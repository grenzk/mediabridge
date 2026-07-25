import { app, ipcMain } from 'electron'
import { analyzeArticleLinks, runMediaLinking } from '../../src/automation/media-linking.js'
import { connectToBrowser } from '../../src/browser.js'
import { getErrorDetail, getErrorMessage } from '../error-format.js'
import { formatUnlinkedTargetsDetail } from '../unlinked-target-logs.js'

/**
 * @typedef {(level: 'info' | 'success' | 'error', scope: string, message: string, detail?: string) => void} AddLog
 */

/**
 * @param {{
 *   addLog: AddLog,
 *   browserService: { getCdpUrl: () => string },
 *   launchBrowser: () => Promise<{ ok: boolean }>,
 * }} dependencies
 */
export function registerSessionHandlers({ addLog, browserService, launchBrowser }) {
  ipcMain.handle('session:get-app-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('session:launch-browser', () => launchBrowser())

  ipcMain.handle('session:get-target-count', async (_event, mode = 'pdf') => {
    let session

    try {
      addLog('info', 'Counter', `Counting ${mode} targets.`)
      session = await getSession(browserService)
      const result = await analyzeArticleLinks(session.pages, mode)
      addLog(
        'success',
        'Counter',
        `Found ${result.unlinkedTargets.length} unlinked ${result.mode.label} target(s).`,
        formatUnlinkedTargetsDetail(result),
      )

      return {
        ok: true,
        targetCount: result.targets.length,
        unlinkedTargetCount: result.unlinkedTargets.length,
        linkedTargetCount: result.linkedTargets.length,
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
      session = await getSession(browserService)
      const result = await runMediaLinking(session, mode)
      addLog(
        'success',
        'Linking',
        `Inserted ${result.processedCount} ${result.mode.label} target(s).`,
        formatUnlinkedTargetsDetail(result),
      )

      return {
        ok: true,
        targetCount: result.targets.length,
        unlinkedTargetCount: result.unlinkedTargetCount,
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
 * @param {{ getCdpUrl: () => string }} browserService
 */
async function getSession(browserService) {
  const cdpUrl = browserService.getCdpUrl()

  return {
    ...(await connectToBrowser(cdpUrl)),
    ownsBrowser: false,
  }
}
