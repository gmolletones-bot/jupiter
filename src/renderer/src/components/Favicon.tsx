import { useState } from 'react'
import { hostnameOf } from '../url'

interface FaviconProps {
  url: string
  /** Icon reported by the page; falls back to the site's /favicon.ico. */
  src?: string
  className?: string
}

function siteIcon(url: string): string | undefined {
  try {
    const { protocol, origin } = new URL(url)
    return /^https?:$/.test(protocol) ? `${origin}/favicon.ico` : undefined
  } catch {
    return undefined
  }
}

/** Site icon with a letter badge when no image can be loaded. */
function Favicon({ url, src, className = '' }: FaviconProps): React.JSX.Element {
  const host = hostnameOf(url)
  const candidates = [src, siteIcon(url)]
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate, index, all) => all.indexOf(candidate) === index)
  const [failed, setFailed] = useState(0)

  if (failed >= candidates.length) {
    return (
      <span className={`favicon favicon-letter ${className}`}>{host.charAt(0).toUpperCase()}</span>
    )
  }
  return (
    <img
      className={`favicon ${className}`}
      src={candidates[failed]}
      alt=""
      onError={() => setFailed(failed + 1)}
    />
  )
}

export default Favicon
