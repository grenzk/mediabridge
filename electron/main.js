import 'dotenv/config'
import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeArticleLinks, runMediaLinking } from '../src/automation/media-linking.js'
import { connectToBrowser } from '../src/browser.js'
import { getCdpPort, getDefaultCdpUrl } from '../src/config/runtime.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const appRoot = join(__dirname, '..')
const browserStartupTimeout =
  Number(process.env.MEDIABRIDGE_BROWSER_STARTUP_TIMEOUT_MS) || 30000

let toolbarWindow
let logsWindow
let browserProcess
let launchedCdpUrl
let nextLogId = 1
const logs = []
const maxLogEntries = 500

function isDev() {
  return getDevServerUrl() !== undefined
}

function getDevServerUrl() {
  const arg = process.argv.find(item => item.startsWith('--dev-server='))

  return process.env.VITE_DEV_SERVER_URL ?? arg?.replace('--dev-server=', '')
}

async function createToolbarWindow() {
  toolbarWindow = new BrowserWindow({
    width: 620,
    height: 116,
    minWidth: 520,
    minHeight: 108,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: 'MediaBridge',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.platform === 'darwin') {
    toolbarWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    })
  }

  if (isDev()) {
    await toolbarWindow.loadURL(getDevServerUrl())
  } else {
    await toolbarWindow.loadFile(join(__dirname, '../dist/renderer/index.html'))
  }
}

async function createLogsWindow() {
  if (logsWindow && !logsWindow.isDestroyed()) {
    logsWindow.show()
    logsWindow.focus()

    return
  }

  logsWindow = new BrowserWindow({
    width: 760,
    height: 460,
    minWidth: 560,
    minHeight: 340,
    title: 'MediaBridge Logs',
    backgroundColor: '#080b10',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  logsWindow.once('closed', () => {
    logsWindow = undefined
  })

  if (isDev()) {
    await logsWindow.loadURL(`${getDevServerUrl()}?view=logs`)
  } else {
    await logsWindow.loadFile(join(__dirname, '../dist/renderer/index.html'), {
      query: { view: 'logs' },
    })
  }
}

async function getSession() {
  const cdpUrl = launchedCdpUrl ?? getDefaultCdpUrl()

  return {
    ...(await connectToBrowser(cdpUrl)),
    ownsBrowser: false,
  }
}

/**
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
function wait(milliseconds) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds)
  })
}

/**
 * Waits until Chrome's remote debugging endpoint accepts Playwright CDP
 * connections. Chrome may need a short startup window after spawn.
 *
 * @param {string} cdpUrl
 */
async function waitForBrowserConnection(cdpUrl) {
  const deadline = Date.now() + browserStartupTimeout
  let lastError

  while (Date.now() < deadline) {
    try {
      if (await isBrowserConnectionReady(cdpUrl)) {
        return
      }
    } catch (error) {
      lastError = error
    }

    await wait(250)
  }

  throw new Error(
    `Browser opened, but CDP was not ready at ${cdpUrl} after ${browserStartupTimeout / 1000} seconds. ${lastError?.message ?? ''}`.trim(),
  )
}

/**
 * Checks Chrome's lightweight CDP metadata endpoint without attaching
 * Playwright to the browser. This avoids changing browser/session state during
 * a readiness probe.
 *
 * @param {string} cdpUrl
 * @returns {Promise<boolean>}
 */
async function isBrowserConnectionReady(cdpUrl) {
  const response = await fetch(new URL('/json/version', cdpUrl)).catch(() => undefined)

  return response?.ok ?? false
}

/**
 * Finds the browser executable MediaBridge should launch for automation. On Windows,
 * Chrome for Testing is preferred so enterprise-managed Chrome policies do not
 * block remote debugging.
 *
 * @returns {string}
 */
function getBrowserExecutable() {
  const bundledChromeForTesting = app.isPackaged
    ? join(process.resourcesPath, 'chrome-win64', 'chrome.exe')
    : join(appRoot, 'vendor', 'chrome-win64', 'chrome.exe')

  const candidates = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    win32: [
      process.env.MEDIABRIDGE_CHROME_PATH,
      bundledChromeForTesting,
      join(process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
      join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
      join(process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Microsoft/Edge/Application/msedge.exe'),
      join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    ],
    linux: ['google-chrome', 'chromium', 'microsoft-edge'],
  }

  const platformCandidates = candidates[process.platform] ?? candidates.linux
  const existingPath = platformCandidates.filter(Boolean).find(item =>
    process.platform === 'linux' ? true : existsSync(item),
  )

  if (!existingPath) {
    throw new Error('Could not find Chrome, Edge, or Chromium on this computer.')
  }

  return existingPath
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

/**
 * @param {unknown} error
 * @returns {string}
 */
function getErrorDetail(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message
  }

  return String(error)
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

ipcMain.handle('session:launch-browser', async () => {
  addLog('info', 'Browser', 'Opening controlled browser.')

  try {
    const cdpUrl = getDefaultCdpUrl()

    if (!browserProcess || browserProcess.killed) {
      if (await isBrowserConnectionReady(cdpUrl)) {
        launchedCdpUrl = cdpUrl

        addLog('success', 'Browser', `Connected to ${launchedCdpUrl}.`)

        return { ok: true }
      }

      const port = getCdpPort()
      const userDataDir = join(app.getPath('userData'), 'browser-profile')

      browserProcess = spawn(getBrowserExecutable(), [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--disable-infobars',
      ], {
        detached: true,
        stdio: 'ignore',
      })

      browserProcess.unref()
      browserProcess.once('exit', () => {
        browserProcess = undefined
        launchedCdpUrl = undefined
      })
      launchedCdpUrl = cdpUrl
    }

    await waitForBrowserConnection(launchedCdpUrl)
    addLog('success', 'Browser', `Connected to ${launchedCdpUrl}.`)

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
      `Found ${result.documentLinks.length} unlinked ${result.mode.label} target(s).`,
      result.articlePage.url(),
    )

    return {
      ok: true,
      count: result.links.length,
      documentCount: result.documentLinks.length,
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
    addLog('info', 'Linking', `Running ${mode} media linking.`)
    session = await getSession()
    const result = await runMediaLinking(session, mode)
    addLog(
      'success',
      'Linking',
      `Inserted ${result.processedCount} ${result.mode.label} target(s).`,
      result.skippedCount
        ? `Skipped ${result.skippedCount} missing media file(s).`
        : '',
    )

    return {
      ok: true,
      count: result.links.length,
      documentCount: result.documentLinks.length,
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

app.whenReady().then(createToolbarWindow)

app.on('window-all-closed', async () => {
  if (
    process.env.MEDIABRIDGE_CLOSE_BROWSER_ON_EXIT === '1' &&
    browserProcess &&
    !browserProcess.killed
  ) {
    browserProcess.kill()
  }

  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createToolbarWindow()
  }
})
