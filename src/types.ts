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

export type ModVisibility = 'public' | 'friends' | 'private' | 'unlisted';

export interface ModUploadData {
  zipPath?: string; // Optional for workshop item updates
  title: string;
  description: string;
  tags?: string;
  visibility?: ModVisibility;
  previewImagePath?: string;
  workshopId?: string;
  changeNotes?: string;
  change_note?: string; // Alternative field name for Steam compatibility
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

export interface WorkshopItemsResult {
  items: WorkshopItem[];
  status: 'success' | 'steam_not_connected' | 'error';
  message?: string;
}

export interface ElectronAPI {
  selectZip: () => Promise<string | null>;
  selectPreviewImage: () => Promise<string | null>;
  uploadToWorkshop: (modData: ModUploadData) => Promise<WorkshopUploadResult>;
  getWorkshopItems: () => Promise<WorkshopItemsResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
