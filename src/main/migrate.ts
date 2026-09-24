import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// The app was called "mi-navegador" / "Mi Navegador" before becoming Jupiter,
// so its data lived in a different userData folder. Copy the browser's own
// files over once, the first time Jupiter starts with an empty folder.

const FILES = [
  'settings.store',
  'session.store',
  'wallpaper.store',
  'wallpapers.store',
  'bookmarks.store',
  'history.json',
  'extensions.json',
  'shields.json'
]
const OLD_NAMES = ['mi-navegador', 'Mi Navegador']

export function migrateFromOldName(): void {
  const userData = app.getPath('userData')
  if (FILES.some((file) => existsSync(join(userData, file)))) return

  for (const oldName of OLD_NAMES) {
    const oldDir = join(app.getPath('appData'), oldName)
    const found = FILES.filter((file) => existsSync(join(oldDir, file)))
    if (found.length === 0) continue
    mkdirSync(userData, { recursive: true })
    for (const file of found) copyFileSync(join(oldDir, file), join(userData, file))
    return
  }
}
