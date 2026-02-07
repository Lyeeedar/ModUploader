// Configuration constants for the Mod Uploader

export const config = {
  // Steam App ID for "Ascend from Nine Mountains"
  appId: 3992260,

  // Timeouts (in milliseconds)
  timeouts: {
    steamInitialization: 1000,
    steamInitMaxRetries: 5,
    steamInitRetryDelay: 500,
    workshopItemsLoad: 5000,
  },

  // Window settings
  window: {
    width: 1200,
    height: 800,
    backgroundColor: '#0a0604',
  },

  // Steam Workshop enums (from steamworks.js)
  steam: {
    UserListType: {
      Published: 0,
      VotedOn: 1,
      VotedUp: 2,
      VotedDown: 3,
      Favorited: 4,
      Subscribed: 5,
      UsedOrPlayed: 6,
      Followed: 7,
    } as const,

    UGCType: {
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
    } as const,

    UserListOrder: {
      CreationOrderAsc: 0,
      CreationOrderDesc: 1,
      TitleAsc: 2,
      LastUpdatedDesc: 3,
      SubscriptionDateDesc: 4,
      VoteScoreDesc: 5,
      ForModeration: 6,
    } as const,

    UgcItemVisibility: {
      Public: 0,
      FriendsOnly: 1,
      Private: 2,
      Unlisted: 3,
    } as const,
  },
} as const;

export type SteamConfig = typeof config.steam;
