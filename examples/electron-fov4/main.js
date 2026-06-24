const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const steamworks = require("steam-bridge");

const APP_ID = Number(process.env.STEAM_BRIDGE_APP_ID || "2957110");

steamworks.electronEnableSteamOverlay();

let client;

function createWindow() {
  const window = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  window.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  client = steamworks.init(APP_ID);

  client.callback.register(
    client.callback.SteamCallback.MicroTxnAuthorizationResponse,
    (event) => BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("steam:microtxn", event);
    })
  );

  createWindow();
});

ipcMain.handle("steam:getSteamId", () => client.localplayer.getSteamId().steamId64.toString());
ipcMain.handle("steam:isSteamDeck", () => client.utils.isSteamRunningOnSteamDeck());
ipcMain.handle("steam:getTicket", async () => {
  const ticket = await client.auth.getAuthTicketForWebApi("fov4");
  return Array.from(ticket.getBytes());
});
ipcMain.handle("steam:achievement", (_event, name) => client.achievement.isActivated(name));
ipcMain.handle("steam:overlay", (_event, url) => client.overlay.activateToWebPage(url));

app.on("window-all-closed", () => {
  steamworks.shutdown();
  app.quit();
});

