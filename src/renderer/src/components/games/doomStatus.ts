// Doom's download state, shared by the arcade card and the game screen.

let status: DoomStatus = { state: 'missing' }
const listeners = new Set<() => void>()
let started = false

function set(next: DoomStatus): void {
  status = next
  for (const listener of listeners) listener()
}

function start(): void {
  if (started) return
  started = true
  window.api.onDoomStatus(set)
  window.api.getDoomStatus().then(set).catch(console.error)
}

export const doomStatusStore = {
  subscribe(listener: () => void): () => void {
    start()
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get: (): DoomStatus => status
}
