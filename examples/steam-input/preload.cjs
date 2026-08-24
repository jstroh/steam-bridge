"use strict";

const { contextBridge, ipcRenderer } = require("electron");
const { subscribeElectronSteamInput } = require("steam-bridge/electron/advanced");

const frameListeners = new Set();
const errorListeners = new Set();
let frameRequestInFlight = false;
const subscription = subscribeElectronSteamInput(ipcRenderer, (frame) => {
  for (const listener of frameListeners) listener(frame);
});
const onFrameComplete = () => {
  frameRequestInFlight = false;
};
const onExampleError = (_event, message) => {
  for (const listener of errorListeners) listener(String(message));
};
ipcRenderer.on("steam-input-example:frame-complete", onFrameComplete);
ipcRenderer.on("steam-input-example:error", onExampleError);

contextBridge.exposeInMainWorld("steamInput", {
  requestFrame() {
    if (frameRequestInFlight) return false;
    frameRequestInFlight = true;
    ipcRenderer.send("steam-input-example:frame");
    return true;
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
    ipcRenderer.removeListener("steam-input-example:frame-complete", onFrameComplete);
    ipcRenderer.removeListener("steam-input-example:error", onExampleError);
    frameRequestInFlight = false;
    frameListeners.clear();
    errorListeners.clear();
  }
});
