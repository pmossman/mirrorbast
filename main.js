// main.js
const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  clipboard,
} = require('electron');
const path = require('path');

const TOOLBAR_HEIGHT = 40;

let mainWindow;
let view1, view2;
let currentView = 1;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 1) load your UI
  mainWindow.loadFile('index.html');

  // 2) create two isolated sessions
  view1 = new BrowserView({ webPreferences: { partition: 'persist:player1' } });
  view2 = new BrowserView({ webPreferences: { partition: 'persist:player2' } });

  // 3) once the UI is ready, attach player-1’s view below the toolbar
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.setBrowserView(view1);
    resizeView(view1);
    view1.webContents.loadURL('https://karabast.net');
  });
}

function resizeView(view) {
  // use contentBounds so we don’t overlap the toolbar
  const { width, height } = mainWindow.getContentBounds();
  view.setBounds({
    x: 0,
    y: TOOLBAR_HEIGHT,
    width,
    height: height - TOOLBAR_HEIGHT,
  });
  view.setAutoResize({ width: true, height: true });
}

app.whenReady().then(createWindow);

ipcMain.on('switch-player', () => {
  const next = currentView === 1 ? view2 : view1;
  mainWindow.setBrowserView(next);
  resizeView(next);
  currentView = currentView === 1 ? 2 : 1;
});

ipcMain.on('join-lobby', () => {
  const url = clipboard.readText().trim();
  if (!url.startsWith('http')) {
    console.error('Clipboard does not contain a valid URL:', url);
    return;
  }
  view2.webContents.loadURL(url);
  mainWindow.setBrowserView(view2);
  resizeView(view2);
  currentView = 2;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (!BrowserWindow.getAllWindows().length) createWindow();
});
