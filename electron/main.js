import 'dotenv/config'
import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeArticleLinks, runMediaLinking } from '../src/automation/media-linking.js'
import { connectToBrowser } from '../src/browser.js'
import { configureApplicationMenu } from './app-menu.js'
import { checkForUpdates, configureAutoUpdater } from './auto-updater.js'
import { createBrowserProcessController } from './browser-process.js'
import { getErrorDetail, getErrorMessage } from './error-format.js'
import { configureDockIcon } from './runtime-icon.js'
import { formatSkippedTargetsDetail } from './skipped-target-logs.js'
import { createLogsBrowserWindow, createToolbarBrowserWindow } from './windows.js'

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
  toolbarWindow = await createToolbarBrowserWindow({
    appRoot,
    devServerUrl: getDevServerUrl(),
    electronDirectory: __dirname,
    focusToolbarWindow,
    shouldFocusOnReady: shouldFocusToolbarOnReady,
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

async function getSession() {
  const cdpUrl = browserProcessController.getCdpUrl()

  return {
    ...(await connectToBrowser(cdpUrl)),
    ownsBrowser: false,
  }
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

ipcMain.handle('session:get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('session:launch-browser', async () => {
  addLog('info', 'Browser', 'Opening controlled browser.')

  try {
    const cdpUrl = await browserProcessController.launch()
    addLog('success', 'Browser', `Connected to ${cdpUrl}.`)

    return { ok: true }
  } catch (error) {
    addLog('error', 'Browser', getErrorMessage(error), getErrorDetail(error))
    throw error
  }
})

ipcMain.handle('session:get-link-count', async (_event, mode = 'pdf') => {
  let session

  try {
    addLog('info', 'Counter', `Counting ${mode} targets.`)
    session = await getSession()
    const result = await analyzeArticleLinks(session.pages, mode)
    addLog(
      'success',
      'Counter',
      `Found ${result.unlinkedTargets.length} unlinked ${result.mode.label} target(s).`,
      result.articlePage.url(),
    )

    return {
      ok: true,
      count: result.targets.length,
      documentCount: result.unlinkedTargets.length,
      linkedCount: result.linkedTargets.length,
      mode: result.mode.label,
      articleUrl: result.articlePage.url(),
    }
  } catch (error) {
    addLog('error', 'Counter', getErrorMessage(error), getErrorDetail(error))
    throw error
  } finally {
    if (session?.ownsBrowser) {
      await session.browser.close()
    }
  }
})

ipcMain.handle('session:run-media-linking', async (_event, mode = 'pdf') => {
  let session

  try {
    addLog('info', 'Linking', `Running ${mode} linking.`)
    session = await getSession()
    const result = await runMediaLinking(session, mode)
    addLog(
      'success',
      'Linking',
      `Inserted ${result.processedCount} ${result.mode.label} target(s).`,
      formatSkippedTargetsDetail(result),
    )

    return {
      ok: true,
      count: result.targets.length,
      documentCount: result.unlinkedTargets.length,
      mode: result.mode.label,
      processedCount: result.processedCount,
      skippedCount: result.skippedCount,
    }
  } catch (error) {
    addLog('error', 'Linking', getErrorMessage(error), getErrorDetail(error))
    throw error
  } finally {
    if (session?.ownsBrowser) {
      await session.browser.close()
    }
  }
})

ipcMain.handle('logs:open', async () => {
  await createLogsWindow()

  return { ok: true }
})

ipcMain.handle('logs:get', () => logs)

ipcMain.handle('logs:clear', () => {
  logs.splice(0)
  publishLogs()

  return { ok: true }
})

ipcMain.handle('logs:write', (_event, level, scope, message, detail = '') => {
  addLog(level, scope, message, detail)

  return { ok: true }
})

ipcMain.handle('toolbar:close', () => {
  logsWindow?.close()
  toolbarWindow?.close()
})

ipcMain.handle('toolbar:minimize', () => {
  toolbarWindow?.minimize()
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
