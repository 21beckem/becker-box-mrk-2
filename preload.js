const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
	addPlayer: () => {
		return ipcRenderer.invoke('addPlayer');
	},
	removePlayer: (slot) => {
		return ipcRenderer.invoke('removePlayer', slot);
	},
	sendPacket: (slot, data) => {
		return ipcRenderer.invoke('sendPacket', slot, data);
	}
});