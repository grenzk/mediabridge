import 'dotenv/config'
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configureApplicationMenu } from './app-menu.js'
import { checkForUpdates, configureAutoUpdater } from './auto-updater.js'
import { createBrowserService } from './browser-service.js'
import { getErrorDetail, getErrorMessage } from './error-format.js'
import { registerAppHandlers } from './ipc/app-handlers.js'
import { registerBrowserHandlers } from './ipc/browser-handlers.js'
import { registerLogHandlers } from './ipc/log-handlers.js'
import { registerSessionHandlers } from './ipc/session-handlers.js'
import { registerToolbarHandlers } from './ipc/toolbar-handlers.js'
import { createLogService } from './log-service.js'
import { configureDockIcon } from './runtime-icon.js'
import { createHubBrowserWindow, createLogsBrowserWindow, createToolbarBrowserWindow } from './windows.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const appRoot = join(__dirname, '..')
const browserStartupTimeout = Number(process.env.MEDIABRIDGE_BROWSER_STARTUP_TIMEOUT_MS) || 30000
const hasSingleInstanceLock = app.requestSingleInstanceLock()
const browserService = createBrowserService({
  appRoot,
  startupTimeout: browserStartupTimeout,
})
const logService = createLogService()
const addLog = logService.add

let toolbarWindow
let logsWindow
let hubWindow
let logsWindowPromise
let launchBrowserPromise
let shouldFocusToolbarOnReady = false

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
  if (!logsWindowPromise) {
    logsWindowPromise = createLogsBrowserWindow({
      devServerUrl: getDevServerUrl(),
      electronDirectory: __dirname,
      existingWindow: logsWindow,
      onClosed: closedWindow => {
        if (logsWindow === closedWindow) {
          logsWindow = undefined
        }
      },
    })
      .then(createdWindow => {
        logsWindow = createdWindow
      })
      .finally(() => {
        logsWindowPromise = undefined
      })
  }

  return logsWindowPromise
}

logService.subscribe(logs => {
  if (logsWindow && !logsWindow.isDestroyed()) {
    logsWindow.webContents.send('logs:updated', logs)
  }
})

function closeToolbar() {
  logsWindow?.close()
  toolbarWindow?.close()
}

function minimizeToolbar() {
  toolbarWindow?.minimize()
}

function launchBrowser() {
  if (!launchBrowserPromise) {
    addLog('info', 'Browser', 'Opening controlled browser.')
    launchBrowserPromise = browserService
      .launch()
      .then(cdpUrl => {
        addLog('success', 'Browser', `Connected to ${cdpUrl}.`)

        return { ok: true }
      })
      .catch(error => {
        addLog('error', 'Browser', getErrorMessage(error), getErrorDetail(error))
        throw error
      })
      .finally(() => {
        launchBrowserPromise = undefined
      })
  }

  return launchBrowserPromise
}

registerAppHandlers({
  getAppVersion: () => app.getVersion(),
  openTool: async tool => {
    if (tool === 'mediabridge') {
      await createToolbarWindow()
    }
  },
})

registerBrowserHandlers({
  browserService,
  launchBrowser,
})

registerSessionHandlers({
  addLog,
  browserService,
  launchBrowser,
})

registerLogHandlers({
  createLogsWindow,
  logService,
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
    browserService.close()
  }

  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createToolbarWindow()
  }
})
