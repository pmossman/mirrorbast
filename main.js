// main.js
const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  clipboard,
  globalShortcut,
  shell // *** NEW: Added shell module ***
} = require("electron");
const path = require("path");
const fetch = require("node-fetch"); // Ensure node-fetch@2 is installed

// Import the auto-setup logic
const { performAutoSetup } = require("./auto-setup");

// Constants for layout
const DEFAULT_SIDEBAR_WIDTH = 300;
const COLLAPSED_SIDEBAR_WIDTH = 0;
const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 50;

// Keep track of the main window and the two browser views
let mainWindow;
let view1, view2;
let currentView = 1; // 1 or 2
let currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH; // Track current sidebar width
let gameViewsVisible = true;
// *** NEW: Track if spacebar shortcut should be active ***
let isSpacebarShortcutGloballyEnabled = true; // Default to enabled

/**
 * Creates the main application window and sets up BrowserViews.
 */
function createWindow() {
  currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH; // Reset on create
  gameViewsVisible = true; // Reset on create
  isSpacebarShortcutGloballyEnabled = true; // Reset on create

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

  // Create BrowserViews
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

  // Add both views immediately
  mainWindow.addBrowserView(view1);
  mainWindow.addBrowserView(view2);
  mainWindow.setBrowserView(view1); // Set P1 on top

  // Load Initial URLs
  console.log("Loading initial URL for View 1...");
  view1.webContents
    .loadURL("https://karabast.net")
    .then(() => console.log("View 1 loadURL initiated."))
    .catch((err) => console.error("Error initiating load for View 1:", err));

  console.log("Loading initial URL for View 2...");
  view2.webContents
    .loadURL("https://karabast.net")
    .then(() => console.log("View 2 loadURL initiated."))
    .catch((err) => console.error("Error initiating load for View 2:", err));

  // Set initial view and resize
  setTimeout(() => {
    if (mainWindow && view1 && !view1.webContents.isDestroyed()) {
      resizeView(view1); // Resize P1
      // Resize P2 to its initial position (it will be behind P1)
      if (view2 && !view2.webContents.isDestroyed()) {
        resizeView(view2);
      }
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
    resizeView(view1);
    resizeView(view2);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/** Registers the Spacebar global shortcut IF it's globally enabled. */
function registerSpaceShortcut() {
  // Only register if the global flag allows it
  if (!isSpacebarShortcutGloballyEnabled) {
      console.log("Spacebar shortcut registration skipped (globally disabled).");
      return;
  }

  if (!globalShortcut.isRegistered("Space")) {
    const ret = globalShortcut.register("Space", () => {
      // Just check if the window is valid
      if (mainWindow?.webContents && !mainWindow.webContents.isDestroyed()) {
        console.log("Spacebar pressed, sending trigger-switch");
        // Check if game views are visible before triggering switch
        if (gameViewsVisible) {
          mainWindow.webContents.send("trigger-switch");
        } else {
          console.log(
            "Spacebar ignored, game views not visible (deck management likely active)."
          );
        }
      } else {
        console.warn(
          "Spacebar pressed, but mainWindow invalid. Attempting to unregister shortcut."
        );
        unregisterSpaceShortcut(); // Attempt cleanup
      }
    });
    if (ret) {
      console.log("Spacebar shortcut registered successfully.");
    } else {
      console.error("Failed to register Spacebar shortcut.");
    }
  } else {
      console.log("Spacebar shortcut already registered.");
  }
}

/** Unregisters the Spacebar global shortcut. */
function unregisterSpaceShortcut() {
  if (globalShortcut.isRegistered("Space")) {
    globalShortcut.unregister("Space");
    console.log("Spacebar shortcut unregistered.");
  } else {
      console.log("Spacebar shortcut was not registered.");
  }
}

/** Resizes and positions the given BrowserView within the main window. */
function resizeView(view) {
  if (!mainWindow || !view?.webContents || view.webContents.isDestroyed()) {
    return;
  }

  // If game views are meant to be hidden, don't resize (they should be at 0x0)
  if (!gameViewsVisible) {
    try {
      view.setBounds({ x: 0, y: HEADER_HEIGHT, width: 0, height: 0 });
    } catch (error) {
      if (!error.message.includes("destroyed")) {
        console.error("Error setting hidden bounds:", error);
      }
    }
    return;
  }

  try {
    const [width, height] = mainWindow.getContentSize();
    // Calculate bounds based on currentSidebarWidth
    const viewWidth = Math.max(1, width - currentSidebarWidth);
    const viewHeight = Math.max(1, height - HEADER_HEIGHT - FOOTER_HEIGHT);

    // If sidebar is collapsed, view takes full width
    const viewX =
      currentSidebarWidth <= COLLAPSED_SIDEBAR_WIDTH ? 0 : currentSidebarWidth;
    const effectiveWidth =
      currentSidebarWidth <= COLLAPSED_SIDEBAR_WIDTH ? width : viewWidth;

    if (effectiveWidth <= 1 || viewHeight <= 1) {
      return;
    }
    view.setBounds({
      x: viewX,
      y: HEADER_HEIGHT,
      width: effectiveWidth,
      height: viewHeight,
    });
  } catch (error) {
    if (!error.message.includes("destroyed")) {
      console.error("Error resizing view:", error);
    }
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

// --- IPC Handlers ---

ipcMain.handle("read-clipboard", () => clipboard.readText());

ipcMain.handle("fetch-metadata", async (_, url) => {
  console.log(`Fetching metadata for: ${url}`);
  if (typeof fetch !== "function") {
    console.error("FATAL: fetch not available.");
    return { name: "Setup Error", author: "N/A" };
  }
  try {
    if (!url || !(url.startsWith("http://") || url.startsWith("https://"))) {
      throw new Error("Invalid URL");
    }
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
      console.error(
        `API Error ${response.status} for ${url}. Body: ${errorBody}`
      );
      throw new Error(`API request failed: ${response.status}`);
    }
    const data = await response.json();
    if (data?.metadata?.name !== undefined) {
      return {
        name: data.metadata.name || "Unnamed",
        author: data.metadata.author || "Unknown",
      };
    } else {
      console.warn("Invalid metadata structure:", url);
      return { name: "Invalid Metadata", author: "N/A" };
    }
  } catch (error) {
    console.error(`Fetch metadata error for ${url}:`, error);
    return { name: error.name || "Fetch Error", author: "N/A" };
  }
});

ipcMain.on("switch-player", () => {
  // Don't switch if views aren't visible
  if (!gameViewsVisible) {
    console.log("Switch player ignored: Game views not visible.");
    return;
  }

  const nextViewNum = currentView === 1 ? 2 : 1;
  console.log(`Switching player from ${currentView} to ${nextViewNum}`);
  const activeView = nextViewNum === 1 ? view1 : view2;

  if (
    mainWindow &&
    activeView?.webContents &&
    !activeView.webContents.isDestroyed()
  ) {
    setCurrentView(nextViewNum);
    mainWindow.setBrowserView(activeView); // Bring the new active view to the front
    resizeView(activeView);
    resizeView(nextViewNum === 1 ? view2 : view1);
  } else {
    console.error(`Cannot switch player: View ${nextViewNum} invalid.`);
  }
});

ipcMain.on("reset-phase", (event) => {
  console.log("Resetting application views...");
  // Ensure views are visible before reloading
  if (!gameViewsVisible) {
    console.log("Making game views visible before reset.");
    gameViewsVisible = true;
    resizeView(view1);
    resizeView(view2);
    if (mainWindow && currentView === 1 && view1)
      mainWindow.setBrowserView(view1);
    else if (mainWindow && currentView === 2 && view2)
      mainWindow.setBrowserView(view2);
  }

  let view1Loaded = false,
    view2Loaded = false,
    errors = [];
  const checkCompletion = () => {
    if (!view1Loaded || !view2Loaded) return;
    if (errors.length === 0) {
      console.log("Views reloaded.");
      setCurrentView(1);
      if (mainWindow) {
        currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH; // Ensure expanded
        gameViewsVisible = true; // Ensure visible state is correct
        mainWindow.setBrowserView(view1); // Ensures P1 is on top
        resizeView(view1); // Resize P1
        resizeView(view2); // Resize P2 (it will be behind P1)
        if (mainWindow?.webContents && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send("set-sidebar-collapsed", false); // Tell renderer to expand
        }
      }
      event.reply("reset-success");
    } else {
      console.error("Reset error:", errors.join("; "));
      // Attempt to recover with P1 if possible
      if (
        mainWindow &&
        view1?.webContents &&
        !view1.webContents.isDestroyed() &&
        !errors.some((e) => e.includes("V1"))
      ) {
        console.log("Setting V1 active despite reset errors.");
        setCurrentView(1);
        currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
        gameViewsVisible = true; // Ensure visible
        mainWindow.setBrowserView(view1);
        resizeView(view1);
        resizeView(view2);
        if (mainWindow?.webContents && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send("set-sidebar-collapsed", false);
        }
      }
      event.reply("reset-error", `Failed reload: ${errors.join("; ")}`);
    }
  };
  if (view1?.webContents && !view1.webContents.isDestroyed()) {
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

  // Ensure views are visible before setup
  if (!gameViewsVisible) {
    console.log("Making game views visible before auto-setup.");
    gameViewsVisible = true;
    resizeView(view1);
    resizeView(view2);
    if (mainWindow && view1) mainWindow.setBrowserView(view1); // Start with P1
    setCurrentView(1);
    await new Promise((r) => setTimeout(r, 100)); // Short delay for resize
  }

  // Ensure sidebar is expanded and P1 is active
  if (currentView !== 1 || currentSidebarWidth <= COLLAPSED_SIDEBAR_WIDTH) {
    console.log(
      "Ensuring View 1 active and sidebar expanded before auto-setup."
    );
    const targetView = view1;
    if (
      mainWindow &&
      targetView?.webContents &&
      !targetView.webContents.isDestroyed()
    ) {
      setCurrentView(1);
      currentSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
      mainWindow.setBrowserView(targetView);
      resizeView(targetView);
      resizeView(view2);
      mainWindow.webContents.send("set-sidebar-collapsed", false); // Tell renderer to expand UI
      await new Promise((r) => setTimeout(r, 300));
    } else {
      event.reply("auto-setup-error", "Cannot switch/show P1 view.");
      return;
    }
  } else {
    console.log("View 1 ready for auto-setup.");
  }

  const appContext = {
    view1,
    view2,
    mainWindow,
    clipboard,
    setCurrentView,
    resizeView,
    getCurrentView: () => currentView,
  };
  performAutoSetup(event, p1Url, p2Url, appContext);
});

// --- Sidebar State Handler ---
ipcMain.on("sidebar-state-change", (event, isCollapsed) => {
  console.log(`Renderer reported sidebar collapsed: ${isCollapsed}`);
  currentSidebarWidth = isCollapsed
    ? COLLAPSED_SIDEBAR_WIDTH
    : DEFAULT_SIDEBAR_WIDTH;
  resizeView(view1);
  resizeView(view2);
});

// --- Game View Visibility Handler ---
ipcMain.on("set-game-views-visibility", (event, visible) => {
  console.log(`Setting game views visibility to: ${visible}`);
  if (gameViewsVisible === visible) return; // No change

  gameViewsVisible = visible;

  if (visible) {
    // Make views visible
    console.log("Resizing views to make them visible.");
    resizeView(view1);
    resizeView(view2);
    const activeView = currentView === 1 ? view1 : view2;
    if (mainWindow && activeView) {
      mainWindow.setBrowserView(activeView);
    } else {
      console.warn("Could not set active view after making visible.");
    }
  } else {
    // Make views hidden
    console.log("Setting view bounds to zero to hide them.");
    try {
      if (view1 && !view1.webContents.isDestroyed()) {
        view1.setBounds({ x: 0, y: HEADER_HEIGHT, width: 0, height: 0 });
      }
      if (view2 && !view2.webContents.isDestroyed()) {
        view2.setBounds({ x: 0, y: HEADER_HEIGHT, width: 0, height: 0 });
      }
    } catch (error) {
      console.error("Error setting zero bounds:", error);
    }
  }
});

// *** NEW: Handler to toggle spacebar shortcut ***
ipcMain.on("toggle-spacebar-shortcut", (event, enabled) => {
    console.log(`Received request to set spacebar shortcut enabled: ${enabled}`);
    isSpacebarShortcutGloballyEnabled = enabled;
    if (mainWindow?.isFocused()) { // Only change registration if window is focused
        if (enabled) {
            registerSpaceShortcut();
        } else {
            unregisterSpaceShortcut();
        }
    } else {
        console.log("Window not focused, shortcut registration state will update on focus.");
    }
});

// *** NEW: Handler to open external URL ***
ipcMain.on("open-external-url", (event, url) => {
    console.log(`Received request to open external URL: ${url}`);
    if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
        shell.openExternal(url).catch(err => {
            console.error(`Failed to open external URL "${url}":`, err);
            // Optionally, notify the renderer of the failure
            // event.reply('open-external-url-error', url, err.message);
        });
    } else {
        console.warn(`Attempted to open invalid external URL: ${url}`);
        // Optionally, notify the renderer
        // event.reply('open-external-url-error', url, 'Invalid URL format');
    }
});


// --- Electron App Lifecycle ---
app.whenReady().then(() => {
    createWindow();
    // Initial registration attempt on ready (if enabled)
    registerSpaceShortcut();
});

app.on("browser-window-focus", () => {
    console.log("Window focused, ensuring correct spacebar shortcut state.");
    // Re-evaluate shortcut registration based on the global flag when window gains focus
    if (isSpacebarShortcutGloballyEnabled) {
        registerSpaceShortcut();
    } else {
        unregisterSpaceShortcut();
    }
});

app.on("browser-window-blur", () => {
    console.log("Window blurred, unregistering spacebar shortcut.");
    // Always unregister when window loses focus
    unregisterSpaceShortcut();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
  // Re-evaluate shortcut registration on activate (macOS)
  if (isSpacebarShortcutGloballyEnabled) {
      registerSpaceShortcut();
  }
});

app.on("will-quit", () => {
  // Clean up shortcut before quitting
  unregisterSpaceShortcut();
});

app.on("gpu-process-crashed", (event, killed) =>
  console.error(`GPU crash! Killed: ${killed}`)
);

app.on("renderer-process-crashed", (event, webContents, killed) => {
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
