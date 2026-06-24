import fs from "node:fs";
import path from "node:path";

export interface NativeAuthTicket {
  cancel(): void;
  getBytes(): Buffer;
}

export interface NativeCallbackHandle {
  disconnect(): void;
}

export interface NativeSteamId {
  steamId64: bigint;
  steamId32: string;
  accountId: number;
}

export interface NativeBinding {
  init(appId: number): void;
  shutdown(): void;
  restartAppIfNecessary(appId: number): boolean;
  runCallbacks(): void;
  getSteamId(): NativeSteamId;
  getAuthTicketForWebApi(identity: string, timeoutSeconds?: number): Promise<NativeAuthTicket>;
  isSteamDeck(): boolean;
  registerMicroTxnAuthorizationResponse(handler: (event: unknown) => void): NativeCallbackHandle;
  activateOverlayToWebPage(url: string): void;
  isAchievementActivated(name: string): boolean;
}

let binding: NativeBinding | undefined;

export function loadNativeBinding(): NativeBinding {
  if (binding) {
    return binding;
  }

  const errors: string[] = [];
  for (const candidate of nativeCandidates()) {
    if (!candidate || !fs.existsSync(candidate)) {
      continue;
    }

    try {
      binding = require(candidate) as NativeBinding;
      return binding;
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    [
      "Unable to load Steam Bridge native module.",
      "Run `npm run native:build`, publish/install a prebuild, or set STEAM_BRIDGE_NATIVE_PATH to a .node file.",
      ...errors
    ].join("\n")
  );
}

function nativeCandidates(): string[] {
  const packageRoot = path.resolve(__dirname, "..");
  const repoRoot = path.resolve(packageRoot, "..", "..");
  const taggedName = `steam_bridge_native.${process.platform}-${process.arch}.node`;

  return [
    process.env.STEAM_BRIDGE_NATIVE_PATH || "",
    path.join(packageRoot, "steam_bridge_native.local.node"),
    path.join(packageRoot, "steam_bridge_native.node"),
    path.join(packageRoot, taggedName),
    path.join(packageRoot, "native", taggedName),
    path.join(repoRoot, "target", "release", "steam_bridge_native.node")
  ];
}

