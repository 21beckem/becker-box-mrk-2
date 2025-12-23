import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

let dolphinProcess = null;

let settingGamePath = false;
async function setGameFilePath(PhoneMote, path) {
    if (settingGamePath) return;
    settingGamePath = true;
    
    fs.writeFileSync('dolphin\\diskPath.txt', path.trim());
    PhoneMote.setDataAttr(0, 'ChangeDisk', 1);
    await new Promise(r => setTimeout(r, 500));
    PhoneMote.setDataAttr(0, 'ChangeDisk', 0);
    await new Promise(r => setTimeout(r, 1500));
    fs.rmSync('dolphin\\diskPath.txt');

    settingGamePath = false;
}

export function startWii() {
    // check if there already is an instance running, if so, do nothing
    if (dolphinProcess) return;
    
    dolphinProcess = spawn('dolphin\\Dolphin.exe', ['-b', '-n', '0000000100000002']); // wii menu
}

export function changeDisk(PhoneMote, path) {
    PhoneMote.enable();
    if (!dolphinProcess) return;

    setGameFilePath(PhoneMote, path);
}
export function getDiscList() {
    if (!fs.existsSync('games\\')) return [];
    let list = fs.readdirSync('games\\');
    const fileTypes = ['elf', 'dol', 'gcm', 'bin', 'iso', 'tgc', 'wbfs', 'ciso', 'gcz', 'wia', 'rvz', 'wad', 'dff', 'm3u', 'json'];
    list = list.filter(file => fileTypes.some(type => file.endsWith('.'+type)));
    list = list.map(file => {
        return {
            name: file.split('.').toSpliced(-1).join('.'),
            path: path.resolve('games\\', file)
        }
    })
    return list;
}

if (import.meta.main) {
    // test code here
    // setGameFilePath(null, 'C:\\Users\\21bec\\OneDrive - BYU-Idaho\\Documents\\Wii Sports (USA).rvz');
    console.log(getDiscList());
}