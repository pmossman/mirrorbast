const { app, BrowserWindow, BrowserView, ipcMain, clipboard, globalShortcut } = require('electron');
const path = require('path');

const HEADER_HEIGHT = 60;
const SIDEBAR_WIDTH = 300;

let mainWindow;
let view1, view2;
let currentView = 1;
let inGameplay = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');

  // Create game views
  view1 = new BrowserView({ webPreferences: { partition: 'persist:player1', contextIsolation: true } });
  view2 = new BrowserView({ webPreferences: { partition: 'persist:player2', contextIsolation: true } });

  // Attach Player1 initially
  mainWindow.setBrowserView(view1);
  resizeView(view1);
  view1.webContents.loadURL('https://karabast.net');

  // Adjust on window resize
  mainWindow.on('resize', () => {
    const active = currentView === 1 ? view1 : view2;
    resizeView(active);
  });

  // Register global Space handler once
  mainWindow.on('focus', () => {
    if (!globalShortcut.isRegistered('Space')) {
      globalShortcut.register('Space', () => {
        if (inGameplay) {
          mainWindow.webContents.send('trigger-switch');
        }
      });
    }
  });
  mainWindow.on('blur', () => {
    if (globalShortcut.isRegistered('Space')) {
      globalShortcut.unregister('Space');
    }
  });
}

function resizeView(view) {
  const [contentW, contentH] = mainWindow.getContentSize();
  view.setBounds({
    x: SIDEBAR_WIDTH,
    y: HEADER_HEIGHT,
    width: contentW - SIDEBAR_WIDTH,
    height: contentH - HEADER_HEIGHT,
  });
  view.setAutoResize({ width: true, height: true });
}

function sendPreview() {
  const inactive = currentView === 1 ? view2 : view1;
  inactive.webContents.capturePage().then(img => {
    mainWindow.webContents.send('preview-updated', img.toDataURL());
  });
}

ipcMain.handle('read-clipboard', () => clipboard.readText());

ipcMain.handle('fetch-metadata', async (_, url) => {
  try {
    const res = await fetch(`https://karabast.net/api/swudbdeck?deckLink=${encodeURIComponent(url)}`);
    const data = await res.json();
    return { name: data.metadata.name, author: data.metadata.author };
  } catch {
    return { name: 'Unknown', author: 'Unknown' };
  }
});

ipcMain.on('join-lobby', (e, url) => {
  view2.webContents.once('did-finish-load', () => {
    currentView = 2;
    inGameplay = true;
    mainWindow.setBrowserView(view2);
    resizeView(view2);
    e.reply('lobby-success');
    sendPreview();
  });
  view2.webContents.once('did-fail-load', (_e, _code, desc) => {
    e.reply('lobby-error', desc);
  });
  view2.webContents.loadURL(url);
});

ipcMain.on('switch-player', () => {
  currentView = currentView === 1 ? 2 : 1;
  const active = currentView === 1 ? view1 : view2;
  mainWindow.setBrowserView(active);
  resizeView(active);
  sendPreview();
});

ipcMain.on('reset-phase', (e) => {
  view1.webContents.loadURL('https://karabast.net');
  currentView = 1;
  inGameplay = false;
  mainWindow.setBrowserView(view1);
  resizeView(view1);
  e.reply('reset-success');
  mainWindow.webContents.send('preview-updated', '');
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { globalShortcut.unregisterAll(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});