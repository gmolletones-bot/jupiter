import { useState } from 'react'
import { setSoundVolume, type SoundId, startSound, stopSound } from './ambient'

export interface Ambient {
  /** Volume (0–1) of each sound that is playing. */
  levels: Partial<Record<SoundId, number>>
  toggle: (id: SoundId) => void
  setVolume: (id: SoundId, volume: number) => void
  stopAll: () => void
}

const DEFAULT_VOLUME = 0.5

export function useAmbient(): Ambient {
  const [levels, setLevels] = useState<Partial<Record<SoundId, number>>>({})

  return {
    levels,
    toggle: (id) => {
      if (levels[id] !== undefined) {
        stopSound(id)
        const rest = { ...levels }
        delete rest[id]
        setLevels(rest)
      } else {
        startSound(id, DEFAULT_VOLUME)
        setLevels({ ...levels, [id]: DEFAULT_VOLUME })
      }
    },
    setVolume: (id, volume) => {
      setSoundVolume(id, volume)
      setLevels({ ...levels, [id]: volume })
    },
    stopAll: () => {
      Object.keys(levels).forEach((id) => stopSound(id as SoundId))
      setLevels({})
    }
  }
}
