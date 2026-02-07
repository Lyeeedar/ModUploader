// Auto-updater module for electron-updater

import { app, BrowserWindow, ipcMain } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

let mainWindow: BrowserWindow | null = null;

function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

/**
 * Initialize the auto-updater and register IPC handlers.
 * Should be called once after the main window is created.
 */
export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win;

  // Don't check for updates in dev mode
  if (!app.isPackaged) {
    console.log('Auto-updater disabled in development mode');
    return;
  }

  // Let the user decide when to download
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // --- Auto-updater events ---

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    sendToRenderer('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update-download-progress', {
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded, ready to install');
    sendToRenderer('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
    sendToRenderer('update-error', { message: err.message });
  });

  // --- IPC handlers ---

  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) return;
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      console.error('Failed to check for updates:', err);
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      console.error('Failed to download update:', err);
    }
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // Check for updates shortly after launch
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Initial update check failed:', err);
    });
  }, 5000);
}
