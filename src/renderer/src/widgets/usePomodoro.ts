import { useEffect, useEffectEvent, useState } from 'react'
import { playChime } from './ambient'

export type FocusPhase = 'focus' | 'break'

interface PomodoroState {
  phase: FocusPhase
  /** Timestamp when the running period ends; null while paused or idle. */
  endsAt: number | null
  /** Milliseconds left while paused; null means the full period (not started). */
  remaining: number | null
  completed: number
}

export interface Pomodoro extends PomodoroState {
  /** Length of the current phase in ms. */
  duration: number
  toggle: () => void
  reset: () => void
  skip: () => void
}

function notify(body: string): void {
  try {
    new Notification('Jupiter', { body, silent: true })
  } catch {
    // Notifications unavailable: the chime is enough.
  }
}

/**
 * Focus/break timer. Lives in App so it keeps counting across tabs and when
 * the new tab page is closed.
 */
export function usePomodoro(focusMinutes: number, breakMinutes: number): Pomodoro {
  const [state, setState] = useState<PomodoroState>({
    phase: 'focus',
    endsAt: null,
    remaining: null,
    completed: 0
  })
  const durationOf = (phase: FocusPhase): number =>
    (phase === 'focus' ? focusMinutes : breakMinutes) * 60_000

  const finish = useEffectEvent(() => {
    const endedFocus = state.phase === 'focus'
    playChime()
    notify(endedFocus ? '¡Buen trabajo! Toca un descanso.' : 'Descanso terminado. ¡A concentrarse!')
    setState({
      phase: endedFocus ? 'break' : 'focus',
      endsAt: null,
      remaining: null,
      completed: state.completed + (endedFocus ? 1 : 0)
    })
  })

  useEffect(() => {
    if (state.endsAt === null) return
    const timer = setTimeout(() => finish(), Math.max(0, state.endsAt - Date.now()))
    return () => clearTimeout(timer)
  }, [state.endsAt])

  return {
    ...state,
    duration: durationOf(state.phase),
    toggle: () =>
      setState((current) =>
        current.endsAt === null
          ? {
              ...current,
              endsAt: Date.now() + (current.remaining ?? durationOf(current.phase)),
              remaining: null
            }
          : { ...current, endsAt: null, remaining: Math.max(0, current.endsAt - Date.now()) }
      ),
    reset: () => setState((current) => ({ ...current, endsAt: null, remaining: null })),
    skip: () =>
      setState((current) => ({
        ...current,
        phase: current.phase === 'focus' ? 'break' : 'focus',
        endsAt: null,
        remaining: null
      }))
  }
}
