import { app, ipcMain } from 'electron'
import { analyzeArticleLinks, runMediaLinking } from '../../src/automation/media-linking.js'
import { connectToBrowser } from '../../src/browser.js'
import { getErrorDetail, getErrorMessage } from '../error-format.js'
import { formatSkippedTargetsDetail } from '../skipped-target-logs.js'

/**
 * @typedef {(level: 'info' | 'success' | 'error', scope: string, message: string, detail?: string) => void} AddLog
 */

/**
 * @param {{
 *   addLog: AddLog,
 *   browserProcessController: { getCdpUrl: () => string, launch: () => Promise<string> },
 * }} dependencies
 */
export function registerSessionHandlers({ addLog, browserProcessController }) {
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
      session = await getSession(browserProcessController)
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
      session = await getSession(browserProcessController)
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
}

/**
 * @param {{ getCdpUrl: () => string }} browserProcessController
 */
async function getSession(browserProcessController) {
  const cdpUrl = browserProcessController.getCdpUrl()

  return {
    ...(await connectToBrowser(cdpUrl)),
    ownsBrowser: false,
  }
}
