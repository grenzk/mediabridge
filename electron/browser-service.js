import { app } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getCdpPort, getDefaultCdpUrl } from '../src/config/runtime.js'

/**
 * @typedef {'idle' | 'launching' | 'connected' | 'disconnected' | 'error'} BrowserConnectionState
 *
 * @typedef {{
 *   state: BrowserConnectionState,
 *   message?: string,
 * }} BrowserStatus
 *
 * @typedef {{
 *   getCdpUrl: () => string,
 *   getStatus: () => BrowserStatus,
 *   launch: () => Promise<string>,
 *   refreshStatus: () => Promise<BrowserStatus>,
 *   subscribe: (listener: (status: BrowserStatus) => void) => () => void,
 *   close: () => void,
 * }} BrowserService
 */

/**
 * @param {{
 *   appRoot: string,
 *   startupTimeout: number,
 * }} options
 * @returns {BrowserService}
 */
export function createBrowserService({ appRoot, startupTimeout }) {
  let browserProcess
  let launchPromise
  let launchedCdpUrl
  /** @type {BrowserStatus} */
  let status = { state: 'idle' }
  /** @type {Set<(status: BrowserStatus) => void>} */
  const listeners = new Set()

  function getCdpUrl() {
    return launchedCdpUrl ?? getDefaultCdpUrl()
  }

  /**
   * @param {BrowserStatus} nextStatus
   */
  function updateStatus(nextStatus) {
    if (status.state === nextStatus.state && status.message === nextStatus.message) {
      return
    }

    status = { ...nextStatus }
    listeners.forEach(listener => listener({ ...status }))
  }

  async function performLaunch() {
    const cdpUrl = getDefaultCdpUrl()
    updateStatus({ state: 'launching' })

    try {
      if (await isBrowserConnectionReady(cdpUrl)) {
        await activateBrowserTarget(cdpUrl)
        launchedCdpUrl = cdpUrl
        updateStatus({ state: 'connected' })

        return launchedCdpUrl
      }

      if (!browserProcess || browserProcess.killed) {
        const port = getCdpPort()
        const userDataDir = join(app.getPath('userData'), 'browser-profile')
        const spawnedBrowser = spawn(
          getBrowserExecutable(appRoot),
          [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, '--disable-infobars'],
          {
            detached: true,
            stdio: 'ignore',
          },
        )

        browserProcess = spawnedBrowser
        spawnedBrowser.unref()
        spawnedBrowser.once('exit', () => {
          if (browserProcess !== spawnedBrowser) {
            return
          }

          browserProcess = undefined
          launchedCdpUrl = undefined
          updateStatus({ state: 'disconnected' })
        })
        launchedCdpUrl = cdpUrl
      }

      await waitForBrowserConnection(launchedCdpUrl, startupTimeout)
      updateStatus({ state: 'connected' })

      return launchedCdpUrl
    } catch (error) {
      updateStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  return {
    getCdpUrl,

    getStatus() {
      return { ...status }
    },

    launch() {
      if (!launchPromise) {
        launchPromise = performLaunch().finally(() => {
          launchPromise = undefined
        })
      }

      return launchPromise
    },

    async refreshStatus() {
      if (launchPromise) {
        return { ...status }
      }

      const isConnected = await isBrowserConnectionReady(getCdpUrl())

      if (isConnected) {
        updateStatus({ state: 'connected' })
      } else {
        updateStatus({
          state: status.state === 'connected' ? 'disconnected' : 'idle',
        })
      }

      return { ...status }
    },

    subscribe(listener) {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },

    close() {
      if (browserProcess && !browserProcess.killed) {
        const runningBrowser = browserProcess
        browserProcess = undefined
        launchedCdpUrl = undefined
        runningBrowser.kill()
      }

      updateStatus({ state: 'idle' })
    },
  }
}

/**
 * Brings an existing controlled browser page to the foreground.
 *
 * @param {string} cdpUrl
 * @returns {Promise<void>}
 */
async function activateBrowserTarget(cdpUrl) {
  const response = await fetch(`${cdpUrl}/json/list`)

  if (!response.ok) {
    throw new Error(`Could not inspect controlled browser tabs (${response.status}).`)
  }

  /** @type {Array<{ id?: string, type?: string, url?: string }>} */
  const targets = await response.json()
  const pageTarget =
    targets.find(target => target.type === 'page' && target.url && !target.url.startsWith('chrome://')) ??
    targets.find(target => target.type === 'page')

  if (!pageTarget?.id) {
    return
  }

  const activateResponse = await fetch(`${cdpUrl}/json/activate/${encodeURIComponent(pageTarget.id)}`)

  if (!activateResponse.ok) {
    throw new Error(`Could not open the controlled browser (${activateResponse.status}).`)
  }
}

/**
 * Finds the browser executable MediaBridge should launch for automation. On Windows,
 * Chrome for Testing is preferred so enterprise-managed Chrome policies do not
 * block remote debugging.
 *
 * @param {string} appRoot
 * @returns {string}
 */
function getBrowserExecutable(appRoot) {
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
  const existingPath = platformCandidates
    .filter(Boolean)
    .find(candidatePath => (process.platform === 'linux' ? true : existsSync(candidatePath)))

  if (!existingPath) {
    throw new Error('Could not find Chrome, Edge, or Chromium on this computer.')
  }

  return existingPath
}

/**
 * Waits until Chrome's remote debugging endpoint accepts Playwright CDP
 * connections. Chrome may need a short startup window after spawn.
 *
 * @param {string} cdpUrl
 * @param {number} startupTimeout
 */
async function waitForBrowserConnection(cdpUrl, startupTimeout) {
  const deadline = Date.now() + startupTimeout
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
    `Browser opened, but CDP was not ready at ${cdpUrl} after ${startupTimeout / 1000} seconds. ${lastError?.message ?? ''}`.trim(),
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
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
function wait(milliseconds) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds)
  })
}
