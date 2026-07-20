import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface KWinWaylandOverlayHostSyncStatus {
  attempted: boolean;
  active: boolean;
  command?: "qdbus6" | "qdbus";
  reason?: "not-kde-wayland" | "runtime-file-unavailable" | "kwin-dbus-unavailable";
}

const KWIN_SCRIPT_NAME = "steam-bridge-overlay-host-sync-v1";
const KWIN_HOST_CLASS = "steambridgenativeprobe";
const KWIN_OVERLAY_HOST_SYNC_SCRIPT = `
const steamBridgeHostClass = ${JSON.stringify(KWIN_HOST_CLASS)};
const steamBridgePairs = [];
const steamBridgeConnectedWindows = [];
let steamBridgeSyncing = false;

function steamBridgeIsHost(window) {
  return String(window.resourceClass || "").toLowerCase() === steamBridgeHostClass;
}

function steamBridgeSameGeometry(left, right) {
  return left && right &&
    left.x === right.x && left.y === right.y &&
    left.width === right.width && left.height === right.height;
}

function steamBridgeFindSource(host) {
  const candidates = workspace.windowList().filter(
    (window) => window !== host && window.pid === host.pid && !steamBridgeIsHost(window)
  );
  const activeWindow = workspace.activeWindow;
  const hostGeometry = host.frameGeometry;
  const geometryMatches = candidates.filter((window) => {
    const geometry = window.clientGeometry;
    return geometry.width === hostGeometry.width && geometry.height === hostGeometry.height;
  });
  if (activeWindow && geometryMatches.indexOf(activeWindow) >= 0) {
    return activeWindow;
  }
  if (geometryMatches.length > 0) {
    return geometryMatches[0];
  }
  if (activeWindow && candidates.indexOf(activeWindow) >= 0) {
    return activeWindow;
  }
  return candidates[0] || null;
}

function steamBridgeExcludeHostFromShell(host) {
  if (!host.skipTaskbar) {
    host.skipTaskbar = true;
  }
  if (!host.skipPager) {
    host.skipPager = true;
  }
  if (!host.skipSwitcher) {
    host.skipSwitcher = true;
  }
}

function steamBridgePairHost(host) {
  const existing = steamBridgePairs.find((pair) => pair.host === host);
  if (existing) {
    return existing;
  }
  const source = steamBridgeFindSource(host);
  if (!source) {
    return null;
  }
  const pair = { host, source };
  steamBridgePairs.push(pair);
  return pair;
}

function steamBridgeSyncPair(pair) {
  const host = pair.host;
  const source = pair.source;
  if (!host || !source || host.deleted || source.deleted) {
    return;
  }
  if (host.fullScreen !== source.fullScreen) {
    host.fullScreen = source.fullScreen;
  }
  if (source.minimized) {
    // An inactive host is already transparent, input-empty, idle, and absent
    // from the shell. KWin intentionally classifies that skip-taskbar window
    // as non-minimizable. The active Steam surface is minimizable and must
    // follow its owner immediately.
    steamBridgeExcludeHostFromShell(host);
    if (host.active && !host.minimized) {
      host.minimized = true;
    }
  } else {
    if (host.minimized) {
      host.minimized = false;
    }
    // Unminimizing can clear skip-taskbar, so restore the exclusions after it.
    steamBridgeExcludeHostFromShell(host);
  }
  if (!source.fullScreen && !steamBridgeSameGeometry(host.frameGeometry, source.clientGeometry)) {
    host.frameGeometry = source.clientGeometry;
  }
}

function steamBridgeSyncAll() {
  if (steamBridgeSyncing) {
    return;
  }
  steamBridgeSyncing = true;
  try {
    for (const window of workspace.windowList()) {
      if (steamBridgeIsHost(window)) {
        steamBridgePairHost(window);
      }
    }
    for (const pair of steamBridgePairs) {
      steamBridgeSyncPair(pair);
    }
  } finally {
    steamBridgeSyncing = false;
  }
}

function steamBridgeConnectWindow(window) {
  if (steamBridgeConnectedWindows.indexOf(window) >= 0) {
    return;
  }
  steamBridgeConnectedWindows.push(window);
  window.frameGeometryChanged.connect(steamBridgeSyncAll);
  window.clientGeometryChanged.connect(steamBridgeSyncAll);
  window.fullScreenChanged.connect(steamBridgeSyncAll);
  window.minimizedChanged.connect(steamBridgeSyncAll);
  window.windowClassChanged.connect(steamBridgeSyncAll);
}

workspace.windowAdded.connect((window) => {
  steamBridgeConnectWindow(window);
  steamBridgeSyncAll();
});
workspace.windowRemoved.connect((window) => {
  for (let index = steamBridgePairs.length - 1; index >= 0; index -= 1) {
    if (steamBridgePairs[index].host === window || steamBridgePairs[index].source === window) {
      steamBridgePairs.splice(index, 1);
    }
  }
  const connectedIndex = steamBridgeConnectedWindows.indexOf(window);
  if (connectedIndex >= 0) {
    steamBridgeConnectedWindows.splice(connectedIndex, 1);
  }
});

for (const window of workspace.windowList()) {
  steamBridgeConnectWindow(window);
}
steamBridgeSyncAll();
`;

let status: KWinWaylandOverlayHostSyncStatus = {
  attempted: false,
  active: false
};

export function ensureKWinWaylandOverlayHostSync(): KWinWaylandOverlayHostSyncStatus {
  if (status.attempted) {
    return status;
  }
  if (!isKdeWaylandSession()) {
    status = { attempted: true, active: false, reason: "not-kde-wayland" };
    return status;
  }

  const scriptPath = path.join(
    process.env.XDG_RUNTIME_DIR?.trim() || os.tmpdir(),
    `${KWIN_SCRIPT_NAME}-${process.pid}-${randomUUID()}.js`
  );
  try {
    fs.writeFileSync(scriptPath, KWIN_OVERLAY_HOST_SYNC_SCRIPT, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600
    });
  } catch {
    status = { attempted: true, active: false, reason: "runtime-file-unavailable" };
    return status;
  }

  try {
    for (const command of ["qdbus6", "qdbus"] as const) {
      runKWinDbus(command, "org.kde.kwin.Scripting.unloadScript", [KWIN_SCRIPT_NAME]);
      const loaded = runKWinDbus(command, "org.kde.kwin.Scripting.loadScript", [scriptPath, KWIN_SCRIPT_NAME]);
      if (!loaded) {
        continue;
      }
      const started = runKWinDbus(command, "org.kde.kwin.Scripting.start", []);
      if (started) {
        status = { attempted: true, active: true, command };
        return status;
      }
    }
  } finally {
    try {
      fs.rmSync(scriptPath, { force: true });
    } catch {
      // XDG_RUNTIME_DIR is session-scoped, so a failed best-effort cleanup is bounded.
    }
  }

  status = { attempted: true, active: false, reason: "kwin-dbus-unavailable" };
  return status;
}

export function getKWinWaylandOverlayHostSyncStatus(): KWinWaylandOverlayHostSyncStatus {
  return status;
}

function isKdeWaylandSession(): boolean {
  if (
    process.platform !== "linux" ||
    process.env.XDG_SESSION_TYPE?.trim().toLowerCase() !== "wayland" ||
    !process.env.WAYLAND_DISPLAY?.trim()
  ) {
    return false;
  }
  if (process.env.KDE_FULL_SESSION?.trim().toLowerCase() === "true") {
    return true;
  }
  return (process.env.XDG_CURRENT_DESKTOP || "")
    .split(":")
    .some((desktop) => desktop.trim().toLowerCase() === "kde");
}

function runKWinDbus(command: "qdbus6" | "qdbus", method: string, args: string[]): boolean {
  const result = spawnSync(
    command,
    ["org.kde.KWin", "/Scripting", method, ...args],
    { encoding: "utf8", timeout: 1500, windowsHide: true }
  );
  return result.status === 0 && !result.error;
}
