import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
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
  ModPackageInfo,
} from '../../src/types';
import { init } from 'steamworks.js';
import * as yauzl from 'yauzl';
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

// Helper function to format mod names for better visual appeal
function formatModName(name: string): string {
  if (!name) return name;

  return name
    .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) // Capitalize first letter of each word
    .trim(); // Remove any extra whitespace
}

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
    icon: path.join(__dirname, '..', '..', 'icon.ico'),
    backgroundColor: '#0a0604',
    titleBarStyle: 'default',
    frame: true,
    resizable: true,
    autoHideMenuBar: true,
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

ipcMain.handle(
  'open-url',
  async (_event: IpcMainInvokeEvent, url: string): Promise<void> => {
    console.log('Opening URL:', url);
    await shell.openExternal(url);
  },
);

ipcMain.handle(
  'open-steam-workshop',
  async (
    _event: IpcMainInvokeEvent,
    publishedFileId: string,
  ): Promise<void> => {
    console.log('Opening Steam Workshop item:', publishedFileId);

    if (!steamClient || !steamInitialized) {
      // Fallback to opening in browser if Steam is not available
      const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${publishedFileId}`;
      await shell.openExternal(url);
      return;
    }

    try {
      // Use Steam overlay to open the workshop page
      steamClient.overlay.activateToWebPage(
        `steam://url/CommunityFilePage/${publishedFileId}`,
      );
      console.log(
        'Opened Steam Workshop page via overlay for item:',
        publishedFileId,
      );
    } catch (overlayError) {
      console.warn(
        'Could not open Steam overlay, falling back to browser:',
        overlayError,
      );
      // Fallback to opening in browser
      const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${publishedFileId}`;
      await shell.openExternal(url);
    }
  },
);

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

ipcMain.handle(
  'extract-package-info',
  async (
    _event: IpcMainInvokeEvent,
    zipPath: string,
  ): Promise<ModPackageInfo | null> => {
    console.log('extract-package-info handler called with:', zipPath);

    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          console.error('Error opening ZIP file:', err);
          resolve(null);
          return;
        }

        if (!zipfile) {
          console.error('No zipfile object returned');
          resolve(null);
          return;
        }

        let modJsFound = false;

        zipfile.readEntry();

        zipfile.on('entry', (entry) => {
          // Look for mod.js in the root or any folder
          if (entry.fileName.endsWith('mod.js') && !modJsFound) {
            modJsFound = true;

            if (/\/$/.test(entry.fileName)) {
              // Directory entry, skip
              zipfile.readEntry();
              return;
            }

            // File entry, read it
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                console.error('Error opening read stream:', err);
                zipfile.readEntry();
                return;
              }

              if (!readStream) {
                console.error('No read stream returned');
                zipfile.readEntry();
                return;
              }

              let data = '';
              readStream.on('data', (chunk) => {
                data += chunk;
              });

              readStream.on('end', () => {
                try {
                  // Extract metadata from the mod.js file
                  console.log('Parsing mod.js content...');

                  // Look for the getMetadata function and extract its return value
                  // Handle both minified and non-minified code
                  const metadataMatch = data.match(
                    /getMetadata\s*:\s*function\s*\(\s*\)\s*\{\s*return\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})/,
                  );

                  if (!metadataMatch) {
                    console.log('No getMetadata function found in mod.js');
                    resolve(null);
                    zipfile.close();
                    return;
                  }

                  // Parse the metadata object
                  let metadataString = metadataMatch[1];
                  console.log('Found metadata string:', metadataString);

                  // Handle nested objects like author: {name: "value"}
                  // First, try to find the complete metadata object by counting braces
                  let braceCount = 0;
                  let completeMetadata = '';
                  let startIndex = data.indexOf(metadataMatch[1]);

                  for (let i = startIndex; i < data.length; i++) {
                    const char = data[i];
                    completeMetadata += char;

                    if (char === '{') {
                      braceCount++;
                    } else if (char === '}') {
                      braceCount--;
                      if (braceCount === 0) {
                        break;
                      }
                    }
                  }

                  console.log('Complete metadata string:', completeMetadata);

                  // Now clean up the metadata string for JSON parsing
                  let cleanedMetadata = completeMetadata
                    .replace(/(\w+):/g, '"$1":') // Quote unquoted property names
                    .replace(/'/g, '"'); // Convert single quotes to double quotes

                  const metadata = JSON.parse(cleanedMetadata);
                  console.log('Parsed metadata:', metadata);

                  const packageInfo: ModPackageInfo = {
                    name: metadata.name,
                    title: formatModName(metadata.title || metadata.name),
                    description: metadata.description,
                    version: metadata.version,
                    author:
                      typeof metadata.author === 'string'
                        ? metadata.author
                        : metadata.author?.name,
                    tags: metadata.tags || metadata.keywords,
                  };

                  resolve(packageInfo);
                  zipfile.close();
                } catch (parseError) {
                  console.error('Error parsing mod.js metadata:', parseError);
                  console.error('Raw metadata string:', data.substring(0, 500));

                  // Enhanced fallback: try to extract the complete getMetadata return object
                  try {
                    // Look for the exact pattern: getMetadata:function(){return{...}}
                    const fullMatch = data.match(
                      /getMetadata\s*:\s*function\s*\(\s*\)\s*\{\s*return\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/,
                    );

                    if (fullMatch) {
                      console.log('Found full metadata match:', fullMatch[0]);

                      // Extract individual properties using more specific regex
                      const nameMatch = fullMatch[0].match(
                        /name\s*:\s*["']([^"']+)["']/,
                      );
                      const versionMatch = fullMatch[0].match(
                        /version\s*:\s*["']([^"']+)["']/,
                      );
                      const descriptionMatch = fullMatch[0].match(
                        /description\s*:\s*["']([^"']+)["']/,
                      );
                      const authorNameMatch = fullMatch[0].match(
                        /author\s*:\s*\{[^}]*name\s*:\s*["']([^"']+)["']/,
                      );

                      const fallbackInfo: ModPackageInfo = {
                        name: nameMatch?.[1],
                        title: nameMatch?.[1]
                          ? formatModName(nameMatch[1])
                          : undefined,
                        description: descriptionMatch?.[1],
                        version: versionMatch?.[1],
                        author: authorNameMatch?.[1],
                      };

                      console.log(
                        'Using enhanced fallback parsing:',
                        fallbackInfo,
                      );
                      resolve(fallbackInfo);
                      zipfile.close();
                    } else {
                      // Last resort: basic regex extraction
                      const nameMatch = data.match(
                        /name\s*:\s*["']([^"']+)["'][^}]*version\s*:\s*["']([^"']+)["']/,
                      );
                      if (nameMatch) {
                        const basicInfo: ModPackageInfo = {
                          name: nameMatch[1],
                          title: formatModName(nameMatch[1]),
                          version: nameMatch[2],
                        };
                        console.log('Using basic fallback parsing:', basicInfo);
                        resolve(basicInfo);
                        zipfile.close();
                      } else {
                        console.log('All parsing methods failed');
                        resolve(null);
                        zipfile.close();
                      }
                    }
                  } catch (fallbackError) {
                    console.error('Fallback parsing failed:', fallbackError);
                    resolve(null);
                    zipfile.close();
                  }
                }
              });

              readStream.on('error', (streamError) => {
                console.error('Error reading stream:', streamError);
                zipfile.readEntry();
              });
            });
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.on('end', () => {
          if (!modJsFound) {
            console.log('No mod.js found in ZIP file');
            resolve(null);
          }
        });

        zipfile.on('error', (zipError) => {
          console.error('ZIP file error:', zipError);
          resolve(null);
        });
      });
    });
  },
);

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
