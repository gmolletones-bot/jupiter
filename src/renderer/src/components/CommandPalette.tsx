import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AppWindow, ArrowRight, Clock, CornerDownLeft, Search, Star } from 'lucide-react'
import { fold, highlight } from '../text'
import type { Bookmark, SearchEngine, Tab } from '../types'
import { hostnameOf, SEARCH_ENGINES, toUrl } from '../url'
import Favicon from './Favicon'

/** Something the palette can run: an action, or opening a tab, bookmark or page. */
export interface PaletteCommand {
  id: string
  title: string
  /** Extra words that should find this command ("oscuro", "tema"…). */
  keywords?: string
  hint?: string
  icon: LucideIcon
  run: () => void
}

interface Item {
  key: string
  group: string
  title: string
  subtitle?: string
  icon?: LucideIcon
  /** Page URL, for a favicon instead of an icon. */
  url?: string
  run: () => void
}

interface CommandPaletteProps {
  tabs: Tab[]
  activeId: number
  bookmarks: Bookmark[]
  commands: PaletteCommand[]
  searchEngine: SearchEngine
  onActivateTab: (id: number) => void
  onOpen: (url: string) => void
  onClose: () => void
}

const MAX_PER_GROUP = { Pestañas: 6, Acciones: 8, Marcadores: 4, Historial: 5 }
const SUGGESTED_ACTIONS = 7

function matches(haystack: string, words: string[]): boolean {
  const folded = fold(haystack)
  return words.every((word) => folded.includes(word))
}

/** Ctrl+K: one box to jump to tabs, run actions and open bookmarks or history. */
function CommandPalette({
  tabs,
  activeId,
  bookmarks,
  commands,
  searchEngine,
  onActivateTab,
  onOpen,
  onClose
}: CommandPaletteProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<HistorySuggestion[]>([])
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const words = fold(query.trim()).split(/\s+/).filter(Boolean)

  useEffect(() => {
    const text = query.trim()
    if (!text) return
    let cancelled = false
    const timer = setTimeout(() => {
      window.api
        .suggestHistory(text, MAX_PER_GROUP.Historial)
        .then((results) => !cancelled && setHistory(results))
        .catch(() => undefined)
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const run = (item: Item): void => {
    onClose()
    item.run()
  }

  const items: Item[] = []
  const tabMatches = tabs.filter(
    (tab) => tab.id !== activeId && (!words.length || matches(`${tab.title} ${tab.url}`, words))
  )
  for (const tab of tabMatches.slice(0, MAX_PER_GROUP.Pestañas)) {
    items.push({
      key: `tab:${tab.id}`,
      group: 'Pestañas abiertas',
      title: tab.title || tab.url,
      subtitle: tab.kind === 'web' ? hostnameOf(tab.url) : undefined,
      icon: tab.kind === 'web' ? undefined : AppWindow,
      url: tab.kind === 'web' ? tab.url : undefined,
      run: () => onActivateTab(tab.id)
    })
  }

  const actions = words.length
    ? commands.filter((command) => matches(`${command.title} ${command.keywords ?? ''}`, words))
    : commands.slice(0, SUGGESTED_ACTIONS)
  for (const command of actions.slice(0, MAX_PER_GROUP.Acciones)) {
    items.push({
      key: `command:${command.id}`,
      group: 'Acciones',
      title: command.title,
      subtitle: command.hint,
      icon: command.icon,
      run: command.run
    })
  }

  if (words.length) {
    const seen = new Set<string>()
    for (const bookmark of bookmarks
      .filter((bookmark) => matches(`${bookmark.title} ${bookmark.url}`, words))
      .slice(0, MAX_PER_GROUP.Marcadores)) {
      seen.add(bookmark.url)
      items.push({
        key: `bookmark:${bookmark.id}`,
        group: 'Marcadores',
        title: bookmark.title || bookmark.url,
        subtitle: hostnameOf(bookmark.url),
        icon: Star,
        url: bookmark.url,
        run: () => onOpen(bookmark.url)
      })
    }
    for (const page of history) {
      if (seen.has(page.url)) continue
      items.push({
        key: `history:${page.url}`,
        group: 'Historial',
        title: page.title || page.url,
        subtitle: hostnameOf(page.url),
        icon: Clock,
        url: page.url,
        run: () => onOpen(page.url)
      })
    }

    const text = query.trim()
    const target = toUrl(text, searchEngine)
    const isAddress = !target.startsWith(SEARCH_ENGINES[searchEngine].searchUrl)
    items.push({
      key: 'go',
      group: 'Web',
      title: isAddress ? `Ir a ${text}` : `Buscar «${text}»`,
      subtitle: isAddress ? undefined : `con ${SEARCH_ENGINES[searchEngine].label}`,
      icon: isAddress ? ArrowRight : Search,
      run: () => onOpen(target)
    })
  }

  const current = Math.min(selected, Math.max(items.length - 1, 0))

  // Keep the highlighted row visible while moving with the arrows.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-label="Paleta de comandos"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="palette-input">
          <Search />
          <input
            autoFocus
            value={query}
            placeholder="Busca pestañas, acciones, marcadores o escribe una web…"
            spellCheck={false}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelected(0)
              if (!event.target.value.trim()) setHistory([])
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                const step = event.key === 'ArrowDown' ? 1 : -1
                setSelected((current + step + items.length) % Math.max(items.length, 1))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                if (items[current]) run(items[current])
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>

        <ul className="palette-list" role="listbox" ref={listRef}>
          {items.length === 0 && <li className="palette-empty">Sin resultados</li>}
          {items.map((item, index) => (
            <li key={item.key} className="palette-row">
              {(index === 0 || items[index - 1].group !== item.group) && (
                <div className="palette-group">{item.group}</div>
              )}
              <div
                role="option"
                aria-selected={index === current}
                className={index === current ? 'palette-item selected' : 'palette-item'}
                // Only real movement selects, not the list appearing under a still pointer.
                onMouseMove={() => index !== current && setSelected(index)}
                onClick={() => run(item)}
              >
                <span className="palette-icon">
                  {item.url ? <Favicon url={item.url} /> : item.icon && <item.icon />}
                </span>
                <span className="palette-title">{highlight(item.title, words)}</span>
                {item.subtitle && <span className="palette-subtitle">{item.subtitle}</span>}
                {index === current && <CornerDownLeft className="palette-enter" />}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default CommandPalette
