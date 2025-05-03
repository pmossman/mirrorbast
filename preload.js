// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Invoke: Send a message and expect a result asynchronously
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  fetchMetadata: (url) => ipcRenderer.invoke('fetch-metadata', url),

  // Send: Send a message without expecting a direct reply (fire and forget)
  joinLobby: (url) => ipcRenderer.send('join-lobby', url),
  switchPlayer: () => ipcRenderer.send('switch-player'),
  resetApp: () => ipcRenderer.send('reset-phase'), // Renamed for clarity, maps to 'reset-phase' in main
  autoSetup: (p1Url, p2Url) => ipcRenderer.send('auto-setup', p1Url, p2Url),

  // On: Listen for messages initiated from the main process
  onLobbySuccess: (callback) => ipcRenderer.on('lobby-success', (event, ...args) => callback(...args)),
  onLobbyError: (callback) => ipcRenderer.on('lobby-error', (event, ...args) => callback(...args)),
  onResetSuccess: (callback) => ipcRenderer.on('reset-success', (event, ...args) => callback(...args)),
  onResetError: (callback) => ipcRenderer.on('reset-error', (event, ...args) => callback(...args)),
  onAutoSetupError: (callback) => ipcRenderer.on('auto-setup-error', (event, ...args) => callback(...args)),
  onTriggerSwitch: (callback) => ipcRenderer.on('trigger-switch', (event, ...args) => callback(...args)),
  // Removed onPreview listener registration

  // Off: Function to remove listeners (good practice for cleanup)
  // Note: These are generic functions; actual removal logic is in renderer.js
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

console.log('Preload script loaded (Preview functionality removed).');
