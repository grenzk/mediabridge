import { app, nativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @param {string} appRoot
 * @returns {string}
 */
function getRuntimeIconPath(appRoot) {
  const filename = process.platform === 'darwin' ? 'icon.icns' : 'icon.ico'

  return app.isPackaged ? join(process.resourcesPath, filename) : join(appRoot, 'build/icons', filename)
}

/**
 * @param {string} appRoot
 * @returns {import('electron').NativeImage | undefined}
 */
export function getRuntimeIcon(appRoot) {
  const runtimeIconPath = getRuntimeIconPath(appRoot)

  if (!existsSync(runtimeIconPath)) {
    return undefined
  }

  const icon = nativeImage.createFromPath(runtimeIconPath)

  return icon.isEmpty() ? undefined : icon
}

/**
 * @param {string} appRoot
 */
export function configureDockIcon(appRoot) {
  if (process.platform !== 'darwin') {
    return
  }

  const icon = getRuntimeIcon(appRoot)

  if (icon) {
    app.dock.setIcon(icon)
  }

  app.dock.show()
}
