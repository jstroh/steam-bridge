"use strict";

const { contextBridge, ipcRenderer } = require("electron");
const { subscribeElectronSteamInput } = require("steam-bridge/electron");

const frameListeners = new Set();
const errorListeners = new Set();
const subscription = subscribeElectronSteamInput(ipcRenderer, (frame) => {
  for (const listener of frameListeners) listener(frame);
});
ipcRenderer.on("steam-input-example:error", (_event, message) => {
  for (const listener of errorListeners) listener(String(message));
});

contextBridge.exposeInMainWorld("steamInput", {
  requestFrame() {
    ipcRenderer.send("steam-input-example:frame");
  },
  onFrame(listener) {
    if (typeof listener !== "function") throw new TypeError("onFrame requires a function");
    frameListeners.add(listener);
    return () => frameListeners.delete(listener);
  },
  onError(listener) {
    if (typeof listener !== "function") throw new TypeError("onError requires a function");
    errorListeners.add(listener);
    return () => errorListeners.delete(listener);
  },
  getPrompt(action) {
    return ipcRenderer.invoke("steam-input-example:prompt", action);
  },
  showBindingPanel() {
    return ipcRenderer.invoke("steam-input-example:binding-panel");
  },
  getDiagnostics() {
    return ipcRenderer.invoke("steam-input-example:diagnostics");
  },
  close() {
    subscription.close();
    frameListeners.clear();
    errorListeners.clear();
  }
});
