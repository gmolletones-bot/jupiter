import { app, ipcMain } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'

// Small key/value store for the UI (settings, open tabs, custom wallpaper).
// Unlike the renderer's localStorage, which Chromium flushes lazily, each
// write lands on disk immediately, so nothing is lost if the process is
// killed (e.g. Ctrl+C on `npm run dev`).

const KEYS = ['settings', 'session', 'wallpaper', 'wallpapers', 'bookmarks'] as const
type StoreKey = (typeof KEYS)[number]

function isStoreKey(key: unknown): key is StoreKey {
  return KEYS.includes(key as StoreKey)
}

function fileFor(key: StoreKey): string {
  return join(app.getPath('userData'), `${key}.store`)
}

export function registerStore(): void {
  ipcMain.on('store:get', (event, key: unknown) => {
    if (!isStoreKey(key)) {
      event.returnValue = null
      return
    }
    try {
      event.returnValue = readFileSync(fileFor(key), 'utf-8')
    } catch {
      event.returnValue = null
    }
  })

  ipcMain.on('store:set', (_, key: unknown, value: unknown) => {
    if (!isStoreKey(key) || (typeof value !== 'string' && value !== null)) return
    const file = fileFor(key)
    try {
      // Write-then-rename so a crash mid-write never leaves a truncated file.
      writeFileSync(`${file}.tmp`, value ?? '')
      renameSync(`${file}.tmp`, file)
    } catch (error) {
      console.error(`No se pudo guardar ${key}:`, error)
    }
  })
}
