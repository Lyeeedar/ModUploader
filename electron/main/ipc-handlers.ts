// IPC Handlers for Electron main process

import {
  ipcMain,
  dialog,
  shell,
  BrowserWindow,
  IpcMainInvokeEvent,
} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { Client } from '@pipelab/steamworks.js';
import {
  ModUploadData,
  WorkshopUploadResult,
  WorkshopItem,
  WorkshopItemsResult,
  ImageCompressionResult,
} from '../../src/types';
import { config } from './config';
import {
  getSteamClient,
  isSteamInitialized,
  initializeSteam,
  openSteamWorkshopPage,
  getWorkshopUrl,
} from './steam';
import {
  visibilityToUgcVisibility,
  ugcVisibilityToString,
} from './steam-types';
import { extractModMetadata } from './mod-parser';
import { compressPreviewImage, getImageSizeInfo } from './image-utils';

// Whitelist of allowed file paths for reading (security)
const allowedFilePaths = new Set<string>();

type WorkshopQueryResult = {
  items?: Array<unknown | null | undefined>;
};

type WorkshopApiCompatibility = {
  getUserItems?: (...args: unknown[]) => Promise<unknown>;
};

/**
 * Register a file path as allowed for reading
 */
function allowFilePath(filePath: string): void {
  if (filePath) {
    allowedFilePaths.add(path.resolve(filePath));
  }
}

/**
 * Check if a file path is allowed for reading
 */
function isFilePathAllowed(filePath: string): boolean {
  const resolvedPath = path.resolve(filePath);
  // Allow temp directory files and whitelisted paths
  const tempDir = path.resolve(require('os').tmpdir());
  if (resolvedPath.startsWith(tempDir)) {
    return true;
  }
  return allowedFilePaths.has(resolvedPath);
}

function isSteamAuthError(errorMessage: string): boolean {
  const message = errorMessage.toLowerCase();
  return (
    message.includes('user not logged on') ||
    message.includes('not logged in')
  );
}

function normalizeWorkshopError(error: unknown): Error {
  const errorMessage =
    error instanceof Error ? error.message : String(error);

  if (isSteamAuthError(errorMessage)) {
    return new Error(
      'Steam user is not logged in. Open Steam and sign in to the account that owns "Ascend from Nine Mountains", then retry.',
    );
  }

  return error instanceof Error ? error : new Error(errorMessage);
}

async function ensureSteamClientReady(
  getMainWindow: () => BrowserWindow | null,
): Promise<NonNullable<ReturnType<typeof getSteamClient>>> {
  let steamClient = getSteamClient();

  if (!steamClient || !isSteamInitialized()) {
    const initialized = await initializeSteam(getMainWindow());
    if (!initialized) {
      throw new Error(
        'Steam is not connected. Please make sure Steam is running and logged in.',
      );
    }
    steamClient = getSteamClient();
  }

  if (!steamClient || !isSteamInitialized()) {
    throw new Error(
      'Steam is not connected. Please make sure Steam is running and logged in.',
    );
  }

  try {
    steamClient.localplayer.getSteamId();
    steamClient.localplayer.getName();
  } catch (error) {
    throw normalizeWorkshopError(error);
  }

  return steamClient;
}

function getItemsFromQueryResult(result: unknown): Array<unknown | null | undefined> {
  if (
    result &&
    typeof result === 'object' &&
    Array.isArray((result as WorkshopQueryResult).items)
  ) {
    return (result as WorkshopQueryResult).items || [];
  }
  return [];
}

async function queryWorkshopItemsWithCompatibility(
  steamClient: NonNullable<ReturnType<typeof getSteamClient>>,
): Promise<Array<unknown | null | undefined>> {
  const userSteamId = steamClient.localplayer.getSteamId();
  const { UserListType, UGCType, UserListOrder } = config.steam;
  const workshopApi = steamClient.workshop as unknown as WorkshopApiCompatibility;
  let lastError: unknown = null;

  if (typeof workshopApi.getUserItems === 'function') {
    // Query config to request full descriptions (not truncated)
    const queryConfig = { includeLongDescription: true };

    try {
      const result = await workshopApi.getUserItems(
        1, // page
        userSteamId.accountId,
        UserListType.Published,
        UGCType.Items,
        UserListOrder.CreationOrderDesc,
        { creator: config.appId, consumer: config.appId },
        queryConfig,
      );
      return getItemsFromQueryResult(result);
    } catch (error) {
      lastError = error;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn('Modern getUserItems signature failed:', errorMessage);
    }

    try {
      // Legacy steamworks.js versions expected creatorAppId and consumerAppId as separate args.
      const result = await workshopApi.getUserItems(
        1, // page
        userSteamId.accountId,
        UserListType.Published,
        UGCType.Items,
        UserListOrder.CreationOrderDesc,
        config.appId,
        config.appId,
        queryConfig,
      );
      return getItemsFromQueryResult(result);
    } catch (error) {
      lastError = error;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn('Legacy getUserItems signature failed:', errorMessage);
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error('No compatible Steam Workshop query method available');
}

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  // Open external URL
  ipcMain.handle(
    'open-url',
    async (_event: IpcMainInvokeEvent, url: string): Promise<void> => {
      console.log('Opening URL:', url);
      await shell.openExternal(url);
    },
  );

  // Open Steam Workshop page
  ipcMain.handle(
    'open-steam-workshop',
    async (
      _event: IpcMainInvokeEvent,
      publishedFileId: string,
    ): Promise<void> => {
      console.log('Opening Steam Workshop item:', publishedFileId);

      try {
        await openSteamWorkshopPage(publishedFileId);
      } catch {
        // Fallback to browser
        const url = getWorkshopUrl(publishedFileId);
        await shell.openExternal(url);
      }
    },
  );

  // Select ZIP file
  ipcMain.handle('select-zip', async (): Promise<string | null> => {
    console.log('select-zip handler called');
    const mainWindow = getMainWindow();

    if (!mainWindow) {
      console.error('No main window available');
      return null;
    }

    try {
      mainWindow.focus();

      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'Zip Files', extensions: ['zip'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        console.log('Selected file:', selectedPath);
        allowFilePath(selectedPath);
        return selectedPath;
      }

      console.log('No file selected');
      return null;
    } catch (error) {
      console.error('Error showing file dialog:', error);
      throw error;
    }
  });

  // Select preview image
  ipcMain.handle('select-preview-image', async (): Promise<string | null> => {
    console.log('select-preview-image handler called');
    const mainWindow = getMainWindow();

    if (!mainWindow) {
      console.error('No main window available');
      return null;
    }

    try {
      mainWindow.focus();

      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        console.log('Selected image:', selectedPath);
        allowFilePath(selectedPath);
        return selectedPath;
      }

      console.log('No image selected');
      return null;
    } catch (error) {
      console.error('Error showing image dialog:', error);
      throw error;
    }
  });

  // Extract package info from ZIP
  ipcMain.handle(
    'extract-package-info',
    async (_event: IpcMainInvokeEvent, zipPath: string) => {
      console.log('extract-package-info handler called with:', zipPath);
      return extractModMetadata(zipPath);
    },
  );

  // Read file as base64 for preview
  ipcMain.handle(
    'read-file-base64',
    async (
      _event: IpcMainInvokeEvent,
      filePath: string,
    ): Promise<string | null> => {
      try {
        // Security check: only allow reading whitelisted files or temp files
        if (!isFilePathAllowed(filePath)) {
          console.error('File read denied - not in whitelist:', filePath);
          return null;
        }

        if (!fs.existsSync(filePath)) {
          return null;
        }
        const buffer = await fs.promises.readFile(filePath);
        const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
        const mimeType =
          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
      } catch (error) {
        console.error('Error reading file as base64:', error);
        return null;
      }
    },
  );

  // Compress preview image to fit Steam Workshop 1MB limit
  ipcMain.handle(
    'compress-preview-image',
    async (
      _event: IpcMainInvokeEvent,
      imagePath: string,
    ): Promise<ImageCompressionResult> => {
      console.log('compress-preview-image handler called with:', imagePath);
      const sizeInfo = getImageSizeInfo(imagePath);
      console.log(
        `Image size: ${sizeInfo.sizeFormatted}, exceeds limit: ${sizeInfo.exceedsLimit}`,
      );
      const result = await compressPreviewImage(imagePath);
      // Whitelist the compressed image path for reading
      if (result.success && result.compressedPath) {
        allowFilePath(result.compressedPath);
      }
      return result;
    },
  );

  // Upload to Workshop
  ipcMain.handle(
    'upload-to-workshop',
    async (
      _event: IpcMainInvokeEvent,
      modData: ModUploadData,
    ): Promise<WorkshopUploadResult> => {
      try {
        const steamClient = await ensureSteamClientReady(getMainWindow);

        const {
          zipPath,
          title,
          description,
          tags,
          visibility,
          previewImagePath,
          changeNotes,
        } = modData;
        let { workshopId } = modData;

        // Prepare update details
        const updateDetails: Parameters<Client['workshop']['updateItem']>[1] =
          {};

        if (title) {
          updateDetails.title = title;
        }

        if (description) {
          updateDetails.description = description;
        }

        if (tags) {
          updateDetails.tags = tags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        }

        updateDetails.visibility = visibilityToUgcVisibility(
          visibility || 'private',
        );

        if (zipPath) {
          updateDetails.contentPath = zipPath;
        }

        if (previewImagePath && fs.existsSync(previewImagePath)) {
          updateDetails.previewPath = previewImagePath;
        }

        if (changeNotes) {
          updateDetails.changeNote = changeNotes;
        }

        let publishedFileId: string;

        if (!workshopId) {
          // Create new item first
          console.log('Creating new workshop item...');
          const createResult = await steamClient.workshop.createItem(
            config.appId,
          );

          publishedFileId = createResult.itemId.toString();
          console.log('Workshop item created successfully:', publishedFileId);

          // Update the newly created item
          console.log('Updating workshop item with content...');
          await steamClient.workshop.updateItem(
            createResult.itemId,
            updateDetails,
            config.appId,
          );
        } else {
          // Update existing item
          publishedFileId = workshopId;
          console.log('Updating existing workshop item:', publishedFileId);
          await steamClient.workshop.updateItem(
            BigInt(workshopId),
            updateDetails,
            config.appId,
          );
        }

        const result: WorkshopUploadResult = {
          success: true,
          publishedFileId: publishedFileId,
          error: undefined,
        };

        console.log(
          'Workshop upload completed successfully:',
          result.publishedFileId,
        );

        // Open workshop page in Steam overlay
        try {
          steamClient.overlay.activateToWebPage(
            `steam://url/CommunityFilePage/${publishedFileId}`,
          );
          console.log('Opened Steam Workshop page for item:', publishedFileId);
        } catch (overlayError) {
          console.warn(
            'Could not open Steam overlay to workshop page:',
            overlayError,
          );
        }

        return result;
      } catch (error) {
        const normalizedError = normalizeWorkshopError(error);
        console.error('Workshop upload error:', normalizedError);
        throw normalizedError;
      }
    },
  );

  // Get Workshop items
  ipcMain.handle('get-workshop-items', async (): Promise<WorkshopItemsResult> => {
    let steamClient: NonNullable<ReturnType<typeof getSteamClient>>;
    try {
      steamClient = await ensureSteamClientReady(getMainWindow);
    } catch (error) {
      const normalizedError = normalizeWorkshopError(error);
      return {
        items: [],
        status: 'steam_not_connected',
        message: normalizedError.message,
      };
    }

    try {
      const workshopItems = await queryWorkshopItemsWithCompatibility(steamClient);

      const items: WorkshopItem[] = workshopItems
        .filter((item: unknown) => item != null)
        .map((item: unknown) => {
          const typedItem = item as {
            publishedFileId: bigint;
            title: string;
            description: string;
            tags?: string[];
            visibility: number;
            timeCreated: number;
            timeUpdated: number;
            statistics?: {
              numSubscriptions?: number | bigint;
              numFavorites?: number | bigint;
              numUniqueWebsiteViews?: number | bigint;
            };
          };
          return {
            publishedFileId: typedItem.publishedFileId.toString(),
            title: typedItem.title,
            description: typedItem.description,
            tags: typedItem.tags || [],
            visibility: ugcVisibilityToString(typedItem.visibility),
            createdDate: typedItem.timeCreated,
            updatedDate: typedItem.timeUpdated,
            subscriptions: Number(
              typedItem.statistics?.numSubscriptions || 0,
            ),
            favorited: Number(typedItem.statistics?.numFavorites || 0),
            views: Number(typedItem.statistics?.numUniqueWebsiteViews || 0),
          };
        });

      return {
        items,
        status: 'success',
        message:
          items.length === 0
            ? 'No workshop items found. Upload your first mod!'
            : undefined,
      };
    } catch (error) {
      const normalizedError = normalizeWorkshopError(error);
      console.error('Workshop API error:', normalizedError);
      if (isSteamAuthError(normalizedError.message)) {
        return {
          items: [],
          status: 'steam_not_connected',
          message: normalizedError.message,
        };
      }
      return {
        items: [],
        status: 'error',
        message:
          'Workshop API is currently unavailable. Upload functionality still works.',
      };
    }
  });

  // Delete Workshop item
  ipcMain.handle(
    'delete-workshop-item',
    async (
      _event: IpcMainInvokeEvent,
      publishedFileId: string,
    ): Promise<{ success: boolean; error?: string }> => {
      let steamClient: NonNullable<ReturnType<typeof getSteamClient>>;
      try {
        steamClient = await ensureSteamClientReady(getMainWindow);
      } catch (error) {
        const normalizedError = normalizeWorkshopError(error);
        return { success: false, error: normalizedError.message };
      }

      try {
        console.log('Deleting workshop item:', publishedFileId);
        await steamClient.workshop.deleteItem(BigInt(publishedFileId));
        console.log('Workshop item deleted successfully');
        return { success: true };
      } catch (error) {
        const normalizedError = normalizeWorkshopError(error);
        const errorMsg =
          normalizedError instanceof Error
            ? normalizedError.message
            : String(normalizedError);
        console.error('Failed to delete workshop item:', errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }
    },
  );

  // Check Steam connection status
  ipcMain.handle('get-steam-status', async (): Promise<{
    connected: boolean;
    userId?: string;
    userName?: string;
  }> => {
    let steamClient = getSteamClient();
    if (!steamClient || !isSteamInitialized()) {
      await initializeSteam(getMainWindow());
      steamClient = getSteamClient();
    }

    if (!steamClient || !isSteamInitialized()) {
      return { connected: false };
    }

    try {
      const steamId = steamClient.localplayer.getSteamId();
      const userName = steamClient.localplayer.getName();
      return {
        connected: true,
        userId: steamId.steamId64.toString(),
        userName,
      };
    } catch {
      return { connected: false };
    }
  });
}
