const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
	init: () => {
		return ipcRenderer.invoke('init');
	},
	addPlayer: () => {
		return ipcRenderer.invoke('addPlayer');
	},
	removePlayer: (slot) => {
		return ipcRenderer.invoke('removePlayer', slot);
	},
	sendPacket: (slot, data) => {
		return ipcRenderer.invoke('sendPacket', slot, data);
	},
	startWii: () => {
		return ipcRenderer.invoke('startWii');
	},
	getDiscList: () => {
		return ipcRenderer.invoke('getDiscList');
	},
	startDiscSelection: () => {
		return ipcRenderer.invoke('startDiscSelection');
	},
	changeDisc: (path) => {
		return ipcRenderer.invoke('changeDisc', path);
	}
});