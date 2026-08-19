import { BrowserWindow, ipcMain } from 'electron'

/**
 * @typedef {{
 *   state: 'idle' | 'launching' | 'connected' | 'disconnected' | 'error',
 *   message?: string,
 * }} BrowserStatus
 */

/**
 * @param {{
 *   browserService: {
 *     refreshStatus: () => Promise<BrowserStatus>,
 *     subscribe: (listener: (status: BrowserStatus) => void) => () => void,
 *   },
 *   launchBrowser: () => Promise<{ ok: boolean }>,
 * }} dependencies
 */
export function registerBrowserHandlers({ browserService, launchBrowser }) {
  ipcMain.handle('browser:get-status', () => browserService.refreshStatus())
  ipcMain.handle('browser:launch', () => launchBrowser())

  return browserService.subscribe(status => {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('browser:status-changed', status)
      }
    })
  })
}
