// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  switchPlayer: () => ipcRenderer.send('switch-player'),
  joinLobby:   () => ipcRenderer.send('join-lobby'),
});
