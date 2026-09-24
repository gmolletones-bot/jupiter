import { app, BrowserWindow, ipcMain } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'

// Settings that must be known before Electron starts (GPU switches can only be
// set then), so they live in the main process rather than in the UI's store.

interface SystemConfig {
  /** Use the GPU for page rendering and video decoding when available. */
  hardwareAcceleration: boolean
  /** Download and install Jupiter updates automatically. */
  autoUpdate: boolean
  /** Windows 11 Mica material behind the tab strip. */
  mica: boolean
}

const FILE = (): string => join(app.getPath('userData'), 'system.json')
let config: SystemConfig = { hardwareAcceleration: true, autoUpdate: true, mica: false }
/** Value in effect for this run; changing it needs a restart. */
let accelerationAtStartup = true

function loadConfig(): void {
  try {
    const data = JSON.parse(readFileSync(FILE(), 'utf-8'))
    config = {
      hardwareAcceleration: data.hardwareAcceleration !== false,
      autoUpdate: data.autoUpdate !== false,
      mica: data.mica === true
    }
  } catch {
    // First run: defaults.
  }
}

function saveConfig(): void {
  try {
    writeFileSync(`${FILE()}.tmp`, JSON.stringify(config, null, 2))
    renameSync(`${FILE()}.tmp`, FILE())
  } catch (error) {
    console.error('No se pudo guardar la configuración del sistema:', error)
  }
}

export function systemConfig(): Readonly<SystemConfig> {
  return config
}

/**
 * Must run before the app is ready. On Linux, Chromium leaves hardware video
 * decoding (VA-API) off unless asked, so 1080p video is decoded by the CPU;
 * these switches turn it on, like Firefox does by default. Windows and macOS
 * already decode video on the GPU.
 */
export function applyGpuSwitches(): void {
  loadConfig()
  accelerationAtStartup = config.hardwareAcceleration
  if (!config.hardwareAcceleration) {
    app.disableHardwareAcceleration()
    return
  }
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch(
      'enable-features',
      [
        // Current names (Chromium 131+) for VA-API decoding with the GL backend…
        'AcceleratedVideoDecodeLinuxGL',
        'AcceleratedVideoDecodeLinuxZeroCopyGL',
        'AcceleratedVideoEncoder',
        // …and the older ones, ignored by newer Chromium.
        'VaapiVideoDecoder',
        'VaapiVideoEncoder'
      ].join(',')
    )
    app.commandLine.appendSwitch('enable-gpu-rasterization')
    app.commandLine.appendSwitch('enable-zero-copy')
  }
}

/** Mica needs Windows 11 and a transparent window background to show through. */
export function supportsMica(): boolean {
  if (process.platform !== 'win32') return false
  const build = Number(process.getSystemVersion().split('.')[2] ?? 0)
  return build >= 22621
}

export function applyMica(window: BrowserWindow): void {
  if (!supportsMica()) return
  const on = config.mica
  window.setBackgroundColor(on ? '#00000000' : '#ffffff')
  window.setBackgroundMaterial(on ? 'mica' : 'none')
}

type Acceleration = 'hardware' | 'software' | 'off'

/** Chromium's per-feature status ("enabled", "disabled_software"…) simplified. */
function describe(status: string | undefined): Acceleration {
  if (!status) return 'off'
  if (status.startsWith('enabled')) return 'hardware'
  if (status.includes('software')) return 'software'
  return 'off'
}

export function registerSystem(): void {
  ipcMain.handle('system:get', () => {
    const gpu = app.getGPUFeatureStatus()
    return {
      ...config,
      accelerationActive: accelerationAtStartup,
      platform: process.platform,
      micaSupported: supportsMica(),
      version: app.getVersion(),
      gpu: {
        videoDecode: describe(gpu.video_decode),
        videoEncode: describe(gpu.video_encode),
        rasterization: describe(gpu.rasterization),
        compositing: describe(gpu.gpu_compositing),
        webgl: describe(gpu.webgl)
      }
    }
  })

  ipcMain.handle('system:set', (_, patch: Partial<SystemConfig>) => {
    if (typeof patch.hardwareAcceleration === 'boolean') {
      config.hardwareAcceleration = patch.hardwareAcceleration
    }
    if (typeof patch.autoUpdate === 'boolean') config.autoUpdate = patch.autoUpdate
    if (typeof patch.mica === 'boolean') {
      config.mica = patch.mica
      for (const window of BrowserWindow.getAllWindows()) applyMica(window)
    }
    saveConfig()
  })

  ipcMain.on('system:relaunch', () => {
    app.relaunch()
    app.quit()
  })
}
