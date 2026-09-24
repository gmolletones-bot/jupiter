import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

// Rough averages used by privacy browsers for their "saved" counters.
const KB_PER_REQUEST = 20
const MS_PER_REQUEST = 50

interface ShieldStatsCardProps {
  /** Refetch when the page becomes visible again. */
  active: boolean
  onOpen: () => void
}

function formatBytes(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(kb >= 10240 ? 0 : 1)} MB` : `${Math.round(kb)} KB`
}

function formatTime(ms: number): string {
  const minutes = ms / 60_000
  return minutes >= 1 ? `${Math.round(minutes)} min` : `${Math.round(ms / 1000)} s`
}

/** New tab card: ads and trackers blocked this week, with a 7-day chart. */
function ShieldStatsCard({ active, onOpen }: ShieldStatsCardProps): React.JSX.Element | null {
  const [days, setDays] = useState<{ day: string; count: number }[] | null>(null)

  useEffect(() => {
    if (!active) return
    window.api.getShieldStats().then(setDays).catch(console.error)
  }, [active])

  if (!days) return null
  const total = days.reduce((sum, day) => sum + day.count, 0)
  const max = Math.max(...days.map((day) => day.count), 1)

  return (
    <button className="shield-stats" onClick={onOpen} title="Configuración de privacidad">
      <div className="shield-stats-head">
        <ShieldCheck />
        <span>Escudos · 7 días</span>
      </div>
      <div className="shield-stats-total">{total.toLocaleString('es-ES')}</div>
      <div className="shield-stats-label">anuncios y rastreadores bloqueados</div>
      <svg className="shield-stats-chart" viewBox="0 0 70 24" aria-hidden="true">
        {days.map((day, index) => {
          const height = Math.max((day.count / max) * 22, 1.5)
          return (
            <rect
              key={day.day}
              x={index * 10 + 1}
              y={24 - height}
              width="8"
              height={height}
              rx="2"
              className={index === days.length - 1 ? 'today' : ''}
            />
          )
        })}
      </svg>
      <div className="shield-stats-saved">
        ≈ {formatBytes(total * KB_PER_REQUEST)} y {formatTime(total * MS_PER_REQUEST)} ahorrados
      </div>
    </button>
  )
}

export default ShieldStatsCard
