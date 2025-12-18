import fs from 'fs';
export default class Logger {
    constructor(mode='terminal') {
        this.mode = mode;
        this.fileName = 'logs/' + (new Date()).toISOString().replace('T','_').slice(0,-5) + '.log';
    }
    logString(msg) {
        if (this.mode === 'terminal') return console.log(msg);

        fs.appendFileSync(this.fileName, `\n${msg}`, (err) => {
            if (err) console.error('Error writing to log file:', err);
        });
    }
    logObject(obj) {
        if (this.mode === 'terminal') return console.log(obj);
        else this.logString(JSON.stringify(obj));
    }
    logPacket(buf) {
        buf = Buffer.from(buf);
        let p = {
            magicString: buf.toString('ascii', 0, 4),
            protocolVersion: buf.readUInt16LE(4),
            lengthWithoutHeader: buf.readUInt16LE(6),
            CRC: buf.readUInt32LE(8).toString(16).padStart(8, '0'),
            senderId: buf.readUInt32LE(12),
            msgType: '0x' + buf.readUInt32LE(16).toString(16).padStart(6, '0'),
            payload: buf.slice(20)
        };
        p.payloadBrokenDown = this.#breakPayload(p.msgType, p.payload);
        // let magic = ;
        // let protocolVersion = buf.readUInt16LE(4);
        // let messageLength = buf.readUInt16LE(6);
        // let crc = buf.readUInt32LE(8);
        // let encodedMsgType = buf.readUInt32LE(16);
        // let packetData = buf.slice(20);

        // let logMessage = `type: ${encodedMsgType.toString(16).padStart(8, '0')} | crc: ${crc.toString(16).padStart(8, '0')} | message: ${JSON.stringify(Array.from(Buffer.concat([response1, packetData])))}`;
        // this.logString(JSON.stringify(msg));

        this.logObject(p);
    }
    #breakPayload(msgType, payload) {
        switch (msgType) {
            case '0x100001':
                return this.#breakInfoAboutConnectedControllers(payload);
            case '0x100002':
                return this.#breakActualControllerData(payload);
            default:
                return null;
        }
    }
    #breakInfoAboutConnectedControllers(d) {
        return {
            slotNumber: d.readUInt8(0),
            slotState: ['Not connected', 'Reserved', 'Connected'][d.readUInt8(1)] || d.readUInt8(1),
            deviceModel: ['N/A', 'No/partial gyro', 'Full gyro', 'Exists but don\'t use'][d.readUInt8(2)] || d.readUInt8(2),
            connectionType: ['N/A', 'USB', 'Bluetooth'][d.readUInt8(3)] || d.readUInt8(3),
            deviceMACAddress: d.readUInt32LE(4).toString(16).padStart(12, '0'),
            batteryStatus: ['N/A', 'Dying', 'Low', 'Medium', 'High', 'Full (or almost)'][d.readUInt8(10)] || d.readUInt8(10)
        };
    }
    #breakActualControllerData(d) {
        return {
            connected: d.readUInt8(0),
            packetNumber: d.readUInt32LE(1),
            buttons1: d.readUInt8(5).toString(2).padStart(8, '0'),
            buttons2: d.readUInt8(6).toString(2).padStart(8, '0'),
            home: d.readUInt8(7),
            touchButton: d.readUInt8(8),
            leftStickXPlusRightward: d.readUInt8(9),
            leftStickYPlusUpward: d.readUInt8(10),
            rightStickXPlusRightward: d.readUInt8(11),
            rightStickYPlusUpward: d.readUInt8(12),
            dpadLeft: d.readUInt8(13),
            dpadDown: d.readUInt8(14),
            dpadRight: d.readUInt8(15),
            dpadUp: d.readUInt8(16),
            y: d.readUInt8(17),
            b: d.readUInt8(18),
            a: d.readUInt8(19),
            x: d.readUInt8(20),
            r1: d.readUInt8(21),
            l1: d.readUInt8(22),
            r2: d.readUInt8(23),
            l2: d.readUInt8(24),
            firstTouch: null,
            secondTouch: null,
            motionDataTimestamp: d.readUInt8(37),
            accelX: d.readFloatLE(45),
            accelY: d.readFloatLE(49),
            accelZ: d.readFloatLE(53),
            gyroX: d.readFloatLE(57),
            gyroY: d.readFloatLE(61),
            gyroZ: d.readFloatLE(65)
        }
    }
}

function testCode() {
    const logger = new Logger();
    
    // Example usage
    const response1 = Buffer.from(
        [68,83,85,83,233,3,15,0,46,85,192,63,1,0,0,0,1,0,16,0,0,2,2,2,0,0,0,0,0,0,5]
        // [68,83,85,83,233,3,16,0,179,20,52,76,0,0,0,0,1,0,16,0,0,2,2,2,0,0,0,0,0,0,5,0]
        // [68,83,85,83,233,3,84,0,221,191,28,107,0,0,0,0,2,0,16,0,0,2,2,2,0,0,0,0,0,0,5,1,239,0,0,0,0,0,0,0,128,128,128,128,0,0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,213,225,25,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,101,99,54,194]
    );
    logger.logPacket(response1);
}
if (import.meta.main) testCode();