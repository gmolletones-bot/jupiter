import type { InternalPage, SearchEngine } from './types'

export const NEW_TAB_URL = 'jupiter://inicio'

export const INTERNAL_PAGES: Record<InternalPage, { url: string; title: string }> = {
  settings: { url: 'jupiter://configuracion', title: 'Configuración' },
  history: { url: 'jupiter://historial', title: 'Historial' },
  bookmarks: { url: 'jupiter://marcadores', title: 'Marcadores' }
}

const OLD_SCHEME = 'navegador://'

/** Internal pages were navegador:// before the rename; saved sessions and settings may still say so. */
export function upgradeInternalUrl(url: string): string {
  return url.startsWith(OLD_SCHEME) ? `jupiter://${url.slice(OLD_SCHEME.length)}` : url
}

export function internalPageOf(url: string): InternalPage | undefined {
  return (Object.keys(INTERNAL_PAGES) as InternalPage[]).find(
    (page) => INTERNAL_PAGES[page].url === url
  )
}

export const SEARCH_ENGINES: Record<SearchEngine, { label: string; searchUrl: string }> = {
  google: { label: 'Google', searchUrl: 'https://www.google.com/search?q=' },
  duckduckgo: { label: 'DuckDuckGo', searchUrl: 'https://duckduckgo.com/?q=' },
  bing: { label: 'Bing', searchUrl: 'https://www.bing.com/search?q=' }
}

// Turns what the user typed into a loadable URL: adds https:// to bare
// domains and falls back to a web search for anything else.
export function toUrl(input: string, engine: SearchEngine): string {
  const text = input.trim()
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(text)) return upgradeInternalUrl(text)
  if (/^localhost(:\d+)?(\/|$)/i.test(text)) return `http://${text}`
  if (!/\s/.test(text) && /\.[a-z]{2,}(:\d+)?(\/|$)/i.test(text)) return `https://${text}`
  return SEARCH_ENGINES[engine].searchUrl + encodeURIComponent(text)
}

/** Exact hostname of a URL, or '' if it can't be parsed. */
export function exactHostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/** Whether the URL's host is one of `sites` or a subdomain of one. */
export function hostMatches(url: string, sites: string[]): boolean {
  const host = exactHostOf(url).toLowerCase()
  return Boolean(host) && sites.some((site) => host === site || host.endsWith(`.${site}`))
}

/** Error code of the notice shown for sites blocked by Focus mode. */
export const FOCUS_BLOCKED = 'FOCUS_BLOCKED'

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
