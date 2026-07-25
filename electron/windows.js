import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { getRuntimeIcon } from './runtime-icon.js'

/**
 * @param {BrowserWindow | undefined} window
 * @returns {BrowserWindow | undefined}
 */
function focusWindow(window) {
  if (!window || window.isDestroyed()) {
    return undefined
  }

  if (window.isMinimized()) {
    window.restore()
  }

  window.show()
  window.focus()

  return window
}

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
  const focusedWindow = focusWindow(existingWindow)

  if (focusedWindow) {
    return focusedWindow
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

/**
 * @param {{
 *   appRoot: string,
 *   devServerUrl?: string,
 *   electronDirectory: string,
 *   existingWindow?: BrowserWindow,
 *   onClosed: () => void,
 * }} options
 * @returns {Promise<BrowserWindow>}
 */
export async function createHubBrowserWindow({
  appRoot,
  devServerUrl,
  electronDirectory,
  existingWindow,
  onClosed,
}) {
  const focusedWindow = focusWindow(existingWindow)

  if (focusedWindow) {
    return focusedWindow
  }

  const hubWindow = new BrowserWindow({
    width: 460,
    height: 280,
    minWidth: 420,
    minHeight: 260,
    resizable: false,
    title: 'KnowledgeWorks',
    backgroundColor: '#111418',
    icon: getRuntimeIcon(appRoot),
    webPreferences: {
      preload: join(electronDirectory, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  hubWindow.once('closed', onClosed)

  if (devServerUrl) {
    await hubWindow.loadURL(`${devServerUrl}?view=hub`)
  } else {
    await hubWindow.loadFile(join(electronDirectory, '../dist/renderer/index.html'), {
      query: { view: 'hub' },
    })
  }

  return hubWindow
}
