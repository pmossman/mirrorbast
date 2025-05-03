// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Invoke
  readClipboard: () => ipcRenderer.invoke("read-clipboard"),
  fetchMetadata: (url) => ipcRenderer.invoke("fetch-metadata", url),

  // Send
  switchPlayer: () => ipcRenderer.send("switch-player"),
  resetApp: () => ipcRenderer.send("reset-phase"),
  autoSetup: (p1Url, p2Url) => ipcRenderer.send("auto-setup", p1Url, p2Url),
  sidebarStateChanged: (isCollapsed) =>
    ipcRenderer.send("sidebar-state-change", isCollapsed),
  setGameViewsVisibility: (visible) =>
    ipcRenderer.send("set-game-views-visibility", visible),
  // *** NEW: Toggle Spacebar Shortcut ***
  toggleSpacebarShortcut: (enabled) =>
    ipcRenderer.send("toggle-spacebar-shortcut", enabled),
  // *** NEW: Open External URL ***
  openExternalUrl: (url) => ipcRenderer.send("open-external-url", url),


  // On
  onLobbySuccess: (callback) =>
    ipcRenderer.on("lobby-success", (event, ...args) => callback(...args)),
  onResetSuccess: (callback) =>
    ipcRenderer.on("reset-success", (event, ...args) => callback(...args)),
  onResetError: (callback) =>
    ipcRenderer.on("reset-error", (event, ...args) => callback(...args)),
  onAutoSetupError: (callback) =>
    ipcRenderer.on("auto-setup-error", (event, ...args) => callback(...args)),
  onTriggerSwitch: (callback) =>
    ipcRenderer.on("trigger-switch", (event, ...args) => callback(...args)),
  onSetSidebarCollapsed: (callback) =>
    ipcRenderer.on("set-sidebar-collapsed", (e, isCollapsed) =>
      callback(isCollapsed)
    ),
  onCollapseSidebarRequest: (callback) =>
    ipcRenderer.on("collapse-sidebar", (event, ...args) => callback(...args)),

  // Off
  removeListener: (channel, callback) =>
    ipcRenderer.removeListener(channel, callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

console.log("Preload script loaded (with shortcut toggle and open URL).");

