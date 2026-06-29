#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const RESULT_PREFIX = "STEAM_BRIDGE_SMOKE_RESULT ";
const FATAL_LIFECYCLE_EVENT_TYPES = new Set([
  "app:render-process-gone",
  "app:child-process-gone",
  "app:gpu-process-crashed",
  "process:uncaught-exception",
  "process:unhandled-rejection"
]);
const MANAGED_LIFECYCLE_ACTIONS = new Set([
  "presenter-web",
  "presenter-store",
  "presenter-friends",
  "presenter-profile",
  "presenter-players",
  "presenter-dialog-auto",
  "presenter-community",
  "presenter-stats",
  "presenter-achievements",
  "presenter-user",
  "presenter-shortcut"
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
  summarize-steam-deck-overlay-matrix.cjs --artifact-root PATH
  summarize-steam-deck-overlay-matrix.cjs --self-test

Audits a Steam Deck overlay matrix artifact root for collected smoke results,
lifecycle failures, crash diagnostics, duplicate overlay targets, and screenshot
counts.
`);
}

function summarizeMatrixArtifacts(root) {
  const diagnosticsRoot = path.join(root, "diagnostics");
  const screenshotsRoot = path.join(root, "screens");
  const failures = [];
  const caseSummaries = [];
  const caseManifest = readCaseManifest(path.join(root, "matrix-cases.jsonl"), failures);

  if (!fs.existsSync(root)) {
    failures.push(`missing artifact root: ${root}`);
  }
  if (!fs.existsSync(diagnosticsRoot)) {
    failures.push(`missing diagnostics directory: ${diagnosticsRoot}`);
  }

  const caseNames = fs.existsSync(diagnosticsRoot)
    ? fs
        .readdirSync(diagnosticsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

  if (caseNames.length === 0) {
    failures.push(`no case diagnostics found under ${diagnosticsRoot}`);
  }

  for (const caseName of caseNames) {
    const caseDir = path.join(diagnosticsRoot, caseName);
    const resultLog = findResultLog(caseDir, failures);
    if (!resultLog) {
      failures.push(`${caseName}: missing collected result log`);
      continue;
    }

    let result;
    try {
      result = readSmokeResult(resultLog);
    } catch (error) {
      failures.push(`${caseName}: ${error.message}`);
      continue;
    }

    const snapshot = objectOrEmpty(result.snapshot);
    const steam = objectOrEmpty(snapshot.steam);
    const app = objectOrEmpty(snapshot.app);
    const processInfo = objectOrEmpty(snapshot.process);
    const crashDiagnostics = objectOrEmpty(snapshot.crashDiagnostics);
    const overlay = objectOrEmpty(snapshot.overlay);
    const overlayProcesses = objectOrEmpty(snapshot.overlayProcesses);
    const events = Array.isArray(snapshot.events) ? snapshot.events : [];
    const action = objectOrEmpty(result.action);
    const caseMetadata = caseManifest.byCase.get(caseName);
    const nativePresenter = readOkValue(overlay.nativePresenter);
    const overlayTargetCount = countOverlayTargets(overlayProcesses);
    const overlayActivated = events.some(isOverlayActiveEvent);
    const resultFailures = [];

    expect(result.ok === true, `${caseName}: smoke result ok`, resultFailures);
    expect(action.ok === true, `${caseName}: autorun action succeeded`, resultFailures);
    expect(steam.initialized === true, `${caseName}: Steam initialized`, resultFailures);
    expect(readOkValue(steam.running) === true, `${caseName}: Steam running`, resultFailures);
    expect(readOkValue(steam.appId) === app.appId, `${caseName}: Steam App ID matches app config`, resultFailures);
    expect(processInfo.platform === "linux", `${caseName}: platform is linux`, resultFailures);
    expect(processInfo.arch === "x64", `${caseName}: arch is x64`, resultFailures);

    const crashDumps = Array.isArray(crashDiagnostics.crashDumps) ? crashDiagnostics.crashDumps : [];
    const fatalLifecycleEvents = Array.isArray(crashDiagnostics.fatalLifecycleEvents)
      ? crashDiagnostics.fatalLifecycleEvents
      : [];
    expect(crashDiagnostics.available === true, `${caseName}: crash diagnostics available`, resultFailures);
    expect(crashDiagnostics.ok === true, `${caseName}: no crash diagnostics reported`, resultFailures);
    expect(crashDumps.length === 0, `${caseName}: no crash dumps found`, resultFailures);
    expect(
      fatalLifecycleEvents.length === 0,
      `${caseName}: no fatal lifecycle events in result snapshot`,
      resultFailures
    );

    if (String(action.action || "").startsWith("presenter-")) {
      expect(Boolean(nativePresenter), `${caseName}: native presenter snapshot available`, resultFailures);
    }
    if (nativePresenter && typeof nativePresenter === "object") {
      expect(nativePresenter.attached === true, `${caseName}: native presenter attached`, resultFailures);
      expect(nativePresenter.nativeHostOpen === true, `${caseName}: native presenter host open`, resultFailures);
    }
    if (String(action.action || "").startsWith("presenter-")) {
      const electronOverlay = readElectronOverlay(nativePresenter);
      expect(Boolean(electronOverlay), `${caseName}: managed Electron overlay diagnostics available`, resultFailures);
      if (electronOverlay) {
        expect(
          electronOverlay.autoPrepareForNotifications === true,
          `${caseName}: managed Electron overlay automatic notification priming is enabled`,
          resultFailures
        );
      }
    }
    if (overlayTargetCount > 1) {
      resultFailures.push(`${caseName}: duplicate gameoverlayui targets detected (${overlayTargetCount})`);
    }
    verifyCaseMetadata(caseName, caseManifest, action, resultFailures);

    const lifecycle = readLifecycle(caseDir);
    if (!lifecycle.found) {
      resultFailures.push(`${caseName}: missing lifecycle.jsonl`);
    }
    for (const error of lifecycle.errors) {
      resultFailures.push(`${caseName}: ${error}`);
    }
    if (lifecycle.rawText.includes("Object has been destroyed")) {
      resultFailures.push(`${caseName}: lifecycle log contains Object has been destroyed`);
    }
    const lifecycleFatalEvents = lifecycle.entries.filter(
      (entry) => entry && FATAL_LIFECYCLE_EVENT_TYPES.has(entry.type)
    );
    if (lifecycleFatalEvents.length > 0) {
      resultFailures.push(
        `${caseName}: fatal lifecycle events recorded (${lifecycleFatalEvents.map((entry) => entry.type).join(", ")})`
      );
    }
    const passiveNotification = verifyPassiveNotificationAction(
      caseName,
      action.action,
      events,
      lifecycle.entries,
      nativePresenter,
      overlayTargetCount,
      resultFailures
    );
    const parking = verifyLifecycleParking(caseName, lifecycle.entries, resultFailures);
    const managedWaits = verifyManagedLifecycleWaits(caseName, action.action, lifecycle.entries, resultFailures);
    const checkoutWait = verifyCheckoutOpenAndWait(caseName, action.action, lifecycle.entries, resultFailures);

    failures.push(...resultFailures);
    caseSummaries.push({
      caseName,
      action: action.action || "unknown",
      resultOk: result.ok === true,
      actionOk: action.ok === true,
      overlayActivated,
      lifecycleActivated: lifecycle.entries.some(isLifecycleOverlayActiveEvent),
      lifecycleInactive: lifecycle.entries.some(isLifecycleOverlayInactiveEvent),
      presenterMode:
        nativePresenter && typeof nativePresenter === "object" ? nativePresenter.mode || "unknown" : "missing",
      presenterFps:
        nativePresenter && typeof nativePresenter === "object" && nativePresenter.currentFps != null
          ? nativePresenter.currentFps
          : "n/a",
      closeInput: caseMetadata?.visualCloseInput || "n/a",
      toggleInput: caseMetadata?.visualToggleInput || "n/a",
      passiveToast: passiveNotification.required ? passiveNotification.ok : "n/a",
      parked: parking.required ? parking.ok : "n/a",
      managedWaits: managedWaits.required ? managedWaits.ok : "n/a",
      checkoutWait: checkoutWait.required ? checkoutWait.ok : "n/a",
      crashOk: crashDiagnostics.ok === true,
      overlayTargets: overlayTargetCount,
      screenshots: countScreenshots(path.join(screenshotsRoot, caseName))
    });
  }

  console.log("Steam Deck overlay matrix artifact summary:");
  for (const item of caseSummaries) {
    console.log(
      [
        `  ${item.caseName}:`,
        `action=${item.action}`,
        `ok=${item.resultOk && item.actionOk}`,
        `overlayActive=${item.overlayActivated || item.lifecycleActivated}`,
        `overlayInactive=${item.lifecycleInactive}`,
        `presenter=${item.presenterMode}`,
        `fps=${item.presenterFps}`,
        `closeInput=${item.closeInput}`,
        `toggleInput=${item.toggleInput}`,
        `passiveToast=${item.passiveToast}`,
        `parked=${item.parked}`,
        `managedWaits=${item.managedWaits}`,
        `checkoutWait=${item.checkoutWait}`,
        `overlayTargets=${item.overlayTargets}`,
        `crashOk=${item.crashOk}`,
        `screenshots=${item.screenshots}`
      ].join(" ")
    );
  }

  const totalScreenshots = caseSummaries.reduce((sum, item) => sum + item.screenshots, 0);

  if (failures.length > 0) {
    console.error("Steam Deck overlay matrix summary failed:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Steam Deck overlay matrix summary passed: cases=${caseSummaries.length} screenshots=${totalScreenshots}`);
  return { caseSummaries, totalScreenshots };
}

function runSelfTest() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-deck-matrix-summary."));
  try {
    createSelfTestFixture(fixtureRoot);
    const summary = summarizeMatrixArtifacts(fixtureRoot);
    assert(summary.caseSummaries.length === 5, "summary self-test should include five cases");
    assert(summary.totalScreenshots === 8, "summary self-test should count eight screenshots");
    console.log("Steam Deck overlay matrix summary self-test passed.");
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function createSelfTestFixture(root) {
  const caseId = "01-web-modal";
  const diagnosticsDir = path.join(root, "diagnostics", caseId);
  const runDiagnosticsDir = path.join(diagnosticsDir, "steam-bridge-smoke-matrix-01-web-modal.log.diagnostics");
  const screensDir = path.join(root, "screens", caseId);

  fs.mkdirSync(runDiagnosticsDir, { recursive: true });
  fs.mkdirSync(screensDir, { recursive: true });

  const result = {
    ok: true,
    action: { ok: true, action: "presenter-web" },
    snapshot: {
      app: { appId: 480 },
      process: { pid: 4242, platform: "linux", arch: "x64" },
      launch: { steamLaunch: true, overlayInjection: true },
      crashDiagnostics: { available: true, ok: true, crashDumps: [], fatalLifecycleEvents: [] },
      overlayProcesses: {
        available: true,
        gameoverlayui: [{ pid: 9001, targetPid: 4242, gameId: "480" }]
      },
      overlay: {
        nativePresenter: {
          ok: true,
          value: parkedPresenterFixture(0)
        }
      },
      steam: {
        initialized: true,
        running: { ok: true, value: true },
        appId: { ok: true, value: 480 },
        overlayEnabled: { ok: true, value: true }
      },
      events: [{ type: "callback:overlay-activated", payload: { active: true } }]
    }
  };

  fs.writeFileSync(
    path.join(diagnosticsDir, "steam-bridge-smoke-matrix-01-web-modal.log"),
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(result)}\n`
  );
  fs.writeFileSync(
    path.join(runDiagnosticsDir, "lifecycle.jsonl"),
    [
      { type: "event:callback:overlay-activated", payload: { active: true } },
      { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(8) } },
      { type: "event:callback:overlay-activated", payload: { active: false } },
      { type: "event:overlay:presenter-wait-closed", payload: { presenter: parkedPresenterFixture(7) } },
      { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(7) } },
      { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(7) } },
      { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(7) } }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n") + "\n"
  );
  fs.writeFileSync(path.join(screensDir, "after-open.png"), "");

  const shortcutCaseId = "02-shortcut-friends";
  const shortcutDiagnosticsDir = path.join(root, "diagnostics", shortcutCaseId);
  const shortcutRunDiagnosticsDir = path.join(
    shortcutDiagnosticsDir,
    "steam-bridge-smoke-matrix-02-shortcut-friends.log.diagnostics"
  );
  const shortcutScreensDir = path.join(root, "screens", shortcutCaseId);
  const shortcutResult = JSON.parse(JSON.stringify(result));

  shortcutResult.action.action = "presenter-shortcut";
  fs.mkdirSync(shortcutRunDiagnosticsDir, { recursive: true });
  fs.mkdirSync(shortcutScreensDir, { recursive: true });
  fs.writeFileSync(
    path.join(shortcutDiagnosticsDir, "steam-bridge-smoke-matrix-02-shortcut-friends.log"),
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(shortcutResult)}\n`
  );
  fs.writeFileSync(
    path.join(shortcutRunDiagnosticsDir, "lifecycle.jsonl"),
    [
      { type: "event:callback:overlay-activated", payload: { active: true } },
      { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(12) } },
      { type: "event:callback:overlay-activated", payload: { active: false } },
      { type: "event:overlay:presenter-wait-closed", payload: { presenter: parkedPresenterFixture(11) } },
      { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(11) } },
      { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(11) } },
      { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(11) } }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n") + "\n"
  );
  for (const screenshot of [
    "overlay-open.png",
    "before-toggle-probe.png",
    "after-toggle-open.png",
    "after-toggle-close.png"
  ]) {
    fs.writeFileSync(path.join(shortcutScreensDir, screenshot), "");
  }

  const unlockCaseId = "03-passive-unlock-toast";
  const unlockDiagnosticsDir = path.join(root, "diagnostics", unlockCaseId);
  const unlockRunDiagnosticsDir = path.join(
    unlockDiagnosticsDir,
    "steam-bridge-smoke-matrix-03-passive-unlock-toast.log.diagnostics"
  );
  const unlockScreensDir = path.join(root, "screens", unlockCaseId);
  const unlockResult = JSON.parse(JSON.stringify(result));
  const passivePresenter = passiveNotificationPresenterFixture(14);

  unlockResult.action.action = "presenter-achievement-unlock";
  unlockResult.snapshot.overlay.nativePresenter.value = passivePresenter;
  unlockResult.snapshot.events = [
    { type: "achievement:unlock", payload: { achievement: "ACH_TRAVEL_FAR_ACCUM", presenter: passivePresenter } },
    { type: "callback:user-stats-stored", payload: { gameId: "480" } },
    { type: "callback:achievement-stored", payload: { achievement: "ACH_TRAVEL_FAR_ACCUM" } }
  ];

  fs.mkdirSync(unlockRunDiagnosticsDir, { recursive: true });
  fs.mkdirSync(unlockScreensDir, { recursive: true });
  fs.writeFileSync(
    path.join(unlockDiagnosticsDir, "steam-bridge-smoke-matrix-03-passive-unlock-toast.log"),
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(unlockResult)}\n`
  );
  fs.writeFileSync(
    path.join(unlockRunDiagnosticsDir, "lifecycle.jsonl"),
    [
      {
        type: "event:achievement:unlock",
        payload: { achievement: "ACH_TRAVEL_FAR_ACCUM", presenter: passivePresenter }
      },
      { type: "event:callback:user-stats-stored", payload: { gameId: "480" } },
      { type: "event:callback:achievement-stored", payload: { achievement: "ACH_TRAVEL_FAR_ACCUM" } }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n") + "\n"
  );
  fs.writeFileSync(path.join(unlockScreensDir, "overlay-open.png"), "");

  const sessionCaseId = "04-session-web";
  const sessionDiagnosticsDir = path.join(root, "diagnostics", sessionCaseId);
  const sessionRunDiagnosticsDir = path.join(
    sessionDiagnosticsDir,
    "steam-bridge-smoke-matrix-04-session-web.log.diagnostics"
  );
  const sessionScreensDir = path.join(root, "screens", sessionCaseId);
  const sessionResult = JSON.parse(JSON.stringify(result));

  sessionResult.snapshot.overlay.nativePresenter.value = sessionPresenterFixture(4, false);
  fs.mkdirSync(sessionRunDiagnosticsDir, { recursive: true });
  fs.mkdirSync(sessionScreensDir, { recursive: true });
  fs.writeFileSync(
    path.join(sessionDiagnosticsDir, "steam-bridge-smoke-matrix-04-session-web.log"),
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(sessionResult)}\n`
  );
  fs.writeFileSync(
    path.join(sessionRunDiagnosticsDir, "lifecycle.jsonl"),
    [
      { type: "event:callback:overlay-activated", payload: { active: true } },
      { type: "event:overlay:presenter-wait-shown", payload: { presenter: sessionPresenterFixture(8, true) } },
      { type: "event:callback:overlay-activated", payload: { active: false } },
      { type: "event:overlay:presenter-wait-closed", payload: { presenter: sessionPresenterFixture(9, false) } },
      { type: "event:overlay:presenter-parked", payload: { presenter: sessionPresenterFixture(9, false) } }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n") + "\n"
  );
  fs.writeFileSync(path.join(sessionScreensDir, "overlay-open.png"), "");

  const checkoutCaseId = "05-checkout-approval-route";
  const checkoutDiagnosticsDir = path.join(root, "diagnostics", checkoutCaseId);
  const checkoutRunDiagnosticsDir = path.join(
    checkoutDiagnosticsDir,
    "steam-bridge-smoke-matrix-05-checkout-approval-route.log.diagnostics"
  );
  const checkoutScreensDir = path.join(root, "screens", checkoutCaseId);
  const checkoutResult = JSON.parse(JSON.stringify(result));

  checkoutResult.action.action = "presenter-checkout";
  fs.mkdirSync(checkoutRunDiagnosticsDir, { recursive: true });
  fs.mkdirSync(checkoutScreensDir, { recursive: true });
  fs.writeFileSync(
    path.join(checkoutDiagnosticsDir, "steam-bridge-smoke-matrix-05-checkout-approval-route.log"),
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(checkoutResult)}\n`
  );
  fs.writeFileSync(
    path.join(checkoutRunDiagnosticsDir, "lifecycle.jsonl"),
    [
      {
        type: "event:overlay:presenter-open",
        payload: {
          target: "checkout",
          api: "openCheckoutAndWait",
          checkout: { hasCheckoutUrl: false, hasTransactionId: true, hasReturnUrl: false }
        }
      },
      { type: "event:callback:overlay-activated", payload: { active: true } },
      { type: "event:overlay:presenter-wait-shown", payload: { presenter: activePresenterFixture(16) } },
      { type: "event:callback:overlay-activated", payload: { active: false } },
      { type: "event:overlay:presenter-wait-closed", payload: { presenter: parkedPresenterFixture(15) } },
      { type: "event:overlay:presenter-parked", payload: { presenter: parkedPresenterFixture(15) } },
      {
        type: "event:overlay:presenter-checkout-open-and-wait-complete",
        payload: {
          parked: parkedPresenterFixture(15),
          presenter: parkedPresenterFixture(15),
          resolvedTarget: { hasCheckoutUrl: true, hasTransactionId: true, hasReturnUrl: false }
        }
      },
      { type: "event:overlay:presenter-after-close", payload: { presenter: parkedPresenterFixture(15) } },
      { type: "event:overlay:presenter-after-close-stable", payload: { presenter: parkedPresenterFixture(15) } }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n") + "\n"
  );
  fs.writeFileSync(path.join(checkoutScreensDir, "overlay-open.png"), "");

  fs.writeFileSync(
    path.join(root, "matrix-cases.jsonl"),
    [
      {
        caseId,
        caseName: "web-modal",
        action: "presenter-web",
        visualCloseInput: "web",
        visualToggleInput: null
      },
      {
        caseId: shortcutCaseId,
        caseName: "shortcut-friends",
        action: "presenter-shortcut",
        visualCloseInput: "toggle",
        visualToggleInput: "keyboard"
      },
      {
        caseId: unlockCaseId,
        caseName: "passive-unlock-toast",
        action: "presenter-achievement-unlock",
        visualCloseInput: null,
        visualToggleInput: null
      },
      {
        caseId: sessionCaseId,
        caseName: "session-web",
        action: "presenter-web",
        visualCloseInput: "web",
        visualToggleInput: null
      },
      {
        caseId: checkoutCaseId,
        caseName: "checkout-approval-route",
        action: "presenter-checkout",
        visualCloseInput: "web",
        visualToggleInput: null
      }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n") + "\n"
  );
}

function activePresenterFixture(pumpCount) {
  return {
    closed: false,
    attached: true,
    nativeHostOpen: true,
    mode: "active",
    clickThrough: false,
    focusable: true,
    transparent: false,
    overlayActive: true,
    idleFps: 0,
    currentFps: 30,
    overlayNeedsPresent: true,
    pumpCount,
    electronOverlay: electronOverlayFixture()
  };
}

function parkedPresenterFixture(pumpCount) {
  return {
    closed: false,
    attached: true,
    nativeHostOpen: true,
    mode: "passive",
    clickThrough: true,
    focusable: false,
    transparent: true,
    overlayActive: false,
    idleFps: 0,
    currentFps: 0,
    overlayNeedsPresent: false,
    pumpCount,
    electronOverlay: electronOverlayFixture()
  };
}

function passiveNotificationPresenterFixture(pumpCount) {
  return {
    ...parkedPresenterFixture(pumpCount),
    currentFps: 30,
    overlayNeedsPresent: true
  };
}

function sessionPresenterFixture(pumpCount, active) {
  return {
    ...(active ? activePresenterFixture(pumpCount) : parkedPresenterFixture(pumpCount)),
    electronOverlay: {
      ...electronOverlayFixture(),
      presenterMode: "session"
    }
  };
}

function electronOverlayFixture() {
  return {
    presenterMode: "persistent",
    closeWithWindow: true,
    autoPrepareForNotifications: true,
    overlayShortcut: {
      enabled: true,
      preventDefault: true,
      targetType: "friends",
      target: { type: "friends" }
    }
  };
}

function verifyPassiveNotificationAction(
  caseName,
  action,
  resultEvents,
  lifecycleEntries,
  nativePresenter,
  overlayTargetCount,
  failures
) {
  const requirements = PASSIVE_NOTIFICATION_ACTIONS.get(action);
  if (!requirements) {
    return { required: false, ok: true };
  }

  const failuresBefore = failures.length;
  const resultActionEvent = findEvent(resultEvents, requirements.event);
  const lifecycleActionEvent = findEvent(lifecycleEntries, lifecycleEventType(requirements.event));

  if (!resultActionEvent) {
    failures.push(`${caseName}: missing ${requirements.event} in result snapshot events`);
  }
  if (!lifecycleActionEvent) {
    failures.push(`${caseName}: missing ${lifecycleEventType(requirements.event)} in lifecycle log`);
  }
  if (action === "presenter-achievement-progress") {
    if (resultActionEvent && (!resultActionEvent.payload || resultActionEvent.payload.indicated !== true)) {
      failures.push(`${caseName}: achievement progress was not indicated by Steam`);
    }
    if (lifecycleActionEvent && (!lifecycleActionEvent.payload || lifecycleActionEvent.payload.indicated !== true)) {
      failures.push(`${caseName}: lifecycle achievement progress was not indicated by Steam`);
    }
  }
  for (const eventType of requirements.callbacks) {
    if (!findEvent(resultEvents, eventType)) {
      failures.push(`${caseName}: missing ${eventType} in result snapshot events`);
    }
    const lifecycleType = lifecycleEventType(eventType);
    if (!findEvent(lifecycleEntries, lifecycleType)) {
      failures.push(`${caseName}: missing ${lifecycleType} in lifecycle log`);
    }
  }

  const activeOverlayEvents = [...resultEvents, ...lifecycleEntries].filter((event) => overlayEventState(event) === true);
  if (activeOverlayEvents.length > 0) {
    failures.push(`${caseName}: passive notification unexpectedly activated a modal Steam overlay`);
  }
  if (overlayTargetCount !== 1) {
    failures.push(`${caseName}: passive notification expected one gameoverlayui target, got ${overlayTargetCount}`);
  }

  const eventPresenter = presenterPayload(resultActionEvent) || presenterPayload(lifecycleActionEvent);
  const passivePresenter = eventPresenter || nativePresenter;
  if (!passivePresenter || typeof passivePresenter !== "object") {
    failures.push(`${caseName}: passive notification did not include a presenter snapshot`);
  } else {
    expectPassiveNotificationPresenter(caseName, passivePresenter, "passive notification", failures);
  }

  return { required: true, ok: failures.length === failuresBefore };
}

function findEvent(events, type) {
  return Array.isArray(events) ? events.find((event) => event && event.type === type) : undefined;
}

function lifecycleEventType(type) {
  return `event:${type}`;
}

function expectPassiveNotificationPresenter(caseName, presenter, label, failures) {
  expectPresenterField(caseName, presenter, "closed", false, `native presenter closed ${label}`, failures);
  expectPresenterField(caseName, presenter, "attached", true, `native presenter attached ${label}`, failures);
  expectPresenterField(caseName, presenter, "nativeHostOpen", true, `native presenter host open ${label}`, failures);
  expectPresenterField(caseName, presenter, "mode", "passive", `native presenter mode ${label}`, failures);
  expectPresenterField(caseName, presenter, "clickThrough", true, `native presenter click-through ${label}`, failures);
  expectPresenterField(caseName, presenter, "focusable", false, `native presenter focusable ${label}`, failures);
  expectPresenterField(caseName, presenter, "transparent", true, `native presenter transparent ${label}`, failures);
  expectPresenterField(caseName, presenter, "overlayActive", false, `native presenter overlay active ${label}`, failures);
  expectPresenterField(caseName, presenter, "idleFps", 0, `native presenter idle FPS ${label}`, failures);
}

function verifyManagedLifecycleWaits(caseName, action, entries, failures) {
  if (!requiresManagedLifecycleWaits(action, entries)) {
    return { required: false, ok: true };
  }
  const failuresBefore = failures.length;

  const firstActiveIndex = entries.findIndex(isLifecycleOverlayActiveEvent);
  if (firstActiveIndex === -1) {
    return { required: true, ok: false };
  }

  const inactiveAfterActiveIndex = entries.findIndex(
    (entry, index) => index > firstActiveIndex && isLifecycleOverlayInactiveEvent(entry)
  );
  if (inactiveAfterActiveIndex === -1) {
    return { required: true, ok: false };
  }

  const shown = entries.find(
    (entry, index) => index > firstActiveIndex && entry.type === "event:overlay:presenter-wait-shown"
  );
  const closed = entries.find(
    (entry, index) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-wait-closed"
  );
  const parked = entries.find(
    (entry, index) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-parked"
  );

  if (!shown) {
    failures.push(`${caseName}: no overlay:presenter-wait-shown event after active=true`);
  } else if (!presenterPayload(shown)) {
    failures.push(`${caseName}: overlay:presenter-wait-shown did not include a presenter snapshot`);
  }
  if (!closed) {
    failures.push(`${caseName}: no overlay:presenter-wait-closed event after active=false`);
  } else if (!presenterPayload(closed)) {
    failures.push(`${caseName}: overlay:presenter-wait-closed did not include a presenter snapshot`);
  }
  const parkedPresenter = parked ? presenterPayload(parked) : undefined;
  if (!parked) {
    failures.push(`${caseName}: no overlay:presenter-parked event after active=false`);
  } else if (!parkedPresenter) {
    failures.push(`${caseName}: overlay:presenter-parked did not include a presenter snapshot`);
  }

  if (parkedPresenter && readPresenterMode(parkedPresenter) !== "session") {
    expectParkedPresenter(caseName, parkedPresenter, "managed park wait", failures);
  }

  return { required: true, ok: failures.length === failuresBefore };
}

function requiresManagedLifecycleWaits(action, entries) {
  if (MANAGED_LIFECYCLE_ACTIONS.has(action)) {
    return entries.some((entry) => entry.type === "event:callback:overlay-activated");
  }
  if (action === "presenter-checkout") {
    return entries.some((entry) => entry.type === "event:overlay:presenter-open");
  }
  return false;
}

function verifyCheckoutOpenAndWait(caseName, action, entries, failures) {
  if (action !== "presenter-checkout") {
    return { required: false, ok: true };
  }
  const open = entries.find((entry) => {
    const payload = entry && typeof entry.payload === "object" && !Array.isArray(entry.payload) ? entry.payload : {};
    return entry.type === "event:overlay:presenter-open" && payload.target === "checkout";
  });
  if (!open) {
    return { required: false, ok: true };
  }

  const failuresBefore = failures.length;
  const openPayload = open && typeof open.payload === "object" && !Array.isArray(open.payload) ? open.payload : {};
  if (openPayload.api !== "openCheckoutAndWait") {
    failures.push(`${caseName}: checkout presenter-open did not use openCheckoutAndWait`);
  }

  const inactiveIndex = entries.findIndex(isLifecycleOverlayInactiveEvent);
  if (inactiveIndex === -1) {
    failures.push(`${caseName}: checkout openAndWait did not record active=false before completion`);
    return { required: true, ok: false };
  }

  const complete = entries.find(
    (entry, index) => index > inactiveIndex && entry.type === "event:overlay:presenter-checkout-open-and-wait-complete"
  );
  if (!complete) {
    failures.push(`${caseName}: missing overlay:presenter-checkout-open-and-wait-complete after active=false`);
    return { required: true, ok: false };
  }

  const payload = complete && typeof complete.payload === "object" && !Array.isArray(complete.payload) ? complete.payload : {};
  const parked = payload.parked && typeof payload.parked === "object" && !Array.isArray(payload.parked)
    ? payload.parked
    : undefined;
  if (!parked) {
    failures.push(`${caseName}: checkout completion did not include parked presenter snapshot`);
  } else if (readPresenterMode(parked) !== "session") {
    expectParkedPresenter(caseName, parked, "checkout openAndWait completion", failures);
  }

  return { required: true, ok: failures.length === failuresBefore };
}

function readPresenterMode(presenter) {
  const electronOverlay = readElectronOverlay(presenter);
  return electronOverlay && typeof electronOverlay.presenterMode === "string" ? electronOverlay.presenterMode : "";
}

function readElectronOverlay(presenter) {
  return presenter && typeof presenter.electronOverlay === "object" && !Array.isArray(presenter.electronOverlay)
    ? presenter.electronOverlay
    : undefined;
}

function findResultLog(caseDir, failures) {
  const logs = fs
    .readdirSync(caseDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
    .map((entry) => path.join(caseDir, entry.name))
    .filter((file) => fs.readFileSync(file, "utf8").includes(RESULT_PREFIX));
  if (logs.length !== 1) {
    if (logs.length > 1) {
      failures.push(`${path.basename(caseDir)}: found multiple result logs`);
    }
    return null;
  }
  return logs[0];
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
      failures.push(`invalid matrix case manifest JSON in ${file}:${index + 1}: ${error.message}`);
      continue;
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      failures.push(`invalid matrix case manifest entry in ${file}:${index + 1}`);
      continue;
    }
    if (!metadata.caseId || typeof metadata.caseId !== "string") {
      failures.push(`matrix case manifest entry missing caseId in ${file}:${index + 1}`);
      continue;
    }
    if (byCase.has(metadata.caseId)) {
      failures.push(`duplicate matrix case manifest entry for ${metadata.caseId}`);
      continue;
    }
    byCase.set(metadata.caseId, metadata);
  }

  return { found: true, byCase };
}

function verifyCaseMetadata(caseName, caseManifest, action, failures) {
  const metadata = caseManifest.byCase.get(caseName);
  if (!metadata) {
    if (caseManifest.found) {
      failures.push(`${caseName}: missing matrix case metadata`);
    }
    return;
  }

  const actionName = action.action || "unknown";
  if (metadata.action !== actionName) {
    failures.push(
      `${caseName}: matrix metadata action expected ${formatValue(actionName)}, got ${formatValue(metadata.action)}`
    );
  }

  if (actionName === "presenter-shortcut") {
    if (metadata.visualToggleInput !== "keyboard") {
      failures.push(
        `${caseName}: shortcut matrix metadata visualToggleInput expected "keyboard", got ${formatValue(metadata.visualToggleInput)}`
      );
    }
    if (metadata.visualCloseInput !== "toggle") {
      failures.push(
        `${caseName}: shortcut matrix metadata visualCloseInput expected "toggle", got ${formatValue(metadata.visualCloseInput)}`
      );
    }
  }
}

function readLifecycle(caseDir) {
  const lifecycleFiles = findFiles(caseDir, "lifecycle.jsonl");
  if (lifecycleFiles.length === 0) {
    return { found: false, rawText: "", entries: [], errors: [] };
  }

  const errors = [];
  const entries = [];
  let rawText = "";

  if (lifecycleFiles.length > 1) {
    errors.push(`found multiple lifecycle logs (${lifecycleFiles.length})`);
  }

  for (const file of lifecycleFiles) {
    const text = fs.readFileSync(file, "utf8");
    rawText += text;
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (!line.trim()) {
        continue;
      }
      try {
        entries.push(JSON.parse(line));
      } catch (error) {
        errors.push(`invalid lifecycle JSON in ${file}:${index + 1}: ${error.message}`);
      }
    }
  }

  return { found: true, rawText, entries, errors };
}

function verifyLifecycleParking(caseName, entries, failures) {
  const firstActiveIndex = entries.findIndex(isLifecycleOverlayActiveEvent);
  if (firstActiveIndex === -1) {
    return { required: false, ok: true };
  }

  const inactiveAfterActiveIndex = entries.findIndex(
    (entry, index) => index > firstActiveIndex && isLifecycleOverlayInactiveEvent(entry)
  );
  if (inactiveAfterActiveIndex === -1) {
    failures.push(`${caseName}: no active=false overlay callback after active=true`);
    return { required: true, ok: false };
  }

  if (entries.some((entry) => readPresenterMode(presenterPayload(entry)) === "session")) {
    return { required: false, ok: true };
  }

  const firstAfterClosePresenters = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(
      ({ entry, index }) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-after-close"
    );
  const stableAfterClosePresenters = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(
      ({ entry, index }) =>
        index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-after-close-stable"
    );
  const firstPresenter = firstAfterClosePresenters.filter(({ presenter }) => presenter).at(-1)?.presenter;
  const stablePresenter = stableAfterClosePresenters.filter(({ presenter }) => presenter).at(-1)?.presenter;

  if (firstAfterClosePresenters.length === 0) {
    failures.push(`${caseName}: no overlay:presenter-after-close event after active=false`);
  } else if (!firstPresenter) {
    failures.push(`${caseName}: overlay:presenter-after-close did not include a presenter snapshot`);
  }
  if (stableAfterClosePresenters.length === 0) {
    failures.push(`${caseName}: no overlay:presenter-after-close-stable event after active=false`);
  } else if (!stablePresenter) {
    failures.push(`${caseName}: overlay:presenter-after-close-stable did not include a presenter snapshot`);
  }

  if (!firstPresenter || !stablePresenter) {
    return { required: true, ok: false };
  }

  const parkingFailuresBefore = failures.length;
  expectParkedPresenter(caseName, firstPresenter, "first sample", failures);
  expectParkedPresenter(caseName, stablePresenter, "stable sample", failures);

  const firstPumpCount = firstPresenter.pumpCount;
  const stablePumpCount = stablePresenter.pumpCount;
  if (firstPumpCount !== stablePumpCount) {
    failures.push(
      `${caseName}: native presenter pump count changed after close: first=${formatValue(firstPumpCount)} stable=${formatValue(stablePumpCount)}`
    );
  }

  return { required: true, ok: failures.length === parkingFailuresBefore };
}

function presenterPayload(entry) {
  const payload = entry && typeof entry.payload === "object" && !Array.isArray(entry.payload) ? entry.payload : {};
  return payload.presenter && typeof payload.presenter === "object" && !Array.isArray(payload.presenter)
    ? payload.presenter
    : undefined;
}

function expectParkedPresenter(caseName, presenter, label, failures) {
  expectPresenterField(caseName, presenter, "closed", false, `native presenter closed ${label}`, failures);
  expectPresenterField(caseName, presenter, "attached", true, `native presenter attached ${label}`, failures);
  expectPresenterField(caseName, presenter, "nativeHostOpen", true, `native presenter host open ${label}`, failures);
  expectPresenterField(caseName, presenter, "mode", "passive", `native presenter mode ${label}`, failures);
  expectPresenterField(caseName, presenter, "clickThrough", true, `native presenter click-through ${label}`, failures);
  expectPresenterField(caseName, presenter, "focusable", false, `native presenter focusable ${label}`, failures);
  expectPresenterField(caseName, presenter, "transparent", true, `native presenter transparent ${label}`, failures);
  expectPresenterField(caseName, presenter, "overlayActive", false, `native presenter overlay active ${label}`, failures);
  expectPresenterField(caseName, presenter, "idleFps", 0, `native presenter idle FPS ${label}`, failures);
  expectPresenterField(caseName, presenter, "currentFps", 0, `native presenter current FPS ${label}`, failures);
  expectPresenterField(
    caseName,
    presenter,
    "overlayNeedsPresent",
    false,
    `native presenter overlay needs present ${label}`,
    failures
  );
}

function expectPresenterField(caseName, presenter, key, expected, label, failures) {
  if (presenter[key] !== expected) {
    failures.push(`${caseName}: ${label} expected ${formatValue(expected)}, got ${formatValue(presenter[key])}`);
  }
}

function formatValue(value) {
  return JSON.stringify(value);
}

function findFiles(rootDir, name) {
  const matches = [];
  if (!fs.existsSync(rootDir)) {
    return matches;
  }
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findFiles(fullPath, name));
    } else if (entry.isFile() && entry.name === name) {
      matches.push(fullPath);
    }
  }
  return matches;
}

function countScreenshots(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return 0;
  }

  let count = 0;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      count += countScreenshots(fullPath);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      count += 1;
    }
  }
  return count;
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readOkValue(entry) {
  return entry && entry.ok === true ? entry.value : undefined;
}

function expect(condition, message, bucket) {
  if (!condition) {
    bucket.push(message);
  }
}

function countOverlayTargets(overlayProcesses) {
  const gameoverlayui = Array.isArray(overlayProcesses.gameoverlayui) ? overlayProcesses.gameoverlayui : [];
  return gameoverlayui.filter((entry) => entry && entry.targetPid != null).length;
}

function isOverlayActiveEvent(event) {
  return overlayEventState(event) === true;
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
  if (event.type !== "callback:overlay-activated" && event.type !== "event:callback:overlay-activated") {
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
