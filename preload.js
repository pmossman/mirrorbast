const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  fetchMetadata: (url) => ipcRenderer.invoke('fetch-metadata', url),
  joinLobby: (url) => ipcRenderer.send('join-lobby', url),
  onLobbySuccess: (cb) => ipcRenderer.on('lobby-success', cb),
  onLobbyError: (cb) => ipcRenderer.on('lobby-error', (_e, msg) => cb(msg)),
  switchPlayer: () => ipcRenderer.send('switch-player'),
  onTriggerSwitch: (cb) => ipcRenderer.on('trigger-switch', cb),
  resetPhase: () => ipcRenderer.send('reset-phase'),
  onResetSuccess: (cb) => ipcRenderer.on('reset-success', cb),
  onPreview: (cb) => ipcRenderer.on('preview-updated', (_e, dataUrl) => cb(dataUrl)),
});