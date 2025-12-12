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
debugger;



// parse both logs into useable arrays