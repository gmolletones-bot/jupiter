import { app, ipcMain, type WebContents } from 'electron'
import { randomUUID } from 'crypto'
import { readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'

// Browsing history, recorded here from each tab's navigation events so it
// doesn't depend on the UI. Kept in memory and written to disk shortly after
// each change (and on quit).

const MAX_ENTRIES = 10000
const SAVE_DELAY_MS = 1000
const FILE = (): string => join(app.getPath('userData'), 'history.json')

let entries: HistoryEntry[] = []
let saveTimer: NodeJS.Timeout | undefined

function load(): void {
  try {
    const data = JSON.parse(readFileSync(FILE(), 'utf-8'))
    entries = Array.isArray(data) ? data : []
  } catch {
    entries = []
  }
}

function saveNow(): void {
  clearTimeout(saveTimer)
  saveTimer = undefined
  try {
    writeFileSync(`${FILE()}.tmp`, JSON.stringify(entries))
    renameSync(`${FILE()}.tmp`, FILE())
  } catch (error) {
    console.error('No se pudo guardar el historial:', error)
  }
}

function scheduleSave(): void {
  if (!saveTimer) saveTimer = setTimeout(saveNow, SAVE_DELAY_MS)
}

function withoutHash(url: string): string {
  return url.split('#')[0]
}

/** Records visits made in a tab (a <webview>'s contents). */
export function trackHistory(contents: WebContents): void {
  let current: HistoryEntry | undefined

  const record = (url: string): void => {
    if (!/^https?:\/\//i.test(url) || /\/embed\//.test(url)) return
    // Reloads and hash changes don't count as new visits.
    if (current && withoutHash(current.url) === withoutHash(url)) return
    current = { id: randomUUID(), url, title: '', visitedAt: Date.now() }
    entries.unshift(current)
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES
    scheduleSave()
  }

  contents.on('did-navigate', (_event, url) => record(url))
  contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) record(url)
  })
  contents.on('page-title-updated', (_event, title) => {
    if (!current) return
    current.title = title
    scheduleSave()
  })
  contents.on('page-favicon-updated', (_event, favicons) => {
    if (!current || !favicons[0]) return
    current.favicon = favicons[0]
    scheduleSave()
  })
}

/** URL without scheme, "www." or trailing slash: what the user types to reach it. */
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

const DAY = 24 * 60 * 60 * 1000

/** Lowercase without accents, so "jupiter" finds "Júpiter". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Pages for the address bar: one per URL, matching every word typed, ranked
 * by how often and how recently they were visited, with a big boost when the
 * address starts with what was typed (that one gets autocompleted).
 */
function suggest(query: string, limit: number): HistorySuggestion[] {
  const words = fold(query.trim()).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const prefix = fold(query.trim())

  const byUrl = new Map<string, HistorySuggestion>()
  for (const entry of entries) {
    const key = entry.url.split('#')[0]
    const known = byUrl.get(key)
    if (known) {
      known.visits++
      if (!known.title && entry.title) known.title = entry.title
      if (!known.favicon && entry.favicon) known.favicon = entry.favicon
      continue
    }
    byUrl.set(key, {
      url: entry.url,
      title: entry.title,
      favicon: entry.favicon,
      visits: 1,
      lastVisit: entry.visitedAt
    })
  }

  const now = Date.now()
  const score = (item: HistorySuggestion): number => {
    const age = now - item.lastVisit
    const recency = age < DAY ? 6 : age < 7 * DAY ? 3 : age < 30 * DAY ? 1 : 0
    const typed = typedForm(item.url).toLowerCase()
    const startsWith = typed.startsWith(prefix) ? 40 : 0
    const titleStarts = fold(item.title).startsWith(prefix) ? 5 : 0
    // Shorter addresses first among equals: the site's root beats a deep link.
    return Math.min(item.visits, 30) * 2 + recency + startsWith + titleStarts - typed.length / 100
  }

  return [...byUrl.values()]
    .filter((item) => {
      const haystack = fold(`${item.title} ${typedForm(item.url)}`)
      return words.every((word) => haystack.includes(word))
    })
    .map((item) => ({ item, rank: score(item) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map(({ item }) => item)
}

export function clearHistory(): void {
  entries = []
  saveNow()
}

export function registerHistory(): void {
  load()
  app.on('before-quit', () => {
    if (saveTimer) saveNow()
  })

  ipcMain.handle('history:search', (_, query: string, offset: number, limit: number) => {
    const needle = query.trim().toLowerCase()
    const matches = needle
      ? entries.filter(
          (entry) =>
            entry.title.toLowerCase().includes(needle) || entry.url.toLowerCase().includes(needle)
        )
      : entries
    return {
      entries: matches.slice(offset, offset + limit),
      hasMore: matches.length > offset + limit
    }
  })

  ipcMain.handle('history:delete', (_, id: string) => {
    entries = entries.filter((entry) => entry.id !== id)
    scheduleSave()
  })

  ipcMain.handle('history:clear', () => clearHistory())

  ipcMain.handle('history:suggest', (_, query: string, limit: number) => suggest(query, limit))

  ipcMain.handle('history:delete-url', (_, url: string) => {
    const key = url.split('#')[0]
    entries = entries.filter((entry) => entry.url.split('#')[0] !== key)
    scheduleSave()
  })
}
