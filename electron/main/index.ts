import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  IpcMainInvokeEvent,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import {
  ModUploadData,
  WorkshopUploadResult,
  WorkshopItem,
  WorkshopItemsResult,
  ModMetadata,
  ModVisibility,
} from '../../src/types';
import { init } from 'steamworks.js';
import type { Client } from 'steamworks.js';

// Import the enums we need from steamworks.js
const UserListType = {
  Published: 0,
  VotedOn: 1,
  VotedUp: 2,
  VotedDown: 3,
  Favorited: 4,
  Subscribed: 5,
  UsedOrPlayed: 6,
  Followed: 7,
};

const UGCType = {
  Items: 0,
  ItemsMtx: 1,
  ItemsReadyToUse: 2,
  Collections: 3,
  Artwork: 4,
  Videos: 5,
  Screenshots: 6,
  AllGuides: 7,
  WebGuides: 8,
  IntegratedGuides: 9,
  UsableInGame: 10,
  ControllerBindings: 11,
  GameManagedItems: 12,
  All: 13,
};

const UserListOrder = {
  CreationOrderAsc: 0,
  CreationOrderDesc: 1,
  TitleAsc: 2,
  LastUpdatedDesc: 3,
  SubscriptionDateDesc: 4,
  VoteScoreDesc: 5,
  ForModeration: 6,
};

const enum UgcItemVisibility {
  Public = 0,
  FriendsOnly = 1,
  Private = 2,
  Unlisted = 3,
}

const appId = 3992260; // Ascend from Nine Mountains app ID

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let steamClient: ReturnType<typeof init> | null = null;
let steamInitialized = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', '..', 'icon.png'),
    backgroundColor: '#0a0604',
    titleBarStyle: 'default',
    frame: true,
    resizable: true,
  });

  // In development, load from Vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built file
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Try to initialize Steamworks after window is created
  setTimeout(() => {
    try {
      // Initialize Steamworks

      // Create steam_appid.txt file if it doesn't exist
      const steamAppIdPath = path.join(process.cwd(), 'steam_appid.txt');
      try {
        if (!fs.existsSync(steamAppIdPath)) {
          fs.writeFileSync(steamAppIdPath, appId.toString());
          console.log('Created steam_appid.txt file');
        }
      } catch (fileError) {
        console.log('Could not create steam_appid.txt:', fileError);
      }

      steamClient = init(appId);

      if (!steamClient) {
        console.log(
          'Steam client not available - Steam may not be running or app not registered',
        );
        console.log(
          'Note: Workshop uploads require Steam to be running and the game to be owned',
        );
      } else {
        console.log('Steamworks initialized successfully');
        console.log('steamClient methods:', Object.keys(steamClient));
        steamInitialized = true;

        // Notify the renderer that Steam is ready
        if (mainWindow) {
          mainWindow.webContents.send('steam-initialized');
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('ConnectToGlobalUser')) {
          console.log(
            'Steam connection failed - make sure Steam is running and you own the game',
          );
          console.log('Workshop functionality will be disabled');
        } else {
          console.log('Steam integration not available:', error.message);
        }
      } else {
        console.log('Steam integration not available:', error);
      }
      // Don't treat this as a fatal error - the app should still work without Steam
    }
  }, 1000);
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

// IPC Handlers

ipcMain.handle('select-zip', async (): Promise<string | null> => {
  console.log('select-zip handler called');

  if (!mainWindow) {
    console.error('No main window available');
    return null;
  }

  try {
    // Focus the window first
    mainWindow.focus();

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Zip Files', extensions: ['zip'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    console.log('Dialog result:', result);

    if (!result.canceled && result.filePaths.length > 0) {
      console.log('Selected file:', result.filePaths[0]);
      return result.filePaths[0];
    }

    console.log('No file selected');
    return null;
  } catch (error) {
    console.error('Error showing file dialog:', error);
    throw error;
  }
});

ipcMain.handle('select-preview-image', async (): Promise<string | null> => {
  console.log('select-preview-image handler called');

  if (!mainWindow) {
    console.error('No main window available');
    return null;
  }

  try {
    // Focus the window first
    mainWindow.focus();

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    console.log('Dialog result:', result);

    if (!result.canceled && result.filePaths.length > 0) {
      console.log('Selected image:', result.filePaths[0]);
      return result.filePaths[0];
    }

    console.log('No image selected');
    return null;
  } catch (error) {
    console.error('Error showing image dialog:', error);
    throw error;
  }
});

const visibilityToUgcVisibility = (visibility: ModVisibility): number => {
  switch (visibility) {
    case 'public':
      return UgcItemVisibility.Public;
    case 'friends':
      return UgcItemVisibility.FriendsOnly;
    case 'private':
      return UgcItemVisibility.Private;
    case 'unlisted':
      return UgcItemVisibility.Unlisted;
  }
};

// Removed get-mods-directory handler since we're focusing on Steam Workshop only

ipcMain.handle(
  'upload-to-workshop',
  async (
    _event: IpcMainInvokeEvent,
    modData: ModUploadData,
  ): Promise<WorkshopUploadResult> => {
    if (!steamClient) {
      throw new Error(
        'Steam is not connected. Please make sure Steam is running and you own "Ascend from Nine Mountains".',
      );
    }

    try {
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

      let publishedFileId: string;

      // Prepare update details for steamworks.js using the proper type
      const updateDetails: Parameters<Client['workshop']['updateItem']>[1] = {};

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

      let ugcResult: { needsToAcceptAgreement: boolean };

      if (!workshopId) {
        // Create new item first
        console.log('Creating new workshop item...');
        const createResult = await steamClient.workshop.createItem(appId);

        publishedFileId = createResult.itemId.toString();
        console.log('Workshop item created successfully:', publishedFileId);

        // Now update the newly created item
        console.log('Updating workshop item with content...');
        ugcResult = await steamClient.workshop.updateItem(
          createResult.itemId,
          updateDetails,
          appId,
        );
      } else {
        // Update existing item
        publishedFileId = workshopId;
        console.log('Updating existing workshop item:', publishedFileId);
        ugcResult = await steamClient.workshop.updateItem(
          BigInt(workshopId),
          updateDetails,
          appId,
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

      // Open workshop page in Steam overlay so user can accept legal agreement and configure item
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
      console.error('Workshop upload error:', error);
      throw error;
    }
  },
);

ipcMain.handle('get-workshop-items', async (): Promise<WorkshopItemsResult> => {
  // Check if Steam is available and initialized
  if (!steamClient || !steamInitialized) {
    return {
      items: [],
      status: 'steam_not_connected',
      message: 'Steam is not connected. Please make sure Steam is running.',
    };
  }

  try {
    const userSteamId = steamClient.localplayer.getSteamId();

    console.log(userSteamId);

    const result = await steamClient.workshop.getUserItems(
      1, // page
      userSteamId.accountId,
      UserListType.Published,
      UGCType.Items,
      UserListOrder.CreationOrderDesc,
      appId,
      appId,
    );

    const items: WorkshopItem[] = result.items
      .filter((item: any) => item != null)
      .map((item: any) => ({
        publishedFileId: item.publishedFileId.toString(),
        title: item.title,
        description: item.description,
        tags: item.tags || [],
        visibility: item.visibility === 0 ? 'public' : 'private',
        createdDate: item.timeCreated,
        updatedDate: item.timeUpdated,
        subscriptions: Number(item.statistics?.numSubscriptions || 0),
        favorited: Number(item.statistics?.numFavorites || 0),
        views: Number(item.statistics?.numUniqueWebsiteViews || 0),
      }));

    return {
      items,
      status: 'success',
      message:
        items.length === 0
          ? 'No workshop items found. Upload your first mod!'
          : undefined,
    };
  } catch (error) {
    console.error('Workshop API error:', error);
    return {
      items: [],
      status: 'error',
      message:
        'Workshop API is currently unavailable. Upload functionality still works.',
    };
  }
});
