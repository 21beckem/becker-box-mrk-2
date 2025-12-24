// if not running in Electron, redirect to home page
if (!window.electron) {
    // window.location.href = 'https://beckersuite.com';
}


import PlayerManager from './player_manager.js';

window.PlayerManager = PlayerManager;



// --- disc select page ---
const dummyData = [
    {
        name: 'Wii Sports',
        img: 'https://art.gametdb.com/wii/cover3D/US/RSPE01.png',
        path: 'C:\\Users\\21bec\\local-git\\becker-box-mrk-2\\games\\Wii Sports.rvz'
    },
    {
        name: 'Wii Sports',
        img: 'https://art.gametdb.com/wii/cover3D/US/RSPE01.png',
        path: 'C:\\Users\\21bec\\local-git\\becker-box-mrk-2\\games\\Wii Sports.rvz'
    },
    {
        name: 'Wii Sports',
        img: 'https://art.gametdb.com/wii/cover3D/US/RSPE01.png',
        path: 'C:\\Users\\21bec\\local-git\\becker-box-mrk-2\\games\\Wii Sports.rvz'
    },
    {
        name: 'Wii Sports',
        img: 'https://art.gametdb.com/wii/cover3D/US/RSPE01.png',
        path: 'C:\\Users\\21bec\\local-git\\becker-box-mrk-2\\games\\Wii Sports.rvz'
    },
    {
        name: 'Wii Sports',
        img: 'https://art.gametdb.com/wii/cover3D/US/RSPE01.png',
        path: 'C:\\Users\\21bec\\local-git\\becker-box-mrk-2\\games\\Wii Sports.rvz'
    },
    {
        name: 'Wii Sports',
        img: 'https://art.gametdb.com/wii/cover3D/US/RSPE01.png',
        path: 'C:\\Users\\21bec\\local-git\\becker-box-mrk-2\\games\\Wii Sports.rvz'
    },
    {
        name: 'Wii Sports',
        img: 'https://art.gametdb.com/wii/cover3D/US/RSPE01.png',
        path: 'C:\\Users\\21bec\\local-git\\becker-box-mrk-2\\games\\Wii Sports.rvz'
    },
    {
        name: 'Wii Sports',
        img: 'https://art.gametdb.com/wii/cover3D/US/RSPE01.png',
        path: 'C:\\Users\\21bec\\local-git\\becker-box-mrk-2\\games\\Wii Sports.rvz'
    },
    {
        name: 'Wii Sports',
        img: 'https://art.gametdb.com/wii/cover3D/US/RSPE01.png',
        path: 'C:\\Users\\21bec\\local-git\\becker-box-mrk-2\\games\\Wii Sports.rvz'
    },
    {
        name: 'Wii Sports',
        img: 'https://art.gametdb.com/wii/cover3D/US/RSPE01.png',
        path: 'C:\\Users\\21bec\\local-git\\becker-box-mrk-2\\games\\Wii Sports.rvz'
    },
    {
        name: 'Wii Sports',
        img: 'https://art.gametdb.com/wii/cover3D/US/RSPE01.png',
        path: 'C:\\Users\\21bec\\local-git\\becker-box-mrk-2\\games\\Wii Sports.rvz'
    }
];
const discSelectPage = document.getElementById('discSelectPage');
const discGrid = document.getElementById('discGrid');
document.getElementById('backBtn').onclick = () => window.hideDiscSelectPage();

window.showDiscSelectPage = async () => {
    let canStart = await window.electron.startDiscSelection();
    if (canStart===false) return;

    let discs = canStart;
    
    discSelectPage.style.display = 'unset';
    discGrid.innerHTML = '';
    
    discs.forEach(disc => {
        const discBtn = document.createElement('button');
        discBtn.className = 'disc';
        discBtn.onclick = () => window.electron.changeDisc(disc.path);
        discBtn.innerHTML = `
            <img src="${disc.img}" alt="${disc.name}">
            <p>${disc.name}</p>
        `;
        discGrid.appendChild(discBtn);
    });
}
window.hideDiscSelectPage = () => {
    discSelectPage.style.display = 'none';
}