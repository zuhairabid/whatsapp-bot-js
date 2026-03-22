const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { startServer } = require('./index.js');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: "WhatsApp Bot Manager"
    });

    // Remove the default menu
    Menu.setApplicationMenu(null);

    // Load the file locally (no server needed yet)
    mainWindow.loadFile(path.join(__dirname, 'public/index.html'));
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

// Handle starting the server via IPC
ipcMain.on('start-server', (event, port) => {
    console.log(`Starting server on port: ${port}`);
    try {
        const portNumber = parseInt(port, 10);
        if (isNaN(portNumber) || portNumber < 1024 || portNumber > 65535) {
            console.error('Invalid port number');
            return;
        }

        startServer(portNumber);
        
        // Notify the UI that the server is up
        event.reply('server-started', portNumber);
    } catch (err) {
        console.error('Failed to start server:', err);
    }
});

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});
