type MediaBridgeLinkingMode = 'pdf' | 'word' | 'excel' | 'image' | 'article'
type MediaBridgeLogLevel = 'info' | 'success' | 'error'

type MediaBridgeActionResult = {
  articleUrl?: string
  count?: number
  documentCount?: number
  mode?: string
  ok: boolean
  processedCount?: number
  skippedCount?: number
}

type MediaBridgeOkResult = {
  ok: boolean
}

type MediaBridgeLogEntry = {
  detail?: string
  id: number
  level: MediaBridgeLogLevel
  message: string
  scope: string
  timestamp: string
}

type MediaBridgeApi = {
  clearLogs: () => Promise<MediaBridgeOkResult>
  closeToolbar: () => Promise<void>
  getAppVersion: () => Promise<string>
  getLinkCount: (mode: MediaBridgeLinkingMode) => Promise<MediaBridgeActionResult>
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

declare global {
  interface Window {
    mediabridge: MediaBridgeApi
  }
}

export {}
