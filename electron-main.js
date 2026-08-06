const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const CURRENT_VERSION = '1.0.0';
const SERVER_URL = process.env.SERVER_URL || 'http://sg.dimzo.es:9090';

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
  mainWindow.loadURL(SERVER_URL).catch(() => {
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

  // Check for auto-updates after 3 seconds
  setTimeout(checkForUpdates, 3000);
}

function checkForUpdates() {
  try {
    const url = new URL('/api/version', SERVER_URL);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.version && json.version !== CURRENT_VERSION) {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              buttons: ['Actualizar Ahora', 'Luego'],
              defaultId: 0,
              title: '⚡ Actualización Disponible',
              message: `Nueva versión de EmergencyCord (${json.version}) disponible en el servidor. ¿Deseas descargarla y sobreescribir automáticamente?`
            }).then(({ response }) => {
              if (response === 0) {
                downloadAndUpdate(json.downloadUrl);
              }
            });
          }
        } catch (e) {
          console.log('Error leyendo versión del servidor:', e);
        }
      });
    }).on('error', (err) => {
      console.log('No se pudo comprobar actualización:', err.message);
    });
  } catch (e) {}
}

function downloadAndUpdate(relativeDownloadUrl) {
  const downloadUrl = new URL(relativeDownloadUrl, SERVER_URL).href;
  const tempExePath = path.join(app.getPath('temp'), 'EmergencyCord-Update.exe');
  const file = fs.createWriteStream(tempExePath);

  http.get(downloadUrl, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close(() => {
        // Launch updated executable and close current instance
        spawn(tempExePath, [], { detached: true, stdio: 'ignore' }).unref();
        app.quit();
      });
    });
  }).on('error', (err) => {
    fs.unlink(tempExePath, () => {});
    dialog.showErrorBox('Error', 'No se pudo descargar la actualización: ' + err.message);
  });
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
