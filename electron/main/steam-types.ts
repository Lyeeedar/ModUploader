// Steam-related TypeScript types

import { ModVisibility } from '../../src/types';
import { config } from './config';

// Steam Workshop item from API response
export interface SteamWorkshopItemRaw {
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
}

// Steam user items query result
export interface SteamUserItemsResult {
  items: SteamWorkshopItemRaw[];
  totalResults: number;
  numReturned: number;
}

// Steam create item result
export interface SteamCreateItemResult {
  itemId: bigint;
  needsToAcceptAgreement: boolean;
}

// Steam update item result
export interface SteamUpdateItemResult {
  needsToAcceptAgreement: boolean;
}

// Convert visibility string to Steam UGC visibility number
export function visibilityToUgcVisibility(visibility: ModVisibility): number {
  const { UgcItemVisibility } = config.steam;
  switch (visibility) {
    case 'public':
      return UgcItemVisibility.Public;
    case 'friends':
      return UgcItemVisibility.FriendsOnly;
    case 'private':
      return UgcItemVisibility.Private;
    case 'unlisted':
      return UgcItemVisibility.Unlisted;
    default:
      return UgcItemVisibility.Private;
  }
}

// Convert Steam UGC visibility number to visibility string
export function ugcVisibilityToString(visibility: number): ModVisibility {
  const { UgcItemVisibility } = config.steam;
  switch (visibility) {
    case UgcItemVisibility.Public:
      return 'public';
    case UgcItemVisibility.FriendsOnly:
      return 'friends';
    case UgcItemVisibility.Private:
      return 'private';
    case UgcItemVisibility.Unlisted:
      return 'unlisted';
    default:
      return 'private';
  }
}
