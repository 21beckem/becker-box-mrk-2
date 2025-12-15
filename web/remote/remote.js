class Remote {
    static init() {
        // attempt to connect to the host if room code is in hash
        if (window.location.hash) {
            Remote.connectWithCode();
        } else {
            _('connectingText').style.display = 'none';
            _('connectForm').style.display = '';
        }
    }
    static async connectWithCode(code='') {
        if (code == '' && !window.location.hash.includes('#r=')) {
            console.error("No game code provided!");
            _('connectingText').style.display = 'none';
            _('connectForm').style.display = '';
            return;
        }
        GUI.attemptFullscreen();
        // if trying to use differnent code than in the hash, be sure that the hash won't mess with that
        if (code != '') {
            window.location.hash = '';
        }
        await Playroom.insertCoin({
            skipLobby: true,
            roomCode: code
        });
        if (Playroom.isHost()) {
            console.error("You are the host, not good! Try Again!");
            // refresh the page without any parameters
            window.location.hash = '';
            window.location = window.location.pathname;
        }
        console.log('waiting for handshake...');
        
        let slot = await Playroom.waitForPlayerState(Playroom.me(), 'handshake');
        Playroom.me().setState('handshook', slot, true);
        slot -= 1;

        Remote.showRemotePage();
        GUI.setSlot(slot);
    }
    static showRemotePage() {
        _('connectPage').style.display = 'none';
        _('RemotePage').style.display = '';
        GUI.setBposition();

        // start sending packets to the host
        Remote.sendPackets();
    }
    static Acel = [0, 0, 0];
    static Gyro = [0, 0, 0];
    static handleMotion(e) {
        Remote.Acel = {x: e.acceleration.x, y: e.acceleration.y, z: e.acceleration.z};
        Remote.sendPacketNow();
    }
    static handleOrientation(e) {
        Remote.Gyro = {x: e.alpha, y: e.beta, z: e.gamma};
    }
    static sendPacketNow() {
        Playroom.RPC.call('sendPacket', {
            buttons : GUI.buttons,
            acc : Remote.Acel,
            gyro : Remote.Gyro
        }, Playroom.RPC.Mode.HOST);
        console.log('sent packet');
    }
    static sendPackets() {
        if ( DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === "function" ) {
            DeviceMotionEvent.requestPermission();
        }
        window.addEventListener("devicemotion", Remote.handleMotion);
        window.addEventListener("deviceorientation", Remote.handleOrientation);
    }
}
Remote.init();