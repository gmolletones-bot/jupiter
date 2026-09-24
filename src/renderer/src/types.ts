export type SearchEngine = 'google' | 'duckduckgo' | 'bing'

export type StartupMode = 'home' | 'restore'

export type WallpaperPreset =
  'ambient' | 'aurora' | 'neon' | 'sunset' | 'ocean' | 'forest' | 'midnight' | 'accent' | 'plain'

/** A preset id, or `img:<id>` for an image in the uploaded gallery. */
export type WallpaperRef = string

export interface StoredWallpaper {
  id: string
  dataUrl: string
}

/** Internal pages that exist at most once (opening them again focuses the tab). */
export type InternalPage = 'settings' | 'history' | 'bookmarks'

export type SettingsSection =
  'personalization' | 'widgets' | 'home' | 'search' | 'privacy' | 'extensions' | 'system' | 'about'

export interface Shortcut {
  id: string
  title: string
  url: string
}

export interface Bookmark {
  id: string
  url: string
  title: string
  favicon?: string
  createdAt: number
}

export interface WeatherLocation {
  name: string
  country: string
  latitude: number
  longitude: number
}

export interface CustomPlaylist {
  id: string
  title: string
  url: string
}

export interface Settings {
  theme: BrowserTheme
  homePage: string
  searchEngine: SearchEngine
  /** Ask the search engine for suggestions while typing in the address bar. */
  searchSuggestions: boolean
  startup: StartupMode
  accentColor: string
  tintTabBar: boolean
  /** Take the tab strip and toolbar colour from each site's theme colour. */
  siteColors: boolean
  animations: boolean
  /** Base corner radius in px, scaled per element. */
  cornerRadius: number
  wallpaper: WallpaperRef
  /** Used from 19:00 to 7:00; empty means the same as `wallpaper`. */
  nightWallpaper: WallpaperRef
  userName: string
  showClock: boolean
  clockFormat: '24h' | '12h'
  greetingStyle: 'classic' | 'handwritten'
  showWeather: boolean
  weatherLocation: WeatherLocation | null
  temperatureUnit: 'celsius' | 'fahrenheit'
  showFocus: boolean
  focusMinutes: number
  breakMinutes: number
  showSounds: boolean
  customPlaylists: CustomPlaylist[]
  showShortcuts: boolean
  shortcuts: Shortcut[]
  showBookmarksBar: boolean
}

export interface Tab {
  id: number
  kind: 'web' | 'newtab' | InternalPage
  /** URL the webview is created with; never changes, so React doesn't reload the page. */
  initialUrl: string
  /** URL currently shown by the page. */
  url: string
  /** Text in the address bar, which the user may be editing. */
  address: string
  title: string
  favicon?: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  /** The webview's webContents id, known once it's attached (main process refers to tabs by it). */
  contentsId?: number
  /** The page's <meta name="theme-color">, as #rrggbb. */
  themeColor?: string
  /** Dominant colour of the favicon, used when there's no usable theme colour. */
  faviconColor?: string
  /** Page zoom factor (1 = 100 %). */
  zoom?: number
  /** Set when the page couldn't be loaded (DNS error, no connection…). */
  loadError?: { url: string; code: string }
}
