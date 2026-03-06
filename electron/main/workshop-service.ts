import * as fs from 'fs';
import type { BrowserWindow } from 'electron';
import type { Client } from '@pipelab/steamworks.js';
import type { ModUploadData, WorkshopUploadResult } from '../../src/types';
import { config } from './config';
import { getSteamClient, initializeSteam, isSteamInitialized } from './steam';
import { visibilityToUgcVisibility } from './steam-types';

const WORKSHOP_ID_PATTERN = /^\d+$/;

export function isSteamAuthError(errorMessage: string): boolean {
  const message = errorMessage.toLowerCase();
  return (
    message.includes('user not logged on') ||
    message.includes('not logged in')
  );
}

export function normalizeWorkshopError(error: unknown): Error {
  const errorMessage =
    error instanceof Error ? error.message : String(error);

  if (isSteamAuthError(errorMessage)) {
    return new Error(
      'Steam user is not logged in. Open Steam and sign in to the account that owns "Ascend from Nine Mountains", then retry.',
    );
  }

  return error instanceof Error ? error : new Error(errorMessage);
}

export function parseWorkshopId(
  workshopId: string,
  label = 'workshop ID',
): bigint {
  const normalizedWorkshopId = workshopId.trim();
  if (!WORKSHOP_ID_PATTERN.test(normalizedWorkshopId)) {
    throw new Error(
      `Invalid ${label}. It must be a non-negative integer (digits 0-9 only).`,
    );
  }
  return BigInt(normalizedWorkshopId);
}

export async function ensureSteamClientReady(
  mainWindow: BrowserWindow | null,
): Promise<NonNullable<ReturnType<typeof getSteamClient>>> {
  let steamClient = getSteamClient();

  if (!steamClient || !isSteamInitialized()) {
    const initialized = await initializeSteam(mainWindow);
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

export interface UploadWorkshopOptions {
  mainWindow?: BrowserWindow | null;
  openWorkshopPage?: boolean;
}

export async function uploadWorkshopItem(
  modData: ModUploadData,
  options: UploadWorkshopOptions = {},
): Promise<WorkshopUploadResult> {
  try {
    const steamClient = await ensureSteamClientReady(options.mainWindow ?? null);

    const {
      zipPath,
      title,
      description,
      tags,
      visibility,
      previewImagePath,
    } = modData;
    const changeNotes = modData.changeNotes || modData.change_note;
    const workshopItemId =
      modData.workshopId == null
        ? undefined
        : parseWorkshopId(modData.workshopId);
    const workshopId = workshopItemId?.toString();

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
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }

    if (visibility) {
      updateDetails.visibility = visibilityToUgcVisibility(visibility);
    } else if (!workshopId) {
      // Keep CLI and GUI creation flows aligned when no visibility is provided.
      updateDetails.visibility = visibilityToUgcVisibility('public');
    }

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
      console.log('Creating new workshop item...');
      const createResult = await steamClient.workshop.createItem(config.appId);

      publishedFileId = createResult.itemId.toString();
      console.log('Workshop item created successfully:', publishedFileId);

      console.log('Updating workshop item with content...');
      await steamClient.workshop.updateItem(
        createResult.itemId,
        updateDetails,
        config.appId,
      );
    } else {
      publishedFileId = workshopId;
      console.log('Updating existing workshop item:', publishedFileId);
      await steamClient.workshop.updateItem(
        workshopItemId,
        updateDetails,
        config.appId,
      );
    }

    const result: WorkshopUploadResult = {
      success: true,
      publishedFileId,
      error: undefined,
    };

    console.log('Workshop upload completed successfully:', publishedFileId);

    if (options.openWorkshopPage) {
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
    }

    return result;
  } catch (error) {
    const normalizedError = normalizeWorkshopError(error);
    console.error('Workshop upload error:', normalizedError);
    throw normalizedError;
  }
}
