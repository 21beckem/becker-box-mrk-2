const _ = (x) => document.getElementById(x);
class GUI {
    static buttons = {
        'u': 0,
        'l': 0,
        'r': 0,
        'd': 0,
        'a': 0,
        'b': 0,
        '-': 0,
        'H': 0,
        '+': 0,
        '1': 0,
        '2': 0
    };
    static b_states = [0, 0];
    static init() {
        GUI.setBposition();
        window.addEventListener('resize', GUI.setBposition);
        
        // add haptic feedback for all buttons and ensure the page is in fullscreen
        document.querySelectorAll('#RemotePage div.btn').forEach(div => {
            div.addEventListener('touchstart', event => {
                if (event.target.getAttribute('data-key') == 'b') {
                    GUI.b_states[event.target.id.includes('1') ? 0 : 1] = 1;
                    GUI.buttons.b = 1;
                } else {
                    GUI.buttons[event.target.getAttribute('data-key')] = 1;
                }
                // console.log(JSON.stringify(GUI.buttons, null, 2));
                event.target.classList.add('pressed');
                GUI.attemptFullscreen();
                GUI.hapticFeedback();
            });
            div.addEventListener('touchend', event => {
                if (event.target.getAttribute('data-key') == 'b') {
                    GUI.b_states[event.target.id.includes('1') ? 0 : 1] = 0;
                    GUI.buttons.b = parseInt(GUI.b_states[0] || GUI.b_states[1]);
                } else {
                    GUI.buttons[event.target.getAttribute('data-key')] = 0;
                }
                // console.log(JSON.stringify(GUI.buttons, null, 2));
                event.target.classList.remove('pressed');
                GUI.hapticFeedback();
            });
        });
    }
    static attemptFullscreen() {
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

        // request wake lock too
        if (navigator.requestWakeLock) {
            navigator.wakeLock.request("screen");
        }
    }
    static hapticFeedback(n=50) {
        if (navigator.vibrate) {
            navigator.vibrate(n);
        }
    }
    static setBposition() {
        let dist = _('aBtn').getBoundingClientRect().top - 127.5;
        document.documentElement.style.setProperty('--bBtn-top', `${dist}px`);
    }
    static setSlot(s) {
        _('lights').children[s].classList.add('on');
    }
}

GUI.init();