const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  storeGet: (k) => ipcRenderer.invoke('store:get', k),
  storeSet: (k, v) => ipcRenderer.invoke('store:set', k, v),
  vaultSync: (id) => ipcRenderer.invoke('vault:sync', id),
  togglePaused: () => ipcRenderer.invoke('paused:toggle'),
  onActivity: (cb) => ipcRenderer.on('vault:activity', (_, payload) => cb(payload)),
  openPath: (id) => ipcRenderer.invoke('vault:openPath', id),

  getVaultStats: (id) => ipcRenderer.invoke('vault:getStats', id),
  countVaultFiles: (p) => ipcRenderer.invoke('vault:countFiles', p),

  onSyncState: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('vault:sync-state', handler);
    return () => ipcRenderer.off('vault:sync-state', handler);
  },
  getSyncState: () => ipcRenderer.invoke('sync:state'),

  // Git log wiring
  onGitEntry: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('vault:git-entry', handler);
    return () => ipcRenderer.off('vault:git-entry', handler);
  },
  gitGetLog: (id, limit = 500) => ipcRenderer.invoke('git:getLog', id, limit),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('win:minimize'),
  closeWindow: () => ipcRenderer.invoke('win:close'),
  
  // NEW: Open external URLs
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});