import GUI from './gui.js';
import { Peer } from 'https://esm.sh/peerjs@1.5.5?bundle-deps';
const JSAlert = window.JSAlert;
const peer = new Peer(null);
const status = {
	connecting: 'Connecting to BeckerBox host<br><br>Please wait...',
	connected: 'Connected!<br><br>Launching remote...',
	cantconnect: 'Sorry, it looks something went wrong!<br><br>Please try scanning the QR code again.',
	disconnected: 'Sorry, it looks like you got disconnected!<br><br>Please <button class="wiiUIbtn" onclick="window.location.reload();" style="font-size: inherit; border-radius: 17px;">Refresh</button> to reconnect, or scan the QR code again.',
	error: (err) => `There's been an error:<br>${err}`
}

const PACKET = {
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
const RAW_MOTION = {
	AccelerometerX: 0.0,
	AccelerometerY: 0.0,
	AccelerometerZ: 0.0,
	Gyroscope_Pitch: 0.0,
	Gyroscope_Yaw: 0.0,
	Gyroscope_Roll: 0.0
}
function getCalibrationFromStorage() {
	// if (localStorage.getItem('BeckerBoxRemoteCalibration')) {
	// 	try {
	// 		return JSON.parse(localStorage.getItem('BeckerBoxRemoteCalibration'));
	// 	} catch (e) { }
	// }
	return {
		AccelerometerX: 0.0,
		AccelerometerY: 0.0,
		AccelerometerZ: 0.0,
		Gyroscope_Pitch: 0.0,
		Gyroscope_Yaw: 0.0,
		Gyroscope_Roll: 0.0
	}
}
function saveCalibrationToStorage(calibration) {
	localStorage.setItem('BeckerBoxRemoteCalibration', JSON.stringify(calibration));
}

class Remote {
	static calibration = getCalibrationFromStorage();
	static searchParams = new URLSearchParams(window.location.search)
	static init() {
		GUI.setRemote(this);
		GUI.setConnectingStatus(status.connecting);
		peer.on('open', () => {
			// attempt to connect
			this.connectWithCode();
		});
		peer.on('connection', (c) => {
			// Disallow incoming connections
			c.on('open', function() {
				c.send("Connection to another remote is not allowed at this time.");
				setTimeout(function() { c.close(); }, 500);
			});
		});
		peer.on('disconnected', function() {
			GUI.setConnectingStatus(status.disconnected);
		});
		peer.on('error', function(err) {
			GUI.setConnectingStatus(status.error(err));
		});
	}
	static async connectWithCode(code = null) {
		if (!code && !this.searchParams.get('id')) {
			console.error("No peer code provided!");
			GUI.setConnectingStatus(status.cantconnect);
			return;
		}
		code = code || this.searchParams.get('id');

		this.conn = peer.connect(code);
		this.conn.on('open', () => {
			console.log('Peer opened');
			this.showRemotePage();
			this.startSendingPackets();
		});
		this.conn.on('data', (data) => {
			console.log('Received', data);
			if (data.slot || data.slot === 0) {
				GUI.setSlot(data.slot);
			}
		});
		this.conn.on('disconnected', () => {
			console.log('Connection lost. Please reconnect');
			GUI.setConnectingStatus(status.disconnected);
		});
		this.conn.on('close', () => {
			console.log('Connection closed');
			GUI.setConnectingStatus(status.disconnected);
		});
		this.conn.on('error', (err) => {
			GUI.setConnectingStatus(status.error(err));
		});
	}
	static showRemotePage() {
		GUI.showRemotePage();
		// start sending packets to the host
		this.startSendingPackets();
	}
	static clamp = (x) => (x === null || x === undefined) ? 0 : x; // Math.round(x * 100) / 100;
	static applyCalibration = (x, calibration) => {
		x = this.clamp(x);
		if (x - calibration < -180)
			return (x - calibration) + 360;
		else if (x - calibration > 180)
			return (x - calibration) - 360;
		else
			return x - calibration;
	}
	static handleMotion(e) {
		RAW_MOTION.AccelerometerX = e.acceleration.x;
		RAW_MOTION.AccelerometerY = e.acceleration.y;
		RAW_MOTION.AccelerometerZ = e.acceleration.z;
		PACKET.AccelerometerX = this.applyCalibration(e.acceleration.x, this.calibration.AccelerometerX);
		PACKET.AccelerometerY = this.applyCalibration(e.acceleration.y, this.calibration.AccelerometerY);
		PACKET.AccelerometerZ = this.applyCalibration(e.acceleration.z, this.calibration.AccelerometerZ);
	}
	static handleOrientation(e) {
		RAW_MOTION.Gyroscope_Yaw = e.alpha;
		RAW_MOTION.Gyroscope_Pitch = e.beta;
		RAW_MOTION.Gyroscope_Roll = e.gamma;
		RAW_MOTION.Gyroscope_Yaw = e.alpha - 180;
		RAW_MOTION.Gyroscope_Pitch = e.beta > 180 ? e.beta - 360 : e.beta;
		RAW_MOTION.Gyroscope_Roll = e.gamma > 180 ? e.gamma - 360 : e.gamma;

		PACKET.Gyroscope_Yaw = this.applyCalibration(RAW_MOTION.Gyroscope_Yaw, this.calibration.Gyroscope_Yaw);
		PACKET.Gyroscope_Pitch = this.applyCalibration(RAW_MOTION.Gyroscope_Pitch, this.calibration.Gyroscope_Pitch);
		PACKET.Gyroscope_Roll = this.applyCalibration(RAW_MOTION.Gyroscope_Roll, this.calibration.Gyroscope_Roll);
	}
	static sendPacketNow() {
		if (peer && !peer.disconnected && this.conn && this.conn.open) {
			this.conn.send(PACKET);
			// console.log('sent packet');
		}
	}
	static startSendingPackets() {
		if (DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === "function") {
			DeviceMotionEvent.requestPermission();
		}
		window.addEventListener("devicemotion", (e) => this.handleMotion(e));
		window.addEventListener("deviceorientation", (e) => this.handleOrientation(e));
		setInterval(() => this.sendPacketNow(), 10);
	}

	static calibrate() {
		var alert = new JSAlert('Please place the remote on a flat surface facing directly towards the screen. Then press <i>Calibrate</i> to confirm.', 'Calibrate');
		// alert.setIcon(JSAlert.Icons.Becker);
		alert.addButton('Cancel');
		alert.addButton('Calibrate').then(() => {
			this.calibration = {
				AccelerometerX: RAW_MOTION.AccelerometerX,
				AccelerometerY: RAW_MOTION.AccelerometerY,
				AccelerometerZ: RAW_MOTION.AccelerometerZ,
				Gyroscope_Pitch: RAW_MOTION.Gyroscope_Pitch,
				Gyroscope_Yaw: RAW_MOTION.Gyroscope_Yaw,
				Gyroscope_Roll: RAW_MOTION.Gyroscope_Roll
			}
			saveCalibrationToStorage(this.calibration);
		});
		alert.show();
	}

	static changeDisc() {
		this.conn.send({
			menuAction: 'changeDisc'
		});
	}
}
Remote.init();

export { PACKET, Remote };