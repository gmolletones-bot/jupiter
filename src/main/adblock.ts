import { app, ipcMain, type Session, type WebContents } from 'electron'
import { ElectronBlocker, fromElectronDetails } from '@ghostery/adblocker-electron'
import { parse } from 'tldts-experimental'
import { readFileSync, renameSync, writeFileSync } from 'fs'
import { readFile, stat, unlink, writeFile } from 'fs/promises'
import { join } from 'path'

// Native ad & tracker blocker ("Escudos").
//
// The real work is done by Ghostery's engine (@ghostery/adblocker, MPL-2.0),
// fed with EasyList, EasyPrivacy and uBlock Origin's lists — the same format
// and lists uBlock Origin and Brave use. Besides blocking requests it hides
// ad slots and runs uBlock's scriptlets (which is what strips YouTube's ads).
// Until the lists are loaded (first run, or offline without a cache) a small
// built-in domain list keeps the basics blocked.
export const BLOCKLIST: readonly string[] = [
  // Google ads & analytics
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'adservice.google.com',
  'app-measurement.com',
  // Social networks' ads & pixels
  'ads.twitter.com',
  'analytics.twitter.com',
  'ads-twitter.com',
  'facebook.net',
  'ads.linkedin.com',
  'snap.licdn.com',
  'analytics.tiktok.com',
  'ads.tiktok.com',
  'tr.snapchat.com',
  'sc-static.net',
  'ads.pinterest.com',
  'ct.pinterest.com',
  'ads.reddit.com',
  // Microsoft & Yahoo
  'bat.bing.com',
  'clarity.ms',
  'ads.yahoo.com',
  'analytics.yahoo.com',
  // Ad exchanges & networks
  'adnxs.com',
  'adsrvr.org',
  'amazon-adsystem.com',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'casalemedia.com',
  '33across.com',
  'sharethrough.com',
  'teads.tv',
  'yieldmo.com',
  'smartadserver.com',
  'adform.net',
  'bidswitch.net',
  'media.net',
  'zedo.com',
  'advertising.com',
  'adcolony.com',
  'applovin.com',
  'moatads.com',
  'adsafeprotected.com',
  'doubleverify.com',
  // Analytics, session recording & data brokers
  'scorecardresearch.com',
  'quantserve.com',
  'hotjar.com',
  'mixpanel.com',
  'api.segment.io',
  'cdn.segment.com',
  'fullstory.com',
  'mouseflow.com',
  'crazyegg.com',
  'bluekai.com',
  'krxd.net',
  'demdex.net'
]

const BLOCKED = new Set(BLOCKLIST)

/** The blocklist entry matching `host` (itself or a parent domain), if any. */
export function blockedEntry(host: string): string | undefined {
  let candidate = host.toLowerCase().replace(/\.$/, '')
  while (candidate.includes('.')) {
    if (BLOCKED.has(candidate)) return candidate
    candidate = candidate.slice(candidate.indexOf('.') + 1)
  }
  return undefined
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

// ---------- Settings: global switch + sites with shields down ----------

interface ShieldsConfig {
  enabled: boolean
  allowedSites: string[]
  /** Hide cookie banners (extra lists) and decline Google/YouTube's consent. */
  cookieNotices: boolean
}

const FILE = (): string => join(app.getPath('userData'), 'shields.json')
let config: ShieldsConfig = { enabled: true, allowedSites: [], cookieNotices: true }

function loadConfig(): void {
  try {
    const data = JSON.parse(readFileSync(FILE(), 'utf-8'))
    config = {
      enabled: data.enabled !== false,
      allowedSites: Array.isArray(data.allowedSites) ? data.allowedSites : [],
      cookieNotices: data.cookieNotices !== false
    }
  } catch {
    // First run or unreadable file: defaults (shields up everywhere).
  }
}

function saveConfig(): void {
  try {
    writeFileSync(`${FILE()}.tmp`, JSON.stringify(config, null, 2))
    renameSync(`${FILE()}.tmp`, FILE())
  } catch (error) {
    console.error('No se pudo guardar la configuración de los escudos:', error)
  }
}

// ---------- Per-tab bookkeeping ----------

/** Site (hostname) each tab is showing, set when a navigation starts. */
const siteOf = new Map<number, string>()
/** Requests blocked on each tab's current page. */
const countOf = new Map<number, number>()
let totalBlocked = 0

/** Starts tracking a tab so its blocked count resets on each new page. */
export function trackShields(contents: WebContents, host: WebContents): void {
  const id = contents.id
  // Scriptlets injected while a page is still loading each wait on a one-off
  // 'did-stop-loading' listener; busy sites (YouTube) exceed Node's default 10.
  contents.setMaxListeners(50)
  contents.on('did-start-navigation', (details) => {
    if (!details.isMainFrame || details.isSameDocument) return
    siteOf.set(id, hostOf(details.url))
    countOf.set(id, 0)
    if (!host.isDestroyed()) host.send('shields:blocked', id, 0)
  })
  contents.once('destroyed', () => {
    siteOf.delete(id)
    countOf.delete(id)
  })
}

/** Site a request belongs to: the page shown in its tab. */
function siteFor(contentsId: number | undefined, fallbackUrl: string): string {
  return (contentsId !== undefined && siteOf.get(contentsId)) || hostOf(fallbackUrl)
}

function shieldsUpFor(site: string): boolean {
  return config.enabled && !config.allowedSites.includes(site)
}

// ---------- Daily statistics (for the new tab page card) ----------

const STATS_FILE = (): string => join(app.getPath('userData'), 'shields-stats.json')
const KEEP_DAYS = 30
let stats: Record<string, number> = {}
let statsTimer: NodeJS.Timeout | undefined

/** Local date as YYYY-MM-DD. */
function dayKey(date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function loadStats(): void {
  try {
    const data = JSON.parse(readFileSync(STATS_FILE(), 'utf-8'))
    if (data && typeof data === 'object') stats = data
  } catch {
    stats = {}
  }
}

function saveStats(): void {
  statsTimer = undefined
  const keep = new Set(
    Array.from({ length: KEEP_DAYS }, (_, i) => dayKey(new Date(Date.now() - i * 86_400_000)))
  )
  for (const day of Object.keys(stats)) if (!keep.has(day)) delete stats[day]
  try {
    writeFileSync(`${STATS_FILE()}.tmp`, JSON.stringify(stats))
    renameSync(`${STATS_FILE()}.tmp`, STATS_FILE())
  } catch (error) {
    console.error('No se pudieron guardar las estadísticas de los escudos:', error)
  }
}

/** Blocked requests of the last 7 days, oldest first. */
function lastWeek(): { day: string; count: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = dayKey(new Date(Date.now() - (6 - i) * 86_400_000))
    return { day, count: stats[day] ?? 0 }
  })
}

// ---------- Focus mode: distracting sites blocked while the timer runs ----------

let focusBlock: { sites: string[]; until: number } | null = null

function blockedByFocus(url: string): boolean {
  if (!focusBlock || Date.now() > focusBlock.until) return false
  // The mini player loads YouTube/Spotify embeds as pages: those stay allowed.
  if (/\/embed\//.test(url)) return false
  const host = hostOf(url).toLowerCase()
  return focusBlock.sites.some((site) => host === site || host.endsWith(`.${site}`))
}

function countBlocked(contents: WebContents | undefined, contentsId: number | undefined): void {
  totalBlocked++
  const today = dayKey()
  stats[today] = (stats[today] ?? 0) + 1
  statsTimer ??= setTimeout(saveStats, 5000)
  if (!contents || contentsId === undefined) return
  const count = (countOf.get(contentsId) ?? 0) + 1
  countOf.set(contentsId, count)
  const host = contents.hostWebContents
  if (host && !host.isDestroyed()) host.send('shields:blocked', contentsId, count)
}

// ---------- Filter lists engine ----------

// "full" adds uBlock/EasyList's cookie-notice lists to the ads & tracking ones.
type ListVariant = 'ads-tracking' | 'full'
const variant = (): ListVariant => (config.cookieNotices ? 'full' : 'ads-tracking')
const ENGINE_FILE = (which: ListVariant): string =>
  join(app.getPath('userData'), `adblock-engine-${which}.bin`)
// uBlock ships YouTube fixes almost daily, so check once a day, also while running.
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000
const REFRESH_CHECK_MS = 60 * 60 * 1000

let engine: ElectronBlocker | undefined
let listsUpdatedAt: number | undefined

/** Downloads and compiles the lists, then caches the result on disk. */
async function downloadEngine(which: ListVariant = variant()): Promise<ElectronBlocker> {
  const blocker =
    which === 'full'
      ? await ElectronBlocker.fromPrebuiltFull(fetch)
      : await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch)
  await writeFile(ENGINE_FILE(which), blocker.serialize())
  listsUpdatedAt = Date.now()
  return blocker
}

function refreshInBackground(): void {
  const which = variant()
  downloadEngine(which)
    .then((fresh) => {
      // The setting may have changed while downloading.
      if (which === variant()) activateEngine(fresh)
    })
    .catch((error) => console.warn('No se pudieron actualizar las listas de bloqueo:', error))
}

/** Cached engine if there is one (even if old), refreshed in the background when stale. */
async function loadEngine(): Promise<ElectronBlocker> {
  const which = variant()
  try {
    const file = ENGINE_FILE(which)
    const [data, info] = await Promise.all([readFile(file), stat(file)])
    const cached = ElectronBlocker.deserialize(new Uint8Array(data))
    listsUpdatedAt = info.mtimeMs
    if (Date.now() - info.mtimeMs > REFRESH_AFTER_MS) refreshInBackground()
    return cached
  } catch {
    // No usable cache (first run, other variant or incompatible version): download now.
    return downloadEngine(which)
  }
}

// ---------- Google / YouTube consent ----------

// The cookie Google stores when you click "Reject all" on its consent screen.
// Only set when there's no SOCS cookie yet, so a choice made by the user wins.
const REJECT_ALL_SOCS = 'CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg'
const CONSENT_SITES = [
  { url: 'https://www.google.com', domain: '.google.com' },
  { url: 'https://www.youtube.com', domain: '.youtube.com' }
]

export async function declineGoogleConsent(target: Session): Promise<void> {
  if (!config.cookieNotices) return
  for (const site of CONSENT_SITES) {
    try {
      const existing = await target.cookies.get({ url: site.url, name: 'SOCS' })
      if (existing.length > 0) continue
      await target.cookies.set({
        url: site.url,
        name: 'SOCS',
        value: REJECT_ALL_SOCS,
        domain: site.domain,
        path: '/',
        secure: true,
        sameSite: 'lax',
        expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
      })
    } catch (error) {
      console.warn(`No se pudo rechazar el consentimiento de ${site.domain}:`, error)
    }
  }
}

let browserSession: Session | undefined

function activateEngine(blocker: ElectronBlocker): void {
  const previous = engine
  engine = blocker

  // Cosmetic CSS (hiding ad slots) through the engine's own preload. Its
  // scriptlets are left out here: they'd run after the page loaded, too late
  // for YouTube. They go through our preload instead (see 'shields:scriptlets').
  blocker.onInjectCosmeticFilters = async (event, url, msg) => {
    if (!shieldsUpFor(siteFor(event.sender.id, url))) return
    const { hostname = '', domain = '' } = parse(url)
    const firstRun = msg === undefined
    const { active, styles } = blocker.getCosmeticsFilters({
      domain: domain ?? '',
      hostname: hostname ?? '',
      url,
      classes: msg?.classes,
      hrefs: msg?.hrefs,
      ids: msg?.ids,
      getBaseRules: firstRun,
      getInjectionRules: false,
      getExtendedRules: false,
      getRulesFromHostname: firstRun,
      getRulesFromDOM: !firstRun,
      callerContext: {
        frameId: event.frameId,
        processId: event.processId,
        lifecycle: msg?.lifecycle
      }
    })
    if (active !== false && styles.length > 0) {
      event.sender.insertCSS(styles, { cssOrigin: 'user' }).catch(() => undefined)
    }
  }

  if (!browserSession) return
  if (previous) previous.disableBlockingInSession(browserSession)
  // Registers the engine's preload (cosmetics) and its webRequest listeners;
  // Electron allows one listener per event, so ours are put back on top.
  blocker.enableBlockingInSession(browserSession)
  installListeners(browserSession)
}

// ---------- webRequest listeners ----------

function installListeners(target: Session): void {
  target.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    // Always answer, even if something below throws, or the request would hang.
    try {
      if (details.resourceType === 'mainFrame') {
        if (!blockedByFocus(details.url)) return callback({})
        // A cancelled page load fires no 'did-fail-load' in the webview, so the
        // UI is told directly which tab to show the "blocked by Focus" notice in.
        const host = details.webContents?.hostWebContents
        if (host && !host.isDestroyed()) {
          host.send('focus:blocked', details.webContentsId, details.url)
        }
        return callback({ cancel: true })
      }
      const site = siteFor(details.webContentsId, details.webContents?.getURL() ?? '')
      if (!shieldsUpFor(site)) return callback({})

      if (engine) {
        const { match, redirect } = engine.match(fromElectronDetails(details))
        if (redirect) {
          // Swapped for a harmless stand-in (e.g. an empty analytics script) so
          // pages that expect it keep working.
          countBlocked(details.webContents, details.webContentsId)
          return callback({ redirectURL: redirect.dataUrl })
        }
        if (match) {
          countBlocked(details.webContents, details.webContentsId)
          return callback({ cancel: true })
        }
        return callback({})
      }

      // Lists not loaded yet: built-in domain list. Visiting a listed service
      // itself (e.g. your ads.twitter.com dashboard) is left alone.
      const entry = blockedEntry(hostOf(details.url))
      if (!entry || blockedEntry(site) === entry) return callback({})
      countBlocked(details.webContents, details.webContentsId)
      callback({ cancel: true })
    } catch (error) {
      console.error('Error en el bloqueador:', error)
      callback({})
    }
  })

  // Some filters add CSP rules to pages; only the engine knows about them.
  target.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    try {
      const site = siteFor(details.webContentsId, details.url)
      if (!engine || !shieldsUpFor(site)) return callback({})
      engine.onHeadersReceived(details, callback)
    } catch (error) {
      console.error('Error en el bloqueador:', error)
      callback({})
    }
  })
}

/** Scriptlets for a page, asked synchronously by our preload before the page's scripts run. */
function scriptletsFor(contentsId: number, url: string): string[] {
  if (!engine || !/^https?:/i.test(url) || !shieldsUpFor(siteFor(contentsId, url))) return []
  const { hostname, domain } = parse(url)
  const { active, scripts } = engine.getCosmeticsFilters({
    domain: domain ?? '',
    hostname: hostname ?? '',
    url,
    getBaseRules: false,
    getInjectionRules: true,
    getExtendedRules: false,
    getRulesFromHostname: true,
    getRulesFromDOM: false
  })
  return active === false ? [] : scripts
}

export function registerShields(target: Session, shieldsPreload: string): void {
  loadConfig()
  loadStats()
  app.on('before-quit', () => {
    if (statsTimer) {
      clearTimeout(statsTimer)
      saveStats()
    }
  })

  ipcMain.handle('shields:stats', () => lastWeek())

  ipcMain.on('focus:set-blocking', (_, sites: unknown, until: unknown) => {
    focusBlock =
      Array.isArray(sites) && typeof until === 'number'
        ? {
            sites: sites
              .filter((site): site is string => typeof site === 'string')
              .map((site) =>
                site
                  .trim()
                  .toLowerCase()
                  .replace(/^www\./, '')
              )
              .filter(Boolean),
            until
          }
        : null
  })
  browserSession = target
  installListeners(target)

  target.registerPreloadScript({ type: 'frame', filePath: shieldsPreload })
  ipcMain.on('shields:scriptlets', (event, url: unknown) => {
    try {
      event.returnValue = typeof url === 'string' ? scriptletsFor(event.sender.id, url) : []
    } catch (error) {
      console.error('Error preparando scriptlets:', error)
      event.returnValue = []
    }
  })

  // Load the lists without delaying startup; the built-in list covers the gap.
  loadEngine()
    .then(activateEngine)
    .catch((error) =>
      console.warn('Listas de bloqueo no disponibles, usando la lista básica:', error)
    )
  void declineGoogleConsent(target)
  // Cache file used before the lists had variants.
  unlink(join(app.getPath('userData'), 'adblock-engine.bin')).catch(() => undefined)
  setInterval(() => {
    if (engine && Date.now() - (listsUpdatedAt ?? 0) > REFRESH_AFTER_MS) refreshInBackground()
  }, REFRESH_CHECK_MS)

  ipcMain.handle('shields:get', () => ({
    ...config,
    totalBlocked,
    engine: engine ? 'lists' : 'basic',
    listsUpdatedAt
  }))

  ipcMain.handle('shields:update-lists', async () => {
    activateEngine(await downloadEngine())
  })

  ipcMain.handle('shields:set-cookie-notices', async (_, enabled: boolean) => {
    config.cookieNotices = Boolean(enabled)
    saveConfig()
    await declineGoogleConsent(target)
    activateEngine(await loadEngine())
  })

  ipcMain.handle('shields:set-enabled', (_, enabled: boolean) => {
    config.enabled = Boolean(enabled)
    saveConfig()
  })

  ipcMain.handle('shields:set-site', (_, site: string, shieldsUp: boolean) => {
    if (typeof site !== 'string' || !site) return
    const others = config.allowedSites.filter((allowed) => allowed !== site)
    config.allowedSites = shieldsUp ? others : [...others, site]
    saveConfig()
  })
}
