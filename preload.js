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
  toggleSpacebarShortcut: (enabled) =>
    ipcRenderer.send("toggle-spacebar-shortcut", enabled),
  openExternalUrl: (url) => ipcRenderer.send("open-external-url", url),
  // Removed start/end progress signals

  // On
  onLobbySuccess: (callback) =>
    ipcRenderer.on("lobby-success", (event, ...args) => callback(...args)),
  onResetSuccess: (callback) =>
    ipcRenderer.on("reset-success", (event, ...args) => callback(...args)),
  onResetError: (callback) =>
    ipcRenderer.on("reset-error", (event, ...args) => callback(...args)),
  onAutoSetupError: (callback) =>
    ipcRenderer.on("auto-setup-error", (event, ...args) => callback(...args)),
  onTriggerSwitch: (
    callback // Used by main process for spacebar
  ) => ipcRenderer.on("trigger-switch", (event, ...args) => callback(...args)),
  onPlayerSwitched: (callback) =>
    ipcRenderer.on("player-switched", (event, playerNum) =>
      callback(playerNum)
    ),
  onSetSidebarCollapsed: (callback) =>
    ipcRenderer.on("set-sidebar-collapsed", (e, isCollapsed) =>
      callback(isCollapsed)
    ),
  onCollapseSidebarRequest: (callback) =>
    ipcRenderer.on("collapse-sidebar", (event, ...args) => callback(...args)),
  // *** Renamed Spinner Listeners ***
  onShowSpinner: (callback) =>
    ipcRenderer.on("show-spinner", (event) => callback()),
  onHideSpinner: (callback) =>
    ipcRenderer.on("hide-spinner", (event) => callback()),

  // Off
  removeListener: (channel, callback) =>
    ipcRenderer.removeListener(channel, callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

console.log("Preload script loaded (with spinner channels).");
