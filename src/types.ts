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

export interface ModPackageInfo {
  name?: string;
  title?: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
}

export interface SteamStatus {
  connected: boolean;
  userId?: string;
  userName?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export interface ImageCompressionResult {
  success: boolean;
  originalPath: string;
  compressedPath?: string;
  originalSize: number;
  compressedSize?: number;
  quality?: number;
  wasCompressed: boolean;
  error?: string;
}

export interface ElectronAPI {
  selectZip: () => Promise<string | null>;
  selectPreviewImage: () => Promise<string | null>;
  extractPackageInfo: (zipPath: string) => Promise<ModPackageInfo | null>;
  uploadToWorkshop: (modData: ModUploadData) => Promise<WorkshopUploadResult>;
  getWorkshopItems: () => Promise<WorkshopItemsResult>;
  openUrl: (url: string) => Promise<void>;
  openSteamWorkshop: (publishedFileId: string) => Promise<void>;
  readFileBase64: (filePath: string) => Promise<string | null>;
  deleteWorkshopItem: (publishedFileId: string) => Promise<DeleteResult>;
  getSteamStatus: () => Promise<SteamStatus>;
  onSteamInitialized: (callback: () => void) => void;
  compressPreviewImage: (imagePath: string) => Promise<ImageCompressionResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
