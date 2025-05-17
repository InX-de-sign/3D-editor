const { app, BrowserWindow } = require('electron');
// const path = require('path');

console.log('Electron app is starting...');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        backgroundColor: '#808080',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webgl: true
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.webContents.openDevTools();

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Window loaded successfully');
    });
}

app.whenReady().then(() => {
    console.log('Electron is ready!');
    createWindow();
}).catch(err => {
    console.error('Error during app initialization:', err);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});