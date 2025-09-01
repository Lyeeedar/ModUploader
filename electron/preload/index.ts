import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, ModUploadData } from '../../src/types';

const electronAPI: ElectronAPI = {
  selectZip: () => ipcRenderer.invoke('select-zip'),
  selectPreviewImage: () => ipcRenderer.invoke('select-preview-image'),
  uploadToWorkshop: (modData: ModUploadData) => ipcRenderer.invoke('upload-to-workshop', modData),
  getWorkshopItems: () => ipcRenderer.invoke('get-workshop-items')
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);