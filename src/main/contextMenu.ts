import {
  BrowserWindow,
  clipboard,
  dialog,
  Menu,
  type ContextMenuParams,
  type Input,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron'

export async function savePageAs(contents: WebContents): Promise<void> {
  const window = BrowserWindow.fromWebContents(contents.hostWebContents ?? contents)
  const name = (contents.getTitle() || 'pagina').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)
  const options = {
    defaultPath: `${name}.html`,
    filters: [{ name: 'Página web completa', extensions: ['html', 'htm'] }]
  }
  const { canceled, filePath } = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return
  await contents.savePage(filePath, 'HTMLComplete')
}

/** Page-level shortcuts (the ones shown in the context menu); returns true when handled. */
export function handlePageShortcut(contents: WebContents, input: Input): boolean {
  if (input.type !== 'keyDown') return false
  const history = contents.navigationHistory
  const mod = input.control || input.meta

  if (input.alt && !mod && input.key === 'ArrowLeft') {
    if (history.canGoBack()) history.goBack()
  } else if (input.alt && !mod && input.key === 'ArrowRight') {
    if (history.canGoForward()) history.goForward()
  } else if (mod && !input.shift && input.key.toLowerCase() === 's') {
    savePageAs(contents).catch(console.error)
  } else if (mod && !input.shift && input.key.toLowerCase() === 'p') {
    contents.print()
  } else if (input.key === 'F12' || (mod && input.shift && input.key.toLowerCase() === 'i')) {
    contents.toggleDevTools()
  } else {
    return false
  }
  return true
}

function truncate(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, ' ')
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

/**
 * Right-click menu for web pages (webviews) and for the browser UI itself,
 * where only the text-editing entries make sense.
 */
export function showContextMenu(
  contents: WebContents,
  host: WebContents,
  params: ContextMenuParams
): void {
  const isPage = contents.getType() === 'webview'
  const selection = params.selectionText.trim()
  const items: MenuItemConstructorOptions[] = []
  const section = (entries: MenuItemConstructorOptions[]): void => {
    if (entries.length === 0) return
    if (items.length > 0) items.push({ type: 'separator' })
    items.push(...entries)
  }

  if (params.misspelledWord) {
    const suggestions = params.dictionarySuggestions.slice(0, 5)
    section(
      suggestions.length > 0
        ? suggestions.map((word) => ({
            label: word,
            click: () => contents.replaceMisspelling(word)
          }))
        : [{ label: 'Sin sugerencias', enabled: false }]
    )
  }

  if (isPage && params.linkURL) {
    section([
      {
        label: 'Abrir enlace en pestaña nueva',
        click: () => host.send('open-in-new-tab', params.linkURL, false)
      },
      {
        label: 'Copiar dirección del enlace',
        click: () => clipboard.writeText(params.linkURL)
      }
    ])
  }

  if (isPage && params.mediaType === 'image' && params.srcURL) {
    section([
      {
        label: 'Abrir imagen en pestaña nueva',
        click: () => host.send('open-in-new-tab', params.srcURL, false)
      },
      { label: 'Guardar imagen como…', click: () => contents.downloadURL(params.srcURL) },
      { label: 'Copiar imagen', click: () => contents.copyImageAt(params.x, params.y) },
      {
        label: 'Copiar dirección de la imagen',
        click: () => clipboard.writeText(params.srcURL)
      }
    ])
  }

  if (params.isEditable) {
    const { editFlags } = params
    section([
      {
        label: 'Deshacer',
        accelerator: 'CmdOrCtrl+Z',
        enabled: editFlags.canUndo,
        click: () => contents.undo()
      },
      {
        label: 'Rehacer',
        accelerator: 'CmdOrCtrl+Y',
        enabled: editFlags.canRedo,
        click: () => contents.redo()
      },
      { type: 'separator' },
      {
        label: 'Cortar',
        accelerator: 'CmdOrCtrl+X',
        enabled: editFlags.canCut,
        click: () => contents.cut()
      },
      {
        label: 'Copiar',
        accelerator: 'CmdOrCtrl+C',
        enabled: editFlags.canCopy,
        click: () => contents.copy()
      },
      {
        label: 'Pegar',
        accelerator: 'CmdOrCtrl+V',
        enabled: editFlags.canPaste,
        click: () => contents.paste()
      },
      {
        label: 'Seleccionar todo',
        accelerator: 'CmdOrCtrl+A',
        enabled: editFlags.canSelectAll,
        click: () => contents.selectAll()
      }
    ])
  } else if (selection) {
    section([
      { label: 'Copiar', accelerator: 'CmdOrCtrl+C', click: () => contents.copy() },
      ...(isPage
        ? [
            {
              label: `Buscar «${truncate(selection, 30)}» en la web`,
              click: () => host.send('search-in-new-tab', selection)
            }
          ]
        : [])
    ])
  }

  const onPlainPage =
    isPage && !params.linkURL && params.mediaType === 'none' && !params.isEditable && !selection
  if (onPlainPage) {
    const history = contents.navigationHistory
    section([
      {
        label: 'Atrás',
        accelerator: 'Alt+Left',
        enabled: history.canGoBack(),
        click: () => history.goBack()
      },
      {
        label: 'Adelante',
        accelerator: 'Alt+Right',
        enabled: history.canGoForward(),
        click: () => history.goForward()
      },
      { label: 'Volver a cargar', accelerator: 'CmdOrCtrl+R', click: () => contents.reload() }
    ])
    section([
      {
        label: 'Guardar como…',
        accelerator: 'CmdOrCtrl+S',
        click: () => savePageAs(contents).catch(console.error)
      },
      { label: 'Imprimir…', accelerator: 'CmdOrCtrl+P', click: () => contents.print() }
    ])
  }

  if (isPage) {
    section([
      {
        label: 'Inspeccionar',
        accelerator: 'CmdOrCtrl+Shift+I',
        click: () => contents.inspectElement(params.x, params.y)
      }
    ])
  }

  if (items.length === 0) return
  const window = BrowserWindow.fromWebContents(host)
  Menu.buildFromTemplate(items).popup(window ? { window } : {})
}
