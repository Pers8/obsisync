
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('overlayAPI', {
  onNotify: (cb) => ipcRenderer.on('overlay:show', (_, payload) => cb(payload)),
});
