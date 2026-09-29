import { useState, useSyncExternalStore } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft,
  Brain,
  Briefcase,
  Footprints,
  Network,
  Rocket,
  Skull,
  Sprout
} from 'lucide-react'
import DoomGame from './DoomGame'
import GameFrame from './GameFrame'
import OrbitRunner from './OrbitRunner'
import { doomStatusStore } from './doomStatus'

interface GameInfo {
  id: string
  title: string
  description: string
  controls: string
  /** Author and license, shown while playing. */
  credit: string
  icon: LucideIcon
  /** CSS background of the card's artwork. */
  art: string
  render: (active: boolean) => React.JSX.Element
}

const NES_CONTROLS = 'Flechas para moverte · X = A · Z = B · Enter = Start · Ctrl derecho = Select'

function nesGame(
  rom: string,
  title: string,
  description: string,
  credit: string,
  icon: LucideIcon,
  art: string
): GameInfo {
  return {
    id: `nes:${rom}`,
    title,
    description,
    controls: NES_CONTROLS,
    credit: `${credit} · NES homebrew`,
    icon,
    art,
    render: (active) => (
      <GameFrame key={rom} path={`nes/index.html?rom=${rom}`} title={title} active={active} />
    )
  }
}

const GAMES: GameInfo[] = [
  {
    id: 'orbit',
    title: 'Órbita',
    description: 'Esquiva asteroides frente a Júpiter y atrapa estrellas. Hecho para Jupiter.',
    controls: 'Flechas o WASD para moverte · Espacio para pausar',
    credit: 'Jupiter',
    icon: Rocket,
    art: 'radial-gradient(circle at 80% 110%, #e2b183 0 30%, transparent 31%), radial-gradient(circle at 30% 20%, #3b2a86, #0b0820)',
    render: (active) => <OrbitRunner active={active} />
  },
  {
    id: 'doom',
    title: 'Doom',
    description:
      'El clásico de 1993 con los niveles libres de Freedoom. Se descarga una vez (26 MB).',
    controls: 'Flechas para moverte · A/D de lado · Ctrl dispara · Espacio abre puertas · Esc menú',
    credit: 'Chocolate Doom (GPL-2.0) · Freedoom (BSD-3)',
    icon: Skull,
    art: 'radial-gradient(circle at 50% 120%, #f97316, #7f1d1d 45%, #1c0a0a)',
    render: (active) => <DoomGame active={active} />
  },
  nesGame(
    'lawn-mower.nes',
    'Lawn Mower',
    'Arcade: corta el césped de cada nivel sin que te pillen.',
    'Shiru · Dominio público',
    Sprout,
    'linear-gradient(135deg, #15803d, #4ade80)'
  ),
  nesGame(
    'chase.nes',
    'Chase',
    'Un pequeño laberinto donde te persiguen. Corre.',
    'Shiru · Dominio público',
    Footprints,
    'linear-gradient(135deg, #1e3a8a, #60a5fa)'
  ),
  nesGame(
    'lan-master.nes',
    'LAN Master',
    'Puzle: gira los cables hasta conectar toda la red. 50 niveles.',
    'Shiru · Dominio público',
    Network,
    'linear-gradient(135deg, #0f766e, #22d3ee)'
  ),
  nesGame(
    'zooming-secretary.nes',
    'Zooming Secretary',
    'Arcade de oficina: atiende a todos antes de que se enfaden.',
    'Shiru y PinWizz · CC BY',
    Briefcase,
    'linear-gradient(135deg, #9d174d, #f472b6)'
  ),
  nesGame(
    'concentration-room.nes',
    'Concentration Room',
    'Juego de memoria: encuentra las parejas de cartas.',
    'Damian Yerrick · GPL-3.0',
    Brain,
    'linear-gradient(135deg, #6d28d9, #c084fc)'
  )
]

function DoomBadge(): React.JSX.Element | null {
  const status = useSyncExternalStore(doomStatusStore.subscribe, doomStatusStore.get)
  if (status.state === 'ready') return null
  const text =
    status.state === 'downloading' ? `Descargando ${status.percent}%` : 'Necesita descarga'
  return <span className="arcade-badge">{text}</span>
}

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
        <div className="arcade-credit">{game.credit}</div>
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
            {candidate.id === 'doom' && <DoomBadge />}
            {candidate.id.startsWith('nes:') && <span className="arcade-badge">NES</span>}
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
