import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI, ModUploadData } from './types';

const electronAPI: ElectronAPI = {
  selectZip: () => ipcRenderer.invoke('select-zip'),
  selectPreviewImage: () => ipcRenderer.invoke('select-preview-image'),
  getModsDirectory: () => ipcRenderer.invoke('get-mods-directory'),
  uploadToWorkshop: (modData: ModUploadData) => ipcRenderer.invoke('upload-to-workshop', modData),
  getWorkshopItems: () => ipcRenderer.invoke('get-workshop-items')
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);