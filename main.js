// main.js
const { app, BrowserWindow, BrowserView, ipcMain, clipboard, globalShortcut } = require('electron');
const path = require('path');
// *** Ensure node-fetch is required correctly ***
// Make sure you have run: npm install node-fetch@2
const fetch = require('node-fetch');

// Import the auto-setup logic
const { performAutoSetup } = require('./auto-setup');

// Constants for layout
const HEADER_HEIGHT = 60;
const SIDEBAR_WIDTH = 300;

// Keep track of the main window and the two browser views
let mainWindow;
let view1, view2;
let currentView = 1; // 1 or 2 // This state is managed here
let isBrowserViewVisible = true; // Track if BrowserView should be visible

/**
 * Creates the main application window and sets up BrowserViews.
 */
function createWindow() {
  isBrowserViewVisible = true; // Reset on create

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.on('page-title-updated', (event) => event.preventDefault());
  mainWindow.setTitle('Karabast Tester');
  mainWindow.loadFile('index.html');

  // Create BrowserViews
  view1 = new BrowserView({ webPreferences: { partition: 'persist:player1', contextIsolation: true, backgroundThrottling: false } });
  view2 = new BrowserView({ webPreferences: { partition: 'persist:player2', contextIsolation: true, backgroundThrottling: false } });

  // Load Initial URLs
  console.log("Loading initial URL for View 1...");
  view1.webContents.loadURL('https://karabast.net')
    .then(() => console.log("View 1 loadURL initiated."))
    .catch(err => console.error("Error initiating load for View 1:", err));

  console.log("Loading initial URL for View 2...");
  view2.webContents.loadURL('https://karabast.net')
    .then(() => console.log("View 2 loadURL initiated."))
    .catch(err => console.error("Error initiating load for View 2:", err));

  // Set initial view and resize
  mainWindow.setBrowserView(view1);
  setTimeout(() => {
      if (mainWindow && view1 && !view1.webContents.isDestroyed()) {
          resizeView(view1);
      }
  }, 150);

  // DevTools & Logging
  // view1.webContents.openDevTools({ mode: 'detach' });
  view1.webContents.on('console-message', (e, level, message) => console.log('[VIEW1]', message));
  // view2.webContents.openDevTools({ mode: 'detach' });
  view2.webContents.on('console-message', (e, level, message) => console.log('[VIEW2]', message));

  // Window Event Handling
  mainWindow.on('resize', () => {
      if (isBrowserViewVisible) {
          resizeView(currentView === 1 ? view1 : view2);
      }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

/** Registers the Spacebar global shortcut. */
function registerSpaceShortcut() {
     if (!globalShortcut.isRegistered('Space')) {
      const ret = globalShortcut.register('Space', () => {
        if (isBrowserViewVisible && mainWindow?.webContents && !mainWindow.webContents.isDestroyed()) {
            console.log("Spacebar pressed, sending trigger-switch");
            mainWindow.webContents.send('trigger-switch');
        } else if (!isBrowserViewVisible) {
            console.log("Spacebar pressed, but ignored (deck management view active).");
        } else {
            console.warn("Spacebar pressed, but mainWindow invalid. Unregistering shortcut.");
            unregisterSpaceShortcut();
        }
      });
      if (ret) { console.log("Spacebar shortcut registered successfully."); }
      else { console.error("Failed to register Spacebar shortcut."); }
    }
}

/** Unregisters the Spacebar global shortcut. */
function unregisterSpaceShortcut() {
     if (globalShortcut.isRegistered('Space')) {
      globalShortcut.unregister('Space');
      console.log("Spacebar shortcut unregistered.");
    }
}


/** Resizes and positions the given BrowserView within the main window. */
function resizeView(view) {
  if (!mainWindow || !view?.webContents || view.webContents.isDestroyed()) { return; }
  if (!isBrowserViewVisible) {
    //   console.log("Skipping resize, BrowserView is hidden."); // Reduce noise
      return;
  }
  try {
    const [width, height] = mainWindow.getContentSize();
    const viewWidth = Math.max(1, width - SIDEBAR_WIDTH);
    const viewHeight = Math.max(1, height - HEADER_HEIGHT);
    if (viewWidth <= 1 || viewHeight <= 1) { return; }
    view.setBounds({ x: SIDEBAR_WIDTH, y: HEADER_HEIGHT, width: viewWidth, height: viewHeight });
  } catch (error) {
    if (!error.message.includes('destroyed')) { console.error("Error resizing view:", error); }
  }
}

/** Updates the current active view state variable. */
function setCurrentView(viewNum) {
    if (viewNum === 1 || viewNum === 2) { currentView = viewNum; }
    else { console.error(`Invalid view number passed to setCurrentView: ${viewNum}`); }
}

// --- IPC Handlers ---

ipcMain.handle('read-clipboard', () => clipboard.readText());

// *** Ensure fetch is available in this scope ***
ipcMain.handle('fetch-metadata', async (_, url) => {
  console.log(`Fetching metadata for: ${url}`);
  // Check if fetch was correctly required
  if (typeof fetch !== 'function') {
      console.error("FATAL: fetch function is not available in main process. Is node-fetch installed and required?");
      return { name: 'Setup Error', author: 'N/A' }; // Indicate a setup problem
  }
  try {
    if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) { throw new Error('Invalid URL (must start with http/https)'); }
    const response = await fetch(`https://karabast.net/api/swudbdeck?deckLink=${encodeURIComponent(url)}`, { method: 'GET', headers: { 'Accept': 'application/json', 'User-Agent': 'KarabastTesterApp/1.0' }, timeout: 15000 });
    if (!response.ok) { const errorBody = await response.text().catch(() => ''); console.error(`API Error ${response.status} for ${url}. Body: ${errorBody}`); throw new Error(`API request failed: ${response.status}`); }
    const data = await response.json();
    if (data?.metadata?.name !== undefined) { return { name: data.metadata.name || 'Unnamed', author: data.metadata.author || 'Unknown' }; }
    else { console.warn('Invalid metadata structure:', url); return { name: 'Invalid Metadata', author: 'N/A' }; }
  } catch (error) { console.error(`Fetch metadata error for ${url}:`, error); return { name: error.name || 'Fetch Error', author: 'N/A' }; }
});

ipcMain.on('join-lobby', (event, url) => {
  console.log(`Joining lobby (manual): ${url}`);
  if (!view2 || !view2.webContents || view2.webContents.isDestroyed()) { event.reply('lobby-error', 'P2 view unavailable.'); return; }
  if (!url || !url.includes('karabast.net/lobby')) { event.reply('lobby-error', 'Invalid lobby URL.'); return; }
  console.log("Loading lobby URL into View 2...");
  view2.webContents.loadURL(url)
    .then(() => {
      if (!view2 || view2.webContents.isDestroyed()) { console.warn("V2 destroyed during load."); return; }
      console.log('V2 finished loading lobby URL.');
      setCurrentView(2);
      if (mainWindow) {
          isBrowserViewVisible = true; // Ensure visible
          mainWindow.setBrowserView(view2);
          resizeView(view2);
      }
      event.reply('lobby-success');
    })
    .catch(err => { console.error(`Error loading V2 URL ${url}:`, err); event.reply('lobby-error', `Failed load: ${err.message}`); });
});

ipcMain.on('switch-player', () => {
  if (!isBrowserViewVisible) { console.log("Switch player ignored (view hidden)."); return; }
  const nextView = currentView === 1 ? 2 : 1;
  console.log(`Switching player from ${currentView} to ${nextView}`);
  const activeView = nextView === 1 ? view1 : view2;
  if (mainWindow && activeView?.webContents && !activeView.webContents.isDestroyed()) {
    setCurrentView(nextView);
    mainWindow.setBrowserView(activeView);
    resizeView(activeView);
  } else { console.error(`Cannot switch player: View ${nextView} invalid.`); }
});

ipcMain.on('reset-phase', (event) => {
  console.log('Resetting application views...');
  let view1Loaded = false, view2Loaded = false, errors = [];
  const checkCompletion = () => {
      if (!view1Loaded || !view2Loaded) return;
      if (errors.length === 0) {
          console.log("Views reloaded."); setCurrentView(1);
          if (mainWindow) {
              isBrowserViewVisible = true; // Ensure visible
              mainWindow.setBrowserView(view1);
              resizeView(view1);
          }
          event.reply('reset-success');
      } else {
          console.error("Reset error:", errors.join('; '));
          if (mainWindow && view1?.webContents && !view1.webContents.isDestroyed() && !errors.some(e => e.includes("V1"))) {
              console.log("Setting V1 active despite reset errors."); setCurrentView(1);
              isBrowserViewVisible = true;
              mainWindow.setBrowserView(view1); resizeView(view1);
          }
          event.reply('reset-error', `Failed reload: ${errors.join('; ')}`);
      }
  };
  // Reload V1
  if (view1?.webContents && !view1.webContents.isDestroyed()) { view1.webContents.loadURL('https://karabast.net').then(() => { view1Loaded = true; }).catch(err => { errors.push("V1:"+err.message); view1Loaded = true; }).finally(checkCompletion); }
  else { errors.push("V1 unavailable"); view1Loaded = true; checkCompletion(); }
  // Reload V2
  if (view2?.webContents && !view2.webContents.isDestroyed()) { view2.webContents.loadURL('https://karabast.net').then(() => { view2Loaded = true; }).catch(err => { errors.push("V2:"+err.message); view2Loaded = true; }).finally(checkCompletion); }
  else { errors.push("V2 unavailable"); view2Loaded = true; checkCompletion(); }
});

// --- Auto Setup Handler ---
ipcMain.on('auto-setup', async (event, p1Url, p2Url) => {
    console.log("Received 'auto-setup' request.");
    if (currentView !== 1 || !isBrowserViewVisible) {
        console.log("Switching to View 1 and ensuring visibility before auto-setup.");
        const targetView = view1;
         if (mainWindow && targetView?.webContents && !targetView.webContents.isDestroyed()) {
            setCurrentView(1);
            if (!isBrowserViewVisible) { mainWindow.addBrowserView(targetView); isBrowserViewVisible = true; }
            else { mainWindow.setBrowserView(targetView); }
            resizeView(targetView);
            await new Promise(r => setTimeout(r, 300));
        } else { event.reply('auto-setup-error', 'Cannot switch to P1 view.'); return; }
    } else { console.log("Already on View 1 and visible."); }
    const appContext = { view1, view2, mainWindow, clipboard, setCurrentView, resizeView, getCurrentView: () => currentView };
    performAutoSetup(event, p1Url, p2Url, appContext);
});

// --- BrowserView Visibility Handlers ---
ipcMain.on('hide-browser-view', (event) => {
    const activeView = currentView === 1 ? view1 : view2;
    if (mainWindow && activeView) {
        console.log(`Hiding BrowserView ${currentView}`);
        mainWindow.removeBrowserView(activeView);
        isBrowserViewVisible = false;
    } else { console.warn("Could not hide BrowserView."); }
});

ipcMain.on('show-browser-view', (event) => {
    const activeView = currentView === 1 ? view1 : view2;
    if (mainWindow && activeView) {
        console.log(`Showing BrowserView ${currentView}`);
        mainWindow.setBrowserView(activeView); // setBrowserView adds if not present
        isBrowserViewVisible = true;
        resizeView(activeView);
    } else { console.warn("Could not show BrowserView."); }
});


// --- Electron App Lifecycle ---
app.whenReady().then(createWindow);
app.on('browser-window-focus', registerSpaceShortcut);
app.on('browser-window-blur', unregisterSpaceShortcut);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') { app.quit(); } });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) { createWindow(); } registerSpaceShortcut(); });
app.on('will-quit', () => { unregisterSpaceShortcut(); });
app.on('gpu-process-crashed', (event, killed) => console.error(`GPU crash! Killed: ${killed}`));
app.on('renderer-process-crashed', (event, webContents, killed) => { /* ... error logging ... */ });
