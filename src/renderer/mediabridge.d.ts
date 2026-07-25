export type MediaBridgeLinkingMode = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'article'
export type MediaBridgeLogLevel = 'info' | 'success' | 'error'
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

export type MediaBridgeLogEntry = {
  detail?: string
  id: number
  level: MediaBridgeLogLevel
  message: string
  scope: string
  timestamp: string
}

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
  getAppVersion: () => Promise<string>
  getBrowserStatus: () => Promise<KnowledgeWorksBrowserStatus>
  launchBrowser: () => Promise<MediaBridgeOkResult>
  onBrowserStatusChanged: (callback: (status: KnowledgeWorksBrowserStatus) => void) => () => void
  openLogs: () => Promise<MediaBridgeOkResult>
  openTool: (tool: KnowledgeWorksTool) => Promise<MediaBridgeOkResult>
}

declare global {
  interface Window {
    knowledgeworks: KnowledgeWorksApi
    mediabridge: MediaBridgeApi
  }
}

export {}
