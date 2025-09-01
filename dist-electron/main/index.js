import { app, ipcMain, dialog, BrowserWindow } from "electron";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { init } from "steamworks.js";
const UserListType = {
  Published: 0,
  VotedOn: 1,
  VotedUp: 2,
  VotedDown: 3,
  Favorited: 4,
  Subscribed: 5,
  UsedOrPlayed: 6,
  Followed: 7
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
  All: 13
};
const UserListOrder = {
  CreationOrderAsc: 0,
  CreationOrderDesc: 1,
  TitleAsc: 2,
  LastUpdatedDesc: 3,
  SubscriptionDateDesc: 4,
  VoteScoreDesc: 5,
  ForModeration: 6
};
const appId = 3992260;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
let steamClient = null;
let steamInitialized = false;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, "..", "..", "icon.png"),
    backgroundColor: "#0a0604",
    titleBarStyle: "default",
    frame: true,
    resizable: true
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.whenReady().then(() => {
  createWindow();
  setTimeout(() => {
    try {
      const steamAppIdPath = path.join(process.cwd(), "steam_appid.txt");
      try {
        if (!fs.existsSync(steamAppIdPath)) {
          fs.writeFileSync(steamAppIdPath, appId.toString());
          console.log("Created steam_appid.txt file");
        }
      } catch (fileError) {
        console.log("Could not create steam_appid.txt:", fileError);
      }
      steamClient = init(appId);
      if (!steamClient) {
        console.log(
          "Steam client not available - Steam may not be running or app not registered"
        );
        console.log(
          "Note: Workshop uploads require Steam to be running and the game to be owned"
        );
      } else {
        console.log("Steamworks initialized successfully");
        console.log("steamClient methods:", Object.keys(steamClient));
        steamInitialized = true;
        if (mainWindow) {
          mainWindow.webContents.send("steam-initialized");
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("ConnectToGlobalUser")) {
          console.log(
            "Steam connection failed - make sure Steam is running and you own the game"
          );
          console.log("Workshop functionality will be disabled");
        } else {
          console.log("Steam integration not available:", error.message);
        }
      } else {
        console.log("Steam integration not available:", error);
      }
    }
  }, 1e3);
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
ipcMain.handle("select-zip", async () => {
  console.log("select-zip handler called");
  if (!mainWindow) {
    console.error("No main window available");
    return null;
  }
  try {
    mainWindow.focus();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        { name: "Zip Files", extensions: ["zip"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    console.log("Dialog result:", result);
    if (!result.canceled && result.filePaths.length > 0) {
      console.log("Selected file:", result.filePaths[0]);
      return result.filePaths[0];
    }
    console.log("No file selected");
    return null;
  } catch (error) {
    console.error("Error showing file dialog:", error);
    throw error;
  }
});
ipcMain.handle("select-preview-image", async () => {
  console.log("select-preview-image handler called");
  if (!mainWindow) {
    console.error("No main window available");
    return null;
  }
  try {
    mainWindow.focus();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        { name: "Images", extensions: ["jpg", "jpeg", "png", "gif"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    console.log("Dialog result:", result);
    if (!result.canceled && result.filePaths.length > 0) {
      console.log("Selected image:", result.filePaths[0]);
      return result.filePaths[0];
    }
    console.log("No image selected");
    return null;
  } catch (error) {
    console.error("Error showing image dialog:", error);
    throw error;
  }
});
const visibilityToUgcVisibility = (visibility) => {
  switch (visibility) {
    case "public":
      return 0;
    case "friends":
      return 1;
    case "private":
      return 2;
    case "unlisted":
      return 3;
  }
};
ipcMain.handle(
  "upload-to-workshop",
  async (_event, modData) => {
    if (!steamClient) {
      throw new Error(
        'Steam is not connected. Please make sure Steam is running and you own "Ascend from Nine Mountains".'
      );
    }
    try {
      const {
        zipPath,
        title,
        description,
        tags,
        visibility,
        previewImagePath
      } = modData;
      let { workshopId } = modData;
      let publishedFileId;
      const updateDetails = {};
      if (title) {
        updateDetails.title = title;
      }
      if (description) {
        updateDetails.description = description;
      }
      if (tags) {
        updateDetails.tags = tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      }
      updateDetails.visibility = visibilityToUgcVisibility(
        visibility || "private"
      );
      updateDetails.contentPath = zipPath;
      if (previewImagePath && fs.existsSync(previewImagePath)) {
        updateDetails.previewPath = previewImagePath;
      }
      let ugcResult;
      if (!workshopId) {
        console.log("Creating new workshop item...");
        const createResult = await steamClient.workshop.createItem(appId);
        publishedFileId = createResult.itemId.toString();
        console.log("Workshop item created successfully:", publishedFileId);
        console.log("Updating workshop item with content...");
        ugcResult = await steamClient.workshop.updateItem(
          createResult.itemId,
          updateDetails,
          appId
        );
      } else {
        publishedFileId = workshopId;
        console.log("Updating existing workshop item:", publishedFileId);
        ugcResult = await steamClient.workshop.updateItem(
          BigInt(workshopId),
          updateDetails,
          appId
        );
      }
      const result = {
        success: true,
        publishedFileId,
        error: void 0
      };
      if (!modData.workshopId && result.publishedFileId) {
        const modName = path.basename(zipPath, ".zip");
        const modJsonPath = path.join(
          __dirname,
          "..",
          "..",
          "..",
          modName,
          "mod.json"
        );
        if (fs.existsSync(modJsonPath)) {
          const modJson = JSON.parse(
            fs.readFileSync(modJsonPath, "utf8")
          );
          modJson.workshopId = result.publishedFileId;
          fs.writeFileSync(modJsonPath, JSON.stringify(modJson, null, 2));
          console.log(
            "Updated mod.json with workshop ID:",
            result.publishedFileId
          );
        }
      }
      console.log(
        "Workshop upload completed successfully:",
        result.publishedFileId
      );
      try {
        steamClient.overlay.activateToWebPage(
          `steam://url/CommunityFilePage/${publishedFileId}`
        );
        console.log("Opened Steam Workshop page for item:", publishedFileId);
      } catch (overlayError) {
        console.warn(
          "Could not open Steam overlay to workshop page:",
          overlayError
        );
      }
      return result;
    } catch (error) {
      console.error("Workshop upload error:", error);
      throw error;
    }
  }
);
ipcMain.handle("get-workshop-items", async () => {
  if (!steamClient || !steamInitialized) {
    return {
      items: [],
      status: "steam_not_connected",
      message: "Steam is not connected. Please make sure Steam is running."
    };
  }
  try {
    const userSteamId = steamClient.localplayer.getSteamId();
    console.log(userSteamId);
    const result = await steamClient.workshop.getUserItems(
      1,
      // page
      userSteamId.accountId,
      UserListType.Published,
      UGCType.Items,
      UserListOrder.CreationOrderDesc,
      appId,
      appId
    );
    const items = result.items.filter((item) => item != null).map((item) => {
      var _a, _b, _c;
      return {
        publishedFileId: item.publishedFileId.toString(),
        title: item.title,
        description: item.description,
        tags: item.tags || [],
        visibility: item.visibility === 0 ? "public" : "private",
        createdDate: item.timeCreated,
        updatedDate: item.timeUpdated,
        subscriptions: Number(((_a = item.statistics) == null ? void 0 : _a.numSubscriptions) || 0),
        favorited: Number(((_b = item.statistics) == null ? void 0 : _b.numFavorites) || 0),
        views: Number(((_c = item.statistics) == null ? void 0 : _c.numUniqueWebsiteViews) || 0)
      };
    });
    return {
      items,
      status: "success",
      message: items.length === 0 ? "No workshop items found. Upload your first mod!" : void 0
    };
  } catch (error) {
    console.error("Workshop API error:", error);
    return {
      items: [],
      status: "error",
      message: "Workshop API is currently unavailable. Upload functionality still works."
    };
  }
});
//# sourceMappingURL=index.js.map
