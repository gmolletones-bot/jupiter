import { useEffect, useState } from 'react'
import Switch from './Switch'
import { Settings, Shield, ShieldCheck } from 'lucide-react'

interface ShieldsButtonProps {
  /** Hostname of the page in the active tab; empty on internal pages. */
  site: string
  blocked: number
  shields: ShieldsState
  onSetSite: (site: string, shieldsUp: boolean) => void
  onEnable: () => void
  onOpenSettings: () => void
}

/** Toolbar button + panel for the ad & tracker blocker, like Brave's shields. */
function ShieldsButton({
  site,
  blocked,
  shields,
  onSetSite,
  onEnable,
  onOpenSettings
}: ShieldsButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const shieldsUp = shields.enabled && !shields.allowedSites.includes(site)
  const active = shieldsUp && Boolean(site)

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  return (
    <div className="app-menu-anchor">
      <button
        className={`nav-button shields-button${active ? ' on' : ''}${open ? ' selected' : ''}`}
        title={active ? `Escudos arriba · ${blocked} bloqueados` : 'Escudos'}
        onClick={() => setOpen(!open)}
      >
        {active ? <ShieldCheck /> : <Shield />}
        {active && blocked > 0 && (
          <span className="shields-badge">{blocked > 99 ? '99+' : blocked}</span>
        )}
      </button>

      {open && (
        <>
          <div className="app-menu-backdrop" onMouseDown={() => setOpen(false)} />
          <div className="app-menu shields-panel">
            {!shields.enabled ? (
              <div className="shields-off">
                <div className="shields-site">El bloqueador está desactivado</div>
                <p>Actívalo para bloquear anuncios y rastreadores en todos los sitios.</p>
                <button className="button-primary" onClick={onEnable}>
                  Activar escudos
                </button>
              </div>
            ) : !site ? (
              <div className="shields-off">
                <div className="shields-site">Página interna de Jupiter</div>
                <p>Aquí no hay nada que bloquear.</p>
              </div>
            ) : (
              <>
                <div className="shields-header">
                  <div>
                    <div className="shields-site">{site}</div>
                    <div className="shields-state">
                      Escudos <strong>{shieldsUp ? 'arriba' : 'abajo'}</strong> para este sitio
                    </div>
                  </div>
                  <Switch
                    label="Escudos para este sitio"
                    checked={shieldsUp}
                    onChange={(up) => onSetSite(site, up)}
                  />
                </div>
                <div className="shields-count">
                  <span className="shields-count-number">{shieldsUp ? blocked : 0}</span>
                  <span>
                    {shieldsUp
                      ? 'anuncios y rastreadores bloqueados en esta página'
                      : 'Los escudos están bajados: todo se carga en este sitio'}
                  </span>
                </div>
                <p className="shields-hint">
                  Si este sitio parece roto, prueba a bajar los escudos. La página se recargará.
                </p>
              </>
            )}
            <div className="app-menu-separator" />
            <button
              className="app-menu-item"
              onClick={() => {
                setOpen(false)
                onOpenSettings()
              }}
            >
              <span className="app-menu-check">
                <Settings />
              </span>
              <span className="app-menu-label">Configuración de privacidad</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default ShieldsButton
