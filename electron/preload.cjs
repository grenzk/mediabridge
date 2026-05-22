const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sessionjack', {
  closeToolbar: () => ipcRenderer.invoke('toolbar:close'),
  getLinkCount: () => ipcRenderer.invoke('session:get-link-count'),
  launchBrowser: () => ipcRenderer.invoke('session:launch-browser'),
  runMediaLinking: () => ipcRenderer.invoke('session:run-media-linking'),
})
