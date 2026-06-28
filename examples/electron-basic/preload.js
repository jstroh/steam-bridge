const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("steamSmoke", {
  snapshot: () => ipcRenderer.invoke("steam-smoke:snapshot"),
  requestAuthTicket: () => ipcRenderer.invoke("steam-smoke:auth-ticket"),
  openOverlayStore: () => ipcRenderer.invoke("steam-smoke:overlay-store"),
  openOverlayWeb: () => ipcRenderer.invoke("steam-smoke:overlay-web"),
  openOverlayDialog: () => ipcRenderer.invoke("steam-smoke:overlay-dialog"),
  openPresenterWeb: () => ipcRenderer.invoke("steam-smoke:presenter-web"),
  openPresenterFriends: () => ipcRenderer.invoke("steam-smoke:presenter-friends"),
  openPresenterCommunity: () => ipcRenderer.invoke("steam-smoke:presenter-community"),
  openPresenterStats: () => ipcRenderer.invoke("steam-smoke:presenter-stats"),
  openPresenterAchievements: () => ipcRenderer.invoke("steam-smoke:presenter-achievements"),
  openPresenterAchievementProgress: () => ipcRenderer.invoke("steam-smoke:presenter-achievement-progress"),
  openNativeProbe: () => ipcRenderer.invoke("steam-smoke:native-probe-open"),
  pumpNativeProbe: () => ipcRenderer.invoke("steam-smoke:native-probe-pump"),
  closeNativeProbe: () => ipcRenderer.invoke("steam-smoke:native-probe-close"),
  onEvent: (handler) => {
    const listener = (_event, value) => handler(value);
    ipcRenderer.on("steam-smoke:event", listener);
    return () => ipcRenderer.removeListener("steam-smoke:event", listener);
  }
});
