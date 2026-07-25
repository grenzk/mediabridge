const { contextBridge, ipcRenderer } = require('electron')

/**
 * @typedef {'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'article'} MediaBridgeLinkingMode
 * @typedef {'info' | 'success' | 'error'} MediaBridgeLogLevel
 *
 * @typedef {{
 *   articleUrl?: string,
 *   linkedTargetCount?: number,
 *   mode?: string,
 *   ok: boolean,
 *   processedCount?: number,
 *   skippedCount?: number,
 *   targetCount?: number,
 *   unlinkedTargetCount?: number,
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
 *
 * @typedef {'mediabridge'} KnowledgeWorksTool
 * @typedef {'idle' | 'launching' | 'connected' | 'disconnected' | 'error'} KnowledgeWorksBrowserState
 *
 * @typedef {{
 *   state: KnowledgeWorksBrowserState,
 *   message?: string,
 * }} KnowledgeWorksBrowserStatus
 */

contextBridge.exposeInMainWorld('knowledgeworks', {
  /**
   * @returns {Promise<string>}
   */
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  /**
   * @returns {Promise<KnowledgeWorksBrowserStatus>}
   */
  getBrowserStatus: () => ipcRenderer.invoke('browser:get-status'),

  /**
   * @returns {Promise<MediaBridgeOkResult>}
   */
  launchBrowser: () => ipcRenderer.invoke('browser:launch'),

  /**
   * @param {(status: KnowledgeWorksBrowserStatus) => void} callback
   * @returns {() => void}
   */
  onBrowserStatusChanged: callback => {
    const listener = (_event, status) => callback(status)

    ipcRenderer.on('browser:status-changed', listener)

    return () => ipcRenderer.removeListener('browser:status-changed', listener)
  },

  /**
   * @returns {Promise<MediaBridgeOkResult>}
   */
  openLogs: () => ipcRenderer.invoke('logs:open'),

  /**
   * @param {KnowledgeWorksTool} tool
   * @returns {Promise<MediaBridgeOkResult>}
   */
  openTool: tool => ipcRenderer.invoke('app:open-tool', tool),
})

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
  getTargetCount: mode => ipcRenderer.invoke('session:get-target-count', mode),

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
  writeLog: (level, scope, message, detail) => ipcRenderer.invoke('logs:write', level, scope, message, detail),
})
