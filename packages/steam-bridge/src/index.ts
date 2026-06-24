import { electronEnableSteamOverlay as electronEnableSteamOverlayImpl } from "./electron";
import {
  loadNativeBinding,
  NativeAuthTicket,
  NativeBinding,
  NativeCallbackHandle,
  NativeSteamId
} from "./native";

export interface InitOptions {
  appId: number;
  callbackIntervalMs?: number;
}

export interface SteamId {
  steamId64: bigint;
  steamId32: string;
  accountId: number;
}

export interface AuthTicket {
  cancel(): void;
  getBytes(): Buffer;
}

export interface CallbackHandle {
  disconnect(): void;
}

export interface MicroTxnAuthorizationResponse {
  appId?: number;
  app_id?: number;
  orderId?: bigint | string | number;
  order_id?: bigint | string | number;
  authorized?: boolean;
  [key: string]: unknown;
}

export const SteamCallback = {
  MicroTxnAuthorizationResponse: 9
} as const;

// Keep this as a mutable CommonJS export. FOV4's current main process replaces
// steamworks.electronEnableSteamOverlay before calling it.
export let electronEnableSteamOverlay = electronEnableSteamOverlayImpl;

export type SteamCallbackId = typeof SteamCallback[keyof typeof SteamCallback];

export interface SteamBridgeClient {
  localplayer: {
    getSteamId(): SteamId;
  };
  auth: {
    getAuthTicketForWebApi(identity: string, timeoutSeconds?: number): Promise<AuthTicket>;
  };
  callback: {
    SteamCallback: typeof SteamCallback;
    register(callback: SteamCallbackId, handler: (event: MicroTxnAuthorizationResponse) => void): CallbackHandle;
  };
  overlay: {
    activateToWebPage(url: string): void;
  };
  achievement: {
    isActivated(name: string): boolean;
  };
  utils: {
    isSteamRunningOnSteamDeck(): boolean;
  };
}

let callbackTimer: NodeJS.Timeout | undefined;
let activeCallbackIntervalMs = 33;

export function init(options: InitOptions | number): SteamBridgeClient {
  const normalized = normalizeInitOptions(options);
  native().init(normalized.appId);
  startCallbackPump(normalized.callbackIntervalMs);
  return createCompatibilityClient();
}

export function shutdown(): void {
  stopCallbackPump();
  native().shutdown();
}

export function restartAppIfNecessary(appId: number): boolean {
  return native().restartAppIfNecessary(appId);
}

export function runCallbacks(): void {
  native().runCallbacks();
}

export function getSteamId(): SteamId {
  return normalizeSteamId(native().getSteamId());
}

export async function getAuthTicketForWebApi(
  identity: string,
  timeoutSeconds?: number
): Promise<AuthTicket> {
  return wrapAuthTicket(await native().getAuthTicketForWebApi(identity, timeoutSeconds));
}

export function isSteamDeck(): boolean {
  return native().isSteamDeck();
}

export function onMicroTxnAuthorizationResponse(
  handler: (event: MicroTxnAuthorizationResponse) => void
): CallbackHandle {
  return wrapCallbackHandle(
    native().registerMicroTxnAuthorizationResponse((event) => {
      handler(normalizeMicroTxnEvent(event));
    })
  );
}

export function activateOverlayToWebPage(url: string): void {
  native().activateOverlayToWebPage(url);
}

export function isAchievementActivated(name: string): boolean {
  return native().isAchievementActivated(name);
}

export function createCompatibilityClient(): SteamBridgeClient {
  return {
    localplayer: {
      getSteamId
    },
    auth: {
      getAuthTicketForWebApi
    },
    callback: {
      SteamCallback,
      register(callback, handler) {
        if (callback !== SteamCallback.MicroTxnAuthorizationResponse) {
          throw new Error(`Steam Bridge does not implement callback ${String(callback)} in V1`);
        }

        return onMicroTxnAuthorizationResponse(handler);
      }
    },
    overlay: {
      activateToWebPage: activateOverlayToWebPage
    },
    achievement: {
      isActivated: isAchievementActivated
    },
    utils: {
      isSteamRunningOnSteamDeck: isSteamDeck
    }
  };
}

function native(): NativeBinding {
  return loadNativeBinding();
}

function normalizeInitOptions(options: InitOptions | number): Required<InitOptions> {
  if (typeof options === "number") {
    return { appId: options, callbackIntervalMs: activeCallbackIntervalMs };
  }

  if (!Number.isInteger(options.appId) || options.appId <= 0) {
    throw new Error("Steam Bridge init requires a positive integer appId");
  }

  return {
    appId: options.appId,
    callbackIntervalMs: options.callbackIntervalMs ?? activeCallbackIntervalMs
  };
}

function startCallbackPump(intervalMs: number): void {
  activeCallbackIntervalMs = intervalMs;

  if (callbackTimer) {
    clearInterval(callbackTimer);
  }

  callbackTimer = setInterval(() => {
    try {
      native().runCallbacks();
    } catch {
      stopCallbackPump();
    }
  }, intervalMs);

  callbackTimer.unref?.();
}

function stopCallbackPump(): void {
  if (callbackTimer) {
    clearInterval(callbackTimer);
    callbackTimer = undefined;
  }
}

function normalizeSteamId(steamId: NativeSteamId): SteamId {
  return {
    steamId64: BigInt(steamId.steamId64),
    steamId32: steamId.steamId32,
    accountId: steamId.accountId
  };
}

function wrapAuthTicket(ticket: NativeAuthTicket): AuthTicket {
  return {
    cancel: () => ticket.cancel(),
    getBytes: () => ticket.getBytes()
  };
}

function wrapCallbackHandle(handle: NativeCallbackHandle): CallbackHandle {
  return {
    disconnect: () => handle.disconnect()
  };
}

function normalizeMicroTxnEvent(event: unknown): MicroTxnAuthorizationResponse {
  if (!event || typeof event !== "object") {
    return { value: event };
  }

  const source = event as Record<string, unknown>;
  const normalized: MicroTxnAuthorizationResponse = { ...source };

  if (typeof source.app_id === "number" && normalized.appId === undefined) {
    normalized.appId = source.app_id;
  }

  if (source.order_id !== undefined && normalized.orderId === undefined) {
    normalized.orderId = normalizeOrderId(source.order_id);
  }

  return normalized;
}

function normalizeOrderId(value: unknown): bigint | string | number {
  if (typeof value === "bigint" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    try {
      return BigInt(value);
    } catch {
      return value;
    }
  }

  return String(value);
}

const defaultExport = {
  init,
  shutdown,
  restartAppIfNecessary,
  runCallbacks,
  getSteamId,
  getAuthTicketForWebApi,
  isSteamDeck,
  onMicroTxnAuthorizationResponse,
  activateOverlayToWebPage,
  isAchievementActivated,
  electronEnableSteamOverlay,
  SteamCallback
};

export default defaultExport;
