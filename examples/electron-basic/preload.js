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
  openPresenterDuplicateOpenGuard: () => ipcRenderer.invoke("steam-smoke:presenter-duplicate-open-guard"),
  openPresenterStoreOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-store-open-and-wait"),
  openPresenterDialogAutoOpenAndWait: () =>
    ipcRenderer.invoke("steam-smoke:presenter-dialog-auto-open-and-wait"),
  openPresenterFriends: () => ipcRenderer.invoke("steam-smoke:presenter-friends"),
  openPresenterFriendsOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-friends-open-and-wait"),
  openPresenterProfile: () => ipcRenderer.invoke("steam-smoke:presenter-profile"),
  openPresenterProfileOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-profile-open-and-wait"),
  openPresenterPlayers: () => ipcRenderer.invoke("steam-smoke:presenter-players"),
  openPresenterPlayersOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-players-open-and-wait"),
  openPresenterCommunity: () => ipcRenderer.invoke("steam-smoke:presenter-community"),
  openPresenterCommunityOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-community-open-and-wait"),
  openPresenterStats: () => ipcRenderer.invoke("steam-smoke:presenter-stats"),
  openPresenterStatsOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-stats-open-and-wait"),
  openPresenterAchievements: () => ipcRenderer.invoke("steam-smoke:presenter-achievements"),
  openPresenterAchievementsOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-achievements-open-and-wait"),
  openPresenterUser: () => ipcRenderer.invoke("steam-smoke:presenter-user"),
  openPresenterUserOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-user-open-and-wait"),
  openPresenterCheckout: () => ipcRenderer.invoke("steam-smoke:presenter-checkout"),
  getPresenterShortcutOpenStatus: () => ipcRenderer.invoke("steam-smoke:presenter-shortcut-status"),
  openPresenterShortcutTarget: () => ipcRenderer.invoke("steam-smoke:presenter-shortcut-open"),
  openPresenterShortcutTargetOpenAndWait: () =>
    ipcRenderer.invoke("steam-smoke:presenter-shortcut-open-and-wait"),
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
