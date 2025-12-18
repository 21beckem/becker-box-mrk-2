export function createTestInfoPacket() {
    const makeCrcTable = (() => {
    const table = new Uint32Array(256);
    const POLY = 0xEDB88320 >>> 0;
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (POLY ^ (c >>> 1)) >>> 0 : (c >>> 1) >>> 0;
        }
        table[i] = c >>> 0;
    }
    return table;
    })();
    function crc32(buf) {
    // buf: Buffer
    let crc = 0xFFFFFFFF >>> 0;
    for (let i = 0; i < buf.length; i++) {
        crc = (makeCrcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    let p = Buffer.alloc(31);

    p.write('DSUS', 0, 4, 'ascii');  // magic string
    p.writeUInt16LE(1001, 4);        // protocol version
    p.writeUInt16LE(15, 6);          // packet length without header
    p.writeUInt32LE(0, 8);           // CRC32 placeholder
    p.writeUInt32LE(1, 12);          // server id

    p.writeUInt32LE(0x100001, 16);   // event type (include in packet length)

    p.writeUInt8(0, 20);             // slot number
    p.writeUInt8(2, 21);             // slot state
    p.writeUInt8(2, 22);             // device model (2=full gyro)
    p.writeUInt8(2, 23);             // connection type (2=bluetooth)
    // mac address (leaving it zeroed out) (length=6)
    p.writeUInt8(0x05, 30);          // battery level (5=full)

    // Calculate and write CRC32
    let crc = crc32(p);
    p.writeUInt32LE(crc >>> 0, 8);

    return p;
}
console.log('Test info packet buffer:\n' + JSON.stringify(Array.from(createTestInfoPacket())) );