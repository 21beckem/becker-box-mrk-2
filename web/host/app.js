// if not running in Electron, redirect to home page
if (!window.electron) {
    window.location = 'https://beckersuite.com';
}

import Pointer from './pointer.js';
import PlayerManager from './player_manager.js';


window.p = new Pointer(0);
window.PlayerManager = PlayerManager;