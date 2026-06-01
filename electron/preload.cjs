const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mediabridge', {
  clearLogs: () => ipcRenderer.invoke('logs:clear'),
  closeToolbar: () => ipcRenderer.invoke('toolbar:close'),
  getLinkCount: mode => ipcRenderer.invoke('session:get-link-count', mode),
  getLogs: () => ipcRenderer.invoke('logs:get'),
  launchBrowser: () => ipcRenderer.invoke('session:launch-browser'),
  minimizeToolbar: () => ipcRenderer.invoke('toolbar:minimize'),
  onLogsUpdated: callback => {
    const listener = (_event, logs) => callback(logs)

    ipcRenderer.on('logs:updated', listener)

    return () => ipcRenderer.removeListener('logs:updated', listener)
  },
  openLogs: () => ipcRenderer.invoke('logs:open'),
  runMediaLinking: mode => ipcRenderer.invoke('session:run-media-linking', mode),
  writeLog: (level, scope, message, detail) =>
    ipcRenderer.invoke('logs:write', level, scope, message, detail),
})
