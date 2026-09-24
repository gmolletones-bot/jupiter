import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api: BrowserApi = {
  onOpenInNewTab: (callback) => {
    const listener = (_event: IpcRendererEvent, url: string, activate: boolean): void =>
      callback(url, activate)
    ipcRenderer.on('open-in-new-tab', listener)
    return () => {
      ipcRenderer.removeListener('open-in-new-tab', listener)
    }
  },
  onSearchInNewTab: (callback) => {
    const listener = (_event: IpcRendererEvent, text: string): void => callback(text)
    ipcRenderer.on('search-in-new-tab', listener)
    return () => {
      ipcRenderer.removeListener('search-in-new-tab', listener)
    }
  },
  onShortcut: (callback) => {
    const listener = (_event: IpcRendererEvent, action: ShortcutAction): void => callback(action)
    ipcRenderer.on('shortcut', listener)
    return () => {
      ipcRenderer.removeListener('shortcut', listener)
    }
  },
  storeGet: (key) => ipcRenderer.sendSync('store:get', key),
  storeSet: (key, value) => ipcRenderer.send('store:set', key, value),
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
  setTitleBarColors: (colors) => ipcRenderer.send('set-title-bar', colors),
  clearBrowsingData: () => ipcRenderer.invoke('clear-browsing-data'),
  searchHistory: (query, offset, limit) =>
    ipcRenderer.invoke('history:search', query, offset, limit),
  deleteHistoryEntry: (id) => ipcRenderer.invoke('history:delete', id),
  deleteHistoryUrl: (url) => ipcRenderer.invoke('history:delete-url', url),
  suggestHistory: (query, limit) => ipcRenderer.invoke('history:suggest', query, limit),
  suggestSearch: (engine, query) => ipcRenderer.invoke('suggest:search', engine, query),
  youtubeLiveId: (handle) => ipcRenderer.invoke('youtube:live-id', handle),
  getSystem: () => ipcRenderer.invoke('system:get'),
  setSystem: (patch) => ipcRenderer.invoke('system:set', patch),
  relaunch: () => ipcRenderer.send('system:relaunch'),
  getUpdateStatus: () => ipcRenderer.invoke('updater:get'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.send('updater:install'),
  onUpdateStatus: (callback) => {
    const listener = (_event: IpcRendererEvent, status: UpdateStatus): void => callback(status)
    ipcRenderer.on('updater:status', listener)
    return () => {
      ipcRenderer.removeListener('updater:status', listener)
    }
  },
  faviconColor: (url) => ipcRenderer.invoke('favicon:color', url),
  getShields: () => ipcRenderer.invoke('shields:get'),
  setShieldsEnabled: (enabled) => ipcRenderer.invoke('shields:set-enabled', enabled),
  updateShieldLists: () => ipcRenderer.invoke('shields:update-lists'),
  setCookieNotices: (enabled) => ipcRenderer.invoke('shields:set-cookie-notices', enabled),
  getShieldStats: () => ipcRenderer.invoke('shields:stats'),
  setFocusBlocking: (sites, until) => ipcRenderer.send('focus:set-blocking', sites, until),
  onFocusBlocked: (callback) => {
    const listener = (_event: IpcRendererEvent, contentsId: number, url: string): void =>
      callback(contentsId, url)
    ipcRenderer.on('focus:blocked', listener)
    return () => {
      ipcRenderer.removeListener('focus:blocked', listener)
    }
  },
  setSiteShields: (site, shieldsUp) => ipcRenderer.invoke('shields:set-site', site, shieldsUp),
  onShieldsBlocked: (callback) => {
    const listener = (_event: IpcRendererEvent, contentsId: number, count: number): void =>
      callback(contentsId, count)
    ipcRenderer.on('shields:blocked', listener)
    return () => {
      ipcRenderer.removeListener('shields:blocked', listener)
    }
  },
  toggleFullscreen: () => ipcRenderer.send('window:toggle-fullscreen'),
  savePage: (contentsId) => ipcRenderer.invoke('page:save', contentsId),
  quit: () => ipcRenderer.send('app:quit'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  listExtensions: () => ipcRenderer.invoke('extensions:list'),
  addExtension: () => ipcRenderer.invoke('extensions:add'),
  removeExtension: (id) => ipcRenderer.invoke('extensions:remove', id),
  openExtensionPopup: (popupUrl, anchor) =>
    ipcRenderer.send('extensions:open-popup', popupUrl, anchor)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
