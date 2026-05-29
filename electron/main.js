import 'dotenv/config'
import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeArticleLinks, runMediaLinking } from '../src/automation/media-linking.js'
import { connectToBrowser } from '../src/browser.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const appRoot = join(__dirname, '..')
const browserStartupTimeout =
  Number(process.env.MEDIABRIDGE_BROWSER_STARTUP_TIMEOUT_MS) || 30000

let toolbarWindow
let browserProcess
let launchedCdpUrl

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

async function getSession() {
  const cdpUrl = launchedCdpUrl ?? process.env.CDP_URL

  if (!cdpUrl) {
    throw new Error('Launch a browser first or set CDP_URL in your environment.')
  }

  return {
    ...(await connectToBrowser(cdpUrl)),
    ownsBrowser: cdpUrl === process.env.CDP_URL,
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
      const session = await connectToBrowser(cdpUrl)
      await session.browser.close()

      return
    } catch (error) {
      lastError = error
      await wait(250)
    }
  }

  throw new Error(
    `Browser opened, but CDP was not ready at ${cdpUrl} after ${browserStartupTimeout / 1000} seconds. ${lastError?.message ?? ''}`.trim(),
  )
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

ipcMain.handle('session:launch-browser', async () => {
  if (!browserProcess || browserProcess.killed) {
    const port = process.env.MEDIABRIDGE_CDP_PORT ?? '9222'
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
    launchedCdpUrl = `http://127.0.0.1:${port}`
  }

  await waitForBrowserConnection(launchedCdpUrl)

  return { ok: true }
})

ipcMain.handle('session:get-link-count', async (_event, mode = 'pdf') => {
  const session = await getSession()

  try {
    const result = await analyzeArticleLinks(session.pages, mode)

    return {
      ok: true,
      count: result.links.length,
      documentCount: result.documentLinks.length,
      mode: result.mode.label,
      articleUrl: result.articlePage.url(),
    }
  } finally {
    if (session.ownsBrowser) {
      await session.browser.close()
    }
  }
})

ipcMain.handle('session:run-media-linking', async (_event, mode = 'pdf') => {
  const session = await getSession()

  try {
    const result = await runMediaLinking(session, mode)

    return {
      ok: true,
      count: result.links.length,
      documentCount: result.documentLinks.length,
      mode: result.mode.label,
      processedCount: result.processedCount,
      skippedCount: result.skippedCount,
    }
  } finally {
    if (session.ownsBrowser) {
      await session.browser.close()
    }
  }
})

ipcMain.handle('toolbar:close', () => {
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
