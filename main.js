import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import * as DolphinController from './dolphinController.js';
import FONEMOTE from './PhoneMote.js';
const PhoneMote = new FONEMOTE(false);

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


// --- Useful functions ---
function focusOnElectron() {
    PhoneMote.disable();
    bringWindowToFront();
}
function focusOnDolphin() {
    PhoneMote.enable();
    DolphinController.focusOnDolphin();
}
function bringWindowToFront() {
    const win = BrowserWindow.getAllWindows()[0];
    if (win.isMinimized()) win.restore(); // Optional: restore if minimized
    win.setAlwaysOnTop(true);
    win.show(); // Ensure it is visible
    win.setAlwaysOnTop(false);
}

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
        // printClean(data.Gyroscope_Yaw);
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
ipcMain.handle('startWii', (_event) => {
    DolphinController.startWii();
    return true;
});
ipcMain.handle('startDiscSelection', async (_event) => {
    if (await DolphinController.isOnWiiMenu()) {
        focusOnElectron();
        return DolphinController.getDiscList();
    }
    return false;
});
ipcMain.handle('changeDisc', (_event, path) => {
    DolphinController.focusOnDolphin();
    DolphinController.changeDisc(PhoneMote, path);
    return true;
});
