// Steam integration module - handles Steam SDK initialization and client management

import * as path from 'path';
import * as fs from 'fs';
import { init } from '@pipelab/steamworks.js';
import type { Client } from '@pipelab/steamworks.js';
import { config } from './config';
import { BrowserWindow } from 'electron';

export type SteamClient = ReturnType<typeof init>;

let steamClient: SteamClient | null = null;
let steamInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

export function getSteamClient(): SteamClient | null {
  return steamClient;
}

export function isSteamInitialized(): boolean {
  return steamInitialized;
}

/**
 * Initialize Steam SDK with retry logic
 * Returns a promise that resolves to true if successful, false otherwise
 */
export async function initializeSteam(
  mainWindow: BrowserWindow | null,
): Promise<boolean> {
  // If already initializing, return the existing promise
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = doInitializeSteam(mainWindow);
  const result = await initializationPromise;
  initializationPromise = null;
  return result;
}

async function doInitializeSteam(
  mainWindow: BrowserWindow | null,
): Promise<boolean> {
  const { appId } = config;
  const { steamInitMaxRetries, steamInitRetryDelay } = config.timeouts;

  for (let attempt = 1; attempt <= steamInitMaxRetries; attempt++) {
    try {
      // Ensure steam_appid.txt exists
      ensureSteamAppIdFile();

      steamClient = init(appId);

      if (!steamClient) {
        console.log(
          `Steam init attempt ${attempt}/${steamInitMaxRetries}: Client not available`,
        );
        if (attempt < steamInitMaxRetries) {
          await sleep(steamInitRetryDelay);
          continue;
        }
        return false;
      }

      console.log('Steamworks initialized successfully');
      console.log('Available Steam methods:', Object.keys(steamClient));
      steamInitialized = true;

      // Notify renderer that Steam is ready
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('steam-initialized');
      }

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('ConnectToGlobalUser')) {
        console.log(
          'Steam connection failed - make sure Steam is running and you own the game',
        );
      } else {
        console.log(
          `Steam init attempt ${attempt}/${steamInitMaxRetries} failed:`,
          errorMessage,
        );
      }

      if (attempt < steamInitMaxRetries) {
        await sleep(steamInitRetryDelay);
      }
    }
  }

  console.log('Steam initialization failed after all retries');
  console.log('Workshop functionality will be disabled');
  return false;
}

function ensureSteamAppIdFile(): void {
  const steamAppIdPath = path.join(process.cwd(), 'steam_appid.txt');
  try {
    if (!fs.existsSync(steamAppIdPath)) {
      fs.writeFileSync(steamAppIdPath, config.appId.toString());
      console.log('Created steam_appid.txt file');
    }
  } catch (error) {
    console.log('Could not create steam_appid.txt:', error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Open Steam Workshop page for an item
 */
export async function openSteamWorkshopPage(
  publishedFileId: string,
): Promise<void> {
  if (!steamClient || !steamInitialized) {
    throw new Error('Steam is not initialized');
  }

  try {
    steamClient.overlay.activateToWebPage(
      `steam://url/CommunityFilePage/${publishedFileId}`,
    );
    console.log(
      'Opened Steam Workshop page via overlay for item:',
      publishedFileId,
    );
  } catch (error) {
    console.warn('Could not open Steam overlay:', error);
    throw error;
  }
}

/**
 * Get the Workshop URL for an item (for fallback browser opening)
 */
export function getWorkshopUrl(publishedFileId: string): string {
  return `https://steamcommunity.com/sharedfiles/filedetails/?id=${publishedFileId}`;
}
