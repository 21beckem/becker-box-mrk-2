const dgram = require('dgram');
const crc32 = require('buffer-crc32');
const fs = require('fs');

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
        'AccelerometerX': 0.0,
        'AccelerometerY': 0.0,
        'AccelerometerZ': 0.0,
        'Gyroscope_Pitch': 0.0,
        'Gyroscope_Yaw': 0.0,
        'Gyroscope_Roll': 0.0
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

        this.controllerStates[0].slot_state = 2;
        
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
                console.log(decodedType);
                

                // Map Python’s if/elif chain to JS
                switch (decodedType) {
                    case 'Protocol version information':
                        this.versionRequest(encodedType, msgData);
                        break;

                    case 'Information about connected controllers':
                        this.controllerInfoRequest(encodedType, msgData);
                        break;

                    case 'Actual controllers data':
                        this.actualControllerDataRequest(encodedType, msgData);
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
        this.controllerStates.forEach((c, i) => {
            if (c.slot_state === 2)
                this.sendControllerData(i);
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

    controllerInfoRequest(encodedMsgType, msgData) {
        // Read number of ports (int32 little-endian)
        const nOfPorts = msgData.readInt32LE(0);

        // Bytes after the first 4 are the port list
        let portsBytes = msgData.slice(4);
        const ports = [];

        for (let i = 0; i < nOfPorts; i++) {
            ports.push(portsBytes.readUInt8(0));
            portsBytes = portsBytes.slice(1);
        }

        for (const port of ports) {
            // this.createControllerInfoIntro(port) must return a Buffer
            const intro = this.createControllerInfoIntro(port);

            // Single byte 0
            const endByte = Buffer.from([0]);

            const packetData = Buffer.concat([intro, endByte]);

            const finalPacket = this.addHeader(encodedMsgType, packetData);
            this.sendPacket(finalPacket);
        }
    }

    actualControllerDataRequest(encodedMsgType, msgData) {
        // msgData should be a Buffer
        // <BBIH> → 1 byte, 1 byte, 4-byte little-endian, 2-byte little-endian
        const bitMask = msgData.readUInt8(0);
        const slot = msgData.readUInt8(1);
        const macLow = msgData.readUInt32LE(2);
        const macHigh = msgData.readUInt16LE(6);

        // Compute MAC address as in Python
        const macAddr = (macHigh << 24) | macLow;

        // console.log(`bitMask: ${bitMask}, slot: ${slot}, macAddr: ${macAddr}`);

        if (bitMask !== 0 && bitMask !== 1) {
            console.error('Fatal error: bitMask is not 0 or 1. MACaddress based subscriptions not supported.');
        }

        this.controllerStates[slot].dolphin_requested = true;
        this.sendControllerData(slot);
    }

    createControllerInfoIntro(slot) {
        const state = this.controllerStates[slot].slot_state;

        // <BBBB  → 4 bytes
        const b1 = Buffer.from([
            Number(slot),
            Number(state),
            0,
            0
        ]);

        // <Q → 8-byte little-endian unsigned long long (but Python slices [:6])
        const q = Buffer.alloc(8);
        q.writeBigUInt64LE(0n, 0);
        const q6 = q.slice(0, 6); // first 6 bytes

        // <B → 1 byte (0x04)
        const lastByte = Buffer.from([0x04]);

        return Buffer.concat([b1, q6, lastByte]);
    }
    addHeader(encodedMsgType, packetData, overrideCrc = 0) {
        // Prepend encodedMsgType as 4-byte little-endian uint32
        const msgTypeBuf = Buffer.alloc(4);
        msgTypeBuf.writeUInt32LE(encodedMsgType, 0);
        packetData = Buffer.concat([msgTypeBuf, packetData]);

        // Build first header: <4sHHLL>
        // 4s → 'DSUS'
        // H  → 2 bytes (1001)
        // H  → 2 bytes (packetData length)
        // L  → 4 bytes (0 placeholder)
        // L  → 4 bytes (this.ID)
        const response1 = Buffer.alloc(16);
        response1.write('DSUS', 0, 4, 'ascii');          // 4s
        response1.writeUInt16LE(1001, 4);                // H
        response1.writeUInt16LE(packetData.length, 6);   // H
        response1.writeUInt32LE(0, 8);                   // L
        response1.writeUInt32LE(this.ID, 12);            // L

        // Compute CRC
        let crc = overrideCrc === 0 ? this.computeCrc(Buffer.concat([response1, packetData])) : overrideCrc;
        
        // log to file and console
        let logMessage = `type: ${encodedMsgType.toString(16).padStart(8, '0')} | crc: ${crc.toString(16).padStart(8, '0')} | message: ${JSON.stringify(Array.from(Buffer.concat([response1, packetData])))}`;
        console.log(logMessage);
        fs.appendFile('logs/me.txt', `\n${logMessage}`, (err) => {
            if (err) console.error('Error writing to log file:', err);
        });

        // Build final header with CRC
        const response2 = Buffer.alloc(16);
        response2.write('DSUS', 0, 4, 'ascii');          // 4s
        response2.writeUInt16LE(1001, 4);                // H
        response2.writeUInt16LE(packetData.length, 6);   // H
        response2.writeUInt32LE(crc, 8);                 // L
        response2.writeUInt32LE(this.ID, 12);            // L

        // Concatenate header + packetData
        return Buffer.concat([response2, packetData]);
    }
    computeCrc(packet, crcFieldRange = [8, 12]) {
        // packet should be a Buffer
        // buffer-crc32 returns a Buffer, so convert to number
        const crcBuf = crc32.unsigned(packet); // returns unsigned 32-bit integer
        return crcBuf >>> 0; // ensure unsigned
    }
    sendPacket(packet) {
        // packet should be a Buffer
        this.serverSocket.send(packet, 0, packet.length, this.clientAddress.port, this.clientAddress.address, (err) => {
            if (err) {
                console.error('Error sending packet:', err);
            }
        });
    }
    sendControllerData(slot, data=null) {
        if (!this.controllerStates[slot].dolphin_requested) return;

        if (data === null)
            data = this.controllerStates[slot].data;
        else
            this.controllerStates[slot].data = data;

        // define vars
        let [
            dpadL, dpadD, dpadR, dpadU, start, r3, l3, select,
            y, b, a, x, r1, l1, r2, l2, homeB, touchB, lX, lY, rX, rY,
            accelX, accelY, accelZ, gyroPitch, gyroYaw, gyroRoll
        ] = Array(28).fill(0);
        a = this.controllerStates[slot].data.Cross;
        // console.log('slot', slot);
        // console.log(this.controllerStates[slot].packet_number);
        
        // console.log('a', a);
        
        

        // construct the packet
        let packetParts = [];

        // slot + 3 bytes of value 2
        packetParts.push(Buffer.from([slot, 2, 2, 2]));

        // split_int_48_rev(0) → returns 6-byte Buffer
        packetParts.push(SmartMan.splitInt48Rev(0));

        packetParts.push(Buffer.from([0x05, 1]));

        // split_int_32_rev(packetNumber) → returns 4-byte Buffer
        packetParts.push(SmartMan.splitInt32Rev(  this.controllerStates[slot].packet_number  ));

        // convert booleans to single byte
        packetParts.push(Buffer.from([SmartMan.bytesToInt([dpadL, dpadD, dpadR, dpadU, start, r3, l3, select])]));
        packetParts.push(Buffer.from([SmartMan.bytesToInt([y, b, 255, x, r1, l1, r2, l2])]));

        // next 6 bytes
        packetParts.push(Buffer.from([homeB, touchB, lX, lY, rX, rY]));

        // individual button bytes
        packetParts.push(Buffer.from([dpadL, dpadD, dpadR, dpadU, y, b, a, x, r1, l1, r2, l2]));

        // two 48-bit zeros
        packetParts.push(SmartMan.splitInt48Rev(0));
        packetParts.push(SmartMan.splitInt48Rev(0));

        // two 32-bit zeros
        packetParts.push(SmartMan.splitInt32Rev(0));
        packetParts.push(SmartMan.splitInt32Rev(0));

        // accelerometer and gyro values (32-bit each)
        packetParts.push(SmartMan.splitInt32Rev(accelX));
        packetParts.push(SmartMan.splitInt32Rev(accelY));
        packetParts.push(SmartMan.splitInt32Rev(accelZ));
        packetParts.push(SmartMan.splitInt32Rev(gyroPitch));
        packetParts.push(SmartMan.splitInt32Rev(gyroYaw));
        packetParts.push(SmartMan.splitInt32Rev(gyroRoll));

        // concatenate all parts
        let packet = Buffer.concat(packetParts);

        // construct with ID and message type
        packet = this.construct(this.ID, 0x100001, packet);

        // console.log('packet len', packet.length);
        // console.log('packet number', this.controllerStates[slot].packet_number);
        this.sendPacket(packet);
        // console.log('packet:', packet);

        this.controllerStates[slot].packet_number += 1;

        // if (this.controllerStates[slot].packet_number > 100) {
        //     this.controllerStates[slot].packet_number = 0;
        // }
    }
    construct(id, eventType, data) {
        // message starts empty
        const messageParts = [];

        // 'DSUS'
        messageParts.push(Buffer.from('DSUS', 'ascii'));

        // b'\xe9\x03'
        messageParts.push(Buffer.from([0xe9, 0x03]));

        // length of data + 4 as 2-byte little-endian
        messageParts.push(SmartMan.splitInt16Rev(data.length + 4));

        // CRC32 placeholder (4 bytes)
        const crcPlaceholder = Buffer.alloc(4, 0);
        messageParts.push(crcPlaceholder);

        // id and eventType as 32-bit little-endian
        messageParts.push(SmartMan.splitInt32Rev(id));
        messageParts.push(SmartMan.splitInt32Rev(eventType));

        // append data (Buffer)
        messageParts.push(data);

        // concatenate everything
        const message = Buffer.concat(messageParts);

        // compute CRC32
        let crcUnsigned = this.computeCrc(message);
        const crc = SmartMan.splitInt32Rev(crcUnsigned);


        // log to file and console
        let logMessage = `type: ${eventType.toString(16).padStart(8, '0')} | crc: ${crcUnsigned.toString(16).padStart(8, '0')} | message: ${JSON.stringify(Array.from(message))}`;
        console.log(logMessage);
        fs.appendFile('logs/me.txt', `\n${logMessage}`, (err) => {
            if (err) console.error('Error writing to log file:', err);
        });
        

        // write CRC into message at bytes 8–11
        for (let i = 0; i < 4; i++) {
            message[8 + i] = crc[i];
        }

        return message;
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