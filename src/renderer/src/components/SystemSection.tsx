import { useEffect, useState } from 'react'
import Switch from './Switch'

interface SystemSectionProps {
  updateStatus: UpdateStatus
}

const ACCELERATION_LABEL: Record<Acceleration, string> = {
  hardware: 'Por hardware (GPU)',
  software: 'Por software (CPU)',
  off: 'No disponible'
}

const GPU_FEATURES: { key: keyof SystemInfo['gpu']; label: string }[] = [
  { key: 'videoDecode', label: 'Decodificación de vídeo' },
  { key: 'videoEncode', label: 'Codificación de vídeo' },
  { key: 'rasterization', label: 'Dibujado de páginas' },
  { key: 'compositing', label: 'Composición' },
  { key: 'webgl', label: 'WebGL (3D)' }
]

function updateText(status: UpdateStatus): string {
  switch (status.state) {
    case 'dev':
      return 'Modo desarrollo: las actualizaciones solo funcionan en la versión instalada.'
    case 'idle':
      return 'Todavía no se ha buscado ninguna actualización.'
    case 'checking':
      return 'Buscando actualizaciones…'
    case 'up-to-date':
      return 'Jupiter está actualizado.'
    case 'available':
      return `Hay una versión nueva: ${status.version}.`
    case 'downloading':
      return `Descargando la versión ${status.version ?? 'nueva'}… ${status.percent ?? 0} %`
    case 'downloaded':
      return `La versión ${status.version} está lista. Reinicia Jupiter para instalarla.`
    case 'error':
      return `No se pudo comprobar: ${status.error}`
  }
}

/** Settings → System: updates and hardware acceleration. */
function SystemSection({ updateStatus }: SystemSectionProps): React.JSX.Element {
  const [info, setInfo] = useState<SystemInfo | null>(null)

  useEffect(() => {
    window.api.getSystem().then(setInfo).catch(console.error)
  }, [])

  if (!info) return <section className="settings-card">Cargando…</section>

  const change = async (
    patch: Partial<Pick<SystemInfo, 'hardwareAcceleration' | 'autoUpdate'>>
  ): Promise<void> => {
    await window.api.setSystem(patch)
    setInfo({ ...info, ...patch })
  }
  const needsRestart = info.hardwareAcceleration !== info.accelerationActive
  const videoOnCpu = info.accelerationActive && info.gpu.videoDecode !== 'hardware'

  return (
    <>
      <section className="settings-card">
        <h2>Actualizaciones</h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">Jupiter {info.version}</div>
            <div className="settings-hint">{updateText(updateStatus)}</div>
          </div>
          {updateStatus.state === 'downloaded' ? (
            <button className="button-primary" onClick={() => window.api.installUpdate()}>
              Reiniciar y actualizar
            </button>
          ) : updateStatus.state === 'available' ? (
            <button className="button-primary" onClick={() => window.api.downloadUpdate()}>
              Descargar
            </button>
          ) : (
            <button
              className="button-ghost"
              disabled={
                updateStatus.state === 'dev' ||
                updateStatus.state === 'checking' ||
                updateStatus.state === 'downloading'
              }
              onClick={() => window.api.checkForUpdates()}
            >
              Buscar actualizaciones
            </button>
          )}
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Actualizar automáticamente</div>
            <div className="settings-hint">
              Descarga las versiones nuevas en segundo plano y las instala al cerrar Jupiter.
            </div>
          </div>
          <Switch
            label="Actualizar automáticamente"
            checked={info.autoUpdate}
            onChange={(autoUpdate) => change({ autoUpdate })}
          />
        </div>
      </section>

      <section className="settings-card">
        <h2>Rendimiento</h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">
              Usar aceleración por hardware cuando esté disponible
            </div>
            <div className="settings-hint">
              La tarjeta gráfica dibuja las páginas y decodifica los vídeos, y la CPU trabaja mucho
              menos (por ejemplo, un vídeo en 1080p). En Linux activa VA-API.
            </div>
          </div>
          <Switch
            label="Usar aceleración por hardware"
            checked={info.hardwareAcceleration}
            onChange={(hardwareAcceleration) => change({ hardwareAcceleration })}
          />
        </div>
        {needsRestart && (
          <div className="settings-row">
            <div className="settings-hint">El cambio se aplicará al reiniciar Jupiter.</div>
            <button className="button-primary" onClick={() => window.api.relaunch()}>
              Reiniciar ahora
            </button>
          </div>
        )}

        <div className="gpu-status">
          {GPU_FEATURES.map((feature) => (
            <div key={feature.key} className="gpu-status-row">
              <span>{feature.label}</span>
              <span className={`gpu-badge gpu-${info.gpu[feature.key]}`}>
                {ACCELERATION_LABEL[info.gpu[feature.key]]}
              </span>
            </div>
          ))}
        </div>

        {info.platform === 'linux' && videoOnCpu && (
          <div className="settings-hint card-intro gpu-help">
            El vídeo se está decodificando con la CPU. Instala los controladores VA-API de tu
            tarjeta gráfica y reinicia Jupiter:
            <code>sudo apt install intel-media-va-driver-non-free vainfo</code> (Intel) o
            <code>sudo apt install mesa-va-drivers vainfo</code> (AMD). Con <code>vainfo</code>{' '}
            puedes comprobar que funcionan.
          </div>
        )}
      </section>
    </>
  )
}

export default SystemSection
