const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startServer: (port) => ipcRenderer.send('start-server', port),
    onServerStarted: (callback) => ipcRenderer.on('server-started', (event, port) => callback(port))
});
