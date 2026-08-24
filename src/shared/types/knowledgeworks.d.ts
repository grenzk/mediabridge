export type MediaBridgeLinkingMode = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'article'
export type ArticleFlowCompletionAction = 'check-in' | 'publish'
export type KnowledgeWorksLogLevel = 'info' | 'success' | 'error'
export type MediaBridgeLogLevel = KnowledgeWorksLogLevel
export type KnowledgeWorksTool = 'articleflow' | 'mediabridge' | 'docsweep'
export type KnowledgeWorksBrowserState = 'idle' | 'launching' | 'connected' | 'disconnected' | 'error'

export type KnowledgeWorksBrowserStatus = {
  state: KnowledgeWorksBrowserState
  message?: string
}

export type MediaBridgeActionResult = {
  articleUrl?: string
  linkedTargetCount?: number
  mode?: string
  ok: boolean
  processedCount?: number
  skippedCount?: number
  targetCount?: number
  unlinkedTargetCount?: number
}

export type MediaBridgeOkResult = {
  ok: boolean
}

export type KnowledgeWorksLogEntry = {
  detail?: string
  id: number
  level: KnowledgeWorksLogLevel
  message: string
  scope: string
  timestamp: string
}

export type MediaBridgeLogEntry = KnowledgeWorksLogEntry

export type ArticleFlowImportEntry = {
  folderPath: string[]
  relativeSourcePath: string
  sourcePath: string
  title: string
}

export type ArticleFlowImportPlan = {
  articles: ArticleFlowImportEntry[]
  folderPaths: string[][]
  ignoredPaths: string[]
  rootPath: string
}

export type ArticleFlowSelectionResult = {
  canceled: boolean
  ok: boolean
  plan?: ArticleFlowImportPlan
}

export type ArticleFlowRunResult = {
  createdArticleCount: number
  createdFolderCount: number
  existingArticleCount: number
  existingFolderCount: number
  failedArticles: Array<{
    message: string
    relativeSourcePath: string
  }>
  ok: boolean
}

export type DocSweepRunResult = {
  ok: boolean
  status: string
}

export type DocSweepFileSelectionResult = {
  canceled: boolean
  ok: boolean
  filePath?: string
}

export type DocSweepActionResult = {
  ok: boolean
}

export type ArticleFlowApi = {
  runImport: (rootPath: string, completionAction: ArticleFlowCompletionAction) => Promise<ArticleFlowRunResult>
  selectRoot: () => Promise<ArticleFlowSelectionResult>
}

export type MediaBridgeApi = {
  clearLogs: () => Promise<MediaBridgeOkResult>
  closeToolbar: () => Promise<void>
  getTargetCount: (mode: MediaBridgeLinkingMode) => Promise<MediaBridgeActionResult>
  getLogs: () => Promise<MediaBridgeLogEntry[]>
  launchBrowser: () => Promise<MediaBridgeActionResult>
  minimizeToolbar: () => Promise<void>
  onLogsUpdated: (callback: (logs: MediaBridgeLogEntry[]) => void) => () => void
  openLogs: () => Promise<MediaBridgeOkResult>
  runMediaLinking: (mode: MediaBridgeLinkingMode) => Promise<MediaBridgeActionResult>
  writeLog: (
    level: MediaBridgeLogLevel,
    scope: string,
    message: string,
    detail?: string,
  ) => Promise<MediaBridgeOkResult>
}

export type DocSweepApi = {
  selectExcelFile: () => Promise<DocSweepFileSelectionResult>
  loadExcel: (filePath: string) => Promise<{
    ok: boolean
    sheetName: string
    documents: Array<{
      row: number
      controlNumber: string
    }>
    error?: string
  }>
  openSite: (url: string, matchUrl: string) => Promise<DocSweepActionResult>
  verifySites: (includedSites: Array<'Vertiv' | 'Asset Library' | 'PD Cloud' | 'MASW'>) => Promise<{
    ok: boolean
    results: Array<{
      name: 'Vertiv' | 'Asset Library' | 'PD Cloud' | 'MASW'
      status: 'Ready' | 'Not connected' | 'Error'
      reason?: string
    }>
    error?: string
  }>
  runSweep: (controlNumber: string) => Promise<DocSweepRunResult>
}

export type KnowledgeWorksApi = {
  clearLogs: () => Promise<MediaBridgeOkResult>
  getAppVersion: () => Promise<string>
  getBrowserStatus: () => Promise<KnowledgeWorksBrowserStatus>
  getLogs: () => Promise<KnowledgeWorksLogEntry[]>
  launchBrowser: () => Promise<MediaBridgeOkResult>
  onBrowserStatusChanged: (callback: (status: KnowledgeWorksBrowserStatus) => void) => () => void
  onLogsUpdated: (callback: (logs: KnowledgeWorksLogEntry[]) => void) => () => void
  openLogs: () => Promise<MediaBridgeOkResult>
  openTool: (tool: KnowledgeWorksTool) => Promise<MediaBridgeOkResult>
  writeLog: (
    level: KnowledgeWorksLogLevel,
    scope: string,
    message: string,
    detail?: string,
  ) => Promise<MediaBridgeOkResult>
}

declare global {
  interface Window {
    articleflow: ArticleFlowApi
    docsweep: DocSweepApi
    knowledgeworks: KnowledgeWorksApi
    mediabridge: MediaBridgeApi
  }
}

export {}
