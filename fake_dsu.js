// fake_dsu.js
// Node.js implementation of the Arduino gyro UDP DSU server (dummy sensor data).
// Produces bit-for-bit packet layouts for Cemuhook (info packets = 32 bytes, data packets = 100 bytes).
//
// Protocol details follow the Cemuhook README (user-supplied). See filecite in chat for exact layout.
// CRC32 uses standard IEEE polynomial and produces the same LE uint32 bytes that Arduino memcpy did.

const dgram = require('dgram');
const server = dgram.createSocket('udp4');

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

// --- Build info packet (32 bytes) ---
// Mirrors makeInfoPacket(...) from the Arduino code exactly.
function makeInfoPacket(slotNumber) {
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

  if (slotNumber === 0) {
    out[20] = 0x00; // slot
    out[21] = 0x02; // slot state connected (2)
    out[22] = 0x02; // device model full gyro (2)
    out[23] = 0x02; // connection type bluetooth (2)
    // MAC
    for (let i = 0; i < 6; i++) out[24 + i] = macAddress[i] & 0xFF;
    out[30] = 0x05; // battery full
    out[31] = 0x00; // termination byte per Arduino code
  } else {
    // Other slots: not connected (zeros except slot index and slot state)
    out[20] = slotNumber & 0xFF;
    out[21] = 0x00;
    out[22] = 0x00;
    out[23] = 0x00;
    // MAC left as zeros
    out[30] = 0x00;
    out[31] = 0x00;
  }

  // Compute CRC32 over the full 32 bytes (with CRC bytes still zero) and write LE uint32 into bytes 8..11
  const checksum = crc32(out);
  out.writeUInt32LE(checksum >>> 0, 8);

  return out;
}

// --- Build data packet (100 bytes) ---
// Mirrors makeDataPacket(...) from Arduino code exactly.
function makeDataPacket(packetCount, timestamp32, accX, accY, accZ, gyroP, gyroY, gyroR) {
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

  // Buttons / sticks / analogs / touch: Arduino zeroes most of these; copy exact zeros and positions
  // offsets 36..67 remain zero (we allocated zeros)

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

// --- UDP message handling ---
// Accepts incoming packets and checks udpIn[16] (least-significant byte of event type)
server.on('message', (msg, rinfo) => {
  if (!Buffer.isBuffer(msg) || msg.length < 20) return; // invalid
  const eventTypeLSB = msg[16];

  if (eventTypeLSB === 0x01) { // Information about controllers (request)
    // msg[20] contains amount of ports to report about (signed 32-bit in Arduino, but LSB is used)
    const amount = msg[20] & 0xFF;
    // slot bytes start at msg[24 + i]
    for (let i = 0; i < amount; i++) {
      const slot = msg[24 + i] & 0xFF;
      const info = makeInfoPacket(slot);
      server.send(info, 0, info.length, rinfo.port, rinfo.address, (err) => {
        if (err) console.warn('Failed to send info packet:', err);
      });
    }
    return;
  }

  if (eventTypeLSB === 0x02) { // Controller input data request (subscribe)
    // Remember remote client so we can send data packets periodically
    dataReplyAddr = rinfo.address;
    dataReplyPort = rinfo.port;

    // Update a "last request" time if you want, but this simple impl will keep sending until program stopped or another client connects.
    console.log(`Registered data client ${dataReplyAddr}:${dataReplyPort}`);
    return;
  }

  // Optionally handle other incoming message types (e.g. 0x00 protocol version info) if required.
});

// Start UDP server
server.bind(UDP_PORT, () => {
  console.log(`Fake DSU server listening on 0.0.0.0:${UDP_PORT}`);
  console.log(`MAC address used in responses: ${macAddress.map(b => b.toString(16).padStart(2,'0')).join(':')}`);
});

// --- Periodic sample producer (replaces MPU6050 reads with dummy data) ---
setInterval(() => {
  if (!dataReplyAddr || !dataReplyPort) return; // nobody subscribed

  // Dummy data - change here if you want deterministic values:
  // - accelerometer values are in g (1.0 = 1 g). Arduino code converts raws to float g values.
  // - gyroscope values are in degrees/sec.
  const dummyAccX = 0.0;
  const dummyAccY = 0.0;
  const dummyAccZ = 1.0;  // standing still -> ~1g on Z
  const dummyGyroP = 0.0;
  const dummyGyroY = 0.0;
  const dummyGyroR = 0.0;

  // packet counter and timestamp
  packetCounter = (packetCounter + 1) >>> 0;
  const ts32 = micros32(); // lower 32 bits of micros since process start

  const pkt = makeDataPacket(packetCounter, ts32, dummyAccX, dummyAccY, dummyAccZ, dummyGyroP, dummyGyroY, dummyGyroR);

  server.send(pkt, 0, pkt.length, dataReplyPort, dataReplyAddr, (err) => {
    if (err) console.warn('Error sending data packet:', err);
  });

}, SAMPLE_INTERVAL_MS);
