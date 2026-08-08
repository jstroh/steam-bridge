"use strict";

const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const steamworks = require("steam-bridge");
const { createElectronSteamInputTransport } = require("steam-bridge/electron");

const APP_ID = Number(process.env.STEAM_APP_ID || 480);
const definition = steamworks.defineSteamInput({
  actionSets: { gameplay: "Gameplay" },
  actionLayers: { menu: "MenuLayer" },
  digital: { jump: "Jump", pause: "Pause" },
  analog: { move: "Move" }
});

let client;
let session;
let transport;
let gameWindow;
let gameplaySetActive = false;
let shuttingDown = false;

function fromGameRenderer(event) {
  return gameWindow && !gameWindow.isDestroyed() && event.sender === gameWindow.webContents;
}

function serializePrompt(prompt) {
  if (!prompt) return null;
  return {
    ...prompt,
    controllerHandle: prompt.controllerHandle.toString(),
    actionSetHandle: prompt.actionSetHandle.toString()
  };
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  transport?.close();
  transport = undefined;
  session?.dispose();
  session = undefined;
  if (client) {
    steamworks.shutdown();
    client = undefined;
  }
}

async function start() {
  client = steamworks.init(APP_ID);
  session = client.input.createSession({
    definition,
    controllers: "both",
    manifestPath: process.env.STEAM_INPUT_MANIFEST
      ? path.resolve(process.env.STEAM_INPUT_MANIFEST)
      : null
  }).start();

  gameWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });
  await gameWindow.loadFile(path.join(__dirname, "renderer.html"));
  transport = createElectronSteamInputTransport(session, gameWindow.webContents);

  ipcMain.on("steam-input-example:frame", (event) => {
    if (!fromGameRenderer(event) || !session || !transport || transport.closed) return;
    try {
      const frame = session.update();
      if (!gameplaySetActive && session.getDiagnostics().resolvedActionSetCount > 0) {
        session.activateActionSet("gameplay");
        gameplaySetActive = true;
      }
      transport.publish(frame);
    } catch (error) {
      event.sender.send("steam-input-example:error", error instanceof Error ? error.message : String(error));
    }
  });
  ipcMain.handle("steam-input-example:prompt", (event, action) => {
    if (!fromGameRenderer(event) || !session) throw new Error("Steam Input renderer is unavailable");
    if (action !== "jump" && action !== "pause") throw new Error("Unknown prompt action");
    return serializePrompt(session.getDigitalPrompt(action));
  });
  ipcMain.handle("steam-input-example:binding-panel", (event) => {
    if (!fromGameRenderer(event) || !session) throw new Error("Steam Input renderer is unavailable");
    return session.showBindingPanel();
  });
  ipcMain.handle("steam-input-example:diagnostics", (event) => {
    if (!fromGameRenderer(event) || !session || !transport) {
      throw new Error("Steam Input renderer is unavailable");
    }
    const diagnostics = session.getDiagnostics();
    return {
      ...diagnostics,
      primaryControllerHandle: diagnostics.primaryControllerHandle?.toString() ?? null,
      lastSequence: diagnostics.lastSequence.toString(),
      transport: transport.getDiagnostics()
    };
  });
  gameWindow.on("closed", shutdown);
}

app.whenReady().then(start).catch((error) => {
  console.error(error);
  shutdown();
  app.quit();
});
app.on("before-quit", shutdown);
app.on("window-all-closed", () => app.quit());
