const { contextBridge, ipcRenderer } = require('electron')

/**
 * @typedef {'pdf' | 'word' | 'excel' | 'image' | 'article'} MediaBridgeLinkingMode
 * @typedef {'info' | 'success' | 'error'} MediaBridgeLogLevel
 *
 * @typedef {{
 *   articleUrl?: string,
 *   count?: number,
 *   documentCount?: number,
 *   mode?: string,
 *   ok: boolean,
 *   processedCount?: number,
 *   skippedCount?: number,
 * }} MediaBridgeActionResult
 *
 * @typedef {{ ok: boolean }} MediaBridgeOkResult
 *
 * @typedef {{
 *   detail?: string,
 *   id: number,
 *   level: MediaBridgeLogLevel,
 *   message: string,
 *   scope: string,
 *   timestamp: string,
 * }} MediaBridgeLogEntry
 */

contextBridge.exposeInMainWorld('mediabridge', {
  /**
   * @returns {Promise<MediaBridgeOkResult>}
   */
  clearLogs: () => ipcRenderer.invoke('logs:clear'),

  /**
   * @returns {Promise<void>}
   */
  closeToolbar: () => ipcRenderer.invoke('toolbar:close'),

  /**
   * @param {MediaBridgeLinkingMode} mode
   * @returns {Promise<MediaBridgeActionResult>}
   */
  getLinkCount: mode => ipcRenderer.invoke('session:get-link-count', mode),

  /**
   * @returns {Promise<MediaBridgeLogEntry[]>}
   */
  getLogs: () => ipcRenderer.invoke('logs:get'),

  /**
   * @returns {Promise<MediaBridgeActionResult>}
   */
  launchBrowser: () => ipcRenderer.invoke('session:launch-browser'),

  /**
   * @returns {Promise<void>}
   */
  minimizeToolbar: () => ipcRenderer.invoke('toolbar:minimize'),

  /**
   * @param {(logs: MediaBridgeLogEntry[]) => void} callback
   * @returns {() => void}
   */
  onLogsUpdated: callback => {
    const listener = (_event, logs) => callback(logs)

    ipcRenderer.on('logs:updated', listener)

    return () => ipcRenderer.removeListener('logs:updated', listener)
  },

  /**
   * @returns {Promise<MediaBridgeOkResult>}
   */
  openLogs: () => ipcRenderer.invoke('logs:open'),

  /**
   * @param {MediaBridgeLinkingMode} mode
   * @returns {Promise<MediaBridgeActionResult>}
   */
  runMediaLinking: mode => ipcRenderer.invoke('session:run-media-linking', mode),

  /**
   * @returns {Promise<string>}
   */
  getAppVersion: () => ipcRenderer.invoke('session:get-app-version'),

  /**
   * @param {MediaBridgeLogLevel} level
   * @param {string} scope
   * @param {string} message
   * @param {string} [detail]
   * @returns {Promise<MediaBridgeOkResult>}
   */
  writeLog: (level, scope, message, detail) =>
    ipcRenderer.invoke('logs:write', level, scope, message, detail),
})
