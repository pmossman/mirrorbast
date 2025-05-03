// main.js
const { app, BrowserWindow, BrowserView, ipcMain, clipboard, globalShortcut } = require('electron');
const path = require('path');
const fetch = require('node-fetch'); // Ensure node-fetch@2 is installed

// Import the auto-setup logic
const { performAutoSetup } = require('./auto-setup');

// Constants for layout
const HEADER_HEIGHT = 60;
const SIDEBAR_WIDTH = 300;

// Keep track of the main window and the two browser views
let mainWindow;
let view1, view2;
let currentView = 1; // 1 or 2 // This state is managed here

/**
 * Creates the main application window and sets up BrowserViews.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'icon.png') // Optional: Add an app icon
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // Uncomment for main window dev tools

  // Create BrowserViews
  view1 = new BrowserView({ webPreferences: { partition: 'persist:player1', contextIsolation: true } });
  view2 = new BrowserView({ webPreferences: { partition: 'persist:player2', contextIsolation: true } });

  // Load Initial URLs
  console.log("Loading initial URL for View 1...");
  view1.webContents.loadURL('https://karabast.net')
    .then(() => console.log("View 1 loaded initial URL."))
    .catch(err => console.error("Error loading initial URL for View 1:", err));

  console.log("Loading initial URL for View 2...");
  view2.webContents.loadURL('https://karabast.net')
    .then(() => console.log("View 2 loaded initial URL."))
    .catch(err => console.error("Error loading initial URL for View 2:", err));

  // Set initial view and resize after a short delay
  mainWindow.setBrowserView(view1);
  setTimeout(() => {
      if (mainWindow && view1 && !view1.webContents.isDestroyed()) { // Check validity
          resizeView(view1);
          sendPreview();
      }
  }, 150);

  // DevTools & Logging (Optional)
  // view1.webContents.openDevTools({ mode: 'detach' });
  view1.webContents.on('console-message', (e, level, message) => console.log('[VIEW1]', message));
  // view2.webContents.openDevTools({ mode: 'detach' });
  view2.webContents.on('console-message', (e, level, message) => console.log('[VIEW2]', message));

  // Window Event Handling
  mainWindow.on('resize', () => resizeView(currentView === 1 ? view1 : view2));
  mainWindow.on('focus', registerSpaceShortcut);
  mainWindow.on('blur', unregisterSpaceShortcut);
  mainWindow.on('closed', () => {
    unregisterSpaceShortcut(); // Ensure cleanup
    mainWindow = null; // Dereference window
  });
}

/**
 * Registers the Spacebar global shortcut.
 */
function registerSpaceShortcut() {
     if (!globalShortcut.isRegistered('Space')) {
      globalShortcut.register('Space', () => {
        // Check if mainWindow and its webContents are valid before sending
        if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('trigger-switch');
        } else {
            console.warn("Skipping trigger-switch send; mainWindow invalid.");
        }
      });
      console.log("Spacebar shortcut registered.");
    }
}

/**
 * Unregisters the Spacebar global shortcut.
 */
function unregisterSpaceShortcut() {
     if (globalShortcut.isRegistered('Space')) {
      globalShortcut.unregister('Space');
      console.log("Spacebar shortcut unregistered.");
    }
}


/**
 * Resizes and positions the given BrowserView within the main window.
 * @param {BrowserView} view - The BrowserView to resize.
 */
function resizeView(view) {
  // Check if mainWindow and the view/webContents are valid and not destroyed
  if (!mainWindow || !view || !view.webContents || view.webContents.isDestroyed()) {
      // console.warn("ResizeView called with invalid window or view."); // Reduce console noise
      return;
  }
  try {
    const [width, height] = mainWindow.getContentSize();
    const viewWidth = Math.max(1, width - SIDEBAR_WIDTH);
    const viewHeight = Math.max(1, height - HEADER_HEIGHT);

    // Prevent setting bounds if dimensions are invalid (e.g., during minimize)
    if (viewWidth <= 1 || viewHeight <= 1) {
        // console.warn(`Skipping resize for View ${currentView === 1 ? '1' : '2'} due to invalid dimensions: ${viewWidth}x${viewHeight}`);
        return;
    }

    view.setBounds({ x: SIDEBAR_WIDTH, y: HEADER_HEIGHT, width: viewWidth, height: viewHeight });
    // console.log(`Resized view ${currentView === 1 ? '1' : '2'} to bounds: x:${SIDEBAR_WIDTH}, y:${HEADER_HEIGHT}, w:${viewWidth}, h:${viewHeight}`);
  } catch (error) {
    // Catch errors specifically if the view is destroyed between the check and setBounds
    if (!error.message.includes('destroyed')) { // Ignore errors if view was destroyed during resize attempt
        console.error("Error resizing view:", error);
    }
  }
}

/**
 * Captures a preview image of the inactive BrowserView and sends it to the renderer.
 */
function sendPreview() {
  const inactiveView = currentView === 1 ? view2 : view1;
  // Ensure the inactive view and its webContents are valid before capturing
  if (inactiveView && inactiveView.webContents && !inactiveView.webContents.isDestroyed()) {
    inactiveView.webContents.capturePage()
      .then(img => {
        // Ensure mainWindow is still valid before sending
        if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('preview-updated', img.toDataURL());
        }
      })
      .catch(err => {
        // Reduce console noise for common capture issues when hidden/occluded
        // if (!err.message.includes('WebContents was hidden')) {
        //      console.error("Error capturing page:", err);
        // }
        // Send empty preview on error
        if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('preview-updated', '');
        }
      });
  } else {
    // console.warn(`Cannot send preview, inactive view (${currentView === 1 ? '2' : '1'}) is not available.`); // Reduce noise
    // Send empty preview if view is invalid
    if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('preview-updated', '');
    }
  }
}

/**
 * Updates the current active view state variable.
 * This function is passed to the auto-setup module.
 * @param {number} viewNum - The view number (1 or 2) to set as active.
 */
function setCurrentView(viewNum) {
    if (viewNum === 1 || viewNum === 2) {
        // console.log(`Setting current view to: ${viewNum}`); // Can be noisy
        currentView = viewNum;
    } else {
        console.error(`Invalid view number passed to setCurrentView: ${viewNum}`);
    }
}

// --- IPC Handlers ---

// Handle request to read clipboard
ipcMain.handle('read-clipboard', () => clipboard.readText());

// Handle request to fetch deck metadata
ipcMain.handle('fetch-metadata', async (_, url) => {
  // Metadata fetch logic remains the same
  console.log(`Fetching metadata for: ${url}`);
  try {
    if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) {
      throw new Error('Invalid URL provided (must start with http/https)');
    }
    const response = await fetch(`https://karabast.net/api/swudbdeck?deckLink=${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'KarabastTesterApp/1.0' },
        timeout: 15000 // 15 second timeout
    });
    if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Could not read error body');
        console.error(`API Error ${response.status} for ${url}. Body: ${errorBody}`);
        throw new Error(`API request failed with status: ${response.status}`);
    }
    const data = await response.json();
    if (data && typeof data === 'object' && data.metadata && typeof data.metadata.name === 'string') {
         return { name: data.metadata.name || 'Unnamed Deck', author: data.metadata.author || 'Unknown Author' };
    } else {
        console.warn('Metadata structure missing or invalid in response for:', url);
        return { name: 'Invalid Metadata', author: 'N/A' };
    }
  } catch (error) {
    console.error(`Error fetching metadata for ${url}:`, error);
    const errorName = error.code || error.name || 'Fetch Error';
    return { name: errorName, author: 'N/A' };
  }
});

// Handle request to join lobby manually
ipcMain.on('join-lobby', (event, url) => {
  // Manual join lobby logic remains the same
  console.log(`Joining lobby (manual): ${url}`);
  if (!view2 || !view2.webContents || view2.webContents.isDestroyed()) {
    console.error("View 2 is not available to join lobby.");
    event.reply('lobby-error', 'Player 2 view is not initialized.'); return;
  }
  // Basic URL validation
  if (!url || !url.includes('karabast.net/lobby')) {
      console.error("Invalid lobby URL provided for manual join:", url);
      event.reply('lobby-error', 'Invalid lobby URL format.'); return;
  }
  console.log("Loading lobby URL into View 2...");
  view2.webContents.loadURL(url)
    .then(() => {
      // Check if view still exists after load
      if (!view2 || view2.webContents.isDestroyed()) { console.warn("View 2 was destroyed during lobby load."); return; }
      console.log('View 2 finished loading lobby URL.');
      setCurrentView(2); // Update state
      if (mainWindow) { mainWindow.setBrowserView(view2); resizeView(view2); }
      event.reply('lobby-success');
      sendPreview();
    })
    .catch(err => {
      console.error(`Error loading View 2 URL ${url}:`, err);
      event.reply('lobby-error', `Failed to load lobby: ${err.message}`);
    });
});

// Handle request to switch player view
ipcMain.on('switch-player', () => {
  // Switch player logic remains the same, uses local currentView state
  const nextView = currentView === 1 ? 2 : 1;
  console.log(`Switching player from ${currentView} to ${nextView}`);
  const activeView = nextView === 1 ? view1 : view2;

  // Ensure target view is valid before switching
  if (mainWindow && activeView && activeView.webContents && !activeView.webContents.isDestroyed()) {
    setCurrentView(nextView); // Update state *before* switching
    mainWindow.setBrowserView(activeView);
    resizeView(activeView);
    sendPreview(); // Update preview
  } else {
    console.error(`Cannot switch player: MainWindow or target View ${nextView} is missing/invalid.`);
  }
});

// Handle request to reset views
ipcMain.on('reset-phase', (event) => {
  // Reset logic remains the same
  console.log('Resetting application views to Karabast home...');
  let view1Loaded = false, view2Loaded = false, errors = [];
  const checkCompletion = () => {
      if (!view1Loaded || !view2Loaded) return; // Wait for both attempts
      if (errors.length === 0) {
          console.log("Both views reloaded successfully.");
          setCurrentView(1); // Reset active view state
          if (mainWindow) { mainWindow.setBrowserView(view1); resizeView(view1); }
          sendPreview();
          event.reply('reset-success');
      } else {
          console.error("Error during reset:", errors.join('; '));
          // Attempt to set P1 as active anyway if it succeeded or exists
          if (mainWindow && view1 && !view1.webContents.isDestroyed() && !errors.some(e => e.includes("V1"))) {
              console.log("Setting View 1 as active despite reset errors.");
              setCurrentView(1); // Reset active view state
              mainWindow.setBrowserView(view1); resizeView(view1); sendPreview();
          }
          event.reply('reset-error', `Failed to reload views: ${errors.join('; ')}`);
      }
  };
  // Reload View 1
  if (view1 && view1.webContents && !view1.webContents.isDestroyed()) {
    view1.webContents.loadURL('https://karabast.net').then(() => { view1Loaded = true; }).catch(err => { console.error("Error reloading View 1:", err); errors.push("V1:"+err.message); view1Loaded = true; }).finally(checkCompletion);
  } else { console.warn("V1 unavailable for reset."); errors.push("V1 unavailable"); view1Loaded = true; checkCompletion(); }
  // Reload View 2
  if (view2 && view2.webContents && !view2.webContents.isDestroyed()) {
    view2.webContents.loadURL('https://karabast.net').then(() => { view2Loaded = true; }).catch(err => { console.error("Error reloading View 2:", err); errors.push("V2:"+err.message); view2Loaded = true; }).finally(checkCompletion);
  } else { console.warn("V2 unavailable for reset."); errors.push("V2 unavailable"); view2Loaded = true; checkCompletion(); }
});

// --- Auto Setup Handler (Refactored) ---
ipcMain.on('auto-setup', async (event, p1Url, p2Url) => {
    console.log("Received 'auto-setup' request.");
    // Ensure Player 1 view is active before starting auto-setup
    if (currentView !== 1) {
        console.log("Switching to View 1 before starting auto-setup.");
        const targetView = view1;
         // Check if switch is possible
         if (mainWindow && targetView && targetView.webContents && !targetView.webContents.isDestroyed()) {
            setCurrentView(1); // Update state
            mainWindow.setBrowserView(targetView);
            resizeView(targetView);
            sendPreview();
            await new Promise(r => setTimeout(r, 300)); // Short delay after switch
        } else {
             console.error("Cannot switch to View 1 for auto-setup, view invalid.");
             event.reply('auto-setup-error', 'Cannot switch to Player 1 view.');
             return; // Stop if cannot switch
        }
    } else {
        console.log("Already on View 1, proceeding with auto-setup.");
    }

    // Create the context object to pass necessary functions and state access
    const appContext = {
        view1,
        view2,
        mainWindow,
        clipboard,
        setCurrentView, // Pass the function to update state managed here
        resizeView,     // Pass helper function from this scope
        sendPreview,    // Pass helper function from this scope
        getCurrentView: () => currentView // Provide a way to read current state
    };

    // Call the imported function from auto-setup.js
    // No need to await here unless main process needs to wait for completion
    // for something else. Errors/success are handled via event.reply within performAutoSetup.
    performAutoSetup(event, p1Url, p2Url, appContext);
});


// --- Electron App Lifecycle ---

// Create window when ready
app.whenReady().then(createWindow);

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  unregisterSpaceShortcut(); // Cleanup shortcut
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Re-create window on activate (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Ensure cleanup before quitting
app.on('will-quit', () => {
  unregisterSpaceShortcut();
});

// Optional: Handle process crashes for more robustness
app.on('gpu-process-crashed', (event, killed) => console.error(`GPU process crashed! Killed: ${killed}`));
app.on('renderer-process-crashed', (event, webContents, killed) => {
    console.error(`Renderer process crashed! URL: ${webContents?.getURL()}, Killed: ${killed}`);
    // Identify which view crashed if possible
    const viewId = webContents?.id;
    let viewName = 'Unknown View';
    if (viewId) {
        if (view1 && view1.webContents.id === viewId) viewName = 'View 1';
        else if (view2 && view2.webContents.id === viewId) viewName = 'View 2';
        else if (mainWindow && mainWindow.webContents.id === viewId) viewName = 'Main Window Renderer';
    }
    console.error(`${viewName} renderer process crashed.`);
});
