import { app, BrowserWindow, dialog, type Extension, type Session } from 'electron'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { extname, join } from 'path'

// Chrome extensions are loaded unpacked (a folder with manifest.json) into the
// browsing session. Electron implements only part of the chrome.* APIs, so
// content-script extensions work best; popups that rely on chrome.tabs may not.

const STORE_FILE = join(app.getPath('userData'), 'extensions.json')

const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

async function readStoredPaths(): Promise<string[]> {
  try {
    const paths = JSON.parse(await readFile(STORE_FILE, 'utf-8'))
    return Array.isArray(paths) ? paths.filter((path) => typeof path === 'string') : []
  } catch {
    return []
  }
}

async function storePaths(browserSession: Session): Promise<void> {
  const paths = browserSession.extensions.getAllExtensions().map((extension) => extension.path)
  await writeFile(STORE_FILE, JSON.stringify(paths, null, 2))
}

export async function loadStoredExtensions(browserSession: Session): Promise<void> {
  for (const path of await readStoredPaths()) {
    try {
      await browserSession.extensions.loadExtension(path, { allowFileAccess: true })
    } catch (error) {
      console.error(`No se pudo cargar la extensión ${path}:`, error)
    }
  }
}

/** Resolves "__MSG_key__" placeholders from the extension's default locale. */
async function localize(extension: Extension, text: string | undefined): Promise<string> {
  const match = text?.match(/^__MSG_(.+)__$/)
  if (!text || !match) return text ?? ''
  const locale = extension.manifest.default_locale ?? 'en'
  try {
    const messages = JSON.parse(
      await readFile(join(extension.path, '_locales', locale, 'messages.json'), 'utf-8')
    )
    const key = Object.keys(messages).find((k) => k.toLowerCase() === match[1].toLowerCase())
    return key ? messages[key].message : text
  } catch {
    return text
  }
}

function actionOf(extension: Extension): { default_popup?: string; default_icon?: unknown } {
  const { manifest } = extension
  return manifest.action ?? manifest.browser_action ?? manifest.page_action ?? {}
}

/** Picks the icon closest to 32px and returns it as a data URL the UI can show. */
async function iconOf(extension: Extension): Promise<string | undefined> {
  const actionIcon = actionOf(extension).default_icon
  const icons: Record<string, string> =
    typeof actionIcon === 'string'
      ? { '32': actionIcon }
      : { ...extension.manifest.icons, ...(actionIcon as Record<string, string>) }
  const sizes = Object.keys(icons).sort(
    (a, b) => Math.abs(Number(a) - 32) - Math.abs(Number(b) - 32)
  )
  for (const size of sizes) {
    const file = join(extension.path, icons[size])
    const type = IMAGE_TYPES[extname(file).toLowerCase()]
    if (!type || !existsSync(file)) continue
    return `data:${type};base64,${(await readFile(file)).toString('base64')}`
  }
  return undefined
}

async function describe(extension: Extension): Promise<ExtensionInfo> {
  const popup = actionOf(extension).default_popup
  return {
    id: extension.id,
    name: await localize(extension, extension.name),
    version: extension.version,
    description: await localize(extension, extension.manifest.description),
    path: extension.path,
    icon: await iconOf(extension),
    popupUrl: popup ? `chrome-extension://${extension.id}/${popup.replace(/^\//, '')}` : undefined
  }
}

export function listExtensions(browserSession: Session): Promise<ExtensionInfo[]> {
  return Promise.all(browserSession.extensions.getAllExtensions().map(describe))
}

export async function addExtension(
  browserSession: Session,
  window: BrowserWindow | null
): Promise<ExtensionResult> {
  const options = {
    title: 'Selecciona la carpeta de la extensión (la que contiene manifest.json)',
    properties: ['openDirectory' as const]
  }
  const { canceled, filePaths } = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  if (canceled || filePaths.length === 0) return { ok: true }

  const path = filePaths[0]
  if (!existsSync(join(path, 'manifest.json'))) {
    return { ok: false, error: 'Esa carpeta no contiene un manifest.json.' }
  }
  try {
    await browserSession.extensions.loadExtension(path, { allowFileAccess: true })
    await storePaths(browserSession)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function removeExtension(browserSession: Session, id: string): Promise<void> {
  browserSession.extensions.removeExtension(id)
  await storePaths(browserSession)
}

/** Shows an extension's popup in a small frameless window under its toolbar button. */
export function openExtensionPopup(
  parent: BrowserWindow,
  partition: string,
  popupUrl: string,
  anchor: { x: number; y: number }
): void {
  const bounds = parent.getContentBounds()
  const popup = new BrowserWindow({
    parent,
    x: Math.round(bounds.x + anchor.x - 360),
    y: Math.round(bounds.y + anchor.y + 4),
    width: 360,
    height: 480,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: { partition, sandbox: true, contextIsolation: true }
  })

  popup.webContents.setWindowOpenHandler(({ url }) => {
    parent.webContents.send('open-in-new-tab', url, true)
    return { action: 'deny' }
  })

  // Size the window to the popup's content, like Chrome does (max 800x600).
  popup.webContents.once('did-finish-load', async () => {
    try {
      const size = await popup.webContents.executeJavaScript(
        '[document.documentElement.scrollWidth, document.documentElement.scrollHeight]'
      )
      const [width, height] = [Math.min(Math.max(size[0], 120), 800), Math.min(size[1], 600)]
      popup.setBounds({
        x: Math.round(bounds.x + anchor.x - width),
        y: Math.round(bounds.y + anchor.y + 4),
        width,
        height: Math.max(height, 40)
      })
    } catch {
      // Keep the default size.
    }
    popup.show()
  })

  popup.on('blur', () => {
    if (!popup.isDestroyed()) popup.close()
  })
  popup.loadURL(popupUrl)
}
