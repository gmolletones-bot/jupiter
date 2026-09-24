import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  net,
  session,
  webContents,
  type Input
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { declineGoogleConsent, registerShields, trackShields } from './adblock'
import { handlePageShortcut, savePageAs, showContextMenu } from './contextMenu'
import {
  addExtension,
  listExtensions,
  loadStoredExtensions,
  openExtensionPopup,
  removeExtension
} from './extensions'
import { registerFaviconColors } from './favicon'
import { clearHistory, registerHistory, trackHistory } from './history'
import { migrateFromOldName } from './migrate'
import { registerStore } from './store'
import { applyGpuSwitches, applyMica, registerSystem } from './system'
import { registerUpdater } from './updater'

// Session shared by every tab; kept apart from the app UI so clearing
// browsing data never wipes the browser's own settings.
const BROWSER_PARTITION = 'persist:navegador'

const THEMES: BrowserTheme[] = ['system', 'light', 'dark']

// Must match the tab bar height in main.css. The renderer then keeps the
// colours in sync (set-title-bar) so the native window buttons blend in.
const TAB_BAR_HEIGHT = 40

function titleBarOverlay(): Electron.TitleBarOverlayOptions {
  return nativeTheme.shouldUseDarkColors
    ? { color: '#17181b', symbolColor: '#e6e7ea', height: TAB_BAR_HEIGHT }
    : { color: '#dfe3e8', symbolColor: '#16181d', height: TAB_BAR_HEIGHT }
}

function isPlayerEmbed(url: string): boolean {
  return /^https:\/\/(www\.youtube\.com|open\.spotify\.com)\/embed\//.test(url)
}

const SUGGEST_URLS: Record<string, string> = {
  google: 'https://suggestqueries.google.com/complete/search?client=firefox&hl=es&q=',
  duckduckgo: 'https://duckduckgo.com/ac/?type=list&q=',
  bing: 'https://api.bing.com/osjson.aspx?query='
}

/** What the search engine suggests for a partial query; [] on any problem. */
async function searchSuggestions(engine: string, query: string): Promise<string[]> {
  const base = SUGGEST_URLS[engine]
  if (!base || !query.trim()) return []
  try {
    const response = await net.fetch(base + encodeURIComponent(query), {
      signal: AbortSignal.timeout(2000)
    })
    const data = await response.json()
    return Array.isArray(data?.[1]) ? data[1].filter((s: unknown) => typeof s === 'string') : []
  } catch {
    return []
  }
}

/** Id of the video a YouTube channel is streaming live right now, if any. */
async function youtubeLiveId(handle: string): Promise<string | null> {
  if (!/^@[\w.-]+$/.test(handle)) return null
  try {
    const response = await net.fetch(`https://www.youtube.com/${handle}/live`, {
      headers: { 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' }
    })
    const html = await response.text()
    // While live, the canonical link points at the stream; otherwise at the channel.
    const canonical =
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/
    return html.match(canonical)?.[1] ?? null
  } catch {
    return null
  }
}

function shortcutFor(input: Input): ShortcutAction | null {
  if (input.type !== 'keyDown') return null
  const key = input.key.toLowerCase()
  if (key === 'f5') return 'reload'
  if (key === 'f11') return 'fullscreen'
  if (!(input.control || input.meta) || input.alt) return null
  if (key === 'tab') return input.shift ? 'prev-tab' : 'next-tab'
  // "+" needs Shift on many layouts, so check zoom before the Shift combos.
  if (key === '+' || key === '=') return 'zoom-in'
  if (key === '-') return 'zoom-out'
  if (key === '0') return 'zoom-reset'
  if (input.shift) {
    if (key === 'o') return 'bookmarks'
    if (key === 'b') return 'toggle-bookmarks-bar'
    if (key === 'delete') return 'clear-data'
    return null
  }
  switch (key) {
    case 't':
      return 'new-tab'
    case 'w':
      return 'close-tab'
    case 'l':
      return 'focus-address'
    case 'r':
      return 'reload'
    case ',':
      return 'settings'
    case 'h':
      return 'history'
    case 'd':
      return 'bookmark-page'
    case 'f':
      return 'find'
    default:
      return null
  }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    // No native title bar: the tabs take its place, like Chrome or Brave.
    titleBarStyle: 'hidden',
    ...(process.platform !== 'darwin' ? { titleBarOverlay: titleBarOverlay() } : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    }
  })

  applyMica(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

migrateFromOldName()
applyGpuSwitches()

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.jupiter.browser')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerStore()
  registerSystem()
  registerUpdater()
  registerHistory()

  ipcMain.on('set-theme', (_, theme: BrowserTheme) => {
    if (THEMES.includes(theme)) nativeTheme.themeSource = theme
  })

  ipcMain.on('set-title-bar', (event, colors: { color: string; symbolColor: string }) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window && process.platform !== 'darwin') {
      window.setTitleBarOverlay({ ...colors, height: TAB_BAR_HEIGHT })
    }
  })

  const browserSession = session.fromPartition(BROWSER_PARTITION)
  registerShields(browserSession, join(__dirname, '../preload/shields.js'))
  registerFaviconColors(browserSession)

  ipcMain.on('window:toggle-fullscreen', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.setFullScreen(!window.isFullScreen())
  })

  ipcMain.on('app:quit', () => app.quit())

  ipcMain.handle('page:save', async (_, contentsId: number) => {
    const contents = webContents.fromId(contentsId)
    if (contents && contents.getType() === 'webview') await savePageAs(contents)
  })

  ipcMain.handle('clear-browsing-data', async () => {
    await browserSession.clearStorageData()
    await browserSession.clearCache()
    clearHistory()
    await declineGoogleConsent(browserSession)
  })

  ipcMain.handle('youtube:live-id', (_, handle: string) => youtubeLiveId(handle))
  ipcMain.handle('suggest:search', (_, engine: string, query: string) =>
    searchSuggestions(engine, query)
  )

  ipcMain.handle('extensions:list', () => listExtensions(browserSession))
  ipcMain.handle('extensions:add', (event) =>
    addExtension(browserSession, BrowserWindow.fromWebContents(event.sender))
  )
  ipcMain.handle('extensions:remove', (_, id: string) => removeExtension(browserSession, id))
  ipcMain.on(
    'extensions:open-popup',
    (event, popupUrl: string, anchor: { x: number; y: number }) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window && popupUrl.startsWith('chrome-extension://')) {
        openExtensionPopup(window, BROWSER_PARTITION, popupUrl, anchor)
      }
    }
  )

  // Extensions must be in place before the first tab loads.
  await loadStoredExtensions(browserSession)

  app.on('web-contents-created', (_, contents) => {
    // Web pages loaded in a <webview> must never get Node access or our preload.
    contents.on('will-attach-webview', (_event, webPreferences, params) => {
      delete webPreferences.preload
      webPreferences.nodeIntegration = false
      webPreferences.contextIsolation = true
      // The mini player only loads YouTube/Spotify embeds and starts them on
      // the user's click in the sounds panel, so let them play right away.
      if (isPlayerEmbed(params.src)) webPreferences.autoplayPolicy = 'no-user-gesture-required'
    })

    const type = contents.getType()
    if (type !== 'window' && type !== 'webview') return
    const host = type === 'webview' ? contents.hostWebContents : contents
    if (!host) return

    // Popups, target="_blank" and Ctrl+click links open as a new tab.
    if (type === 'webview') {
      trackHistory(contents)
      trackShields(contents, host)
      // Ctrl + mouse wheel zooms the page, like the keyboard shortcuts.
      contents.on('zoom-changed', (_event, direction) =>
        host.send('shortcut', direction === 'in' ? 'zoom-in' : 'zoom-out')
      )
      contents.setWindowOpenHandler(({ url, disposition }) => {
        if (/^https?:\/\//i.test(url)) {
          host.send('open-in-new-tab', url, disposition !== 'background-tab')
        }
        return { action: 'deny' }
      })
    }

    contents.on('context-menu', (_event, params) => showContextMenu(contents, host, params))

    // Shortcuts are caught here so they also work while a web page has focus.
    contents.on('before-input-event', (event, input) => {
      if (type === 'webview' && handlePageShortcut(contents, input)) {
        event.preventDefault()
        return
      }
      const action = shortcutFor(input)
      if (!action) return
      event.preventDefault()
      host.send('shortcut', action)
    })
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
