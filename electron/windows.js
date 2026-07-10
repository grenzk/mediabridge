import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { getRuntimeIcon } from './runtime-icon.js'

/**
 * @param {{
 *   appRoot: string,
 *   devServerUrl?: string,
 *   electronDirectory: string,
 *   focusToolbarWindow: () => void,
 *   shouldFocusOnReady: boolean,
 * }} options
 * @returns {Promise<BrowserWindow>}
 */
export async function createToolbarBrowserWindow({
  appRoot,
  devServerUrl,
  electronDirectory,
  focusToolbarWindow,
  shouldFocusOnReady,
}) {
  const toolbarWindow = new BrowserWindow({
    width: 620,
    height: 116,
    minWidth: 520,
    minHeight: 108,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: 'MediaBridge',
    icon: getRuntimeIcon(appRoot),
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: join(electronDirectory, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.platform === 'darwin') {
    toolbarWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    })
  }

  if (devServerUrl) {
    await toolbarWindow.loadURL(devServerUrl)
  } else {
    await toolbarWindow.loadFile(join(electronDirectory, '../dist/renderer/index.html'))
  }

  if (shouldFocusOnReady) {
    focusToolbarWindow()
  }

  return toolbarWindow
}

/**
 * @param {{
 *   devServerUrl?: string,
 *   electronDirectory: string,
 *   existingWindow?: BrowserWindow,
 *   onClosed: () => void,
 * }} options
 * @returns {Promise<BrowserWindow>}
 */
export async function createLogsBrowserWindow({ devServerUrl, electronDirectory, existingWindow, onClosed }) {
  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.show()
    existingWindow.focus()

    return existingWindow
  }

  const logsWindow = new BrowserWindow({
    width: 760,
    height: 460,
    minWidth: 560,
    minHeight: 340,
    title: 'MediaBridge Logs',
    backgroundColor: '#080b10',
    webPreferences: {
      preload: join(electronDirectory, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  logsWindow.once('closed', onClosed)

  if (devServerUrl) {
    await logsWindow.loadURL(`${devServerUrl}?view=logs`)
  } else {
    await logsWindow.loadFile(join(electronDirectory, '../dist/renderer/index.html'), {
      query: { view: 'logs' },
    })
  }

  return logsWindow
}
