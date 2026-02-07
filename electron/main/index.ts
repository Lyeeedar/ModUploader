// Main Electron entry point

import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { config } from './config';
import { initializeSteam } from './steam';
import { registerIpcHandlers } from './ipc-handlers';
import { initAutoUpdater } from './updater';

let mainWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): void {
  const { window: windowConfig } = config;

  mainWindow = new BrowserWindow({
    width: windowConfig.width,
    height: windowConfig.height,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: join(__dirname, '..', '..', 'icon.ico'),
    backgroundColor: windowConfig.backgroundColor,
    titleBarStyle: 'default',
    frame: true,
    resizable: true,
    autoHideMenuBar: true,
  });

  // Load content based on environment
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Application lifecycle
app.whenReady().then(async () => {
  // Register IPC handlers before creating window
  registerIpcHandlers(getMainWindow);

  // Create the main window
  createWindow();

  // Initialize auto-updater
  if (mainWindow) {
    initAutoUpdater(mainWindow);
  }

  // Initialize Steam after window is created
  const steamDelay = config.timeouts.steamInitialization;
  setTimeout(async () => {
    const success = await initializeSteam(mainWindow);
    if (success) {
      console.log('Steam integration ready');
    } else {
      console.log('Steam integration unavailable - app will work in offline mode');
    }
  }, steamDelay);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
