import type { Bookmark, Settings, StoredWallpaper } from './types'
import { NEW_TAB_URL, upgradeInternalUrl } from './url'

// Values live in files written by the main process (see src/main/store.ts).
// Older versions used localStorage under these keys; they are read once as a
// fallback so existing settings carry over.
const LEGACY_KEYS: Record<StoreKey, string> = {
  settings: 'navegador.settings',
  session: 'navegador.session',
  wallpaper: 'navegador.wallpaper',
  wallpapers: 'navegador.wallpapers',
  bookmarks: 'navegador.bookmarks'
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  homePage: NEW_TAB_URL,
  searchEngine: 'google',
  searchSuggestions: true,
  startup: 'home',
  accentColor: '#3b82f6',
  tintTabBar: false,
  siteColors: true,
  animations: true,
  cornerRadius: 10,
  wallpaper: 'aurora',
  nightWallpaper: 'midnight',
  userName: '',
  showClock: true,
  clockFormat: '24h',
  greetingStyle: 'handwritten',
  showWeather: true,
  weatherLocation: null,
  temperatureUnit: 'celsius',
  showFocus: true,
  focusMinutes: 25,
  breakMinutes: 5,
  focusBlockSites: true,
  focusBlockedSites: [
    'facebook.com',
    'instagram.com',
    'x.com',
    'twitter.com',
    'tiktok.com',
    'reddit.com',
    'netflix.com'
  ],
  showShieldStats: true,
  showSounds: true,
  customPlaylists: [],
  showShortcuts: true,
  shortcuts: [
    { id: 'youtube', title: 'YouTube', url: 'https://www.youtube.com' },
    { id: 'github', title: 'GitHub', url: 'https://github.com' },
    { id: 'wikipedia', title: 'Wikipedia', url: 'https://es.wikipedia.org' },
    { id: 'gmail', title: 'Gmail', url: 'https://mail.google.com' }
  ],
  showBookmarksBar: true,
  onboarded: false
}

export interface SavedSession {
  urls: string[]
  activeIndex: number
}

function readRaw(key: StoreKey): string | null {
  const value = window.api.storeGet(key)
  if (value !== null) return value
  try {
    return localStorage.getItem(LEGACY_KEYS[key])
  } catch {
    return null
  }
}

function read<T>(key: StoreKey): T | null {
  try {
    const raw = readRaw(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function loadSettings(): Settings {
  const settings = { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>('settings') }
  // Older versions had a single uploaded wallpaper called "custom".
  if (settings.wallpaper === 'custom') settings.wallpaper = 'img:custom'
  settings.homePage = upgradeInternalUrl(settings.homePage)
  return settings
}

export function saveSettings(settings: Settings): void {
  window.api.storeSet('settings', JSON.stringify(settings))
}

export function loadSession(): SavedSession | null {
  const session = read<SavedSession>('session')
  return session && Array.isArray(session.urls) && session.urls.length > 0 ? session : null
}

export function saveSession(sessionJson: string): void {
  window.api.storeSet('session', sessionJson)
}

export function loadBookmarks(): Bookmark[] {
  const bookmarks = read<Bookmark[]>('bookmarks')
  return Array.isArray(bookmarks) ? bookmarks : []
}

export function saveBookmarks(bookmarks: Bookmark[]): void {
  window.api.storeSet('bookmarks', JSON.stringify(bookmarks))
}

/** Uploaded wallpapers (data URLs), kept apart so settings stay small. */
export function loadWallpapers(): StoredWallpaper[] {
  const wallpapers = read<StoredWallpaper[]>('wallpapers')
  if (Array.isArray(wallpapers)) return wallpapers
  const legacy = readRaw('wallpaper')
  return legacy ? [{ id: 'custom', dataUrl: legacy }] : []
}

export function saveWallpapers(wallpapers: StoredWallpaper[]): void {
  window.api.storeSet('wallpapers', JSON.stringify(wallpapers))
}
