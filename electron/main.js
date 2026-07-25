import 'dotenv/config'
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configureApplicationMenu } from './app-menu.js'
import { checkForUpdates, configureAutoUpdater } from './auto-updater.js'
import { createBrowserProcessController } from './browser-process.js'
import { registerAppHandlers } from './ipc/app-handlers.js'
import { registerLogHandlers } from './ipc/log-handlers.js'
import { registerSessionHandlers } from './ipc/session-handlers.js'
import { registerToolbarHandlers } from './ipc/toolbar-handlers.js'
import { configureDockIcon } from './runtime-icon.js'
import { createHubBrowserWindow, createLogsBrowserWindow, createToolbarBrowserWindow } from './windows.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const appRoot = join(__dirname, '..')
const browserStartupTimeout = Number(process.env.MEDIABRIDGE_BROWSER_STARTUP_TIMEOUT_MS) || 30000
const hasSingleInstanceLock = app.requestSingleInstanceLock()
const browserProcessController = createBrowserProcessController({
  appRoot,
  startupTimeout: browserStartupTimeout,
})

let toolbarWindow
let logsWindow
let hubWindow
let nextLogId = 1
let shouldFocusToolbarOnReady = false
const logs = []
const maxLogEntries = 500

/**
 * Restores and focuses the existing toolbar after another launch attempt.
 */
function focusToolbarWindow() {
  if (!toolbarWindow || toolbarWindow.isDestroyed()) {
    shouldFocusToolbarOnReady = true

    return
  }

  if (toolbarWindow.isMinimized()) {
    toolbarWindow.restore()
  }

  toolbarWindow.show()
  toolbarWindow.focus()
  toolbarWindow.moveTop()
  shouldFocusToolbarOnReady = false
}

function getDevServerUrl() {
  const devServerArg = process.argv.find(arg => arg.startsWith('--dev-server='))

  return process.env.VITE_DEV_SERVER_URL ?? devServerArg?.replace('--dev-server=', '')
}

async function createToolbarWindow() {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    focusToolbarWindow()

    return
  }

  toolbarWindow = await createToolbarBrowserWindow({
    appRoot,
    devServerUrl: getDevServerUrl(),
    electronDirectory: __dirname,
    focusToolbarWindow,
    shouldFocusOnReady: shouldFocusToolbarOnReady,
  })
}

async function createHubWindow() {
  hubWindow = await createHubBrowserWindow({
    appRoot,
    devServerUrl: getDevServerUrl(),
    electronDirectory: __dirname,
    existingWindow: hubWindow,
    onClosed: () => {
      hubWindow = undefined
    },
  })
}

async function createLogsWindow() {
  logsWindow = await createLogsBrowserWindow({
    devServerUrl: getDevServerUrl(),
    electronDirectory: __dirname,
    existingWindow: logsWindow,
    onClosed: () => {
      logsWindow = undefined
    },
  })
}

function getLogTimestamp() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function publishLogs() {
  if (logsWindow && !logsWindow.isDestroyed()) {
    logsWindow.webContents.send('logs:updated', logs)
  }
}

/**
 * @param {'info' | 'success' | 'error'} level
 * @param {string} scope
 * @param {string} message
 * @param {string} [detail]
 */
function addLog(level, scope, message, detail = '') {
  logs.push({
    id: nextLogId,
    timestamp: getLogTimestamp(),
    level,
    scope,
    message,
    detail,
  })
  nextLogId += 1

  if (logs.length > maxLogEntries) {
    logs.splice(0, logs.length - maxLogEntries)
  }

  publishLogs()
}

function clearLogs() {
  logs.splice(0)
  publishLogs()
}

function closeToolbar() {
  logsWindow?.close()
  toolbarWindow?.close()
}

function minimizeToolbar() {
  toolbarWindow?.minimize()
}

registerAppHandlers({
  getAppVersion: () => app.getVersion(),
  openTool: async tool => {
    if (tool === 'mediabridge') {
      await createToolbarWindow()
    }
  },
})

registerSessionHandlers({
  addLog,
  browserProcessController,
})

registerLogHandlers({
  addLog,
  clearLogs,
  createLogsWindow,
  getLogs: () => logs,
})

registerToolbarHandlers({
  closeToolbar,
  minimizeToolbar,
})

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', focusToolbarWindow)

  app.whenReady().then(async () => {
    configureApplicationMenu()
    configureDockIcon(appRoot)
    configureAutoUpdater(addLog)
    addLog('info', 'App', `MediaBridge ${app.getVersion()} started.`)
    await createToolbarWindow()

    if (process.argv.includes('--show-hub')) {
      await createHubWindow()
    }

    checkForUpdates(addLog)
  })
}

app.on('window-all-closed', () => {
  if (process.env.MEDIABRIDGE_CLOSE_BROWSER_ON_EXIT === '1') {
    browserProcessController.close()
  }

  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createToolbarWindow()
  }
})
