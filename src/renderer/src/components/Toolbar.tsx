import type { Bookmark, SearchEngine, Tab } from '../types'
import { exactHostOf } from '../url'
import AddressBar from './AddressBar'
import AppMenu from './AppMenu'
import ShieldsButton from './ShieldsButton'

interface ToolbarProps {
  tab: Tab
  extensions: ExtensionInfo[]
  isBookmarked: boolean
  bookmarks: Bookmark[]
  searchEngine: SearchEngine
  searchSuggestions: boolean
  inputRef: React.Ref<HTMLInputElement>
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onHome: () => void
  onAddressChange: (address: string) => void
  onNavigate: (address: string) => void
  onToggleBookmark: () => void
  bookmarksBarVisible: boolean
  onMenuAction: (action: ShortcutAction) => void
  shields: ShieldsState
  /** Ads and trackers blocked on the active tab's page. */
  blocked: number
  onSetSiteShields: (site: string, shieldsUp: boolean) => void
  onEnableShields: () => void
}

function Toolbar({
  tab,
  extensions,
  isBookmarked,
  bookmarks,
  searchEngine,
  searchSuggestions,
  inputRef,
  onBack,
  onForward,
  onReload,
  onHome,
  onAddressChange,
  onNavigate,
  onToggleBookmark,
  bookmarksBarVisible,
  onMenuAction,
  shields,
  blocked,
  onSetSiteShields,
  onEnableShields
}: ToolbarProps): React.JSX.Element {
  const isWeb = tab.kind === 'web'

  return (
    <header className="toolbar">
      <button className="nav-button" title="Atrás" disabled={!tab.canGoBack} onClick={onBack}>
        ←
      </button>
      <button
        className="nav-button"
        title="Adelante"
        disabled={!tab.canGoForward}
        onClick={onForward}
      >
        →
      </button>
      <button
        className="nav-button"
        title={tab.isLoading ? 'Detener' : 'Recargar (Ctrl+R)'}
        disabled={!isWeb}
        onClick={onReload}
      >
        {tab.isLoading ? '✕' : '↻'}
      </button>
      <button className="nav-button" title="Página de inicio" onClick={onHome}>
        ⌂
      </button>

      <AddressBar
        key={tab.id}
        tab={tab}
        inputRef={inputRef}
        bookmarks={bookmarks}
        searchEngine={searchEngine}
        searchSuggestions={searchSuggestions}
        onAddressChange={onAddressChange}
        onNavigate={onNavigate}
      >
        {isWeb && (
          <button
            type="button"
            className={isBookmarked ? 'bookmark-star on' : 'bookmark-star'}
            title={isBookmarked ? 'Quitar de marcadores (Ctrl+D)' : 'Añadir a marcadores (Ctrl+D)'}
            onClick={onToggleBookmark}
          >
            {isBookmarked ? '★' : '☆'}
          </button>
        )}
      </AddressBar>

      {extensions
        .filter((extension) => extension.popupUrl)
        .map((extension) => (
          <button
            key={extension.id}
            className="nav-button extension-button"
            title={extension.name}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              window.api.openExtensionPopup(extension.popupUrl!, {
                x: rect.right,
                y: rect.bottom
              })
            }}
          >
            {extension.icon ? <img src={extension.icon} alt="" /> : '🧩'}
          </button>
        ))}

      <ShieldsButton
        site={isWeb ? exactHostOf(tab.url) : ''}
        blocked={blocked}
        shields={shields}
        onSetSite={onSetSiteShields}
        onEnable={onEnableShields}
        onOpenSettings={() => onMenuAction('clear-data')}
      />

      <AppMenu
        bookmarksBarVisible={bookmarksBarVisible}
        isWeb={isWeb}
        zoom={tab.zoom ?? 1}
        onAction={onMenuAction}
      />

      {tab.isLoading && <div className="progress" />}
    </header>
  )
}

export default Toolbar
