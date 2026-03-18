const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Run the server inside Electron
require('./index.js');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        title: "WhatsApp Bot Manager"
    });

    // Remove the default menu
    Menu.setApplicationMenu(null);

    // Wait a brief moment to ensure server is listening
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
        });
    }, 1500);

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

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
