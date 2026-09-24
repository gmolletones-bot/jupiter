import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  type BrowserTheme = 'system' | 'light' | 'dark'

  type ShortcutAction =
    | 'new-tab'
    | 'close-tab'
    | 'next-tab'
    | 'prev-tab'
    | 'focus-address'
    | 'reload'
    | 'settings'
    | 'history'
    | 'bookmarks'
    | 'bookmark-page'
    | 'toggle-bookmarks-bar'
    | 'zoom-in'
    | 'zoom-out'
    | 'zoom-reset'
    | 'find'
    | 'print'
    | 'save-page'
    | 'devtools'
    | 'fullscreen'
    | 'extensions'
    | 'clear-data'
    | 'quit'

  type UpdateStatus =
    | { state: 'dev' | 'idle' | 'checking' | 'up-to-date'; version?: string }
    | { state: 'available' | 'downloading'; version?: string; percent?: number }
    | { state: 'downloaded'; version: string }
    | { state: 'error'; error: string; version?: string }

  /** 'hardware': done by the GPU; 'software': by the CPU; 'off': unavailable. */
  type Acceleration = 'hardware' | 'software' | 'off'

  interface SystemInfo {
    hardwareAcceleration: boolean
    /** What this run actually uses (changing the setting needs a restart). */
    accelerationActive: boolean
    autoUpdate: boolean
    /** Windows 11 Mica behind the tab strip. */
    mica: boolean
    micaSupported: boolean
    platform: string
    version: string
    gpu: Record<
      'videoDecode' | 'videoEncode' | 'rasterization' | 'compositing' | 'webgl',
      Acceleration
    >
  }

  interface HistorySuggestion {
    url: string
    title: string
    favicon?: string
    visits: number
    lastVisit: number
  }

  interface ShieldsState {
    /** Global switch for the ad & tracker blocker. */
    enabled: boolean
    /** Sites (hostnames) where the user turned shields down. */
    allowedSites: string[]
    /** Requests blocked since Jupiter started. */
    totalBlocked: number
    /** Hide cookie banners and decline Google/YouTube's consent screen. */
    cookieNotices: boolean
    /** 'lists': EasyList/uBlock engine loaded; 'basic': built-in domain list only. */
    engine: 'lists' | 'basic'
    /** When the filter lists were last downloaded (ms since epoch). */
    listsUpdatedAt?: number
  }

  interface HistoryEntry {
    id: string
    url: string
    title: string
    favicon?: string
    /** Milliseconds since epoch. */
    visitedAt: number
  }

  interface ExtensionInfo {
    id: string
    name: string
    version: string
    description: string
    path: string
    /** Data URL of the extension's icon. */
    icon?: string
    /** chrome-extension:// URL of the toolbar popup, if the extension has one. */
    popupUrl?: string
  }

  type StoreKey = 'settings' | 'session' | 'wallpaper' | 'wallpapers' | 'bookmarks'

  type ExtensionResult = { ok: true } | { ok: false; error: string }

  interface BrowserApi {
    /** Pages asked to open a link in a new window; returns an unsubscribe function. */
    onOpenInNewTab(callback: (url: string, activate: boolean) => void): () => void
    /** "Search the web" from the context menu; returns an unsubscribe function. */
    onSearchInNewTab(callback: (text: string) => void): () => void
    /** Keyboard shortcuts captured by the main process; returns an unsubscribe function. */
    onShortcut(callback: (action: ShortcutAction) => void): () => void
    /** Reads a stored value synchronously (used once at startup). */
    storeGet(key: StoreKey): string | null
    /** Persists a value to disk right away; null clears it. */
    storeSet(key: StoreKey, value: string | null): void
    setTheme(theme: BrowserTheme): void
    /** Colours of the native window buttons drawn over the tab bar. */
    setTitleBarColors(colors: { color: string; symbolColor: string }): void
    /** Also clears the history. */
    clearBrowsingData(): Promise<void>
    /** Newest first; `query` filters by title or URL. */
    searchHistory(
      query: string,
      offset: number,
      limit: number
    ): Promise<{ entries: HistoryEntry[]; hasMore: boolean }>
    deleteHistoryEntry(id: string): Promise<void>
    /** Every visit to this URL. */
    deleteHistoryUrl(url: string): Promise<void>
    /** Best history matches for the address bar. */
    suggestHistory(query: string, limit: number): Promise<HistorySuggestion[]>
    /** Search engine suggestions for a partial query ('google' | 'duckduckgo' | 'bing'). */
    suggestSearch(engine: string, query: string): Promise<string[]>
    getSystem(): Promise<SystemInfo>
    setSystem(
      patch: Partial<Pick<SystemInfo, 'hardwareAcceleration' | 'autoUpdate' | 'mica'>>
    ): Promise<void>
    /** Restarts Jupiter (to apply the hardware acceleration setting). */
    relaunch(): void
    getUpdateStatus(): Promise<UpdateStatus>
    checkForUpdates(): Promise<void>
    downloadUpdate(): Promise<void>
    /** Restarts into the downloaded update. */
    installUpdate(): void
    onUpdateStatus(callback: (status: UpdateStatus) => void): () => void
    /** Dominant colour of a favicon (#rrggbb), or null. */
    faviconColor(url: string): Promise<string | null>
    getShields(): Promise<ShieldsState>
    setShieldsEnabled(enabled: boolean): Promise<void>
    setCookieNotices(enabled: boolean): Promise<void>
    /** Downloads the latest filter lists now. */
    updateShieldLists(): Promise<void>
    /** Shields up (block) or down (allow everything) on one site. */
    setSiteShields(site: string, shieldsUp: boolean): Promise<void>
    /** Blocked-request count of a tab's page, by the tab's webContents id. */
    onShieldsBlocked(callback: (contentsId: number, count: number) => void): () => void
    toggleFullscreen(): void
    /** "Save page as…" for the tab with this webContents id. */
    savePage(contentsId: number): Promise<void>
    quit(): void
    /** Current live video id of a YouTube channel (e.g. "@LofiGirl"), or null if not live. */
    youtubeLiveId(handle: string): Promise<string | null>
    clearHistory(): Promise<void>
    listExtensions(): Promise<ExtensionInfo[]>
    /** Asks for an unpacked extension folder and loads it. */
    addExtension(): Promise<ExtensionResult>
    removeExtension(id: string): Promise<void>
    /** `anchor` is the bottom-right corner of the toolbar button, in window coordinates. */
    openExtensionPopup(popupUrl: string, anchor: { x: number; y: number }): void
  }

  interface Window {
    electron: ElectronAPI
    api: BrowserApi
  }
}
