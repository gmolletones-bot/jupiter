import { useState } from 'react'
import { Puzzle } from 'lucide-react'

interface ExtensionsSectionProps {
  extensions: ExtensionInfo[]
  onChanged: () => void
}

const BRAVE_EXTENSIONS_DIR =
  '%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Extensions'

function ExtensionsSection({ extensions, onChanged }: ExtensionsSectionProps): React.JSX.Element {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async (): Promise<void> => {
    setBusy(true)
    setError('')
    const result = await window.api.addExtension()
    if (!result.ok) setError(result.error)
    setBusy(false)
    onChanged()
  }

  const remove = async (id: string): Promise<void> => {
    await window.api.removeExtension(id)
    onChanged()
  }

  return (
    <>
      <section className="settings-card">
        <h2>Extensiones</h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">Añadir extensión de Chrome</div>
            <div className="settings-hint">
              Elige la carpeta descomprimida de la extensión (la que contiene manifest.json).
            </div>
          </div>
          <button className="button-primary" disabled={busy} onClick={add}>
            {busy ? 'Cargando…' : 'Añadir extensión…'}
          </button>
        </div>
        {error && <p className="settings-error">{error}</p>}

        {extensions.length === 0 ? (
          <div className="empty-state">
            <Puzzle className="empty-icon" />
            Aún no tienes extensiones.
          </div>
        ) : (
          <ul className="extension-list">
            {extensions.map((extension) => (
              <li key={extension.id} className="extension-item">
                {extension.icon ? (
                  <img className="extension-icon" src={extension.icon} alt="" />
                ) : (
                  <Puzzle className="extension-icon" />
                )}
                <div className="extension-info">
                  <div className="settings-label">
                    {extension.name} <span className="extension-version">{extension.version}</span>
                  </div>
                  {extension.description && (
                    <div className="settings-hint">{extension.description}</div>
                  )}
                  <div className="extension-path">{extension.path}</div>
                </div>
                <button className="settings-button" onClick={() => remove(extension.id)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-card info-card">
        <h2>Bueno saberlo</h2>
        <p>
          <strong>¿Ya las tienes en Brave?</strong> Brave guarda sus extensiones en{' '}
          <code>{BRAVE_EXTENSIONS_DIR}\&lt;id&gt;\&lt;versión&gt;</code>. Puedes elegir esa carpeta
          directamente.
        </p>
        <p>
          La compatibilidad es parcial: funcionan mejor las extensiones que modifican páginas
          (bloqueadores, modo oscuro, estilos). Las que dependen mucho de la ventana emergente o de
          la API de pestañas de Chrome pueden no funcionar del todo. No se puede instalar desde la
          Chrome Web Store.
        </p>
        <p>Recarga las pestañas abiertas para que una extensión nueva actúe sobre ellas.</p>
      </section>
    </>
  )
}

export default ExtensionsSection
