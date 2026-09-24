import { useCallback, useEffect, useEffectEvent, useReducer, useRef, useState } from 'react'
import type { WebviewTag } from 'electron'
import {
  AudioWaveform,
  BookmarkPlus,
  CloudRain,
  Cpu,
  Flame,
  History,
  House,
  Info,
  LogOut,
  Maximize,
  Monitor,
  Moon,
  Orbit,
  Palette,
  PanelTop,
  Pause,
  Plus,
  Printer,
  Puzzle,
  Radio,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Scan,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  ShieldOff,
  Square,
  Star,
  Sun,
  Timer,
  Trash2,
  VolumeX,
  Waves,
  Wind,
  Wrench,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import BookmarksBar from './components/BookmarksBar'
import BookmarksPage from './components/BookmarksPage'
import CommandPalette, { type PaletteCommand } from './components/CommandPalette'
import FindBar from './components/FindBar'
import HistoryPage from './components/HistoryPage'
import NewTabPage from './components/NewTabPage'
import MiniPlayer from './components/widgets/MiniPlayer'
import SettingsPage from './components/SettingsPage'
import TabBar from './components/TabBar'
import UpdateBanner from './components/UpdateBanner'
import Welcome from './components/Welcome'
import Toolbar from './components/Toolbar'
import WebTab from './components/WebTab'
import {
  loadBookmarks,
  loadSettings,
  loadWallpapers,
  saveBookmarks,
  saveSession,
  saveSettings,
  saveWallpapers
} from './storage'
import {
  createInitialTabs,
  createInternalTab,
  createNewTabPage,
  createTab,
  createWebTab,
  tabsReducer
} from './tabs'
import type {
  Bookmark,
  InternalPage,
  Settings,
  SettingsSection,
  StoredWallpaper,
  Tab
} from './types'
import { useAppearance } from './useAppearance'
import {
  exactHostOf,
  FOCUS_BLOCKED,
  hostMatches,
  internalPageOf,
  NEW_TAB_URL,
  SEARCH_ENGINES,
  toUrl
} from './url'
import { embedForVideo, type Playlist } from './widgets/playlists'
import type { SoundId } from './widgets/ambient'
import { useAmbient } from './widgets/useAmbient'
import { usePomodoro } from './widgets/usePomodoro'

function App(): React.JSX.Element {
  const [settings, setSettings] = useState(loadSettings)
  const [wallpapers, setWallpapers] = useState(loadWallpapers)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [notice, setNotice] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [shields, setShields] = useState<ShieldsState>({
    enabled: true,
    allowedSites: [],
    totalBlocked: 0,
    cookieNotices: true,
    engine: 'basic'
  })
  /** Blocked ads/trackers per page, keyed by the tab's webContents id. */
  const [blockedCounts, setBlockedCounts] = useState<Record<number, number>>({})
  /** Tab whose find bar is open, plus a counter to refocus it on Ctrl+F. */
  const [find, setFind] = useState<{ tabId: number; focusKey: number } | null>(null)
  /** Commands of the open Ctrl+K palette (built when it opens); null when closed. */
  const [palette, setPalette] = useState<PaletteCommand[] | null>(null)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('personalization')
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([])
  const [bookmarks, setBookmarks] = useState(loadBookmarks)
  const [{ tabs, activeId }, dispatch] = useReducer(tabsReducer, settings, createInitialTabs)
  const webviews = useRef(new Map<number, WebviewTag>())
  const addressRef = useRef<HTMLInputElement>(null)

  const [mica, setMica] = useState(false)
  // Widgets live here, not in the new tab page, so they keep going across tabs.
  const pomodoro = usePomodoro(settings.focusMinutes, settings.breakMinutes)
  const ambient = useAmbient()
  // Distracting sites are blocked only while a focus period is running.
  const focusBlockUntil =
    settings.focusBlockSites && pomodoro.phase === 'focus' && pomodoro.endsAt !== null
      ? pomodoro.endsAt
      : null
  const focusBlocks = (url: string): boolean =>
    focusBlockUntil !== null && hostMatches(url, settings.focusBlockedSites)
  const blockedNotice = (url: string): Partial<Tab> => ({
    address: url,
    title: exactHostOf(url) || url,
    favicon: undefined,
    isLoading: false,
    loadError: { url, code: FOCUS_BLOCKED }
  })
  /** A web tab for `url`, or one showing the Focus notice without loading it. */
  const webTab = (url: string): Tab =>
    focusBlocks(url)
      ? { ...createWebTab(url), initialUrl: 'about:blank', ...blockedNotice(url) }
      : createWebTab(url)

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0]
  const isWebTab = activeTab.kind === 'web'
  useAppearance(
    settings,
    isWebTab ? activeTab.themeColor : undefined,
    isWebTab ? activeTab.faviconColor : undefined,
    mica
  )
  const activeBookmark =
    activeTab.kind === 'web'
      ? bookmarks.find((bookmark) => bookmark.url === activeTab.url)
      : undefined

  const updateTab = useCallback(
    (id: number, patch: Partial<Tab>) => dispatch({ type: 'update', id, patch }),
    []
  )

  const registerWebview = useCallback((id: number, webview: WebviewTag | null) => {
    if (webview) webviews.current.set(id, webview)
    else webviews.current.delete(id)
  }, [])

  const getWebview = useCallback((id: number) => webviews.current.get(id), [])

  const updateSettings = (patch: Partial<Settings>): void =>
    setSettings((current) => ({ ...current, ...patch }))

  const changeWallpapers = (next: StoredWallpaper[]): void => {
    setWallpapers(next)
    saveWallpapers(next)
  }

  const refreshExtensions = useCallback(() => {
    window.api.listExtensions().then(setExtensions).catch(console.error)
  }, [])

  // Runs a command on the active page; webview methods throw until the page is attached.
  const withActiveWebview = (command: (webview: WebviewTag) => void): void => {
    const webview = activeTab.kind === 'web' ? webviews.current.get(activeTab.id) : undefined
    if (!webview) return
    try {
      command(webview)
    } catch {
      // Not ready yet; the user can simply retry.
    }
  }

  const openTab = (tab: Tab = createNewTabPage(), activate = true): void =>
    dispatch({ type: 'open', tab, activate })

  const closeTab = (id: number): void =>
    dispatch({ type: 'close', id, fallback: createNewTabPage() })

  /** Settings, history and bookmarks exist once: focus the tab if it's already open. */
  const openInternalPage = (page: InternalPage): void => {
    const existing = tabs.find((tab) => tab.kind === page)
    if (existing) dispatch({ type: 'activate', id: existing.id })
    else openTab(createInternalTab(page))
  }

  const openSettings = (section?: SettingsSection): void => {
    if (section) setSettingsSection(section)
    openInternalPage('settings')
  }

  const navigate = (input: string): void => {
    const url = toUrl(input, settings.searchEngine)
    const page = internalPageOf(url)
    if (page) {
      // Internal pages open in their own tab; drop what was typed in this one.
      updateTab(activeTab.id, { address: activeTab.kind === 'newtab' ? '' : activeTab.url })
      openInternalPage(page)
      return
    }
    const next = internalPageOf(url) || url === NEW_TAB_URL ? createTab(url) : webTab(url)
    // Internal pages, or leaving one, swap the tab; web-to-web stays in the same webview.
    if (activeTab.kind !== 'web' || next.kind !== 'web') {
      dispatch({ type: 'replace', id: activeTab.id, tab: next })
      return
    }
    if (focusBlocks(url)) {
      updateTab(activeTab.id, blockedNotice(url))
      return
    }
    updateTab(activeTab.id, { address: url, loadError: undefined })
    withActiveWebview((webview) => {
      // Load errors are shown by the page itself, so the rejection needs no handling here.
      webview.loadURL(url).catch(() => {})
      webview.focus()
    })
  }

  /** Opens a saved link: in this tab, or in a background tab (Ctrl/middle click). */
  const openLink = (url: string, inBackground: boolean): void => {
    if (inBackground) openTab(webTab(url), false)
    else navigate(url)
  }

  const play = async (next: Playlist): Promise<void> => {
    if (!next.liveChannel) {
      setPlaylist(next)
      return
    }
    const videoId = await window.api.youtubeLiveId(next.liveChannel)
    if (videoId) setPlaylist({ ...next, ...embedForVideo(videoId) })
    else setNotice(`${next.title} no está en directo ahora mismo. Prueba otra playlist.`)
  }

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const toggleBookmark = (): void => {
    if (activeTab.kind !== 'web') return
    if (activeBookmark) {
      setBookmarks((current) => current.filter((bookmark) => bookmark.id !== activeBookmark.id))
      return
    }
    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      url: activeTab.url,
      title: activeTab.title,
      favicon: activeTab.favicon,
      createdAt: Date.now()
    }
    setBookmarks((current) => [...current, bookmark])
  }

  const ZOOM_STEPS = [
    0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5
  ]

  const zoom = (direction: 'in' | 'out' | 'reset'): void => {
    const current = activeTab.zoom ?? 1
    const next =
      direction === 'reset'
        ? 1
        : direction === 'in'
          ? (ZOOM_STEPS.find((step) => step > current + 0.001) ?? current)
          : (ZOOM_STEPS.findLast((step) => step < current - 0.001) ?? current)
    withActiveWebview((webview) => {
      webview.setZoomFactor(next)
      updateTab(activeTab.id, { zoom: next })
    })
  }

  const refreshShields = (): void => {
    window.api.getShields().then(setShields).catch(console.error)
  }

  const setSiteShields = async (site: string, shieldsUp: boolean): Promise<void> => {
    await window.api.setSiteShields(site, shieldsUp)
    refreshShields()
    // Reload so the page picks up (or drops) the blocked resources.
    withActiveWebview((webview) => {
      if (exactHostOf(webview.getURL()) === site) webview.reload()
    })
  }

  const setShieldsEnabled = async (enabled: boolean): Promise<void> => {
    await window.api.setShieldsEnabled(enabled)
    refreshShields()
    withActiveWebview((webview) => webview.reload())
  }

  const reload = (): void => {
    if (activeTab.loadError) updateTab(activeTab.id, { loadError: undefined })
    withActiveWebview((webview) => (activeTab.isLoading ? webview.stop() : webview.reload()))
  }

  const focusAddressBar = (): void => {
    addressRef.current?.focus()
    addressRef.current?.select()
  }

  const runAction = (action: ShortcutAction): void => {
    switch (action) {
      case 'new-tab':
        openTab()
        break
      case 'close-tab':
        closeTab(activeTab.id)
        break
      case 'next-tab':
        dispatch({ type: 'cycle', step: 1 })
        break
      case 'prev-tab':
        dispatch({ type: 'cycle', step: -1 })
        break
      case 'focus-address':
        focusAddressBar()
        break
      case 'reload':
        reload()
        break
      case 'settings':
        openSettings()
        break
      case 'history':
      case 'bookmarks':
        openInternalPage(action)
        break
      case 'bookmark-page':
        toggleBookmark()
        break
      case 'toggle-bookmarks-bar':
        updateSettings({ showBookmarksBar: !settings.showBookmarksBar })
        break
      case 'zoom-in':
        zoom('in')
        break
      case 'zoom-out':
        zoom('out')
        break
      case 'zoom-reset':
        zoom('reset')
        break
      case 'find':
        if (activeTab.kind === 'web') {
          setFind((current) => ({ tabId: activeTab.id, focusKey: (current?.focusKey ?? 0) + 1 }))
        }
        break
      case 'print':
        withActiveWebview((webview) => webview.print())
        break
      case 'save-page':
        if (activeTab.kind === 'web' && activeTab.contentsId !== undefined) {
          window.api.savePage(activeTab.contentsId).catch(console.error)
        }
        break
      case 'devtools':
        withActiveWebview((webview) => webview.openDevTools())
        break
      case 'fullscreen':
        window.api.toggleFullscreen()
        break
      case 'extensions':
        openSettings('extensions')
        break
      case 'clear-data':
        refreshShields()
        openSettings('privacy')
        break
      case 'quit':
        window.api.quit()
        break
      case 'command-palette':
        setPalette(palette ? null : paletteCommands())
        break
    }
  }

  /** Everything the Ctrl+K palette can do; the first ones show before typing. */
  const paletteCommands = (): PaletteCommand[] => {
    const site = activeTab.kind === 'web' ? exactHostOf(activeTab.url) : ''
    const siteShieldsUp = shields.enabled && !shields.allowedSites.includes(site)
    const focusRunning = pomodoro.endsAt !== null
    const command = (
      id: string,
      title: string,
      icon: PaletteCommand['icon'],
      run: () => void,
      keywords = '',
      hint?: string
    ): PaletteCommand => ({ id, title, icon, run, keywords, hint })
    const section = (
      id: SettingsSection,
      title: string,
      icon: PaletteCommand['icon']
    ): PaletteCommand =>
      command(
        `settings:${id}`,
        `Configuración: ${title}`,
        icon,
        () => openSettings(id),
        'ajustes opciones'
      )
    const sounds: [SoundId, string, PaletteCommand['icon']][] = [
      ['rain', 'Lluvia', CloudRain],
      ['fire', 'Chimenea', Flame],
      ['waves', 'Olas', Waves],
      ['wind', 'Viento', Wind],
      ['white', 'Ruido blanco', Radio],
      ['brown', 'Ruido marrón', AudioWaveform]
    ]

    return [
      command('new-tab', 'Nueva pestaña', Plus, () => runAction('new-tab'), 'abrir', 'Ctrl+T'),
      command('history', 'Historial', History, () => runAction('history'), 'visitadas', 'Ctrl+H'),
      command('bookmarks', 'Marcadores', Star, () => runAction('bookmarks'), 'favoritos'),
      command(
        'theme-toggle',
        settings.theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
        settings.theme === 'dark' ? Sun : Moon,
        () => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }),
        'modo oscuro claro tema noche'
      ),
      command(
        'focus-toggle',
        focusRunning ? 'Pausar el temporizador Focus' : 'Iniciar el temporizador Focus',
        focusRunning ? Pause : Timer,
        pomodoro.toggle,
        'pomodoro concentración trabajo'
      ),
      command('settings', 'Configuración', SettingsIcon, () => openSettings(), 'ajustes opciones'),
      command(
        'find',
        'Buscar en la página',
        Search,
        () => runAction('find'),
        'encontrar',
        'Ctrl+F'
      ),
      command('close-tab', 'Cerrar pestaña', X, () => runAction('close-tab'), '', 'Ctrl+W'),
      command(
        'reload',
        'Recargar la página',
        RotateCw,
        () => runAction('reload'),
        'actualizar',
        'Ctrl+R'
      ),
      command(
        'bookmark-page',
        activeBookmark ? 'Quitar de marcadores' : 'Añadir a marcadores',
        BookmarkPlus,
        () => runAction('bookmark-page'),
        'guardar favorito estrella',
        'Ctrl+D'
      ),
      command(
        'bookmarks-bar',
        settings.showBookmarksBar
          ? 'Ocultar la barra de marcadores'
          : 'Mostrar la barra de marcadores',
        PanelTop,
        () => runAction('toggle-bookmarks-bar')
      ),
      command(
        'zoom-in',
        'Acercar',
        ZoomIn,
        () => runAction('zoom-in'),
        'zoom más grande',
        'Ctrl++'
      ),
      command(
        'zoom-out',
        'Alejar',
        ZoomOut,
        () => runAction('zoom-out'),
        'zoom más pequeño',
        'Ctrl+-'
      ),
      command(
        'zoom-reset',
        'Restablecer el zoom',
        Scan,
        () => runAction('zoom-reset'),
        '100',
        'Ctrl+0'
      ),
      command(
        'fullscreen',
        'Pantalla completa',
        Maximize,
        () => runAction('fullscreen'),
        '',
        'F11'
      ),
      command('print', 'Imprimir', Printer, () => runAction('print'), '', 'Ctrl+P'),
      command(
        'save-page',
        'Guardar página como…',
        Save,
        () => runAction('save-page'),
        'descargar',
        'Ctrl+S'
      ),
      command(
        'devtools',
        'Herramientas para desarrolladores',
        Wrench,
        () => runAction('devtools'),
        'inspeccionar consola devtools'
      ),
      command(
        'theme-system',
        'Usar el tema del sistema',
        Monitor,
        () => updateSettings({ theme: 'system' }),
        'automático'
      ),
      ...(site
        ? [
            command(
              'site-shields',
              siteShieldsUp ? `Bajar los escudos en ${site}` : `Subir los escudos en ${site}`,
              siteShieldsUp ? ShieldOff : ShieldCheck,
              () => void setSiteShields(site, !siteShieldsUp),
              'bloqueador anuncios rastreadores'
            )
          ]
        : []),
      command(
        'shields',
        shields.enabled
          ? 'Desactivar el bloqueador de anuncios'
          : 'Activar el bloqueador de anuncios',
        shields.enabled ? ShieldOff : Shield,
        () => void setShieldsEnabled(!shields.enabled),
        'escudos rastreadores'
      ),
      command(
        'focus-reset',
        'Reiniciar el temporizador Focus',
        RotateCcw,
        pomodoro.reset,
        'pomodoro'
      ),
      ...sounds.map(([id, name, icon]) =>
        command(
          `sound:${id}`,
          `${ambient.levels[id] !== undefined ? 'Detener' : 'Reproducir'} sonido: ${name}`,
          icon,
          () => ambient.toggle(id),
          'ambiente música relajante'
        )
      ),
      ...(Object.keys(ambient.levels).length > 0
        ? [command('mute', 'Silenciar todos los sonidos', VolumeX, ambient.stopAll, 'callar parar')]
        : []),
      ...(playlist
        ? [
            command(
              'stop-music',
              `Detener la música (${playlist.title})`,
              Square,
              () => setPlaylist(null),
              'parar reproductor'
            )
          ]
        : []),
      section('personalization', 'Personalización', Palette),
      section('widgets', 'Widgets de inicio', Orbit),
      section('home', 'Inicio y pestañas', House),
      section('search', 'Buscador', Search),
      section('privacy', 'Privacidad y escudos', Shield),
      section('extensions', 'Extensiones', Puzzle),
      section('system', 'Sistema y actualizaciones', Cpu),
      section('about', 'Acerca de Jupiter', Info),
      command(
        'clear-data',
        'Eliminar datos de navegación',
        Trash2,
        () => runAction('clear-data'),
        'borrar cookies caché'
      ),
      command(
        'updates',
        'Buscar actualizaciones',
        RefreshCw,
        () => {
          openSettings('system')
          void window.api.checkForUpdates()
        },
        'versión nueva'
      ),
      command('quit', 'Salir de Jupiter', LogOut, () => runAction('quit'), 'cerrar')
    ]
  }

  const onShortcut = useEffectEvent((action: ShortcutAction) => runAction(action))

  useEffect(() => window.api.onShortcut((action) => onShortcut(action)), [])

  const onOpenInNewTab = useEffectEvent((url: string, activate: boolean) =>
    dispatch({ type: 'open', tab: webTab(url), activate })
  )

  useEffect(() => window.api.onOpenInNewTab((url, activate) => onOpenInNewTab(url, activate)), [])

  // A link inside a page led to a blocked site: show the notice in that tab.
  const onFocusBlocked = useEffectEvent((contentsId: number, url: string) => {
    const tab = tabs.find((candidate) => candidate.contentsId === contentsId)
    if (tab) updateTab(tab.id, blockedNotice(url))
  })

  useEffect(
    () => window.api.onFocusBlocked((contentsId, url) => onFocusBlocked(contentsId, url)),
    []
  )

  const onSearchInNewTab = useEffectEvent((text: string) =>
    openTab(
      createWebTab(SEARCH_ENGINES[settings.searchEngine].searchUrl + encodeURIComponent(text))
    )
  )

  useEffect(() => window.api.onSearchInNewTab((text) => onSearchInNewTab(text)), [])

  useEffect(refreshExtensions, [refreshExtensions])

  const blockedSitesKey = settings.focusBlockedSites.join(',')
  useEffect(() => {
    if (focusBlockUntil === null) window.api.setFocusBlocking(null)
    else window.api.setFocusBlocking(blockedSitesKey.split(',').filter(Boolean), focusBlockUntil)
  }, [focusBlockUntil, blockedSitesKey])

  useEffect(() => {
    window.api
      .getSystem()
      .then((system) => setMica(system.micaSupported && system.mica))
      .catch(console.error)
  }, [])

  useEffect(() => {
    window.api.getUpdateStatus().then(setUpdateStatus).catch(console.error)
    return window.api.onUpdateStatus(setUpdateStatus)
  }, [])

  useEffect(() => {
    window.api.getShields().then(setShields).catch(console.error)
    return window.api.onShieldsBlocked((contentsId, count) =>
      setBlockedCounts((current) => ({ ...current, [contentsId]: count }))
    )
  }, [])

  useEffect(() => saveBookmarks(bookmarks), [bookmarks])

  useEffect(() => {
    saveSettings(settings)
    window.api.setTheme(settings.theme)
  }, [settings])

  const sessionTabs = tabs.filter((tab) => tab.kind !== 'settings')
  const sessionJson = JSON.stringify({
    urls: sessionTabs.map((tab) => tab.url),
    activeIndex: Math.max(
      0,
      sessionTabs.findIndex((tab) => tab.id === activeId)
    )
  })
  useEffect(() => saveSession(sessionJson), [sessionJson])

  useEffect(() => {
    document.title = `${activeTab.title} - Jupiter`
  }, [activeTab.title])

  const renderPage = (tab: Tab): React.JSX.Element => {
    const active = tab.id === activeId
    switch (tab.kind) {
      case 'web':
        return (
          <WebTab
            key={tab.id}
            tab={tab}
            active={active}
            focusBlockUntil={focusBlockUntil}
            onUpdate={updateTab}
            registerWebview={registerWebview}
          />
        )
      case 'newtab':
        return (
          <NewTabPage
            key={tab.id}
            settings={settings}
            wallpapers={wallpapers}
            active={active}
            pomodoro={pomodoro}
            ambient={ambient}
            currentPlaylistId={playlist?.id}
            onPlay={play}
            onNavigate={navigate}
            onChange={updateSettings}
            onOpenSettings={openSettings}
          />
        )
      case 'settings':
        return (
          <SettingsPage
            key={tab.id}
            settings={settings}
            wallpapers={wallpapers}
            extensions={extensions}
            section={settingsSection}
            active={active}
            onSectionChange={setSettingsSection}
            onChange={updateSettings}
            onWallpapersChange={changeWallpapers}
            mica={mica}
            onMicaChange={(on) => {
              setMica(on)
              window.api.setSystem({ mica: on }).catch(console.error)
            }}
            onExtensionsChanged={refreshExtensions}
            shields={shields}
            onShieldsEnabled={setShieldsEnabled}
            onSetSiteShields={setSiteShields}
            onShieldsChanged={refreshShields}
            updateStatus={updateStatus}
          />
        )
      case 'history':
        return <HistoryPage key={tab.id} active={active} onOpen={openLink} />
      case 'bookmarks':
        return (
          <BookmarksPage
            key={tab.id}
            bookmarks={bookmarks}
            active={active}
            showBar={settings.showBookmarksBar}
            onToggleBar={(showBookmarksBar) => updateSettings({ showBookmarksBar })}
            onOpen={openLink}
            onRename={(id, title) =>
              setBookmarks((current) =>
                current.map((bookmark) => (bookmark.id === id ? { ...bookmark, title } : bookmark))
              )
            }
            onRemove={(id) =>
              setBookmarks((current) => current.filter((bookmark) => bookmark.id !== id))
            }
          />
        )
    }
  }

  return (
    <div className="browser">
      <TabBar
        tabs={tabs}
        activeId={activeId}
        onActivate={(id) => dispatch({ type: 'activate', id })}
        onClose={closeTab}
        onNew={() => openTab()}
      />
      <Toolbar
        tab={activeTab}
        extensions={extensions}
        isBookmarked={Boolean(activeBookmark)}
        bookmarks={bookmarks}
        searchEngine={settings.searchEngine}
        searchSuggestions={settings.searchSuggestions}
        inputRef={addressRef}
        onBack={() => withActiveWebview((webview) => webview.goBack())}
        onForward={() => withActiveWebview((webview) => webview.goForward())}
        onReload={reload}
        onHome={() => navigate(settings.homePage)}
        onAddressChange={(address) => updateTab(activeTab.id, { address })}
        onNavigate={navigate}
        onToggleBookmark={toggleBookmark}
        bookmarksBarVisible={settings.showBookmarksBar}
        onMenuAction={runAction}
        shields={shields}
        blocked={
          activeTab.contentsId !== undefined ? (blockedCounts[activeTab.contentsId] ?? 0) : 0
        }
        onSetSiteShields={setSiteShields}
        onEnableShields={() => setShieldsEnabled(true)}
      />
      {settings.showBookmarksBar && <BookmarksBar bookmarks={bookmarks} onOpen={openLink} />}
      <main className="content">
        {tabs.map(renderPage)}
        {playlist && (
          <MiniPlayer
            key={playlist.id}
            playlist={playlist}
            onOpenInTab={(url) => openTab(createWebTab(url))}
            onClose={() => setPlaylist(null)}
          />
        )}
        {find && find.tabId === activeTab.id && activeTab.kind === 'web' && (
          <FindBar
            key={find.tabId}
            tabId={find.tabId}
            getWebview={getWebview}
            focusKey={find.focusKey}
            onClose={() => setFind(null)}
          />
        )}
        {notice && <div className="toast">{notice}</div>}
        {palette && (
          <CommandPalette
            tabs={tabs}
            activeId={activeId}
            bookmarks={bookmarks}
            commands={palette}
            searchEngine={settings.searchEngine}
            onActivateTab={(id) => dispatch({ type: 'activate', id })}
            onOpen={(url) => navigate(url)}
            onClose={() => setPalette(null)}
          />
        )}
        <UpdateBanner status={updateStatus} />
      </main>
      {!settings.onboarded && (
        <Welcome
          settings={settings}
          onChange={updateSettings}
          onFinish={() => {
            updateSettings({ onboarded: true })
            refreshShields()
          }}
        />
      )}
    </div>
  )
}

export default App
