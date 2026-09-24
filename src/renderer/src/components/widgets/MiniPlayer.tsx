import { useState } from 'react'
import type { Playlist } from '../../widgets/playlists'
import { ChevronDown, ChevronUp, ExternalLink, Music, X } from 'lucide-react'

interface MiniPlayerProps {
  playlist: Playlist
  onOpenInTab: (url: string) => void
  onClose: () => void
}

/**
 * Floating player for YouTube/Spotify embeds. Lives outside the tabs so the
 * music keeps playing while browsing; minimizing only hides it visually.
 */
function MiniPlayer({ playlist, onOpenInTab, onClose }: MiniPlayerProps): React.JSX.Element {
  const [minimized, setMinimized] = useState(false)

  return (
    <div className={`mini-player mini-player-${playlist.source}${minimized ? ' minimized' : ''}`}>
      <header className="mini-player-header">
        <Music className="mini-player-note" />
        <span className="mini-player-title" title={playlist.title}>
          {playlist.title}
        </span>
        <button
          title={minimized ? 'Mostrar reproductor' : 'Minimizar'}
          onClick={() => setMinimized(!minimized)}
        >
          {minimized ? <ChevronUp /> : <ChevronDown />}
        </button>
        <button title="Abrir en una pestaña" onClick={() => onOpenInTab(playlist.url)}>
          <ExternalLink />
        </button>
        <button title="Cerrar reproductor" onClick={onClose}>
          <X />
        </button>
      </header>
      <webview
        className="mini-player-view"
        src={playlist.embedUrl}
        // <webview>-specific attributes the React lint rule doesn't know about.
        // eslint-disable-next-line react/no-unknown-property
        partition="persist:navegador"
        // YouTube refuses embeds without a referrer (error 153) and also when the
        // referrer is YouTube itself (error 152), so identify as Jupiter. The
        // .browser TLD doesn't exist, so this can't point at anyone's site.
        // eslint-disable-next-line react/no-unknown-property
        httpreferrer="https://jupiter.browser/"
      />
    </div>
  )
}

export default MiniPlayer
