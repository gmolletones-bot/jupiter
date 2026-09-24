import { useState } from 'react'
import type { Bookmark } from '../types'
import { hostnameOf } from '../url'
import Favicon from './Favicon'
import Switch from './Switch'

interface BookmarksPageProps {
  bookmarks: Bookmark[]
  active: boolean
  showBar: boolean
  onToggleBar: (show: boolean) => void
  onOpen: (url: string, inBackground: boolean) => void
  onRename: (id: string, title: string) => void
  onRemove: (id: string) => void
}

function BookmarksPage({
  bookmarks,
  active,
  showBar,
  onToggleBar,
  onOpen,
  onRename,
  onRemove
}: BookmarksPageProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null)

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? bookmarks.filter(
        (bookmark) =>
          bookmark.title.toLowerCase().includes(needle) ||
          bookmark.url.toLowerCase().includes(needle)
      )
    : bookmarks

  const commitRename = (): void => {
    if (editing && editing.title.trim()) onRename(editing.id, editing.title.trim())
    setEditing(null)
  }

  return (
    <div className={active ? 'page list-page' : 'page list-page hidden'}>
      <div className="list-content">
        <header className="list-header">
          <h1>★ Marcadores</h1>
          <input
            className="list-search"
            type="search"
            value={query}
            placeholder="Buscar en marcadores"
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className="list-toggle">
            Barra de marcadores
            <Switch label="Mostrar barra de marcadores" checked={showBar} onChange={onToggleBar} />
          </label>
        </header>

        {visible.length === 0 ? (
          <div className="empty-state list-empty">
            <span className="empty-icon">☆</span>
            {query
              ? 'Nada coincide con tu búsqueda.'
              : 'Aún no tienes marcadores. Pulsa ☆ en la barra de direcciones o Ctrl+D.'}
          </div>
        ) : (
          <section className="settings-card list-card">
            {visible.map((bookmark) => (
              <div key={bookmark.id} className="list-row">
                <Favicon url={bookmark.url} src={bookmark.favicon} />
                {editing?.id === bookmark.id ? (
                  <input
                    className="settings-input grow"
                    autoFocus
                    value={editing.title}
                    onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitRename()
                      if (event.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  <a
                    className="list-link"
                    href={bookmark.url}
                    title={bookmark.url}
                    onClick={(event) => {
                      event.preventDefault()
                      onOpen(bookmark.url, event.ctrlKey || event.metaKey)
                    }}
                    onAuxClick={(event) => {
                      event.preventDefault()
                      if (event.button === 1) onOpen(bookmark.url, true)
                    }}
                  >
                    <span className="list-title">{bookmark.title || bookmark.url}</span>
                    <span className="list-host">{hostnameOf(bookmark.url)}</span>
                  </a>
                )}
                <button
                  className="list-action"
                  title="Cambiar nombre"
                  onClick={() => setEditing({ id: bookmark.id, title: bookmark.title })}
                >
                  ✎
                </button>
                <button
                  className="list-action"
                  title="Quitar marcador"
                  onClick={() => onRemove(bookmark.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

export default BookmarksPage
