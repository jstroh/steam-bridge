import * as steamworks from "./index";

export type {
  SteamInputDefinition,
  SteamInputFrame,
  SteamInputNameMap,
  SteamInputSessionOptions,
  SteamInputSession
} from "./index";

export interface StartSteamOptions {
  appId: number;
  /** Positive callback-pump interval in milliseconds. */
  callbackIntervalMs?: number;
}

export type Unsubscribe = () => void;

export type SteamOverlayDialog =
  | "friends"
  | "community"
  | "players"
  | "settings"
  | "official-game-group"
  | "stats"
  | "achievements";

export type SteamOverlayTarget =
  | { type: "dialog"; dialog: SteamOverlayDialog }
  | { type: "store"; appId?: number; action?: "open" | "add-to-cart" | "add-to-cart-and-show" }
  | { type: "web"; url: string; modal?: boolean }
  | { type: "user"; userId: bigint; page?: "profile" | "chat" | "stats" | "achievements" };

export interface SteamEvents {
  onOverlayChanged(listener: (active: boolean) => void): Unsubscribe;
  onPurchaseAuthorization(
    listener: (event: steamworks.MicroTxnAuthorizationResponse) => void
  ): Unsubscribe;
}

export interface SteamOverlay {
  open(target: SteamOverlayTarget): void;
  isAvailable(): boolean;
  getDiagnostics(): steamworks.OverlayDiagnostics;
}

export interface SteamGameHost {
  attachElectronWindow(
    window: Parameters<typeof steamworks.createElectronSteamOverlay>[0],
    options?: Parameters<typeof steamworks.createElectronSteamOverlay>[1]
  ): ReturnType<typeof steamworks.createElectronSteamOverlay>;
  createNativeWindow(
    options?: steamworks.NativeOverlaySessionOptions
  ): steamworks.NativeOverlaySession;
}

export interface SteamInputService {
  createSession<const TDefinition extends steamworks.SteamInputDefinition>(
    options: steamworks.SteamInputSessionOptions<TDefinition>
  ): steamworks.SteamInputSession<TDefinition>;
}

export interface SteamApplication {
  readonly appId: number;
  readonly packageVersion: string;
  readonly apps: typeof steamworks.apps;
  readonly localPlayer: typeof steamworks.localplayer;
  readonly achievements: typeof steamworks.achievement;
  readonly auth: typeof steamworks.auth;
  readonly cloud: typeof steamworks.cloud;
  readonly friends: typeof steamworks.friends;
  readonly steamInput: SteamInputService;
  readonly inventory: typeof steamworks.inventory;
  readonly matchmaking: typeof steamworks.matchmaking;
  readonly networking: typeof steamworks.networking;
  readonly screenshots: typeof steamworks.screenshots;
  readonly stats: typeof steamworks.stats;
  readonly workshop: typeof steamworks.workshop;
  readonly events: SteamEvents;
  readonly overlay: SteamOverlay;
  readonly gameHost: SteamGameHost;
  readonly isSteamDeck: boolean;
  readonly isBigPicture: boolean;
  readonly closed: boolean;
  close(): void;
}

interface PackageMetadata {
  version?: unknown;
}

const packageMetadata = require("../package.json") as PackageMetadata;
export const packageVersion = typeof packageMetadata.version === "string"
  ? packageMetadata.version
  : "unknown";
export const defineSteamInput = steamworks.defineSteamInput;

let activeApplication: SteamApplication | null = null;

interface OwnedCleanup {
  run(): void;
}

export function startSteam(options: StartSteamOptions): SteamApplication {
  if (!options || typeof options !== "object") {
    throw new TypeError("startSteam requires an options object.");
  }
  if (activeApplication) {
    throw new Error("Steam Bridge already has an active application. Close it before starting another.");
  }

  steamworks.init({
    appId: options.appId,
    callbackIntervalMs: options.callbackIntervalMs
  });

  let closed = false;
  const ownedCleanups = new Set<OwnedCleanup>();
  const own = (cleanup: () => void): (() => void) => {
    let active = true;
    const entry: OwnedCleanup = {
      run(): void {
        if (!active) return;
        active = false;
        ownedCleanups.delete(entry);
        cleanup();
      }
    };
    ownedCleanups.add(entry);
    return entry.run;
  };
  const ensureOpen = (): void => {
    if (closed) throw new Error("Steam application is closed.");
  };
  const unsubscribe = (handle: steamworks.CallbackHandle): Unsubscribe => {
    return own(() => handle.disconnect());
  };
  const events: SteamEvents = {
    onOverlayChanged(listener): Unsubscribe {
      ensureOpen();
      return unsubscribe(steamworks.onGameOverlayActivated((event) => listener(event.active === true)));
    },
    onPurchaseAuthorization(listener): Unsubscribe {
      ensureOpen();
      return unsubscribe(steamworks.onMicroTxnAuthorizationResponse(listener));
    }
  };
  const overlay: SteamOverlay = {
    open(target): void {
      ensureOpen();
      switch (target.type) {
        case "dialog":
          steamworks.overlay.activateDialog(overlayDialog(target.dialog));
          return;
        case "store":
          steamworks.overlay.activateToStore(
            target.appId ?? options.appId,
            overlayStoreAction(target.action ?? "open")
          );
          return;
        case "web":
          steamworks.overlay.activateToWebPage(target.url, { modal: target.modal });
          return;
        case "user":
          steamworks.overlay.activateDialogToUser(overlayUserDialog(target.page ?? "profile"), target.userId);
      }
    },
    isAvailable(): boolean {
      ensureOpen();
      return steamworks.isOverlayEnabled();
    },
    getDiagnostics(): steamworks.OverlayDiagnostics {
      ensureOpen();
      return steamworks.getOverlayDiagnostics();
    }
  };
  const gameHost: SteamGameHost = {
    attachElectronWindow(window, hostOptions) {
      ensureOpen();
      const host = steamworks.createElectronSteamOverlay(window, hostOptions);
      own(() => host.close());
      return host;
    },
    createNativeWindow(hostOptions = {}) {
      ensureOpen();
      const host = steamworks.startNativeOverlaySession(hostOptions);
      own(() => host.close());
      return host;
    }
  };
  const steamInput: SteamInputService = {
    createSession<const TDefinition extends steamworks.SteamInputDefinition>(
      sessionOptions: steamworks.SteamInputSessionOptions<TDefinition>
    ): steamworks.SteamInputSession<TDefinition> {
      ensureOpen();
      const session = steamworks.input.createSession(sessionOptions);
      own(() => session.dispose());
      return session;
    }
  };

  const application: SteamApplication = {
    appId: options.appId,
    packageVersion,
    apps: steamworks.apps,
    localPlayer: steamworks.localplayer,
    achievements: steamworks.achievement,
    auth: steamworks.auth,
    cloud: steamworks.cloud,
    friends: steamworks.friends,
    steamInput,
    inventory: steamworks.inventory,
    matchmaking: steamworks.matchmaking,
    networking: steamworks.networking,
    screenshots: steamworks.screenshots,
    stats: steamworks.stats,
    workshop: steamworks.workshop,
    events,
    overlay,
    gameHost,
    get isSteamDeck(): boolean {
      return steamworks.isSteamDeck();
    },
    get isBigPicture(): boolean {
      return steamworks.isSteamInBigPictureMode();
    },
    get closed(): boolean {
      return closed;
    },
    close(): void {
      if (closed) return;
      closed = true;
      let firstError: unknown;
      try {
        for (const cleanup of [...ownedCleanups].reverse()) {
          try {
            cleanup.run();
          } catch (error) {
            firstError ??= error;
          }
        }
        try {
          steamworks.shutdown();
        } catch (error) {
          firstError ??= error;
        }
      } finally {
        if (activeApplication === application) activeApplication = null;
      }
      if (firstError !== undefined) throw firstError;
    }
  };
  activeApplication = application;
  return application;
}

function overlayDialog(dialog: SteamOverlayDialog): number {
  switch (dialog) {
    case "friends": return steamworks.Dialog.Friends;
    case "community": return steamworks.Dialog.Community;
    case "players": return steamworks.Dialog.Players;
    case "settings": return steamworks.Dialog.Settings;
    case "official-game-group": return steamworks.Dialog.OfficialGameGroup;
    case "stats": return steamworks.Dialog.Stats;
    case "achievements": return steamworks.Dialog.Achievements;
  }
}

function overlayStoreAction(action: NonNullable<Extract<SteamOverlayTarget, { type: "store" }>["action"]>): number {
  switch (action) {
    case "open": return steamworks.StoreFlag.None;
    case "add-to-cart": return steamworks.StoreFlag.AddToCart;
    case "add-to-cart-and-show": return steamworks.StoreFlag.AddToCartAndShow;
  }
}

function overlayUserDialog(page: NonNullable<Extract<SteamOverlayTarget, { type: "user" }>["page"]>): string {
  switch (page) {
    case "profile": return steamworks.UserDialog.Profile;
    case "chat": return steamworks.UserDialog.Chat;
    case "stats": return steamworks.UserDialog.Stats;
    case "achievements": return steamworks.UserDialog.Achievements;
  }
}
