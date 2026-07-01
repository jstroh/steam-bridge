const fs = require("node:fs");
const path = require("node:path");

const RESULT_PREFIX = "STEAM_BRIDGE_SMOKE_RESULT ";
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
const options = parseArgs(process.argv.slice(2));
const input = options.file ? fs.readFileSync(options.file, "utf8") : fs.readFileSync(0, "utf8");
const result = readResult(input);
const snapshot = result.snapshot || {};
const steam = snapshot.steam || {};
const app = snapshot.app || {};
const launch = snapshot.launch || {};
const overlay = snapshot.overlay || {};
const overlayProcesses = snapshot.overlayProcesses || {};
const crashDiagnostics = snapshot.crashDiagnostics || {};
const processInfo = snapshot.process || {};
const nativePresenter = readOkValue(overlay.nativePresenter);
const nativeHostAvailability = readOkValue(overlay.nativeHostAvailability);
const electronOverlay = nativePresenter && typeof nativePresenter === "object" ? nativePresenter.electronOverlay : undefined;
const expectedActionName = options.action || (result.action && result.action.action) || "";
const events = sliceEntriesForCurrentAction(Array.isArray(snapshot.events) ? snapshot.events : [], expectedActionName);
const overlayActivated = events.some(isOverlayActiveEvent);
const expectedActionError = Boolean(options.requireActionErrorCode || options.requireActionErrorReason);
const failures = [];

if (expectedActionError) {
  expect(result.ok === false, "smoke result failed with expected action error");
} else {
  expect(result.ok === true, "smoke result ok");
}
expect(steam.initialized === true, "Steam initialized");
expect(readOkValue(steam.running) === true, "Steam running");
expect(readOkValue(steam.appId) === app.appId, "Steam App ID matches app config");

if (options.appId != null) {
  expect(app.appId === options.appId, `app ID is ${options.appId}`);
}
if (options.platform) {
  expect(processInfo.platform === options.platform, `platform is ${options.platform}`);
}
if (options.arch) {
  expect(processInfo.arch === options.arch, `arch is ${options.arch}`);
}
if (options.action) {
  expect(result.action && result.action.action === options.action, `autorun action is ${options.action}`);
  if (expectedActionError) {
    expect(result.action && result.action.ok === false, `autorun action ${options.action} failed with expected error`);
  } else {
    expect(result.action && result.action.ok === true, `autorun action ${options.action} succeeded`);
  }
}
if (expectedActionError) {
  verifyExpectedActionError();
}
if (options.requireNativeHostUnavailableReason) {
  verifyNativeHostUnavailableReason();
}
if (options.requireSteamDeck) {
  expect(readOkValue(steam.steamDeck) === true, "Steam Deck detected");
}
if (options.requireBigPicture) {
  expect(readOkValue(steam.bigPicture) === true, "Big Picture/Game Mode detected");
}
if (options.requireOverlayEnabled) {
  expect(readOkValue(steam.overlayEnabled) === true, "overlay enabled");
}
if (options.requireOverlayReady) {
  expect(readOkValue(steam.overlayEnabled) === true, "overlay enabled");
  expect(
    readOkValue(steam.overlayNeedsPresent) === false || overlayActivated,
    "overlay does not need present or emitted active overlay callback"
  );
}
if (options.requireOverlayActivated) {
  expect(overlayActivated, "overlay activation callback active=true emitted");
}
if (options.requireNoOverlayActivation) {
  expect(!overlayActivated, "overlay activation callback active=true was not emitted");
}
if (options.requireSingleOverlayTarget) {
  const gameoverlayui = Array.isArray(overlayProcesses.gameoverlayui)
    ? overlayProcesses.gameoverlayui.filter((entry) => entry && entry.targetPid != null)
    : [];
  expect(overlayProcesses.available === true, "overlay process snapshot available");
  expect(gameoverlayui.length === 1, "exactly one gameoverlayui target detected");
  if (gameoverlayui.length > 0) {
    expect(gameoverlayui[0].targetPid === processInfo.pid, "gameoverlayui targets the smoke app process");
  }
}
if (processInfo.platform === "darwin" && nativePresenter) {
  expectMacosNeedsPresentPollingDisabled(nativePresenter, "native presenter");
}
if (options.requirePassivePresenter || options.requireIdlePresenter) {
  expect(Boolean(nativePresenter), "native presenter snapshot available");
  if (nativePresenter) {
    expect(nativePresenter.attached === true, "native presenter attached");
    expect(nativePresenter.nativeHostOpen === true, "native presenter host open");
    if (processInfo.platform === "darwin") {
      expectMacOverlayEnvironmentAvailable(nativePresenter, "native presenter");
    }
    expect(nativePresenter.mode === "passive", "native presenter is passive");
    expect(nativePresenter.clickThrough === true, "native presenter is click-through");
    expect(nativePresenter.focusable === false, "native presenter is non-focusable");
    expect(nativePresenter.transparent === true, "native presenter is transparent");
    expect(nativePresenter.overlayActive === false, "native presenter overlay inactive");
  }
}
if (
  options.requireElectronOverlay ||
  options.requirePresenterMode ||
  options.requireOverlayShortcutTarget ||
  options.requireManagedOverlayIsolation ||
  options.requireZeroManagedOverlayTiming ||
  options.requireRestoreFocusDelayMs != null
) {
  expect(Boolean(electronOverlay), "managed Electron overlay diagnostics available");
  if (electronOverlay) {
    expect(
      electronOverlay.autoPrepareForNotifications === true,
      "managed Electron overlay automatic notification priming is enabled"
    );
  }
}
if (options.requireManagedOverlayIsolation && electronOverlay) {
  expect(
    electronOverlay.scrubSteamOverlayChildProcessEnv === true,
    "managed Electron overlay child process preload scrub is enabled"
  );
  expect(
    Array.isArray(electronOverlay.scrubbedEnvKeys),
    "managed Electron overlay scrubbed environment key diagnostics are available"
  );
  if (Array.isArray(electronOverlay.scrubbedEnvKeys)) {
    for (const key of electronOverlay.scrubbedEnvKeys) {
      expect(
        key === "LD_PRELOAD" || key === "DYLD_INSERT_LIBRARIES",
        `managed Electron overlay scrubbed environment key is expected: ${key}`
      );
    }
  }
}
if (options.requirePresenterMode && electronOverlay) {
  expect(
    electronOverlay.presenterMode === options.requirePresenterMode,
    `managed Electron presenter mode is ${options.requirePresenterMode}`
  );
}
if (options.requireRestoreFocusDelayMs != null && electronOverlay) {
  expect(
    electronOverlay.restoreFocusDelayMs === options.requireRestoreFocusDelayMs,
    `managed Electron overlay restore focus delay is ${options.requireRestoreFocusDelayMs}ms`
  );
}
if (options.requireZeroManagedOverlayTiming && electronOverlay) {
  expect(electronOverlay.restoreFocusDelayMs === 0, "managed Electron overlay restore focus delay is zero");
  expect(electronOverlay.activationBoostMs === 0, "managed Electron overlay activation boost is zero");
  expect(electronOverlay.activeGraceMs === 0, "managed Electron overlay active grace is zero");
}
if (options.requireOverlayShortcutTarget && electronOverlay) {
  const overlayShortcut = electronOverlay.overlayShortcut || {};
  const targetType = overlayShortcut.targetType;
  const targetSnapshotType = overlayShortcut.target && typeof overlayShortcut.target.type === "string" ? overlayShortcut.target.type : undefined;
  const configuredShortcutTarget = typeof app.shortcutTarget === "string" ? app.shortcutTarget : undefined;
  expect(overlayShortcut.enabled === true, "managed Electron overlay shortcut is enabled");
  if (targetSnapshotType) {
    expect(targetType === targetSnapshotType, "managed Electron overlay shortcut target diagnostics are consistent");
  }
  expect(
    targetType === options.requireOverlayShortcutTarget ||
      targetSnapshotType === options.requireOverlayShortcutTarget ||
      (targetType === "function" && configuredShortcutTarget === options.requireOverlayShortcutTarget),
    `managed Electron overlay shortcut target is ${options.requireOverlayShortcutTarget}`
  );
}
if (options.requireIdlePresenter) {
  if (nativePresenter) {
    expect(nativePresenter.idleFps === 0, "native presenter idle FPS is zero");
    expect(nativePresenter.currentFps === 0, "native presenter current FPS is zero");
    expect(nativePresenter.overlayNeedsPresent === false, "native presenter overlay does not need present");
  }
}
if (options.requireNoCrashes) {
  const crashDumps = Array.isArray(crashDiagnostics.crashDumps) ? crashDiagnostics.crashDumps : [];
  const fatalLifecycleEvents = Array.isArray(crashDiagnostics.fatalLifecycleEvents)
    ? crashDiagnostics.fatalLifecycleEvents
    : [];
  expect(crashDiagnostics.available === true, "crash diagnostics available");
  expect(crashDiagnostics.ok === true, "no crash diagnostics reported");
  expect(crashDumps.length === 0, "no crash dumps found");
  expect(fatalLifecycleEvents.length === 0, "no fatal lifecycle events recorded");
}
if (options.requireSteamLaunch) {
  expect(launch.steamLaunch === true, "Steam launch marker detected");
}
if (options.requireOverlayInjection) {
  expect(launch.overlayInjection === true, "Steam overlay injection marker detected");
}
if (options.requireNativeProbeOpen) {
  expect(readOkValue(overlay.nativeProbeOpen) === true, "native overlay probe open");
}
for (const type of options.requiredEvents) {
  expect(events.some((event) => event && event.type === type), `event ${type} emitted`);
}
if (options.requirePassiveNotification) {
  verifyPassiveNotification();
}
if (options.requireDirectOpenReadinessStatus) {
  verifyDirectOpenReadinessStatus();
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Smoke result failed: ${failure}`);
  }
  process.exit(1);
}

console.log(
  [
    "Electron smoke result verified",
    `appId=${app.appId}`,
    `platform=${processInfo.platform}/${processInfo.arch}`,
    `steamDeck=${readOkValue(steam.steamDeck)}`,
    `bigPicture=${readOkValue(steam.bigPicture)}`,
    `overlayEnabled=${readOkValue(steam.overlayEnabled)}`,
    `overlayNeedsPresent=${readOkValue(steam.overlayNeedsPresent)}`,
    `overlayNeedsPresentPollingEnabled=${readOkValue(steam.overlayNeedsPresentPollingEnabled)}`,
    `overlayActivated=${overlayActivated}`,
    `steamLaunch=${launch.steamLaunch}`,
    `overlayInjection=${launch.overlayInjection}`,
    `action=${result.action && result.action.action}`
  ].join(" ")
);

function readResult(text) {
  const line = text
    .split(/\r?\n/)
    .reverse()
    .find((entry) => entry.startsWith(RESULT_PREFIX));
  if (!line) {
    throw new Error(`Missing ${RESULT_PREFIX.trim()} line.`);
  }

  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

function readOkValue(entry) {
  return entry && entry.ok === true ? entry.value : undefined;
}

function objectField(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const field = value[key];
  return field && typeof field === "object" && !Array.isArray(field) ? field : undefined;
}

function expectNoRawTargetValues(targetSnapshot, label) {
  for (const key of ["url", "steamUrl", "transactionId", "returnUrl", "steamId64"]) {
    expect(!Object.prototype.hasOwnProperty.call(targetSnapshot, key), `${label} omits raw ${key}`);
  }
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function isOverlayActiveEvent(event) {
  if (!event || event.type !== "callback:overlay-activated") {
    return false;
  }

  const payload = event.payload;
  if (payload == null) {
    return false;
  }
  if (payload === true || payload === 1) {
    return true;
  }
  if (typeof payload !== "object") {
    return false;
  }

  const activePayload = payload["0"] && typeof payload["0"] === "object" ? payload["0"] : payload;
  return (
    activePayload.active === true ||
    activePayload.active === 1 ||
    activePayload.m_bActive === true ||
    activePayload.m_bActive === 1
  );
}

function verifyPassiveNotification() {
  const action = expectedActionName;
  const requirements = PASSIVE_NOTIFICATION_ACTIONS.get(action);
  if (!requirements) {
    failures.push(`passive notification requirements are not defined for action ${action || "<unknown>"}`);
    return;
  }

  const lifecycleEntries = readLifecycleEntries();
  const resultActionEvent = findEvent(events, requirements.event);
  const lifecycleActionEvent = findEvent(lifecycleEntries, lifecycleEventType(requirements.event));

  expect(Boolean(resultActionEvent), `event ${requirements.event} emitted`);
  expect(Boolean(lifecycleActionEvent), `lifecycle event ${lifecycleEventType(requirements.event)} emitted`);

  if (action === "presenter-achievement-progress") {
    if (resultActionEvent) {
      expect(
        resultActionEvent.payload && resultActionEvent.payload.indicated === true,
        "achievement progress was accepted by Steam"
      );
    }
    if (lifecycleActionEvent) {
      expect(
        lifecycleActionEvent.payload && lifecycleActionEvent.payload.indicated === true,
        "lifecycle achievement progress was accepted by Steam"
      );
    }
  }

  for (const eventType of requirements.callbacks) {
    expect(Boolean(findEvent(events, eventType)), `event ${eventType} emitted`);
    expect(Boolean(findEvent(lifecycleEntries, lifecycleEventType(eventType))), `lifecycle event ${lifecycleEventType(eventType)} emitted`);
  }

  const activeOverlayEvents = [...events, ...lifecycleEntries].filter((event) => overlayEventState(event) === true);
  expect(activeOverlayEvents.length === 0, "passive notification did not activate a modal Steam overlay");

  const eventPresenter = presenterPayload(resultActionEvent) || presenterPayload(lifecycleActionEvent);
  const passivePresenter = eventPresenter || nativePresenter;
  const managedOverlay = findManagedOverlayDiagnostics([
    eventPresenter,
    nativePresenter,
    ...events.map(presenterPayload),
    ...lifecycleEntries.map(presenterPayload)
  ]);
  expect(Boolean(passivePresenter), "passive notification presenter snapshot available");
  if (passivePresenter) {
    expectPassiveNotificationPresenter(passivePresenter, "passive notification", managedOverlay);
  }
}

function verifyExpectedActionError() {
  const actionError = result.action && result.action.error;
  expect(Boolean(actionError && typeof actionError === "object"), "autorun action error is serialized");
  if (!actionError || typeof actionError !== "object") {
    return;
  }
  if (options.requireActionErrorCode) {
    expect(
      actionError.code === options.requireActionErrorCode,
      `autorun action error code is ${options.requireActionErrorCode}`
    );
  }
  if (options.requireActionErrorReason) {
    expect(
      actionError.reason === options.requireActionErrorReason,
      `autorun action error reason is ${options.requireActionErrorReason}`
    );
  }
  verifyExpectedActionErrorTargetSnapshot(actionError);
}

function verifyDirectOpenReadinessStatus() {
  const lifecycleEntries = readLifecycleEntries();
  const directStatusEvent =
    findEvent(events, "overlay:presenter-direct-open-status") ||
    findEvent(lifecycleEntries, lifecycleEventType("overlay:presenter-direct-open-status"));
  expect(Boolean(directStatusEvent), "direct presenter open readiness status event emitted");
  if (!directStatusEvent) {
    return;
  }

  const payload = directStatusEvent.payload && typeof directStatusEvent.payload === "object" ? directStatusEvent.payload : {};
  const status = payload.status && typeof payload.status === "object" ? payload.status : undefined;
  expect(Boolean(status), "direct presenter open readiness status payload present");
  if (!status) {
    return;
  }

  expect(typeof status.canOpen === "boolean", "direct presenter open readiness status canOpen is boolean");
  expect(typeof status.canWait === "boolean", "direct presenter open readiness status canWait is boolean");
  expectNoRawTargetValues(status, "direct presenter open readiness status");
  const targetSnapshot = objectField(status, "targetSnapshot");
  expect(Boolean(targetSnapshot), "direct presenter open readiness status includes sanitized targetSnapshot");
  if (targetSnapshot) {
    expect(typeof targetSnapshot.type === "string" && targetSnapshot.type.length > 0, "direct presenter open readiness targetSnapshot has a target type");
    expectNoRawTargetValues(targetSnapshot, "direct presenter open readiness targetSnapshot");
  }

  if (status.canOpen === true) {
    return;
  }
  expect(
    status.reason === "overlay-not-ready",
    "direct presenter open readiness status is either ready or waiting for overlay-not-ready"
  );
  if (status.reason !== "overlay-not-ready") {
    return;
  }

  const waitStart =
    findEvent(events, "overlay:presenter-direct-open-wait-start") ||
    findEvent(lifecycleEntries, lifecycleEventType("overlay:presenter-direct-open-wait-start"));
  const waitComplete =
    findEvent(events, "overlay:presenter-direct-open-wait-complete") ||
    findEvent(lifecycleEntries, lifecycleEventType("overlay:presenter-direct-open-wait-complete"));
  expect(Boolean(waitStart), "direct presenter open wait-start event emitted for overlay-not-ready");
  expect(Boolean(waitComplete), "direct presenter open wait-complete event emitted for overlay-not-ready");
  if (!waitComplete || !waitComplete.payload || typeof waitComplete.payload !== "object") {
    return;
  }
  const ready = waitComplete.payload.ready && typeof waitComplete.payload.ready === "object" ? waitComplete.payload.ready : undefined;
  expect(Boolean(ready), "direct presenter open wait-complete includes ready snapshot");
  const readyDiagnostics = ready && ready.diagnostics && typeof ready.diagnostics === "object" ? ready.diagnostics : {};
  if (ready && Object.prototype.hasOwnProperty.call(readyDiagnostics, "overlayEnabled")) {
    expect(readyDiagnostics.overlayEnabled === true, "direct presenter open wait completed with overlayEnabled=true");
  }
}

function verifyExpectedActionErrorTargetSnapshot(actionError) {
  const targetSnapshot = objectField(actionError, "targetSnapshot");
  expect(Boolean(targetSnapshot), "autorun action error includes sanitized targetSnapshot");
  if (!targetSnapshot) {
    return;
  }

  expect(typeof targetSnapshot.type === "string" && targetSnapshot.type.length > 0, "autorun action error targetSnapshot has a target type");
  expectNoRawTargetValues(targetSnapshot, "autorun action error targetSnapshot");

  if (targetSnapshot.type === "checkout" || expectedActionName === "presenter-checkout") {
    const checkoutTargetSnapshot = objectField(actionError, "checkoutTargetSnapshot");
    expect(Boolean(checkoutTargetSnapshot), "autorun checkout action error includes sanitized checkoutTargetSnapshot");
    if (checkoutTargetSnapshot) {
      expect(
        checkoutTargetSnapshot.type === "checkout",
        "autorun checkout action error checkoutTargetSnapshot type is checkout"
      );
      expectNoRawTargetValues(checkoutTargetSnapshot, "autorun checkout action error checkoutTargetSnapshot");
    }
  }
}

function verifyNativeHostUnavailableReason() {
  expect(Boolean(nativePresenter), "native presenter snapshot available");
  if (!nativePresenter || typeof nativePresenter !== "object") {
    return;
  }

  expect(
    nativePresenter.nativeHostUnavailableReason === options.requireNativeHostUnavailableReason,
    `native host unavailable reason is ${options.requireNativeHostUnavailableReason}`
  );
  expect(nativePresenter.attached === false, "native presenter is not attached while host is unavailable");
  expect(nativePresenter.nativeHostOpen === false, "native presenter host is closed while unavailable");
  expect(nativePresenter.currentFps === 0, "native presenter current FPS is zero while unavailable");
  const actualEnvironment = nativePresenter.macOverlayEnvironment;
  expect(
    macOverlayEnvironmentMatchesReason(actualEnvironment, options.requireNativeHostUnavailableReason),
    `mac overlay environment matches ${options.requireNativeHostUnavailableReason}`
  );
  expect(Boolean(nativeHostAvailability), "native host availability snapshot available");
  if (!nativeHostAvailability || typeof nativeHostAvailability !== "object") {
    return;
  }
  expect(nativeHostAvailability.available === false, "native host availability reports unavailable");
  expect(
    nativeHostAvailability.code === "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
    "native host availability error code is STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE"
  );
  expect(
    nativeHostAvailability.reason === options.requireNativeHostUnavailableReason,
    `native host availability reason is ${options.requireNativeHostUnavailableReason}`
  );
  expect(
    nativeHostAvailability.nativeHostUnavailableReason === options.requireNativeHostUnavailableReason,
    `native host availability nativeHostUnavailableReason is ${options.requireNativeHostUnavailableReason}`
  );
  expect(
    macOverlayEnvironmentMatchesReason(
      nativeHostAvailability.macOverlayEnvironment,
      options.requireNativeHostUnavailableReason
    ),
    `native host availability mac overlay environment matches ${options.requireNativeHostUnavailableReason}`
  );
  const availabilitySnapshot =
    nativeHostAvailability.snapshot && typeof nativeHostAvailability.snapshot === "object"
      ? nativeHostAvailability.snapshot
      : undefined;
  expect(Boolean(availabilitySnapshot), "native host availability presenter snapshot available");
  if (availabilitySnapshot) {
    expect(
      availabilitySnapshot.nativeHostUnavailableReason === options.requireNativeHostUnavailableReason,
      `native host availability presenter reason is ${options.requireNativeHostUnavailableReason}`
    );
    expect(availabilitySnapshot.nativeHostOpen === false, "native host availability presenter host is closed");
  }
}

function macOverlayEnvironmentMatchesReason(environment, reason) {
  if (!environment || typeof environment !== "object") {
    return false;
  }
  switch (reason) {
    case "macos-screen-locked":
      return environment.screenLocked === true;
    case "macos-display-asleep":
      return environment.screenLocked === false && environment.displayAsleep === true;
    default:
      return true;
  }
}

function readLifecycleEntries() {
  if (!options.diagnosticDir) {
    failures.push("diagnostic dir is required for passive notification lifecycle verification");
    return [];
  }

  const lifecyclePath = path.join(options.diagnosticDir, "lifecycle.jsonl");
  let text;
  try {
    text = fs.readFileSync(lifecyclePath, "utf8");
  } catch (error) {
    failures.push(`could not read lifecycle log ${lifecyclePath}: ${error.message}`);
    return [];
  }

  const entries = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    try {
      entries.push(JSON.parse(line));
    } catch (error) {
      failures.push(`invalid lifecycle JSON in ${lifecyclePath}: ${error.message}`);
    }
  }
  return sliceEntriesForCurrentAction(entries, expectedActionName);
}

function findEvent(eventList, type) {
  return Array.isArray(eventList) ? eventList.find((event) => event && event.type === type) : undefined;
}

function sliceEntriesForCurrentAction(entries, action) {
  if (!action) {
    return entries;
  }
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
    if (
      (entry.type === "control:action-begin" ||
        entry.type === "autorun:action-begin" ||
        entry.type === "event:control:action-begin" ||
        entry.type === "event:autorun:action-begin") &&
      payload.action === action
    ) {
      return entries.slice(index);
    }
  }
  return entries;
}

function lifecycleEventType(type) {
  return `event:${type}`;
}

function overlayEventState(event) {
  if (!event || (event.type !== "callback:overlay-activated" && event.type !== "event:callback:overlay-activated")) {
    return undefined;
  }
  return activeValue(event.payload);
}

function activeValue(payload) {
  if (payload === true || payload === 1) {
    return true;
  }
  if (payload === false || payload === 0) {
    return false;
  }
  if (!payload || typeof payload !== "object") {
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

function presenterPayload(event) {
  const payload = event && event.payload;
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const presenter = payload.presenter;
  return presenter && typeof presenter === "object" ? presenter : undefined;
}

function expectPassiveNotificationPresenter(presenter, label, managedOverlay) {
  expect(presenter.closed === false, `native presenter closed ${label}`);
  if (
    processInfo.platform === "darwin" &&
    options.requireNativeHostUnavailableReason
  ) {
    const hasExpectedReason = presenter.nativeHostUnavailableReason === options.requireNativeHostUnavailableReason;
    expect(
      hasExpectedReason,
      `${label} native host unavailable reason is ${options.requireNativeHostUnavailableReason}`
    );
    if (!hasExpectedReason) {
      return;
    }
    expectMacosNeedsPresentPollingDisabled(presenter, label);
    expect(presenter.attached === false, `native presenter is not attached ${label}`);
    expect(presenter.nativeHostOpen === false, `native presenter host is closed ${label}`);
    expect(presenter.mode === "hidden", `native presenter mode ${label}`);
    expect(presenter.clickThrough === true, `native presenter click-through ${label}`);
    expect(presenter.focusable === false, `native presenter focusable ${label}`);
    expect(presenter.transparent === true, `native presenter transparent ${label}`);
    expect(presenter.overlayActive === false, `native presenter overlay inactive ${label}`);
    expect(presenter.idleFps === 0, `native presenter idle FPS ${label}`);
    expect(presenter.currentFps === 0, `native presenter current FPS ${label}`);
    expect(presenter.overlayNeedsPresent === false, `native presenter overlay does not need present ${label}`);
    expect(
      macOverlayEnvironmentMatchesReason(presenter.macOverlayEnvironment, options.requireNativeHostUnavailableReason),
      `${label} mac overlay environment matches ${options.requireNativeHostUnavailableReason}`
    );
    expect(Boolean(managedOverlay), `managed Electron overlay diagnostics available ${label}`);
    if (managedOverlay) {
      expect(
        managedOverlay.autoPrepareForNotifications === true,
        `managed Electron overlay automatic notification priming enabled ${label}`
      );
    }
    return;
  }
  expect(presenter.attached === true, `native presenter attached ${label}`);
  expect(presenter.nativeHostOpen === true, `native presenter host open ${label}`);
  if (processInfo.platform === "darwin") {
    expectMacOverlayEnvironmentAvailable(presenter, label);
  }
  expect(presenter.mode === "passive", `native presenter mode ${label}`);
  expect(presenter.clickThrough === true, `native presenter click-through ${label}`);
  expect(presenter.focusable === false, `native presenter focusable ${label}`);
  expect(presenter.transparent === true, `native presenter transparent ${label}`);
  expect(presenter.overlayActive === false, `native presenter overlay inactive ${label}`);
  expect(presenter.idleFps === 0, `native presenter idle FPS ${label}`);
  expect(Boolean(managedOverlay), `managed Electron overlay diagnostics available ${label}`);
  if (managedOverlay) {
    expect(
      managedOverlay.autoPrepareForNotifications === true,
      `managed Electron overlay automatic notification priming enabled ${label}`
    );
  }
}

function expectMacOverlayEnvironmentAvailable(presenter, label) {
  const environment = presenter && typeof presenter === "object" ? presenter.macOverlayEnvironment : undefined;
  if (!environment || typeof environment !== "object") {
    failures.push(`${label} mac overlay environment available`);
    return;
  }
  expect(environment.screenLocked === false, `${label} screen is unlocked`);
  expect(environment.displayAsleep === false, `${label} display is awake`);
  expect(presenter.nativeHostUnavailableReason == null, `${label} native host unavailable reason is absent`);
}

function expectMacosNeedsPresentPollingDisabled(presenter, label) {
  const values = [];
  if (Object.prototype.hasOwnProperty.call(presenter, "overlayNeedsPresentPollingEnabled")) {
    values.push({ source: "presenter", value: presenter.overlayNeedsPresentPollingEnabled });
  }
  const diagnostics =
    presenter && presenter.diagnostics && typeof presenter.diagnostics === "object" ? presenter.diagnostics : {};
  if (Object.prototype.hasOwnProperty.call(diagnostics, "overlayNeedsPresentPollingEnabled")) {
    values.push({ source: "presenter diagnostics", value: diagnostics.overlayNeedsPresentPollingEnabled });
  }
  for (const entry of values) {
    expect(entry.value === false, `macOS needs-present polling disabled in ${entry.source} ${label}`);
  }
  if (values.some((entry) => entry.value === false)) {
    expect(
      presenter.overlayNeedsPresent !== true,
      `native presenter overlay does not need present while macOS polling is disabled ${label}`
    );
  }
}

function findManagedOverlayDiagnostics(presenters) {
  for (const presenter of presenters) {
    if (presenter && typeof presenter === "object" && presenter.electronOverlay && typeof presenter.electronOverlay === "object") {
      return presenter.electronOverlay;
    }
  }
  return undefined;
}

function parseArgs(args) {
  const parsed = {
    appId: undefined,
    arch: undefined,
    action: undefined,
    diagnosticDir: undefined,
    file: undefined,
    platform: undefined,
    requireBigPicture: false,
    requireOverlayInjection: false,
    requireOverlayEnabled: false,
    requireOverlayReady: false,
    requireNativeProbeOpen: false,
    requireOverlayActivated: false,
    requireSingleOverlayTarget: false,
    requirePassivePresenter: false,
    requireIdlePresenter: false,
    requireElectronOverlay: false,
    requirePresenterMode: undefined,
    requireOverlayShortcutTarget: undefined,
    requireManagedOverlayIsolation: false,
    requireActionErrorCode: undefined,
    requireActionErrorReason: undefined,
    requireNativeHostUnavailableReason: undefined,
    requireRestoreFocusDelayMs: undefined,
    requireZeroManagedOverlayTiming: false,
    requireNoOverlayActivation: false,
    requireNoCrashes: false,
    requirePassiveNotification: false,
    requireDirectOpenReadinessStatus: false,
    requireSteamLaunch: false,
    requireSteamDeck: false,
    requiredEvents: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--action":
        parsed.action = args[++index];
        break;
      case "--app-id":
        parsed.appId = Number(args[++index]);
        break;
      case "--arch":
        parsed.arch = args[++index];
        break;
      case "--file":
        parsed.file = args[++index];
        break;
      case "--diagnostic-dir":
        parsed.diagnosticDir = args[++index];
        break;
      case "--platform":
        parsePlatformValue(parsed, args[++index]);
        break;
      case "--require-big-picture":
        parsed.requireBigPicture = true;
        break;
      case "--require-event":
        parsed.requiredEvents.push(args[++index]);
        break;
      case "--require-overlay-injection":
        parsed.requireOverlayInjection = true;
        break;
      case "--require-overlay-enabled":
        parsed.requireOverlayEnabled = true;
        break;
      case "--require-overlay-ready":
        parsed.requireOverlayReady = true;
        break;
      case "--require-overlay-activated":
        parsed.requireOverlayActivated = true;
        break;
      case "--require-no-overlay-activation":
        parsed.requireNoOverlayActivation = true;
        break;
      case "--require-single-overlay-target":
        parsed.requireSingleOverlayTarget = true;
        break;
      case "--require-passive-presenter":
        parsed.requirePassivePresenter = true;
        break;
      case "--require-passive-notification":
        parsed.requirePassiveNotification = true;
        parsed.requireElectronOverlay = true;
        break;
      case "--require-direct-open-readiness-status":
        parsed.requireDirectOpenReadinessStatus = true;
        break;
      case "--require-idle-presenter":
        parsed.requireIdlePresenter = true;
        parsed.requirePassivePresenter = true;
        break;
      case "--require-electron-overlay":
        parsed.requireElectronOverlay = true;
        break;
      case "--require-presenter-mode":
        parsed.requirePresenterMode = args[++index];
        parsed.requireElectronOverlay = true;
        break;
      case "--require-overlay-shortcut-target":
        parsed.requireOverlayShortcutTarget = args[++index];
        parsed.requireElectronOverlay = true;
        break;
      case "--require-managed-overlay-isolation":
        parsed.requireManagedOverlayIsolation = true;
        parsed.requireElectronOverlay = true;
        break;
      case "--require-action-error-code":
        parsed.requireActionErrorCode = args[++index];
        break;
      case "--require-action-error-reason":
        parsed.requireActionErrorReason = args[++index];
        break;
      case "--require-native-host-unavailable-reason":
        parsed.requireNativeHostUnavailableReason = args[++index];
        break;
      case "--require-restore-focus-delay-ms":
        parsed.requireRestoreFocusDelayMs = parseRequiredInteger(arg, args[++index]);
        parsed.requireElectronOverlay = true;
        break;
      case "--require-zero-managed-overlay-timing":
        parsed.requireZeroManagedOverlayTiming = true;
        parsed.requireElectronOverlay = true;
        break;
      case "--require-no-crashes":
        parsed.requireNoCrashes = true;
        break;
      case "--require-native-probe-open":
        parsed.requireNativeProbeOpen = true;
        break;
      case "--require-steam-launch":
        parsed.requireSteamLaunch = true;
        break;
      case "--require-steam-deck":
        parsed.requireSteamDeck = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function parseRequiredInteger(name, value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name} value: ${value}`);
  }
  return parsed;
}

function parsePlatformValue(parsed, value) {
  const [platform, arch, extra] = String(value || "").split("/");
  if (!platform || extra) {
    throw new Error(`Invalid platform value: ${value}`);
  }

  parsed.platform = platform;
  if (arch) {
    parsed.arch = arch;
  }
}
