import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { CustomPlaylist } from '../../types'
import { isNight } from '../../appearance'
import { type SoundId, SOUNDS } from '../../widgets/ambient'
import { customToPlaylist, PRESET_PLAYLISTS, type Playlist } from '../../widgets/playlists'
import type { Ambient } from '../../widgets/useAmbient'
import AmbientScene from '../AmbientScene'
import {
  AudioLines,
  AudioWaveform,
  CloudRain,
  Flame,
  Music,
  Play,
  Radio,
  Tv,
  Waves,
  Wind,
  X
} from 'lucide-react'

const SOUND_ICONS: Record<SoundId, LucideIcon> = {
  rain: CloudRain,
  fire: Flame,
  waves: Waves,
  wind: Wind,
  white: Radio,
  brown: AudioWaveform
}

interface SoundsPanelProps {
  ambient: Ambient
  customPlaylists: CustomPlaylist[]
  currentPlaylistId?: string
  onPlay: (playlist: Playlist) => void
  onManagePlaylists: () => void
  onClose: () => void
}

function PlaylistCard({
  playlist,
  playing,
  onPlay
}: {
  playlist: Playlist
  playing: boolean
  onPlay: () => void
}): React.JSX.Element {
  return (
    <button className={playing ? 'playlist-card playing' : 'playlist-card'} onClick={onPlay}>
      {playlist.thumbnail ? (
        <img className="playlist-thumb" src={playlist.thumbnail} alt="" />
      ) : (
        <span className="playlist-thumb playlist-thumb-icon">
          {playlist.liveChannel ? <Tv /> : <Music />}
        </span>
      )}
      <span className="playlist-info">
        <span className="playlist-badges">
          <span className={`badge badge-${playlist.source}`}>
            {playlist.source === 'youtube' ? 'YouTube' : 'Spotify'}
          </span>
          {playlist.liveChannel && <span className="badge">En vivo</span>}
          {playing && <span className="badge">Sonando</span>}
        </span>
        <span className="playlist-title">{playlist.title}</span>
        <span className="playlist-subtitle">{playlist.subtitle}</span>
      </span>
      <span className="playlist-play">{playing ? <AudioLines /> : <Play />}</span>
    </button>
  )
}

function SoundsPanel({
  ambient,
  customPlaylists,
  currentPlaylistId,
  onPlay,
  onManagePlaylists,
  onClose
}: SoundsPanelProps): React.JSX.Element {
  const [tab, setTab] = useState<'sounds' | 'playlists'>('sounds')
  const active = SOUNDS.filter((sound) => ambient.levels[sound.id] !== undefined)
  const custom = customPlaylists
    .map(customToPlaylist)
    .filter((playlist): playlist is Playlist => playlist !== null)
  const groups: [string, Playlist[]][] = [
    ['Tus playlists', custom],
    ['YouTube', PRESET_PLAYLISTS.filter((playlist) => playlist.source === 'youtube')],
    ['Spotify', PRESET_PLAYLISTS.filter((playlist) => playlist.source === 'spotify')]
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="sounds-panel" onClick={(event) => event.stopPropagation()}>
        <header className="sounds-header">
          <div>
            <h2>Sonidos y música</h2>
            <p>Sonidos ambientales y tus playlists, en un solo lugar.</p>
          </div>
          <button className="modal-close" title="Cerrar" onClick={onClose}>
            <X />
          </button>
        </header>

        <nav className="sounds-tabs">
          <button className={tab === 'sounds' ? 'selected' : ''} onClick={() => setTab('sounds')}>
            Sonidos
          </button>
          <button
            className={tab === 'playlists' ? 'selected' : ''}
            onClick={() => setTab('playlists')}
          >
            Playlists
          </button>
        </nav>

        <div className="sounds-body">
          {tab === 'sounds' ? (
            <>
              <div className="sounds-scene">
                <AmbientScene
                  sounds={active.map((sound) => sound.id as SoundId)}
                  night={isNight(new Date())}
                />
                <span className="sounds-scene-caption">
                  {active.length > 0
                    ? active.map((sound) => sound.name).join(' + ')
                    : 'Elige sonidos para crear tu ambiente'}
                </span>
              </div>
              <div className="sound-grid">
                {SOUNDS.map((sound) => {
                  const volume = ambient.levels[sound.id]
                  const on = volume !== undefined
                  return (
                    <div key={sound.id} className={on ? 'sound-card on' : 'sound-card'}>
                      <button className="sound-toggle" onClick={() => ambient.toggle(sound.id)}>
                        {(() => {
                          const Icon = SOUND_ICONS[sound.id]
                          return <Icon className="sound-icon" />
                        })()}
                        <span>{sound.name}</span>
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        disabled={!on}
                        value={volume ?? 0.5}
                        aria-label={`Volumen de ${sound.name}`}
                        onChange={(event) =>
                          ambient.setVolume(sound.id, Number(event.target.value))
                        }
                      />
                    </div>
                  )
                })}
              </div>
              <p className="sounds-note">
                Combina varios a la vez. Siguen sonando aunque cambies de pestaña. Elige el fondo
                «Tus sonidos» en Personalización para ver esta escena en la página de inicio.
                {Object.keys(ambient.levels).length > 0 && (
                  <button className="link-button" onClick={ambient.stopAll}>
                    Silenciar todo
                  </button>
                )}
              </p>
            </>
          ) : (
            <>
              {groups.map(
                ([label, playlists]) =>
                  playlists.length > 0 && (
                    <section key={label}>
                      <h3 className="sounds-group">{label}</h3>
                      <div className="playlist-grid">
                        {playlists.map((playlist) => (
                          <PlaylistCard
                            key={playlist.id}
                            playlist={playlist}
                            playing={playlist.id === currentPlaylistId}
                            onPlay={() => onPlay(playlist)}
                          />
                        ))}
                      </div>
                    </section>
                  )
              )}
              <p className="sounds-note">
                Spotify reproduce canciones completas si inicias sesión en open.spotify.com.{' '}
                <button className="link-button" onClick={onManagePlaylists}>
                  Añadir mis playlists
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SoundsPanel
