const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  sendPacket: (slot, data) => {
    return ipcRenderer.invoke('packet', slot, data);
  }
});