import dgram from 'dgram';

// Config (match Arduino defaults)
const UDP_PORT = 26760;
const PROTOCOL_VERSION = 1001; // 0x03E9 -> bytes 0xE9 0x03 (LE)
const INFO_PACKET_TOTAL = 32;
const DATA_PACKET_TOTAL = 100;
const SAMPLE_INTERVAL_MS = 10; // Arduino used sampleDelay = 10e3 microseconds -> 10 ms
const macAddress = [0x00,0x00,0x00,0x00,0x00,0x00]; // same default as Arduino sketch (zeros)

// State
let dataReplyAddr = null;
let dataReplyPort = null;
let packetCounter = 0 >>> 0; // uint32
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

function defaultButtons() {
  return {
    // (only first 4 bits of byte1 are used by dolphin for some reason)
    byte1: 0x00,
    byte2: 0x00, // not used by dolphin at all

    // single bytes
    home: 0x01,   // offset 38
    touch: 0x01,  // offset 39

    // sticks (unsigned 0..255). 128 is neutral/center usually.
    leftStickX: 128,  // offset 40
    leftStickY: 128,  // offset 41
    rightStickX: 128, // offset 42
    rightStickY: 128, // offset 43

    // analog D-pad (0..255)
    analogDpadLeft: 255,  // offset 44
    analogDpadDown: 255,  // offset 45
    analogDpadRight: 255, // offset 46
    analogDpadUp: 255,    // offset 47

    // face analogs (Y,B,A,X) offsets 48..51
    analogY: 255,
    analogB: 255,
    analogA: 255,
    analogX: 255,

    // analog shoulder/triggers offsets 52..55: R1, L1, R2, L2
    analogR1: 255,
    analogL1: 255,
    analogR2: 255,
    analogL2: 255,
  };
}

// --- Build data packet (100 bytes) ---
// Mirrors makeDataPacket(...) from Arduino code exactly.
function makeDataPacket(packetCount, timestamp32, accX, accY, accZ, gyroP, gyroY, gyroR, buttons) {
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
  out[20] = 0x00; // slot 0
  out[21] = 0x02; // slot state connected
  out[22] = 0x02; // device model (DS4 full gyro)
  out[23] = 0x02; // connection type (bluetooth)
  for (let i = 0; i < 6; i++) out[24 + i] = macAddress[i] & 0xFF;
  out[30] = 0x05; // battery full
  out[31] = 0x01; // device state active

  // Packet number (for this client) little-endian at offset 32
  out.writeUInt32LE(packetCount >>> 0, 32);

  
  // ---------- BUTTONS / STICKS / ANALOGS REGION: offsets 36..55 ----------
  // buttons argument defaults
  if (!buttons) buttons = defaultButtons();

  // Map README offsets (16..35) to our buffer by adding +20 => 36..55
  const bOff = 36;
  out[bOff + 0] = buttons.byte1 & 0xFF;           // README offset 16 -> buffer 36
  out[bOff + 1] = buttons.byte2 & 0xFF;           // README offset 17 -> buffer 37
  out[bOff + 2] = buttons.home & 0xFF;            // README offset 18 -> buffer 38
  out[bOff + 3] = buttons.touch & 0xFF;           // README offset 19 -> buffer 39

  out[bOff + 4] = buttons.leftStickX & 0xFF;      // 20 -> 40
  out[bOff + 5] = buttons.leftStickY & 0xFF;      // 21 -> 41
  out[bOff + 6] = buttons.rightStickX & 0xFF;     // 22 -> 42
  out[bOff + 7] = buttons.rightStickY & 0xFF;     // 23 -> 43

  out[bOff + 8] = buttons.analogDpadLeft & 0xFF;  // 24 -> 44
  out[bOff + 9] = buttons.analogDpadDown & 0xFF;  // 25 -> 45
  out[bOff +10] = buttons.analogDpadRight & 0xFF; // 26 -> 46
  out[bOff +11] = buttons.analogDpadUp & 0xFF;    // 27 -> 47

  out[bOff +12] = buttons.analogY & 0xFF;         // 28 -> 48
  out[bOff +13] = buttons.analogB & 0xFF;         // 29 -> 49
  out[bOff +14] = buttons.analogA & 0xFF;         // 30 -> 50
  out[bOff +15] = buttons.analogX & 0xFF;         // 31 -> 51

  out[bOff +16] = buttons.analogR1 & 0xFF;        // 32 -> 52
  out[bOff +17] = buttons.analogL1 & 0xFF;        // 33 -> 53
  out[bOff +18] = buttons.analogR2 & 0xFF;        // 34 -> 54
  out[bOff +19] = buttons.analogL2 & 0xFF;        // 35 -> 55
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
  out.writeFloatLE(accX, 76);
  out.writeFloatLE(accY, 80);
  out.writeFloatLE(accZ, 84);
  out.writeFloatLE(gyroP, 88);
  out.writeFloatLE(gyroY, 92);
  out.writeFloatLE(gyroR, 96);

  // Compute CRC32 over full 100 bytes (CRC field still zero) and write to bytes 8..11 LE
  const checksum = crc32(out);
  out.writeUInt32LE(checksum >>> 0, 8);

  return out;
}

const SmartMan = {
    splitInt48Rev: (n) => {
        const buf = Buffer.alloc(6);
        buf[0] = n & 0xff;
        buf[1] = (n >> 8) & 0xff;
        buf[2] = (n >> 16) & 0xff;
        buf[3] = (n >> 24) & 0xff;
        buf[4] = (n >> 32) & 0xff;
        buf[5] = (n >> 40) & 0xff;
        return buf;
    },
    splitInt32Rev: (n) => {
        const buf = Buffer.alloc(4);
        buf[0] = n & 0xff;
        buf[1] = (n >> 8) & 0xff;
        buf[2] = (n >> 16) & 0xff;
        buf[3] = (n >> 24) & 0xff;
        return buf;
    },
    bytesToInt: (arr) => {
        let o = 0;
        for (const i of arr) {
            o = (o << 1) + Number(i); // use << 1 if arr is 0/1 bits like Python version     MAY NEED TO BE CHANGED!!!! ! !  !!!!
        }
        return o;
    },
    splitInt16Rev: (n) => {
        const buf = Buffer.alloc(2);
        buf[0] = n & 0xff;
        buf[1] = (n >> 8) & 0xff;
        return buf;
    }
}
const DefaultControllerState = {
    dolphin_requested: false,
    slot_state: 0,
    connected_state: 0,
    packet_number: 0,
    data: {
        'Home Btn': 0,
        'Plus Btn': 0,
        'Minus Btn': 0,
        'Cross': 0,
        'B Btn': 0,
        '1 Btn': 0,
        '2 Btn': 0,
        'D-Pad Left': 0,
        'D-Pad Down': 0,
        'D-Pad Right': 0,
        'D-Pad Up': 0,
        'timestamp': 0,
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

        this.controllerStates[0].connected_state = 2;
        this.controllerStates[1].connected_state = 2;
        
        this.serverSocket = dgram.createSocket('udp4');
    }
    static MSG_TYP = {
        0x100000: 'Protocol version information',
        0x100001: 'Information about connected controllers',
        0x100002: 'Actual controllers data',
        0x110001: '(Unofficial) Information about controller motors', // unofficial
        0x110002: '(Unofficial) Rumble controller motor'              // unofficial
    };

    start() {
        // Bind the socket
        this.serverSocket.bind(this.port, this.host, () => {
            console.log(`DSU server is running on ${this.host}:${this.port}`);
        });

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
                        console.log('Information about connected controllers');
                        this.controllerStates.forEach((c, i) => {
                            this.sendPacket( this.makeInfoPacket(i) );
                        });
                        break;

                    case 'Actual controllers data':
                        let slot = msgData.readUInt8(1);
                        this.sendPacket( this.makeDataPacket(slot) );
                        // this.actualControllerDataRequest(encodedType, msgData);
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
        if (!this.clientAddress) return;
        this.controllerStates.forEach((c, slot) => {
            if (c.slot_state === 2)
                this.sendPacket( this.makeDataPacket(slot) );
        });
        setTimeout(() => this.keepSendingData(), 8); // about 120 Hz
    }

    decodePacket(buf) {
        const magicString       = buf.toString('ascii', 0, 4);
        const protocolVersion   = buf.readUInt16LE(4);
        const messageLength     = buf.readUInt16LE(6);
        const crc               = buf.readUInt32LE(8);
        const clientId          = buf.readUInt32LE(12);
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
        out[21] = c.connected_state & 0xFF;
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
        let packetCount = (c.packet_number + 1) >>> 0;
        c.packet_number = packetCount;
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
        out[21] = c.connected_state & 0xFF;
        out[22] = 0x02; // device model full gyro (2)
        out[23] = 0x02; // connection type bluetooth (2)
        // MAC
        for (let i = 0; i < 6; i++) out[24 + i] = macAddress[i] & 0xFF;
        out[30] = 0x05; // battery full
        out[31] = 0x01; // termination byte per Arduino code

        // Packet number (for this client) little-endian at offset 32
        out.writeUInt32LE(packetCount >>> 0, 32);

        
        // ---------- BUTTONS / STICKS / ANALOGS REGION: offsets 36..55 ----------
        const buttons = defaultButtons();

        // Map README offsets (16..35) to our buffer by adding +20 => 36..55
        const bOff = 36;
        out[bOff + 0] = buttons.byte1 & 0xFF;           // README offset 16 -> buffer 36
        out[bOff + 1] = buttons.byte2 & 0xFF;           // README offset 17 -> buffer 37
        out[bOff + 2] = buttons.home & 0xFF;            // README offset 18 -> buffer 38
        out[bOff + 3] = buttons.touch & 0xFF;           // README offset 19 -> buffer 39

        out[bOff + 4] = buttons.leftStickX & 0xFF;      // 20 -> 40
        out[bOff + 5] = buttons.leftStickY & 0xFF;      // 21 -> 41
        out[bOff + 6] = buttons.rightStickX & 0xFF;     // 22 -> 42
        out[bOff + 7] = buttons.rightStickY & 0xFF;     // 23 -> 43

        out[bOff + 8] = buttons.analogDpadLeft & 0xFF;  // 24 -> 44
        out[bOff + 9] = buttons.analogDpadDown & 0xFF;  // 25 -> 45
        out[bOff +10] = buttons.analogDpadRight & 0xFF; // 26 -> 46
        out[bOff +11] = buttons.analogDpadUp & 0xFF;    // 27 -> 47

        out[bOff +12] = buttons.analogY & 0xFF;         // 28 -> 48
        out[bOff +13] = buttons.analogB & 0xFF;         // 29 -> 49
        out[bOff +14] = buttons.analogA & 0xFF;         // 30 -> 50
        out[bOff +15] = buttons.analogX & 0xFF;         // 31 -> 51

        out[bOff +16] = buttons.analogR1 & 0xFF;        // 32 -> 52
        out[bOff +17] = buttons.analogL1 & 0xFF;        // 33 -> 53
        out[bOff +18] = buttons.analogR2 & 0xFF;        // 34 -> 54
        out[bOff +19] = buttons.analogL2 & 0xFF;        // 35 -> 55
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

async function pushA(server, val) {
    console.log('Setting A to:', val);
    
    server.controllerStates[0].data['Cross'] = val ? 1 : 0;
    setTimeout(() => pushA(server, !val), 2000);
}


let server = new DSUServer('0.0.0.0', 26760);
server.start();
// pushA(server, false);