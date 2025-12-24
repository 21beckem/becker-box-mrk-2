import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';

let dolphinProcess = null;

let settingGamePath = false;
async function setGameFilePath(PhoneMote, path) {
    if (!path) path = '';
    if (settingGamePath) return;
    settingGamePath = true;
    
    fs.writeFileSync('dolphin\\diskPath.txt', path.trim());
    PhoneMote.setDataAttr(0, 'ChangeDisc', 1);
    await new Promise(r => setTimeout(r, 500));
    PhoneMote.setDataAttr(0, 'ChangeDisc', 0);
    await new Promise(r => setTimeout(r, 1500));
    fs.rmSync('dolphin\\diskPath.txt');

    settingGamePath = false;
}
async function checkWindowByTitle(partialTitle) {
    return new Promise((resolve, reject) => {
        const command = `powershell -Command "if (Get-Process | Where-Object { $_.MainWindowTitle -like '*${partialTitle}*' }) { Exit 0 } else { Exit 1 }"`;
    
        exec(command, (error, stdout, stderr) => {
            resolve(!error);
        });
    });
}

export async function startWii() {
    // check if there already is an instance running, if so, do nothing
    if (dolphinProcess) return focusOnDolphin();
    
    dolphinProcess = spawn('dolphin\\Dolphin.exe', ['-b', '-n', '0000000100000002']); // wii menu

    // wait until that window exists
    while (!(await isOnWiiMenu())) {}

    focusOnDolphin();
}
export function focusOnDolphin() {
    if (!dolphinProcess) return;

    const command = `nircmd.exe win activate ititle "Dolphin 2509-582-dirty | JIT64 SC" && nircmd.exe win max ititle "Dolphin 2509-582-dirty | JIT64 SC"`;
    exec(command);
    // setTimeout(()=> exec(command),  500);
    // setTimeout(()=> exec(command), 1000);
    // setTimeout(()=> exec(command), 1500);
}

export function changeDisc(PhoneMote, path) {
    PhoneMote.enable();
    if (!dolphinProcess) return;

    // wait a little bit to allow the remote to re-enable so that the "change dic" command can be sent via PhoneMote
    setTimeout(() => {
        setGameFilePath(PhoneMote, path);
    }, 500);
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
export function isOnWiiMenu() {
    return checkWindowByTitle('0000000100000002');
}

if (import.meta.main) {
    // test code here
    // setGameFilePath(null, 'C:\\Users\\21bec\\OneDrive - BYU-Idaho\\Documents\\Wii Sports (USA).rvz');
    // console.log(getDiscList());
    console.log( await checkWindowByTitle('0000000100000002') );
}