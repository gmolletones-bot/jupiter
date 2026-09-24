import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BookmarkPlus,
  Check,
  Command,
  EllipsisVertical,
  History,
  LogOut,
  Maximize,
  Minus,
  PanelTop,
  Plus,
  Printer,
  Puzzle,
  Save,
  Search,
  Settings,
  Star,
  Trash2,
  Wrench,
  ZoomIn
} from 'lucide-react'

type MenuEntry =
  | {
      action: ShortcutAction
      icon: LucideIcon
      label: string
      shortcut?: string
      checkable?: boolean
      /** Only makes sense on a web page (not on Jupiter's own pages). */
      webOnly?: boolean
    }
  | 'separator'
  | 'zoom'

const ENTRIES: MenuEntry[] = [
  { action: 'new-tab', icon: Plus, label: 'Nueva pestaña', shortcut: 'Ctrl+T' },
  { action: 'command-palette', icon: Command, label: 'Paleta de comandos', shortcut: 'Ctrl+K' },
  'separator',
  { action: 'history', icon: History, label: 'Historial', shortcut: 'Ctrl+H' },
  { action: 'bookmarks', icon: Star, label: 'Marcadores', shortcut: 'Ctrl+Mayús+O' },
  {
    action: 'bookmark-page',
    icon: BookmarkPlus,
    label: 'Añadir página a marcadores',
    shortcut: 'Ctrl+D',
    webOnly: true
  },
  {
    action: 'toggle-bookmarks-bar',
    icon: PanelTop,
    label: 'Mostrar barra de marcadores',
    shortcut: 'Ctrl+Mayús+B',
    checkable: true
  },
  { action: 'extensions', icon: Puzzle, label: 'Extensiones' },
  {
    action: 'clear-data',
    icon: Trash2,
    label: 'Eliminar datos de navegación…',
    shortcut: 'Ctrl+Mayús+Supr'
  },
  'separator',
  'zoom',
  'separator',
  {
    action: 'find',
    icon: Search,
    label: 'Buscar en la página…',
    shortcut: 'Ctrl+F',
    webOnly: true
  },
  { action: 'print', icon: Printer, label: 'Imprimir…', shortcut: 'Ctrl+P', webOnly: true },
  {
    action: 'save-page',
    icon: Save,
    label: 'Guardar página como…',
    shortcut: 'Ctrl+S',
    webOnly: true
  },
  {
    action: 'devtools',
    icon: Wrench,
    label: 'Herramientas para desarrolladores',
    shortcut: 'Ctrl+Mayús+I',
    webOnly: true
  },
  'separator',
  { action: 'settings', icon: Settings, label: 'Configuración', shortcut: 'Ctrl+,' },
  { action: 'quit', icon: LogOut, label: 'Salir' }
]

interface AppMenuProps {
  bookmarksBarVisible: boolean
  /** Whether the active tab is a web page. */
  isWeb: boolean
  zoom: number
  onAction: (action: ShortcutAction) => void
}

/** The ⋮ menu, drawn by us so it lines up under its button and follows the theme. */
function AppMenu({ bookmarksBarVisible, isWeb, zoom, onAction }: AppMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  const run = (action: ShortcutAction, keepOpen = false): void => {
    if (!keepOpen) setOpen(false)
    onAction(action)
  }

  return (
    <div className="app-menu-anchor">
      <button
        className={open ? 'nav-button selected' : 'nav-button'}
        title="Personaliza y controla Jupiter"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <EllipsisVertical />
      </button>
      {open && (
        <>
          {/* Covers the page (webviews included) so any click outside closes the menu. */}
          <div className="app-menu-backdrop" onMouseDown={() => setOpen(false)} />
          <div className="app-menu" role="menu">
            {ENTRIES.map((entry, index) => {
              if (entry === 'separator') return <div key={index} className="app-menu-separator" />
              if (entry === 'zoom') {
                return (
                  <div key="zoom" className="app-menu-item app-menu-zoom">
                    <span className="app-menu-check">
                      <ZoomIn />
                    </span>
                    <span className="app-menu-label">Zoom</span>
                    <span className="zoom-controls">
                      <button
                        disabled={!isWeb}
                        title="Alejar (Ctrl+-)"
                        onClick={() => run('zoom-out', true)}
                      >
                        <Minus />
                      </button>
                      <button
                        className="zoom-value"
                        disabled={!isWeb}
                        title="Restablecer (Ctrl+0)"
                        onClick={() => run('zoom-reset', true)}
                      >
                        {Math.round(zoom * 100)} %
                      </button>
                      <button
                        disabled={!isWeb}
                        title="Acercar (Ctrl++)"
                        onClick={() => run('zoom-in', true)}
                      >
                        <Plus />
                      </button>
                      <span className="zoom-divider" />
                      <button title="Pantalla completa (F11)" onClick={() => run('fullscreen')}>
                        <Maximize />
                      </button>
                    </span>
                  </div>
                )
              }
              const disabled = entry.webOnly && !isWeb
              return (
                <button
                  key={entry.action}
                  role={entry.checkable ? 'menuitemcheckbox' : 'menuitem'}
                  aria-checked={entry.checkable ? bookmarksBarVisible : undefined}
                  className="app-menu-item"
                  disabled={disabled}
                  onClick={() => run(entry.action)}
                >
                  <span className="app-menu-check">
                    {entry.checkable ? bookmarksBarVisible && <Check /> : <entry.icon />}
                  </span>
                  <span className="app-menu-label">{entry.label}</span>
                  {entry.shortcut && <span className="app-menu-shortcut">{entry.shortcut}</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default AppMenu
