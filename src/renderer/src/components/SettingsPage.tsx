import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type {
  SearchEngine,
  Settings,
  SettingsSection,
  StartupMode,
  StoredWallpaper
} from '../types'
import { NEW_TAB_URL, SEARCH_ENGINES, toUrl } from '../url'
import ExtensionsSection from './ExtensionsSection'
import PersonalizationSection from './PersonalizationSection'
import Switch from './Switch'
import SystemSection from './SystemSection'
import WidgetsSection from './WidgetsSection'
import {
  House,
  Info,
  Orbit,
  Palette,
  Puzzle,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck
} from 'lucide-react'

interface SettingsPageProps {
  settings: Settings
  wallpapers: StoredWallpaper[]
  extensions: ExtensionInfo[]
  section: SettingsSection
  active: boolean
  onSectionChange: (section: SettingsSection) => void
  onChange: (patch: Partial<Settings>) => void
  onWallpapersChange: (wallpapers: StoredWallpaper[]) => void
  onExtensionsChanged: () => void
  shields: ShieldsState
  onShieldsEnabled: (enabled: boolean) => void
  onSetSiteShields: (site: string, shieldsUp: boolean) => void
  onShieldsChanged: () => void
  updateStatus: UpdateStatus
}

const SECTIONS: { id: SettingsSection; icon: LucideIcon; label: string }[] = [
  { id: 'personalization', icon: Palette, label: 'Personalización' },
  { id: 'widgets', icon: Orbit, label: 'Widgets de inicio' },
  { id: 'home', icon: House, label: 'Inicio y pestañas' },
  { id: 'search', icon: Search, label: 'Buscador' },
  { id: 'privacy', icon: Shield, label: 'Privacidad' },
  { id: 'extensions', icon: Puzzle, label: 'Extensiones' },
  { id: 'system', icon: SettingsIcon, label: 'Sistema' },
  { id: 'about', icon: Info, label: 'Acerca de' }
]

const STARTUP_MODES: { value: StartupMode; label: string }[] = [
  { value: 'home', label: 'Abrir la página de inicio' },
  { value: 'restore', label: 'Restaurar las pestañas de la última sesión' }
]

function HomeSection({
  settings,
  onChange
}: Pick<SettingsPageProps, 'settings' | 'onChange'>): React.JSX.Element {
  const usesNewTabPage = settings.homePage === NEW_TAB_URL
  const [homePageDraft, setHomePageDraft] = useState(usesNewTabPage ? '' : settings.homePage)

  const commitHomePage = (): void => {
    if (!homePageDraft.trim()) return
    const homePage = toUrl(homePageDraft, settings.searchEngine)
    setHomePageDraft(homePage)
    onChange({ homePage })
  }

  return (
    <>
      <section className="settings-card">
        <h2>Al iniciar</h2>
        {STARTUP_MODES.map((mode) => (
          <label key={mode.value} className="settings-row radio-row">
            <input
              type="radio"
              name="startup"
              checked={settings.startup === mode.value}
              onChange={() => onChange({ startup: mode.value })}
            />
            <span className="settings-label">{mode.label}</span>
          </label>
        ))}
      </section>

      <section className="settings-card">
        <h2>Página de inicio</h2>
        <div className="settings-hint card-intro">
          Se abre al iniciar y con el botón de inicio. Las pestañas nuevas siempre muestran la
          página de inicio de Jupiter.
        </div>
        <label className="settings-row radio-row">
          <input
            type="radio"
            name="home-page"
            checked={usesNewTabPage}
            onChange={() => onChange({ homePage: NEW_TAB_URL })}
          />
          <span className="settings-label">Página de inicio de Jupiter</span>
        </label>
        <div className="settings-row radio-row">
          <input
            type="radio"
            name="home-page"
            checked={!usesNewTabPage}
            onChange={commitHomePage}
            aria-label="Una página concreta"
          />
          <input
            className="settings-input grow"
            type="text"
            value={homePageDraft}
            placeholder="Una página concreta, p. ej. google.com"
            spellCheck={false}
            onChange={(event) => setHomePageDraft(event.target.value)}
            onBlur={commitHomePage}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          />
        </div>
      </section>
    </>
  )
}

function PrivacySection({
  shields,
  onShieldsEnabled,
  onSetSiteShields,
  onShieldsChanged
}: Pick<
  SettingsPageProps,
  'shields' | 'onShieldsEnabled' | 'onSetSiteShields' | 'onShieldsChanged'
>): React.JSX.Element {
  const [listsStatus, setListsStatus] = useState<'idle' | 'updating' | 'error'>('idle')

  const updateLists = async (): Promise<void> => {
    setListsStatus('updating')
    try {
      await window.api.updateShieldLists()
      setListsStatus('idle')
      onShieldsChanged()
    } catch {
      setListsStatus('error')
    }
  }

  const listsHint =
    shields.engine === 'lists'
      ? 'EasyList, EasyPrivacy y uBlock Origin, con ocultación de anuncios y protección en YouTube.' +
        (shields.listsUpdatedAt
          ? ` Actualizadas el ${new Date(shields.listsUpdatedAt).toLocaleDateString('es-ES')}.`
          : '')
      : 'Cargando las listas… mientras tanto se usa la lista básica de dominios.'

  const [clearStatus, setClearStatus] = useState<'idle' | 'clearing' | 'done' | 'error'>('idle')

  const clearBrowsingData = async (): Promise<void> => {
    setClearStatus('clearing')
    try {
      await window.api.clearBrowsingData()
      setClearStatus('done')
    } catch {
      setClearStatus('error')
    }
  }

  const label = {
    idle: 'Borrar datos',
    clearing: 'Borrando…',
    done: 'Datos borrados',
    error: 'Error, reintentar'
  }[clearStatus]

  return (
    <>
      <section className="settings-card">
        <h2>
          <ShieldCheck /> Escudos
        </h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">Bloquear anuncios y rastreadores</div>
            <div className="settings-hint">
              Bloquea las peticiones a redes de publicidad y rastreo conocidas en todos los sitios.
              {shields.totalBlocked > 0 &&
                ` ${shields.totalBlocked} bloqueados desde que abriste Jupiter.`}
            </div>
          </div>
          <Switch
            label="Bloquear anuncios y rastreadores"
            checked={shields.enabled}
            onChange={onShieldsEnabled}
          />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Bloquear avisos de cookies</div>
            <div className="settings-hint">
              Oculta los banners de cookies de la mayoría de webs y rechaza el consentimiento de
              Google y YouTube (solo si no has elegido tú antes).
            </div>
          </div>
          <Switch
            label="Bloquear avisos de cookies"
            checked={shields.cookieNotices}
            onChange={async (enabled) => {
              setListsStatus('updating')
              try {
                await window.api.setCookieNotices(enabled)
                setListsStatus('idle')
              } catch {
                setListsStatus('error')
              }
              onShieldsChanged()
            }}
          />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Listas de filtros</div>
            <div className="settings-hint">{listsHint}</div>
            {listsStatus === 'error' && (
              <div className="settings-error">No se pudieron descargar. ¿Hay conexión?</div>
            )}
          </div>
          <button
            className="button-ghost"
            disabled={listsStatus === 'updating'}
            onClick={updateLists}
          >
            {listsStatus === 'updating' ? 'Actualizando…' : 'Actualizar ahora'}
          </button>
        </div>
        <div className="settings-hint card-intro">
          Sitios con los escudos bajados (todo se carga en ellos):
        </div>
        {shields.allowedSites.length === 0 ? (
          <div className="settings-hint card-intro">Ninguno.</div>
        ) : (
          shields.allowedSites.map((site) => (
            <div key={site} className="settings-row">
              <div className="settings-label">{site}</div>
              <button className="button-ghost" onClick={() => onSetSiteShields(site, true)}>
                Subir escudos
              </button>
            </div>
          ))
        )}
      </section>

      <section className="settings-card">
        <h2>Privacidad</h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">Borrar datos de navegación</div>
            <div className="settings-hint">
              Historial, cookies, caché y datos guardados por los sitios. Cerrará tus sesiones
              iniciadas.
            </div>
          </div>
          <button
            className="settings-button"
            disabled={clearStatus === 'clearing'}
            onClick={clearBrowsingData}
          >
            {label}
          </button>
        </div>
      </section>
    </>
  )
}

function SettingsPage(props: SettingsPageProps): React.JSX.Element {
  const { settings, section, active, onSectionChange, onChange } = props
  const versions = window.electron.process.versions

  return (
    <div className={active ? 'page settings-page' : 'page settings-page hidden'}>
      <nav className="settings-nav">
        <div className="settings-nav-title">Configuración</div>
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            className={section === item.id ? 'settings-nav-item selected' : 'settings-nav-item'}
            onClick={() => onSectionChange(item.id)}
          >
            <item.icon className="settings-nav-icon" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="settings-scroll">
        <div className="settings-content" key={section}>
          {section === 'personalization' && (
            <PersonalizationSection
              settings={settings}
              wallpapers={props.wallpapers}
              onChange={onChange}
              onWallpapersChange={props.onWallpapersChange}
            />
          )}

          {section === 'widgets' && <WidgetsSection settings={settings} onChange={onChange} />}

          {section === 'home' && <HomeSection settings={settings} onChange={onChange} />}

          {section === 'search' && (
            <section className="settings-card">
              <h2>Buscador</h2>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Buscador de la barra de direcciones</div>
                  <div className="settings-hint">
                    Se usa cuando escribes algo que no es una URL.
                  </div>
                </div>
                <select
                  className="settings-input"
                  value={settings.searchEngine}
                  onChange={(event) =>
                    onChange({ searchEngine: event.target.value as SearchEngine })
                  }
                >
                  {Object.entries(SEARCH_ENGINES).map(([value, engine]) => (
                    <option key={value} value={value}>
                      {engine.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Sugerencias del buscador</div>
                  <div className="settings-hint">
                    Mientras escribes en la barra de direcciones, pregunta al buscador por
                    sugerencias. Para ello le envía lo que vas escribiendo. El historial y los
                    marcadores se sugieren siempre, sin salir de tu equipo.
                  </div>
                </div>
                <Switch
                  label="Sugerencias del buscador"
                  checked={settings.searchSuggestions}
                  onChange={(searchSuggestions) => onChange({ searchSuggestions })}
                />
              </div>
            </section>
          )}

          {section === 'privacy' && (
            <PrivacySection
              shields={props.shields}
              onShieldsEnabled={props.onShieldsEnabled}
              onSetSiteShields={props.onSetSiteShields}
              onShieldsChanged={props.onShieldsChanged}
            />
          )}

          {section === 'extensions' && (
            <ExtensionsSection
              extensions={props.extensions}
              onChanged={props.onExtensionsChanged}
            />
          )}

          {section === 'system' && <SystemSection updateStatus={props.updateStatus} />}

          {section === 'about' && (
            <section className="settings-card about-card">
              <Orbit className="about-logo" />
              <h2>Jupiter</h2>
              <div className="settings-hint">
                Chromium {versions.chrome} · Electron {versions.electron} · Node {versions.node}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
