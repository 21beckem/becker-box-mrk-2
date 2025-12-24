import Pointer from "./pointer.js";
const DISCONNECT_TIMEOUT_MS = 10000;

export default class Player {
    #disconnectTimeout = null;
    #lastPacket = null;
    constructor(slot, conn, parent) {
        this.removed = false;
        this.slot = slot;
        this.conn = conn;
        this.parent = parent;
        this.pointer = new Pointer(this.slot);
        this.#initConn();

        this.#restartDisconnectTimer();
    }
    #initConn() {
        this.conn.on('open', () => {
            this.#restartDisconnectTimer();
            this.conn.send({slot: this.slot});
        })
        this.conn.on('data', (data) => {
            this.#restartDisconnectTimer();
            if (data.menuAction) {
                switch (data.menuAction) {
                    case 'changeDisc':
                        window.showDiscSelectPage();
                        break;
                }
                return;
            }

            this.pointer.newPacket( this.#convertData(data) );
            window.electron.sendPacket(this.slot, data);
        });
    }
    #convertData(data) {
        if (!this.#lastPacket) {
            this.#lastPacket = data;
            return data;
        }
        let newData = {
            ...data,
            raw: data,

            AccelerometerX: data.AccelerometerX - this.#lastPacket.AccelerometerX,
            AccelerometerY: data.AccelerometerY - this.#lastPacket.AccelerometerY,
            AccelerometerZ: data.AccelerometerZ - this.#lastPacket.AccelerometerZ,

            Gyroscope_Yaw: data.Gyroscope_Yaw - this.#lastPacket.Gyroscope_Yaw,
            Gyroscope_Pitch: data.Gyroscope_Pitch - this.#lastPacket.Gyroscope_Pitch,
            Gyroscope_Roll: data.Gyroscope_Roll - this.#lastPacket.Gyroscope_Roll
        };
        this.#lastPacket = data;
        return newData;
    }
    remove() {
        this.#disconnect();
    }


    
    #removeDisconnectTimer() {
        if (this.#disconnectTimeout)
            clearTimeout(this.#disconnectTimeout);
        this.#disconnectTimeout = null;
    }
    #restartDisconnectTimer() {
        this.#removeDisconnectTimer();
        this.#disconnectTimeout = setTimeout(() => this.#disconnect(), DISCONNECT_TIMEOUT_MS);
    }
    #disconnect() {
        if (this.removed) return;
        this.removed = true;

        this.#removeDisconnectTimer();
        console.warn(`Disconnecting slot ${this.slot} due to inactivity`);
        this.conn.close();
        this.pointer.remove();
        window.electron.removePlayer(this.slot);
        this.parent.removePlayer(this.slot);
    }
}