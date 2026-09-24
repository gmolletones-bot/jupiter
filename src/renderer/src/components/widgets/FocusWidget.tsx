import type { Pomodoro } from '../../widgets/usePomodoro'

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const SESSIONS_PER_ROUND = 4

interface FocusWidgetProps {
  pomodoro: Pomodoro
  /** Current time, so the countdown re-renders every second. */
  now: Date
}

function FocusWidget({ pomodoro, now }: FocusWidgetProps): React.JSX.Element {
  const { phase, endsAt, remaining, duration, completed } = pomodoro
  const running = endsAt !== null
  const left = running ? Math.max(0, endsAt - now.getTime()) : (remaining ?? duration)
  const seconds = Math.ceil(left / 1000)
  const progress = duration > 0 ? 1 - left / duration : 0

  return (
    <aside className={`focus focus-${phase}`}>
      <div className="focus-ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="focus-track" cx="60" cy="60" r={RADIUS} />
          <circle
            className="focus-progress"
            cx="60"
            cy="60"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <div className="focus-time">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          <span>{phase === 'focus' ? 'Focus' : 'Descanso'}</span>
        </div>
      </div>

      <div className="focus-controls">
        <button
          className="focus-button primary"
          title={running ? 'Pausar' : 'Empezar'}
          onClick={pomodoro.toggle}
        >
          {running ? '❚❚' : '▶'}
        </button>
        <button className="focus-button" title="Reiniciar" onClick={pomodoro.reset}>
          ↺
        </button>
        <button
          className="focus-button"
          title={phase === 'focus' ? 'Saltar al descanso' : 'Saltar al focus'}
          onClick={pomodoro.skip}
        >
          ⏭
        </button>
      </div>

      <div className="focus-sessions" title="Sesiones completadas">
        {completed % SESSIONS_PER_ROUND}/{SESSIONS_PER_ROUND}
      </div>
    </aside>
  )
}

export default FocusWidget
