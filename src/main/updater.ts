import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { systemConfig } from './system'

// Updates come from the GitHub Releases of the project (see "publish" in
// electron-builder.yml). The installer (Windows), AppImage and .deb (Linux)
// can update themselves; in development there's nothing to update.

const FIRST_CHECK_DELAY_MS = 15 * 1000
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000

let status: UpdateStatus = { state: app.isPackaged ? 'idle' : 'dev' }

function publish(next: UpdateStatus): void {
  status = next
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('updater:status', status)
  }
}

async function check(): Promise<void> {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = systemConfig().autoUpdate
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    publish({ state: 'error', error: error instanceof Error ? error.message : String(error) })
  }
}

export function registerUpdater(): void {
  ipcMain.handle('updater:get', () => status)
  ipcMain.handle('updater:check', () => check())
  ipcMain.handle('updater:download', async () => {
    if (app.isPackaged) await autoUpdater.downloadUpdate()
  })
  ipcMain.on('updater:install', () => {
    if (status.state === 'downloaded') autoUpdater.quitAndInstall()
  })

  if (!app.isPackaged) return

  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => publish({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => publish({ state: 'up-to-date' }))
  autoUpdater.on('update-available', (info) =>
    publish({
      state: systemConfig().autoUpdate ? 'downloading' : 'available',
      version: info.version,
      percent: 0
    })
  )
  autoUpdater.on('download-progress', (progress) =>
    publish({
      state: 'downloading',
      version: status.version,
      percent: Math.round(progress.percent)
    })
  )
  autoUpdater.on('update-downloaded', (info) =>
    publish({ state: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (error) => publish({ state: 'error', error: error.message }))

  setTimeout(() => void check(), FIRST_CHECK_DELAY_MS)
  setInterval(() => void check(), CHECK_EVERY_MS)
}
