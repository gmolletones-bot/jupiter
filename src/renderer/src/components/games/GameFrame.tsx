import { useEffect, useRef } from 'react'

/** Games bundled with Jupiter, served by the main process on their own origin. */
export const GAMES_ORIGIN = 'jupiter-games://app'

interface GameFrameProps {
  /** Path under jupiter-games://app/, e.g. "nes/index.html?rom=chase.nes". */
  path: string
  title: string
  /** The game pauses while its page isn't visible. */
  active: boolean
}

/** A game running in an isolated frame, so its keyboard handling stays inside it. */
function GameFrame({ path, title, active }: GameFrameProps): React.JSX.Element {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const loaded = useRef(false)
  const activeRef = useRef(active)

  useEffect(() => {
    activeRef.current = active
    const frame = frameRef.current
    // Until the game page loads, the frame still holds about:blank.
    if (!loaded.current || !frame) return
    frame.contentWindow?.postMessage(active ? 'resume' : 'pause', GAMES_ORIGIN)
    if (active) frame.focus()
  }, [active])

  return (
    <iframe
      ref={frameRef}
      className="game-frame"
      src={`${GAMES_ORIGIN}/${path}`}
      title={title}
      allow="autoplay; gamepad"
      onLoad={(event) => {
        loaded.current = true
        if (activeRef.current) event.currentTarget.focus()
        else event.currentTarget.contentWindow?.postMessage('pause', GAMES_ORIGIN)
      }}
    />
  )
}

export default GameFrame
