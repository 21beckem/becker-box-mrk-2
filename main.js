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
    try {
        return PhoneMote.setPacket(slot, {
            Home: data.Home,
            Plus: data.Plus,
            Minus: data.Minus,
            A: data.A,
            B: data.B,
            One: data.One,
            Two: data.Two,
            PadN: data.PadN,
            PadS: data.PadS,
            PadE: data.PadE,
            PadW: data.PadW,
            AccelerometerX: data.AccelerometerX,
            AccelerometerY: data.AccelerometerY,
            AccelerometerZ: data.AccelerometerZ,
            Gyroscope_Pitch: data.Gyroscope_Pitch,
            Gyroscope_Yaw: data.Gyroscope_Yaw,
            Gyroscope_Roll: data.Gyroscope_Roll
        });
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
