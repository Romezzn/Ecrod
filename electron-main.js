const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Custom Glassmorphism Windows titlebar
    transparent: true,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Bypasses browser HTTP audio origin restrictions in desktop client
    }
  });

  // Automatically approve microphone & media permissions in desktop app
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    callback(true);
  });

  // Load app (connects to http://sg.dimzo.es:9090 by default in standalone .exe)
  const serverUrl = process.env.SERVER_URL || 'http://sg.dimzo.es:9090';
  mainWindow.loadURL(serverUrl).catch(() => {
    mainWindow.loadFile(path.join(__dirname, 'public/index.html'));
  });

  // Window control IPC handlers
  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window-close', () => mainWindow.close());
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
