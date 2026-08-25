import { dialog, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { connectToBrowser } from '../../../src/shared/browser/connect-to-browser.ts'
import type { BrowserSession } from '../../../src/shared/browser/connect-to-browser.ts'
import { getErrorDetail, getErrorMessage } from '../../platform/error-format.ts'
import { verifySites, type DocSweepSiteName } from '../../../src/tools/docsweep/automation/verification.ts'
import { loadExcelFile } from '../../../src/tools/docsweep/automation/excel-reader.ts'
import { sweepVertiv } from '../../../src/tools/docsweep/automation/vertiv.ts'

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

  ipcMain.handle('docsweep:load-excel', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      addLog('info', 'DocSweep', `Loading Excel file: ${filePath}`)

      const result = await loadExcelFile(filePath)

      addLog('success', 'DocSweep', `Loaded ${result.documents.length} control number(s) from "${result.sheetName}".`)

      return {
        ok: true,
        sheetName: result.sheetName,
        documents: result.documents,
      }
    } catch (error) {
      addLog('error', 'DocSweep', `Failed to load Excel file: ${getErrorMessage(error)}`, getErrorDetail(error))

      return {
        ok: false,
        sheetName: '',
        documents: [],
        error: getErrorMessage(error),
      }
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

  ipcMain.handle('docsweep:verify-sites', async (_event: IpcMainInvokeEvent, includedSites: DocSweepSiteName[]) => {
    let session: BrowserSession | undefined

    try {
      addLog('info', 'DocSweep', `Verifying ${includedSites.length} included site(s).`)

      session = await getSession(browserService)

      const results = await verifySites(session.pages, includedSites)

      for (const result of results) {
        if (result.status === 'Ready') {
          addLog('success', 'DocSweep', `${result.name} is ready.`)

          continue
        }

        addLog(
          result.status === 'Error' ? 'error' : 'info',
          'DocSweep',
          `${result.name}: ${result.reason ?? 'Site is not ready.'}`,
        )
      }

      const readyCount = results.filter(result => result.status === 'Ready').length

      addLog('info', 'DocSweep', `${readyCount} of ${results.length} included site(s) are ready.`)

      return {
        ok: true,
        results,
      }
    } catch (error) {
      addLog('error', 'DocSweep', getErrorMessage(error), getErrorDetail(error))

      return {
        ok: false,
        results: [],
        error: getErrorMessage(error),
      }
    } finally {
      // Do not close the browser.
      // This is the existing controlled browser.
      session = undefined
    }
  })

  ipcMain.handle('docsweep:run', async (_event: IpcMainInvokeEvent, controlNumber: string) => {
    const value = controlNumber?.trim()

    if (!value) {
      throw new Error('Control number is required.')
    }

    try {
      addLog('info', 'DocSweep', `Starting Vertiv sweep for ${value}.`)

      const session = await getSession(browserService)

      const result = await sweepVertiv(session.pages, value)

      if (result.status === 'Found') {
        addLog('success', 'DocSweep', `Vertiv: ${value} found.`)
      } else if (result.status === 'Not Found') {
        addLog('info', 'DocSweep', `Vertiv: ${value} not found.`)
      } else {
        addLog('error', 'DocSweep', `Vertiv: ${value}: ${result.message}`)
      }

      return {
        ok: result.status !== 'Error',
        status: result.status,
        message: result.message,
      }
    } catch (error) {
      addLog('error', 'DocSweep', `Vertiv sweep failed for ${value}: ${getErrorMessage(error)}`, getErrorDetail(error))

      return {
        ok: false,
        status: 'Error',
        message: getErrorMessage(error),
      }
    }
  })
}
