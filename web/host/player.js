import Pointer from "./pointer.js";
const DISCONNECT_TIMEOUT_MS = 10000;

export default class Player {
    #disconnectTimeout = null;
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
        this.conn.on('data', (data) => {
            this.#restartDisconnectTimer();
            window.electron.sendPacket(this.slot, data)
        });
        this.conn.send(this.slot);
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