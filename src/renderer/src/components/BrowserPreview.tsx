import { activeWallpaper, formatTime, isLightWallpaper } from '../appearance'
import type { Settings, StoredWallpaper } from '../types'
import Wallpaper from './Wallpaper'

interface BrowserPreviewProps {
  settings: Settings
  wallpapers: StoredWallpaper[]
}

/** Miniature, live-updating mock of the browser for the personalization page. */
function BrowserPreview({ settings, wallpapers }: BrowserPreviewProps): React.JSX.Element {
  const now = new Date()
  const wallpaper = activeWallpaper(settings, now)
  const { time, suffix } = formatTime(now, settings.clockFormat)

  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-tabbar">
        <span className="preview-tab active">Nueva pestaña</span>
        <span className="preview-tab">GitHub</span>
        <span className="preview-dots">
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="preview-toolbar">
        <span className="preview-nav" />
        <span className="preview-nav" />
        <span className="preview-address" />
      </div>
      <div className="preview-page">
        <Wallpaper wallpaper={wallpaper} images={wallpapers} />
        <div className={isLightWallpaper(wallpaper) ? 'preview-ntp' : 'preview-ntp on-wallpaper'}>
          {settings.showClock && (
            <div className="preview-clock">
              {time}
              {suffix && <small> {suffix}</small>}
            </div>
          )}
          <div className="preview-search" />
          {settings.showShortcuts && (
            <div className="preview-tiles">
              {settings.shortcuts.slice(0, 5).map((shortcut) => (
                <span key={shortcut.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BrowserPreview
