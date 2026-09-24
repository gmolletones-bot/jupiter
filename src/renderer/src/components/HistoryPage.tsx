import { useEffect, useState } from 'react'
import { hostnameOf } from '../url'
import Favicon from './Favicon'

const PAGE_SIZE = 150

interface HistoryPageProps {
  active: boolean
  onOpen: (url: string, inBackground: boolean) => void
}

function dayLabel(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const prefix =
    date.toDateString() === today.toDateString()
      ? 'Hoy – '
      : date.toDateString() === yesterday.toDateString()
        ? 'Ayer – '
        : ''
  const text = date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  return prefix + text.charAt(0).toUpperCase() + text.slice(1)
}

function groupByDay(entries: HistoryEntry[]): [string, HistoryEntry[]][] {
  const groups = new Map<string, HistoryEntry[]>()
  for (const entry of entries) {
    const label = dayLabel(entry.visitedAt)
    groups.set(label, [...(groups.get(label) ?? []), entry])
  }
  return [...groups]
}

function HistoryPage({ active, onOpen }: HistoryPageProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  // Refresh whenever the page is shown or the search changes (debounced).
  useEffect(() => {
    if (!active) return
    let cancelled = false
    const timer = setTimeout(() => {
      window.api.searchHistory(query, 0, PAGE_SIZE).then((result) => {
        if (cancelled) return
        setEntries(result.entries)
        setHasMore(result.hasMore)
      })
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [active, query])

  const loadMore = async (): Promise<void> => {
    const result = await window.api.searchHistory(query, entries.length, PAGE_SIZE)
    setEntries([...entries, ...result.entries])
    setHasMore(result.hasMore)
  }

  const remove = async (id: string): Promise<void> => {
    await window.api.deleteHistoryEntry(id)
    setEntries(entries.filter((entry) => entry.id !== id))
  }

  const clearAll = async (): Promise<void> => {
    await window.api.clearHistory()
    setEntries([])
    setHasMore(false)
    setConfirmClear(false)
  }

  return (
    <div className={active ? 'page list-page' : 'page list-page hidden'}>
      <div className="list-content">
        <header className="list-header">
          <h1>🕘 Historial</h1>
          <input
            className="list-search"
            type="search"
            value={query}
            placeholder="Buscar en el historial"
            onChange={(event) => setQuery(event.target.value)}
          />
          {confirmClear ? (
            <div className="list-confirm">
              <span>¿Borrar todo el historial?</span>
              <button className="settings-button" onClick={clearAll}>
                Sí, borrar
              </button>
              <button className="button-ghost" onClick={() => setConfirmClear(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              className="settings-button"
              disabled={entries.length === 0}
              onClick={() => setConfirmClear(true)}
            >
              Borrar historial
            </button>
          )}
        </header>

        {entries.length === 0 ? (
          <div className="empty-state list-empty">
            <span className="empty-icon">🕘</span>
            {query ? 'Nada coincide con tu búsqueda.' : 'Aún no hay nada en el historial.'}
          </div>
        ) : (
          groupByDay(entries).map(([label, dayEntries]) => (
            <section key={label} className="settings-card list-card">
              <h2>{label}</h2>
              {dayEntries.map((entry) => (
                <div key={entry.id} className="list-row">
                  <span className="list-time">
                    {new Date(entry.visitedAt).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  <Favicon url={entry.url} src={entry.favicon} />
                  <a
                    className="list-link"
                    href={entry.url}
                    title={entry.url}
                    onClick={(event) => {
                      event.preventDefault()
                      onOpen(entry.url, event.ctrlKey || event.metaKey)
                    }}
                    onAuxClick={(event) => {
                      event.preventDefault()
                      if (event.button === 1) onOpen(entry.url, true)
                    }}
                  >
                    <span className="list-title">{entry.title || entry.url}</span>
                    <span className="list-host">{hostnameOf(entry.url)}</span>
                  </a>
                  <button
                    className="list-action"
                    title="Quitar del historial"
                    onClick={() => remove(entry.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </section>
          ))
        )}

        {hasMore && (
          <button className="button-ghost list-more" onClick={loadMore}>
            Cargar más
          </button>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
