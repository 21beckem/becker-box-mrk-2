import dgram from 'dgram';

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
export function createTestInfoPacket() {
    let p = Buffer.alloc(32, 0);

    p.write('DSUS', 0, 4, 'ascii');  // magic string
    p.writeUInt16LE(1001, 4);        // protocol version
    p.writeUInt16LE(16, 6);          // packet length without header
    // crc left zero for now
    p.writeUInt32LE(0, 12);          // server id

    p.writeUInt32LE(0x100001, 16);   // event type (include in packet length)

    p.writeUInt8(0, 20);             // slot number
    p.writeUInt8(2, 21);             // slot state
    p.writeUInt8(2, 22);             // device model (2=full gyro)
    p.writeUInt8(2, 23);             // connection type (2=bluetooth)
    // mac address (leaving it zeroed out) (length=6)
    p.writeUInt8(5, 30);          // battery level (5=full)

    // Calculate and write CRC32
    let crc = crc32(p);
    p.writeUInt32LE(crc >>> 0, 8);

    return p;
}
export function createActualDataPacket() {
    let p = Buffer.alloc(100, 0);

    p.write('DSUS', 0, 4, 'ascii');  // magic string
    p.writeUInt16LE(1001, 4);        // protocol version
    p.writeUInt16LE(84, 6);          // packet length without header
    // crc left zero for now
    p.writeUInt32LE(0, 12);          // server id

    p.writeUInt32LE(0x100002, 16);   // event type (include in packet length)

    /* slot info */
    p.writeUInt8(0, 20);             // slot number
    p.writeUInt8(2, 21);             // slot state
    p.writeUInt8(2, 22);             // device model (2=full gyro)
    p.writeUInt8(2, 23);             // connection type (2=bluetooth)
    // mac address (leaving it zeroed out) (length=6)
    p.writeUInt8(5, 30);          // battery level (5=full)

    /* controller data */
    // Unsigned 8-bit  | Is controller connected (1 if connected, 0 if not)
    // Unsigned 32-bit | Packet number (for this client)
    // Bitmask         | D-Pad Left, D-Pad Down, D-Pad Right, D-Pad Up, Options (?), R3, L3, Share (?)
    // Bitmask         | Y, B, A, X, R1, L1, R2, L2
    // Unsigned 8-bit  | HOME Button (0 or 1)
    // Unsigned 8-bit  | Touch Button (0 or 1)
    // Unsigned 8-bit  | Left stick X (plus rightward)
    // Unsigned 8-bit  | Left stick Y (plus upward)
    // Unsigned 8-bit  | Right stick X (plus rightward)
    // Unsigned 8-bit  | Right stick Y (plus upward)
    // Unsigned 8-bit  | Analog D-Pad Left
    // Unsigned 8-bit  | Analog D-Pad Down
    // Unsigned 8-bit  | Analog D-Pad Right
    // Unsigned 8-bit  | Analog D-Pad Up
    // Unsigned 8-bit  | Analog Y
    // Unsigned 8-bit  | Analog B
    // Unsigned 8-bit  | Analog A
    // Unsigned 8-bit  | Analog X
    // Unsigned 8-bit  | Analog R1
    // Unsigned 8-bit  | Analog L1
    // Unsigned 8-bit  | Analog R2
    // Unsigned 8-bit  | Analog L2
    // Complex         | First touch
    // Complex         | Second touch
    // Unsigned 64-bit | Motion data timestamp in microseconds, update only with accelerometer (but not gyro only) changes
    // Float           | Accelerometer X axis
    // Float           | Accelerometer Y axis
    // Float           | Accelerometer Z axis
    // Float           | Gyroscope pitch
    // Float           | Gyroscope yaw
    // Float           | Gyroscope roll



}

















const server = dgram.createSocket('udp4');
// Bind the socket
server.bind(26760, '0.0.0.0', () => {
    console.log(`DSU server is running on 0.0.0.0:26760`);
});
server.on('message', (message, rinfo) => {
    try {
        const { decodedType, encodedType, msgData } = decodePacket(message);
        
        switch (decodedType) {
            case 'Protocol version information':
                console.log('Protocol version information');
                break;

            case 'Information about connected controllers':
                console.log('Information about connected controllers');
                let packet = createTestInfoPacket();
                server.send(packet, 0, packet.length, rinfo.port, rinfo.address);
                break;

            case 'Actual controllers data':
                console.log('Actual controllers data');
                break;

            case '(Unofficial) Information about controller motors':
                // TODO
                break;

            case '(Unofficial) Rumble controller motor':
                // TODO
                break;

            default:
                console.log("Unknown packet type:", decodedType);
        }
    } catch (err) {
        console.error("Error handling client:", err);
    }
});
function decodePacket(buf) {
    const MSG_TYP = {
        0x100000: 'Protocol version information',
        0x100001: 'Information about connected controllers',
        0x100002: 'Actual controllers data',
        0x110001: '(Unofficial) Information about controller motors', // unofficial
        0x110002: '(Unofficial) Rumble controller motor'              // unofficial
    };
    // const magicString       = buf.toString('ascii', 0, 4);
    // const protocolVersion   = buf.readUInt16LE(4);
    // const messageLength     = buf.readUInt16LE(6);
    // const crc               = buf.readUInt32LE(8);
    // const clientId          = buf.readUInt32LE(12);
    const messageType       = buf.readUInt32LE(16);
    // console.log(magicString, protocolVersion, messageLength, crc, clientId, messageType);
    

    return { decodedType: MSG_TYP[messageType], encodedType: messageType, msgData: buf.slice(20) };
}