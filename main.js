// main.js
const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  clipboard,
  globalShortcut,
  shell,
} = require("electron");
const path = require("path");
const fetch = require("node-fetch");

const { performAutoSetup } = require("./auto-setup");
const { delay } = require("./auto-setup-utils");

// Constants for layout
const DEFAULT_SIDEBAR_WIDTH = 300;
const COLLAPSED_SIDEBAR_WIDTH = 0;
const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 50;
const BORDER_WIDTH = 3;

const PLACEHOLDER_HTML_DATA_URI = `data:text/html;charset=UTF-8,${encodeURIComponent(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Waiting</title>
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background-color: #1a1a1a; color: #cccccc; font-family: 'Barlow', sans-serif; font-size: 1.2em; text-align: center; overflow: hidden; }
        .container { padding: 20px; }
        .spinner { border: 4px solid rgba(204, 204, 204, 0.3); border-radius: 50%; border-top-color: #cccccc; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        Waiting for Player 1 to finish setup...
    </div>
</body>
</html>
`)}`;

// Keep track of the main window and the two browser views
let mainWindow;
let view1, view2;
let currentView = 1;
let currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
let gameViewsVisible = true;
let isSpacebarShortcutGloballyEnabled = true;
let allowPlayerSwitch = false; // Single flag to control switching

/** Safely gets main window webContents if available */
function getMainWindowWebContents() {
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.webContents &&
    !mainWindow.webContents.isDestroyed()
  ) {
    return mainWindow.webContents;
  }
  return null;
}

/** Updates the renderer UI based on the allowPlayerSwitch state */
function updateRendererSwitchState(allowed) {
    const wc = getMainWindowWebContents();
    if (wc) {
        // console.log(`Sending set-switching-allowed: ${allowed}`);
        wc.send("set-switching-allowed", allowed);
    }
}

/** Creates the main application window and sets up BrowserViews. */
function createWindow() {
  currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
  gameViewsVisible = true;
  isSpacebarShortcutGloballyEnabled = true;
  allowPlayerSwitch = false; // Initialize as false
  currentView = 1;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, "icon.png"),
  });

  mainWindow.on("page-title-updated", (event) => event.preventDefault());
  mainWindow.setTitle("Mirrorbast");
  mainWindow.loadFile("index.html");

  view1 = new BrowserView({
    webPreferences: {
      partition: "persist:player1",
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });
  view2 = new BrowserView({
    webPreferences: {
      partition: "persist:player2",
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.addBrowserView(view1);
  mainWindow.addBrowserView(view2);
  mainWindow.setBrowserView(view1);
  setCurrentView(1);

  console.log("Loading initial URL for View 1...");
  view1.webContents
    .loadURL("https://karabast.net")
    .catch((err) => console.error("Error initiating load for View 1:", err));

  console.log("Loading placeholder URL for View 2...");
  view2.webContents
    .loadURL(PLACEHOLDER_HTML_DATA_URI)
    .catch((err) =>
      console.error("Error initiating load for View 2 placeholder:", err)
    );

  setTimeout(() => {
    const wc = getMainWindowWebContents();
    if (wc) {
      if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
      if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
      wc.send("player-switched", currentView);
      updateRendererSwitchState(allowPlayerSwitch); // Send initial state
    }
  }, 150);

  view1.webContents.on("console-message", (e, level, message) => console.log("[VIEW1]", message));
  view2.webContents.on("console-message", (e, level, message) => console.log("[VIEW2]", message));

  mainWindow.on("resize", () => {
    if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
    if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    allowPlayerSwitch = false; // Reset on close
  });
}

/** Registers the Spacebar global shortcut IF it's globally enabled. */
function registerSpaceShortcut() {
  if (!isSpacebarShortcutGloballyEnabled) return;
  if (!globalShortcut.isRegistered("Space")) {
    const ret = globalShortcut.register("Space", () => {
      if (!allowPlayerSwitch) {
        console.log("[Main] Spacebar pressed, but switching disallowed.");
        return;
      }

      const wc = getMainWindowWebContents();
      if (wc) {
        if (gameViewsVisible) {
          wc.send("trigger-switch");
        }
      } else {
        unregisterSpaceShortcut();
      }
    });
    if (!ret) console.error("Failed to register Spacebar shortcut.");
  }
}

/** Unregisters the Spacebar global shortcut. */
function unregisterSpaceShortcut() {
  if (globalShortcut.isRegistered("Space")) globalShortcut.unregister("Space");
}

/** Resizes and positions the given BrowserView within the main window, accounting for border. */
function resizeView(view) {
    if (!mainWindow || !view?.webContents || view.webContents.isDestroyed()) return;
    if (!gameViewsVisible) {
        try {
        if (!view.webContents.isDestroyed()) view.setBounds({ x: 0, y: HEADER_HEIGHT, width: 0, height: 0 });
        } catch (error) { if (!error.message.includes("destroyed")) console.error("Error setting hidden bounds:", error); }
        return;
    }
    try {
        const [windowWidth, windowHeight] = mainWindow.getContentSize();
        const contentAreaX = currentSidebarWidth <= COLLAPSED_SIDEBAR_WIDTH ? 0 : currentSidebarWidth;
        const contentAreaY = HEADER_HEIGHT;
        const contentAreaWidth = Math.max(1, windowWidth - contentAreaX);
        const contentAreaHeight = Math.max(1, windowHeight - contentAreaY - FOOTER_HEIGHT);
        const viewX = contentAreaX + BORDER_WIDTH;
        const viewY = contentAreaY + BORDER_WIDTH;
        const viewWidth = Math.max(1, contentAreaWidth - 2 * BORDER_WIDTH);
        const viewHeight = Math.max(1, contentAreaHeight - 2 * BORDER_WIDTH);
        if (viewWidth <= 1 || viewHeight <= 1) return;
        if (!view.webContents.isDestroyed()) view.setBounds({ x: viewX, y: viewY, width: viewWidth, height: viewHeight });
    } catch (error) { if (!error.message.includes("destroyed")) console.error("Error resizing view:", error); }
}

/** Updates the current active view state variable. */
function setCurrentView(viewNum) {
    if (viewNum === 1 || viewNum === 2) { currentView = viewNum; }
    else { console.error(`Invalid view number passed to setCurrentView: ${viewNum}`); }
}

/** Function to reset progress bar state and notify renderer */
function resetAndHideProgress() {
    const wc = getMainWindowWebContents();
    if (wc) { wc.send("hide-spinner"); }
}

// --- IPC Handlers ---

ipcMain.handle("read-clipboard", () => clipboard.readText());

ipcMain.handle("fetch-metadata", async (_, url) => {
    if (typeof fetch !== "function") return { name: "Setup Error", author: "N/A" };
    try {
        if (!url || !(url.startsWith("http://") || url.startsWith("https://"))) throw new Error("Invalid URL");
        const response = await fetch(`https://karabast.net/api/swudbdeck?deckLink=${encodeURIComponent(url)}`, { method: "GET", headers: { Accept: "application/json", "User-Agent": "Mirrorbast/1.0" }, timeout: 15000 });
        if (!response.ok) { const errorBody = await response.text().catch(() => ""); throw new Error(`API request failed: ${response.status} Body: ${errorBody}`); }
        const data = await response.json();
        if (data?.metadata?.name !== undefined) { return { name: data.metadata.name || "Unnamed", author: data.metadata.author || "Unknown" }; }
        else { return { name: "Invalid Metadata", author: "N/A" }; }
    } catch (error) { console.error(`Fetch metadata error for ${url}:`, error); return { name: error.name || "Fetch Error", author: "N/A" }; }
});

ipcMain.on("switch-player", async () => {
  if (!allowPlayerSwitch) {
    console.log("Switch player ignored: Switching disallowed.");
    return;
  }

  if (!gameViewsVisible)
    return console.log("Switch player ignored: Game views not visible.");

  const nextViewNum = currentView === 1 ? 2 : 1;
  console.log(`Switching player from ${currentView} to ${nextViewNum}`);
  const activeView = nextViewNum === 1 ? view1 : view2;
  const inactiveView = nextViewNum === 1 ? view2 : view1;
  if (
    mainWindow && !mainWindow.isDestroyed() &&
    activeView?.webContents && !activeView.webContents.isDestroyed()
  ) {
    setCurrentView(nextViewNum);

    try {
        mainWindow.removeBrowserView(activeView);
        if (inactiveView && !inactiveView.webContents.isDestroyed()) mainWindow.setBrowserView(inactiveView);
        await delay(30);
        mainWindow.addBrowserView(activeView)
        mainWindow.setBrowserView(activeView);
        resizeView(activeView);
        activeView.webContents.focus();
    } catch(error) {
         console.error(`Error during remove/add view hack:`, error);
         if (mainWindow && !mainWindow.isDestroyed() && activeView && !activeView.webContents.isDestroyed()) {
            mainWindow.setBrowserView(activeView);
            resizeView(activeView);
            activeView.webContents.focus();
         }
    }

    const wc = getMainWindowWebContents();
    if (wc) {
      wc.send("player-switched", nextViewNum);
    }
  } else {
    console.error(`Cannot switch player: View ${nextViewNum} invalid.`);
  }
});

ipcMain.on("reset-phase", (event) => {
  console.log("Resetting application views...");
  allowPlayerSwitch = false; // Disallow switching on reset
  resetAndHideProgress();
  updateRendererSwitchState(false); // Notify renderer

  if (!gameViewsVisible) {
    gameViewsVisible = true;
    if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
    if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
  }
  let view1Loaded = false, view2Loaded = false, errors = [];
  const checkCompletion = () => {
    if (!view1Loaded || !view2Loaded) return;
    if (errors.length === 0) {
      console.log("Views reloaded successfully after reset.");
      setCurrentView(1);
      if (mainWindow) {
        currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
        gameViewsVisible = true;
        mainWindow.setBrowserView(view1);
        if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
        if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
        const wc = getMainWindowWebContents();
        if (wc) {
          wc.send("set-sidebar-collapsed", false);
          wc.send("player-switched", 1);
        }
      }
      event.reply("reset-success");
    } else {
      console.error("Reset error (view reloads):", errors.join("; "));
      if (mainWindow && view1?.webContents && !view1.webContents.isDestroyed() && !errors.some((e) => e.includes("V1"))) {
        setCurrentView(1);
        currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
        gameViewsVisible = true;
        mainWindow.setBrowserView(view1);
        if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
        if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
        const wc = getMainWindowWebContents();
        if (wc) {
          wc.send("set-sidebar-collapsed", false);
          wc.send("player-switched", 1);
        }
      }
      event.reply("reset-error", `Failed view reload: ${errors.join("; ")}`);
    }
  };
  if (view1?.webContents && !view1.webContents.isDestroyed()) {
    view1.webContents.loadURL("https://karabast.net").then(() => { view1Loaded = true; }).catch((err) => { errors.push("V1:" + err.message); view1Loaded = true; }).finally(checkCompletion);
  } else { errors.push("V1 unavailable"); view1Loaded = true; checkCompletion(); }
  if (view2?.webContents && !view2.webContents.isDestroyed()) {
    view2.webContents.loadURL(PLACEHOLDER_HTML_DATA_URI).then(() => { view2Loaded = true; }).catch((err) => { errors.push("V2 Placeholder:" + err.message); view2Loaded = true; }).finally(checkCompletion);
  } else { errors.push("V2 unavailable"); view2Loaded = true; checkCompletion(); }
});

// --- Auto Setup Handler ---
ipcMain.on("auto-setup", async (event, p1Url, p2Url) => {
  let setupSucceeded = false; // Track success locally
  console.log("Received 'auto-setup' request.");
  allowPlayerSwitch = false; // Disallow switching during setup
  updateRendererSwitchState(false); // Notify renderer

  if (currentView !== 1) {
    console.log("Auto-setup initiated: Switching to Player 1 view first.");
    const targetView = view1;
    if (mainWindow && targetView?.webContents && !targetView.webContents.isDestroyed()) {
      setCurrentView(1);
      mainWindow.setBrowserView(targetView);
      resizeView(targetView);
      if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
      const wc = getMainWindowWebContents();
      if (wc) { wc.send("player-switched", 1); }
      await delay(200);
      console.log("Switched to Player 1 view.");
    } else {
      console.error("Cannot switch to Player 1 view before auto-setup.");
      event.reply("auto-setup-error", "Cannot switch to Player 1 view.");
      updateRendererSwitchState(allowPlayerSwitch); // Send final (false) state
      return;
    }
  } else {
    console.log("Player 1 already active for auto-setup.");
  }

  if (!gameViewsVisible) {
    console.log("Making game views visible before auto-setup.");
    gameViewsVisible = true;
    if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
    if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
    await delay(100);
  }

  if (currentSidebarWidth <= COLLAPSED_SIDEBAR_WIDTH) {
    console.log("Ensuring sidebar expanded before auto-setup.");
    currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
    if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
    if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
    const wc = getMainWindowWebContents();
    if (wc) { wc.send("set-sidebar-collapsed", false); }
    await delay(200);
  }

  const appContext = {
    view1, view2, mainWindow, clipboard,
    setCurrentView, resizeView, getCurrentView: () => currentView,
  };

  try {
    await performAutoSetup(event, p1Url, p2Url, appContext);
    // If performAutoSetup completes without error, it means it sent 'lobby-success'
    console.log("performAutoSetup completed successfully.");
    setupSucceeded = true; // Mark as success
  } catch (error) {
    console.error("Error during performAutoSetup orchestration:", error);
    // Error reply is handled within performAutoSetup
    // setupSucceeded remains false
  } finally {
    console.log("Auto-setup finished.");
    resetAndHideProgress();
    // Set the final state based on whether setup succeeded
    allowPlayerSwitch = setupSucceeded;
    updateRendererSwitchState(allowPlayerSwitch);
  }
});

// --- Sidebar State Handler ---
ipcMain.on("sidebar-state-change", (event, isCollapsed) => {
  currentSidebarWidth = isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : DEFAULT_SIDEBAR_WIDTH;
  if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
  if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
});

// --- Game View Visibility Handler ---
ipcMain.on("set-game-views-visibility", (event, visible) => {
  if (gameViewsVisible === visible) return;
  gameViewsVisible = visible;
  if (visible) {
    if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
    if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
    const activeView = currentView === 1 ? view1 : view2;
    if (mainWindow && activeView && !activeView.webContents.isDestroyed()) mainWindow.setBrowserView(activeView);
  } else {
    try {
      if (view1 && !view1.webContents.isDestroyed()) view1.setBounds({ x: 0, y: HEADER_HEIGHT, width: 0, height: 0 });
      if (view2 && !view2.webContents.isDestroyed()) view2.setBounds({ x: 0, y: HEADER_HEIGHT, width: 0, height: 0 });
    } catch (error) { console.error("Error setting zero bounds:", error); }
  }
});

// --- Spacebar Shortcut Toggle Handler ---
ipcMain.on("toggle-spacebar-shortcut", (event, enabled) => {
  isSpacebarShortcutGloballyEnabled = enabled;
  if (mainWindow?.isFocused()) {
    if (enabled) registerSpaceShortcut();
    else unregisterSpaceShortcut();
  }
});

// --- External URL Handler ---
ipcMain.on("open-external-url", (event, url) => {
  if (url && (url.startsWith("http:") || url.startsWith("https:"))) {
    shell.openExternal(url).catch((err) => console.error(`Failed to open external URL "${url}":`, err));
  } else { console.warn(`Attempted to open invalid external URL: ${url}`); }
});


// --- Electron App Lifecycle ---
app.whenReady().then(() => {
  createWindow();
  registerSpaceShortcut(); // Initial registration attempt
});
app.on("browser-window-focus", () => {
  if (isSpacebarShortcutGloballyEnabled) registerSpaceShortcut();
  else unregisterSpaceShortcut();
});
app.on("browser-window-blur", () => { unregisterSpaceShortcut(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  if (isSpacebarShortcutGloballyEnabled) registerSpaceShortcut();
});
app.on("will-quit", () => { unregisterSpaceShortcut(); allowPlayerSwitch = false; });
app.on("gpu-process-crashed", (event, killed) => console.error(`GPU crash! Killed: ${killed}`));
app.on("renderer-process-crashed", (event, webContents, killed) => {
  console.error(`Renderer crash! URL: ${webContents?.getURL()}, Killed: ${killed}`);
  const viewId = webContents?.id;
  let viewName = "Unknown";
  if (viewId) {
    if (view1?.webContents.id === viewId) viewName = "View 1";
    else if (view2?.webContents.id === viewId) viewName = "View 2";
    else if (mainWindow?.webContents.id === viewId) viewName = "Main Window";
  }
  console.error(`${viewName} renderer crashed.`);
  allowPlayerSwitch = false; // Reset state on crash
  updateRendererSwitchState(false); // Notify renderer
});
