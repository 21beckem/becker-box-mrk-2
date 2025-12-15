// import { app, BrowserWindow , ipcMain } from 'electron';
// import relativePath from './relativePath.js';

// function createPreloadScript() {
//     const textData = 'alert("Hello, world!")';
//     const mimeType = 'text/plain;charset=utf-8;base64';
//     // The unescape(encodeURIComponent(data)) pattern is used for robust character encoding
//     return `data:${mimeType},${btoa(unescape(encodeURIComponent(textData)))}`;
// }

// app.on('ready', () => {
//     const win = new BrowserWindow({
//         width: 900,
//         height: 700,
//         resizable: false,
//         autoHideMenuBar: true,
//         menuBarVisible: false,
//         kiosk: false,
//         webPreferences: {
//             preload: relativePath('./preload.js'),
//             nodeIntegration: true
//         }
//     });

//     // Load a remote URL
//     win.loadURL('http://localhost:5500/web/host/');
// });

// app.on('window-all-closed', () => {
//     if (process.platform !== 'darwin') {// dont on mac
//         app.quit();
//     }
// });

// ipcMain.on('set-title', (event, title) => {
//     console.log(event, title);
// });


import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadURL('http://localhost:5500/web/host/');
}

ipcMain.handle('packet', (_event, slot, data) => {
  console.log('got packet from:', slot, 'with data:', data);
  return {
    ok: true,
    slot: slot,
    timestamp: Date.now(),
  };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
