"use strict";

const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const steamworks = require("steam-bridge/steamworks");
const { createElectronSteamInputTransport } = require("steam-bridge/electron/advanced");
const inputDefinition = require("./definition.cjs");

const APP_ID = Number(process.env.STEAM_APP_ID || 480);
const definition = steamworks.defineSteamInput(inputDefinition);

let client;
let session;
let transport;
let gameWindow;
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
  session.activateActionSet("gameplay");

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
    if (!fromGameRenderer(event)) return;
    try {
      if (!session || !transport || transport.closed) {
        throw new Error("Steam Input transport is unavailable");
      }
      const frame = session.update();
      transport.publish(frame);
    } catch (error) {
      event.sender.send("steam-input-example:error", error instanceof Error ? error.message : String(error));
    } finally {
      if (!event.sender.isDestroyed()) event.sender.send("steam-input-example:frame-complete");
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
