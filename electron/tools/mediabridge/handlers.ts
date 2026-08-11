import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { connectToBrowser } from '../../../src/shared/browser/connect-to-browser.ts'
import type { BrowserSession } from '../../../src/shared/browser/connect-to-browser.ts'
import { analyzeArticleLinks, runMediaLinking } from '../../../src/tools/mediabridge/automation/media-linking.ts'
import { getErrorDetail, getErrorMessage } from '../../platform/error-format.ts'
import { formatUnlinkedTargetsDetail } from './unlinked-target-logs.ts'

type AddLog = (level: 'info' | 'success' | 'error', scope: string, message: string, detail?: string) => void

type BrowserService = {
  getCdpUrl: () => string
}

type MediaBridgeSession = BrowserSession & {
  ownsBrowser: boolean
}

type MediaBridgeHandlerDependencies = {
  addLog: AddLog
  browserService: BrowserService
  launchBrowser: () => Promise<{ ok: boolean }>
}

export function registerMediaBridgeHandlers({ addLog, browserService, launchBrowser }: MediaBridgeHandlerDependencies) {
  ipcMain.handle('session:launch-browser', () => launchBrowser())

  ipcMain.handle('session:get-target-count', async (_event: IpcMainInvokeEvent, mode: string = 'pdf') => {
    let session: MediaBridgeSession | undefined

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

  ipcMain.handle('session:run-media-linking', async (_event: IpcMainInvokeEvent, mode: string = 'pdf') => {
    let session: MediaBridgeSession | undefined

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

async function getSession(browserService: BrowserService): Promise<MediaBridgeSession> {
  const cdpUrl = browserService.getCdpUrl()

  return {
    ...(await connectToBrowser(cdpUrl)),
    ownsBrowser: false,
  }
}
