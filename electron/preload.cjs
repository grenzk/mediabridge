const { contextBridge, ipcRenderer } = require('electron')

/**
 * @typedef {'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'article'} MediaBridgeLinkingMode
 * @typedef {'check-in' | 'publish'} ArticleFlowCompletionAction
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
 * @typedef {'articleflow' | 'mediabridge'} KnowledgeWorksTool
 * @typedef {'idle' | 'launching' | 'connected' | 'disconnected' | 'error'} KnowledgeWorksBrowserState
 *
 * @typedef {{
 *   state: KnowledgeWorksBrowserState,
 *   message?: string,
 * }} KnowledgeWorksBrowserStatus
 *
 * @typedef {{
 *   folderPath: string[],
 *   relativeSourcePath: string,
 *   sourcePath: string,
 *   title: string,
 * }} ArticleFlowImportEntry
 *
 * @typedef {{
 *   articles: ArticleFlowImportEntry[],
 *   folderPaths: string[][],
 *   ignoredPaths: string[],
 *   rootPath: string,
 * }} ArticleFlowImportPlan
 *
 * @typedef {{
 *   canceled: boolean,
 *   ok: boolean,
 *   plan?: ArticleFlowImportPlan,
 * }} ArticleFlowSelectionResult
 *
 * @typedef {{
 *   createdArticleCount: number,
 *   createdFolderCount: number,
 *   existingArticleCount: number,
 *   existingFolderCount: number,
 *   failedArticles: Array<{ message: string, relativeSourcePath: string }>,
 *   ok: boolean,
 * }} ArticleFlowRunResult
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

contextBridge.exposeInMainWorld('articleflow', {
  /**
   * @param {string} rootPath
   * @param {ArticleFlowCompletionAction} completionAction
   * @returns {Promise<ArticleFlowRunResult>}
   */
  runImport: (rootPath, completionAction) => ipcRenderer.invoke('articleflow:run', rootPath, completionAction),

  /**
   * @returns {Promise<ArticleFlowSelectionResult>}
   */
  selectRoot: () => ipcRenderer.invoke('articleflow:select-root'),
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

  writeLog,
})
