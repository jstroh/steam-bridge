const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  readNativeBindingMethodNames: readNativeBindingMethodNamesFromManifest
} = require("./native-binding-manifest.cjs");

const repoRoot = path.resolve(__dirname, "..");
const steamworksSysRoot = findSteamworksSysRoot();
const steamHeadersRoot = path.join(steamworksSysRoot, "lib", "steam", "public", "steam");
const flatHeader = path.join(steamHeadersRoot, "steam_api_flat.h");
const bindingFiles = [
  "macos_bindings.rs",
  "linux_bindings.rs",
  "windows_bindings.rs"
].map((file) => path.join(steamworksSysRoot, "src", file));
const nativeSourceFiles = [
  path.join(repoRoot, "crates", "native", "src", "lib.rs"),
  path.join(repoRoot, "crates", "native", "src", "compat.rs"),
  path.join(repoRoot, "crates", "native", "src", "steam_music_remote_bridge.cpp"),
  path.join(repoRoot, "crates", "native", "src", "steam_game_coordinator_bridge.cpp"),
  path.join(repoRoot, "crates", "native", "src", "steam_header_only_bridge.cpp")
];
const napiExportSourceFiles = [
  path.join(repoRoot, "crates", "native", "src", "lib.rs"),
  path.join(repoRoot, "crates", "native", "src", "compat.rs")
];
const napiWrapperMacros = new Set([
  "game_server_inventory_wrapper",
  "game_server_networking_sockets_wrapper"
]);
const auditedTopLevelMacros = new Set([...napiWrapperMacros, "thread_local"]);
const manualCallbackAliases = ["GCMessageAvailable", "GCMessageFailed"];
const manualHeaderOnlyNativeSymbols = [
  "steam_bridge_client_run_frame",
  "steam_bridge_client_set_post_api_result_in_process",
  "steam_bridge_client_remove_post_api_result_in_process",
  "steam_bridge_client_set_check_callback_registered_in_process",
  "steam_bridge_client_destroy_all_interfaces",
  "steam_bridge_app_ticket_get_app_ownership_ticket_data",
  "steam_bridge_game_server_init_game_server",
  "steam_bridge_game_server_set_master_server_heartbeat_interval_deprecated",
  "steam_bridge_game_server_force_master_server_heartbeat_deprecated",
  "steam_bridge_utils_get_cser_ip_port"
];
const manualHeaderOnlyFacadeMethods = [
  "runFrameDeprecated",
  "registerPostApiResultInProcessHook",
  "registerCheckCallbackRegisteredInProcessHook",
  "destroyAllInterfaces",
  "getAppOwnershipTicketData",
  "initGameServer",
  "setMasterServerHeartbeatIntervalDeprecated",
  "forceMasterServerHeartbeatDeprecated",
  "getCSERIPPort"
];
const intentionallyInternalSdkExports = [
  "SteamInternal_ContextInit",
  "SteamInternal_FindOrCreateGameServerInterface",
  "SteamInternal_SteamAPI_Init"
];
assertNapiExportScannerSelfTest();
assertFlatApiCoverage();
assertSdkExportCoverage();
assertHeaderOnlyShimCoverage();
assertCallbackCoverage();
assertCallbackFacadeCoverage();
assertNativeBindingCoverage();
assertSteamworksEnumCoverage();

console.log("Steam API coverage audit passed: SDK exports, flat API references, native bindings, manual shim references, callback aliases, callback facade helpers, and SDK enum constants are covered.");

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
  const flatFunctions = unique([...flat.matchAll(/\b(SteamAPI_[A-Za-z0-9_]+)\s*\(/g)].map((match) => match[1]));
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

function assertSdkExportCoverage() {
  const exportedSymbols = readSdkExportNames().filter((name) => !intentionallyInternalSdkExports.includes(name));
  const nativeSource = readNativeSource();

  const missing = exportedSymbols.filter((fnName) => !nativeSource.includes(fnName));
  if (missing.length > 0) {
    throw new Error(
      [
        `Native source is missing references for ${missing.length} Steam SDK exports:`,
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

function assertCallbackFacadeCoverage() {
  const indexSource = fs.readFileSync(path.join(repoRoot, "packages", "steam-bridge", "src", "index.ts"), "utf8");
  const requiredPatterns = [
    ["SteamCallbackName type", /export type SteamCallbackName\s*=\s*keyof typeof SteamCallback;/],
    ["onSteamCallback helper", /export function onSteamCallback\s*\(/],
    ["name-or-id callback input", /SteamCallbackName\s*\|\s*SteamCallbackId\s*\|\s*number/],
    ["callback name resolver", /function resolveSteamCallbackId\s*\(/]
  ];
  const missing = requiredPatterns.filter(([, pattern]) => !pattern.test(indexSource)).map(([label]) => label);
  if (missing.length > 0) {
    throw new Error(
      [
        "Public facade is missing generic Steam callback subscription helpers:",
        ...missing.map((label) => `  - ${label}`)
      ].join("\n")
    );
  }
}

function assertHeaderOnlyShimCoverage() {
  const nativeSource = readNativeSource();
  const indexSource = fs.readFileSync(path.join(repoRoot, "packages", "steam-bridge", "src", "index.ts"), "utf8");

  const missingNativeSymbols = manualHeaderOnlyNativeSymbols.filter((symbol) => !nativeSource.includes(symbol));
  if (missingNativeSymbols.length > 0) {
    throw new Error(
      [
        "Native source is missing manual header-only shim symbols:",
        ...missingNativeSymbols.map((symbol) => `  - ${symbol}`)
      ].join("\n")
    );
  }

  const missingFacadeMethods = manualHeaderOnlyFacadeMethods.filter((method) => !indexSource.includes(method));
  if (missingFacadeMethods.length > 0) {
    throw new Error(
      [
        "Public facade is missing manual header-only shim methods:",
        ...missingFacadeMethods.map((method) => `  - ${method}`)
      ].join("\n")
    );
  }
}

function assertNativeBindingCoverage() {
  const nativeBindingMethods = readNativeBindingMethodNames();
  const nativeBindingMethodSet = new Set(nativeBindingMethods);
  const napiExports = readNapiExportNames();
  const napiExportSet = new Set(napiExports);
  const indexSource = fs.readFileSync(path.join(repoRoot, "packages", "steam-bridge", "src", "index.ts"), "utf8");

  const missingBindingMethods = napiExports.filter((method) => !nativeBindingMethodSet.has(method));
  if (missingBindingMethods.length > 0) {
    throw new Error(
      [
        `NativeBinding is missing declarations for ${missingBindingMethods.length} N-API exports:`,
        ...missingBindingMethods.map((method) => `  - ${method}`)
      ].join("\n")
    );
  }

  const missingNapiExports = nativeBindingMethods.filter((method) => !napiExportSet.has(method));
  if (missingNapiExports.length > 0) {
    throw new Error(
      [
        `Native implementation is missing ${missingNapiExports.length} NativeBinding methods:`,
        ...missingNapiExports.map((method) => `  - ${method}`)
      ].join("\n")
    );
  }

  const missingFacadeReferences = nativeBindingMethods.filter((method) => !indexSource.includes(method));
  if (missingFacadeReferences.length > 0) {
    throw new Error(
      [
        `Public facade is missing references for ${missingFacadeReferences.length} NativeBinding methods:`,
        ...missingFacadeReferences.map((method) => `  - ${method}`)
      ].join("\n")
    );
  }
}

function assertSteamworksEnumCoverage() {
  const check = spawnSync("node", [path.join(repoRoot, "scripts", "generate-steamworks-enums.cjs"), "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (check.status !== 0) {
    process.stderr.write(check.stderr || check.stdout);
    process.exit(check.status ?? 1);
  }
}

function readNativeSource() {
  return nativeSourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

function readNapiExportNames() {
  const names = napiExportSourceFiles.flatMap((file) => {
    return readNapiExportNamesFromSource(fs.readFileSync(file, "utf8"), path.relative(repoRoot, file));
  });
  assert.equal(new Set(names).size, names.length, "N-API exports must not contain duplicate JavaScript names.");
  return names;
}

function readNapiExportNamesFromSource(source, sourceLabel) {
  const stripped = stripRustComments(source);
  const validatedNapiWrapperDefinitions = validateNapiGeneratingMacros(stripped, sourceLabel);
  assertAuditedTopLevelMacroInvocations(stripped, sourceLabel);
  const lines = stripped.split(/\r?\n/);
  const direct = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("#[napi")) {
      continue;
    }
    const attribute = line.match(/^#\[napi(?:\((.*)\))?\]$/);
    if (!attribute) {
      throw new Error(`${sourceLabel}:${index + 1} uses an unsupported top-level #[napi] attribute shape.`);
    }
    const item = findNextRustItem(lines, index + 1);
    if (!item) {
      throw new Error(`${sourceLabel}:${index + 1} has a top-level #[napi] attribute without an item.`);
    }
    if (isRustFunctionItem(item.line)) {
      const jsName = attribute[1]?.match(/^js_name\s*=\s*"([A-Za-z_$][A-Za-z0-9_$]*)"$/);
      if (!jsName) {
        throw new Error(
          `${sourceLabel}:${index + 1} must give every top-level N-API function exactly one ASCII js_name.`
        );
      }
      direct.push(jsName[1]);
    } else if (!isKnownNonFunctionNapiItem(item.line)) {
      throw new Error(`${sourceLabel}:${item.lineNumber} uses #[napi] on an unsupported top-level item.`);
    }
  }

  const generated = [];
  const wrapperStart = /^(game_server_inventory_wrapper|game_server_networking_sockets_wrapper)!\(\s*/gm;
  for (const match of stripped.matchAll(wrapperStart)) {
    const argument = stripped.slice(match.index + match[0].length).match(/^"([A-Za-z_$][A-Za-z0-9_$]*)"/);
    if (!argument) {
      const lineNumber = stripped.slice(0, match.index).split("\n").length;
      throw new Error(`${sourceLabel}:${lineNumber} must give ${match[1]} an ASCII string-literal js_name first.`);
    }
    if (!validatedNapiWrapperDefinitions.has(match[1])) {
      const lineNumber = stripped.slice(0, match.index).split("\n").length;
      throw new Error(`${sourceLabel}:${lineNumber} invokes ${match[1]} without its audited N-API definition.`);
    }
    generated.push(argument[1]);
  }
  return [...direct, ...generated];
}

function validateNapiGeneratingMacros(source, sourceLabel) {
  const validated = new Set();
  const definition = /^macro_rules!\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)^\}/gm;
  for (const match of source.matchAll(definition)) {
    const name = match[1];
    const body = match[2];
    const lineNumber = source.slice(0, match.index).split("\n").length;
    const napiAttributes = [...body.matchAll(/#\[napi(?:\([^\n]*\))?\]/g)].map((entry) => entry[0]);
    if (napiAttributes.length > 0 && !napiWrapperMacros.has(name)) {
      throw new Error(`${sourceLabel}:${lineNumber} defines an unaudited N-API-generating macro ${match[1]}.`);
    }
    if (napiWrapperMacros.has(name)) {
      if (
        napiAttributes.length !== 1 ||
        napiAttributes[0] !== "#[napi(js_name = $js_name)]" ||
        !/\(\$js_name:literal,/.test(body) ||
        !/^\s*pub fn \$fn_name\b/m.test(body)
      ) {
        throw new Error(`${sourceLabel}:${lineNumber} changed the audited N-API template for ${name}.`);
      }
      validated.add(name);
    }
  }
  return validated;
}

function assertAuditedTopLevelMacroInvocations(source, sourceLabel) {
  const invocation = /^([A-Za-z_][A-Za-z0-9_]*)!\s*[({\[]/gm;
  for (const match of source.matchAll(invocation)) {
    if (!auditedTopLevelMacros.has(match[1])) {
      const lineNumber = source.slice(0, match.index).split("\n").length;
      throw new Error(`${sourceLabel}:${lineNumber} invokes an unaudited top-level macro ${match[1]}.`);
    }
  }
}

function findNextRustItem(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === "" || /^#\[.*\]$/.test(line)) {
      continue;
    }
    return { line, lineNumber: index + 1 };
  }
  return undefined;
}

function isRustFunctionItem(line) {
  return /^(?:pub(?:\([^)]*\))?\s+)?(?:(?:async|const|unsafe)\s+)*(?:extern\s+"[^"]+"\s+)?fn\b/.test(line);
}

function isKnownNonFunctionNapiItem(line) {
  return /^(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum)\b/.test(line) || /^impl\b/.test(line);
}

function stripRustComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/\/\/.*$/gm, "");
}

function assertNapiExportScannerSelfTest() {
  const parsed = readNapiExportNamesFromSource(
    [
      '// #[napi(js_name = "commentedDirect")]',
      "// game_server_inventory_wrapper!(\"commentedWrapper\", ignored);",
      "/*",
      '#[napi(js_name = "blockCommentedDirect")]',
      "game_server_networking_sockets_wrapper!(\"blockCommentedWrapper\", ignored);",
      "*/",
      '#[napi(js_name = "alpha")]',
      "pub fn alpha() {}",
      "macro_rules! game_server_inventory_wrapper {",
      "    ($js_name:literal, $fn_name:ident, $ignored:ident) => {",
      "        #[napi(js_name = $js_name)]",
      "        pub fn $fn_name() {}",
      "    };",
      "}",
      "game_server_inventory_wrapper!(",
      '    "beta",',
      "    ignored",
      ");",
      "#[napi(object)]",
      "pub struct Shape {}",
      "#[napi]",
      "impl Shape {",
      "    #[napi]",
      "    pub fn nested(&self) {}",
      "}",
      ""
    ].join("\n"),
    "self-test.rs"
  );
  assert.deepEqual(parsed, ["alpha", "beta"]);
  assert.throws(
    () => readNapiExportNamesFromSource("#[napi]\npub fn implicit() {}\n", "implicit.rs"),
    /exactly one ASCII js_name/
  );
  assert.throws(
    () =>
      readNapiExportNamesFromSource(
        '#[napi(js_name = "extra", catch_unwind)]\npub fn extra() {}\n',
        "extra.rs"
      ),
    /exactly one ASCII js_name/
  );
  assert.throws(
    () => readNapiExportNamesFromSource("game_server_inventory_wrapper!(NAME, ignored);\n", "macro.rs"),
    /ASCII string-literal js_name/
  );
  assert.throws(
    () =>
      readNapiExportNamesFromSource(
        [
          "macro_rules! game_server_inventory_wrapper {",
          "    ($js_name:literal, $fn_name:ident, $ignored:ident) => {",
          "        pub fn $fn_name() {}",
          "    };",
          "}",
          'game_server_inventory_wrapper!("missing", ignored, ignored);',
          ""
        ].join("\n"),
        "missing-template.rs"
      ),
    /changed the audited N-API template/
  );
  assert.throws(
    () =>
      readNapiExportNamesFromSource(
        [
          "macro_rules! hidden_export {",
          "    () => {",
          '        #[napi(js_name = "hidden")]',
          "        pub fn hidden() {}",
          "    };",
          "}",
          "hidden_export!();",
          ""
        ].join("\n"),
        "hidden.rs"
      ),
    /unaudited N-API-generating macro/
  );
}

function readNativeBindingMethodNames() {
  return readNativeBindingMethodNamesFromManifest(
    path.join(repoRoot, "packages", "steam-bridge", "src", "native.ts")
  );
}

function readSdkExportNames() {
  const headerFiles = fs.readdirSync(steamHeadersRoot)
    .filter((file) => file.endsWith(".h"))
    .map((file) => path.join(steamHeadersRoot, file));
  const names = [];

  for (const file of headerFiles) {
    const header = stripComments(fs.readFileSync(file, "utf8"));
    for (const match of header.matchAll(/\bS_API(?:_EXPORT)?\s+(?:[^;{}()]|\n)*?\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
      names.push(match[1]);
    }
  }

  return unique(names);
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/^\s*#.*$/gm, "");
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
