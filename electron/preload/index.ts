import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, ModUploadData } from '../../src/types';

const electronAPI: ElectronAPI = {
  selectZip: () => ipcRenderer.invoke('select-zip'),
  selectPreviewImage: () => ipcRenderer.invoke('select-preview-image'),
  extractPackageInfo: (zipPath: string) =>
    ipcRenderer.invoke('extract-package-info', zipPath),
  uploadToWorkshop: (modData: ModUploadData) =>
    ipcRenderer.invoke('upload-to-workshop', modData),
  getWorkshopItems: () => ipcRenderer.invoke('get-workshop-items'),
  openUrl: (url: string) => ipcRenderer.invoke('open-url', url),
  openSteamWorkshop: (publishedFileId: string) =>
    ipcRenderer.invoke('open-steam-workshop', publishedFileId),
  readFileBase64: (filePath: string) =>
    ipcRenderer.invoke('read-file-base64', filePath),
  deleteWorkshopItem: (publishedFileId: string) =>
    ipcRenderer.invoke('delete-workshop-item', publishedFileId),
  getSteamStatus: () => ipcRenderer.invoke('get-steam-status'),
  onSteamInitialized: (callback: () => void) => {
    ipcRenderer.on('steam-initialized', callback);
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('steam-initialized', callback);
    };
  },
  compressPreviewImage: (imagePath: string) =>
    ipcRenderer.invoke('compress-preview-image', imagePath),

  // Auto-updater
  onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: { version: string; releaseNotes?: string }) => callback(info);
    ipcRenderer.on('update-available', listener);
    return () => { ipcRenderer.removeListener('update-available', listener); };
  },
  onUpdateDownloadProgress: (callback: (info: { percent: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: { percent: number }) => callback(info);
    ipcRenderer.on('update-download-progress', listener);
    return () => { ipcRenderer.removeListener('update-download-progress', listener); };
  },
  onUpdateDownloaded: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('update-downloaded', listener);
    return () => { ipcRenderer.removeListener('update-downloaded', listener); };
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
