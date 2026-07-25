export type MediaBridgeLinkingMode = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'article'
export type KnowledgeWorksLogLevel = 'info' | 'success' | 'error'
export type MediaBridgeLogLevel = KnowledgeWorksLogLevel
export type KnowledgeWorksTool = 'mediabridge'
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

export type MediaBridgeApi = {
  clearLogs: () => Promise<MediaBridgeOkResult>
  closeToolbar: () => Promise<void>
  getAppVersion: () => Promise<string>
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
    knowledgeworks: KnowledgeWorksApi
    mediabridge: MediaBridgeApi
  }
}

export {}
