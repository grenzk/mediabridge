import { dialog, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { connectToBrowser } from '../../../src/shared/browser/connect-to-browser.ts'
import type { BrowserSession } from '../../../src/shared/browser/connect-to-browser.ts'
import { getErrorDetail, getErrorMessage } from '../../platform/error-format.ts'

type BrowserService = {
  getCdpUrl: () => string
}

type Dependencies = {
  addLog: (level: 'info' | 'success' | 'error', scope: string, message: string, detail?: string) => void
  browserService: BrowserService
}

async function getSession(browserService: BrowserService): Promise<BrowserSession> {
  const cdpUrl = browserService.getCdpUrl()

  return connectToBrowser(cdpUrl)
}

export function registerDocSweepHandlers({ addLog, browserService }: Dependencies) {
  ipcMain.handle('docsweep:select-excel-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: 'Excel Files',
          extensions: ['xlsx'],
        },
      ],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return {
        canceled: true,
        ok: false,
      }
    }

    return {
      canceled: false,
      ok: true,
      filePath: result.filePaths[0],
    }
  })

  ipcMain.handle('docsweep:open-site', async (_event: IpcMainInvokeEvent, url: string, matchUrl: string) => {
    let session: BrowserSession | undefined

    try {
      session = await getSession(browserService)

      const existingPage = session.context.pages().find(page => page.url().startsWith(matchUrl))

      if (existingPage) {
        await existingPage.bringToFront()

        return {
          ok: true,
        }
      }

      const page = await session.context.newPage()

      await page.goto(url)

      await page.bringToFront()

      return {
        ok: true,
      }
    } catch (error) {
      addLog('error', 'DocSweep', getErrorMessage(error), getErrorDetail(error))

      throw error
    }
  })

  ipcMain.handle('docsweep:run', async (_event, controlNumber: string) => {
    const value = controlNumber?.trim()

    if (!value) {
      throw new Error('Control number is required.')
    }

    const cdpUrl = browserService.getCdpUrl()

    addLog('info', 'DocSweep', `Starting sweep for ${value}.`)

    const session = await connectToBrowser(cdpUrl)

    addLog('info', 'DocSweep', `Connected to browser with ${session.pages.length} page(s).`)

    return {
      ok: true,
      status: `Browser connected. ${session.pages.length} page(s) available.`,
    }
  })
}
