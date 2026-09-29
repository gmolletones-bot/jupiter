import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Rocket } from 'lucide-react'
import OrbitRunner from './OrbitRunner'

interface GameInfo {
  id: string
  title: string
  description: string
  controls: string
  icon: LucideIcon
  /** CSS background of the card's artwork. */
  art: string
  render: (active: boolean) => React.JSX.Element
}

const GAMES: GameInfo[] = [
  {
    id: 'orbit',
    title: 'Órbita',
    description: 'Esquiva asteroides frente a Júpiter y atrapa estrellas. Hecho para Jupiter.',
    controls: 'Flechas o WASD para moverte · Espacio para pausar',
    icon: Rocket,
    art: 'radial-gradient(circle at 80% 110%, #e2b183 0 30%, transparent 31%), radial-gradient(circle at 30% 20%, #3b2a86, #0b0820)',
    render: (active) => <OrbitRunner active={active} />
  }
]

interface ArcadeProps {
  /** Whether the page showing the arcade is visible; games pause otherwise. */
  active: boolean
}

/** The game picker, and the selected game once one is chosen. */
function Arcade({ active }: ArcadeProps): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(null)
  const game = GAMES.find((candidate) => candidate.id === selected)

  if (game) {
    return (
      <div className="arcade-stage">
        <header className="arcade-stage-bar">
          <button className="button-ghost" onClick={() => setSelected(null)}>
            <ArrowLeft /> Juegos
          </button>
          <strong>{game.title}</strong>
          <span className="arcade-controls">{game.controls}</span>
        </header>
        <div className="arcade-screen">{game.render(active)}</div>
      </div>
    )
  }

  return (
    <div className="arcade-grid">
      {GAMES.map((candidate) => (
        <button
          key={candidate.id}
          className="arcade-card"
          onClick={() => setSelected(candidate.id)}
        >
          <span className="arcade-art" style={{ background: candidate.art }}>
            <candidate.icon />
          </span>
          <span className="arcade-card-text">
            <strong>{candidate.title}</strong>
            <span>{candidate.description}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

export default Arcade
