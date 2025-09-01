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
  | { screen: 'edit'; mod: LocalMod }
  | { screen: 'create' };