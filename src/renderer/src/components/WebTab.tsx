import { useEffect, useRef } from 'react'
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
import { exactHostOf } from '../url'
import { Orbit } from 'lucide-react'

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
}

function WebTab({ tab, active, onUpdate, registerWebview }: WebTabProps): React.JSX.Element {
  const webviewRef = useRef<WebviewTag>(null)
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
    const onNavigate = (event: DidNavigateEvent): void =>
      onUpdate(id, {
        ...navigationState(event.url),
        favicon: undefined,
        themeColor: undefined,
        zoom: webview.getZoomFactor()
      })
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
    const onStartLoading = (): void => onUpdate(id, { isLoading: true, loadError: undefined })
    const onFailLoad = (event: DidFailLoadEvent): void => {
      // -3 is ERR_ABORTED: the user navigated away or stopped the load; not an error.
      if (!event.isMainFrame || event.errorCode === -3) return
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

  const { loadError } = tab

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
          <div className="load-error-box">
            <Orbit className="load-error-icon" />
            <h1>No se puede acceder a este sitio</h1>
            <p>{errorMessage(loadError.code, loadError.url)}</p>
            <code>{loadError.code}</code>
            <button
              className="button-primary"
              onClick={() => webviewRef.current?.loadURL(loadError.url).catch(() => {})}
            >
              Volver a intentar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default WebTab
