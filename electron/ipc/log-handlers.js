import { ipcMain } from 'electron'

/**
 * @param {{
 *   createLogsWindow: () => Promise<void>,
 *   logService: {
 *     add: (level: 'info' | 'success' | 'error', scope: string, message: string, detail?: string) => void,
 *     clear: () => void,
 *     getEntries: () => unknown[],
 *   },
 * }} dependencies
 */
export function registerLogHandlers({ createLogsWindow, logService }) {
  ipcMain.handle('logs:open', async () => {
    await createLogsWindow()

    return { ok: true }
  })

  ipcMain.handle('logs:get', () => logService.getEntries())

  ipcMain.handle('logs:clear', () => {
    logService.clear()

    return { ok: true }
  })

  ipcMain.handle('logs:write', (_event, level, scope, message, detail = '') => {
    logService.add(level, scope, message, detail)

    return { ok: true }
  })
}
