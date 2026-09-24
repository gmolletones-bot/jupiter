import type { Tab } from '../types'
import { Globe, History, Orbit, Plus, Settings, Star, X } from 'lucide-react'

interface TabBarProps {
  tabs: Tab[]
  activeId: number
  onActivate: (id: number) => void
  onClose: (id: number) => void
  onNew: () => void
}

function TabIcon({ tab }: { tab: Tab }): React.JSX.Element {
  if (tab.isLoading) return <span className="tab-icon spinner" />
  if (tab.kind === 'settings') return <Settings className="tab-icon" />
  if (tab.kind === 'newtab') return <Orbit className="tab-icon" />
  if (tab.kind === 'history') return <History className="tab-icon" />
  if (tab.kind === 'bookmarks') return <Star className="tab-icon" />
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
  return <Globe className="tab-icon" />
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
            <X />
          </button>
        </div>
      ))}
      <button className="tab-new" title="Nueva pestaña (Ctrl+T)" onClick={onNew}>
        <Plus />
      </button>
    </nav>
  )
}

export default TabBar
