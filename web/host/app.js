// if not running in Electron, redirect to home page
if (!window.electron) {
    // window.location.href = 'https://beckersuite.com';
}


import PlayerManager from './player_manager.js';

window.PlayerManager = PlayerManager;