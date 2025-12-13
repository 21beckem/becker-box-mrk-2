const fs = require('fs');

// read me.txt and dolphin.txt and split them by lines
const meLog = fs.readFileSync('logs/me.txt', 'utf-8')
    .split('\n')
    .map(line => {
        let s = line.split(' | ')
        return {
            type: s[0].split(':')[1].trim(),
            crc: s[1].split(':')[1].trim(),
            message: s[2].split(':')[1].trim(),
            line
        };
    });
const dolphinLog = fs.readFileSync('logs/dolphin.txt', 'utf-8')
    .split('\n')
    .map(line => {
        let s = line.split('bad CRC in header: got ')[1];
        s = s.split(', expected ');
        return {
            got: s[0].trim(),
            expected: s[1].replaceAll('\r', '').trim(),
            line
        };
    });

let didWork = [];
let didntWork = [];

meLog.forEach(m => {
    if (dolphinLog.some(d => d.got === m.crc)) {
        let d = dolphinLog.find(d => d.got === m.crc);
        didntWork.push({
            me: m,
            dolphin: d,
            fullLine: `me: ${m.line} $$$ dolphin: ${d.line}`
        });
    } else {
        didWork.push({
            me: m,
            dolphin: null,
            fullLine: `me: ${m.line} $$$ dolphin: null`
        });
    }
});

// write those to files
fs.writeFileSync('logs/didWork.txt', didWork.map(d => d.fullLine).join('\n'));
fs.writeFileSync('logs/didntWork.txt', didntWork.map(d => d.fullLine).join('\n'));

fs.writeFileSync('logs/stats.txt', [
    `meLog: ${meLog.length}`,
    `dolphinLog: ${dolphinLog.length}`,
    `didWork: ${didWork.length}`,
    `didntWork: ${didntWork.length}`,
    `percentage that did work: ${didWork.length / (didWork.length + didntWork.length) * 100}%`
].join('\n'));