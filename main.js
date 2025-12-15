import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import PhoneMote from './PhoneMote.js';


// --- init electron app ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.on('window-all-closed', () => (process.platform !== 'darwin') && app.quit() );
app.whenReady().then(() =>{
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        resizable: false,
        autoHideMenuBar: true,
        menuBarVisible: false,
        kiosk: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    win.loadURL('http://localhost:5500/web/host/');
});


// --- electron IPC handlers ---
ipcMain.handle('sendPacket', (_event, slot, data) => {
    console.log('got packet from:', slot, 'with data:', data);
    return {
        ok: true,
        slot: slot,
        timestamp: Date.now(),
    };
});
ipcMain.handle('addPlayer', (_event) => {
    return PhoneMote.connectNewPhone();
});
ipcMain.handle('removePlayer', (_event, slot) => {
    return PhoneMote.disconnect(slot);
});
