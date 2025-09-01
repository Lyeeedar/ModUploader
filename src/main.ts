import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ModUploadData, LocalMod, ModMetadata, WorkshopUploadResult, WorkshopItem } from './types';

// Type declarations for steamworks.js
interface SteamworksClient {
  // Add methods as needed based on actual steamworks.js API
}

interface SteamworksModule {
  init: (appId: number) => SteamworksClient | null;
  uploadToWorkshop: (data: any) => Promise<WorkshopUploadResult>;
  updateWorkshopItem: (data: any) => Promise<WorkshopUploadResult>;
  getWorkshopItems: () => Promise<WorkshopItem[]>;
}

let steamworks: SteamworksModule;
try {
  steamworks = require('steamworks.js');
} catch (error) {
  console.error('Failed to load steamworks.js:', error);
}

let mainWindow: BrowserWindow | null = null;
let steamClient: SteamworksClient | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '..', 'icon.png'),
    backgroundColor: '#0a0604',
    titleBarStyle: 'default',
    frame: true,
    resizable: true
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  // Try to initialize Steamworks after window is created
  setTimeout(() => {
    try {
      if (steamworks) {
        // Initialize Steamworks - replace with your app ID
        const appId = 2986600; // Ascend from Nine Mountains app ID
        steamClient = steamworks.init(appId);
        
        if (!steamClient) {
          console.log('Steam client not available - Steam may not be running');
        } else {
          console.log('Steamworks initialized successfully');
        }
      } else {
        console.log('Steamworks module not available');
      }
    } catch (error) {
      console.log('Steam integration not available:', error);
      // This is expected if Steam is not running - not an error
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
        { name: 'All Files', extensions: ['*'] }
      ]
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
        { name: 'All Files', extensions: ['*'] }
      ]
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

ipcMain.handle('get-mods-directory', (): LocalMod[] => {
  // Look for mods in the parent directory
  const modsPath = path.join(__dirname, '..', '..', '..');
  
  try {
    const modDirs = fs.readdirSync(modsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .filter(dirent => {
        // Check if it's a valid mod directory (has mod.json)
        const modJsonPath = path.join(modsPath, dirent.name, 'mod.json');
        return fs.existsSync(modJsonPath);
      })
      .map(dirent => {
        const modJsonPath = path.join(modsPath, dirent.name, 'mod.json');
        const modJson: ModMetadata = JSON.parse(fs.readFileSync(modJsonPath, 'utf8'));
        return {
          name: dirent.name,
          path: path.join(modsPath, dirent.name),
          metadata: modJson,
          workshopId: modJson.workshopId || null
        };
      });
    
    return modDirs;
  } catch (error) {
    console.error('Error reading mods directory:', error);
    return [];
  }
});

ipcMain.handle('upload-to-workshop', async (event: IpcMainInvokeEvent, modData: ModUploadData): Promise<WorkshopUploadResult> => {
  if (!steamClient) {
    throw new Error('Steam is not initialized. Please make sure Steam is running.');
  }

  if (!steamworks) {
    throw new Error('Steamworks module not loaded.');
  }

  try {
    const { zipPath, title, description, tags, visibility, previewImagePath, workshopId } = modData;
    
    // Read the zip file
    const contentBuffer = fs.readFileSync(zipPath);
    
    // Read preview image if provided
    let previewBuffer: Buffer | null = null;
    if (previewImagePath) {
      previewBuffer = fs.readFileSync(previewImagePath);
    }

    let result: WorkshopUploadResult;
    if (workshopId) {
      // Update existing workshop item
      result = await steamworks.updateWorkshopItem({
        publishedFileId: workshopId,
        title,
        description,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        visibility: visibility || 'public',
        content: contentBuffer,
        preview: previewBuffer
      });
    } else {
      // Create new workshop item
      result = await steamworks.uploadToWorkshop({
        title,
        description,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        visibility: visibility || 'public',
        content: contentBuffer,
        preview: previewBuffer
      });
    }

    // Save workshop ID back to mod.json if it's a new upload
    if (!workshopId && result.publishedFileId) {
      const modName = path.basename(zipPath, '.zip');
      const modJsonPath = path.join(__dirname, '..', '..', '..', modName, 'mod.json');
      
      if (fs.existsSync(modJsonPath)) {
        const modJson: ModMetadata = JSON.parse(fs.readFileSync(modJsonPath, 'utf8'));
        modJson.workshopId = result.publishedFileId;
        fs.writeFileSync(modJsonPath, JSON.stringify(modJson, null, 2));
      }
    }

    return result;
  } catch (error) {
    console.error('Workshop upload error:', error);
    throw error;
  }
});

ipcMain.handle('get-workshop-items', async (): Promise<WorkshopItem[]> => {
  // Return empty array if Steam is not available - this is not an error
  if (!steamClient || !steamworks) {
    console.log('Steam not available for workshop items');
    return [];
  }

  try {
    const items = await steamworks.getWorkshopItems();
    return items || [];
  } catch (error) {
    console.log('Could not fetch workshop items (Steam may not be running)');
    return [];
  }
});