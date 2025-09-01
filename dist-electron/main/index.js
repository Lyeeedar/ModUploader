import { app as g, ipcMain as h, dialog as k, BrowserWindow as C } from "electron";
import * as p from "path";
import * as y from "fs";
import { fileURLToPath as D } from "url";
import { init as F } from "steamworks.js";
const _ = {
  Published: 0,
  VotedOn: 1,
  VotedUp: 2,
  VotedDown: 3,
  Favorited: 4,
  Subscribed: 5,
  UsedOrPlayed: 6,
  Followed: 7
}, x = {
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
}, E = {
  CreationOrderAsc: 0,
  CreationOrderDesc: 1,
  TitleAsc: 2,
  LastUpdatedDesc: 3,
  SubscriptionDateDesc: 4,
  VoteScoreDesc: 5,
  ForModeration: 6
}, a = 3992260, W = D(import.meta.url), b = p.dirname(W);
let t = null, s = null, P = !1;
function U() {
  t = new C({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: p.join(b, "..", "preload", "index.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    },
    icon: p.join(b, "..", "..", "icon.ico"),
    backgroundColor: "#0a0604",
    titleBarStyle: "default",
    frame: !0,
    resizable: !0,
    autoHideMenuBar: !0
  }), process.env.VITE_DEV_SERVER_URL ? (t.loadURL(process.env.VITE_DEV_SERVER_URL), t.webContents.openDevTools()) : t.loadFile(p.join(b, "..", "index.html")), t.on("closed", () => {
    t = null;
  });
}
g.whenReady().then(() => {
  U(), setTimeout(() => {
    try {
      const e = p.join(process.cwd(), "steam_appid.txt");
      try {
        y.existsSync(e) || (y.writeFileSync(e, a.toString()), console.log("Created steam_appid.txt file"));
      } catch (c) {
        console.log("Could not create steam_appid.txt:", c);
      }
      s = F(a), s ? (console.log("Steamworks initialized successfully"), console.log("steamClient methods:", Object.keys(s)), P = !0, t && t.webContents.send("steam-initialized")) : (console.log(
        "Steam client not available - Steam may not be running or app not registered"
      ), console.log(
        "Note: Workshop uploads require Steam to be running and the game to be owned"
      ));
    } catch (e) {
      e instanceof Error ? e.message.includes("ConnectToGlobalUser") ? (console.log(
        "Steam connection failed - make sure Steam is running and you own the game"
      ), console.log("Workshop functionality will be disabled")) : console.log("Steam integration not available:", e.message) : console.log("Steam integration not available:", e);
    }
  }, 1e3);
});
g.on("window-all-closed", () => {
  process.platform !== "darwin" && g.quit();
});
g.on("activate", () => {
  t === null && U();
});
h.handle("select-zip", async () => {
  if (console.log("select-zip handler called"), !t)
    return console.error("No main window available"), null;
  try {
    t.focus();
    const e = await k.showOpenDialog(t, {
      properties: ["openFile"],
      filters: [
        { name: "Zip Files", extensions: ["zip"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    return console.log("Dialog result:", e), !e.canceled && e.filePaths.length > 0 ? (console.log("Selected file:", e.filePaths[0]), e.filePaths[0]) : (console.log("No file selected"), null);
  } catch (e) {
    throw console.error("Error showing file dialog:", e), e;
  }
});
h.handle("select-preview-image", async () => {
  if (console.log("select-preview-image handler called"), !t)
    return console.error("No main window available"), null;
  try {
    t.focus();
    const e = await k.showOpenDialog(t, {
      properties: ["openFile"],
      filters: [
        { name: "Images", extensions: ["jpg", "jpeg", "png", "gif"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    return console.log("Dialog result:", e), !e.canceled && e.filePaths.length > 0 ? (console.log("Selected image:", e.filePaths[0]), e.filePaths[0]) : (console.log("No image selected"), null);
  } catch (e) {
    throw console.error("Error showing image dialog:", e), e;
  }
});
const V = (e) => {
  switch (e) {
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
h.handle(
  "upload-to-workshop",
  async (e, c) => {
    if (!s)
      throw new Error(
        'Steam is not connected. Please make sure Steam is running and you own "Ascend from Nine Mountains".'
      );
    try {
      const {
        zipPath: n,
        title: o,
        description: d,
        tags: u,
        visibility: m,
        previewImagePath: f,
        changeNotes: v
      } = c;
      let { workshopId: w } = c, l;
      const i = {};
      o && (i.title = o), d && (i.description = d), u && (i.tags = u.split(",").map((r) => r.trim()).filter((r) => r.length > 0)), i.visibility = V(
        m || "private"
      ), n && (i.contentPath = n), f && y.existsSync(f) && (i.previewPath = f), v && (i.changeNote = v);
      let I;
      if (w)
        l = w, console.log("Updating existing workshop item:", l), I = await s.workshop.updateItem(
          BigInt(w),
          i,
          a
        );
      else {
        console.log("Creating new workshop item...");
        const r = await s.workshop.createItem(a);
        l = r.itemId.toString(), console.log("Workshop item created successfully:", l), console.log("Updating workshop item with content..."), I = await s.workshop.updateItem(
          r.itemId,
          i,
          a
        );
      }
      const S = {
        success: !0,
        publishedFileId: l,
        error: void 0
      };
      console.log(
        "Workshop upload completed successfully:",
        S.publishedFileId
      );
      try {
        s.overlay.activateToWebPage(
          `steam://url/CommunityFilePage/${l}`
        ), console.log("Opened Steam Workshop page for item:", l);
      } catch (r) {
        console.warn(
          "Could not open Steam overlay to workshop page:",
          r
        );
      }
      return S;
    } catch (n) {
      throw console.error("Workshop upload error:", n), n;
    }
  }
);
h.handle("get-workshop-items", async () => {
  if (!s || !P)
    return {
      items: [],
      status: "steam_not_connected",
      message: "Steam is not connected. Please make sure Steam is running."
    };
  try {
    const e = s.localplayer.getSteamId();
    console.log(e);
    const n = (await s.workshop.getUserItems(
      1,
      // page
      e.accountId,
      _.Published,
      x.Items,
      E.CreationOrderDesc,
      a,
      a
    )).items.filter((o) => o != null).map((o) => {
      var d, u, m;
      return {
        publishedFileId: o.publishedFileId.toString(),
        title: o.title,
        description: o.description,
        tags: o.tags || [],
        visibility: o.visibility === 0 ? "public" : "private",
        createdDate: o.timeCreated,
        updatedDate: o.timeUpdated,
        subscriptions: Number(((d = o.statistics) == null ? void 0 : d.numSubscriptions) || 0),
        favorited: Number(((u = o.statistics) == null ? void 0 : u.numFavorites) || 0),
        views: Number(((m = o.statistics) == null ? void 0 : m.numUniqueWebsiteViews) || 0)
      };
    });
    return {
      items: n,
      status: "success",
      message: n.length === 0 ? "No workshop items found. Upload your first mod!" : void 0
    };
  } catch (e) {
    return console.error("Workshop API error:", e), {
      items: [],
      status: "error",
      message: "Workshop API is currently unavailable. Upload functionality still works."
    };
  }
});
