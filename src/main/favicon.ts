import { ipcMain, nativeImage, type Session } from 'electron'

// Dominant colour of a site's favicon, used to tint the tab strip when the
// page doesn't declare a usable <meta name="theme-color"> (YouTube's red,
// Spotify's green…). Fetched in the main process: the page's own favicon
// usually can't be read from the UI because of cross-origin restrictions.

const cache = new Map<string, string | null>()
const MAX_CACHE = 300

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

/** Most common strongly coloured hue in the image (greys, white and black are ignored). */
function dominantColor(bitmap: Buffer): string | null {
  const bins = new Map<number, { weight: number; r: number; g: number; b: number }>()
  // Bitmap is BGRA.
  for (let i = 0; i + 3 < bitmap.length; i += 4) {
    const [b, g, r, a] = [bitmap[i], bitmap[i + 1], bitmap[i + 2], bitmap[i + 3]]
    if (a < 160) continue
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    if (saturation < 0.35 || max < 50) continue
    let hue: number
    if (max === r) hue = ((g - b) / (max - min) + 6) % 6
    else if (max === g) hue = (b - r) / (max - min) + 2
    else hue = (r - g) / (max - min) + 4
    const bin = Math.round(hue * 2) % 12
    const entry = bins.get(bin) ?? { weight: 0, r: 0, g: 0, b: 0 }
    const weight = saturation
    entry.weight += weight
    entry.r += r * weight
    entry.g += g * weight
    entry.b += b * weight
    bins.set(bin, entry)
  }
  let best: { weight: number; r: number; g: number; b: number } | undefined
  for (const entry of bins.values()) if (!best || entry.weight > best.weight) best = entry
  // Ignore stray pixels: the colour must cover a meaningful part of the icon.
  if (!best || best.weight < 20) return null
  return toHex(best.r / best.weight, best.g / best.weight, best.b / best.weight)
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47])

/**
 * Pixels (BGRA) of an image. Electron's nativeImage reads PNG and JPEG but not
 * .ico, which most sites (YouTube included) use, so the largest image inside
 * an .ico is extracted: modern ones embed a PNG, older ones a 32-bit bitmap.
 */
function pixelsOf(data: Buffer): Buffer | null {
  const isIco = data.length > 6 && data.readUInt16LE(0) === 0 && data.readUInt16LE(2) === 1
  if (!isIco) {
    const image = nativeImage.createFromBuffer(data)
    return image.isEmpty() ? null : image.resize({ width: 32, height: 32 }).toBitmap()
  }
  const count = data.readUInt16LE(4)
  let best: { size: number; offset: number; length: number } | undefined
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16
    if (entry + 16 > data.length) break
    const size = data[entry] || 256
    const length = data.readUInt32LE(entry + 8)
    const offset = data.readUInt32LE(entry + 12)
    if (offset + length > data.length) continue
    if (!best || size > best.size) best = { size, offset, length }
  }
  if (!best) return null
  const image = data.subarray(best.offset, best.offset + best.length)
  if (image.subarray(0, 4).equals(PNG_SIGNATURE)) return pixelsOf(image)
  // BITMAPINFOHEADER + pixels; only 32-bit ones are worth decoding here. Row
  // order doesn't matter for picking a colour, so the pixels are used as is.
  const headerSize = image.readUInt32LE(0)
  const bitCount = image.readUInt16LE(14)
  if (bitCount !== 32) return null
  const width = image.readInt32LE(4)
  return image.subarray(headerSize, headerSize + width * width * 4)
}

async function faviconColor(browserSession: Session, url: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null
  if (cache.has(url)) return cache.get(url) ?? null
  let color: string | null = null
  try {
    const response = await browserSession.fetch(url, { signal: AbortSignal.timeout(4000) })
    if (response.ok) {
      const pixels = pixelsOf(Buffer.from(await response.arrayBuffer()))
      if (pixels) color = dominantColor(pixels)
    }
  } catch {
    // Unreachable or unsupported format (e.g. SVG): no colour.
  }
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string)
  cache.set(url, color)
  return color
}

export function registerFaviconColors(browserSession: Session): void {
  ipcMain.handle('favicon:color', (_, url: string) =>
    typeof url === 'string' ? faviconColor(browserSession, url) : null
  )
}
