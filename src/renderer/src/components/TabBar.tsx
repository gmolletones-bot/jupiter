import type { Tab } from '../types'

interface TabBarProps {
  tabs: Tab[]
  activeId: number
  onActivate: (id: number) => void
  onClose: (id: number) => void
  onNew: () => void
}

function TabIcon({ tab }: { tab: Tab }): React.JSX.Element {
  if (tab.isLoading) return <span className="tab-icon spinner" />
  if (tab.kind === 'settings') return <span className="tab-icon">⚙</span>
  if (tab.kind === 'newtab') return <span className="tab-icon">🪐</span>
  if (tab.kind === 'history') return <span className="tab-icon">🕘</span>
  if (tab.kind === 'bookmarks') return <span className="tab-icon">★</span>
  if (tab.favicon) {
    return (
      <img
        className="tab-icon"
        src={tab.favicon}
        alt=""
        onError={(event) => (event.currentTarget.style.visibility = 'hidden')}
      />
    )
  }
  return <span className="tab-icon">🌐</span>
}

function TabBar({ tabs, activeId, onActivate, onClose, onNew }: TabBarProps): React.JSX.Element {
  return (
    <nav className="tabbar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={tab.id === activeId ? 'tab active' : 'tab'}
          title={tab.title}
          onMouseDown={(event) => event.button === 0 && onActivate(tab.id)}
          onAuxClick={(event) => event.button === 1 && onClose(tab.id)}
        >
          <TabIcon tab={tab} />
          <span className="tab-title">{tab.title || tab.url}</span>
          <button
            className="tab-close"
            title="Cerrar pestaña (Ctrl+W)"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => onClose(tab.id)}
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-new" title="Nueva pestaña (Ctrl+T)" onClick={onNew}>
        +
      </button>
    </nav>
  )
}

export default TabBar
