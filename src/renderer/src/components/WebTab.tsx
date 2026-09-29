import { useEffect, useEffectEvent, useRef } from 'react'
import type {
  DidChangeThemeColorEvent,
  DidFailLoadEvent,
  DidNavigateEvent,
  DidNavigateInPageEvent,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
  WebviewTag
} from 'electron'
import type { Tab } from '../types'
import { toHexColor } from '../appearance'
import { exactHostOf, FOCUS_BLOCKED } from '../url'
import { Orbit, RotateCw, Timer, WifiOff } from 'lucide-react'
import Arcade from './games/Arcade'

const OFFLINE_ERRORS = [
  'INTERNET_DISCONNECTED',
  'NETWORK_CHANGED',
  'ADDRESS_UNREACHABLE',
  'NETWORK_ACCESS_DENIED'
]

/** Failures caused by having no connection, where Jupiter offers its games instead. */
function isOfflineError(code: string): boolean {
  return !navigator.onLine || OFFLINE_ERRORS.some((error) => code.includes(error))
}

function errorMessage(code: string, url: string): string {
  let host = url
  try {
    host = new URL(url).hostname
  } catch {
    // Keep the raw URL.
  }
  if (code.includes('NAME_NOT_RESOLVED')) {
    return `No se ha encontrado la dirección de ${host}. Revisa que esté bien escrita o que tu red no la bloquee.`
  }
  if (code.includes('INTERNET_DISCONNECTED')) return 'No hay conexión a internet.'
  if (code.includes('TIMED_OUT')) return `${host} ha tardado demasiado en responder.`
  if (code.includes('CONNECTION_REFUSED')) return `${host} ha rechazado la conexión.`
  if (code.includes('CERT'))
    return `La conexión con ${host} no es segura (problema con su certificado).`
  return `${host} no se ha podido cargar.`
}

interface WebTabProps {
  tab: Tab
  active: boolean
  onUpdate: (id: number, patch: Partial<Tab>) => void
  registerWebview: (id: number, webview: WebviewTag | null) => void
  /** End of the running focus period that blocks distracting sites, if any. */
  focusBlockUntil?: number | null
}

function WebTab({
  tab,
  active,
  onUpdate,
  registerWebview,
  focusBlockUntil
}: WebTabProps): React.JSX.Element {
  const webviewRef = useRef<WebviewTag>(null)
  /** URL whose load failed: Chromium then commits an error page at that same URL. */
  const failedUrl = useRef<string | null>(null)
  const { id } = tab

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return
    registerWebview(id, webview)

    const navigationState = (url: string): Partial<Tab> => ({
      url,
      address: url,
      canGoBack: webview.canGoBack(),
      canGoForward: webview.canGoForward()
    })
    // Chromium keeps zoom per site, so re-read it after every navigation.
    const onNavigate = (event: DidNavigateEvent): void => {
      // Chromium's error page and the blank page of a tab that was never loaded
      // (blocked by Focus) aren't real pages.
      if (event.url.startsWith('chrome-error:') || event.url === 'about:blank') return
      // Any real page clears the notice, except the failed URL loading its error page.
      const leftError = failedUrl.current !== event.url
      failedUrl.current = null
      onUpdate(id, {
        ...navigationState(event.url),
        favicon: undefined,
        themeColor: undefined,
        zoom: webview.getZoomFactor(),
        ...(leftError ? { loadError: undefined } : {})
      })
    }
    const onThemeColor = (event: DidChangeThemeColorEvent): void =>
      onUpdate(id, { themeColor: toHexColor(event.themeColor) })
    const onDomReady = (): void => onUpdate(id, { contentsId: webview.getWebContentsId() })
    const onNavigateInPage = (event: DidNavigateInPageEvent): void => {
      if (event.isMainFrame) onUpdate(id, navigationState(event.url))
    }
    const onTitle = (event: PageTitleUpdatedEvent): void => onUpdate(id, { title: event.title })
    const onFavicon = (event: PageFaviconUpdatedEvent): void => {
      const favicon = event.favicons[0]
      onUpdate(id, { favicon, faviconColor: undefined })
      if (!favicon) return
      window.api
        .faviconColor(favicon)
        .then((color) => onUpdate(id, { faviconColor: color ?? undefined }))
        .catch(() => undefined)
    }
    const onStartLoading = (): void => onUpdate(id, { isLoading: true })
    const onFailLoad = (event: DidFailLoadEvent): void => {
      // -3 is ERR_ABORTED: the user navigated away or stopped the load; not an error.
      if (!event.isMainFrame || event.errorCode === -3) return
      failedUrl.current = event.validatedURL
      onUpdate(id, {
        address: event.validatedURL,
        title: exactHostOf(event.validatedURL) || event.validatedURL,
        favicon: undefined,
        loadError: { url: event.validatedURL, code: event.errorDescription || `${event.errorCode}` }
      })
    }
    const onStopLoading = (): void => onUpdate(id, { isLoading: false })

    webview.addEventListener('dom-ready', onDomReady)
    webview.addEventListener('did-change-theme-color', onThemeColor)
    webview.addEventListener('did-navigate', onNavigate)
    webview.addEventListener('did-navigate-in-page', onNavigateInPage)
    webview.addEventListener('page-title-updated', onTitle)
    webview.addEventListener('page-favicon-updated', onFavicon)
    webview.addEventListener('did-start-loading', onStartLoading)
    webview.addEventListener('did-stop-loading', onStopLoading)
    webview.addEventListener('did-fail-load', onFailLoad)

    return () => {
      webview.removeEventListener('dom-ready', onDomReady)
      webview.removeEventListener('did-change-theme-color', onThemeColor)
      webview.removeEventListener('did-navigate', onNavigate)
      webview.removeEventListener('did-navigate-in-page', onNavigateInPage)
      webview.removeEventListener('page-title-updated', onTitle)
      webview.removeEventListener('page-favicon-updated', onFavicon)
      webview.removeEventListener('did-start-loading', onStartLoading)
      webview.removeEventListener('did-stop-loading', onStopLoading)
      webview.removeEventListener('did-fail-load', onFailLoad)
      registerWebview(id, null)
    }
  }, [id, onUpdate, registerWebview])

  const retry = (): void => {
    if (!tab.loadError) return
    const { url } = tab.loadError
    failedUrl.current = null
    onUpdate(id, { loadError: undefined })
    webviewRef.current?.loadURL(url).catch(() => {})
  }

  // Back online: load the page that failed.
  const onOnline = useEffectEvent(() => {
    if (tab.loadError && tab.loadError.code !== FOCUS_BLOCKED) retry()
  })
  useEffect(() => {
    const listener = (): void => onOnline()
    window.addEventListener('online', listener)
    return () => window.removeEventListener('online', listener)
  }, [])

  const { loadError } = tab
  const blockedByFocus = loadError?.code === FOCUS_BLOCKED

  return (
    <>
      <webview
        ref={webviewRef}
        className={active ? 'page' : 'page hidden'}
        src={tab.initialUrl}
        // <webview>-specific attribute the React lint rule doesn't know about.
        // eslint-disable-next-line react/no-unknown-property
        partition="persist:navegador"
      />
      {loadError && (
        <div className={active ? 'page load-error' : 'page load-error hidden'}>
          {blockedByFocus ? (
            <div className="load-error-box focus-blocked">
              <Timer className="load-error-icon" />
              <h1>Modo Focus activo</h1>
              <p>
                {exactHostOf(loadError.url)} está bloqueado hasta las{' '}
                <strong>
                  {focusBlockUntil
                    ? new Date(focusBlockUntil).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'que termine el Focus'}
                </strong>
                . Vuelve a lo tuyo: cuando termine el Focus podrás entrar.
              </p>
            </div>
          ) : isOfflineError(loadError.code) ? (
            <div className="offline">
              <header className="offline-head">
                <WifiOff className="offline-icon" />
                <div>
                  <h1>Sin conexión</h1>
                  <p>
                    Mientras vuelve internet, juega un rato. {exactHostOf(loadError.url)} se cargará
                    solo cuando haya conexión.
                  </p>
                </div>
                <button className="button-ghost" onClick={retry}>
                  <RotateCw /> Reintentar
                </button>
              </header>
              <Arcade active={active} />
            </div>
          ) : (
            <div className="load-error-box">
              <Orbit className="load-error-icon" />
              <h1>No se puede acceder a este sitio</h1>
              <p>{errorMessage(loadError.code, loadError.url)}</p>
              <code>{loadError.code}</code>
              <button className="button-primary" onClick={retry}>
                Volver a intentar
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default WebTab
