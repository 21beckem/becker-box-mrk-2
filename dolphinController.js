import { spawn } from 'child_process';
import fs from 'fs';

let dolphinProcess = null;

function sendText(text) {
    text = text
        .replaceAll('"', '""')
        .replaceAll('+', '{+}')
        .replaceAll('^', '{^}')
        .replaceAll('%', '{%}')
        .replaceAll('~', '{~}')
        .replaceAll('(', '{(}')
        .replaceAll(')', '{)}');
    fs.writeFileSync('commander.vbs', `
        set shell = CreateObject("WScript.Shell")
        shell.SendKeys "${text}"
    `.trim());
    spawn('wscript.exe', ['commander.vbs']);
}
async function setGameFilePath(PhoneMote, path) {
    PhoneMote.setDataAttr(0, 'ChangeDisk', 1);
    setTimeout(() => PhoneMote.setDataAttr(0, 'ChangeDisk', 0), 500);
    await new Promise(r => setTimeout(r, 1500));
    sendText(path+'{ENTER}');
}

export function startWii() {
    // check if there already is an instance running, if so, do nothing
    if (dolphinProcess) return;
    
    dolphinProcess = spawn('dolphin\\Dolphin.exe', ['-b', '-n', '0000000100000002']);
}

export function changeDisk(PhoneMote) {
    if (!dolphinProcess) return;

    setGameFilePath(PhoneMote, 'C:\\Users\\21bec\\OneDrive - BYU-Idaho\\Documents\\Wii Sports (USA).rvz');
}

if (import.meta.main) {
    setTimeout(() => {
        sendText('C:\\Users\\21bec\\OneDrive - BYU-Idaho\\Documents\\Wii Sports (USA).rvz{ENTER}');
    }, 1000);
}