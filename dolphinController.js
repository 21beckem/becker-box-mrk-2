import { spawn } from 'child_process';
import fs from 'fs';

let dolphinProcess = null;

async function setGameFilePath(PhoneMote, path) {
    fs.writeFileSync('dolphin\\diskPath.txt', path.trim());
    PhoneMote.setDataAttr(0, 'ChangeDisk', 1);
    await new Promise(r => setTimeout(r, 100));
    PhoneMote.setDataAttr(0, 'ChangeDisk', 0);
    await new Promise(r => setTimeout(r, 1500));
    fs.rmSync('dolphin\\diskPath.txt');
}

export function startWii() {
    // check if there already is an instance running, if so, do nothing
    if (dolphinProcess) return;
    
    dolphinProcess = spawn('dolphin\\Dolphin.exe', ['-b', '-n', '0000000100000002']); // wii menu
}

export function changeDisk(PhoneMote) {
    if (!dolphinProcess) return;

    setGameFilePath(PhoneMote, 'C:\\Users\\21bec\\OneDrive - BYU-Idaho\\Documents\\Wii Sports (USA).rvz');
}

if (import.meta.main) {
    // test code here
    setGameFilePath(null, 'C:\\Users\\21bec\\OneDrive - BYU-Idaho\\Documents\\Wii Sports (USA).rvz');
}