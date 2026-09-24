import type { CustomPlaylist } from '../types'

export interface Playlist {
  id: string
  title: string
  subtitle: string
  source: 'youtube' | 'spotify'
  /** Normal link, used for "open in a tab". */
  url: string
  /** Player-only page loaded in the mini player. */
  embedUrl: string
  thumbnail?: string
  /**
   * YouTube channel handle (e.g. "@LofiGirl") whose current live stream is
   * played. Live video ids change over time, so they're looked up on play.
   */
  liveChannel?: string
}

/** Recognizes YouTube and Spotify links and returns their embeddable form. */
export function parsePlaylistUrl(
  url: string
): Pick<Playlist, 'source' | 'embedUrl' | 'thumbnail'> | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^(www|m|music)\./, '')

  if (host === 'youtube.com' || host === 'youtu.be') {
    const list = parsed.searchParams.get('list')
    const video =
      host === 'youtu.be'
        ? parsed.pathname.slice(1)
        : (parsed.searchParams.get('v') ??
          parsed.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]+)/)?.[1])
    if (video) {
      const { embedUrl, thumbnail } = embedForVideo(video)
      return { source: 'youtube', embedUrl, thumbnail }
    }
    if (list) {
      return {
        source: 'youtube',
        embedUrl: `https://www.youtube.com/embed/videoseries?list=${list}&autoplay=1`
      }
    }
    return null
  }

  if (host === 'open.spotify.com') {
    const match = parsed.pathname.match(
      /^\/(?:intl-\w+\/)?(playlist|album|track|artist|show|episode)\/(\w+)/
    )
    if (match) {
      return {
        source: 'spotify',
        embedUrl: `https://open.spotify.com/embed/${match[1]}/${match[2]}`
      }
    }
  }
  return null
}

function playlist(id: string, title: string, subtitle: string, url: string): Playlist {
  const parsed = parsePlaylistUrl(url)
  if (!parsed) throw new Error(`URL de playlist no válida: ${url}`)
  return { id, title, subtitle, url, ...parsed }
}

function liveChannel(id: string, title: string, subtitle: string, handle: string): Playlist {
  return {
    id,
    title,
    subtitle,
    source: 'youtube',
    url: `https://www.youtube.com/${handle}/live`,
    embedUrl: '',
    liveChannel: handle
  }
}

export function embedForVideo(videoId: string): Pick<Playlist, 'url' | 'embedUrl' | 'thumbnail'> {
  return {
    url: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
  }
}

export const PRESET_PLAYLISTS: Playlist[] = [
  liveChannel('lofi-girl', 'Lofi Girl Radio', 'beats to relax/study to', '@LofiGirl'),
  liveChannel('chillhop', 'Chillhop Radio', 'jazzy & lofi hip hop beats', '@ChillhopMusic'),
  liveChannel('cafe-jazz', 'Café Jazz', 'Jazz relajante para trabajar', '@CafeMusicBGMchannel'),
  playlist(
    'spotify-lofi',
    'Lofi Beats',
    'Ritmos tranquilos para concentrarte',
    'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn'
  ),
  playlist(
    'spotify-focus',
    'Deep Focus',
    'Música ambiental para concentrarte',
    'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ'
  ),
  playlist(
    'spotify-piano',
    'Peaceful Piano',
    'Piano tranquilo para relajarte',
    'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO'
  ),
  playlist(
    'spotify-jazz',
    'Jazz Vibes',
    'Jazz suave para el día',
    'https://open.spotify.com/playlist/37i9dQZF1DX0SM0LYsmbMT'
  )
]

export function customToPlaylist(custom: CustomPlaylist): Playlist | null {
  const parsed = parsePlaylistUrl(custom.url)
  return parsed
    ? { id: custom.id, title: custom.title, subtitle: 'Añadida por ti', url: custom.url, ...parsed }
    : null
}
