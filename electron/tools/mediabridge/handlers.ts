import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { connectToBrowser } from '../../../src/shared/browser/connect-to-browser.ts'
import type { BrowserSession } from '../../../src/shared/browser/connect-to-browser.ts'
import { isAutomationCancellationError } from '../../../src/shared/automation/cancellation.ts'
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
  let activeCountController: AbortController | undefined
  let activeLinkingController: AbortController | undefined

  ipcMain.handle('session:launch-browser', () => launchBrowser())

  ipcMain.handle('session:cancel-target-count', () => {
    if (!activeCountController) {
      return { cancellationRequested: false, ok: true }
    }

    activeCountController.abort()
    addLog('info', 'Counter', 'Stopping target count.')

    return { cancellationRequested: true, ok: true }
  })

  ipcMain.handle('session:cancel-media-linking', () => {
    if (!activeLinkingController) {
      return { cancellationRequested: false, ok: true }
    }

    activeLinkingController.abort()
    addLog('info', 'Linking', 'Stopping MediaBridge after the current operation.')

    return { cancellationRequested: true, ok: true }
  })

  ipcMain.handle('session:get-target-count', async (_event: IpcMainInvokeEvent, mode: string = 'pdf') => {
    let session: MediaBridgeSession | undefined

    if (activeCountController || activeLinkingController) {
      throw new Error('Another MediaBridge action is already running.')
    }

    const controller = new AbortController()
    activeCountController = controller

    try {
      addLog('info', 'Counter', `Counting ${mode} targets.`)
      session = await getSession(browserService)
      const result = await analyzeArticleLinks(session.pages, mode, { signal: controller.signal })

      if (controller.signal.aborted) {
        addLog('info', 'Counter', 'Target counting stopped.')

        return { canceled: true, ok: true }
      }

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
      if (isAutomationCancellationError(error)) {
        addLog('info', 'Counter', 'Target counting stopped.')

        return { canceled: true, ok: true }
      }

      addLog('error', 'Counter', getErrorMessage(error), getErrorDetail(error))
      throw error
    } finally {
      if (activeCountController === controller) {
        activeCountController = undefined
      }

      if (session?.ownsBrowser) {
        await session.browser.close()
      }
    }
  })

  ipcMain.handle('session:run-media-linking', async (_event: IpcMainInvokeEvent, mode: string = 'pdf') => {
    let session: MediaBridgeSession | undefined

    if (activeCountController || activeLinkingController) {
      throw new Error('Another MediaBridge action is already running.')
    }

    const controller = new AbortController()
    activeLinkingController = controller

    try {
      addLog('info', 'Linking', `Running ${mode} linking.`)
      session = await getSession(browserService)
      const result = await runMediaLinking(session, mode, { signal: controller.signal })

      if (result.canceled) {
        addLog('info', 'Linking', `MediaBridge stopped after inserting ${result.processedCount} target(s).`)
      } else {
        addLog(
          'success',
          'Linking',
          `Inserted ${result.processedCount} ${result.mode.label} target(s).`,
          formatUnlinkedTargetsDetail(result),
        )
      }

      return {
        canceled: result.canceled,
        ok: true,
        targetCount: result.targets.length,
        unlinkedTargetCount: result.unlinkedTargetCount,
        mode: result.mode.label,
        processedCount: result.processedCount,
        skippedCount: result.skippedCount,
      }
    } catch (error) {
      if (isAutomationCancellationError(error)) {
        addLog('info', 'Linking', 'MediaBridge stopped before linking began.')

        return { canceled: true, ok: true, processedCount: 0 }
      }

      addLog('error', 'Linking', getErrorMessage(error), getErrorDetail(error))
      throw error
    } finally {
      if (activeLinkingController === controller) {
        activeLinkingController = undefined
      }

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
