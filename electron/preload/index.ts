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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
