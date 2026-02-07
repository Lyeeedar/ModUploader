// Main Electron entry point

import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config';
import { initializeSteam } from './steam';
import { registerIpcHandlers } from './ipc-handlers';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      preload: path.join(__dirname, '..', 'preload', 'index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', '..', 'icon.ico'),
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
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
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
