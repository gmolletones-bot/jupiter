import { useEffect, useRef, useState } from 'react'
import { activeWallpaper, formatTime, greetingFor, isLightWallpaper } from '../appearance'
import type { Settings, SettingsSection, Shortcut, StoredWallpaper } from '../types'
import { hostnameOf, SEARCH_ENGINES, toUrl } from '../url'
import type { SoundId } from '../widgets/ambient'
import type { Playlist } from '../widgets/playlists'
import type { Ambient } from '../widgets/useAmbient'
import type { Pomodoro } from '../widgets/usePomodoro'
import Favicon from './Favicon'
import Wallpaper from './Wallpaper'
import FocusWidget from './widgets/FocusWidget'
import SoundsPanel from './widgets/SoundsPanel'
import WeatherWidget from './widgets/WeatherWidget'
import { Music, Plus, Search, Sparkles, X } from 'lucide-react'

const MAX_SHORTCUTS = 12

interface NewTabPageProps {
  settings: Settings
  wallpapers: StoredWallpaper[]
  active: boolean
  pomodoro: Pomodoro
  ambient: Ambient
  currentPlaylistId?: string
  onPlay: (playlist: Playlist) => void
  onNavigate: (input: string) => void
  onChange: (patch: Partial<Settings>) => void
  onOpenSettings: (section: SettingsSection) => void
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function ShortcutTile({
  shortcut,
  onOpen,
  onRemove
}: {
  shortcut: Shortcut
  onOpen: () => void
  onRemove: () => void
}): React.JSX.Element {
  return (
    <div className="tile" role="link" tabIndex={0} title={shortcut.url} onClick={onOpen}>
      <button
        className="tile-remove"
        title="Quitar acceso directo"
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
      >
        <X />
      </button>
      <span className="tile-icon">
        <Favicon url={shortcut.url} className="tile-favicon" />
      </span>
      <span className="tile-title">{shortcut.title || hostnameOf(shortcut.url)}</span>
    </div>
  )
}

function NewTabPage({
  settings,
  wallpapers,
  active,
  pomodoro,
  ambient,
  currentPlaylistId,
  onPlay,
  onNavigate,
  onChange,
  onOpenSettings
}: NewTabPageProps): React.JSX.Element {
  const now = useNow()
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [soundsOpen, setSoundsOpen] = useState(false)
  const [draft, setDraft] = useState({ title: '', url: '' })

  // Like Chrome, typing goes straight to the search box when the page is shown.
  useEffect(() => {
    if (active) searchRef.current?.focus()
  }, [active])

  const wallpaper = activeWallpaper(settings, now)
  const onWallpaper = !isLightWallpaper(wallpaper)
  const { time, suffix } = formatTime(now, settings.clockFormat)
  const { greeting, phrase } = greetingFor(now)
  const name = settings.userName.trim()
  const fullGreeting = name ? `${greeting}, ${name}` : greeting
  const dateText = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
  const soundsPlaying = Object.keys(ambient.levels).length > 0 || Boolean(currentPlaylistId)

  const addShortcut = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!draft.url.trim()) return
    const url = toUrl(draft.url, settings.searchEngine)
    const shortcut = { id: crypto.randomUUID(), title: draft.title.trim(), url }
    onChange({ shortcuts: [...settings.shortcuts, shortcut] })
    setDraft({ title: '', url: '' })
    setAdding(false)
  }

  return (
    <div className={active ? 'page ntp' : 'page ntp hidden'}>
      <Wallpaper
        wallpaper={wallpaper}
        images={wallpapers}
        sounds={Object.keys(ambient.levels) as SoundId[]}
      />

      <div className={onWallpaper ? 'ntp-content on-wallpaper' : 'ntp-content'}>
        {settings.showSounds && (
          <button
            className={soundsPlaying ? 'ntp-corner-button playing' : 'ntp-corner-button'}
            title="Sonidos y música"
            onClick={() => setSoundsOpen(true)}
          >
            <Music />
          </button>
        )}

        <main className="ntp-center">
          {settings.showClock && (
            <header className="ntp-hero">
              <div className="ntp-clock">
                {time}
                {suffix && <span className="ntp-clock-suffix">{suffix}</span>}
              </div>
              <div className="ntp-date">{dateText}</div>
              {settings.greetingStyle === 'classic' && (
                <div className="ntp-greeting">{fullGreeting}</div>
              )}
            </header>
          )}

          {settings.showWeather && (
            <WeatherWidget
              location={settings.weatherLocation}
              unit={settings.temperatureUnit}
              onConfigure={() => onOpenSettings('widgets')}
            />
          )}

          <form
            className="ntp-search"
            onSubmit={(event) => {
              event.preventDefault()
              if (query.trim()) onNavigate(query)
            }}
          >
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Buscar con ${SEARCH_ENGINES[settings.searchEngine].label} o escribir una URL`}
              spellCheck={false}
            />
            <button className="ntp-search-button" type="submit" title="Buscar">
              <Search />
            </button>
          </form>

          {settings.showShortcuts && (
            <section className="ntp-tiles">
              {settings.shortcuts.map((shortcut) => (
                <ShortcutTile
                  key={shortcut.id}
                  shortcut={shortcut}
                  onOpen={() => onNavigate(shortcut.url)}
                  onRemove={() =>
                    onChange({ shortcuts: settings.shortcuts.filter((s) => s.id !== shortcut.id) })
                  }
                />
              ))}
              {settings.shortcuts.length < MAX_SHORTCUTS && (
                <button className="tile tile-add" onClick={() => setAdding(true)}>
                  <span className="tile-icon">
                    <Plus />
                  </span>
                  <span className="tile-title">Añadir</span>
                </button>
              )}
            </section>
          )}
        </main>

        {settings.showFocus && <FocusWidget pomodoro={pomodoro} now={now} />}

        {settings.showClock && settings.greetingStyle === 'handwritten' && (
          <div className="ntp-handwritten">
            <div className="ntp-handwritten-greeting">{fullGreeting}</div>
            <div className="ntp-handwritten-phrase">{phrase}</div>
          </div>
        )}

        <button className="ntp-customize" onClick={() => onOpenSettings('personalization')}>
          <Sparkles /> Personalizar
        </button>
      </div>

      {soundsOpen && (
        <SoundsPanel
          ambient={ambient}
          customPlaylists={settings.customPlaylists}
          currentPlaylistId={currentPlaylistId}
          onPlay={onPlay}
          onManagePlaylists={() => {
            setSoundsOpen(false)
            onOpenSettings('widgets')
          }}
          onClose={() => setSoundsOpen(false)}
        />
      )}

      {adding && (
        <div className="modal-backdrop" onClick={() => setAdding(false)}>
          <form
            className="ntp-dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={addShortcut}
          >
            <h3>Nuevo acceso directo</h3>
            <label>
              Nombre
              <input
                autoFocus
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Mi sitio favorito"
              />
            </label>
            <label>
              URL
              <input
                value={draft.url}
                onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                placeholder="ejemplo.com"
                spellCheck={false}
              />
            </label>
            <div className="ntp-dialog-actions">
              <button type="button" className="button-ghost" onClick={() => setAdding(false)}>
                Cancelar
              </button>
              <button type="submit" className="button-primary" disabled={!draft.url.trim()}>
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default NewTabPage
