import { ipcMain } from 'electron'

/**
 * @typedef {(level: 'info' | 'success' | 'error', scope: string, message: string, detail?: string) => void} AddLog
 */

/**
 * @param {{
 *   addLog: AddLog,
 *   clearLogs: () => void,
 *   createLogsWindow: () => Promise<void>,
 *   getLogs: () => unknown[],
 * }} dependencies
 */
export function registerLogHandlers({ addLog, clearLogs, createLogsWindow, getLogs }) {
  ipcMain.handle('logs:open', async () => {
    await createLogsWindow()

    return { ok: true }
  })

  ipcMain.handle('logs:get', () => getLogs())

  ipcMain.handle('logs:clear', () => {
    clearLogs()

    return { ok: true }
  })

  ipcMain.handle('logs:write', (_event, level, scope, message, detail = '') => {
    addLog(level, scope, message, detail)

    return { ok: true }
  })
}
