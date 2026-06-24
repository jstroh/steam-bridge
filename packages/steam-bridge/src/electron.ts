export interface ElectronOverlayOptions {
  disableDirectComposition?: boolean;
  enableInProcessGpu?: boolean;
  repaintIntervalMs?: number;
}

interface ElectronApp {
  commandLine: {
    appendSwitch(name: string, value?: string): void;
  };
  on(event: "browser-window-created", handler: (event: unknown, window: ElectronWindow) => void): void;
}

interface ElectronWindow {
  isDestroyed(): boolean;
  webContents: {
    once(event: "did-finish-load", handler: () => void): void;
    invalidate(): void;
    send(channel: string, ...args: unknown[]): void;
  };
}

interface ElectronApi {
  app: ElectronApp;
  BrowserWindow: {
    getAllWindows(): ElectronWindow[];
  };
}

let repaintTimer: NodeJS.Timeout | undefined;

export function electronEnableSteamOverlay(options: ElectronOverlayOptions = {}): void {
  const {
    disableDirectComposition = process.platform === "win32",
    enableInProcessGpu = true,
    repaintIntervalMs = 1000
  } = options;

  const electron = require("electron") as ElectronApi;

  if (enableInProcessGpu) {
    electron.app.commandLine.appendSwitch("in-process-gpu");
  }

  if (disableDirectComposition) {
    electron.app.commandLine.appendSwitch("disable-direct-composition");
  }

  electron.app.on("browser-window-created", (_event, window) => {
    window.webContents.once("did-finish-load", () => {
      window.webContents.invalidate();
    });
  });

  if (!repaintTimer && repaintIntervalMs > 0) {
    repaintTimer = setInterval(() => {
      for (const window of electron.BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.invalidate();
        }
      }
    }, repaintIntervalMs);

    repaintTimer.unref?.();
  }
}

export function electronDisableSteamOverlayRepaintLoop(): void {
  if (repaintTimer) {
    clearInterval(repaintTimer);
    repaintTimer = undefined;
  }
}
