// Renders build/icon.svg into every icon the app and its installers need:
//   build/icon.png      1024 px  (electron-builder: Linux, and macOS if ever built)
//   build/icon.ico      16–256 px (Windows installer and .exe)
//   resources/icon.png  512 px   (window icon at runtime)
// Run with `npm run icons` after editing the SVG.
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const SIZES = [...ICO_SIZES, 512, 1024]

/** .ico file whose entries are PNG images (supported since Windows Vista). */
function icoFromPngs(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(pngs.length, 4)
  const entries = []
  let offset = 6 + pngs.length * 16
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2) // no palette
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    offset += data.length
  }
  return Buffer.concat([header, ...entries, ...pngs.map((png) => png.data)])
}

app.whenReady().then(async () => {
  const svg = readFileSync(join(root, 'build/icon.svg'), 'utf8')
  const window = new BrowserWindow({ show: false })
  await window.loadURL('about:blank')
  // Draw the vector at each size in a canvas: sharper small icons than
  // shrinking one big bitmap, and real transparency in the corners.
  const images = await window.webContents.executeJavaScript(`(async () => {
    const image = new Image()
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(svg)})
    await image.decode()
    const out = {}
    for (const size of ${JSON.stringify(SIZES)}) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const context = canvas.getContext('2d')
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, size, size)
      out[size] = canvas.toDataURL('image/png').split(',')[1]
    }
    return out
  })()`)
  const png = (size) => Buffer.from(images[size], 'base64')

  writeFileSync(join(root, 'build/icon.png'), png(1024))
  writeFileSync(join(root, 'resources/icon.png'), png(512))
  writeFileSync(
    join(root, 'build/icon.ico'),
    icoFromPngs(ICO_SIZES.map((size) => ({ size, data: png(size) })))
  )
  console.log('Iconos generados: build/icon.png, build/icon.ico, resources/icon.png')
  app.quit()
})
