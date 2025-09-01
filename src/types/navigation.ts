import { WorkshopItem } from '../types';

export interface LocalMod {
  name: string;
  path: string;
  metadata: {
    name: string;
    version: string;
    description: string;
    author: string;
    workshopId?: string;
    [key: string]: unknown;
  };
  workshopId: string | null;
}

export type NavigationState =
  | { screen: 'list' }
  | { screen: 'create' }
  | { screen: 'edit'; item: WorkshopItem };
