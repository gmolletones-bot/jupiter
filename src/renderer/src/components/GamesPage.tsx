import { Gamepad2 } from 'lucide-react'
import Arcade from './games/Arcade'

interface GamesPageProps {
  active: boolean
}

/** jupiter://juegos — the offline games, also reachable with internet. */
function GamesPage({ active }: GamesPageProps): React.JSX.Element {
  return (
    <div className={active ? 'page games-page' : 'page games-page hidden'}>
      <div className="games-page-inner">
        <h1>
          <Gamepad2 /> Juegos
        </h1>
        <p className="games-page-intro">
          Funcionan sin conexión: cuando se caiga internet, Jupiter te los ofrece en lugar del
          error.
        </p>
        <Arcade active={active} />
      </div>
    </div>
  )
}

export default GamesPage
