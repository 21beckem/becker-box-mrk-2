import dgram from 'dgram';
import fs from 'fs';

class logger {
    static enabled = true;
    static fileName = 'logs/' + (new Date()).toISOString().replace('T','_').slice(0,-5) + '.log';
    static string(msg) {
        if (!this.enabled) return;
        fs.appendFileSync(this.fileName, `\n${msg}`, (err) => {
            if (err) console.error('Error writing to log file:', err);
        });
    }
    static packet(buf) {
        buf = Buffer.from(buf);
        if (!this.enabled) return;
        let magic = buf.toString('ascii', 0, 4);
        let protocolVersion = buf.readUInt16LE(4);
        let messageLength = buf.readUInt16LE(6);
        let crc = buf.readUInt32LE(8);
        let encodedMsgType = buf.readUInt32LE(16);
        let packetData = buf.slice(20);

        let logMessage = `type: ${encodedMsgType.toString(16).padStart(8, '0')} | crc: ${crc.toString(16).padStart(8, '0')} | message: ${JSON.stringify(Array.from(Buffer.concat([response1, packetData])))}`;
        this.string(JSON.stringify(msg));
    }
}


// Config (match Arduino defaults)
const UDP_PORT = 26760;
const PROTOCOL_VERSION = 1001;
const INFO_PACKET_TOTAL = 32;
const DATA_PACKET_TOTAL = 100;
const SAMPLE_INTERVAL_MS = 10;
const macAddress = [0x00,0x00,0x00,0x00,0x00,0x00]; // same default as Arduino sketch (zeros)
const DISCONNECT_TIMEOUT_MS = 5000;

// State
let startHrTime = process.hrtime.bigint();

// --- CRC32 implementation (standard IEEE 802.3) ---
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

// --- Helper: get microseconds since server start, as 32-bit value (lower 32 bits) ---
function micros32() {
  const deltaNs = Number(process.hrtime.bigint() - startHrTime); // nanoseconds (may exceed Number range eventually; OK for tests)
  const micros = Math.floor(deltaNs / 1000);
  return micros >>> 0;
}

const DefaultControllerState = {
    connectedState: 0,
    packetNumber: 0,
    data: {
        Home: 0,
        Plus: 0,
        Minus: 0,
        A: 0,
        B: 0,
        One: 0,
        Two: 0,
        PadN: 0,
        PadS: 0,
        PadE: 0,
        PadW: 0,
        AccelerometerX: 0.0,
        AccelerometerY: 0.0,
        AccelerometerZ: 0.0,
        Gyroscope_Pitch: 0.0,
        Gyroscope_Yaw: 0.0,
        Gyroscope_Roll: 0.0
    }
}

class DSUServer {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.clientAddress = null;
        this.controllerStates = [];
        this.controllerStates[0] = {...DefaultControllerState};
        this.controllerStates[1] = {...DefaultControllerState};
        this.controllerStates[2] = {...DefaultControllerState};
        this.controllerStates[3] = {...DefaultControllerState};
        
        this.serverSocket = dgram.createSocket('udp4');
    }
    static MSG_TYP = {
        0x100000: 'Protocol version information',
        0x100001: 'Information about connected controllers',
        0x100002: 'Actual controllers data',
        0x110001: '(Unofficial) Information about controller motors', // unofficial
        0x110002: '(Unofficial) Rumble controller motor'              // unofficial
    };

    start(keepSendingData) {
        // Bind the socket
        this.serverSocket.bind(this.port, this.host, () => {
            console.log(`DSU server is running on ${this.host}:${this.port}`);
        });

        if (keepSendingData)
            this.keepSendingData();

        // Main receive loop
        this.serverSocket.on('message', (message, rinfo) => {
            try {
                this.clientAddress = rinfo;
                const { decodedType, encodedType, msgData } = this.decodePacket(message);
                
                switch (decodedType) {
                    case 'Protocol version information':
                        this.versionRequest(encodedType, msgData);
                        break;

                    case 'Information about connected controllers':
                        // console.log('Information about connected controllers');
                        this.controllerStates.forEach((c, i) => {
                            this.sendPacket( this.makeInfoPacket(i) );
                        });
                        break;

                    case 'Actual controllers data':
                        let slot = msgData.readUInt8(1);
                        this.sendPacket( this.makeDataPacket(slot) );
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
    }
    keepSendingData() {
        if (this.clientAddress) {
            this.controllerStates.forEach((c, slot) => {
                if (c.connectedState === 2)
                    this.sendPacket( this.makeDataPacket(slot) );
            });
        }
        setTimeout(() => this.keepSendingData(), SAMPLE_INTERVAL_MS);
    }

    decodePacket(buf) {
        // const magicString       = buf.toString('ascii', 0, 4);
        // const protocolVersion   = buf.readUInt16LE(4);
        // const messageLength     = buf.readUInt16LE(6);
        // const crc               = buf.readUInt32LE(8);
        // const clientId          = buf.readUInt32LE(12);
        const messageType       = buf.readUInt32LE(16);
        // console.log(magicString, protocolVersion, messageLength, crc, clientId, messageType);
        

        return { decodedType: DSUServer.MSG_TYP[messageType], encodedType: messageType, msgData: buf.slice(20) };
    }

    versionRequest(encodedMsgType, msgData) {
        // <H> → 2-byte little-endian unsigned short (1001)
        const packetData = Buffer.alloc(2);
        packetData.writeUInt16LE(1001, 0);

        const finalPacket = this.addHeader(encodedMsgType, packetData);
        this.sendPacket(finalPacket);
    }
    makeInfoPacket(slotNumber) {
        const out = Buffer.alloc(INFO_PACKET_TOTAL, 0);

        // Magic "DSUS"
        out.write('DSUS', 0, 4, 'ascii');

        // Protocol version (1001) -> bytes 4..5 as LE
        out.writeUInt16LE(PROTOCOL_VERSION, 4);

        // Packet length without header plus length of event type (16)
        // Arduino used output[6] = (uint8_t)(16); output[7] = 0;
        out.writeUInt16LE(16, 6);

        // CRC32 field bytes 8..11 are zeroed for CRC calculation (already zero in alloc)

        // Server id bytes 12..15 -- Arduino sets to 0
        out.writeUInt32LE(0, 12);

        // Event type: Information about connected controllers (0x00100001)
        // Write as 32-bit little-endian so bytes are [0x01, 0x00, 0x10, 0x00]
        out.writeUInt32LE(0x00100001, 16);

        const c = this.controllerStates[slotNumber];

        out[20] = slotNumber & 0xFF;
        out[21] = c.connectedState & 0xFF;
        out[22] = 0x02; // device model full gyro (2)
        out[23] = 0x02; // connection type bluetooth (2)
        // MAC
        for (let i = 0; i < 6; i++) out[24 + i] = macAddress[i] & 0xFF;
        out[30] = 0x05; // battery full
        out[31] = 0x00; // termination byte per Arduino code

        // Compute CRC32 over the full 32 bytes (with CRC bytes still zero) and write LE uint32 into bytes 8..11
        const checksum = crc32(out);
        out.writeUInt32LE(checksum >>> 0, 8);

        return out;
    }
    makeDataPacket(slotNumber) {
        const c = this.controllerStates[slotNumber];
        let packetCount = (c.packetNumber + 1) >>> 0;
        c.packetNumber = packetCount;
        let timestamp32 = micros32();

        const out = Buffer.alloc(DATA_PACKET_TOTAL, 0);

        // Magic
        out.write('DSUS', 0, 4, 'ascii');

        // Protocol version
        out.writeUInt16LE(PROTOCOL_VERSION, 4);

        // Packet length without header plus length of event type (80 + 4)
        out.writeUInt16LE(80 + 4, 6); // 84

        // CRC bytes left zero
        // Server id 0
        out.writeUInt32LE(0, 12);

        // Event type: controller data (0x00100002)
        out.writeUInt32LE(0x00100002, 16);

        // Beginning of shared response
        out[20] = slotNumber & 0xFF;
        out[21] = c.connectedState & 0xFF;
        out[22] = 0x02; // device model full gyro (2)
        out[23] = 0x02; // connection type bluetooth (2)
        // MAC
        for (let i = 0; i < 6; i++) out[24 + i] = macAddress[i] & 0xFF;
        out[30] = 0x05; // battery full
        out[31] = 0x01; // termination byte per Arduino code

        // Packet number (for this client) little-endian at offset 32
        out.writeUInt32LE(packetCount >>> 0, 32);

        
        // ---------- BUTTONS / STICKS / ANALOGS REGION: offsets 36..55 ----------
        const bOff = 36;
        out[bOff + 0] = 0x00 & 0xFF;                            // Byte1
        out[bOff + 1] = 0x00 & 0xFF;                            // Byte2
        out[bOff + 2] = (c.data.Home ? 0x01 : 0x00) & 0xFF;     // Home
        out[bOff + 3] = 0x00 & 0xFF;                            // Touch

        out[bOff + 4] = 128 & 0xFF;                             // leftStickX
        out[bOff + 5] = 128 & 0xFF;                             // leftStickY
        out[bOff + 6] = 128 & 0xFF;                             // rightStickX
        out[bOff + 7] = 128 & 0xFF;                             // rightStickY

        out[bOff + 8] = (c.data.PadW ? 255 : 0) & 0xFF;         // analogDpadLeft
        out[bOff + 9] = (c.data.PadS ? 255 : 0) & 0xFF;         // analogDpadDown
        out[bOff +10] = (c.data.PadE ? 255 : 0) & 0xFF;         // analogDpadRight
        out[bOff +11] = (c.data.PadN ? 255 : 0) & 0xFF;         // analogDpadUp

        out[bOff +12] = (c.data.A ? 255 : 0) & 0xFF;            // analogY (up)
        out[bOff +13] = (c.data.B ? 255 : 0) & 0xFF;            // analogB (right)
        out[bOff +14] = (c.data.One ? 255 : 0) & 0xFF;          // analogA (down)
        out[bOff +15] = (c.data.Two ? 255 : 0) & 0xFF;          // analogX (left)

        out[bOff +16] = (c.data.Plus ? 255 : 0)  & 0xFF;        // analogR1
        out[bOff +17] = (c.data.Minus ? 255 : 0) & 0xFF;        // analogL1
        out[bOff +18] = 0 & 0xFF;                               // analogR2
        out[bOff +19] = 0 & 0xFF;                               // analogL2
        // ---------- end buttons region ----------

        // Timestamp: Arduino places 4 lower bytes at offset 68 and zeros the higher 4 bytes at 72..75
        out.writeUInt32LE(timestamp32 >>> 0, 68);
        out.writeUInt32LE(0, 72);

        // Floats (LE) at 76.. and 88.. etc:
        // offsets per Arduino:
        // 76: accel X (float)
        // 80: accel Y
        // 84: accel Z
        // 88: gyro pitch
        // 92: gyro yaw
        // 96: gyro roll
        // out.writeFloatLE(accX, 76);
        // out.writeFloatLE(accY, 80);
        // out.writeFloatLE(accZ, 84);
        // out.writeFloatLE(gyroP, 88);
        // out.writeFloatLE(gyroY, 92);
        // out.writeFloatLE(gyroR, 96);
        out.writeFloatLE(c.data.AccelerometerX, 76);
        out.writeFloatLE(c.data.AccelerometerY, 80);
        out.writeFloatLE(c.data.AccelerometerZ, 84);
        out.writeFloatLE(c.data.Gyroscope_Pitch, 88);
        out.writeFloatLE(c.data.Gyroscope_Yaw, 92);
        out.writeFloatLE(c.data.Gyroscope_Roll, 96);

        // Compute CRC32 over full 100 bytes (CRC field still zero) and write to bytes 8..11 LE
        const checksum = crc32(out);
        out.writeUInt32LE(checksum >>> 0, 8);

        return out;
    }
    sendPacket(packet) {
        this.serverSocket.send(packet, 0, packet.length, this.clientAddress.port, this.clientAddress.address, (err) => {
            if (err) console.warn('Failed to send info packet:', err);
        });
    }
}


class FONEMOTE {
    constructor(sendOnFixedInterval=false) {
        this.sendOnFixedInterval = sendOnFixedInterval;
        this.server = new DSUServer('0.0.0.0', UDP_PORT);
        this.server.start(this.sendOnFixedInterval);
    }
    connectNewPhone() {
        let nextSlotNum = this.server.controllerStates.findIndex(c => c.connectedState === 0);
        if (nextSlotNum === -1) return console.warn('No free slots');

        let nextSlot = this.server.controllerStates[nextSlotNum];
        nextSlot.connectedState = 2;

        return nextSlotNum;
    }
    setPacket(slot, data) {
        if (!this.server.controllerStates[slot] || this.server.controllerStates[slot].connectedState === 0) return;
        const current = this.server.controllerStates[slot].data;
        this.server.controllerStates[slot].data = {
            Home: (data.Home===undefined) ? current.Home : data.Home,
            Plus: (data.Plus===undefined) ? current.Plus : data.Plus,
            Minus: (data.Minus===undefined) ? current.Minus : data.Minus,
            A: (data.A===undefined) ? current.A : data.A,
            B: (data.B===undefined) ? current.B : data.B,
            One: (data.One===undefined) ? current.One : data.One,
            Two: (data.Two===undefined) ? current.Two : data.Two,
            PadN: (data.PadN===undefined) ? current.PadN : data.PadN,
            PadS: (data.PadS===undefined) ? current.PadS : data.PadS,
            PadE: (data.PadE===undefined) ? current.PadE : data.PadE,
            PadW: (data.PadW===undefined) ? current.PadW : data.PadW,
            AccelerometerX: (data.AccelerometerX===undefined) ? current.AccelerometerX : data.AccelerometerX,
            AccelerometerY: (data.AccelerometerY===undefined) ? current.AccelerometerY : data.AccelerometerY,
            AccelerometerZ: (data.AccelerometerZ===undefined) ? current.AccelerometerZ : data.AccelerometerZ,
            Gyroscope_Pitch: (data.Gyroscope_Pitch===undefined) ? current.Gyroscope_Pitch : data.Gyroscope_Pitch,
            Gyroscope_Yaw: (data.Gyroscope_Yaw===undefined) ? current.Gyroscope_Yaw : data.Gyroscope_Yaw,
            Gyroscope_Roll: (data.Gyroscope_Roll===undefined) ? current.Gyroscope_Roll : data.Gyroscope_Roll,
        };

        if (!this.sendOnFixedInterval)
            this.server.sendPacket( this.server.makeDataPacket(slot) );
    }
    setDataAttr(slot, attr, val) {
        if (!this.server.controllerStates[slot] || this.server.controllerStates[slot].connectedState === 0) return;
        this.server.controllerStates[slot].data[attr] = val;
        
        if (!this.sendOnFixedInterval)
            this.server.sendPacket( this.server.makeDataPacket(slot) );
    }
    disconnect(slot) {
        if (!this.server.controllerStates[slot] || this.server.controllerStates[slot].connectedState === 0) return;
        this.server.controllerStates[slot].connectedState = 0;
        this.server.controllerStates[slot].packetNumber = 0;
        this.server.controllerStates[slot].data = {...DefaultControllerState.data};
    }
    clear() {
        this.server.controllerStates.forEach((c, i) => this.disconnect(i));
    }
}
export default FONEMOTE;



// --- test code ---
function testCode() {
    let PhoneMote = new FONEMOTE();
    let slot = PhoneMote.connectNewPhone();
    console.log('Slot', slot);

    // Push A
    pushA(PhoneMote.server, slot, false);

    // Make gyroscope roll with sin wave
    let offset = 0;
    setInterval(() => {
        PhoneMote.setDataAttr(slot, 'Gyroscope_Roll', Math.sin(offset * Math.PI / 180) * 55.0);
        offset = (offset + 1);
    }, 7);
}
async function pushA(server, slot, val) {  // Push / release A every second
    console.log('Setting A to:', val);
    
    PhoneMote.setDataAttr(slot, 'A', val?1:0);
    setTimeout(() => pushA(server, slot, !val), 1000);
}
if (import.meta.main) testCode();