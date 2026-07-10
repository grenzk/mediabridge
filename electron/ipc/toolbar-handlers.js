import { ipcMain } from 'electron'

/**
 * @param {{
 *   closeToolbar: () => void,
 *   minimizeToolbar: () => void,
 * }} dependencies
 */
export function registerToolbarHandlers({ closeToolbar, minimizeToolbar }) {
  ipcMain.handle('toolbar:close', () => {
    closeToolbar()
  })

  ipcMain.handle('toolbar:minimize', () => {
    minimizeToolbar()
  })
}
