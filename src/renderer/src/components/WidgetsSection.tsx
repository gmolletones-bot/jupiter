import { useState } from 'react'
import type { Settings, WeatherLocation } from '../types'
import { parsePlaylistUrl } from '../widgets/playlists'
import { searchCities } from '../widgets/weather'
import Segmented from './Segmented'
import Switch from './Switch'

interface WidgetsSectionProps {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

function Row({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-label">{label}</div>
        {hint && <div className="settings-hint">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function CityPicker({ settings, onChange }: WidgetsSectionProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WeatherLocation[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'searching' | 'error'>('idle')

  const search = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!query.trim()) return
    setStatus('searching')
    try {
      setResults(await searchCities(query.trim()))
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  const location = settings.weatherLocation
  return (
    <>
      <Row
        label="Ciudad"
        hint={
          location ? `${location.name}, ${location.country}` : 'Aún no has elegido ninguna ciudad.'
        }
      >
        <form className="inline-form" onSubmit={search}>
          <input
            className="settings-input"
            value={query}
            placeholder="Buscar ciudad, p. ej. Caracas"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="button-ghost" disabled={status === 'searching'}>
            {status === 'searching' ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
      </Row>
      {status === 'error' && (
        <p className="settings-error">No se pudo buscar. ¿Tienes conexión a internet?</p>
      )}
      {results && (
        <div className="city-results">
          {results.length === 0 && <span className="settings-hint">Sin resultados.</span>}
          {results.map((result) => (
            <button
              key={`${result.latitude},${result.longitude}`}
              className="city-result"
              onClick={() => {
                onChange({ weatherLocation: result })
                setResults(null)
                setQuery('')
              }}
            >
              <strong>{result.name}</strong> <span>{result.country}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function PlaylistManager({ settings, onChange }: WidgetsSectionProps): React.JSX.Element {
  const [draft, setDraft] = useState({ title: '', url: '' })
  const valid = parsePlaylistUrl(draft.url) !== null

  const add = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!valid) return
    const playlist = {
      id: crypto.randomUUID(),
      title: draft.title.trim() || 'Mi playlist',
      url: draft.url.trim()
    }
    onChange({ customPlaylists: [...settings.customPlaylists, playlist] })
    setDraft({ title: '', url: '' })
  }

  return (
    <>
      {settings.customPlaylists.map((playlist) => (
        <div key={playlist.id} className="settings-row">
          <div className="extension-info">
            <div className="settings-label">{playlist.title}</div>
            <div className="extension-path">{playlist.url}</div>
          </div>
          <button
            className="settings-button"
            onClick={() =>
              onChange({
                customPlaylists: settings.customPlaylists.filter((p) => p.id !== playlist.id)
              })
            }
          >
            Quitar
          </button>
        </div>
      ))}
      <form className="settings-row playlist-form" onSubmit={add}>
        <input
          className="settings-input"
          value={draft.title}
          placeholder="Nombre"
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <input
          className="settings-input grow"
          value={draft.url}
          placeholder="Enlace de YouTube o Spotify"
          spellCheck={false}
          onChange={(event) => setDraft({ ...draft, url: event.target.value })}
        />
        <button className="button-primary" disabled={!valid}>
          Añadir
        </button>
      </form>
      {draft.url.trim() && !valid && (
        <p className="settings-error">
          Pega un enlace de un vídeo o lista de YouTube, o de una playlist, álbum o canción de
          Spotify.
        </p>
      )}
    </>
  )
}

function WidgetsSection({ settings, onChange }: WidgetsSectionProps): React.JSX.Element {
  const minutes = (value: string, min: number, max: number): number =>
    Math.min(max, Math.max(min, Math.round(Number(value) || min)))

  return (
    <>
      <section className="settings-card">
        <h2>Reloj y saludo</h2>
        <Row
          label="Mostrar reloj y saludo"
          hint="Hora, fecha y un saludo según el momento del día."
        >
          <Switch
            label="Mostrar reloj y saludo"
            checked={settings.showClock}
            onChange={(showClock) => onChange({ showClock })}
          />
        </Row>
        <Row label="Formato de hora">
          <Segmented
            value={settings.clockFormat}
            options={[
              { value: '24h', label: '24 h' },
              { value: '12h', label: '12 h (AM/PM)' }
            ]}
            onChange={(clockFormat) => onChange({ clockFormat })}
          />
        </Row>
        <Row
          label="Estilo del saludo"
          hint="Manuscrito: abajo a la izquierda, con una frase que cambia cada día."
        >
          <Segmented
            value={settings.greetingStyle}
            options={[
              { value: 'handwritten', label: 'Manuscrito' },
              { value: 'classic', label: 'Clásico' }
            ]}
            onChange={(greetingStyle) => onChange({ greetingStyle })}
          />
        </Row>
        <Row label="Tu nombre" hint="Para saludarte: «Buenos días, …».">
          <input
            className="settings-input"
            type="text"
            value={settings.userName}
            placeholder="Opcional"
            onChange={(event) => onChange({ userName: event.target.value })}
          />
        </Row>
      </section>

      <section className="settings-card">
        <h2>Clima</h2>
        <Row label="Mostrar el clima" hint="Datos de Open-Meteo, se actualizan cada 30 minutos.">
          <Switch
            label="Mostrar el clima"
            checked={settings.showWeather}
            onChange={(showWeather) => onChange({ showWeather })}
          />
        </Row>
        <CityPicker settings={settings} onChange={onChange} />
        <Row label="Unidades">
          <Segmented
            value={settings.temperatureUnit}
            options={[
              { value: 'celsius', label: '°C' },
              { value: 'fahrenheit', label: '°F' }
            ]}
            onChange={(temperatureUnit) => onChange({ temperatureUnit })}
          />
        </Row>
      </section>

      <section className="settings-card">
        <h2>Temporizador Focus</h2>
        <Row
          label="Mostrar el temporizador"
          hint="Técnica Pomodoro: bloques de concentración con descansos cortos."
        >
          <Switch
            label="Mostrar el temporizador"
            checked={settings.showFocus}
            onChange={(showFocus) => onChange({ showFocus })}
          />
        </Row>
        <Row label="Minutos de concentración">
          <input
            className="settings-input number-input"
            type="number"
            min={5}
            max={120}
            value={settings.focusMinutes}
            onChange={(event) => onChange({ focusMinutes: minutes(event.target.value, 5, 120) })}
          />
        </Row>
        <Row label="Minutos de descanso">
          <input
            className="settings-input number-input"
            type="number"
            min={1}
            max={60}
            value={settings.breakMinutes}
            onChange={(event) => onChange({ breakMinutes: minutes(event.target.value, 1, 60) })}
          />
        </Row>
      </section>

      <section className="settings-card">
        <h2>Sonidos y música</h2>
        <Row
          label="Mostrar el botón ♪"
          hint="Sonidos ambientales y playlists de YouTube y Spotify."
        >
          <Switch
            label="Mostrar el botón de sonidos"
            checked={settings.showSounds}
            onChange={(showSounds) => onChange({ showSounds })}
          />
        </Row>
        <div className="settings-hint card-intro">
          Tus playlists: pega el enlace de un vídeo o lista de YouTube, o de una playlist, álbum o
          canción de Spotify.
        </div>
        <PlaylistManager settings={settings} onChange={onChange} />
      </section>

      <section className="settings-card">
        <h2>Accesos directos</h2>
        <Row label="Mostrar accesos directos" hint="Añádelos o quítalos desde la propia página.">
          <Switch
            label="Mostrar accesos directos"
            checked={settings.showShortcuts}
            onChange={(showShortcuts) => onChange({ showShortcuts })}
          />
        </Row>
      </section>
    </>
  )
}

export default WidgetsSection
