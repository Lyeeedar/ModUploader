export interface ModMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  workshopId?: string;
  [key: string]: unknown;
}

// Re-export from navigation types for compatibility
export { LocalMod } from './types/navigation';

export interface ModUploadData {
  zipPath: string;
  title: string;
  description: string;
  tags?: string;
  visibility?: 'public' | 'friends' | 'private' | 'unlisted';
  previewImagePath?: string;
  workshopId?: string;
}

export interface WorkshopItem {
  publishedFileId: string;
  title: string;
  description: string;
  tags: string[];
  visibility: string;
  createdDate: number;
  updatedDate: number;
  subscriptions: number;
  favorited: number;
  views: number;
}

export interface WorkshopUploadResult {
  success: boolean;
  publishedFileId?: string;
  error?: string;
}

export interface ElectronAPI {
  selectZip: () => Promise<string | null>;
  selectPreviewImage: () => Promise<string | null>;
  getModsDirectory: () => Promise<import('./types/navigation').LocalMod[]>;
  uploadToWorkshop: (modData: ModUploadData) => Promise<WorkshopUploadResult>;
  getWorkshopItems: () => Promise<WorkshopItem[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}