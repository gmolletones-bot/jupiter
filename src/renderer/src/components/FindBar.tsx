import { useEffect, useRef, useState } from 'react'
import type { FoundInPageEvent, WebviewTag } from 'electron'
import { ChevronDown, ChevronUp, X } from 'lucide-react'

interface FindBarProps {
  tabId: number
  getWebview: (tabId: number) => WebviewTag | undefined
  /** Bumped each time Ctrl+F is pressed, to refocus the input. */
  focusKey: number
  onClose: () => void
}

/** "Find in page" bar (Ctrl+F) for the active tab. */
function FindBar({ tabId, getWebview, focusKey, onClose }: FindBarProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ active: number; total: number } | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusKey])

  useEffect(() => {
    const webview = getWebview(tabId)
    if (!webview) return
    const onFound = (event: FoundInPageEvent): void => {
      if (event.result.finalUpdate) {
        setResult({ active: event.result.activeMatchOrdinal, total: event.result.matches })
      }
    }
    webview.addEventListener('found-in-page', onFound)
    return () => {
      webview.removeEventListener('found-in-page', onFound)
      try {
        webview.stopFindInPage('clearSelection')
      } catch {
        // The tab may already be gone.
      }
    }
  }, [tabId, getWebview])

  const search = (text: string): void => {
    setQuery(text)
    const webview = getWebview(tabId)
    if (!webview) return
    if (!text) {
      webview.stopFindInPage('clearSelection')
      setResult(null)
      return
    }
    // findNext: true starts a new search; false moves through the current one.
    webview.findInPage(text, { findNext: true })
  }

  const step = (forward: boolean): void => {
    if (query) getWebview(tabId)?.findInPage(query, { findNext: false, forward })
  }

  return (
    <div className="find-bar">
      <input
        ref={inputRef}
        value={query}
        placeholder="Buscar en la página"
        spellCheck={false}
        onChange={(event) => search(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') step(!event.shiftKey)
          if (event.key === 'Escape') onClose()
        }}
      />
      <span className="find-count">
        {query && result ? `${result.total === 0 ? 0 : result.active}/${result.total}` : ''}
      </span>
      <button title="Anterior (Mayús+Enter)" onClick={() => step(false)}>
        <ChevronUp />
      </button>
      <button title="Siguiente (Enter)" onClick={() => step(true)}>
        <ChevronDown />
      </button>
      <button title="Cerrar (Esc)" onClick={onClose}>
        <X />
      </button>
    </div>
  )
}

export default FindBar
