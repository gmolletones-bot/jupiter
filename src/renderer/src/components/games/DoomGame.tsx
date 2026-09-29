import { useSyncExternalStore } from 'react'
import { CloudOff, Download, Skull } from 'lucide-react'
import GameFrame from './GameFrame'
import { doomStatusStore } from './doomStatus'

interface DoomGameProps {
  active: boolean
}

/** Doom once it's downloaded; until then, its download state. */
function DoomGame({ active }: DoomGameProps): React.JSX.Element {
  const status = useSyncExternalStore(doomStatusStore.subscribe, doomStatusStore.get)

  if (status.state === 'ready')
    return <GameFrame path="doom/index.html" title="Doom" active={active} />

  return (
    <div className="game-message">
      <Skull />
      {status.state === 'downloading' ? (
        <>
          <strong>Descargando Doom… {status.percent}%</strong>
          <div className="game-progress">
            <span style={{ width: `${status.percent}%` }} />
          </div>
        </>
      ) : navigator.onLine ? (
        <>
          <strong>Doom aún no está descargado</strong>
          <span>
            Son unos 26 MB, una sola vez: el motor Chocolate Doom y los niveles libres de Freedoom.
          </span>
          {status.state === 'error' && <span className="game-error">{status.error}</span>}
          <button className="button-primary" onClick={() => void window.api.downloadDoom()}>
            <Download /> {status.state === 'error' ? 'Reintentar' : 'Descargar'}
          </button>
        </>
      ) : (
        <>
          <CloudOff />
          <strong>Doom se descargará cuando vuelva internet</strong>
          <span>Mientras tanto, prueba Órbita o los juegos de NES: ya vienen con Jupiter.</span>
        </>
      )}
    </div>
  )
}

export default DoomGame
