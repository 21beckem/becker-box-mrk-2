import Player from './player.js';
import { Peer } from 'https://esm.sh/peerjs@1.5.5?bundle-deps';

// manage players
const PlayerManager = new (class PlayerManager {
    constructor() {
        this.players = [null, null, null, null];
        this.#initPeer();
    }
    #initPeer() {
        this.peer = new Peer();
        this.peer.on('connection', (conn) => {

            conn.on('data', (data) =>  window.electron.sendPacket(0, data)  );
        })
    }
    
    async #waitUntilPeerIsReady() {
        return new Promise((resolve, reject) => {
            let timer = setInterval(() => {
                if (this.peer.connected) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    }
})();

export default PlayerManager;