import { useLayoutEffect, useRef, useState } from 'react'
import type { Bookmark, SearchEngine, Tab } from '../types'
import { SEARCH_ENGINES, toUrl } from '../url'
import Favicon from './Favicon'

interface Suggestion {
  kind: 'page' | 'search'
  /** 'history' entries can be deleted; 'bookmark' shows a star. */
  source?: 'history' | 'bookmark'
  key: string
  /** Main line: page title or search text. */
  text: string
  /** Shown after the title for pages. */
  url?: string
  favicon?: string
  /** Where Enter/click goes. */
  target: string
  /** Text shown in the box while the suggestion is highlighted. */
  fill: string
}

interface AddressBarProps {
  tab: Tab
  inputRef: React.Ref<HTMLInputElement>
  bookmarks: Bookmark[]
  searchEngine: SearchEngine
  searchSuggestions: boolean
  onAddressChange: (address: string) => void
  onNavigate: (input: string) => void
  children?: React.ReactNode
}

const MAX_HISTORY = 5
const MAX_BOOKMARKS = 2
const MAX_SEARCHES = 4

/** URL without scheme, "www." or trailing slash: what people type to reach it. */
function typedForm(url: string): string {
  const bare = url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
  // Show "Júpiter", not "J%C3%BApiter".
  try {
    return decodeURI(bare)
  } catch {
    return bare
  }
}

/** Whether the text would be opened as an address rather than searched. */
function looksLikeUrl(text: string): boolean {
  return !toUrl(text, 'google').startsWith(SEARCH_ENGINES.google.searchUrl)
}

function originOf(url: string): string | undefined {
  try {
    return `${new URL(url).origin}/`
  } catch {
    return undefined
  }
}

/** Points a ref we received from the parent at the input. */
function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value)
  else if (ref) (ref as React.RefObject<T | null>).current = value
}

/** Lowercase without accents, so "jupiter" finds "Júpiter". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Bolds every occurrence of the typed words (ignoring case and accents). */
function highlight(text: string, words: string[]): React.ReactNode {
  const folded = fold(text)
  const needles = words.map(fold).filter(Boolean)
  // Folding keeps lengths for ordinary accented letters; if not, don't risk misaligned bold.
  if (needles.length === 0 || folded.length !== text.length) return text
  const bold = new Array<boolean>(text.length).fill(false)
  for (const needle of needles) {
    for (let at = folded.indexOf(needle); at !== -1; at = folded.indexOf(needle, at + 1)) {
      bold.fill(true, at, at + needle.length)
    }
  }
  const parts: React.ReactNode[] = []
  let start = 0
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || bold[i] !== bold[start]) {
      const chunk = text.slice(start, i)
      parts.push(bold[start] ? <strong key={start}>{chunk}</strong> : chunk)
      start = i
    }
  }
  return parts
}

/**
 * Address bar with Chrome-style suggestions: inline autocompletion of the most
 * visited matching site, plus history, bookmarks and search engine suggestions.
 */
function AddressBar({
  tab,
  inputRef,
  bookmarks,
  searchEngine,
  searchSuggestions,
  onAddressChange,
  onNavigate,
  children
}: AddressBarProps): React.JSX.Element {
  const localRef = useRef<HTMLInputElement | null>(null)
  const requestId = useRef(0)
  const deleting = useRef(false)
  const [typed, setTyped] = useState<string | null>(null)
  const [completion, setCompletion] = useState('')
  const [items, setItems] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState(0)
  const [open, setOpen] = useState(false)

  const searchUrl = (text: string): string =>
    SEARCH_ENGINES[searchEngine].searchUrl + encodeURIComponent(text.trim())
  const searchItem = (text: string, key = `search:${text}`): Suggestion => ({
    kind: 'search',
    key,
    text,
    target: searchUrl(text),
    fill: text
  })

  const editing = typed !== null
  const value = !editing
    ? tab.address
    : open && selected > 0 && items[selected]
      ? items[selected].fill
      : typed + completion

  // Select the autocompleted part so typing over it replaces it.
  useLayoutEffect(() => {
    const input = localRef.current
    if (input && editing && completion && selected === 0 && document.activeElement === input) {
      input.setSelectionRange(typed.length, typed.length + completion.length)
    }
  }, [editing, typed, completion, selected])

  const close = (): void => {
    requestId.current++
    setOpen(false)
    setItems([])
    setCompletion('')
    setSelected(0)
  }

  const update = async (text: string, allowInline: boolean): Promise<void> => {
    const id = ++requestId.current
    const query = text.trim()
    if (!query) {
      close()
      return
    }
    const words = fold(query).split(/\s+/)
    const history = await window.api.suggestHistory(query, MAX_HISTORY + 3)
    if (id !== requestId.current) return

    const matchingBookmarks = bookmarks.filter((bookmark) => {
      const haystack = fold(`${bookmark.title} ${typedForm(bookmark.url)}`)
      return words.every((word) => haystack.includes(word))
    })

    // Inline completion: the best page whose address starts with the text.
    let inline: Suggestion | null = null
    let inlineText = ''
    if (allowInline && !/\s/.test(text)) {
      const lower = text.toLowerCase()
      const candidates = [...history, ...matchingBookmarks]
      const best = candidates.find((page) => typedForm(page.url).toLowerCase().startsWith(lower))
      if (best) {
        const address = typedForm(best.url)
        const host = address.split('/')[0]
        // Complete to the site itself unless the user is already typing a path.
        const toHost = lower.length <= host.length
        inlineText = toHost ? host : address
        const exact = candidates.find((page) => typedForm(page.url) === inlineText)
        const target = exact?.url ?? (toHost ? (originOf(best.url) ?? best.url) : best.url)
        inline = {
          kind: 'page',
          source: 'history',
          key: `inline:${target}`,
          text: exact?.title || inlineText,
          url: inlineText,
          favicon: exact?.favicon ?? best.favicon,
          target,
          fill: inlineText
        }
      }
    }

    const first: Suggestion =
      inline ??
      (looksLikeUrl(query)
        ? {
            kind: 'page',
            key: `go:${query}`,
            text: query,
            target: toUrl(query, searchEngine),
            fill: query
          }
        : searchItem(query))
    const list: Suggestion[] = [first]
    if (first.kind === 'page') list.push(searchItem(query))

    const seen = new Set(list.map((item) => item.target))
    for (const bookmark of matchingBookmarks.slice(0, MAX_BOOKMARKS)) {
      if (seen.has(bookmark.url)) continue
      seen.add(bookmark.url)
      list.push({
        kind: 'page',
        source: 'bookmark',
        key: `bookmark:${bookmark.id}`,
        text: bookmark.title || typedForm(bookmark.url),
        url: typedForm(bookmark.url),
        favicon: bookmark.favicon,
        target: bookmark.url,
        fill: typedForm(bookmark.url)
      })
    }
    for (const page of history) {
      if (list.length >= 1 + MAX_BOOKMARKS + MAX_HISTORY || seen.has(page.url)) continue
      seen.add(page.url)
      list.push({
        kind: 'page',
        source: 'history',
        key: `history:${page.url}`,
        text: page.title || typedForm(page.url),
        url: typedForm(page.url),
        favicon: page.favicon,
        target: page.url,
        fill: typedForm(page.url)
      })
    }

    setItems(list)
    setCompletion(inline ? inlineText.slice(text.length) : '')
    setSelected(0)
    setOpen(true)

    if (!searchSuggestions) return
    const remote = await window.api.suggestSearch(searchEngine, query)
    if (id !== requestId.current) return
    const extra = remote
      .filter((suggestion) => suggestion.toLowerCase() !== query.toLowerCase())
      .slice(0, MAX_SEARCHES)
      .map((suggestion) => searchItem(suggestion, `suggest:${suggestion}`))
    if (extra.length > 0) setItems((current) => [...current, ...extra])
  }

  const activate = (item: Suggestion | undefined, fallback: string): void => {
    close()
    setTyped(null)
    localRef.current?.blur()
    onNavigate(item ? item.target : fallback)
  }

  const removeFromHistory = async (item: Suggestion): Promise<void> => {
    await window.api.deleteHistoryUrl(item.target)
    if (typed !== null) void update(typed, false)
  }

  const words = (typed ?? '').trim().toLowerCase().split(/\s+/)

  return (
    <form
      className="address-form"
      onSubmit={(event) => {
        event.preventDefault()
        const text = value.trim()
        if (!text) return
        activate(open ? items[selected] : undefined, text)
      }}
    >
      <input
        ref={(element) => {
          localRef.current = element
          assignRef(inputRef, element)
        }}
        className={open && items.length > 0 ? 'address-bar open' : 'address-bar'}
        type="text"
        value={value}
        placeholder="Escribe una URL o busca en la web"
        spellCheck={false}
        autoComplete="off"
        onFocus={(event) => event.target.select()}
        onBlur={() => {
          close()
          setTyped(null)
        }}
        onChange={(event) => {
          const text = event.target.value
          setTyped(text)
          onAddressChange(text)
          void update(text, !deleting.current)
          deleting.current = false
        }}
        onKeyDown={(event) => {
          if (event.key === 'Backspace' || event.key === 'Delete') deleting.current = true
          if (!open || items.length === 0) {
            if (event.key === 'Escape') {
              // Second Escape: back to the page's own address.
              setTyped(null)
              onAddressChange(tab.kind === 'newtab' ? '' : tab.url)
              event.currentTarget.select()
            }
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const step = event.key === 'ArrowDown' ? 1 : -1
            setSelected((current) => (current + step + items.length) % items.length)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            close()
          } else if (
            event.key === 'Delete' &&
            event.shiftKey &&
            items[selected]?.source === 'history'
          ) {
            event.preventDefault()
            void removeFromHistory(items[selected])
          }
        }}
      />
      {children}

      {open && items.length > 0 && (
        <ul className="omnibox" role="listbox">
          {items.map((item, index) => (
            <li
              key={item.key}
              role="option"
              aria-selected={index === selected}
              className={index === selected ? 'omnibox-item selected' : 'omnibox-item'}
              // Keep focus in the input so blur doesn't close the list first.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setSelected(index)}
              onClick={() => activate(item, item.target)}
            >
              <span className="omnibox-icon">
                {item.kind === 'search' ? '⌕' : <Favicon url={item.target} src={item.favicon} />}
              </span>
              <span className="omnibox-text">
                {highlight(item.text, words)}
                {item.kind === 'page' && item.url && item.url !== item.text && (
                  <span className="omnibox-url"> – {highlight(item.url, words)}</span>
                )}
                {item.kind === 'search' && (
                  <span className="omnibox-hint">
                    {' '}
                    – Buscar con {SEARCH_ENGINES[searchEngine].label}
                  </span>
                )}
              </span>
              {item.source === 'bookmark' && <span className="omnibox-star">★</span>}
              {item.source === 'history' && !item.key.startsWith('inline:') && (
                <button
                  type="button"
                  className="omnibox-remove"
                  title="Quitar del historial (Mayús+Supr)"
                  onClick={(event) => {
                    event.stopPropagation()
                    void removeFromHistory(item)
                  }}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}

export default AddressBar
