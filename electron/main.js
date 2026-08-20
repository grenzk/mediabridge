import 'dotenv/config'
import { app } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerAppHandlers } from './ipc/app-handlers.js'
import { registerBrowserHandlers } from './ipc/browser-handlers.js'
import { registerLogHandlers } from './ipc/log-handlers.js'
import { registerToolbarHandlers } from './ipc/toolbar-handlers.js'
import { configureApplicationMenu } from './platform/app-menu.js'
import { checkForUpdates, configureAutoUpdater } from './platform/auto-updater.js'
import { createBrowserService } from './platform/browser-service.js'
import { getErrorDetail, getErrorMessage } from './platform/error-format.ts'
import { createLogService } from './platform/log-service.js'
import { configureDockIcon } from './platform/runtime-icon.js'
import {
  createArticleFlowBrowserWindow,
  createDocSweepBrowserWindow,
  createHubBrowserWindow,
  createLogsBrowserWindow,
  createToolbarBrowserWindow,
} from './platform/windows.js'
import { registerArticleFlowHandlers } from './tools/articleflow/handlers.ts'
import { registerMediaBridgeHandlers } from './tools/mediabridge/handlers.ts'
import { registerDocSweepHandlers } from './tools/docsweep/handlers.ts'

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
let articleFlowWindow
let toolbarWindowPromise
let logsWindowPromise
let hubWindowPromise
let articleFlowWindowPromise
let launchBrowserPromise
let docSweepWindow
let docSweepWindowPromise

/**
 * Restores and focuses the existing toolbar.
 */
function focusToolbarWindow() {
  if (!toolbarWindow || toolbarWindow.isDestroyed()) {
    return
  }

  if (toolbarWindow.isMinimized()) {
    toolbarWindow.restore()
  }

  toolbarWindow.show()
  toolbarWindow.focus()
  toolbarWindow.moveTop()
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

  if (!toolbarWindowPromise) {
    toolbarWindowPromise = createToolbarBrowserWindow({
      appRoot,
      devServerUrl: getDevServerUrl(),
      electronDirectory: __dirname,
    })
      .then(createdWindow => {
        toolbarWindow = createdWindow
      })
      .finally(() => {
        toolbarWindowPromise = undefined
      })
  }

  return toolbarWindowPromise
}

async function createHubWindow() {
  if (!hubWindowPromise) {
    hubWindowPromise = createHubBrowserWindow({
      devServerUrl: getDevServerUrl(),
      electronDirectory: __dirname,
      existingWindow: hubWindow,
      onClosed: closedWindow => {
        if (hubWindow === closedWindow) {
          hubWindow = undefined
        }
      },
    })
      .then(createdWindow => {
        hubWindow = createdWindow
      })
      .finally(() => {
        hubWindowPromise = undefined
      })
  }

  return hubWindowPromise
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

async function createArticleFlowWindow() {
  if (!articleFlowWindowPromise) {
    articleFlowWindowPromise = createArticleFlowBrowserWindow({
      appRoot,
      devServerUrl: getDevServerUrl(),
      electronDirectory: __dirname,
      existingWindow: articleFlowWindow,
      onClosed: closedWindow => {
        if (articleFlowWindow === closedWindow) {
          articleFlowWindow = undefined
        }
      },
    })
      .then(createdWindow => {
        articleFlowWindow = createdWindow
      })
      .finally(() => {
        articleFlowWindowPromise = undefined
      })
  }

  return articleFlowWindowPromise
}

async function createDocSweepWindow() {
  if (!docSweepWindowPromise) {
    docSweepWindowPromise = createDocSweepBrowserWindow({
      appRoot,
      devServerUrl: getDevServerUrl(),
      electronDirectory: __dirname,
      existingWindow: docSweepWindow,
      onClosed: closedWindow => {
        if (docSweepWindow === closedWindow) {
          docSweepWindow = undefined
        }
      },
    })
      .then(createdWindow => {
        docSweepWindow = createdWindow
      })
      .finally(() => {
        docSweepWindowPromise = undefined
      })
  }

  return docSweepWindowPromise
}

logService.subscribe(logs => {
  if (logsWindow && !logsWindow.isDestroyed()) {
    logsWindow.webContents.send('logs:updated', logs)
  }
})

function closeToolbar() {
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
      return
    }

    if (tool === 'articleflow') {
      await createArticleFlowWindow()
    }

    if (tool === 'docsweep') {
      await createDocSweepWindow()
    }
  },
})

registerBrowserHandlers({
  browserService,
  launchBrowser,
})

registerMediaBridgeHandlers({
  addLog,
  browserService,
  launchBrowser,
})

registerArticleFlowHandlers({
  addLog,
  browserService,
})

registerDocSweepHandlers({
  addLog,
  browserService,
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
  app.on('second-instance', createHubWindow)

  app.whenReady().then(async () => {
    configureApplicationMenu()
    configureDockIcon(appRoot)
    configureAutoUpdater(addLog)
    addLog('info', 'App', `KnowledgeWorks ${app.getVersion()} started.`)
    await createHubWindow()

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
  createHubWindow()
})
