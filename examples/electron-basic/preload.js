const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("steamSmoke", {
  snapshot: () => ipcRenderer.invoke("steam-smoke:snapshot"),
  requestAuthTicket: () => ipcRenderer.invoke("steam-smoke:auth-ticket"),
  openOverlayStore: () => ipcRenderer.invoke("steam-smoke:overlay-store"),
  openOverlayWeb: () => ipcRenderer.invoke("steam-smoke:overlay-web"),
  openOverlayDialog: () => ipcRenderer.invoke("steam-smoke:overlay-dialog"),
  checkPresenterReady: () => ipcRenderer.invoke("steam-smoke:presenter-ready"),
  openPresenterWeb: () => ipcRenderer.invoke("steam-smoke:presenter-web"),
  openPresenterWebOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-web-open-and-wait"),
  openPresenterStoreOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-store-open-and-wait"),
  openPresenterDialogAutoOpenAndWait: () =>
    ipcRenderer.invoke("steam-smoke:presenter-dialog-auto-open-and-wait"),
  openPresenterFriends: () => ipcRenderer.invoke("steam-smoke:presenter-friends"),
  openPresenterFriendsOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-friends-open-and-wait"),
  openPresenterProfile: () => ipcRenderer.invoke("steam-smoke:presenter-profile"),
  openPresenterPlayers: () => ipcRenderer.invoke("steam-smoke:presenter-players"),
  openPresenterCommunity: () => ipcRenderer.invoke("steam-smoke:presenter-community"),
  openPresenterStats: () => ipcRenderer.invoke("steam-smoke:presenter-stats"),
  openPresenterAchievements: () => ipcRenderer.invoke("steam-smoke:presenter-achievements"),
  openPresenterCheckout: () => ipcRenderer.invoke("steam-smoke:presenter-checkout"),
  openPresenterAchievementProgress: () => ipcRenderer.invoke("steam-smoke:presenter-achievement-progress"),
  openPresenterAchievementUnlock: () => ipcRenderer.invoke("steam-smoke:presenter-achievement-unlock"),
  openNativeProbe: () => ipcRenderer.invoke("steam-smoke:native-probe-open"),
  pumpNativeProbe: () => ipcRenderer.invoke("steam-smoke:native-probe-pump"),
  closeNativeProbe: () => ipcRenderer.invoke("steam-smoke:native-probe-close"),
  onEvent: (handler) => {
    const listener = (_event, value) => handler(value);
    ipcRenderer.on("steam-smoke:event", listener);
    return () => ipcRenderer.removeListener("steam-smoke:event", listener);
  }
});
