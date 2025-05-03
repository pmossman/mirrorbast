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

const { performAutoSetup, AbortError } = require("./auto-setup");
const { delay } = require("./auto-setup-utils"); // Only need basic delay here now

// Constants for layout
const DEFAULT_SIDEBAR_WIDTH = 300;
const COLLAPSED_SIDEBAR_WIDTH = 0;
const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 50;
const BORDER_WIDTH = 3;

// Keep track of the main window and the two browser views
let mainWindow;
let view1, view2;
let currentView = 1;
let currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
let gameViewsVisible = true;
let isSpacebarShortcutGloballyEnabled = true;
let currentAbortController = null;

// State for Progress Bar Management
let activeDelayCounter = 0;
let currentActiveDelayType = null;

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

/** Creates the main application window and sets up BrowserViews. */
function createWindow() {
  currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
  gameViewsVisible = true;
  isSpacebarShortcutGloballyEnabled = true;
  currentAbortController = null;
  activeDelayCounter = 0;
  currentActiveDelayType = null;

  mainWindow = new BrowserWindow({
    /* ... browser window options ... */ width: 1200,
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
  console.log("Loading initial URL for View 2...");
  view2.webContents
    .loadURL("https://karabast.net")
    .catch((err) => console.error("Error initiating load for View 2:", err));

  setTimeout(() => {
    const wc = getMainWindowWebContents();
    if (wc) {
      if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
      if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
      wc.send("player-switched", currentView);
    }
  }, 150);

  // DevTools & Logging
  // view1.webContents.openDevTools({ mode: 'detach' });
  view1.webContents.on("console-message", (e, level, message) =>
    console.log("[VIEW1]", message)
  );
  // view2.webContents.openDevTools({ mode: 'detach' });
  view2.webContents.on("console-message", (e, level, message) =>
    console.log("[VIEW2]", message)
  );

  // Window Event Handling
  mainWindow.on("resize", () => {
    if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
    if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
  });
  mainWindow.on("closed", () => {
    if (currentAbortController) currentAbortController.abort();
    mainWindow = null;
  });
}

/** Registers the Spacebar global shortcut IF it's globally enabled. */
function registerSpaceShortcut() {
  if (!isSpacebarShortcutGloballyEnabled) return;
  if (!globalShortcut.isRegistered("Space")) {
    const ret = globalShortcut.register("Space", () => {
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
  if (!mainWindow || !view?.webContents || view.webContents.isDestroyed())
    return;
  if (!gameViewsVisible) {
    try {
      view.setBounds({ x: 0, y: HEADER_HEIGHT, width: 0, height: 0 });
    } catch (error) {
      if (!error.message.includes("destroyed"))
        console.error("Error setting hidden bounds:", error);
    }
    return;
  }
  try {
    const [windowWidth, windowHeight] = mainWindow.getContentSize();
    const contentAreaX =
      currentSidebarWidth <= COLLAPSED_SIDEBAR_WIDTH ? 0 : currentSidebarWidth;
    const contentAreaY = HEADER_HEIGHT;
    const contentAreaWidth = Math.max(1, windowWidth - contentAreaX);
    const contentAreaHeight = Math.max(
      1,
      windowHeight - contentAreaY - FOOTER_HEIGHT
    );
    const viewX = contentAreaX + BORDER_WIDTH;
    const viewY = contentAreaY + BORDER_WIDTH;
    const viewWidth = Math.max(1, contentAreaWidth - 2 * BORDER_WIDTH);
    const viewHeight = Math.max(1, contentAreaHeight - 2 * BORDER_WIDTH);
    if (viewWidth <= 1 || viewHeight <= 1) return;
    view.setBounds({
      x: viewX,
      y: viewY,
      width: viewWidth,
      height: viewHeight,
    });
  } catch (error) {
    if (!error.message.includes("destroyed"))
      console.error("Error resizing view:", error);
  }
}

/** Updates the current active view state variable. */
function setCurrentView(viewNum) {
  if (viewNum === 1 || viewNum === 2) {
    currentView = viewNum;
  } else {
    console.error(`Invalid view number passed to setCurrentView: ${viewNum}`);
  }
}

/** Function to reset progress bar state and notify renderer */
function resetAndHideProgress() {
  if (activeDelayCounter > 0 || currentActiveDelayType !== null) {
    console.log(
      `[Main] Resetting progress bar state. Counter was ${activeDelayCounter}.`
    );
    activeDelayCounter = 0;
    currentActiveDelayType = null;
    const wc = getMainWindowWebContents();
    if (wc) {
      console.log("[Main] Sending hide-progress to renderer during reset.");
      wc.send("hide-progress");
    }
  }
}

// --- IPC Handlers ---

ipcMain.handle("read-clipboard", () => clipboard.readText());

ipcMain.handle("fetch-metadata", async (_, url) => {
  /* ... fetch logic ... */
  if (typeof fetch !== "function")
    return { name: "Setup Error", author: "N/A" };
  try {
    if (!url || !(url.startsWith("http://") || url.startsWith("https://")))
      throw new Error("Invalid URL");
    const response = await fetch(
      `https://karabast.net/api/swudbdeck?deckLink=${encodeURIComponent(url)}`,
      {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "Mirrorbast/1.0" },
        timeout: 15000,
      }
    );
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `API request failed: ${response.status} Body: ${errorBody}`
      );
    }
    const data = await response.json();
    if (data?.metadata?.name !== undefined) {
      return {
        name: data.metadata.name || "Unnamed",
        author: data.metadata.author || "Unknown",
      };
    } else {
      return { name: "Invalid Metadata", author: "N/A" };
    }
  } catch (error) {
    console.error(`Fetch metadata error for ${url}:`, error);
    return { name: error.name || "Fetch Error", author: "N/A" };
  }
});

ipcMain.on("switch-player", () => {
  /* ... switch logic ... */
  if (!gameViewsVisible)
    return console.log("Switch player ignored: Game views not visible.");
  const nextViewNum = currentView === 1 ? 2 : 1;
  console.log(`Switching player from ${currentView} to ${nextViewNum}`);
  const activeView = nextViewNum === 1 ? view1 : view2;
  if (
    mainWindow &&
    activeView?.webContents &&
    !activeView.webContents.isDestroyed()
  ) {
    setCurrentView(nextViewNum);
    mainWindow.setBrowserView(activeView);
    resizeView(activeView);
    resizeView(nextViewNum === 1 ? view2 : view1);
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
  if (currentAbortController) {
    console.log("Reset triggered: Aborting ongoing auto-setup.");
    currentAbortController.abort();
    currentAbortController = null;
  }
  resetAndHideProgress(); // Reset progress state

  if (!gameViewsVisible) {
    /* ... make views visible ... */
    gameViewsVisible = true;
    if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
    if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
  }

  let view1Loaded = false,
    view2Loaded = false,
    errors = [];
  const checkCompletion = () => {
    /* ... check completion logic ... */
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
      if (
        mainWindow &&
        view1?.webContents &&
        !view1.webContents.isDestroyed() &&
        !errors.some((e) => e.includes("V1"))
      ) {
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
    /* ... reload view 1 ... */
    view1.webContents
      .loadURL("https://karabast.net")
      .then(() => {
        view1Loaded = true;
      })
      .catch((err) => {
        errors.push("V1:" + err.message);
        view1Loaded = true;
      })
      .finally(checkCompletion);
  } else {
    errors.push("V1 unavailable");
    view1Loaded = true;
    checkCompletion();
  }
  if (view2?.webContents && !view2.webContents.isDestroyed()) {
    /* ... reload view 2 ... */
    view2.webContents
      .loadURL("https://karabast.net")
      .then(() => {
        view2Loaded = true;
      })
      .catch((err) => {
        errors.push("V2:" + err.message);
        view2Loaded = true;
      })
      .finally(checkCompletion);
  } else {
    errors.push("V2 unavailable");
    view2Loaded = true;
    checkCompletion();
  }
});

// --- Auto Setup Handler ---
ipcMain.on("auto-setup", async (event, p1Url, p2Url) => {
  console.log("Received 'auto-setup' request.");

  // Abort previous setup if running
  if (currentAbortController) {
    console.log("New setup requested, aborting previous one.");
    currentAbortController.abort();
    await delay(50); // Brief pause
    resetAndHideProgress(); // Reset progress state
  }
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  // Ensure Player 1 is active before starting
  if (currentView !== 1) {
    /* ... switch to P1 ... */
    console.log("Auto-setup initiated: Switching to Player 1 view first.");
    const targetView = view1;
    if (
      mainWindow &&
      targetView?.webContents &&
      !targetView.webContents.isDestroyed()
    ) {
      setCurrentView(1);
      mainWindow.setBrowserView(targetView);
      resizeView(targetView);
      if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
      const wc = getMainWindowWebContents();
      if (wc) {
        wc.send("player-switched", 1);
      }
      await delay(200);
      console.log("Switched to Player 1 view.");
    } else {
      console.error("Cannot switch to Player 1 view before auto-setup.");
      event.reply("auto-setup-error", "Cannot switch to Player 1 view.");
      currentAbortController = null;
      return;
    }
  } else {
    console.log("Player 1 already active for auto-setup.");
  }

  // Ensure views are visible
  if (!gameViewsVisible) {
    /* ... make views visible ... */
    console.log("Making game views visible before auto-setup.");
    gameViewsVisible = true;
    if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
    if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
    await delay(100);
  }

  // Ensure sidebar is expanded
  if (currentSidebarWidth <= COLLAPSED_SIDEBAR_WIDTH) {
    /* ... expand sidebar ... */
    console.log("Ensuring sidebar expanded before auto-setup.");
    currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
    if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
    if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
    const wc = getMainWindowWebContents();
    if (wc) {
      wc.send("set-sidebar-collapsed", false);
    }
    await delay(200);
  }

  // Prepare context
  const appContext = {
    view1,
    view2,
    mainWindow,
    clipboard,
    setCurrentView,
    resizeView,
    getCurrentView: () => currentView,
    signal: signal,
  };

  try {
    await performAutoSetup(event, p1Url, p2Url, appContext);
    console.log("performAutoSetup process completed or aborted.");
  } catch (error) {
    if (!(error instanceof AbortError)) {
      console.error(
        "Unexpected error during performAutoSetup orchestration:",
        error
      );
      if (!event.sender.isDestroyed()) {
        event.reply(
          "auto-setup-error",
          "An unexpected error occurred during setup orchestration."
        );
      }
    }
    resetAndHideProgress(); // Ensure progress hidden on error
  } finally {
    console.log("Clearing auto-setup AbortController.");
    currentAbortController = null;
    resetAndHideProgress(); // Ensure progress hidden on normal completion/abort
  }
});

// --- Sidebar State Handler ---
ipcMain.on("sidebar-state-change", (event, isCollapsed) => {
  /* ... resize views ... */
  currentSidebarWidth = isCollapsed
    ? COLLAPSED_SIDEBAR_WIDTH
    : DEFAULT_SIDEBAR_WIDTH;
  if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
  if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
});

// --- Game View Visibility Handler ---
ipcMain.on("set-game-views-visibility", (event, visible) => {
  /* ... show/hide views ... */
  if (gameViewsVisible === visible) return;
  gameViewsVisible = visible;
  if (visible) {
    if (view1 && !view1.webContents.isDestroyed()) resizeView(view1);
    if (view2 && !view2.webContents.isDestroyed()) resizeView(view2);
    const activeView = currentView === 1 ? view1 : view2;
    if (mainWindow && activeView) mainWindow.setBrowserView(activeView);
  } else {
    try {
      if (view1 && !view1.webContents.isDestroyed())
        view1.setBounds({ x: 0, y: HEADER_HEIGHT, width: 0, height: 0 });
      if (view2 && !view2.webContents.isDestroyed())
        view2.setBounds({ x: 0, y: HEADER_HEIGHT, width: 0, height: 0 });
    } catch (error) {
      console.error("Error setting zero bounds:", error);
    }
  }
});

// --- Spacebar Shortcut Toggle Handler ---
ipcMain.on("toggle-spacebar-shortcut", (event, enabled) => {
  /* ... register/unregister ... */
  isSpacebarShortcutGloballyEnabled = enabled;
  if (mainWindow?.isFocused()) {
    if (enabled) registerSpaceShortcut();
    else unregisterSpaceShortcut();
  }
});

// --- External URL Handler ---
ipcMain.on("open-external-url", (event, url) => {
  /* ... open url ... */
  if (url && (url.startsWith("http:") || url.startsWith("https:"))) {
    shell
      .openExternal(url)
      .catch((err) =>
        console.error(`Failed to open external URL "${url}":`, err)
      );
  } else {
    console.warn(`Attempted to open invalid external URL: ${url}`);
  }
});

// Progress Bar State Management Handlers
ipcMain.on("start-progress-delay", (event, delayType) => {
  const wasZero = activeDelayCounter === 0;
  activeDelayCounter++;
  console.log(
    `[Main:IPC] Start delay signal received. Counter: ${activeDelayCounter}, Type: ${delayType}`
  );
  if (wasZero) {
    currentActiveDelayType = delayType;
    const wc = getMainWindowWebContents();
    if (wc) {
      // *** Add small delay before sending show-progress ***
      setTimeout(() => {
        // Re-check webContents validity *inside* the timeout
        const wcDelayed = getMainWindowWebContents();
        if (wcDelayed) {
          console.log(
            `[Main:IPC] Sending show-progress (${currentActiveDelayType}) to renderer after 50ms delay (webContents ID: ${wcDelayed.id}).`
          );
          wcDelayed.send("show-progress", currentActiveDelayType);
        } else {
          console.warn(
            `[Main:IPC] Cannot send show-progress after delay, webContents became invalid.`
          );
        }
      }, 50); // 50ms delay
    } else {
      console.warn(
        `[Main:IPC] Cannot send show-progress (initial check), webContents invalid.`
      );
    }
  }
});

ipcMain.on("end-progress-delay", (event) => {
  if (activeDelayCounter <= 0) {
    console.warn(
      "[Main:IPC] Received end-progress-delay signal, but counter was already 0 or less."
    );
    activeDelayCounter = 0;
    return;
  }

  activeDelayCounter--;
  console.log(
    `[Main:IPC] End delay signal received. Counter: ${activeDelayCounter}`
  );
  if (activeDelayCounter === 0) {
    currentActiveDelayType = null;
    const wc = getMainWindowWebContents();
    if (wc) {
      console.log(
        `[Main:IPC] Sending hide-progress to renderer (webContents ID: ${wc.id}).`
      );
      wc.send("hide-progress");
    } else {
      console.warn(
        `[Main:IPC] Cannot send hide-progress, webContents invalid.`
      );
    }
  }
});

// --- Electron App Lifecycle ---
app.whenReady().then(() => {
  createWindow();
  registerSpaceShortcut();
});
app.on("browser-window-focus", () => {
  if (isSpacebarShortcutGloballyEnabled) registerSpaceShortcut();
  else unregisterSpaceShortcut();
});
app.on("browser-window-blur", () => {
  unregisterSpaceShortcut();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  if (isSpacebarShortcutGloballyEnabled) registerSpaceShortcut();
});
app.on("will-quit", () => {
  unregisterSpaceShortcut();
  if (currentAbortController) currentAbortController.abort();
});
app.on("gpu-process-crashed", (event, killed) =>
  console.error(`GPU crash! Killed: ${killed}`)
);
app.on("renderer-process-crashed", (event, webContents, killed) => {
  /* ... error logging ... */
  console.error(
    `Renderer crash! URL: ${webContents?.getURL()}, Killed: ${killed}`
  );
  const viewId = webContents?.id;
  let viewName = "Unknown";
  if (viewId) {
    if (view1?.webContents.id === viewId) viewName = "View 1";
    else if (view2?.webContents.id === viewId) viewName = "View 2";
    else if (mainWindow?.webContents.id === viewId) viewName = "Main Window";
  }
  console.error(`${viewName} renderer crashed.`);
});
