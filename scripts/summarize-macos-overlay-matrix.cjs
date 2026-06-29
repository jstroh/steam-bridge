#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const RESULT_PREFIX = "STEAM_BRIDGE_SMOKE_RESULT ";
const OPEN_AND_WAIT_ACTIONS = new Set([
  "presenter-web-open-and-wait",
  "presenter-store-open-and-wait",
  "presenter-dialog-auto-open-and-wait",
  "presenter-friends-open-and-wait"
]);
const PASSIVE_NOTIFICATION_ACTIONS = new Map([
  [
    "presenter-achievement-progress",
    {
      event: "achievement:progress",
      callbacks: ["callback:achievement-stored"]
    }
  ],
  [
    "presenter-achievement-unlock",
    {
      event: "achievement:unlock",
      callbacks: ["callback:user-stats-stored", "callback:achievement-stored"]
    }
  ]
]);

main();

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    printUsage(process.stderr);
    process.exit(2);
  }

  if (options.help) {
    printUsage(process.stdout);
    return;
  }

  if (options.selfTest) {
    runSelfTest();
    return;
  }

  if (!options.artifactRoot) {
    printUsage(process.stderr);
    process.exit(2);
  }

  summarizeMatrixArtifacts(options.artifactRoot);
}

function parseArgs(args) {
  const options = { artifactRoot: "" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--self-test":
        options.selfTest = true;
        break;
      case "--artifact-root":
        index += 1;
        if (!args[index]) {
          throw new Error("missing --artifact-root value");
        }
        options.artifactRoot = args[index];
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`unknown option: ${arg}`);
        }
        if (options.artifactRoot) {
          throw new Error(`unexpected argument: ${arg}`);
        }
        options.artifactRoot = arg;
        break;
    }
  }
  return options;
}

function printUsage(stream) {
  stream.write(`Usage:
  summarize-macos-overlay-matrix.cjs --artifact-root PATH
  summarize-macos-overlay-matrix.cjs --self-test

Audits a macOS overlay matrix artifact root for collected smoke results,
lifecycle close/park evidence, Steam overlay injection, managed Electron
zero-timing diagnostics, passive notification callbacks, and crash diagnostics.
`);
}

function summarizeMatrixArtifacts(root) {
  const failures = [];
  const summaries = [];
  const manifestPath = path.join(root, "macos-matrix-cases.jsonl");
  const manifest = readCaseManifest(manifestPath, failures);

  if (!fs.existsSync(root)) {
    failures.push(`missing artifact root: ${root}`);
  }
  if (!manifest.found) {
    failures.push(`missing macOS matrix manifest: ${manifestPath}`);
  }
  if (manifest.byCase.size === 0) {
    failures.push("macOS matrix manifest has no cases");
  }

  for (const metadata of manifest.byCase.values()) {
    const caseFailures = [];
    const caseId = metadata.caseId;
    const resultFile = metadata.resultFile;
    const diagnosticDir = metadata.diagnosticDir;

    if (!resultFile || typeof resultFile !== "string") {
      failures.push(`${caseId}: missing resultFile in manifest`);
      continue;
    }
    if (!diagnosticDir || typeof diagnosticDir !== "string") {
      failures.push(`${caseId}: missing diagnosticDir in manifest`);
      continue;
    }
    if (!fs.existsSync(resultFile)) {
      failures.push(`${caseId}: missing result log: ${resultFile}`);
      continue;
    }
    if (!fs.existsSync(diagnosticDir)) {
      failures.push(`${caseId}: missing diagnostic dir: ${diagnosticDir}`);
      continue;
    }

    let result;
    try {
      result = readSmokeResult(resultFile);
    } catch (error) {
      failures.push(`${caseId}: ${error.message}`);
      continue;
    }

    const lifecycle = readLifecycle(path.join(diagnosticDir, "lifecycle.jsonl"));
    const summary = verifyCase(caseId, metadata, result, lifecycle, caseFailures);
    summaries.push(summary);

    if (caseFailures.length > 0) {
      failures.push(...caseFailures);
    }
  }

  for (const summary of summaries) {
    console.log(
      [
        "MACOS_CASE",
        summary.caseId,
        `action=${summary.action}`,
        `activated=${summary.activated}`,
        `closed=${summary.closed}`,
        `parked=${summary.parked}`,
        `passive=${summary.passive}`,
        `overlayTargets=${summary.overlayTargets}`,
        `overlayGameIds=${summary.overlayGameIds.join(",") || "none"}`,
        `zeroTiming=${summary.zeroTiming}`,
        `openAndWait=${summary.openAndWait}`,
        `checkoutWait=${summary.checkoutWait}`,
        `crashOk=${summary.crashOk}`
      ].join(" ")
    );
  }

  if (failures.length > 0) {
    console.error("macOS overlay matrix summary failed:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log(`macOS overlay matrix summary passed: cases=${summaries.length}`);
  return { caseSummaries: summaries };
}

function verifyCase(caseId, metadata, result, lifecycle, failures) {
  const snapshot = objectOrEmpty(result.snapshot);
  const app = objectOrEmpty(snapshot.app);
  const processInfo = objectOrEmpty(snapshot.process);
  const launch = objectOrEmpty(snapshot.launch);
  const steam = objectOrEmpty(snapshot.steam);
  const crashDiagnostics = objectOrEmpty(snapshot.crashDiagnostics);
  const overlayProcesses = objectOrEmpty(snapshot.overlayProcesses);
  const overlay = objectOrEmpty(snapshot.overlay);
  const action = objectOrEmpty(result.action);
  const actionName = String(action.action || "unknown");
  const nativePresenter = readOkValue(overlay.nativePresenter);
  const electronOverlay = readElectronOverlay(nativePresenter);
  const lifecycleEntries = lifecycle.entries;
  const overlayTargets = countOverlayTargets(overlayProcesses);
  const overlayGameIds = collectOverlayGameIds(overlayProcesses);
  const passiveConfig = PASSIVE_NOTIFICATION_ACTIONS.get(actionName);
  const isPassive = Boolean(passiveConfig);
  const activated = lifecycleEntries.some(isLifecycleOverlayActiveEvent);
  const closed = hasInactiveAfterActive(lifecycleEntries);
  const parked = verifyLifecycleParking(caseId, lifecycleEntries, isPassive, failures);
  const zeroTiming = Boolean(
    electronOverlay &&
      electronOverlay.restoreFocusDelayMs === 0 &&
      electronOverlay.activationBoostMs === 0 &&
      electronOverlay.activeGraceMs === 0
  );
  const crashOk = crashDiagnostics.available === true && crashDiagnostics.ok === true;
  const openAndWait = verifyOpenAndWaitCompletion(caseId, actionName, lifecycleEntries, failures);
  const checkoutWait = verifyCheckoutOpenAndWait(caseId, actionName, lifecycleEntries, failures);

  expect(result.ok === true, `${caseId}: smoke result ok`, failures);
  expect(action.ok === true, `${caseId}: autorun action succeeded`, failures);
  if (metadata.action) {
    expect(
      metadata.action === actionName,
      `${caseId}: manifest action expected ${formatValue(actionName)}, got ${formatValue(metadata.action)}`,
      failures
    );
  }
  expect(app.appId === 480, `${caseId}: app ID is public test App ID 480`, failures);
  expect(processInfo.platform === "darwin", `${caseId}: platform is darwin`, failures);
  expect(processInfo.arch === "arm64", `${caseId}: arch is arm64`, failures);
  expect(launch.steamLaunch === true, `${caseId}: Steam launch detected`, failures);
  expect(launch.overlayInjection === true, `${caseId}: Steam overlay injection detected`, failures);
  const env = objectOrEmpty(launch.env);
  expect(env.SteamAppId === "480", `${caseId}: SteamAppId env is 480`, failures);
  expect(env.SteamGameId === "480", `${caseId}: SteamGameId env is 480`, failures);
  expect(env.SteamOverlayGameId === "480", `${caseId}: SteamOverlayGameId env is 480`, failures);
  expect(steam.initialized === true, `${caseId}: Steam initialized`, failures);
  expect(readOkValue(steam.running) === true, `${caseId}: Steam running`, failures);
  expect(readOkValue(steam.appId) === 480, `${caseId}: Steam app ID is 480`, failures);
  expect(readOkValue(steam.steamDeck) === false, `${caseId}: Steam Deck flag is false on macOS`, failures);
  expect(readOkValue(steam.bigPicture) === false, `${caseId}: Big Picture flag is false on macOS`, failures);
  expect(readOkValue(steam.overlayEnabled) === true, `${caseId}: Steam overlay enabled`, failures);
  expect(crashOk, `${caseId}: crash diagnostics are available and ok`, failures);
  expect(arrayLength(crashDiagnostics.crashDumps) === 0, `${caseId}: no crash dumps reported`, failures);
  expect(
    arrayLength(crashDiagnostics.fatalLifecycleEvents) === 0,
    `${caseId}: no fatal lifecycle events reported`,
    failures
  );
  expect(lifecycle.found === true, `${caseId}: lifecycle log present`, failures);
  for (const error of lifecycle.errors) {
    failures.push(`${caseId}: ${error}`);
  }
  if (lifecycle.rawText.includes("Object has been destroyed")) {
    failures.push(`${caseId}: lifecycle log contains Object has been destroyed`);
  }

  expect(Boolean(nativePresenter), `${caseId}: native presenter snapshot available`, failures);
  if (nativePresenter) {
    expect(nativePresenter.backend === "macos-metal" || nativePresenter.backend === "macos-opengl", `${caseId}: macOS native presenter backend`, failures);
    expect(nativePresenter.attached === true, `${caseId}: native presenter attached`, failures);
    expect(nativePresenter.nativeHostOpen === true, `${caseId}: native presenter host open`, failures);
    expect(nativePresenter.idleFps === 0, `${caseId}: native presenter idle FPS is zero`, failures);
    expect(Boolean(electronOverlay), `${caseId}: managed Electron overlay diagnostics available`, failures);
  }
  if (electronOverlay) {
    expect(electronOverlay.presenterMode === "persistent", `${caseId}: presenter mode is persistent`, failures);
    expect(electronOverlay.autoPrepareForNotifications === true, `${caseId}: automatic notification priming enabled`, failures);
    expect(electronOverlay.restoreFocusDelayMs === 0, `${caseId}: restore focus delay is zero`, failures);
    expect(electronOverlay.activationBoostMs === 0, `${caseId}: activation boost is zero`, failures);
    expect(electronOverlay.activeGraceMs === 0, `${caseId}: active grace is zero`, failures);
  }

  expect(overlayProcesses.available === true, `${caseId}: overlay process diagnostics available`, failures);
  expect(overlayProcesses.platform === "darwin", `${caseId}: overlay process platform is darwin`, failures);
  expect(overlayTargets === 1, `${caseId}: exactly one gameoverlayui target`, failures);
  const requirePublicOverlayGameId = !isStoreOverlayAction(actionName);
  for (const target of Array.isArray(overlayProcesses.gameoverlayui) ? overlayProcesses.gameoverlayui : []) {
    expect(target.gameId != null, `${caseId}: gameoverlayui game ID is recorded`, failures);
    if (requirePublicOverlayGameId) {
      expect(String(target.gameId) === "480", `${caseId}: gameoverlayui game ID is public test App ID 480`, failures);
    }
    expect(Number(target.targetPid) === Number(processInfo.pid), `${caseId}: gameoverlayui targets the smoke process`, failures);
    if (requirePublicOverlayGameId && typeof target.command === "string" && target.command.length > 0) {
      expect(
        /\s-gameid\s+480(?:\s|$)/.test(target.command),
        `${caseId}: gameoverlayui command line uses -gameid 480`,
        failures
      );
    }
  }

  if (isPassive) {
    verifyPassiveNotification(caseId, lifecycleEntries, nativePresenter, passiveConfig, failures);
  } else {
    expect(activated, `${caseId}: overlay active callback observed`, failures);
    expect(closed, `${caseId}: overlay inactive callback observed after active`, failures);
    verifyOverlayCallbackAppIds(caseId, lifecycleEntries, 480, failures);
    expect(parked, `${caseId}: presenter parked after overlay close`, failures);
  }

  if (actionName === "presenter-shortcut") {
    expect(
      lifecycleEntries.some((entry) => entry.type === "event:overlay:shortcut-open"),
      `${caseId}: managed shortcut open event recorded`,
      failures
    );
    if (electronOverlay) {
      const shortcut = objectOrEmpty(electronOverlay.overlayShortcut);
      expect(shortcut.enabled === true, `${caseId}: overlay shortcut enabled`, failures);
      expect(shortcut.targetType === "friends", `${caseId}: overlay shortcut target is friends`, failures);
    }
  }

  return {
    caseId,
    action: actionName,
    activated,
    closed,
    parked,
    passive: isPassive,
    overlayTargets,
    overlayGameIds,
    zeroTiming,
    openAndWait: openAndWait.required ? openAndWait.ok : "n/a",
    checkoutWait: checkoutWait.required ? checkoutWait.ok : "n/a",
    crashOk
  };
}

function isStoreOverlayAction(actionName) {
  return actionName === "presenter-store" || actionName === "presenter-store-open-and-wait";
}

function collectOverlayGameIds(overlayProcesses) {
  if (!Array.isArray(overlayProcesses.gameoverlayui)) {
    return [];
  }
  return [...new Set(overlayProcesses.gameoverlayui.map((target) => String(target.gameId ?? "unknown")))];
}

function verifyOpenAndWaitCompletion(caseId, actionName, entries, failures) {
  if (!OPEN_AND_WAIT_ACTIONS.has(actionName)) {
    return { required: false, ok: true };
  }

  const failuresBefore = failures.length;
  const start = entries.find((entry) => entry.type === "event:overlay:presenter-open-and-wait-start");
  if (!start) {
    failures.push(`${caseId}: missing overlay:presenter-open-and-wait-start`);
  }

  const inactiveIndex = entries.findIndex(isLifecycleOverlayInactiveEvent);
  if (inactiveIndex === -1) {
    failures.push(`${caseId}: openAndWait did not record active=false before completion`);
    return { required: true, ok: false };
  }

  const complete = entries.find(
    (entry, index) => index > inactiveIndex && entry.type === "event:overlay:presenter-open-and-wait-complete"
  );
  if (!complete) {
    failures.push(`${caseId}: missing overlay:presenter-open-and-wait-complete after active=false`);
    return { required: true, ok: false };
  }

  const payload = objectOrEmpty(complete.payload);
  const shown = objectField(payload, "shown");
  const parked = objectField(payload, "parked");
  if (!shown) {
    failures.push(`${caseId}: openAndWait completion did not include shown presenter snapshot`);
  } else if (shown.overlayActive !== true) {
    failures.push(`${caseId}: openAndWait shown snapshot did not report overlayActive=true`);
  }
  if (!parked) {
    failures.push(`${caseId}: openAndWait completion did not include parked presenter snapshot`);
  } else {
    expectParkedPresenter(caseId, parked, "openAndWait completion", failures);
  }

  return { required: true, ok: failures.length === failuresBefore };
}

function verifyCheckoutOpenAndWait(caseId, actionName, entries, failures) {
  if (actionName !== "presenter-checkout") {
    return { required: false, ok: true };
  }

  const open = entries.find((entry) => {
    const payload = objectOrEmpty(entry.payload);
    return entry.type === "event:overlay:presenter-open" && payload.target === "checkout";
  });
  if (!open) {
    failures.push(`${caseId}: missing checkout overlay:presenter-open event`);
    return { required: true, ok: false };
  }

  const failuresBefore = failures.length;
  const openPayload = objectOrEmpty(open.payload);
  if (openPayload.api !== "openCheckoutAndWait") {
    failures.push(`${caseId}: checkout presenter-open did not use openCheckoutAndWait`);
  }

  const inactiveIndex = entries.findIndex(isLifecycleOverlayInactiveEvent);
  if (inactiveIndex === -1) {
    failures.push(`${caseId}: checkout openAndWait did not record active=false before completion`);
    return { required: true, ok: false };
  }

  const complete = entries.find(
    (entry, index) => index > inactiveIndex && entry.type === "event:overlay:presenter-checkout-open-and-wait-complete"
  );
  if (!complete) {
    failures.push(`${caseId}: missing overlay:presenter-checkout-open-and-wait-complete after active=false`);
    return { required: true, ok: false };
  }

  const payload = objectOrEmpty(complete.payload);
  const shown = objectField(payload, "shown");
  const parked = objectField(payload, "parked");
  if (!shown) {
    failures.push(`${caseId}: checkout completion did not include shown presenter snapshot`);
  } else if (shown.overlayActive !== true) {
    failures.push(`${caseId}: checkout shown snapshot did not report overlayActive=true`);
  }
  if (!parked) {
    failures.push(`${caseId}: checkout completion did not include parked presenter snapshot`);
  } else {
    expectParkedPresenter(caseId, parked, "checkout openAndWait completion", failures);
  }

  return { required: true, ok: failures.length === failuresBefore };
}

function verifyPassiveNotification(caseId, entries, presenter, config, failures) {
  expect(!entries.some(isLifecycleOverlayActiveEvent), `${caseId}: passive notification did not activate modal overlay`, failures);
  expect(
    entries.some((entry) => entry.type === `event:${config.event}`),
    `${caseId}: passive notification event ${config.event} recorded`,
    failures
  );
  for (const callback of config.callbacks) {
    expect(
      entries.some((entry) => entry.type === `event:${callback}`),
      `${caseId}: passive notification callback ${callback} recorded`,
      failures
    );
  }
  if (presenter) {
    expectParkedPresenter(caseId, presenter, "passive notification snapshot", failures);
    expect(presenter.overlayWasActive === false, `${caseId}: passive notification overlay was not modal active`, failures);
  }
}

function verifyOverlayCallbackAppIds(caseId, entries, expectedAppId, failures) {
  for (const entry of entries.filter((item) => item && item.type === "event:callback:overlay-activated")) {
    const appId = overlayEventAppId(entry);
    if (appId !== expectedAppId) {
      failures.push(
        `${caseId}: overlay callback app ID expected ${formatValue(expectedAppId)}, got ${formatValue(appId)}`
      );
    }
  }
}

function verifyLifecycleParking(caseId, entries, isPassive, failures) {
  if (isPassive) {
    return true;
  }

  const firstActiveIndex = entries.findIndex(isLifecycleOverlayActiveEvent);
  if (firstActiveIndex === -1) {
    return false;
  }
  const inactiveAfterActiveIndex = entries.findIndex(
    (entry, index) => index > firstActiveIndex && isLifecycleOverlayInactiveEvent(entry)
  );
  if (inactiveAfterActiveIndex === -1) {
    return false;
  }

  const afterClose = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(({ entry, index }) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-after-close");
  const stable = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(
      ({ entry, index }) =>
        index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-after-close-stable"
    );
  const parked = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(({ entry, index }) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-parked");
  const firstPresenter = afterClose.filter(({ presenter }) => presenter).at(-1)?.presenter;
  const stablePresenter = stable.filter(({ presenter }) => presenter).at(-1)?.presenter;
  const parkedPresenter = parked.filter(({ presenter }) => presenter).at(-1)?.presenter;

  expect(afterClose.length > 0, `${caseId}: after-close presenter event recorded`, failures);
  expect(stable.length > 0, `${caseId}: stable after-close presenter event recorded`, failures);
  expect(parked.length > 0, `${caseId}: presenter parked event recorded`, failures);
  if (!firstPresenter || !stablePresenter || !parkedPresenter) {
    return false;
  }

  expectParkedPresenter(caseId, firstPresenter, "first close sample", failures);
  expectParkedPresenter(caseId, stablePresenter, "stable close sample", failures);
  expectParkedPresenter(caseId, parkedPresenter, "parked sample", failures);

  if (firstPresenter.pumpCount !== stablePresenter.pumpCount) {
    failures.push(
      `${caseId}: native presenter pump count changed after close: first=${formatValue(firstPresenter.pumpCount)} stable=${formatValue(stablePresenter.pumpCount)}`
    );
  }

  return true;
}

function expectParkedPresenter(caseId, presenter, label, failures) {
  expectPresenterField(caseId, presenter, "closed", false, `native presenter closed ${label}`, failures);
  expectPresenterField(caseId, presenter, "attached", true, `native presenter attached ${label}`, failures);
  expectPresenterField(caseId, presenter, "nativeHostOpen", true, `native presenter host open ${label}`, failures);
  expectPresenterField(caseId, presenter, "mode", "passive", `native presenter mode ${label}`, failures);
  expectPresenterField(caseId, presenter, "clickThrough", true, `native presenter click-through ${label}`, failures);
  expectPresenterField(caseId, presenter, "focusable", false, `native presenter focusable ${label}`, failures);
  expectPresenterField(caseId, presenter, "transparent", true, `native presenter transparent ${label}`, failures);
  expectPresenterField(caseId, presenter, "overlayActive", false, `native presenter overlay active ${label}`, failures);
  expectPresenterField(caseId, presenter, "idleFps", 0, `native presenter idle FPS ${label}`, failures);
  expectPresenterField(caseId, presenter, "currentFps", 0, `native presenter current FPS ${label}`, failures);
  expectPresenterField(caseId, presenter, "overlayNeedsPresent", false, `native presenter overlay needs present ${label}`, failures);
}

function expectPresenterField(caseId, presenter, key, expected, label, failures) {
  if (presenter[key] !== expected) {
    failures.push(`${caseId}: ${label} expected ${formatValue(expected)}, got ${formatValue(presenter[key])}`);
  }
}

function runSelfTest() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-matrix-summary."));
  try {
    createSelfTestFixture(fixtureRoot);
    const summary = summarizeMatrixArtifacts(fixtureRoot);
    assert.equal(summary.caseSummaries.length, 5, "summary self-test should include five cases");
    console.log("macOS overlay matrix summary self-test passed.");
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function createSelfTestFixture(root) {
  fs.mkdirSync(root, { recursive: true });

  const baseResult = {
    ok: true,
    action: { ok: true, action: "presenter-web-open-and-wait" },
    snapshot: {
      app: { appId: 480 },
      process: { pid: 4242, platform: "darwin", arch: "arm64" },
      launch: {
        steamLaunch: true,
        overlayInjection: true,
        env: { SteamAppId: "480", SteamGameId: "480", SteamOverlayGameId: "480" }
      },
      crashDiagnostics: { available: true, ok: true, crashDumps: [], fatalLifecycleEvents: [] },
      overlayProcesses: {
        available: true,
        platform: "darwin",
        gameoverlayui: [{ pid: 9001, targetPid: 4242, gameId: "480" }]
      },
      steam: {
        initialized: true,
        running: { ok: true, value: true },
        appId: { ok: true, value: 480 },
        steamDeck: { ok: true, value: false },
        bigPicture: { ok: true, value: false },
        overlayEnabled: { ok: true, value: true }
      },
      overlay: {
        nativePresenter: { ok: true, value: activePresenterFixture(10) }
      }
    }
  };

  const cases = [
    {
      caseId: "01-web-openwait",
      action: "presenter-web-open-and-wait",
      resultPresenter: activePresenterFixture(10),
      lifecycle: [
        { type: "event:overlay:presenter-open-and-wait-start", payload: { presenter: activePresenterFixture(10) } },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(11) } },
        { type: "event:callback:overlay-activated", payload: { active: false, appId: 480 } },
        { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(12) } },
        { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(12) } },
        {
          type: "event:overlay:presenter-open-and-wait-complete",
          payload: { shown: activePresenterFixture(11), parked: parkedPresenterFixture(12) }
        },
        { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(12) } }
      ]
    },
    {
      caseId: "02-passive-toast",
      action: "presenter-achievement-progress",
      resultPresenter: parkedPresenterFixture(2),
      lifecycle: [
        { type: "event:achievement:progress", payload: { indicated: true } },
        { type: "event:callback:achievement-stored", payload: { achievement: "ACH_TEST" } }
      ]
    },
    {
      caseId: "03-store-openwait",
      action: "presenter-store-open-and-wait",
      overlayGameId: "15338446133907161088",
      resultPresenter: activePresenterFixture(14),
      lifecycle: [
        { type: "event:overlay:presenter-open-and-wait-start", payload: { presenter: activePresenterFixture(14) } },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(15) } },
        { type: "event:callback:overlay-activated", payload: { active: false, appId: 480 } },
        { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(16) } },
        { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(16) } },
        {
          type: "event:overlay:presenter-open-and-wait-complete",
          payload: { shown: activePresenterFixture(15), parked: parkedPresenterFixture(16) }
        },
        { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(16) } }
      ]
    },
    {
      caseId: "04-shortcut-friends",
      action: "presenter-shortcut",
      resultPresenter: parkedPresenterFixture(1),
      lifecycle: [
        { type: "event:overlay:shortcut-open", payload: { target: "friends" } },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(20) } },
        { type: "event:callback:overlay-activated", payload: { active: false, appId: 480 } },
        { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(21) } },
        { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(21) } },
        { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(21) } }
      ]
    },
    {
      caseId: "05-checkout",
      action: "presenter-checkout",
      resultPresenter: activePresenterFixture(30),
      lifecycle: [
        {
          type: "event:overlay:presenter-open",
          payload: { target: "checkout", api: "openCheckoutAndWait", presenter: activePresenterFixture(30) }
        },
        { type: "event:callback:overlay-activated", payload: { active: true, appId: 480 } },
        { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(31) } },
        { type: "event:callback:overlay-activated", payload: { active: false, appId: 480 } },
        { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(32) } },
        { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(32) } },
        {
          type: "event:overlay:presenter-checkout-open-and-wait-complete",
          payload: { shown: activePresenterFixture(31), parked: parkedPresenterFixture(32) }
        },
        { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(32) } }
      ]
    }
  ];

  const manifest = [];
  for (const fixture of cases) {
    const resultFile = path.join(root, `${fixture.caseId}.log`);
    const diagnosticDir = path.join(root, `${fixture.caseId}.log.diagnostics`);
    const result = JSON.parse(JSON.stringify(baseResult));
    result.action.action = fixture.action;
    result.snapshot.overlay.nativePresenter.value = fixture.resultPresenter;
    const overlayGameId = fixture.overlayGameId || "480";
    result.snapshot.overlayProcesses.gameoverlayui[0].gameId = overlayGameId;
    result.snapshot.overlayProcesses.gameoverlayui[0].command = `gameoverlayui -pid 4242 -gameid ${overlayGameId}`;
    fs.mkdirSync(diagnosticDir, { recursive: true });
    fs.writeFileSync(resultFile, `${RESULT_PREFIX}${JSON.stringify(result)}\n`);
    fs.writeFileSync(
      path.join(diagnosticDir, "lifecycle.jsonl"),
      fixture.lifecycle.map((entry) => JSON.stringify(entry)).join("\n") + "\n"
    );
    manifest.push({
      caseId: fixture.caseId,
      resultFile,
      diagnosticDir,
      action: fixture.action
    });
  }

  fs.writeFileSync(path.join(root, "macos-matrix-cases.jsonl"), manifest.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

function activePresenterFixture(pumpCount) {
  return {
    ...parkedPresenterFixture(pumpCount),
    mode: "active",
    clickThrough: false,
    transparent: false,
    currentFps: 30,
    overlayActive: true,
    overlayWasActive: true
  };
}

function parkedPresenterFixture(pumpCount) {
  return {
    title: "Steam Bridge Overlay Presenter",
    backend: "macos-metal",
    closed: false,
    mode: "passive",
    attached: true,
    nativeProbeOpen: false,
    nativeHostOpen: true,
    clickThrough: true,
    focusable: false,
    transparent: true,
    idleFps: 0,
    needsPresentFps: 30,
    activeOverlayFps: 30,
    currentFps: 0,
    pumpCount,
    overlayActive: false,
    overlayWasActive: false,
    overlayNeedsPresent: false,
    electronOverlay: {
      presenterMode: "persistent",
      closeWithWindow: true,
      autoPrepareForNotifications: true,
      restoreFocusDelayMs: 0,
      activationBoostMs: 0,
      activeGraceMs: 0,
      overlayShortcut: {
        enabled: true,
        preventDefault: true,
        targetType: "friends",
        target: { type: "friends" }
      }
    }
  };
}

function readSmokeResult(file) {
  const text = fs.readFileSync(file, "utf8");
  const line = text
    .split(/\r?\n/)
    .reverse()
    .find((entry) => entry.startsWith(RESULT_PREFIX));
  if (!line) {
    throw new Error(`missing ${RESULT_PREFIX.trim()} line in ${file}`);
  }
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

function readCaseManifest(file, failures) {
  const byCase = new Map();
  if (!fs.existsSync(file)) {
    return { found: false, byCase };
  }

  const text = fs.readFileSync(file, "utf8");
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      continue;
    }
    let metadata;
    try {
      metadata = JSON.parse(line);
    } catch (error) {
      failures.push(`invalid macOS matrix manifest JSON in ${file}:${index + 1}: ${error.message}`);
      continue;
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      failures.push(`invalid macOS matrix manifest entry in ${file}:${index + 1}`);
      continue;
    }
    if (!metadata.caseId || typeof metadata.caseId !== "string") {
      failures.push(`macOS matrix manifest entry missing caseId in ${file}:${index + 1}`);
      continue;
    }
    if (byCase.has(metadata.caseId)) {
      failures.push(`duplicate macOS matrix manifest entry for ${metadata.caseId}`);
      continue;
    }
    byCase.set(metadata.caseId, metadata);
  }

  return { found: true, byCase };
}

function readLifecycle(file) {
  if (!fs.existsSync(file)) {
    return { found: false, rawText: "", entries: [], errors: [] };
  }

  const errors = [];
  const entries = [];
  const rawText = fs.readFileSync(file, "utf8");
  for (const [index, line] of rawText.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      continue;
    }
    try {
      entries.push(JSON.parse(line));
    } catch (error) {
      errors.push(`invalid lifecycle JSON in ${file}:${index + 1}: ${error.message}`);
    }
  }

  return { found: true, rawText, entries, errors };
}

function readElectronOverlay(presenter) {
  if (!presenter || typeof presenter !== "object" || Array.isArray(presenter)) {
    return undefined;
  }
  return presenter.electronOverlay && typeof presenter.electronOverlay === "object" && !Array.isArray(presenter.electronOverlay)
    ? presenter.electronOverlay
    : undefined;
}

function presenterPayload(entry) {
  const payload = entry && typeof entry.payload === "object" && !Array.isArray(entry.payload) ? entry.payload : {};
  return payload.presenter && typeof payload.presenter === "object" && !Array.isArray(payload.presenter)
    ? payload.presenter
    : undefined;
}

function hasInactiveAfterActive(entries) {
  const firstActiveIndex = entries.findIndex(isLifecycleOverlayActiveEvent);
  return (
    firstActiveIndex !== -1 &&
    entries.some((entry, index) => index > firstActiveIndex && isLifecycleOverlayInactiveEvent(entry))
  );
}

function isLifecycleOverlayActiveEvent(event) {
  return event && event.type === "event:callback:overlay-activated" && overlayEventState(event) === true;
}

function isLifecycleOverlayInactiveEvent(event) {
  return event && event.type === "event:callback:overlay-activated" && overlayEventState(event) === false;
}

function overlayEventState(event) {
  if (!event) {
    return undefined;
  }
  const payload = event.payload;
  if (payload === true || payload === 1) {
    return true;
  }
  if (payload === false || payload === 0) {
    return false;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const activePayload = payload["0"] && typeof payload["0"] === "object" ? payload["0"] : payload;
  for (const key of ["active", "m_bActive"]) {
    if (activePayload[key] === true || activePayload[key] === 1) {
      return true;
    }
    if (activePayload[key] === false || activePayload[key] === 0) {
      return false;
    }
  }
  return undefined;
}

function overlayEventAppId(event) {
  if (!event) {
    return undefined;
  }
  const payload = event.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const activePayload = payload["0"] && typeof payload["0"] === "object" ? payload["0"] : payload;
  for (const key of ["appId", "app_id", "m_nAppID"]) {
    if (activePayload[key] != null) {
      return Number(activePayload[key]);
    }
  }
  return undefined;
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function objectField(value, key) {
  const object = objectOrEmpty(value);
  return object[key] && typeof object[key] === "object" && !Array.isArray(object[key]) ? object[key] : undefined;
}

function readOkValue(entry) {
  return entry && entry.ok === true ? entry.value : undefined;
}

function countOverlayTargets(overlayProcesses) {
  const gameoverlayui = Array.isArray(overlayProcesses.gameoverlayui) ? overlayProcesses.gameoverlayui : [];
  return gameoverlayui.filter((entry) => entry && entry.targetPid != null).length;
}

function arrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function expect(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function formatValue(value) {
  return JSON.stringify(value);
}
