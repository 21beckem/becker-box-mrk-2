import { PACKET } from './remote.js'

const _ = (x) => document.getElementById(x);
class GUI {
	static b_states = [0, 0];
	static init() {
		_('launchFullscreenBtn').addEventListener('click', this.attemptFullscreen)
		this.setBposition();
		window.addEventListener('resize', this.setBposition);

		// add haptic feedback for all buttons and ensure the page is in fullscreen
		document.querySelectorAll('#RemotePage div.btn').forEach(div => {
			div.addEventListener('touchstart', event => {
				if (event.target.getAttribute('data-key') === 'B') {
					this.b_states[event.target.id.includes('1') ? 0 : 1] = 1;
					PACKET.B = 1;
				} else {
					PACKET[event.target.getAttribute('data-key')] = 1;
				}
				// console.log(JSON.stringify(PACKET, null, 2));
				event.target.classList.add('pressed');
				this.attemptFullscreen();
				this.hapticFeedback();
			});
			div.addEventListener('touchend', event => {
				if (event.target.getAttribute('data-key') === 'B') {
					this.b_states[event.target.id.includes('1') ? 0 : 1] = 0;
					PACKET.B = parseInt(this.b_states[0] || this.b_states[1]);
				} else {
					PACKET[event.target.getAttribute('data-key')] = 0;
				}
				// console.log(JSON.stringify(PACKET, null, 2));
				event.target.classList.remove('pressed');
				this.hapticFeedback();
			});
		});
	}
	static attemptFullscreen() {
		try {
			let elem = document.documentElement;
			if (elem.requestFullscreen) {
				elem.requestFullscreen();
			} else if (elem.mozRequestFullScreen) {
				elem.mozRequestFullScreen();
			} else if (elem.webkitRequestFullscreen) {
				elem.webkitRequestFullscreen();
			} else if (elem.msRequestFullscreen) {
				elem.msRequestFullscreen();
			}
		} catch (e) { }

		try {
			// request wake lock too
			if (navigator.requestWakeLock) {
				navigator.wakeLock.request("screen");
			}
		} catch (e) { }
	}
	static hapticFeedback(n = 50) {
		if (navigator.vibrate) {
			navigator.vibrate(n);
		}
	}
	static setBposition() {
		let dist = _('aBtn').getBoundingClientRect().top - 127.5;
		document.documentElement.style.setProperty('--bBtn-top', `${dist}px`);
	}
	static setSlot(s) {
		_('lights').children.forEach(div => div.classList.remove('on'));
		_('lights').children[s].classList.add('on');
	}
	static showRemotePage() {
		_('connectPage').style.display = 'none';
		_('RemotePage').style.display = '';
		this.setBposition();
	}
	static setConnectingStatus(status) {
		// show status page
		_('connectingText').innerHTML = status;
		_('connectPage').style.display = '';
		_('RemotePage').style.display = 'none';
	}
}

GUI.init();

export default GUI;