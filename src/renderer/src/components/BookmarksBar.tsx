import type { Bookmark } from '../types'
import Favicon from './Favicon'

interface BookmarksBarProps {
  bookmarks: Bookmark[]
  onOpen: (url: string, inBackground: boolean) => void
}

function BookmarksBar({ bookmarks, onOpen }: BookmarksBarProps): React.JSX.Element {
  return (
    <nav className="bookmarks-bar">
      {bookmarks.length === 0 ? (
        <span className="bookmarks-bar-hint">
          Pulsa ☆ en la barra de direcciones (o Ctrl+D) para tener tus sitios favoritos aquí.
        </span>
      ) : (
        bookmarks.map((bookmark) => (
          <button
            key={bookmark.id}
            className="bookmark-chip"
            title={`${bookmark.title}\n${bookmark.url}`}
            onClick={(event) => onOpen(bookmark.url, event.ctrlKey || event.metaKey)}
            onAuxClick={(event) => event.button === 1 && onOpen(bookmark.url, true)}
          >
            <Favicon url={bookmark.url} src={bookmark.favicon} />
            <span>{bookmark.title || bookmark.url}</span>
          </button>
        ))
      )}
    </nav>
  )
}

export default BookmarksBar
