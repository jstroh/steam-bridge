const { contextBridge, ipcRenderer } = require("electron");

const AUTORUN_USER_GESTURE_GATE_TARGETS = Object.freeze({
  "presenter-web-open-and-wait": "presenter-web-wait",
  "presenter-duplicate-open-guard": "presenter-duplicate-guard"
});
let autorunUserGestureGate;
let autorunUserGestureGateHandler;
let autorunUserGestureGateActivated = false;

ipcRenderer.on("steam-smoke:autorun-user-gesture-gate-arm", (_event, value) => {
  const targetId = getAutorunUserGestureGateTargetId(value?.action);
  if (
    autorunUserGestureGate ||
    !value ||
    !targetId ||
    typeof value.nonce !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.nonce)
  ) {
    return;
  }
  autorunUserGestureGate = {
    action: value.action,
    targetId,
    nonce: value.nonce,
    attempted: false,
    button: undefined
  };
  activateAutorunUserGestureGate();
});

function activateAutorunUserGestureGate() {
  if (!autorunUserGestureGate || !autorunUserGestureGateHandler || autorunUserGestureGateActivated) {
    return;
  }

  const button = document.getElementById(autorunUserGestureGate.targetId);
  if (!button) {
    return;
  }

  autorunUserGestureGateActivated = true;
  autorunUserGestureGate.button = button;
  button.addEventListener("click", consumeAutorunUserGestureGate, { capture: true, once: true });
  autorunUserGestureGateHandler({ action: autorunUserGestureGate.action });

  const evidence = getAutorunUserGestureGateReadyEvidence(button);
  ipcRenderer
    .invoke("steam-smoke:autorun-user-gesture-gate-ready", {
      action: autorunUserGestureGate.action,
      nonce: autorunUserGestureGate.nonce,
      evidence
    })
    .catch(() => undefined);
}

function getAutorunUserGestureGateTargetId(action) {
  if (typeof action !== "string" || !Object.prototype.hasOwnProperty.call(AUTORUN_USER_GESTURE_GATE_TARGETS, action)) {
    return undefined;
  }
  return AUTORUN_USER_GESTURE_GATE_TARGETS[action];
}

function consumeAutorunUserGestureGate(event) {
  const gate = autorunUserGestureGate;
  if (!gate || gate.attempted || event.currentTarget !== gate.button) {
    return;
  }

  gate.attempted = true;
  const nonce = gate.nonce;
  gate.nonce = undefined;
  const click = {
    isTrusted: event.isTrusted === true,
    button: event.button,
    detail: event.detail,
    clientX: event.clientX,
    clientY: event.clientY,
    userActivationActive: navigator.userActivation && navigator.userActivation.isActive === true
  };
  ipcRenderer
    .invoke("steam-smoke:autorun-user-gesture-gate-consume", {
      action: gate.action,
      nonce,
      click
    })
    .catch(() => undefined);
}

function getAutorunUserGestureGateReadyEvidence(button) {
  const rect = button.getBoundingClientRect();
  const style = window.getComputedStyle(button);
  const rectValues = [rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height];
  const viewportValues = [window.innerWidth, window.innerHeight, window.devicePixelRatio];
  const finite = rectValues.every(Number.isFinite) && viewportValues.every(Number.isFinite);
  const fullyInsideViewport =
    finite &&
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.right <= window.innerWidth &&
    rect.bottom <= window.innerHeight;
  const centerElement = fullyInsideViewport
    ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    : null;
  const unobscured = centerElement === button || button.contains(centerElement);
  const opacity = Number.parseFloat(style.opacity);
  const visible =
    button.isConnected &&
    !button.disabled &&
    rect.width > 0 &&
    rect.height > 0 &&
    fullyInsideViewport &&
    unobscured &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.visibility !== "collapse" &&
    Number.isFinite(opacity) &&
    opacity > 0;

  return {
    button: {
      id: button.id,
      connected: button.isConnected,
      enabled: !button.disabled,
      visible,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      }
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    }
  };
}

contextBridge.exposeInMainWorld("steamSmoke", {
  snapshot: () => ipcRenderer.invoke("steam-smoke:snapshot"),
  requestAuthTicket: () => ipcRenderer.invoke("steam-smoke:auth-ticket"),
  openOverlayStore: () => ipcRenderer.invoke("steam-smoke:overlay-store"),
  openOverlayWeb: () => ipcRenderer.invoke("steam-smoke:overlay-web"),
  openOverlayDialog: () => ipcRenderer.invoke("steam-smoke:overlay-dialog"),
  checkPresenterReady: () => ipcRenderer.invoke("steam-smoke:presenter-ready"),
  openPresenterWeb: () => ipcRenderer.invoke("steam-smoke:presenter-web"),
  openPresenterWebOpenAndWait: () => ipcRenderer.invoke("steam-smoke:presenter-web-open-and-wait"),
  onAutorunUserGestureGateArm: (handler) => {
    if (typeof handler !== "function") {
      return () => undefined;
    }
    autorunUserGestureGateHandler = handler;
    activateAutorunUserGestureGate();
    return () => {
      if (autorunUserGestureGateHandler === handler) {
        autorunUserGestureGateHandler = undefined;
      }
    };
  },
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
  openPresenterNativeUser: () => ipcRenderer.invoke("steam-smoke:presenter-user-native"),
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
