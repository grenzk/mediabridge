import { ipcMain } from 'electron'

const supportedTools = new Set(['articleflow', 'mediabridge', 'docsweep'])

/**
 * @param {{
 *   getAppVersion: () => string,
 *   openTool: (tool: string) => Promise<void>,
 * }} dependencies
 */
export function registerAppHandlers({ getAppVersion, openTool }) {
  ipcMain.handle('app:get-version', () => getAppVersion())

  ipcMain.handle('app:open-tool', async (_event, tool) => {
    if (!supportedTools.has(tool)) {
      throw new Error(`Unsupported KnowledgeWorks tool: ${tool}`)
    }

    await openTool(tool)

    return { ok: true }
  })
}
