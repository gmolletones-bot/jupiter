import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'
import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { extname, join, normalize, sep } from 'path'
import { inflateRawSync } from 'zlib'
import { systemConfig } from './system'

// Offline games. The NES games and the launchers ship inside the app; Doom's
// engine and data are downloaded once (about 26 MB) from their own projects,
// checked against pinned SHA-256 hashes, and kept in userData.
//
// Everything is served from jupiter-games://app/, a separate origin, so the
// games (and their keyboard handling) run in frames isolated from the UI.

const SCHEME = 'jupiter-games'
const HOST = 'app'

interface Download {
  url: string
  sha256: string
  size: number
}

// Chocolate Doom compiled to WebAssembly by Cloudflare (GPL-2.0,
// https://github.com/cloudflare/doom-wasm). This npm copy is byte-identical to
// the build Cloudflare serves on its demo site.
const ENGINE = 'https://cdn.jsdelivr.net/npm/@nicejsisverycool/tizendoom@0.1.6'
const DOOM_ENGINE: Record<string, Download> = {
  'websockets-doom.js': {
    url: `${ENGINE}/websockets-doom.js`,
    sha256: 'a2909044a9fbc5529f941c8dbf93cc2931927690e0341c737545cf0b9cff23fb',
    size: 276_667
  },
  'websockets-doom.wasm': {
    url: `${ENGINE}/websockets-doom.wasm`,
    sha256: '6366f83a58fe8596ce742a66dbf86871d315862c89c11e65b54935be03c7e6c4',
    size: 2_283_167
  }
}

// Freedoom 0.13.0 (BSD-3-Clause, https://freedoom.github.io). Only the Phase 1
// IWAD and the license are kept from the zip.
const FREEDOOM: Download = {
  url: 'https://github.com/freedoom/freedoom/releases/download/v0.13.0/freedoom-0.13.0.zip',
  sha256: '3f9b264f3e3ce503b4fb7f6bdcb1f419d93c7b546f4df3e874dd878db9688f59',
  size: 24_143_781
}
const FREEDOOM_FILES: Record<string, string> = {
  'freedoom-0.13.0/freedoom1.wad': 'freedoom1.wad',
  'freedoom-0.13.0/COPYING.txt': 'FREEDOOM-COPYING.txt'
}
const TOTAL_BYTES = FREEDOOM.size + Object.values(DOOM_ENGINE).reduce((sum, f) => sum + f.size, 0)

const AUTO_DOWNLOAD_DELAY_MS = 45 * 1000

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8'
}

// The game pages only load their own files. Emscripten compiles WebAssembly
// and jsnes plays audio through an AudioWorklet loaded from a blob.
const GAME_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'"
].join('; ')

let doomStatus: DoomStatus = { state: 'missing' }
let downloading: Promise<void> | null = null

const bundledRoot = (): string => join(app.getAppPath(), 'resources', 'games')
const doomDir = (): string => join(app.getPath('userData'), 'games', 'doom')
const readyMarker = (): string => join(doomDir(), 'ready.json')

/** Must run before the app is ready. */
export function registerGamesScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

function publish(next: DoomStatus): void {
  doomStatus = next
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('games:doom-status', doomStatus)
  }
}

/** The file on disk for a jupiter-games:// path, or null if it isn't one we serve. */
function fileFor(pathname: string): string | null {
  const path = decodeURIComponent(pathname).replace(/^\/+/, '')
  if (path === 'nes/jsnes.min.js') {
    return join(app.getAppPath(), 'node_modules', 'jsnes', 'dist', 'jsnes.min.js')
  }
  const engine = /^doom\/engine\/([a-z0-9.-]+)$/.exec(path)
  if (engine) {
    const name = engine[1]
    const known = name in DOOM_ENGINE || Object.values(FREEDOOM_FILES).includes(name)
    return known ? join(doomDir(), name) : null
  }
  const root = bundledRoot()
  const file = normalize(join(root, path))
  return file.startsWith(root + sep) ? file : null
}

async function serve(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const file = url.host === HOST ? fileFor(url.pathname) : null
  if (!file) return new Response('Not found', { status: 404 })
  try {
    const body = await readFile(file)
    const type = CONTENT_TYPES[extname(file)] ?? 'application/octet-stream'
    const headers: Record<string, string> = { 'Content-Type': type }
    if (type.startsWith('text/html')) headers['Content-Security-Policy'] = GAME_CSP
    return new Response(body, { headers })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}

/** Downloads a file into memory, checking its hash and reporting progress. */
async function fetchVerified(file: Download, onBytes: (bytes: number) => void): Promise<Buffer> {
  const response = await net.fetch(file.url)
  if (!response.ok || !response.body) throw new Error(`${response.status} al descargar ${file.url}`)
  const hash = createHash('sha256')
  const chunks: Buffer[] = []
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = Buffer.from(value)
    hash.update(chunk)
    chunks.push(chunk)
    onBytes(chunk.length)
  }
  if (hash.digest('hex') !== file.sha256) {
    throw new Error(`El archivo descargado no es el esperado: ${file.url}`)
  }
  return Buffer.concat(chunks)
}

/** Extracts the named entries of a zip (stored or deflated, no zip64). */
function unzip(zip: Buffer, wanted: string[]): Map<string, Buffer> {
  const out = new Map<string, Buffer>()
  let end = zip.length - 22
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0) throw new Error('Zip dañado')
  const count = zip.readUInt16LE(end + 10)
  let offset = zip.readUInt32LE(end + 16)
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error('Zip dañado')
    const method = zip.readUInt16LE(offset + 10)
    const compressedSize = zip.readUInt32LE(offset + 20)
    const nameLength = zip.readUInt16LE(offset + 28)
    const extraLength = zip.readUInt16LE(offset + 30)
    const commentLength = zip.readUInt16LE(offset + 32)
    const local = zip.readUInt32LE(offset + 42)
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength)
    if (wanted.includes(name)) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
      const data = zip.subarray(start, start + compressedSize)
      out.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data))
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  return out
}

async function downloadDoom(): Promise<void> {
  let received = 0
  let lastPercent = -1
  const onBytes = (bytes: number): void => {
    received += bytes
    const percent = Math.floor((received / TOTAL_BYTES) * 100)
    if (percent !== lastPercent) {
      lastPercent = percent
      publish({ state: 'downloading', percent })
    }
  }
  publish({ state: 'downloading', percent: 0 })
  try {
    const dir = doomDir()
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    for (const [name, file] of Object.entries(DOOM_ENGINE)) {
      await writeFile(join(dir, name), await fetchVerified(file, onBytes))
    }
    const entries = unzip(await fetchVerified(FREEDOOM, onBytes), Object.keys(FREEDOOM_FILES))
    for (const [entry, name] of Object.entries(FREEDOOM_FILES)) {
      const data = entries.get(entry)
      if (!data) throw new Error(`Falta ${entry} en Freedoom`)
      await writeFile(join(dir, name), data)
    }
    await writeFile(`${readyMarker()}.tmp`, JSON.stringify({ freedoom: '0.13.0' }))
    await rename(`${readyMarker()}.tmp`, readyMarker())
    publish({ state: 'ready' })
  } catch (error) {
    publish({ state: 'error', error: error instanceof Error ? error.message : String(error) })
  }
}

function startDoomDownload(): Promise<void> {
  if (doomStatus.state === 'ready') return Promise.resolve()
  downloading ??= downloadDoom().finally(() => {
    downloading = null
  })
  return downloading
}

export function registerGames(): void {
  protocol.handle(SCHEME, serve)
  if (existsSync(readyMarker())) doomStatus = { state: 'ready' }

  ipcMain.handle('games:doom-status', () => doomStatus)
  ipcMain.handle('games:doom-download', () => startDoomDownload())

  // Fetched in the background the first time there's internet, so Doom is
  // there when the connection drops.
  setTimeout(() => {
    if (doomStatus.state !== 'ready' && systemConfig().downloadGames && net.isOnline()) {
      void startDoomDownload()
    }
  }, AUTO_DOWNLOAD_DELAY_MS)
}
