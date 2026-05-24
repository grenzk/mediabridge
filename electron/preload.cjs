const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sessionjack', {
  closeToolbar: () => ipcRenderer.invoke('toolbar:close'),
  getLinkCount: mode => ipcRenderer.invoke('session:get-link-count', mode),
  launchBrowser: () => ipcRenderer.invoke('session:launch-browser'),
  runMediaLinking: mode => ipcRenderer.invoke('session:run-media-linking', mode),
})
