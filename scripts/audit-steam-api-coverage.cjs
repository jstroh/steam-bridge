const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const steamworksSysRoot = findSteamworksSysRoot();
const flatHeader = path.join(steamworksSysRoot, "lib", "steam", "public", "steam", "steam_api_flat.h");
const bindingFiles = [
  "macos_bindings.rs",
  "linux_bindings.rs",
  "windows_bindings.rs"
].map((file) => path.join(steamworksSysRoot, "src", file));
const nativeSourceFiles = [
  path.join(repoRoot, "crates", "native", "src", "lib.rs"),
  path.join(repoRoot, "crates", "native", "src", "compat.rs"),
  path.join(repoRoot, "crates", "native", "src", "steam_music_remote_bridge.cpp"),
  path.join(repoRoot, "crates", "native", "src", "steam_game_coordinator_bridge.cpp")
];
const manualCallbackAliases = ["GCMessageAvailable", "GCMessageFailed"];

assertFlatApiCoverage();
assertCallbackCoverage();

console.log("Steam API coverage audit passed: flat API references, shim references, and callback aliases are covered.");

function findSteamworksSysRoot() {
  const metadata = spawnSync("cargo", ["metadata", "--format-version", "1"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (metadata.status !== 0) {
    process.stderr.write(metadata.stderr || metadata.stdout);
    process.exit(metadata.status ?? 1);
  }

  const parsed = JSON.parse(metadata.stdout);
  const pkg = parsed.packages.find((candidate) => candidate.name === "steamworks-sys");
  if (!pkg) {
    throw new Error("cargo metadata did not include steamworks-sys.");
  }

  return path.dirname(pkg.manifest_path);
}

function assertFlatApiCoverage() {
  const flat = fs.readFileSync(flatHeader, "utf8");
  const flatFunctions = unique([...flat.matchAll(/\b(SteamAPI_ISteam[A-Za-z0-9_]+)\s*\(/g)].map((match) => match[1]));
  const nativeSource = readNativeSource();

  const missing = flatFunctions.filter((fnName) => !nativeSource.includes(fnName));
  if (missing.length > 0) {
    throw new Error(
      [
        `Native source is missing references for ${missing.length} Steam flat API functions:`,
        ...missing.map((fnName) => `  - ${fnName}`)
      ].join("\n")
    );
  }
}

function assertCallbackCoverage() {
  const exported = readSteamCallbackNames();
  const callbackConstants = unique(
    bindingFiles.flatMap((file) => {
      const bindings = fs.readFileSync(file, "utf8");
      return [...bindings.matchAll(/pub const ([A-Za-z0-9_]+)_t_k_iCallback:/g)].map((match) => match[1]);
    })
  );

  const missing = callbackConstants.filter((callbackName) => {
    return callbackNameVariants(callbackName).every((candidate) => !exported.has(candidate));
  });

  if (missing.length > 0) {
    throw new Error(
      [
        `SteamCallback is missing aliases for ${missing.length} generated callback constants:`,
        ...missing.map((callbackName) => `  - ${callbackName}`)
      ].join("\n")
    );
  }

  const missingManualAliases = manualCallbackAliases.filter((callbackName) => !exported.has(callbackName));
  if (missingManualAliases.length > 0) {
    throw new Error(
      [
        `SteamCallback is missing manual shim callback aliases:`,
        ...missingManualAliases.map((callbackName) => `  - ${callbackName}`)
      ].join("\n")
    );
  }
}

function readNativeSource() {
  return nativeSourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

function readSteamCallbackNames() {
  const indexSource = fs.readFileSync(path.join(repoRoot, "packages", "steam-bridge", "src", "index.ts"), "utf8");
  const match = indexSource.match(/export const SteamCallback = \{([\s\S]*?)\n\} as const;/);
  if (!match) {
    throw new Error("Could not find exported SteamCallback object.");
  }

  return new Set([...match[1].matchAll(/^\s*([A-Za-z0-9_]+):\s*-?\d+/gm)].map((entry) => entry[1]));
}

function callbackNameVariants(callbackName) {
  const variants = new Set([callbackName]);
  const withoutCallbackSuffix = callbackName.replace(/Callback$/, "");
  variants.add(withoutCallbackSuffix);
  variants.add(withoutCallbackSuffix.replace(/^HTML_/, "HTML"));
  variants.add(withoutCallbackSuffix.replace(/IDs$/, "Ids"));
  variants.add(withoutCallbackSuffix.replace("SteamInventoryEligiblePromoItemDefIDs", "SteamInventoryEligiblePromoItemDefIds"));
  variants.add(withoutCallbackSuffix.replace("SteamUGCRequestUGCDetailsResult", "SteamUGCRequestDetailsResult"));
  variants.add(withoutCallbackSuffix.replace("SteamNetConnectionStatusChangedCallback", "SteamNetConnectionStatusChanged"));

  addUgcAlias(variants, withoutCallbackSuffix, "CreateItemResult", "SteamUGCCreateItemResult");
  addUgcAlias(variants, withoutCallbackSuffix, "SubmitItemUpdateResult", "SteamUGCSubmitItemUpdateResult");
  addUgcAlias(variants, withoutCallbackSuffix, "ItemInstalled", "SteamUGCItemInstalled");
  addUgcAlias(variants, withoutCallbackSuffix, "DownloadItemResult", "SteamUGCDownloadItemResult");
  addUgcAlias(variants, withoutCallbackSuffix, "UserFavoriteItemsListChanged", "SteamUGCUserFavoriteItemsListChanged");
  addUgcAlias(variants, withoutCallbackSuffix, "SetUserItemVoteResult", "SteamUGCSetUserItemVoteResult");
  addUgcAlias(variants, withoutCallbackSuffix, "GetUserItemVoteResult", "SteamUGCGetUserItemVoteResult");
  addUgcAlias(variants, withoutCallbackSuffix, "StartPlaytimeTrackingResult", "SteamUGCStartPlaytimeTrackingResult");
  addUgcAlias(variants, withoutCallbackSuffix, "StopPlaytimeTrackingResult", "SteamUGCStopPlaytimeTrackingResult");
  addUgcAlias(variants, withoutCallbackSuffix, "AddUGCDependencyResult", "SteamUGCAddDependencyResult");
  addUgcAlias(variants, withoutCallbackSuffix, "RemoveUGCDependencyResult", "SteamUGCRemoveDependencyResult");
  addUgcAlias(variants, withoutCallbackSuffix, "AddAppDependencyResult", "SteamUGCAddAppDependencyResult");
  addUgcAlias(variants, withoutCallbackSuffix, "RemoveAppDependencyResult", "SteamUGCRemoveAppDependencyResult");
  addUgcAlias(variants, withoutCallbackSuffix, "GetAppDependenciesResult", "SteamUGCGetAppDependenciesResult");
  addUgcAlias(variants, withoutCallbackSuffix, "DeleteItemResult", "SteamUGCDeleteItemResult");
  addUgcAlias(variants, withoutCallbackSuffix, "UserSubscribedItemsListChanged", "SteamUGCUserSubscribedItemsListChanged");
  addUgcAlias(variants, withoutCallbackSuffix, "WorkshopEULAStatus", "SteamUGCWorkshopEULAStatus");

  variants.add(
    withoutCallbackSuffix
      .replace(/^GSClient/, "GameServerClient")
      .replace(/^GSPolicy/, "GameServerPolicy")
      .replace(/^GSGameplay/, "GameServerGameplay")
      .replace(/^GSReputation/, "GameServerReputation")
      .replace(/^GSStats/, "GameServerStats")
  );
  variants.add(withoutCallbackSuffix.replace("AssociateWithClanResult", "GameServerAssociateWithClan"));
  variants.add(withoutCallbackSuffix.replace("ComputeNewPlayerCompatibilityResult", "GameServerPlayerCompatibility"));

  return [...variants];
}

function addUgcAlias(variants, name, generated, exported) {
  if (name === generated) {
    variants.add(exported);
  }
}

function unique(values) {
  return [...new Set(values)];
}
