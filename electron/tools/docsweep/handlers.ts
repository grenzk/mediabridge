import { ipcMain } from 'electron'
import { connectToBrowser } from '../../../src/shared/browser/connect-to-browser.ts'

type BrowserService = {
  getCdpUrl: () => string
}

type Dependencies = {
  addLog: (
    level: 'info' | 'success' | 'error',
    scope: string,
    message: string,
    detail?: string,
  ) => void
  browserService: BrowserService
}

export function registerDocSweepHandlers({
  addLog,
  browserService,
}: Dependencies) {
  ipcMain.handle('docsweep:run', async (_event, controlNumber: string) => {
    const value = controlNumber?.trim()

    if (!value) {
      throw new Error('Control number is required.')
    }

    const cdpUrl = browserService.getCdpUrl()

    addLog(
      'info',
      'DocSweep',
      `Starting sweep for ${value}.`,
    )

    const session = await connectToBrowser(cdpUrl)

    addLog(
      'info',
      'DocSweep',
      `Connected to browser with ${session.pages.length} page(s).`,
    )

    return {
      ok: true,
      status: `Browser connected. ${session.pages.length} page(s) available.`,
    }
  })
}