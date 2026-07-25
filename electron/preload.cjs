const { contextBridge, ipcRenderer } = require('electron')

/**
 * @typedef {'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'article'} MediaBridgeLinkingMode
 * @typedef {'info' | 'success' | 'error'} KnowledgeWorksLogLevel
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
 *   level: KnowledgeWorksLogLevel,
 *   message: string,
 *   scope: string,
 *   timestamp: string,
 * }} KnowledgeWorksLogEntry
 *
 * @typedef {'mediabridge'} KnowledgeWorksTool
 * @typedef {'idle' | 'launching' | 'connected' | 'disconnected' | 'error'} KnowledgeWorksBrowserState
 *
 * @typedef {{
 *   state: KnowledgeWorksBrowserState,
 *   message?: string,
 * }} KnowledgeWorksBrowserStatus
 */

/** @returns {Promise<MediaBridgeOkResult>} */
const clearLogs = () => ipcRenderer.invoke('logs:clear')
/** @returns {Promise<KnowledgeWorksLogEntry[]>} */
const getLogs = () => ipcRenderer.invoke('logs:get')
/** @returns {Promise<MediaBridgeOkResult>} */
const openLogs = () => ipcRenderer.invoke('logs:open')

/**
 * @param {(logs: KnowledgeWorksLogEntry[]) => void} callback
 * @returns {() => void}
 */
function onLogsUpdated(callback) {
  const listener = (_event, logs) => callback(logs)

  ipcRenderer.on('logs:updated', listener)

  return () => ipcRenderer.removeListener('logs:updated', listener)
}

/**
 * @param {KnowledgeWorksLogLevel} level
 * @param {string} scope
 * @param {string} message
 * @param {string} [detail]
 * @returns {Promise<MediaBridgeOkResult>}
 */
const writeLog = (level, scope, message, detail) => ipcRenderer.invoke('logs:write', level, scope, message, detail)

contextBridge.exposeInMainWorld('knowledgeworks', {
  clearLogs,

  /**
   * @returns {Promise<string>}
   */
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  /**
   * @returns {Promise<KnowledgeWorksBrowserStatus>}
   */
  getBrowserStatus: () => ipcRenderer.invoke('browser:get-status'),

  getLogs,

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

  onLogsUpdated,

  openLogs,

  /**
   * @param {KnowledgeWorksTool} tool
   * @returns {Promise<MediaBridgeOkResult>}
   */
  openTool: tool => ipcRenderer.invoke('app:open-tool', tool),

  writeLog,
})

contextBridge.exposeInMainWorld('mediabridge', {
  clearLogs,

  /**
   * @returns {Promise<void>}
   */
  closeToolbar: () => ipcRenderer.invoke('toolbar:close'),

  /**
   * @param {MediaBridgeLinkingMode} mode
   * @returns {Promise<MediaBridgeActionResult>}
   */
  getTargetCount: mode => ipcRenderer.invoke('session:get-target-count', mode),

  getLogs,

  /**
   * @returns {Promise<MediaBridgeActionResult>}
   */
  launchBrowser: () => ipcRenderer.invoke('session:launch-browser'),

  /**
   * @returns {Promise<void>}
   */
  minimizeToolbar: () => ipcRenderer.invoke('toolbar:minimize'),

  onLogsUpdated,

  openLogs,

  /**
   * @param {MediaBridgeLinkingMode} mode
   * @returns {Promise<MediaBridgeActionResult>}
   */
  runMediaLinking: mode => ipcRenderer.invoke('session:run-media-linking', mode),

  /**
   * @returns {Promise<string>}
   */
  getAppVersion: () => ipcRenderer.invoke('session:get-app-version'),

  writeLog,
})
