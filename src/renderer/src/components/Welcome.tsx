import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Command,
  EllipsisVertical,
  ShieldCheck,
  Sparkles,
  Timer
} from 'lucide-react'
import { ACCENT_COLORS, greetingFor } from '../appearance'
import type { Settings, WallpaperPreset } from '../types'
import JupiterLogo from './JupiterLogo'
import Segmented from './Segmented'
import Switch from './Switch'
import Wallpaper from './Wallpaper'

interface WelcomeProps {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onFinish: () => void
}

const WALLPAPER_CHOICES: { id: WallpaperPreset; name: string }[] = [
  { id: 'aurora', name: 'Aurora' },
  { id: 'ambient', name: 'Tus sonidos' },
  { id: 'sunset', name: 'Atardecer' },
  { id: 'midnight', name: 'Medianoche' }
]

const TIPS = [
  { icon: Command, title: 'Ctrl+K', text: 'Busca pestañas, acciones, marcadores e historial.' },
  { icon: Sparkles, title: 'Personalizar', text: 'Colores, fondos animados y widgets de inicio.' },
  { icon: Timer, title: 'Modo Focus', text: 'Pomodoro que bloquea las webs que distraen.' },
  {
    icon: EllipsisVertical,
    title: 'Menú ⋮',
    text: 'Historial, marcadores, zoom, extensiones y más.'
  }
]

const STEPS = 5

/** First-run tour: pick a look, a name for the greeting and the privacy basics. */
function Welcome({ settings, onChange, onFinish }: WelcomeProps): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [shields, setShields] = useState<ShieldsState | null>(null)

  useEffect(() => {
    window.api.getShields().then(setShields).catch(console.error)
  }, [])

  const next = (): void => (step === STEPS - 1 ? onFinish() : setStep(step + 1))

  const content = [
    <div key="hello" className="welcome-step welcome-hello">
      <JupiterLogo className="welcome-logo" />
      <h1>Te damos la bienvenida a Jupiter</h1>
      <p>
        Un navegador rápido, bonito y que protege tu privacidad. Vamos a dejarlo a tu gusto en un
        minuto.
      </p>
    </div>,

    <div key="look" className="welcome-step">
      <h2>Hazlo tuyo</h2>
      <div className="welcome-field">
        <span>Tema</span>
        <Segmented
          value={settings.theme}
          options={[
            { value: 'system', label: 'Sistema' },
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Oscuro' }
          ]}
          onChange={(theme) => onChange({ theme })}
        />
      </div>
      <div className="welcome-field">
        <span>Color</span>
        <div className="swatches">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              className={settings.accentColor === color.value ? 'swatch selected' : 'swatch'}
              style={{ '--swatch': color.value } as React.CSSProperties}
              title={color.name}
              onClick={() => onChange({ accentColor: color.value })}
            />
          ))}
        </div>
      </div>
      <div className="welcome-field">
        <span>Fondo de inicio</span>
        <div className="welcome-wallpapers">
          {WALLPAPER_CHOICES.map((choice) => (
            <button
              key={choice.id}
              className={
                settings.wallpaper === choice.id ? 'wallpaper-thumb selected' : 'wallpaper-thumb'
              }
              onClick={() => onChange({ wallpaper: choice.id })}
            >
              <Wallpaper wallpaper={choice.id} images={[]} sounds={['waves', 'wind']} />
              <span className="wallpaper-name">{choice.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,

    <div key="name" className="welcome-step">
      <h2>¿Cómo te llamamos?</h2>
      <p>Lo usaremos para saludarte en la página de inicio. Es opcional.</p>
      <input
        className="welcome-input"
        autoFocus
        value={settings.userName}
        placeholder="Tu nombre"
        onChange={(event) => onChange({ userName: event.target.value })}
        onKeyDown={(event) => event.key === 'Enter' && next()}
      />
      {settings.userName.trim() && (
        <div className="welcome-greeting">
          {greetingFor(new Date()).greeting}, {settings.userName.trim()}
        </div>
      )}
    </div>,

    <div key="privacy" className="welcome-step">
      <ShieldCheck className="welcome-icon" />
      <h2>Tu privacidad, primero</h2>
      <p>Jupiter usa las mismas listas que uBlock Origin y Brave.</p>
      {shields && (
        <div className="welcome-toggles">
          <label>
            <span>
              <strong>Bloquear anuncios y rastreadores</strong>
              Incluidos los anuncios de YouTube.
            </span>
            <Switch
              label="Bloquear anuncios y rastreadores"
              checked={shields.enabled}
              onChange={(enabled) => {
                setShields({ ...shields, enabled })
                void window.api.setShieldsEnabled(enabled)
              }}
            />
          </label>
          <label>
            <span>
              <strong>Bloquear avisos de cookies</strong>Y rechazar el consentimiento de Google y
              YouTube.
            </span>
            <Switch
              label="Bloquear avisos de cookies"
              checked={shields.cookieNotices}
              onChange={(cookieNotices) => {
                setShields({ ...shields, cookieNotices })
                void window.api.setCookieNotices(cookieNotices)
              }}
            />
          </label>
        </div>
      )}
    </div>,

    <div key="ready" className="welcome-step">
      <h2>¡Todo listo!</h2>
      <p>Unos trucos para empezar:</p>
      <div className="welcome-tips">
        {TIPS.map((tip) => (
          <div key={tip.title} className="welcome-tip">
            <tip.icon />
            <div>
              <strong>{tip.title}</strong>
              <span>{tip.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  ]

  return (
    <div className="welcome" role="dialog" aria-label="Bienvenida">
      <Wallpaper wallpaper="aurora" images={[]} />
      <div className="welcome-drag" />
      <div className="welcome-card">
        {content[step]}

        <footer className="welcome-footer">
          <div className="welcome-dots">
            {Array.from({ length: STEPS }, (_, index) => (
              <span key={index} className={index === step ? 'active' : ''} />
            ))}
          </div>
          <div className="welcome-actions">
            {step === 0 ? (
              <button className="button-ghost" onClick={onFinish}>
                Saltar
              </button>
            ) : (
              <button className="button-ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft /> Atrás
              </button>
            )}
            <button className="button-primary" onClick={next}>
              {step === 0 ? 'Empezar' : step === STEPS - 1 ? 'Empezar a navegar' : 'Siguiente'}
              {step < STEPS - 1 && <ArrowRight />}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default Welcome
