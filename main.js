import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import FONEMOTE from './PhoneMote.js';
const PhoneMote = new FONEMOTE(true);

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

function printClean(val) {
    if (typeof val !== 'number') console.log(val);
    else {
        if (val >= 0) console.log(' '+val.toFixed(2));
        else console.log(val.toFixed(2));
    }
}

// --- electron IPC handlers ---
ipcMain.handle('init', (_event) => {
    return PhoneMote.clear();
});
ipcMain.handle('sendPacket', (_event, slot, data) => {
    try {
        printClean(data.Gyroscope_Yaw);
          
        return PhoneMote.setPacket(slot, data);
    } catch (error) {
        return false;
    }
});
ipcMain.handle('addPlayer', (_event) => {
    return PhoneMote.connectNewPhone();
});
ipcMain.handle('removePlayer', (_event, slot) => {
    return PhoneMote.disconnect(slot);
});
