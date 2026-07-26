import { app, dialog } from 'electron'
import electronUpdater from 'electron-updater'
import { getErrorDetail, getErrorMessage } from './error-format.ts'

let lastUpdateDownloadLogPercent = 0

/**
 * @typedef {(level: 'info' | 'success' | 'error', scope: string, message: string, detail?: string) => void} AddLog
 */

/**
 * @param {AddLog} addLog
 */
export function configureAutoUpdater(addLog) {
  if (!app.isPackaged) {
    addLog('info', 'Updates', 'Skipping update check in development.')

    return
  }

  if (!shouldCheckForUpdates()) {
    addLog('info', 'Updates', 'Skipping update check outside Windows.')

    return
  }

  const autoUpdater = getAutoUpdater()

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    addLog('info', 'Updates', 'Checking for updates...')
  })

  autoUpdater.on('update-available', updateInfo => {
    lastUpdateDownloadLogPercent = 0
    addLog(
      'info',
      'Updates',
      `${formatUpdateVersion(updateInfo)} is available.`,
      'Downloading update in the background.',
    )
  })

  autoUpdater.on('update-not-available', updateInfo => {
    addLog('success', 'Updates', `${formatUpdateVersion(updateInfo)} is up to date.`)
  })

  autoUpdater.on('download-progress', progress => {
    const percent = Math.floor(progress.percent)

    if (percent < lastUpdateDownloadLogPercent + 25 && percent < 100) {
      return
    }

    lastUpdateDownloadLogPercent = percent
    addLog('info', 'Updates', `Downloading update: ${percent}%.`)
  })

  autoUpdater.on('update-downloaded', async updateInfo => {
    const version = formatUpdateVersion(updateInfo)

    addLog('success', 'Updates', `${version} is ready to install.`, 'Restart MediaBridge to complete the update.')

    const { response } = await dialog.showMessageBox({
      type: 'question',
      title: 'Update Ready',
      message: `${version} is ready to install.`,
      detail: 'Restart MediaBridge now?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })

    if (response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  autoUpdater.on('error', error => {
    addLog('error', 'Updates', getErrorMessage(error), getErrorDetail(error))
  })
}

/**
 * @param {AddLog} addLog
 */
export function checkForUpdates(addLog) {
  if (!shouldCheckForUpdates()) {
    return
  }

  getAutoUpdater()
    .checkForUpdates()
    .catch(error => {
      addLog('error', 'Updates', getErrorMessage(error), getErrorDetail(error))
    })
}

function getAutoUpdater() {
  return electronUpdater.autoUpdater
}

function formatUpdateVersion(updateInfo) {
  return updateInfo?.version ? `MediaBridge ${updateInfo.version}` : 'MediaBridge'
}

function shouldCheckForUpdates() {
  return app.isPackaged && process.platform === 'win32'
}
