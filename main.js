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

  // Create BrowserViews for both players
  view1 = new BrowserView({ webPreferences: { partition: 'persist:player1', contextIsolation: true } });
  view2 = new BrowserView({ webPreferences: { partition: 'persist:player2', contextIsolation: true } });

  mainWindow.setBrowserView(view1);
  resizeView(view1);
  view1.webContents.loadURL('https://karabast.net');

  // Open devtools for logging
  view1.webContents.openDevTools({ mode: 'detach' });
  view1.webContents.on('console-message', (e, level, message) => console.log('[VIEW1]', message));

  mainWindow.on('resize', () => resizeView(currentView === 1 ? view1 : view2));
  mainWindow.on('focus', () => {
    if (!globalShortcut.isRegistered('Space')) {
      globalShortcut.register('Space', () => {
        if (inGameplay) mainWindow.webContents.send('trigger-switch');
      });
    }
  });
  mainWindow.on('blur', () => {
    if (globalShortcut.isRegistered('Space')) globalShortcut.unregister('Space');
  });
}

function resizeView(view) {
  const [width, height] = mainWindow.getContentSize();
  view.setBounds({ x: SIDEBAR_WIDTH, y: HEADER_HEIGHT, width: width - SIDEBAR_WIDTH, height: height - HEADER_HEIGHT });
  view.setAutoResize({ width: true, height: true });
}

function sendPreview() {
  const other = currentView === 1 ? view2 : view1;
  other.webContents.capturePage().then(img => mainWindow.webContents.send('preview-updated', img.toDataURL()));
}

// IPC handlers
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
  view2.webContents.loadURL(url);
});

ipcMain.on('switch-player', () => {
  currentView = currentView === 1 ? 2 : 1;
  const active = currentView === 1 ? view1 : view2;
  mainWindow.setBrowserView(active);
  resizeView(active);
  sendPreview();
});

ipcMain.on('reset-phase', e => {
  view1.webContents.loadURL('https://karabast.net');
  currentView = 1;
  inGameplay = false;
  mainWindow.setBrowserView(view1);
  resizeView(view1);
  e.reply('reset-success');
  mainWindow.webContents.send('preview-updated', '');
});

// Auto setup flow with explicit focus + change event
ipcMain.on('auto-setup', (e, p1Url, p2Url) => {
  const delay = ms => new Promise(res => setTimeout(res, ms));
  view1.webContents
    .executeJavaScript(`
      console.log('Step1: Click Create Lobby');
      Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.trim() === 'Create Lobby')
        ?.click();
    `)
    
    .then(() =>
      view1.webContents.executeJavaScript(`
        console.log('Step2: Select Private');
        Array.from(document.querySelectorAll('input[type=radio]'))
          .find(r => r.value === 'Private')
          ?.click();
      `)
    )
    
    .then(() =>
      view1.webContents.executeJavaScript(`
        console.log('Step3: Fill deck input');
        const input = Array.from(document.querySelectorAll('input[type=text]')).find(el=>el.offsetParent!==null);
        if (input) {
          console.log('Filling input with', ${JSON.stringify(p1Url)});
          input.focus();
          (function(){
            const input = Array
              .from(document.querySelectorAll('input[type=text]'))
              .find(el => el.offsetParent !== null);
            if (!input) return;

            // 1) Grab the native setter (React will see this)
            const nativeSetter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype, 'value'
            ).set;

            // 2) Call it on your element
            nativeSetter.call(input, ${JSON.stringify(p1Url)});

            // 3) Dispatch React’s preferred events
            input.dispatchEvent(new Event('input',  { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('Deck URL set via native setter');
          })();

        } else {
          console.error('Input not found');
        }
      `)
    )
    
    
    
    .then(() =>
      view1.webContents.executeJavaScript(`
        console.log('Step4: Click Create Game');
        Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.trim() === 'Create Game')
          ?.click();
      `)
    )
    
    .then(
      () =>
        new Promise(resolve =>
          view1.webContents.once('did-navigate', resolve)
        )
    )
    
    .then(() =>
      view1.webContents.executeJavaScript(`
        console.log('Step5: Click Copy Invite Link');
        Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.trim() === 'Copy Invite Link')
          ?.click();
      `)
    )
    
    .then(() => {
      console.log('Step6: Read clipboard and auto join');
      const link = clipboard.readText().trim();
      view2.webContents.loadURL(link);
      mainWindow.setBrowserView(view2);
      resizeView(view2);
      currentView = 2;
      inGameplay = true;
      sendPreview();
      e.reply('auto-setup-done');
    });
});


app.whenReady().then(createWindow);
app.on('window-all-closed', () => { globalShortcut.unregisterAll(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });