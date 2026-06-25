const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("steam", {
  getSteamId: () => ipcRenderer.invoke("steam:getSteamId"),
  isSteamDeck: () => ipcRenderer.invoke("steam:isSteamDeck"),
  getAuthTicketForWebApi: () => ipcRenderer.invoke("steam:getTicket"),
  isAchievementActivated: (name) => ipcRenderer.invoke("steam:achievement", name),
  activateToWebPage: (url) => ipcRenderer.invoke("steam:overlay", url),
  onMicroTxnAuthorizationResponse: (handler) => {
    ipcRenderer.on("steam:microtxn", (_event, value) => handler(value));
  }
});

