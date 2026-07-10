import { app } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getCdpPort, getDefaultCdpUrl } from '../src/config/runtime.js'

/**
 * @typedef {{
 *   getCdpUrl: () => string,
 *   launch: () => Promise<string>,
 *   close: () => void,
 * }} BrowserProcessController
 */

/**
 * @param {{
 *   appRoot: string,
 *   startupTimeout: number,
 * }} options
 * @returns {BrowserProcessController}
 */
export function createBrowserProcessController({ appRoot, startupTimeout }) {
  let browserProcess
  let launchedCdpUrl

  return {
    getCdpUrl() {
      return launchedCdpUrl ?? getDefaultCdpUrl()
    },

    async launch() {
      const cdpUrl = getDefaultCdpUrl()

      if (!browserProcess || browserProcess.killed) {
        if (await isBrowserConnectionReady(cdpUrl)) {
          launchedCdpUrl = cdpUrl

          return launchedCdpUrl
        }

        const port = getCdpPort()
        const userDataDir = join(app.getPath('userData'), 'browser-profile')

        browserProcess = spawn(
          getBrowserExecutable(appRoot),
          [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, '--disable-infobars'],
          {
            detached: true,
            stdio: 'ignore',
          },
        )

        browserProcess.unref()
        browserProcess.once('exit', () => {
          browserProcess = undefined
          launchedCdpUrl = undefined
        })
        launchedCdpUrl = cdpUrl
      }

      await waitForBrowserConnection(launchedCdpUrl, startupTimeout)

      return launchedCdpUrl
    },

    close() {
      if (browserProcess && !browserProcess.killed) {
        browserProcess.kill()
      }
    },
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
