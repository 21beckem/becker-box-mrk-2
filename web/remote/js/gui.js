import { PACKET } from './remote.js';
let noSleep = new window.NoSleep();

const _ = (x) => document.getElementById(x);
class GUI {
	static b_states = [0, 0];
	static Remote = null;
	static setRemote(remote) { this.Remote = remote; }
	static init() {
		_('launchFullscreenBtn').addEventListener('click', this.attemptFullscreen);
		_('menuBarsBtn').addEventListener('click', () => this.openMenu());
		_('changeDiscBtn').addEventListener('click', () => this.changeDisk());
		_('calibrateBtn').addEventListener('click', () => this.Remote.calibrate());
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
		noSleep.enable();
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

			// ensure the page doesn't destort when going to fullscreen
			window.scrollTo(0, 0);
			document.body.scrollTop = 0;
			_('RemotePage').style.overflowY = 'unset';
			setTimeout(() => _('RemotePage').style.overflowY = 'hidden', 10);
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
		Array.from(_('lights').children).forEach(div => div.classList.remove('on'));
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

	static openMenu() { _('side-menu').classList.remove('closed'); }
	static closeMenu() { _('side-menu').classList.add('closed'); }

	static changeDisk() {
		this.Remote.changeDisk();
		this.closeMenu();
	}
}

GUI.init();

export default GUI;