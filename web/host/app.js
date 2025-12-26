// if not running in Electron, redirect to home page
if (!window.electron) {
    window.location.href = 'https://beckersuite.com';
}


import PlayerManager from './player_manager.js';

window.PlayerManager = PlayerManager;



// --- disc select page ---
const discSelectPage = document.getElementById('discSelectPage');
const discGrid = document.getElementById('discGrid');
document.getElementById('backBtn').onclick = () => {
    window.electron.changeDisc('');
    window.hideDiscSelectPage();
};

window.showDiscSelectPage = async () => {
    let canStart = await window.electron.startDiscSelection();
    if (canStart===false) return;

    let discs = canStart;
    
    discSelectPage.style.display = 'unset';
    discGrid.innerHTML = '';
    
    discs.forEach(disc => {
        const discBtn = document.createElement('button');
        discBtn.className = 'disc';
        discBtn.onclick = () => {
            window.electron.changeDisc(disc.path);
            window.hideDiscSelectPage();
        };
        discBtn.innerHTML = `
            <img src="${disc.img || 'img/wii-disk.png'}" alt="${disc.name}">
            <p>${disc.name}</p>
        `;
        discGrid.appendChild(discBtn);
    });
}
window.hideDiscSelectPage = () => {
    discSelectPage.style.display = 'none';
}