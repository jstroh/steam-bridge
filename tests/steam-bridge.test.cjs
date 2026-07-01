const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "packages", "steam-bridge", "dist");
const steamEnvKeys = ["SteamAppId", "SteamAppID", "STEAM_APP_ID"];

function distFile(fileName) {
  return path.join(distRoot, fileName);
}

function clearSteamBridgeCache() {
  for (const fileName of ["index.js", "native.js", "electron.js"]) {
    try {
      delete require.cache[require.resolve(distFile(fileName))];
    } catch {
      // The build step creates dist before tests run. This keeps direct test
      // execution from failing during cache cleanup.
    }
  }
}

function loadSteamWithFakeNative(fakeNative, options = {}) {
  if (options.linuxDisplay !== false && process.platform === "linux" && !process.env.DISPLAY) {
    process.env.DISPLAY = ":99";
  }
  clearSteamBridgeCache();
  const nativeModule = require(distFile("native.js"));
  nativeModule.loadNativeBinding = () => fakeNative;
  return require(distFile("index.js"));
}

function setProcessPlatformForTest(t, platform) {
  const previous = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
    enumerable: previous?.enumerable ?? true
  });
  t.after(() => {
    if (previous) {
      Object.defineProperty(process, "platform", previous);
    }
  });
}

function mockElectronModule(t, electron) {
  const previousLoad = Module._load;
  Module._load = function mockElectronLoad(request, parent, isMain) {
    if (request === "electron") {
      return electron;
    }
    return previousLoad.call(this, request, parent, isMain);
  };
  t.after(() => {
    Module._load = previousLoad;
  });
}

function expectedNativeOverlayBackend(nativeWindowHandle = false) {
  if (process.platform === "linux") {
    return "x11-glx";
  }
  if (process.platform === "darwin") {
    return nativeWindowHandle ? "macos-metal" : "macos-opengl";
  }
  return "none";
}

function setSteamEnv(values = {}) {
  const previous = new Map(steamEnvKeys.map((key) => [key, process.env[key]]));
  for (const key of steamEnvKeys) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  return () => {
    for (const key of steamEnvKeys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

test("electron smoke sanitizer redacts private overlay proof fields", () => {
  const { sanitizeSmokeValue } = require(path.join(repoRoot, "examples", "electron-basic", "smoke-sanitize.cjs"));
  const { serializeSmokeError } = require(path.join(repoRoot, "examples", "electron-basic", "smoke-error.cjs"));
  const overlayError = new Error("Steam overlay native host is unavailable: macOS screen is locked.");
  overlayError.name = "SteamOverlayNativeHostUnavailableError";
  overlayError.code = "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE";
  overlayError.reason = "macos-screen-locked";
  overlayError.macOverlayEnvironment = { screenLocked: true, displayAsleep: false };
  overlayError.privateTransactionId = 123456789n;
  const waitError = new Error("Timed out waiting for Steam overlay to become active after 500ms.");
  waitError.name = "SteamOverlayWaitTimeoutError";
  waitError.code = "STEAM_OVERLAY_WAIT_TIMEOUT";
  waitError.state = "become active";
  waitError.timeoutMs = 500;
  waitError.targetSnapshot = {
    type: "checkout",
    steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/123456789/",
    hasSteamUrl: true,
    hasTransactionId: true
  };
  waitError.checkoutTargetSnapshot = {
    type: "checkout",
    transactionId: 123456789n,
    hasTransactionId: true
  };

  const sanitized = sanitizeSmokeValue({
    appId: 480,
    steamId64: 76561198000000000n,
    orderId: "order-private-001",
    transactionId: 123456789n,
    steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/123456789/",
    returnUrl: "steam://return/private-token",
    checkoutJsonFile: "/tmp/private-init-txn-response.json",
    checkout: {
      hasCheckoutUrl: true,
      hasTransactionId: true,
      hasReturnUrl: true
    },
    presenter: {
      currentFps: 0,
      overlayActive: false
    },
    callback: {
      authorized: true,
      owner: 76561198000000001n
    },
    response: {
      params: {
        transid: "246813579",
        orderid: "order-private-002"
      }
    },
    error: serializeSmokeError(overlayError),
    waitError: serializeSmokeError(waitError),
    launch: {
      argv: [
        "SteamBridgeSmoke",
        "--steam-bridge-smoke-checkout-transaction-id=123456789",
        "--steam-bridge-smoke-checkout-json-file=/tmp/private-init-txn-response.json",
        "--steam-bridge-smoke-control-token=super-secret-control-token",
        "--steam-bridge-smoke-web-url=https://store.steampowered.com/app/480/"
      ]
    },
    message: "approval https://checkout.steampowered.com/checkout/approvetxn/123456789/"
  });

  assert.equal(sanitized.appId, 480);
  assert.equal(sanitized.checkout.hasCheckoutUrl, true);
  assert.equal(sanitized.checkout.hasTransactionId, true);
  assert.equal(sanitized.checkout.hasReturnUrl, true);
  assert.equal(sanitized.presenter.currentFps, 0);
  assert.equal(sanitized.callback.authorized, true);
  assert.equal(sanitized.callback.owner, "[redacted-steam-id]");
  assert.equal(sanitized.response.params.transid.redacted, true);
  assert.equal(sanitized.response.params.orderid.redacted, true);
  assert.equal(sanitized.error.name, "SteamOverlayNativeHostUnavailableError");
  assert.equal(sanitized.error.code, "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE");
  assert.equal(sanitized.error.reason, "macos-screen-locked");
  assert.deepEqual(sanitized.error.macOverlayEnvironment, { screenLocked: true, displayAsleep: false });
  assert.equal(sanitized.waitError.name, "SteamOverlayWaitTimeoutError");
  assert.equal(sanitized.waitError.code, "STEAM_OVERLAY_WAIT_TIMEOUT");
  assert.equal(sanitized.waitError.state, "become active");
  assert.equal(sanitized.waitError.timeoutMs, 500);
  assert.deepEqual(sanitized.waitError.targetSnapshot, {
    type: "checkout",
    hasSteamUrl: true,
    hasTransactionId: true
  });
  assert.deepEqual(sanitized.waitError.checkoutTargetSnapshot, {
    type: "checkout",
    hasTransactionId: true
  });
  assert.equal(sanitized.steamId64.redacted, true);
  assert.equal(sanitized.transactionId.redacted, true);
  assert.equal(sanitized.steamUrl.redacted, true);
  assert.equal(sanitized.returnUrl.redacted, true);
  assert.equal(sanitized.checkoutJsonFile.redacted, true);
  assert.equal(sanitized.launch.argv[1].redacted, true);
  assert.equal(sanitized.launch.argv[2].redacted, true);
  assert.equal(sanitized.launch.argv[3].redacted, true);
  assert.equal(sanitized.message.redacted, true);

  const serialized = JSON.stringify(sanitized);
  assert.equal(serialized.includes("76561198000000000"), false);
  assert.equal(serialized.includes("76561198000000001"), false);
  assert.equal(serialized.includes("123456789"), false);
  assert.equal(serialized.includes("246813579"), false);
  assert.equal(serialized.includes("order-private-002"), false);
  assert.equal(serialized.includes("order-private-001"), false);
  assert.equal(serialized.includes("steam://return/private-token"), false);
  assert.equal(serialized.includes("private-init-txn-response"), false);
  assert.equal(serialized.includes("super-secret-control-token"), false);
});

test("native host unavailable guard accepts class and error-like shapes", (t) => {
  const steam = require(distFile("index.js"));
  t.after(clearSteamBridgeCache);

  const error = new steam.SteamOverlayNativeHostUnavailableError({
    nativeHostUnavailableReason: "macos-screen-locked",
    macOverlayEnvironment: { screenLocked: true, displayAsleep: false }
  });

  assert.equal(steam.isSteamOverlayNativeHostUnavailableError(error), true);
  assert.equal(steam.default.isSteamOverlayNativeHostUnavailableError(error), true);
  assert.equal(error instanceof steam.default.SteamOverlayNativeHostUnavailableError, true);
  assert.equal(
    steam.isSteamOverlayNativeHostUnavailableError({
      code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      reason: "macos-display-asleep"
    }),
    true
  );
  assert.equal(
    steam.isSteamOverlayNativeHostUnavailableError({
      code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      reason: "other"
    }),
    false
  );
  assert.equal(steam.isSteamOverlayNativeHostUnavailableError(new Error("nope")), false);
  assert.equal(steam.isSteamOverlayNativeHostUnavailableError(null), false);
});

test("overlay wait timeout guard accepts class and error-like shapes", (t) => {
  const steam = require(distFile("index.js"));
  t.after(clearSteamBridgeCache);

  const snapshot = {
    mode: "passive",
    backend: "macos-metal",
    attached: true,
    nativeHostOpen: true,
    overlayActive: false,
    overlayWasActive: false,
    overlayNeedsPresent: false,
    currentFps: 0,
    nativeHostUnavailableReason: "macos-screen-locked",
    macOverlayEnvironment: {
      screenLocked: true,
      displayAsleep: false
    },
    diagnostics: {
      steamRunning: true,
      appId: 480,
      overlayEnabled: false,
      overlayNeedsPresent: false,
      steamDeck: false,
      bigPicture: false,
      platform: "darwin",
      arch: "arm64",
      pid: 1234
    }
  };
  const error = new steam.SteamOverlayWaitTimeoutError("become active", 123, snapshot);

  assert.equal(steam.isSteamOverlayWaitTimeoutError(error), true);
  assert.equal(steam.default.isSteamOverlayWaitTimeoutError(error), true);
  assert.equal(error instanceof steam.default.SteamOverlayWaitTimeoutError, true);
  assert.equal(error.name, "SteamOverlayWaitTimeoutError");
  assert.equal(error.code, "STEAM_OVERLAY_WAIT_TIMEOUT");
  assert.equal(error.state, "become active");
  assert.equal(error.timeoutMs, 123);
  assert.equal(error.snapshot, snapshot);
  assert.equal(error.diagnostics, snapshot.diagnostics);
  assert.equal(error.nativeHostUnavailableReason, "macos-screen-locked");
  assert.equal(error.macOverlayEnvironment, snapshot.macOverlayEnvironment);
  assert.match(error.message, /Timed out waiting for Steam overlay to become active after 123ms/);
  assert.match(error.message, /Last presenter state: mode=passive, backend=macos-metal/);
  assert.match(error.message, /nativeHostOpen=true/);
  assert.match(error.message, /nativeHostUnavailable=macos-screen-locked/);
  assert.match(error.message, /Steam overlay diagnostics: steamRunning=true, appId=480, overlayEnabled=false/);
  assert.match(error.message, /process=darwin\/arm64\/1234/);
  assert.match(error.message, /macOverlayEnvironment: screenLocked=true, displayAsleep=false/);
  assert.equal(
    steam.isSteamOverlayWaitTimeoutError({
      code: "STEAM_OVERLAY_WAIT_TIMEOUT",
      state: "close and park",
      timeoutMs: 300000
    }),
    true
  );
  assert.equal(
    steam.isSteamOverlayWaitTimeoutError({
      code: "STEAM_OVERLAY_WAIT_TIMEOUT",
      state: "close"
    }),
    false
  );
  assert.equal(steam.isSteamOverlayWaitTimeoutError(new Error("nope")), false);
  assert.equal(steam.isSteamOverlayWaitTimeoutError(null), false);
  const rawTargetContext = {
    targetSnapshot: {
      type: "checkout",
      steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/123456789/",
      transactionId: "123456789",
      returnUrl: "steam://return/private-token",
      hasSteamUrl: true,
      hasTransactionId: true,
      hasReturnUrl: true
    },
    checkoutTargetSnapshot: {
      type: "checkout",
      steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/987654321/",
      transactionId: "987654321",
      returnUrl: "steam://return/other-private-token",
      hasSteamUrl: true,
      hasTransactionId: true,
      hasReturnUrl: true
    }
  };
  assert.deepEqual(steam.getSteamOverlayErrorTargetSnapshot(rawTargetContext), {
    type: "checkout",
    hasSteamUrl: true,
    hasTransactionId: true,
    hasReturnUrl: true
  });
  assert.deepEqual(steam.getSteamOverlayCheckoutErrorTargetSnapshot(rawTargetContext), {
    type: "checkout",
    hasSteamUrl: true,
    hasTransactionId: true,
    hasReturnUrl: true
  });
  assert.equal(JSON.stringify(steam.getSteamOverlayErrorTargetSnapshot(rawTargetContext)).includes("123456789"), false);
  assert.equal(
    JSON.stringify(steam.getSteamOverlayCheckoutErrorTargetSnapshot(rawTargetContext)).includes("987654321"),
    false
  );

  const aborted = new steam.SteamOverlayWaitAbortedError("close", snapshot);
  assert.equal(steam.isSteamOverlayWaitAbortedError(aborted), true);
  assert.equal(steam.default.isSteamOverlayWaitAbortedError(aborted), true);
  assert.equal(aborted instanceof steam.default.SteamOverlayWaitAbortedError, true);
  assert.equal(aborted.code, "STEAM_OVERLAY_WAIT_ABORTED");
  assert.equal(aborted.state, "close");
  assert.equal(aborted.snapshot, snapshot);
  assert.equal(aborted.diagnostics, snapshot.diagnostics);
  assert.equal(aborted.nativeHostUnavailableReason, "macos-screen-locked");
  assert.equal(aborted.macOverlayEnvironment, snapshot.macOverlayEnvironment);
  assert.match(aborted.message, /Aborted waiting for Steam overlay to close/);
  assert.match(aborted.message, /Last presenter state: mode=passive/);
  assert.equal(
    steam.isSteamOverlayWaitAbortedError({
      code: "STEAM_OVERLAY_WAIT_ABORTED",
      state: "close"
    }),
    true
  );
  assert.equal(steam.isSteamOverlayWaitAbortedError({ code: "STEAM_OVERLAY_WAIT_ABORTED" }), false);

  const closed = new steam.SteamOverlayWaitClosedError("close and park", snapshot);
  assert.equal(steam.isSteamOverlayWaitClosedError(closed), true);
  assert.equal(steam.default.isSteamOverlayWaitClosedError(closed), true);
  assert.equal(closed instanceof steam.default.SteamOverlayWaitClosedError, true);
  assert.equal(closed.code, "STEAM_OVERLAY_WAIT_CLOSED");
  assert.equal(closed.state, "close and park");
  assert.equal(closed.snapshot, snapshot);
  assert.equal(closed.diagnostics, snapshot.diagnostics);
  assert.equal(closed.nativeHostUnavailableReason, "macos-screen-locked");
  assert.equal(closed.macOverlayEnvironment, snapshot.macOverlayEnvironment);
  assert.match(closed.message, /closed while waiting for Steam overlay to close and park/);
  assert.match(closed.message, /Last presenter state: mode=passive/);
  assert.equal(
    steam.isSteamOverlayWaitClosedError({
      code: "STEAM_OVERLAY_WAIT_CLOSED",
      state: "close and park"
    }),
    true
  );
  assert.equal(steam.isSteamOverlayWaitClosedError({ code: "STEAM_OVERLAY_WAIT_CLOSED" }), false);
});

test("checkout target helper unwraps InitTxn-style response envelopes", (t) => {
  const steam = require(distFile("index.js"));
  t.after(clearSteamBridgeCache);

  const target = steam.overlay.checkoutTargetFromResult(
    {
      response: {
        result: "OK",
        params: {
          transid: "246813579",
          steamurl: "https://checkout.steampowered.com/checkout/approvetxn/246813579/",
          returnurl: "steam://return-from-init-txn"
        }
      }
    },
    { modal: false }
  );

  assert.deepEqual(
    target,
    {
      type: "checkout",
      modal: false,
      steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/246813579/",
      transactionId: "246813579",
      returnUrl: "steam://return-from-init-txn"
    }
  );
  assert.deepEqual(steam.overlay.snapshotSteamOverlayTarget(target), {
    type: "checkout",
    modal: false,
    hasSteamUrl: true,
    hasTransactionId: true,
    hasReturnUrl: true
  });
  assert.deepEqual(
    steam.snapshotSteamOverlayTarget({
      type: "user",
      dialog: steam.UserDialog.Chat,
      steamId64: 76561198000000000n
    }),
    {
      type: "user",
      dialog: "chat",
      hasSteamId64: true
    }
  );
  const targetSnapshotJson = JSON.stringify(steam.overlay.snapshotSteamOverlayTarget(target));
  assert.equal(targetSnapshotJson.includes("246813579"), false);
  assert.equal(targetSnapshotJson.includes("return-from-init-txn"), false);

  assert.deepEqual(
    steam.checkoutTargetFromResult(
      {
        ok: true,
        data: {
          response: {
            params: {
              transid: "97531"
            }
          }
        }
      },
      { returnUrl: "steam://return-from-options" }
    ),
    {
      type: "checkout",
      returnUrl: "steam://return-from-options",
      transactionId: "97531"
    }
  );
});

function fakeTicket(label, calls) {
  return {
    cancel() {
      calls.push({ method: "cancelAuthTicket", args: [label] });
    },
    getBytes() {
      return Buffer.from(label);
    }
  };
}

function passiveNotificationPresenterFixture() {
  return {
    closed: false,
    attached: true,
    nativeHostOpen: true,
    macOverlayEnvironment: {
      screenLocked: false,
      displayAsleep: false
    },
    mode: "passive",
    clickThrough: true,
    focusable: false,
    transparent: true,
    overlayActive: false,
    overlayNeedsPresent: false,
    overlayNeedsPresentPollingEnabled: false,
    idleFps: 0,
    currentFps: 0,
    electronOverlay: {
      presenterMode: "persistent",
      closeWithWindow: true,
      autoPrepareForNotifications: true,
      restoreFocusDelayMs: 0,
      activationBoostMs: 0,
      activeGraceMs: 0,
      overlayShortcut: {
        enabled: true,
        targetType: "friends",
        target: { type: "friends" }
      }
    }
  };
}

function passiveNotificationResult(presenter) {
  return {
    ok: true,
    action: { ok: true, action: "presenter-achievement-progress" },
    snapshot: {
      steam: {
        initialized: true,
        running: { ok: true, value: true },
        appId: { ok: true, value: 480 },
        steamDeck: { ok: true, value: false },
        bigPicture: { ok: true, value: false },
        overlayEnabled: { ok: true, value: true },
        overlayNeedsPresent: { ok: true, value: false }
      },
      app: { appId: 480 },
      launch: {
        steamLaunch: true,
        overlayInjection: true
      },
      process: {
        platform: "darwin",
        arch: "arm64",
        pid: 1234
      },
      overlay: {
        nativePresenter: { ok: true, value: presenter },
        nativeHostAvailability: { ok: true, value: nativeHostAvailabilityFixture(presenter) }
      },
      events: [
        {
          type: "achievement:progress",
          payload: {
            achievement: "ACH_TRAVEL_FAR_SINGLE",
            indicated: true,
            presenter
          }
        },
        {
          type: "callback:achievement-stored",
          payload: { achievement: "ACH_TRAVEL_FAR_SINGLE" }
        }
      ]
    }
  };
}

function nativeHostUnavailablePresenterFixture(reason = "macos-screen-locked", macOverlayEnvironmentOverride) {
  const macOverlayEnvironment =
    macOverlayEnvironmentOverride ??
    (reason === "macos-display-asleep"
      ? { screenLocked: false, displayAsleep: true }
      : { screenLocked: true, displayAsleep: false });

  return {
    backend: "macos-metal",
    closed: false,
    attached: false,
    nativeHostOpen: false,
    nativeHostUnavailableReason: reason,
    mode: "hidden",
    clickThrough: true,
    focusable: false,
    transparent: true,
    overlayActive: false,
    overlayNeedsPresent: false,
    overlayNeedsPresentPollingEnabled: false,
    idleFps: 0,
    currentFps: 0,
    macOverlayEnvironment,
    electronOverlay: {
      presenterMode: "persistent",
      closeWithWindow: true,
      autoPrepareForNotifications: true,
      restoreFocusDelayMs: 0,
      activationBoostMs: 0,
      activeGraceMs: 0,
      overlayShortcut: {
        enabled: true,
        targetType: "friends",
        target: { type: "friends" }
      }
    }
  };
}

function nativeHostAvailabilityFixture(presenter) {
  if (!presenter) {
    return null;
  }
  if (!presenter.nativeHostUnavailableReason) {
    return {
      available: true,
      snapshot: presenter,
      diagnostics: presenter.diagnostics,
      macOverlayEnvironment: presenter.macOverlayEnvironment
    };
  }
  return {
    available: false,
    snapshot: presenter,
    diagnostics: presenter.diagnostics,
    code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
    reason: presenter.nativeHostUnavailableReason,
    nativeHostUnavailableReason: presenter.nativeHostUnavailableReason,
    macOverlayEnvironment: presenter.macOverlayEnvironment
  };
}

function actionErrorSmokeResult(error, presenter = undefined, events = []) {
  const serializedError = {
    targetSnapshot: { type: "web", hasUrl: true, modal: true },
    ...error
  };
  return {
    ok: false,
    action: {
      ok: false,
      action: "presenter-web-open-and-wait",
      error: serializedError
    },
    snapshot: {
      steam: {
        initialized: true,
        running: { ok: true, value: true },
        appId: { ok: true, value: 480 },
        steamDeck: { ok: true, value: false },
        bigPicture: { ok: true, value: false },
        overlayEnabled: { ok: true, value: true },
        overlayNeedsPresent: { ok: true, value: false }
      },
      app: { appId: 480 },
      launch: {
        steamLaunch: true,
        overlayInjection: true
      },
      process: {
        platform: "darwin",
        arch: "arm64",
        pid: 1234
      },
      overlay: presenter
        ? {
            nativePresenter: { ok: true, value: presenter },
            nativeHostAvailability: { ok: true, value: nativeHostAvailabilityFixture(presenter) }
          }
        : undefined,
      events
    }
  };
}

function createFakeNative(overrides = {}) {
  const calls = [];
  const callbacks = new Map();

  const fake = {
    calls,
    callbacks,
    init(appId) {
      calls.push({ method: "init", args: [appId] });
    },
    shutdown() {
      calls.push({ method: "shutdown", args: [] });
    },
    restartAppIfNecessary(appId) {
      calls.push({ method: "restartAppIfNecessary", args: [appId] });
      return false;
    },
    isSteamRunning() {
      return true;
    },
    getSteamInstallPath() {
      return "/tmp/steam";
    },
    runCallbacks() {
      calls.push({ method: "runCallbacks", args: [] });
    },
    initAnonymousUser() {
      calls.push({ method: "initAnonymousUser", args: [] });
      return true;
    },
    initSafe() {
      calls.push({ method: "initSafe", args: [] });
      return true;
    },
    runLegacyCallbacks() {
      calls.push({ method: "runLegacyCallbacks", args: [] });
    },
    releaseCurrentThreadMemory() {
      calls.push({ method: "releaseCurrentThreadMemory", args: [] });
    },
    setTryCatchCallbacks(enabled) {
      calls.push({ method: "setTryCatchCallbacks", args: [enabled] });
    },
    setMiniDumpComment(comment) {
      calls.push({ method: "setMiniDumpComment", args: [comment] });
    },
    writeMiniDump(structuredExceptionCode, buildId) {
      calls.push({ method: "writeMiniDump", args: [structuredExceptionCode, buildId] });
    },
    useBreakpadCrashHandler(version, date, time, fullMemoryDumps) {
      calls.push({ method: "useBreakpadCrashHandler", args: [version, date, time, fullMemoryDumps] });
    },
    setBreakpadAppId(appId) {
      calls.push({ method: "setBreakpadAppId", args: [appId] });
    },
    getSteamId() {
      return { steamId64: "76561198000000000", steamId32: "STEAM_0:0:19867136", accountId: 39734272 };
    },
    isSteamDeck() {
      return false;
    },
    getAppId() {
      return 480;
    },
    isSteamInBigPictureMode() {
      return false;
    },
    isOverlayEnabled() {
      return true;
    },
    overlayNeedsPresent() {
      return false;
    },
    isOverlayNeedsPresentPollingEnabled() {
      return true;
    },
    getOverlayDiagnostics() {
      return {
        steamRunning: true,
        steamInstallPath: "/tmp/steam",
        appId: 480,
        overlayEnabled: true,
        overlayNeedsPresent: false,
        overlayNeedsPresentPollingEnabled: true,
        steamDeck: false,
        bigPicture: false
      };
    },
    clientCreateSteamPipe() {
      calls.push({ method: "clientCreateSteamPipe", args: [] });
      return 7;
    },
    clientReleaseSteamPipe(pipe) {
      calls.push({ method: "clientReleaseSteamPipe", args: [pipe] });
      return true;
    },
    clientConnectToGlobalUser(pipe) {
      calls.push({ method: "clientConnectToGlobalUser", args: [pipe] });
      return 11;
    },
    clientCreateLocalUser(accountType) {
      calls.push({ method: "clientCreateLocalUser", args: [accountType] });
      return { user: 12, pipe: 8 };
    },
    clientReleaseUser(pipe, user) {
      calls.push({ method: "clientReleaseUser", args: [pipe, user] });
    },
    clientSetLocalIpBinding(ipv4, port) {
      calls.push({ method: "clientSetLocalIpBinding", args: [ipv4, port] });
    },
    clientGetInterface(interfaceName, user, pipe, version) {
      calls.push({ method: "clientGetInterface", args: [interfaceName, user, pipe, version] });
      return interfaceName === "missing" ? null : 4096n;
    },
    clientGetIpcCallCount() {
      calls.push({ method: "clientGetIpcCallCount", args: [] });
      return 13;
    },
    clientRegisterWarningMessageHook(handler) {
      calls.push({ method: "clientRegisterWarningMessageHook", args: [] });
      handler({ severity: 1, message: "client warning" });
      return {
        disconnect() {
          calls.push({ method: "disconnectClientWarningMessageHook", args: [] });
        }
      };
    },
    clientShutdownIfAllPipesClosed() {
      calls.push({ method: "clientShutdownIfAllPipesClosed", args: [] });
      return false;
    },
    clientRunFrameDeprecated() {
      calls.push({ method: "clientRunFrameDeprecated", args: [] });
      return true;
    },
    clientRegisterPostApiResultInProcessHook(handler) {
      calls.push({ method: "clientRegisterPostApiResultInProcessHook", args: [] });
      handler({});
      return {
        disconnect() {
          calls.push({ method: "disconnectClientPostApiResultInProcessHook", args: [] });
        }
      };
    },
    clientRegisterCheckCallbackRegisteredInProcessHook(handler, registeredReturnValue) {
      calls.push({
        method: "clientRegisterCheckCallbackRegisteredInProcessHook",
        args: [registeredReturnValue]
      });
      handler({ callback_id: 304 });
      return {
        disconnect() {
          calls.push({ method: "disconnectClientCheckCallbackRegisteredInProcessHook", args: [] });
        }
      };
    },
    clientDestroyAllInterfaces() {
      calls.push({ method: "clientDestroyAllInterfaces", args: [] });
      return true;
    },
    registerSteamCallback(callbackId, handler) {
      calls.push({ method: "registerSteamCallback", args: [callbackId] });
      callbacks.set(callbackId, handler);
      return {
        disconnect() {
          callbacks.delete(callbackId);
          calls.push({ method: "disconnectCallback", args: [callbackId] });
        }
      };
    },
    registerMicroTxnAuthorizationResponse(handler) {
      calls.push({ method: "registerMicroTxnAuthorizationResponse", args: [] });
      callbacks.set(152, handler);
      return {
        disconnect() {
          callbacks.delete(152);
          calls.push({ method: "disconnectMicroTxnAuthorizationResponse", args: [] });
        }
      };
    },
    registerGameOverlayActivated(handler) {
      calls.push({ method: "registerGameOverlayActivated", args: [] });
      callbacks.set(331, handler);
      return {
        disconnect() {
          callbacks.delete(331);
          calls.push({ method: "disconnectGameOverlayActivated", args: [] });
        }
      };
    },
    registerRawSteamCallback(callbackBasePointer, callbackId) {
      calls.push({ method: "registerRawSteamCallback", args: [callbackBasePointer, callbackId] });
    },
    unregisterRawSteamCallback(callbackBasePointer) {
      calls.push({ method: "unregisterRawSteamCallback", args: [callbackBasePointer] });
    },
    registerRawSteamCallResult(callbackBasePointer, apiCall) {
      calls.push({ method: "registerRawSteamCallResult", args: [callbackBasePointer, apiCall] });
    },
    unregisterRawSteamCallResult(callbackBasePointer, apiCall) {
      calls.push({ method: "unregisterRawSteamCallResult", args: [callbackBasePointer, apiCall] });
    },
    activateOverlay(dialog) {
      calls.push({ method: "activateOverlay", args: [dialog] });
    },
    activateOverlayToWebPage(url, modal) {
      calls.push({ method: "activateOverlayToWebPage", args: [url, modal] });
    },
    overlayActivateDialogToUser(dialog, steamId64) {
      calls.push({ method: "overlayActivateDialogToUser", args: [dialog, steamId64] });
    },
    overlayActivateInviteDialog(lobbyId) {
      calls.push({ method: "overlayActivateInviteDialog", args: [lobbyId] });
    },
    overlayActivateToStore(appId, flag) {
      calls.push({ method: "overlayActivateToStore", args: [appId, flag] });
    },
    cloudListFiles() {
      return [
        { name: "save.dat", size: "1024" },
        { name: "settings.json", size: 2048n }
      ];
    },
    cloudIsEnabledForAccount() {
      calls.push({ method: "cloudIsEnabledForAccount", args: [] });
      return true;
    },
    cloudIsEnabledForApp() {
      calls.push({ method: "cloudIsEnabledForApp", args: [] });
      return false;
    },
    cloudSetEnabledForApp(enabled) {
      calls.push({ method: "cloudSetEnabledForApp", args: [enabled] });
    },
    cloudWriteFileAsync(name, data, timeoutSeconds) {
      calls.push({ method: "cloudWriteFileAsync", args: [name, data, timeoutSeconds] });
      return Promise.resolve(1);
    },
    cloudReadFileAsync(name, offset, bytesToRead, timeoutSeconds) {
      calls.push({ method: "cloudReadFileAsync", args: [name, offset, bytesToRead, timeoutSeconds] });
      return Promise.resolve(Buffer.from("async-save"));
    },
    cloudShareFile(name, timeoutSeconds) {
      calls.push({ method: "cloudShareFile", args: [name, timeoutSeconds] });
      return Promise.resolve({ result: 1, file: "555", name });
    },
    cloudDeleteFile(name) {
      calls.push({ method: "cloudDeleteFile", args: [name] });
      return name === "old-save.dat";
    },
    cloudForgetFile(name) {
      calls.push({ method: "cloudForgetFile", args: [name] });
      return true;
    },
    cloudFileExists(name) {
      calls.push({ method: "cloudFileExists", args: [name] });
      return name === "save.dat";
    },
    cloudFilePersisted(name) {
      calls.push({ method: "cloudFilePersisted", args: [name] });
      return name === "save.dat";
    },
    cloudGetFileSize(name) {
      calls.push({ method: "cloudGetFileSize", args: [name] });
      return name === "save.dat" ? "1024" : null;
    },
    cloudGetFileTimestamp(name) {
      calls.push({ method: "cloudGetFileTimestamp", args: [name] });
      return name === "save.dat" ? 1700000000n : null;
    },
    cloudGetSyncPlatforms(name) {
      calls.push({ method: "cloudGetSyncPlatforms", args: [name] });
      return 10;
    },
    cloudSetSyncPlatforms(name, platforms) {
      calls.push({ method: "cloudSetSyncPlatforms", args: [name, platforms] });
      return true;
    },
    cloudGetQuota() {
      return { total_bytes: "100000", available_bytes: 64000n };
    },
    cloudGetLocalFileChangeCount() {
      return 1;
    },
    cloudGetLocalFileChange(index) {
      calls.push({ method: "cloudGetLocalFileChange", args: [index] });
      return index === 0 ? { name: "save.dat", change_type: 1, path_type: 2 } : null;
    },
    cloudGetLocalFileChanges() {
      return [{ name: "save.dat", change_type: 1, path_type: 2 }];
    },
    cloudBeginFileWriteBatch() {
      calls.push({ method: "cloudBeginFileWriteBatch", args: [] });
      return true;
    },
    cloudEndFileWriteBatch() {
      calls.push({ method: "cloudEndFileWriteBatch", args: [] });
      return true;
    },
    cloudOpenFileWriteStream(name) {
      calls.push({ method: "cloudOpenFileWriteStream", args: [name] });
      return "987";
    },
    cloudWriteFileStreamChunk(handle, data) {
      calls.push({ method: "cloudWriteFileStreamChunk", args: [handle, data] });
      return true;
    },
    cloudCloseFileWriteStream(handle) {
      calls.push({ method: "cloudCloseFileWriteStream", args: [handle] });
      return true;
    },
    cloudCancelFileWriteStream(handle) {
      calls.push({ method: "cloudCancelFileWriteStream", args: [handle] });
      return true;
    },
    cloudDownloadUgc(file, priority, timeoutSeconds) {
      calls.push({ method: "cloudDownloadUgc", args: [file, priority, timeoutSeconds] });
      return Promise.resolve({
        result: 1,
        file: "555",
        app_id: 480,
        size: "10",
        name: "shared.dat",
        owner: { steamId64: 76561198000000030n, steamId32: "STEAM_0:0:19867151", accountId: 39734302 }
      });
    },
    cloudDownloadUgcToLocation(file, location, priority, timeoutSeconds) {
      calls.push({ method: "cloudDownloadUgcToLocation", args: [file, location, priority, timeoutSeconds] });
      return Promise.resolve({
        result: 1,
        file: 555n,
        appId: 480,
        size: 10n,
        name: "shared.dat",
        owner: { steamId64: 76561198000000030n, steamId32: "STEAM_0:0:19867151", accountId: 39734302 }
      });
    },
    cloudGetUgcDownloadProgress(file) {
      calls.push({ method: "cloudGetUgcDownloadProgress", args: [file] });
      return { downloaded_bytes: "4", expected_bytes: 10n };
    },
    cloudGetUgcDetails(file) {
      calls.push({ method: "cloudGetUgcDetails", args: [file] });
      return {
        app_id: 480,
        name: "shared.dat",
        size: "10",
        owner: { steamId64: 76561198000000030n, steamId32: "STEAM_0:0:19867151", accountId: 39734302 }
      };
    },
    cloudReadUgc(file, bytesToRead, offset, action) {
      calls.push({ method: "cloudReadUgc", args: [file, bytesToRead, offset, action] });
      return Buffer.from("ugc");
    },
    cloudGetCachedUgcCount() {
      return 2;
    },
    cloudGetCachedUgcHandle(index) {
      calls.push({ method: "cloudGetCachedUgcHandle", args: [index] });
      return index === 0 ? "555" : null;
    },
    cloudGetCachedUgcHandles() {
      return ["555", 666n];
    },
    cloudLegacyPublishWorkshopFile(filePath, previewPath, consumerAppId, title, description, visibility, tags, fileType, timeoutSeconds) {
      calls.push({
        method: "cloudLegacyPublishWorkshopFile",
        args: [filePath, previewPath, consumerAppId, title, description, visibility, tags, fileType, timeoutSeconds]
      });
      return Promise.resolve({ result: 1, published_file_id: "12345678901234567890", needs_to_accept_agreement: true });
    },
    cloudLegacyPublishVideo(provider, videoAccount, videoIdentifier, previewPath, consumerAppId, title, description, visibility, tags, timeoutSeconds) {
      calls.push({
        method: "cloudLegacyPublishVideo",
        args: [provider, videoAccount, videoIdentifier, previewPath, consumerAppId, title, description, visibility, tags, timeoutSeconds]
      });
      return Promise.resolve({ result: 1, publishedFileId: 12345678901234567890n, needsToAcceptAgreement: false });
    },
    cloudLegacyCreatePublishedFileUpdateRequest(publishedFileId) {
      calls.push({ method: "cloudLegacyCreatePublishedFileUpdateRequest", args: [publishedFileId] });
      return "999";
    },
    cloudLegacyUpdatePublishedFileFile(handle, filePath) {
      calls.push({ method: "cloudLegacyUpdatePublishedFileFile", args: [handle, filePath] });
      return true;
    },
    cloudLegacyUpdatePublishedFilePreviewFile(handle, previewPath) {
      calls.push({ method: "cloudLegacyUpdatePublishedFilePreviewFile", args: [handle, previewPath] });
      return true;
    },
    cloudLegacyUpdatePublishedFileTitle(handle, title) {
      calls.push({ method: "cloudLegacyUpdatePublishedFileTitle", args: [handle, title] });
      return true;
    },
    cloudLegacyUpdatePublishedFileDescription(handle, description) {
      calls.push({ method: "cloudLegacyUpdatePublishedFileDescription", args: [handle, description] });
      return true;
    },
    cloudLegacyUpdatePublishedFileVisibility(handle, visibility) {
      calls.push({ method: "cloudLegacyUpdatePublishedFileVisibility", args: [handle, visibility] });
      return true;
    },
    cloudLegacyUpdatePublishedFileTags(handle, tags) {
      calls.push({ method: "cloudLegacyUpdatePublishedFileTags", args: [handle, tags] });
      return true;
    },
    cloudLegacyUpdatePublishedFileSetChangeDescription(handle, changeDescription) {
      calls.push({ method: "cloudLegacyUpdatePublishedFileSetChangeDescription", args: [handle, changeDescription] });
      return true;
    },
    cloudLegacyCommitPublishedFileUpdate(handle, timeoutSeconds) {
      calls.push({ method: "cloudLegacyCommitPublishedFileUpdate", args: [handle, timeoutSeconds] });
      return Promise.resolve({ result: 1, published_file_id: "12345678901234567890", needs_to_accept_agreement: false });
    },
    cloudLegacyGetPublishedFileDetails(publishedFileId, maxSecondsOld, timeoutSeconds) {
      calls.push({ method: "cloudLegacyGetPublishedFileDetails", args: [publishedFileId, maxSecondsOld, timeoutSeconds] });
      return Promise.resolve({
        result: 1,
        published_file_id: "12345678901234567890",
        creator_app_id: 480,
        consumer_app_id: 480,
        title: "Legacy Item",
        description: "Legacy description",
        file: "555",
        preview_file: 556n,
        owner: { steamId64: 76561198000000030n, steamId32: "STEAM_0:0:19867151", accountId: 39734302 },
        time_created: 1700000000,
        time_updated: 1700000100,
        visibility: 0,
        banned: false,
        tags: ["save", "legacy"],
        tags_truncated: false,
        file_name: "legacy.dat",
        file_size: "1024",
        preview_file_size: 256n,
        url: "https://example.invalid/item",
        file_type: 0,
        accepted_for_use: true
      });
    },
    cloudLegacyDeletePublishedFile(publishedFileId, timeoutSeconds) {
      calls.push({ method: "cloudLegacyDeletePublishedFile", args: [publishedFileId, timeoutSeconds] });
      return Promise.resolve({ result: 1, published_file_id: "12345678901234567890" });
    },
    cloudLegacyEnumerateUserPublishedFiles(startIndex, timeoutSeconds) {
      calls.push({ method: "cloudLegacyEnumerateUserPublishedFiles", args: [startIndex, timeoutSeconds] });
      return Promise.resolve({ result: 1, returned_results: 1, total_result_count: 2, published_file_ids: ["12345678901234567890"] });
    },
    cloudLegacySubscribePublishedFile(publishedFileId, timeoutSeconds) {
      calls.push({ method: "cloudLegacySubscribePublishedFile", args: [publishedFileId, timeoutSeconds] });
      return Promise.resolve({ result: 1, published_file_id: "12345678901234567890" });
    },
    cloudLegacyEnumerateUserSubscribedFiles(startIndex, timeoutSeconds) {
      calls.push({ method: "cloudLegacyEnumerateUserSubscribedFiles", args: [startIndex, timeoutSeconds] });
      return Promise.resolve({
        result: 1,
        returned_results: 1,
        total_result_count: 1,
        published_file_ids: ["12345678901234567890"],
        subscribed_times: [1700000200]
      });
    },
    cloudLegacyUnsubscribePublishedFile(publishedFileId, timeoutSeconds) {
      calls.push({ method: "cloudLegacyUnsubscribePublishedFile", args: [publishedFileId, timeoutSeconds] });
      return Promise.resolve({ result: 1, published_file_id: "12345678901234567890" });
    },
    cloudLegacyGetPublishedItemVoteDetails(publishedFileId, timeoutSeconds) {
      calls.push({ method: "cloudLegacyGetPublishedItemVoteDetails", args: [publishedFileId, timeoutSeconds] });
      return Promise.resolve({
        result: 1,
        published_file_id: "12345678901234567890",
        votes_for: 10,
        votes_against: 2,
        reports: 1,
        score: 0.9
      });
    },
    cloudLegacyUpdateUserPublishedItemVote(publishedFileId, voteUp, timeoutSeconds) {
      calls.push({ method: "cloudLegacyUpdateUserPublishedItemVote", args: [publishedFileId, voteUp, timeoutSeconds] });
      return Promise.resolve({ result: 1, published_file_id: "12345678901234567890" });
    },
    cloudLegacyGetUserPublishedItemVoteDetails(publishedFileId, timeoutSeconds) {
      calls.push({ method: "cloudLegacyGetUserPublishedItemVoteDetails", args: [publishedFileId, timeoutSeconds] });
      return Promise.resolve({ result: 1, published_file_id: "12345678901234567890", vote: 1 });
    },
    cloudLegacyEnumerateUserSharedWorkshopFiles(steamId64, startIndex, requiredTags, excludedTags, timeoutSeconds) {
      calls.push({
        method: "cloudLegacyEnumerateUserSharedWorkshopFiles",
        args: [steamId64, startIndex, requiredTags, excludedTags, timeoutSeconds]
      });
      return Promise.resolve({ result: 1, returned_results: 1, total_result_count: 1, published_file_ids: ["12345678901234567890"] });
    },
    cloudLegacySetUserPublishedFileAction(publishedFileId, action, timeoutSeconds) {
      calls.push({ method: "cloudLegacySetUserPublishedFileAction", args: [publishedFileId, action, timeoutSeconds] });
      return Promise.resolve({ result: 1, published_file_id: "12345678901234567890", action });
    },
    cloudLegacyEnumeratePublishedFilesByUserAction(action, startIndex, timeoutSeconds) {
      calls.push({ method: "cloudLegacyEnumeratePublishedFilesByUserAction", args: [action, startIndex, timeoutSeconds] });
      return Promise.resolve({
        result: 1,
        action,
        returned_results: 1,
        total_result_count: 1,
        published_file_ids: ["12345678901234567890"],
        updated_times: [1700000300]
      });
    },
    cloudLegacyEnumeratePublishedWorkshopFiles(enumerationType, startIndex, count, days, tags, userTags, timeoutSeconds) {
      calls.push({
        method: "cloudLegacyEnumeratePublishedWorkshopFiles",
        args: [enumerationType, startIndex, count, days, tags, userTags, timeoutSeconds]
      });
      return Promise.resolve({
        result: 1,
        returned_results: 1,
        total_result_count: 1,
        published_file_ids: ["12345678901234567890"],
        scores: [0.75],
        app_id: 480,
        start_index: 0
      });
    },
    inputInit() {
      calls.push({ method: "inputInit", args: [] });
    },
    inputShutdown() {
      calls.push({ method: "inputShutdown", args: [] });
    },
    inputGetControllers() {
      return [
        { handle: "123", inputType: "PS5Controller" },
        { handle: 456n, inputType: "FlightStick" }
      ];
    },
    inputRunFrame(reserved) {
      calls.push({ method: "inputRunFrame", args: [reserved] });
    },
    inputWaitForData(waitForever, timeoutMs) {
      calls.push({ method: "inputWaitForData", args: [waitForever, timeoutMs] });
      return true;
    },
    inputNewDataAvailable() {
      calls.push({ method: "inputNewDataAvailable", args: [] });
      return true;
    },
    inputEnableDeviceCallbacks() {
      calls.push({ method: "inputEnableDeviceCallbacks", args: [] });
    },
    inputRegisterActionEventCallback(handler) {
      calls.push({ method: "inputRegisterActionEventCallback", args: [] });
      handler({
        controller_handle: "123",
        event_type: 0,
        digital_action_handle: "20",
        digital_action_data: { state: true, active: true }
      });
      return {
        disconnect() {
          calls.push({ method: "disconnectInputActionEventCallback", args: [] });
        }
      };
    },
    inputSetActionManifestFilePath(path) {
      calls.push({ method: "inputSetActionManifestFilePath", args: [path] });
      return true;
    },
    inputGetControllerForGamepadIndex(index) {
      calls.push({ method: "inputGetControllerForGamepadIndex", args: [index] });
      return index === 0 ? 123n : null;
    },
    inputGetActionSet(actionSetName) {
      calls.push({ method: "inputGetActionSet", args: [actionSetName] });
      return 10n;
    },
    inputGetDigitalAction(actionName) {
      calls.push({ method: "inputGetDigitalAction", args: [actionName] });
      return 20n;
    },
    inputGetAnalogAction(actionName) {
      calls.push({ method: "inputGetAnalogAction", args: [actionName] });
      return 30n;
    },
    inputActivateActionSet(controller, actionSet) {
      calls.push({ method: "inputActivateActionSet", args: [controller, actionSet] });
    },
    inputGetCurrentActionSet(controller) {
      calls.push({ method: "inputGetCurrentActionSet", args: [controller] });
      return 10n;
    },
    inputActivateActionSetLayer(controller, actionSetLayer) {
      calls.push({ method: "inputActivateActionSetLayer", args: [controller, actionSetLayer] });
    },
    inputDeactivateActionSetLayer(controller, actionSetLayer) {
      calls.push({ method: "inputDeactivateActionSetLayer", args: [controller, actionSetLayer] });
    },
    inputDeactivateAllActionSetLayers(controller) {
      calls.push({ method: "inputDeactivateAllActionSetLayers", args: [controller] });
    },
    inputGetActiveActionSetLayers(controller) {
      calls.push({ method: "inputGetActiveActionSetLayers", args: [controller] });
      return [11n, "12"];
    },
    inputGetDigitalActionData(controller, action) {
      calls.push({ method: "inputGetDigitalActionData", args: [controller, action] });
      return { state: true, active: true };
    },
    inputIsDigitalActionPressed(controller, action) {
      calls.push({ method: "inputIsDigitalActionPressed", args: [controller, action] });
      return true;
    },
    inputGetDigitalActionOrigins(controller, actionSet, action) {
      calls.push({ method: "inputGetDigitalActionOrigins", args: [controller, actionSet, action] });
      return [1, 2];
    },
    inputGetStringForDigitalActionName(action) {
      calls.push({ method: "inputGetStringForDigitalActionName", args: [action] });
      return "jump";
    },
    inputGetAnalogActionData(controller, action) {
      calls.push({ method: "inputGetAnalogActionData", args: [controller, action] });
      return { mode: 1, x: 0.25, y: -0.5, active: true };
    },
    inputGetAnalogActionVector(controller, action) {
      calls.push({ method: "inputGetAnalogActionVector", args: [controller, action] });
      return { x: 0.25, y: -0.5 };
    },
    inputGetAnalogActionOrigins(controller, actionSet, action) {
      calls.push({ method: "inputGetAnalogActionOrigins", args: [controller, actionSet, action] });
      return [3, 4];
    },
    inputGetStringForAnalogActionName(action) {
      calls.push({ method: "inputGetStringForAnalogActionName", args: [action] });
      return "move";
    },
    inputGetGlyphPngForActionOrigin(origin, size, flags) {
      calls.push({ method: "inputGetGlyphPngForActionOrigin", args: [origin, size, flags] });
      return "/glyph.png";
    },
    inputGetGlyphSvgForActionOrigin(origin, flags) {
      calls.push({ method: "inputGetGlyphSvgForActionOrigin", args: [origin, flags] });
      return "/glyph.svg";
    },
    inputGetLegacyGlyphForActionOrigin(origin) {
      calls.push({ method: "inputGetLegacyGlyphForActionOrigin", args: [origin] });
      return "legacy";
    },
    inputGetStringForActionOrigin(origin) {
      calls.push({ method: "inputGetStringForActionOrigin", args: [origin] });
      return "A";
    },
    inputStopAnalogActionMomentum(controller, action) {
      calls.push({ method: "inputStopAnalogActionMomentum", args: [controller, action] });
    },
    inputGetMotionData(controller) {
      calls.push({ method: "inputGetMotionData", args: [controller] });
      return {
        rotation_quaternion_x: 0.1,
        rotation_quaternion_y: 0.2,
        rotation_quaternion_z: 0.3,
        rotation_quaternion_w: 1,
        position_acceleration_x: 1,
        position_acceleration_y: 2,
        position_acceleration_z: 3,
        rotation_velocity_x: 4,
        rotation_velocity_y: 5,
        rotation_velocity_z: 6
      };
    },
    inputTriggerVibration(controller, leftSpeed, rightSpeed) {
      calls.push({ method: "inputTriggerVibration", args: [controller, leftSpeed, rightSpeed] });
    },
    inputTriggerVibrationExtended(controller, leftSpeed, rightSpeed, leftTriggerSpeed, rightTriggerSpeed) {
      calls.push({
        method: "inputTriggerVibrationExtended",
        args: [controller, leftSpeed, rightSpeed, leftTriggerSpeed, rightTriggerSpeed]
      });
    },
    inputSetDualSenseTriggerEffect(controller, effect) {
      calls.push({ method: "inputSetDualSenseTriggerEffect", args: [controller, effect] });
    },
    inputTriggerSimpleHapticEvent(controller, location, intensity, gainDb, otherIntensity, otherGainDb) {
      calls.push({
        method: "inputTriggerSimpleHapticEvent",
        args: [controller, location, intensity, gainDb, otherIntensity, otherGainDb]
      });
    },
    inputSetLedColor(controller, red, green, blue, flags) {
      calls.push({ method: "inputSetLedColor", args: [controller, red, green, blue, flags] });
    },
    inputLegacyTriggerHapticPulse(controller, targetPad, durationMicroseconds) {
      calls.push({ method: "inputLegacyTriggerHapticPulse", args: [controller, targetPad, durationMicroseconds] });
    },
    inputLegacyTriggerRepeatedHapticPulse(controller, targetPad, durationMicroseconds, offMicroseconds, repeat, flags) {
      calls.push({
        method: "inputLegacyTriggerRepeatedHapticPulse",
        args: [controller, targetPad, durationMicroseconds, offMicroseconds, repeat, flags]
      });
    },
    inputShowBindingPanel(controller) {
      calls.push({ method: "inputShowBindingPanel", args: [controller] });
      return true;
    },
    inputGetControllerType(controller) {
      calls.push({ method: "inputGetControllerType", args: [controller] });
      return "PS5Controller";
    },
    inputGetGamepadIndexForController(controller) {
      calls.push({ method: "inputGetGamepadIndexForController", args: [controller] });
      return 0;
    },
    inputGetStringForXboxOrigin(origin) {
      calls.push({ method: "inputGetStringForXboxOrigin", args: [origin] });
      return "A";
    },
    inputGetGlyphForXboxOrigin(origin) {
      calls.push({ method: "inputGetGlyphForXboxOrigin", args: [origin] });
      return "xbox-a";
    },
    inputGetActionOriginFromXboxOrigin(controller, origin) {
      calls.push({ method: "inputGetActionOriginFromXboxOrigin", args: [controller, origin] });
      return 1;
    },
    inputTranslateActionOrigin(destinationInputType, sourceOrigin) {
      calls.push({ method: "inputTranslateActionOrigin", args: [destinationInputType, sourceOrigin] });
      return 50;
    },
    inputGetDeviceBindingRevision(controller) {
      calls.push({ method: "inputGetDeviceBindingRevision", args: [controller] });
      return { major: 1, minor: 2 };
    },
    inputGetRemotePlaySessionId(controller) {
      calls.push({ method: "inputGetRemotePlaySessionId", args: [controller] });
      return 42;
    },
    inputGetSessionInputConfigurationSettings() {
      calls.push({ method: "inputGetSessionInputConfigurationSettings", args: [] });
      return 3;
    },
    controllerInit() {
      calls.push({ method: "controllerInit", args: [] });
      return true;
    },
    controllerShutdown() {
      calls.push({ method: "controllerShutdown", args: [] });
      return true;
    },
    controllerRunFrame() {
      calls.push({ method: "controllerRunFrame", args: [] });
    },
    controllerGetControllers() {
      calls.push({ method: "controllerGetControllers", args: [] });
      return [{ handle: "789", inputType: "SteamController" }];
    },
    controllerGetControllerForGamepadIndex(index) {
      calls.push({ method: "controllerGetControllerForGamepadIndex", args: [index] });
      return index === 0 ? 789n : null;
    },
    controllerGetActionSet(actionSetName) {
      calls.push({ method: "controllerGetActionSet", args: [actionSetName] });
      return 110n;
    },
    controllerGetDigitalAction(actionName) {
      calls.push({ method: "controllerGetDigitalAction", args: [actionName] });
      return 120n;
    },
    controllerGetAnalogAction(actionName) {
      calls.push({ method: "controllerGetAnalogAction", args: [actionName] });
      return 130n;
    },
    controllerActivateActionSet(controller, actionSet) {
      calls.push({ method: "controllerActivateActionSet", args: [controller, actionSet] });
    },
    controllerGetCurrentActionSet(controller) {
      calls.push({ method: "controllerGetCurrentActionSet", args: [controller] });
      return 110n;
    },
    controllerActivateActionSetLayer(controller, actionSetLayer) {
      calls.push({ method: "controllerActivateActionSetLayer", args: [controller, actionSetLayer] });
    },
    controllerDeactivateActionSetLayer(controller, actionSetLayer) {
      calls.push({ method: "controllerDeactivateActionSetLayer", args: [controller, actionSetLayer] });
    },
    controllerDeactivateAllActionSetLayers(controller) {
      calls.push({ method: "controllerDeactivateAllActionSetLayers", args: [controller] });
    },
    controllerGetActiveActionSetLayers(controller) {
      calls.push({ method: "controllerGetActiveActionSetLayers", args: [controller] });
      return ["111", 112n];
    },
    controllerGetDigitalActionData(controller, action) {
      calls.push({ method: "controllerGetDigitalActionData", args: [controller, action] });
      return { state: true, active: true };
    },
    controllerIsDigitalActionPressed(controller, action) {
      calls.push({ method: "controllerIsDigitalActionPressed", args: [controller, action] });
      return true;
    },
    controllerGetDigitalActionOrigins(controller, actionSet, action) {
      calls.push({ method: "controllerGetDigitalActionOrigins", args: [controller, actionSet, action] });
      return [5, 6];
    },
    controllerGetAnalogActionData(controller, action) {
      calls.push({ method: "controllerGetAnalogActionData", args: [controller, action] });
      return { mode: 2, x: 0.5, y: -0.25, active: true };
    },
    controllerGetAnalogActionVector(controller, action) {
      calls.push({ method: "controllerGetAnalogActionVector", args: [controller, action] });
      return { x: 0.5, y: -0.25 };
    },
    controllerGetAnalogActionOrigins(controller, actionSet, action) {
      calls.push({ method: "controllerGetAnalogActionOrigins", args: [controller, actionSet, action] });
      return [7, 8];
    },
    controllerGetGlyphForActionOrigin(origin) {
      calls.push({ method: "controllerGetGlyphForActionOrigin", args: [origin] });
      return "legacy-glyph";
    },
    controllerGetStringForActionOrigin(origin) {
      calls.push({ method: "controllerGetStringForActionOrigin", args: [origin] });
      return "Legacy A";
    },
    controllerStopAnalogActionMomentum(controller, action) {
      calls.push({ method: "controllerStopAnalogActionMomentum", args: [controller, action] });
    },
    controllerGetMotionData(controller) {
      calls.push({ method: "controllerGetMotionData", args: [controller] });
      return {
        rotationQuaternionX: 0.4,
        rotationQuaternionY: 0.5,
        rotationQuaternionZ: 0.6,
        rotationQuaternionW: 1,
        positionAccelerationX: 7,
        positionAccelerationY: 8,
        positionAccelerationZ: 9,
        rotationVelocityX: 10,
        rotationVelocityY: 11,
        rotationVelocityZ: 12
      };
    },
    controllerTriggerHapticPulse(controller, targetPad, durationMicroseconds) {
      calls.push({ method: "controllerTriggerHapticPulse", args: [controller, targetPad, durationMicroseconds] });
    },
    controllerTriggerRepeatedHapticPulse(controller, targetPad, durationMicroseconds, offMicroseconds, repeat, flags) {
      calls.push({
        method: "controllerTriggerRepeatedHapticPulse",
        args: [controller, targetPad, durationMicroseconds, offMicroseconds, repeat, flags]
      });
    },
    controllerTriggerVibration(controller, leftSpeed, rightSpeed) {
      calls.push({ method: "controllerTriggerVibration", args: [controller, leftSpeed, rightSpeed] });
    },
    controllerSetLedColor(controller, red, green, blue, flags) {
      calls.push({ method: "controllerSetLedColor", args: [controller, red, green, blue, flags] });
    },
    controllerShowBindingPanel(controller) {
      calls.push({ method: "controllerShowBindingPanel", args: [controller] });
      return true;
    },
    controllerGetControllerType(controller) {
      calls.push({ method: "controllerGetControllerType", args: [controller] });
      return "SteamController";
    },
    controllerGetGamepadIndexForController(controller) {
      calls.push({ method: "controllerGetGamepadIndexForController", args: [controller] });
      return 1;
    },
    controllerGetStringForXboxOrigin(origin) {
      calls.push({ method: "controllerGetStringForXboxOrigin", args: [origin] });
      return "legacy A";
    },
    controllerGetGlyphForXboxOrigin(origin) {
      calls.push({ method: "controllerGetGlyphForXboxOrigin", args: [origin] });
      return "legacy-xbox-a";
    },
    controllerGetActionOriginFromXboxOrigin(controller, origin) {
      calls.push({ method: "controllerGetActionOriginFromXboxOrigin", args: [controller, origin] });
      return 9;
    },
    controllerTranslateActionOrigin(destinationInputType, sourceOrigin) {
      calls.push({ method: "controllerTranslateActionOrigin", args: [destinationInputType, sourceOrigin] });
      return 51;
    },
    controllerGetControllerBindingRevision(controller) {
      calls.push({ method: "controllerGetControllerBindingRevision", args: [controller] });
      return { major: 3, minor: 4 };
    },
    networkingReadP2PPacket(size) {
      calls.push({ method: "networkingReadP2PPacket", args: [size] });
      return {
        data: Buffer.from("hello"),
        size: 5,
        steamId: { steamId64: "76561198000000001", steamId32: "STEAM_0:1:19867136", accountId: 39734273 }
      };
    },
    workshopCreateItem(appId) {
      calls.push({ method: "workshopCreateItem", args: [appId] });
      return Promise.resolve({ item_id: "12345678901234567890", needs_to_accept_agreement: false });
    },
    workshopUpdateItemWithProgress(itemId, updateDetails, appId, progressHandler, progressIntervalMs) {
      calls.push({
        method: "workshopUpdateItemWithProgress",
        args: [itemId, updateDetails, appId, progressIntervalMs]
      });
      progressHandler({ status: 3, progress: "128", total: "256" });
      return Promise.resolve({ item_id: "12345678901234567890", needs_to_accept_agreement: true });
    },
    workshopGetItemUpdateProgress(handle) {
      calls.push({ method: "workshopGetItemUpdateProgress", args: [handle] });
      return { status: 3, progress: "32", total: "64" };
    },
    workshopSubscribe(itemId) {
      calls.push({ method: "workshopSubscribe", args: [itemId] });
      return Promise.resolve();
    },
    workshopUnsubscribe(itemId) {
      calls.push({ method: "workshopUnsubscribe", args: [itemId] });
      return Promise.resolve();
    },
    workshopInitWorkshopForGameServer(depotId, folder) {
      calls.push({ method: "workshopInitWorkshopForGameServer", args: [depotId, folder] });
      return true;
    },
    workshopSuspendDownloads(suspend) {
      calls.push({ method: "workshopSuspendDownloads", args: [suspend] });
    },
    workshopSetItemsDisabledLocally(itemIds, disabled) {
      calls.push({ method: "workshopSetItemsDisabledLocally", args: [itemIds, disabled] });
      return true;
    },
    workshopSetSubscriptionsLoadOrder(itemIds) {
      calls.push({ method: "workshopSetSubscriptionsLoadOrder", args: [itemIds] });
      return true;
    },
    workshopMarkDownloadedItemAsUnused(itemId) {
      calls.push({ method: "workshopMarkDownloadedItemAsUnused", args: [itemId] });
      return true;
    },
    workshopState(itemId) {
      calls.push({ method: "workshopState", args: [itemId] });
      return 4;
    },
    workshopInstallInfo(itemId) {
      calls.push({ method: "workshopInstallInfo", args: [itemId] });
      return { folder: "/tmp/workshop", sizeOnDisk: "4096", timestamp: 1700000400 };
    },
    workshopDownloadInfo(itemId) {
      calls.push({ method: "workshopDownloadInfo", args: [itemId] });
      return { current: "128", total: "256" };
    },
    workshopDownload(itemId, highPriority) {
      calls.push({ method: "workshopDownload", args: [itemId, highPriority] });
      return true;
    },
    workshopGetDownloadedItems(maxEntries) {
      calls.push({ method: "workshopGetDownloadedItems", args: [maxEntries] });
      return [42n, "43"];
    },
    workshopGetSubscribedItems() {
      calls.push({ method: "workshopGetSubscribedItems", args: [] });
      return [42n, "43"];
    },
    workshopGetItems(items, queryConfig) {
      calls.push({ method: "workshopGetItems", args: [items, queryConfig] });
      return Promise.resolve({
        items: [
          {
            published_file_id: "12345678901234567890",
            creator_app_id: 480,
            consumer_app_id: 480,
            title: "Workshop Item",
            description: "Generic workshop item",
            owner: { steamId64: "76561198000000002", steamId32: "STEAM_0:0:19867137", accountId: 39734274 },
            visibility: 0,
            tags: ["example"],
            tag_details: [{ name: "example", display_name: "Example" }],
            metadata: "{\"kind\":\"test\"}",
            children: ["43"],
            additional_previews: [{ url_or_video_id: "preview.png", original_file_name: "preview.png", preview_type: 0 }],
            key_value_tags: [{ key: "mode", value: "coop" }],
            first_key_value_tags: [{ key: "mode", value: "coop" }],
            supported_game_versions: [{ game_branch_min: "1.0", game_branch_max: "2.0" }],
            content_descriptors: [5],
            num_subscriptions: "12"
          }
        ],
        next_cursor: "cursor-2",
        was_cached: true
      });
    },
    workshopGetAllItemsByCursor(cursor, queryType, itemType, creatorAppId, consumerAppId, queryConfig) {
      calls.push({
        method: "workshopGetAllItemsByCursor",
        args: [cursor, queryType, itemType, creatorAppId, consumerAppId, queryConfig]
      });
      return this.workshopGetItems([], queryConfig);
    },
    workshopGetUserItems(page, accountId, listType, itemType, sortOrder, creatorAppId, consumerAppId, queryConfig) {
      calls.push({
        method: "workshopGetUserItems",
        args: [page, accountId, listType, itemType, sortOrder, creatorAppId, consumerAppId, queryConfig]
      });
      return this.workshopGetItems([], queryConfig);
    },
    workshopRequestItemDetails(itemId, maxAgeSeconds) {
      calls.push({ method: "workshopRequestItemDetails", args: [itemId, maxAgeSeconds] });
      return Promise.resolve({
        details: {
          published_file_id: itemId.toString(),
          creator_app_id: 480,
          title: "Workshop Item",
          tags: "space,war",
          file_size: "12",
          preview_file: "99",
          accepted_for_use: true
        },
        was_cached: true
      });
    },
    workshopAddFavorite(itemId, appId) {
      calls.push({ method: "workshopAddFavorite", args: [itemId, appId] });
      return Promise.resolve({ result: 1, item_id: itemId, was_add_request: true });
    },
    workshopRemoveFavorite(itemId, appId) {
      calls.push({ method: "workshopRemoveFavorite", args: [itemId, appId] });
      return Promise.resolve({ result: 1, itemId, wasAddRequest: false });
    },
    workshopSetUserItemVote(itemId, voteUp) {
      calls.push({ method: "workshopSetUserItemVote", args: [itemId, voteUp] });
      return Promise.resolve({ result: 1, item_id: itemId, vote_up: voteUp });
    },
    workshopGetUserItemVote(itemId) {
      calls.push({ method: "workshopGetUserItemVote", args: [itemId] });
      return Promise.resolve({ result: 1, item_id: itemId, voted_up: true, voted_down: false, vote_skipped: false });
    },
    workshopStartPlaytimeTracking(itemIds) {
      calls.push({ method: "workshopStartPlaytimeTracking", args: [itemIds] });
      return Promise.resolve({ result: 1 });
    },
    workshopStopPlaytimeTracking(itemIds) {
      calls.push({ method: "workshopStopPlaytimeTracking", args: [itemIds] });
      return Promise.resolve({ result: 1 });
    },
    workshopStopPlaytimeTrackingForAllItems() {
      calls.push({ method: "workshopStopPlaytimeTrackingForAllItems", args: [] });
      return Promise.resolve({ result: 1 });
    },
    workshopAddDependency(parentItemId, childItemId) {
      calls.push({ method: "workshopAddDependency", args: [parentItemId, childItemId] });
      return Promise.resolve({ result: 1, item_id: parentItemId, child_item_id: childItemId });
    },
    workshopRemoveDependency(parentItemId, childItemId) {
      calls.push({ method: "workshopRemoveDependency", args: [parentItemId, childItemId] });
      return Promise.resolve({ result: 1, itemId: parentItemId, childItemId });
    },
    workshopAddAppDependency(itemId, appId) {
      calls.push({ method: "workshopAddAppDependency", args: [itemId, appId] });
      return Promise.resolve({ result: 1, item_id: itemId, app_id: appId });
    },
    workshopRemoveAppDependency(itemId, appId) {
      calls.push({ method: "workshopRemoveAppDependency", args: [itemId, appId] });
      return Promise.resolve({ result: 1, itemId, appId });
    },
    workshopGetAppDependencies(itemId) {
      calls.push({ method: "workshopGetAppDependencies", args: [itemId] });
      return Promise.resolve({
        result: 1,
        item_id: itemId,
        app_ids: [480, 481],
        num_app_dependencies: 2,
        total_num_app_dependencies: 2
      });
    },
    workshopDeleteItem(itemId) {
      calls.push({ method: "workshopDeleteItem", args: [itemId] });
      return Promise.resolve({ result: 1, item_id: itemId });
    },
    workshopShowEula() {
      calls.push({ method: "workshopShowEula", args: [] });
      return true;
    },
    workshopGetEulaStatus() {
      calls.push({ method: "workshopGetEulaStatus", args: [] });
      return Promise.resolve({
        result: 1,
        app_id: 480,
        version: 2,
        action_time: 1700000400,
        accepted: true,
        needs_action: false
      });
    },
    workshopGetUserContentDescriptorPreferences(maxEntries) {
      calls.push({ method: "workshopGetUserContentDescriptorPreferences", args: [maxEntries] });
      return [1, 5];
    },
    ...overrides
  };

  return fake;
}

async function waitForCondition(predicate, timeoutMs = 500, intervalMs = 10) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (predicate()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

function steamWebOverlayCalls(fake) {
  return fake.calls.filter((call) => call.method === "activateOverlayToWebPage");
}

async function waitForNextSteamWebOverlayCall(fake, afterCount, expectedArgs, timeoutMs = 500) {
  const activated = await waitForCondition(() => steamWebOverlayCalls(fake).length > afterCount, timeoutMs);
  assert.equal(activated, true);
  assert.deepEqual(steamWebOverlayCalls(fake).at(-1), {
    method: "activateOverlayToWebPage",
    args: expectedArgs
  });
}

test("project support policy covers Steam desktop targets except Intel macOS", () => {
  const packageJson = require(path.join(repoRoot, "packages", "steam-bridge", "package.json"));
  const rootPackageJson = require(path.join(repoRoot, "package.json"));
  const rootReadme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const packageReadme = fs.readFileSync(path.join(repoRoot, "packages", "steam-bridge", "README.md"), "utf8");
  const exampleReadme = fs.readFileSync(path.join(repoRoot, "examples", "electron-basic", "README.md"), "utf8");
  const ciWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
  const releaseWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "release.yml"), "utf8");
  const targetScript = fs.readFileSync(path.join(repoRoot, "scripts", "assert-supported-targets.cjs"), "utf8");
  const packagerScript = fs.readFileSync(path.join(repoRoot, "scripts", "package-electron-example.cjs"), "utf8");
  const prepareMacosScript = fs.readFileSync(
    path.join(repoRoot, "packages", "steam-bridge", "bin", "prepare-macos-app.cjs"),
    "utf8"
  );
  const verifyMacosScript = fs.readFileSync(
    path.join(repoRoot, "packages", "steam-bridge", "bin", "verify-macos-signing.cjs"),
    "utf8"
  );
  const loader = fs.readFileSync(path.join(repoRoot, "packages", "steam-bridge", "src", "native.ts"), "utf8");
  const linkScript = fs.readFileSync(
    path.join(repoRoot, "packages", "steam-bridge", "scripts", "link-native.cjs"),
    "utf8"
  );

  const supportedTargets = [
    "aarch64-apple-darwin",
    "x86_64-pc-windows-msvc",
    "x86_64-unknown-linux-gnu"
  ];

  assert.equal(packageJson.os, undefined);
  assert.equal(packageJson.cpu, undefined);
  assert.deepEqual(packageJson.napi.targets, supportedTargets);
  assert.ok(packageJson.files.includes("libsteam_api.*"));
  assert.ok(packageJson.files.includes("steam_api*.dll"));
  assert.match(rootPackageJson.scripts["native:build"], /scripts\/build-native\.cjs/);
  assert.match(rootPackageJson.scripts["native:check"], /scripts\/check-native\.cjs/);
  assert.match(rootPackageJson.scripts["check:platform"], /assert-supported-targets\.cjs/);
  assert.match(rootPackageJson.scripts["api:check"], /audit-steam-api-coverage\.cjs/);
  assert.match(rootPackageJson.scripts["steamworks-enums:generate"], /generate-steamworks-enums\.cjs/);

  for (const workflow of [ciWorkflow, releaseWorkflow]) {
    for (const target of supportedTargets) {
      assert.match(workflow, new RegExp(target));
    }
    assert.match(workflow, /node scripts\/assert-supported-targets\.cjs/);
  }
  assert.match(ciWorkflow, /npm run api:check/);

  for (const source of [ciWorkflow, releaseWorkflow, loader, linkScript, packagerScript, prepareMacosScript]) {
    assert.doesNotMatch(source, /x86_64-apple-darwin|darwin-x64|macos-13/);
  }
  assert.match(targetScript, /x86_64-apple-darwin/);
  assert.match(loader, /Intel macOS is not supported/);
  assert.match(rootReadme, /Do not package, launch, or verify macOS smoke apps through Rosetta/);
  assert.match(packageReadme, /Do not package, launch, or verify macOS smoke\s+apps through Rosetta/);
  assert.match(exampleReadme, /Do not\s+launch these macOS smoke apps through Rosetta/);
  assert.match(
    packagerScript,
    /"aarch64-apple-darwin":\s*\{[\s\S]*?platform:\s*"darwin"[\s\S]*?arch:\s*"arm64"/
  );
  assert.match(packagerScript, /assertSupportedPackageHost\(target\)/);
  assert.match(
    packagerScript,
    /Steam Bridge does not build, run, or verify Intel or multi-arch macOS test apps/
  );
  assert.doesNotMatch(packagerScript, /platform:\s*"darwin"[\s\S]{0,160}arch:\s*"x64"|universal2?/);
  assert.match(prepareMacosScript, /"-arch",\s*"arm64"/);
  assert.match(verifyMacosScript, /must contain only an arm64 macOS slice/);
});

test("smoke result verifier accepts passive notification evidence with lifecycle callbacks", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-passive-verify-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const presenter = passiveNotificationPresenterFixture();
  const resultFile = path.join(tempDir, "smoke.log");
  const diagnosticDir = path.join(tempDir, "diagnostics");
  fs.mkdirSync(diagnosticDir, { recursive: true });
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(passiveNotificationResult(presenter))}\n`
  );
  fs.writeFileSync(
    path.join(diagnosticDir, "lifecycle.jsonl"),
    [
      { type: "event:achievement:progress", payload: { indicated: true, presenter } },
      { type: "event:callback:achievement-stored", payload: { achievement: "ACH_TRAVEL_FAR_SINGLE" } }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n")
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--diagnostic-dir",
      diagnosticDir,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-achievement-progress",
      "--require-passive-notification"
    ],
    { encoding: "utf8" }
  );

  assert.equal(verifier.status, 0, verifier.stderr);
  assert.match(verifier.stdout, /Electron smoke result verified/);
});

test("smoke result verifier accepts unavailable macOS passive notification evidence", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-passive-unavailable-verify-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const presenter = nativeHostUnavailablePresenterFixture("macos-screen-locked", {
    screenLocked: true,
    displayAsleep: true
  });
  const resultFile = path.join(tempDir, "smoke.log");
  const diagnosticDir = path.join(tempDir, "diagnostics");
  fs.mkdirSync(diagnosticDir, { recursive: true });
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(passiveNotificationResult(presenter))}\n`
  );
  fs.writeFileSync(
    path.join(diagnosticDir, "lifecycle.jsonl"),
    [
      { type: "event:achievement:progress", payload: { indicated: true, presenter } },
      { type: "event:callback:achievement-stored", payload: { achievement: "ACH_TRAVEL_FAR_SINGLE" } }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n")
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--diagnostic-dir",
      diagnosticDir,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-achievement-progress",
      "--require-native-host-unavailable-reason",
      "macos-screen-locked",
      "--require-no-overlay-activation",
      "--require-passive-notification"
    ],
    { encoding: "utf8" }
  );

  assert.equal(verifier.status, 0, verifier.stderr);
  assert.match(verifier.stdout, /Electron smoke result verified/);
});

test("smoke result verifier rejects Darwin passive notification evidence without mac overlay environment", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-passive-verify-macenv-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const presenter = passiveNotificationPresenterFixture();
  delete presenter.macOverlayEnvironment;
  const resultFile = path.join(tempDir, "smoke.log");
  const diagnosticDir = path.join(tempDir, "diagnostics");
  fs.mkdirSync(diagnosticDir, { recursive: true });
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(passiveNotificationResult(presenter))}\n`
  );
  fs.writeFileSync(
    path.join(diagnosticDir, "lifecycle.jsonl"),
    [
      { type: "event:achievement:progress", payload: { indicated: true, presenter } },
      { type: "event:callback:achievement-stored", payload: { achievement: "ACH_TRAVEL_FAR_SINGLE" } }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n")
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--diagnostic-dir",
      diagnosticDir,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-achievement-progress",
      "--require-passive-notification"
    ],
    { encoding: "utf8" }
  );

  assert.notEqual(verifier.status, 0);
  assert.match(verifier.stderr, /mac overlay environment available/);
});

test("smoke result verifier rejects available passive evidence when unavailable is required", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-passive-unavailable-missing-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const presenter = passiveNotificationPresenterFixture();
  const resultFile = path.join(tempDir, "smoke.log");
  const diagnosticDir = path.join(tempDir, "diagnostics");
  fs.mkdirSync(diagnosticDir, { recursive: true });
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(passiveNotificationResult(presenter))}\n`
  );
  fs.writeFileSync(
    path.join(diagnosticDir, "lifecycle.jsonl"),
    [
      { type: "event:achievement:progress", payload: { indicated: true, presenter } },
      { type: "event:callback:achievement-stored", payload: { achievement: "ACH_TRAVEL_FAR_SINGLE" } }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n")
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--diagnostic-dir",
      diagnosticDir,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-achievement-progress",
      "--require-native-host-unavailable-reason",
      "macos-screen-locked",
      "--require-no-overlay-activation",
      "--require-passive-notification"
    ],
    { encoding: "utf8" }
  );

  assert.notEqual(verifier.status, 0);
  assert.match(verifier.stderr, /native host unavailable reason is macos-screen-locked/);
});

test("smoke result verifier rejects passive notification evidence without lifecycle callbacks", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-passive-verify-missing-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const presenter = passiveNotificationPresenterFixture();
  const resultFile = path.join(tempDir, "smoke.log");
  const diagnosticDir = path.join(tempDir, "diagnostics");
  fs.mkdirSync(diagnosticDir, { recursive: true });
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(passiveNotificationResult(presenter))}\n`
  );
  fs.writeFileSync(
    path.join(diagnosticDir, "lifecycle.jsonl"),
    `${JSON.stringify({ type: "event:achievement:progress", payload: { indicated: true, presenter } })}\n`
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--diagnostic-dir",
      diagnosticDir,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-achievement-progress",
      "--require-passive-notification"
    ],
    { encoding: "utf8" }
  );

  assert.notEqual(verifier.status, 0);
  assert.match(verifier.stderr, /lifecycle event event:callback:achievement-stored emitted/);
});

test("smoke result verifier accepts expected overlay action errors", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-action-error-verify-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(
      actionErrorSmokeResult({
        name: "SteamOverlayNativeHostUnavailableError",
        message: "Steam overlay native host is unavailable: macOS screen is locked.",
        code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
        reason: "macos-screen-locked",
        macOverlayEnvironment: { screenLocked: true, displayAsleep: false }
      })
    )}\n`
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-web-open-and-wait",
      "--require-action-error-code",
      "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      "--require-action-error-reason",
      "macos-screen-locked"
    ],
    { encoding: "utf8" }
  );

  assert.equal(verifier.status, 0, verifier.stderr);
  assert.match(verifier.stdout, /Electron smoke result verified/);
});

test("smoke result verifier accepts checkout action error target snapshots", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-checkout-action-error-verify-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  const result = actionErrorSmokeResult({
    name: "SteamOverlayNativeHostUnavailableError",
    message: "Steam overlay native host is unavailable: macOS screen is locked.",
    code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
    reason: "macos-screen-locked",
    targetSnapshot: { type: "checkout", hasTransactionId: true },
    checkoutTargetSnapshot: { type: "checkout", hasTransactionId: true },
    macOverlayEnvironment: { screenLocked: true, displayAsleep: false }
  });
  result.action.action = "presenter-checkout";
  fs.writeFileSync(resultFile, `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(result)}\n`);

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-checkout",
      "--require-action-error-code",
      "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      "--require-action-error-reason",
      "macos-screen-locked"
    ],
    { encoding: "utf8" }
  );

  assert.equal(verifier.status, 0, verifier.stderr);
  assert.match(verifier.stdout, /Electron smoke result verified/);
});

test("smoke result verifier rejects expected overlay action errors without target snapshots", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-action-error-target-missing-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  const result = actionErrorSmokeResult({
    name: "SteamOverlayNativeHostUnavailableError",
    message: "Steam overlay native host is unavailable: macOS screen is locked.",
    code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
    reason: "macos-screen-locked",
    macOverlayEnvironment: { screenLocked: true, displayAsleep: false }
  });
  delete result.action.error.targetSnapshot;
  fs.writeFileSync(resultFile, `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(result)}\n`);

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-web-open-and-wait",
      "--require-action-error-code",
      "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      "--require-action-error-reason",
      "macos-screen-locked"
    ],
    { encoding: "utf8" }
  );

  assert.notEqual(verifier.status, 0);
  assert.match(verifier.stderr, /autorun action error includes sanitized targetSnapshot/);
});

test("smoke result verifier rejects raw action error target fields", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-action-error-target-raw-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(
      actionErrorSmokeResult({
        name: "SteamOverlayNativeHostUnavailableError",
        message: "Steam overlay native host is unavailable: macOS screen is locked.",
        code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
        reason: "macos-screen-locked",
        targetSnapshot: { type: "web", url: "https://store.steampowered.com/private-checkout" },
        macOverlayEnvironment: { screenLocked: true, displayAsleep: false }
      })
    )}\n`
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-web-open-and-wait",
      "--require-action-error-code",
      "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      "--require-action-error-reason",
      "macos-screen-locked"
    ],
    { encoding: "utf8" }
  );

  assert.notEqual(verifier.status, 0);
  assert.match(verifier.stderr, /autorun action error targetSnapshot omits raw url/);
});

test("smoke result verifier rejects unexpected overlay action error reasons", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-action-error-verify-mismatch-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(
      actionErrorSmokeResult({
        name: "SteamOverlayNativeHostUnavailableError",
        message: "Steam overlay native host is unavailable: macOS screen is locked.",
        code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
        reason: "macos-screen-locked",
        macOverlayEnvironment: { screenLocked: true, displayAsleep: false }
      })
    )}\n`
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-web-open-and-wait",
      "--require-action-error-code",
      "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      "--require-action-error-reason",
      "macos-display-asleep"
    ],
    { encoding: "utf8" }
  );

  assert.notEqual(verifier.status, 0);
  assert.match(verifier.stderr, /autorun action error reason is macos-display-asleep/);
});

test("smoke result verifier accepts native host unavailable presenter evidence", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-host-unavailable-verify-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(
      actionErrorSmokeResult(
        {
          name: "SteamOverlayNativeHostUnavailableError",
          message: "Steam overlay native host is unavailable: macOS screen is locked.",
          code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
          reason: "macos-screen-locked",
          macOverlayEnvironment: { screenLocked: true, displayAsleep: false }
        },
        nativeHostUnavailablePresenterFixture("macos-screen-locked")
      )
    )}\n`
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-web-open-and-wait",
      "--require-action-error-code",
      "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      "--require-action-error-reason",
      "macos-screen-locked",
      "--require-native-host-unavailable-reason",
      "macos-screen-locked"
    ],
    { encoding: "utf8" }
  );

  assert.equal(verifier.status, 0, verifier.stderr);
  assert.match(verifier.stdout, /Electron smoke result verified/);
});

test("smoke result verifier accepts locked macOS sessions with sleeping display", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-host-unavailable-locked-asleep-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  const lockedAsleepEnvironment = { screenLocked: true, displayAsleep: true };
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(
      actionErrorSmokeResult(
        {
          name: "SteamOverlayNativeHostUnavailableError",
          message: "Steam overlay native host is unavailable: macOS screen is locked.",
          code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
          reason: "macos-screen-locked",
          macOverlayEnvironment: lockedAsleepEnvironment
        },
        nativeHostUnavailablePresenterFixture("macos-screen-locked", lockedAsleepEnvironment)
      )
    )}\n`
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-web-open-and-wait",
      "--require-action-error-code",
      "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      "--require-action-error-reason",
      "macos-screen-locked",
      "--require-native-host-unavailable-reason",
      "macos-screen-locked"
    ],
    { encoding: "utf8" }
  );

  assert.equal(verifier.status, 0, verifier.stderr);
  assert.match(verifier.stdout, /Electron smoke result verified/);
});

test("smoke result verifier rejects unexpected native host unavailable presenter evidence", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-host-unavailable-verify-mismatch-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(
      actionErrorSmokeResult(
        {
          name: "SteamOverlayNativeHostUnavailableError",
          message: "Steam overlay native host is unavailable: macOS screen is locked.",
          code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
          reason: "macos-screen-locked",
          macOverlayEnvironment: { screenLocked: true, displayAsleep: false }
        },
        nativeHostUnavailablePresenterFixture("macos-screen-locked")
      )
    )}\n`
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-web-open-and-wait",
      "--require-action-error-code",
      "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      "--require-action-error-reason",
      "macos-screen-locked",
      "--require-native-host-unavailable-reason",
      "macos-display-asleep"
    ],
    { encoding: "utf8" }
  );

  assert.notEqual(verifier.status, 0);
  assert.match(verifier.stderr, /native host unavailable reason is macos-display-asleep/);
});

test("smoke result verifier accepts expected absence of overlay activation", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-no-overlay-activation-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(
      actionErrorSmokeResult(
        {
          name: "SteamOverlayNativeHostUnavailableError",
          message: "Steam overlay native host is unavailable: macOS screen is locked.",
          code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
          reason: "macos-screen-locked",
          macOverlayEnvironment: { screenLocked: true, displayAsleep: false }
        },
        nativeHostUnavailablePresenterFixture("macos-screen-locked")
      )
    )}\n`
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-web-open-and-wait",
      "--require-action-error-code",
      "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      "--require-action-error-reason",
      "macos-screen-locked",
      "--require-native-host-unavailable-reason",
      "macos-screen-locked",
      "--require-no-overlay-activation"
    ],
    { encoding: "utf8" }
  );

  assert.equal(verifier.status, 0, verifier.stderr);
  assert.match(verifier.stdout, /Electron smoke result verified/);
});

test("smoke result verifier rejects unexpected overlay activation", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-no-overlay-activation-reject-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(
      actionErrorSmokeResult(
        {
          name: "SteamOverlayNativeHostUnavailableError",
          message: "Steam overlay native host is unavailable: macOS screen is locked.",
          code: "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
          reason: "macos-screen-locked",
          macOverlayEnvironment: { screenLocked: true, displayAsleep: false }
        },
        nativeHostUnavailablePresenterFixture("macos-screen-locked"),
        [{ type: "callback:overlay-activated", payload: { active: true } }]
      )
    )}\n`
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-web-open-and-wait",
      "--require-action-error-code",
      "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE",
      "--require-action-error-reason",
      "macos-screen-locked",
      "--require-native-host-unavailable-reason",
      "macos-screen-locked",
      "--require-no-overlay-activation"
    ],
    { encoding: "utf8" }
  );

  assert.notEqual(verifier.status, 0);
  assert.match(verifier.stderr, /overlay activation callback active=true was not emitted/);
});

test("smoke result verifier accepts expected managed overlay restore focus delay", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-restore-delay-verify-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(passiveNotificationResult(passiveNotificationPresenterFixture()))}\n`
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-achievement-progress",
      "--require-restore-focus-delay-ms",
      "0"
    ],
    { encoding: "utf8" }
  );

  assert.equal(verifier.status, 0, verifier.stderr);
  assert.match(verifier.stdout, /Electron smoke result verified/);
});

test("smoke result verifier rejects unexpected managed overlay restore focus delay", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-restore-delay-reject-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const presenter = passiveNotificationPresenterFixture();
  presenter.electronOverlay.restoreFocusDelayMs = 250;
  const resultFile = path.join(tempDir, "smoke.log");
  fs.writeFileSync(resultFile, `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(passiveNotificationResult(presenter))}\n`);

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-achievement-progress",
      "--require-restore-focus-delay-ms",
      "0"
    ],
    { encoding: "utf8" }
  );

  assert.notEqual(verifier.status, 0);
  assert.match(verifier.stderr, /managed Electron overlay restore focus delay is 0ms/);
});

test("smoke result verifier accepts zero managed overlay timing", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-zero-timing-verify-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const resultFile = path.join(tempDir, "smoke.log");
  fs.writeFileSync(
    resultFile,
    `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(passiveNotificationResult(passiveNotificationPresenterFixture()))}\n`
  );

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-achievement-progress",
      "--require-zero-managed-overlay-timing"
    ],
    { encoding: "utf8" }
  );

  assert.equal(verifier.status, 0, verifier.stderr);
  assert.match(verifier.stdout, /Electron smoke result verified/);
});

test("smoke result verifier rejects nonzero managed overlay timing", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-zero-timing-reject-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const presenter = passiveNotificationPresenterFixture();
  presenter.electronOverlay.activationBoostMs = 250;
  const resultFile = path.join(tempDir, "smoke.log");
  fs.writeFileSync(resultFile, `STEAM_BRIDGE_SMOKE_RESULT ${JSON.stringify(passiveNotificationResult(presenter))}\n`);

  const verifier = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      "--file",
      resultFile,
      "--app-id",
      "480",
      "--platform",
      "darwin/arm64",
      "--action",
      "presenter-achievement-progress",
      "--require-zero-managed-overlay-timing"
    ],
    { encoding: "utf8" }
  );

  assert.notEqual(verifier.status, 0);
  assert.match(verifier.stderr, /managed Electron overlay activation boost is zero/);
});

test("generated Steamworks enums expose SDK constants and lookup helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.SteamworksEnums.EResult.k_EResultOK, 1);
  assert.equal(steam.SteamworksEnums.EHTTPStatusCode.k_EHTTPStatusCode200OK, 200);
  assert.equal(steam.SteamworksEnums.EInputActionOrigin.k_EInputActionOrigin_MaximumPossibleValue, 32767);
  assert.equal(steam.SteamworksEnums.ESteamAPIInitResult.k_ESteamAPIInitResult_VersionMismatch, 3);
  assert.equal(steam.getSteamworksEnum("EResult"), steam.SteamworksEnums.EResult);
  assert.equal(steam.getSteamworksEnumValue("EHTTPStatusCode", "k_EHTTPStatusCode404NotFound"), 404);
  assert.equal(steam.default.SteamworksEnums, steam.SteamworksEnums);

  const client = steam.createCompatibilityClient();
  assert.equal(client.SteamworksEnums, steam.SteamworksEnums);
  assert.equal(client.getSteamworksEnumValue("EServerMode", "eServerModeAuthenticationAndSecure"), 3);
});

test("init reads the Steam app ID from the environment and returns the grouped client", (t) => {
  const restoreEnv = setSteamEnv({ STEAM_APP_ID: "480" });
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(() => {
    try {
      steam.shutdown();
    } finally {
      restoreEnv();
      clearSteamBridgeCache();
    }
  });

  const client = steam.init();

  assert.deepEqual(fake.calls[0], { method: "init", args: [480] });
  assert.equal(client.overlay, steam.overlay);
  assert.equal(client.client, steam.client);
  assert.equal(client.workshop, steam.workshop);
  assert.equal(client.friends, steam.friends);
  assert.equal(client.gameServer, steam.gameServer);
  assert.equal(client.gameServerHttp, steam.gameServerHttp);
  assert.equal(steam.default.gameServerHttp, steam.gameServerHttp);
  assert.equal(client.gameServerInventory, steam.gameServerInventory);
  assert.equal(steam.default.gameServerInventory, steam.gameServerInventory);
  assert.equal(client.gameServerNetworking, steam.gameServerNetworking);
  assert.equal(steam.default.gameServerNetworking, steam.gameServerNetworking);
  assert.equal(client.gameServerNetworkingMessages, steam.gameServerNetworkingMessages);
  assert.equal(steam.default.gameServerNetworkingMessages, steam.gameServerNetworkingMessages);
  assert.equal(client.gameServerNetworkingSockets, steam.gameServerNetworkingSockets);
  assert.equal(steam.default.gameServerNetworkingSockets, steam.gameServerNetworkingSockets);
  assert.equal(client.gameServerStats, steam.gameServerStats);
  assert.equal(client.gameServerWorkshop, steam.gameServerWorkshop);
  assert.equal(steam.default.gameServerWorkshop, steam.gameServerWorkshop);
  assert.equal(client.SteamworksEnums.EResult.k_EResultOK, 1);
  assert.equal(client.getSteamworksEnumValue("EUniverse", "k_EUniversePublic"), 1);
  assert.equal(client.http, steam.http);
  assert.equal(client.inventory, steam.inventory);
  assert.equal(client.matchmakingServers, steam.matchmakingServers);
  assert.equal(client.parties, steam.parties);
  assert.equal(client.user, steam.user);
  assert.equal(client.timeline, steam.timeline);
  assert.equal(client.remotePlay, steam.remotePlay);
  assert.equal(client.localplayer.getSteamId().steamId64, 76561198000000000n);
  assert.equal(steam.initAnonymousUser(), true);
  assert.equal(steam.initSafe(), true);
  steam.runLegacyCallbacks();
  steam.releaseCurrentThreadMemory();
  steam.setTryCatchCallbacks(true);
  steam.setMiniDumpComment("diagnostic");
  steam.writeMiniDump(0, 480);
  steam.useBreakpadCrashHandler({
    version: "1.0.0",
    date: "Jan 01 2026",
    time: "00:00:00",
    fullMemoryDumps: false
  });
  steam.setBreakpadAppId(480);
  assert.deepEqual(fake.calls.filter((call) => [
    "initAnonymousUser",
    "initSafe",
    "runLegacyCallbacks",
    "releaseCurrentThreadMemory",
    "setTryCatchCallbacks",
    "setMiniDumpComment",
    "writeMiniDump",
    "useBreakpadCrashHandler",
    "setBreakpadAppId"
  ].includes(call.method)), [
    { method: "initAnonymousUser", args: [] },
    { method: "initSafe", args: [] },
    { method: "runLegacyCallbacks", args: [] },
    { method: "releaseCurrentThreadMemory", args: [] },
    { method: "setTryCatchCallbacks", args: [true] },
    { method: "setMiniDumpComment", args: ["diagnostic"] },
    { method: "writeMiniDump", args: [0, 480] },
    { method: "useBreakpadCrashHandler", args: ["1.0.0", "Jan 01 2026", "00:00:00", false] },
    { method: "setBreakpadAppId", args: [480] }
  ]);
});

test("init rejects missing app IDs with an actionable error", (t) => {
  const restoreEnv = setSteamEnv();
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(() => {
    restoreEnv();
    clearSteamBridgeCache();
  });

  assert.throws(() => steam.init(), /requires an appId or STEAM_APP_ID/);
  assert.equal(fake.calls.some((call) => call.method === "init"), false);
});

test("client facade covers low-level Steam client helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.client.SteamAccountType.Individual, 1);
  assert.equal(steam.client.createSteamPipe(), 7);
  assert.equal(steam.client.connectToGlobalUser(7), 11);
  assert.deepEqual(steam.client.createLocalUser(steam.client.SteamAccountType.AnonUser), { user: 12, pipe: 8 });
  steam.client.releaseUser(8, 12);
  assert.equal(steam.client.releaseSteamPipe(7), true);
  steam.client.setLocalIpBinding(0x7f000001, 27015);
  assert.equal(steam.client.getInterface("user", { user: 11, pipe: 7 }), 4096n);
  assert.equal(steam.client.getInterface("generic", { user: 11, pipe: 7, version: "SteamTest001" }), 4096n);
  assert.equal(steam.client.getIPCCallCount(), 13);
  assert.equal(steam.client.shutdownIfAllPipesClosed(), false);
  assert.equal(steam.client.runFrameDeprecated(), true);
  assert.equal(steam.client.destroyAllInterfaces(), true);

  let postApiResultCount = 0;
  const postApiResultHook = steam.client.registerPostApiResultInProcessHook(() => {
    postApiResultCount += 1;
  });
  postApiResultHook.disconnect();
  assert.equal(postApiResultCount, 1);

  const callbackRegistrationChecks = [];
  const callbackRegistrationHook = steam.client.registerCheckCallbackRegisteredInProcessHook((event) => {
    callbackRegistrationChecks.push(event);
  }, false);
  callbackRegistrationHook.disconnect();
  assert.deepEqual(callbackRegistrationChecks, [{ callbackId: 304 }]);

  const warnings = [];
  const hook = steam.client.registerWarningMessageHook((event) => warnings.push(event));
  hook.disconnect();
  assert.deepEqual(warnings, [{ severity: 1, message: "client warning" }]);

  assert.deepEqual(fake.calls.filter((call) => call.method.startsWith("client")), [
    { method: "clientCreateSteamPipe", args: [] },
    { method: "clientConnectToGlobalUser", args: [7] },
    { method: "clientCreateLocalUser", args: [steam.client.SteamAccountType.AnonUser] },
    { method: "clientReleaseUser", args: [8, 12] },
    { method: "clientReleaseSteamPipe", args: [7] },
    { method: "clientSetLocalIpBinding", args: [0x7f000001, 27015] },
    { method: "clientGetInterface", args: ["user", 11, 7, undefined] },
    { method: "clientGetInterface", args: ["generic", 11, 7, "SteamTest001"] },
    { method: "clientGetIpcCallCount", args: [] },
    { method: "clientShutdownIfAllPipesClosed", args: [] },
    { method: "clientRunFrameDeprecated", args: [] },
    { method: "clientDestroyAllInterfaces", args: [] },
    { method: "clientRegisterPostApiResultInProcessHook", args: [] },
    { method: "clientRegisterCheckCallbackRegisteredInProcessHook", args: [0] },
    { method: "clientRegisterWarningMessageHook", args: [] }
  ]);
  assert.deepEqual(fake.calls.find((call) => call.method === "disconnectClientPostApiResultInProcessHook"), {
    method: "disconnectClientPostApiResultInProcessHook",
    args: []
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "disconnectClientCheckCallbackRegisteredInProcessHook"), {
    method: "disconnectClientCheckCallbackRegisteredInProcessHook",
    args: []
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "disconnectClientWarningMessageHook"), {
    method: "disconnectClientWarningMessageHook",
    args: []
  });
});

test("Steam IDs and diagnostics are normalized for JavaScript callers", (t) => {
  setProcessPlatformForTest(t, "linux");
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.deepEqual(steam.getSteamId(), {
    steamId64: 76561198000000000n,
    steamId32: "STEAM_0:0:19867136",
    accountId: 39734272
  });
  assert.deepEqual(steam.utils.getOverlayDiagnostics(), {
    steamRunning: true,
    steamInstallPath: "/tmp/steam",
    appId: 480,
    overlayEnabled: true,
    overlayNeedsPresent: false,
    overlayNeedsPresentPollingEnabled: true,
    steamDeck: false,
    bigPicture: false,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid
  });
  assert.equal(steam.utils.isOverlayNeedsPresentPollingEnabled(), true);
});

test("macOS disables needs-present polling before native Steam calls by default", (t) => {
  setProcessPlatformForTest(t, "darwin");
  const previousDisable = process.env.STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT;
  const previousEnable = process.env.STEAM_BRIDGE_ENABLE_OVERLAY_NEEDS_PRESENT;
  delete process.env.STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT;
  delete process.env.STEAM_BRIDGE_ENABLE_OVERLAY_NEEDS_PRESENT;
  t.after(() => {
    if (previousDisable === undefined) {
      delete process.env.STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT;
    } else {
      process.env.STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT = previousDisable;
    }
    if (previousEnable === undefined) {
      delete process.env.STEAM_BRIDGE_ENABLE_OVERLAY_NEEDS_PRESENT;
    } else {
      process.env.STEAM_BRIDGE_ENABLE_OVERLAY_NEEDS_PRESENT = previousEnable;
    }
  });

  const fake = createFakeNative({
    overlayNeedsPresent() {
      throw new Error("BOverlayNeedsPresent should not be polled on macOS by default");
    },
    isOverlayNeedsPresentPollingEnabled() {
      throw new Error("native polling flag should not be read on macOS by default");
    },
    getOverlayDiagnostics() {
      throw new Error("native overlay diagnostics should not poll needs-present on macOS by default");
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.utils.overlayNeedsPresent(), false);
  assert.equal(steam.utils.isOverlayNeedsPresentPollingEnabled(), false);
  assert.deepEqual(steam.utils.getOverlayDiagnostics(), {
    steamRunning: true,
    steamInstallPath: "/tmp/steam",
    appId: 480,
    overlayEnabled: true,
    overlayNeedsPresent: false,
    overlayNeedsPresentPollingEnabled: false,
    steamDeck: false,
    bigPicture: false,
    platform: "darwin",
    arch: process.arch,
    pid: process.pid
  });
});

test("macOS ignores needs-present polling opt-in", (t) => {
  setProcessPlatformForTest(t, "darwin");
  const previousDisable = process.env.STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT;
  const previousEnable = process.env.STEAM_BRIDGE_ENABLE_OVERLAY_NEEDS_PRESENT;
  delete process.env.STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT;
  process.env.STEAM_BRIDGE_ENABLE_OVERLAY_NEEDS_PRESENT = "1";
  t.after(() => {
    if (previousDisable === undefined) {
      delete process.env.STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT;
    } else {
      process.env.STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT = previousDisable;
    }
    if (previousEnable === undefined) {
      delete process.env.STEAM_BRIDGE_ENABLE_OVERLAY_NEEDS_PRESENT;
    } else {
      process.env.STEAM_BRIDGE_ENABLE_OVERLAY_NEEDS_PRESENT = previousEnable;
    }
  });

  const fake = createFakeNative({
    overlayNeedsPresent() {
      throw new Error("BOverlayNeedsPresent should never be polled on macOS");
    },
    isOverlayNeedsPresentPollingEnabled() {
      throw new Error("native polling flag should not be read on macOS");
    },
    getOverlayDiagnostics() {
      throw new Error("native overlay diagnostics should not be called on macOS");
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.utils.overlayNeedsPresent(), false);
  assert.equal(steam.utils.isOverlayNeedsPresentPollingEnabled(), false);
  assert.deepEqual(
    fake.calls.filter((call) =>
      call.method === "overlayNeedsPresent" || call.method === "isOverlayNeedsPresentPollingEnabled"
    ),
    []
  );
});

test("localplayer facade covers profile and rich presence helpers", (t) => {
  const fake = createFakeNative({
    localplayerGetName() {
      this.calls.push({ method: "localplayerGetName", args: [] });
      return "SpaceWar Player";
    },
    localplayerGetLevel() {
      this.calls.push({ method: "localplayerGetLevel", args: [] });
      return 12;
    },
    localplayerGetIpCountry() {
      this.calls.push({ method: "localplayerGetIpCountry", args: [] });
      return "US";
    },
    localplayerSetRichPresence(key, value) {
      this.calls.push({ method: "localplayerSetRichPresence", args: [key, value] });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.localplayer.getName(), "SpaceWar Player");
  assert.equal(steam.localplayer.getLevel(), 12);
  assert.equal(steam.localplayer.getIpCountry(), "US");
  steam.localplayer.setRichPresence("status", "testing");
  steam.localplayer.setRichPresence("status", null);
  assert.deepEqual(fake.calls.filter((call) => call.method.startsWith("localplayer")), [
    { method: "localplayerGetName", args: [] },
    { method: "localplayerGetLevel", args: [] },
    { method: "localplayerGetIpCountry", args: [] },
    { method: "localplayerSetRichPresence", args: ["status", "testing"] },
    { method: "localplayerSetRichPresence", args: ["status", undefined] }
  ]);
});

test("auth facade forwards Steam ID and IP session ticket requests", async (t) => {
  const fake = createFakeNative({
    authGetSessionTicketWithSteamId(steamId64, timeoutSeconds) {
      this.calls.push({ method: "authGetSessionTicketWithSteamId", args: [steamId64, timeoutSeconds] });
      return Promise.resolve(fakeTicket("steam-id", this.calls));
    },
    authGetSessionTicketWithIp(ip, timeoutSeconds) {
      this.calls.push({ method: "authGetSessionTicketWithIp", args: [ip, timeoutSeconds] });
      return Promise.resolve(fakeTicket(ip, this.calls));
    },
    getAuthTicketForWebApi(identity, timeoutSeconds) {
      this.calls.push({ method: "getAuthTicketForWebApi", args: [identity, timeoutSeconds] });
      return Promise.resolve(fakeTicket("web-api", this.calls));
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(
    (await steam.auth.getSessionTicketWithSteamId(76561198000000000n, 3)).getBytes().toString(),
    "steam-id"
  );
  assert.equal((await steam.auth.getSessionTicketWithIp("127.0.0.1", 4)).getBytes().toString(), "127.0.0.1");
  const ipv6Ticket = await steam.auth.getSessionTicketWithIp("2001:db8::1", 5);
  assert.equal(ipv6Ticket.getBytes().toString(), "2001:db8::1");
  ipv6Ticket.cancel();
  assert.equal((await steam.auth.getAuthTicketForWebApi("web", 6)).getBytes().toString(), "web-api");

  assert.deepEqual(fake.calls, [
    { method: "authGetSessionTicketWithSteamId", args: [76561198000000000n, 3] },
    { method: "authGetSessionTicketWithIp", args: ["127.0.0.1", 4] },
    { method: "authGetSessionTicketWithIp", args: ["2001:db8::1", 5] },
    { method: "cancelAuthTicket", args: ["2001:db8::1"] },
    { method: "getAuthTicketForWebApi", args: ["web", 6] }
  ]);
});

test("app ticket facade normalizes ownership ticket data", (t) => {
  const ticket = Buffer.from([1, 2, 3, 4, 5, 6]);
  const fake = createFakeNative({
    appTicketGetAppOwnershipTicketData(appId, maxBytes) {
      this.calls.push({ method: "appTicketGetAppOwnershipTicketData", args: [appId, maxBytes] });
      return {
        ticket,
        bytes_written: 6,
        app_id_offset: 1,
        steam_id_offset: 2,
        signature_offset: 4,
        signature_length: 2
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.deepEqual(steam.appTicket.getAppOwnershipTicketData(480, 2048), {
    ticket,
    bytesWritten: 6,
    appIdOffset: 1,
    steamIdOffset: 2,
    signatureOffset: 4,
    signatureLength: 2
  });
  assert.deepEqual(fake.calls, [{ method: "appTicketGetAppOwnershipTicketData", args: [480, 2048] }]);
});

test("encrypted app ticket facade covers decrypt and accessors", (t) => {
  const encrypted = Uint8Array.from([9, 8, 7]);
  const decrypted = Buffer.from([1, 2, 3, 4]);
  const key = Buffer.alloc(32, 7);
  const rsaKey = Uint8Array.from([5, 6, 7]);
  const userData = Buffer.from("userdata");
  const fake = createFakeNative({
    encryptedAppTicketDecrypt(ticket, symmetricKey, maxBytes) {
      this.calls.push({ method: "encryptedAppTicketDecrypt", args: [ticket, symmetricKey, maxBytes] });
      return decrypted;
    },
    encryptedAppTicketIsTicketForApp(ticket, appId) {
      this.calls.push({ method: "encryptedAppTicketIsTicketForApp", args: [ticket, appId] });
      return true;
    },
    encryptedAppTicketGetTicketIssueTime(ticket) {
      this.calls.push({ method: "encryptedAppTicketGetTicketIssueTime", args: [ticket] });
      return 12345;
    },
    encryptedAppTicketGetTicketSteamId(ticket) {
      this.calls.push({ method: "encryptedAppTicketGetTicketSteamId", args: [ticket] });
      return { steamId64: "76561198000000000", steamId32: "STEAM_0:0:19867136", accountId: 39734272 };
    },
    encryptedAppTicketGetTicketAppId(ticket) {
      this.calls.push({ method: "encryptedAppTicketGetTicketAppId", args: [ticket] });
      return 480;
    },
    encryptedAppTicketUserOwnsAppInTicket(ticket, appId) {
      this.calls.push({ method: "encryptedAppTicketUserOwnsAppInTicket", args: [ticket, appId] });
      return true;
    },
    encryptedAppTicketUserIsVacBanned(ticket) {
      this.calls.push({ method: "encryptedAppTicketUserIsVacBanned", args: [ticket] });
      return false;
    },
    encryptedAppTicketGetAppDefinedValue(ticket) {
      this.calls.push({ method: "encryptedAppTicketGetAppDefinedValue", args: [ticket] });
      return 99;
    },
    encryptedAppTicketGetUserVariableData(ticket) {
      this.calls.push({ method: "encryptedAppTicketGetUserVariableData", args: [ticket] });
      return userData;
    },
    encryptedAppTicketIsTicketSigned(ticket, publicKey) {
      this.calls.push({ method: "encryptedAppTicketIsTicketSigned", args: [ticket, publicKey] });
      return true;
    },
    encryptedAppTicketIsLicenseBorrowed(ticket) {
      this.calls.push({ method: "encryptedAppTicketIsLicenseBorrowed", args: [ticket] });
      return false;
    },
    encryptedAppTicketIsLicenseTemporary(ticket) {
      this.calls.push({ method: "encryptedAppTicketIsLicenseTemporary", args: [ticket] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.deepEqual(steam.encryptedAppTicket.decrypt(encrypted, key, 8192), decrypted);
  assert.equal(steam.encryptedAppTicket.isTicketForApp(decrypted, 480), true);
  assert.equal(steam.encryptedAppTicket.getTicketIssueTime(decrypted), 12345);
  assert.deepEqual(steam.encryptedAppTicket.getTicketSteamId(decrypted), {
    steamId64: 76561198000000000n,
    steamId32: "STEAM_0:0:19867136",
    accountId: 39734272
  });
  assert.equal(steam.encryptedAppTicket.getTicketAppId(decrypted), 480);
  assert.equal(steam.encryptedAppTicket.userOwnsAppInTicket(decrypted, 480), true);
  assert.equal(steam.encryptedAppTicket.userIsVacBanned(decrypted), false);
  assert.equal(steam.encryptedAppTicket.getAppDefinedValue(decrypted), 99);
  assert.deepEqual(steam.encryptedAppTicket.getUserVariableData(decrypted), userData);
  assert.equal(steam.encryptedAppTicket.isTicketSigned(decrypted, rsaKey), true);
  assert.equal(steam.encryptedAppTicket.isLicenseBorrowed(decrypted), false);
  assert.equal(steam.encryptedAppTicket.isLicenseTemporary(decrypted), true);

  assert.deepEqual(fake.calls, [
    { method: "encryptedAppTicketDecrypt", args: [Buffer.from(encrypted), key, 8192] },
    { method: "encryptedAppTicketIsTicketForApp", args: [decrypted, 480] },
    { method: "encryptedAppTicketGetTicketIssueTime", args: [decrypted] },
    { method: "encryptedAppTicketGetTicketSteamId", args: [decrypted] },
    { method: "encryptedAppTicketGetTicketAppId", args: [decrypted] },
    { method: "encryptedAppTicketUserOwnsAppInTicket", args: [decrypted, 480] },
    { method: "encryptedAppTicketUserIsVacBanned", args: [decrypted] },
    { method: "encryptedAppTicketGetAppDefinedValue", args: [decrypted] },
    { method: "encryptedAppTicketGetUserVariableData", args: [decrypted] },
    { method: "encryptedAppTicketIsTicketSigned", args: [decrypted, Buffer.from(rsaKey)] },
    { method: "encryptedAppTicketIsLicenseBorrowed", args: [decrypted] },
    { method: "encryptedAppTicketIsLicenseTemporary", args: [decrypted] }
  ]);
});

test("user facade covers voice, auth session, account, and duration helpers", async (t) => {
  const ticketBytes = Buffer.from([9, 8, 7]);
  const fake = createFakeNative({
    userStartVoiceRecording() {
      this.calls.push({ method: "userStartVoiceRecording", args: [] });
    },
    userStopVoiceRecording() {
      this.calls.push({ method: "userStopVoiceRecording", args: [] });
    },
    userGetHSteamUser() {
      this.calls.push({ method: "userGetHSteamUser", args: [] });
      return 7;
    },
    userIsLoggedOn() {
      this.calls.push({ method: "userIsLoggedOn", args: [] });
      return true;
    },
    userGetAvailableVoice(sampleRate) {
      this.calls.push({ method: "userGetAvailableVoice", args: [sampleRate] });
      return { result: 0, compressed_bytes: 4, uncompressedBytes: 8 };
    },
    userGetVoice(wantCompressed, compressedBufferBytes, wantUncompressed, uncompressedBufferBytes, sampleRate) {
      this.calls.push({
        method: "userGetVoice",
        args: [wantCompressed, compressedBufferBytes, wantUncompressed, uncompressedBufferBytes, sampleRate]
      });
      return {
        result: 0,
        compressed: Buffer.from([1, 2]),
        uncompressed: Buffer.from([3, 4]),
        compressed_bytes: 2,
        uncompressedBytes: 2
      };
    },
    userDecompressVoice(compressed, maxBytes, desiredSampleRate) {
      this.calls.push({ method: "userDecompressVoice", args: [compressed, maxBytes, desiredSampleRate] });
      return {
        result: 0,
        uncompressed: Buffer.from([5, 6, 7]),
        compressedBytes: compressed.length,
        uncompressed_bytes: 3
      };
    },
    userGetVoiceOptimalSampleRate() {
      this.calls.push({ method: "userGetVoiceOptimalSampleRate", args: [] });
      return 48000;
    },
    userGetUserDataFolder() {
      this.calls.push({ method: "userGetUserDataFolder", args: [] });
      return "/tmp/steam-user";
    },
    userTrackAppUsageEvent(gameId, event, extraInfo) {
      this.calls.push({ method: "userTrackAppUsageEvent", args: [gameId, event, extraInfo] });
    },
    userBeginAuthSession(ticket, steamId64) {
      this.calls.push({ method: "userBeginAuthSession", args: [ticket, steamId64] });
      return 0;
    },
    userEndAuthSession(steamId64) {
      this.calls.push({ method: "userEndAuthSession", args: [steamId64] });
    },
    userCancelAuthTicket(authTicket) {
      this.calls.push({ method: "userCancelAuthTicket", args: [authTicket] });
    },
    userHasLicenseForApp(steamId64, appId) {
      this.calls.push({ method: "userHasLicenseForApp", args: [steamId64, appId] });
      return 0;
    },
    userIsBehindNat() {
      this.calls.push({ method: "userIsBehindNat", args: [] });
      return true;
    },
    userAdvertiseGame(steamId64, ip, port) {
      this.calls.push({ method: "userAdvertiseGame", args: [steamId64, ip, port] });
    },
    userInitiateGameConnectionDeprecated(serverSteamId64, ip, port, secure, maxBytes) {
      this.calls.push({
        method: "userInitiateGameConnectionDeprecated",
        args: [serverSteamId64, ip, port, secure, maxBytes]
      });
      return Buffer.from([4, 5, 6]);
    },
    userTerminateGameConnectionDeprecated(ip, port) {
      this.calls.push({ method: "userTerminateGameConnectionDeprecated", args: [ip, port] });
    },
    userRequestEncryptedAppTicket(dataToInclude, timeoutSeconds) {
      this.calls.push({ method: "userRequestEncryptedAppTicket", args: [dataToInclude, timeoutSeconds] });
      return Promise.resolve({ result: 0, ticket: ticketBytes });
    },
    userGetEncryptedAppTicket(maxBytes) {
      this.calls.push({ method: "userGetEncryptedAppTicket", args: [maxBytes] });
      return ticketBytes;
    },
    userGetGameBadgeLevel(series, foil) {
      this.calls.push({ method: "userGetGameBadgeLevel", args: [series, foil] });
      return foil ? 2 : 1;
    },
    userGetPlayerSteamLevel() {
      this.calls.push({ method: "userGetPlayerSteamLevel", args: [] });
      return 42;
    },
    userRequestStoreAuthUrl(redirectUrl, timeoutSeconds) {
      this.calls.push({ method: "userRequestStoreAuthUrl", args: [redirectUrl, timeoutSeconds] });
      return Promise.resolve("https://store.steampowered.com/login/");
    },
    userIsPhoneVerified() {
      this.calls.push({ method: "userIsPhoneVerified", args: [] });
      return true;
    },
    userIsTwoFactorEnabled() {
      this.calls.push({ method: "userIsTwoFactorEnabled", args: [] });
      return true;
    },
    userIsPhoneIdentifying() {
      this.calls.push({ method: "userIsPhoneIdentifying", args: [] });
      return false;
    },
    userIsPhoneRequiringVerification() {
      this.calls.push({ method: "userIsPhoneRequiringVerification", args: [] });
      return false;
    },
    userGetMarketEligibility(timeoutSeconds) {
      this.calls.push({ method: "userGetMarketEligibility", args: [timeoutSeconds] });
      return Promise.resolve({
        allowed: false,
        not_allowed_reason: 64,
        allowedAtTime: 1234,
        steam_guard_required_days: 15,
        newDeviceCooldownDays: 7
      });
    },
    userGetDurationControl(timeoutSeconds) {
      this.calls.push({ method: "userGetDurationControl", args: [timeoutSeconds] });
      return Promise.resolve({
        result: 1,
        app_id: 480,
        applicable: true,
        seconds_last_5h: 3600,
        progress: 1,
        notification: 2,
        seconds_today: 7200,
        secondsRemaining: 1800
      });
    },
    userSetDurationControlOnlineState(onlineState) {
      this.calls.push({ method: "userSetDurationControlOnlineState", args: [onlineState] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.user.VoiceResult.OK, 0);
  assert.equal(steam.user.BeginAuthSessionResult.DuplicateRequest, 2);
  assert.equal(steam.user.UserHasLicenseForAppResult.HasLicense, 0);
  assert.equal(steam.user.MarketNotAllowedReasonFlags.SteamGuardNotEnabled, 64);
  assert.equal(steam.user.DurationControlOnlineState.OnlineHighPri, 3);
  assert.equal(steam.user.DurationControlProgress.Half, 1);

  steam.user.startVoiceRecording();
  steam.user.stopVoiceRecording();
  assert.equal(steam.user.getHSteamUser(), 7);
  assert.equal(steam.user.isLoggedOn(), true);
  assert.deepEqual(steam.user.getAvailableVoice(48000), {
    result: 0,
    compressedBytes: 4,
    uncompressedBytes: 8
  });
  assert.deepEqual(steam.user.getVoice(true, 256, true, 512, 48000), {
    result: 0,
    compressed: Buffer.from([1, 2]),
    uncompressed: Buffer.from([3, 4]),
    compressedBytes: 2,
    uncompressedBytes: 2
  });
  assert.deepEqual(steam.user.decompressVoice(Buffer.from([1, 2, 3]), 1024, 48000), {
    result: 0,
    compressed: null,
    uncompressed: Buffer.from([5, 6, 7]),
    compressedBytes: 3,
    uncompressedBytes: 3
  });
  assert.equal(steam.user.getVoiceOptimalSampleRate(), 48000);
  assert.equal(steam.user.getUserDataFolder(), "/tmp/steam-user");
  steam.user.trackAppUsageEvent(480n, 1, "menu");
  assert.equal(steam.user.beginAuthSession(Buffer.from([1, 2]), 76561198000000000n), 0);
  steam.user.endAuthSession(76561198000000000n);
  steam.user.cancelAuthTicket(123);
  assert.equal(steam.user.hasLicenseForApp(76561198000000000n, 480), 0);
  assert.equal(steam.user.isBehindNAT(), true);
  steam.user.advertiseGame(76561198000000000n, 2130706433, 27015);
  assert.deepEqual(
    steam.user.initiateGameConnectionDeprecated(76561198000000001n, 2130706433, 27015, true, 2048),
    Buffer.from([4, 5, 6])
  );
  steam.user.terminateGameConnectionDeprecated(2130706433, 27015);
  assert.deepEqual(await steam.user.requestEncryptedAppTicket("abc", 7), {
    result: 0,
    ticket: ticketBytes
  });
  assert.deepEqual(steam.user.getEncryptedAppTicket(4096), ticketBytes);
  assert.equal(steam.user.getGameBadgeLevel(1, true), 2);
  assert.equal(steam.user.getPlayerSteamLevel(), 42);
  assert.equal(await steam.user.requestStoreAuthURL("https://example.test/return", 5), "https://store.steampowered.com/login/");
  assert.equal(steam.user.isPhoneVerified(), true);
  assert.equal(steam.user.isTwoFactorEnabled(), true);
  assert.equal(steam.user.isPhoneIdentifying(), false);
  assert.equal(steam.user.isPhoneRequiringVerification(), false);
  assert.deepEqual(await steam.user.getMarketEligibility(6), {
    allowed: false,
    notAllowedReason: 64,
    allowedAtTime: 1234,
    steamGuardRequiredDays: 15,
    newDeviceCooldownDays: 7
  });
  assert.deepEqual(await steam.user.getDurationControl(8), {
    result: 1,
    appId: 480,
    applicable: true,
    secondsLast5h: 3600,
    progress: 1,
    notification: 2,
    secondsToday: 7200,
    secondsRemaining: 1800
  });
  assert.equal(steam.user.setDurationControlOnlineState(steam.user.DurationControlOnlineState.Online), true);

  assert.deepEqual(
    fake.calls.filter((call) => call.method.startsWith("user")),
    [
      { method: "userStartVoiceRecording", args: [] },
      { method: "userStopVoiceRecording", args: [] },
      { method: "userGetHSteamUser", args: [] },
      { method: "userIsLoggedOn", args: [] },
      { method: "userGetAvailableVoice", args: [48000] },
      { method: "userGetVoice", args: [true, 256, true, 512, 48000] },
      { method: "userDecompressVoice", args: [Buffer.from([1, 2, 3]), 1024, 48000] },
      { method: "userGetVoiceOptimalSampleRate", args: [] },
      { method: "userGetUserDataFolder", args: [] },
      { method: "userTrackAppUsageEvent", args: [480n, 1, "menu"] },
      { method: "userBeginAuthSession", args: [Buffer.from([1, 2]), 76561198000000000n] },
      { method: "userEndAuthSession", args: [76561198000000000n] },
      { method: "userCancelAuthTicket", args: [123] },
      { method: "userHasLicenseForApp", args: [76561198000000000n, 480] },
      { method: "userIsBehindNat", args: [] },
      { method: "userAdvertiseGame", args: [76561198000000000n, 2130706433, 27015] },
      {
        method: "userInitiateGameConnectionDeprecated",
        args: [76561198000000001n, 2130706433, 27015, true, 2048]
      },
      { method: "userTerminateGameConnectionDeprecated", args: [2130706433, 27015] },
      { method: "userRequestEncryptedAppTicket", args: [Buffer.from("abc"), 7] },
      { method: "userGetEncryptedAppTicket", args: [4096] },
      { method: "userGetGameBadgeLevel", args: [1, true] },
      { method: "userGetPlayerSteamLevel", args: [] },
      { method: "userRequestStoreAuthUrl", args: ["https://example.test/return", 5] },
      { method: "userIsPhoneVerified", args: [] },
      { method: "userIsTwoFactorEnabled", args: [] },
      { method: "userIsPhoneIdentifying", args: [] },
      { method: "userIsPhoneRequiringVerification", args: [] },
      { method: "userGetMarketEligibility", args: [6] },
      { method: "userGetDurationControl", args: [8] },
      { method: "userSetDurationControlOnlineState", args: [2] }
    ]
  );
});

test("user facade exposes typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  let denyEvent;
  let licenseEvent;
  let validateTicketEvent;
  let encryptedTicketEvent;
  let authSessionTicketEvent;
  let gameWebEvent;
  let storeAuthURLEvent;
  let marketEvent;
  let durationEvent;
  let webApiTicketEvent;

  const handles = [
    steam.user.onClientGameServerDeny((event) => {
      denyEvent = event;
    }),
    steam.user.onLicensesUpdated((event) => {
      licenseEvent = event;
    }),
    steam.user.onValidateAuthTicketResponse((event) => {
      validateTicketEvent = event;
    }),
    steam.user.onEncryptedAppTicketResponse((event) => {
      encryptedTicketEvent = event;
    }),
    steam.user.onGetAuthSessionTicketResponse((event) => {
      authSessionTicketEvent = event;
    }),
    steam.user.onGameWebCallback((event) => {
      gameWebEvent = event;
    }),
    steam.user.onStoreAuthURLResponse((event) => {
      storeAuthURLEvent = event;
    }),
    steam.user.onMarketEligibilityResponse((event) => {
      marketEvent = event;
    }),
    steam.user.onDurationControl((event) => {
      durationEvent = event;
    }),
    steam.user.onGetTicketForWebApiResponse((event) => {
      webApiTicketEvent = event;
    })
  ];

  fake.callbacks.get(steam.SteamCallback.ClientGameServerDeny)({
    app_id: 480,
    game_server_ip: 2130706433,
    game_server_ip_address: "127.0.0.1",
    game_server_port: 27015,
    secure: true,
    reason: 7
  });
  fake.callbacks.get(steam.SteamCallback.LicensesUpdated)({});
  fake.callbacks.get(steam.SteamCallback.ValidateAuthTicketResponse)({
    steam_id: "76561198000000010",
    auth_session_response: 1,
    owner_steam_id: "76561198000000011"
  });
  fake.callbacks.get(steam.SteamCallback.EncryptedAppTicketResponse)({ result: 1 });
  fake.callbacks.get(steam.SteamCallback.GetAuthSessionTicketResponse)({
    auth_ticket: 77,
    result: 1
  });
  fake.callbacks.get(steam.SteamCallback.GameWebCallback)({ url: "https://example.invalid/callback" });
  fake.callbacks.get(steam.SteamCallback.StoreAuthURLResponse)({ url: "https://store.steampowered.com/login/" });
  fake.callbacks.get(steam.SteamCallback.MarketEligibilityResponse)({
    allowed: false,
    not_allowed_reason: 64,
    allowed_at_time: 1234,
    steam_guard_required_days: 15,
    new_device_cooldown_days: 7
  });
  fake.callbacks.get(steam.SteamCallback.DurationControl)({
    result: 1,
    app_id: 480,
    applicable: true,
    seconds_last_5h: 3600,
    progress: 1,
    notification: 2,
    seconds_today: 7200,
    seconds_remaining: 1800
  });
  fake.callbacks.get(steam.SteamCallback.GetTicketForWebApiResponse)({
    auth_ticket: 88,
    result: 1,
    ticket_byte_length: 6,
    ticket_base64: Buffer.from("ticket").toString("base64")
  });

  assert.equal(denyEvent.appId, 480);
  assert.equal(denyEvent.gameServerIp, 2130706433);
  assert.equal(denyEvent.gameServerIpAddress, "127.0.0.1");
  assert.equal(denyEvent.gameServerPort, 27015);
  assert.equal(denyEvent.secure, true);
  assert.deepEqual(licenseEvent, {});
  assert.equal(validateTicketEvent.steamId, 76561198000000010n);
  assert.equal(validateTicketEvent.authSessionResponse, 1);
  assert.equal(validateTicketEvent.ownerSteamId, 76561198000000011n);
  assert.equal(encryptedTicketEvent.result, 1);
  assert.equal(authSessionTicketEvent.authTicket, 77);
  assert.equal(authSessionTicketEvent.result, 1);
  assert.equal(gameWebEvent.url, "https://example.invalid/callback");
  assert.equal(storeAuthURLEvent.url, "https://store.steampowered.com/login/");
  assert.equal(marketEvent.allowed, false);
  assert.equal(marketEvent.notAllowedReason, 64);
  assert.equal(marketEvent.allowedAtTime, 1234);
  assert.equal(marketEvent.steamGuardRequiredDays, 15);
  assert.equal(marketEvent.newDeviceCooldownDays, 7);
  assert.equal(durationEvent.appId, 480);
  assert.equal(durationEvent.secondsLast5h, 3600);
  assert.equal(durationEvent.secondsToday, 7200);
  assert.equal(durationEvent.secondsRemaining, 1800);
  assert.equal(webApiTicketEvent.authTicket, 88);
  assert.equal(webApiTicketEvent.ticketByteLength, 6);
  assert.equal(webApiTicketEvent.ticket.toString(), "ticket");

  for (const handle of handles) {
    handle.disconnect();
  }

  const callbackIds = [
    steam.SteamCallback.ClientGameServerDeny,
    steam.SteamCallback.LicensesUpdated,
    steam.SteamCallback.ValidateAuthTicketResponse,
    steam.SteamCallback.EncryptedAppTicketResponse,
    steam.SteamCallback.GetAuthSessionTicketResponse,
    steam.SteamCallback.GameWebCallback,
    steam.SteamCallback.StoreAuthURLResponse,
    steam.SteamCallback.MarketEligibilityResponse,
    steam.SteamCallback.DurationControl,
    steam.SteamCallback.GetTicketForWebApiResponse
  ];
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback"),
    callbackIds.map((callbackId) => ({ method: "registerSteamCallback", args: [callbackId] }))
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback"),
    callbackIds.map((callbackId) => ({ method: "disconnectCallback", args: [callbackId] }))
  );
});

test("game server facade covers lifecycle, metadata, auth, async status, and packet helpers", async (t) => {
  const serverId = { steamId64: "901234", steamId32: "STEAM_0:0:450617", accountId: 901234 };
  const playerId = { steamId64: "76561198000000020", steamId32: "STEAM_0:0:19867146", accountId: 39734292 };
  const fake = createFakeNative({
    gameServerInit(options) {
      this.calls.push({ method: "gameServerInit", args: [options] });
    },
    gameServerInitGameServer(options) {
      this.calls.push({ method: "gameServerInitGameServer", args: [options] });
      return true;
    },
    gameServerShutdown() {
      this.calls.push({ method: "gameServerShutdown", args: [] });
    },
    gameServerRunCallbacks() {
      this.calls.push({ method: "gameServerRunCallbacks", args: [] });
    },
    gameServerGetHSteamUser() {
      this.calls.push({ method: "gameServerGetHSteamUser", args: [] });
      return 42;
    },
    gameServerSetMasterServerHeartbeatIntervalDeprecated(heartbeatInterval) {
      this.calls.push({
        method: "gameServerSetMasterServerHeartbeatIntervalDeprecated",
        args: [heartbeatInterval]
      });
    },
    gameServerForceMasterServerHeartbeatDeprecated() {
      this.calls.push({ method: "gameServerForceMasterServerHeartbeatDeprecated", args: [] });
    },
    gameServerIsSecure() {
      this.calls.push({ method: "gameServerIsSecure", args: [] });
      return true;
    },
    gameServerGetSteamId() {
      this.calls.push({ method: "gameServerGetSteamId", args: [] });
      return serverId;
    },
    gameServerSetProduct(product) {
      this.calls.push({ method: "gameServerSetProduct", args: [product] });
    },
    gameServerSetGameDescription(description) {
      this.calls.push({ method: "gameServerSetGameDescription", args: [description] });
    },
    gameServerSetModDir(modDir) {
      this.calls.push({ method: "gameServerSetModDir", args: [modDir] });
    },
    gameServerSetDedicatedServer(dedicated) {
      this.calls.push({ method: "gameServerSetDedicatedServer", args: [dedicated] });
    },
    gameServerLogOn(token) {
      this.calls.push({ method: "gameServerLogOn", args: [token] });
    },
    gameServerLogOnAnonymous() {
      this.calls.push({ method: "gameServerLogOnAnonymous", args: [] });
    },
    gameServerLogOff() {
      this.calls.push({ method: "gameServerLogOff", args: [] });
    },
    gameServerIsLoggedOn() {
      this.calls.push({ method: "gameServerIsLoggedOn", args: [] });
      return true;
    },
    gameServerInterfaceIsSecure() {
      this.calls.push({ method: "gameServerInterfaceIsSecure", args: [] });
      return true;
    },
    gameServerGetInterfaceSteamId() {
      this.calls.push({ method: "gameServerGetInterfaceSteamId", args: [] });
      return serverId;
    },
    gameServerWasRestartRequested() {
      this.calls.push({ method: "gameServerWasRestartRequested", args: [] });
      return false;
    },
    gameServerSetMaxPlayerCount(playersMax) {
      this.calls.push({ method: "gameServerSetMaxPlayerCount", args: [playersMax] });
    },
    gameServerSetBotPlayerCount(botPlayers) {
      this.calls.push({ method: "gameServerSetBotPlayerCount", args: [botPlayers] });
    },
    gameServerSetServerName(name) {
      this.calls.push({ method: "gameServerSetServerName", args: [name] });
    },
    gameServerSetMapName(name) {
      this.calls.push({ method: "gameServerSetMapName", args: [name] });
    },
    gameServerSetPasswordProtected(passwordProtected) {
      this.calls.push({ method: "gameServerSetPasswordProtected", args: [passwordProtected] });
    },
    gameServerSetSpectatorPort(port) {
      this.calls.push({ method: "gameServerSetSpectatorPort", args: [port] });
    },
    gameServerSetSpectatorServerName(name) {
      this.calls.push({ method: "gameServerSetSpectatorServerName", args: [name] });
    },
    gameServerClearAllKeyValues() {
      this.calls.push({ method: "gameServerClearAllKeyValues", args: [] });
    },
    gameServerSetKeyValue(key, value) {
      this.calls.push({ method: "gameServerSetKeyValue", args: [key, value] });
    },
    gameServerSetGameTags(tags) {
      this.calls.push({ method: "gameServerSetGameTags", args: [tags] });
    },
    gameServerSetGameData(data) {
      this.calls.push({ method: "gameServerSetGameData", args: [data] });
    },
    gameServerSetRegion(region) {
      this.calls.push({ method: "gameServerSetRegion", args: [region] });
    },
    gameServerSetAdvertiseServerActive(active) {
      this.calls.push({ method: "gameServerSetAdvertiseServerActive", args: [active] });
    },
    gameServerGetAuthSessionTicket(identity, maxBytes) {
      this.calls.push({ method: "gameServerGetAuthSessionTicket", args: [identity, maxBytes] });
      return { data: Buffer.from("ticket"), handle: 77 };
    },
    gameServerBeginAuthSession(ticket, steamId64) {
      this.calls.push({ method: "gameServerBeginAuthSession", args: [ticket, steamId64] });
      return 0;
    },
    gameServerEndAuthSession(steamId64) {
      this.calls.push({ method: "gameServerEndAuthSession", args: [steamId64] });
    },
    gameServerCancelAuthTicket(authTicket) {
      this.calls.push({ method: "gameServerCancelAuthTicket", args: [authTicket] });
    },
    gameServerUserHasLicenseForApp(steamId64, appId) {
      this.calls.push({ method: "gameServerUserHasLicenseForApp", args: [steamId64, appId] });
      return 0;
    },
    gameServerRequestUserGroupStatus(steamId64, groupId64) {
      this.calls.push({ method: "gameServerRequestUserGroupStatus", args: [steamId64, groupId64] });
      return true;
    },
    gameServerGetGameplayStats() {
      this.calls.push({ method: "gameServerGetGameplayStats", args: [] });
    },
    gameServerGetServerReputation() {
      this.calls.push({ method: "gameServerGetServerReputation", args: [] });
      return Promise.resolve({
        result: 1,
        reputation_score: 900,
        banned: true,
        banned_ip: 2130706433,
        banned_ip_address: "127.0.0.1",
        banned_port: 27015,
        banned_game_id: "480",
        ban_expires: 1234567890
      });
    },
    gameServerAssociateWithClan(clanId64) {
      this.calls.push({ method: "gameServerAssociateWithClan", args: [clanId64] });
      return Promise.resolve({ result: 1 });
    },
    gameServerComputeNewPlayerCompatibility(steamId64) {
      this.calls.push({ method: "gameServerComputeNewPlayerCompatibility", args: [steamId64] });
      return Promise.resolve({
        result: 1,
        players_that_dont_like_candidate: 2,
        players_that_candidate_doesnt_like: 3,
        clan_players_that_dont_like_candidate: 4,
        candidate: playerId
      });
    },
    gameServerGetPublicIp() {
      this.calls.push({ method: "gameServerGetPublicIp", args: [] });
      return { is_set: true, ip_type: 0, ipv4: 2130706433, ipv4_address: "127.0.0.1", ipv6: null };
    },
    gameServerHandleIncomingPacket(data, srcIp, srcPort) {
      this.calls.push({ method: "gameServerHandleIncomingPacket", args: [data, srcIp, srcPort] });
      return true;
    },
    gameServerGetNextOutgoingPacket(maxBytes) {
      this.calls.push({ method: "gameServerGetNextOutgoingPacket", args: [maxBytes] });
      return { data: Buffer.from("out"), ip: 2130706433, ip_address: "127.0.0.1", port: 27015 };
    },
    gameServerSendUserConnectAndAuthenticateDeprecated(clientIp, authBlob) {
      this.calls.push({ method: "gameServerSendUserConnectAndAuthenticateDeprecated", args: [clientIp, authBlob] });
      return { success: true, steam_id: playerId };
    },
    gameServerCreateUnauthenticatedUserConnection() {
      this.calls.push({ method: "gameServerCreateUnauthenticatedUserConnection", args: [] });
      return playerId;
    },
    gameServerSendUserDisconnectDeprecated(steamId64) {
      this.calls.push({ method: "gameServerSendUserDisconnectDeprecated", args: [steamId64] });
    },
    gameServerUpdateUserData(steamId64, playerName, score) {
      this.calls.push({ method: "gameServerUpdateUserData", args: [steamId64, playerName, score] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  steam.gameServer.init({
    ip: 2130706433,
    gamePort: 27015,
    queryPort: 27016,
    serverMode: steam.ServerMode.AuthenticationAndSecure,
    version: "1.0.0.0"
  });
  assert.equal(
    steam.gameServer.initGameServer({
      ip: 2130706433,
      gamePort: 27015,
      queryPort: 27016,
      flags: 3,
      appId: 480,
      version: "1.0.0.0"
    }),
    true
  );
  steam.gameServer.runCallbacks();
  assert.equal(steam.gameServer.getHSteamUser(), 42);
  steam.gameServer.setMasterServerHeartbeatIntervalDeprecated(250);
  steam.gameServer.forceMasterServerHeartbeatDeprecated();
  assert.equal(steam.gameServer.isSecure(), true);
  assert.equal(steam.gameServer.getSteamID().steamId64, 901234n);
  steam.gameServer.setProduct("spacewar");
  steam.gameServer.setGameDescription("Spacewar");
  steam.gameServer.setModDir("spacewar");
  steam.gameServer.setDedicatedServer(true);
  steam.gameServer.logOn("token");
  steam.gameServer.logOnAnonymous();
  steam.gameServer.logOff();
  assert.equal(steam.gameServer.isLoggedOn(), true);
  assert.equal(steam.gameServer.interfaceIsSecure(), true);
  assert.equal(steam.gameServer.getInterfaceSteamID().steamId64, 901234n);
  assert.equal(steam.gameServer.wasRestartRequested(), false);
  steam.gameServer.setMaxPlayerCount(16);
  steam.gameServer.setBotPlayerCount(2);
  steam.gameServer.setServerName("Server");
  steam.gameServer.setMapName("arena");
  steam.gameServer.setPasswordProtected(false);
  steam.gameServer.setSpectatorPort(27020);
  steam.gameServer.setSpectatorServerName("Spectator");
  steam.gameServer.clearAllKeyValues();
  steam.gameServer.setKeyValue("mode", "dm");
  steam.gameServer.setGameTags("dm,pvp");
  steam.gameServer.setGameData("data");
  steam.gameServer.setRegion("usw");
  steam.gameServer.setAdvertiseServerActive(true);
  const ticket = steam.gameServer.getAuthSessionTicket({ steamId64: 76561198000000020n }, 1024);
  assert.equal(ticket.handle, 77);
  assert.equal(ticket.data.toString(), "ticket");
  assert.equal(steam.gameServer.beginAuthSession(Buffer.from("ticket"), 76561198000000020n), 0);
  steam.gameServer.endAuthSession(76561198000000020n);
  steam.gameServer.cancelAuthTicket(77);
  assert.equal(steam.gameServer.userHasLicenseForApp(76561198000000020n, 480), 0);
  assert.equal(steam.gameServer.requestUserGroupStatus(76561198000000020n, 103582791429521412n), true);
  steam.gameServer.getGameplayStats();
  const reputation = await steam.gameServer.getServerReputation();
  assert.equal(reputation.reputationScore, 900);
  assert.equal(reputation.bannedGameId, 480n);
  assert.equal(reputation.bannedIpAddress, "127.0.0.1");
  const clanResult = await steam.gameServer.associateWithClan(103582791429521412n);
  assert.equal(clanResult.result, 1);
  const compatibility = await steam.gameServer.computeNewPlayerCompatibility(76561198000000020n);
  assert.equal(compatibility.playersThatDontLikeCandidate, 2);
  assert.equal(compatibility.playersThatCandidateDoesntLike, 3);
  assert.equal(compatibility.clanPlayersThatDontLikeCandidate, 4);
  assert.equal(compatibility.candidate.steamId64, 76561198000000020n);
  assert.equal(steam.gameServer.getPublicIP().ipv4Address, "127.0.0.1");
  assert.equal(steam.gameServer.handleIncomingPacket(Buffer.from("in"), 2130706433, 27015), true);
  assert.equal(steam.gameServer.getNextOutgoingPacket(2048).data.toString(), "out");
  assert.equal(
    steam.gameServer.sendUserConnectAndAuthenticateDeprecated(2130706433, Buffer.from("auth")).steamId.steamId64,
    76561198000000020n
  );
  assert.equal(steam.gameServer.createUnauthenticatedUserConnection().steamId64, 76561198000000020n);
  steam.gameServer.sendUserDisconnectDeprecated(76561198000000020n);
  assert.equal(steam.gameServer.updateUserData(76561198000000020n, "player", 100), true);
  steam.gameServer.shutdown();

  assert.deepEqual(fake.calls[0], {
    method: "gameServerInit",
    args: [
      {
        ip: 2130706433,
        game_port: 27015,
        query_port: 27016,
        server_mode: steam.ServerMode.AuthenticationAndSecure,
        version: "1.0.0.0"
      }
    ]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerGetAuthSessionTicket"), {
    method: "gameServerGetAuthSessionTicket",
    args: [{ steamId64: 76561198000000020n }, 1024]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerInitGameServer"), {
    method: "gameServerInitGameServer",
    args: [
      {
        ip: 2130706433,
        game_port: 27015,
        query_port: 27016,
        flags: 3,
        app_id: 480,
        version: "1.0.0.0"
      }
    ]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerGetHSteamUser"), {
    method: "gameServerGetHSteamUser",
    args: []
  });
  assert.deepEqual(
    fake.calls.find((call) => call.method === "gameServerSetMasterServerHeartbeatIntervalDeprecated"),
    {
      method: "gameServerSetMasterServerHeartbeatIntervalDeprecated",
      args: [250]
    }
  );
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerForceMasterServerHeartbeatDeprecated"), {
    method: "gameServerForceMasterServerHeartbeatDeprecated",
    args: []
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerAssociateWithClan"), {
    method: "gameServerAssociateWithClan",
    args: [103582791429521412n]
  });
});

test("game server stats facade covers user stat and achievement helpers", async (t) => {
  const playerId = { steamId64: "76561198000000020", steamId32: "STEAM_0:0:19867146", accountId: 39734292 };
  const playerSteamId = 76561198000000020n;
  const fake = createFakeNative({
    gameServerStatsRequestUserStats(steamId64) {
      this.calls.push({ method: "gameServerStatsRequestUserStats", args: [steamId64] });
      return Promise.resolve({ result: 1, steam_id: playerId });
    },
    gameServerStatsGetUserInt(steamId64, name) {
      this.calls.push({ method: "gameServerStatsGetUserInt", args: [steamId64, name] });
      return 42;
    },
    gameServerStatsGetUserFloat(steamId64, name) {
      this.calls.push({ method: "gameServerStatsGetUserFloat", args: [steamId64, name] });
      return 3.5;
    },
    gameServerStatsGetUserAchievement(steamId64, name) {
      this.calls.push({ method: "gameServerStatsGetUserAchievement", args: [steamId64, name] });
      return true;
    },
    gameServerStatsSetUserInt(steamId64, name, value) {
      this.calls.push({ method: "gameServerStatsSetUserInt", args: [steamId64, name, value] });
      return true;
    },
    gameServerStatsSetUserFloat(steamId64, name, value) {
      this.calls.push({ method: "gameServerStatsSetUserFloat", args: [steamId64, name, value] });
      return true;
    },
    gameServerStatsUpdateUserAvgRate(steamId64, name, countThisSession, sessionLength) {
      this.calls.push({
        method: "gameServerStatsUpdateUserAvgRate",
        args: [steamId64, name, countThisSession, sessionLength]
      });
      return true;
    },
    gameServerStatsSetUserAchievement(steamId64, name) {
      this.calls.push({ method: "gameServerStatsSetUserAchievement", args: [steamId64, name] });
      return true;
    },
    gameServerStatsClearUserAchievement(steamId64, name) {
      this.calls.push({ method: "gameServerStatsClearUserAchievement", args: [steamId64, name] });
      return true;
    },
    gameServerStatsStoreUserStats(steamId64) {
      this.calls.push({ method: "gameServerStatsStoreUserStats", args: [steamId64] });
      return Promise.resolve({ result: 1, steamId: playerId });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.gameServer.stats, steam.gameServerStats);
  const requested = await steam.gameServer.stats.requestUserStats(playerSteamId);
  assert.equal(requested.result, 1);
  assert.equal(requested.steamId.steamId64, playerSteamId);
  assert.equal(steam.gameServer.stats.getUserInt(playerSteamId, "kills"), 42);
  assert.equal(steam.gameServer.stats.getUserFloat(playerSteamId, "accuracy"), 3.5);
  assert.equal(steam.gameServer.stats.getUserAchievement(playerSteamId, "WIN_ONE"), true);
  assert.equal(steam.gameServer.stats.setUserInt(playerSteamId, "kills", 43), true);
  assert.equal(steam.gameServer.stats.setUserFloat(playerSteamId, "accuracy", 4.25), true);
  assert.equal(steam.gameServer.stats.updateUserAvgRate(playerSteamId, "score_rate", 10, 60), true);
  assert.equal(steam.gameServer.stats.setUserAchievement(playerSteamId, "WIN_ONE"), true);
  assert.equal(steam.gameServer.stats.clearUserAchievement(playerSteamId, "WIN_ONE"), true);
  const stored = await steam.gameServer.stats.storeUserStats(playerSteamId);
  assert.equal(stored.result, 1);
  assert.equal(stored.steamId.steamId64, playerSteamId);

  assert.deepEqual(
    fake.calls.map((call) => call.method),
    [
      "gameServerStatsRequestUserStats",
      "gameServerStatsGetUserInt",
      "gameServerStatsGetUserFloat",
      "gameServerStatsGetUserAchievement",
      "gameServerStatsSetUserInt",
      "gameServerStatsSetUserFloat",
      "gameServerStatsUpdateUserAvgRate",
      "gameServerStatsSetUserAchievement",
      "gameServerStatsClearUserAchievement",
      "gameServerStatsStoreUserStats"
    ]
  );
});

test("game server facades expose typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const events = {};
  const handles = [
    steam.gameServer.onServersConnected((event) => {
      events.connected = event;
    }),
    steam.gameServer.onServerConnectFailure((event) => {
      events.connectFailure = event;
    }),
    steam.gameServer.onServersDisconnected((event) => {
      events.disconnected = event;
    }),
    steam.gameServer.onClientApprove((event) => {
      events.approve = event;
    }),
    steam.gameServer.onClientDeny((event) => {
      events.deny = event;
    }),
    steam.gameServer.onClientKick((event) => {
      events.kick = event;
    }),
    steam.gameServer.onClientAchievementStatus((event) => {
      events.achievementStatus = event;
    }),
    steam.gameServer.onPolicyResponse((event) => {
      events.policy = event;
    }),
    steam.gameServer.onGameplayStats((event) => {
      events.gameplayStats = event;
    }),
    steam.gameServer.onClientGroupStatus((event) => {
      events.groupStatus = event;
    }),
    steam.gameServer.onReputation((event) => {
      events.reputation = event;
    }),
    steam.gameServer.onAssociateWithClan((event) => {
      events.associateWithClan = event;
    }),
    steam.gameServer.onPlayerCompatibility((event) => {
      events.playerCompatibility = event;
    }),
    steam.gameServer.stats.onUserStatsReceived((event) => {
      events.statsReceived = event;
    }),
    steam.gameServer.stats.onUserStatsStored((event) => {
      events.statsStored = event;
    }),
    steam.gameServer.stats.onUserStatsUnloaded((event) => {
      events.statsUnloaded = event;
    })
  ];

  fake.callbacks.get(steam.SteamCallback.SteamServersConnectedSteamworks)({});
  fake.callbacks.get(steam.SteamCallback.SteamServerConnectFailureSteamworks)({
    reason: 3,
    still_retrying: true
  });
  fake.callbacks.get(steam.SteamCallback.SteamServersDisconnectedSteamworks)({ reason: 2 });
  fake.callbacks.get(steam.SteamCallback.GameServerClientApprove)({
    steam_id: "76561198000000020",
    owner_steam_id: "76561198000000021"
  });
  fake.callbacks.get(steam.SteamCallback.GameServerClientDeny)({
    steam_id: "76561198000000022",
    deny_reason: 4,
    optional_text: "bad auth"
  });
  fake.callbacks.get(steam.SteamCallback.GameServerClientKick)({
    steam_id: "76561198000000023",
    deny_reason: 5
  });
  fake.callbacks.get(steam.SteamCallback.GameServerClientAchievementStatus)({
    steam_id: "76561198000000024",
    achievement: "ACH_WIN_ONE",
    unlocked: true
  });
  fake.callbacks.get(steam.SteamCallback.GameServerPolicyResponse)({ secure: true });
  fake.callbacks.get(steam.SteamCallback.GameServerGameplayStats)({
    result: 1,
    rank: 7,
    total_connects: 120,
    total_minutes_played: 4800
  });
  fake.callbacks.get(steam.SteamCallback.GameServerClientGroupStatus)({
    steam_id: "76561198000000025",
    group_id: "103582791429521412",
    member: true,
    officer: false
  });
  fake.callbacks.get(steam.SteamCallback.GameServerReputation)({
    result: 1,
    reputation_score: 900,
    banned: true,
    banned_ip: 2130706433,
    banned_ip_address: "127.0.0.1",
    banned_port: 27015,
    banned_game_id: "480",
    ban_expires: 1234567890
  });
  fake.callbacks.get(steam.SteamCallback.GameServerAssociateWithClan)({ result: 1 });
  fake.callbacks.get(steam.SteamCallback.GameServerPlayerCompatibility)({
    result: 1,
    players_that_dont_like_candidate: 2,
    players_that_candidate_doesnt_like: 3,
    clan_players_that_dont_like_candidate: 4,
    candidate_steam_id: "76561198000000026"
  });
  fake.callbacks.get(steam.SteamCallback.GameServerStatsReceived)({
    result: 1,
    steam_id: "76561198000000027"
  });
  fake.callbacks.get(steam.SteamCallback.GameServerStatsStored)({
    result: 1,
    steam_id: "76561198000000028"
  });
  fake.callbacks.get(steam.SteamCallback.GameServerStatsUnloaded)({
    steam_id: "76561198000000029"
  });

  assert.deepEqual(events.connected, {});
  assert.equal(events.connectFailure.reason, 3);
  assert.equal(events.connectFailure.stillRetrying, true);
  assert.equal(events.disconnected.reason, 2);
  assert.equal(events.approve.steamId, 76561198000000020n);
  assert.equal(events.approve.ownerSteamId, 76561198000000021n);
  assert.equal(events.deny.steamId, 76561198000000022n);
  assert.equal(events.deny.denyReason, 4);
  assert.equal(events.deny.optionalText, "bad auth");
  assert.equal(events.kick.steamId, 76561198000000023n);
  assert.equal(events.kick.denyReason, 5);
  assert.equal(events.achievementStatus.steamId, 76561198000000024n);
  assert.equal(events.achievementStatus.achievement, "ACH_WIN_ONE");
  assert.equal(events.achievementStatus.unlocked, true);
  assert.equal(events.policy.secure, true);
  assert.equal(events.gameplayStats.rank, 7);
  assert.equal(events.gameplayStats.totalConnects, 120);
  assert.equal(events.gameplayStats.totalMinutesPlayed, 4800);
  assert.equal(events.groupStatus.steamId, 76561198000000025n);
  assert.equal(events.groupStatus.groupId, 103582791429521412n);
  assert.equal(events.groupStatus.member, true);
  assert.equal(events.reputation.reputationScore, 900);
  assert.equal(events.reputation.bannedGameId, 480n);
  assert.equal(events.associateWithClan.result, 1);
  assert.equal(events.playerCompatibility.candidateSteamId, 76561198000000026n);
  assert.equal(events.playerCompatibility.playersThatDontLikeCandidate, 2);
  assert.equal(events.statsReceived.steamId, 76561198000000027n);
  assert.equal(events.statsStored.steamId, 76561198000000028n);
  assert.equal(events.statsUnloaded.steamId, 76561198000000029n);

  for (const handle of handles) {
    handle.disconnect();
  }

  const callbackIds = [
    steam.SteamCallback.SteamServersConnectedSteamworks,
    steam.SteamCallback.SteamServerConnectFailureSteamworks,
    steam.SteamCallback.SteamServersDisconnectedSteamworks,
    steam.SteamCallback.GameServerClientApprove,
    steam.SteamCallback.GameServerClientDeny,
    steam.SteamCallback.GameServerClientKick,
    steam.SteamCallback.GameServerClientAchievementStatus,
    steam.SteamCallback.GameServerPolicyResponse,
    steam.SteamCallback.GameServerGameplayStats,
    steam.SteamCallback.GameServerClientGroupStatus,
    steam.SteamCallback.GameServerReputation,
    steam.SteamCallback.GameServerAssociateWithClan,
    steam.SteamCallback.GameServerPlayerCompatibility,
    steam.SteamCallback.GameServerStatsReceived,
    steam.SteamCallback.GameServerStatsStored,
    steam.SteamCallback.GameServerStatsUnloaded
  ];
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback"),
    callbackIds.map((callbackId) => ({ method: "registerSteamCallback", args: [callbackId] }))
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback"),
    callbackIds.map((callbackId) => ({ method: "disconnectCallback", args: [callbackId] }))
  );
});

test("utils facade covers activity, images, VR, filtering, and text input helpers", async (t) => {
  const imageData = Buffer.from([255, 0, 0, 255, 0, 255, 0, 255]);
  const fake = createFakeNative({
    utilsGetServerRealTime() {
      this.calls.push({ method: "utilsGetServerRealTime", args: [] });
      return 1700000000;
    },
    utilsGetSecondsSinceAppActive() {
      this.calls.push({ method: "utilsGetSecondsSinceAppActive", args: [] });
      return 12;
    },
    utilsGetSecondsSinceComputerActive() {
      this.calls.push({ method: "utilsGetSecondsSinceComputerActive", args: [] });
      return 34;
    },
    utilsGetConnectedUniverse() {
      this.calls.push({ method: "utilsGetConnectedUniverse", args: [] });
      return 1;
    },
    utilsGetSteamUiLanguage() {
      this.calls.push({ method: "utilsGetSteamUiLanguage", args: [] });
      return "english";
    },
    utilsGetImageSize(image) {
      this.calls.push({ method: "utilsGetImageSize", args: [image] });
      return image === 7 ? { width: 2, height: 1 } : null;
    },
    utilsGetImageRgba(image) {
      this.calls.push({ method: "utilsGetImageRgba", args: [image] });
      return image === 7 ? imageData : null;
    },
    utilsGetCserIpPort() {
      this.calls.push({ method: "utilsGetCserIpPort", args: [] });
      return { ip: 2130706433, ip_address: "127.0.0.1", port: 27015 };
    },
    utilsGetCurrentBatteryPower() {
      this.calls.push({ method: "utilsGetCurrentBatteryPower", args: [] });
      return 95;
    },
    utilsGetIpcCallCount() {
      this.calls.push({ method: "utilsGetIpcCallCount", args: [] });
      return 3;
    },
    utilsRegisterWarningMessageHook(handler) {
      this.calls.push({ method: "utilsRegisterWarningMessageHook", args: [] });
      this.warningMessageHandler = handler;
      return {
        disconnect: () => this.calls.push({ method: "disconnectWarningMessageHook", args: [] })
      };
    },
    utilsIsApiCallCompleted(apiCall) {
      this.calls.push({ method: "utilsIsApiCallCompleted", args: [apiCall] });
      return { completed: true, failed: false };
    },
    utilsGetApiCallFailureReason(apiCall) {
      this.calls.push({ method: "utilsGetApiCallFailureReason", args: [apiCall] });
      return -1;
    },
    utilsGetApiCallResult(apiCall, expectedCallback, byteLength) {
      this.calls.push({ method: "utilsGetApiCallResult", args: [apiCall, expectedCallback, byteLength] });
      return { ok: true, failed: false, data: Buffer.from([1, 2, 3, 4]) };
    },
    utilsCheckFileSignature(fileName, timeoutSeconds) {
      this.calls.push({ method: "utilsCheckFileSignature", args: [fileName, timeoutSeconds] });
      return Promise.resolve(1);
    },
    utilsSetOverlayNotificationPosition(position) {
      this.calls.push({ method: "utilsSetOverlayNotificationPosition", args: [position] });
    },
    utilsSetOverlayNotificationInset(horizontal, vertical) {
      this.calls.push({ method: "utilsSetOverlayNotificationInset", args: [horizontal, vertical] });
    },
    utilsIsSteamRunningInVr() {
      this.calls.push({ method: "utilsIsSteamRunningInVr", args: [] });
      return true;
    },
    utilsStartVrDashboard() {
      this.calls.push({ method: "utilsStartVrDashboard", args: [] });
    },
    utilsIsVrHeadsetStreamingEnabled() {
      this.calls.push({ method: "utilsIsVrHeadsetStreamingEnabled", args: [] });
      return false;
    },
    utilsSetVrHeadsetStreamingEnabled(enabled) {
      this.calls.push({ method: "utilsSetVrHeadsetStreamingEnabled", args: [enabled] });
    },
    utilsIsSteamChinaLauncher() {
      this.calls.push({ method: "utilsIsSteamChinaLauncher", args: [] });
      return false;
    },
    utilsInitFilterText(options) {
      this.calls.push({ method: "utilsInitFilterText", args: [options] });
      return true;
    },
    utilsFilterText(context, sourceSteamId64, input, maxBytes) {
      this.calls.push({ method: "utilsFilterText", args: [context, sourceSteamId64, input, maxBytes] });
      return { filtered: "hello", characters_filtered: 1 };
    },
    utilsGetIpv6ConnectivityState(protocol) {
      this.calls.push({ method: "utilsGetIpv6ConnectivityState", args: [protocol] });
      return protocol === 1 ? 1 : 2;
    },
    utilsSetGameLauncherMode(enabled) {
      this.calls.push({ method: "utilsSetGameLauncherMode", args: [enabled] });
    },
    utilsDismissFloatingGamepadTextInput() {
      this.calls.push({ method: "utilsDismissFloatingGamepadTextInput", args: [] });
      return true;
    },
    utilsDismissGamepadTextInput() {
      this.calls.push({ method: "utilsDismissGamepadTextInput", args: [] });
      return true;
    },
    utilsShowGamepadTextInput(inputMode, inputLineMode, description, maxCharacters, existingText) {
      this.calls.push({
        method: "utilsShowGamepadTextInput",
        args: [inputMode, inputLineMode, description, maxCharacters, existingText]
      });
      return Promise.resolve("accepted text");
    },
    utilsShowFloatingGamepadTextInput(keyboardMode, x, y, width, height) {
      this.calls.push({ method: "utilsShowFloatingGamepadTextInput", args: [keyboardMode, x, y, width, height] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.utils.SteamUniverse.Public, 1);
  assert.equal(steam.utils.OverlayNotificationPosition.BottomRight, 3);
  assert.equal(steam.utils.GamepadTextInputMode.Normal, 0);
  assert.equal(steam.utils.GamepadTextInputLineMode.SingleLine, 0);
  assert.equal(steam.utils.FloatingGamepadTextInputMode.Email, 2);
  assert.equal(steam.utils.TextFilteringContext.Chat, 2);
  assert.equal(steam.utils.IPv6ConnectivityProtocol.HTTP, 1);
  assert.equal(steam.utils.IPv6ConnectivityState.Good, 1);
  assert.equal(steam.utils.getServerRealTime(), 1700000000);
  assert.equal(steam.utils.getSecondsSinceAppActive(), 12);
  assert.equal(steam.utils.getSecondsSinceComputerActive(), 34);
  assert.equal(steam.utils.getConnectedUniverse(), steam.utils.SteamUniverse.Public);
  assert.equal(steam.utils.getSteamUILanguage(), "english");
  assert.deepEqual(steam.utils.getImageSize(7), { width: 2, height: 1 });
  assert.equal(steam.utils.getImageSize(99), null);
  assert.deepEqual(steam.utils.getImageRGBA(7), imageData);
  assert.equal(steam.utils.getImageRGBA(99), null);
  assert.deepEqual(steam.utils.getCSERIPPort(), { ip: 2130706433, ipAddress: "127.0.0.1", port: 27015 });
  assert.equal(steam.utils.getCurrentBatteryPower(), 95);
  assert.equal(steam.utils.getIPCCallCount(), 3);
  let warningEvent;
  const warningHandle = steam.utils.registerWarningMessageHook((event) => {
    warningEvent = event;
  });
  fake.warningMessageHandler({ severity: 2, message: "warning text" });
  assert.deepEqual(warningEvent, { severity: 2, message: "warning text" });
  assert.deepEqual(steam.utils.isApiCallCompleted("12345678901234567890"), {
    completed: true,
    failed: false
  });
  assert.equal(steam.utils.getApiCallFailureReason(12345678901234567890n), -1);
  const apiCallResult = steam.utils.getApiCallResult(
    12345678901234567890n,
    steam.SteamCallback.FileDetailsResult,
    36
  );
  assert.equal(apiCallResult.ok, true);
  assert.equal(apiCallResult.failed, false);
  assert.deepEqual(apiCallResult.data, Buffer.from([1, 2, 3, 4]));
  assert.equal(
    await steam.utils.checkFileSignature("steam_appid.txt", 5),
    steam.utils.CheckFileSignature.ValidSignature
  );

  steam.utils.setOverlayNotificationPosition(steam.utils.OverlayNotificationPosition.BottomRight);
  steam.utils.setOverlayNotificationInset(16, 24);

  assert.equal(steam.utils.isSteamRunningInVR(), true);
  steam.utils.startVRDashboard();
  assert.equal(steam.utils.isVRHeadsetStreamingEnabled(), false);
  steam.utils.setVRHeadsetStreamingEnabled(true);
  assert.equal(steam.utils.isSteamChinaLauncher(), false);
  assert.equal(steam.utils.initFilterText(), true);
  assert.deepEqual(
    steam.utils.filterText(steam.utils.TextFilteringContext.Chat, 76561198000000000n, "hello", 256),
    { filtered: "hello", charactersFiltered: 1 }
  );
  assert.equal(
    steam.utils.getIPv6ConnectivityState(steam.utils.IPv6ConnectivityProtocol.HTTP),
    steam.utils.IPv6ConnectivityState.Good
  );
  steam.utils.setGameLauncherMode(true);
  assert.equal(steam.utils.dismissFloatingGamepadTextInput(), true);
  assert.equal(steam.utils.dismissGamepadTextInput(), true);
  assert.equal(
    await steam.utils.showGamepadTextInput(
      steam.utils.GamepadTextInputMode.Normal,
      steam.utils.GamepadTextInputLineMode.SingleLine,
      "Enter name",
      32,
      "Player"
    ),
    "accepted text"
  );
  assert.equal(
    await steam.utils.showFloatingGamepadTextInput(steam.utils.FloatingGamepadTextInputMode.Email, 10, 20, 300, 48),
    true
  );
  warningHandle.disconnect();
  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "utilsRegisterWarningMessageHook",
        "utilsGetServerRealTime",
        "utilsSetOverlayNotificationPosition",
        "utilsSetOverlayNotificationInset",
        "utilsIsApiCallCompleted",
        "utilsGetApiCallFailureReason",
        "utilsGetApiCallResult",
        "utilsCheckFileSignature",
        "utilsFilterText",
        "utilsSetGameLauncherMode",
        "utilsShowGamepadTextInput",
        "utilsShowFloatingGamepadTextInput",
        "disconnectWarningMessageHook"
      ].includes(call.method)
    ),
    [
      { method: "utilsGetServerRealTime", args: [] },
      { method: "utilsRegisterWarningMessageHook", args: [] },
      { method: "utilsIsApiCallCompleted", args: [12345678901234567890n] },
      { method: "utilsGetApiCallFailureReason", args: [12345678901234567890n] },
      { method: "utilsGetApiCallResult", args: [12345678901234567890n, 1023, 36] },
      { method: "utilsCheckFileSignature", args: ["steam_appid.txt", 5] },
      { method: "utilsSetOverlayNotificationPosition", args: [3] },
      { method: "utilsSetOverlayNotificationInset", args: [16, 24] },
      { method: "utilsFilterText", args: [2, 76561198000000000n, "hello", 256] },
      { method: "utilsSetGameLauncherMode", args: [true] },
      { method: "utilsShowGamepadTextInput", args: [0, 0, "Enter name", 32, "Player"] },
      { method: "utilsShowFloatingGamepadTextInput", args: [2, 10, 20, 300, 48] },
      { method: "disconnectWarningMessageHook", args: [] }
    ]
  );
});

test("utils facade exposes typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const events = {};
  const handles = [
    steam.utils.onIpCountry((event) => {
      events.ipCountry = event;
    }),
    steam.utils.onLowBatteryPower((event) => {
      events.lowBattery = event;
    }),
    steam.utils.onApiCallCompleted((event) => {
      events.apiCall = event;
    }),
    steam.utils.onSteamShutdown((event) => {
      events.shutdown = event;
    }),
    steam.utils.onIpcFailure((event) => {
      events.ipcFailure = event;
    }),
    steam.utils.onCheckFileSignature((event) => {
      events.signature = event;
    }),
    steam.utils.onGamepadTextInputDismissed((event) => {
      events.gamepadText = event;
    }),
    steam.utils.onAppResumingFromSuspend((event) => {
      events.resume = event;
    }),
    steam.utils.onFloatingGamepadTextInputDismissed((event) => {
      events.floatingText = event;
    }),
    steam.utils.onFilterTextDictionaryChanged((event) => {
      events.dictionary = event;
    })
  ];

  fake.callbacks.get(steam.SteamCallback.IPCountry)({});
  fake.callbacks.get(steam.SteamCallback.LowBatteryPower)({ minutes_battery_left: 15 });
  fake.callbacks.get(steam.SteamCallback.SteamAPICallCompleted)({
    async_call: "12345678901234567890",
    callback: steam.SteamCallback.FileDetailsResult,
    parameter_size: 252
  });
  fake.callbacks.get(steam.SteamCallback.SteamShutdown)({});
  fake.callbacks.get(steam.SteamCallback.IPCFailure)({ failure_type: 1 });
  fake.callbacks.get(steam.SteamCallback.CheckFileSignature)({
    check_file_signature: steam.utils.CheckFileSignature.ValidSignature
  });
  fake.callbacks.get(steam.SteamCallback.GamepadTextInputDismissed)({
    submitted: true,
    submitted_text: 12,
    app_id: 480
  });
  fake.callbacks.get(steam.SteamCallback.AppResumingFromSuspend)({});
  fake.callbacks.get(steam.SteamCallback.FloatingGamepadTextInputDismissed)({});
  fake.callbacks.get(steam.SteamCallback.FilterTextDictionaryChanged)({ language: 1 });

  assert.deepEqual(events.ipCountry, {});
  assert.equal(events.lowBattery.minutesBatteryLeft, 15);
  assert.equal(events.apiCall.asyncCall, 12345678901234567890n);
  assert.equal(events.apiCall.callback, steam.SteamCallback.FileDetailsResult);
  assert.equal(events.apiCall.parameterSize, 252);
  assert.deepEqual(events.shutdown, {});
  assert.equal(events.ipcFailure.failureType, 1);
  assert.equal(events.signature.checkFileSignature, steam.utils.CheckFileSignature.ValidSignature);
  assert.equal(events.gamepadText.submitted, true);
  assert.equal(events.gamepadText.submittedText, 12);
  assert.equal(events.gamepadText.appId, 480);
  assert.deepEqual(events.resume, {});
  assert.deepEqual(events.floatingText, {});
  assert.equal(events.dictionary.language, 1);

  for (const handle of handles) {
    handle.disconnect();
  }

  const callbackIds = [
    steam.SteamCallback.IPCountry,
    steam.SteamCallback.LowBatteryPower,
    steam.SteamCallback.SteamAPICallCompleted,
    steam.SteamCallback.SteamShutdown,
    steam.SteamCallback.IPCFailure,
    steam.SteamCallback.CheckFileSignature,
    steam.SteamCallback.GamepadTextInputDismissed,
    steam.SteamCallback.AppResumingFromSuspend,
    steam.SteamCallback.FloatingGamepadTextInputDismissed,
    steam.SteamCallback.FilterTextDictionaryChanged
  ];
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback"),
    callbackIds.map((callbackId) => ({ method: "registerSteamCallback", args: [callbackId] }))
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback"),
    callbackIds.map((callbackId) => ({ method: "disconnectCallback", args: [callbackId] }))
  );
});

test("specific and generic callbacks normalize Steamworks payloads", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.SteamCallback.SteamServersConnectedSteamworks, 101);
  assert.equal(steam.SteamCallback.SteamServerConnectFailureSteamworks, 102);
  assert.equal(steam.SteamCallback.SteamServersDisconnectedSteamworks, 103);
  assert.equal(steam.SteamCallback.SteamAPICallCompleted, 703);
  assert.equal(steam.SteamCallback.ClientGameServerDeny, 113);
  assert.equal(steam.SteamCallback.IPCFailure, 117);
  assert.equal(steam.SteamCallback.LicensesUpdated, 125);
  assert.equal(steam.SteamCallback.ValidateAuthTicketResponse, 143);
  assert.equal(steam.SteamCallback.MicroTxnAuthorizationResponseSteamworks, 152);
  assert.equal(steam.SteamCallback.EncryptedAppTicketResponse, 154);
  assert.equal(steam.SteamCallback.GetAuthSessionTicketResponse, 163);
  assert.equal(steam.SteamCallback.GameWebCallback, 164);
  assert.equal(steam.SteamCallback.StoreAuthURLResponse, 165);
  assert.equal(steam.SteamCallback.MarketEligibilityResponse, 166);
  assert.equal(steam.SteamCallback.DurationControl, 167);
  assert.equal(steam.SteamCallback.GetTicketForWebApiResponse, 168);
  assert.equal(steam.SteamCallback.PersonaStateChangeSteamworks, 304);
  assert.equal(steam.SteamCallback.GameServerChangeRequested, 332);
  assert.equal(steam.SteamCallback.GameLobbyJoinRequestedSteamworks, 333);
  assert.equal(steam.SteamCallback.AvatarImageLoaded, 334);
  assert.equal(steam.SteamCallback.FriendRichPresenceUpdate, 336);
  assert.equal(steam.SteamCallback.FriendsEnumerateFollowingList, 346);
  assert.equal(steam.SteamCallback.OverlayBrowserProtocolNavigation, 349);
  assert.equal(steam.SteamCallback.EquippedProfileItems, 351);
  assert.equal(steam.SteamCallback.LobbyCreated, 513);
  assert.equal(steam.SteamCallback.LobbyDataUpdateSteamworks, 505);
  assert.equal(steam.SteamCallback.LobbyChatUpdateSteamworks, 506);
  assert.equal(steam.SteamCallback.FavoritesListAccountsUpdated, 516);
  assert.equal(steam.SteamCallback.GamepadTextInputDismissed, 714);
  assert.equal(steam.SteamCallback.DlcInstalled, 1005);
  assert.equal(steam.SteamCallback.AppProofOfPurchaseKeyResponse, 1021);
  assert.equal(steam.SteamCallback.FileDetailsResult, 1023);
  assert.equal(steam.SteamCallback.TimedTrialStatus, 1030);
  assert.equal(steam.SteamCallback.SocketStatusCallback, 1201);
  assert.equal(steam.SteamCallback.P2PSessionRequestSteamworks, 1202);
  assert.equal(steam.SteamCallback.P2PSessionConnectFailSteamworks, 1203);
  assert.equal(steam.SteamCallback.RemoteStorageFileShareResult, 1307);
  assert.equal(steam.SteamCallback.RemoteStoragePublishFileResult, 1309);
  assert.equal(steam.SteamCallback.RemoteStorageDeletePublishedFileResult, 1311);
  assert.equal(steam.SteamCallback.RemoteStorageEnumerateUserPublishedFilesResult, 1312);
  assert.equal(steam.SteamCallback.RemoteStorageSubscribePublishedFileResult, 1313);
  assert.equal(steam.SteamCallback.RemoteStorageEnumerateUserSubscribedFilesResult, 1314);
  assert.equal(steam.SteamCallback.RemoteStorageUnsubscribePublishedFileResult, 1315);
  assert.equal(steam.SteamCallback.RemoteStorageUpdatePublishedFileResult, 1316);
  assert.equal(steam.SteamCallback.RemoteStorageDownloadUGCResult, 1317);
  assert.equal(steam.SteamCallback.RemoteStorageGetPublishedFileDetailsResult, 1318);
  assert.equal(steam.SteamCallback.RemoteStorageEnumerateWorkshopFilesResult, 1319);
  assert.equal(steam.SteamCallback.RemoteStorageGetPublishedItemVoteDetailsResult, 1320);
  assert.equal(steam.SteamCallback.RemoteStoragePublishedFileSubscribed, 1321);
  assert.equal(steam.SteamCallback.RemoteStoragePublishedFileUnsubscribed, 1322);
  assert.equal(steam.SteamCallback.RemoteStoragePublishedFileDeleted, 1323);
  assert.equal(steam.SteamCallback.RemoteStorageUpdateUserPublishedItemVoteResult, 1324);
  assert.equal(steam.SteamCallback.RemoteStorageUserVoteDetails, 1325);
  assert.equal(steam.SteamCallback.RemoteStorageEnumerateUserSharedWorkshopFilesResult, 1326);
  assert.equal(steam.SteamCallback.RemoteStorageSetUserPublishedFileActionResult, 1327);
  assert.equal(steam.SteamCallback.RemoteStorageEnumeratePublishedFilesByUserActionResult, 1328);
  assert.equal(steam.SteamCallback.RemoteStoragePublishFileProgress, 1329);
  assert.equal(steam.SteamCallback.RemoteStoragePublishedFileUpdated, 1330);
  assert.equal(steam.SteamCallback.RemoteStorageFileWriteAsyncComplete, 1331);
  assert.equal(steam.SteamCallback.RemoteStorageFileReadAsyncComplete, 1332);
  assert.equal(steam.SteamCallback.RemoteStorageLocalFileChange, 1333);
  assert.equal(steam.SteamCallback.GameServerClientApprove, 201);
  assert.equal(steam.SteamCallback.GameServerClientDeny, 202);
  assert.equal(steam.SteamCallback.GameServerClientKick, 203);
  assert.equal(steam.SteamCallback.GameServerClientAchievementStatus, 206);
  assert.equal(steam.SteamCallback.GameServerPolicyResponse, 115);
  assert.equal(steam.SteamCallback.GameServerGameplayStats, 207);
  assert.equal(steam.SteamCallback.GameServerClientGroupStatus, 208);
  assert.equal(steam.SteamCallback.GameServerReputation, 209);
  assert.equal(steam.SteamCallback.GameServerAssociateWithClan, 210);
  assert.equal(steam.SteamCallback.GameServerPlayerCompatibility, 211);
  assert.equal(steam.SteamCallback.UserStatsReceived, 1101);
  assert.equal(steam.SteamCallback.UserStatsStored, 1102);
  assert.equal(steam.SteamCallback.UserAchievementStored, 1103);
  assert.equal(steam.SteamCallback.LeaderboardFindResult, 1104);
  assert.equal(steam.SteamCallback.LeaderboardScoresDownloaded, 1105);
  assert.equal(steam.SteamCallback.LeaderboardScoreUploaded, 1106);
  assert.equal(steam.SteamCallback.NumberOfCurrentPlayers, 1107);
  assert.equal(steam.SteamCallback.UserStatsUnloaded, 1108);
  assert.equal(steam.SteamCallback.GameServerStatsUnloaded, 1108);
  assert.equal(steam.SteamCallback.UserAchievementIconFetched, 1109);
  assert.equal(steam.SteamCallback.GlobalAchievementPercentagesReady, 1110);
  assert.equal(steam.SteamCallback.LeaderboardUGCSet, 1111);
  assert.equal(steam.SteamCallback.GlobalStatsReceived, 1112);
  assert.equal(steam.SteamCallback.GCMessageAvailable, 1701);
  assert.equal(steam.SteamCallback.GCMessageFailed, 1702);
  assert.equal(steam.SteamCallback.GameServerStatsReceived, 1800);
  assert.equal(steam.SteamCallback.GameServerStatsStored, 1801);
  assert.equal(steam.SteamCallback.HTTPRequestCompleted, 2101);
  assert.equal(steam.SteamCallback.HTTPRequestHeadersReceived, 2102);
  assert.equal(steam.SteamCallback.HTTPRequestDataReceived, 2103);
  assert.equal(steam.SteamCallback.ScreenshotReady, 2301);
  assert.equal(steam.SteamCallback.ScreenshotRequested, 2302);
  assert.equal(steam.SteamCallback.PlaybackStatusHasChanged, 4001);
  assert.equal(steam.SteamCallback.VolumeHasChanged, 4002);
  assert.equal(steam.SteamCallback.MusicPlayerWantsVolume, 4011);
  assert.equal(steam.SteamCallback.MusicPlayerSelectsQueueEntry, 4012);
  assert.equal(steam.SteamCallback.MusicPlayerSelectsPlaylistEntry, 4013);
  assert.equal(steam.SteamCallback.MusicPlayerRemoteWillActivate, 4101);
  assert.equal(steam.SteamCallback.MusicPlayerRemoteWillDeactivate, 4102);
  assert.equal(steam.SteamCallback.MusicPlayerRemoteToFront, 4103);
  assert.equal(steam.SteamCallback.MusicPlayerWillQuit, 4104);
  assert.equal(steam.SteamCallback.MusicPlayerWantsPlay, 4105);
  assert.equal(steam.SteamCallback.MusicPlayerWantsPause, 4106);
  assert.equal(steam.SteamCallback.MusicPlayerWantsPlayPrevious, 4107);
  assert.equal(steam.SteamCallback.MusicPlayerWantsPlayNext, 4108);
  assert.equal(steam.SteamCallback.MusicPlayerWantsShuffled, 4109);
  assert.equal(steam.SteamCallback.MusicPlayerWantsLooped, 4110);
  assert.equal(steam.SteamCallback.MusicPlayerWantsPlayingRepeatStatus, 4114);
  assert.equal(steam.SteamCallback.BroadcastUploadStart, 4604);
  assert.equal(steam.SteamCallback.BroadcastUploadStop, 4605);
  assert.equal(steam.SteamCallback.GetVideoURLResult, 4611);
  assert.equal(steam.SteamCallback.GetOPFSettingsResult, 4624);
  assert.equal(steam.SteamCallback.SteamParentalSettingsChanged, 5001);
  assert.equal(steam.SteamCallback.AvailableBeaconLocationsUpdated, 5305);
  assert.equal(steam.SteamCallback.ActiveBeaconsUpdated, 5306);
  assert.equal(steam.SteamCallback.SteamInputDeviceConnected, 2801);
  assert.equal(steam.SteamCallback.SteamInputDeviceDisconnected, 2802);
  assert.equal(steam.SteamCallback.SteamInputConfigurationLoaded, 2803);
  assert.equal(steam.SteamCallback.SteamInputGamepadSlotChange, 2804);
  assert.equal(steam.SteamCallback.SteamRemotePlaySessionConnected, 5701);
  assert.equal(steam.SteamCallback.SteamRemotePlaySessionDisconnected, 5702);
  assert.equal(steam.SteamCallback.SteamRemotePlayTogetherGuestInvite, 5703);
  assert.equal(steam.SteamCallback.SteamRemotePlaySessionAvatarLoaded, 5704);
  assert.equal(steam.SteamCallback.SteamTimelineGamePhaseRecordingExists, 6001);
  assert.equal(steam.SteamCallback.SteamTimelineEventRecordingExists, 6002);

  let txnEvent;
  const txnHandle = steam.onMicroTxnAuthorizationResponse((event) => {
    txnEvent = event;
  });

  fake.callbacks.get(steam.SteamCallback.MicroTxnAuthorizationResponseSteamworks)({
    app_id: 480,
    order_id: "9223372036854775807",
    authorized: true
  });

  assert.equal(txnEvent.appId, 480);
  assert.equal(txnEvent.orderId, 9223372036854775807n);
  assert.equal(txnEvent.authorized, true);

  let legacyTxnEvent;
  const legacyTxnHandle = steam.onLegacyMicroTxnAuthorizationResponse((event) => {
    legacyTxnEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.MicroTxnAuthorizationResponse)({
    app_id: 480,
    order_id: "9223372036854775806",
    authorized: true
  });
  assert.equal(legacyTxnEvent.appId, 480);
  assert.equal(legacyTxnEvent.orderId, 9223372036854775806n);
  assert.equal(legacyTxnEvent.authorized, true);
  legacyTxnHandle.disconnect();

  let txnSteamworksEvent;
  steam.callback.register(steam.SteamCallback.MicroTxnAuthorizationResponseSteamworks, (event) => {
    txnSteamworksEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.MicroTxnAuthorizationResponseSteamworks)({
    app_id: 480,
    order_id: "9223372036854775808",
    authorized: false
  });

  assert.equal(txnSteamworksEvent.appId, 480);
  assert.equal(txnSteamworksEvent.orderId, 9223372036854775808n);
  assert.equal(txnSteamworksEvent.authorized, false);

  let personaEvent;
  steam.callback.register(steam.SteamCallback.PersonaStateChangeSteamworks, (event) => {
    personaEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.PersonaStateChangeSteamworks)({
    steam_id: "76561198000000030",
    flags: { bits: 2 }
  });
  assert.equal(personaEvent.steamId, 76561198000000030n);
  assert.deepEqual(personaEvent.flags, { bits: 2 });

  let namedPersonaEvent;
  const namedPersonaHandle = steam.onSteamCallback("PersonaStateChangeSteamworks", (event) => {
    namedPersonaEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.PersonaStateChangeSteamworks)({
    steam_id: "76561198000000036",
    flags: { bits: 4 }
  });
  assert.equal(namedPersonaEvent.steamId, 76561198000000036n);
  assert.deepEqual(namedPersonaEvent.flags, { bits: 4 });
  namedPersonaHandle.disconnect();
  assert.equal(fake.callbacks.has(steam.SteamCallback.PersonaStateChangeSteamworks), false);
  assert.throws(
    () => steam.onSteamCallback("UnknownCallbackForTest", () => {}),
    /Unknown Steam callback: UnknownCallbackForTest/
  );

  let serverFailureEvent;
  steam.callback.register("SteamServerConnectFailureSteamworks", (event) => {
    serverFailureEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamServerConnectFailureSteamworks)({
    reason: 3,
    still_retrying: true
  });
  assert.equal(serverFailureEvent.reason, 3);
  assert.equal(serverFailureEvent.stillRetrying, true);

  let legacyServerFailureEvent;
  const legacyServerFailureHandle = steam.onSteamServerConnectFailure((event) => {
    legacyServerFailureEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamServerConnectFailure)({
    reason: 4,
    still_retrying: false
  });
  assert.equal(legacyServerFailureEvent.reason, 4);
  assert.equal(legacyServerFailureEvent.stillRetrying, false);
  legacyServerFailureHandle.disconnect();

  let serverDisconnectedEvent;
  steam.callback.register(steam.SteamCallback.SteamServersDisconnectedSteamworks, (event) => {
    serverDisconnectedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamServersDisconnectedSteamworks)({ reason: 2 });
  assert.equal(serverDisconnectedEvent.reason, 2);

  let legacyServerDisconnectedEvent;
  const legacyServerDisconnectedHandle = steam.onSteamServersDisconnected((event) => {
    legacyServerDisconnectedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamServersDisconnected)({ reason: 5 });
  assert.equal(legacyServerDisconnectedEvent.reason, 5);
  legacyServerDisconnectedHandle.disconnect();

  let serverConnectedEvent;
  steam.callback.register(steam.SteamCallback.SteamServersConnectedSteamworks, (event) => {
    serverConnectedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamServersConnectedSteamworks)({});
  assert.deepEqual(serverConnectedEvent, {});

  let legacyServerConnectedEvent;
  const legacyServerConnectedHandle = steam.onSteamServersConnected((event) => {
    legacyServerConnectedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamServersConnected)({});
  assert.deepEqual(legacyServerConnectedEvent, {});
  legacyServerConnectedHandle.disconnect();

  let lobbyEvent;
  steam.callback.register(steam.SteamCallback.LobbyDataUpdate, (event) => {
    lobbyEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LobbyDataUpdate)({
    lobby: "109775242022617907",
    member: "76561198000000000",
    remote: 42,
    note: "kept"
  });

  assert.equal(lobbyEvent.lobby, 109775242022617907n);
  assert.equal(lobbyEvent.member, 76561198000000000n);
  assert.equal(lobbyEvent.remote, 42n);
  assert.equal(lobbyEvent.note, "kept");

  let lobbySteamworksEvent;
  steam.callback.register(steam.SteamCallback.LobbyDataUpdateSteamworks, (event) => {
    lobbySteamworksEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LobbyDataUpdateSteamworks)({
    lobby: "109775242022617909",
    member: "76561198000000031",
    success: true
  });
  assert.equal(lobbySteamworksEvent.lobby, 109775242022617909n);
  assert.equal(lobbySteamworksEvent.member, 76561198000000031n);
  assert.equal(lobbySteamworksEvent.success, true);

  let lobbyChatSteamworksEvent;
  steam.callback.register(steam.SteamCallback.LobbyChatUpdateSteamworks, (event) => {
    lobbyChatSteamworksEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LobbyChatUpdateSteamworks)({
    lobby: "109775242022617909",
    user_changed: "76561198000000031",
    making_change: "76561198000000032",
    member_state_change: 4
  });
  assert.equal(lobbyChatSteamworksEvent.userChanged, 76561198000000031n);
  assert.equal(lobbyChatSteamworksEvent.makingChange, 76561198000000032n);
  assert.equal(lobbyChatSteamworksEvent.memberStateChange, 4);

  let lobbyCreatedEvent;
  steam.callback.register(steam.SteamCallback.LobbyCreated, (event) => {
    lobbyCreatedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LobbyCreated)({
    result: 1,
    lobby: "109775242022617908"
  });

  assert.equal(lobbyCreatedEvent.result, 1);
  assert.equal(lobbyCreatedEvent.lobby, 109775242022617908n);

  let favoritesAccountsUpdatedEvent;
  steam.callback.register(steam.SteamCallback.FavoritesListAccountsUpdated, (event) => {
    favoritesAccountsUpdatedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.FavoritesListAccountsUpdated)({ result: 1 });
  assert.equal(favoritesAccountsUpdatedEvent.result, 1);

  let apiCallEvent;
  steam.callback.register(steam.SteamCallback.SteamAPICallCompleted, (event) => {
    apiCallEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamAPICallCompleted)({
    async_call: "12345678901234567890",
    callback: steam.SteamCallback.AppProofOfPurchaseKeyResponse,
    parameter_size: 252
  });

  assert.equal(apiCallEvent.async_call, 12345678901234567890n);
  assert.equal(apiCallEvent.asyncCall, 12345678901234567890n);
  assert.equal(apiCallEvent.callback, steam.SteamCallback.AppProofOfPurchaseKeyResponse);
  assert.equal(apiCallEvent.parameterSize, 252);

  let denyEvent;
  steam.callback.register(steam.SteamCallback.ClientGameServerDeny, (event) => {
    denyEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.ClientGameServerDeny)({
    app_id: 480,
    game_server_ip: 2130706433,
    game_server_ip_address: "127.0.0.1",
    game_server_port: 27015,
    secure: true,
    reason: 7
  });

  assert.equal(denyEvent.appId, 480);
  assert.equal(denyEvent.gameServerIp, 2130706433);
  assert.equal(denyEvent.gameServerIpAddress, "127.0.0.1");
  assert.equal(denyEvent.gameServerPort, 27015);
  assert.equal(denyEvent.secure, true);

  let ipcEvent;
  steam.callback.register(steam.SteamCallback.IPCFailure, (event) => {
    ipcEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.IPCFailure)({ failure_type: 1 });
  assert.equal(ipcEvent.failureType, 1);

  let licenseEvent;
  steam.callback.register(steam.SteamCallback.LicensesUpdated, (event) => {
    licenseEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LicensesUpdated)({});
  assert.deepEqual(licenseEvent, {});

  let validateTicketEvent;
  steam.callback.register(steam.SteamCallback.ValidateAuthTicketResponse, (event) => {
    validateTicketEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.ValidateAuthTicketResponse)({
    steam_id: "76561198000000010",
    auth_session_response: 1,
    owner_steam_id: "76561198000000011"
  });

  assert.equal(validateTicketEvent.steamId, 76561198000000010n);
  assert.equal(validateTicketEvent.authSessionResponse, 1);
  assert.equal(validateTicketEvent.ownerSteamId, 76561198000000011n);

  let gameWebEvent;
  steam.callback.register(steam.SteamCallback.GameWebCallback, (event) => {
    gameWebEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameWebCallback)({ url: "https://example.invalid/callback" });
  assert.equal(gameWebEvent.url, "https://example.invalid/callback");

  let webApiTicketEvent;
  steam.callback.register(steam.SteamCallback.GetTicketForWebApiResponse, (event) => {
    webApiTicketEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GetTicketForWebApiResponse)({
    auth_ticket: 88,
    result: 1,
    ticket_byte_length: 6,
    ticket_base64: Buffer.from("ticket").toString("base64")
  });

  assert.equal(webApiTicketEvent.authTicket, 88);
  assert.equal(webApiTicketEvent.ticketByteLength, 6);
  assert.equal(webApiTicketEvent.ticket.toString(), "ticket");

  let socketStatusEvent;
  steam.callback.register(steam.SteamCallback.SocketStatusCallback, (event) => {
    socketStatusEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SocketStatusCallback)({
    socket: 103,
    listen_socket: 101,
    remote: "76561198000000033",
    state: 3
  });
  assert.equal(socketStatusEvent.socket, 103);
  assert.equal(socketStatusEvent.listenSocket, 101);
  assert.equal(socketStatusEvent.remote, 76561198000000033n);
  assert.equal(socketStatusEvent.state, 3);

  let p2pRequestEvent;
  steam.callback.register(steam.SteamCallback.P2PSessionRequestSteamworks, (event) => {
    p2pRequestEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.P2PSessionRequestSteamworks)({ remote: "76561198000000034" });
  assert.equal(p2pRequestEvent.remote, 76561198000000034n);

  let p2pConnectFailEvent;
  steam.callback.register(steam.SteamCallback.P2PSessionConnectFailSteamworks, (event) => {
    p2pConnectFailEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.P2PSessionConnectFailSteamworks)({
    remote: "76561198000000035",
    error: 4
  });
  assert.equal(p2pConnectFailEvent.remote, 76561198000000035n);
  assert.equal(p2pConnectFailEvent.error, 4);

  let localFileChangeEvent;
  steam.callback.register(steam.SteamCallback.RemoteStorageLocalFileChange, (event) => {
    localFileChangeEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageLocalFileChange)({});
  assert.deepEqual(localFileChangeEvent, {});

  let gcMessageAvailableEvent;
  steam.callback.register(steam.SteamCallback.GCMessageAvailable, (event) => {
    gcMessageAvailableEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GCMessageAvailable)({ message_size: 64 });
  assert.equal(gcMessageAvailableEvent.messageSize, 64);

  let gcMessageFailedEvent;
  steam.callback.register(steam.SteamCallback.GCMessageFailed, (event) => {
    gcMessageFailedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GCMessageFailed)({});
  assert.deepEqual(gcMessageFailedEvent, {});

  let availableBeaconLocationsUpdatedEvent;
  steam.callback.register(steam.SteamCallback.AvailableBeaconLocationsUpdated, (event) => {
    availableBeaconLocationsUpdatedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.AvailableBeaconLocationsUpdated)({});
  assert.deepEqual(availableBeaconLocationsUpdatedEvent, {});

  let activeBeaconsUpdatedEvent;
  steam.callback.register(steam.SteamCallback.ActiveBeaconsUpdated, (event) => {
    activeBeaconsUpdatedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.ActiveBeaconsUpdated)({});
  assert.deepEqual(activeBeaconsUpdatedEvent, {});

  steam.callback.registerRawCallbackBase(0x1234n, "LobbyDataUpdate");
  steam.callback.registerRawCallResult(0x1234n, 12345678901234567890n);
  steam.callback.unregisterRawCallResult(0x1234n, 12345678901234567890n);
  steam.callback.unregisterRawCallbackBase(0x1234n);
  assert.deepEqual(fake.calls.filter((call) => [
    "registerRawSteamCallback",
    "registerRawSteamCallResult",
    "unregisterRawSteamCallResult",
    "unregisterRawSteamCallback"
  ].includes(call.method)), [
    { method: "registerRawSteamCallback", args: [0x1234n, steam.SteamCallback.LobbyDataUpdate] },
    { method: "registerRawSteamCallResult", args: [0x1234n, 12345678901234567890n] },
    { method: "unregisterRawSteamCallResult", args: [0x1234n, 12345678901234567890n] },
    { method: "unregisterRawSteamCallback", args: [0x1234n] }
  ]);

  let proofKeyEvent;
  steam.callback.register(steam.SteamCallback.AppProofOfPurchaseKeyResponse, (event) => {
    proofKeyEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.AppProofOfPurchaseKeyResponse)({
    result: 1,
    app_id: 480,
    key_length: 8,
    key: "spacewar"
  });

  assert.equal(proofKeyEvent.appId, 480);
  assert.equal(proofKeyEvent.keyLength, 8);
  assert.equal(proofKeyEvent.key, "spacewar");

  let fileDetailsEvent;
  steam.callback.register(steam.SteamCallback.FileDetailsResult, (event) => {
    fileDetailsEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.FileDetailsResult)({
    result: 1,
    file_size: "4294967297",
    sha_hex: "001122",
    flags: 3
  });

  assert.equal(fileDetailsEvent.file_size, 4294967297n);
  assert.equal(fileDetailsEvent.fileSize, 4294967297n);
  assert.equal(fileDetailsEvent.shaHex, "001122");

  let timedTrialEvent;
  steam.callback.register(steam.SteamCallback.TimedTrialStatus, (event) => {
    timedTrialEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.TimedTrialStatus)({
    app_id: 480,
    is_offline: false,
    seconds_allowed: 3600,
    seconds_played: 120
  });

  assert.equal(timedTrialEvent.appId, 480);
  assert.equal(timedTrialEvent.isOffline, false);
  assert.equal(timedTrialEvent.secondsAllowed, 3600);
  assert.equal(timedTrialEvent.secondsPlayed, 120);

  let reputationEvent;
  steam.callback.register(steam.SteamCallback.GameServerReputation, (event) => {
    reputationEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameServerReputation)({
    result: 1,
    reputation_score: 900,
    banned: true,
    banned_ip: 2130706433,
    banned_ip_address: "127.0.0.1",
    banned_port: 27015,
    banned_game_id: "480",
    ban_expires: 1234567890
  });

  assert.equal(reputationEvent.reputationScore, 900);
  assert.equal(reputationEvent.bannedGameId, 480n);
  assert.equal(reputationEvent.bannedIpAddress, "127.0.0.1");

  let compatibilityEvent;
  steam.callback.register(steam.SteamCallback.GameServerPlayerCompatibility, (event) => {
    compatibilityEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameServerPlayerCompatibility)({
    result: 1,
    candidate_steam_id: "76561198000000020",
    players_that_dont_like_candidate: 2,
    players_that_candidate_doesnt_like: 3,
    clan_players_that_dont_like_candidate: 4
  });

  assert.equal(compatibilityEvent.candidateSteamId, 76561198000000020n);
  assert.equal(compatibilityEvent.playersThatDontLikeCandidate, 2);
  assert.equal(compatibilityEvent.playersThatCandidateDoesntLike, 3);
  assert.equal(compatibilityEvent.clanPlayersThatDontLikeCandidate, 4);

  let userStatsReceivedEvent;
  steam.callback.register(steam.SteamCallback.UserStatsReceived, (event) => {
    userStatsReceivedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.UserStatsReceived)({
    game_id: "480",
    result: 1,
    steam_id: "76561198000000021"
  });
  assert.equal(userStatsReceivedEvent.gameId, 480n);
  assert.equal(userStatsReceivedEvent.steamId, 76561198000000021n);

  let userStatsStoredEvent;
  steam.callback.register(steam.SteamCallback.UserStatsStored, (event) => {
    userStatsStoredEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.UserStatsStored)({ game_id: "480", result: 1 });
  assert.equal(userStatsStoredEvent.gameId, 480n);
  assert.equal(userStatsStoredEvent.result, 1);

  let achievementStoredEvent;
  steam.callback.register(steam.SteamCallback.UserAchievementStored, (event) => {
    achievementStoredEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.UserAchievementStored)({
    game_id: "480",
    group_achievement: false,
    achievement: "ACH_WIN",
    current_progress: 5,
    max_progress: 10
  });
  assert.equal(achievementStoredEvent.gameId, 480n);
  assert.equal(achievementStoredEvent.groupAchievement, false);
  assert.equal(achievementStoredEvent.achievement, "ACH_WIN");
  assert.equal(achievementStoredEvent.currentProgress, 5);
  assert.equal(achievementStoredEvent.maxProgress, 10);

  let leaderboardFindEvent;
  steam.callback.register(steam.SteamCallback.LeaderboardFindResult, (event) => {
    leaderboardFindEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LeaderboardFindResult)({ leaderboard: "44", found: true });
  assert.equal(leaderboardFindEvent.leaderboard, 44n);
  assert.equal(leaderboardFindEvent.found, true);

  let leaderboardScoresEvent;
  steam.callback.register(steam.SteamCallback.LeaderboardScoresDownloaded, (event) => {
    leaderboardScoresEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LeaderboardScoresDownloaded)({
    leaderboard: "44",
    entries_handle: "9000",
    entry_count: 2
  });
  assert.equal(leaderboardScoresEvent.leaderboard, 44n);
  assert.equal(leaderboardScoresEvent.entriesHandle, 9000n);
  assert.equal(leaderboardScoresEvent.entryCount, 2);

  let leaderboardUploadEvent;
  steam.callback.register(steam.SteamCallback.LeaderboardScoreUploaded, (event) => {
    leaderboardUploadEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LeaderboardScoreUploaded)({
    success: true,
    leaderboard: "44",
    score: 1234,
    score_changed: true,
    global_rank_new: 3,
    global_rank_previous: 9
  });
  assert.equal(leaderboardUploadEvent.leaderboard, 44n);
  assert.equal(leaderboardUploadEvent.scoreChanged, true);
  assert.equal(leaderboardUploadEvent.globalRankNew, 3);
  assert.equal(leaderboardUploadEvent.globalRankPrevious, 9);

  let currentPlayersEvent;
  steam.callback.register(steam.SteamCallback.NumberOfCurrentPlayers, (event) => {
    currentPlayersEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.NumberOfCurrentPlayers)({ success: true, players: 123 });
  assert.equal(currentPlayersEvent.success, true);
  assert.equal(currentPlayersEvent.players, 123);

  let achievementIconEvent;
  steam.callback.register(steam.SteamCallback.UserAchievementIconFetched, (event) => {
    achievementIconEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.UserAchievementIconFetched)({
    game_id: "480",
    achievement: "ACH_WIN",
    achieved: true,
    icon_handle: 321
  });
  assert.equal(achievementIconEvent.gameId, 480n);
  assert.equal(achievementIconEvent.achievement, "ACH_WIN");
  assert.equal(achievementIconEvent.achieved, true);
  assert.equal(achievementIconEvent.iconHandle, 321);

  let globalAchievementEvent;
  steam.callback.register(steam.SteamCallback.GlobalAchievementPercentagesReady, (event) => {
    globalAchievementEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GlobalAchievementPercentagesReady)({ game_id: "480", result: 1 });
  assert.equal(globalAchievementEvent.gameId, 480n);
  assert.equal(globalAchievementEvent.result, 1);

  let leaderboardUgcEvent;
  steam.callback.register(steam.SteamCallback.LeaderboardUGCSet, (event) => {
    leaderboardUgcEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LeaderboardUGCSet)({ result: 1, leaderboard: "44" });
  assert.equal(leaderboardUgcEvent.result, 1);
  assert.equal(leaderboardUgcEvent.leaderboard, 44n);

  let globalStatsEvent;
  steam.callback.register(steam.SteamCallback.GlobalStatsReceived, (event) => {
    globalStatsEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GlobalStatsReceived)({ game_id: "480", result: 1 });
  assert.equal(globalStatsEvent.gameId, 480n);
  assert.equal(globalStatsEvent.result, 1);

  let marketEvent;
  steam.callback.register(steam.SteamCallback.MarketEligibilityResponse, (event) => {
    marketEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.MarketEligibilityResponse)({
    allowed: false,
    not_allowed_reason: 64,
    allowed_at_time: 1234,
    steam_guard_required_days: 15,
    new_device_cooldown_days: 7
  });

  assert.equal(marketEvent.notAllowedReason, 64);
  assert.equal(marketEvent.allowedAtTime, 1234);
  assert.equal(marketEvent.steamGuardRequiredDays, 15);
  assert.equal(marketEvent.newDeviceCooldownDays, 7);

  let durationEvent;
  steam.callback.register(steam.SteamCallback.DurationControl, (event) => {
    durationEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.DurationControl)({
    result: 1,
    app_id: 480,
    applicable: true,
    seconds_last_5h: 3600,
    progress: 1,
    notification: 2,
    seconds_today: 7200,
    seconds_remaining: 1800
  });

  assert.equal(durationEvent.appId, 480);
  assert.equal(durationEvent.secondsLast5h, 3600);
  assert.equal(durationEvent.secondsToday, 7200);
  assert.equal(durationEvent.secondsRemaining, 1800);

  let gamepadEvent;
  steam.callback.register(steam.SteamCallback.GamepadTextInputDismissed, (event) => {
    gamepadEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GamepadTextInputDismissed)({
    submitted: true,
    submitted_text: 12,
    app_id: 480
  });

  assert.equal(gamepadEvent.submitted, true);
  assert.equal(gamepadEvent.submittedText, 12);
  assert.equal(gamepadEvent.appId, 480);

  let avatarEvent;
  steam.callback.register(steam.SteamCallback.AvatarImageLoaded, (event) => {
    avatarEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.AvatarImageLoaded)({
    steam_id: "76561198000000001",
    image: 17,
    wide: 64,
    tall: 64
  });

  assert.equal(avatarEvent.steamId, 76561198000000001n);
  assert.equal(avatarEvent.image, 17);
  assert.equal(avatarEvent.wide, 64);
  assert.equal(avatarEvent.tall, 64);

  let richPresenceEvent;
  steam.callback.register(steam.SteamCallback.GameRichPresenceJoinRequested, (event) => {
    richPresenceEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameRichPresenceJoinRequested)({
    friend: "76561198000000002",
    connect: "+connect_lobby 109775242022617907"
  });

  assert.equal(richPresenceEvent.friend, 76561198000000002n);
  assert.equal(richPresenceEvent.connect, "+connect_lobby 109775242022617907");

  let lobbyJoinEvent;
  steam.callback.register(steam.SteamCallback.GameLobbyJoinRequestedSteamworks, (event) => {
    lobbyJoinEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameLobbyJoinRequestedSteamworks)({
    lobby_steam_id: "109775242022617907",
    friend_steam_id: "76561198000000003"
  });

  assert.equal(lobbyJoinEvent.lobbySteamId, 109775242022617907n);
  assert.equal(lobbyJoinEvent.friendSteamId, 76561198000000003n);

  let chatLeaveEvent;
  steam.callback.register(steam.SteamCallback.GameConnectedChatLeave, (event) => {
    chatLeaveEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameConnectedChatLeave)({
    clan_chat: "103582791429521408",
    user: "76561198000000003",
    kicked: false,
    dropped: true
  });

  assert.equal(chatLeaveEvent.clan_chat, 103582791429521408n);
  assert.equal(chatLeaveEvent.clanChat, 103582791429521408n);
  assert.equal(chatLeaveEvent.user, 76561198000000003n);
  assert.equal(chatLeaveEvent.dropped, true);

  let followingEvent;
  steam.callback.register(steam.SteamCallback.FriendsEnumerateFollowingList, (event) => {
    followingEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.FriendsEnumerateFollowingList)({
    result: 1,
    steam_ids: ["76561198000000004", "76561198000000005"],
    results_returned: 2,
    total_result_count: 7
  });

  assert.deepEqual(followingEvent.steam_ids, [76561198000000004n, 76561198000000005n]);
  assert.deepEqual(followingEvent.steamIds, [76561198000000004n, 76561198000000005n]);
  assert.equal(followingEvent.resultsReturned, 2);
  assert.equal(followingEvent.totalResultCount, 7);

  let equippedItemsEvent;
  steam.callback.register(steam.SteamCallback.EquippedProfileItems, (event) => {
    equippedItemsEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.EquippedProfileItems)({
    result: 1,
    steam_id: "76561198000000006",
    has_animated_avatar: true,
    has_avatar_frame: false,
    has_profile_modifier: true,
    has_profile_background: false,
    has_mini_profile_background: true,
    from_cache: true
  });

  assert.equal(equippedItemsEvent.steamId, 76561198000000006n);
  assert.equal(equippedItemsEvent.hasAnimatedAvatar, true);
  assert.equal(equippedItemsEvent.hasAvatarFrame, false);
  assert.equal(equippedItemsEvent.hasProfileModifier, true);
  assert.equal(equippedItemsEvent.hasMiniProfileBackground, true);
  assert.equal(equippedItemsEvent.fromCache, true);

  let gameServerStatsUnloadedEvent;
  steam.callback.register(steam.SteamCallback.GameServerStatsUnloaded, (event) => {
    gameServerStatsUnloadedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameServerStatsUnloaded)({
    steam_id: "76561198000000020"
  });

  assert.equal(gameServerStatsUnloadedEvent.steam_id, 76561198000000020n);
  assert.equal(gameServerStatsUnloadedEvent.steamId, 76561198000000020n);

  let navigationEvent;
  steam.callback.register(steam.SteamCallback.OverlayBrowserProtocolNavigation, (event) => {
    navigationEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.OverlayBrowserProtocolNavigation)({
    uri: "steam://openurl/https://store.steampowered.com/app/480/"
  });

  assert.equal(navigationEvent.uri, "steam://openurl/https://store.steampowered.com/app/480/");

  let screenshotReadyEvent;
  steam.callback.register(steam.SteamCallback.ScreenshotReady, (event) => {
    screenshotReadyEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.ScreenshotReady)({
    local_handle: 77,
    result: 1
  });

  assert.equal(screenshotReadyEvent.localHandle, 77);
  assert.equal(screenshotReadyEvent.result, 1);

  let screenshotRequestedEvent;
  steam.callback.register(steam.SteamCallback.ScreenshotRequested, (event) => {
    screenshotRequestedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.ScreenshotRequested)({});

  assert.deepEqual(screenshotRequestedEvent, {});

  let playbackEvent;
  steam.callback.register(steam.SteamCallback.PlaybackStatusHasChanged, (event) => {
    playbackEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.PlaybackStatusHasChanged)({});

  assert.deepEqual(playbackEvent, {});

  let volumeEvent;
  steam.callback.register(steam.SteamCallback.VolumeHasChanged, (event) => {
    volumeEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.VolumeHasChanged)({
    new_volume: 0.625
  });

  assert.equal(volumeEvent.newVolume, 0.625);

  let musicRemoteShuffledEvent;
  steam.callback.register(steam.SteamCallback.MusicPlayerWantsShuffled, (event) => {
    musicRemoteShuffledEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.MusicPlayerWantsShuffled)({
    shuffled: true
  });

  assert.equal(musicRemoteShuffledEvent.shuffled, true);

  let musicRemoteQueueEvent;
  steam.callback.register(steam.SteamCallback.MusicPlayerSelectsQueueEntry, (event) => {
    musicRemoteQueueEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.MusicPlayerSelectsQueueEntry)({
    entry_id: 9
  });

  assert.equal(musicRemoteQueueEvent.entryId, 9);

  let musicRemoteRepeatEvent;
  steam.callback.register(steam.SteamCallback.MusicPlayerWantsPlayingRepeatStatus, (event) => {
    musicRemoteRepeatEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.MusicPlayerWantsPlayingRepeatStatus)({
    repeat_status: 2
  });

  assert.equal(musicRemoteRepeatEvent.repeatStatus, 2);

  let broadcastStartEvent;
  steam.callback.register(steam.SteamCallback.BroadcastUploadStart, (event) => {
    broadcastStartEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.BroadcastUploadStart)({
    is_rtmp: true
  });

  assert.equal(broadcastStartEvent.isRtmp, true);

  let broadcastStopEvent;
  steam.callback.register(steam.SteamCallback.BroadcastUploadStop, (event) => {
    broadcastStopEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.BroadcastUploadStop)({
    result: 1
  });

  assert.equal(broadcastStopEvent.result, 1);

  let videoUrlEvent;
  steam.callback.register(steam.SteamCallback.GetVideoURLResult, (event) => {
    videoUrlEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GetVideoURLResult)({
    result: 1,
    video_app_id: 480,
    url: "https://example.invalid/spacewar.webm"
  });

  assert.equal(videoUrlEvent.videoAppId, 480);
  assert.equal(videoUrlEvent.url, "https://example.invalid/spacewar.webm");

  let opfSettingsEvent;
  steam.callback.register(steam.SteamCallback.GetOPFSettingsResult, (event) => {
    opfSettingsEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GetOPFSettingsResult)({
    result: 1,
    video_app_id: 480
  });

  assert.equal(opfSettingsEvent.videoAppId, 480);

  let parentalEvent;
  steam.callback.register(steam.SteamCallback.SteamParentalSettingsChanged, (event) => {
    parentalEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamParentalSettingsChanged)({});

  assert.deepEqual(parentalEvent, {});

  let remotePlayConnectedEvent;
  steam.callback.register(steam.SteamCallback.SteamRemotePlaySessionConnected, (event) => {
    remotePlayConnectedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamRemotePlaySessionConnected)({
    session_id: 42
  });

  assert.equal(remotePlayConnectedEvent.sessionId, 42);

  let remotePlayDisconnectedEvent;
  steam.callback.register(steam.SteamCallback.SteamRemotePlaySessionDisconnected, (event) => {
    remotePlayDisconnectedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamRemotePlaySessionDisconnected)({
    session_id: 42
  });

  assert.equal(remotePlayDisconnectedEvent.sessionId, 42);

  let remotePlayInviteEvent;
  steam.callback.register(steam.SteamCallback.SteamRemotePlayTogetherGuestInvite, (event) => {
    remotePlayInviteEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamRemotePlayTogetherGuestInvite)({
    connect_url: "steam://join/480/test"
  });

  assert.equal(remotePlayInviteEvent.connectUrl, "steam://join/480/test");

  let remotePlayAvatarEvent;
  steam.callback.register(steam.SteamCallback.SteamRemotePlaySessionAvatarLoaded, (event) => {
    remotePlayAvatarEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamRemotePlaySessionAvatarLoaded)({
    session_id: 42,
    image: 17,
    wide: 64,
    tall: 64
  });

  assert.equal(remotePlayAvatarEvent.sessionId, 42);
  assert.equal(remotePlayAvatarEvent.image, 17);
  assert.equal(remotePlayAvatarEvent.wide, 64);
  assert.equal(remotePlayAvatarEvent.tall, 64);

  let timelinePhaseEvent;
  steam.callback.register(steam.SteamCallback.SteamTimelineGamePhaseRecordingExists, (event) => {
    timelinePhaseEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamTimelineGamePhaseRecordingExists)({
    phase_id: "round-1",
    recording_ms: "1500",
    longest_clip_ms: "750",
    clip_count: 2,
    screenshot_count: 3
  });

  assert.equal(timelinePhaseEvent.phaseId, "round-1");
  assert.equal(timelinePhaseEvent.recordingMs, 1500n);
  assert.equal(timelinePhaseEvent.longestClipMs, 750n);
  assert.equal(timelinePhaseEvent.clipCount, 2);
  assert.equal(timelinePhaseEvent.screenshotCount, 3);

  let timelineEvent;
  steam.callback.register(steam.SteamCallback.SteamTimelineEventRecordingExists, (event) => {
    timelineEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamTimelineEventRecordingExists)({
    event: "9001",
    recording_exists: true
  });

  assert.equal(timelineEvent.event, 9001n);
  assert.equal(timelineEvent.recordingExists, true);

  let overlayEvent;
  const overlayHandle = steam.onGameOverlayActivated((event) => {
    overlayEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({
    active: true,
    user_initiated: false,
    app_id: 480
  });

  assert.equal(overlayEvent.active, true);
  assert.equal(overlayEvent.userInitiated, false);
  assert.equal(overlayEvent.appId, 480);

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({
    0: {
      active: false,
      user_initiated: true,
      app_id: 480,
      overlay_pid: 1234
    }
  });

  assert.equal(overlayEvent.active, false);
  assert.equal(overlayEvent.userInitiated, true);
  assert.equal(overlayEvent.appId, 480);
  assert.equal(overlayEvent.overlayPid, 1234);

  txnHandle.disconnect();
  overlayHandle.disconnect();
  assert.equal(fake.callbacks.has(steam.SteamCallback.MicroTxnAuthorizationResponseSteamworks), false);
  assert.equal(fake.callbacks.has(steam.SteamCallback.GameOverlayActivated), false);
  assert.deepEqual(fake.calls.find((call) => call.method === "registerMicroTxnAuthorizationResponse"), {
    method: "registerMicroTxnAuthorizationResponse",
    args: []
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "registerGameOverlayActivated"), {
    method: "registerGameOverlayActivated",
    args: []
  });
});

test("media and remote facades expose typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const events = {};
  const handles = [
    steam.screenshots.onReady((event) => {
      events.screenshotReady = event;
    }),
    steam.screenshots.onRequested((event) => {
      events.screenshotRequested = event;
    }),
    steam.music.onPlaybackStatusChanged((event) => {
      events.playback = event;
    }),
    steam.music.onVolumeChanged((event) => {
      events.volume = event;
    }),
    steam.music.remote.onWantsVolume((event) => {
      events.remoteVolume = event;
    }),
    steam.music.remote.onSelectsQueueEntry((event) => {
      events.queueEntry = event;
    }),
    steam.music.remote.onSelectsPlaylistEntry((event) => {
      events.playlistEntry = event;
    }),
    steam.music.remote.onRemoteWillActivate((event) => {
      events.remoteActivate = event;
    }),
    steam.music.remote.onRemoteWillDeactivate((event) => {
      events.remoteDeactivate = event;
    }),
    steam.music.remote.onRemoteToFront((event) => {
      events.remoteFront = event;
    }),
    steam.music.remote.onWillQuit((event) => {
      events.remoteQuit = event;
    }),
    steam.music.remote.onWantsPlay((event) => {
      events.remotePlay = event;
    }),
    steam.music.remote.onWantsPause((event) => {
      events.remotePause = event;
    }),
    steam.music.remote.onWantsPlayPrevious((event) => {
      events.remotePrevious = event;
    }),
    steam.music.remote.onWantsPlayNext((event) => {
      events.remoteNext = event;
    }),
    steam.music.remote.onWantsShuffled((event) => {
      events.remoteShuffled = event;
    }),
    steam.music.remote.onWantsLooped((event) => {
      events.remoteLooped = event;
    }),
    steam.music.remote.onWantsPlayingRepeatStatus((event) => {
      events.remoteRepeat = event;
    }),
    steam.video.onBroadcastUploadStart((event) => {
      events.broadcastStart = event;
    }),
    steam.video.onBroadcastUploadStop((event) => {
      events.broadcastStop = event;
    }),
    steam.video.onGetVideoUrlResult((event) => {
      events.videoUrl = event;
    }),
    steam.video.onGetOpfSettingsResult((event) => {
      events.opf = event;
    }),
    steam.parental.onSettingsChanged((event) => {
      events.parental = event;
    }),
    steam.remotePlay.onSessionConnected((event) => {
      events.remotePlayConnected = event;
    }),
    steam.remotePlay.onSessionDisconnected((event) => {
      events.remotePlayDisconnected = event;
    }),
    steam.remotePlay.onTogetherGuestInvite((event) => {
      events.remotePlayInvite = event;
    }),
    steam.remotePlay.onSessionAvatarLoaded((event) => {
      events.remotePlayAvatar = event;
    }),
    steam.timeline.onGamePhaseRecordingExists((event) => {
      events.timelinePhase = event;
    }),
    steam.timeline.onEventRecordingExists((event) => {
      events.timelineEvent = event;
    })
  ];

  fake.callbacks.get(steam.SteamCallback.ScreenshotReady)({ local_handle: 77, result: 1 });
  fake.callbacks.get(steam.SteamCallback.ScreenshotRequested)({});
  fake.callbacks.get(steam.SteamCallback.PlaybackStatusHasChanged)({});
  fake.callbacks.get(steam.SteamCallback.VolumeHasChanged)({ new_volume: 0.5 });
  fake.callbacks.get(steam.SteamCallback.MusicPlayerWantsVolume)({ new_volume: 0.75 });
  fake.callbacks.get(steam.SteamCallback.MusicPlayerSelectsQueueEntry)({ entry_id: 9 });
  fake.callbacks.get(steam.SteamCallback.MusicPlayerSelectsPlaylistEntry)({ entry_id: 10 });
  fake.callbacks.get(steam.SteamCallback.MusicPlayerRemoteWillActivate)({});
  fake.callbacks.get(steam.SteamCallback.MusicPlayerRemoteWillDeactivate)({});
  fake.callbacks.get(steam.SteamCallback.MusicPlayerRemoteToFront)({});
  fake.callbacks.get(steam.SteamCallback.MusicPlayerWillQuit)({});
  fake.callbacks.get(steam.SteamCallback.MusicPlayerWantsPlay)({});
  fake.callbacks.get(steam.SteamCallback.MusicPlayerWantsPause)({});
  fake.callbacks.get(steam.SteamCallback.MusicPlayerWantsPlayPrevious)({});
  fake.callbacks.get(steam.SteamCallback.MusicPlayerWantsPlayNext)({});
  fake.callbacks.get(steam.SteamCallback.MusicPlayerWantsShuffled)({ shuffled: true });
  fake.callbacks.get(steam.SteamCallback.MusicPlayerWantsLooped)({ looped: false });
  fake.callbacks.get(steam.SteamCallback.MusicPlayerWantsPlayingRepeatStatus)({ repeat_status: 2 });
  fake.callbacks.get(steam.SteamCallback.BroadcastUploadStart)({ is_rtmp: true });
  fake.callbacks.get(steam.SteamCallback.BroadcastUploadStop)({ result: 1 });
  fake.callbacks.get(steam.SteamCallback.GetVideoURLResult)({
    result: 1,
    video_app_id: 480,
    url: "https://example.invalid/spacewar.webm"
  });
  fake.callbacks.get(steam.SteamCallback.GetOPFSettingsResult)({ result: 1, video_app_id: 480 });
  fake.callbacks.get(steam.SteamCallback.SteamParentalSettingsChanged)({});
  fake.callbacks.get(steam.SteamCallback.SteamRemotePlaySessionConnected)({ session_id: 42 });
  fake.callbacks.get(steam.SteamCallback.SteamRemotePlaySessionDisconnected)({ session_id: 42 });
  fake.callbacks.get(steam.SteamCallback.SteamRemotePlayTogetherGuestInvite)({
    connect_url: "steam://join/480/test"
  });
  fake.callbacks.get(steam.SteamCallback.SteamRemotePlaySessionAvatarLoaded)({
    session_id: 42,
    image: 17,
    wide: 64,
    tall: 64
  });
  fake.callbacks.get(steam.SteamCallback.SteamTimelineGamePhaseRecordingExists)({
    phase_id: "round-1",
    recording_ms: "1500",
    longest_clip_ms: "750",
    clip_count: 2,
    screenshot_count: 3
  });
  fake.callbacks.get(steam.SteamCallback.SteamTimelineEventRecordingExists)({
    event: "9001",
    recording_exists: true
  });

  assert.equal(events.screenshotReady.localHandle, 77);
  assert.equal(events.screenshotReady.result, 1);
  assert.deepEqual(events.screenshotRequested, {});
  assert.deepEqual(events.playback, {});
  assert.equal(events.volume.newVolume, 0.5);
  assert.equal(events.remoteVolume.newVolume, 0.75);
  assert.equal(events.queueEntry.entryId, 9);
  assert.equal(events.playlistEntry.entryId, 10);
  assert.deepEqual(events.remoteActivate, {});
  assert.deepEqual(events.remoteDeactivate, {});
  assert.deepEqual(events.remoteFront, {});
  assert.deepEqual(events.remoteQuit, {});
  assert.deepEqual(events.remotePlay, {});
  assert.deepEqual(events.remotePause, {});
  assert.deepEqual(events.remotePrevious, {});
  assert.deepEqual(events.remoteNext, {});
  assert.equal(events.remoteShuffled.shuffled, true);
  assert.equal(events.remoteLooped.looped, false);
  assert.equal(events.remoteRepeat.repeatStatus, 2);
  assert.equal(events.broadcastStart.isRtmp, true);
  assert.equal(events.broadcastStop.result, 1);
  assert.equal(events.videoUrl.videoAppId, 480);
  assert.equal(events.videoUrl.url, "https://example.invalid/spacewar.webm");
  assert.equal(events.opf.videoAppId, 480);
  assert.deepEqual(events.parental, {});
  assert.equal(events.remotePlayConnected.sessionId, 42);
  assert.equal(events.remotePlayDisconnected.sessionId, 42);
  assert.equal(events.remotePlayInvite.connectUrl, "steam://join/480/test");
  assert.equal(events.remotePlayAvatar.sessionId, 42);
  assert.equal(events.remotePlayAvatar.image, 17);
  assert.equal(events.remotePlayAvatar.wide, 64);
  assert.equal(events.remotePlayAvatar.tall, 64);
  assert.equal(events.timelinePhase.phaseId, "round-1");
  assert.equal(events.timelinePhase.recordingMs, 1500n);
  assert.equal(events.timelinePhase.longestClipMs, 750n);
  assert.equal(events.timelinePhase.clipCount, 2);
  assert.equal(events.timelinePhase.screenshotCount, 3);
  assert.equal(events.timelineEvent.event, 9001n);
  assert.equal(events.timelineEvent.recordingExists, true);

  for (const handle of handles) {
    handle.disconnect();
  }

  const callbackIds = [
    steam.SteamCallback.ScreenshotReady,
    steam.SteamCallback.ScreenshotRequested,
    steam.SteamCallback.PlaybackStatusHasChanged,
    steam.SteamCallback.VolumeHasChanged,
    steam.SteamCallback.MusicPlayerWantsVolume,
    steam.SteamCallback.MusicPlayerSelectsQueueEntry,
    steam.SteamCallback.MusicPlayerSelectsPlaylistEntry,
    steam.SteamCallback.MusicPlayerRemoteWillActivate,
    steam.SteamCallback.MusicPlayerRemoteWillDeactivate,
    steam.SteamCallback.MusicPlayerRemoteToFront,
    steam.SteamCallback.MusicPlayerWillQuit,
    steam.SteamCallback.MusicPlayerWantsPlay,
    steam.SteamCallback.MusicPlayerWantsPause,
    steam.SteamCallback.MusicPlayerWantsPlayPrevious,
    steam.SteamCallback.MusicPlayerWantsPlayNext,
    steam.SteamCallback.MusicPlayerWantsShuffled,
    steam.SteamCallback.MusicPlayerWantsLooped,
    steam.SteamCallback.MusicPlayerWantsPlayingRepeatStatus,
    steam.SteamCallback.BroadcastUploadStart,
    steam.SteamCallback.BroadcastUploadStop,
    steam.SteamCallback.GetVideoURLResult,
    steam.SteamCallback.GetOPFSettingsResult,
    steam.SteamCallback.SteamParentalSettingsChanged,
    steam.SteamCallback.SteamRemotePlaySessionConnected,
    steam.SteamCallback.SteamRemotePlaySessionDisconnected,
    steam.SteamCallback.SteamRemotePlayTogetherGuestInvite,
    steam.SteamCallback.SteamRemotePlaySessionAvatarLoaded,
    steam.SteamCallback.SteamTimelineGamePhaseRecordingExists,
    steam.SteamCallback.SteamTimelineEventRecordingExists
  ];
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback"),
    callbackIds.map((callbackId) => ({ method: "registerSteamCallback", args: [callbackId] }))
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback"),
    callbackIds.map((callbackId) => ({ method: "disconnectCallback", args: [callbackId] }))
  );
});

test("overlay helpers map constants and forward modal/store options", (t) => {
  const fake = createFakeNative({
    openNativeOverlayProbeWindow(title) {
      this.calls.push({ method: "openNativeOverlayProbeWindow", args: [title] });
    },
    attachNativeOverlayHostView(nativeWindowHandle) {
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    pumpNativeOverlayHostView() {
      this.calls.push({ method: "pumpNativeOverlayHostView", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    hideNativeOverlayHostView() {
      this.calls.push({ method: "hideNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    updateNativeOverlayHostFrame(frame, width, height) {
      this.calls.push({ method: "updateNativeOverlayHostFrame", args: [frame, width, height] });
    },
    closeNativeOverlayProbeWindow() {
      this.calls.push({ method: "closeNativeOverlayProbeWindow", args: [] });
    },
    detachNativeOverlayHostView() {
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      this.calls.push({ method: "isNativeOverlayProbeWindowOpen", args: [] });
      return true;
    },
    isNativeOverlayHostViewOpen() {
      this.calls.push({ method: "isNativeOverlayHostViewOpen", args: [] });
      return false;
    },
    getMacWindowSnapshot(appId) {
      this.calls.push({ method: "getMacWindowSnapshot", args: [appId] });
      return appId === 480 ? "snapshot" : undefined;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const nativeWindowHandle = Buffer.from([1, 2, 3, 4]);
  const frame = Buffer.alloc(16, 255);
  const presenterCalls = [];
  const mockPresenter = {
    prepareForOverlay() {
      presenterCalls.push("prepareForOverlay");
    },
    prepareForPassiveOverlay() {
      presenterCalls.push("prepareForPassiveOverlay");
    },
    prepareForTransparentInputOverlay() {
      presenterCalls.push("prepareForTransparentInputOverlay");
    },
    close() {},
    disconnect() {},
    pump() {},
    show() {},
    hide() {},
    isOpen() {
      return true;
    },
    snapshot() {
      return {};
    }
  };

  steam.overlay.activateDialog(steam.Dialog.Achievements);
  steam.overlay.activateToWebPage("https://store.steampowered.com/app/480/", { modal: true });
  steam.overlay.activateDialogToUser(steam.Dialog.Friends, 76561198000000000n);
  steam.overlay.activateToStore(480, steam.StoreFlag.AddToCart);
  steam.overlay.openFriendsOverlay({ presenter: mockPresenter });
  steam.overlay.openProfileOverlay({ steamId64: 76561198000000000n, presenter: mockPresenter });
  steam.overlay.openPlayersOverlay({ steamId64: 76561198000000000n, presenter: mockPresenter });
  steam.overlay.openCommunityOverlay({ appId: 480, presenter: mockPresenter });
  steam.overlay.openStatsOverlay({ appId: 480, steamId64: 76561198000000000n, presenter: mockPresenter });
  steam.overlay.openAchievementsOverlay({ appId: 480, steamId64: 76561198000000000n, presenter: mockPresenter });
  steam.overlay.openUserOverlay({
    dialog: steam.UserDialog.SteamId,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openUserOverlay({
    dialog: steam.UserDialog.Chat,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openUserOverlay({
    dialog: steam.UserDialog.Stats,
    appId: 480,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openUserOverlay({
    dialog: steam.UserDialog.Achievements,
    appId: 480,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openCheckoutOverlay({
    transactionId: 123456789n,
    returnUrl: "steam://return",
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "web",
    url: "https://store.steampowered.com/app/480/",
    modal: true,
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "store",
    appId: 480,
    flag: steam.StoreFlag.AddToCart,
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "store",
    appId: 480,
    flag: steam.StoreFlag.AddToCart,
    route: "native",
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({ type: "friends", presenter: mockPresenter });
  steam.overlay.openSteamOverlay({ type: "profile", steamId64: 76561198000000000n, presenter: mockPresenter });
  steam.overlay.openSteamOverlay({ type: "players", steamId64: 76561198000000000n, presenter: mockPresenter });
  steam.overlay.openSteamOverlay({ type: "community", appId: 480, presenter: mockPresenter });
  steam.overlay.openSteamOverlay({
    type: "stats",
    appId: 480,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "achievements",
    appId: 480,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "user",
    dialog: steam.UserDialog.SteamId,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "user",
    dialog: steam.UserDialog.Chat,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "user",
    dialog: steam.UserDialog.Stats,
    appId: 480,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "user",
    dialog: steam.UserDialog.Achievements,
    appId: 480,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  assert.throws(
    () =>
      steam.overlay.openSteamOverlay({
        type: "user",
        dialog: " ",
        steamId64: 76561198000000000n,
        presenter: mockPresenter
      }),
    /user dialog name cannot be empty/
  );
  steam.overlay.openSteamOverlay({
    type: "user",
    dialog: steam.UserDialog.FriendAdd,
    steamId64: 76561198000000000n,
    route: "native",
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "checkout",
    steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/987/",
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({ type: "dialog", dialog: steam.Dialog.Friends, presenter: mockPresenter });
  steam.overlay.openSteamOverlay({
    type: "dialog",
    dialog: steam.Dialog.Players,
    appId: 480,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({ type: "dialog", dialog: steam.Dialog.Community, appId: 480, presenter: mockPresenter });
  steam.overlay.openSteamOverlay({
    type: "dialog",
    dialog: steam.Dialog.OfficialGameGroup,
    appId: 480,
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "dialog",
    dialog: steam.Dialog.Stats,
    appId: 480,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "dialog",
    dialog: steam.Dialog.Achievements,
    appId: 480,
    steamId64: 76561198000000000n,
    presenter: mockPresenter
  });
  steam.overlay.openSteamOverlay({
    type: "dialog",
    dialog: steam.Dialog.Friends,
    route: "native",
    presenter: mockPresenter
  });
  assert.throws(
    () =>
      steam.overlay.openSteamOverlay({
        type: "dialog",
        dialog: steam.Dialog.Settings,
        presenter: mockPresenter
      }),
    /does not have a verified presenter-backed route/
  );
  steam.overlay.openSteamOverlay({
    type: "dialog",
    dialog: steam.Dialog.Settings,
    route: "native",
    presenter: mockPresenter
  });
  steam.openNativeOverlayProbeWindow("Steam Overlay Probe");
  steam.overlay.attachNativeOverlayHostView(nativeWindowHandle);
  steam.overlay.pumpNativeOverlayProbeWindow();
  steam.pumpNativeOverlayHostView();
  steam.overlay.showNativeOverlayHostView();
  steam.hideNativeOverlayHostView();
  steam.overlay.setNativeOverlayHostInputPassthrough(true);
  steam.overlay.setNativeOverlayHostOpacity(false);
  steam.overlay.updateNativeOverlayHostFrame(frame, 2, 2);
  steam.closeNativeOverlayProbeWindow();
  steam.overlay.detachNativeOverlayHostView();
  assert.equal(steam.isNativeOverlayProbeWindowOpen(), true);
  assert.equal(steam.overlay.isNativeOverlayHostViewOpen(), false);
  assert.equal(steam.getMacWindowSnapshot(480), "snapshot");
  assert.equal(steam.overlay.getMacWindowSnapshot(), undefined);

  assert.deepEqual(
    fake.calls.filter((call) => call.method.startsWith("activate") || call.method.startsWith("overlay")),
    [
      { method: "activateOverlay", args: ["Achievements"] },
      { method: "activateOverlayToWebPage", args: ["https://store.steampowered.com/app/480/", true] },
      { method: "overlayActivateDialogToUser", args: ["Friends", 76561198000000000n] },
      { method: "overlayActivateToStore", args: [480, steam.StoreFlag.AddToCart] },
      { method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityProfileUrl(76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityPlayersUrl(76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityAppUrl(480), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityUserStatsUrl(480, 76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityAchievementsUrl(480, 76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityProfileUrl(76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityUserStatsUrl(480, 76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityAchievementsUrl(480, 76561198000000000n), true] },
      {
        method: "activateOverlayToWebPage",
        args: [
          "https://checkout.steampowered.com/checkout/approvetxn/123456789/?returnurl=steam%3A%2F%2Freturn",
          true
        ]
      },
      { method: "activateOverlayToWebPage", args: ["https://store.steampowered.com/app/480/", true] },
      { method: "activateOverlayToWebPage", args: [steam.steamStoreAppUrl(480), true] },
      { method: "overlayActivateToStore", args: [480, steam.StoreFlag.AddToCart] },
      { method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityProfileUrl(76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityPlayersUrl(76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityAppUrl(480), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityUserStatsUrl(480, 76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityAchievementsUrl(480, 76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityProfileUrl(76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityUserStatsUrl(480, 76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityAchievementsUrl(480, 76561198000000000n), true] },
      { method: "overlayActivateDialogToUser", args: ["friendadd", 76561198000000000n] },
      {
        method: "activateOverlayToWebPage",
        args: ["https://checkout.steampowered.com/checkout/approvetxn/987/", true]
      },
      { method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityPlayersUrl(76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityAppUrl(480), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityAppUrl(480), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityUserStatsUrl(480, 76561198000000000n), true] },
      { method: "activateOverlayToWebPage", args: [steam.steamCommunityAchievementsUrl(480, 76561198000000000n), true] },
      { method: "activateOverlay", args: ["Friends"] },
      { method: "activateOverlay", args: ["Settings"] }
    ]
  );
  assert.equal(steam.STEAM_STORE_BASE_URL, "https://store.steampowered.com");
  assert.equal(steam.steamStoreAppUrl(480), "https://store.steampowered.com/app/480/");
  assert.equal(steam.STEAM_COMMUNITY_BASE_URL, "https://steamcommunity.com");
  assert.equal(steam.UserDialog.SteamId, "steamid");
  assert.equal(steam.UserDialog.FriendAdd, "friendadd");
  assert.equal(steam.steamCommunityAppUrl(480), "https://steamcommunity.com/app/480/");
  assert.equal(
    steam.steamCommunityProfileUrl(76561198000000000n),
    "https://steamcommunity.com/profiles/76561198000000000/"
  );
  assert.equal(
    steam.steamCommunityPlayersUrl(76561198000000000n),
    "https://steamcommunity.com/profiles/76561198000000000/friends/coplay/"
  );
  assert.equal(steam.steamCommunityStatsUrl(480), "https://steamcommunity.com/stats/480/");
  assert.equal(
    steam.steamCommunityUserStatsUrl(480, 76561198000000000n),
    "https://steamcommunity.com/profiles/76561198000000000/stats/480/"
  );
  assert.equal(
    steam.steamCommunityAchievementsUrl(480, 76561198000000000n),
    "https://steamcommunity.com/profiles/76561198000000000/stats/480/achievements/"
  );
  assert.equal(steam.STEAM_CHECKOUT_BASE_URL, "https://checkout.steampowered.com");
  assert.equal(
    steam.steamCheckoutTransactionUrl(123456789n),
    "https://checkout.steampowered.com/checkout/approvetxn/123456789/"
  );
  assert.equal(
    steam.steamCheckoutTransactionUrl("123456789", { returnUrl: "steam://return" }),
    "https://checkout.steampowered.com/checkout/approvetxn/123456789/?returnurl=steam%3A%2F%2Freturn"
  );
  assert.throws(() => steam.steamCommunityAchievementsUrl(0), /Invalid Steam App ID/);
  assert.throws(() => steam.steamCommunityProfileUrl("not-a-steam-id"), /Invalid Steam ID/);
  assert.throws(() => steam.steamCommunityPlayersUrl("not-a-steam-id"), /Invalid Steam ID/);
  assert.throws(() => steam.steamCommunityAchievementsUrl(480, "not-a-steam-id"), /Invalid Steam ID/);
  assert.throws(() => steam.steamCheckoutTransactionUrl(0), /Invalid Steam transaction ID/);
  assert.throws(() => steam.steamCheckoutTransactionUrl(Number.MAX_SAFE_INTEGER + 1), /Invalid Steam transaction ID/);
  assert.throws(() => steam.overlay.openCheckoutOverlay({ presenter: mockPresenter }), /requires a url, steamUrl, or transactionId/);
  assert.deepEqual(presenterCalls, [
    ...Array(24).fill("prepareForOverlay"),
    "prepareForTransparentInputOverlay",
    ...Array(7).fill("prepareForOverlay"),
    "prepareForTransparentInputOverlay",
    "prepareForTransparentInputOverlay"
  ]);
  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "openNativeOverlayProbeWindow",
        "attachNativeOverlayHostView",
        "pumpNativeOverlayProbeWindow",
        "pumpNativeOverlayHostView",
        "showNativeOverlayHostView",
        "hideNativeOverlayHostView",
        "setNativeOverlayHostInputPassthrough",
        "setNativeOverlayHostOpacity",
        "updateNativeOverlayHostFrame",
        "closeNativeOverlayProbeWindow",
        "detachNativeOverlayHostView",
        "isNativeOverlayProbeWindowOpen",
        "isNativeOverlayHostViewOpen",
        "getMacWindowSnapshot"
      ].includes(call.method)
    ),
    [
      { method: "openNativeOverlayProbeWindow", args: ["Steam Overlay Probe"] },
      { method: "attachNativeOverlayHostView", args: [nativeWindowHandle] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "pumpNativeOverlayHostView", args: [] },
      { method: "showNativeOverlayHostView", args: [] },
      { method: "hideNativeOverlayHostView", args: [] },
      { method: "setNativeOverlayHostInputPassthrough", args: [true] },
      { method: "setNativeOverlayHostOpacity", args: [false] },
      { method: "updateNativeOverlayHostFrame", args: [frame, 2, 2] },
      { method: "closeNativeOverlayProbeWindow", args: [] },
      { method: "detachNativeOverlayHostView", args: [] },
      { method: "isNativeOverlayProbeWindowOpen", args: [] },
      { method: "isNativeOverlayHostViewOpen", args: [] },
      { method: "getMacWindowSnapshot", args: [480] },
      { method: "getMacWindowSnapshot", args: [undefined] }
    ]
  );
});

test("electron overlay helper scrubs Steam overlay preload from child process env", (t) => {
  clearSteamBridgeCache();
  const electron = require(distFile("electron.js"));
  t.after(clearSteamBridgeCache);

  const env = {
    LD_PRELOAD:
      "/tmp/keep.so:/home/deck/.local/share/Steam/ubuntu12_64/gameoverlayrenderer.so /home/deck/.local/share/Steam/ubuntu12_32/gameoverlayrenderer.so",
    DYLD_INSERT_LIBRARIES:
      "/Users/me/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamloader.dylib:/Users/me/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/gameoverlayrenderer.dylib",
    OTHER: "untouched"
  };

  assert.deepEqual(electron.electronScrubSteamOverlayChildProcessEnv(env), [
    "LD_PRELOAD",
    "DYLD_INSERT_LIBRARIES"
  ]);
  assert.equal(env.LD_PRELOAD, "/tmp/keep.so");
  assert.equal(
    env.DYLD_INSERT_LIBRARIES,
    "/Users/me/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamloader.dylib"
  );
  assert.equal(env.OTHER, "untouched");

  assert.deepEqual(electron.electronScrubSteamOverlayChildProcessEnv(env), []);
});

test("electron steam overlay manager owns one presenter and routes opens", async (t) => {
  const hostHandle = Buffer.from([8, 7, 6, 5]);
  let windowBounds = { x: 10, y: 20, width: 1280, height: 720 };
  let hostOpen = false;
  let closedHandler;
  let windowShowCount = 0;
  let windowFocusCount = 0;
  let windowInvalidateCount = 0;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    getBounds() {
      return windowBounds;
    },
    once(event, handler) {
      if (event === "closed") {
        closedHandler = handler;
      }
    },
    show() {
      windowShowCount += 1;
    },
    focus() {
      windowFocusCount += 1;
    },
    webContents: {
      once() {},
      invalidate() {
        windowInvalidateCount += 1;
      },
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Managed Overlay",
    pollIntervalMs: 10000
  });

  assert.equal(overlay.isOpen(), true);
  const initialSnapshot = overlay.snapshot();
  assert.equal(initialSnapshot.nativeHostOpen, true);
  assert.deepEqual(initialSnapshot.bounds, windowBounds);
  const initialAvailability = overlay.getNativeHostAvailability();
  assert.equal(initialAvailability.available, true);
  assert.equal(initialAvailability.code, undefined);
  assert.equal(initialAvailability.reason, undefined);
  assert.equal(initialAvailability.nativeHostUnavailableReason, undefined);
  assert.equal(initialAvailability.snapshot.nativeHostOpen, true);
  const friendsTarget = { type: "friends" };
  const friendsOpenStatus = overlay.getOpenStatus(friendsTarget);
  assert.equal(friendsOpenStatus.canOpen, true);
  assert.equal(friendsOpenStatus.canWait, true);
  assert.deepEqual(friendsOpenStatus.targetSnapshot, { type: "friends" });
  assert.equal(friendsOpenStatus.reason, undefined);
  assert.equal(friendsOpenStatus.waitReason, undefined);
  assert.equal(friendsOpenStatus.nativeHostAvailability.available, true);
  assert.equal(friendsOpenStatus.snapshot.nativeHostOpen, true);
  assert.equal(overlay.openIfAvailable(friendsTarget), overlay.presenter);
  assert.equal(windowShowCount, 1);
  assert.equal(windowFocusCount, 1);
  assert.equal(windowInvalidateCount, 1);
  const webTarget = { type: "web", url: "https://store.steampowered.com/app/480/", modal: true };
  const openingOpenStatus = overlay.getOpenStatus(webTarget);
  assert.equal(openingOpenStatus.canOpen, false);
  assert.equal(openingOpenStatus.canWait, false);
  assert.equal(openingOpenStatus.reason, "opening");
  assert.equal(openingOpenStatus.waitReason, "opening");
  assert.match(openingOpenStatus.message, /already opening/);
  const openingShortcutStatus = overlay.getShortcutOpenStatus();
  assert.equal(openingShortcutStatus.canOpen, false);
  assert.equal(openingShortcutStatus.canWait, false);
  assert.equal(openingShortcutStatus.reason, "opening");
  assert.equal(openingShortcutStatus.waitReason, "opening");
  assert.equal(overlay.openIfAvailable(webTarget), null);
  assert.equal(await overlay.openAndWaitIfAvailable(webTarget, { showTimeoutMs: 5, closeTimeoutMs: 5 }), null);
  assert.equal(overlay.openShortcutTargetIfAvailable(), null);
  assert.equal(await overlay.openShortcutTargetAndWaitIfAvailable({ showTimeoutMs: 5, closeTimeoutMs: 5 }), null);
  let checkoutOperationRanWhileOpening = false;
  assert.equal(
    await overlay.openCheckoutAndWaitIfAvailable(
      () => {
        checkoutOperationRanWhileOpening = true;
        return "123";
      },
      { showTimeoutMs: 5, closeTimeoutMs: 5 }
    ),
    null
  );
  assert.equal(checkoutOperationRanWhileOpening, false);
  assert.throws(() => overlay.open(webTarget), /already opening/);
  assert.throws(() => overlay.prepareForCheckout(), /already opening/);

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  const activeOpenStatus = overlay.getOpenStatus(webTarget);
  assert.equal(activeOpenStatus.canOpen, false);
  assert.equal(activeOpenStatus.canWait, false);
  assert.equal(activeOpenStatus.reason, "overlay-active");
  assert.equal(activeOpenStatus.waitReason, "overlay-active");
  assert.match(activeOpenStatus.message, /already active/);
  const activeShortcutStatus = overlay.getShortcutOpenStatus();
  assert.equal(activeShortcutStatus.canOpen, false);
  assert.equal(activeShortcutStatus.canWait, false);
  assert.equal(activeShortcutStatus.reason, "overlay-active");
  assert.equal(activeShortcutStatus.waitReason, "overlay-active");
  assert.equal(overlay.openShortcutTargetIfAvailable(), null);
  assert.equal(await overlay.openShortcutTargetAndWaitIfAvailable({ showTimeoutMs: 5, closeTimeoutMs: 5 }), null);
  let checkoutOperationRanWhileActive = false;
  assert.equal(
    await overlay.openCheckoutAndWaitIfAvailable(
      () => {
        checkoutOperationRanWhileActive = true;
        return "456";
      },
      { showTimeoutMs: 5, closeTimeoutMs: 5 }
    ),
    null
  );
  assert.equal(checkoutOperationRanWhileActive, false);
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const reopenedOpenStatus = overlay.getOpenStatus(webTarget);
  assert.equal(reopenedOpenStatus.canOpen, true);
  assert.equal(reopenedOpenStatus.canWait, true);
  assert.equal(reopenedOpenStatus.reason, undefined);
  assert.equal(reopenedOpenStatus.waitReason, undefined);
  const rawDialogStatus = overlay.getOpenStatus({
    type: "dialog",
    dialog: steam.Dialog.Friends,
    route: "native"
  });
  assert.equal(rawDialogStatus.canOpen, true);
  assert.equal(rawDialogStatus.canWait, false);
  assert.equal(rawDialogStatus.reason, undefined);
  assert.equal(rawDialogStatus.waitReason, "not-waitable");
  assert.match(rawDialogStatus.message, /openAndWait\(\) requires a presenter-backed target/);
  const unsupportedDialogTarget = {
    type: "dialog",
    dialog: steam.Dialog.Settings
  };
  const unsupportedDialogStatus = overlay.getOpenStatus(unsupportedDialogTarget);
  assert.equal(unsupportedDialogStatus.canOpen, false);
  assert.equal(unsupportedDialogStatus.canWait, false);
  assert.deepEqual(unsupportedDialogStatus.targetSnapshot, {
    type: "dialog",
    dialog: steam.Dialog.Settings
  });
  assert.equal(unsupportedDialogStatus.reason, "unsupported-target");
  assert.equal(unsupportedDialogStatus.waitReason, "unsupported-target");
  assert.match(unsupportedDialogStatus.message, /does not have a verified presenter-backed route/);
  assert.equal(overlay.openIfAvailable(unsupportedDialogTarget), null);
  assert.deepEqual(initialSnapshot.electronOverlay, {
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
  });
  windowBounds = { x: 24, y: 32, width: 1920, height: 1080 };
  assert.deepEqual(overlay.snapshot().bounds, windowBounds);

  overlay.open(webTarget);
  assert.equal(windowShowCount, 3);
  assert.equal(windowFocusCount, 3);
  assert.equal(windowInvalidateCount, 3);
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const checkoutPreparedLastCall = [];
  const checkoutResult = await overlay.withCheckoutPrepared(() => {
    checkoutPreparedLastCall.push(fake.calls.at(-1)?.method);
    return { steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/123/" };
  }, { durationMs: 2500 });
  assert.deepEqual(checkoutPreparedLastCall, ["pumpNativeOverlayProbeWindow"]);
  assert.deepEqual(checkoutResult, {
    steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/123/"
  });
  overlay.prepareForCheckout();
  overlay.prepareForNotification();
  overlay.pump();

  assert.equal(typeof closedHandler, "function");
  closedHandler();
  assert.equal(overlay.isOpen(), false);
  const closedOpenStatus = overlay.getOpenStatus({ type: "friends" });
  assert.equal(closedOpenStatus.canOpen, false);
  assert.equal(closedOpenStatus.canWait, false);
  assert.equal(closedOpenStatus.reason, "closed");
  assert.equal(closedOpenStatus.waitReason, "closed");
  assert.equal(overlay.openIfAvailable(friendsTarget), null);
  assert.throws(() => overlay.open({ type: "friends" }), /Electron Steam overlay is closed/);
  assert.throws(() => overlay.prepareForCheckout(), /Electron Steam overlay is closed/);
  await assert.rejects(overlay.withCheckoutPrepared(() => "closed"), /Electron Steam overlay is closed/);

  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "attachNativeOverlayHostView",
        "showNativeOverlayHostView",
        "setNativeOverlayHostInputPassthrough",
        "setNativeOverlayHostOpacity",
        "pumpNativeOverlayProbeWindow",
        "activateOverlayToWebPage",
        "disconnectGameOverlayActivated",
        "detachNativeOverlayHostView"
      ].includes(call.method)
    ),
    [
      { method: "attachNativeOverlayHostView", args: [hostHandle] },
      { method: "showNativeOverlayHostView", args: [] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "setNativeOverlayHostInputPassthrough", args: [false] },
      { method: "setNativeOverlayHostOpacity", args: [true] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] },
      { method: "setNativeOverlayHostInputPassthrough", args: [true] },
      { method: "setNativeOverlayHostOpacity", args: [false] },
      { method: "setNativeOverlayHostInputPassthrough", args: [false] },
      { method: "setNativeOverlayHostOpacity", args: [true] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "activateOverlayToWebPage", args: ["https://store.steampowered.com/app/480/", true] },
      { method: "setNativeOverlayHostInputPassthrough", args: [true] },
      { method: "setNativeOverlayHostOpacity", args: [false] },
      { method: "setNativeOverlayHostInputPassthrough", args: [false] },
      { method: "setNativeOverlayHostOpacity", args: [true] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "setNativeOverlayHostInputPassthrough", args: [true] },
      { method: "setNativeOverlayHostOpacity", args: [false] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "disconnectGameOverlayActivated", args: [] },
      { method: "detachNativeOverlayHostView", args: [] }
    ]
  );
});

test("electron steam overlay manager syncs the presenter on window geometry events", (t) => {
  const hostHandle = Buffer.from([6, 7, 8, 9]);
  let hostOpen = false;
  let windowBounds = { x: 12, y: 24, width: 900, height: 600 };
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const handlers = new Map();
  const removedEvents = [];
  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    getBounds() {
      return windowBounds;
    },
    on(event, handler) {
      handlers.set(event, handler);
    },
    off(event, handler) {
      if (handlers.get(event) === handler) {
        handlers.delete(event);
      }
      removedEvents.push(event);
    },
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Geometry Sync Overlay",
    pollIntervalMs: 10000
  });

  assert.equal(handlers.has("resize"), true);
  assert.equal(handlers.has("move"), true);
  assert.equal(handlers.has("enter-full-screen"), true);
  assert.equal(pumpCalls().length, 1);

  const resizeHandler = handlers.get("resize");
  windowBounds = { x: 16, y: 32, width: 1280, height: 720 };
  resizeHandler();
  assert.equal(pumpCalls().length, 2);
  assert.deepEqual(overlay.snapshot().bounds, windowBounds);

  handlers.get("enter-full-screen")();
  assert.equal(pumpCalls().length, 3);

  overlay.close();
  assert.equal(handlers.size, 0);
  assert.equal(removedEvents.includes("resize"), true);
  assert.equal(removedEvents.includes("enter-full-screen"), true);

  resizeHandler();
  assert.equal(pumpCalls().length, 3);

  function pumpCalls() {
    return fake.calls.filter((call) => call.method === "pumpNativeOverlayProbeWindow");
  }
});

test("electron steam overlay checkout preparation holds only for the wrapped operation", async (t) => {
  const hostHandle = Buffer.from([1, 3, 5, 7]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Checkout Overlay",
    pollIntervalMs: 10000
  });

  overlay.prepareForCheckout();
  const prepareOnly = overlay.snapshot();
  assert.equal(prepareOnly.mode, "passive");
  assert.equal(prepareOnly.clickThrough, true);
  assert.equal(prepareOnly.transparent, true);
  assert.equal(prepareOnly.currentFps, 0);

  let duringOperation;
  const result = await overlay.withCheckoutPrepared(() => {
    duringOperation = overlay.snapshot();
    return "ready";
  }, { durationMs: 999999 });
  const afterOperation = overlay.snapshot();

  assert.equal(result, "ready");
  assert.equal(duringOperation.mode, "active");
  assert.equal(duringOperation.clickThrough, false);
  assert.equal(duringOperation.transparent, false);
  assert.equal(duringOperation.currentFps, 30);
  assert.equal(duringOperation.overlayActive, false);
  assert.equal(afterOperation.mode, "passive");
  assert.equal(afterOperation.clickThrough, true);
  assert.equal(afterOperation.transparent, true);
  assert.equal(afterOperation.currentFps, 0);

  const abortController = new AbortController();
  let resolvePreparedOperation;
  const abortedPrepared = overlay.withCheckoutPrepared(
    () =>
      new Promise((resolve) => {
        resolvePreparedOperation = resolve;
      }),
    { signal: abortController.signal }
  );

  await Promise.resolve();
  assert.equal(typeof resolvePreparedOperation, "function");
  const duringAbortedOperation = overlay.snapshot();
  assert.equal(duringAbortedOperation.mode, "active");
  assert.equal(duringAbortedOperation.currentFps, 30);

  abortController.abort();
  await assert.rejects(abortedPrepared, (error) => {
    assert.equal(error instanceof steam.SteamOverlayWaitAbortedError, true);
    assert.equal(error.name, "SteamOverlayWaitAbortedError");
    assert.equal(error.code, "STEAM_OVERLAY_WAIT_ABORTED");
    assert.equal(error.state, "finish checkout preparation operation");
    assert.equal(error.snapshot.mode, "active");
    assert.equal(error.snapshot.currentFps, 30);
    assert.deepEqual(error.targetSnapshot, { type: "checkout" });
    assert.deepEqual(error.checkoutTargetSnapshot, { type: "checkout" });
    assert.match(error.message, /Aborted waiting for Steam overlay to finish checkout preparation operation/);
    return true;
  });
  resolvePreparedOperation("late");

  const afterAbortedOperation = overlay.snapshot();
  assert.equal(afterAbortedOperation.mode, "passive");
  assert.equal(afterAbortedOperation.clickThrough, true);
  assert.equal(afterAbortedOperation.transparent, true);
  assert.equal(afterAbortedOperation.currentFps, 0);

  assert.deepEqual(
    fake.calls
      .filter((call) => call.method === "setNativeOverlayHostInputPassthrough")
      .map((call) => call.args[0]),
    [false, true, false, true]
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "setNativeOverlayHostOpacity").map((call) => call.args[0]),
    [true, false, true, false]
  );

  overlay.close();
});

test("electron steam overlay open holds the presenter until Steam reports shown", async (t) => {
  const hostHandle = Buffer.from([8, 5, 3, 0]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  let focusCount = 0;
  let showCount = 0;
  let invalidateCount = 0;
  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    show() {
      showCount += 1;
    },
    focus() {
      focusCount += 1;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {
        invalidateCount += 1;
      },
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Managed Open Overlay",
    pollIntervalMs: 10000
  });

  assert.equal(overlay.snapshot().electronOverlay.restoreFocusDelayMs, 0);
  assert.equal(overlay.snapshot().electronOverlay.activationBoostMs, 0);
  assert.equal(overlay.snapshot().electronOverlay.activeGraceMs, 0);

  overlay.open({ type: "friends" });
  assert.equal(showCount, 1);
  assert.equal(focusCount, 1);
  assert.equal(invalidateCount, 1);

  const waitingForSteam = overlay.snapshot();
  assert.equal(waitingForSteam.mode, "active");
  assert.equal(waitingForSteam.clickThrough, false);
  assert.equal(waitingForSteam.transparent, false);
  assert.equal(waitingForSteam.currentFps, 30);
  assert.equal(waitingForSteam.overlayActive, false);

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  await Promise.resolve();

  const shown = overlay.snapshot();
  assert.equal(shown.overlayActive, true);
  assert.equal(shown.overlayWasActive, true);
  assert.equal(shown.currentFps, 30);

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });

  const parked = overlay.snapshot();
  assert.equal(parked.mode, "passive");
  assert.equal(parked.clickThrough, true);
  assert.equal(parked.transparent, true);
  assert.equal(parked.currentFps, 0);
  assert.equal(showCount, 2);
  assert.equal(focusCount, 2);
  assert.equal(invalidateCount, 2);

  overlay.close();
});

test("electron steam overlay manager primes passive notification toasts automatically", (t) => {
  const hostHandle = Buffer.from([3, 1, 4, 1]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    },
    achievementActivate(name) {
      this.calls.push({ method: "achievementActivate", args: [name] });
      return true;
    },
    achievementIndicateProgress(name, current, max) {
      this.calls.push({ method: "achievementIndicateProgress", args: [name, current, max] });
      return true;
    },
    statsStore() {
      this.calls.push({ method: "statsStore", args: [] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Notification Overlay",
    pollIntervalMs: 10000
  });

  assert.equal(overlay.snapshot().electronOverlay.autoPrepareForNotifications, true);
  assert.deepEqual(notificationCalls(), ["pumpNativeOverlayProbeWindow"]);

  assert.equal(steam.achievement.indicateProgress("ACH_PROGRESS", 1, 2), true);
  assert.deepEqual(notificationCalls(), [
    "pumpNativeOverlayProbeWindow",
    "pumpNativeOverlayProbeWindow",
    "achievementIndicateProgress"
  ]);

  assert.equal(steam.achievement.activate("ACH_WIN"), true);
  assert.equal(steam.stats.store(), true);
  assert.deepEqual(notificationCalls(), [
    "pumpNativeOverlayProbeWindow",
    "pumpNativeOverlayProbeWindow",
    "achievementIndicateProgress",
    "pumpNativeOverlayProbeWindow",
    "achievementActivate",
    "pumpNativeOverlayProbeWindow",
    "statsStore"
  ]);

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  const activeCallCount = notificationCalls().length;
  assert.equal(steam.achievement.indicateProgress("ACH_ACTIVE", 2, 3), true);
  assert.deepEqual(notificationCalls().slice(activeCallCount), ["achievementIndicateProgress"]);

  overlay.close();

  function notificationCalls() {
    return fake.calls
      .filter((call) =>
        [
          "pumpNativeOverlayProbeWindow",
          "achievementIndicateProgress",
          "achievementActivate",
          "statsStore"
        ].includes(call.method)
      )
      .map((call) => call.method);
  }
});

test("electron steam overlay notification priming retries after macOS host becomes available", (t) => {
  setProcessPlatformForTest(t, "darwin");

  const hostHandle = Buffer.from([2, 4, 6, 8]);
  let hostOpen = false;
  let macEnvironment = { screenLocked: true, displayAsleep: true };
  const fake = createFakeNative({
    getMacOverlayEnvironment() {
      this.calls.push({ method: "getMacOverlayEnvironment", args: [] });
      return macEnvironment;
    },
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    },
    achievementActivate(name) {
      this.calls.push({ method: "achievementActivate", args: [name] });
      return true;
    },
    achievementIndicateProgress(name, current, max) {
      this.calls.push({ method: "achievementIndicateProgress", args: [name, current, max] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Notification macOS Availability Overlay",
    pollIntervalMs: 10000
  });

  assert.equal(overlay.snapshot().nativeHostUnavailableReason, "macos-screen-locked");
  assert.equal(overlay.snapshot().currentFps, 0);

  assert.equal(steam.achievement.indicateProgress("ACH_LOCKED", 1, 2), true);
  assert.deepEqual(notificationCalls(), ["achievementIndicateProgress"]);
  assert.equal(overlay.snapshot().nativeHostUnavailableReason, "macos-screen-locked");
  assert.equal(overlay.snapshot().nativeHostOpen, false);
  assert.equal(overlay.snapshot().currentFps, 0);

  macEnvironment = { screenLocked: false, displayAsleep: false };

  assert.equal(steam.achievement.activate("ACH_UNLOCKED"), true);
  assert.deepEqual(notificationCalls(), [
    "achievementIndicateProgress",
    "attachNativeOverlayHostView",
    "showNativeOverlayHostView",
    "pumpNativeOverlayProbeWindow",
    "achievementActivate"
  ]);
  const available = overlay.snapshot();
  assert.equal(available.nativeHostUnavailableReason, undefined);
  assert.equal(available.nativeHostOpen, true);
  assert.equal(available.currentFps, 0);

  overlay.close();

  function notificationCalls() {
    return fake.calls
      .filter((call) =>
        [
          "attachNativeOverlayHostView",
          "showNativeOverlayHostView",
          "pumpNativeOverlayProbeWindow",
          "achievementIndicateProgress",
          "achievementActivate"
        ].includes(call.method)
      )
      .map((call) => call.method);
  }
});

test("electron steam overlay manager can disable automatic passive notification priming", (t) => {
  const hostHandle = Buffer.from([2, 7, 1, 8]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    },
    achievementIndicateProgress(name, current, max) {
      this.calls.push({ method: "achievementIndicateProgress", args: [name, current, max] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Manual Notification Overlay",
    autoPrepareForNotifications: false,
    pollIntervalMs: 10000
  });

  assert.equal(overlay.snapshot().electronOverlay.autoPrepareForNotifications, false);
  assert.equal(steam.achievement.indicateProgress("ACH_MANUAL", 1, 2), true);
  assert.deepEqual(
    fake.calls
      .filter((call) => ["pumpNativeOverlayProbeWindow", "achievementIndicateProgress"].includes(call.method))
      .map((call) => call.method),
    ["pumpNativeOverlayProbeWindow", "achievementIndicateProgress"]
  );

  overlay.close();
});

test("electron steam overlay manager can fall back to native overlay sessions", (t) => {
  const hostHandle = Buffer.from([9, 9, 9, 9]);
  const windowBounds = { x: 4, y: 8, width: 1024, height: 768 };
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    getBounds() {
      return windowBounds;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Session Fallback",
    presenterMode: "session"
  });

  assert.equal(overlay.isOpen(), true);
  assert.equal(overlay.snapshot().attached, false);
  assert.equal(overlay.snapshot().backend, "none");
  assert.equal(overlay.snapshot().bounds, undefined);
  assert.deepEqual(overlay.snapshot().electronOverlay, {
    presenterMode: "session",
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
  });
  assert.deepEqual(fake.calls.filter((call) => call.method === "attachNativeOverlayHostView"), []);

  overlay.open({ type: "web", url: "https://store.steampowered.com/app/480/", modal: true });

  assert.equal(overlay.snapshot().attached, true);
  assert.equal(overlay.snapshot().backend, expectedNativeOverlayBackend(true));
  assert.deepEqual(overlay.snapshot().bounds, windowBounds);
  overlay.close();
  assert.equal(overlay.isOpen(), false);
  assert.equal(overlay.snapshot().attached, false);
  assert.equal(overlay.snapshot().backend, "none");
  assert.equal(overlay.snapshot().bounds, undefined);
  assert.equal(overlay.snapshot().currentFps, 0);

  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "attachNativeOverlayHostView",
        "showNativeOverlayHostView",
        "setNativeOverlayHostInputPassthrough",
        "setNativeOverlayHostOpacity",
        "pumpNativeOverlayProbeWindow",
        "activateOverlayToWebPage",
        "disconnectGameOverlayActivated",
        "detachNativeOverlayHostView"
      ].includes(call.method)
    ),
    [
      { method: "attachNativeOverlayHostView", args: [hostHandle] },
      { method: "showNativeOverlayHostView", args: [] },
      { method: "setNativeOverlayHostInputPassthrough", args: [false] },
      { method: "setNativeOverlayHostOpacity", args: [true] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "activateOverlayToWebPage", args: ["https://store.steampowered.com/app/480/", true] },
      { method: "disconnectGameOverlayActivated", args: [] },
      { method: "detachNativeOverlayHostView", args: [] }
    ]
  );
});

test("electron steam overlay manager honors the presenter kill switch env flag", (t) => {
  const previous = process.env.STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER;
  process.env.STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER = "1";

  t.after(() => {
    if (previous === undefined) {
      delete process.env.STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER;
    } else {
      process.env.STEAM_BRIDGE_DISABLE_ELECTRON_OVERLAY_PRESENTER = previous;
    }
    clearSteamBridgeCache();
  });

  const hostHandle = Buffer.from([1, 2, 3, 4]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Env Fallback"
  });

  assert.equal(overlay.snapshot().attached, false);
  assert.equal(overlay.snapshot().backend, "none");
  assert.equal(overlay.snapshot().electronOverlay.presenterMode, "session");
  assert.deepEqual(fake.calls.filter((call) => call.method === "attachNativeOverlayHostView"), []);
  overlay.prepareForCheckout();
  overlay.close();

  assert.deepEqual(
    fake.calls.filter((call) => call.method === "attachNativeOverlayHostView"),
    [{ method: "attachNativeOverlayHostView", args: [hostHandle] }]
  );
});

test("electron steam overlay manager fails clearly on Linux without X11 display", (t) => {
  const previousDisplay = process.env.DISPLAY;
  const previousWaylandDisplay = process.env.WAYLAND_DISPLAY;
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake, { linuxDisplay: false });
  const hostHandle = Buffer.from([3, 1, 4, 1]);
  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  setProcessPlatformForTest(t, "linux");
  delete process.env.DISPLAY;
  process.env.WAYLAND_DISPLAY = "wayland-0";

  t.after(() => {
    if (previousDisplay === undefined) {
      delete process.env.DISPLAY;
    } else {
      process.env.DISPLAY = previousDisplay;
    }
    if (previousWaylandDisplay === undefined) {
      delete process.env.WAYLAND_DISPLAY;
    } else {
      process.env.WAYLAND_DISPLAY = previousWaylandDisplay;
    }
    clearSteamBridgeCache();
  });

  assert.throws(
    () =>
      steam.overlay.createElectronSteamOverlay(window, {
        title: "Linux Headless Persistent Overlay"
      }),
    /requires an X11\/Xwayland DISPLAY on Linux/
  );

  const sessionOverlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Linux Headless Session Overlay",
    presenterMode: "session"
  });
  assert.equal(sessionOverlay.snapshot().backend, "none");
  assert.equal(sessionOverlay.snapshot().electronOverlay.presenterMode, "session");
  assert.throws(
    () =>
      sessionOverlay.open({
        type: "web",
        url: "https://store.steampowered.com/app/480/",
        modal: true
      }),
    /WAYLAND_DISPLAY is set to "wayland-0"/
  );
  sessionOverlay.close();

  assert.deepEqual(
    fake.calls.filter((call) => ["attachNativeOverlayHostView", "activateOverlayToWebPage"].includes(call.method)),
    []
  );
});

test("native overlay presenter snapshots identify the macOS host backend", (t) => {
  const previousOpenGlHost = process.env.STEAM_BRIDGE_MAC_NATIVE_OPENGL_HOST;
  const previousMetalHost = process.env.STEAM_BRIDGE_MAC_NATIVE_METAL_HOST;
  setProcessPlatformForTest(t, "darwin");

  t.after(() => {
    if (previousOpenGlHost === undefined) {
      delete process.env.STEAM_BRIDGE_MAC_NATIVE_OPENGL_HOST;
    } else {
      process.env.STEAM_BRIDGE_MAC_NATIVE_OPENGL_HOST = previousOpenGlHost;
    }
    if (previousMetalHost === undefined) {
      delete process.env.STEAM_BRIDGE_MAC_NATIVE_METAL_HOST;
    } else {
      process.env.STEAM_BRIDGE_MAC_NATIVE_METAL_HOST = previousMetalHost;
    }
    clearSteamBridgeCache();
  });

  let hostOpen = false;
  const hostHandle = Buffer.from([6, 2, 6, 2]);
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  delete process.env.STEAM_BRIDGE_MAC_NATIVE_OPENGL_HOST;
  delete process.env.STEAM_BRIDGE_MAC_NATIVE_METAL_HOST;
  const metalPresenter = steam.overlay.attachPresenter({
    nativeWindowHandle: hostHandle,
    pollIntervalMs: 10000
  });
  assert.equal(metalPresenter.snapshot().backend, "macos-metal");
  metalPresenter.close();

  process.env.STEAM_BRIDGE_MAC_NATIVE_METAL_HOST = "0";
  const disabledMetalPresenter = steam.overlay.attachPresenter({
    nativeWindowHandle: hostHandle,
    pollIntervalMs: 10000
  });
  assert.equal(disabledMetalPresenter.snapshot().backend, "macos-opengl");
  disabledMetalPresenter.close();

  process.env.STEAM_BRIDGE_MAC_NATIVE_OPENGL_HOST = "1";
  const openGlPresenter = steam.overlay.attachPresenter({
    nativeWindowHandle: hostHandle,
    pollIntervalMs: 10000
  });
  assert.equal(openGlPresenter.snapshot().backend, "macos-opengl");
  openGlPresenter.close();
});

test("electron steam overlay manager opens the presenter route from the default Shift+Tab shortcut", (t) => {
  const hostHandle = Buffer.from([4, 8, 15, 16]);
  let hostOpen = false;
  let beforeInputHandler;
  let removedHandler;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {},
      on(event, handler) {
        if (event === "before-input-event") {
          beforeInputHandler = handler;
        }
      },
      off(event, handler) {
        if (event === "before-input-event") {
          removedHandler = handler;
          beforeInputHandler = undefined;
        }
      }
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Shortcut Overlay",
    pollIntervalMs: 10000
  });

  assert.equal(typeof beforeInputHandler, "function");
  assert.deepEqual(overlay.snapshot().electronOverlay.overlayShortcut, {
    enabled: true,
    preventDefault: true,
    targetType: "friends",
    target: { type: "friends" }
  });
  let preventDefaultCount = 0;
  beforeInputHandler(
    {
      preventDefault() {
        preventDefaultCount += 1;
      }
    },
    {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      shift: true
    }
  );

  assert.equal(preventDefaultCount, 1);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [{ method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] }]
  );

  beforeInputHandler(
    {
      preventDefault() {
        preventDefaultCount += 1;
      }
    },
    {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      shift: true
    }
  );
  assert.equal(preventDefaultCount, 2);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [{ method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] }]
  );

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  beforeInputHandler(
    {
      preventDefault() {
        preventDefaultCount += 1;
      }
    },
    {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      shift: true
    }
  );
  assert.equal(preventDefaultCount, 2);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [{ method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] }]
  );

  beforeInputHandler(
    {
      preventDefault() {
        preventDefaultCount += 1;
      }
    },
    {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      shift: true,
      isAutoRepeat: true
    }
  );
  assert.equal(preventDefaultCount, 2);

  overlay.close();
  assert.equal(removedHandler !== undefined, true);
  assert.equal(overlay.isOpen(), false);
});

test("electron steam overlay manager opens the configured shortcut target programmatically", (t) => {
  const hostHandle = Buffer.from([4, 8, 15, 17]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {},
      on() {},
      off() {}
    }
  };

  const openedTargets = [];
  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Programmatic Shortcut Overlay",
    pollIntervalMs: 10000,
    overlayShortcut: {
      target: {
        type: "web",
        url: "https://example.invalid/overlay-menu",
        modal: true
      },
      onOpen(target) {
        openedTargets.push(target);
      }
    }
  });

  const shortcutStatus = overlay.getShortcutOpenStatus();
  assert.equal(shortcutStatus.enabled, true);
  assert.equal(shortcutStatus.canOpen, true);
  assert.equal(shortcutStatus.canWait, true);
  assert.equal(shortcutStatus.reason, undefined);
  assert.equal(shortcutStatus.waitReason, undefined);
  assert.deepEqual(shortcutStatus.target, {
    type: "web",
    url: "https://example.invalid/overlay-menu",
    modal: true
  });
  assert.deepEqual(shortcutStatus.shortcut, {
    enabled: true,
    preventDefault: true,
    targetType: "web",
    target: {
      type: "web",
      modal: true,
      hasUrl: true
    }
  });
  assert.equal(shortcutStatus.targetStatus.canOpen, true);
  assert.equal(shortcutStatus.targetStatus.canWait, true);

  assert.equal(overlay.openShortcutTargetIfAvailable() !== null, true);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [{ method: "activateOverlayToWebPage", args: ["https://example.invalid/overlay-menu", true] }]
  );
  assert.deepEqual(openedTargets, [
    {
      type: "web",
      url: "https://example.invalid/overlay-menu",
      modal: true
    }
  ]);

  assert.equal(overlay.openShortcutTarget(), null);
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  const activeShortcutStatus = overlay.getShortcutOpenStatus();
  assert.equal(activeShortcutStatus.canOpen, false);
  assert.equal(activeShortcutStatus.canWait, false);
  assert.equal(activeShortcutStatus.reason, "overlay-active");
  assert.equal(activeShortcutStatus.waitReason, "overlay-active");
  assert.equal(overlay.openShortcutTargetIfAvailable(), null);
  assert.equal(overlay.openShortcutTarget(), null);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [{ method: "activateOverlayToWebPage", args: ["https://example.invalid/overlay-menu", true] }]
  );
  overlay.close();

  const disabledOverlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Disabled Shortcut Overlay",
    pollIntervalMs: 10000,
    overlayShortcut: false
  });
  const disabledStatus = disabledOverlay.getShortcutOpenStatus();
  assert.equal(disabledStatus.enabled, false);
  assert.equal(disabledStatus.canOpen, false);
  assert.equal(disabledStatus.canWait, false);
  assert.equal(disabledStatus.reason, "disabled");
  assert.equal(disabledStatus.waitReason, "disabled");
  assert.equal(disabledOverlay.openShortcutTargetIfAvailable(), null);
  assert.equal(disabledOverlay.openShortcutTarget(), null);
  disabledOverlay.close();
});

test("electron steam overlay manager opens the configured shortcut target with managed wait", async (t) => {
  const hostHandle = Buffer.from([4, 8, 15, 18]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {},
      on() {},
      off() {}
    }
  };

  const openedTargets = [];
  const shortcutTarget = {
    type: "web",
    url: "https://example.invalid/overlay-menu",
    modal: true
  };
  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Programmatic Shortcut Wait Overlay",
    pollIntervalMs: 50,
    overlayShortcut: {
      target: shortcutTarget,
      onOpen(target) {
        openedTargets.push(target);
      }
    }
  });

  const managedOpen = overlay.openShortcutTargetAndWaitIfAvailable({ showTimeoutMs: 200, closeTimeoutMs: 200 });
  assert.notEqual(managedOpen, null);
  assert.equal(overlay.openShortcutTarget(), null);
  await waitForNextSteamWebOverlayCall(fake, 0, ["https://example.invalid/overlay-menu", true]);
  assert.deepEqual(openedTargets, [shortcutTarget]);

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const managedResult = await managedOpen;

  assert.equal(managedResult.shown.overlayActive, true);
  assert.equal(managedResult.parked.overlayActive, false);
  assert.equal(managedResult.parked.mode, "passive");
  assert.equal(managedResult.parked.clickThrough, true);
  assert.equal(managedResult.parked.currentFps, 0);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [{ method: "activateOverlayToWebPage", args: ["https://example.invalid/overlay-menu", true] }]
  );

  overlay.close();

  const disabledOverlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Disabled Shortcut Wait Overlay",
    pollIntervalMs: 50,
    overlayShortcut: false
  });
  assert.equal(await disabledOverlay.openShortcutTargetAndWaitIfAvailable({ showTimeoutMs: 5, closeTimeoutMs: 5 }), null);
  assert.equal(await disabledOverlay.openShortcutTargetAndWait({ showTimeoutMs: 5, closeTimeoutMs: 5 }), null);
  disabledOverlay.close();
});

test("electron steam overlay shortcut wait does not report opened before overlay readiness", async (t) => {
  setProcessPlatformForTest(t, "linux");
  const hostHandle = Buffer.from([4, 8, 15, 19]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    },
    getOverlayDiagnostics() {
      return {
        steamRunning: true,
        steamInstallPath: "/tmp/steam",
        appId: 480,
        overlayEnabled: false,
        overlayNeedsPresent: false,
        overlayNeedsPresentPollingEnabled: true,
        steamDeck: false,
        bigPicture: false
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {},
      on() {},
      off() {}
    }
  };

  const openedTargets = [];
  const shortcutErrors = [];
  const shortcutTarget = {
    type: "web",
    url: "https://example.invalid/overlay-menu",
    modal: true
  };
  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Shortcut Wait Readiness Overlay",
    pollIntervalMs: 50,
    overlayShortcut: {
      target: shortcutTarget,
      onOpen(target) {
        openedTargets.push(target);
      },
      onError(error) {
        shortcutErrors.push(error);
      }
    }
  });

  await assert.rejects(
    overlay.openShortcutTargetAndWait({ showTimeoutMs: 5, closeTimeoutMs: 5 }),
    (error) => {
      assert.equal(error instanceof steam.SteamOverlayWaitTimeoutError, true);
      assert.equal(error.code, "STEAM_OVERLAY_WAIT_TIMEOUT");
      assert.equal(error.state, "be ready");
      assert.equal(error.snapshot.diagnostics.overlayEnabled, false);
      assert.deepEqual(error.targetSnapshot, {
        type: "web",
        modal: true,
        hasUrl: true
      });
      assert.deepEqual(steam.getSteamOverlayErrorTargetSnapshot(error), {
        type: "web",
        modal: true,
        hasUrl: true
      });
      assert.equal(steam.getSteamOverlayCheckoutErrorTargetSnapshot(error), undefined);
      assert.deepEqual(steam.overlay.getSteamOverlayErrorTargetSnapshot(error), {
        type: "web",
        modal: true,
        hasUrl: true
      });
      assert.equal(JSON.stringify(error.targetSnapshot).includes("overlay-menu"), false);
      return true;
    }
  );

  assert.deepEqual(openedTargets, []);
  assert.equal(shortcutErrors.length, 1);
  assert.equal(shortcutErrors[0] instanceof steam.SteamOverlayWaitTimeoutError, true);
  assert.equal(shortcutErrors[0].state, "be ready");
  assert.deepEqual(steamWebOverlayCalls(fake), []);

  overlay.close();
});

test("electron steam overlay shortcut wait rejects raw native diagnostic targets", async (t) => {
  const hostHandle = Buffer.from([4, 8, 15, 20]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {},
      on() {},
      off() {}
    }
  };

  const shortcutErrors = [];
  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Shortcut Wait Native Diagnostic Overlay",
    pollIntervalMs: 50,
    overlayShortcut: {
      target: {
        type: "dialog",
        dialog: "Friends",
        route: "native"
      },
      onError(error) {
        shortcutErrors.push(error);
      }
    }
  });

  await assert.rejects(
    overlay.openShortcutTargetAndWait({ showTimeoutMs: 5, closeTimeoutMs: 5 }),
    /openAndWait\(\) requires a presenter-backed target/
  );

  assert.equal(shortcutErrors.length, 1);
  assert.match(shortcutErrors[0].message, /openAndWait\(\) requires a presenter-backed target/);
  assert.deepEqual(
    fake.calls.filter((call) =>
      ["activateOverlay", "activateOverlayToWebPage", "activateOverlayToStore"].includes(call.method)
    ),
    []
  );

  overlay.close();
});

test("electron steam overlay manager uses a focused macOS global shortcut fallback", async (t) => {
  setProcessPlatformForTest(t, "darwin");

  const hostHandle = Buffer.from([4, 8, 15, 16]);
  let hostOpen = false;
  let registeredHandler;
  let registerCount = 0;
  let unregisterCount = 0;
  mockElectronModule(t, {
    globalShortcut: {
      register(accelerator, handler) {
        assert.equal(accelerator, "Shift+Tab");
        registeredHandler = handler;
        registerCount += 1;
        return true;
      },
      unregister(accelerator) {
        assert.equal(accelerator, "Shift+Tab");
        registeredHandler = undefined;
        unregisterCount += 1;
      }
    }
  });

  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);
  t.after(clearSteamBridgeCache);

  const windowHandlers = new Map();
  let windowFocused = true;
  let showCount = 0;
  let focusCount = 0;
  let invalidateCount = 0;
  const window = {
    isDestroyed() {
      return false;
    },
    isFocused() {
      return windowFocused;
    },
    show() {
      showCount += 1;
    },
    focus() {
      focusCount += 1;
      if (focusCount >= 2) {
        windowFocused = true;
      }
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    on(event, handler) {
      windowHandlers.set(event, handler);
    },
    off(event, handler) {
      if (windowHandlers.get(event) === handler) {
        windowHandlers.delete(event);
      }
    },
    webContents: {
      once() {},
      invalidate() {
        invalidateCount += 1;
      },
      send() {},
      on() {},
      off() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron macOS Shortcut Overlay",
    pollIntervalMs: 10000
  });

  assert.equal(registerCount, 1);
  assert.equal(typeof registeredHandler, "function");
  assert.equal(typeof windowHandlers.get("focus"), "function");
  assert.equal(typeof windowHandlers.get("blur"), "function");

  registeredHandler();
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [{ method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] }]
  );
  assert.equal(unregisterCount, 1);
  assert.equal(registeredHandler, undefined);

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(registerCount, 1);

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(registerCount, 1);

  windowFocused = false;
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(showCount, 2);
  assert.equal(focusCount, 2);
  assert.equal(invalidateCount, 2);
  assert.equal(windowFocused, true);
  assert.equal(registerCount, 2);
  assert.equal(typeof registeredHandler, "function");

  overlay.close();
  assert.equal(unregisterCount, 2);
  assert.equal(windowHandlers.has("focus"), false);
  assert.equal(windowHandlers.has("blur"), false);
});

test("electron steam overlay macOS shortcut stays quiet while the native host is unavailable", async (t) => {
  setProcessPlatformForTest(t, "darwin");

  const hostHandle = Buffer.from([3, 6, 9, 12]);
  let hostOpen = false;
  let registeredHandler;
  let registerCount = 0;
  let unregisterCount = 0;
  let macEnvironment = { screenLocked: true, displayAsleep: false };
  const warnings = [];
  const previousEmitWarning = process.emitWarning;
  process.emitWarning = function emitWarningForTest(warning, options) {
    warnings.push({ warning, options });
  };
  t.after(() => {
    process.emitWarning = previousEmitWarning;
  });
  mockElectronModule(t, {
    globalShortcut: {
      register(accelerator, handler) {
        assert.equal(accelerator, "Shift+Tab");
        registeredHandler = handler;
        registerCount += 1;
        return true;
      },
      unregister(accelerator) {
        assert.equal(accelerator, "Shift+Tab");
        registeredHandler = undefined;
        unregisterCount += 1;
      }
    }
  });

  const fake = createFakeNative({
    getMacOverlayEnvironment() {
      this.calls.push({ method: "getMacOverlayEnvironment", args: [] });
      return macEnvironment;
    },
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);
  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    isFocused() {
      return true;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    on() {},
    off() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {},
      on() {},
      off() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron macOS Shortcut Unavailable Overlay",
    pollIntervalMs: 10000
  });

  assert.equal(registerCount, 1);
  assert.equal(typeof registeredHandler, "function");
  assert.equal(overlay.snapshot().nativeHostUnavailableReason, "macos-screen-locked");

  registeredHandler();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fake.calls.some((call) => call.method === "activateOverlayToWebPage"), false);
  assert.equal(registerCount, 1);
  assert.equal(unregisterCount, 0);
  assert.equal(warnings.filter((warning) => warning.options?.type === "SteamBridgeOverlayShortcutWarning").length, 0);

  macEnvironment = { screenLocked: false, displayAsleep: false };
  overlay.pump();
  assert.equal(overlay.snapshot().nativeHostUnavailableReason, undefined);

  registeredHandler();
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [{ method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] }]
  );
  assert.equal(unregisterCount, 1);
  assert.equal(registeredHandler, undefined);

  macEnvironment = { screenLocked: true, displayAsleep: false };
  overlay.pump();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(registerCount, 2);
  assert.equal(typeof registeredHandler, "function");
  assert.equal(warnings.filter((warning) => warning.options?.type === "SteamBridgeOverlayShortcutWarning").length, 0);

  overlay.close();
});

test("electron steam overlay does not resolve dynamic shortcut targets while macOS native host is unavailable", async (t) => {
  setProcessPlatformForTest(t, "darwin");

  const hostHandle = Buffer.from([6, 12, 24, 48]);
  let hostOpen = false;
  const fake = createFakeNative({
    getMacOverlayEnvironment() {
      this.calls.push({ method: "getMacOverlayEnvironment", args: [] });
      return { screenLocked: true, displayAsleep: false };
    },
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);
  t.after(clearSteamBridgeCache);

  let beforeInputHandler;
  const window = {
    isDestroyed() {
      return false;
    },
    isFocused() {
      return true;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    on() {},
    off() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {},
      on(event, handler) {
        if (event === "before-input-event") {
          beforeInputHandler = handler;
        }
      },
      off() {}
    }
  };

  let resolveCount = 0;
  const shortcutErrors = [];
  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Dynamic Shortcut Unavailable Overlay",
    pollIntervalMs: 10000,
    overlayShortcut: {
      target() {
        resolveCount += 1;
        return { type: "friends" };
      },
      onError(error) {
        shortcutErrors.push(error);
      }
    }
  });

  assert.equal(overlay.snapshot().nativeHostUnavailableReason, "macos-screen-locked");
  const dynamicStatus = overlay.getShortcutOpenStatus();
  assert.equal(dynamicStatus.canOpen, false);
  assert.equal(dynamicStatus.canWait, false);
  assert.equal(dynamicStatus.reason, "native-host-unavailable");
  assert.equal(dynamicStatus.waitReason, "native-host-unavailable");
  assert.equal(dynamicStatus.target, undefined);
  assert.equal(dynamicStatus.targetStatus, undefined);
  assert.equal(dynamicStatus.nativeHostAvailability?.available, false);
  assert.equal(dynamicStatus.nativeHostAvailability?.reason, "macos-screen-locked");
  assert.match(dynamicStatus.message, /macOS screen is locked/);
  assert.equal(resolveCount, 0);
  assert.equal(overlay.openShortcutTargetIfAvailable(), null);
  assert.equal(await overlay.openShortcutTargetAndWaitIfAvailable({ showTimeoutMs: 5, closeTimeoutMs: 5 }), null);
  assert.equal(resolveCount, 0);

  const assertUnavailableError = (error) => {
    assert.equal(error instanceof steam.SteamOverlayNativeHostUnavailableError, true);
    assert.equal(error.name, "SteamOverlayNativeHostUnavailableError");
    assert.equal(error.code, "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE");
    assert.equal(error.reason, "macos-screen-locked");
    return true;
  };

  assert.equal(typeof beforeInputHandler, "function");
  let shortcutPrevented = false;
  beforeInputHandler(
    {
      preventDefault() {
        shortcutPrevented = true;
      }
    },
    {
      type: "keyDown",
      key: "Tab",
      shift: true
    }
  );
  assert.equal(shortcutPrevented, true);
  assert.equal(resolveCount, 0);
  assert.equal(shortcutErrors.length, 1);
  assertUnavailableError(shortcutErrors[0]);

  assert.throws(() => overlay.openShortcutTarget(), assertUnavailableError);
  assert.equal(resolveCount, 0);
  assert.equal(shortcutErrors.length, 2);
  assertUnavailableError(shortcutErrors[1]);

  await assert.rejects(
    overlay.openShortcutTargetAndWait({ showTimeoutMs: 5, closeTimeoutMs: 5 }),
    assertUnavailableError
  );
  assert.equal(resolveCount, 0);
  assert.equal(shortcutErrors.length, 3);
  assertUnavailableError(shortcutErrors[2]);
  assert.deepEqual(fake.calls.filter((call) => call.method === "activateOverlayToWebPage"), []);

  overlay.close();
});

test("electron steam overlay manager tolerates destroyed macOS shortcut window during close", (t) => {
  setProcessPlatformForTest(t, "darwin");

  const hostHandle = Buffer.from([11, 22, 33, 44]);
  let hostOpen = false;
  let windowDestroyed = false;
  let unregisterCount = 0;
  let removeWindowListenerAttempts = 0;
  mockElectronModule(t, {
    globalShortcut: {
      register(accelerator) {
        assert.equal(accelerator, "Shift+Tab");
        return true;
      },
      unregister(accelerator) {
        assert.equal(accelerator, "Shift+Tab");
        unregisterCount += 1;
      }
    }
  });

  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return windowDestroyed;
    },
    isFocused() {
      return true;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    on() {},
    off() {
      removeWindowListenerAttempts += 1;
      if (windowDestroyed) {
        throw new TypeError("Object has been destroyed");
      }
    },
    webContents: {
      isDestroyed() {
        return windowDestroyed;
      },
      once() {},
      invalidate() {},
      send() {},
      on() {},
      off() {
        if (windowDestroyed) {
          throw new TypeError("Object has been destroyed");
        }
      }
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Destroyed macOS Shortcut Overlay",
    pollIntervalMs: 10000
  });

  windowDestroyed = true;
  assert.doesNotThrow(() => overlay.close());
  assert.equal(overlay.isOpen(), false);
  assert.equal(unregisterCount, 1);
  assert.equal(removeWindowListenerAttempts > 0, true);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "detachNativeOverlayHostView"),
    [{ method: "detachNativeOverlayHostView", args: [] }]
  );
});

test("electron steam overlay shortcut snapshots static targets without leaking private values", async (t) => {
  const hostHandle = Buffer.from([7, 7, 1, 4]);
  let hostOpen = false;
  let beforeInputHandler;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {},
      on(event, handler) {
        if (event === "before-input-event") {
          beforeInputHandler = handler;
        }
      },
      off(event) {
        if (event === "before-input-event") {
          beforeInputHandler = undefined;
        }
      }
    }
  };

  const openedTargets = [];
  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Static Shortcut Overlay",
    pollIntervalMs: 10000,
    overlayShortcut: {
      target: {
        type: "web",
        url: "https://example.invalid/private-checkout-token",
        modal: true
      },
      onOpen(target) {
        openedTargets.push(target);
      }
    }
  });

  assert.deepEqual(overlay.snapshot().electronOverlay.overlayShortcut, {
    enabled: true,
    preventDefault: true,
    targetType: "web",
    target: {
      type: "web",
      modal: true,
      hasUrl: true
    }
  });
  const staticStatus = overlay.getShortcutOpenStatus();
  assert.equal(staticStatus.canOpen, true);
  assert.equal(staticStatus.canWait, true);
  assert.equal(staticStatus.shortcut.targetType, "web");
  assert.equal(JSON.stringify(staticStatus.shortcut).includes("private-checkout-token"), false);
  assert.deepEqual(staticStatus.target, {
    type: "web",
    url: "https://example.invalid/private-checkout-token",
    modal: true
  });
  assert.deepEqual(staticStatus.targetSnapshot, {
    type: "web",
    modal: true,
    hasUrl: true
  });
  assert.equal(JSON.stringify(overlay.snapshot()).includes("private-checkout-token"), false);
  beforeInputHandler(
    {
      preventDefault() {}
    },
    {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      shift: true
    }
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [{ method: "activateOverlayToWebPage", args: ["https://example.invalid/private-checkout-token", true] }]
  );
  assert.deepEqual(openedTargets, [
    {
      type: "web",
      url: "https://example.invalid/private-checkout-token",
      modal: true
    }
  ]);
  overlay.close();

  const checkoutOverlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Checkout Shortcut Overlay",
    pollIntervalMs: 10000,
    overlayShortcut: {
      target: {
        type: "checkout",
        steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/123456789/",
        transactionId: 123456789n,
        returnUrl: "steam://return"
      }
    }
  });

  assert.deepEqual(checkoutOverlay.snapshot().electronOverlay.overlayShortcut, {
    enabled: true,
    preventDefault: true,
    targetType: "checkout",
    target: {
      type: "checkout",
      hasSteamUrl: true,
      hasTransactionId: true,
      hasReturnUrl: true
    }
  });
  const checkoutSnapshotJson = JSON.stringify(checkoutOverlay.snapshot());
  assert.equal(checkoutSnapshotJson.includes("123456789"), false);
  assert.equal(checkoutSnapshotJson.includes("steam://return"), false);
  assert.deepEqual(checkoutOverlay.getShortcutOpenStatus().targetSnapshot, {
    type: "checkout",
    hasSteamUrl: true,
    hasTransactionId: true,
    hasReturnUrl: true
  });
  checkoutOverlay.close();

  const dynamicOverlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Dynamic Shortcut Overlay",
    pollIntervalMs: 10000,
    overlayShortcut: {
      target: () => ({ type: "friends" })
    }
  });
  const dynamicStatus = dynamicOverlay.getShortcutOpenStatus();
  assert.equal(dynamicStatus.canOpen, false);
  assert.equal(dynamicStatus.canWait, false);
  assert.equal(dynamicStatus.reason, "dynamic-target");
  assert.equal(dynamicStatus.waitReason, "dynamic-target");
  assert.equal(dynamicStatus.target, undefined);
  assert.equal(dynamicStatus.targetStatus, undefined);
  assert.equal(dynamicStatus.shortcut.targetType, "function");
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [{ method: "activateOverlayToWebPage", args: ["https://example.invalid/private-checkout-token", true] }]
  );
  assert.equal(dynamicOverlay.openShortcutTargetIfAvailable() !== null, true);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [
      { method: "activateOverlayToWebPage", args: ["https://example.invalid/private-checkout-token", true] },
      { method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] }
    ]
  );
  dynamicOverlay.close();

  let observedShortcutError;
  const errorOverlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Shortcut Observer Error Overlay",
    pollIntervalMs: 10000,
    overlayShortcut: {
      target: { type: "friends" },
      onOpen() {
        throw new Error("shortcut observer failed");
      },
      onError(error) {
        observedShortcutError = error;
      }
    }
  });
  assert.doesNotThrow(() =>
    beforeInputHandler(
      {
        preventDefault() {}
      },
      {
        type: "keyDown",
        key: "Tab",
        code: "Tab",
        shift: true
      }
    )
  );
  assert.equal(observedShortcutError?.message, "shortcut observer failed");
  errorOverlay.close();
});

test("electron steam overlay shortcut still opens during passive notification presentation", async (t) => {
  setProcessPlatformForTest(t, "linux");
  const hostHandle = Buffer.from([9, 2, 6, 5]);
  let hostOpen = false;
  let overlayNeedsPresent = false;
  let beforeInputHandler;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    },
    getOverlayDiagnostics() {
      return {
        steamRunning: true,
        steamInstallPath: "/tmp/steam",
        appId: 480,
        overlayEnabled: true,
        overlayNeedsPresent,
        overlayNeedsPresentPollingEnabled: true,
        steamDeck: false,
        bigPicture: false
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {},
      on(event, handler) {
        if (event === "before-input-event") {
          beforeInputHandler = handler;
        }
      },
      off() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Passive Notification Shortcut Overlay",
    pollIntervalMs: 5
  });

  overlay.prepareForNotification();
  overlayNeedsPresent = true;
  await new Promise((resolve) => setTimeout(resolve, 40));

  const passiveSnapshot = overlay.snapshot();
  assert.equal(passiveSnapshot.mode, "passive");
  assert.equal(passiveSnapshot.clickThrough, true);
  assert.equal(passiveSnapshot.transparent, false);
  assert.equal(passiveSnapshot.currentFps > passiveSnapshot.idleFps, true);

  let preventDefaultCount = 0;
  beforeInputHandler(
    {
      preventDefault() {
        preventDefaultCount += 1;
      }
    },
    {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      shift: true
    }
  );

  assert.equal(preventDefaultCount, 1);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    [{ method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] }]
  );

  overlay.close();
});

test("electron steam overlay manager exposes lifecycle wait helpers", async (t) => {
  const hostHandle = Buffer.from([2, 4, 6, 8]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Lifecycle Overlay",
    pollIntervalMs: 50
  });

  overlay.open({ type: "friends" });

  const shown = overlay.waitForOverlayShown({ timeoutMs: 200 });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  const shownSnapshot = await shown;

  assert.equal(shownSnapshot.overlayActive, true);
  assert.equal(shownSnapshot.overlayWasActive, true);

  const closed = overlay.waitForOverlayClosed({ timeoutMs: 200 });
  const parked = overlay.parkWhenSteamOverlayCloses({ timeoutMs: 200 });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });

  const closedSnapshot = await closed;
  const parkedSnapshot = await parked;

  assert.equal(closedSnapshot.overlayActive, false);
  assert.equal(closedSnapshot.overlayWasActive, true);
  assert.equal(parkedSnapshot.mode, "passive");
  assert.equal(parkedSnapshot.clickThrough, true);
  assert.equal(parkedSnapshot.transparent, true);
  assert.equal(parkedSnapshot.currentFps, 0);

  await assert.rejects(overlay.waitForOverlayShown({ timeoutMs: 5 }), (error) => {
    assert.equal(error instanceof steam.SteamOverlayWaitTimeoutError, true);
    assert.equal(error.name, "SteamOverlayWaitTimeoutError");
    assert.equal(error.code, "STEAM_OVERLAY_WAIT_TIMEOUT");
    assert.equal(error.state, "become active");
    assert.equal(error.timeoutMs, 5);
    assert.equal(error.snapshot.overlayActive, false);
    assert.equal(error.snapshot.overlayWasActive, true);
    assert.equal(error.snapshot.mode, "passive");
    assert.match(error.message, /Timed out waiting for Steam overlay to become active after 5ms/);
    assert.match(error.message, /Last presenter state: mode=passive/);
    return true;
  });

  const abortController = new AbortController();
  const aborted = overlay.waitForOverlayShown({
    timeoutMs: 200,
    signal: abortController.signal
  });
  abortController.abort();
  await assert.rejects(aborted, (error) => {
    assert.equal(error instanceof steam.SteamOverlayWaitAbortedError, true);
    assert.equal(error.name, "SteamOverlayWaitAbortedError");
    assert.equal(error.code, "STEAM_OVERLAY_WAIT_ABORTED");
    assert.equal(error.state, "become active");
    assert.equal(error.snapshot.overlayActive, false);
    assert.equal(error.snapshot.mode, "passive");
    assert.match(error.message, /Aborted waiting for Steam overlay to become active/);
    assert.match(error.message, /Last presenter state: mode=passive/);
    return true;
  });

  const pumpsBeforeManagedOpen = fake.calls.filter((call) => call.method === "pumpNativeOverlayProbeWindow").length;
  const managedOpen = overlay.openAndWait(
    { type: "web", url: "https://store.steampowered.com/app/480/", modal: true },
    { showTimeoutMs: 200, closeTimeoutMs: 200 }
  );
  const waitingForShown = overlay.snapshot();
  const pumpsAfterManagedOpen = fake.calls.filter((call) => call.method === "pumpNativeOverlayProbeWindow").length;

  assert.equal(waitingForShown.mode, "active");
  assert.equal(waitingForShown.clickThrough, false);
  assert.equal(waitingForShown.transparent, false);
  assert.equal(waitingForShown.currentFps, 30);
  assert.equal(pumpsAfterManagedOpen, pumpsBeforeManagedOpen + 1);

  await waitForNextSteamWebOverlayCall(fake, 0, ["https://store.steampowered.com/app/480/", true]);
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  await Promise.resolve();
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const managedResult = await managedOpen;

  assert.equal(managedResult.shown.overlayActive, true);
  assert.equal(managedResult.shown.overlayWasActive, true);
  assert.equal(managedResult.parked.overlayActive, false);
  assert.equal(managedResult.parked.mode, "passive");
  assert.equal(managedResult.parked.clickThrough, true);
  assert.equal(managedResult.parked.currentFps, 0);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage").at(-1),
    { method: "activateOverlayToWebPage", args: ["https://store.steampowered.com/app/480/", true] }
  );

  const webOverlayCallsAfterManagedOpen = steamWebOverlayCalls(fake).length;
  const managedFriendsOpen = overlay.openAndWait({ type: "friends" }, { showTimeoutMs: 200, closeTimeoutMs: 200 });
  await waitForNextSteamWebOverlayCall(fake, webOverlayCallsAfterManagedOpen, [steam.STEAM_FRIENDS_OVERLAY_URL, true]);
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const managedFriendsResult = await managedFriendsOpen;

  assert.equal(managedFriendsResult.shown.overlayActive, true);
  assert.equal(managedFriendsResult.parked.overlayActive, false);
  assert.equal(managedFriendsResult.parked.currentFps, 0);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage").at(-1),
    { method: "activateOverlayToWebPage", args: [steam.STEAM_FRIENDS_OVERLAY_URL, true] }
  );

  const webOverlayCallsAfterFriends = steamWebOverlayCalls(fake).length;
  const managedStoreOpen = overlay.openAndWaitIfAvailable(
    { type: "store", appId: 480 },
    { showTimeoutMs: 200, closeTimeoutMs: 200 }
  );
  assert.notEqual(managedStoreOpen, null);
  await waitForNextSteamWebOverlayCall(fake, webOverlayCallsAfterFriends, ["https://store.steampowered.com/app/480/", true]);
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const managedStoreResult = await managedStoreOpen;

  assert.equal(managedStoreResult.shown.overlayActive, true);
  assert.equal(managedStoreResult.parked.overlayActive, false);
  assert.equal(managedStoreResult.parked.currentFps, 0);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage").at(-1),
    { method: "activateOverlayToWebPage", args: ["https://store.steampowered.com/app/480/", true] }
  );

  const webOverlayCallsAfterStore = steamWebOverlayCalls(fake).length;
  const managedDialogOpen = overlay.openAndWait(
    { type: "dialog", dialog: steam.Dialog.OfficialGameGroup, appId: 480 },
    { showTimeoutMs: 200, closeTimeoutMs: 200 }
  );
  await waitForNextSteamWebOverlayCall(fake, webOverlayCallsAfterStore, [steam.steamCommunityAppUrl(480), true]);
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const managedDialogResult = await managedDialogOpen;

  assert.equal(managedDialogResult.shown.overlayActive, true);
  assert.equal(managedDialogResult.parked.overlayActive, false);
  assert.equal(managedDialogResult.parked.currentFps, 0);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage").at(-1),
    { method: "activateOverlayToWebPage", args: [steam.steamCommunityAppUrl(480), true] }
  );

  assert.equal(
    await overlay.openAndWaitIfAvailable(
      { type: "dialog", dialog: steam.Dialog.Friends, route: "native" },
      { showTimeoutMs: 5, closeTimeoutMs: 5 }
    ),
    null
  );

  const closedDuringWait = overlay.waitForOverlayShown({ timeoutMs: 200 });
  overlay.close();
  await assert.rejects(closedDuringWait, (error) => {
    assert.equal(error instanceof steam.SteamOverlayWaitClosedError, true);
    assert.equal(error.name, "SteamOverlayWaitClosedError");
    assert.equal(error.code, "STEAM_OVERLAY_WAIT_CLOSED");
    assert.equal(error.state, "become active");
    assert.equal(error.snapshot.closed, true);
    assert.equal(error.snapshot.mode, "closed");
    assert.match(error.message, /closed while waiting for Steam overlay to become active/);
    assert.match(error.message, /Last presenter state: mode=closed/);
    return true;
  });
  assert.throws(() => overlay.waitForOverlayShown(), /Electron Steam overlay is closed/);
  assert.equal(await overlay.openAndWaitIfAvailable({ type: "friends" }), null);
  await assert.rejects(overlay.openAndWait({ type: "friends" }), /Electron Steam overlay is closed/);
});

test("electron steam overlay openAndWait waits for overlay readiness before activating Steam", async (t) => {
  setProcessPlatformForTest(t, "linux");
  const hostHandle = Buffer.from([4, 8, 1, 6]);
  let hostOpen = false;
  let overlayEnabled = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    },
    getOverlayDiagnostics() {
      return {
        steamRunning: true,
        steamInstallPath: "/tmp/steam",
        appId: 480,
        overlayEnabled,
        overlayNeedsPresent: false,
        overlayNeedsPresentPollingEnabled: true,
        steamDeck: false,
        bigPicture: false
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Readiness Overlay",
    pollIntervalMs: 50
  });

  const managedOpen = overlay.openAndWait(
    { type: "web", url: "https://store.steampowered.com/app/480/", modal: true },
    { showTimeoutMs: 500, closeTimeoutMs: 500 }
  );

  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage"),
    []
  );

  overlayEnabled = true;
  const activated = await waitForCondition(
    () => fake.calls.some((call) => call.method === "activateOverlayToWebPage"),
    500
  );
  assert.equal(activated, true);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "activateOverlayToWebPage").at(-1),
    { method: "activateOverlayToWebPage", args: ["https://store.steampowered.com/app/480/", true] }
  );

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const result = await managedOpen;

  assert.equal(result.shown.overlayActive, true);
  assert.equal(result.parked.overlayActive, false);
  assert.equal(result.parked.currentFps, 0);
  overlay.close();
});

test("electron steam overlay openAndWait releases presenter hold when readiness times out", async (t) => {
  setProcessPlatformForTest(t, "linux");
  const hostHandle = Buffer.from([4, 8, 1, 7]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    },
    getOverlayDiagnostics() {
      return {
        steamRunning: true,
        steamInstallPath: "/tmp/steam",
        appId: 480,
        overlayEnabled: false,
        overlayNeedsPresent: false,
        overlayNeedsPresentPollingEnabled: true,
        steamDeck: false,
        bigPicture: false
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Readiness Timeout Overlay",
    pollIntervalMs: 50
  });

  await assert.rejects(
    overlay.openAndWait(
      { type: "web", url: "https://store.steampowered.com/app/480/", modal: true },
      { showTimeoutMs: 5, closeTimeoutMs: 5 }
    ),
    (error) => {
      assert.equal(error instanceof steam.SteamOverlayWaitTimeoutError, true);
      assert.equal(error.code, "STEAM_OVERLAY_WAIT_TIMEOUT");
      assert.equal(error.state, "be ready");
      assert.equal(error.snapshot.diagnostics.overlayEnabled, false);
      assert.equal(error.snapshot.mode, "active");
      assert.equal(error.snapshot.currentFps, 30);
      return true;
    }
  );

  assert.deepEqual(steamWebOverlayCalls(fake), []);
  const afterTimeout = overlay.snapshot();
  assert.equal(afterTimeout.mode, "passive");
  assert.equal(afterTimeout.clickThrough, true);
  assert.equal(afterTimeout.transparent, true);
  assert.equal(afterTimeout.currentFps, 0);

  overlay.close();
});

test("electron steam overlay manager validates managed targets before presenter activation", async (t) => {
  const hostHandle = Buffer.from([3, 1, 4, 1]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Target Validation Overlay",
    pollIntervalMs: 10000
  });

  assert.throws(
    () => overlay.open({ type: "dialog", dialog: steam.Dialog.Settings }),
    /does not have a verified presenter-backed route/
  );
  assert.throws(
    () => overlay.open({ type: "checkout" }),
    /requires a url, steamUrl, or transactionId/
  );
  await assert.rejects(
    overlay.openAndWait(
      { type: "dialog", dialog: steam.Dialog.Settings },
      { showTimeoutMs: 200, closeTimeoutMs: 200 }
    ),
    /does not have a verified presenter-backed route/
  );
  await assert.rejects(
    overlay.openAndWait(
      { type: "dialog", dialog: steam.Dialog.Friends, route: "native" },
      { showTimeoutMs: 200, closeTimeoutMs: 200 }
    ),
    /openAndWait\(\) requires a presenter-backed target/
  );
  await assert.rejects(
    overlay.openAndWait(
      {
        type: "user",
        dialog: steam.UserDialog.FriendAdd,
        steamId64: 76561198000000000n,
        route: "native"
      },
      { showTimeoutMs: 200, closeTimeoutMs: 200 }
    ),
    /openAndWait\(\) requires a presenter-backed target/
  );

  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "activateOverlay",
        "activateOverlayToWebPage",
        "overlayActivateDialogToUser",
        "overlayActivateToStore",
        "setNativeOverlayHostInputPassthrough",
        "setNativeOverlayHostOpacity"
      ].includes(call.method)
    ),
    []
  );
  assert.equal(overlay.snapshot().mode, "passive");
  assert.equal(overlay.snapshot().clickThrough, true);
  assert.equal(overlay.snapshot().transparent, true);

  overlay.close();
});

test("electron steam overlay checkout helper prepares, opens, and waits with backend result shapes", async (t) => {
  const hostHandle = Buffer.from([31, 41, 59, 26]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Checkout And Wait Overlay",
    pollIntervalMs: 10000
  });

  let operationSnapshot;
  const checkoutCallsBefore = steamWebOverlayCalls(fake).length;
  const checkout = overlay.openCheckoutAndWaitIfAvailable(
    () => {
      operationSnapshot = overlay.snapshot();
      return {
        steamurl: "https://checkout.steampowered.com/checkout/approvetxn/987/",
        returnurl: "steam://return-from-backend"
      };
    },
    { modal: false, showTimeoutMs: 200, closeTimeoutMs: 200 }
  );

  await Promise.resolve();
  await Promise.resolve();
  assert.equal(operationSnapshot.mode, "active");
  assert.equal(operationSnapshot.clickThrough, false);
  assert.equal(operationSnapshot.transparent, false);
  assert.equal(operationSnapshot.currentFps, 30);
  await waitForNextSteamWebOverlayCall(fake, checkoutCallsBefore, [
    "https://checkout.steampowered.com/checkout/approvetxn/987/",
    false
  ]);

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const checkoutResult = await checkout;

  assert.notEqual(checkoutResult, null);
  assert.equal(checkoutResult.transaction.steamurl, "https://checkout.steampowered.com/checkout/approvetxn/987/");
  assert.deepEqual(checkoutResult.target, {
    type: "checkout",
    modal: false,
    steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/987/",
    returnUrl: "steam://return-from-backend"
  });
  assert.deepEqual(checkoutResult.targetSnapshot, {
    type: "checkout",
    modal: false,
    hasSteamUrl: true,
    hasReturnUrl: true
  });
  assert.equal(JSON.stringify(checkoutResult.targetSnapshot).includes("987"), false);
  assert.equal(JSON.stringify(checkoutResult.targetSnapshot).includes("return-from-backend"), false);
  assert.equal(checkoutResult.shown.overlayActive, true);
  assert.equal(checkoutResult.parked.mode, "passive");
  assert.equal(checkoutResult.parked.currentFps, 0);

  const transactionCallsBefore = steamWebOverlayCalls(fake).length;
  const transactionCheckout = overlay.openCheckoutAndWait(
    () => "123456789",
    { returnUrl: "steam://return-from-options", showTimeoutMs: 200, closeTimeoutMs: 200 }
  );

  await Promise.resolve();
  await Promise.resolve();
  await waitForNextSteamWebOverlayCall(fake, transactionCallsBefore, [
    "https://checkout.steampowered.com/checkout/approvetxn/123456789/?returnurl=steam%3A%2F%2Freturn-from-options",
    true
  ]);

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const transactionResult = await transactionCheckout;

  assert.deepEqual(transactionResult.target, {
    type: "checkout",
    returnUrl: "steam://return-from-options",
    transactionId: "123456789"
  });
  assert.deepEqual(transactionResult.targetSnapshot, {
    type: "checkout",
    hasTransactionId: true,
    hasReturnUrl: true
  });
  assert.equal(transactionResult.parked.clickThrough, true);

  const initTxnCallsBefore = steamWebOverlayCalls(fake).length;
  const initTxnCheckout = overlay.openCheckoutAndWait(
    () => ({
      response: {
        result: "OK",
        params: {
          transid: "246813579",
          steamurl: "https://checkout.steampowered.com/checkout/approvetxn/246813579/",
          returnurl: "steam://return-from-init-txn"
        }
      }
    }),
    { showTimeoutMs: 200, closeTimeoutMs: 200 }
  );

  await Promise.resolve();
  await Promise.resolve();
  await waitForNextSteamWebOverlayCall(fake, initTxnCallsBefore, [
    "https://checkout.steampowered.com/checkout/approvetxn/246813579/",
    true
  ]);

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const initTxnResult = await initTxnCheckout;

  assert.deepEqual(initTxnResult.target, {
    type: "checkout",
    steamUrl: "https://checkout.steampowered.com/checkout/approvetxn/246813579/",
    transactionId: "246813579",
    returnUrl: "steam://return-from-init-txn"
  });
  assert.deepEqual(initTxnResult.targetSnapshot, {
    type: "checkout",
    hasSteamUrl: true,
    hasTransactionId: true,
    hasReturnUrl: true
  });
  assert.equal(initTxnResult.parked.currentFps, 0);

  const webApiEnvelopeCallsBefore = steamWebOverlayCalls(fake).length;
  const webApiEnvelopeCheckout = overlay.openCheckoutAndWait(
    () => ({
      ok: true,
      status: 200,
      url: "https://partner.steam-api.com/ISteamMicroTxnSandbox/InitTxn/v0003/",
      headers: { "content-type": "application/json; charset=utf-8" },
      text: JSON.stringify({ response: { params: { transid: "97531" } } }),
      data: {
        response: {
          result: "OK",
          params: {
            transid: "97531"
          }
        }
      }
    }),
    { returnUrl: "steam://return-from-web-api", showTimeoutMs: 200, closeTimeoutMs: 200 }
  );

  await Promise.resolve();
  await Promise.resolve();
  await waitForNextSteamWebOverlayCall(fake, webApiEnvelopeCallsBefore, [
    "https://checkout.steampowered.com/checkout/approvetxn/97531/?returnurl=steam%3A%2F%2Freturn-from-web-api",
    true
  ]);

  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: true });
  fake.callbacks.get(steam.SteamCallback.GameOverlayActivated)({ active: false });
  const webApiEnvelopeResult = await webApiEnvelopeCheckout;

  assert.deepEqual(webApiEnvelopeResult.target, {
    type: "checkout",
    returnUrl: "steam://return-from-web-api",
    transactionId: "97531"
  });
  assert.deepEqual(webApiEnvelopeResult.targetSnapshot, {
    type: "checkout",
    hasTransactionId: true,
    hasReturnUrl: true
  });
  assert.equal(webApiEnvelopeResult.transaction.data.response.params.transid, "97531");

  const activationCallsBeforeAbort = fake.calls.filter((call) => call.method === "activateOverlayToWebPage").length;
  const abortController = new AbortController();
  let resolveCheckoutOperation;
  const abortedCheckout = overlay.openCheckoutAndWait(
    () =>
      new Promise((resolve) => {
        resolveCheckoutOperation = resolve;
      }),
    { signal: abortController.signal, showTimeoutMs: 200, closeTimeoutMs: 200 }
  );

  await Promise.resolve();
  assert.equal(typeof resolveCheckoutOperation, "function");
  const duringAbortedCheckout = overlay.snapshot();
  assert.equal(duringAbortedCheckout.mode, "active");
  assert.equal(duringAbortedCheckout.clickThrough, false);
  assert.equal(duringAbortedCheckout.transparent, false);
  assert.equal(duringAbortedCheckout.currentFps, 30);

  abortController.abort();
  await assert.rejects(abortedCheckout, (error) => {
    assert.equal(error instanceof steam.SteamOverlayWaitAbortedError, true);
    assert.equal(error.name, "SteamOverlayWaitAbortedError");
    assert.equal(error.code, "STEAM_OVERLAY_WAIT_ABORTED");
    assert.equal(error.state, "finish checkout operation");
    assert.equal(error.snapshot.mode, "active");
    assert.equal(error.snapshot.currentFps, 30);
    assert.deepEqual(error.targetSnapshot, { type: "checkout" });
    assert.deepEqual(error.checkoutTargetSnapshot, { type: "checkout" });
    assert.match(error.message, /Aborted waiting for Steam overlay to finish checkout operation/);
    return true;
  });
  resolveCheckoutOperation({
    steamurl: "https://checkout.steampowered.com/checkout/approvetxn/111/"
  });

  const afterAbortedCheckout = overlay.snapshot();
  assert.equal(afterAbortedCheckout.mode, "passive");
  assert.equal(afterAbortedCheckout.clickThrough, true);
  assert.equal(afterAbortedCheckout.transparent, true);
  assert.equal(afterAbortedCheckout.currentFps, 0);
  assert.equal(fake.calls.filter((call) => call.method === "activateOverlayToWebPage").length, activationCallsBeforeAbort);

  await assert.rejects(
    overlay.openCheckoutAndWait(() => ({ type: "checkout" }), { showTimeoutMs: 200, closeTimeoutMs: 200 }),
    /requires a url, steamUrl, or transactionId/
  );

  const activationCallsBeforeClose = fake.calls.filter((call) => call.method === "activateOverlayToWebPage").length;
  let resolveClosingCheckoutOperation;
  const closedCheckout = overlay.openCheckoutAndWait(
    () =>
      new Promise((resolve) => {
        resolveClosingCheckoutOperation = resolve;
      }),
    { showTimeoutMs: 200, closeTimeoutMs: 200 }
  );

  await Promise.resolve();
  assert.equal(typeof resolveClosingCheckoutOperation, "function");
  const duringClosedCheckout = overlay.snapshot();
  assert.equal(duringClosedCheckout.mode, "active");
  assert.equal(duringClosedCheckout.currentFps, 30);

  overlay.close();
  await assert.rejects(closedCheckout, (error) => {
    assert.equal(error instanceof steam.SteamOverlayWaitClosedError, true);
    assert.equal(error.name, "SteamOverlayWaitClosedError");
    assert.equal(error.code, "STEAM_OVERLAY_WAIT_CLOSED");
    assert.equal(error.state, "finish checkout operation");
    assert.equal(error.snapshot.closed, true);
    assert.equal(error.snapshot.mode, "closed");
    assert.deepEqual(error.targetSnapshot, { type: "checkout" });
    assert.deepEqual(error.checkoutTargetSnapshot, { type: "checkout" });
    assert.match(error.message, /closed while waiting for Steam overlay to finish checkout operation/);
    return true;
  });
  resolveClosingCheckoutOperation({
    steamurl: "https://checkout.steampowered.com/checkout/approvetxn/222/"
  });
  await Promise.resolve();
  assert.equal(fake.calls.filter((call) => call.method === "activateOverlayToWebPage").length, activationCallsBeforeClose);

  await assert.rejects(overlay.openCheckoutAndWait(() => "123"), /Electron Steam overlay is closed/);
});

test("electron steam overlay checkout wait does not activate before overlay readiness", async (t) => {
  setProcessPlatformForTest(t, "linux");
  const hostHandle = Buffer.from([31, 41, 59, 27]);
  let hostOpen = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    },
    getOverlayDiagnostics() {
      return {
        steamRunning: true,
        steamInstallPath: "/tmp/steam",
        appId: 480,
        overlayEnabled: false,
        overlayNeedsPresent: false,
        overlayNeedsPresentPollingEnabled: true,
        steamDeck: false,
        bigPicture: false
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Checkout Readiness Overlay",
    pollIntervalMs: 50
  });

  let operationSnapshot;
  await assert.rejects(
    overlay.openCheckoutAndWait(
      () => {
        operationSnapshot = overlay.snapshot();
        return {
          steamurl: "https://checkout.steampowered.com/checkout/approvetxn/333/"
        };
      },
      { showTimeoutMs: 5, closeTimeoutMs: 5 }
    ),
    (error) => {
      assert.equal(error instanceof steam.SteamOverlayWaitTimeoutError, true);
      assert.equal(error.code, "STEAM_OVERLAY_WAIT_TIMEOUT");
      assert.equal(error.state, "be ready");
      assert.equal(error.snapshot.diagnostics.overlayEnabled, false);
      assert.deepEqual(error.targetSnapshot, {
        type: "checkout",
        hasSteamUrl: true
      });
      assert.deepEqual(error.checkoutTargetSnapshot, {
        type: "checkout",
        hasSteamUrl: true
      });
      assert.deepEqual(steam.getSteamOverlayErrorTargetSnapshot(error), {
        type: "checkout",
        hasSteamUrl: true
      });
      assert.deepEqual(steam.getSteamOverlayCheckoutErrorTargetSnapshot(error), {
        type: "checkout",
        hasSteamUrl: true
      });
      assert.deepEqual(steam.overlay.getSteamOverlayErrorTargetSnapshot(error), {
        type: "checkout",
        hasSteamUrl: true
      });
      assert.equal(JSON.stringify(error.targetSnapshot).includes("333"), false);
      return true;
    }
  );

  assert.equal(operationSnapshot.mode, "active");
  assert.equal(operationSnapshot.clickThrough, false);
  assert.equal(operationSnapshot.transparent, false);
  assert.deepEqual(steamWebOverlayCalls(fake), []);

  const afterTimeout = overlay.snapshot();
  assert.equal(afterTimeout.mode, "passive");
  assert.equal(afterTimeout.clickThrough, true);
  assert.equal(afterTimeout.transparent, true);
  assert.equal(afterTimeout.currentFps, 0);

  overlay.close();
});

test("electron steam overlay manager tolerates destroyed webContents during window close", (t) => {
  const hostHandle = Buffer.from([23, 42, 108, 15]);
  let hostOpen = false;
  let closedHandler;
  let beforeInputHandler;
  let webContentsDestroyed = false;
  let removedHandler = false;
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return webContentsDestroyed;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once(event, handler) {
      if (event === "closed") {
        closedHandler = handler;
      }
    },
    webContents: {
      isDestroyed() {
        return webContentsDestroyed;
      },
      once() {},
      invalidate() {},
      send() {},
      on(event, handler) {
        if (event === "before-input-event") {
          beforeInputHandler = handler;
        }
      },
      off(event) {
        if (webContentsDestroyed) {
          throw new TypeError("Object has been destroyed");
        }
        if (event === "before-input-event") {
          removedHandler = true;
        }
      }
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Destroyed Window Overlay",
    pollIntervalMs: 10000
  });

  assert.equal(typeof beforeInputHandler, "function");
  assert.equal(typeof closedHandler, "function");
  webContentsDestroyed = true;
  assert.doesNotThrow(() => closedHandler());
  assert.equal(overlay.isOpen(), false);
  assert.equal(removedHandler, false);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "detachNativeOverlayHostView"),
    [{ method: "detachNativeOverlayHostView", args: [] }]
  );
  assert.doesNotThrow(() => overlay.close());
});

test("native overlay session owns the probe pump lifecycle", async (t) => {
  let probeOpen = false;
  let hostOpen = false;
  let restoreFocusCount = 0;
  const hostHandle = Buffer.from([8, 7, 6, 5, 4, 3, 2, 1]);
  const hostBounds = { x: 30, y: 40, width: 1440, height: 900 };
  const fake = createFakeNative({
    openNativeOverlayProbeWindow(title) {
      probeOpen = true;
      this.calls.push({ method: "openNativeOverlayProbeWindow", args: [title] });
    },
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!probeOpen && !hostOpen) {
        throw new Error("native overlay surface is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    hideNativeOverlayHostView() {
      this.calls.push({ method: "hideNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    closeNativeOverlayProbeWindow() {
      probeOpen = false;
      this.calls.push({ method: "closeNativeOverlayProbeWindow", args: [] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      this.calls.push({ method: "isNativeOverlayProbeWindowOpen", args: [] });
      return probeOpen;
    },
    isNativeOverlayHostViewOpen() {
      this.calls.push({ method: "isNativeOverlayHostViewOpen", args: [] });
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const session = steam.overlay.activateDialogWithNativeSession("Friends", {
    title: "Managed Overlay",
    pumpIntervalMs: 10000
  });

  assert.equal(session.isOpen(), true);
  assert.equal(session.snapshot().title, "Managed Overlay");
  assert.equal(session.snapshot().backend, expectedNativeOverlayBackend(false));
  assert.equal(session.snapshot().bounds, undefined);
  assert.equal(session.snapshot().nativeProbeOpen, true);

  fake.callbacks.get(331)({ active: true, app_id: 480 });
  assert.equal(session.snapshot().overlayActive, true);
  assert.equal(session.snapshot().overlayWasActive, true);

  fake.callbacks.get(331)({ active: false, app_id: 480 });
  assert.equal(session.snapshot().overlayActive, false);
  assert.equal(session.snapshot().lastOverlayEvent.appId, 480);
  assert.equal(session.snapshot().closed, false);
  assert.equal(session.isOpen(), true);

  session.close();
  assert.equal(session.snapshot().closed, true);
  assert.equal(session.snapshot().backend, "none");
  assert.equal(session.isOpen(), false);

  const webSession = steam.overlay.activateToWebPageWithNativeSession("https://store.steampowered.com/app/480/", {
    modal: true,
    title: "Managed Web Overlay",
    pumpIntervalMs: 10000
  });
  webSession.close();

  const storeSession = steam.overlay.activateToStoreWithNativeSession(480, steam.StoreFlag.AddToCart, {
    title: "Managed Store Overlay",
    pumpIntervalMs: 10000
  });
  storeSession.close();

  const hostSession = steam.overlay.activateDialogWithNativeSession("Friends", {
    title: "Managed Host Overlay",
    nativeWindowHandle: hostHandle,
    getBounds() {
      return hostBounds;
    },
    pumpIntervalMs: 10000,
    restoreFocusDelayMs: 0,
    restoreFocus() {
      restoreFocusCount += 1;
    }
  });

  assert.equal(hostSession.isOpen(), true);
  assert.equal(hostSession.snapshot().backend, expectedNativeOverlayBackend(true));
  assert.deepEqual(hostSession.snapshot().bounds, hostBounds);
  assert.equal(hostSession.snapshot().nativeHostOpen, true);

  fake.callbacks.get(331)({ active: false, app_id: 480 });
  assert.equal(restoreFocusCount, 1);
  await new Promise((resolve) => setTimeout(resolve, 560));
  assert.equal(restoreFocusCount, 1);

  hostSession.close();
  assert.equal(hostSession.isOpen(), false);

  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "openNativeOverlayProbeWindow",
        "attachNativeOverlayHostView",
        "pumpNativeOverlayProbeWindow",
        "showNativeOverlayHostView",
        "hideNativeOverlayHostView",
        "setNativeOverlayHostInputPassthrough",
        "setNativeOverlayHostOpacity",
        "activateOverlay",
        "activateOverlayToWebPage",
        "overlayActivateToStore",
        "disconnectGameOverlayActivated",
        "closeNativeOverlayProbeWindow",
        "detachNativeOverlayHostView"
      ].includes(call.method)
    ),
    [
      { method: "openNativeOverlayProbeWindow", args: ["Managed Overlay"] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "activateOverlay", args: ["Friends"] },
      { method: "disconnectGameOverlayActivated", args: [] },
      { method: "closeNativeOverlayProbeWindow", args: [] },
      { method: "openNativeOverlayProbeWindow", args: ["Managed Web Overlay"] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "activateOverlayToWebPage", args: ["https://store.steampowered.com/app/480/", true] },
      { method: "disconnectGameOverlayActivated", args: [] },
      { method: "closeNativeOverlayProbeWindow", args: [] },
      { method: "openNativeOverlayProbeWindow", args: ["Managed Store Overlay"] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "overlayActivateToStore", args: [480, steam.StoreFlag.AddToCart] },
      { method: "disconnectGameOverlayActivated", args: [] },
      { method: "closeNativeOverlayProbeWindow", args: [] },
      { method: "attachNativeOverlayHostView", args: [hostHandle] },
      { method: "showNativeOverlayHostView", args: [] },
      { method: "setNativeOverlayHostInputPassthrough", args: [false] },
      { method: "setNativeOverlayHostOpacity", args: [true] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "activateOverlay", args: ["Friends"] },
      { method: "hideNativeOverlayHostView", args: [] },
      { method: "setNativeOverlayHostInputPassthrough", args: [true] },
      { method: "setNativeOverlayHostOpacity", args: [false] },
      { method: "disconnectGameOverlayActivated", args: [] },
      { method: "detachNativeOverlayHostView", args: [] }
    ]
  );
});

test("native overlay presenter reuses a passive host for overlay activation", async (t) => {
  let hostOpen = false;
  let restoreFocusCount = 0;
  const hostHandle = Buffer.from([1, 3, 3, 7, 0, 0, 0, 0]);
  let hostBounds = { x: 5, y: 6, width: 800, height: 600 };
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    hideNativeOverlayHostView() {
      this.calls.push({ method: "hideNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      this.calls.push({ method: "isNativeOverlayProbeWindowOpen", args: [] });
      return false;
    },
    isNativeOverlayHostViewOpen() {
      this.calls.push({ method: "isNativeOverlayHostViewOpen", args: [] });
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const presenter = steam.overlay.attachPresenter({
    title: "Passive Presenter",
    nativeWindowHandle: hostHandle,
    idleFps: 0,
    pollIntervalMs: 10000,
    activeGraceMs: 0,
    restoreFocusDelayMs: 0,
    getBounds() {
      return hostBounds;
    },
    restoreFocus() {
      restoreFocusCount += 1;
    }
  });

  assert.equal(presenter.isOpen(), true);
  assert.equal(presenter.snapshot().mode, "passive");
  assert.equal(presenter.snapshot().backend, expectedNativeOverlayBackend(true));
  assert.deepEqual(presenter.snapshot().bounds, hostBounds);
  assert.equal(presenter.snapshot().nativeHostOpen, true);
  assert.equal(presenter.snapshot().clickThrough, true);
  assert.equal(presenter.snapshot().focusable, false);
  assert.equal(presenter.snapshot().transparent, true);

  steam.overlay.openWebOverlay("https://store.steampowered.com/app/480/", {
    modal: true,
    presenter
  });
  assert.equal(restoreFocusCount, 1);
  assert.equal(presenter.snapshot().mode, "active");
  assert.equal(presenter.snapshot().clickThrough, false);
  assert.equal(presenter.snapshot().transparent, false);
  hostBounds = { x: 6, y: 7, width: 1024, height: 640 };
  assert.deepEqual(presenter.snapshot().bounds, hostBounds);

  fake.callbacks.get(331)({ active: true, app_id: 480 });
  assert.equal(presenter.snapshot().overlayActive, true);
  assert.equal(presenter.snapshot().overlayWasActive, true);
  assert.equal(presenter.snapshot().clickThrough, false);
  assert.equal(presenter.snapshot().transparent, false);

  fake.callbacks.get(331)({ active: false, app_id: 480 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(presenter.snapshot().overlayActive, false);
  assert.equal(presenter.snapshot().clickThrough, true);
  assert.equal(presenter.snapshot().transparent, true);
  assert.equal(restoreFocusCount, 2);

  presenter.close();
  assert.equal(presenter.isOpen(), false);
  assert.equal(presenter.snapshot().backend, "none");
  assert.equal(presenter.snapshot().bounds, undefined);

  const oneShot = steam.overlay.openStoreOverlay(480, steam.StoreFlag.None, {
    nativeWindowHandle: hostHandle,
    idleFps: 0,
    pollIntervalMs: 10000
  });
  oneShot.close();

  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "attachNativeOverlayHostView",
        "showNativeOverlayHostView",
        "setNativeOverlayHostInputPassthrough",
        "setNativeOverlayHostOpacity",
        "pumpNativeOverlayProbeWindow",
        "activateOverlayToWebPage",
        "overlayActivateToStore",
        "disconnectGameOverlayActivated",
        "detachNativeOverlayHostView"
      ].includes(call.method)
    ),
    [
      { method: "attachNativeOverlayHostView", args: [hostHandle] },
      { method: "showNativeOverlayHostView", args: [] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "setNativeOverlayHostInputPassthrough", args: [false] },
      { method: "setNativeOverlayHostOpacity", args: [true] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "activateOverlayToWebPage", args: ["https://store.steampowered.com/app/480/", true] },
      { method: "setNativeOverlayHostInputPassthrough", args: [true] },
      { method: "setNativeOverlayHostOpacity", args: [false] },
      { method: "disconnectGameOverlayActivated", args: [] },
      { method: "detachNativeOverlayHostView", args: [] },
      { method: "attachNativeOverlayHostView", args: [hostHandle] },
      { method: "showNativeOverlayHostView", args: [] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "setNativeOverlayHostInputPassthrough", args: [false] },
      { method: "setNativeOverlayHostOpacity", args: [true] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "activateOverlayToWebPage", args: [steam.steamStoreAppUrl(480), true] },
      { method: "disconnectGameOverlayActivated", args: [] },
      { method: "detachNativeOverlayHostView", args: [] }
    ]
  );
});

test("native overlay presenter defers macOS host attach while locked or display-asleep", (t) => {
  setProcessPlatformForTest(t, "darwin");

  const hostHandle = Buffer.from([2, 4, 6, 8, 0, 0, 0, 0]);
  let hostOpen = false;
  let macEnvironment = { screenLocked: true, displayAsleep: false };
  const fake = createFakeNative({
    getMacOverlayEnvironment() {
      this.calls.push({ method: "getMacOverlayEnvironment", args: [] });
      return macEnvironment;
    },
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.deepEqual(steam.getMacOverlayEnvironment(), { screenLocked: true, displayAsleep: false });

  const presenter = steam.overlay.attachPresenter({
    title: "macOS Availability Presenter",
    nativeWindowHandle: hostHandle,
    pollIntervalMs: 10000,
    activationBoostMs: 0
  });

  const locked = presenter.snapshot();
  assert.equal(presenter.isOpen(), true);
  assert.equal(locked.backend, "macos-metal");
  assert.equal(locked.nativeHostUnavailableReason, "macos-screen-locked");
  assert.equal(locked.mode, "hidden");
  assert.equal(locked.attached, false);
  assert.equal(locked.nativeHostOpen, false);
  assert.deepEqual(locked.macOverlayEnvironment, { screenLocked: true, displayAsleep: false });
  assert.equal(locked.currentFps, 0);
  assert.deepEqual(fake.calls.filter((call) => call.method === "attachNativeOverlayHostView"), []);

  macEnvironment = { screenLocked: false, displayAsleep: true };
  presenter.pump();
  const asleep = presenter.snapshot();
  assert.equal(asleep.nativeHostUnavailableReason, "macos-display-asleep");
  assert.deepEqual(asleep.macOverlayEnvironment, { screenLocked: false, displayAsleep: true });
  assert.deepEqual(fake.calls.filter((call) => call.method === "attachNativeOverlayHostView"), []);

  macEnvironment = { screenLocked: false, displayAsleep: false };
  presenter.prepareForOverlay(1000);
  const available = presenter.snapshot();
  assert.equal(available.nativeHostUnavailableReason, undefined);
  assert.deepEqual(available.macOverlayEnvironment, { screenLocked: false, displayAsleep: false });
  assert.equal(available.attached, true);
  assert.equal(available.nativeHostOpen, true);
  assert.equal(available.mode, "active");
  assert.equal(available.clickThrough, false);
  assert.equal(available.transparent, false);
  assert.equal(available.currentFps, 30);
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "attachNativeOverlayHostView"),
    [{ method: "attachNativeOverlayHostView", args: [hostHandle] }]
  );

  presenter.close();
});

test("electron steam overlay manager fails fast while the macOS native host is unavailable", async (t) => {
  setProcessPlatformForTest(t, "darwin");

  const hostHandle = Buffer.from([8, 6, 7, 5, 3, 0, 9, 0]);
  let hostOpen = false;
  const fake = createFakeNative({
    getMacOverlayEnvironment() {
      this.calls.push({ method: "getMacOverlayEnvironment", args: [] });
      return { screenLocked: true, displayAsleep: false };
    },
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Locked macOS Overlay",
    pollIntervalMs: 10000
  });

  assert.equal(overlay.snapshot().nativeHostUnavailableReason, "macos-screen-locked");
  const availability = overlay.getNativeHostAvailability();
  assert.equal(availability.available, false);
  assert.equal(availability.code, "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE");
  assert.equal(availability.reason, "macos-screen-locked");
  assert.equal(availability.nativeHostUnavailableReason, "macos-screen-locked");
  assert.deepEqual(availability.macOverlayEnvironment, { screenLocked: true, displayAsleep: false });
  assert.equal(availability.snapshot.nativeHostUnavailableReason, "macos-screen-locked");
  assert.equal(availability.snapshot.nativeHostOpen, false);
  const unavailableOpenStatus = overlay.getOpenStatus({ type: "friends" });
  assert.equal(unavailableOpenStatus.canOpen, false);
  assert.equal(unavailableOpenStatus.canWait, false);
  assert.equal(unavailableOpenStatus.reason, "native-host-unavailable");
  assert.equal(unavailableOpenStatus.waitReason, "native-host-unavailable");
  assert.equal(unavailableOpenStatus.nativeHostAvailability.available, false);
  assert.equal(unavailableOpenStatus.nativeHostAvailability.reason, "macos-screen-locked");
  assert.match(unavailableOpenStatus.message, /macOS screen is locked/);
  const unavailableShortcutStatus = overlay.getShortcutOpenStatus();
  assert.equal(unavailableShortcutStatus.canOpen, false);
  assert.equal(unavailableShortcutStatus.canWait, false);
  assert.equal(unavailableShortcutStatus.reason, "native-host-unavailable");
  assert.equal(unavailableShortcutStatus.waitReason, "native-host-unavailable");
  assert.equal(unavailableShortcutStatus.target?.type, "friends");
  assert.equal(unavailableShortcutStatus.targetStatus?.reason, "native-host-unavailable");
  assert.equal(unavailableShortcutStatus.nativeHostAvailability?.available, false);
  assert.equal(unavailableShortcutStatus.nativeHostAvailability?.reason, "macos-screen-locked");
  assert.match(unavailableShortcutStatus.message, /macOS screen is locked/);
  assert.equal(overlay.openIfAvailable({ type: "friends" }), null);
  assert.equal(overlay.openShortcutTargetIfAvailable(), null);
  assert.equal(
    await overlay.openAndWaitIfAvailable(
      { type: "web", url: "https://store.steampowered.com/app/480/", modal: true },
      { showTimeoutMs: 200, closeTimeoutMs: 200 }
    ),
    null
  );
  assert.equal(await overlay.openShortcutTargetAndWaitIfAvailable({ showTimeoutMs: 200, closeTimeoutMs: 200 }), null);
  const assertUnavailableError = (error) => {
    assert.equal(error instanceof steam.SteamOverlayNativeHostUnavailableError, true);
    assert.equal(error.name, "SteamOverlayNativeHostUnavailableError");
    assert.equal(error.code, "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE");
    assert.equal(error.reason, "macos-screen-locked");
    assert.deepEqual(error.macOverlayEnvironment, { screenLocked: true, displayAsleep: false });
    assert.match(error.message, /macOS screen is locked/);
    return true;
  };
  const assertCheckoutUnavailableError = (error) => {
    assertUnavailableError(error);
    assert.deepEqual(error.targetSnapshot, { type: "checkout" });
    assert.deepEqual(error.checkoutTargetSnapshot, { type: "checkout" });
    assert.deepEqual(steam.getSteamOverlayErrorTargetSnapshot(error), { type: "checkout" });
    assert.deepEqual(steam.getSteamOverlayCheckoutErrorTargetSnapshot(error), { type: "checkout" });
    assert.deepEqual(steam.overlay.getSteamOverlayErrorTargetSnapshot(error), { type: "checkout" });
    assert.deepEqual(steam.overlay.getSteamOverlayCheckoutErrorTargetSnapshot(error), { type: "checkout" });
    return true;
  };

  assert.throws(
    () => overlay.open({ type: "dialog", dialog: steam.Dialog.Settings }),
    /does not have a verified presenter-backed route/
  );
  assert.throws(
    () => overlay.open({ type: "checkout" }),
    /requires a url, steamUrl, or transactionId/
  );
  await assert.rejects(
    overlay.openAndWait(
      { type: "dialog", dialog: steam.Dialog.Settings },
      { showTimeoutMs: 200, closeTimeoutMs: 200 }
    ),
    /does not have a verified presenter-backed route/
  );
  await assert.rejects(
    overlay.openAndWait(
      { type: "dialog", dialog: steam.Dialog.Friends, route: "native" },
      { showTimeoutMs: 200, closeTimeoutMs: 200 }
    ),
    /openAndWait\(\) requires a presenter-backed target/
  );
  assert.throws(() => overlay.open({ type: "friends" }), assertUnavailableError);
  assert.throws(() => overlay.prepareForCheckout(), assertCheckoutUnavailableError);

  await assert.rejects(
    overlay.openAndWait(
      { type: "web", url: "https://store.steampowered.com/app/480/", modal: true },
      { showTimeoutMs: 200, closeTimeoutMs: 200 }
    ),
    assertUnavailableError
  );
  await assert.rejects(overlay.waitForOverlayShown({ timeoutMs: 200 }), assertUnavailableError);

  let checkoutOperationRan = false;
  assert.equal(
    await overlay.openCheckoutAndWaitIfAvailable(
      () => {
        checkoutOperationRan = true;
        return { transactionId: 456n };
      },
      { showTimeoutMs: 200, closeTimeoutMs: 200 }
    ),
    null
  );
  assert.equal(checkoutOperationRan, false);
  await assert.rejects(
    overlay.openCheckoutAndWait(
      () => {
        checkoutOperationRan = true;
        return { transactionId: 123n };
      },
      { showTimeoutMs: 200, closeTimeoutMs: 200 }
    ),
    assertCheckoutUnavailableError
  );
  await assert.rejects(
    overlay.withCheckoutPrepared(() => {
      checkoutOperationRan = true;
      return "prepared";
    }),
    assertCheckoutUnavailableError
  );
  assert.equal(checkoutOperationRan, false);

  assert.deepEqual(fake.calls.filter((call) => call.method === "attachNativeOverlayHostView"), []);
  assert.deepEqual(fake.calls.filter((call) => call.method === "activateOverlayToWebPage"), []);

  overlay.close();
});

test("electron steam overlay checkout helper stops if macOS host becomes unavailable while pending", async (t) => {
  setProcessPlatformForTest(t, "darwin");

  const hostHandle = Buffer.from([4, 8, 15, 16, 23, 42, 0, 0]);
  let hostOpen = false;
  let macEnvironment = { screenLocked: false, displayAsleep: false };
  const fake = createFakeNative({
    getMacOverlayEnvironment() {
      this.calls.push({ method: "getMacOverlayEnvironment", args: [] });
      return macEnvironment;
    },
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const window = {
    isDestroyed() {
      return false;
    },
    getNativeWindowHandle() {
      return hostHandle;
    },
    once() {},
    webContents: {
      once() {},
      invalidate() {},
      send() {}
    }
  };

  const overlay = steam.overlay.createElectronSteamOverlay(window, {
    title: "Electron Checkout macOS Availability Overlay",
    pollIntervalMs: 10000
  });

  let resolveCheckoutOperation;
  const activationCallsBeforeUnavailable = fake.calls.filter((call) => call.method === "activateOverlayToWebPage").length;
  const checkout = overlay.openCheckoutAndWait(
    () =>
      new Promise((resolve) => {
        resolveCheckoutOperation = resolve;
      }),
    { showTimeoutMs: 200, closeTimeoutMs: 200 }
  );

  await Promise.resolve();
  assert.equal(typeof resolveCheckoutOperation, "function");
  const duringCheckout = overlay.snapshot();
  assert.equal(duringCheckout.nativeHostUnavailableReason, undefined);
  assert.equal(duringCheckout.mode, "active");
  assert.equal(duringCheckout.currentFps, 30);

  macEnvironment = { screenLocked: true, displayAsleep: false };
  overlay.pump();

  await assert.rejects(checkout, (error) => {
    assert.equal(error instanceof steam.SteamOverlayNativeHostUnavailableError, true);
    assert.equal(error.name, "SteamOverlayNativeHostUnavailableError");
    assert.equal(error.code, "STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE");
    assert.equal(error.reason, "macos-screen-locked");
    assert.deepEqual(error.macOverlayEnvironment, { screenLocked: true, displayAsleep: false });
    assert.deepEqual(error.targetSnapshot, { type: "checkout" });
    assert.deepEqual(error.checkoutTargetSnapshot, { type: "checkout" });
    return true;
  });

  const unavailable = overlay.snapshot();
  assert.equal(unavailable.nativeHostUnavailableReason, "macos-screen-locked");
  assert.equal(unavailable.mode, "hidden");
  assert.equal(unavailable.currentFps, 0);

  resolveCheckoutOperation({
    steamurl: "https://checkout.steampowered.com/checkout/approvetxn/333/"
  });
  await Promise.resolve();
  assert.equal(fake.calls.filter((call) => call.method === "activateOverlayToWebPage").length, activationCallsBeforeUnavailable);

  overlay.close();
});

test("native overlay presenter does not pump frames while idle by default", async (t) => {
  let hostOpen = false;
  const hostHandle = Buffer.from([9, 0, 0, 0, 0, 0, 0, 0]);
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const presenter = steam.overlay.attachPresenter({
    title: "Zero Idle Presenter",
    nativeWindowHandle: hostHandle,
    pollIntervalMs: 50
  });

  assert.equal(presenter.snapshot().idleFps, 0);
  assert.equal(presenter.snapshot().currentFps, 0);
  assert.equal(presenter.snapshot().pumpCount, 1);

  await new Promise((resolve) => setTimeout(resolve, 130));

  const afterIdle = presenter.snapshot();
  assert.equal(afterIdle.currentFps, 0);
  assert.equal(afterIdle.pumpCount, 1);
  assert.ok(afterIdle.pollCount >= 1);
  assert.equal(afterIdle.clickThrough, true);
  assert.equal(afterIdle.transparent, true);
  assert.equal(fake.calls.filter((call) => call.method === "pumpNativeOverlayProbeWindow").length, 1);

  presenter.close();
});

test("native overlay presenter primes passive notifications without a blind frame loop", async (t) => {
  setProcessPlatformForTest(t, "linux");
  let hostOpen = false;
  let overlayNeedsPresent = false;
  let restoreFocusCount = 0;
  const hostHandle = Buffer.from([9, 0, 1, 0, 0, 0, 0, 0]);
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    },
    getOverlayDiagnostics() {
      return {
        steamRunning: true,
        steamInstallPath: "/tmp/steam",
        appId: 480,
        overlayEnabled: true,
        overlayNeedsPresent,
        overlayNeedsPresentPollingEnabled: true,
        steamDeck: false,
        bigPicture: false
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const presenter = steam.overlay.attachPresenter({
    title: "Passive Notification Presenter",
    nativeWindowHandle: hostHandle,
    idleFps: 0,
    pollIntervalMs: 10,
    restoreFocus() {
      restoreFocusCount += 1;
    }
  });

  presenter.prepareForPassiveOverlay();
  assert.equal(restoreFocusCount, 0);
  const prepared = presenter.snapshot();
  assert.equal(prepared.mode, "passive");
  assert.equal(prepared.clickThrough, true);
  assert.equal(prepared.transparent, true);
  assert.equal(prepared.currentFps, 0);
  assert.equal(prepared.pumpCount, 2);

  await new Promise((resolve) => setTimeout(resolve, 45));
  const stillIdle = presenter.snapshot();
  assert.equal(stillIdle.currentFps, 0);
  assert.equal(stillIdle.pumpCount, 2);

  overlayNeedsPresent = true;
  assert.equal(
    await waitForCondition(() => presenter.snapshot().overlayNeedsPresent === true, 500, 5),
    true
  );
  const presenting = presenter.snapshot();
  assert.equal(presenting.overlayNeedsPresent, true);
  assert.equal(presenting.mode, "passive");
  assert.equal(presenting.clickThrough, true);
  assert.equal(presenting.transparent, false);
  assert.equal(presenting.currentFps, presenting.needsPresentFps);
  assert.equal(presenting.pumpCount > 2, true);

  presenter.close();
});

test("native overlay presenter keeps passive input while overlay needs present", async (t) => {
  setProcessPlatformForTest(t, "linux");
  let hostOpen = false;
  let overlayNeedsPresent = false;
  const hostHandle = Buffer.from([4, 8, 0, 0, 0, 0, 0, 0]);
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    },
    getOverlayDiagnostics() {
      return {
        steamRunning: true,
        steamInstallPath: "/tmp/steam",
        appId: 480,
        overlayEnabled: true,
        overlayNeedsPresent,
        overlayNeedsPresentPollingEnabled: true,
        steamDeck: false,
        bigPicture: false
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const presenter = steam.overlay.attachPresenter({
    nativeWindowHandle: hostHandle,
    idleFps: 0,
    pollIntervalMs: 5,
    activeGraceMs: 0
  });

  assert.equal(presenter.snapshot().mode, "passive");
  assert.equal(presenter.snapshot().clickThrough, true);
  assert.equal(presenter.snapshot().transparent, true);

  overlayNeedsPresent = true;
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(presenter.snapshot().overlayNeedsPresent, true);
  assert.equal(presenter.snapshot().mode, "passive");
  assert.equal(presenter.snapshot().clickThrough, true);
  assert.equal(presenter.snapshot().transparent, false);

  presenter.close();
});

test("native overlay presenter parks modal overlays after inactive callbacks", async (t) => {
  setProcessPlatformForTest(t, "linux");
  let hostOpen = false;
  let overlayNeedsPresent = false;
  const hostHandle = Buffer.from([4, 8, 0, 2, 0, 0, 0, 0]);
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    },
    getOverlayDiagnostics() {
      return {
        steamRunning: true,
        steamInstallPath: "/tmp/steam",
        appId: 480,
        overlayEnabled: true,
        overlayNeedsPresent,
        overlayNeedsPresentPollingEnabled: true,
        steamDeck: false,
        bigPicture: false
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const presenter = steam.overlay.attachPresenter({
    nativeWindowHandle: hostHandle,
    idleFps: 0,
    pollIntervalMs: 5,
    activeGraceMs: 0
  });

  steam.overlay.openWebOverlay("https://store.steampowered.com/app/480/", {
    modal: true,
    presenter
  });
  assert.equal(presenter.snapshot().mode, "active");
  assert.equal(presenter.snapshot().clickThrough, false);
  assert.equal(presenter.snapshot().transparent, false);

  fake.callbacks.get(331)({ active: true, app_id: 480 });
  overlayNeedsPresent = true;
  assert.equal(
    await waitForCondition(() => presenter.snapshot().overlayNeedsPresent === true, 500, 5),
    true
  );
  assert.equal(presenter.snapshot().overlayNeedsPresent, true);
  assert.equal(presenter.snapshot().transparent, false);

  fake.callbacks.get(331)({ active: false, app_id: 480 });
  assert.equal(presenter.snapshot().mode, "passive");
  assert.equal(presenter.snapshot().clickThrough, true);
  assert.equal(presenter.snapshot().transparent, true);
  const parkedPumpCount = presenter.snapshot().pumpCount;

  await new Promise((resolve) => setTimeout(resolve, 40));
  const afterParkedIdle = presenter.snapshot();
  assert.equal(afterParkedIdle.currentFps, 0);
  assert.equal(afterParkedIdle.pumpCount, parkedPumpCount);

  presenter.close();

  assert.deepEqual(
    fake.calls.filter((call) => call.method === "setNativeOverlayHostOpacity"),
    [
      { method: "setNativeOverlayHostOpacity", args: [true] },
      { method: "setNativeOverlayHostOpacity", args: [false] }
    ]
  );
});

test("native overlay presenter keeps dialog overlays transparent while accepting input", async (t) => {
  let hostOpen = false;
  const hostHandle = Buffer.from([4, 8, 0, 1, 0, 0, 0, 0]);
  const fake = createFakeNative({
    attachNativeOverlayHostView(nativeWindowHandle) {
      hostOpen = true;
      this.calls.push({ method: "attachNativeOverlayHostView", args: [nativeWindowHandle] });
    },
    pumpNativeOverlayProbeWindow() {
      if (!hostOpen) {
        throw new Error("native overlay presenter is closed");
      }
      this.calls.push({ method: "pumpNativeOverlayProbeWindow", args: [] });
    },
    showNativeOverlayHostView() {
      this.calls.push({ method: "showNativeOverlayHostView", args: [] });
    },
    setNativeOverlayHostInputPassthrough(passThrough) {
      this.calls.push({ method: "setNativeOverlayHostInputPassthrough", args: [passThrough] });
    },
    setNativeOverlayHostOpacity(opaque) {
      this.calls.push({ method: "setNativeOverlayHostOpacity", args: [opaque] });
    },
    detachNativeOverlayHostView() {
      hostOpen = false;
      this.calls.push({ method: "detachNativeOverlayHostView", args: [] });
    },
    isNativeOverlayProbeWindowOpen() {
      return false;
    },
    isNativeOverlayHostViewOpen() {
      return hostOpen;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const presenter = steam.overlay.attachPresenter({
    nativeWindowHandle: hostHandle,
    idleFps: 0,
    pollIntervalMs: 10000,
    activeGraceMs: 0
  });

  steam.overlay.openDialogOverlay("Friends", { presenter });
  assert.equal(presenter.snapshot().mode, "active");
  assert.equal(presenter.snapshot().clickThrough, false);
  assert.equal(presenter.snapshot().transparent, true);

  fake.callbacks.get(331)({ active: true, app_id: 480 });
  assert.equal(presenter.snapshot().overlayActive, true);
  assert.equal(presenter.snapshot().overlayWasActive, true);
  assert.equal(presenter.snapshot().mode, "active");
  assert.equal(presenter.snapshot().clickThrough, false);
  assert.equal(presenter.snapshot().transparent, true);

  fake.callbacks.get(331)({ active: false, app_id: 480 });
  assert.equal(presenter.snapshot().overlayActive, false);
  assert.equal(presenter.snapshot().mode, "passive");
  assert.equal(presenter.snapshot().clickThrough, true);
  assert.equal(presenter.snapshot().transparent, true);

  presenter.close();

  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "attachNativeOverlayHostView",
        "showNativeOverlayHostView",
        "pumpNativeOverlayProbeWindow",
        "activateOverlay",
        "setNativeOverlayHostInputPassthrough",
        "setNativeOverlayHostOpacity",
        "disconnectGameOverlayActivated",
        "detachNativeOverlayHostView"
      ].includes(call.method)
    ),
    [
      { method: "attachNativeOverlayHostView", args: [hostHandle] },
      { method: "showNativeOverlayHostView", args: [] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "setNativeOverlayHostInputPassthrough", args: [false] },
      { method: "pumpNativeOverlayProbeWindow", args: [] },
      { method: "activateOverlay", args: ["Friends"] },
      { method: "setNativeOverlayHostInputPassthrough", args: [true] },
      { method: "disconnectGameOverlayActivated", args: [] },
      { method: "detachNativeOverlayHostView", args: [] }
    ]
  );
});

test("matchmaking facade covers favorites, lobby filters, metadata, chat, and callbacks", async (t) => {
  const lobbyId = 109775242022617907n;
  const dependentLobbyId = 109775242022617908n;
  const memberId = 76561198000000010n;
  const serverId = 90123456789012345n;
  const nativeServer = {
    address: {
      ip: 2130706433,
      ip_address: "127.0.0.1",
      connection_port: 27015,
      query_port: 27016,
      connection_address: "127.0.0.1:27015",
      query_address: "127.0.0.1:27016"
    },
    ping: 42,
    had_successful_response: true,
    do_not_refresh: false,
    game_dir: "spacewar",
    map: "arena",
    game_description: "Spacewar",
    app_id: 480,
    players: 3,
    max_players: 8,
    bot_players: 1,
    password: false,
    secure: true,
    time_last_played: 123456,
    server_version: 7,
    name: "Test Server",
    game_tags: "dm,pvp",
    steam_id: { steamId64: String(serverId), steamId32: "STEAM_0:0:2", accountId: 2 }
  };
  const nativeServerList = {
    response: 0,
    responded: [0],
    failed: [1],
    servers: [nativeServer]
  };
  const fake = createFakeNative({
    matchmakingGetFavoriteGameCount() {
      this.calls.push({ method: "matchmakingGetFavoriteGameCount", args: [] });
      return 1;
    },
    matchmakingGetFavoriteGame(index) {
      this.calls.push({ method: "matchmakingGetFavoriteGame", args: [index] });
      return {
        app_id: 480,
        ip: 2130706433,
        ip_address: "127.0.0.1",
        conn_port: 27015,
        query_port: 27016,
        flags: 1,
        last_played_on_server: 123456
      };
    },
    matchmakingAddFavoriteGame(appId, ip, connPort, queryPort, flags, lastPlayedOnServer) {
      this.calls.push({ method: "matchmakingAddFavoriteGame", args: [appId, ip, connPort, queryPort, flags, lastPlayedOnServer] });
      return 2;
    },
    matchmakingRemoveFavoriteGame(appId, ip, connPort, queryPort, flags) {
      this.calls.push({ method: "matchmakingRemoveFavoriteGame", args: [appId, ip, connPort, queryPort, flags] });
      return true;
    },
    matchmakingAddRequestLobbyListStringFilter(key, value, comparison) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListStringFilter", args: [key, value, comparison] });
    },
    matchmakingAddRequestLobbyListNumericalFilter(key, value, comparison) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListNumericalFilter", args: [key, value, comparison] });
    },
    matchmakingAddRequestLobbyListNearValueFilter(key, value) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListNearValueFilter", args: [key, value] });
    },
    matchmakingAddRequestLobbyListFilterSlotsAvailable(slots) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListFilterSlotsAvailable", args: [slots] });
    },
    matchmakingAddRequestLobbyListDistanceFilter(distanceFilter) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListDistanceFilter", args: [distanceFilter] });
    },
    matchmakingAddRequestLobbyListResultCountFilter(maxResults) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListResultCountFilter", args: [maxResults] });
    },
    matchmakingAddRequestLobbyListCompatibleMembersFilter(lobby) {
      this.calls.push({ method: "matchmakingAddRequestLobbyListCompatibleMembersFilter", args: [lobby] });
    },
    matchmakingServersRequestInternetServerList(appId, filters, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestInternetServerList", args: [appId, filters, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersRequestLanServerList(appId, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestLanServerList", args: [appId, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersRequestFriendsServerList(appId, filters, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestFriendsServerList", args: [appId, filters, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersRequestFavoritesServerList(appId, filters, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestFavoritesServerList", args: [appId, filters, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersRequestHistoryServerList(appId, filters, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestHistoryServerList", args: [appId, filters, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersRequestSpectatorServerList(appId, filters, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersRequestSpectatorServerList", args: [appId, filters, timeoutSeconds] });
      return Promise.resolve(nativeServerList);
    },
    matchmakingServersOpenInternetServerList(appId, filters) {
      this.calls.push({ method: "matchmakingServersOpenInternetServerList", args: [appId, filters] });
      return { handle: 55n, steam_request: 66n, app_id: appId, kind: "internet" };
    },
    matchmakingServersOpenLanServerList(appId) {
      this.calls.push({ method: "matchmakingServersOpenLanServerList", args: [appId] });
      return { handle: 56n, steam_request: 67n, app_id: appId, kind: "lan" };
    },
    matchmakingServersOpenFriendsServerList(appId, filters) {
      this.calls.push({ method: "matchmakingServersOpenFriendsServerList", args: [appId, filters] });
      return { handle: 57n, steam_request: 68n, app_id: appId, kind: "friends" };
    },
    matchmakingServersOpenFavoritesServerList(appId, filters) {
      this.calls.push({ method: "matchmakingServersOpenFavoritesServerList", args: [appId, filters] });
      return { handle: 58n, steam_request: 69n, app_id: appId, kind: "favorites" };
    },
    matchmakingServersOpenHistoryServerList(appId, filters) {
      this.calls.push({ method: "matchmakingServersOpenHistoryServerList", args: [appId, filters] });
      return { handle: 59n, steam_request: 70n, app_id: appId, kind: "history" };
    },
    matchmakingServersOpenSpectatorServerList(appId, filters) {
      this.calls.push({ method: "matchmakingServersOpenSpectatorServerList", args: [appId, filters] });
      return { handle: 60n, steam_request: 71n, app_id: appId, kind: "spectator" };
    },
    matchmakingServersGetServerListRequestState(handle) {
      this.calls.push({ method: "matchmakingServersGetServerListRequestState", args: [handle] });
      return {
        handle,
        steam_request: 66n,
        app_id: 480,
        kind: "internet",
        completed: true,
        cancelled: false,
        response: 0,
        responded: [0],
        failed: [1],
        refreshing: false,
        server_count: 1
      };
    },
    matchmakingServersGetServerListRequestServerDetails(handle, server) {
      this.calls.push({ method: "matchmakingServersGetServerListRequestServerDetails", args: [handle, server] });
      return nativeServer;
    },
    matchmakingServersRefreshServerListQuery(handle) {
      this.calls.push({ method: "matchmakingServersRefreshServerListQuery", args: [handle] });
    },
    matchmakingServersRefreshServerListServer(handle, server) {
      this.calls.push({ method: "matchmakingServersRefreshServerListServer", args: [handle, server] });
    },
    matchmakingServersCancelServerListQuery(handle) {
      this.calls.push({ method: "matchmakingServersCancelServerListQuery", args: [handle] });
    },
    matchmakingServersReleaseServerListRequest(handle) {
      this.calls.push({ method: "matchmakingServersReleaseServerListRequest", args: [handle] });
      return true;
    },
    matchmakingServersPingServer(ip, queryPort, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersPingServer", args: [ip, queryPort, timeoutSeconds] });
      return Promise.resolve({ responded: true, server: nativeServer });
    },
    matchmakingServersPlayerDetails(ip, queryPort, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersPlayerDetails", args: [ip, queryPort, timeoutSeconds] });
      return Promise.resolve({ responded: true, players: [{ name: "player", score: 10, time_played: 12.5 }] });
    },
    matchmakingServersServerRules(ip, queryPort, timeoutSeconds) {
      this.calls.push({ method: "matchmakingServersServerRules", args: [ip, queryPort, timeoutSeconds] });
      return Promise.resolve({ responded: true, rules: [{ name: "sv_cheats", value: "0" }] });
    },
    matchmakingServersCreateServerAddress(ip, queryPort, connectionPort) {
      this.calls.push({ method: "matchmakingServersCreateServerAddress", args: [ip, queryPort, connectionPort] });
      return {
        ip,
        ip_address: "127.0.0.1",
        connection_port: connectionPort,
        query_port: queryPort,
        connection_address: "127.0.0.1:27015",
        query_address: "127.0.0.1:27016"
      };
    },
    matchmakingServersCopyServerAddress(ip, queryPort, connectionPort) {
      this.calls.push({ method: "matchmakingServersCopyServerAddress", args: [ip, queryPort, connectionPort] });
      return {
        ip,
        ip_address: "127.0.0.1",
        connection_port: connectionPort,
        query_port: queryPort,
        connection_address: "127.0.0.1:27015",
        query_address: "127.0.0.1:27016"
      };
    },
    matchmakingServersIsServerAddressLessThan(ip, queryPort, connectionPort, otherIp, otherQueryPort, otherConnectionPort) {
      this.calls.push({
        method: "matchmakingServersIsServerAddressLessThan",
        args: [ip, queryPort, connectionPort, otherIp, otherQueryPort, otherConnectionPort]
      });
      return true;
    },
    matchmakingServersCreateServerFilter(key, value) {
      this.calls.push({ method: "matchmakingServersCreateServerFilter", args: [key, value] });
      return { key, value };
    },
    matchmakingServersCreateServerItem(name, ip, queryPort, connectionPort) {
      this.calls.push({ method: "matchmakingServersCreateServerItem", args: [name, ip, queryPort, connectionPort] });
      return { ...nativeServer, name };
    },
    matchmakingServersCreateResponseCallbackSnapshot(
      request,
      respondedServer,
      failedServer,
      response,
      playerName,
      playerScore,
      playerTimePlayed,
      ruleName,
      ruleValue
    ) {
      this.calls.push({
        method: "matchmakingServersCreateResponseCallbackSnapshot",
        args: [request, respondedServer, failedServer, response, playerName, playerScore, playerTimePlayed, ruleName, ruleValue]
      });
      return {
        server_list: {
          request,
          completed: true,
          cancelled: false,
          response,
          responded: [respondedServer],
          failed: [failedServer]
        },
        ping_success: { responded: true, server: nativeServer },
        ping_failure: { responded: false, server: null },
        players_success: { responded: true, players: [{ name: playerName, score: playerScore, time_played: playerTimePlayed }] },
        players_failure: { responded: false, players: [] },
        rules_success: { responded: true, rules: [{ name: ruleName, value: ruleValue }] },
        rules_failure: { responded: false, rules: [] }
      };
    },
    matchmakingCreateLobby(lobbyType, maxMembers) {
      this.calls.push({ method: "matchmakingCreateLobby", args: [lobbyType, maxMembers] });
      return Promise.resolve({ id: lobbyId });
    },
    matchmakingJoinLobby(lobby) {
      this.calls.push({ method: "matchmakingJoinLobby", args: [lobby] });
      return Promise.resolve({ id: lobby });
    },
    matchmakingGetLobbies() {
      this.calls.push({ method: "matchmakingGetLobbies", args: [] });
      return Promise.resolve([{ id: lobbyId }]);
    },
    matchmakingLeaveLobby(lobby) {
      this.calls.push({ method: "matchmakingLeaveLobby", args: [lobby] });
    },
    matchmakingGetLobbyMemberCount(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyMemberCount", args: [lobby] });
      return 2;
    },
    matchmakingGetLobbyMemberLimit(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyMemberLimit", args: [lobby] });
      return 4;
    },
    matchmakingGetLobbyMembers(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyMembers", args: [lobby] });
      return [{ steamId64: String(memberId), steamId32: "STEAM_0:0:1", accountId: 1 }];
    },
    matchmakingGetLobbyOwner(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyOwner", args: [lobby] });
      return { steamId64: String(memberId), steamId32: "STEAM_0:0:1", accountId: 1 };
    },
    matchmakingSetLobbyJoinable(lobby, joinable) {
      this.calls.push({ method: "matchmakingSetLobbyJoinable", args: [lobby, joinable] });
      return true;
    },
    matchmakingGetLobbyData(lobby, key) {
      this.calls.push({ method: "matchmakingGetLobbyData", args: [lobby, key] });
      return key === "missing" ? null : "value";
    },
    matchmakingSetLobbyData(lobby, key, value) {
      this.calls.push({ method: "matchmakingSetLobbyData", args: [lobby, key, value] });
      return true;
    },
    matchmakingDeleteLobbyData(lobby, key) {
      this.calls.push({ method: "matchmakingDeleteLobbyData", args: [lobby, key] });
      return true;
    },
    matchmakingGetLobbyFullData(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyFullData", args: [lobby] });
      return { map: "test-map" };
    },
    matchmakingInviteUserToLobby(lobby, steamId64) {
      this.calls.push({ method: "matchmakingInviteUserToLobby", args: [lobby, steamId64] });
      return true;
    },
    matchmakingGetLobbyMemberData(lobby, steamId64, key) {
      this.calls.push({ method: "matchmakingGetLobbyMemberData", args: [lobby, steamId64, key] });
      return "ready";
    },
    matchmakingSetLobbyMemberData(lobby, key, value) {
      this.calls.push({ method: "matchmakingSetLobbyMemberData", args: [lobby, key, value] });
    },
    matchmakingSendLobbyChatMsg(lobby, data) {
      this.calls.push({ method: "matchmakingSendLobbyChatMsg", args: [lobby, data] });
      return true;
    },
    matchmakingGetLobbyChatEntry(lobby, chatId, maxBytes) {
      this.calls.push({ method: "matchmakingGetLobbyChatEntry", args: [lobby, chatId, maxBytes] });
      return {
        steam_id: { steamId64: String(memberId), steamId32: "STEAM_0:0:1", accountId: 1 },
        data: Buffer.from("hello"),
        size: 5,
        text: "hello",
        entry_type: 1
      };
    },
    matchmakingRequestLobbyData(lobby) {
      this.calls.push({ method: "matchmakingRequestLobbyData", args: [lobby] });
      return true;
    },
    matchmakingSetLobbyGameServer(lobby, ip, port, steamId64) {
      this.calls.push({ method: "matchmakingSetLobbyGameServer", args: [lobby, ip, port, steamId64] });
    },
    matchmakingGetLobbyGameServer(lobby) {
      this.calls.push({ method: "matchmakingGetLobbyGameServer", args: [lobby] });
      return {
        ip: 2130706433,
        ip_address: "127.0.0.1",
        port: 27015,
        steam_id: { steamId64: String(serverId), steamId32: "STEAM_0:0:2", accountId: 2 }
      };
    },
    matchmakingSetLobbyMemberLimit(lobby, maxMembers) {
      this.calls.push({ method: "matchmakingSetLobbyMemberLimit", args: [lobby, maxMembers] });
      return true;
    },
    matchmakingSetLobbyType(lobby, lobbyType) {
      this.calls.push({ method: "matchmakingSetLobbyType", args: [lobby, lobbyType] });
      return true;
    },
    matchmakingSetLobbyOwner(lobby, steamId64) {
      this.calls.push({ method: "matchmakingSetLobbyOwner", args: [lobby, steamId64] });
      return true;
    },
    matchmakingSetLinkedLobby(lobby, dependentLobby) {
      this.calls.push({ method: "matchmakingSetLinkedLobby", args: [lobby, dependentLobby] });
      return true;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.matchmaking.FavoriteFlags.Favorite, 1);
  assert.equal(steam.matchmaking.LobbyType.PrivateUnique, 4);
  assert.equal(steam.matchmaking.servers, steam.matchmakingServers);
  assert.equal(steam.matchmaking.favoriteGameCount(), 1);
  assert.deepEqual(steam.matchmaking.favoriteGame(0), {
    appId: 480,
    ip: 2130706433,
    ipAddress: "127.0.0.1",
    connPort: 27015,
    queryPort: 27016,
    flags: 1,
    lastPlayedOnServer: 123456
  });
  assert.equal(
    steam.matchmaking.addFavoriteGame({
      appId: 480,
      ip: 2130706433,
      ipAddress: "127.0.0.1",
      connPort: 27015,
      queryPort: 27016,
      flags: steam.matchmaking.FavoriteFlags.Favorite,
      lastPlayedOnServer: 123456
    }),
    2
  );
  assert.equal(
    steam.matchmaking.removeFavoriteGame({
      appId: 480,
      ip: 2130706433,
      connPort: 27015,
      queryPort: 27016,
      flags: steam.matchmaking.FavoriteFlags.Favorite
    }),
    true
  );

  const lobbies = await steam.matchmaking.getLobbies({
    stringFilters: [{ key: "mode", value: "coop" }],
    numericalFilters: [{ key: "skill", value: 3, comparison: steam.matchmaking.LobbyComparison.EqualToOrGreaterThan }],
    nearValueFilters: [{ key: "ping", value: 50 }],
    slotsAvailable: 1,
    distanceFilter: steam.matchmaking.LobbyDistanceFilter.Worldwide,
    resultCount: 10,
    compatibleLobby: lobbyId
  });
  assert.equal(lobbies[0].id, lobbyId);

  const internetServers = await steam.matchmaking.servers.requestInternetServerList(480, {
    filters: [{ key: "map", value: "arena" }],
    timeoutSeconds: 5
  });
  assert.equal(internetServers.response, 0);
  assert.deepEqual(internetServers.responded, [0]);
  assert.deepEqual(internetServers.failed, [1]);
  assert.equal(internetServers.servers[0].address.ipAddress, "127.0.0.1");
  assert.equal(internetServers.servers[0].address.connectionPort, 27015);
  assert.equal(internetServers.servers[0].address.queryAddress, "127.0.0.1:27016");
  assert.equal(internetServers.servers[0].gameDir, "spacewar");
  assert.equal(internetServers.servers[0].gameDescription, "Spacewar");
  assert.equal(internetServers.servers[0].maxPlayers, 8);
  assert.equal(internetServers.servers[0].steamId.steamId64, serverId);
  assert.equal((await steam.matchmaking.servers.requestLANServerList(480, 5)).servers[0].name, "Test Server");
  await steam.matchmaking.servers.requestFriendsServerList(480, { filters: [{ key: "secure" }] });
  await steam.matchmaking.servers.requestFavoritesServerList(480);
  await steam.matchmaking.servers.requestHistoryServerList(480);
  await steam.matchmaking.servers.requestSpectatorServerList(480);
  const serverListRequest = steam.matchmaking.servers.openInternetServerList(480, {
    filters: [{ key: "map", value: "arena" }]
  });
  assert.equal(serverListRequest.handle, 55n);
  assert.equal(serverListRequest.steamRequest, 66n);
  assert.equal(serverListRequest.appId, 480);
  assert.equal(serverListRequest.kind, "internet");
  const requestState = serverListRequest.getState();
  assert.equal(requestState.completed, true);
  assert.equal(requestState.cancelled, false);
  assert.equal(requestState.serverCount, 1);
  assert.deepEqual(requestState.responded, [0]);
  assert.equal(serverListRequest.getServerCount(), 1);
  assert.equal(serverListRequest.getServerDetails(0).steamId.steamId64, serverId);
  serverListRequest.refreshQuery();
  serverListRequest.refreshServer(0);
  serverListRequest.cancelQuery();
  assert.equal(serverListRequest.release(), true);
  assert.equal(steam.matchmaking.servers.openLANServerList(480).kind, "lan");
  assert.equal(steam.matchmaking.servers.openFriendsServerList(480, { filters: [{ key: "secure" }] }).kind, "friends");
  assert.equal(steam.matchmaking.servers.openFavoritesServerList(480).kind, "favorites");
  assert.equal(steam.matchmaking.servers.openHistoryServerList(480).kind, "history");
  assert.equal(steam.matchmaking.servers.openSpectatorServerList(480).kind, "spectator");
  const ping = await steam.matchmaking.servers.pingServer(2130706433, 27016, 5);
  assert.equal(ping.responded, true);
  assert.equal(ping.server.name, "Test Server");
  const players = await steam.matchmaking.servers.playerDetails(2130706433, 27016, 5);
  assert.equal(players.responded, true);
  assert.equal(players.players[0].timePlayed, 12.5);
  const rules = await steam.matchmaking.servers.serverRules(2130706433, 27016, 5);
  assert.equal(rules.responded, true);
  assert.equal(rules.rules[0].name, "sv_cheats");
  assert.deepEqual(steam.matchmaking.servers.createServerAddress(2130706433, 27016, 27015), {
    ip: 2130706433,
    ipAddress: "127.0.0.1",
    connectionPort: 27015,
    queryPort: 27016,
    connectionAddress: "127.0.0.1:27015",
    queryAddress: "127.0.0.1:27016"
  });
  assert.equal(steam.matchmaking.servers.copyServerAddress(2130706433, 27016, 27015).connectionAddress, "127.0.0.1:27015");
  assert.equal(
    steam.matchmaking.servers.isServerAddressLessThan(2130706433, 27016, 27015, 2130706434, 27016, 27015),
    true
  );
  assert.deepEqual(steam.matchmaking.servers.createServerFilter("map", "arena"), { key: "map", value: "arena" });
  assert.equal(steam.matchmaking.servers.createServerItem("Constructed Server", 2130706433, 27016, 27015).name, "Constructed Server");
  const callbackSnapshot = steam.matchmaking.servers.createResponseCallbackSnapshot({
    request: 99n,
    respondedServer: 2,
    failedServer: 3,
    response: 0,
    playerName: "alice",
    playerScore: 10,
    playerTimePlayed: 12.5,
    ruleName: "sv_gravity",
    ruleValue: "800"
  });
  assert.deepEqual(callbackSnapshot.serverList.responded, [2]);
  assert.deepEqual(callbackSnapshot.serverList.failed, [3]);
  assert.equal(callbackSnapshot.serverList.request, 99n);
  assert.equal(callbackSnapshot.pingSuccess.server.name, "Test Server");
  assert.equal(callbackSnapshot.pingFailure.responded, false);
  assert.equal(callbackSnapshot.playersSuccess.players[0].timePlayed, 12.5);
  assert.equal(callbackSnapshot.playersFailure.responded, false);
  assert.deepEqual(callbackSnapshot.rulesSuccess.rules[0], { name: "sv_gravity", value: "800" });
  assert.equal(callbackSnapshot.rulesFailure.responded, false);

  const lobby = await steam.matchmaking.createLobby(steam.matchmaking.LobbyType.Public, 4);
  assert.equal((await steam.matchmaking.joinLobby(lobbyId)).id, lobbyId);
  assert.equal(lobby.getMemberCount(), 2n);
  assert.equal(lobby.getMemberLimit(), 4n);
  assert.equal(lobby.getMembers()[0].steamId64, memberId);
  assert.equal(lobby.getOwner().steamId64, memberId);
  assert.equal(lobby.setJoinable(true), true);
  assert.equal(lobby.getData("key"), "value");
  assert.equal(lobby.setData("key", "value"), true);
  assert.equal(lobby.deleteData("key"), true);
  assert.deepEqual(lobby.getFullData(), { map: "test-map" });
  assert.equal(lobby.inviteUser(memberId), true);
  assert.equal(lobby.getMemberData(memberId, "status"), "ready");
  lobby.setMemberData("status", "ready");
  assert.equal(lobby.sendChatMessage("hello"), true);
  assert.equal(lobby.getChatEntry(7, 128).steamId.steamId64, memberId);
  assert.equal(lobby.requestData(), true);
  lobby.setGameServer({ ip: 2130706433, port: 27015, steamId64: serverId });
  assert.equal(lobby.getGameServer().steamId.steamId64, serverId);
  assert.equal(lobby.setMemberLimit(8), true);
  assert.equal(lobby.setType(steam.matchmaking.LobbyType.Invisible), true);
  assert.equal(lobby.setOwner(memberId), true);
  assert.equal(lobby.setLinkedLobby(dependentLobbyId), true);
  lobby.leave();

  let inviteEvent;
  steam.callback.register(steam.SteamCallback.LobbyInvite, (event) => {
    inviteEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LobbyInvite)({
    user: String(memberId),
    lobby: String(lobbyId),
    game_id: "480"
  });
  assert.equal(inviteEvent.user, memberId);
  assert.equal(inviteEvent.lobby, lobbyId);
  assert.equal(inviteEvent.gameId, 480n);

  let chatEvent;
  steam.callback.register(steam.SteamCallback.LobbyChatMsg, (event) => {
    chatEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.LobbyChatMsg)({
    lobby: String(lobbyId),
    user: String(memberId),
    entry_type: 1,
    chat_id: 7
  });
  assert.equal(chatEvent.entryType, 1);
  assert.equal(chatEvent.chatId, 7);

  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingAddRequestLobbyListStringFilter"), {
    method: "matchmakingAddRequestLobbyListStringFilter",
    args: ["mode", "coop", steam.matchmaking.LobbyComparison.Equal]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingServersRequestInternetServerList"), {
    method: "matchmakingServersRequestInternetServerList",
    args: [480, [{ key: "map", value: "arena" }], 5]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingServersRequestFriendsServerList"), {
    method: "matchmakingServersRequestFriendsServerList",
    args: [480, [{ key: "secure", value: "" }], undefined]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingServersOpenInternetServerList"), {
    method: "matchmakingServersOpenInternetServerList",
    args: [480, [{ key: "map", value: "arena" }]]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingServersRefreshServerListQuery"), {
    method: "matchmakingServersRefreshServerListQuery",
    args: [55n]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingServersReleaseServerListRequest"), {
    method: "matchmakingServersReleaseServerListRequest",
    args: [55n]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingServersCreateServerAddress"), {
    method: "matchmakingServersCreateServerAddress",
    args: [2130706433, 27016, 27015]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingServersCreateServerFilter"), {
    method: "matchmakingServersCreateServerFilter",
    args: ["map", "arena"]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingServersCreateServerItem"), {
    method: "matchmakingServersCreateServerItem",
    args: ["Constructed Server", 2130706433, 27016, 27015]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "matchmakingServersCreateResponseCallbackSnapshot"), {
    method: "matchmakingServersCreateResponseCallbackSnapshot",
    args: [99n, 2, 3, 0, "alice", 10, 12.5, "sv_gravity", "800"]
  });
});

test("matchmaking facade exposes typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);
  const lobbyId = 109775242022617907n;
  const memberId = 76561198000000010n;
  const adminId = 76561198000000011n;
  const serverId = 90123456789012345n;

  t.after(clearSteamBridgeCache);

  const events = {};
  const handles = [
    steam.matchmaking.onFavoritesListChanged((event) => {
      events.favoritesListChanged = event;
    }),
    steam.matchmaking.onLobbyInvite((event) => {
      events.lobbyInvite = event;
    }),
    steam.matchmaking.onLobbyEnter((event) => {
      events.lobbyEnter = event;
    }),
    steam.matchmaking.onLegacyLobbyDataUpdate((event) => {
      events.legacyLobbyDataUpdate = event;
    }),
    steam.matchmaking.onLobbyDataUpdate((event) => {
      events.lobbyDataUpdate = event;
    }),
    steam.matchmaking.onLegacyLobbyChatUpdate((event) => {
      events.legacyLobbyChatUpdate = event;
    }),
    steam.matchmaking.onLobbyChatUpdate((event) => {
      events.lobbyChatUpdate = event;
    }),
    steam.matchmaking.onLobbyChatMessage((event) => {
      events.lobbyChatMessage = event;
    }),
    steam.matchmaking.onLobbyGameCreated((event) => {
      events.lobbyGameCreated = event;
    }),
    steam.matchmaking.onLobbyMatchList((event) => {
      events.lobbyMatchList = event;
    }),
    steam.matchmaking.onLobbyKicked((event) => {
      events.lobbyKicked = event;
    }),
    steam.matchmaking.onLobbyCreated((event) => {
      events.lobbyCreated = event;
    }),
    steam.matchmaking.onFavoritesListAccountsUpdated((event) => {
      events.favoritesListAccountsUpdated = event;
    })
  ];
  const callbackNames = [
    "FavoritesListChanged",
    "LobbyInvite",
    "LobbyEnter",
    "LobbyDataUpdate",
    "LobbyDataUpdateSteamworks",
    "LobbyChatUpdate",
    "LobbyChatUpdateSteamworks",
    "LobbyChatMsg",
    "LobbyGameCreated",
    "LobbyMatchList",
    "LobbyKicked",
    "LobbyCreated",
    "FavoritesListAccountsUpdated"
  ];
  const emit = (callbackName, payload) => {
    fake.callbacks.get(steam.SteamCallback[callbackName])(payload);
  };

  emit("FavoritesListChanged", {
    ip: 2130706433,
    ip_address: "127.0.0.1",
    query_port: 27016,
    conn_port: 27015,
    app_id: 480,
    flags: steam.matchmaking.FavoriteFlags.Favorite,
    add: true,
    account_id: 42
  });
  emit("LobbyInvite", {
    user: String(memberId),
    lobby: String(lobbyId),
    game_id: "480"
  });
  emit("LobbyEnter", {
    lobby: String(lobbyId),
    chat_permissions: 3,
    locked: false,
    chat_room_enter_response: 1
  });
  emit("LobbyDataUpdate", {
    lobby: String(lobbyId),
    member: String(adminId),
    success: false
  });
  emit("LobbyDataUpdateSteamworks", {
    lobby: String(lobbyId),
    member: String(memberId),
    success: true
  });
  emit("LobbyChatUpdate", {
    lobby: String(lobbyId),
    user_changed: String(adminId),
    making_change: String(memberId),
    member_state_change: 2
  });
  emit("LobbyChatUpdateSteamworks", {
    lobby: String(lobbyId),
    user_changed: String(memberId),
    making_change: String(adminId),
    member_state_change: 4
  });
  emit("LobbyChatMsg", {
    lobby: String(lobbyId),
    user: String(memberId),
    entry_type: 1,
    chat_id: 7
  });
  emit("LobbyGameCreated", {
    lobby: String(lobbyId),
    game_server: String(serverId),
    ip: 2130706433,
    ip_address: "127.0.0.1",
    port: 27015
  });
  emit("LobbyMatchList", { lobbies_matching: 12 });
  emit("LobbyKicked", {
    lobby: String(lobbyId),
    admin: String(adminId),
    kicked_due_to_disconnect: true
  });
  emit("LobbyCreated", {
    result: 1,
    lobby: String(lobbyId)
  });
  emit("FavoritesListAccountsUpdated", { result: 1 });

  assert.equal(events.favoritesListChanged.ipAddress, "127.0.0.1");
  assert.equal(events.favoritesListChanged.queryPort, 27016);
  assert.equal(events.favoritesListChanged.connPort, 27015);
  assert.equal(events.favoritesListChanged.appId, 480);
  assert.equal(events.favoritesListChanged.accountId, 42);
  assert.equal(events.lobbyInvite.user, memberId);
  assert.equal(events.lobbyInvite.lobby, lobbyId);
  assert.equal(events.lobbyInvite.gameId, 480n);
  assert.equal(events.lobbyEnter.chatPermissions, 3);
  assert.equal(events.lobbyEnter.chatRoomEnterResponse, 1);
  assert.equal(events.legacyLobbyDataUpdate.member, adminId);
  assert.equal(events.legacyLobbyDataUpdate.success, false);
  assert.equal(events.lobbyDataUpdate.member, memberId);
  assert.equal(events.lobbyDataUpdate.success, true);
  assert.equal(events.legacyLobbyChatUpdate.userChanged, adminId);
  assert.equal(events.legacyLobbyChatUpdate.makingChange, memberId);
  assert.equal(events.legacyLobbyChatUpdate.memberStateChange, 2);
  assert.equal(events.lobbyChatUpdate.userChanged, memberId);
  assert.equal(events.lobbyChatUpdate.makingChange, adminId);
  assert.equal(events.lobbyChatUpdate.memberStateChange, 4);
  assert.equal(events.lobbyChatMessage.entryType, 1);
  assert.equal(events.lobbyChatMessage.chatId, 7);
  assert.equal(events.lobbyGameCreated.gameServer, serverId);
  assert.equal(events.lobbyGameCreated.ipAddress, "127.0.0.1");
  assert.equal(events.lobbyGameCreated.port, 27015);
  assert.equal(events.lobbyMatchList.lobbiesMatching, 12);
  assert.equal(events.lobbyKicked.admin, adminId);
  assert.equal(events.lobbyKicked.kickedDueToDisconnect, true);
  assert.equal(events.lobbyCreated.lobby, lobbyId);
  assert.equal(events.favoritesListAccountsUpdated.result, 1);

  handles.forEach((handle) => handle.disconnect());

  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback").map((call) => call.args[0]),
    callbackNames.map((callbackName) => steam.SteamCallback[callbackName])
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback").map((call) => call.args[0]),
    callbackNames.map((callbackName) => steam.SteamCallback[callbackName])
  );
});

test("apps facade covers DLC, launch, depot, trial, beta, and file-detail helpers", async (t) => {
  const sha = Buffer.from("00112233445566778899aabbccddeeff00112233", "hex");
  const fake = createFakeNative({
    appsIsSubscribedApp(appId) {
      this.calls.push({ method: "appsIsSubscribedApp", args: [appId] });
      return appId === 480;
    },
    appsIsAppInstalled(appId) {
      this.calls.push({ method: "appsIsAppInstalled", args: [appId] });
      return appId === 480;
    },
    appsIsDlcInstalled(appId) {
      this.calls.push({ method: "appsIsDlcInstalled", args: [appId] });
      return appId === 481;
    },
    appsIsSubscribedFromFreeWeekend() {
      this.calls.push({ method: "appsIsSubscribedFromFreeWeekend", args: [] });
      return false;
    },
    appsIsVacBanned() {
      this.calls.push({ method: "appsIsVacBanned", args: [] });
      return false;
    },
    appsIsCybercafe() {
      this.calls.push({ method: "appsIsCybercafe", args: [] });
      return false;
    },
    appsIsLowViolence() {
      this.calls.push({ method: "appsIsLowViolence", args: [] });
      return false;
    },
    appsAppBuildId() {
      this.calls.push({ method: "appsAppBuildId", args: [] });
      return 123456;
    },
    appsAppInstallDir(appId) {
      this.calls.push({ method: "appsAppInstallDir", args: [appId] });
      return "/tmp/spacewar";
    },
    appsAppOwner() {
      this.calls.push({ method: "appsAppOwner", args: [] });
      return { steamId64: "76561198000000001", steamId32: "STEAM_0:1:19867136", accountId: 39734273 };
    },
    appsAvailableGameLanguages() {
      this.calls.push({ method: "appsAvailableGameLanguages", args: [] });
      return ["english", "spanish"];
    },
    appsCurrentGameLanguage() {
      this.calls.push({ method: "appsCurrentGameLanguage", args: [] });
      return "english";
    },
    appsCurrentBetaName() {
      this.calls.push({ method: "appsCurrentBetaName", args: [] });
      return "public";
    },
    appsEarliestPurchaseUnixTime(appId) {
      this.calls.push({ method: "appsEarliestPurchaseUnixTime", args: [appId] });
      return 1700000000;
    },
    appsDlcCount() {
      this.calls.push({ method: "appsDlcCount", args: [] });
      return 1;
    },
    appsDlcDataByIndex(index) {
      this.calls.push({ method: "appsDlcDataByIndex", args: [index] });
      return index === 0 ? { app_id: 481, available: true, name: "Soundtrack" } : null;
    },
    appsInstallDlc(appId) {
      this.calls.push({ method: "appsInstallDlc", args: [appId] });
    },
    appsUninstallDlc(appId) {
      this.calls.push({ method: "appsUninstallDlc", args: [appId] });
    },
    appsRequestAppProofOfPurchaseKey(appId) {
      this.calls.push({ method: "appsRequestAppProofOfPurchaseKey", args: [appId] });
    },
    appsRequestAllProofOfPurchaseKeys() {
      this.calls.push({ method: "appsRequestAllProofOfPurchaseKeys", args: [] });
    },
    appsMarkContentCorrupt(missingFilesOnly) {
      this.calls.push({ method: "appsMarkContentCorrupt", args: [missingFilesOnly] });
      return true;
    },
    appsInstalledDepots(appId, maxDepots) {
      this.calls.push({ method: "appsInstalledDepots", args: [appId, maxDepots] });
      return [100, 101];
    },
    appsLaunchQueryParam(key) {
      this.calls.push({ method: "appsLaunchQueryParam", args: [key] });
      return "127.0.0.1";
    },
    appsDlcDownloadProgress(appId) {
      this.calls.push({ method: "appsDlcDownloadProgress", args: [appId] });
      return appId === 481 ? { bytes_downloaded: "10", bytes_total: 20n } : null;
    },
    appsLaunchCommandLine(maxBytes) {
      this.calls.push({ method: "appsLaunchCommandLine", args: [maxBytes] });
      return "+connect 127.0.0.1";
    },
    appsIsSubscribedFromFamilySharing() {
      this.calls.push({ method: "appsIsSubscribedFromFamilySharing", args: [] });
      return true;
    },
    appsTimedTrial() {
      this.calls.push({ method: "appsTimedTrial", args: [] });
      return { seconds_allowed: 3600, seconds_played: 120 };
    },
    appsSetDlcContext(appId) {
      this.calls.push({ method: "appsSetDlcContext", args: [appId] });
      return true;
    },
    appsBetaCounts() {
      this.calls.push({ method: "appsBetaCounts", args: [] });
      return { total: 2, available: 1, private: 1 };
    },
    appsBetaInfo(index) {
      this.calls.push({ method: "appsBetaInfo", args: [index] });
      return index === 0
        ? { flags: 1, build_id: 123, name: "public", description: "Public beta", last_updated: 1700000000 }
        : null;
    },
    appsSetActiveBeta(betaName) {
      this.calls.push({ method: "appsSetActiveBeta", args: [betaName] });
      return true;
    },
    appsGetFileDetails(fileName, timeoutSeconds) {
      this.calls.push({ method: "appsGetFileDetails", args: [fileName, timeoutSeconds] });
      return Promise.resolve({ result: 1, file_size: "12345", sha, sha_hex: sha.toString("hex"), flags: 2 });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.apps.isSubscribedApp(480), true);
  assert.equal(steam.apps.isAppInstalled(480), true);
  assert.equal(steam.apps.isDlcInstalled(481), true);
  assert.equal(steam.apps.isSubscribedFromFreeWeekend(), false);
  assert.equal(steam.apps.isVacBanned(), false);
  assert.equal(steam.apps.isCybercafe(), false);
  assert.equal(steam.apps.isLowViolence(), false);
  assert.equal(steam.apps.appBuildId(), 123456);
  assert.equal(steam.apps.appInstallDir(480), "/tmp/spacewar");
  assert.deepEqual(steam.apps.appOwner(), {
    steamId64: 76561198000000001n,
    steamId32: "STEAM_0:1:19867136",
    accountId: 39734273
  });
  assert.deepEqual(steam.apps.availableGameLanguages(), ["english", "spanish"]);
  assert.equal(steam.apps.currentGameLanguage(), "english");
  assert.equal(steam.apps.currentBetaName(), "public");
  assert.equal(steam.apps.earliestPurchaseUnixTime(480), 1700000000);
  assert.equal(steam.apps.dlcCount(), 1);
  assert.deepEqual(steam.apps.dlcDataByIndex(0), { appId: 481, available: true, name: "Soundtrack" });
  assert.equal(steam.apps.dlcDataByIndex(9), null);

  steam.apps.installDlc(481);
  steam.apps.uninstallDlc(481);
  steam.apps.requestAppProofOfPurchaseKey(481);
  steam.apps.requestAllProofOfPurchaseKeys();

  assert.equal(steam.apps.markContentCorrupt(true), true);
  assert.deepEqual(steam.apps.installedDepots(480, 4), [100, 101]);
  assert.equal(steam.apps.launchQueryParam("server"), "127.0.0.1");
  assert.deepEqual(steam.apps.dlcDownloadProgress(481), { bytesDownloaded: 10n, bytesTotal: 20n });
  assert.equal(steam.apps.dlcDownloadProgress(999), null);
  assert.equal(steam.apps.launchCommandLine(512), "+connect 127.0.0.1");
  assert.equal(steam.apps.isSubscribedFromFamilySharing(), true);
  assert.deepEqual(steam.apps.timedTrial(), { secondsAllowed: 3600, secondsPlayed: 120 });
  assert.equal(steam.apps.setDlcContext(481), true);
  assert.deepEqual(steam.apps.betaCounts(), { total: 2, available: 1, private: 1 });
  assert.deepEqual(steam.apps.betaInfo(0), {
    flags: 1,
    buildId: 123,
    name: "public",
    description: "Public beta",
    lastUpdated: 1700000000
  });
  assert.equal(steam.apps.betaInfo(9), null);
  assert.equal(steam.apps.setActiveBeta("public"), true);
  assert.deepEqual(await steam.apps.getFileDetails("steam_appid.txt", 5), {
    result: 1,
    fileSize: 12345n,
    sha,
    shaHex: sha.toString("hex"),
    flags: 2
  });
  assert.deepEqual(
    fake.calls.filter((call) =>
      [
        "appsIsSubscribedApp",
        "appsIsAppInstalled",
        "appsIsDlcInstalled",
        "appsAppInstallDir",
        "appsInstalledDepots",
        "appsMarkContentCorrupt",
        "appsLaunchCommandLine",
        "appsSetActiveBeta",
        "appsGetFileDetails"
      ].includes(call.method)
    ),
    [
      { method: "appsIsSubscribedApp", args: [480] },
      { method: "appsIsAppInstalled", args: [480] },
      { method: "appsIsDlcInstalled", args: [481] },
      { method: "appsAppInstallDir", args: [480] },
      { method: "appsMarkContentCorrupt", args: [true] },
      { method: "appsInstalledDepots", args: [480, 4] },
      { method: "appsLaunchCommandLine", args: [512] },
      { method: "appsSetActiveBeta", args: ["public"] },
      { method: "appsGetFileDetails", args: ["steam_appid.txt", 5] }
    ]
  );
});

test("apps facade exposes typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const shaHex = "00112233445566778899aabbccddeeff00112233";
  const events = {};
  const handles = [
    steam.apps.onDlcInstalled((event) => {
      events.dlc = event;
    }),
    steam.apps.onNewUrlLaunchParameters((event) => {
      events.newUrl = event;
    }),
    steam.apps.onAppProofOfPurchaseKeyResponse((event) => {
      events.proofKey = event;
    }),
    steam.apps.onFileDetailsResult((event) => {
      events.fileDetails = event;
    }),
    steam.apps.onTimedTrialStatus((event) => {
      events.timedTrial = event;
    })
  ];

  fake.callbacks.get(steam.SteamCallback.DlcInstalled)({ app_id: 481 });
  fake.callbacks.get(steam.SteamCallback.NewUrlLaunchParameters)({});
  fake.callbacks.get(steam.SteamCallback.AppProofOfPurchaseKeyResponse)({
    result: 1,
    app_id: 480,
    key_length: 8,
    key: "proof-key"
  });
  fake.callbacks.get(steam.SteamCallback.FileDetailsResult)({
    result: 1,
    file_size: "12345",
    sha_hex: shaHex,
    flags: 2
  });
  fake.callbacks.get(steam.SteamCallback.TimedTrialStatus)({
    app_id: 480,
    is_offline: false,
    seconds_allowed: 3600,
    seconds_played: 120
  });

  assert.equal(events.dlc.appId, 481);
  assert.deepEqual(events.newUrl, {});
  assert.equal(events.proofKey.result, 1);
  assert.equal(events.proofKey.appId, 480);
  assert.equal(events.proofKey.keyLength, 8);
  assert.equal(events.proofKey.key, "proof-key");
  assert.equal(events.fileDetails.result, 1);
  assert.equal(events.fileDetails.fileSize, 12345n);
  assert.equal(events.fileDetails.shaHex, shaHex);
  assert.equal(events.fileDetails.flags, 2);
  assert.equal(events.timedTrial.appId, 480);
  assert.equal(events.timedTrial.isOffline, false);
  assert.equal(events.timedTrial.secondsAllowed, 3600);
  assert.equal(events.timedTrial.secondsPlayed, 120);

  for (const handle of handles) {
    handle.disconnect();
  }

  const callbackIds = [
    steam.SteamCallback.DlcInstalled,
    steam.SteamCallback.NewUrlLaunchParameters,
    steam.SteamCallback.AppProofOfPurchaseKeyResponse,
    steam.SteamCallback.FileDetailsResult,
    steam.SteamCallback.TimedTrialStatus
  ];
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback"),
    callbackIds.map((callbackId) => ({ method: "registerSteamCallback", args: [callbackId] }))
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback"),
    callbackIds.map((callbackId) => ({ method: "disconnectCallback", args: [callbackId] }))
  );
});

test("cloud facade exposes typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const events = {};
  const handles = [
    steam.cloud.onFileShareResult((event) => {
      events.fileShare = event;
    }),
    steam.cloud.onPublishFileResult((event) => {
      events.publish = event;
    }),
    steam.cloud.onDeletePublishedFileResult((event) => {
      events.delete = event;
    }),
    steam.cloud.onEnumerateUserPublishedFilesResult((event) => {
      events.userPublished = event;
    }),
    steam.cloud.onSubscribePublishedFileResult((event) => {
      events.subscribe = event;
    }),
    steam.cloud.onEnumerateUserSubscribedFilesResult((event) => {
      events.subscribed = event;
    }),
    steam.cloud.onUnsubscribePublishedFileResult((event) => {
      events.unsubscribe = event;
    }),
    steam.cloud.onUpdatePublishedFileResult((event) => {
      events.update = event;
    }),
    steam.cloud.onDownloadUgcResult((event) => {
      events.download = event;
    }),
    steam.cloud.onGetPublishedFileDetailsResult((event) => {
      events.details = event;
    }),
    steam.cloud.onEnumerateWorkshopFilesResult((event) => {
      events.workshop = event;
    }),
    steam.cloud.onGetPublishedItemVoteDetailsResult((event) => {
      events.voteDetails = event;
    }),
    steam.cloud.onPublishedFileSubscribed((event) => {
      events.publishedSubscribed = event;
    }),
    steam.cloud.onPublishedFileUnsubscribed((event) => {
      events.publishedUnsubscribed = event;
    }),
    steam.cloud.onPublishedFileDeleted((event) => {
      events.publishedDeleted = event;
    }),
    steam.cloud.onUpdateUserPublishedItemVoteResult((event) => {
      events.updateVote = event;
    }),
    steam.cloud.onUserVoteDetails((event) => {
      events.userVote = event;
    }),
    steam.cloud.onEnumerateUserSharedWorkshopFilesResult((event) => {
      events.shared = event;
    }),
    steam.cloud.onSetUserPublishedFileActionResult((event) => {
      events.action = event;
    }),
    steam.cloud.onEnumeratePublishedFilesByUserActionResult((event) => {
      events.userAction = event;
    }),
    steam.cloud.onPublishFileProgress((event) => {
      events.progress = event;
    }),
    steam.cloud.onPublishedFileUpdated((event) => {
      events.publishedUpdated = event;
    }),
    steam.cloud.onFileWriteAsyncComplete((event) => {
      events.writeAsync = event;
    }),
    steam.cloud.onFileReadAsyncComplete((event) => {
      events.readAsync = event;
    }),
    steam.cloud.onLocalFileChange((event) => {
      events.localChange = event;
    })
  ];

  fake.callbacks.get(steam.SteamCallback.RemoteStorageFileShareResult)({
    result: 1,
    file: "555",
    name: "save.dat"
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStoragePublishFileResult)({
    result: 1,
    published_file_id: "1001",
    needs_to_accept_agreement: true
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageDeletePublishedFileResult)({
    result: 1,
    published_file_id: "1001"
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageEnumerateUserPublishedFilesResult)({
    result: 1,
    returned_results: 2,
    total_result_count: 3,
    published_file_ids: ["1001", "1002"]
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageSubscribePublishedFileResult)({
    result: 1,
    published_file_id: "1001"
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageEnumerateUserSubscribedFilesResult)({
    result: 1,
    returned_results: 2,
    total_result_count: 4,
    published_file_ids: ["1001", "1002"],
    subscribed_times: [11, 22]
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageUnsubscribePublishedFileResult)({
    result: 1,
    published_file_id: "1002"
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageUpdatePublishedFileResult)({
    result: 1,
    published_file_id: "1001",
    needs_to_accept_agreement: false
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageDownloadUGCResult)({
    result: 1,
    file: "777",
    app_id: 480,
    size: "4096",
    name: "shared.dat",
    owner: "76561198000000030"
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageGetPublishedFileDetailsResult)({
    result: 1,
    published_file_id: "1001",
    creator_app_id: 480,
    consumer_app_id: 480,
    title: "SpaceWar Save",
    description: "A shared save",
    file: "888",
    preview_file: "889",
    owner: "76561198000000030",
    time_created: 1700000000,
    time_updated: 1700000100,
    visibility: 0,
    banned: false,
    tags: "spacewar,save",
    tags_truncated: false,
    file_name: "save.dat",
    file_size: "1024",
    preview_file_size: "256",
    url: "https://example.invalid/save.dat",
    file_type: 2,
    accepted_for_use: true
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageEnumerateWorkshopFilesResult)({
    result: 1,
    returned_results: 1,
    total_result_count: 1,
    published_file_ids: ["1001"],
    scores: [0.5],
    app_id: 480,
    start_index: 0
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageGetPublishedItemVoteDetailsResult)({
    result: 1,
    published_file_id: "1001",
    votes_for: 9,
    votes_against: 1,
    reports: 0,
    score: 0.9
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStoragePublishedFileSubscribed)({
    published_file_id: "1001",
    app_id: 480
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStoragePublishedFileUnsubscribed)({
    published_file_id: "1002",
    app_id: 480
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStoragePublishedFileDeleted)({
    published_file_id: "1003",
    app_id: 480
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageUpdateUserPublishedItemVoteResult)({
    result: 1,
    published_file_id: "1001"
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageUserVoteDetails)({
    result: 1,
    published_file_id: "1001",
    vote: 1
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageEnumerateUserSharedWorkshopFilesResult)({
    result: 1,
    returned_results: 1,
    total_result_count: 1,
    published_file_ids: ["1001"]
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageSetUserPublishedFileActionResult)({
    result: 1,
    published_file_id: "1001",
    action: 2
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageEnumeratePublishedFilesByUserActionResult)({
    result: 1,
    action: 2,
    returned_results: 1,
    total_result_count: 1,
    published_file_ids: ["1001"],
    updated_times: [1700000100]
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStoragePublishFileProgress)({
    percent_file: 42.5,
    preview: true
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStoragePublishedFileUpdated)({
    published_file_id: "1001",
    app_id: 480,
    unused: "12345"
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageFileWriteAsyncComplete)({ result: 1 });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageFileReadAsyncComplete)({
    async_call: "12345678901234567890",
    result: 1,
    offset: 8,
    bytes_read: 16
  });
  fake.callbacks.get(steam.SteamCallback.RemoteStorageLocalFileChange)({});

  assert.equal(events.fileShare.file, 555n);
  assert.equal(events.fileShare.name, "save.dat");
  assert.equal(events.publish.publishedFileId, 1001n);
  assert.equal(events.publish.needsToAcceptAgreement, true);
  assert.equal(events.delete.publishedFileId, 1001n);
  assert.deepEqual(events.userPublished.publishedFileIds, [1001n, 1002n]);
  assert.equal(events.userPublished.totalResultCount, 3);
  assert.equal(events.subscribe.publishedFileId, 1001n);
  assert.deepEqual(events.subscribed.subscribedTimes, [11, 22]);
  assert.equal(events.unsubscribe.publishedFileId, 1002n);
  assert.equal(events.update.needsToAcceptAgreement, false);
  assert.equal(events.download.file, 777n);
  assert.equal(events.download.appId, 480);
  assert.equal(events.download.size, 4096n);
  assert.equal(events.download.owner, 76561198000000030n);
  assert.equal(events.details.creatorAppId, 480);
  assert.equal(events.details.consumerAppId, 480);
  assert.equal(events.details.previewFile, 889n);
  assert.equal(events.details.owner, 76561198000000030n);
  assert.deepEqual(events.details.tags, ["spacewar", "save"]);
  assert.equal(events.details.tagsTruncated, false);
  assert.equal(events.details.fileName, "save.dat");
  assert.equal(events.details.fileSize, 1024n);
  assert.equal(events.details.previewFileSize, 256n);
  assert.equal(events.details.acceptedForUse, true);
  assert.deepEqual(events.workshop.publishedFileIds, [1001n]);
  assert.equal(events.workshop.startIndex, 0);
  assert.equal(events.voteDetails.votesFor, 9);
  assert.equal(events.voteDetails.votesAgainst, 1);
  assert.equal(events.publishedSubscribed.appId, 480);
  assert.equal(events.publishedUnsubscribed.publishedFileId, 1002n);
  assert.equal(events.publishedDeleted.publishedFileId, 1003n);
  assert.equal(events.updateVote.publishedFileId, 1001n);
  assert.equal(events.userVote.vote, 1);
  assert.deepEqual(events.shared.publishedFileIds, [1001n]);
  assert.equal(events.action.action, 2);
  assert.deepEqual(events.userAction.updatedTimes, [1700000100]);
  assert.equal(events.progress.percentFile, 42.5);
  assert.equal(events.progress.preview, true);
  assert.equal(events.publishedUpdated.unused, 12345n);
  assert.equal(events.writeAsync.result, 1);
  assert.equal(events.readAsync.asyncCall, 12345678901234567890n);
  assert.equal(events.readAsync.bytesRead, 16);
  assert.deepEqual(events.localChange, {});

  for (const handle of handles) {
    handle.disconnect();
  }

  const callbackIds = [
    steam.SteamCallback.RemoteStorageFileShareResult,
    steam.SteamCallback.RemoteStoragePublishFileResult,
    steam.SteamCallback.RemoteStorageDeletePublishedFileResult,
    steam.SteamCallback.RemoteStorageEnumerateUserPublishedFilesResult,
    steam.SteamCallback.RemoteStorageSubscribePublishedFileResult,
    steam.SteamCallback.RemoteStorageEnumerateUserSubscribedFilesResult,
    steam.SteamCallback.RemoteStorageUnsubscribePublishedFileResult,
    steam.SteamCallback.RemoteStorageUpdatePublishedFileResult,
    steam.SteamCallback.RemoteStorageDownloadUGCResult,
    steam.SteamCallback.RemoteStorageGetPublishedFileDetailsResult,
    steam.SteamCallback.RemoteStorageEnumerateWorkshopFilesResult,
    steam.SteamCallback.RemoteStorageGetPublishedItemVoteDetailsResult,
    steam.SteamCallback.RemoteStoragePublishedFileSubscribed,
    steam.SteamCallback.RemoteStoragePublishedFileUnsubscribed,
    steam.SteamCallback.RemoteStoragePublishedFileDeleted,
    steam.SteamCallback.RemoteStorageUpdateUserPublishedItemVoteResult,
    steam.SteamCallback.RemoteStorageUserVoteDetails,
    steam.SteamCallback.RemoteStorageEnumerateUserSharedWorkshopFilesResult,
    steam.SteamCallback.RemoteStorageSetUserPublishedFileActionResult,
    steam.SteamCallback.RemoteStorageEnumeratePublishedFilesByUserActionResult,
    steam.SteamCallback.RemoteStoragePublishFileProgress,
    steam.SteamCallback.RemoteStoragePublishedFileUpdated,
    steam.SteamCallback.RemoteStorageFileWriteAsyncComplete,
    steam.SteamCallback.RemoteStorageFileReadAsyncComplete,
    steam.SteamCallback.RemoteStorageLocalFileChange
  ];
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback"),
    callbackIds.map((callbackId) => ({ method: "registerSteamCallback", args: [callbackId] }))
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback"),
    callbackIds.map((callbackId) => ({ method: "disconnectCallback", args: [callbackId] }))
  );
});

test("cloud, input, and networking facades coerce native values", async (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const files = steam.cloud.listFiles();
  assert.equal(files[0].name, "save.dat");
  assert.equal(files[0].size, 1024n);
  assert.equal(files[1].size, 2048n);
  assert.equal(steam.cloud.RemoteStoragePlatform.OSX, 2);
  assert.equal(steam.cloud.RemoteStorageLocalFileChange.FileUpdated, 1);
  assert.equal(steam.cloud.RemoteStorageFilePathType.APIFilename, 2);
  assert.equal(steam.cloud.isEnabledForAccount(), true);
  assert.equal(steam.cloud.isEnabledForApp(), false);
  assert.equal(steam.cloud.setEnabledForApp(true), undefined);
  assert.equal(steam.cloud.deleteFile("old-save.dat"), true);
  assert.equal(steam.cloud.fileExists("save.dat"), true);
  assert.equal(steam.cloud.filePersisted("save.dat"), true);
  assert.equal(steam.cloud.forgetFile("save.dat"), true);
  assert.equal(steam.cloud.getFileSize("save.dat"), 1024n);
  assert.equal(steam.cloud.getFileSize("missing.dat"), null);
  assert.equal(steam.cloud.getFileTimestamp("save.dat"), 1700000000n);
  assert.equal(steam.cloud.getSyncPlatforms("save.dat"), 10);
  assert.equal(steam.cloud.setSyncPlatforms("save.dat", steam.cloud.RemoteStoragePlatform.OSX), true);
  assert.deepEqual(steam.cloud.getQuota(), { totalBytes: 100000n, availableBytes: 64000n });
  assert.equal(steam.cloud.getLocalFileChangeCount(), 1);
  assert.deepEqual(steam.cloud.getLocalFileChange(0), { name: "save.dat", changeType: 1, pathType: 2 });
  assert.equal(steam.cloud.getLocalFileChange(1), null);
  assert.deepEqual(steam.cloud.getLocalFileChanges(), [{ name: "save.dat", changeType: 1, pathType: 2 }]);
  assert.equal(steam.cloud.beginFileWriteBatch(), true);
  assert.equal(steam.cloud.endFileWriteBatch(), true);
  assert.equal(steam.cloud.UGCReadAction.Close, 2);
  assert.equal(await steam.cloud.writeFileAsync("save.dat", new Uint8Array([1, 2]), 9), 1);
  assert.deepEqual(await steam.cloud.readFileAsync("save.dat", 1, 4, 9), Buffer.from("async-save"));
  assert.deepEqual(await steam.cloud.shareFile("save.dat", 9), { result: 1, file: 555n, name: "save.dat" });
  const stream = steam.cloud.openFileWriteStream("stream.dat");
  assert.equal(stream, 987n);
  assert.equal(steam.cloud.writeFileStreamChunk(stream, "chunk"), true);
  assert.equal(steam.cloud.closeFileWriteStream(stream), true);
  assert.equal(steam.cloud.cancelFileWriteStream(stream), true);
  const download = await steam.cloud.downloadUgc(555n, 10, 9);
  assert.equal(download.file, 555n);
  assert.equal(download.appId, 480);
  assert.equal(download.size, 10n);
  assert.equal(download.owner.steamId64, 76561198000000030n);
  assert.deepEqual(await steam.cloud.downloadUgcToLocation(555n, "/tmp/shared.dat"), download);
  assert.deepEqual(steam.cloud.getUgcDownloadProgress(555n), { downloadedBytes: 4n, expectedBytes: 10n });
  const ugcDetails = steam.cloud.getUgcDetails(555n);
  assert.equal(ugcDetails.appId, 480);
  assert.equal(ugcDetails.owner.steamId64, 76561198000000030n);
  assert.deepEqual(steam.cloud.readUgc(555n, 3, 0, steam.cloud.UGCReadAction.Close), Buffer.from("ugc"));
  assert.equal(steam.cloud.getCachedUgcCount(), 2);
  assert.equal(steam.cloud.getCachedUgcHandle(0), 555n);
  assert.equal(steam.cloud.getCachedUgcHandle(1), null);
  assert.deepEqual(steam.cloud.getCachedUgcHandles(), [555n, 666n]);
  assert.deepEqual(fake.calls.find((call) => call.method === "cloudSetSyncPlatforms"), {
    method: "cloudSetSyncPlatforms",
    args: ["save.dat", 2]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "cloudSetEnabledForApp"), {
    method: "cloudSetEnabledForApp",
    args: [true]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "cloudDeleteFile"), {
    method: "cloudDeleteFile",
    args: ["old-save.dat"]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "cloudFileExists"), {
    method: "cloudFileExists",
    args: ["save.dat"]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "cloudWriteFileAsync"), {
    method: "cloudWriteFileAsync",
    args: ["save.dat", Buffer.from([1, 2]), 9]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "cloudDownloadUgcToLocation"), {
    method: "cloudDownloadUgcToLocation",
    args: [555n, "/tmp/shared.dat", undefined, undefined]
  });

  assert.equal(steam.input.init(), undefined);
  const controllers = steam.input.getControllers();
  assert.equal(controllers[0].getHandle(), 123n);
  assert.equal(controllers[0].getType(), steam.InputType.PS5Controller);
  assert.equal(controllers[1].getType(), steam.InputType.Unknown);
  assert.equal(steam.input.STEAM_INPUT_HANDLE_ALL_CONTROLLERS, 18446744073709551615n);
  assert.equal(steam.input.STEAM_INPUT_MAX_COUNT, 16);
  assert.equal(steam.input.InputActionEventType.DigitalAction, 0);
  assert.equal(steam.input.InputActionEventType.AnalogAction, 1);
  assert.equal(steam.input.InputGlyphSize.Medium, 1);
  assert.equal(steam.input.InputHapticLocation.Both, 3);
  assert.equal(steam.input.XboxOrigin.A, 0);
  steam.input.runFrame(true);
  assert.equal(steam.input.waitForData(false, 16), true);
  assert.equal(steam.input.newDataAvailable(), true);
  steam.input.enableDeviceCallbacks();
  const inputDeviceConnectedEvents = [];
  const inputDeviceDisconnectedEvents = [];
  const inputConfigurationLoadedEvents = [];
  const inputGamepadSlotChangeEvents = [];
  const inputDeviceConnectedHandle = steam.input.onDeviceConnected((event) => inputDeviceConnectedEvents.push(event));
  const inputDeviceDisconnectedHandle = steam.input.onDeviceDisconnected((event) => {
    inputDeviceDisconnectedEvents.push(event);
  });
  const inputConfigurationLoadedHandle = steam.input.onConfigurationLoaded((event) => {
    inputConfigurationLoadedEvents.push(event);
  });
  const inputGamepadSlotChangeHandle = steam.input.onGamepadSlotChange((event) => {
    inputGamepadSlotChangeEvents.push(event);
  });
  fake.callbacks.get(steam.SteamCallback.SteamInputDeviceConnected)({ connected_device_handle: "123" });
  fake.callbacks.get(steam.SteamCallback.SteamInputDeviceDisconnected)({ disconnected_device_handle: "124" });
  fake.callbacks.get(steam.SteamCallback.SteamInputConfigurationLoaded)({
    app_id: 480,
    device_handle: "123",
    mapping_creator: "76561198000000000",
    major_revision: 1,
    minor_revision: 2,
    uses_steam_input_api: true,
    uses_gamepad_api: false
  });
  fake.callbacks.get(steam.SteamCallback.SteamInputGamepadSlotChange)({
    app_id: 480,
    device_handle: "123",
    device_type: steam.input.InputType.PS5Controller,
    old_gamepad_slot: 0,
    new_gamepad_slot: 1
  });
  assert.deepEqual(inputDeviceConnectedEvents, [
    { connected_device_handle: 123n, connectedDeviceHandle: 123n }
  ]);
  assert.deepEqual(inputDeviceDisconnectedEvents, [
    { disconnected_device_handle: 124n, disconnectedDeviceHandle: 124n }
  ]);
  assert.deepEqual(inputConfigurationLoadedEvents, [
    {
      app_id: 480,
      device_handle: 123n,
      mapping_creator: 76561198000000000n,
      major_revision: 1,
      minor_revision: 2,
      uses_steam_input_api: true,
      uses_gamepad_api: false,
      appId: 480,
      deviceHandle: 123n,
      mappingCreator: 76561198000000000n,
      majorRevision: 1,
      minorRevision: 2,
      usesSteamInputApi: true,
      usesGamepadApi: false
    }
  ]);
  assert.deepEqual(inputGamepadSlotChangeEvents, [
    {
      app_id: 480,
      device_handle: 123n,
      device_type: steam.input.InputType.PS5Controller,
      old_gamepad_slot: 0,
      new_gamepad_slot: 1,
      appId: 480,
      deviceHandle: 123n,
      deviceType: steam.input.InputType.PS5Controller,
      oldGamepadSlot: 0,
      newGamepadSlot: 1
    }
  ]);
  inputDeviceConnectedHandle.disconnect();
  inputDeviceDisconnectedHandle.disconnect();
  inputConfigurationLoadedHandle.disconnect();
  inputGamepadSlotChangeHandle.disconnect();
  const actionEvents = [];
  const actionEventHandle = steam.input.registerActionEventCallback((event) => actionEvents.push(event));
  actionEventHandle.disconnect();
  assert.deepEqual(actionEvents, [
    {
      controllerHandle: 123n,
      eventType: steam.input.InputActionEventType.DigitalAction,
      analogActionHandle: undefined,
      analogActionData: undefined,
      digitalActionHandle: 20n,
      digitalActionData: { state: true, active: true }
    }
  ]);
  assert.equal(steam.input.setActionManifestFilePath("/tmp/actions.json"), true);
  assert.equal(steam.input.getControllerForGamepadIndex(0)?.getHandle(), 123n);
  assert.equal(steam.input.getControllerForGamepadIndex(1), null);
  const actionSet = steam.input.getActionSet("gameplay");
  const digitalAction = steam.input.getDigitalAction("jump");
  const analogAction = steam.input.getAnalogAction("move");
  assert.equal(actionSet, 10n);
  assert.equal(digitalAction, 20n);
  assert.equal(analogAction, 30n);
  assert.deepEqual(steam.input.getDigitalActionStateByName(controllers[0], "gameplay", "jump"), {
    state: true,
    active: true
  });
  assert.deepEqual(fake.calls.slice(-4), [
    { method: "inputGetActionSet", args: ["gameplay"] },
    { method: "inputActivateActionSet", args: [123n, 10n] },
    { method: "inputGetDigitalAction", args: ["jump"] },
    { method: "inputGetDigitalActionData", args: [123n, 20n] }
  ]);
  assert.equal(steam.input.getStringForDigitalActionName(digitalAction), "jump");
  assert.equal(steam.input.getStringForAnalogActionName(analogAction), "move");
  assert.equal(steam.input.getGlyphPngForActionOrigin(1), "/glyph.png");
  assert.equal(steam.input.getGlyphSvgForActionOrigin(1, steam.input.InputGlyphStyle.Light), "/glyph.svg");
  assert.equal(steam.input.getLegacyGlyphForActionOrigin(1), "legacy");
  assert.equal(steam.input.getStringForActionOrigin(1), "A");
  assert.equal(steam.input.getStringForXboxOrigin(steam.input.XboxOrigin.A), "A");
  assert.equal(steam.input.getGlyphForXboxOrigin(steam.input.XboxOrigin.A), "xbox-a");
  assert.equal(steam.input.getActionOriginFromXboxOrigin(controllers[0], steam.input.XboxOrigin.A), 1);
  assert.equal(steam.input.translateActionOrigin(steam.input.InputTypeCode.PS4Controller, 1), 50);
  assert.equal(steam.input.getSessionInputConfigurationSettings(), 3);
  controllers[0].activateActionSet(actionSet);
  assert.equal(controllers[0].getCurrentActionSet(), 10n);
  controllers[0].activateActionSetLayer(11n);
  controllers[0].deactivateActionSetLayer(11n);
  controllers[0].deactivateAllActionSetLayers();
  assert.deepEqual(controllers[0].getActiveActionSetLayers(), [11n, 12n]);
  assert.deepEqual(controllers[0].getDigitalActionData(digitalAction), { state: true, active: true });
  assert.equal(controllers[0].isDigitalActionPressed(digitalAction), true);
  assert.deepEqual(controllers[0].getDigitalActionOrigins(actionSet, digitalAction), [1, 2]);
  assert.deepEqual(controllers[0].getAnalogActionData(analogAction), { mode: 1, x: 0.25, y: -0.5, active: true });
  assert.deepEqual(controllers[0].getAnalogActionVector(analogAction), { x: 0.25, y: -0.5 });
  assert.deepEqual(controllers[0].getAnalogActionOrigins(actionSet, analogAction), [3, 4]);
  controllers[0].stopAnalogActionMomentum(analogAction);
  assert.equal(controllers[0].getMotionData().rotationVelocityZ, 6);
  controllers[0].triggerVibration(100, 200);
  controllers[0].triggerVibrationExtended(100, 200, 300, 400);
  const dualSenseEffect = Buffer.alloc(120, 1);
  controllers[0].setDualSenseTriggerEffect(dualSenseEffect);
  controllers[0].setDualSenseTriggerEffect(null);
  controllers[0].triggerSimpleHapticEvent(steam.input.InputHapticLocation.Both, 10, -2, 5, -1);
  controllers[0].setLedColor(1, 2, 3);
  controllers[0].legacyTriggerHapticPulse(steam.input.SteamControllerPad.Left, 1000);
  controllers[0].legacyTriggerRepeatedHapticPulse(steam.input.SteamControllerPad.Right, 1000, 2000, 3);
  assert.equal(controllers[0].showBindingPanel(), true);
  assert.equal(controllers[0].getGamepadIndex(), 0);
  assert.deepEqual(controllers[0].getDeviceBindingRevision(), { major: 1, minor: 2 });
  assert.equal(controllers[0].getRemotePlaySessionId(), 42);
  assert.deepEqual(fake.calls.find((call) => call.method === "inputSetLedColor"), {
    method: "inputSetLedColor",
    args: [123n, 1, 2, 3, steam.input.InputLedFlag.SetColor]
  });
  assert.deepEqual(fake.calls.filter((call) => call.method === "inputSetDualSenseTriggerEffect"), [
    { method: "inputSetDualSenseTriggerEffect", args: [123n, dualSenseEffect] },
    { method: "inputSetDualSenseTriggerEffect", args: [123n, undefined] }
  ]);
  assert.equal(steam.input.shutdown(), undefined);
  assert.deepEqual(fake.calls.find((call) => call.method === "inputInit"), {
    method: "inputInit",
    args: []
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "inputShutdown"), {
    method: "inputShutdown",
    args: []
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "disconnectInputActionEventCallback"), {
    method: "disconnectInputActionEventCallback",
    args: []
  });
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback" && call.args[0] >= 2801 && call.args[0] <= 2804),
    [
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamInputDeviceConnected] },
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamInputDeviceDisconnected] },
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamInputConfigurationLoaded] },
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamInputGamepadSlotChange] }
    ]
  );

  assert.equal(steam.controller.init(), true);
  steam.controller.runFrame();
  const legacyControllers = steam.controller.getControllers();
  assert.equal(legacyControllers[0].getHandle(), 789n);
  assert.equal(legacyControllers[0].getType(), steam.InputType.SteamController);
  assert.equal(steam.controller.getControllerForGamepadIndex(0)?.getHandle(), 789n);
  assert.equal(steam.controller.getControllerForGamepadIndex(1), null);
  const legacyActionSet = steam.controller.getActionSet("legacy-gameplay");
  const legacyDigitalAction = steam.controller.getDigitalAction("legacy-jump");
  const legacyAnalogAction = steam.controller.getAnalogAction("legacy-move");
  assert.equal(legacyActionSet, 110n);
  assert.equal(legacyDigitalAction, 120n);
  assert.equal(legacyAnalogAction, 130n);
  assert.equal(steam.controller.getGlyphForActionOrigin(5), "legacy-glyph");
  assert.equal(steam.controller.getStringForActionOrigin(5), "Legacy A");
  assert.equal(steam.controller.getStringForXboxOrigin(steam.controller.XboxOrigin.A), "legacy A");
  assert.equal(steam.controller.getGlyphForXboxOrigin(steam.controller.XboxOrigin.A), "legacy-xbox-a");
  assert.equal(steam.controller.getActionOriginFromXboxOrigin(legacyControllers[0], steam.controller.XboxOrigin.A), 9);
  assert.equal(steam.controller.translateActionOrigin(steam.controller.InputTypeCode.PS4Controller, 5), 51);
  legacyControllers[0].activateActionSet(legacyActionSet);
  assert.equal(legacyControllers[0].getCurrentActionSet(), 110n);
  legacyControllers[0].activateActionSetLayer(111n);
  legacyControllers[0].deactivateActionSetLayer(111n);
  legacyControllers[0].deactivateAllActionSetLayers();
  assert.deepEqual(legacyControllers[0].getActiveActionSetLayers(), [111n, 112n]);
  assert.deepEqual(legacyControllers[0].getDigitalActionData(legacyDigitalAction), { state: true, active: true });
  assert.equal(legacyControllers[0].isDigitalActionPressed(legacyDigitalAction), true);
  assert.deepEqual(legacyControllers[0].getDigitalActionOrigins(legacyActionSet, legacyDigitalAction), [5, 6]);
  assert.deepEqual(legacyControllers[0].getAnalogActionData(legacyAnalogAction), {
    mode: 2,
    x: 0.5,
    y: -0.25,
    active: true
  });
  assert.deepEqual(legacyControllers[0].getAnalogActionVector(legacyAnalogAction), { x: 0.5, y: -0.25 });
  assert.deepEqual(legacyControllers[0].getAnalogActionOrigins(legacyActionSet, legacyAnalogAction), [7, 8]);
  legacyControllers[0].stopAnalogActionMomentum(legacyAnalogAction);
  assert.equal(legacyControllers[0].getMotionData().rotationVelocityZ, 12);
  legacyControllers[0].triggerHapticPulse(steam.controller.SteamControllerPad.Left, 1000);
  legacyControllers[0].triggerRepeatedHapticPulse(steam.controller.SteamControllerPad.Right, 1000, 2000, 3);
  legacyControllers[0].triggerVibration(100, 200);
  legacyControllers[0].setLedColor(4, 5, 6);
  assert.equal(legacyControllers[0].showBindingPanel(), true);
  assert.equal(legacyControllers[0].getGamepadIndex(), 1);
  assert.deepEqual(legacyControllers[0].getControllerBindingRevision(), { major: 3, minor: 4 });
  assert.equal(steam.controller.shutdown(), true);
  assert.deepEqual(fake.calls.find((call) => call.method === "controllerSetLedColor"), {
    method: "controllerSetLedColor",
    args: [789n, 4, 5, 6, steam.controller.InputLedFlag.SetColor]
  });

  const packet = steam.networking.readP2PPacket(64);
  assert.deepEqual(packet.data, Buffer.from("hello"));
  assert.equal(packet.steamId.steamId64, 76561198000000001n);
});

test("cloud legacy facade covers published file workflows", async (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const itemId = 12345678901234567890n;
  assert.equal(steam.cloud.legacy.WorkshopFileType.Community, 0);
  assert.equal(steam.cloud.legacy.WorkshopFileAction.Completed, 1);
  assert.equal(steam.cloud.legacy.WorkshopEnumerationType.Trending, 2);
  assert.equal(steam.cloud.legacy.WorkshopVideoProvider.YouTube, 1);
  assert.equal(steam.cloud.legacy.WorkshopVote.For, 1);

  assert.deepEqual(
    await steam.cloud.legacy.publishWorkshopFile(
      {
        filePath: "/tmp/content",
        previewPath: "/tmp/preview.png",
        consumerAppId: 480,
        title: "Legacy Item",
        description: "Legacy description",
        tags: ["save"],
        visibility: steam.cloud.legacy.PublishedFileVisibility.Public
      },
      9
    ),
    { result: 1, publishedFileId: itemId, needsToAcceptAgreement: true }
  );
  assert.deepEqual(
    await steam.cloud.legacy.publishVideo(
      {
        videoAccount: "channel",
        videoIdentifier: "video-id",
        previewPath: "/tmp/video.png",
        consumerAppId: 480,
        title: "Legacy Video",
        description: "Video description"
      },
      9
    ),
    { result: 1, publishedFileId: itemId, needsToAcceptAgreement: false }
  );

  const updateHandle = steam.cloud.legacy.createPublishedFileUpdateRequest(itemId);
  assert.equal(updateHandle, 999n);
  assert.equal(steam.cloud.legacy.updatePublishedFileFile(updateHandle, "/tmp/content"), true);
  assert.equal(steam.cloud.legacy.updatePublishedFilePreviewFile(updateHandle, "/tmp/preview.png"), true);
  assert.equal(steam.cloud.legacy.updatePublishedFileTitle(updateHandle, "Title"), true);
  assert.equal(steam.cloud.legacy.updatePublishedFileDescription(updateHandle, "Description"), true);
  assert.equal(
    steam.cloud.legacy.updatePublishedFileVisibility(updateHandle, steam.cloud.legacy.PublishedFileVisibility.Unlisted),
    true
  );
  assert.equal(steam.cloud.legacy.updatePublishedFileTags(updateHandle, ["save", "legacy"]), true);
  assert.equal(steam.cloud.legacy.updatePublishedFileSetChangeDescription(updateHandle, "Changes"), true);
  assert.deepEqual(await steam.cloud.legacy.commitPublishedFileUpdate(updateHandle, 9), {
    result: 1,
    publishedFileId: itemId,
    needsToAcceptAgreement: false
  });

  const details = await steam.cloud.legacy.getPublishedFileDetails(itemId, 60, 9);
  assert.equal(details.publishedFileId, itemId);
  assert.equal(details.creatorAppId, 480);
  assert.equal(details.file, 555n);
  assert.equal(details.previewFile, 556n);
  assert.equal(details.owner.steamId64, 76561198000000030n);
  assert.deepEqual(details.tags, ["save", "legacy"]);
  assert.equal(details.fileSize, 1024n);
  assert.equal(details.previewFileSize, 256n);
  assert.equal(details.acceptedForUse, true);

  assert.deepEqual(await steam.cloud.legacy.deletePublishedFile(itemId, 9), { result: 1, publishedFileId: itemId });
  assert.deepEqual(await steam.cloud.legacy.enumerateUserPublishedFiles(0, 9), {
    result: 1,
    returnedResults: 1,
    totalResultCount: 2,
    publishedFileIds: [itemId]
  });
  assert.deepEqual(await steam.cloud.legacy.subscribePublishedFile(itemId, 9), { result: 1, publishedFileId: itemId });
  assert.deepEqual(await steam.cloud.legacy.enumerateUserSubscribedFiles(0, 9), {
    result: 1,
    returnedResults: 1,
    totalResultCount: 1,
    publishedFileIds: [itemId],
    subscribedTimes: [1700000200]
  });
  assert.deepEqual(await steam.cloud.legacy.unsubscribePublishedFile(itemId, 9), {
    result: 1,
    publishedFileId: itemId
  });
  assert.deepEqual(await steam.cloud.legacy.getPublishedItemVoteDetails(itemId, 9), {
    result: 1,
    publishedFileId: itemId,
    votesFor: 10,
    votesAgainst: 2,
    reports: 1,
    score: 0.9
  });
  assert.deepEqual(await steam.cloud.legacy.updateUserPublishedItemVote(itemId, true, 9), {
    result: 1,
    publishedFileId: itemId
  });
  assert.deepEqual(await steam.cloud.legacy.getUserPublishedItemVoteDetails(itemId, 9), {
    result: 1,
    publishedFileId: itemId,
    vote: steam.cloud.legacy.WorkshopVote.For
  });
  assert.deepEqual(
    await steam.cloud.legacy.enumerateUserSharedWorkshopFiles(
      76561198000000030n,
      0,
      { requiredTags: ["save"], excludedTags: ["spoiler"] },
      9
    ),
    { result: 1, returnedResults: 1, totalResultCount: 1, publishedFileIds: [itemId] }
  );
  assert.deepEqual(
    await steam.cloud.legacy.setUserPublishedFileAction(itemId, steam.cloud.legacy.WorkshopFileAction.Completed, 9),
    { result: 1, publishedFileId: itemId, action: 1 }
  );
  assert.deepEqual(
    await steam.cloud.legacy.enumeratePublishedFilesByUserAction(steam.cloud.legacy.WorkshopFileAction.Completed, 0, 9),
    {
      result: 1,
      action: 1,
      returnedResults: 1,
      totalResultCount: 1,
      publishedFileIds: [itemId],
      updatedTimes: [1700000300]
    }
  );
  assert.deepEqual(
    await steam.cloud.legacy.enumeratePublishedWorkshopFiles(
      steam.cloud.legacy.WorkshopEnumerationType.Trending,
      0,
      10,
      7,
      { tags: ["save"], userTags: ["played"] },
      9
    ),
    {
      result: 1,
      returnedResults: 1,
      totalResultCount: 1,
      publishedFileIds: [itemId],
      scores: [0.75],
      appId: 480,
      startIndex: 0
    }
  );

  assert.deepEqual(fake.calls.find((call) => call.method === "cloudLegacyPublishWorkshopFile"), {
    method: "cloudLegacyPublishWorkshopFile",
    args: ["/tmp/content", "/tmp/preview.png", 480, "Legacy Item", "Legacy description", 0, ["save"], 0, 9]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "cloudLegacyPublishVideo"), {
    method: "cloudLegacyPublishVideo",
    args: [1, "channel", "video-id", "/tmp/video.png", 480, "Legacy Video", "Video description", 0, [], 9]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "cloudLegacyEnumerateUserSharedWorkshopFiles"), {
    method: "cloudLegacyEnumerateUserSharedWorkshopFiles",
    args: [76561198000000030n, 0, ["save"], ["spoiler"], 9]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "cloudLegacyEnumeratePublishedWorkshopFiles"), {
    method: "cloudLegacyEnumeratePublishedWorkshopFiles",
    args: [2, 0, 10, 7, ["save"], ["played"], 9]
  });
});

test("legacy networking facade covers P2P sessions and socket helpers", (t) => {
  const peer = 76561198000000010n;
  const fake = createFakeNative({
    networkingSendP2PPacket(steamId64, sendType, data) {
      this.calls.push({ method: "networkingSendP2PPacket", args: [steamId64, sendType, data] });
      return true;
    },
    networkingIsP2PPacketAvailable() {
      this.calls.push({ method: "networkingIsP2PPacketAvailable", args: [] });
      return 5;
    },
    networkingAcceptP2PSession(steamId64) {
      this.calls.push({ method: "networkingAcceptP2PSession", args: [steamId64] });
    },
    networkingCloseP2PSession(steamId64) {
      this.calls.push({ method: "networkingCloseP2PSession", args: [steamId64] });
      return true;
    },
    networkingCloseP2PChannel(steamId64, channel) {
      this.calls.push({ method: "networkingCloseP2PChannel", args: [steamId64, channel] });
      return true;
    },
    networkingGetP2PSessionState(steamId64) {
      this.calls.push({ method: "networkingGetP2PSessionState", args: [steamId64] });
      return {
        connection_active: true,
        connecting: false,
        session_error: 0,
        using_relay: true,
        bytes_queued_for_send: 128,
        packets_queued_for_send: 3,
        remote_ip: 2130706433,
        remote_ip_address: "127.0.0.1",
        remote_port: 27015
      };
    },
    networkingAllowP2PPacketRelay(allow) {
      this.calls.push({ method: "networkingAllowP2PPacketRelay", args: [allow] });
      return true;
    },
    networkingCreateListenSocket(virtualP2PPort, ip, port, allowPacketRelay) {
      this.calls.push({ method: "networkingCreateListenSocket", args: [virtualP2PPort, ip, port, allowPacketRelay] });
      return 101;
    },
    networkingCreateP2PConnectionSocket(steamId64, virtualPort, timeoutSeconds, allowPacketRelay) {
      this.calls.push({
        method: "networkingCreateP2PConnectionSocket",
        args: [steamId64, virtualPort, timeoutSeconds, allowPacketRelay]
      });
      return 102;
    },
    networkingCreateConnectionSocket(ip, port, timeoutSeconds) {
      this.calls.push({ method: "networkingCreateConnectionSocket", args: [ip, port, timeoutSeconds] });
      return 103;
    },
    networkingDestroySocket(socket, notifyRemoteEnd) {
      this.calls.push({ method: "networkingDestroySocket", args: [socket, notifyRemoteEnd] });
      return true;
    },
    networkingDestroyListenSocket(socket, notifyRemoteEnd) {
      this.calls.push({ method: "networkingDestroyListenSocket", args: [socket, notifyRemoteEnd] });
      return true;
    },
    networkingSendDataOnSocket(socket, data, reliable) {
      this.calls.push({ method: "networkingSendDataOnSocket", args: [socket, data, reliable] });
      return true;
    },
    networkingIsDataAvailableOnSocket(socket) {
      this.calls.push({ method: "networkingIsDataAvailableOnSocket", args: [socket] });
      return 7;
    },
    networkingRetrieveDataFromSocket(socket, size) {
      this.calls.push({ method: "networkingRetrieveDataFromSocket", args: [socket, size] });
      return { data: Buffer.from("socket"), size: 6 };
    },
    networkingIsDataAvailable(listenSocket) {
      this.calls.push({ method: "networkingIsDataAvailable", args: [listenSocket] });
      return { socket: 103, size: 4 };
    },
    networkingRetrieveData(listenSocket, size) {
      this.calls.push({ method: "networkingRetrieveData", args: [listenSocket, size] });
      return { socket: 103, data: Buffer.from("list"), size: 4 };
    },
    networkingGetSocketInfo(socket) {
      this.calls.push({ method: "networkingGetSocketInfo", args: [socket] });
      return {
        remote_steam_id: { steamId64: "76561198000000010", steamId32: "STEAM_0:0:19867141", accountId: 39734282 },
        socket_status: 1,
        remote_ip: 2130706433,
        remote_ip_address: "127.0.0.1",
        remote_port: 27015
      };
    },
    networkingGetListenSocketInfo(listenSocket) {
      this.calls.push({ method: "networkingGetListenSocketInfo", args: [listenSocket] });
      return { ip: 2130706433, ip_address: "127.0.0.1", port: 27016 };
    },
    networkingGetSocketConnectionType(socket) {
      this.calls.push({ method: "networkingGetSocketConnectionType", args: [socket] });
      return 2;
    },
    networkingGetMaxPacketSize(socket) {
      this.calls.push({ method: "networkingGetMaxPacketSize", args: [socket] });
      return 1200;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const callbackEvents = {};
  const callbackHandles = [
    steam.networking.onSocketStatus((event) => {
      callbackEvents.socketStatus = event;
    }),
    steam.networking.onP2PSessionRequest((event) => {
      callbackEvents.p2pRequest = event;
    }),
    steam.networking.onP2PSessionConnectFail((event) => {
      callbackEvents.p2pConnectFail = event;
    }),
    steam.networking.onLegacyP2PSessionRequest((event) => {
      callbackEvents.legacyP2pRequest = event;
    }),
    steam.networking.onLegacyP2PSessionConnectFail((event) => {
      callbackEvents.legacyP2pConnectFail = event;
    })
  ];
  fake.callbacks.get(steam.SteamCallback.SocketStatusCallback)({
    socket: 103,
    listen_socket: 101,
    remote: String(peer),
    state: steam.networking.LegacySocketState.Connected
  });
  fake.callbacks.get(steam.SteamCallback.P2PSessionRequestSteamworks)({ remote: String(peer) });
  fake.callbacks.get(steam.SteamCallback.P2PSessionConnectFailSteamworks)({
    remote: String(peer),
    error: steam.networking.P2PSessionError.Timeout
  });
  fake.callbacks.get(steam.SteamCallback.P2PSessionRequest)({ remote: "76561198000000012" });
  fake.callbacks.get(steam.SteamCallback.P2PSessionConnectFail)({
    remote: "76561198000000013",
    error: steam.networking.P2PSessionError.NoRightsToApp
  });

  assert.equal(callbackEvents.socketStatus.listenSocket, 101);
  assert.equal(callbackEvents.socketStatus.remote, peer);
  assert.equal(callbackEvents.socketStatus.state, steam.networking.LegacySocketState.Connected);
  assert.equal(callbackEvents.p2pRequest.remote, peer);
  assert.equal(callbackEvents.p2pConnectFail.error, steam.networking.P2PSessionError.Timeout);
  assert.equal(callbackEvents.legacyP2pRequest.remote, 76561198000000012n);
  assert.equal(callbackEvents.legacyP2pConnectFail.remote, 76561198000000013n);
  assert.equal(callbackEvents.legacyP2pConnectFail.error, steam.networking.P2PSessionError.NoRightsToApp);

  assert.equal(steam.networking.P2PSessionError.Timeout, 4);
  assert.equal(steam.networking.LegacySocketState.Connected, 1);
  assert.equal(steam.networking.LegacySocketConnectionType.UDPRelay, 2);
  assert.equal(steam.networking.sendP2PPacket(peer, steam.networking.SendType.Reliable, new Uint8Array([1, 2])), true);
  assert.equal(steam.networking.isP2PPacketAvailable(), 5);
  assert.equal(steam.networking.acceptP2PSession(peer), undefined);
  assert.equal(steam.networking.closeP2PSession(peer), true);
  assert.equal(steam.networking.closeP2PChannel(peer, 2), true);
  assert.deepEqual(steam.networking.getP2PSessionState(peer), {
    connectionActive: true,
    connecting: false,
    sessionError: 0,
    usingRelay: true,
    bytesQueuedForSend: 128,
    packetsQueuedForSend: 3,
    remoteIp: 2130706433,
    remoteIpAddress: "127.0.0.1",
    remotePort: 27015
  });
  assert.equal(steam.networking.allowP2PPacketRelay(true), true);
  assert.equal(steam.networking.createListenSocket(1, { ip: 2130706433, port: 27016, allowPacketRelay: false }), 101);
  assert.equal(steam.networking.createP2PConnectionSocket(peer, 2, 30, false), 102);
  assert.equal(steam.networking.createConnectionSocket(2130706433, 27015, 10), 103);
  assert.equal(steam.networking.destroySocket(103, true), true);
  assert.equal(steam.networking.destroyListenSocket(101, true), true);
  assert.equal(steam.networking.sendDataOnSocket(103, new Uint8Array([3, 4]), false), true);
  assert.equal(steam.networking.isDataAvailableOnSocket(103), 7);
  assert.deepEqual(steam.networking.retrieveDataFromSocket(103, 7), { data: Buffer.from("socket"), size: 6 });
  assert.deepEqual(steam.networking.isDataAvailable(101), { socket: 103, size: 4 });
  assert.deepEqual(steam.networking.retrieveData(101, 4), { socket: 103, data: Buffer.from("list"), size: 4 });
  assert.deepEqual(steam.networking.getSocketInfo(103), {
    remoteSteamId: { steamId64: 76561198000000010n, steamId32: "STEAM_0:0:19867141", accountId: 39734282 },
    socketStatus: 1,
    remoteIp: 2130706433,
    remoteIpAddress: "127.0.0.1",
    remotePort: 27015
  });
  assert.deepEqual(steam.networking.getListenSocketInfo(101), {
    ip: 2130706433,
    ipAddress: "127.0.0.1",
    port: 27016
  });
  assert.equal(steam.networking.getSocketConnectionType(103), 2);
  assert.equal(steam.networking.getMaxPacketSize(103), 1200);
  callbackHandles.forEach((handle) => handle.disconnect());
  const callbackIds = [
    steam.SteamCallback.SocketStatusCallback,
    steam.SteamCallback.P2PSessionRequestSteamworks,
    steam.SteamCallback.P2PSessionConnectFailSteamworks,
    steam.SteamCallback.P2PSessionRequest,
    steam.SteamCallback.P2PSessionConnectFail
  ];
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback").map((call) => call.args[0]),
    callbackIds
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback").map((call) => call.args[0]),
    callbackIds
  );
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingCreateListenSocket"), {
    method: "networkingCreateListenSocket",
    args: [1, 2130706433, 27016, false]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingSendDataOnSocket"), {
    method: "networkingSendDataOnSocket",
    args: [103, Buffer.from([3, 4]), false]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingAcceptP2PSession"), {
    method: "networkingAcceptP2PSession",
    args: [peer]
  });
});

test("networking messages facade covers identity, message, session, and callback flows", (t) => {
  const peer = { identity_type: 16, text: "steamid:76561198000000010", steam_id64: "76561198000000010" };
  const quickStatus = {
    state: 3,
    ping: 42,
    connection_quality_local: 0.95,
    connection_quality_remote: 0.9,
    out_packets_per_second: 10.5,
    out_bytes_per_second: 2048.5,
    in_packets_per_second: 9.5,
    in_bytes_per_second: 1024.25,
    send_rate_bytes_per_second: 4096,
    pending_unreliable: 1,
    pending_reliable: 2,
    sent_unacked_reliable: 3,
    queue_time: "5000",
    max_jitter: 50
  };
  const fake = createFakeNative({
    networkingIdentityToString(identity) {
      this.calls.push({ method: "networkingIdentityToString", args: [identity] });
      return identity.steamId64 ? `steamid:${identity.steamId64}` : identity.text;
    },
    networkingIdentityParse(text) {
      this.calls.push({ method: "networkingIdentityParse", args: [text] });
      return text === "bad" ? null : peer;
    },
    networkingMessagesSendMessageToUser(identity, data, sendFlags, channel) {
      this.calls.push({ method: "networkingMessagesSendMessageToUser", args: [identity, data, sendFlags, channel] });
      return 1;
    },
    networkingMessagesReceiveMessagesOnChannel(channel, maxMessages) {
      this.calls.push({ method: "networkingMessagesReceiveMessagesOnChannel", args: [channel, maxMessages] });
      return [
        {
          data: Buffer.from("payload"),
          size: 7,
          peer,
          connection: 99,
          connection_user_data: "123",
          time_received: "456",
          message_number: "7",
          channel,
          flags: 8,
          user_data: "9",
          lane: 1
        }
      ];
    },
    networkingMessagesAcceptSessionWithUser(identity) {
      this.calls.push({ method: "networkingMessagesAcceptSessionWithUser", args: [identity] });
      return true;
    },
    networkingMessagesCloseSessionWithUser(identity) {
      this.calls.push({ method: "networkingMessagesCloseSessionWithUser", args: [identity] });
      return true;
    },
    networkingMessagesCloseChannelWithUser(identity, channel) {
      this.calls.push({ method: "networkingMessagesCloseChannelWithUser", args: [identity, channel] });
      return true;
    },
    networkingMessagesGetSessionConnectionInfo(identity) {
      this.calls.push({ method: "networkingMessagesGetSessionConnectionInfo", args: [identity] });
      return {
        state: 3,
        remote_identity: peer,
        user_data: "11",
        listen_socket: 0,
        remote_pop: 1234,
        relay_pop: 5678,
        end_reason: 0,
        end_debug: "",
        connection_description: "session to peer",
        flags: 4,
        quick_status: quickStatus
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const identity = { steamId64: 76561198000000010n };
  assert.equal(steam.networking.NetworkingSendFlags.Reliable, 8);
  assert.equal(steam.networking.messages.ConnectionState.Connected, 3);
  assert.equal(steam.networking.messages.identityToString(identity), "steamid:76561198000000010");
  assert.deepEqual(steam.networking.messages.parseIdentity("steamid:76561198000000010"), {
    identityType: 16,
    text: "steamid:76561198000000010",
    steamId64: 76561198000000010n,
    genericString: null,
    localHost: false,
    invalid: false,
    fakeIpType: 0
  });
  assert.equal(steam.networking.messages.parseIdentity("bad"), null);
  assert.equal(
    steam.networking.messages.sendMessageToUser(
      identity,
      Buffer.from("payload"),
      steam.networking.messages.SendFlags.Reliable,
      2
    ),
    1
  );
  assert.deepEqual(steam.networking.messages.receiveMessagesOnChannel(2, 4), [
    {
      data: Buffer.from("payload"),
      size: 7,
      peer: {
        identityType: 16,
        text: "steamid:76561198000000010",
        steamId64: 76561198000000010n,
        genericString: null,
        localHost: false,
        invalid: false,
        fakeIpType: 0
      },
      connection: 99,
      connectionUserData: 123n,
      timeReceived: 456n,
      messageNumber: 7n,
      channel: 2,
      flags: 8,
      userData: 9n,
      lane: 1
    }
  ]);
  assert.equal(steam.networking.messages.acceptSessionWithUser(identity), true);
  assert.equal(steam.networking.messages.closeSessionWithUser(identity), true);
  assert.equal(steam.networking.messages.closeChannelWithUser(identity, 2), true);
  assert.deepEqual(steam.networking.messages.getSessionConnectionInfo(identity), {
    state: 3,
    remoteIdentity: {
      identityType: 16,
      text: "steamid:76561198000000010",
      steamId64: 76561198000000010n,
      genericString: null,
      localHost: false,
      invalid: false,
      fakeIpType: 0
    },
    userData: 11n,
    listenSocket: 0,
    remotePop: 1234,
    relayPop: 5678,
    endReason: 0,
    endDebug: "",
    connectionDescription: "session to peer",
    flags: 4,
    quickStatus: {
      state: 3,
      ping: 42,
      connectionQualityLocal: 0.95,
      connectionQualityRemote: 0.9,
      outPacketsPerSecond: 10.5,
      outBytesPerSecond: 2048.5,
      inPacketsPerSecond: 9.5,
      inBytesPerSecond: 1024.25,
      sendRateBytesPerSecond: 4096,
      pendingUnreliable: 1,
      pendingReliable: 2,
      sentUnackedReliable: 3,
      queueTime: 5000n,
      maxJitter: 50
    }
  });

  let requestEvent;
  const sessionRequestHandle = steam.networking.messages.onSessionRequest((event) => {
    requestEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetworkingMessagesSessionRequest)({ remote_identity: peer });
  assert.equal(requestEvent.remoteIdentity.steamId64, 76561198000000010n);

  let failedEvent;
  const sessionFailedHandle = steam.networking.messages.onSessionFailed((event) => {
    failedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetworkingMessagesSessionFailed)({
    info: {
      state: 5,
      remote_identity: peer,
      user_data: "12",
      flags: 1
    }
  });
  assert.equal(failedEvent.info.remoteIdentity.steamId64, 76561198000000010n);
  assert.equal(failedEvent.info.userData, 12n);
  assert.equal(failedEvent.info.quickStatus, null);
  sessionRequestHandle.disconnect();
  sessionFailedHandle.disconnect();
  assert.deepEqual(
    fake.calls.filter(
      (call) =>
        call.method === "disconnectCallback" &&
        [
          steam.SteamCallback.SteamNetworkingMessagesSessionRequest,
          steam.SteamCallback.SteamNetworkingMessagesSessionFailed
        ].includes(call.args[0])
    ),
    [
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamNetworkingMessagesSessionRequest] },
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamNetworkingMessagesSessionFailed] }
    ]
  );
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingMessagesSendMessageToUser"), {
    method: "networkingMessagesSendMessageToUser",
    args: [identity, Buffer.from("payload"), 8, 2]
  });
});

test("game server legacy networking facade dispatches through game server natives", (t) => {
  let nextPacket = {
    data: Buffer.from("server"),
    size: 6,
    steamId: { steamId64: "76561198000000011", steamId32: "STEAM_0:1:19867141", accountId: 39734283 }
  };
  const fake = createFakeNative({
    gameServerNetworkingSendP2PPacket(steamId64, sendType, data) {
      this.calls.push({ method: "gameServerNetworkingSendP2PPacket", args: [steamId64, sendType, data] });
      return true;
    },
    gameServerNetworkingIsP2PPacketAvailable() {
      this.calls.push({ method: "gameServerNetworkingIsP2PPacketAvailable", args: [] });
      return 6;
    },
    gameServerNetworkingReadP2PPacket(size) {
      this.calls.push({ method: "gameServerNetworkingReadP2PPacket", args: [size] });
      return nextPacket;
    },
    gameServerNetworkingAcceptP2PSession(steamId64) {
      this.calls.push({ method: "gameServerNetworkingAcceptP2PSession", args: [steamId64] });
    },
    gameServerNetworkingCloseP2PSession(steamId64) {
      this.calls.push({ method: "gameServerNetworkingCloseP2PSession", args: [steamId64] });
      return true;
    },
    gameServerNetworkingCloseP2PChannel(steamId64, channel) {
      this.calls.push({ method: "gameServerNetworkingCloseP2PChannel", args: [steamId64, channel] });
      return true;
    },
    gameServerNetworkingGetP2PSessionState(steamId64) {
      this.calls.push({ method: "gameServerNetworkingGetP2PSessionState", args: [steamId64] });
      return {
        connectionActive: true,
        connecting: false,
        sessionError: 0,
        usingRelay: false,
        bytesQueuedForSend: 64,
        packetsQueuedForSend: 1,
        remoteIp: 2130706433,
        remoteIpAddress: "127.0.0.1",
        remotePort: 27015
      };
    },
    gameServerNetworkingAllowP2PPacketRelay(allow) {
      this.calls.push({ method: "gameServerNetworkingAllowP2PPacketRelay", args: [allow] });
      return true;
    },
    gameServerNetworkingCreateListenSocket(virtualP2PPort, ip, port, allowPacketRelay) {
      this.calls.push({
        method: "gameServerNetworkingCreateListenSocket",
        args: [virtualP2PPort, ip, port, allowPacketRelay]
      });
      return 201;
    },
    gameServerNetworkingCreateP2PConnectionSocket(steamId64, virtualPort, timeoutSeconds, allowPacketRelay) {
      this.calls.push({
        method: "gameServerNetworkingCreateP2PConnectionSocket",
        args: [steamId64, virtualPort, timeoutSeconds, allowPacketRelay]
      });
      return 202;
    },
    gameServerNetworkingCreateConnectionSocket(ip, port, timeoutSeconds) {
      this.calls.push({ method: "gameServerNetworkingCreateConnectionSocket", args: [ip, port, timeoutSeconds] });
      return 203;
    },
    gameServerNetworkingDestroySocket(socket, notifyRemoteEnd) {
      this.calls.push({ method: "gameServerNetworkingDestroySocket", args: [socket, notifyRemoteEnd] });
      return true;
    },
    gameServerNetworkingDestroyListenSocket(socket, notifyRemoteEnd) {
      this.calls.push({ method: "gameServerNetworkingDestroyListenSocket", args: [socket, notifyRemoteEnd] });
      return true;
    },
    gameServerNetworkingSendDataOnSocket(socket, data, reliable) {
      this.calls.push({ method: "gameServerNetworkingSendDataOnSocket", args: [socket, data, reliable] });
      return true;
    },
    gameServerNetworkingIsDataAvailableOnSocket(socket) {
      this.calls.push({ method: "gameServerNetworkingIsDataAvailableOnSocket", args: [socket] });
      return 5;
    },
    gameServerNetworkingRetrieveDataFromSocket(socket, size) {
      this.calls.push({ method: "gameServerNetworkingRetrieveDataFromSocket", args: [socket, size] });
      return { data: Buffer.from("server-socket"), size: 13 };
    },
    gameServerNetworkingIsDataAvailable(listenSocket) {
      this.calls.push({ method: "gameServerNetworkingIsDataAvailable", args: [listenSocket] });
      return { socket: 203, size: 6 };
    },
    gameServerNetworkingRetrieveData(listenSocket, size) {
      this.calls.push({ method: "gameServerNetworkingRetrieveData", args: [listenSocket, size] });
      return { socket: 203, data: Buffer.from("server"), size: 6 };
    },
    gameServerNetworkingGetSocketInfo(socket) {
      this.calls.push({ method: "gameServerNetworkingGetSocketInfo", args: [socket] });
      return {
        remoteSteamId: { steamId64: "76561198000000011", steamId32: "STEAM_0:1:19867141", accountId: 39734283 },
        socketStatus: 1,
        remoteIp: 2130706433,
        remoteIpAddress: "127.0.0.1",
        remotePort: 27015
      };
    },
    gameServerNetworkingGetListenSocketInfo(listenSocket) {
      this.calls.push({ method: "gameServerNetworkingGetListenSocketInfo", args: [listenSocket] });
      return { ip: 2130706433, ipAddress: "127.0.0.1", port: 27016 };
    },
    gameServerNetworkingGetSocketConnectionType(socket) {
      this.calls.push({ method: "gameServerNetworkingGetSocketConnectionType", args: [socket] });
      return 1;
    },
    gameServerNetworkingGetMaxPacketSize(socket) {
      this.calls.push({ method: "gameServerNetworkingGetMaxPacketSize", args: [socket] });
      return 1200;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const peer = 76561198000000011n;
  let serverP2pRequestEvent;
  const serverP2pRequestHandle = steam.gameServerNetworking.onP2PSessionRequest((event) => {
    serverP2pRequestEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.P2PSessionRequestSteamworks)({ remote: String(peer) });
  serverP2pRequestHandle.disconnect();
  assert.equal(serverP2pRequestEvent.remote, peer);

  assert.equal(steam.gameServerNetworking.SendType.Reliable, 2);
  assert.equal(
    steam.gameServerNetworking.sendP2PPacket(
      peer,
      steam.gameServerNetworking.SendType.Reliable,
      new Uint8Array([1, 2, 3])
    ),
    true
  );
  assert.equal(steam.gameServerNetworking.isP2PPacketAvailable(), 6);
  assert.deepEqual(steam.gameServerNetworking.readP2PPacket(6), {
    data: Buffer.from("server"),
    size: 6,
    steamId: { steamId64: 76561198000000011n, steamId32: "STEAM_0:1:19867141", accountId: 39734283 }
  });
  steam.gameServerNetworking.acceptP2PSession(peer);
  assert.equal(steam.gameServerNetworking.P2PSessionError.NoRightsToApp, 2);
  assert.equal(steam.gameServerNetworking.LegacySocketState.Connected, 1);
  assert.equal(steam.gameServerNetworking.closeP2PSession(peer), true);
  assert.equal(steam.gameServerNetworking.closeP2PChannel(peer, 4), true);
  assert.equal(steam.gameServerNetworking.getP2PSessionState(peer).bytesQueuedForSend, 64);
  assert.equal(steam.gameServerNetworking.allowP2PPacketRelay(true), true);
  assert.equal(
    steam.gameServerNetworking.createListenSocket(2, { ip: 2130706433, port: 27016, allowPacketRelay: false }),
    201
  );
  assert.equal(steam.gameServerNetworking.createP2PConnectionSocket(peer, 2, 30, false), 202);
  assert.equal(steam.gameServerNetworking.createConnectionSocket(2130706433, 27015, 10), 203);
  assert.equal(steam.gameServerNetworking.destroySocket(203, true), true);
  assert.equal(steam.gameServerNetworking.destroyListenSocket(201, true), true);
  assert.equal(steam.gameServerNetworking.sendDataOnSocket(203, new Uint8Array([4, 5]), false), true);
  assert.equal(steam.gameServerNetworking.isDataAvailableOnSocket(203), 5);
  assert.deepEqual(steam.gameServerNetworking.retrieveDataFromSocket(203, 13), {
    data: Buffer.from("server-socket"),
    size: 13
  });
  assert.deepEqual(steam.gameServerNetworking.isDataAvailable(201), { socket: 203, size: 6 });
  assert.deepEqual(steam.gameServerNetworking.retrieveData(201, 6), {
    socket: 203,
    data: Buffer.from("server"),
    size: 6
  });
  assert.equal(steam.gameServerNetworking.getSocketInfo(203).remoteSteamId.steamId64, peer);
  assert.equal(steam.gameServerNetworking.getListenSocketInfo(201).port, 27016);
  assert.equal(steam.gameServerNetworking.getSocketConnectionType(203), 1);
  assert.equal(steam.gameServerNetworking.getMaxPacketSize(203), 1200);

  nextPacket = null;
  assert.throws(() => steam.gameServerNetworking.readP2PPacket(6), /No Steam game-server P2P packet is available/);
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerNetworkingSendP2PPacket"), {
    method: "gameServerNetworkingSendP2PPacket",
    args: [peer, 2, Buffer.from([1, 2, 3])]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerNetworkingAcceptP2PSession"), {
    method: "gameServerNetworkingAcceptP2PSession",
    args: [peer]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerNetworkingSendDataOnSocket"), {
    method: "gameServerNetworkingSendDataOnSocket",
    args: [203, Buffer.from([4, 5]), false]
  });
});

test("game server networking messages facade dispatches through game server natives", (t) => {
  const peer = { identity_type: 16, text: "steamid:76561198000000011", steam_id64: "76561198000000011" };
  const quickStatus = {
    state: 3,
    ping: 24,
    connection_quality_local: 0.8,
    connection_quality_remote: 0.75,
    out_packets_per_second: 3.5,
    out_bytes_per_second: 512.5,
    in_packets_per_second: 2.5,
    in_bytes_per_second: 256.25,
    send_rate_bytes_per_second: 1024,
    pending_unreliable: 2,
    pending_reliable: 3,
    sent_unacked_reliable: 4,
    queue_time: "6000",
    max_jitter: 60
  };
  const fake = createFakeNative({
    networkingIdentityToString(identity) {
      this.calls.push({ method: "networkingIdentityToString", args: [identity] });
      return identity.steamId64 ? `steamid:${identity.steamId64}` : identity.text;
    },
    networkingIdentityParse(text) {
      this.calls.push({ method: "networkingIdentityParse", args: [text] });
      return text === "bad" ? null : peer;
    },
    gameServerNetworkingMessagesSendMessageToUser(identity, data, sendFlags, channel) {
      this.calls.push({
        method: "gameServerNetworkingMessagesSendMessageToUser",
        args: [identity, data, sendFlags, channel]
      });
      return 1;
    },
    gameServerNetworkingMessagesReceiveMessagesOnChannel(channel, maxMessages) {
      this.calls.push({ method: "gameServerNetworkingMessagesReceiveMessagesOnChannel", args: [channel, maxMessages] });
      return [
        {
          data: Buffer.from("server-payload"),
          size: 14,
          peer,
          connection: 100,
          connection_user_data: "124",
          time_received: "457",
          message_number: "8",
          channel,
          flags: 8,
          user_data: "10",
          lane: 2
        }
      ];
    },
    gameServerNetworkingMessagesAcceptSessionWithUser(identity) {
      this.calls.push({ method: "gameServerNetworkingMessagesAcceptSessionWithUser", args: [identity] });
      return true;
    },
    gameServerNetworkingMessagesCloseSessionWithUser(identity) {
      this.calls.push({ method: "gameServerNetworkingMessagesCloseSessionWithUser", args: [identity] });
      return true;
    },
    gameServerNetworkingMessagesCloseChannelWithUser(identity, channel) {
      this.calls.push({ method: "gameServerNetworkingMessagesCloseChannelWithUser", args: [identity, channel] });
      return true;
    },
    gameServerNetworkingMessagesGetSessionConnectionInfo(identity) {
      this.calls.push({ method: "gameServerNetworkingMessagesGetSessionConnectionInfo", args: [identity] });
      return {
        state: 3,
        remote_identity: peer,
        user_data: "13",
        listen_socket: 0,
        remote_pop: 1111,
        relay_pop: 2222,
        end_reason: 0,
        end_debug: "",
        connection_description: "game server session to peer",
        flags: 5,
        quick_status: quickStatus
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const identity = { steamId64: 76561198000000011n };
  assert.equal(steam.gameServerNetworkingMessages.SendFlags.Reliable, 8);
  assert.equal(steam.gameServerNetworkingMessages.ConnectionState.Connected, 3);
  assert.equal(steam.gameServerNetworkingMessages.identityToString(identity), "steamid:76561198000000011");
  assert.deepEqual(steam.gameServerNetworkingMessages.parseIdentity("steamid:76561198000000011"), {
    identityType: 16,
    text: "steamid:76561198000000011",
    steamId64: 76561198000000011n,
    genericString: null,
    localHost: false,
    invalid: false,
    fakeIpType: 0
  });
  assert.equal(steam.gameServerNetworkingMessages.parseIdentity("bad"), null);
  assert.equal(
    steam.gameServerNetworkingMessages.sendMessageToUser(
      identity,
      Buffer.from("server-payload"),
      steam.gameServerNetworkingMessages.SendFlags.Reliable,
      3
    ),
    1
  );
  assert.deepEqual(steam.gameServerNetworkingMessages.receiveMessagesOnChannel(3, 2), [
    {
      data: Buffer.from("server-payload"),
      size: 14,
      peer: {
        identityType: 16,
        text: "steamid:76561198000000011",
        steamId64: 76561198000000011n,
        genericString: null,
        localHost: false,
        invalid: false,
        fakeIpType: 0
      },
      connection: 100,
      connectionUserData: 124n,
      timeReceived: 457n,
      messageNumber: 8n,
      channel: 3,
      flags: 8,
      userData: 10n,
      lane: 2
    }
  ]);
  assert.equal(steam.gameServerNetworkingMessages.acceptSessionWithUser(identity), true);
  assert.equal(steam.gameServerNetworkingMessages.closeSessionWithUser(identity), true);
  assert.equal(steam.gameServerNetworkingMessages.closeChannelWithUser(identity, 3), true);
  assert.deepEqual(steam.gameServerNetworkingMessages.getSessionConnectionInfo(identity), {
    state: 3,
    remoteIdentity: {
      identityType: 16,
      text: "steamid:76561198000000011",
      steamId64: 76561198000000011n,
      genericString: null,
      localHost: false,
      invalid: false,
      fakeIpType: 0
    },
    userData: 13n,
    listenSocket: 0,
    remotePop: 1111,
    relayPop: 2222,
    endReason: 0,
    endDebug: "",
    connectionDescription: "game server session to peer",
    flags: 5,
    quickStatus: {
      state: 3,
      ping: 24,
      connectionQualityLocal: 0.8,
      connectionQualityRemote: 0.75,
      outPacketsPerSecond: 3.5,
      outBytesPerSecond: 512.5,
      inPacketsPerSecond: 2.5,
      inBytesPerSecond: 256.25,
      sendRateBytesPerSecond: 1024,
      pendingUnreliable: 2,
      pendingReliable: 3,
      sentUnackedReliable: 4,
      queueTime: 6000n,
      maxJitter: 60
    }
  });

  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerNetworkingMessagesSendMessageToUser"), {
    method: "gameServerNetworkingMessagesSendMessageToUser",
    args: [identity, Buffer.from("server-payload"), 8, 3]
  });
});

test("game server networking sockets facade uses game-server native bindings", (t) => {
  const peer = { identity_type: 16, text: "steamid:76561198000000012", steam_id64: "76561198000000012" };
  const address = {
    text: "127.0.0.1:27015",
    ipv4: 2130706433,
    port: 27015,
    ipv4_address: "127.0.0.1",
    is_ipv4: true,
    is_local_host: true,
    is_fake_ip: false,
    fake_ip_type: 0,
    ipv6_all_zeros: false
  };
  const quickStatus = {
    state: 3,
    ping: 21,
    connection_quality_local: 0.99,
    connection_quality_remote: 0.98,
    out_packets_per_second: 8,
    out_bytes_per_second: 2048,
    in_packets_per_second: 7,
    in_bytes_per_second: 1024,
    send_rate_bytes_per_second: 4096,
    pending_unreliable: 1,
    pending_reliable: 2,
    sent_unacked_reliable: 3,
    queue_time: "3000",
    max_jitter: 40
  };
  const connectionInfo = {
    state: 3,
    remote_identity: peer,
    user_data: "99",
    listen_socket: 144,
    remote_address: address,
    remote_pop: 1234,
    relay_pop: 5678,
    end_reason: 0,
    end_debug: "",
    connection_description: "game server socket to peer",
    flags: 16
  };
  const fake = createFakeNative({
    gameServerNetworkingSocketsCreateListenSocketIp(addr, options) {
      this.calls.push({ method: "gameServerNetworkingSocketsCreateListenSocketIp", args: [addr, options] });
      return 144;
    },
    gameServerNetworkingSocketsConnectByIpAddress(addr, options) {
      this.calls.push({ method: "gameServerNetworkingSocketsConnectByIpAddress", args: [addr, options] });
      return 201;
    },
    gameServerNetworkingSocketsCreateListenSocketP2p(port, options) {
      this.calls.push({ method: "gameServerNetworkingSocketsCreateListenSocketP2p", args: [port, options] });
      return 145;
    },
    gameServerNetworkingSocketsConnectP2p(identity, port, options) {
      this.calls.push({ method: "gameServerNetworkingSocketsConnectP2p", args: [identity, port, options] });
      return 202;
    },
    gameServerNetworkingSocketsConnectP2pCustomSignaling(signalingPointer, peerIdentity, port, options) {
      this.calls.push({
        method: "gameServerNetworkingSocketsConnectP2pCustomSignaling",
        args: [signalingPointer, peerIdentity, port, options]
      });
      return 203;
    },
    gameServerNetworkingSocketsReceivedP2pCustomSignal(message, contextPointer) {
      this.calls.push({
        method: "gameServerNetworkingSocketsReceivedP2pCustomSignal",
        args: [message, contextPointer]
      });
      return true;
    },
    gameServerNetworkingSocketsAcceptConnection(connection) {
      this.calls.push({ method: "gameServerNetworkingSocketsAcceptConnection", args: [connection] });
      return 1;
    },
    gameServerNetworkingSocketsCloseConnection(connection, reason, debug, enableLinger) {
      this.calls.push({
        method: "gameServerNetworkingSocketsCloseConnection",
        args: [connection, reason, debug, enableLinger]
      });
      return true;
    },
    gameServerNetworkingSocketsCloseListenSocket(socket) {
      this.calls.push({ method: "gameServerNetworkingSocketsCloseListenSocket", args: [socket] });
      return true;
    },
    gameServerNetworkingSocketsSetConnectionUserData(connection, userData) {
      this.calls.push({ method: "gameServerNetworkingSocketsSetConnectionUserData", args: [connection, userData] });
      return true;
    },
    gameServerNetworkingSocketsGetConnectionUserData(connection) {
      this.calls.push({ method: "gameServerNetworkingSocketsGetConnectionUserData", args: [connection] });
      return "99";
    },
    gameServerNetworkingSocketsSetConnectionName(connection, name) {
      this.calls.push({ method: "gameServerNetworkingSocketsSetConnectionName", args: [connection, name] });
    },
    gameServerNetworkingSocketsGetConnectionName(connection) {
      this.calls.push({ method: "gameServerNetworkingSocketsGetConnectionName", args: [connection] });
      return "game-server-peer";
    },
    gameServerNetworkingSocketsSendMessageToConnection(connection, data, sendFlags) {
      this.calls.push({
        method: "gameServerNetworkingSocketsSendMessageToConnection",
        args: [connection, data, sendFlags]
      });
      return { result: 1, message_number: "902" };
    },
    gameServerNetworkingSocketsSendMessages(messages) {
      this.calls.push({ method: "gameServerNetworkingSocketsSendMessages", args: [messages] });
      return [{ result: 1, message_number: "901" }];
    },
    gameServerNetworkingSocketsFlushMessagesOnConnection(connection) {
      this.calls.push({ method: "gameServerNetworkingSocketsFlushMessagesOnConnection", args: [connection] });
      return 1;
    },
    gameServerNetworkingSocketsReceiveMessagesOnConnection(connection, maxMessages) {
      this.calls.push({ method: "gameServerNetworkingSocketsReceiveMessagesOnConnection", args: [connection, maxMessages] });
      return [
        {
          data: Buffer.from("server-socket"),
          size: 13,
          peer,
          connection,
          connection_user_data: "99",
          time_received: "987",
          message_number: "123",
          channel: 2,
          flags: 8,
          user_data: "77",
          lane: 4
        }
      ];
    },
    gameServerNetworkingSocketsGetConnectionInfo(connection) {
      this.calls.push({ method: "gameServerNetworkingSocketsGetConnectionInfo", args: [connection] });
      return connectionInfo;
    },
    gameServerNetworkingSocketsGetConnectionRealTimeStatus(connection) {
      this.calls.push({ method: "gameServerNetworkingSocketsGetConnectionRealTimeStatus", args: [connection] });
      return quickStatus;
    },
    gameServerNetworkingSocketsGetConnectionRealTimeStatusWithLanes(connection, maxLanes) {
      this.calls.push({
        method: "gameServerNetworkingSocketsGetConnectionRealTimeStatusWithLanes",
        args: [connection, maxLanes]
      });
      return {
        status: quickStatus,
        lanes: [{ pending_unreliable: 4, pending_reliable: 5, sent_unacked_reliable: 6, queue_time: "7000" }]
      };
    },
    gameServerNetworkingSocketsGetDetailedConnectionStatus(connection, maxBytes) {
      this.calls.push({ method: "gameServerNetworkingSocketsGetDetailedConnectionStatus", args: [connection, maxBytes] });
      return "game server detailed status";
    },
    gameServerNetworkingSocketsGetListenSocketAddress(socket) {
      this.calls.push({ method: "gameServerNetworkingSocketsGetListenSocketAddress", args: [socket] });
      return address;
    },
    gameServerNetworkingSocketsCreateSocketPair(useNetworkLoopback, identity1, identity2) {
      this.calls.push({
        method: "gameServerNetworkingSocketsCreateSocketPair",
        args: [useNetworkLoopback, identity1, identity2]
      });
      return { connection1: 301, connection2: 302 };
    },
    gameServerNetworkingSocketsConfigureConnectionLanes(connection, priorities, weights) {
      this.calls.push({
        method: "gameServerNetworkingSocketsConfigureConnectionLanes",
        args: [connection, priorities, weights]
      });
      return 1;
    },
    gameServerNetworkingSocketsGetIdentity() {
      this.calls.push({ method: "gameServerNetworkingSocketsGetIdentity", args: [] });
      return peer;
    },
    gameServerNetworkingSocketsInitAuthentication() {
      this.calls.push({ method: "gameServerNetworkingSocketsInitAuthentication", args: [] });
      return 100;
    },
    gameServerNetworkingSocketsGetAuthenticationStatus() {
      this.calls.push({ method: "gameServerNetworkingSocketsGetAuthenticationStatus", args: [] });
      return { availability: 100, debug_message: "server auth ready" };
    },
    gameServerNetworkingSocketsCreatePollGroup() {
      this.calls.push({ method: "gameServerNetworkingSocketsCreatePollGroup", args: [] });
      return 401;
    },
    gameServerNetworkingSocketsRunCallbacks() {
      this.calls.push({ method: "gameServerNetworkingSocketsRunCallbacks", args: [] });
    },
    gameServerNetworkingSocketsDestroyPollGroup(pollGroup) {
      this.calls.push({ method: "gameServerNetworkingSocketsDestroyPollGroup", args: [pollGroup] });
      return true;
    },
    gameServerNetworkingSocketsSetConnectionPollGroup(connection, pollGroup) {
      this.calls.push({ method: "gameServerNetworkingSocketsSetConnectionPollGroup", args: [connection, pollGroup] });
      return true;
    },
    gameServerNetworkingSocketsReceiveMessagesOnPollGroup(pollGroup, maxMessages) {
      this.calls.push({ method: "gameServerNetworkingSocketsReceiveMessagesOnPollGroup", args: [pollGroup, maxMessages] });
      return [];
    },
    gameServerNetworkingSocketsReceivedRelayAuthTicket(ticket) {
      this.calls.push({ method: "gameServerNetworkingSocketsReceivedRelayAuthTicket", args: [ticket] });
      return true;
    },
    gameServerNetworkingSocketsFindRelayAuthTicketForServer(identity, remoteVirtualPort) {
      this.calls.push({
        method: "gameServerNetworkingSocketsFindRelayAuthTicketForServer",
        args: [identity, remoteVirtualPort]
      });
      return 121;
    },
    gameServerNetworkingSocketsConnectToHostedDedicatedServer(identity, remoteVirtualPort, options) {
      this.calls.push({
        method: "gameServerNetworkingSocketsConnectToHostedDedicatedServer",
        args: [identity, remoteVirtualPort, options]
      });
      return 204;
    },
    gameServerNetworkingSocketsGetHostedDedicatedServerPort() {
      this.calls.push({ method: "gameServerNetworkingSocketsGetHostedDedicatedServerPort", args: [] });
      return 27016;
    },
    gameServerNetworkingSocketsGetHostedDedicatedServerPopId() {
      this.calls.push({ method: "gameServerNetworkingSocketsGetHostedDedicatedServerPopId", args: [] });
      return 4321;
    },
    gameServerNetworkingSocketsGetHostedDedicatedServerAddress() {
      this.calls.push({ method: "gameServerNetworkingSocketsGetHostedDedicatedServerAddress", args: [] });
      return {
        result: 1,
        routing: { pop_id: 4321, size: 3, data: Buffer.from("sdr") },
        debug_message: ""
      };
    },
    gameServerNetworkingSocketsCreateHostedDedicatedServerListenSocket(localVirtualPort, options) {
      this.calls.push({
        method: "gameServerNetworkingSocketsCreateHostedDedicatedServerListenSocket",
        args: [localVirtualPort, options]
      });
      return 146;
    },
    gameServerNetworkingSocketsGetGameCoordinatorServerLogin(appData, maxBlobBytes) {
      this.calls.push({
        method: "gameServerNetworkingSocketsGetGameCoordinatorServerLogin",
        args: [appData, maxBlobBytes]
      });
      return {
        result: 1,
        identity: peer,
        routing: { pop_id: 4321, size: 3, data: Buffer.from("sdr") },
        app_id: 480,
        timestamp: 123456,
        app_data: appData,
        signed_blob: Buffer.from("signed-server-login"),
        debug_message: ""
      };
    },
    gameServerNetworkingSocketsGetCertificateRequest(maxBytes) {
      this.calls.push({ method: "gameServerNetworkingSocketsGetCertificateRequest", args: [maxBytes] });
      return { success: true, data: Buffer.from("server-cert-request"), error: "" };
    },
    gameServerNetworkingSocketsSetCertificate(certificate) {
      this.calls.push({ method: "gameServerNetworkingSocketsSetCertificate", args: [certificate] });
      return { success: true, data: Buffer.alloc(0), error: "" };
    },
    gameServerNetworkingSocketsResetIdentity(identity) {
      this.calls.push({ method: "gameServerNetworkingSocketsResetIdentity", args: [identity] });
    },
    gameServerNetworkingSocketsBeginAsyncRequestFakeIp(numPorts) {
      this.calls.push({ method: "gameServerNetworkingSocketsBeginAsyncRequestFakeIp", args: [numPorts] });
      return true;
    },
    gameServerNetworkingSocketsGetFakeIp(idxFirstPort) {
      this.calls.push({ method: "gameServerNetworkingSocketsGetFakeIp", args: [idxFirstPort] });
      return {
        result: 1,
        identity: peer,
        ipv4: 167772161,
        ipv4_address: "10.0.0.1",
        ports: [27015, 27016]
      };
    },
    gameServerNetworkingSocketsCreateListenSocketP2pFakeIp(idxFakePort, options) {
      this.calls.push({
        method: "gameServerNetworkingSocketsCreateListenSocketP2pFakeIp",
        args: [idxFakePort, options]
      });
      return 147;
    },
    gameServerNetworkingSocketsGetRemoteFakeIpForConnection(connection) {
      this.calls.push({ method: "gameServerNetworkingSocketsGetRemoteFakeIpForConnection", args: [connection] });
      return { result: 1, address };
    },
    gameServerNetworkingSocketsCreateFakeUdpPort(fakeServerPort) {
      this.calls.push({ method: "gameServerNetworkingSocketsCreateFakeUdpPort", args: [fakeServerPort] });
      return 701;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const identity = { steamId64: 76561198000000012n };
  const socketOptions = [
    { value: steam.networking.utils.ConfigValue.TimeoutInitial, int32Value: 1500 },
    { value: steam.networking.utils.ConfigValue.SDRClientForceRelayCluster, stringValue: "iad" }
  ];
  assert.equal(steam.gameServerNetworkingSockets.ConnectionState.Connected, 3);
  assert.equal(steam.gameServerNetworkingSockets.Availability.Current, 100);
  assert.equal(
    steam.gameServerNetworkingSockets.createListenSocketIP({ ipv4: 2130706433, port: 27015 }, socketOptions),
    144
  );
  assert.equal(steam.gameServerNetworkingSockets.connectByIPAddress({ text: "127.0.0.1:27015" }, socketOptions), 201);
  assert.equal(steam.gameServerNetworkingSockets.createListenSocketP2P(7, socketOptions), 145);
  assert.equal(steam.gameServerNetworkingSockets.connectP2P(identity, 7, socketOptions), 202);
  assert.equal(
    steam.gameServerNetworkingSockets.connectP2PCustomSignaling(0x1234n, identity, 8, socketOptions),
    203
  );
  assert.equal(steam.gameServerNetworkingSockets.receivedP2PCustomSignal(Buffer.from("server-signal"), 0x5678n), true);
  assert.equal(steam.gameServerNetworkingSockets.acceptConnection(202), 1);
  assert.equal(
    steam.gameServerNetworkingSockets.closeConnection(202, {
      reason: 2100,
      debug: "server-done",
      enableLinger: true
    }),
    true
  );
  assert.equal(steam.gameServerNetworkingSockets.closeListenSocket(144), true);
  assert.equal(steam.gameServerNetworkingSockets.setConnectionUserData(202, 99n), true);
  assert.equal(steam.gameServerNetworkingSockets.getConnectionUserData(202), 99n);
  steam.gameServerNetworkingSockets.setConnectionName(202, "game-server-peer");
  assert.equal(steam.gameServerNetworkingSockets.getConnectionName(202), "game-server-peer");
  assert.deepEqual(steam.gameServerNetworkingSockets.sendMessageToConnection(202, Buffer.from("server-socket")), {
    result: 1,
    messageNumber: 902n
  });
  assert.deepEqual(
    steam.gameServerNetworkingSockets.sendMessages([
      {
        connection: 202,
        data: Buffer.from("server-batch"),
        sendFlags: steam.gameServerNetworkingSockets.SendFlags.ReliableNoNagle
      }
    ]),
    [{ result: 1, messageNumber: 901n }]
  );
  assert.equal(steam.gameServerNetworkingSockets.receiveMessagesOnConnection(202, 2)[0].messageNumber, 123n);
  assert.equal(steam.gameServerNetworkingSockets.getConnectionInfo(202).remoteIdentity.steamId64, 76561198000000012n);
  assert.equal(
    steam.gameServerNetworkingSockets.getConnectionRealTimeStatusWithLanes(202, 1).lanes[0].queueTime,
    7000n
  );
  assert.equal(steam.gameServerNetworkingSockets.getAuthenticationStatus().debugMessage, "server auth ready");
  assert.equal(steam.gameServerNetworkingSockets.getHostedDedicatedServerAddress().routing.popId, 4321);
  assert.equal(steam.gameServerNetworkingSockets.createFakeUDPPort(1), 701);

  const sendMessagesCall = fake.calls.find((call) => call.method === "gameServerNetworkingSocketsSendMessages");
  assert.equal(sendMessagesCall.args[0][0].data.toString(), "server-batch");
  assert.equal(sendMessagesCall.args[0][0].sendFlags, steam.gameServerNetworkingSockets.SendFlags.ReliableNoNagle);
  assert.equal(steam.gameServerNetworkingSockets.flushMessagesOnConnection(202), 1);
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerNetworkingSocketsConnectP2p"), {
    method: "gameServerNetworkingSocketsConnectP2p",
    args: [{ steamId64: 76561198000000012n }, 7, socketOptions]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerNetworkingSocketsConnectP2pCustomSignaling"), {
    method: "gameServerNetworkingSocketsConnectP2pCustomSignaling",
    args: [0x1234n, { steamId64: 76561198000000012n }, 8, socketOptions]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerNetworkingSocketsCreateListenSocketIp"), {
    method: "gameServerNetworkingSocketsCreateListenSocketIp",
    args: [{ ipv4: 2130706433, port: 27015 }, socketOptions]
  });
  assert.equal(steam.gameServerNetworkingSockets.getConnectionRealTimeStatus(202).queueTime, 3000n);
  assert.equal(steam.gameServerNetworkingSockets.getDetailedConnectionStatus(202, 512), "game server detailed status");
  assert.equal(steam.gameServerNetworkingSockets.getListenSocketAddress(144).port, 27015);
  assert.deepEqual(steam.gameServerNetworkingSockets.createSocketPair(true, { localHost: true }, { genericString: "peer" }), {
    connection1: 301,
    connection2: 302
  });
  assert.equal(steam.gameServerNetworkingSockets.configureConnectionLanes(202, [10, 5], [100, 50]), 1);
  assert.equal(steam.gameServerNetworkingSockets.getIdentity().steamId64, 76561198000000012n);
  assert.equal(steam.gameServerNetworkingSockets.initAuthentication(), 100);
  const pollGroup = steam.gameServerNetworkingSockets.createPollGroup();
  steam.gameServerNetworkingSockets.runCallbacks();
  assert.equal(steam.gameServerNetworkingSockets.setConnectionPollGroup(202, pollGroup), true);
  assert.deepEqual(steam.gameServerNetworkingSockets.receiveMessagesOnPollGroup(pollGroup, 4), []);
  assert.equal(steam.gameServerNetworkingSockets.destroyPollGroup(pollGroup), true);
  assert.equal(steam.gameServerNetworkingSockets.receivedRelayAuthTicket(Buffer.from("ticket")), true);
  assert.equal(steam.gameServerNetworkingSockets.findRelayAuthTicketForServer(identity, 7), 121);
  assert.equal(steam.gameServerNetworkingSockets.connectToHostedDedicatedServer(identity, 7, socketOptions), 204);
  assert.equal(steam.gameServerNetworkingSockets.getHostedDedicatedServerPort(), 27016);
  assert.equal(steam.gameServerNetworkingSockets.getHostedDedicatedServerPopId(), 4321);
  assert.equal(steam.gameServerNetworkingSockets.createHostedDedicatedServerListenSocket(7, socketOptions), 146);
  const serverLogin = steam.gameServerNetworkingSockets.getGameCoordinatorServerLogin(Buffer.from("app-data"), 4096);
  assert.equal(serverLogin.result, 1);
  assert.equal(serverLogin.identity.steamId64, 76561198000000012n);
  assert.equal(serverLogin.routing.data.toString(), "sdr");
  assert.equal(serverLogin.appId, 480);
  assert.equal(serverLogin.appData.toString(), "app-data");
  assert.equal(serverLogin.signedBlob.toString(), "signed-server-login");
  assert.equal(steam.gameServerNetworkingSockets.getCertificateRequest(256).data.toString(), "server-cert-request");
  assert.equal(steam.gameServerNetworkingSockets.setCertificate(Buffer.from("server-cert")).success, true);
  steam.gameServerNetworkingSockets.resetIdentity({ localHost: true });
  assert.equal(steam.gameServerNetworkingSockets.beginAsyncRequestFakeIP(2), true);
  assert.deepEqual(steam.gameServerNetworkingSockets.getFakeIP(0), {
    result: 1,
    identity: {
      identityType: 16,
      text: "steamid:76561198000000012",
      steamId64: 76561198000000012n,
      genericString: null,
      localHost: false,
      invalid: false,
      fakeIpType: 0
    },
    ipv4: 167772161,
    ipv4Address: "10.0.0.1",
    ports: [27015, 27016]
  });
  assert.equal(steam.gameServerNetworkingSockets.createListenSocketP2PFakeIP(1, socketOptions), 147);
  assert.equal(steam.gameServerNetworkingSockets.getRemoteFakeIPForConnection(202).address.port, 27015);
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerNetworkingSocketsReceivedP2pCustomSignal"), {
    method: "gameServerNetworkingSocketsReceivedP2pCustomSignal",
    args: [Buffer.from("server-signal"), 0x5678n]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerNetworkingSocketsConnectToHostedDedicatedServer"), {
    method: "gameServerNetworkingSocketsConnectToHostedDedicatedServer",
    args: [{ steamId64: 76561198000000012n }, 7, socketOptions]
  });

  let statusEvent;
  const connectionStatusHandle = steam.gameServerNetworkingSockets.onConnectionStatusChanged((event) => {
    statusEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetConnectionStatusChanged)({
    connection: 202,
    old_state: 2,
    info: connectionInfo
  });
  assert.equal(statusEvent.connection, 202);
  assert.equal(statusEvent.oldState, 2);
  assert.equal(statusEvent.info.remoteIdentity.steamId64, 76561198000000012n);

  let fakeIpEvent;
  const fakeIpHandle = steam.gameServerNetworkingSockets.onFakeIpResult((event) => {
    fakeIpEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetworkingFakeIPResult)({
    result: 1,
    identity: peer,
    ipv4: 167772161,
    ipv4_address: "10.0.0.1",
    ports: [27015]
  });
  assert.equal(fakeIpEvent.identity.steamId64, 76561198000000012n);
  assert.equal(fakeIpEvent.ipv4Address, "10.0.0.1");
  assert.deepEqual(fakeIpEvent.ports, [27015]);
  connectionStatusHandle.disconnect();
  fakeIpHandle.disconnect();
  assert.deepEqual(
    fake.calls.filter(
      (call) =>
        call.method === "disconnectCallback" &&
        [
          steam.SteamCallback.SteamNetConnectionStatusChanged,
          steam.SteamCallback.SteamNetworkingFakeIPResult
        ].includes(call.args[0])
    ),
    [
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamNetConnectionStatusChanged] },
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamNetworkingFakeIPResult] }
    ]
  );
});

test("networking sockets facade covers connection handles, status, poll groups, and callbacks", (t) => {
  const peer = { identity_type: 16, text: "steamid:76561198000000010", steam_id64: "76561198000000010" };
  const address = {
    text: "127.0.0.1:27015",
    ipv4: 2130706433,
    port: 27015,
    ipv4_address: "127.0.0.1",
    is_ipv4: true,
    is_local_host: true,
    is_fake_ip: false,
    fake_ip_type: 0,
    ipv6_all_zeros: false
  };
  const quickStatus = {
    state: 3,
    ping: 42,
    connection_quality_local: 0.95,
    connection_quality_remote: 0.9,
    out_packets_per_second: 10.5,
    out_bytes_per_second: 2048.5,
    in_packets_per_second: 9.5,
    in_bytes_per_second: 1024.25,
    send_rate_bytes_per_second: 4096,
    pending_unreliable: 1,
    pending_reliable: 2,
    sent_unacked_reliable: 3,
    queue_time: "5000",
    max_jitter: 50
  };
  const connectionInfo = {
    state: 3,
    remote_identity: peer,
    user_data: "88",
    listen_socket: 44,
    remote_address: address,
    remote_pop: 1234,
    relay_pop: 5678,
    end_reason: 0,
    end_debug: "",
    connection_description: "socket to peer",
    flags: 16
  };
  const fake = createFakeNative({
    networkingSocketsCreateListenSocketIp(addr, options) {
      this.calls.push({ method: "networkingSocketsCreateListenSocketIp", args: [addr, options] });
      return 44;
    },
    networkingSocketsConnectByIpAddress(addr, options) {
      this.calls.push({ method: "networkingSocketsConnectByIpAddress", args: [addr, options] });
      return 101;
    },
    networkingSocketsCreateListenSocketP2p(port, options) {
      this.calls.push({ method: "networkingSocketsCreateListenSocketP2p", args: [port, options] });
      return 45;
    },
    networkingSocketsConnectP2p(identity, port, options) {
      this.calls.push({ method: "networkingSocketsConnectP2p", args: [identity, port, options] });
      return 102;
    },
    networkingSocketsConnectP2pCustomSignaling(signalingPointer, peerIdentity, port, options) {
      this.calls.push({
        method: "networkingSocketsConnectP2pCustomSignaling",
        args: [signalingPointer, peerIdentity, port, options]
      });
      return 104;
    },
    networkingSocketsReceivedP2pCustomSignal(message, contextPointer) {
      this.calls.push({
        method: "networkingSocketsReceivedP2pCustomSignal",
        args: [message, contextPointer]
      });
      return true;
    },
    networkingSocketsAcceptConnection(connection) {
      this.calls.push({ method: "networkingSocketsAcceptConnection", args: [connection] });
      return 1;
    },
    networkingSocketsCloseConnection(connection, reason, debug, enableLinger) {
      this.calls.push({ method: "networkingSocketsCloseConnection", args: [connection, reason, debug, enableLinger] });
      return true;
    },
    networkingSocketsCloseListenSocket(socket) {
      this.calls.push({ method: "networkingSocketsCloseListenSocket", args: [socket] });
      return true;
    },
    networkingSocketsSetConnectionUserData(connection, userData) {
      this.calls.push({ method: "networkingSocketsSetConnectionUserData", args: [connection, userData] });
      return true;
    },
    networkingSocketsGetConnectionUserData(connection) {
      this.calls.push({ method: "networkingSocketsGetConnectionUserData", args: [connection] });
      return "88";
    },
    networkingSocketsSetConnectionName(connection, name) {
      this.calls.push({ method: "networkingSocketsSetConnectionName", args: [connection, name] });
    },
    networkingSocketsGetConnectionName(connection) {
      this.calls.push({ method: "networkingSocketsGetConnectionName", args: [connection] });
      return "peer";
    },
    networkingSocketsSendMessageToConnection(connection, data, sendFlags) {
      this.calls.push({ method: "networkingSocketsSendMessageToConnection", args: [connection, data, sendFlags] });
      return { result: 1, message_number: "777" };
    },
    networkingSocketsSendMessages(messages) {
      this.calls.push({ method: "networkingSocketsSendMessages", args: [messages] });
      return [
        { result: 1, message_number: "778" },
        { result: 3, messageNumber: 0n }
      ];
    },
    networkingSocketsFlushMessagesOnConnection(connection) {
      this.calls.push({ method: "networkingSocketsFlushMessagesOnConnection", args: [connection] });
      return 1;
    },
    networkingSocketsReceiveMessagesOnConnection(connection, maxMessages) {
      this.calls.push({ method: "networkingSocketsReceiveMessagesOnConnection", args: [connection, maxMessages] });
      return [
        {
          data: Buffer.from("socket"),
          size: 6,
          peer,
          connection,
          connection_user_data: "88",
          time_received: "456",
          message_number: "7",
          channel: 0,
          flags: 8,
          user_data: "9",
          lane: 1
        }
      ];
    },
    networkingSocketsGetConnectionInfo(connection) {
      this.calls.push({ method: "networkingSocketsGetConnectionInfo", args: [connection] });
      return connectionInfo;
    },
    networkingSocketsGetConnectionRealTimeStatus(connection) {
      this.calls.push({ method: "networkingSocketsGetConnectionRealTimeStatus", args: [connection] });
      return quickStatus;
    },
    networkingSocketsGetConnectionRealTimeStatusWithLanes(connection, maxLanes) {
      this.calls.push({ method: "networkingSocketsGetConnectionRealTimeStatusWithLanes", args: [connection, maxLanes] });
      return {
        status: quickStatus,
        lanes: [
          {
            pending_unreliable: 4,
            pending_reliable: 5,
            sent_unacked_reliable: 6,
            queue_time: "7000"
          }
        ]
      };
    },
    networkingSocketsGetDetailedConnectionStatus(connection, maxBytes) {
      this.calls.push({ method: "networkingSocketsGetDetailedConnectionStatus", args: [connection, maxBytes] });
      return "detailed status";
    },
    networkingSocketsGetListenSocketAddress(socket) {
      this.calls.push({ method: "networkingSocketsGetListenSocketAddress", args: [socket] });
      return address;
    },
    networkingSocketsCreateSocketPair(useNetworkLoopback, identity1, identity2) {
      this.calls.push({ method: "networkingSocketsCreateSocketPair", args: [useNetworkLoopback, identity1, identity2] });
      return { connection1: 201, connection2: 202 };
    },
    networkingSocketsConfigureConnectionLanes(connection, priorities, weights) {
      this.calls.push({ method: "networkingSocketsConfigureConnectionLanes", args: [connection, priorities, weights] });
      return 1;
    },
    networkingSocketsGetIdentity() {
      this.calls.push({ method: "networkingSocketsGetIdentity", args: [] });
      return peer;
    },
    networkingSocketsInitAuthentication() {
      this.calls.push({ method: "networkingSocketsInitAuthentication", args: [] });
      return 100;
    },
    networkingSocketsGetAuthenticationStatus() {
      this.calls.push({ method: "networkingSocketsGetAuthenticationStatus", args: [] });
      return { availability: 100, debug_message: "auth ready" };
    },
    networkingSocketsCreatePollGroup() {
      this.calls.push({ method: "networkingSocketsCreatePollGroup", args: [] });
      return 301;
    },
    networkingSocketsRunCallbacks() {
      this.calls.push({ method: "networkingSocketsRunCallbacks", args: [] });
    },
    networkingSocketsDestroyPollGroup(pollGroup) {
      this.calls.push({ method: "networkingSocketsDestroyPollGroup", args: [pollGroup] });
      return true;
    },
    networkingSocketsSetConnectionPollGroup(connection, pollGroup) {
      this.calls.push({ method: "networkingSocketsSetConnectionPollGroup", args: [connection, pollGroup] });
      return true;
    },
    networkingSocketsReceiveMessagesOnPollGroup(pollGroup, maxMessages) {
      this.calls.push({ method: "networkingSocketsReceiveMessagesOnPollGroup", args: [pollGroup, maxMessages] });
      return [];
    },
    networkingSocketsReceivedRelayAuthTicket(ticket) {
      this.calls.push({ method: "networkingSocketsReceivedRelayAuthTicket", args: [ticket] });
      return true;
    },
    networkingSocketsFindRelayAuthTicketForServer(identity, remoteVirtualPort) {
      this.calls.push({ method: "networkingSocketsFindRelayAuthTicketForServer", args: [identity, remoteVirtualPort] });
      return 120;
    },
    networkingSocketsConnectToHostedDedicatedServer(identity, remoteVirtualPort, options) {
      this.calls.push({ method: "networkingSocketsConnectToHostedDedicatedServer", args: [identity, remoteVirtualPort, options] });
      return 103;
    },
    networkingSocketsGetHostedDedicatedServerPort() {
      this.calls.push({ method: "networkingSocketsGetHostedDedicatedServerPort", args: [] });
      return 27015;
    },
    networkingSocketsGetHostedDedicatedServerPopId() {
      this.calls.push({ method: "networkingSocketsGetHostedDedicatedServerPopId", args: [] });
      return 1234;
    },
    networkingSocketsGetHostedDedicatedServerAddress() {
      this.calls.push({ method: "networkingSocketsGetHostedDedicatedServerAddress", args: [] });
      return {
        result: 1,
        routing: {
          pop_id: 1234,
          size: 3,
          data: Buffer.from("sdr")
        },
        debug_message: ""
      };
    },
    networkingSocketsCreateHostedDedicatedServerDevAddress(ip, port, popId) {
      this.calls.push({ method: "networkingSocketsCreateHostedDedicatedServerDevAddress", args: [ip, port, popId] });
      return {
        pop_id: popId,
        size: 3,
        data: Buffer.from("dev")
      };
    },
    networkingSocketsCreateHostedDedicatedServerListenSocket(localVirtualPort, options) {
      this.calls.push({ method: "networkingSocketsCreateHostedDedicatedServerListenSocket", args: [localVirtualPort, options] });
      return 46;
    },
    networkingSocketsGetGameCoordinatorServerLogin(appData, maxBlobBytes) {
      this.calls.push({ method: "networkingSocketsGetGameCoordinatorServerLogin", args: [appData, maxBlobBytes] });
      return {
        result: 1,
        identity: peer,
        routing: {
          pop_id: 1234,
          size: 3,
          data: Buffer.from("sdr")
        },
        app_id: 480,
        timestamp: 123456,
        app_data: appData,
        signed_blob: Buffer.from("signed-login"),
        debug_message: ""
      };
    },
    networkingSocketsGetCertificateRequest(maxBytes) {
      this.calls.push({ method: "networkingSocketsGetCertificateRequest", args: [maxBytes] });
      return { success: true, data: Buffer.from("cert-request"), error: "" };
    },
    networkingSocketsSetCertificate(certificate) {
      this.calls.push({ method: "networkingSocketsSetCertificate", args: [certificate] });
      return { success: true, data: Buffer.alloc(0), error: "" };
    },
    networkingSocketsResetIdentity(identity) {
      this.calls.push({ method: "networkingSocketsResetIdentity", args: [identity] });
    },
    networkingSocketsBeginAsyncRequestFakeIp(numPorts) {
      this.calls.push({ method: "networkingSocketsBeginAsyncRequestFakeIp", args: [numPorts] });
      return true;
    },
    networkingSocketsGetFakeIp(idxFirstPort) {
      this.calls.push({ method: "networkingSocketsGetFakeIp", args: [idxFirstPort] });
      return {
        result: 1,
        identity: peer,
        ipv4: 167772161,
        ipv4_address: "10.0.0.1",
        ports: [27015, 27016]
      };
    },
    networkingSocketsCreateListenSocketP2pFakeIp(idxFakePort, options) {
      this.calls.push({ method: "networkingSocketsCreateListenSocketP2pFakeIp", args: [idxFakePort, options] });
      return 47;
    },
    networkingSocketsGetRemoteFakeIpForConnection(connection) {
      this.calls.push({ method: "networkingSocketsGetRemoteFakeIpForConnection", args: [connection] });
      return { result: 1, address };
    },
    networkingSocketsCreateFakeUdpPort(fakeServerPort) {
      this.calls.push({ method: "networkingSocketsCreateFakeUdpPort", args: [fakeServerPort] });
      return 601;
    },
    networkingFakeUdpPortDestroy(handle) {
      this.calls.push({ method: "networkingFakeUdpPortDestroy", args: [handle] });
      return true;
    },
    networkingFakeUdpPortSendMessageToFakeIp(handle, remoteAddress, data, sendFlags) {
      this.calls.push({ method: "networkingFakeUdpPortSendMessageToFakeIp", args: [handle, remoteAddress, data, sendFlags] });
      return 1;
    },
    networkingFakeUdpPortReceiveMessages(handle, maxMessages) {
      this.calls.push({ method: "networkingFakeUdpPortReceiveMessages", args: [handle, maxMessages] });
      return [
        {
          data: Buffer.from("udp"),
          size: 3,
          peer,
          connection: 0,
          connection_user_data: "0",
          time_received: "789",
          message_number: "10",
          channel: 0,
          flags: 0,
          user_data: "0",
          lane: 0
        }
      ];
    },
    networkingFakeUdpPortScheduleCleanup(handle, remoteAddress) {
      this.calls.push({ method: "networkingFakeUdpPortScheduleCleanup", args: [handle, remoteAddress] });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const identity = { steamId64: 76561198000000010n };
  const socketOptions = [
    { value: steam.networking.utils.ConfigValue.TimeoutInitial, int32Value: 2500 },
    { value: steam.networking.utils.ConfigValue.SDRClientForceRelayCluster, stringValue: "iad" }
  ];
  assert.equal(steam.SteamCallback.SteamNetConnectionStatusChanged, 1221);
  assert.equal(steam.SteamCallback.SteamNetworkingFakeIPResult, 1223);
  assert.equal(steam.networking.sockets.ConnectionState.Connected, 3);
  assert.equal(steam.networking.sockets.Availability.Current, 100);
  assert.equal(steam.networking.sockets.createListenSocketIP({ ipv4: 2130706433, port: 27015 }, socketOptions), 44);
  assert.equal(steam.networking.sockets.connectByIPAddress({ text: "127.0.0.1:27015" }, socketOptions), 101);
  assert.equal(steam.networking.sockets.createListenSocketP2P(7, socketOptions), 45);
  assert.equal(steam.networking.sockets.connectP2P(identity, 7, socketOptions), 102);
  assert.equal(steam.networking.sockets.connectP2PCustomSignaling(0x1234n, identity, 8, socketOptions), 104);
  assert.equal(steam.networking.sockets.receivedP2PCustomSignal(Uint8Array.from([1, 2, 3]), 0x5678n), true);
  assert.equal(steam.networking.sockets.acceptConnection(102), 1);
  assert.equal(steam.networking.sockets.closeConnection(102, { reason: 2000, debug: "done", enableLinger: true }), true);
  assert.equal(steam.networking.sockets.closeListenSocket(44), true);
  assert.equal(steam.networking.sockets.setConnectionUserData(102, 88n), true);
  assert.equal(steam.networking.sockets.getConnectionUserData(102), 88n);
  steam.networking.sockets.setConnectionName(102, "peer");
  assert.equal(steam.networking.sockets.getConnectionName(102), "peer");
  assert.deepEqual(steam.networking.sockets.sendMessageToConnection(102, Buffer.from("socket")), {
    result: 1,
    messageNumber: 777n
  });
  assert.deepEqual(
    steam.networking.sockets.sendMessages([
      { connection: 102, data: Buffer.from("batch-a"), sendFlags: steam.networking.sockets.SendFlags.ReliableNoNagle },
      { connection: 103, data: Uint8Array.from([1, 2, 3]) }
    ]),
    [
      { result: 1, messageNumber: 778n },
      { result: 3, messageNumber: 0n }
    ]
  );
  const sendMessagesCall = fake.calls.find((call) => call.method === "networkingSocketsSendMessages");
  assert.equal(sendMessagesCall.args[0][0].data.toString(), "batch-a");
  assert.equal(sendMessagesCall.args[0][0].sendFlags, steam.networking.sockets.SendFlags.ReliableNoNagle);
  assert.deepEqual([...sendMessagesCall.args[0][1].data], [1, 2, 3]);
  assert.equal(steam.networking.sockets.flushMessagesOnConnection(102), 1);
  assert.equal(steam.networking.sockets.receiveMessagesOnConnection(102, 2)[0].messageNumber, 7n);
  assert.deepEqual(steam.networking.sockets.getConnectionInfo(102), {
    state: 3,
    remoteIdentity: {
      identityType: 16,
      text: "steamid:76561198000000010",
      steamId64: 76561198000000010n,
      genericString: null,
      localHost: false,
      invalid: false,
      fakeIpType: 0
    },
    userData: 88n,
    listenSocket: 44,
    remoteAddress: {
      text: "127.0.0.1:27015",
      ipv4: 2130706433,
      port: 27015,
      ipv4Address: "127.0.0.1",
      isIpv4: true,
      isLocalHost: true,
      isFakeIp: false,
      fakeIpType: 0,
      ipv6AllZeros: false
    },
    remotePop: 1234,
    relayPop: 5678,
    endReason: 0,
    endDebug: "",
    connectionDescription: "socket to peer",
    flags: 16
  });
  assert.equal(steam.networking.sockets.getConnectionRealTimeStatus(102).queueTime, 5000n);
  assert.deepEqual(steam.networking.sockets.getConnectionRealTimeStatusWithLanes(102, 2), {
    status: {
      state: 3,
      ping: 42,
      connectionQualityLocal: 0.95,
      connectionQualityRemote: 0.9,
      outPacketsPerSecond: 10.5,
      outBytesPerSecond: 2048.5,
      inPacketsPerSecond: 9.5,
      inBytesPerSecond: 1024.25,
      sendRateBytesPerSecond: 4096,
      pendingUnreliable: 1,
      pendingReliable: 2,
      sentUnackedReliable: 3,
      queueTime: 5000n,
      maxJitter: 50
    },
    lanes: [
      {
        pendingUnreliable: 4,
        pendingReliable: 5,
        sentUnackedReliable: 6,
        queueTime: 7000n
      }
    ]
  });
  assert.equal(steam.networking.sockets.getDetailedConnectionStatus(102, 512), "detailed status");
  assert.equal(steam.networking.sockets.getListenSocketAddress(44).port, 27015);
  assert.deepEqual(steam.networking.sockets.createSocketPair(true, { localHost: true }, { genericString: "peer" }), {
    connection1: 201,
    connection2: 202
  });
  assert.equal(steam.networking.sockets.configureConnectionLanes(102, [10, 5], [100, 50]), 1);
  assert.equal(steam.networking.sockets.getIdentity().steamId64, 76561198000000010n);
  assert.equal(steam.networking.sockets.initAuthentication(), 100);
  assert.equal(steam.networking.sockets.getAuthenticationStatus().debugMessage, "auth ready");
  const pollGroup = steam.networking.sockets.createPollGroup();
  steam.networking.sockets.runCallbacks();
  assert.equal(steam.networking.sockets.setConnectionPollGroup(102, pollGroup), true);
  assert.deepEqual(steam.networking.sockets.receiveMessagesOnPollGroup(pollGroup, 4), []);
  assert.equal(steam.networking.sockets.destroyPollGroup(pollGroup), true);
  assert.equal(steam.networking.sockets.receivedRelayAuthTicket(Buffer.from("ticket")), true);
  assert.equal(steam.networking.sockets.findRelayAuthTicketForServer(identity, 7), 120);
  assert.equal(steam.networking.sockets.connectToHostedDedicatedServer(identity, 7, socketOptions), 103);
  assert.equal(steam.networking.sockets.getHostedDedicatedServerPort(), 27015);
  assert.equal(steam.networking.sockets.getHostedDedicatedServerPopId(), 1234);
  const hostedAddress = steam.networking.sockets.getHostedDedicatedServerAddress();
  assert.equal(hostedAddress.result, 1);
  assert.equal(hostedAddress.routing.popId, 1234);
  assert.equal(hostedAddress.routing.data.toString(), "sdr");
  const devAddress = steam.networking.sockets.createHostedDedicatedServerDevAddress(2130706433, 27015, 5678);
  assert.equal(devAddress.popId, 5678);
  assert.equal(devAddress.data.toString(), "dev");
  assert.equal(steam.networking.sockets.createHostedDedicatedServerListenSocket(7, socketOptions), 46);
  const serverLogin = steam.networking.sockets.getGameCoordinatorServerLogin(Buffer.from("app-data"), 4096);
  assert.equal(serverLogin.result, 1);
  assert.equal(serverLogin.identity.steamId64, 76561198000000010n);
  assert.equal(serverLogin.routing.data.toString(), "sdr");
  assert.equal(serverLogin.appId, 480);
  assert.equal(serverLogin.appData.toString(), "app-data");
  assert.equal(serverLogin.signedBlob.toString(), "signed-login");
  const certificateRequest = steam.networking.sockets.getCertificateRequest(256);
  assert.equal(certificateRequest.success, true);
  assert.equal(certificateRequest.data.toString(), "cert-request");
  const certificateSet = steam.networking.sockets.setCertificate(Buffer.from("cert"));
  assert.equal(certificateSet.success, true);
  steam.networking.sockets.resetIdentity({ localHost: true });
  assert.equal(steam.networking.sockets.beginAsyncRequestFakeIP(2), true);
  assert.deepEqual(steam.networking.sockets.getFakeIP(0), {
    result: 1,
    identity: {
      identityType: 16,
      text: "steamid:76561198000000010",
      steamId64: 76561198000000010n,
      genericString: null,
      localHost: false,
      invalid: false,
      fakeIpType: 0
    },
    ipv4: 167772161,
    ipv4Address: "10.0.0.1",
    ports: [27015, 27016]
  });
  assert.equal(steam.networking.sockets.createListenSocketP2PFakeIP(1, socketOptions), 47);
  assert.equal(steam.networking.sockets.getRemoteFakeIPForConnection(102).address.port, 27015);
  const fakeUdpPort = steam.networking.sockets.createFakeUDPPort(1);
  assert.equal(fakeUdpPort, 601);
  assert.equal(
    steam.networking.fakeUDP.sendMessageToFakeIP(fakeUdpPort, { text: "10.0.0.1:27015" }, Buffer.from("udp")),
    1
  );
  assert.equal(steam.networking.fakeUDP.receiveMessages(fakeUdpPort, 3)[0].data.toString(), "udp");
  steam.networking.fakeUDP.scheduleCleanup(fakeUdpPort, { ipv4: 167772161, port: 27015 });
  assert.equal(steam.networking.fakeUDP.destroy(fakeUdpPort), true);

  let statusEvent;
  const connectionStatusHandle = steam.networking.sockets.onConnectionStatusChanged((event) => {
    statusEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetConnectionStatusChanged)({
    connection: 102,
    old_state: 2,
    info: connectionInfo
  });
  assert.equal(statusEvent.connection, 102);
  assert.equal(statusEvent.oldState, 2);
  assert.equal(statusEvent.info.remoteIdentity.steamId64, 76561198000000010n);

  let fakeIpEvent;
  const fakeIpHandle = steam.networking.sockets.onFakeIpResult((event) => {
    fakeIpEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetworkingFakeIPResult)({
    result: 1,
    identity: peer,
    ipv4: 167772161,
    ipv4_address: "10.0.0.1",
    ports: [27015]
  });
  assert.equal(fakeIpEvent.identity.steamId64, 76561198000000010n);
  assert.equal(fakeIpEvent.ipv4Address, "10.0.0.1");
  assert.deepEqual(fakeIpEvent.ports, [27015]);
  connectionStatusHandle.disconnect();
  fakeIpHandle.disconnect();
  assert.deepEqual(
    fake.calls.filter(
      (call) =>
        call.method === "disconnectCallback" &&
        [
          steam.SteamCallback.SteamNetConnectionStatusChanged,
          steam.SteamCallback.SteamNetworkingFakeIPResult
        ].includes(call.args[0])
    ),
    [
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamNetConnectionStatusChanged] },
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamNetworkingFakeIPResult] }
    ]
  );

  assert.deepEqual(fake.calls.find((call) => call.method === "networkingSocketsConnectP2p"), {
    method: "networkingSocketsConnectP2p",
    args: [{ steamId64: 76561198000000010n }, 7, socketOptions]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingSocketsConnectP2pCustomSignaling"), {
    method: "networkingSocketsConnectP2pCustomSignaling",
    args: [0x1234n, { steamId64: 76561198000000010n }, 8, socketOptions]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingSocketsReceivedP2pCustomSignal"), {
    method: "networkingSocketsReceivedP2pCustomSignal",
    args: [Buffer.from([1, 2, 3]), 0x5678n]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingSocketsCreateHostedDedicatedServerDevAddress"), {
    method: "networkingSocketsCreateHostedDedicatedServerDevAddress",
    args: [2130706433, 27015, 5678]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingFakeUdpPortSendMessageToFakeIp"), {
    method: "networkingFakeUdpPortSendMessageToFakeIp",
    args: [601, { text: "10.0.0.1:27015" }, Buffer.from("udp"), steam.NetworkingSendFlags.Unreliable]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingSocketsGetGameCoordinatorServerLogin"), {
    method: "networkingSocketsGetGameCoordinatorServerLogin",
    args: [Buffer.from("app-data"), 4096]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingSocketsCreateListenSocketIp"), {
    method: "networkingSocketsCreateListenSocketIp",
    args: [{ ipv4: 2130706433, port: 27015 }, socketOptions]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingSocketsConnectToHostedDedicatedServer"), {
    method: "networkingSocketsConnectToHostedDedicatedServer",
    args: [{ steamId64: 76561198000000010n }, 7, socketOptions]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingSocketsCreateListenSocketP2pFakeIp"), {
    method: "networkingSocketsCreateListenSocketP2pFakeIp",
    args: [1, socketOptions]
  });
});

test("networking utils facade covers relay, ping, fake IP, address, config, debug, and callback flows", (t) => {
  const peer = { identity_type: 16, text: "steamid:76561198000000010", steam_id64: "76561198000000010" };
  const fake = createFakeNative({
    networkingUtilsInitRelayNetworkAccess() {
      this.calls.push({ method: "networkingUtilsInitRelayNetworkAccess", args: [] });
    },
    networkingUtilsGetRelayNetworkStatus() {
      this.calls.push({ method: "networkingUtilsGetRelayNetworkStatus", args: [] });
      return {
        availability: 100,
        ping_measurement_in_progress: false,
        network_config_availability: 100,
        any_relay_availability: 100,
        debug_message: "relay ready"
      };
    },
    networkingUtilsGetLocalPingLocation() {
      this.calls.push({ method: "networkingUtilsGetLocalPingLocation", args: [] });
      return { location: "local-ping-location", age_seconds: 0.5 };
    },
    networkingUtilsParsePingLocation(location) {
      this.calls.push({ method: "networkingUtilsParsePingLocation", args: [location] });
      return location === "bad" ? null : "canonical-ping-location";
    },
    networkingUtilsEstimatePingTimeBetweenTwoLocations(location1, location2) {
      this.calls.push({ method: "networkingUtilsEstimatePingTimeBetweenTwoLocations", args: [location1, location2] });
      return 44;
    },
    networkingUtilsEstimatePingTimeFromLocalHost(location) {
      this.calls.push({ method: "networkingUtilsEstimatePingTimeFromLocalHost", args: [location] });
      return 22;
    },
    networkingUtilsCheckPingDataUpToDate(maxAgeSeconds) {
      this.calls.push({ method: "networkingUtilsCheckPingDataUpToDate", args: [maxAgeSeconds] });
      return true;
    },
    networkingUtilsGetPingToDataCenter(popId) {
      this.calls.push({ method: "networkingUtilsGetPingToDataCenter", args: [popId] });
      return { ping_ms: 33, via_relay_pop: 5678 };
    },
    networkingUtilsGetDirectPingToPop(popId) {
      this.calls.push({ method: "networkingUtilsGetDirectPingToPop", args: [popId] });
      return 30;
    },
    networkingUtilsGetPopCount() {
      this.calls.push({ method: "networkingUtilsGetPopCount", args: [] });
      return 2;
    },
    networkingUtilsGetPopList(maxPops) {
      this.calls.push({ method: "networkingUtilsGetPopList", args: [maxPops] });
      return [111, 222];
    },
    networkingUtilsGetLocalTimestamp() {
      this.calls.push({ method: "networkingUtilsGetLocalTimestamp", args: [] });
      return 123456789n;
    },
    networkingUtilsIsFakeIpv4(ipv4) {
      this.calls.push({ method: "networkingUtilsIsFakeIpv4", args: [ipv4] });
      return true;
    },
    networkingUtilsGetIpv4FakeIpType(ipv4) {
      this.calls.push({ method: "networkingUtilsGetIpv4FakeIpType", args: [ipv4] });
      return 2;
    },
    networkingUtilsParseIpAddress(text) {
      this.calls.push({ method: "networkingUtilsParseIpAddress", args: [text] });
      return text === "bad" ? null : {
        text: "127.0.0.1:27015",
        ipv4: 2130706433,
        port: 27015,
        ipv4_address: "127.0.0.1",
        is_ipv4: true,
        is_local_host: true,
        is_fake_ip: false,
        fake_ip_type: 1,
        ipv6_all_zeros: false
      };
    },
    networkingUtilsIpAddressToString(address, withPort) {
      this.calls.push({ method: "networkingUtilsIpAddressToString", args: [address, withPort] });
      return withPort ? "127.0.0.1:27015" : "127.0.0.1";
    },
    networkingUtilsIpAddressEquals(address1, address2) {
      this.calls.push({ method: "networkingUtilsIpAddressEquals", args: [address1, address2] });
      return true;
    },
    networkingUtilsGetIpAddressFakeIpType(address) {
      this.calls.push({ method: "networkingUtilsGetIpAddressFakeIpType", args: [address] });
      return 1;
    },
    networkingUtilsGetRealIdentityForFakeIp(address) {
      this.calls.push({ method: "networkingUtilsGetRealIdentityForFakeIp", args: [address] });
      return { result: 1, identity: peer };
    },
    networkingUtilsIdentityToString(identity) {
      this.calls.push({ method: "networkingUtilsIdentityToString", args: [identity] });
      return identity.steamId64 ? `steamid:${identity.steamId64}` : identity.text;
    },
    networkingUtilsParseIdentity(text) {
      this.calls.push({ method: "networkingUtilsParseIdentity", args: [text] });
      return text === "bad" ? null : peer;
    },
    networkingUtilsIdentityGetSteamId(identity) {
      this.calls.push({ method: "networkingUtilsIdentityGetSteamId", args: [identity] });
      return 76561198000000010n;
    },
    networkingUtilsIdentityGetPsnId(identity) {
      this.calls.push({ method: "networkingUtilsIdentityGetPsnId", args: [identity] });
      return 123456789n;
    },
    networkingUtilsIdentityGetXboxPairwiseId(identity) {
      this.calls.push({ method: "networkingUtilsIdentityGetXboxPairwiseId", args: [identity] });
      return "xbox-pairwise-id";
    },
    networkingUtilsIdentityGetIpAddress(identity) {
      this.calls.push({ method: "networkingUtilsIdentityGetIpAddress", args: [identity] });
      return {
        text: "127.0.0.1:27015",
        ipv4: 2130706433,
        port: 27015,
        ipv4_address: "127.0.0.1",
        is_ipv4: true,
        is_local_host: true,
        is_fake_ip: false,
        fake_ip_type: 1,
        ipv6_all_zeros: false
      };
    },
    networkingUtilsIdentityGetIpv4(identity) {
      this.calls.push({ method: "networkingUtilsIdentityGetIpv4", args: [identity] });
      return 2130706433;
    },
    networkingUtilsIdentityGetGenericBytes(identity) {
      this.calls.push({ method: "networkingUtilsIdentityGetGenericBytes", args: [identity] });
      return Buffer.from([1, 2, 3]);
    },
    networkingUtilsIdentityEquals(identity1, identity2) {
      this.calls.push({ method: "networkingUtilsIdentityEquals", args: [identity1, identity2] });
      return true;
    },
    networkingUtilsIdentityIsFakeIp(identity) {
      this.calls.push({ method: "networkingUtilsIdentityIsFakeIp", args: [identity] });
      return false;
    },
    networkingUtilsSetConfigValueInt32(value, scope, scopeObj, data) {
      this.calls.push({ method: "networkingUtilsSetConfigValueInt32", args: [value, scope, scopeObj, data] });
      return true;
    },
    networkingUtilsSetConfigValueInt64(value, scope, scopeObj, data) {
      this.calls.push({ method: "networkingUtilsSetConfigValueInt64", args: [value, scope, scopeObj, data] });
      return true;
    },
    networkingUtilsSetConfigValueFloat(value, scope, scopeObj, data) {
      this.calls.push({ method: "networkingUtilsSetConfigValueFloat", args: [value, scope, scopeObj, data] });
      return true;
    },
    networkingUtilsSetConfigValueString(value, scope, scopeObj, data) {
      this.calls.push({ method: "networkingUtilsSetConfigValueString", args: [value, scope, scopeObj, data] });
      return true;
    },
    networkingUtilsSetConfigValueStruct(option, scope, scopeObj) {
      this.calls.push({ method: "networkingUtilsSetConfigValueStruct", args: [option, scope, scopeObj] });
      return true;
    },
    networkingUtilsSetGlobalConfigValueInt32(value, data) {
      this.calls.push({ method: "networkingUtilsSetGlobalConfigValueInt32", args: [value, data] });
      return true;
    },
    networkingUtilsSetGlobalConfigValueFloat(value, data) {
      this.calls.push({ method: "networkingUtilsSetGlobalConfigValueFloat", args: [value, data] });
      return true;
    },
    networkingUtilsSetGlobalConfigValueString(value, data) {
      this.calls.push({ method: "networkingUtilsSetGlobalConfigValueString", args: [value, data] });
      return true;
    },
    networkingUtilsSetGlobalConfigValuePtr(value, data) {
      this.calls.push({ method: "networkingUtilsSetGlobalConfigValuePtr", args: [value, data] });
      return true;
    },
    networkingUtilsSetConnectionConfigValueInt32(connection, value, data) {
      this.calls.push({ method: "networkingUtilsSetConnectionConfigValueInt32", args: [connection, value, data] });
      return true;
    },
    networkingUtilsSetConnectionConfigValueFloat(connection, value, data) {
      this.calls.push({ method: "networkingUtilsSetConnectionConfigValueFloat", args: [connection, value, data] });
      return true;
    },
    networkingUtilsSetConnectionConfigValueString(connection, value, data) {
      this.calls.push({ method: "networkingUtilsSetConnectionConfigValueString", args: [connection, value, data] });
      return true;
    },
    networkingUtilsGetConfigValue(value, scope, scopeObj, maxBytes) {
      this.calls.push({ method: "networkingUtilsGetConfigValue", args: [value, scope, scopeObj, maxBytes] });
      if (value === 40) {
        return { result: 2, data_type: 2, int64_value: "9223372036854775807" };
      }
      if (value === 29) {
        return { result: 1, data_type: 4, string_value: "iad" };
      }
      return { result: 1, data_type: 1, int32_value: 5000 };
    },
    networkingUtilsGetConfigValueInfo(value) {
      this.calls.push({ method: "networkingUtilsGetConfigValueInfo", args: [value] });
      return { value, name: "TimeoutInitial", data_type: 1, scope: 4 };
    },
    networkingUtilsIterateGenericEditableConfigValues(current, enumerateDevVars) {
      this.calls.push({ method: "networkingUtilsIterateGenericEditableConfigValues", args: [current, enumerateDevVars] });
      if (current === 0) {
        return 24;
      }
      if (current === 24) {
        return 29;
      }
      return 0;
    },
    networkingUtilsEnableGlobalCallbacks() {
      this.calls.push({ method: "networkingUtilsEnableGlobalCallbacks", args: [] });
      return true;
    },
    networkingUtilsClearGlobalCallbacks() {
      this.calls.push({ method: "networkingUtilsClearGlobalCallbacks", args: [] });
      return true;
    },
    networkingUtilsRegisterDebugOutputHook(detailLevel, handler) {
      this.calls.push({ method: "networkingUtilsRegisterDebugOutputHook", args: [detailLevel] });
      this.networkingDebugOutputHandler = handler;
      return {
        disconnect: () => this.calls.push({ method: "disconnectNetworkingDebugOutputHook", args: [] })
      };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.SteamCallback.SteamNetAuthenticationStatus, 1222);
  assert.equal(steam.SteamCallback.SteamRelayNetworkStatus, 1281);
  assert.equal(steam.networking.NetworkingAvailability.Current, 100);
  assert.equal(steam.networking.utils.Availability.Failed, -101);
  assert.equal(steam.networking.utils.FakeIpType.GlobalIPv4, 2);
  assert.equal(steam.networking.utils.ConfigScope.Connection, 4);
  assert.equal(steam.networking.utils.ConfigDataType.Int64, 2);
  assert.equal(steam.networking.utils.ConfigValue.TimeoutInitial, 24);
  assert.equal(steam.networking.utils.ConfigValue.ConnectionUserData, 40);
  assert.equal(steam.networking.utils.DebugOutputType.Warning, 4);
  assert.equal(steam.networking.utils.IceEnable.All, 2147483647);

  steam.networking.utils.initRelayNetworkAccess();
  assert.deepEqual(steam.networking.utils.getRelayNetworkStatus(), {
    availability: 100,
    pingMeasurementInProgress: false,
    networkConfigAvailability: 100,
    anyRelayAvailability: 100,
    debugMessage: "relay ready"
  });
  assert.deepEqual(steam.networking.utils.getLocalPingLocation(), {
    location: "local-ping-location",
    ageSeconds: 0.5
  });
  assert.equal(steam.networking.utils.parsePingLocation("local-ping-location"), "canonical-ping-location");
  assert.equal(steam.networking.utils.parsePingLocation("bad"), null);
  assert.equal(steam.networking.utils.estimatePingTimeBetweenTwoLocations("a", "b"), 44);
  assert.equal(steam.networking.utils.estimatePingTimeFromLocalHost("b"), 22);
  assert.equal(steam.networking.utils.checkPingDataUpToDate(60), true);
  assert.deepEqual(steam.networking.utils.getPingToDataCenter(1234), { pingMs: 33, viaRelayPop: 5678 });
  assert.equal(steam.networking.utils.getDirectPingToPop(1234), 30);
  assert.equal(steam.networking.utils.getPopCount(), 2);
  assert.deepEqual(steam.networking.utils.getPopList(3), [111, 222]);
  assert.equal(steam.networking.utils.getLocalTimestamp(), 123456789n);
  assert.equal(steam.networking.utils.isFakeIpv4(0x0a000001), true);
  assert.equal(steam.networking.utils.getIpv4FakeIpType(0x0a000001), 2);
  assert.deepEqual(steam.networking.utils.parseIpAddress("127.0.0.1:27015"), {
    text: "127.0.0.1:27015",
    ipv4: 2130706433,
    port: 27015,
    ipv4Address: "127.0.0.1",
    isIpv4: true,
    isLocalHost: true,
    isFakeIp: false,
    fakeIpType: 1,
    ipv6AllZeros: false
  });
  assert.equal(steam.networking.utils.parseIpAddress("bad"), null);
  assert.equal(steam.networking.utils.ipAddressToString({ ipv4: 2130706433, port: 27015 }, true), "127.0.0.1:27015");
  assert.equal(
    steam.networking.utils.ipAddressToString({ ipv6: Buffer.from("00000000000000000000ffff7f000001", "hex"), port: 27015 }, false),
    "127.0.0.1"
  );
  assert.equal(
    steam.networking.utils.ipAddressEquals({ ipv4: 2130706433, port: 27015 }, { text: "127.0.0.1:27015" }),
    true
  );
  assert.equal(steam.networking.utils.getIpAddressFakeIpType({ text: "127.0.0.1:27015" }), 1);
  assert.deepEqual(steam.networking.utils.getRealIdentityForFakeIp({ text: "10.0.0.1:27015" }), {
    result: 1,
    identity: {
      identityType: 16,
      text: "steamid:76561198000000010",
      steamId64: 76561198000000010n,
      genericString: null,
      localHost: false,
      invalid: false,
      fakeIpType: 0
    }
  });
  assert.equal(steam.networking.utils.identityToString({ steamId64: 76561198000000010n }), "steamid:76561198000000010");
  assert.equal(steam.networking.utils.parseIdentity("steamid:76561198000000010").steamId64, 76561198000000010n);
  assert.equal(steam.networking.utils.parseIdentity("bad"), null);
  assert.equal(steam.networking.utils.getIdentitySteamId({ steamId64: 76561198000000010n }), 76561198000000010n);
  assert.equal(steam.networking.utils.getIdentityPsnId({ psnId: 123456789n }), 123456789n);
  assert.equal(steam.networking.utils.getIdentityXboxPairwiseId({ xboxPairwiseId: "xbox-pairwise-id" }), "xbox-pairwise-id");
  assert.equal(steam.networking.utils.getIdentityIpAddress({ ipAddress: { text: "127.0.0.1:27015" } }).ipv4, 2130706433);
  assert.equal(steam.networking.utils.getIdentityIpv4({ ipv4: 2130706433, port: 27015 }), 2130706433);
  assert.deepEqual(steam.networking.utils.getIdentityGenericBytes({ genericBytes: Buffer.from([1, 2, 3]) }), Buffer.from([1, 2, 3]));
  assert.equal(steam.networking.utils.identityEquals({ steamId64: 76561198000000010n }, { text: "steamid:76561198000000010" }), true);
  assert.equal(steam.networking.utils.identityIsFakeIp({ ipAddress: { text: "10.0.0.1:27015" } }), false);
  assert.equal(
    steam.networking.utils.setGlobalConfigValueInt32(steam.networking.utils.ConfigValue.TimeoutInitial, 5000),
    true
  );
  assert.equal(
    steam.networking.utils.setGlobalConfigValueFloat(steam.networking.utils.ConfigValue.FakePacketLossSend, 12.5),
    true
  );
  assert.equal(
    steam.networking.utils.setGlobalConfigValueString(steam.networking.utils.ConfigValue.SDRClientForceRelayCluster, "iad"),
    true
  );
  assert.equal(
    steam.networking.utils.setGlobalConfigValuePointer(steam.networking.utils.ConfigValue.CallbackFakeIPResult, 0x1234n),
    true
  );
  assert.equal(
    steam.networking.utils.setGlobalConfigValuePointer(steam.networking.utils.ConfigValue.CallbackFakeIPResult, null),
    true
  );
  assert.equal(
    steam.networking.utils.setConnectionConfigValueInt32(77, steam.networking.utils.ConfigValue.TimeoutInitial, 2500),
    true
  );
  assert.equal(
    steam.networking.utils.setConnectionConfigValueInt64(
      77,
      steam.networking.utils.ConfigValue.ConnectionUserData,
      9223372036854775807n
    ),
    true
  );
  assert.equal(
    steam.networking.utils.setConnectionConfigValueFloat(
      77,
      steam.networking.utils.ConfigValue.FakePacketLossSend,
      1.25
    ),
    true
  );
  assert.equal(
    steam.networking.utils.setConnectionConfigValueString(
      77,
      steam.networking.utils.ConfigValue.SDRClientForceRelayCluster,
      "ord"
    ),
    true
  );
  assert.equal(
    steam.networking.utils.setConfigValueFloat(
      steam.networking.utils.ConfigValue.FakePacketLossSend,
      steam.networking.utils.ConfigScope.Global,
      0,
      12.5
    ),
    true
  );
  assert.equal(
    steam.networking.utils.setConfigValueString(
      steam.networking.utils.ConfigValue.SDRClientForceRelayCluster,
      steam.networking.utils.ConfigScope.Global,
      0,
      "iad"
    ),
    true
  );
  assert.equal(
    steam.networking.utils.setConfigValueStruct(
      {
        value: steam.networking.utils.ConfigValue.FakePacketLossSend,
        dataType: steam.networking.utils.ConfigDataType.Float,
        floatValue: 3.5
      },
      steam.networking.utils.ConfigScope.Global,
      0
    ),
    true
  );
  assert.equal(
    steam.networking.utils.setGlobalConfigValueStruct({
      value: steam.networking.utils.ConfigValue.SDRClientForceRelayCluster,
      stringValue: "iad"
    }),
    true
  );
  assert.equal(
    steam.networking.utils.setConnectionConfigValueStruct(77, {
      value: steam.networking.utils.ConfigValue.ConnectionUserData,
      int64Value: "123"
    }),
    true
  );
  assert.equal(
    steam.networking.utils.setConfigValueStruct(
      {
        value: steam.networking.utils.ConfigValue.CallbackFakeIPResult,
        dataType: steam.networking.utils.ConfigDataType.Ptr,
        pointerValue: 0x1234n
      },
      steam.networking.utils.ConfigScope.Global,
      0
    ),
    true
  );
  assert.deepEqual(
    steam.networking.utils.getConfigValue(steam.networking.utils.ConfigValue.TimeoutInitial),
    {
      result: 1,
      dataType: 1,
      value: 5000,
      int32Value: 5000,
      int64Value: null,
      floatValue: null,
      stringValue: null
    }
  );
  assert.equal(
    steam.networking.utils.getConfigValue(
      steam.networking.utils.ConfigValue.ConnectionUserData,
      steam.networking.utils.ConfigScope.Connection,
      77
    ).value,
    9223372036854775807n
  );
  assert.equal(
    steam.networking.utils.getConfigValue(steam.networking.utils.ConfigValue.SDRClientForceRelayCluster).value,
    "iad"
  );
  assert.deepEqual(steam.networking.utils.getConfigValueInfo(steam.networking.utils.ConfigValue.TimeoutInitial), {
    value: 24,
    name: "TimeoutInitial",
    dataType: 1,
    scope: 4
  });
  assert.equal(steam.networking.utils.iterateGenericEditableConfigValues(), 24);
  assert.deepEqual(steam.networking.utils.listGenericEditableConfigValues(), [24, 29]);
  assert.equal(steam.networking.utils.enableGlobalCallbacks(), true);
  assert.equal(steam.networking.utils.clearGlobalCallbacks(), true);

  let debugEvent;
  const debugHandle = steam.networking.utils.registerDebugOutputHook(
    steam.networking.utils.DebugOutputType.Warning,
    (event) => {
      debugEvent = event;
    }
  );
  fake.networkingDebugOutputHandler({ detail_level: 4, message: "network warning" });
  assert.deepEqual(debugEvent, { detailLevel: 4, message: "network warning" });
  debugHandle.disconnect();

  let authEvent;
  const authStatusHandle = steam.networking.utils.onAuthenticationStatus((event) => {
    authEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamNetAuthenticationStatus)({
    availability: 100,
    debug_message: "auth ready"
  });
  assert.equal(authEvent.debugMessage, "auth ready");

  let relayEvent;
  const relayStatusHandle = steam.networking.utils.onRelayNetworkStatus((event) => {
    relayEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamRelayNetworkStatus)({
    availability: 100,
    ping_measurement_in_progress: true,
    network_config_availability: 100,
    any_relay_availability: 100,
    debug_message: "measurement pending"
  });
  assert.equal(relayEvent.pingMeasurementInProgress, true);
  assert.equal(relayEvent.networkConfigAvailability, 100);
  assert.equal(relayEvent.anyRelayAvailability, 100);
  assert.equal(relayEvent.debugMessage, "measurement pending");
  authStatusHandle.disconnect();
  relayStatusHandle.disconnect();
  assert.deepEqual(
    fake.calls.filter(
      (call) =>
        call.method === "disconnectCallback" &&
        [
          steam.SteamCallback.SteamNetAuthenticationStatus,
          steam.SteamCallback.SteamRelayNetworkStatus
        ].includes(call.args[0])
    ),
    [
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamNetAuthenticationStatus] },
      { method: "disconnectCallback", args: [steam.SteamCallback.SteamRelayNetworkStatus] }
    ]
  );

  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsIpAddressToString"), {
    method: "networkingUtilsIpAddressToString",
    args: [{ ipv4: 2130706433, port: 27015 }, true]
  });
  assert.deepEqual(
    fake.calls
      .filter((call) => call.method === "networkingUtilsIpAddressToString")
      .map((call) => call.args),
    [
      [{ ipv4: 2130706433, port: 27015 }, true],
      [{ ipv6: Buffer.from("00000000000000000000ffff7f000001", "hex"), port: 27015 }, false]
    ]
  );
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsIpAddressEquals"), {
    method: "networkingUtilsIpAddressEquals",
    args: [{ ipv4: 2130706433, port: 27015 }, { text: "127.0.0.1:27015" }]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsIdentityGetPsnId"), {
    method: "networkingUtilsIdentityGetPsnId",
    args: [{ psnId: 123456789n }]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsIdentityGetXboxPairwiseId"), {
    method: "networkingUtilsIdentityGetXboxPairwiseId",
    args: [{ xboxPairwiseId: "xbox-pairwise-id" }]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsIdentityGetIpAddress"), {
    method: "networkingUtilsIdentityGetIpAddress",
    args: [{ ipAddress: { text: "127.0.0.1:27015" } }]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsIdentityGetIpv4"), {
    method: "networkingUtilsIdentityGetIpv4",
    args: [{ ipv4: 2130706433, port: 27015 }]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsIdentityGetGenericBytes"), {
    method: "networkingUtilsIdentityGetGenericBytes",
    args: [{ genericBytes: Buffer.from([1, 2, 3]) }]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsSetConfigValueInt64"), {
    method: "networkingUtilsSetConfigValueInt64",
    args: [40, 4, 77, 9223372036854775807n]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsSetGlobalConfigValueInt32"), {
    method: "networkingUtilsSetGlobalConfigValueInt32",
    args: [24, 5000]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsSetGlobalConfigValueFloat"), {
    method: "networkingUtilsSetGlobalConfigValueFloat",
    args: [2, 12.5]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsSetGlobalConfigValueString"), {
    method: "networkingUtilsSetGlobalConfigValueString",
    args: [29, "iad"]
  });
  assert.deepEqual(
    fake.calls
      .filter((call) => call.method === "networkingUtilsSetGlobalConfigValuePtr")
      .map((call) => call.args),
    [
      [207, 0x1234n],
      [207, null]
    ]
  );
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsSetConnectionConfigValueInt32"), {
    method: "networkingUtilsSetConnectionConfigValueInt32",
    args: [77, 24, 2500]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsSetConnectionConfigValueFloat"), {
    method: "networkingUtilsSetConnectionConfigValueFloat",
    args: [77, 2, 1.25]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsSetConnectionConfigValueString"), {
    method: "networkingUtilsSetConnectionConfigValueString",
    args: [77, 29, "ord"]
  });
  assert.deepEqual(
    fake.calls
      .filter((call) => call.method === "networkingUtilsSetConfigValueStruct")
      .map((call) => call.args),
    [
      [{ value: 2, dataType: 3, floatValue: 3.5 }, 1, 0],
      [{ value: 29, stringValue: "iad" }, 1, 0],
      [{ value: 40, int64Value: 123n }, 4, 77],
      [{ value: 207, dataType: 5, pointerValue: 0x1234n }, 1, 0]
    ]
  );
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsRegisterDebugOutputHook"), {
    method: "networkingUtilsRegisterDebugOutputHook",
    args: [4]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsEnableGlobalCallbacks"), {
    method: "networkingUtilsEnableGlobalCallbacks",
    args: []
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "networkingUtilsClearGlobalCallbacks"), {
    method: "networkingUtilsClearGlobalCallbacks",
    args: []
  });
  assert.equal(fake.calls.some((call) => call.method === "disconnectNetworkingDebugOutputHook"), true);
});

test("http facade covers request lifecycle, response reads, and callbacks", async (t) => {
  const fake = createFakeNative({
    httpCreateRequest(method, url) {
      this.calls.push({ method: "httpCreateRequest", args: [method, url] });
      return 100;
    },
    httpSetContextValue(request, contextValue) {
      this.calls.push({ method: "httpSetContextValue", args: [request, contextValue] });
      return true;
    },
    httpSetNetworkActivityTimeout(request, timeoutSeconds) {
      this.calls.push({ method: "httpSetNetworkActivityTimeout", args: [request, timeoutSeconds] });
      return true;
    },
    httpSetHeaderValue(request, name, value) {
      this.calls.push({ method: "httpSetHeaderValue", args: [request, name, value] });
      return true;
    },
    httpSetGetOrPostParameter(request, name, value) {
      this.calls.push({ method: "httpSetGetOrPostParameter", args: [request, name, value] });
      return true;
    },
    httpSendRequest(request, timeoutSeconds) {
      this.calls.push({ method: "httpSendRequest", args: [request, timeoutSeconds] });
      return Promise.resolve({
        request,
        context_value: "99",
        request_successful: true,
        status_code: 200,
        body_size: 2
      });
    },
    httpSendRequestAndStreamResponse(request, timeoutSeconds) {
      this.calls.push({ method: "httpSendRequestAndStreamResponse", args: [request, timeoutSeconds] });
      return Promise.resolve({ request, contextValue: 99n });
    },
    httpDeferRequest(request) {
      this.calls.push({ method: "httpDeferRequest", args: [request] });
      return true;
    },
    httpPrioritizeRequest(request) {
      this.calls.push({ method: "httpPrioritizeRequest", args: [request] });
      return true;
    },
    httpGetResponseHeaderSize(request, name) {
      this.calls.push({ method: "httpGetResponseHeaderSize", args: [request, name] });
      return name === "missing" ? null : 16;
    },
    httpGetResponseHeaderValue(request, name) {
      this.calls.push({ method: "httpGetResponseHeaderValue", args: [request, name] });
      return name === "missing" ? undefined : "application/json";
    },
    httpGetResponseBodySize(request) {
      this.calls.push({ method: "httpGetResponseBodySize", args: [request] });
      return 2;
    },
    httpGetResponseBodyData(request) {
      this.calls.push({ method: "httpGetResponseBodyData", args: [request] });
      return Buffer.from("ok");
    },
    httpGetStreamingResponseBodyData(request, offset, size) {
      this.calls.push({ method: "httpGetStreamingResponseBodyData", args: [request, offset, size] });
      return Buffer.from("chunk");
    },
    httpReleaseRequest(request) {
      this.calls.push({ method: "httpReleaseRequest", args: [request] });
      return true;
    },
    httpGetDownloadProgressPercent(request) {
      this.calls.push({ method: "httpGetDownloadProgressPercent", args: [request] });
      return 0.5;
    },
    httpSetRawPostBody(request, contentType, body) {
      this.calls.push({ method: "httpSetRawPostBody", args: [request, contentType, body] });
      return Buffer.isBuffer(body);
    },
    httpCreateCookieContainer(allowResponsesToModify) {
      this.calls.push({ method: "httpCreateCookieContainer", args: [allowResponsesToModify] });
      return 77;
    },
    httpReleaseCookieContainer(container) {
      this.calls.push({ method: "httpReleaseCookieContainer", args: [container] });
      return true;
    },
    httpSetCookie(container, host, url, cookie) {
      this.calls.push({ method: "httpSetCookie", args: [container, host, url, cookie] });
      return true;
    },
    httpSetRequestCookieContainer(request, container) {
      this.calls.push({ method: "httpSetRequestCookieContainer", args: [request, container] });
      return true;
    },
    httpSetUserAgentInfo(request, userAgent) {
      this.calls.push({ method: "httpSetUserAgentInfo", args: [request, userAgent] });
      return true;
    },
    httpSetRequiresVerifiedCertificate(request, requireVerifiedCertificate) {
      this.calls.push({ method: "httpSetRequiresVerifiedCertificate", args: [request, requireVerifiedCertificate] });
      return true;
    },
    httpSetAbsoluteTimeoutMs(request, timeoutMs) {
      this.calls.push({ method: "httpSetAbsoluteTimeoutMs", args: [request, timeoutMs] });
      return true;
    },
    httpGetRequestWasTimedOut(request) {
      this.calls.push({ method: "httpGetRequestWasTimedOut", args: [request] });
      return false;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const request = steam.http.createRequest(steam.http.HttpMethod.Post, "https://example.invalid/api");
  assert.equal(request, 100);
  assert.equal(steam.http.setContextValue(request, 99n), true);
  assert.equal(steam.http.setNetworkActivityTimeout(request, 15), true);
  assert.equal(steam.http.setHeaderValue(request, "Accept", "application/json"), true);
  assert.equal(steam.http.setGetOrPostParameter(request, "query", "value"), true);
  assert.deepEqual(await steam.http.sendRequest(request, 3), {
    request: 100,
    contextValue: 99n,
    requestSuccessful: true,
    statusCode: 200,
    bodySize: 2
  });
  assert.deepEqual(await steam.http.sendRequestAndStreamResponse(request), {
    request: 100,
    contextValue: 99n
  });
  assert.equal(steam.http.deferRequest(request), true);
  assert.equal(steam.http.prioritizeRequest(request), true);
  assert.equal(steam.http.getResponseHeaderSize(request, "Content-Type"), 16);
  assert.equal(steam.http.getResponseHeaderSize(request, "missing"), null);
  assert.equal(steam.http.getResponseHeaderValue(request, "Content-Type"), "application/json");
  assert.equal(steam.http.getResponseHeaderValue(request, "missing"), null);
  assert.equal(steam.http.getResponseBodySize(request), 2);
  assert.equal(steam.http.getResponseBodyData(request).toString(), "ok");
  assert.equal(steam.http.getStreamingResponseBodyData(request, 0, 5).toString(), "chunk");
  assert.equal(steam.http.getDownloadProgressPercent(request), 0.5);
  assert.equal(steam.http.setRawPostBody(request, "application/json", new Uint8Array([123, 125])), true);
  assert.equal(steam.http.releaseRequest(request), true);

  const container = steam.http.createCookieContainer(true);
  assert.equal(container, 77);
  assert.equal(steam.http.setCookie(container, "example.invalid", "/", "session=test"), true);
  assert.equal(steam.http.setRequestCookieContainer(request, container), true);
  assert.equal(steam.http.setUserAgentInfo(request, "steam-bridge-test"), true);
  assert.equal(steam.http.setRequiresVerifiedCertificate(request, true), true);
  assert.equal(steam.http.setAbsoluteTimeoutMs(request, 2000), true);
  assert.equal(steam.http.getRequestWasTimedOut(request), false);
  assert.equal(steam.http.releaseCookieContainer(container), true);

  steam.callback.register(steam.SteamCallback.HTTPRequestDataReceived, () => {});
  assert.equal(fake.callbacks.has(steam.SteamCallback.HTTPRequestDataReceived), true);
  assert.deepEqual(fake.calls.find((call) => call.method === "httpCreateRequest"), {
    method: "httpCreateRequest",
    args: [steam.http.HttpMethod.Post, "https://example.invalid/api"]
  });
});

test("game server HTTP facade covers request lifecycle and response reads", async (t) => {
  const fake = createFakeNative({
    gameServerHttpCreateRequest(method, url) {
      this.calls.push({ method: "gameServerHttpCreateRequest", args: [method, url] });
      return 200;
    },
    gameServerHttpSetContextValue(request, contextValue) {
      this.calls.push({ method: "gameServerHttpSetContextValue", args: [request, contextValue] });
      return true;
    },
    gameServerHttpSetNetworkActivityTimeout(request, timeoutSeconds) {
      this.calls.push({ method: "gameServerHttpSetNetworkActivityTimeout", args: [request, timeoutSeconds] });
      return true;
    },
    gameServerHttpSetHeaderValue(request, name, value) {
      this.calls.push({ method: "gameServerHttpSetHeaderValue", args: [request, name, value] });
      return true;
    },
    gameServerHttpSetGetOrPostParameter(request, name, value) {
      this.calls.push({ method: "gameServerHttpSetGetOrPostParameter", args: [request, name, value] });
      return true;
    },
    gameServerHttpSendRequest(request, timeoutSeconds) {
      this.calls.push({ method: "gameServerHttpSendRequest", args: [request, timeoutSeconds] });
      return Promise.resolve({
        request,
        context_value: "123",
        request_successful: true,
        status_code: 204,
        body_size: 0
      });
    },
    gameServerHttpSendRequestAndStreamResponse(request, timeoutSeconds) {
      this.calls.push({ method: "gameServerHttpSendRequestAndStreamResponse", args: [request, timeoutSeconds] });
      return Promise.resolve({ request, contextValue: 123n });
    },
    gameServerHttpDeferRequest(request) {
      this.calls.push({ method: "gameServerHttpDeferRequest", args: [request] });
      return true;
    },
    gameServerHttpPrioritizeRequest(request) {
      this.calls.push({ method: "gameServerHttpPrioritizeRequest", args: [request] });
      return true;
    },
    gameServerHttpGetResponseHeaderSize(request, name) {
      this.calls.push({ method: "gameServerHttpGetResponseHeaderSize", args: [request, name] });
      return name === "missing" ? null : 12;
    },
    gameServerHttpGetResponseHeaderValue(request, name) {
      this.calls.push({ method: "gameServerHttpGetResponseHeaderValue", args: [request, name] });
      return name === "missing" ? undefined : "text/plain";
    },
    gameServerHttpGetResponseBodySize(request) {
      this.calls.push({ method: "gameServerHttpGetResponseBodySize", args: [request] });
      return 4;
    },
    gameServerHttpGetResponseBodyData(request) {
      this.calls.push({ method: "gameServerHttpGetResponseBodyData", args: [request] });
      return Buffer.from("pong");
    },
    gameServerHttpGetStreamingResponseBodyData(request, offset, size) {
      this.calls.push({ method: "gameServerHttpGetStreamingResponseBodyData", args: [request, offset, size] });
      return Buffer.from("part");
    },
    gameServerHttpReleaseRequest(request) {
      this.calls.push({ method: "gameServerHttpReleaseRequest", args: [request] });
      return true;
    },
    gameServerHttpGetDownloadProgressPercent(request) {
      this.calls.push({ method: "gameServerHttpGetDownloadProgressPercent", args: [request] });
      return 1;
    },
    gameServerHttpSetRawPostBody(request, contentType, body) {
      this.calls.push({ method: "gameServerHttpSetRawPostBody", args: [request, contentType, body] });
      return Buffer.isBuffer(body);
    },
    gameServerHttpCreateCookieContainer(allowResponsesToModify) {
      this.calls.push({ method: "gameServerHttpCreateCookieContainer", args: [allowResponsesToModify] });
      return 88;
    },
    gameServerHttpReleaseCookieContainer(container) {
      this.calls.push({ method: "gameServerHttpReleaseCookieContainer", args: [container] });
      return true;
    },
    gameServerHttpSetCookie(container, host, url, cookie) {
      this.calls.push({ method: "gameServerHttpSetCookie", args: [container, host, url, cookie] });
      return true;
    },
    gameServerHttpSetRequestCookieContainer(request, container) {
      this.calls.push({ method: "gameServerHttpSetRequestCookieContainer", args: [request, container] });
      return true;
    },
    gameServerHttpSetUserAgentInfo(request, userAgent) {
      this.calls.push({ method: "gameServerHttpSetUserAgentInfo", args: [request, userAgent] });
      return true;
    },
    gameServerHttpSetRequiresVerifiedCertificate(request, requireVerifiedCertificate) {
      this.calls.push({
        method: "gameServerHttpSetRequiresVerifiedCertificate",
        args: [request, requireVerifiedCertificate]
      });
      return true;
    },
    gameServerHttpSetAbsoluteTimeoutMs(request, timeoutMs) {
      this.calls.push({ method: "gameServerHttpSetAbsoluteTimeoutMs", args: [request, timeoutMs] });
      return true;
    },
    gameServerHttpGetRequestWasTimedOut(request) {
      this.calls.push({ method: "gameServerHttpGetRequestWasTimedOut", args: [request] });
      return false;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const request = steam.gameServerHttp.createRequest(steam.gameServerHttp.HttpMethod.Head, "https://example.invalid/ping");
  assert.equal(request, 200);
  assert.equal(steam.gameServerHttp.setContextValue(request, 123n), true);
  assert.equal(steam.gameServerHttp.setNetworkActivityTimeout(request, 5), true);
  assert.equal(steam.gameServerHttp.setHeaderValue(request, "Accept", "text/plain"), true);
  assert.equal(steam.gameServerHttp.setGetOrPostParameter(request, "server", "spacewar"), true);
  assert.deepEqual(await steam.gameServerHttp.sendRequest(request, 2), {
    request: 200,
    contextValue: 123n,
    requestSuccessful: true,
    statusCode: 204,
    bodySize: 0
  });
  assert.deepEqual(await steam.gameServerHttp.sendRequestAndStreamResponse(request), {
    request: 200,
    contextValue: 123n
  });
  assert.equal(steam.gameServerHttp.deferRequest(request), true);
  assert.equal(steam.gameServerHttp.prioritizeRequest(request), true);
  assert.equal(steam.gameServerHttp.getResponseHeaderSize(request, "Content-Type"), 12);
  assert.equal(steam.gameServerHttp.getResponseHeaderSize(request, "missing"), null);
  assert.equal(steam.gameServerHttp.getResponseHeaderValue(request, "Content-Type"), "text/plain");
  assert.equal(steam.gameServerHttp.getResponseHeaderValue(request, "missing"), null);
  assert.equal(steam.gameServerHttp.getResponseBodySize(request), 4);
  assert.equal(steam.gameServerHttp.getResponseBodyData(request).toString(), "pong");
  assert.equal(steam.gameServerHttp.getStreamingResponseBodyData(request, 0, 4).toString(), "part");
  assert.equal(steam.gameServerHttp.getDownloadProgressPercent(request), 1);
  assert.equal(steam.gameServerHttp.setRawPostBody(request, "text/plain", new Uint8Array([112, 105, 110, 103])), true);
  assert.equal(steam.gameServerHttp.releaseRequest(request), true);

  const container = steam.gameServerHttp.createCookieContainer(true);
  assert.equal(container, 88);
  assert.equal(steam.gameServerHttp.setCookie(container, "example.invalid", "/", "server=test"), true);
  assert.equal(steam.gameServerHttp.setRequestCookieContainer(request, container), true);
  assert.equal(steam.gameServerHttp.setUserAgentInfo(request, "steam-bridge-server-test"), true);
  assert.equal(steam.gameServerHttp.setRequiresVerifiedCertificate(request, true), true);
  assert.equal(steam.gameServerHttp.setAbsoluteTimeoutMs(request, 1000), true);
  assert.equal(steam.gameServerHttp.getRequestWasTimedOut(request), false);
  assert.equal(steam.gameServerHttp.releaseCookieContainer(container), true);

  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerHttpCreateRequest"), {
    method: "gameServerHttpCreateRequest",
    args: [steam.gameServerHttp.HttpMethod.Head, "https://example.invalid/ping"]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerHttpSendRequest"), {
    method: "gameServerHttpSendRequest",
    args: [request, 2]
  });
});

test("http facades expose typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  let completedEvent;
  let headersEvent;
  let dataEvent;
  const handles = [
    steam.http.onRequestCompleted((event) => {
      completedEvent = event;
    }),
    steam.http.onRequestHeadersReceived((event) => {
      headersEvent = event;
    }),
    steam.http.onRequestDataReceived((event) => {
      dataEvent = event;
    })
  ];

  fake.callbacks.get(steam.SteamCallback.HTTPRequestCompleted)({
    request: 11,
    context_value: "9007199254740993",
    request_successful: true,
    status_code: 206,
    body_size: 4096
  });
  fake.callbacks.get(steam.SteamCallback.HTTPRequestHeadersReceived)({
    request: 12,
    context_value: "9007199254740994"
  });
  fake.callbacks.get(steam.SteamCallback.HTTPRequestDataReceived)({
    request: 13,
    context_value: "9007199254740995",
    offset: 128,
    bytes_received: 512
  });

  assert.equal(completedEvent.contextValue, 9007199254740993n);
  assert.equal(completedEvent.requestSuccessful, true);
  assert.equal(completedEvent.statusCode, 206);
  assert.equal(completedEvent.bodySize, 4096);
  assert.equal(headersEvent.contextValue, 9007199254740994n);
  assert.equal(dataEvent.contextValue, 9007199254740995n);
  assert.equal(dataEvent.bytesReceived, 512);

  handles.forEach((handle) => handle.disconnect());

  let serverDataEvent;
  const serverHandle = steam.gameServerHttp.onRequestDataReceived((event) => {
    serverDataEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.HTTPRequestDataReceived)({
    request: 14,
    context_value: "9007199254740996",
    offset: 256,
    bytes_received: 1024
  });
  assert.equal(serverDataEvent.contextValue, 9007199254740996n);
  assert.equal(serverDataEvent.bytesReceived, 1024);
  serverHandle.disconnect();

  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback"),
    [
      { method: "registerSteamCallback", args: [steam.SteamCallback.HTTPRequestCompleted] },
      { method: "registerSteamCallback", args: [steam.SteamCallback.HTTPRequestHeadersReceived] },
      { method: "registerSteamCallback", args: [steam.SteamCallback.HTTPRequestDataReceived] },
      { method: "registerSteamCallback", args: [steam.SteamCallback.HTTPRequestDataReceived] }
    ]
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback"),
    [
      { method: "disconnectCallback", args: [steam.SteamCallback.HTTPRequestCompleted] },
      { method: "disconnectCallback", args: [steam.SteamCallback.HTTPRequestHeadersReceived] },
      { method: "disconnectCallback", args: [steam.SteamCallback.HTTPRequestDataReceived] },
      { method: "disconnectCallback", args: [steam.SteamCallback.HTTPRequestDataReceived] }
    ]
  );
});

test("html facade exposes typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const events = {};
  const handles = [
    steam.html.onBrowserReady((event) => {
      events.browserReady = event;
    }),
    steam.html.onNeedsPaint((event) => {
      events.needsPaint = event;
    }),
    steam.html.onStartRequest((event) => {
      events.startRequest = event;
    }),
    steam.html.onCloseBrowser((event) => {
      events.closeBrowser = event;
    }),
    steam.html.onUrlChanged((event) => {
      events.urlChanged = event;
    }),
    steam.html.onFinishedRequest((event) => {
      events.finishedRequest = event;
    }),
    steam.html.onOpenLinkInNewTab((event) => {
      events.openLinkInNewTab = event;
    }),
    steam.html.onChangedTitle((event) => {
      events.changedTitle = event;
    }),
    steam.html.onSearchResults((event) => {
      events.searchResults = event;
    }),
    steam.html.onCanGoBackAndForward((event) => {
      events.canGoBackAndForward = event;
    }),
    steam.html.onHorizontalScroll((event) => {
      events.horizontalScroll = event;
    }),
    steam.html.onVerticalScroll((event) => {
      events.verticalScroll = event;
    }),
    steam.html.onLinkAtPosition((event) => {
      events.linkAtPosition = event;
    }),
    steam.html.onJsAlert((event) => {
      events.jsAlert = event;
    }),
    steam.html.onJsConfirm((event) => {
      events.jsConfirm = event;
    }),
    steam.html.onFileOpenDialog((event) => {
      events.fileOpenDialog = event;
    }),
    steam.html.onNewWindow((event) => {
      events.newWindow = event;
    }),
    steam.html.onSetCursor((event) => {
      events.setCursor = event;
    }),
    steam.html.onStatusText((event) => {
      events.statusText = event;
    }),
    steam.html.onShowToolTip((event) => {
      events.showToolTip = event;
    }),
    steam.html.onUpdateToolTip((event) => {
      events.updateToolTip = event;
    }),
    steam.html.onHideToolTip((event) => {
      events.hideToolTip = event;
    }),
    steam.html.onBrowserRestarted((event) => {
      events.browserRestarted = event;
    })
  ];
  const callbackNames = [
    "HTMLBrowserReady",
    "HTMLNeedsPaint",
    "HTMLStartRequest",
    "HTMLCloseBrowser",
    "HTMLURLChanged",
    "HTMLFinishedRequest",
    "HTMLOpenLinkInNewTab",
    "HTMLChangedTitle",
    "HTMLSearchResults",
    "HTMLCanGoBackAndForward",
    "HTMLHorizontalScroll",
    "HTMLVerticalScroll",
    "HTMLLinkAtPosition",
    "HTMLJSAlert",
    "HTMLJSConfirm",
    "HTMLFileOpenDialog",
    "HTMLNewWindow",
    "HTMLSetCursor",
    "HTMLStatusText",
    "HTMLShowToolTip",
    "HTMLUpdateToolTip",
    "HTMLHideToolTip",
    "HTMLBrowserRestarted"
  ];
  const emit = (callbackName, payload) => {
    fake.callbacks.get(steam.SteamCallback[callbackName])(payload);
  };

  emit("HTMLBrowserReady", { browser_handle: 55 });
  emit("HTMLNeedsPaint", {
    browser_handle: 55,
    has_bgra_data: true,
    bgra_byte_length: 4,
    bgra_base64: Buffer.from([4, 3, 2, 1]).toString("base64"),
    bgra_truncated: false,
    wide: 1,
    tall: 1,
    update_x: 2,
    update_y: 3,
    update_wide: 4,
    update_tall: 5,
    scroll_x: 6,
    scroll_y: 7,
    page_scale: 1.5,
    page_serial: 8
  });
  emit("HTMLStartRequest", {
    browser_handle: 55,
    url: "https://example.invalid/start",
    target: "_blank",
    post_data: "a=b",
    is_redirect: true
  });
  emit("HTMLCloseBrowser", { browser_handle: 55 });
  emit("HTMLURLChanged", {
    browser_handle: 55,
    url: "https://example.invalid/next",
    post_data: "c=d",
    is_redirect: false,
    page_title: "Next",
    new_navigation: true
  });
  emit("HTMLFinishedRequest", {
    browser_handle: 55,
    url: "https://example.invalid/done",
    page_title: "Done"
  });
  emit("HTMLOpenLinkInNewTab", {
    browser_handle: 55,
    url: "https://example.invalid/tab"
  });
  emit("HTMLChangedTitle", {
    browser_handle: 55,
    title: "Changed"
  });
  emit("HTMLSearchResults", {
    browser_handle: 55,
    results: 9,
    current_match: 3
  });
  emit("HTMLCanGoBackAndForward", {
    browser_handle: 55,
    can_go_back: true,
    can_go_forward: false
  });
  emit("HTMLHorizontalScroll", {
    browser_handle: 55,
    scroll_max: 100,
    scroll_current: 25,
    page_scale: 1.25,
    visible: true,
    page_size: 50
  });
  emit("HTMLVerticalScroll", {
    browser_handle: 55,
    scroll_max: 200,
    scroll_current: 75,
    page_scale: 1.75,
    visible: false,
    page_size: 80
  });
  emit("HTMLLinkAtPosition", {
    browser_handle: 55,
    x: 10,
    y: 20,
    url: "https://example.invalid/link",
    input: true,
    live_link: false
  });
  emit("HTMLJSAlert", { browser_handle: 55, message: "alert" });
  emit("HTMLJSConfirm", { browser_handle: 55, message: "confirm" });
  emit("HTMLFileOpenDialog", {
    browser_handle: 55,
    title: "Open",
    initial_file: "/tmp/file.txt"
  });
  emit("HTMLNewWindow", {
    browser_handle: 55,
    url: "https://example.invalid/new",
    x: 1,
    y: 2,
    wide: 640,
    tall: 360,
    new_window_browser_handle: 77
  });
  emit("HTMLSetCursor", { browser_handle: 55, mouse_cursor: steam.html.MouseCursor.Hand });
  emit("HTMLStatusText", { browser_handle: 55, message: "status" });
  emit("HTMLShowToolTip", { browser_handle: 55, message: "show" });
  emit("HTMLUpdateToolTip", { browser_handle: 55, message: "update" });
  emit("HTMLHideToolTip", { browser_handle: 55 });
  emit("HTMLBrowserRestarted", {
    browser_handle: 56,
    old_browser_handle: 55
  });

  assert.equal(events.browserReady.browserHandle, 55);
  assert.deepEqual(events.needsPaint.bgra, Buffer.from([4, 3, 2, 1]));
  assert.equal(events.needsPaint.hasBgraData, true);
  assert.equal(events.needsPaint.updateWide, 4);
  assert.equal(events.needsPaint.scrollY, 7);
  assert.equal(events.startRequest.postData, "a=b");
  assert.equal(events.startRequest.isRedirect, true);
  assert.equal(events.closeBrowser.browserHandle, 55);
  assert.equal(events.urlChanged.pageTitle, "Next");
  assert.equal(events.urlChanged.newNavigation, true);
  assert.equal(events.finishedRequest.pageTitle, "Done");
  assert.equal(events.openLinkInNewTab.url, "https://example.invalid/tab");
  assert.equal(events.changedTitle.title, "Changed");
  assert.equal(events.searchResults.currentMatch, 3);
  assert.equal(events.canGoBackAndForward.canGoBack, true);
  assert.equal(events.canGoBackAndForward.canGoForward, false);
  assert.equal(events.horizontalScroll.scrollCurrent, 25);
  assert.equal(events.horizontalScroll.pageSize, 50);
  assert.equal(events.verticalScroll.scrollCurrent, 75);
  assert.equal(events.verticalScroll.visible, false);
  assert.equal(events.linkAtPosition.liveLink, false);
  assert.equal(events.jsAlert.message, "alert");
  assert.equal(events.jsConfirm.message, "confirm");
  assert.equal(events.fileOpenDialog.initialFile, "/tmp/file.txt");
  assert.equal(events.newWindow.newWindowBrowserHandle, 77);
  assert.equal(events.setCursor.mouseCursor, steam.html.MouseCursor.Hand);
  assert.equal(events.statusText.message, "status");
  assert.equal(events.showToolTip.message, "show");
  assert.equal(events.updateToolTip.message, "update");
  assert.equal(events.hideToolTip.browserHandle, 55);
  assert.equal(events.browserRestarted.oldBrowserHandle, 55);

  handles.forEach((handle) => handle.disconnect());

  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback").map((call) => call.args[0]),
    callbackNames.map((callbackName) => steam.SteamCallback[callbackName])
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback").map((call) => call.args[0]),
    callbackNames.map((callbackName) => steam.SteamCallback[callbackName])
  );
});

test("html facade covers browser lifecycle, input, and callbacks", async (t) => {
  const fake = createFakeNative({
    htmlInit() {
      this.calls.push({ method: "htmlInit", args: [] });
      return true;
    },
    htmlShutdown() {
      this.calls.push({ method: "htmlShutdown", args: [] });
      return true;
    },
    htmlCreateBrowser(userAgent, userCss, timeoutSeconds) {
      this.calls.push({ method: "htmlCreateBrowser", args: [userAgent, userCss, timeoutSeconds] });
      return Promise.resolve(55);
    },
    htmlRemoveBrowser(browser) {
      this.calls.push({ method: "htmlRemoveBrowser", args: [browser] });
    },
    htmlLoadUrl(browser, url, postData) {
      this.calls.push({ method: "htmlLoadUrl", args: [browser, url, postData] });
    },
    htmlSetSize(browser, width, height) {
      this.calls.push({ method: "htmlSetSize", args: [browser, width, height] });
    },
    htmlStopLoad(browser) {
      this.calls.push({ method: "htmlStopLoad", args: [browser] });
    },
    htmlReload(browser) {
      this.calls.push({ method: "htmlReload", args: [browser] });
    },
    htmlGoBack(browser) {
      this.calls.push({ method: "htmlGoBack", args: [browser] });
    },
    htmlGoForward(browser) {
      this.calls.push({ method: "htmlGoForward", args: [browser] });
    },
    htmlAddHeader(browser, key, value) {
      this.calls.push({ method: "htmlAddHeader", args: [browser, key, value] });
    },
    htmlExecuteJavascript(browser, script) {
      this.calls.push({ method: "htmlExecuteJavascript", args: [browser, script] });
    },
    htmlMouseUp(browser, mouseButton) {
      this.calls.push({ method: "htmlMouseUp", args: [browser, mouseButton] });
    },
    htmlMouseDown(browser, mouseButton) {
      this.calls.push({ method: "htmlMouseDown", args: [browser, mouseButton] });
    },
    htmlMouseDoubleClick(browser, mouseButton) {
      this.calls.push({ method: "htmlMouseDoubleClick", args: [browser, mouseButton] });
    },
    htmlMouseMove(browser, x, y) {
      this.calls.push({ method: "htmlMouseMove", args: [browser, x, y] });
    },
    htmlMouseWheel(browser, delta) {
      this.calls.push({ method: "htmlMouseWheel", args: [browser, delta] });
    },
    htmlKeyDown(browser, nativeKeyCode, keyModifiers, isSystemKey) {
      this.calls.push({ method: "htmlKeyDown", args: [browser, nativeKeyCode, keyModifiers, isSystemKey] });
    },
    htmlKeyUp(browser, nativeKeyCode, keyModifiers) {
      this.calls.push({ method: "htmlKeyUp", args: [browser, nativeKeyCode, keyModifiers] });
    },
    htmlKeyChar(browser, unicodeChar, keyModifiers) {
      this.calls.push({ method: "htmlKeyChar", args: [browser, unicodeChar, keyModifiers] });
    },
    htmlSetHorizontalScroll(browser, absolutePixelScroll) {
      this.calls.push({ method: "htmlSetHorizontalScroll", args: [browser, absolutePixelScroll] });
    },
    htmlSetVerticalScroll(browser, absolutePixelScroll) {
      this.calls.push({ method: "htmlSetVerticalScroll", args: [browser, absolutePixelScroll] });
    },
    htmlSetKeyFocus(browser, hasKeyFocus) {
      this.calls.push({ method: "htmlSetKeyFocus", args: [browser, hasKeyFocus] });
    },
    htmlViewSource(browser) {
      this.calls.push({ method: "htmlViewSource", args: [browser] });
    },
    htmlCopyToClipboard(browser) {
      this.calls.push({ method: "htmlCopyToClipboard", args: [browser] });
    },
    htmlPasteFromClipboard(browser) {
      this.calls.push({ method: "htmlPasteFromClipboard", args: [browser] });
    },
    htmlFind(browser, search, currentlyInFind, reverse) {
      this.calls.push({ method: "htmlFind", args: [browser, search, currentlyInFind, reverse] });
    },
    htmlStopFind(browser) {
      this.calls.push({ method: "htmlStopFind", args: [browser] });
    },
    htmlGetLinkAtPosition(browser, x, y) {
      this.calls.push({ method: "htmlGetLinkAtPosition", args: [browser, x, y] });
    },
    htmlSetCookie(hostname, key, value, cookiePath, expires, secure, httpOnly) {
      this.calls.push({ method: "htmlSetCookie", args: [hostname, key, value, cookiePath, expires, secure, httpOnly] });
    },
    htmlSetPageScaleFactor(browser, zoom, pointX, pointY) {
      this.calls.push({ method: "htmlSetPageScaleFactor", args: [browser, zoom, pointX, pointY] });
    },
    htmlSetBackgroundMode(browser, backgroundMode) {
      this.calls.push({ method: "htmlSetBackgroundMode", args: [browser, backgroundMode] });
    },
    htmlSetDpiScalingFactor(browser, dpiScaling) {
      this.calls.push({ method: "htmlSetDpiScalingFactor", args: [browser, dpiScaling] });
    },
    htmlOpenDeveloperTools(browser) {
      this.calls.push({ method: "htmlOpenDeveloperTools", args: [browser] });
    },
    htmlAllowStartRequest(browser, allowed) {
      this.calls.push({ method: "htmlAllowStartRequest", args: [browser, allowed] });
    },
    htmlJsDialogResponse(browser, result) {
      this.calls.push({ method: "htmlJsDialogResponse", args: [browser, result] });
    },
    htmlFileLoadDialogResponse(browser, selectedFiles) {
      this.calls.push({ method: "htmlFileLoadDialogResponse", args: [browser, selectedFiles] });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.SteamCallback.HTMLBrowserReady, 4501);
  assert.equal(steam.SteamCallback.HTMLNeedsPaint, 4502);
  assert.equal(steam.SteamCallback.HTMLStartRequest, 4503);
  assert.equal(steam.SteamCallback.HTMLBrowserRestarted, 4527);
  assert.equal(steam.html.MouseButton.Left, 0);
  assert.equal(steam.html.MouseCursor.Hand, 20);
  assert.equal(steam.html.MouseCursor.Last, 41);
  assert.equal(steam.html.KeyModifier.ShiftDown, 4);
  const ctrlShift = steam.html.KeyModifier.CtrlDown | steam.html.KeyModifier.ShiftDown;
  assert.equal(ctrlShift, 6);

  assert.equal(steam.html.init(), true);
  const browser = await steam.html.createBrowser({
    userAgent: "steam-bridge-test",
    userCss: "body { color: white; }",
    timeoutSeconds: 2
  });
  assert.equal(browser, 55);

  steam.html.loadUrl(browser, "https://example.invalid/", "a=b");
  steam.html.setSize(browser, 640, 360);
  steam.html.addHeader(browser, "Accept", "text/html");
  steam.html.executeJavascript(browser, "window.__steamBridge = true");
  steam.html.mouseDown(browser, steam.html.MouseButton.Left);
  steam.html.mouseUp(browser, steam.html.MouseButton.Left);
  steam.html.mouseDoubleClick(browser, steam.html.MouseButton.Middle);
  steam.html.mouseMove(browser, 10, 20);
  steam.html.mouseWheel(browser, -120);
  steam.html.keyDown(browser, 65, ctrlShift, false);
  steam.html.keyUp(browser, 65, steam.html.KeyModifier.ShiftDown);
  steam.html.keyChar(browser, 65, steam.html.KeyModifier.ShiftDown);
  steam.html.setHorizontalScroll(browser, 12);
  steam.html.setVerticalScroll(browser, 24);
  steam.html.setKeyFocus(browser, true);
  steam.html.viewSource(browser);
  steam.html.copyToClipboard(browser);
  steam.html.pasteFromClipboard(browser);
  steam.html.find(browser, "space", false, true);
  steam.html.stopFind(browser);
  steam.html.getLinkAtPosition(browser, 5, 6);
  steam.html.setCookie("example.invalid", "session", "test", {
    path: "/",
    expires: 1234567890,
    secure: true,
    httpOnly: true
  });
  steam.html.setPageScaleFactor(browser, 1.25, 10, 20);
  steam.html.setBackgroundMode(browser, true);
  steam.html.setDpiScalingFactor(browser, 2);
  steam.html.openDeveloperTools(browser);
  steam.html.allowStartRequest(browser, true);
  steam.html.jsDialogResponse(browser, false);
  steam.html.fileLoadDialogResponse(browser, ["/tmp/file.txt"]);
  steam.html.stopLoad(browser);
  steam.html.reload(browser);
  steam.html.goBack(browser);
  steam.html.goForward(browser);
  steam.html.removeBrowser(browser);
  assert.equal(steam.html.shutdown(), true);

  assert.deepEqual(
    fake.calls.filter((call) => call.method.startsWith("html")).map((call) => call.method),
    [
      "htmlInit",
      "htmlCreateBrowser",
      "htmlLoadUrl",
      "htmlSetSize",
      "htmlAddHeader",
      "htmlExecuteJavascript",
      "htmlMouseDown",
      "htmlMouseUp",
      "htmlMouseDoubleClick",
      "htmlMouseMove",
      "htmlMouseWheel",
      "htmlKeyDown",
      "htmlKeyUp",
      "htmlKeyChar",
      "htmlSetHorizontalScroll",
      "htmlSetVerticalScroll",
      "htmlSetKeyFocus",
      "htmlViewSource",
      "htmlCopyToClipboard",
      "htmlPasteFromClipboard",
      "htmlFind",
      "htmlStopFind",
      "htmlGetLinkAtPosition",
      "htmlSetCookie",
      "htmlSetPageScaleFactor",
      "htmlSetBackgroundMode",
      "htmlSetDpiScalingFactor",
      "htmlOpenDeveloperTools",
      "htmlAllowStartRequest",
      "htmlJsDialogResponse",
      "htmlFileLoadDialogResponse",
      "htmlStopLoad",
      "htmlReload",
      "htmlGoBack",
      "htmlGoForward",
      "htmlRemoveBrowser",
      "htmlShutdown"
    ]
  );
  assert.deepEqual(fake.calls.find((call) => call.method === "htmlCreateBrowser"), {
    method: "htmlCreateBrowser",
    args: ["steam-bridge-test", "body { color: white; }", 2]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "htmlKeyDown"), {
    method: "htmlKeyDown",
    args: [browser, 65, 6, false]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "htmlSetCookie"), {
    method: "htmlSetCookie",
    args: ["example.invalid", "session", "test", "/", 1234567890, true, true]
  });

  let paintEvent;
  steam.callback.register(steam.SteamCallback.HTMLNeedsPaint, (event) => {
    paintEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.HTMLNeedsPaint)({
    browser_handle: 55,
    has_bgra_data: true,
    bgra_byte_length: 4,
    bgra_base64: Buffer.from([0, 1, 2, 3]).toString("base64"),
    bgra_truncated: false,
    page_scale: 1,
    page_serial: 7,
    update_x: 1,
    update_y: 2,
    update_wide: 3,
    update_tall: 4,
    scroll_x: 5,
    scroll_y: 6
  });

  assert.equal(paintEvent.browserHandle, 55);
  assert.equal(paintEvent.hasBgraData, true);
  assert.equal(paintEvent.bgraByteLength, 4);
  assert.deepEqual(paintEvent.bgra, Buffer.from([0, 1, 2, 3]));
  assert.equal(paintEvent.bgraTruncated, false);
  assert.equal(paintEvent.pageScale, 1);
  assert.equal(paintEvent.pageSerial, 7);
  assert.equal(paintEvent.updateWide, 3);
  assert.equal(paintEvent.scrollY, 6);

  let urlEvent;
  steam.callback.register(steam.SteamCallback.HTMLURLChanged, (event) => {
    urlEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.HTMLURLChanged)({
    browser_handle: 55,
    url: "https://example.invalid/next",
    post_data: "a=b",
    is_redirect: true,
    page_title: "Example",
    new_navigation: false
  });

  assert.equal(urlEvent.browserHandle, 55);
  assert.equal(urlEvent.postData, "a=b");
  assert.equal(urlEvent.isRedirect, true);
  assert.equal(urlEvent.pageTitle, "Example");
  assert.equal(urlEvent.newNavigation, false);
});

test("parties facade covers party beacon lifecycle and callbacks", async (t) => {
  const owner = { steamId64: "76561198000000009", steamId32: "STEAM_0:1:19867140", accountId: 39734281 };
  const fake = createFakeNative({
    partiesGetNumActiveBeacons() {
      this.calls.push({ method: "partiesGetNumActiveBeacons", args: [] });
      return 2;
    },
    partiesGetBeaconByIndex(index) {
      this.calls.push({ method: "partiesGetBeaconByIndex", args: [index] });
      return index === 0 ? "700" : null;
    },
    partiesGetActiveBeacons() {
      this.calls.push({ method: "partiesGetActiveBeacons", args: [] });
      return ["700", 701n];
    },
    partiesGetBeaconDetails(beacon) {
      this.calls.push({ method: "partiesGetBeaconDetails", args: [beacon] });
      return {
        beacon,
        owner,
        location: { location_type: 1, location_id: "900" },
        metadata: "mode=coop"
      };
    },
    partiesJoinParty(beacon, timeoutSeconds) {
      this.calls.push({ method: "partiesJoinParty", args: [beacon, timeoutSeconds] });
      return Promise.resolve({ result: 1, beacon, owner, connect_string: "connect 127.0.0.1" });
    },
    partiesGetNumAvailableBeaconLocations() {
      this.calls.push({ method: "partiesGetNumAvailableBeaconLocations", args: [] });
      return 1;
    },
    partiesGetAvailableBeaconLocations(maxLocations) {
      this.calls.push({ method: "partiesGetAvailableBeaconLocations", args: [maxLocations] });
      return [{ locationType: 1, locationId: "900" }];
    },
    partiesCreateBeacon(openSlots, location, connectString, metadata, timeoutSeconds) {
      this.calls.push({ method: "partiesCreateBeacon", args: [openSlots, location, connectString, metadata, timeoutSeconds] });
      return Promise.resolve({ result: 1, beacon: "702" });
    },
    partiesOnReservationCompleted(beacon, steamId64) {
      this.calls.push({ method: "partiesOnReservationCompleted", args: [beacon, steamId64] });
    },
    partiesCancelReservation(beacon, steamId64) {
      this.calls.push({ method: "partiesCancelReservation", args: [beacon, steamId64] });
    },
    partiesChangeNumOpenSlots(beacon, openSlots, timeoutSeconds) {
      this.calls.push({ method: "partiesChangeNumOpenSlots", args: [beacon, openSlots, timeoutSeconds] });
      return Promise.resolve({ result: 1 });
    },
    partiesDestroyBeacon(beacon) {
      this.calls.push({ method: "partiesDestroyBeacon", args: [beacon] });
      return true;
    },
    partiesGetBeaconLocationData(location, data) {
      this.calls.push({ method: "partiesGetBeaconLocationData", args: [location, data] });
      return data === 1 ? "Chat Group" : null;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.parties.getNumActiveBeacons(), 2);
  assert.equal(steam.parties.getBeaconByIndex(0), 700n);
  assert.equal(steam.parties.getBeaconByIndex(1), null);
  assert.deepEqual(steam.parties.getActiveBeacons(), [700n, 701n]);
  assert.deepEqual(steam.parties.getBeaconDetails(700n), {
    beacon: 700n,
    owner: {
      steamId64: 76561198000000009n,
      steamId32: "STEAM_0:1:19867140",
      accountId: 39734281
    },
    location: {
      locationType: steam.parties.PartyBeaconLocationType.ChatGroup,
      locationId: 900n
    },
    metadata: "mode=coop"
  });
  assert.deepEqual(await steam.parties.joinParty(700n, 3), {
    result: 1,
    beacon: 700n,
    owner: {
      steamId64: 76561198000000009n,
      steamId32: "STEAM_0:1:19867140",
      accountId: 39734281
    },
    connectString: "connect 127.0.0.1"
  });
  assert.equal(steam.parties.getNumAvailableBeaconLocations(), 1);
  assert.deepEqual(steam.parties.getAvailableBeaconLocations(4), [
    {
      locationType: steam.parties.PartyBeaconLocationType.ChatGroup,
      locationId: 900n
    }
  ]);
  assert.deepEqual(
    await steam.parties.createBeacon(
      3,
      { locationType: steam.parties.PartyBeaconLocationType.ChatGroup, locationId: 900n },
      "connect 127.0.0.1",
      "mode=coop",
      5
    ),
    { result: 1, beacon: 702n }
  );
  steam.parties.onReservationCompleted(702n, 76561198000000009n);
  steam.parties.cancelReservation(702n, 76561198000000009n);
  assert.deepEqual(await steam.parties.changeNumOpenSlots(702n, 2, 6), { result: 1 });
  assert.equal(steam.parties.destroyBeacon(702n), true);
  assert.equal(
    steam.parties.getBeaconLocationData(
      { locationType: steam.parties.PartyBeaconLocationType.ChatGroup, locationId: 900n },
      steam.parties.PartyBeaconLocationData.Name
    ),
    "Chat Group"
  );
  assert.equal(
    steam.parties.getBeaconLocationData(
      { locationType: steam.parties.PartyBeaconLocationType.ChatGroup, locationId: 900n },
      steam.parties.PartyBeaconLocationData.IconURLSmall
    ),
    null
  );

  steam.callback.register(steam.SteamCallback.ReservationNotification, () => {});
  assert.equal(fake.callbacks.has(steam.SteamCallback.ReservationNotification), true);
  assert.deepEqual(fake.calls.find((call) => call.method === "partiesCreateBeacon"), {
    method: "partiesCreateBeacon",
    args: [
      3,
      { locationType: steam.parties.PartyBeaconLocationType.ChatGroup, locationId: 900n },
      "connect 127.0.0.1",
      "mode=coop",
      5
    ]
  });
});

test("parties facade exposes typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const events = {};
  const handles = [
    steam.parties.onJoinParty((event) => {
      events.joinParty = event;
    }),
    steam.parties.onCreateBeacon((event) => {
      events.createBeacon = event;
    }),
    steam.parties.onReservationNotification((event) => {
      events.reservationNotification = event;
    }),
    steam.parties.onChangeNumOpenSlots((event) => {
      events.changeNumOpenSlots = event;
    }),
    steam.parties.onAvailableBeaconLocationsUpdated((event) => {
      events.availableBeaconLocationsUpdated = event;
    }),
    steam.parties.onActiveBeaconsUpdated((event) => {
      events.activeBeaconsUpdated = event;
    })
  ];
  const callbackNames = [
    "JoinParty",
    "CreateBeacon",
    "ReservationNotification",
    "ChangeNumOpenSlots",
    "AvailableBeaconLocationsUpdated",
    "ActiveBeaconsUpdated"
  ];
  const emit = (callbackName, payload) => {
    fake.callbacks.get(steam.SteamCallback[callbackName])(payload);
  };

  emit("JoinParty", {
    result: 1,
    beacon: "700",
    owner: "76561198000000009",
    connect_string: "connect 127.0.0.1"
  });
  emit("CreateBeacon", { result: 1, beacon: "701" });
  emit("ReservationNotification", {
    beacon: "701",
    joiner: "76561198000000010"
  });
  emit("ChangeNumOpenSlots", { result: 1 });
  emit("AvailableBeaconLocationsUpdated", {});
  emit("ActiveBeaconsUpdated", {});

  assert.equal(events.joinParty.result, 1);
  assert.equal(events.joinParty.beacon, 700n);
  assert.equal(events.joinParty.owner, 76561198000000009n);
  assert.equal(events.joinParty.connectString, "connect 127.0.0.1");
  assert.equal(events.createBeacon.beacon, 701n);
  assert.equal(events.reservationNotification.beacon, 701n);
  assert.equal(events.reservationNotification.joiner, 76561198000000010n);
  assert.equal(events.changeNumOpenSlots.result, 1);
  assert.deepEqual(events.availableBeaconLocationsUpdated, {});
  assert.deepEqual(events.activeBeaconsUpdated, {});

  handles.forEach((handle) => handle.disconnect());

  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback").map((call) => call.args[0]),
    callbackNames.map((callbackName) => steam.SteamCallback[callbackName])
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback").map((call) => call.args[0]),
    callbackNames.map((callbackName) => steam.SteamCallback[callbackName])
  );
});

test("inventory facade covers result, item, definition, price, and update flows", async (t) => {
  const player = { steamId64: "76561198000000008", steamId32: "STEAM_0:0:19867140", accountId: 39734280 };
  const fake = createFakeNative({
    inventoryGetResultStatus(resultHandle) {
      this.calls.push({ method: "inventoryGetResultStatus", args: [resultHandle] });
      return 1;
    },
    inventoryGetResultItems(resultHandle) {
      this.calls.push({ method: "inventoryGetResultItems", args: [resultHandle] });
      return [{ item_id: "1001", definition: 7, quantity: 2, flags: 1 }];
    },
    inventoryGetResultItemProperty(resultHandle, itemIndex, propertyName) {
      this.calls.push({ method: "inventoryGetResultItemProperty", args: [resultHandle, itemIndex, propertyName] });
      return propertyName === "name" ? "Tool" : null;
    },
    inventoryGetResultTimestamp(resultHandle) {
      this.calls.push({ method: "inventoryGetResultTimestamp", args: [resultHandle] });
      return 1700000000;
    },
    inventoryCheckResultSteamId(resultHandle, steamId64) {
      this.calls.push({ method: "inventoryCheckResultSteamId", args: [resultHandle, steamId64] });
      return true;
    },
    inventoryDestroyResult(resultHandle) {
      this.calls.push({ method: "inventoryDestroyResult", args: [resultHandle] });
    },
    inventoryGetAllItems() {
      this.calls.push({ method: "inventoryGetAllItems", args: [] });
      return 10;
    },
    inventoryGetItemsById(instanceIds) {
      this.calls.push({ method: "inventoryGetItemsById", args: [instanceIds] });
      return 11;
    },
    inventorySerializeResult(resultHandle) {
      this.calls.push({ method: "inventorySerializeResult", args: [resultHandle] });
      return Buffer.from("serialized");
    },
    inventoryDeserializeResult(data) {
      this.calls.push({ method: "inventoryDeserializeResult", args: [data] });
      return 12;
    },
    inventoryGenerateItems(items) {
      this.calls.push({ method: "inventoryGenerateItems", args: [items] });
      return 13;
    },
    inventoryGrantPromoItems() {
      this.calls.push({ method: "inventoryGrantPromoItems", args: [] });
      return 14;
    },
    inventoryAddPromoItem(definition) {
      this.calls.push({ method: "inventoryAddPromoItem", args: [definition] });
      return 15;
    },
    inventoryAddPromoItems(definitions) {
      this.calls.push({ method: "inventoryAddPromoItems", args: [definitions] });
      return 16;
    },
    inventoryConsumeItem(itemId, quantity) {
      this.calls.push({ method: "inventoryConsumeItem", args: [itemId, quantity] });
      return 17;
    },
    inventoryExchangeItems(generate, destroy) {
      this.calls.push({ method: "inventoryExchangeItems", args: [generate, destroy] });
      return 18;
    },
    inventoryTransferItemQuantity(sourceItemId, quantity, destinationItemId) {
      this.calls.push({ method: "inventoryTransferItemQuantity", args: [sourceItemId, quantity, destinationItemId] });
      return 19;
    },
    inventorySendItemDropHeartbeat() {
      this.calls.push({ method: "inventorySendItemDropHeartbeat", args: [] });
    },
    inventoryTriggerItemDrop(dropListDefinition) {
      this.calls.push({ method: "inventoryTriggerItemDrop", args: [dropListDefinition] });
      return 20;
    },
    inventoryTradeItems(tradePartnerSteamId64, give, get) {
      this.calls.push({ method: "inventoryTradeItems", args: [tradePartnerSteamId64, give, get] });
      return 21;
    },
    inventoryLoadItemDefinitions() {
      this.calls.push({ method: "inventoryLoadItemDefinitions", args: [] });
      return true;
    },
    inventoryGetItemDefinitionIds() {
      this.calls.push({ method: "inventoryGetItemDefinitionIds", args: [] });
      return [7, 8];
    },
    inventoryGetItemDefinitionProperty(definition, propertyName) {
      this.calls.push({ method: "inventoryGetItemDefinitionProperty", args: [definition, propertyName] });
      return propertyName === "name" ? "Tool" : "";
    },
    inventoryRequestEligiblePromoItemDefinitionIds(steamId64, timeoutSeconds) {
      this.calls.push({ method: "inventoryRequestEligiblePromoItemDefinitionIds", args: [steamId64, timeoutSeconds] });
      return Promise.resolve({
        result: 1,
        steam_id: player,
        num_eligible_promo_item_defs: 2,
        cached_data: true
      });
    },
    inventoryGetEligiblePromoItemDefinitionIds(steamId64) {
      this.calls.push({ method: "inventoryGetEligiblePromoItemDefinitionIds", args: [steamId64] });
      return [7, 8];
    },
    inventoryStartPurchase(items, timeoutSeconds) {
      this.calls.push({ method: "inventoryStartPurchase", args: [items, timeoutSeconds] });
      return Promise.resolve({ result: 1, order_id: "555", transaction_id: 666n });
    },
    inventoryRequestPrices(timeoutSeconds) {
      this.calls.push({ method: "inventoryRequestPrices", args: [timeoutSeconds] });
      return Promise.resolve({ result: 1, currency: "USD" });
    },
    inventoryGetNumItemsWithPrices() {
      this.calls.push({ method: "inventoryGetNumItemsWithPrices", args: [] });
      return 2;
    },
    inventoryGetItemsWithPrices(maxItems) {
      this.calls.push({ method: "inventoryGetItemsWithPrices", args: [maxItems] });
      return [{ definition: 7, current_price: "199", base_price: 299n }];
    },
    inventoryGetItemPrice(definition) {
      this.calls.push({ method: "inventoryGetItemPrice", args: [definition] });
      return definition === 7 ? { definition: 7, current_price: "199", base_price: 299n } : null;
    },
    inventoryStartUpdateProperties() {
      this.calls.push({ method: "inventoryStartUpdateProperties", args: [] });
      return "77";
    },
    inventoryRemoveProperty(updateHandle, itemId, propertyName) {
      this.calls.push({ method: "inventoryRemoveProperty", args: [updateHandle, itemId, propertyName] });
      return true;
    },
    inventorySetPropertyString(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "inventorySetPropertyString", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    inventorySetPropertyBool(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "inventorySetPropertyBool", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    inventorySetPropertyInt64(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "inventorySetPropertyInt64", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    inventorySetPropertyFloat(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "inventorySetPropertyFloat", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    inventorySubmitUpdateProperties(updateHandle) {
      this.calls.push({ method: "inventorySubmitUpdateProperties", args: [updateHandle] });
      return 22;
    },
    inventoryInspectItem(itemToken) {
      this.calls.push({ method: "inventoryInspectItem", args: [itemToken] });
      return 23;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.inventory.InventoryItemFlags.NoTrade, 1);
  assert.equal(steam.inventory.getResultStatus(10), 1);
  assert.deepEqual(steam.inventory.getResultItems(10), [{ itemId: 1001n, definition: 7, quantity: 2, flags: 1 }]);
  assert.equal(steam.inventory.getResultItemProperty(10, 0, "name"), "Tool");
  assert.equal(steam.inventory.getResultItemProperty(10, 0), null);
  assert.equal(steam.inventory.getResultTimestamp(10), 1700000000);
  assert.equal(steam.inventory.checkResultSteamId(10, 76561198000000008n), true);
  steam.inventory.destroyResult(10);
  assert.equal(steam.inventory.getAllItems(), 10);
  assert.equal(steam.inventory.getItemsById([1001n]), 11);
  assert.equal(steam.inventory.serializeResult(10).toString(), "serialized");
  assert.equal(steam.inventory.deserializeResult(new Uint8Array([1, 2, 3])), 12);
  assert.equal(steam.inventory.generateItems([{ definition: 7, quantity: 2 }]), 13);
  assert.equal(steam.inventory.grantPromoItems(), 14);
  assert.equal(steam.inventory.addPromoItem(7), 15);
  assert.equal(steam.inventory.addPromoItems([7, 8]), 16);
  assert.equal(steam.inventory.consumeItem(1001n, 1), 17);
  assert.equal(
    steam.inventory.exchangeItems([{ definition: 7, quantity: 1 }], [{ itemId: 1001n, quantity: 1 }]),
    18
  );
  assert.equal(steam.inventory.transferItemQuantity(1001n, 1, 1002n), 19);
  assert.equal(steam.inventory.transferItemQuantity(1001n, 1, null), 19);
  steam.inventory.sendItemDropHeartbeat();
  assert.equal(steam.inventory.triggerItemDrop(9), 20);
  assert.equal(steam.inventory.tradeItems(76561198000000008n, [{ itemId: 1001n, quantity: 1 }], [{ itemId: 1002n, quantity: 1 }]), 21);
  assert.equal(steam.inventory.loadItemDefinitions(), true);
  assert.deepEqual(steam.inventory.getItemDefinitionIds(), [7, 8]);
  assert.equal(steam.inventory.getItemDefinitionProperty(7, "name"), "Tool");
  assert.equal(steam.inventory.getItemDefinitionProperty(7), "");
  assert.deepEqual(await steam.inventory.requestEligiblePromoItemDefinitionIds(76561198000000008n, 4), {
    result: 1,
    steamId: { steamId64: 76561198000000008n, steamId32: "STEAM_0:0:19867140", accountId: 39734280 },
    numEligiblePromoItemDefs: 2,
    cachedData: true
  });
  assert.deepEqual(steam.inventory.getEligiblePromoItemDefinitionIds(76561198000000008n), [7, 8]);
  assert.deepEqual(await steam.inventory.startPurchase([{ definition: 7, quantity: 1 }], 5), {
    result: 1,
    orderId: 555n,
    transactionId: 666n
  });
  assert.deepEqual(await steam.inventory.requestPrices(6), { result: 1, currency: "USD" });
  assert.equal(steam.inventory.getNumItemsWithPrices(), 2);
  assert.deepEqual(steam.inventory.getItemsWithPrices(10), [{ definition: 7, currentPrice: 199n, basePrice: 299n }]);
  assert.deepEqual(steam.inventory.getItemPrice(7), { definition: 7, currentPrice: 199n, basePrice: 299n });
  assert.equal(steam.inventory.getItemPrice(999), null);

  const updateHandle = steam.inventory.startUpdateProperties();
  assert.equal(updateHandle, 77n);
  assert.equal(steam.inventory.removeProperty(updateHandle, 1001n, "rarity"), true);
  assert.equal(steam.inventory.setPropertyString(updateHandle, 1001n, "name", "Tool"), true);
  assert.equal(steam.inventory.setPropertyBool(updateHandle, 1001n, "equipped", true), true);
  assert.equal(steam.inventory.setPropertyInt64(updateHandle, 1001n, "serial", 123n), true);
  assert.equal(steam.inventory.setPropertyFloat(updateHandle, 1001n, "wear", 0.5), true);
  assert.equal(steam.inventory.submitUpdateProperties(updateHandle), 22);
  assert.equal(steam.inventory.inspectItem("inspect-token"), 23);

  let purchaseEvent;
  steam.callback.register(steam.SteamCallback.SteamInventoryStartPurchaseResult, (event) => {
    purchaseEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamInventoryStartPurchaseResult)({
    result: 1,
    order_id: "555",
    transaction_id: "666"
  });
  assert.equal(purchaseEvent.orderId, 555n);
  assert.equal(purchaseEvent.transactionId, 666n);

  let promoEvent;
  steam.callback.register(steam.SteamCallback.SteamInventoryEligiblePromoItemDefIds, (event) => {
    promoEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.SteamInventoryEligiblePromoItemDefIds)({
    result: 1,
    steam_id: "76561198000000008",
    num_eligible_promo_item_defs: 2,
    cached_data: true
  });
  assert.equal(promoEvent.steam_id, 76561198000000008n);
  assert.equal(promoEvent.steamId, 76561198000000008n);
  assert.equal(promoEvent.numEligiblePromoItemDefs, 2);
  assert.equal(promoEvent.cachedData, true);

  steam.callback.register(steam.SteamCallback.SteamInventoryResultReady, () => {});
  assert.equal(fake.callbacks.has(steam.SteamCallback.SteamInventoryResultReady), true);
  assert.deepEqual(fake.calls.find((call) => call.method === "inventoryStartPurchase"), {
    method: "inventoryStartPurchase",
    args: [[{ definition: 7, quantity: 1 }], 5]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "inventoryExchangeItems"), {
    method: "inventoryExchangeItems",
    args: [[{ definition: 7, quantity: 1 }], [{ itemId: 1001n, quantity: 1 }]]
  });
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "inventoryTransferItemQuantity").map((call) => call.args),
    [
      [1001n, 1, 1002n],
      [1001n, 1, undefined]
    ]
  );
  assert.deepEqual(fake.calls.find((call) => call.method === "inventoryTradeItems"), {
    method: "inventoryTradeItems",
    args: [76561198000000008n, [{ itemId: 1001n, quantity: 1 }], [{ itemId: 1002n, quantity: 1 }]]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "inventorySubmitUpdateProperties"), {
    method: "inventorySubmitUpdateProperties",
    args: [77n]
  });
});

test("inventory facades expose typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const events = {};
  const callbackNames = [
    "SteamInventoryResultReady",
    "SteamInventoryFullUpdate",
    "SteamInventoryDefinitionUpdate",
    "SteamInventoryEligiblePromoItemDefIds",
    "SteamInventoryStartPurchaseResult",
    "SteamInventoryRequestPricesResult"
  ];
  const handles = [
    steam.inventory.onResultReady((event) => {
      events.resultReady = event;
    }),
    steam.inventory.onFullUpdate((event) => {
      events.fullUpdate = event;
    }),
    steam.inventory.onDefinitionUpdate((event) => {
      events.definitionUpdate = event;
    }),
    steam.inventory.onEligiblePromoItemDefIds((event) => {
      events.eligiblePromoItemDefIds = event;
    }),
    steam.inventory.onStartPurchaseResult((event) => {
      events.startPurchaseResult = event;
    }),
    steam.inventory.onRequestPricesResult((event) => {
      events.requestPricesResult = event;
    })
  ];
  const emit = (callbackName, payload) => {
    fake.callbacks.get(steam.SteamCallback[callbackName])(payload);
  };

  emit("SteamInventoryResultReady", { handle: 10, result: 1 });
  emit("SteamInventoryFullUpdate", { handle: 11 });
  emit("SteamInventoryDefinitionUpdate", {});
  emit("SteamInventoryEligiblePromoItemDefIds", {
    result: 1,
    steam_id: "76561198000000008",
    num_eligible_promo_item_defs: 2,
    cached_data: true
  });
  emit("SteamInventoryStartPurchaseResult", {
    result: 1,
    order_id: "9223372036854775807",
    transaction_id: "9223372036854775808"
  });
  emit("SteamInventoryRequestPricesResult", { result: 1, currency: "USD" });

  assert.equal(events.resultReady.handle, 10);
  assert.equal(events.resultReady.result, 1);
  assert.equal(events.fullUpdate.handle, 11);
  assert.deepEqual(events.definitionUpdate, {});
  assert.equal(events.eligiblePromoItemDefIds.steamId, 76561198000000008n);
  assert.equal(events.eligiblePromoItemDefIds.numEligiblePromoItemDefs, 2);
  assert.equal(events.eligiblePromoItemDefIds.cachedData, true);
  assert.equal(events.startPurchaseResult.orderId, 9223372036854775807n);
  assert.equal(events.startPurchaseResult.transactionId, 9223372036854775808n);
  assert.equal(events.requestPricesResult.currency, "USD");

  handles.forEach((handle) => handle.disconnect());

  const serverHandles = [
    steam.gameServerInventory.onResultReady(() => {}),
    steam.gameServerInventory.onFullUpdate(() => {}),
    steam.gameServerInventory.onDefinitionUpdate(() => {}),
    steam.gameServerInventory.onEligiblePromoItemDefIds(() => {}),
    steam.gameServerInventory.onStartPurchaseResult(() => {}),
    steam.gameServerInventory.onRequestPricesResult(() => {})
  ];
  serverHandles.forEach((handle) => handle.disconnect());

  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback").map((call) => call.args[0]),
    [...callbackNames, ...callbackNames].map((callbackName) => steam.SteamCallback[callbackName])
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback").map((call) => call.args[0]),
    [...callbackNames, ...callbackNames].map((callbackName) => steam.SteamCallback[callbackName])
  );
});

test("game server inventory facade uses game-server native bindings", async (t) => {
  const player = { steamId64: "76561198000000009", steamId32: "STEAM_0:1:19867140", accountId: 39734281 };
  const fake = createFakeNative({
    gameServerInventoryGetResultStatus(resultHandle) {
      this.calls.push({ method: "gameServerInventoryGetResultStatus", args: [resultHandle] });
      return 1;
    },
    gameServerInventoryGetResultItems(resultHandle) {
      this.calls.push({ method: "gameServerInventoryGetResultItems", args: [resultHandle] });
      return [{ item_id: "2001", definition: 17, quantity: 3, flags: 1 }];
    },
    gameServerInventoryGetResultItemProperty(resultHandle, itemIndex, propertyName) {
      this.calls.push({
        method: "gameServerInventoryGetResultItemProperty",
        args: [resultHandle, itemIndex, propertyName]
      });
      return propertyName === "name" ? "Server Tool" : null;
    },
    gameServerInventoryGetResultTimestamp(resultHandle) {
      this.calls.push({ method: "gameServerInventoryGetResultTimestamp", args: [resultHandle] });
      return 1700000300;
    },
    gameServerInventoryCheckResultSteamId(resultHandle, steamId64) {
      this.calls.push({ method: "gameServerInventoryCheckResultSteamId", args: [resultHandle, steamId64] });
      return true;
    },
    gameServerInventoryDestroyResult(resultHandle) {
      this.calls.push({ method: "gameServerInventoryDestroyResult", args: [resultHandle] });
    },
    gameServerInventoryGetAllItems() {
      this.calls.push({ method: "gameServerInventoryGetAllItems", args: [] });
      return 34;
    },
    gameServerInventoryGetItemsById(instanceIds) {
      this.calls.push({ method: "gameServerInventoryGetItemsById", args: [instanceIds] });
      return 35;
    },
    gameServerInventorySerializeResult(resultHandle) {
      this.calls.push({ method: "gameServerInventorySerializeResult", args: [resultHandle] });
      return Buffer.from("server-serialized");
    },
    gameServerInventoryDeserializeResult(data) {
      this.calls.push({ method: "gameServerInventoryDeserializeResult", args: [data] });
      return 36;
    },
    gameServerInventoryGenerateItems(items) {
      this.calls.push({ method: "gameServerInventoryGenerateItems", args: [items] });
      return 31;
    },
    gameServerInventoryGrantPromoItems() {
      this.calls.push({ method: "gameServerInventoryGrantPromoItems", args: [] });
      return 37;
    },
    gameServerInventoryAddPromoItem(definition) {
      this.calls.push({ method: "gameServerInventoryAddPromoItem", args: [definition] });
      return 38;
    },
    gameServerInventoryAddPromoItems(definitions) {
      this.calls.push({ method: "gameServerInventoryAddPromoItems", args: [definitions] });
      return 39;
    },
    gameServerInventoryConsumeItem(itemId, quantity) {
      this.calls.push({ method: "gameServerInventoryConsumeItem", args: [itemId, quantity] });
      return 40;
    },
    gameServerInventoryExchangeItems(generate, destroy) {
      this.calls.push({ method: "gameServerInventoryExchangeItems", args: [generate, destroy] });
      return 32;
    },
    gameServerInventoryTransferItemQuantity(sourceItemId, quantity, destinationItemId) {
      this.calls.push({
        method: "gameServerInventoryTransferItemQuantity",
        args: [sourceItemId, quantity, destinationItemId]
      });
      return 41;
    },
    gameServerInventorySendItemDropHeartbeat() {
      this.calls.push({ method: "gameServerInventorySendItemDropHeartbeat", args: [] });
    },
    gameServerInventoryTriggerItemDrop(dropListDefinition) {
      this.calls.push({ method: "gameServerInventoryTriggerItemDrop", args: [dropListDefinition] });
      return 42;
    },
    gameServerInventoryTradeItems(tradePartnerSteamId64, give, get) {
      this.calls.push({ method: "gameServerInventoryTradeItems", args: [tradePartnerSteamId64, give, get] });
      return 43;
    },
    gameServerInventoryLoadItemDefinitions() {
      this.calls.push({ method: "gameServerInventoryLoadItemDefinitions", args: [] });
      return true;
    },
    gameServerInventoryGetItemDefinitionIds() {
      this.calls.push({ method: "gameServerInventoryGetItemDefinitionIds", args: [] });
      return [17, 18];
    },
    gameServerInventoryGetItemDefinitionProperty(definition, propertyName) {
      this.calls.push({ method: "gameServerInventoryGetItemDefinitionProperty", args: [definition, propertyName] });
      return propertyName === "name" ? "Server Tool" : "";
    },
    gameServerInventoryRequestEligiblePromoItemDefinitionIds(steamId64, timeoutSeconds) {
      this.calls.push({ method: "gameServerInventoryRequestEligiblePromoItemDefinitionIds", args: [steamId64, timeoutSeconds] });
      return Promise.resolve({
        result: 1,
        steam_id: player,
        num_eligible_promo_item_defs: 1,
        cached_data: true
      });
    },
    gameServerInventoryGetEligiblePromoItemDefinitionIds(steamId64) {
      this.calls.push({ method: "gameServerInventoryGetEligiblePromoItemDefinitionIds", args: [steamId64] });
      return [17, 18];
    },
    gameServerInventoryStartPurchase(items, timeoutSeconds) {
      this.calls.push({ method: "gameServerInventoryStartPurchase", args: [items, timeoutSeconds] });
      return Promise.resolve({ result: 1, order_id: "777", transaction_id: 888n });
    },
    gameServerInventoryRequestPrices(timeoutSeconds) {
      this.calls.push({ method: "gameServerInventoryRequestPrices", args: [timeoutSeconds] });
      return Promise.resolve({ result: 1, currency: "USD" });
    },
    gameServerInventoryGetNumItemsWithPrices() {
      this.calls.push({ method: "gameServerInventoryGetNumItemsWithPrices", args: [] });
      return 2;
    },
    gameServerInventoryGetItemsWithPrices(maxItems) {
      this.calls.push({ method: "gameServerInventoryGetItemsWithPrices", args: [maxItems] });
      return [{ definition: 17, current_price: "499", base_price: 599n }];
    },
    gameServerInventoryGetItemPrice(definition) {
      this.calls.push({ method: "gameServerInventoryGetItemPrice", args: [definition] });
      return definition === 17 ? { definition: 17, current_price: "499", base_price: 599n } : null;
    },
    gameServerInventoryStartUpdateProperties() {
      this.calls.push({ method: "gameServerInventoryStartUpdateProperties", args: [] });
      return "91";
    },
    gameServerInventoryRemoveProperty(updateHandle, itemId, propertyName) {
      this.calls.push({ method: "gameServerInventoryRemoveProperty", args: [updateHandle, itemId, propertyName] });
      return true;
    },
    gameServerInventorySetPropertyString(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "gameServerInventorySetPropertyString", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    gameServerInventorySetPropertyBool(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "gameServerInventorySetPropertyBool", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    gameServerInventorySetPropertyInt64(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "gameServerInventorySetPropertyInt64", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    gameServerInventorySetPropertyFloat(updateHandle, itemId, propertyName, value) {
      this.calls.push({ method: "gameServerInventorySetPropertyFloat", args: [updateHandle, itemId, propertyName, value] });
      return true;
    },
    gameServerInventorySubmitUpdateProperties(updateHandle) {
      this.calls.push({ method: "gameServerInventorySubmitUpdateProperties", args: [updateHandle] });
      return 33;
    },
    gameServerInventoryInspectItem(itemToken) {
      this.calls.push({ method: "gameServerInventoryInspectItem", args: [itemToken] });
      return 44;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.deepEqual(Object.keys(steam.gameServerInventory).sort(), Object.keys(steam.inventory).sort());
  assert.equal(steam.gameServerInventory.InventoryItemFlags.NoTrade, 1);
  assert.equal(steam.gameServerInventory.getResultStatus(30), 1);
  assert.deepEqual(steam.gameServerInventory.getResultItems(30), [
    { itemId: 2001n, definition: 17, quantity: 3, flags: 1 }
  ]);
  assert.equal(steam.gameServerInventory.getResultItemProperty(30, 0, "name"), "Server Tool");
  assert.equal(steam.gameServerInventory.getResultItemProperty(30, 0), null);
  assert.equal(steam.gameServerInventory.getResultTimestamp(30), 1700000300);
  assert.equal(steam.gameServerInventory.checkResultSteamId(30, 76561198000000009n), true);
  steam.gameServerInventory.destroyResult(30);
  assert.equal(steam.gameServerInventory.getAllItems(), 34);
  assert.equal(steam.gameServerInventory.getItemsById([2001n]), 35);
  assert.equal(steam.gameServerInventory.serializeResult(30).toString(), "server-serialized");
  assert.equal(steam.gameServerInventory.deserializeResult(new Uint8Array([4, 5, 6])), 36);
  assert.equal(steam.gameServerInventory.generateItems([{ definition: 17, quantity: 3 }]), 31);
  assert.equal(steam.gameServerInventory.grantPromoItems(), 37);
  assert.equal(steam.gameServerInventory.addPromoItem(17), 38);
  assert.equal(steam.gameServerInventory.addPromoItems([17, 18]), 39);
  assert.equal(steam.gameServerInventory.consumeItem(2001n, 1), 40);
  assert.equal(
    steam.gameServerInventory.exchangeItems([{ definition: 17, quantity: 1 }], [{ itemId: 2001n, quantity: 1 }]),
    32
  );
  assert.equal(steam.gameServerInventory.transferItemQuantity(2001n, 1, 2002n), 41);
  assert.equal(steam.gameServerInventory.transferItemQuantity(2001n, 1, null), 41);
  steam.gameServerInventory.sendItemDropHeartbeat();
  assert.equal(steam.gameServerInventory.triggerItemDrop(19), 42);
  assert.equal(
    steam.gameServerInventory.tradeItems(
      76561198000000009n,
      [{ itemId: 2001n, quantity: 1 }],
      [{ itemId: 2002n, quantity: 1 }]
    ),
    43
  );
  assert.equal(steam.gameServerInventory.loadItemDefinitions(), true);
  assert.deepEqual(steam.gameServerInventory.getItemDefinitionIds(), [17, 18]);
  assert.equal(steam.gameServerInventory.getItemDefinitionProperty(17, "name"), "Server Tool");
  assert.equal(steam.gameServerInventory.getItemDefinitionProperty(17), "");
  assert.deepEqual(await steam.gameServerInventory.requestEligiblePromoItemDefinitionIds(76561198000000009n, 4), {
    result: 1,
    steamId: { steamId64: 76561198000000009n, steamId32: "STEAM_0:1:19867140", accountId: 39734281 },
    numEligiblePromoItemDefs: 1,
    cachedData: true
  });
  assert.deepEqual(steam.gameServerInventory.getEligiblePromoItemDefinitionIds(76561198000000009n), [17, 18]);
  assert.deepEqual(await steam.gameServerInventory.startPurchase([{ definition: 17, quantity: 1 }], 5), {
    result: 1,
    orderId: 777n,
    transactionId: 888n
  });
  assert.deepEqual(await steam.gameServerInventory.requestPrices(6), { result: 1, currency: "USD" });
  assert.equal(steam.gameServerInventory.getNumItemsWithPrices(), 2);
  assert.deepEqual(steam.gameServerInventory.getItemsWithPrices(2), [
    { definition: 17, currentPrice: 499n, basePrice: 599n }
  ]);
  assert.deepEqual(steam.gameServerInventory.getItemPrice(17), {
    definition: 17,
    currentPrice: 499n,
    basePrice: 599n
  });
  assert.equal(steam.gameServerInventory.getItemPrice(999), null);
  const updateHandle = steam.gameServerInventory.startUpdateProperties();
  assert.equal(updateHandle, 91n);
  assert.equal(steam.gameServerInventory.removeProperty(updateHandle, 2001n, "rarity"), true);
  assert.equal(steam.gameServerInventory.setPropertyString(updateHandle, 2001n, "name", "Server Tool"), true);
  assert.equal(steam.gameServerInventory.setPropertyBool(updateHandle, 2001n, "equipped", true), true);
  assert.equal(steam.gameServerInventory.setPropertyInt64(updateHandle, 2001n, "serial", 456n), true);
  assert.equal(steam.gameServerInventory.setPropertyFloat(updateHandle, 2001n, "wear", 0.25), true);
  assert.equal(steam.gameServerInventory.submitUpdateProperties(updateHandle), 33);
  assert.equal(steam.gameServerInventory.inspectItem("server-inspect-token"), 44);

  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerInventoryGenerateItems"), {
    method: "gameServerInventoryGenerateItems",
    args: [[{ definition: 17, quantity: 3 }]]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerInventoryExchangeItems"), {
    method: "gameServerInventoryExchangeItems",
    args: [[{ definition: 17, quantity: 1 }], [{ itemId: 2001n, quantity: 1 }]]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerInventoryDeserializeResult"), {
    method: "gameServerInventoryDeserializeResult",
    args: [Buffer.from([4, 5, 6])]
  });
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "gameServerInventoryTransferItemQuantity").map((call) => call.args),
    [
      [2001n, 1, 2002n],
      [2001n, 1, undefined]
    ]
  );
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerInventoryTradeItems"), {
    method: "gameServerInventoryTradeItems",
    args: [76561198000000009n, [{ itemId: 2001n, quantity: 1 }], [{ itemId: 2002n, quantity: 1 }]]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerInventoryStartPurchase"), {
    method: "gameServerInventoryStartPurchase",
    args: [[{ definition: 17, quantity: 1 }], 5]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerInventorySetPropertyInt64"), {
    method: "gameServerInventorySetPropertyInt64",
    args: [91n, 2001n, "serial", 456n]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerInventorySubmitUpdateProperties"), {
    method: "gameServerInventorySubmitUpdateProperties",
    args: [91n]
  });
});

test("stats leaderboard facade normalizes handles, entries, and async results", async (t) => {
  const player = { steamId64: "76561198000000005", steamId32: "STEAM_0:1:19867138", accountId: 39734277 };
  const fake = createFakeNative({
    statsGetInt(name) {
      this.calls.push({ method: "statsGetInt", args: [name] });
      return name === "score" ? 7 : undefined;
    },
    statsSetInt(name, value) {
      this.calls.push({ method: "statsSetInt", args: [name, value] });
      return true;
    },
    statsStore() {
      this.calls.push({ method: "statsStore", args: [] });
      return true;
    },
    statsResetAll(achievementsToo) {
      this.calls.push({ method: "statsResetAll", args: [achievementsToo] });
      return false;
    },
    statsFindOrCreateLeaderboard(name, sortMethod, displayType) {
      this.calls.push({ method: "statsFindOrCreateLeaderboard", args: [name, sortMethod, displayType] });
      return Promise.resolve({ leaderboard: "44", found: true });
    },
    statsFindLeaderboard(name) {
      this.calls.push({ method: "statsFindLeaderboard", args: [name] });
      return Promise.resolve({ leaderboard: 45n, found: false });
    },
    statsGetLeaderboardName(leaderboard) {
      this.calls.push({ method: "statsGetLeaderboardName", args: [leaderboard] });
      return "Daily Score";
    },
    statsGetLeaderboardEntryCount(leaderboard) {
      this.calls.push({ method: "statsGetLeaderboardEntryCount", args: [leaderboard] });
      return 12;
    },
    statsGetLeaderboardSortMethod() {
      return 2;
    },
    statsGetLeaderboardDisplayType() {
      return 1;
    },
    statsDownloadLeaderboardEntries(leaderboard, request, rangeStart, rangeEnd, detailsMax) {
      this.calls.push({ method: "statsDownloadLeaderboardEntries", args: [leaderboard, request, rangeStart, rangeEnd, detailsMax] });
      return Promise.resolve({
        leaderboard,
        entries_handle: "9000",
        entry_count: 1,
        entries: [{ steam_id: player, global_rank: 2, score: 1234, details: [10, 20], ugc: "777" }]
      });
    },
    statsDownloadLeaderboardEntriesForUsers(leaderboard, steamIds64, detailsMax) {
      this.calls.push({ method: "statsDownloadLeaderboardEntriesForUsers", args: [leaderboard, steamIds64, detailsMax] });
      return Promise.resolve({
        leaderboard,
        entriesHandle: 9001n,
        entryCount: 1,
        entries: [{ steamId: player, globalRank: 3, score: 1200, details: [30], ugc: 778n }]
      });
    },
    statsGetDownloadedLeaderboardEntry(entriesHandle, index, detailsMax) {
      this.calls.push({ method: "statsGetDownloadedLeaderboardEntry", args: [entriesHandle, index, detailsMax] });
      return { steam_id: player, global_rank: 4, score: 1100, details: [40, 50], ugc: "779" };
    },
    statsUploadLeaderboardScore(leaderboard, method, score, scoreDetails) {
      this.calls.push({ method: "statsUploadLeaderboardScore", args: [leaderboard, method, score, scoreDetails] });
      return Promise.resolve({
        success: true,
        leaderboard,
        score,
        score_changed: true,
        global_rank_new: 5,
        global_rank_previous: 9
      });
    },
    statsAttachLeaderboardUgc(leaderboard, ugcHandle) {
      this.calls.push({ method: "statsAttachLeaderboardUgc", args: [leaderboard, ugcHandle] });
      return Promise.resolve({ result: 1, leaderboard });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.stats.getInt("score"), 7);
  assert.equal(steam.stats.getInt("missing"), null);
  assert.equal(steam.stats.setInt("score", 8), true);
  assert.equal(steam.stats.store(), true);
  assert.equal(steam.stats.resetAll(true), false);

  assert.deepEqual(
    await steam.stats.findOrCreateLeaderboard(
      "Daily Score",
      steam.stats.LeaderboardSortMethod.Descending,
      steam.stats.LeaderboardDisplayType.Numeric
    ),
    { leaderboard: 44n, found: true }
  );
  assert.deepEqual(await steam.stats.findLeaderboard("Weekly Score"), { leaderboard: 45n, found: false });
  assert.equal(steam.stats.getLeaderboardName(44n), "Daily Score");
  assert.equal(steam.stats.getLeaderboardEntryCount(44n), 12);
  assert.equal(steam.stats.getLeaderboardSortMethod(44n), steam.LeaderboardSortMethod.Descending);
  assert.equal(steam.stats.getLeaderboardDisplayType(44n), steam.LeaderboardDisplayType.Numeric);

  const globalEntries = await steam.stats.downloadLeaderboardEntries(
    44n,
    steam.stats.LeaderboardDataRequest.Global,
    1,
    10,
    2
  );
  assert.equal(globalEntries.entriesHandle, 9000n);
  assert.equal(globalEntries.entryCount, 1);
  assert.deepEqual(globalEntries.entries[0], {
    steamId: { steamId64: 76561198000000005n, steamId32: "STEAM_0:1:19867138", accountId: 39734277 },
    globalRank: 2,
    score: 1234,
    details: [10, 20],
    ugc: 777n
  });

  const userEntries = await steam.stats.downloadLeaderboardEntriesForUsers(44n, [76561198000000005n], 1);
  assert.equal(userEntries.entriesHandle, 9001n);
  assert.equal(userEntries.entries[0].globalRank, 3);
  assert.deepEqual(steam.stats.getDownloadedLeaderboardEntry(9000n, 0, 2), {
    steamId: { steamId64: 76561198000000005n, steamId32: "STEAM_0:1:19867138", accountId: 39734277 },
    globalRank: 4,
    score: 1100,
    details: [40, 50],
    ugc: 779n
  });
  assert.deepEqual(await steam.stats.uploadLeaderboardScore(44n, steam.stats.LeaderboardUploadScoreMethod.KeepBest, 1234, [1, 2]), {
    success: true,
    leaderboard: 44n,
    score: 1234,
    scoreChanged: true,
    globalRankNew: 5,
    globalRankPrevious: 9
  });
  assert.deepEqual(await steam.stats.attachLeaderboardUgc(44n, 777n), { result: 1, leaderboard: 44n });
});

test("stats and achievement facades cover user and global Steam stats", async (t) => {
  const player = { steamId64: "76561198000000006", steamId32: "STEAM_0:0:19867139", accountId: 39734278 };
  const fake = createFakeNative({
    isAchievementActivated(name) {
      this.calls.push({ method: "isAchievementActivated", args: [name] });
      return name === "ACH_WIN";
    },
    achievementActivate(name) {
      this.calls.push({ method: "achievementActivate", args: [name] });
      return true;
    },
    achievementClear(name) {
      this.calls.push({ method: "achievementClear", args: [name] });
      return true;
    },
    achievementNames() {
      this.calls.push({ method: "achievementNames", args: [] });
      return ["ACH_START", "ACH_WIN"];
    },
    achievementGetAndUnlockTime(name) {
      this.calls.push({ method: "achievementGetAndUnlockTime", args: [name] });
      return { achieved: true, unlock_time: 1700000000 };
    },
    achievementGetIcon(name) {
      this.calls.push({ method: "achievementGetIcon", args: [name] });
      return 321;
    },
    achievementGetDisplayAttribute(name, key) {
      this.calls.push({ method: "achievementGetDisplayAttribute", args: [name, key] });
      return `${name}:${key}`;
    },
    achievementIndicateProgress(name, current, max) {
      this.calls.push({ method: "achievementIndicateProgress", args: [name, current, max] });
      return true;
    },
    achievementGetProgressLimitsInt(name) {
      this.calls.push({ method: "achievementGetProgressLimitsInt", args: [name] });
      return { min: 0, max: 100 };
    },
    achievementGetProgressLimitsFloat(name) {
      this.calls.push({ method: "achievementGetProgressLimitsFloat", args: [name] });
      return { min: 0.5, max: 9.5 };
    },
    statsGetFloat(name) {
      this.calls.push({ method: "statsGetFloat", args: [name] });
      return name === "ratio" ? 1.5 : undefined;
    },
    statsSetFloat(name, value) {
      this.calls.push({ method: "statsSetFloat", args: [name, value] });
      return true;
    },
    statsUpdateAvgRate(name, countThisSession, sessionLength) {
      this.calls.push({ method: "statsUpdateAvgRate", args: [name, countThisSession, sessionLength] });
      return true;
    },
    statsRequestUserStats(steamId64) {
      this.calls.push({ method: "statsRequestUserStats", args: [steamId64] });
      return Promise.resolve({ game_id: "480", result: 1, steam_id: player });
    },
    statsGetUserInt(steamId64, name) {
      this.calls.push({ method: "statsGetUserInt", args: [steamId64, name] });
      return 42;
    },
    statsGetUserFloat(steamId64, name) {
      this.calls.push({ method: "statsGetUserFloat", args: [steamId64, name] });
      return 2.5;
    },
    statsGetUserAchievement(steamId64, name) {
      this.calls.push({ method: "statsGetUserAchievement", args: [steamId64, name] });
      return name === "ACH_WIN";
    },
    statsGetUserAchievementAndUnlockTime(steamId64, name) {
      this.calls.push({ method: "statsGetUserAchievementAndUnlockTime", args: [steamId64, name] });
      return { achieved: false, unlockTime: 0 };
    },
    statsGetNumberOfCurrentPlayers() {
      return Promise.resolve({ success: true, players: 123 });
    },
    statsRequestGlobalAchievementPercentages() {
      return Promise.resolve({ game_id: "480", result: 1 });
    },
    statsGetMostAchievedAchievementInfo() {
      return { iterator: 7, name: "ACH_START", percent: 99.5, achieved: true };
    },
    statsGetNextMostAchievedAchievementInfo(previousIterator) {
      this.calls.push({ method: "statsGetNextMostAchievedAchievementInfo", args: [previousIterator] });
      return null;
    },
    statsGetAchievementAchievedPercent(name) {
      this.calls.push({ method: "statsGetAchievementAchievedPercent", args: [name] });
      return 12.5;
    },
    statsRequestGlobalStats(historyDays) {
      this.calls.push({ method: "statsRequestGlobalStats", args: [historyDays] });
      return Promise.resolve({ gameId: 480n, result: 1 });
    },
    statsGetGlobalStatInt(name) {
      this.calls.push({ method: "statsGetGlobalStatInt", args: [name] });
      return "1234567890123";
    },
    statsGetGlobalStatDouble(name) {
      this.calls.push({ method: "statsGetGlobalStatDouble", args: [name] });
      return 123.75;
    },
    statsGetGlobalStatHistoryInt(name, maxEntries) {
      this.calls.push({ method: "statsGetGlobalStatHistoryInt", args: [name, maxEntries] });
      return ["10", 20n, 30];
    },
    statsGetGlobalStatHistoryDouble(name, maxEntries) {
      this.calls.push({ method: "statsGetGlobalStatHistoryDouble", args: [name, maxEntries] });
      return [1.25, 2.5];
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.isAchievementActivated("ACH_WIN"), true);
  assert.equal(steam.achievement.isActivated("ACH_WIN"), true);
  assert.equal(steam.achievement.activate("ACH_WIN"), true);
  assert.equal(steam.achievement.clear("ACH_OLD"), true);
  assert.deepEqual(steam.achievement.names(), ["ACH_START", "ACH_WIN"]);
  assert.deepEqual(steam.achievement.getAndUnlockTime("ACH_WIN"), { achieved: true, unlockTime: 1700000000 });
  assert.equal(steam.achievement.getIcon("ACH_WIN"), 321);
  assert.equal(steam.achievement.getDisplayAttribute("ACH_WIN", "name"), "ACH_WIN:name");
  assert.equal(steam.achievement.indicateProgress("ACH_WIN", 5, 10), true);
  assert.deepEqual(steam.achievement.getProgressLimitsInt("ACH_WIN"), { min: 0, max: 100 });
  assert.deepEqual(steam.achievement.getProgressLimitsFloat("ACH_WIN"), { min: 0.5, max: 9.5 });

  assert.equal(steam.stats.getFloat("ratio"), 1.5);
  assert.equal(steam.stats.getFloat("missing"), null);
  assert.equal(steam.stats.setFloat("ratio", 2.5), true);
  assert.equal(steam.stats.updateAvgRate("distance", 50, 10), true);
  assert.deepEqual(await steam.stats.requestUserStats(76561198000000006n), {
    gameId: 480n,
    result: 1,
    steamId: { steamId64: 76561198000000006n, steamId32: "STEAM_0:0:19867139", accountId: 39734278 }
  });
  assert.equal(steam.stats.getUserInt(76561198000000006n, "score"), 42);
  assert.equal(steam.stats.getUserFloat(76561198000000006n, "ratio"), 2.5);
  assert.equal(steam.stats.getUserAchievement(76561198000000006n, "ACH_WIN"), true);
  assert.deepEqual(steam.stats.getUserAchievementAndUnlockTime(76561198000000006n, "ACH_WIN"), {
    achieved: false,
    unlockTime: 0
  });
  assert.deepEqual(await steam.stats.getNumberOfCurrentPlayers(), { success: true, players: 123 });
  assert.deepEqual(await steam.stats.requestGlobalAchievementPercentages(), { gameId: 480n, result: 1 });
  assert.deepEqual(steam.stats.getMostAchievedAchievementInfo(), {
    iterator: 7,
    name: "ACH_START",
    percent: 99.5,
    achieved: true
  });
  assert.equal(steam.stats.getNextMostAchievedAchievementInfo(7), null);
  assert.equal(steam.stats.getAchievementAchievedPercent("ACH_WIN"), 12.5);
  assert.deepEqual(await steam.stats.requestGlobalStats(60), { gameId: 480n, result: 1 });
  assert.equal(steam.stats.getGlobalStatInt("total_score"), 1234567890123n);
  assert.equal(steam.stats.getGlobalStatDouble("total_ratio"), 123.75);
  assert.deepEqual(steam.stats.getGlobalStatHistoryInt("daily_score", 3), [10n, 20n, 30n]);
  assert.deepEqual(steam.stats.getGlobalStatHistoryDouble("daily_ratio", 2), [1.25, 2.5]);
  assert.deepEqual(fake.calls.filter((call) => call.method === "isAchievementActivated"), [
    { method: "isAchievementActivated", args: ["ACH_WIN"] },
    { method: "isAchievementActivated", args: ["ACH_WIN"] }
  ]);
  assert.deepEqual(fake.calls.find((call) => call.method === "achievementActivate"), {
    method: "achievementActivate",
    args: ["ACH_WIN"]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "achievementClear"), {
    method: "achievementClear",
    args: ["ACH_OLD"]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "achievementNames"), {
    method: "achievementNames",
    args: []
  });
});

test("stats and achievement facades expose typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const events = {};
  const handles = [
    steam.achievement.onStored((event) => {
      events.achievementStored = event;
    }),
    steam.achievement.onIconFetched((event) => {
      events.achievementIconFetched = event;
    }),
    steam.stats.onUserStatsReceived((event) => {
      events.userStatsReceived = event;
    }),
    steam.stats.onUserStatsStored((event) => {
      events.userStatsStored = event;
    }),
    steam.stats.onUserStatsUnloaded((event) => {
      events.userStatsUnloaded = event;
    }),
    steam.stats.onLeaderboardFindResult((event) => {
      events.leaderboardFind = event;
    }),
    steam.stats.onLeaderboardScoresDownloaded((event) => {
      events.leaderboardScores = event;
    }),
    steam.stats.onLeaderboardScoreUploaded((event) => {
      events.leaderboardUpload = event;
    }),
    steam.stats.onNumberOfCurrentPlayers((event) => {
      events.currentPlayers = event;
    }),
    steam.stats.onGlobalAchievementPercentagesReady((event) => {
      events.globalAchievementPercentages = event;
    }),
    steam.stats.onLeaderboardUgcSet((event) => {
      events.leaderboardUgc = event;
    }),
    steam.stats.onGlobalStatsReceived((event) => {
      events.globalStats = event;
    })
  ];

  fake.callbacks.get(steam.SteamCallback.UserAchievementStored)({
    game_id: "480",
    group_achievement: false,
    achievement: "ACH_WIN",
    current_progress: 5,
    max_progress: 10
  });
  fake.callbacks.get(steam.SteamCallback.UserAchievementIconFetched)({
    game_id: "480",
    achievement: "ACH_WIN",
    achieved: true,
    icon_handle: 321
  });
  fake.callbacks.get(steam.SteamCallback.UserStatsReceived)({
    game_id: "480",
    result: 1,
    steam_id: "76561198000000030"
  });
  fake.callbacks.get(steam.SteamCallback.UserStatsStored)({
    game_id: "480",
    result: 1
  });
  fake.callbacks.get(steam.SteamCallback.UserStatsUnloaded)({
    steam_id: "76561198000000031"
  });
  fake.callbacks.get(steam.SteamCallback.LeaderboardFindResult)({ leaderboard: "44", found: true });
  fake.callbacks.get(steam.SteamCallback.LeaderboardScoresDownloaded)({
    leaderboard: "44",
    entries_handle: "9000",
    entry_count: 2
  });
  fake.callbacks.get(steam.SteamCallback.LeaderboardScoreUploaded)({
    success: true,
    leaderboard: "44",
    score: 1234,
    score_changed: true,
    global_rank_new: 3,
    global_rank_previous: 9
  });
  fake.callbacks.get(steam.SteamCallback.NumberOfCurrentPlayers)({ success: true, players: 123 });
  fake.callbacks.get(steam.SteamCallback.GlobalAchievementPercentagesReady)({ game_id: "480", result: 1 });
  fake.callbacks.get(steam.SteamCallback.LeaderboardUGCSet)({ result: 1, leaderboard: "44" });
  fake.callbacks.get(steam.SteamCallback.GlobalStatsReceived)({ game_id: "480", result: 1 });

  assert.equal(events.achievementStored.gameId, 480n);
  assert.equal(events.achievementStored.groupAchievement, false);
  assert.equal(events.achievementStored.currentProgress, 5);
  assert.equal(events.achievementStored.maxProgress, 10);
  assert.equal(events.achievementIconFetched.gameId, 480n);
  assert.equal(events.achievementIconFetched.iconHandle, 321);
  assert.equal(events.userStatsReceived.gameId, 480n);
  assert.equal(events.userStatsReceived.steamId, 76561198000000030n);
  assert.equal(events.userStatsStored.gameId, 480n);
  assert.equal(events.userStatsUnloaded.steamId, 76561198000000031n);
  assert.equal(events.leaderboardFind.leaderboard, 44n);
  assert.equal(events.leaderboardFind.found, true);
  assert.equal(events.leaderboardScores.entriesHandle, 9000n);
  assert.equal(events.leaderboardScores.entryCount, 2);
  assert.equal(events.leaderboardUpload.scoreChanged, true);
  assert.equal(events.leaderboardUpload.globalRankNew, 3);
  assert.equal(events.leaderboardUpload.globalRankPrevious, 9);
  assert.equal(events.currentPlayers.players, 123);
  assert.equal(events.globalAchievementPercentages.gameId, 480n);
  assert.equal(events.leaderboardUgc.leaderboard, 44n);
  assert.equal(events.globalStats.gameId, 480n);

  for (const handle of handles) {
    handle.disconnect();
  }

  const callbackIds = [
    steam.SteamCallback.UserAchievementStored,
    steam.SteamCallback.UserAchievementIconFetched,
    steam.SteamCallback.UserStatsReceived,
    steam.SteamCallback.UserStatsStored,
    steam.SteamCallback.UserStatsUnloaded,
    steam.SteamCallback.LeaderboardFindResult,
    steam.SteamCallback.LeaderboardScoresDownloaded,
    steam.SteamCallback.LeaderboardScoreUploaded,
    steam.SteamCallback.NumberOfCurrentPlayers,
    steam.SteamCallback.GlobalAchievementPercentagesReady,
    steam.SteamCallback.LeaderboardUGCSet,
    steam.SteamCallback.GlobalStatsReceived
  ];
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback"),
    callbackIds.map((callbackId) => ({ method: "registerSteamCallback", args: [callbackId] }))
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback"),
    callbackIds.map((callbackId) => ({ method: "disconnectCallback", args: [callbackId] }))
  );
});

test("game coordinator facade normalizes binary messages", (t) => {
  const fake = createFakeNative({
    gameCoordinatorSendMessage(messageType, data) {
      this.calls.push({ method: "gameCoordinatorSendMessage", args: [messageType, data] });
      return 0;
    },
    gameCoordinatorIsMessageAvailable() {
      this.calls.push({ method: "gameCoordinatorIsMessageAvailable", args: [] });
      return { available: true, message_size: 5 };
    },
    gameCoordinatorRetrieveMessage(maxBytes) {
      this.calls.push({ method: "gameCoordinatorRetrieveMessage", args: [maxBytes] });
      return { result: 0, message_type: 9001, message_size: 5, data: Buffer.from("hello") };
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  let messageAvailableEvent;
  let messageFailedEvent;
  const handles = [
    steam.gameCoordinator.onMessageAvailable((event) => {
      messageAvailableEvent = event;
    }),
    steam.gameCoordinator.onMessageFailed((event) => {
      messageFailedEvent = event;
    })
  ];

  fake.callbacks.get(steam.SteamCallback.GCMessageAvailable)({ message_size: 64 });
  fake.callbacks.get(steam.SteamCallback.GCMessageFailed)({});

  assert.equal(messageAvailableEvent.messageSize, 64);
  assert.deepEqual(messageFailedEvent, {});

  assert.equal(steam.gameCoordinator.GameCoordinatorResult.OK, 0);
  assert.equal(steam.gameCoordinator.sendMessage(9000, "payload"), 0);
  assert.deepEqual(steam.gameCoordinator.isMessageAvailable(), { available: true, messageSize: 5 });
  assert.deepEqual(steam.gameCoordinator.retrieveMessage(32), {
    result: 0,
    messageType: 9001,
    messageSize: 5,
    data: Buffer.from("hello")
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameCoordinatorSendMessage"), {
    method: "gameCoordinatorSendMessage",
    args: [9000, Buffer.from("payload")]
  });

  for (const handle of handles) {
    handle.disconnect();
  }
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback"),
    [
      { method: "registerSteamCallback", args: [steam.SteamCallback.GCMessageAvailable] },
      { method: "registerSteamCallback", args: [steam.SteamCallback.GCMessageFailed] }
    ]
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback"),
    [
      { method: "disconnectCallback", args: [steam.SteamCallback.GCMessageAvailable] },
      { method: "disconnectCallback", args: [steam.SteamCallback.GCMessageFailed] }
    ]
  );
});

test("friends facade normalizes IDs, groups, rich presence, and async results", async (t) => {
  const friend = { steamId64: "76561198000000003", steamId32: "STEAM_0:1:19867137", accountId: 39734275 };
  const clan = { steamId64: "103582791429521412", steamId32: "STEAM_0:0:0", accountId: 0 };
  const friendFlagArgs = [];
  const fake = createFakeNative({
    friendsGetPersonaName() {
      return "Ada";
    },
    friendsGetPersonaState() {
      return 1;
    },
    friendsGetFriendCount(friendFlags) {
      friendFlagArgs.push(friendFlags);
      return 1;
    },
    friendsGetFriendByIndex(index, friendFlags) {
      friendFlagArgs.push({ index, friendFlags });
      return friend;
    },
    friendsGetFriends(friendFlags) {
      friendFlagArgs.push(friendFlags);
      return [friend];
    },
    friendsHasFriend(steamId64, friendFlags) {
      friendFlagArgs.push({ steamId64, friendFlags });
      return true;
    },
    friendsGetFriendRelationship(steamId64) {
      this.calls.push({ method: "friendsGetFriendRelationship", args: [steamId64] });
      return 3;
    },
    friendsGetFriendPersonaState(steamId64) {
      this.calls.push({ method: "friendsGetFriendPersonaState", args: [steamId64] });
      return 1;
    },
    friendsGetFriendPersonaName(steamId64) {
      this.calls.push({ method: "friendsGetFriendPersonaName", args: [steamId64] });
      return "Grace";
    },
    friendsGetFriendPersonaNameHistory(steamId64, index) {
      this.calls.push({ method: "friendsGetFriendPersonaNameHistory", args: [steamId64, index] });
      return "Rear Admiral Grace";
    },
    friendsGetFriendSteamLevel(steamId64) {
      this.calls.push({ method: "friendsGetFriendSteamLevel", args: [steamId64] });
      return 42;
    },
    friendsGetPlayerNickname(steamId64) {
      this.calls.push({ method: "friendsGetPlayerNickname", args: [steamId64] });
      return "debug-pal";
    },
    friendsGetFriendGamePlayed() {
      return { game_id: "480", game_ip: 2130706433, game_port: 27015, query_port: 27016, lobby: "109775242022617907" };
    },
    friendsGetSmallFriendAvatar(steamId64) {
      this.calls.push({ method: "friendsGetSmallFriendAvatar", args: [steamId64] });
      return 11;
    },
    friendsGetMediumFriendAvatar(steamId64) {
      this.calls.push({ method: "friendsGetMediumFriendAvatar", args: [steamId64] });
      return 12;
    },
    friendsGetLargeFriendAvatar(steamId64) {
      this.calls.push({ method: "friendsGetLargeFriendAvatar", args: [steamId64] });
      return 13;
    },
    friendsRequestUserInformation(steamId64, nameOnly) {
      this.calls.push({ method: "friendsRequestUserInformation", args: [steamId64, nameOnly] });
      return true;
    },
    friendsGetFriendsGroups() {
      return [{ id: 7, name: "Co-op", members: [friend] }];
    },
    friendsGetClanCount() {
      this.calls.push({ method: "friendsGetClanCount", args: [] });
      return 1;
    },
    friendsGetClanByIndex(index) {
      this.calls.push({ method: "friendsGetClanByIndex", args: [index] });
      return clan;
    },
    friendsGetClans() {
      this.calls.push({ method: "friendsGetClans", args: [] });
      return [clan];
    },
    friendsGetClanName(clanId64) {
      this.calls.push({ method: "friendsGetClanName", args: [clanId64] });
      return "SpaceWar Testers";
    },
    friendsGetClanTag(clanId64) {
      this.calls.push({ method: "friendsGetClanTag", args: [clanId64] });
      return "SWT";
    },
    friendsGetClanActivityCounts() {
      return { online: 5, in_game: 2, chatting: 1 };
    },
    friendsDownloadClanActivityCounts(clanIds64, timeoutSeconds) {
      this.calls.push({ method: "friendsDownloadClanActivityCounts", args: [clanIds64, timeoutSeconds] });
      return Promise.resolve({ success: true });
    },
    friendsGetFriendCountFromSource(sourceId64) {
      this.calls.push({ method: "friendsGetFriendCountFromSource", args: [sourceId64] });
      return 1;
    },
    friendsGetFriendFromSourceByIndex(sourceId64, index) {
      this.calls.push({ method: "friendsGetFriendFromSourceByIndex", args: [sourceId64, index] });
      return friend;
    },
    friendsGetFriendsFromSource(sourceId64) {
      this.calls.push({ method: "friendsGetFriendsFromSource", args: [sourceId64] });
      return [friend];
    },
    friendsIsUserInSource(steamId64, sourceId64) {
      this.calls.push({ method: "friendsIsUserInSource", args: [steamId64, sourceId64] });
      return true;
    },
    friendsRequestClanOfficerList() {
      return Promise.resolve({ clan, officers: 4, success: true });
    },
    friendsGetClanOwner(clanId64) {
      this.calls.push({ method: "friendsGetClanOwner", args: [clanId64] });
      return friend;
    },
    friendsGetClanOfficerCount(clanId64) {
      this.calls.push({ method: "friendsGetClanOfficerCount", args: [clanId64] });
      return 1;
    },
    friendsGetClanOfficerByIndex(clanId64, index) {
      this.calls.push({ method: "friendsGetClanOfficerByIndex", args: [clanId64, index] });
      return friend;
    },
    friendsSetPlayedWith(steamId64) {
      this.calls.push({ method: "friendsSetPlayedWith", args: [steamId64] });
    },
    friendsSetInGameVoiceSpeaking(steamId64, speaking) {
      this.calls.push({ method: "friendsSetInGameVoiceSpeaking", args: [steamId64, speaking] });
    },
    friendsClearRichPresence() {
      this.calls.push({ method: "friendsClearRichPresence", args: [] });
    },
    friendsJoinClanChatRoom() {
      return Promise.resolve({ clan_chat: clan, response: 1 });
    },
    friendsGetFriendRichPresence() {
      return "ready";
    },
    friendsGetFriendRichPresenceKeys() {
      return ["status"];
    },
    friendsRequestFriendRichPresence(steamId64) {
      this.calls.push({ method: "friendsRequestFriendRichPresence", args: [steamId64] });
    },
    friendsInviteUserToGame() {
      return true;
    },
    friendsGetCoplayFriendCount() {
      this.calls.push({ method: "friendsGetCoplayFriendCount", args: [] });
      return 1;
    },
    friendsGetCoplayFriend(index) {
      this.calls.push({ method: "friendsGetCoplayFriend", args: [index] });
      return friend;
    },
    friendsGetCoplayFriends() {
      this.calls.push({ method: "friendsGetCoplayFriends", args: [] });
      return [friend];
    },
    friendsGetFriendCoplayTime(steamId64) {
      this.calls.push({ method: "friendsGetFriendCoplayTime", args: [steamId64] });
      return 123456;
    },
    friendsGetFriendCoplayGame(steamId64) {
      this.calls.push({ method: "friendsGetFriendCoplayGame", args: [steamId64] });
      return 480;
    },
    friendsLeaveClanChatRoom(clanId64) {
      this.calls.push({ method: "friendsLeaveClanChatRoom", args: [clanId64] });
      return true;
    },
    friendsGetClanChatMemberCount(clanChatId64) {
      this.calls.push({ method: "friendsGetClanChatMemberCount", args: [clanChatId64] });
      return 1;
    },
    friendsGetChatMemberByIndex(clanChatId64, index) {
      this.calls.push({ method: "friendsGetChatMemberByIndex", args: [clanChatId64, index] });
      return friend;
    },
    friendsSendClanChatMessage(clanChatId64, text) {
      this.calls.push({ method: "friendsSendClanChatMessage", args: [clanChatId64, text] });
      return true;
    },
    friendsGetClanChatMessage(clanChatId64, messageId, maxBytes) {
      this.calls.push({ method: "friendsGetClanChatMessage", args: [clanChatId64, messageId, maxBytes] });
      return { chatter: friend, data: Buffer.from("clan"), size: 4, text: "clan", entry_type: 1 };
    },
    friendsIsClanChatAdmin(clanChatId64, steamId64) {
      this.calls.push({ method: "friendsIsClanChatAdmin", args: [clanChatId64, steamId64] });
      return true;
    },
    friendsIsClanChatWindowOpenInSteam(clanChatId64) {
      this.calls.push({ method: "friendsIsClanChatWindowOpenInSteam", args: [clanChatId64] });
      return false;
    },
    friendsOpenClanChatWindowInSteam(clanChatId64) {
      this.calls.push({ method: "friendsOpenClanChatWindowInSteam", args: [clanChatId64] });
      return true;
    },
    friendsCloseClanChatWindowInSteam(clanChatId64) {
      this.calls.push({ method: "friendsCloseClanChatWindowInSteam", args: [clanChatId64] });
      return true;
    },
    friendsSetListenForFriendsMessages(enabled) {
      this.calls.push({ method: "friendsSetListenForFriendsMessages", args: [enabled] });
      return true;
    },
    friendsReplyToFriendMessage(steamId64, message) {
      this.calls.push({ method: "friendsReplyToFriendMessage", args: [steamId64, message] });
      return true;
    },
    friendsGetFriendMessage(steamId64, messageId, maxBytes) {
      this.calls.push({ method: "friendsGetFriendMessage", args: [steamId64, messageId, maxBytes] });
      return { data: Buffer.from("hello"), size: 5, text: "hello", entry_type: 1 };
    },
    friendsGetFollowerCount() {
      return Promise.resolve({ steam_id: friend, result: 1, count: 12 });
    },
    friendsIsFollowing() {
      return Promise.resolve({ steam_id: friend, result: 1, is_following: true });
    },
    friendsEnumerateFollowingList() {
      return Promise.resolve({ result: 1, steam_ids: [friend], returned_results: 1, total_results: 2 });
    },
    friendsActivateGameOverlayRemotePlayTogetherInviteDialog(lobbyId64) {
      this.calls.push({ method: "friendsActivateGameOverlayRemotePlayTogetherInviteDialog", args: [lobbyId64] });
    },
    friendsActivateGameOverlayInviteDialogConnectString(connectString) {
      this.calls.push({ method: "friendsActivateGameOverlayInviteDialogConnectString", args: [connectString] });
    },
    friendsIsClanPublic(clanId64) {
      this.calls.push({ method: "friendsIsClanPublic", args: [clanId64] });
      return true;
    },
    friendsIsClanOfficialGameGroup(clanId64) {
      this.calls.push({ method: "friendsIsClanOfficialGameGroup", args: [clanId64] });
      return false;
    },
    friendsGetNumChatsWithUnreadPriorityMessages() {
      this.calls.push({ method: "friendsGetNumChatsWithUnreadPriorityMessages", args: [] });
      return 2;
    },
    friendsRegisterProtocolInOverlayBrowser(protocol) {
      this.calls.push({ method: "friendsRegisterProtocolInOverlayBrowser", args: [protocol] });
      return true;
    },
    friendsRequestEquippedProfileItems() {
      return Promise.resolve({
        result: 1,
        steam_id: friend,
        has_animated_avatar: true,
        has_avatar_frame: true,
        has_profile_modifier: false,
        has_profile_background: true,
        has_mini_profile_background: false,
        from_cache: true
      });
    },
    friendsHasEquippedProfileItem(steamId64, itemType) {
      this.calls.push({ method: "friendsHasEquippedProfileItem", args: [steamId64, itemType] });
      return true;
    },
    friendsGetProfileItemPropertyString(steamId64, itemType, property) {
      this.calls.push({ method: "friendsGetProfileItemPropertyString", args: [steamId64, itemType, property] });
      return "profile-item-title";
    },
    friendsGetProfileItemPropertyUint(steamId64, itemType, property) {
      this.calls.push({ method: "friendsGetProfileItemPropertyUint", args: [steamId64, itemType, property] });
      return property === 5 ? 480 : 42;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.equal(steam.friends.getPersonaName(), "Ada");
  assert.equal(steam.friends.getPersonaState(), steam.PersonaState.Online);
  assert.equal(steam.friends.getFriendCount(), 1);
  assert.equal(friendFlagArgs[0], steam.FriendFlags.Immediate);
  assert.equal(steam.friends.getFriendByIndex(0).steamId64, 76561198000000003n);
  assert.equal(steam.friends.getFriends()[0].steamId64, 76561198000000003n);
  assert.equal(steam.friends.hasFriend(76561198000000003n), true);
  assert.equal(steam.friends.getFriendRelationship(76561198000000003n), steam.FriendRelationship.Friend);
  assert.equal(steam.friends.getFriendPersonaState(76561198000000003n), steam.PersonaState.Online);
  assert.equal(steam.friends.getFriendPersonaName(76561198000000003n), "Grace");
  assert.equal(steam.friends.getFriendPersonaNameHistory(76561198000000003n, 0), "Rear Admiral Grace");
  assert.equal(steam.friends.getFriendSteamLevel(76561198000000003n), 42);
  assert.equal(steam.friends.getPlayerNickname(76561198000000003n), "debug-pal");

  assert.deepEqual(steam.friends.getFriendGamePlayed(76561198000000003n), {
    gameId: 480n,
    gameIp: 2130706433,
    gamePort: 27015,
    queryPort: 27016,
    lobby: 109775242022617907n
  });
  assert.equal(steam.friends.getSmallFriendAvatar(76561198000000003n), 11);
  assert.equal(steam.friends.getMediumFriendAvatar(76561198000000003n), 12);
  assert.equal(steam.friends.getLargeFriendAvatar(76561198000000003n), 13);
  assert.equal(steam.friends.requestUserInformation(76561198000000003n, true), true);
  assert.deepEqual(steam.friends.getFriendsGroups()[0], {
    id: 7,
    name: "Co-op",
    members: [{ steamId64: 76561198000000003n, steamId32: "STEAM_0:1:19867137", accountId: 39734275 }]
  });
  assert.equal(steam.friends.getClanCount(), 1);
  assert.equal(steam.friends.getClanByIndex(0).steamId64, 103582791429521412n);
  assert.equal(steam.friends.getClans()[0].steamId64, 103582791429521412n);
  assert.equal(steam.friends.getClanName(103582791429521412n), "SpaceWar Testers");
  assert.equal(steam.friends.getClanTag(103582791429521412n), "SWT");
  assert.deepEqual(steam.friends.getClanActivityCounts(103582791429521412n), {
    online: 5,
    inGame: 2,
    chatting: 1
  });
  assert.deepEqual(await steam.friends.downloadClanActivityCounts([103582791429521412n], 7), { success: true });
  assert.equal(steam.friends.getFriendCountFromSource(103582791429521412n), 1);
  assert.equal(steam.friends.getFriendFromSourceByIndex(103582791429521412n, 0).steamId64, 76561198000000003n);
  assert.deepEqual(steam.friends.getFriendsFromSource(103582791429521412n), [
    { steamId64: 76561198000000003n, steamId32: "STEAM_0:1:19867137", accountId: 39734275 }
  ]);
  assert.equal(steam.friends.isUserInSource(76561198000000003n, 103582791429521412n), true);
  assert.deepEqual(fake.calls.find((call) => call.method === "friendsDownloadClanActivityCounts"), {
    method: "friendsDownloadClanActivityCounts",
    args: [[103582791429521412n], 7]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "friendsIsUserInSource"), {
    method: "friendsIsUserInSource",
    args: [76561198000000003n, 103582791429521412n]
  });
  assert.deepEqual(await steam.friends.requestClanOfficerList(103582791429521412n), {
    clan: { steamId64: 103582791429521412n, steamId32: "STEAM_0:0:0", accountId: 0 },
    officers: 4,
    success: true
  });
  assert.equal(steam.friends.getClanOwner(103582791429521412n).steamId64, 76561198000000003n);
  assert.equal(steam.friends.getClanOfficerCount(103582791429521412n), 1);
  assert.equal(steam.friends.getClanOfficerByIndex(103582791429521412n, 0).steamId64, 76561198000000003n);
  steam.friends.setPlayedWith(76561198000000003n);
  steam.friends.setInGameVoiceSpeaking(76561198000000003n, true);
  steam.friends.clearRichPresence();
  assert.deepEqual(await steam.friends.joinClanChatRoom(103582791429521412n), {
    clanChat: { steamId64: 103582791429521412n, steamId32: "STEAM_0:0:0", accountId: 0 },
    response: steam.ChatRoomEnterResponse.Success
  });
  assert.equal(steam.friends.getCoplayFriendCount(), 1);
  assert.equal(steam.friends.getCoplayFriend(0).steamId64, 76561198000000003n);
  assert.equal(steam.friends.getCoplayFriends()[0].steamId64, 76561198000000003n);
  assert.equal(steam.friends.getFriendCoplayTime(76561198000000003n), 123456);
  assert.equal(steam.friends.getFriendCoplayGame(76561198000000003n), 480);
  assert.equal(steam.friends.leaveClanChatRoom(103582791429521412n), true);
  assert.equal(steam.friends.getClanChatMemberCount(103582791429521412n), 1);
  assert.equal(steam.friends.getChatMemberByIndex(103582791429521412n, 0).steamId64, 76561198000000003n);
  assert.equal(steam.friends.sendClanChatMessage(103582791429521412n, "hello clan"), true);
  assert.deepEqual(steam.friends.getClanChatMessage(103582791429521412n, 88, 128), {
    chatter: { steamId64: 76561198000000003n, steamId32: "STEAM_0:1:19867137", accountId: 39734275 },
    data: Buffer.from("clan"),
    size: 4,
    text: "clan",
    entryType: steam.friends.ChatEntryType.ChatMsg
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "friendsGetClanChatMessage"), {
    method: "friendsGetClanChatMessage",
    args: [103582791429521412n, 88, 128]
  });
  assert.equal(steam.friends.isClanChatAdmin(103582791429521412n, 76561198000000003n), true);
  assert.equal(steam.friends.isClanChatWindowOpenInSteam(103582791429521412n), false);
  assert.equal(steam.friends.openClanChatWindowInSteam(103582791429521412n), true);
  assert.equal(steam.friends.closeClanChatWindowInSteam(103582791429521412n), true);
  assert.equal(steam.friends.setListenForFriendsMessages(true), true);
  assert.equal(steam.friends.replyToFriendMessage(76561198000000003n, "hello friend"), true);
  assert.deepEqual(steam.friends.getFriendRichPresenceKeys(76561198000000003n), ["status"]);
  assert.equal(steam.friends.getFriendRichPresence(76561198000000003n, "status"), "ready");
  steam.friends.requestFriendRichPresence(76561198000000003n);
  assert.equal(steam.friends.inviteUserToGame(76561198000000003n, "+connect_lobby 109775242022617907"), true);
  assert.equal(steam.friends.ChatEntryType.ChatMsg, 1);
  assert.deepEqual(steam.friends.getFriendMessage(76561198000000003n, 77, 256), {
    data: Buffer.from("hello"),
    size: 5,
    text: "hello",
    entryType: steam.friends.ChatEntryType.ChatMsg
  });
  assert.equal((await steam.friends.getFollowerCount(76561198000000003n)).count, 12);
  assert.equal((await steam.friends.isFollowing(76561198000000003n)).isFollowing, true);
  assert.deepEqual(await steam.friends.enumerateFollowingList(), {
    result: 1,
    steamIds: [{ steamId64: 76561198000000003n, steamId32: "STEAM_0:1:19867137", accountId: 39734275 }],
    returnedResults: 1,
    totalResults: 2
  });
  steam.friends.activateGameOverlayRemotePlayTogetherInviteDialog(109775242022617907n);
  steam.friends.activateGameOverlayInviteDialogConnectString("+connect_lobby 109775242022617907");
  assert.equal(steam.friends.isClanPublic(103582791429521412n), true);
  assert.equal(steam.friends.isClanOfficialGameGroup(103582791429521412n), false);
  assert.equal(steam.friends.getNumChatsWithUnreadPriorityMessages(), 2);
  assert.equal(steam.friends.registerProtocolInOverlayBrowser("steam-bridge"), true);
  assert.deepEqual(await steam.friends.requestEquippedProfileItems(76561198000000003n), {
    result: 1,
    steamId: { steamId64: 76561198000000003n, steamId32: "STEAM_0:1:19867137", accountId: 39734275 },
    hasAnimatedAvatar: true,
    hasAvatarFrame: true,
    hasProfileModifier: false,
    hasProfileBackground: true,
    hasMiniProfileBackground: false,
    fromCache: true
  });
  assert.equal(
    steam.friends.hasEquippedProfileItem(
      76561198000000003n,
      steam.friends.CommunityProfileItemType.AvatarFrame
    ),
    true
  );
  assert.equal(
    steam.friends.getProfileItemPropertyString(
      76561198000000003n,
      steam.friends.CommunityProfileItemType.AvatarFrame,
      steam.friends.CommunityProfileItemProperty.Title
    ),
    "profile-item-title"
  );
  assert.equal(
    steam.friends.getProfileItemPropertyUint(
      76561198000000003n,
      steam.friends.CommunityProfileItemType.AvatarFrame,
      steam.friends.CommunityProfileItemProperty.AppId
    ),
    480
  );

  let equippedChangedEvent;
  steam.callback.register(steam.SteamCallback.EquippedProfileItemsChanged, (event) => {
    equippedChangedEvent = event;
  });
  fake.callbacks.get(steam.SteamCallback.EquippedProfileItemsChanged)({ steam_id: "76561198000000003" });
  assert.equal(equippedChangedEvent.steamId, 76561198000000003n);
});

test("friends facade exposes typed callback helpers", (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const events = {};
  const handles = [
    steam.friends.onLegacyPersonaStateChange((event) => {
      events.legacyPersona = event;
    }),
    steam.friends.onPersonaStateChange((event) => {
      events.persona = event;
    }),
    steam.friends.onGameServerChangeRequested((event) => {
      events.serverChange = event;
    }),
    steam.friends.onLegacyGameLobbyJoinRequested((event) => {
      events.legacyLobbyJoin = event;
    }),
    steam.friends.onGameLobbyJoinRequested((event) => {
      events.lobbyJoin = event;
    }),
    steam.friends.onAvatarImageLoaded((event) => {
      events.avatar = event;
    }),
    steam.friends.onClanOfficerListResponse((event) => {
      events.officers = event;
    }),
    steam.friends.onRichPresenceUpdate((event) => {
      events.richPresence = event;
    }),
    steam.friends.onGameRichPresenceJoinRequested((event) => {
      events.richPresenceJoin = event;
    }),
    steam.friends.onGameConnectedClanChatMessage((event) => {
      events.clanMessage = event;
    }),
    steam.friends.onGameConnectedChatJoin((event) => {
      events.chatJoin = event;
    }),
    steam.friends.onGameConnectedChatLeave((event) => {
      events.chatLeave = event;
    }),
    steam.friends.onDownloadClanActivityCountsResult((event) => {
      events.activityCounts = event;
    }),
    steam.friends.onJoinClanChatRoomCompletionResult((event) => {
      events.joinClanChat = event;
    }),
    steam.friends.onGameConnectedFriendChatMessage((event) => {
      events.friendMessage = event;
    }),
    steam.friends.onFollowerCount((event) => {
      events.followers = event;
    }),
    steam.friends.onIsFollowing((event) => {
      events.isFollowing = event;
    }),
    steam.friends.onEnumerateFollowingList((event) => {
      events.followingList = event;
    }),
    steam.friends.onUnreadChatMessagesChanged((event) => {
      events.unread = event;
    }),
    steam.friends.onOverlayBrowserProtocolNavigation((event) => {
      events.protocol = event;
    }),
    steam.friends.onEquippedProfileItemsChanged((event) => {
      events.equippedChanged = event;
    }),
    steam.friends.onEquippedProfileItems((event) => {
      events.equipped = event;
    })
  ];

  fake.callbacks.get(steam.SteamCallback.PersonaStateChange)({
    steam_id: "76561198000000002",
    flags: { bits: 2 }
  });
  fake.callbacks.get(steam.SteamCallback.PersonaStateChangeSteamworks)({
    steam_id: "76561198000000003",
    flags: { bits: 4 }
  });
  fake.callbacks.get(steam.SteamCallback.GameServerChangeRequested)({
    server: "127.0.0.1:27015",
    password: "spacewar"
  });
  fake.callbacks.get(steam.SteamCallback.GameLobbyJoinRequested)({
    lobby_steam_id: "109775242022617906",
    friend_steam_id: "76561198000000002"
  });
  fake.callbacks.get(steam.SteamCallback.GameLobbyJoinRequestedSteamworks)({
    lobby_steam_id: "109775242022617907",
    friend_steam_id: "76561198000000004"
  });
  fake.callbacks.get(steam.SteamCallback.AvatarImageLoaded)({
    steam_id: "76561198000000003",
    image: 42,
    wide: 184,
    tall: 184
  });
  fake.callbacks.get(steam.SteamCallback.ClanOfficerListResponse)({
    clan: "103582791429521412",
    officer_count: 4,
    success: true
  });
  fake.callbacks.get(steam.SteamCallback.FriendRichPresenceUpdate)({
    friend: "76561198000000003",
    app_id: 480
  });
  fake.callbacks.get(steam.SteamCallback.GameRichPresenceJoinRequested)({
    friend: "76561198000000003",
    connect: "+connect_lobby 109775242022617907"
  });
  fake.callbacks.get(steam.SteamCallback.GameConnectedClanChatMsg)({
    clan_chat: "103582791429521412",
    user: "76561198000000003",
    message_id: 88
  });
  fake.callbacks.get(steam.SteamCallback.GameConnectedChatJoin)({
    clan_chat: "103582791429521412",
    user: "76561198000000003"
  });
  fake.callbacks.get(steam.SteamCallback.GameConnectedChatLeave)({
    clan_chat: "103582791429521412",
    user: "76561198000000003",
    kicked: false,
    dropped: true
  });
  fake.callbacks.get(steam.SteamCallback.DownloadClanActivityCountsResult)({ success: true });
  fake.callbacks.get(steam.SteamCallback.JoinClanChatRoomCompletionResult)({
    clan_chat: "103582791429521412",
    chat_room_enter_response: steam.friends.ChatRoomEnterResponse.Success
  });
  fake.callbacks.get(steam.SteamCallback.GameConnectedFriendChatMsg)({
    user: "76561198000000003",
    message_id: 77
  });
  fake.callbacks.get(steam.SteamCallback.FriendsGetFollowerCount)({
    result: 1,
    steam_id: "76561198000000003",
    count: 12
  });
  fake.callbacks.get(steam.SteamCallback.FriendsIsFollowing)({
    result: 1,
    steam_id: "76561198000000003",
    is_following: true
  });
  fake.callbacks.get(steam.SteamCallback.FriendsEnumerateFollowingList)({
    result: 1,
    steam_ids: ["76561198000000003", "76561198000000004"],
    results_returned: 2,
    total_result_count: 5
  });
  fake.callbacks.get(steam.SteamCallback.UnreadChatMessagesChanged)({});
  fake.callbacks.get(steam.SteamCallback.OverlayBrowserProtocolNavigation)({ uri: "steam://open/friends" });
  fake.callbacks.get(steam.SteamCallback.EquippedProfileItemsChanged)({ steam_id: "76561198000000003" });
  fake.callbacks.get(steam.SteamCallback.EquippedProfileItems)({
    result: 1,
    steam_id: "76561198000000003",
    has_animated_avatar: true,
    has_avatar_frame: true,
    has_profile_modifier: false,
    has_profile_background: true,
    has_mini_profile_background: false,
    from_cache: true
  });

  assert.equal(events.legacyPersona.steamId, 76561198000000002n);
  assert.deepEqual(events.legacyPersona.flags, { bits: 2 });
  assert.equal(events.persona.steamId, 76561198000000003n);
  assert.deepEqual(events.persona.flags, { bits: 4 });
  assert.deepEqual(events.serverChange, { server: "127.0.0.1:27015", password: "spacewar" });
  assert.equal(events.legacyLobbyJoin.lobbySteamId, 109775242022617906n);
  assert.equal(events.legacyLobbyJoin.friendSteamId, 76561198000000002n);
  assert.equal(events.lobbyJoin.lobbySteamId, 109775242022617907n);
  assert.equal(events.lobbyJoin.friendSteamId, 76561198000000004n);
  assert.equal(events.avatar.steamId, 76561198000000003n);
  assert.equal(events.avatar.image, 42);
  assert.equal(events.avatar.wide, 184);
  assert.equal(events.officers.clan, 103582791429521412n);
  assert.equal(events.officers.officerCount, 4);
  assert.equal(events.richPresence.friend, 76561198000000003n);
  assert.equal(events.richPresence.appId, 480);
  assert.equal(events.richPresenceJoin.connect, "+connect_lobby 109775242022617907");
  assert.equal(events.clanMessage.clanChat, 103582791429521412n);
  assert.equal(events.clanMessage.messageId, 88);
  assert.equal(events.chatJoin.user, 76561198000000003n);
  assert.equal(events.chatLeave.dropped, true);
  assert.equal(events.activityCounts.success, true);
  assert.equal(events.joinClanChat.chatRoomEnterResponse, steam.friends.ChatRoomEnterResponse.Success);
  assert.equal(events.friendMessage.messageId, 77);
  assert.equal(events.followers.count, 12);
  assert.equal(events.isFollowing.isFollowing, true);
  assert.deepEqual(events.followingList.steamIds, [76561198000000003n, 76561198000000004n]);
  assert.equal(events.followingList.resultsReturned, 2);
  assert.equal(events.followingList.totalResultCount, 5);
  assert.deepEqual(events.unread, {});
  assert.equal(events.protocol.uri, "steam://open/friends");
  assert.equal(events.equippedChanged.steamId, 76561198000000003n);
  assert.equal(events.equipped.hasAnimatedAvatar, true);
  assert.equal(events.equipped.hasAvatarFrame, true);
  assert.equal(events.equipped.hasProfileBackground, true);
  assert.equal(events.equipped.fromCache, true);

  for (const handle of handles) {
    handle.disconnect();
  }

  const callbackIds = [
    steam.SteamCallback.PersonaStateChange,
    steam.SteamCallback.PersonaStateChangeSteamworks,
    steam.SteamCallback.GameServerChangeRequested,
    steam.SteamCallback.GameLobbyJoinRequested,
    steam.SteamCallback.GameLobbyJoinRequestedSteamworks,
    steam.SteamCallback.AvatarImageLoaded,
    steam.SteamCallback.ClanOfficerListResponse,
    steam.SteamCallback.FriendRichPresenceUpdate,
    steam.SteamCallback.GameRichPresenceJoinRequested,
    steam.SteamCallback.GameConnectedClanChatMsg,
    steam.SteamCallback.GameConnectedChatJoin,
    steam.SteamCallback.GameConnectedChatLeave,
    steam.SteamCallback.DownloadClanActivityCountsResult,
    steam.SteamCallback.JoinClanChatRoomCompletionResult,
    steam.SteamCallback.GameConnectedFriendChatMsg,
    steam.SteamCallback.FriendsGetFollowerCount,
    steam.SteamCallback.FriendsIsFollowing,
    steam.SteamCallback.FriendsEnumerateFollowingList,
    steam.SteamCallback.UnreadChatMessagesChanged,
    steam.SteamCallback.OverlayBrowserProtocolNavigation,
    steam.SteamCallback.EquippedProfileItemsChanged,
    steam.SteamCallback.EquippedProfileItems
  ];
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "registerSteamCallback"),
    callbackIds.map((callbackId) => ({ method: "registerSteamCallback", args: [callbackId] }))
  );
  assert.deepEqual(
    fake.calls.filter((call) => call.method === "disconnectCallback"),
    callbackIds.map((callbackId) => ({ method: "disconnectCallback", args: [callbackId] }))
  );
});

test("screenshots, music, video, and parental facades forward utility interfaces", (t) => {
  const fake = createFakeNative({
    screenshotsWriteScreenshot(rgb, width, height) {
      this.calls.push({ method: "screenshotsWriteScreenshot", args: [rgb, width, height] });
      return 101;
    },
    screenshotsAddScreenshotToLibrary(filename, thumbnailFilename, width, height) {
      this.calls.push({ method: "screenshotsAddScreenshotToLibrary", args: [filename, thumbnailFilename, width, height] });
      return 102;
    },
    screenshotsTriggerScreenshot() {
      this.calls.push({ method: "screenshotsTriggerScreenshot", args: [] });
    },
    screenshotsHookScreenshots(hook) {
      this.calls.push({ method: "screenshotsHookScreenshots", args: [hook] });
    },
    screenshotsSetLocation(handle, location) {
      this.calls.push({ method: "screenshotsSetLocation", args: [handle, location] });
      return true;
    },
    screenshotsTagUser(handle, steamId64) {
      this.calls.push({ method: "screenshotsTagUser", args: [handle, steamId64] });
      return true;
    },
    screenshotsTagPublishedFile(handle, publishedFileId) {
      this.calls.push({ method: "screenshotsTagPublishedFile", args: [handle, publishedFileId] });
      return true;
    },
    screenshotsIsScreenshotsHooked() {
      return true;
    },
    screenshotsAddVrScreenshotToLibrary(vrType, filename, vrFilename) {
      this.calls.push({ method: "screenshotsAddVrScreenshotToLibrary", args: [vrType, filename, vrFilename] });
      return 103;
    },
    musicIsEnabled() {
      return true;
    },
    musicIsPlaying() {
      return false;
    },
    musicGetPlaybackStatus() {
      return 2;
    },
    musicPlay() {
      this.calls.push({ method: "musicPlay", args: [] });
    },
    musicPause() {
      this.calls.push({ method: "musicPause", args: [] });
    },
    musicPlayPrevious() {
      this.calls.push({ method: "musicPlayPrevious", args: [] });
    },
    musicPlayNext() {
      this.calls.push({ method: "musicPlayNext", args: [] });
    },
    musicSetVolume(volume) {
      this.calls.push({ method: "musicSetVolume", args: [volume] });
    },
    musicGetVolume() {
      return 0.5;
    },
    musicRemoteRegister(name) {
      this.calls.push({ method: "musicRemoteRegister", args: [name] });
      return true;
    },
    musicRemoteDeregister() {
      this.calls.push({ method: "musicRemoteDeregister", args: [] });
      return true;
    },
    musicRemoteIsCurrent() {
      this.calls.push({ method: "musicRemoteIsCurrent", args: [] });
      return true;
    },
    musicRemoteActivationSuccess(value) {
      this.calls.push({ method: "musicRemoteActivationSuccess", args: [value] });
      return true;
    },
    musicRemoteSetDisplayName(displayName) {
      this.calls.push({ method: "musicRemoteSetDisplayName", args: [displayName] });
      return true;
    },
    musicRemoteSetPngIcon64x64(data) {
      this.calls.push({ method: "musicRemoteSetPngIcon64x64", args: [data] });
      return true;
    },
    musicRemoteEnablePlayPrevious(value) {
      this.calls.push({ method: "musicRemoteEnablePlayPrevious", args: [value] });
      return true;
    },
    musicRemoteEnablePlayNext(value) {
      this.calls.push({ method: "musicRemoteEnablePlayNext", args: [value] });
      return true;
    },
    musicRemoteEnableShuffled(value) {
      this.calls.push({ method: "musicRemoteEnableShuffled", args: [value] });
      return true;
    },
    musicRemoteEnableLooped(value) {
      this.calls.push({ method: "musicRemoteEnableLooped", args: [value] });
      return true;
    },
    musicRemoteEnableQueue(value) {
      this.calls.push({ method: "musicRemoteEnableQueue", args: [value] });
      return true;
    },
    musicRemoteEnablePlaylists(value) {
      this.calls.push({ method: "musicRemoteEnablePlaylists", args: [value] });
      return true;
    },
    musicRemoteUpdatePlaybackStatus(status) {
      this.calls.push({ method: "musicRemoteUpdatePlaybackStatus", args: [status] });
      return true;
    },
    musicRemoteUpdateShuffled(value) {
      this.calls.push({ method: "musicRemoteUpdateShuffled", args: [value] });
      return true;
    },
    musicRemoteUpdateLooped(value) {
      this.calls.push({ method: "musicRemoteUpdateLooped", args: [value] });
      return true;
    },
    musicRemoteUpdateVolume(volume) {
      this.calls.push({ method: "musicRemoteUpdateVolume", args: [volume] });
      return true;
    },
    musicRemoteCurrentEntryWillChange() {
      this.calls.push({ method: "musicRemoteCurrentEntryWillChange", args: [] });
      return true;
    },
    musicRemoteCurrentEntryIsAvailable(available) {
      this.calls.push({ method: "musicRemoteCurrentEntryIsAvailable", args: [available] });
      return true;
    },
    musicRemoteUpdateCurrentEntryText(text) {
      this.calls.push({ method: "musicRemoteUpdateCurrentEntryText", args: [text] });
      return true;
    },
    musicRemoteUpdateCurrentEntryElapsedSeconds(value) {
      this.calls.push({ method: "musicRemoteUpdateCurrentEntryElapsedSeconds", args: [value] });
      return true;
    },
    musicRemoteUpdateCurrentEntryCoverArt(data) {
      this.calls.push({ method: "musicRemoteUpdateCurrentEntryCoverArt", args: [data] });
      return true;
    },
    musicRemoteCurrentEntryDidChange() {
      this.calls.push({ method: "musicRemoteCurrentEntryDidChange", args: [] });
      return true;
    },
    musicRemoteQueueWillChange() {
      this.calls.push({ method: "musicRemoteQueueWillChange", args: [] });
      return true;
    },
    musicRemoteResetQueueEntries() {
      this.calls.push({ method: "musicRemoteResetQueueEntries", args: [] });
      return true;
    },
    musicRemoteSetQueueEntry(id, position, entryText) {
      this.calls.push({ method: "musicRemoteSetQueueEntry", args: [id, position, entryText] });
      return true;
    },
    musicRemoteSetCurrentQueueEntry(id) {
      this.calls.push({ method: "musicRemoteSetCurrentQueueEntry", args: [id] });
      return true;
    },
    musicRemoteQueueDidChange() {
      this.calls.push({ method: "musicRemoteQueueDidChange", args: [] });
      return true;
    },
    musicRemotePlaylistWillChange() {
      this.calls.push({ method: "musicRemotePlaylistWillChange", args: [] });
      return true;
    },
    musicRemoteResetPlaylistEntries() {
      this.calls.push({ method: "musicRemoteResetPlaylistEntries", args: [] });
      return true;
    },
    musicRemoteSetPlaylistEntry(id, position, entryText) {
      this.calls.push({ method: "musicRemoteSetPlaylistEntry", args: [id, position, entryText] });
      return true;
    },
    musicRemoteSetCurrentPlaylistEntry(id) {
      this.calls.push({ method: "musicRemoteSetCurrentPlaylistEntry", args: [id] });
      return true;
    },
    musicRemotePlaylistDidChange() {
      this.calls.push({ method: "musicRemotePlaylistDidChange", args: [] });
      return true;
    },
    videoRequestVideoUrl(appId) {
      this.calls.push({ method: "videoRequestVideoUrl", args: [appId] });
    },
    videoIsBroadcasting() {
      return { broadcasting: true, viewers: 42 };
    },
    videoRequestOpfSettings(appId) {
      this.calls.push({ method: "videoRequestOpfSettings", args: [appId] });
    },
    videoGetOpfStringForApp(appId) {
      this.calls.push({ method: "videoGetOpfStringForApp", args: [appId] });
      return "<opf />";
    },
    parentalIsParentalLockEnabled() {
      return true;
    },
    parentalIsParentalLockLocked() {
      return false;
    },
    parentalIsAppBlocked(appId) {
      return appId === 480;
    },
    parentalIsAppInBlockList(appId) {
      return appId === 480;
    },
    parentalIsFeatureBlocked(feature) {
      return feature === 4;
    },
    parentalIsFeatureInBlockList(feature) {
      return feature === 4;
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const rgb = Buffer.from([255, 0, 0]);
  assert.equal(steam.screenshots.writeScreenshot(rgb, 1, 1), 101);
  assert.equal(steam.screenshots.addScreenshotToLibrary("screen.png", null, 1920, 1080), 102);
  steam.screenshots.triggerScreenshot();
  steam.screenshots.hookScreenshots(true);
  assert.equal(steam.screenshots.setLocation(101, "Test Map"), true);
  assert.equal(steam.screenshots.tagUser(101, 76561198000000003n), true);
  assert.equal(steam.screenshots.tagPublishedFile(101, 12345678901234567890n), true);
  assert.equal(steam.screenshots.isScreenshotsHooked(), true);
  assert.equal(
    steam.screenshots.addVrScreenshotToLibrary(steam.VRScreenshotType.StereoPanorama, "screen.png", "screen_vr.png"),
    103
  );

  assert.equal(steam.music.isEnabled(), true);
  assert.equal(steam.music.isPlaying(), false);
  assert.equal(steam.music.getPlaybackStatus(), steam.AudioPlaybackStatus.Paused);
  steam.music.play();
  steam.music.pause();
  steam.music.playPrevious();
  steam.music.playNext();
  steam.music.setVolume(0.5);
  assert.equal(steam.music.getVolume(), 0.5);
  assert.equal(steam.music.remote, steam.musicRemote);

  const remoteIcon = new Uint8Array([137, 80, 78, 71]);
  const remoteCover = Buffer.from([1, 2, 3, 4]);
  assert.equal(steam.music.remote.register("Steam Bridge Remote"), true);
  assert.equal(steam.music.remote.deregister(), true);
  assert.equal(steam.music.remote.isCurrent(), true);
  assert.equal(steam.music.remote.activationSuccess(true), true);
  assert.equal(steam.music.remote.setDisplayName("Steam Bridge"), true);
  assert.equal(steam.music.remote.setPngIcon64x64(remoteIcon), true);
  assert.equal(steam.music.remote.enablePlayPrevious(true), true);
  assert.equal(steam.music.remote.enablePlayNext(true), true);
  assert.equal(steam.music.remote.enableShuffled(true), true);
  assert.equal(steam.music.remote.enableLooped(false), true);
  assert.equal(steam.music.remote.enableQueue(true), true);
  assert.equal(steam.music.remote.enablePlaylists(true), true);
  assert.equal(steam.music.remote.updatePlaybackStatus(steam.AudioPlaybackStatus.Playing), true);
  assert.equal(steam.music.remote.updateShuffled(true), true);
  assert.equal(steam.music.remote.updateLooped(false), true);
  assert.equal(steam.music.remote.updateVolume(0.75), true);
  assert.equal(steam.music.remote.currentEntryWillChange(), true);
  assert.equal(steam.music.remote.currentEntryIsAvailable(true), true);
  assert.equal(steam.music.remote.updateCurrentEntryText("Track 1"), true);
  assert.equal(steam.music.remote.updateCurrentEntryElapsedSeconds(42), true);
  assert.equal(steam.music.remote.updateCurrentEntryCoverArt(remoteCover), true);
  assert.equal(steam.music.remote.currentEntryDidChange(), true);
  assert.equal(steam.music.remote.queueWillChange(), true);
  assert.equal(steam.music.remote.resetQueueEntries(), true);
  assert.equal(steam.music.remote.setQueueEntry(7, 1, "Queued Track"), true);
  assert.equal(steam.music.remote.setCurrentQueueEntry(7), true);
  assert.equal(steam.music.remote.queueDidChange(), true);
  assert.equal(steam.music.remote.playlistWillChange(), true);
  assert.equal(steam.music.remote.resetPlaylistEntries(), true);
  assert.equal(steam.music.remote.setPlaylistEntry(8, 2, "Playlist Track"), true);
  assert.equal(steam.music.remote.setCurrentPlaylistEntry(8), true);
  assert.equal(steam.music.remote.playlistDidChange(), true);
  const musicRemoteCalls = fake.calls
    .filter((call) => call.method.startsWith("musicRemote"))
    .map((call) => ({
      method: call.method,
      args: call.args.map((arg) => (Buffer.isBuffer(arg) ? Array.from(arg) : arg))
    }));
  assert.deepEqual(musicRemoteCalls, [
    { method: "musicRemoteRegister", args: ["Steam Bridge Remote"] },
    { method: "musicRemoteDeregister", args: [] },
    { method: "musicRemoteIsCurrent", args: [] },
    { method: "musicRemoteActivationSuccess", args: [true] },
    { method: "musicRemoteSetDisplayName", args: ["Steam Bridge"] },
    { method: "musicRemoteSetPngIcon64x64", args: [[137, 80, 78, 71]] },
    { method: "musicRemoteEnablePlayPrevious", args: [true] },
    { method: "musicRemoteEnablePlayNext", args: [true] },
    { method: "musicRemoteEnableShuffled", args: [true] },
    { method: "musicRemoteEnableLooped", args: [false] },
    { method: "musicRemoteEnableQueue", args: [true] },
    { method: "musicRemoteEnablePlaylists", args: [true] },
    { method: "musicRemoteUpdatePlaybackStatus", args: [steam.AudioPlaybackStatus.Playing] },
    { method: "musicRemoteUpdateShuffled", args: [true] },
    { method: "musicRemoteUpdateLooped", args: [false] },
    { method: "musicRemoteUpdateVolume", args: [0.75] },
    { method: "musicRemoteCurrentEntryWillChange", args: [] },
    { method: "musicRemoteCurrentEntryIsAvailable", args: [true] },
    { method: "musicRemoteUpdateCurrentEntryText", args: ["Track 1"] },
    { method: "musicRemoteUpdateCurrentEntryElapsedSeconds", args: [42] },
    { method: "musicRemoteUpdateCurrentEntryCoverArt", args: [[1, 2, 3, 4]] },
    { method: "musicRemoteCurrentEntryDidChange", args: [] },
    { method: "musicRemoteQueueWillChange", args: [] },
    { method: "musicRemoteResetQueueEntries", args: [] },
    { method: "musicRemoteSetQueueEntry", args: [7, 1, "Queued Track"] },
    { method: "musicRemoteSetCurrentQueueEntry", args: [7] },
    { method: "musicRemoteQueueDidChange", args: [] },
    { method: "musicRemotePlaylistWillChange", args: [] },
    { method: "musicRemoteResetPlaylistEntries", args: [] },
    { method: "musicRemoteSetPlaylistEntry", args: [8, 2, "Playlist Track"] },
    { method: "musicRemoteSetCurrentPlaylistEntry", args: [8] },
    { method: "musicRemotePlaylistDidChange", args: [] }
  ]);

  steam.video.requestVideoUrl(480);
  assert.deepEqual(steam.video.isBroadcasting(), { broadcasting: true, viewers: 42 });
  steam.video.requestOpfSettings(480);
  assert.equal(steam.video.getOpfStringForApp(480), "<opf />");

  assert.equal(steam.parental.isParentalLockEnabled(), true);
  assert.equal(steam.parental.isParentalLockLocked(), false);
  assert.equal(steam.parental.isAppBlocked(480), true);
  assert.equal(steam.parental.isAppInBlockList(480), true);
  assert.equal(steam.parental.isFeatureBlocked(steam.ParentalFeature.Friends), true);
  assert.equal(steam.parental.isFeatureInBlockList(steam.ParentalFeature.Friends), true);
});

test("timeline and remote play facades normalize timeline and session data", async (t) => {
  const player = { steamId64: "76561198000000004", steamId32: "STEAM_0:0:19867138", accountId: 39734276 };
  const fake = createFakeNative({
    timelineSetTimelineTooltip(description, timeDelta) {
      this.calls.push({ method: "timelineSetTimelineTooltip", args: [description, timeDelta] });
    },
    timelineClearTimelineTooltip(timeDelta) {
      this.calls.push({ method: "timelineClearTimelineTooltip", args: [timeDelta] });
    },
    timelineSetTimelineGameMode(mode) {
      this.calls.push({ method: "timelineSetTimelineGameMode", args: [mode] });
    },
    timelineAddInstantaneousTimelineEvent(...args) {
      this.calls.push({ method: "timelineAddInstantaneousTimelineEvent", args });
      return "9001";
    },
    timelineAddRangeTimelineEvent(...args) {
      this.calls.push({ method: "timelineAddRangeTimelineEvent", args });
      return 9002n;
    },
    timelineStartRangeTimelineEvent(...args) {
      this.calls.push({ method: "timelineStartRangeTimelineEvent", args });
      return 9003n;
    },
    timelineUpdateRangeTimelineEvent(...args) {
      this.calls.push({ method: "timelineUpdateRangeTimelineEvent", args });
    },
    timelineEndRangeTimelineEvent(...args) {
      this.calls.push({ method: "timelineEndRangeTimelineEvent", args });
    },
    timelineRemoveTimelineEvent(event) {
      this.calls.push({ method: "timelineRemoveTimelineEvent", args: [event] });
    },
    timelineDoesEventRecordingExist() {
      return Promise.resolve({ event: "9001", recording_exists: true });
    },
    timelineStartGamePhase() {
      this.calls.push({ method: "timelineStartGamePhase", args: [] });
    },
    timelineEndGamePhase() {
      this.calls.push({ method: "timelineEndGamePhase", args: [] });
    },
    timelineSetGamePhaseId(phaseId) {
      this.calls.push({ method: "timelineSetGamePhaseId", args: [phaseId] });
    },
    timelineDoesGamePhaseRecordingExist() {
      return Promise.resolve({
        phase_id: "round-1",
        recording_ms: "1500",
        longest_clip_ms: "750",
        clip_count: 2,
        screenshot_count: 3
      });
    },
    timelineAddGamePhaseTag(...args) {
      this.calls.push({ method: "timelineAddGamePhaseTag", args });
    },
    timelineSetGamePhaseAttribute(...args) {
      this.calls.push({ method: "timelineSetGamePhaseAttribute", args });
    },
    timelineOpenOverlayToGamePhase(phaseId) {
      this.calls.push({ method: "timelineOpenOverlayToGamePhase", args: [phaseId] });
    },
    timelineOpenOverlayToTimelineEvent(event) {
      this.calls.push({ method: "timelineOpenOverlayToTimelineEvent", args: [event] });
    },
    remotePlayGetSessionCount() {
      return 1;
    },
    remotePlayGetSessionId(index) {
      return index === 0 ? 42 : 0;
    },
    remotePlayGetSessions() {
      return [
        {
          id: 42,
          remote_play_together: true,
          steam_id: player,
          guest_id: 77,
          small_avatar: 11,
          medium_avatar: 12,
          large_avatar: 13,
          client_name: "Living Room",
          client_form_factor: 4,
          resolution: { width: 1920, height: 1080 }
        }
      ];
    },
    remotePlayIsRemotePlayTogether() {
      return true;
    },
    remotePlayGetSessionSteamId() {
      return player;
    },
    remotePlayGetSessionGuestId() {
      return 77;
    },
    remotePlayGetSmallSessionAvatar() {
      return 11;
    },
    remotePlayGetMediumSessionAvatar() {
      return 12;
    },
    remotePlayGetLargeSessionAvatar() {
      return 13;
    },
    remotePlayGetSessionClientName() {
      return "Living Room";
    },
    remotePlayGetSessionClientFormFactor() {
      return 4;
    },
    remotePlayGetSessionClientResolution() {
      return { width: 1920, height: 1080 };
    },
    remotePlayShowRemotePlayTogetherUi() {
      return true;
    },
    remotePlaySendRemotePlayTogetherInvite(steamId64) {
      this.calls.push({ method: "remotePlaySendRemotePlayTogetherInvite", args: [steamId64] });
      return true;
    },
    remotePlayEnableRemotePlayTogetherDirectInput() {
      return true;
    },
    remotePlayDisableRemotePlayTogetherDirectInput() {
      this.calls.push({ method: "remotePlayDisableRemotePlayTogetherDirectInput", args: [] });
    },
    remotePlayGetInput(maxEvents) {
      this.calls.push({ method: "remotePlayGetInput", args: [maxEvents] });
      return [
        { session_id: 42, input_type: 1, absolute: true, normalized_x: 0.25, normalized_y: 0.75, delta_x: 3, delta_y: -2 },
        { session_id: 42, input_type: 5, scancode: 4, modifiers: 1, keycode: 65 }
      ];
    },
    remotePlaySetMouseVisibility(sessionId, visible) {
      this.calls.push({ method: "remotePlaySetMouseVisibility", args: [sessionId, visible] });
    },
    remotePlaySetMousePosition(sessionId, normalizedX, normalizedY) {
      this.calls.push({ method: "remotePlaySetMousePosition", args: [sessionId, normalizedX, normalizedY] });
    },
    remotePlayCreateMouseCursor(width, height, hotX, hotY, bgra, pitch) {
      this.calls.push({ method: "remotePlayCreateMouseCursor", args: [width, height, hotX, hotY, bgra, pitch] });
      return 1234;
    },
    remotePlaySetMouseCursor(sessionId, cursorId) {
      this.calls.push({ method: "remotePlaySetMouseCursor", args: [sessionId, cursorId] });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  steam.timeline.setTimelineTooltip("Overtime", 0.5);
  steam.timeline.clearTimelineTooltip(0.25);
  steam.timeline.setTimelineGameMode(steam.TimelineGameMode.Playing);
  assert.equal(
    steam.timeline.addInstantaneousTimelineEvent("Goal", "Scored", "icon", 100, -1, steam.TimelineEventClipPriority.Standard),
    9001n
  );
  assert.equal(steam.timeline.addRangeTimelineEvent("Boss", "Fight", "boss", 100, 0, 30, 3), 9002n);
  assert.equal(steam.timeline.startRangeTimelineEvent("Round", "Start", "round", 100, 0, 2), 9003n);
  steam.timeline.updateRangeTimelineEvent(9003n, "Round", "Updated", "round", steam.TimelinePriority.KeepCurrentValue, 2);
  steam.timeline.endRangeTimelineEvent(9003n, 0);
  steam.timeline.removeTimelineEvent(9003n);
  assert.deepEqual(await steam.timeline.doesEventRecordingExist(9001n), { event: 9001n, recordingExists: true });
  steam.timeline.startGamePhase();
  steam.timeline.setGamePhaseId("round-1");
  assert.deepEqual(await steam.timeline.doesGamePhaseRecordingExist("round-1"), {
    phaseId: "round-1",
    recordingMs: 1500n,
    longestClipMs: 750n,
    clipCount: 2,
    screenshotCount: 3
  });
  steam.timeline.addGamePhaseTag("boss", "icon", "encounter", 100);
  steam.timeline.setGamePhaseAttribute("difficulty", "hard", 100);
  steam.timeline.openOverlayToGamePhase("round-1");
  steam.timeline.openOverlayToTimelineEvent(9001n);
  steam.timeline.endGamePhase();

  assert.equal(steam.remotePlay.getSessionCount(), 1);
  assert.equal(steam.remotePlay.getSessionId(0), 42);
  assert.equal(steam.remotePlay.getSessions()[0].steamId.steamId64, 76561198000000004n);
  assert.deepEqual(steam.remotePlay.getSessions()[0].resolution, { width: 1920, height: 1080 });
  assert.equal(steam.remotePlay.isRemotePlayTogether(42), true);
  assert.equal(steam.remotePlay.getSessionSteamId(42).steamId64, 76561198000000004n);
  assert.equal(steam.remotePlay.getSessionGuestId(42), 77);
  assert.equal(steam.remotePlay.getSmallSessionAvatar(42), 11);
  assert.equal(steam.remotePlay.getMediumSessionAvatar(42), 12);
  assert.equal(steam.remotePlay.getLargeSessionAvatar(42), 13);
  assert.equal(steam.remotePlay.getSessionClientName(42), "Living Room");
  assert.equal(steam.remotePlay.getSessionClientFormFactor(42), steam.RemotePlayDeviceFormFactor.TV);
  assert.deepEqual(steam.remotePlay.getSessionClientResolution(42), { width: 1920, height: 1080 });
  assert.equal(steam.remotePlay.showRemotePlayTogetherUi(), true);
  assert.equal(steam.remotePlay.sendRemotePlayTogetherInvite(76561198000000004n), true);
  assert.equal(steam.remotePlay.enableRemotePlayTogetherDirectInput(), true);
  steam.remotePlay.disableRemotePlayTogetherDirectInput();
  assert.equal(steam.remotePlay.getInput(2)[0].normalizedX, 0.25);
  assert.equal(steam.remotePlay.getInput(2)[1].keycode, 65);
  steam.remotePlay.setMouseVisibility(42, true);
  steam.remotePlay.setMousePosition(42, 0.5, 0.5);
  assert.equal(steam.remotePlay.createMouseCursor(1, 1, 0, 0, Buffer.from([0, 0, 0, 255]), 4), 1234);
  steam.remotePlay.setMouseCursor(42, 1234);
});

test("workshop updates and queries normalize progress, IDs, and snake_case fields", async (t) => {
  const fake = createFakeNative();
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  const progressEvents = [];
  const updateDetails = { title: "Generic Workshop Item" };
  const updateResult = await new Promise((resolve, reject) => {
    steam.workshop.updateItemWithCallback(
      42n,
      updateDetails,
      480,
      resolve,
      reject,
      (progress) => progressEvents.push(progress),
      250
    );
  });

  assert.deepEqual(progressEvents, [{ status: 3, progress: 128n, total: 256n }]);
  assert.deepEqual(updateResult, {
    itemId: 12345678901234567890n,
    needsToAcceptAgreement: true
  });

  const updateCall = fake.calls.find((call) => call.method === "workshopUpdateItemWithProgress");
  assert.deepEqual(updateCall.args, [42n, updateDetails, 480, 250]);

  const itemsResult = await steam.workshop.getItems([12345678901234567890n], { includeMetadata: true });
  assert.equal(itemsResult.wasCached, true);
  assert.equal(itemsResult.items[0].publishedFileId, 12345678901234567890n);
  assert.equal(itemsResult.items[0].creatorAppId, 480);
  assert.equal(itemsResult.items[0].owner.steamId64, 76561198000000002n);
  assert.equal(itemsResult.items[0].statistics.numSubscriptions, 12n);
  assert.equal(itemsResult.nextCursor, "cursor-2");
  assert.deepEqual(itemsResult.items[0].tagDetails, [{ name: "example", displayName: "Example" }]);
  assert.equal(itemsResult.items[0].metadata, "{\"kind\":\"test\"}");
  assert.deepEqual(itemsResult.items[0].children, [43n]);
  assert.deepEqual(itemsResult.items[0].additionalPreviews, [
    { urlOrVideoId: "preview.png", originalFileName: "preview.png", previewType: 0 }
  ]);
  assert.deepEqual(itemsResult.items[0].keyValueTags, [{ key: "mode", value: "coop" }]);
  assert.deepEqual(itemsResult.items[0].firstKeyValueTags, [{ key: "mode", value: "coop" }]);
  assert.deepEqual(itemsResult.items[0].supportedGameVersions, [{ gameBranchMin: "1.0", gameBranchMax: "2.0" }]);
  assert.deepEqual(itemsResult.items[0].contentDescriptors, [5]);

  assert.equal(steam.SteamCallback.SteamUGCQueryCompleted, 3401);
  assert.equal(steam.SteamCallback.SteamUGCWorkshopEULAStatus, 3420);
  assert.equal(steam.workshop.UGCContentDescriptor.AnyMatureContent, 5);
  assert.equal(steam.workshop.ItemPreviewType.YouTubeVideo, 1);

  assert.deepEqual(await steam.workshop.createItem(480), {
    itemId: 12345678901234567890n,
    needsToAcceptAgreement: false
  });
  assert.deepEqual(steam.workshop.getItemUpdateProgress(99n), {
    status: 3,
    progress: 32n,
    total: 64n
  });
  await steam.workshop.subscribe(42n);
  await steam.workshop.unsubscribe(42n);
  assert.deepEqual(await steam.workshop.addFavorite(42n, 480), {
    result: 1,
    itemId: 42n,
    wasAddRequest: true
  });
  assert.deepEqual(await steam.workshop.removeFavorite(42n, 480), {
    result: 1,
    itemId: 42n,
    wasAddRequest: false
  });
  assert.deepEqual(await steam.workshop.setUserItemVote(42n, true), {
    result: 1,
    itemId: 42n,
    voteUp: true
  });
  assert.deepEqual(await steam.workshop.getUserItemVote(42n), {
    result: 1,
    itemId: 42n,
    votedUp: true,
    votedDown: false,
    voteSkipped: false
  });
  assert.deepEqual(await steam.workshop.startPlaytimeTracking([42n]), { result: 1 });
  assert.deepEqual(await steam.workshop.stopPlaytimeTracking([42n]), { result: 1 });
  assert.deepEqual(await steam.workshop.stopPlaytimeTrackingForAllItems(), { result: 1 });
  assert.deepEqual(await steam.workshop.addDependency(42n, 43n), {
    result: 1,
    itemId: 42n,
    childItemId: 43n
  });
  assert.deepEqual(await steam.workshop.removeDependency(42n, 43n), {
    result: 1,
    itemId: 42n,
    childItemId: 43n
  });
  assert.deepEqual(await steam.workshop.addAppDependency(42n, 480), {
    result: 1,
    itemId: 42n,
    appId: 480
  });
  assert.deepEqual(await steam.workshop.removeAppDependency(42n, 480), {
    result: 1,
    itemId: 42n,
    appId: 480
  });
  assert.deepEqual(await steam.workshop.getAppDependencies(42n), {
    result: 1,
    itemId: 42n,
    appIds: [480, 481],
    numAppDependencies: 2,
    totalNumAppDependencies: 2
  });
  assert.deepEqual(await steam.workshop.deleteItem(42n), { result: 1, itemId: 42n });
  assert.equal(steam.workshop.showEula(), true);
  assert.deepEqual(await steam.workshop.getEulaStatus(), {
    result: 1,
    appId: 480,
    version: 2,
    actionTime: 1700000400,
    accepted: true,
    needsAction: false
  });
  assert.deepEqual(steam.workshop.getUserContentDescriptorPreferences(8), [1, 5]);
  assert.equal(steam.workshop.state(42n), 4);
  assert.deepEqual(steam.workshop.installInfo(42n), {
    folder: "/tmp/workshop",
    sizeOnDisk: 4096n,
    timestamp: 1700000400
  });
  assert.deepEqual(steam.workshop.downloadInfo(42n), { current: 128n, total: 256n });
  assert.equal(steam.workshop.download(42n, true), true);
  assert.equal(steam.workshop.initWorkshopForGameServer(480, "/tmp/workshop"), true);
  steam.workshop.suspendDownloads(true);
  assert.equal(steam.workshop.setItemsDisabledLocally([42n, 43n], true), true);
  assert.equal(steam.workshop.setSubscriptionsLoadOrder([43n, 42n]), true);
  assert.equal(steam.workshop.markDownloadedItemAsUnused(42n), true);
  assert.deepEqual(steam.workshop.getDownloadedItems(2), [42n, 43n]);
  assert.deepEqual(steam.workshop.getSubscribedItems(), [42n, 43n]);

  const cursorResult = await steam.workshop.getAllItemsByCursor(
    "cursor-1",
    steam.workshop.UGCQueryType.RankedByVote,
    steam.workshop.UGCType.Items,
    480,
    480,
    {
      includeChildren: true,
      includeKeyValueTags: true,
      firstKeyValueTagKeys: ["mode"],
      requiredKeyValueTags: { mode: "coop" },
      requiredTagGroups: [["example", "test"]]
    }
  );
  assert.equal(cursorResult.nextCursor, "cursor-2");

  const userItemsResult = await steam.workshop.getUserItems(
    1,
    39734274,
    steam.workshop.UserListType.Published,
    steam.workshop.UGCType.Items,
    steam.workshop.UserListOrder.CreationOrderDesc,
    { creator: 480, consumer: 480 },
    { includeMetadata: true }
  );
  assert.equal(userItemsResult.items[0].publishedFileId, 12345678901234567890n);

  const requestedDetails = await steam.workshop.requestItemDetails(42n, 60);
  assert.equal(requestedDetails.wasCached, true);
  assert.equal(requestedDetails.details.publishedFileId, 42n);
  assert.deepEqual(requestedDetails.details.tags, ["space", "war"]);

  const voteEvents = [];
  const voteHandle = steam.callback.register(steam.SteamCallback.SteamUGCSetUserItemVoteResult, (event) => {
    voteEvents.push(event);
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCSetUserItemVoteResult)({
    item_id: "42",
    vote_up: true,
    result: 1
  });
  voteHandle.disconnect();
  assert.deepEqual(voteEvents, [{ item_id: 42n, vote_up: true, result: 1, itemId: 42n, voteUp: true }]);

  const detailEvents = [];
  const detailHandle = steam.callback.register(steam.SteamCallback.SteamUGCRequestDetailsResult, (event) => {
    detailEvents.push(event);
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCRequestDetailsResult)({
    details: {
      published_file_id: "42",
      creator_app_id: 480,
      title: "Workshop Item",
      tags: "space,war",
      file_size: "12",
      preview_file: "99",
      accepted_for_use: true
    },
    was_cached: true
  });
  detailHandle.disconnect();
  assert.equal(detailEvents[0].wasCached, true);
  assert.equal(detailEvents[0].details.publishedFileId, 42n);
  assert.equal(detailEvents[0].details.creatorAppId, 480);
  assert.deepEqual(detailEvents[0].details.tags, ["space", "war"]);
  assert.equal(detailEvents[0].details.fileSize, 12n);
  assert.equal(detailEvents[0].details.previewFile, 99n);
  assert.equal(detailEvents[0].details.acceptedForUse, true);

  const callbackEvents = new Map();
  const callbackIds = [
    steam.SteamCallback.SteamUGCQueryCompleted,
    steam.SteamCallback.SteamUGCRequestDetailsResult,
    steam.SteamCallback.SteamUGCCreateItemResult,
    steam.SteamCallback.SteamUGCSubmitItemUpdateResult,
    steam.SteamCallback.SteamUGCItemInstalled,
    steam.SteamCallback.SteamUGCDownloadItemResult,
    steam.SteamCallback.SteamUGCUserFavoriteItemsListChanged,
    steam.SteamCallback.SteamUGCSetUserItemVoteResult,
    steam.SteamCallback.SteamUGCGetUserItemVoteResult,
    steam.SteamCallback.SteamUGCStartPlaytimeTrackingResult,
    steam.SteamCallback.SteamUGCStopPlaytimeTrackingResult,
    steam.SteamCallback.SteamUGCAddDependencyResult,
    steam.SteamCallback.SteamUGCRemoveDependencyResult,
    steam.SteamCallback.SteamUGCAddAppDependencyResult,
    steam.SteamCallback.SteamUGCRemoveAppDependencyResult,
    steam.SteamCallback.SteamUGCGetAppDependenciesResult,
    steam.SteamCallback.SteamUGCDeleteItemResult,
    steam.SteamCallback.SteamUGCUserSubscribedItemsListChanged,
    steam.SteamCallback.SteamUGCWorkshopEULAStatus
  ];
  const callbackHandles = [
    steam.workshop.onQueryCompleted((event) => callbackEvents.set("query", event)),
    steam.workshop.onRequestDetailsResult((event) => callbackEvents.set("details", event)),
    steam.workshop.onCreateItemResult((event) => callbackEvents.set("create", event)),
    steam.workshop.onSubmitItemUpdateResult((event) => callbackEvents.set("submit", event)),
    steam.workshop.onItemInstalled((event) => callbackEvents.set("installed", event)),
    steam.workshop.onDownloadItemResult((event) => callbackEvents.set("download", event)),
    steam.workshop.onUserFavoriteItemsListChanged((event) => callbackEvents.set("favorite", event)),
    steam.workshop.onSetUserItemVoteResult((event) => callbackEvents.set("setVote", event)),
    steam.workshop.onGetUserItemVoteResult((event) => callbackEvents.set("getVote", event)),
    steam.workshop.onStartPlaytimeTrackingResult((event) => callbackEvents.set("startPlaytime", event)),
    steam.workshop.onStopPlaytimeTrackingResult((event) => callbackEvents.set("stopPlaytime", event)),
    steam.workshop.onAddDependencyResult((event) => callbackEvents.set("addDependency", event)),
    steam.workshop.onRemoveDependencyResult((event) => callbackEvents.set("removeDependency", event)),
    steam.workshop.onAddAppDependencyResult((event) => callbackEvents.set("addAppDependency", event)),
    steam.workshop.onRemoveAppDependencyResult((event) => callbackEvents.set("removeAppDependency", event)),
    steam.workshop.onGetAppDependenciesResult((event) => callbackEvents.set("getAppDependencies", event)),
    steam.workshop.onDeleteItemResult((event) => callbackEvents.set("delete", event)),
    steam.workshop.onUserSubscribedItemsListChanged((event) => callbackEvents.set("subscribed", event)),
    steam.workshop.onWorkshopEulaStatus((event) => callbackEvents.set("eula", event))
  ];

  fake.callbacks.get(steam.SteamCallback.SteamUGCQueryCompleted)({
    handle: "99",
    result: 1,
    returned_results: 2,
    total_results: 10,
    was_cached: true,
    next_cursor: "cursor-3"
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCRequestDetailsResult)({
    details: { published_file_id: "42", tags: "space,war" },
    was_cached: true
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCCreateItemResult)({
    result: 1,
    item_id: "42",
    needs_to_accept_agreement: true
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCSubmitItemUpdateResult)({
    result: 1,
    item_id: "42",
    needs_to_accept_agreement: false
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCItemInstalled)({
    app_id: 480,
    item_id: "42",
    legacy_content: "9001",
    manifest_id: "9002"
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCDownloadItemResult)({
    app_id: 480,
    item_id: "42",
    result: 1
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCUserFavoriteItemsListChanged)({
    item_id: "42",
    result: 1,
    was_add_request: true
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCSetUserItemVoteResult)({
    item_id: "42",
    result: 1,
    vote_up: true
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCGetUserItemVoteResult)({
    item_id: "42",
    result: 1,
    voted_up: true,
    voted_down: false,
    vote_skipped: false
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCStartPlaytimeTrackingResult)({ result: 1 });
  fake.callbacks.get(steam.SteamCallback.SteamUGCStopPlaytimeTrackingResult)({ result: 1 });
  fake.callbacks.get(steam.SteamCallback.SteamUGCAddDependencyResult)({
    result: 1,
    item_id: "42",
    child_item_id: "43"
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCRemoveDependencyResult)({
    result: 1,
    item_id: "42",
    child_item_id: "43"
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCAddAppDependencyResult)({
    result: 1,
    item_id: "42",
    app_id: 480
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCRemoveAppDependencyResult)({
    result: 1,
    item_id: "42",
    app_id: 480
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCGetAppDependenciesResult)({
    result: 1,
    item_id: "42",
    app_ids: [480, 481],
    num_app_dependencies: 2,
    total_num_app_dependencies: 3
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCDeleteItemResult)({ result: 1, item_id: "42" });
  fake.callbacks.get(steam.SteamCallback.SteamUGCUserSubscribedItemsListChanged)({ app_id: 480 });
  fake.callbacks.get(steam.SteamCallback.SteamUGCWorkshopEULAStatus)({
    result: 1,
    app_id: 480,
    version: 2,
    action_time: 1700000400,
    accepted: true,
    needs_action: false
  });

  assert.equal(callbackEvents.get("query").handle, 99n);
  assert.equal(callbackEvents.get("query").returnedResults, 2);
  assert.equal(callbackEvents.get("query").totalResults, 10);
  assert.equal(callbackEvents.get("query").wasCached, true);
  assert.equal(callbackEvents.get("query").nextCursor, "cursor-3");
  assert.equal(callbackEvents.get("details").details.publishedFileId, 42n);
  assert.deepEqual(callbackEvents.get("details").details.tags, ["space", "war"]);
  assert.equal(callbackEvents.get("create").itemId, 42n);
  assert.equal(callbackEvents.get("create").needsToAcceptAgreement, true);
  assert.equal(callbackEvents.get("submit").needsToAcceptAgreement, false);
  assert.equal(callbackEvents.get("installed").legacyContent, 9001n);
  assert.equal(callbackEvents.get("installed").manifestId, 9002n);
  assert.equal(callbackEvents.get("download").appId, 480);
  assert.equal(callbackEvents.get("favorite").wasAddRequest, true);
  assert.equal(callbackEvents.get("setVote").voteUp, true);
  assert.equal(callbackEvents.get("getVote").votedUp, true);
  assert.equal(callbackEvents.get("startPlaytime").result, 1);
  assert.equal(callbackEvents.get("stopPlaytime").result, 1);
  assert.equal(callbackEvents.get("addDependency").childItemId, 43n);
  assert.equal(callbackEvents.get("removeDependency").childItemId, 43n);
  assert.equal(callbackEvents.get("addAppDependency").appId, 480);
  assert.equal(callbackEvents.get("removeAppDependency").appId, 480);
  assert.deepEqual(callbackEvents.get("getAppDependencies").appIds, [480, 481]);
  assert.equal(callbackEvents.get("getAppDependencies").totalNumAppDependencies, 3);
  assert.equal(callbackEvents.get("delete").itemId, 42n);
  assert.equal(callbackEvents.get("subscribed").appId, 480);
  assert.equal(callbackEvents.get("eula").needsAction, false);

  assert.deepEqual(
    fake.calls
      .filter((call) => call.method === "registerSteamCallback")
      .slice(-callbackIds.length)
      .map((call) => call.args[0]),
    callbackIds
  );
  for (const handle of callbackHandles) {
    handle.disconnect();
  }
  assert.deepEqual(
    fake.calls
      .filter((call) => call.method === "disconnectCallback")
      .slice(-callbackIds.length)
      .map((call) => call.args[0]),
    callbackIds
  );

  assert.deepEqual(fake.calls.find((call) => call.method === "workshopGetAppDependencies"), {
    method: "workshopGetAppDependencies",
    args: [42n]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "workshopGetUserContentDescriptorPreferences"), {
    method: "workshopGetUserContentDescriptorPreferences",
    args: [8]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "workshopCreateItem"), {
    method: "workshopCreateItem",
    args: [480]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "workshopGetItemUpdateProgress"), {
    method: "workshopGetItemUpdateProgress",
    args: [99n]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "workshopDownload"), {
    method: "workshopDownload",
    args: [42n, true]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "workshopGetAllItemsByCursor"), {
    method: "workshopGetAllItemsByCursor",
    args: [
      "cursor-1",
      steam.workshop.UGCQueryType.RankedByVote,
      steam.workshop.UGCType.Items,
      480,
      480,
      {
        includeChildren: true,
        includeKeyValueTags: true,
        firstKeyValueTagKeys: ["mode"],
        requiredKeyValueTags: { mode: "coop" },
        requiredTagGroups: [["example", "test"]]
      }
    ]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "workshopGetUserItems"), {
    method: "workshopGetUserItems",
    args: [
      1,
      39734274,
      steam.workshop.UserListType.Published,
      steam.workshop.UGCType.Items,
      steam.workshop.UserListOrder.CreationOrderDesc,
      480,
      480,
      { includeMetadata: true }
    ]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "workshopRequestItemDetails"), {
    method: "workshopRequestItemDetails",
    args: [42n, 60]
  });
});

test("game server workshop facade uses game-server native bindings", async (t) => {
  const fake = createFakeNative({
    gameServerWorkshopCreateItem(appId) {
      this.calls.push({ method: "gameServerWorkshopCreateItem", args: [appId] });
      return Promise.resolve({ item_id: "9876543210987654321", needs_to_accept_agreement: false });
    },
    gameServerWorkshopUpdateItem(itemId, updateDetails, appId) {
      this.calls.push({ method: "gameServerWorkshopUpdateItem", args: [itemId, updateDetails, appId] });
      return Promise.resolve({ item_id: itemId.toString(), needs_to_accept_agreement: true });
    },
    gameServerWorkshopUpdateItemWithProgress(itemId, updateDetails, appId, progressHandler, progressIntervalMs) {
      this.calls.push({
        method: "gameServerWorkshopUpdateItemWithProgress",
        args: [itemId, updateDetails, appId, progressIntervalMs]
      });
      progressHandler({ status: 3, progress: "64", total: "128" });
      return Promise.resolve({ item_id: "9876543210987654321", needs_to_accept_agreement: false });
    },
    gameServerWorkshopSubscribe(itemId) {
      this.calls.push({ method: "gameServerWorkshopSubscribe", args: [itemId] });
      return Promise.resolve();
    },
    gameServerWorkshopUnsubscribe(itemId) {
      this.calls.push({ method: "gameServerWorkshopUnsubscribe", args: [itemId] });
      return Promise.resolve();
    },
    gameServerWorkshopGetItems(items, queryConfig) {
      this.calls.push({ method: "gameServerWorkshopGetItems", args: [items, queryConfig] });
      return Promise.resolve({
        was_cached: true,
        next_cursor: "server-cursor-2",
        items: [
          {
            published_file_id: "9876543210987654321",
            creator_app_id: 480,
            consumer_app_id: 480,
            title: "Game Server Workshop Item",
            owner: { steamId64: "76561198000000002", steamId32: "STEAM_0:0:19867137", accountId: 39734274 },
            tags: ["server", "ugc"],
            num_subscriptions: "5"
          }
        ]
      });
    },
    gameServerWorkshopGetItemUpdateProgress(handle) {
      this.calls.push({ method: "gameServerWorkshopGetItemUpdateProgress", args: [handle] });
      return { status: 3, progress: "32", total: "64" };
    },
    gameServerWorkshopAddFavorite(itemId, appId) {
      this.calls.push({ method: "gameServerWorkshopAddFavorite", args: [itemId, appId] });
      return Promise.resolve({ result: 1, item_id: itemId, was_add_request: true });
    },
    gameServerWorkshopRemoveFavorite(itemId, appId) {
      this.calls.push({ method: "gameServerWorkshopRemoveFavorite", args: [itemId, appId] });
      return Promise.resolve({ result: 1, item_id: itemId, was_add_request: false });
    },
    gameServerWorkshopSetUserItemVote(itemId, voteUp) {
      this.calls.push({ method: "gameServerWorkshopSetUserItemVote", args: [itemId, voteUp] });
      return Promise.resolve({ result: 1, item_id: itemId, vote_up: voteUp });
    },
    gameServerWorkshopGetUserItemVote(itemId) {
      this.calls.push({ method: "gameServerWorkshopGetUserItemVote", args: [itemId] });
      return Promise.resolve({ result: 1, item_id: itemId, voted_up: true, voted_down: false, vote_skipped: false });
    },
    gameServerWorkshopStartPlaytimeTracking(itemIds) {
      this.calls.push({ method: "gameServerWorkshopStartPlaytimeTracking", args: [itemIds] });
      return Promise.resolve({ result: 1 });
    },
    gameServerWorkshopStopPlaytimeTracking(itemIds) {
      this.calls.push({ method: "gameServerWorkshopStopPlaytimeTracking", args: [itemIds] });
      return Promise.resolve({ result: 1 });
    },
    gameServerWorkshopStopPlaytimeTrackingForAllItems() {
      this.calls.push({ method: "gameServerWorkshopStopPlaytimeTrackingForAllItems", args: [] });
      return Promise.resolve({ result: 1 });
    },
    gameServerWorkshopAddDependency(parentItemId, childItemId) {
      this.calls.push({ method: "gameServerWorkshopAddDependency", args: [parentItemId, childItemId] });
      return Promise.resolve({ result: 1, item_id: parentItemId, child_item_id: childItemId });
    },
    gameServerWorkshopRemoveDependency(parentItemId, childItemId) {
      this.calls.push({ method: "gameServerWorkshopRemoveDependency", args: [parentItemId, childItemId] });
      return Promise.resolve({ result: 1, item_id: parentItemId, child_item_id: childItemId });
    },
    gameServerWorkshopAddAppDependency(itemId, appId) {
      this.calls.push({ method: "gameServerWorkshopAddAppDependency", args: [itemId, appId] });
      return Promise.resolve({ result: 1, item_id: itemId, app_id: appId });
    },
    gameServerWorkshopRemoveAppDependency(itemId, appId) {
      this.calls.push({ method: "gameServerWorkshopRemoveAppDependency", args: [itemId, appId] });
      return Promise.resolve({ result: 1, item_id: itemId, app_id: appId });
    },
    gameServerWorkshopGetAppDependencies(itemId) {
      this.calls.push({ method: "gameServerWorkshopGetAppDependencies", args: [itemId] });
      return Promise.resolve({
        result: 1,
        item_id: itemId,
        app_ids: [480],
        num_app_dependencies: 1,
        total_num_app_dependencies: 1
      });
    },
    gameServerWorkshopDeleteItem(itemId) {
      this.calls.push({ method: "gameServerWorkshopDeleteItem", args: [itemId] });
      return Promise.resolve({ result: 1, item_id: itemId });
    },
    gameServerWorkshopShowEula() {
      this.calls.push({ method: "gameServerWorkshopShowEula", args: [] });
      return true;
    },
    gameServerWorkshopGetEulaStatus() {
      this.calls.push({ method: "gameServerWorkshopGetEulaStatus", args: [] });
      return Promise.resolve({
        result: 1,
        app_id: 480,
        version: 2,
        action_time: 1700000400,
        accepted: true,
        needs_action: false
      });
    },
    gameServerWorkshopGetUserContentDescriptorPreferences(maxEntries) {
      this.calls.push({ method: "gameServerWorkshopGetUserContentDescriptorPreferences", args: [maxEntries] });
      return [5];
    },
    gameServerWorkshopState(itemId) {
      this.calls.push({ method: "gameServerWorkshopState", args: [itemId] });
      return 4;
    },
    gameServerWorkshopInstallInfo(itemId) {
      this.calls.push({ method: "gameServerWorkshopInstallInfo", args: [itemId] });
      return { folder: "/tmp/server-workshop", sizeOnDisk: "4096", timestamp: 1700000400 };
    },
    gameServerWorkshopDownloadInfo(itemId) {
      this.calls.push({ method: "gameServerWorkshopDownloadInfo", args: [itemId] });
      return { current: "128", total: "256" };
    },
    gameServerWorkshopDownload(itemId, highPriority) {
      this.calls.push({ method: "gameServerWorkshopDownload", args: [itemId, highPriority] });
      return true;
    },
    gameServerWorkshopInitWorkshopForGameServer(depotId, folder) {
      this.calls.push({ method: "gameServerWorkshopInitWorkshopForGameServer", args: [depotId, folder] });
      return true;
    },
    gameServerWorkshopSuspendDownloads(suspend) {
      this.calls.push({ method: "gameServerWorkshopSuspendDownloads", args: [suspend] });
    },
    gameServerWorkshopSetItemsDisabledLocally(itemIds, disabled) {
      this.calls.push({ method: "gameServerWorkshopSetItemsDisabledLocally", args: [itemIds, disabled] });
      return true;
    },
    gameServerWorkshopSetSubscriptionsLoadOrder(itemIds) {
      this.calls.push({ method: "gameServerWorkshopSetSubscriptionsLoadOrder", args: [itemIds] });
      return true;
    },
    gameServerWorkshopMarkDownloadedItemAsUnused(itemId) {
      this.calls.push({ method: "gameServerWorkshopMarkDownloadedItemAsUnused", args: [itemId] });
      return true;
    },
    gameServerWorkshopGetDownloadedItems(maxEntries) {
      this.calls.push({ method: "gameServerWorkshopGetDownloadedItems", args: [maxEntries] });
      return [42n, "43"];
    },
    gameServerWorkshopGetSubscribedItems() {
      this.calls.push({ method: "gameServerWorkshopGetSubscribedItems", args: [] });
      return [42n, "43"];
    },
    gameServerWorkshopGetAllItems(page, queryType, itemType, creatorAppId, consumerAppId, queryConfig) {
      this.calls.push({
        method: "gameServerWorkshopGetAllItems",
        args: [page, queryType, itemType, creatorAppId, consumerAppId, queryConfig]
      });
      return this.gameServerWorkshopGetItems([], queryConfig);
    },
    gameServerWorkshopGetAllItemsByCursor(cursor, queryType, itemType, creatorAppId, consumerAppId, queryConfig) {
      this.calls.push({
        method: "gameServerWorkshopGetAllItemsByCursor",
        args: [cursor, queryType, itemType, creatorAppId, consumerAppId, queryConfig]
      });
      return this.gameServerWorkshopGetItems([], queryConfig);
    },
    gameServerWorkshopGetUserItems(page, accountId, listType, itemType, sortOrder, creatorAppId, consumerAppId, queryConfig) {
      this.calls.push({
        method: "gameServerWorkshopGetUserItems",
        args: [page, accountId, listType, itemType, sortOrder, creatorAppId, consumerAppId, queryConfig]
      });
      return this.gameServerWorkshopGetItems([], queryConfig);
    },
    gameServerWorkshopRequestItemDetails(itemId, maxAgeSeconds) {
      this.calls.push({ method: "gameServerWorkshopRequestItemDetails", args: [itemId, maxAgeSeconds] });
      return Promise.resolve({
        details: {
          published_file_id: itemId.toString(),
          creator_app_id: 480,
          title: "Game Server Workshop Item",
          tags: "server,ugc",
          file_size: "12",
          preview_file: "99",
          accepted_for_use: true
        },
        was_cached: true
      });
    }
  });
  const steam = loadSteamWithFakeNative(fake);

  t.after(clearSteamBridgeCache);

  assert.deepEqual(Object.keys(steam.gameServerWorkshop).sort(), Object.keys(steam.workshop).sort());
  assert.equal(steam.gameServerWorkshop.UGCContentDescriptor.AnyMatureContent, 5);

  const serverDeleteEvents = [];
  const serverDeleteHandle = steam.gameServerWorkshop.onDeleteItemResult((event) => {
    serverDeleteEvents.push(event);
  });
  fake.callbacks.get(steam.SteamCallback.SteamUGCDeleteItemResult)({ result: 1, item_id: "44" });
  serverDeleteHandle.disconnect();
  assert.equal(serverDeleteEvents[0].itemId, 44n);

  const progressEvents = [];
  const updateDetails = { title: "Game Server Workshop Item" };
  const updateResult = await new Promise((resolve, reject) => {
    steam.gameServerWorkshop.updateItemWithCallback(
      42n,
      updateDetails,
      480,
      resolve,
      reject,
      (progress) => progressEvents.push(progress),
      100
    );
  });

  assert.deepEqual(progressEvents, [{ status: 3, progress: 64n, total: 128n }]);
  assert.deepEqual(updateResult, {
    itemId: 9876543210987654321n,
    needsToAcceptAgreement: false
  });

  const itemsResult = await steam.gameServerWorkshop.getItems([9876543210987654321n], { includeMetadata: true });
  assert.equal(itemsResult.wasCached, true);
  assert.equal(itemsResult.items[0].publishedFileId, 9876543210987654321n);
  assert.equal(itemsResult.items[0].owner.steamId64, 76561198000000002n);
  assert.deepEqual(itemsResult.items[0].tags, ["server", "ugc"]);
  assert.equal(itemsResult.items[0].statistics.numSubscriptions, 5n);
  assert.deepEqual(steam.gameServerWorkshop.getItemUpdateProgress(99n), {
    status: 3,
    progress: 32n,
    total: 64n
  });

  assert.deepEqual(await steam.gameServerWorkshop.createItem(480), {
    itemId: 9876543210987654321n,
    needsToAcceptAgreement: false
  });
  assert.deepEqual(await steam.gameServerWorkshop.updateItem(42n, updateDetails, 480), {
    itemId: 42n,
    needsToAcceptAgreement: true
  });
  await steam.gameServerWorkshop.subscribe(42n);
  await steam.gameServerWorkshop.unsubscribe(42n);
  assert.deepEqual(await steam.gameServerWorkshop.addFavorite(42n, 480), {
    result: 1,
    itemId: 42n,
    wasAddRequest: true
  });
  assert.deepEqual(await steam.gameServerWorkshop.removeFavorite(42n, 480), {
    result: 1,
    itemId: 42n,
    wasAddRequest: false
  });
  assert.deepEqual(await steam.gameServerWorkshop.setUserItemVote(42n, true), {
    result: 1,
    itemId: 42n,
    voteUp: true
  });
  assert.deepEqual(await steam.gameServerWorkshop.getUserItemVote(42n), {
    result: 1,
    itemId: 42n,
    votedUp: true,
    votedDown: false,
    voteSkipped: false
  });
  assert.deepEqual(await steam.gameServerWorkshop.startPlaytimeTracking([42n]), { result: 1 });
  assert.deepEqual(await steam.gameServerWorkshop.stopPlaytimeTracking([42n]), { result: 1 });
  assert.deepEqual(await steam.gameServerWorkshop.stopPlaytimeTrackingForAllItems(), { result: 1 });
  assert.deepEqual(await steam.gameServerWorkshop.addDependency(42n, 43n), {
    result: 1,
    itemId: 42n,
    childItemId: 43n
  });
  assert.deepEqual(await steam.gameServerWorkshop.removeDependency(42n, 43n), {
    result: 1,
    itemId: 42n,
    childItemId: 43n
  });
  assert.deepEqual(await steam.gameServerWorkshop.addAppDependency(42n, 480), {
    result: 1,
    itemId: 42n,
    appId: 480
  });
  assert.deepEqual(await steam.gameServerWorkshop.removeAppDependency(42n, 480), {
    result: 1,
    itemId: 42n,
    appId: 480
  });
  assert.deepEqual(await steam.gameServerWorkshop.getAppDependencies(42n), {
    result: 1,
    itemId: 42n,
    appIds: [480],
    numAppDependencies: 1,
    totalNumAppDependencies: 1
  });
  assert.deepEqual(await steam.gameServerWorkshop.deleteItem(42n), { result: 1, itemId: 42n });
  assert.equal(steam.gameServerWorkshop.showEula(), true);
  assert.deepEqual(await steam.gameServerWorkshop.getEulaStatus(), {
    result: 1,
    appId: 480,
    version: 2,
    actionTime: 1700000400,
    accepted: true,
    needsAction: false
  });
  assert.deepEqual(steam.gameServerWorkshop.getUserContentDescriptorPreferences(8), [5]);
  assert.equal(steam.gameServerWorkshop.state(42n), 4);
  assert.deepEqual(steam.gameServerWorkshop.installInfo(42n), {
    folder: "/tmp/server-workshop",
    sizeOnDisk: 4096n,
    timestamp: 1700000400
  });
  assert.deepEqual(steam.gameServerWorkshop.downloadInfo(42n), { current: 128n, total: 256n });
  assert.equal(steam.gameServerWorkshop.download(42n, true), true);
  assert.equal(steam.gameServerWorkshop.initWorkshopForGameServer(480, "/tmp/server-workshop"), true);
  steam.gameServerWorkshop.suspendDownloads(true);
  assert.equal(steam.gameServerWorkshop.setItemsDisabledLocally([42n, 43n], true), true);
  assert.equal(steam.gameServerWorkshop.setSubscriptionsLoadOrder([43n, 42n]), true);
  assert.equal(steam.gameServerWorkshop.markDownloadedItemAsUnused(42n), true);
  assert.deepEqual(steam.gameServerWorkshop.getDownloadedItems(2), [42n, 43n]);
  assert.deepEqual(steam.gameServerWorkshop.getSubscribedItems(), [42n, 43n]);
  assert.equal(
    (await steam.gameServerWorkshop.getAllItems(
      1,
      steam.gameServerWorkshop.UGCQueryType.RankedByVote,
      steam.gameServerWorkshop.UGCType.Items,
      480,
      480,
      { includeMetadata: true }
    )).items[0].publishedFileId,
    9876543210987654321n
  );
  assert.equal(
    (await steam.gameServerWorkshop.getAllItemsByCursor(
      "server-cursor-1",
      steam.gameServerWorkshop.UGCQueryType.RankedByVote,
      steam.gameServerWorkshop.UGCType.Items,
      480,
      480,
      { includeMetadata: true }
    )).nextCursor,
    "server-cursor-2"
  );
  assert.equal(
    (await steam.gameServerWorkshop.getUserItems(
      1,
      39734274,
      steam.gameServerWorkshop.UserListType.Published,
      steam.gameServerWorkshop.UGCType.Items,
      steam.gameServerWorkshop.UserListOrder.CreationOrderDesc,
      { creator: 480, consumer: 480 },
      { includeMetadata: true }
    )).items[0].statistics.numSubscriptions,
    5n
  );
  const requestedDetails = await steam.gameServerWorkshop.requestItemDetails(42n, 60);
  assert.equal(requestedDetails.wasCached, true);
  assert.equal(requestedDetails.details.publishedFileId, 42n);
  assert.deepEqual(requestedDetails.details.tags, ["server", "ugc"]);

  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerWorkshopUpdateItemWithProgress"), {
    method: "gameServerWorkshopUpdateItemWithProgress",
    args: [42n, updateDetails, 480, 100]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerWorkshopGetItems"), {
    method: "gameServerWorkshopGetItems",
    args: [[9876543210987654321n], { includeMetadata: true }]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerWorkshopGetAppDependencies"), {
    method: "gameServerWorkshopGetAppDependencies",
    args: [42n]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerWorkshopGetAllItemsByCursor"), {
    method: "gameServerWorkshopGetAllItemsByCursor",
    args: [
      "server-cursor-1",
      steam.gameServerWorkshop.UGCQueryType.RankedByVote,
      steam.gameServerWorkshop.UGCType.Items,
      480,
      480,
      { includeMetadata: true }
    ]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerWorkshopGetUserItems"), {
    method: "gameServerWorkshopGetUserItems",
    args: [
      1,
      39734274,
      steam.gameServerWorkshop.UserListType.Published,
      steam.gameServerWorkshop.UGCType.Items,
      steam.gameServerWorkshop.UserListOrder.CreationOrderDesc,
      480,
      480,
      { includeMetadata: true }
    ]
  });
  assert.deepEqual(fake.calls.find((call) => call.method === "gameServerWorkshopRequestItemDetails"), {
    method: "gameServerWorkshopRequestItemDetails",
    args: [42n, 60]
  });
});

test("web API client builds generic Steam Web API URLs and parses JSON responses", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json; charset=utf-8", "content-type");
          callback("trace-1", "x-trace-id");
        }
      },
      async text() {
        return JSON.stringify({ response: { player_count: 123 } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "secret", fetch: fetchImpl });
  const request = {
    interfaceName: "ISteamUserStats",
    methodName: "GetNumberOfCurrentPlayers",
    version: 1,
    params: {
      appid: 480,
      include_appinfo: false,
      ids: [1n, 2n],
      omitted: null
    }
  };

  t.after(clearSteamBridgeCache);

  assert.equal(
    client.buildUrl(request),
    "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v0001/?key=secret&format=json&appid=480&include_appinfo=0&ids=1&ids=2"
  );

  const response = await client.get(request);
  assert.equal(response.ok, true);
  assert.equal(response.status, 200);
  assert.deepEqual(response.data, { response: { player_count: 123 } });
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(fetchCalls[0].url, client.buildUrl(request));
  assert.equal(fetchCalls[0].init.method, "GET");
});

test("web API post helper sends form fields and supports partner base URLs", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const previousWebApiKey = process.env.STEAM_WEB_API_KEY;
  process.env.STEAM_WEB_API_KEY = "env-secret";
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { trade_offers_sent: [] } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({
    apiKey: null,
    baseUrl: "https://partner.steam-api.com",
    headers: { "x-default": "1" },
    fetch: fetchImpl
  });

  t.after(() => {
    clearSteamBridgeCache();
    if (previousWebApiKey === undefined) {
      delete process.env.STEAM_WEB_API_KEY;
    } else {
      process.env.STEAM_WEB_API_KEY = previousWebApiKey;
    }
  });

  const response = await client.post({
    interfaceName: "IEconService",
    methodName: "GetTradeOffers",
    version: "v1",
    params: {
      get_sent_offers: true,
      appid: 480
    },
    headers: { "x-request": "2" }
  });

  assert.equal(
    fetchCalls[0].url,
    "https://partner.steam-api.com/IEconService/GetTradeOffers/v0001/?format=json"
  );
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.equal(fetchCalls[0].init.body, "get_sent_offers=1&appid=480");
  assert.equal(fetchCalls[0].init.headers["content-type"], "application/x-www-form-urlencoded");
  assert.equal(fetchCalls[0].init.headers["x-default"], "1");
  assert.equal(fetchCalls[0].init.headers["x-request"], "2");
  assert.deepEqual(response.data, { response: { trade_offers_sent: [] } });
  assert.equal(typeof steam.webApi.buildUrl, "function");
  assert.equal(
    steam.buildSteamWebApiUrl({
      interfaceName: "ISteamApps",
      methodName: "GetAppList",
      version: "v2",
      key: null,
      format: null
    }),
    "https://api.steampowered.com/ISteamApps/GetAppList/v0002/"
  );
});

test("web API endpoint facades cover util, user stats, and user helpers", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "secret", fetch: fetchImpl });

  t.after(clearSteamBridgeCache);

  await client.util.getSupportedApiList();
  await client.userStats.getNumberOfCurrentPlayers(480);
  await client.userStats.getGlobalStatsForGame({
    appId: 480,
    names: ["global_wins", "global_losses"],
    startDate: 1700000000,
    endDate: 1700003600
  });
  await client.user.getPlayerSummaries([76561198000000000n, 76561198000000001n]);
  await client.user.resolveVanityUrl("spacewar", { urlType: 3 });
  await client.user.checkAppOwnership({ appId: 480, steamId64: 76561198000000000n });

  assert.equal(
    fetchCalls[0].url,
    "https://api.steampowered.com/ISteamWebAPIUtil/GetSupportedAPIList/v0001/?key=secret&format=json"
  );
  assert.equal(
    fetchCalls[1].url,
    "https://partner.steam-api.com/ISteamUserStats/GetNumberOfCurrentPlayers/v0001/?key=secret&format=json&appid=480"
  );
  assert.match(fetchCalls[2].url, /ISteamUserStats\/GetGlobalStatsForGame\/v0001/);
  assert.match(fetchCalls[2].url, /name%5B0%5D=global_wins/);
  assert.match(fetchCalls[2].url, /name%5B1%5D=global_losses/);
  assert.match(fetchCalls[2].url, /count=2/);
  assert.match(fetchCalls[3].url, /ISteamUser\/GetPlayerSummaries\/v0002/);
  assert.match(fetchCalls[3].url, /steamids=76561198000000000%2C76561198000000001/);
  assert.equal(
    fetchCalls[4].url,
    "https://partner.steam-api.com/ISteamUser/ResolveVanityURL/v0001/?key=secret&format=json&vanityurl=spacewar&url_type=3"
  );
  assert.equal(
    fetchCalls[5].url,
    "https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v0004/?key=secret&format=json&appid=480&steamid=76561198000000000"
  );
});

test("web API microtransaction facades map economy fields and sandbox endpoints", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { result: "OK" } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "publisher-secret", fetch: fetchImpl });

  t.after(clearSteamBridgeCache);

  await client.microTxnSandbox.initTxn({
    appId: 480,
    orderId: 9001n,
    steamId64: 76561198000000000n,
    language: "en",
    currency: "USD",
    userSession: "client",
    items: [
      {
        itemId: 100,
        quantity: 2,
        amount: 199,
        description: "Space credits",
        category: "currency",
        billingType: "Steam",
        period: "Month",
        frequency: 1,
        recurringAmount: 99
      }
    ],
    bundles: [
      {
        bundleId: 500,
        quantity: 1,
        description: "Starter bundle"
      }
    ]
  });
  await client.microTxn.finalizeTxn({ appId: 480, orderId: 9001n });
  await client.microTxn.queryTxn({ appId: 480, transactionId: 123456789n });
  await client.microTxn.refundTxn({ appId: 480, orderId: 9001n });

  assert.equal(
    fetchCalls[0].url,
    "https://partner.steam-api.com/ISteamMicroTxnSandbox/InitTxn/v0003/?key=publisher-secret&format=json"
  );
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.match(fetchCalls[0].init.body, /orderid=9001/);
  assert.match(fetchCalls[0].init.body, /steamid=76561198000000000/);
  assert.match(fetchCalls[0].init.body, /itemcount=1/);
  assert.match(fetchCalls[0].init.body, /itemid%5B0%5D=100/);
  assert.match(fetchCalls[0].init.body, /qty%5B0%5D=2/);
  assert.match(fetchCalls[0].init.body, /description%5B0%5D=Space\+credits/);
  assert.match(fetchCalls[0].init.body, /bundlecount=1/);
  assert.match(fetchCalls[0].init.body, /bundleid%5B0%5D=500/);
  assert.equal(
    fetchCalls[1].url,
    "https://partner.steam-api.com/ISteamMicroTxn/FinalizeTxn/v0002/?key=publisher-secret&format=json"
  );
  assert.equal(fetchCalls[1].init.body, "appid=480&orderid=9001");
  assert.equal(
    fetchCalls[2].url,
    "https://partner.steam-api.com/ISteamMicroTxn/QueryTxn/v0003/?key=publisher-secret&format=json&appid=480&transid=123456789"
  );
  assert.equal(fetchCalls[3].init.body, "appid=480&orderid=9001");
  assert.equal(typeof steam.webApi.microTxn.cancelAgreement, "function");
});

test("web API microtransaction InitTxn session helpers set client and web modes", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { result: "OK" } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "publisher-secret", fetch: fetchImpl });
  const initTxnOptions = {
    appId: 480,
    orderId: 9002n,
    steamId64: 76561198000000000n,
    language: "en",
    currency: "USD",
    items: [
      {
        itemId: 100,
        quantity: 1,
        amount: 199,
        description: "Space credits"
      }
    ]
  };

  t.after(clearSteamBridgeCache);

  await client.microTxnSandbox.initClientTxn(initTxnOptions);
  await client.microTxnSandbox.initWebTxn({ ...initTxnOptions, orderId: 9003n });

  assert.equal(
    fetchCalls[0].url,
    "https://partner.steam-api.com/ISteamMicroTxnSandbox/InitTxn/v0003/?key=publisher-secret&format=json"
  );
  assert.match(fetchCalls[0].init.body, /orderid=9002/);
  assert.match(fetchCalls[0].init.body, /usersession=client/);
  assert.equal(
    fetchCalls[1].url,
    "https://partner.steam-api.com/ISteamMicroTxnSandbox/InitTxn/v0003/?key=publisher-secret&format=json"
  );
  assert.match(fetchCalls[1].init.body, /orderid=9003/);
  assert.match(fetchCalls[1].init.body, /usersession=web/);
});

test("web API app and news facades map public and partner endpoints", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "secret", fetch: fetchImpl });

  t.after(clearSteamBridgeCache);

  await client.apps.getAppList();
  await client.apps.getAppBetas(480);
  await client.apps.getPartnerAppListForWebApiKey({ typeFilter: ["game", "dlc"] });
  await client.apps.getServersAtAddress("127.0.0.1:27015");
  await client.apps.setAppBuildLive({
    appId: 480,
    buildId: 1234,
    betaKey: "public",
    steamId64: 76561198000000000n,
    description: "Release build"
  });
  await client.apps.upToDateCheck({ appId: 480, version: 100 });
  await client.news.getNewsForApp({
    appId: 480,
    maxLength: 300,
    count: 2,
    feeds: ["steam_community_announcements", "steam_updates"]
  });
  await client.news.getNewsForAppAuthed({ appId: 480, endDate: 1700000000 });
  await client.apps.getAppBuilds({ appId: 480, count: 3 });
  await client.apps.getAppDepotVersions(480);
  await client.apps.getPlayersBanned(480);
  await client.apps.getServerList({ filter: "\\appid\\480", limit: 5 });

  assert.equal(
    fetchCalls[0].url,
    "https://api.steampowered.com/ISteamApps/GetAppList/v0002/?key=secret&format=json"
  );
  assert.equal(
    fetchCalls[1].url,
    "https://partner.steam-api.com/ISteamApps/GetAppBetas/v0001/?key=secret&format=json&appid=480"
  );
  assert.equal(
    fetchCalls[2].url,
    "https://partner.steam-api.com/ISteamApps/GetPartnerAppListForWebAPIKey/v0002/?key=secret&format=json&type_filter=game%2Cdlc"
  );
  assert.equal(
    fetchCalls[3].url,
    "https://api.steampowered.com/ISteamApps/GetServersAtAddress/v0001/?key=secret&format=json&addr=127.0.0.1%3A27015"
  );
  assert.equal(
    fetchCalls[4].url,
    "https://partner.steam-api.com/ISteamApps/SetAppBuildLive/v0002/?key=secret&format=json"
  );
  assert.equal(
    fetchCalls[4].init.body,
    "appid=480&buildid=1234&betakey=public&steamid=76561198000000000&description=Release+build"
  );
  assert.equal(
    fetchCalls[5].url,
    "https://api.steampowered.com/ISteamApps/UpToDateCheck/v0001/?key=secret&format=json&appid=480&version=100"
  );
  assert.equal(
    fetchCalls[6].url,
    "https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?key=secret&format=json&appid=480&maxlength=300&count=2&feeds=steam_community_announcements%2Csteam_updates"
  );
  assert.equal(
    fetchCalls[7].url,
    "https://partner.steam-api.com/ISteamNews/GetNewsForAppAuthed/v0002/?key=secret&format=json&appid=480&enddate=1700000000"
  );
  assert.equal(
    fetchCalls[8].url,
    "https://partner.steam-api.com/ISteamApps/GetAppBuilds/v0001/?key=secret&format=json&appid=480&count=3"
  );
  assert.equal(
    fetchCalls[9].url,
    "https://partner.steam-api.com/ISteamApps/GetAppDepotVersions/v0001/?key=secret&format=json&appid=480"
  );
  assert.equal(
    fetchCalls[10].url,
    "https://partner.steam-api.com/ISteamApps/GetPlayersBanned/v0001/?key=secret&format=json&appid=480"
  );
  assert.equal(
    fetchCalls[11].url,
    "https://partner.steam-api.com/ISteamApps/GetServerList/v0001/?key=secret&format=json&filter=%5Cappid%5C480&limit=5"
  );
});

test("web API public app, broadcast, and directory facades map Valve endpoints", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "secret", fetch: fetchImpl });

  t.after(clearSteamBridgeCache);

  await client.apps.getSdrConfig(480);
  await client.broadcast.playerStats();
  await client.broadcast.viewerHeartbeat({
    steamId64: 76561198000000000n,
    sessionId: 123n,
    token: 456n,
    stream: 1
  });
  await client.directory.getCmList({ cellId: 0, maxCount: 4 });
  await client.directory.getCmListForConnect({
    cellId: 1,
    cmType: "websockets",
    realm: "public",
    maxCount: 8,
    qosLevel: 2
  });
  await client.directory.getSteamPipeDomains();

  assert.equal(
    fetchCalls[0].url,
    "https://api.steampowered.com/ISteamApps/GetSDRConfig/v0001/?key=secret&format=json&appid=480"
  );
  assert.equal(
    fetchCalls[1].url,
    "https://api.steampowered.com/ISteamBroadcast/PlayerStats/v0001/?key=secret&format=json"
  );
  assert.equal(fetchCalls[1].init.method, "POST");
  assert.equal(
    fetchCalls[2].url,
    "https://api.steampowered.com/ISteamBroadcast/ViewerHeartbeat/v0001/?key=secret&format=json&steamid=76561198000000000&sessionid=123&token=456&stream=1"
  );
  assert.equal(
    fetchCalls[3].url,
    "https://api.steampowered.com/ISteamDirectory/GetCMList/v0001/?key=secret&format=json&cellid=0&maxcount=4"
  );
  assert.equal(
    fetchCalls[4].url,
    "https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v0001/?key=secret&format=json&cellid=1&cmtype=websockets&realm=public&maxcount=8&qoslevel=2"
  );
  assert.equal(
    fetchCalls[5].url,
    "https://api.steampowered.com/ISteamDirectory/GetSteamPipeDomains/v0001/?key=secret&format=json"
  );
  assert.equal(typeof steam.webApi.broadcast.viewerHeartbeat, "function");
  assert.equal(typeof steam.webApi.directory.getSteamPipeDomains, "function");
});

test("web API app-specific public facades map Valve endpoints", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "secret", fetch: fetchImpl });
  const requestPath = (index) => {
    const url = new URL(fetchCalls[index].url);
    return url.origin + url.pathname;
  };

  t.after(clearSteamBridgeCache);

  await client.clientStats1046930.reportEvent();
  await client.gameCoordinatorVersion.app1046930.getClientVersion();
  await client.gameCoordinatorVersion.app1046930.getServerVersion();
  await client.gameCoordinatorVersion.app1269260.getClientVersion();
  await client.gameCoordinatorVersion.app1269260.getServerVersion();
  await client.gameCoordinatorVersion.app1422450.getClientVersion();
  await client.gameCoordinatorVersion.app1422450.getServerVersion();
  await client.gameCoordinatorVersion.teamFortress2.getClientVersion();
  await client.gameCoordinatorVersion.teamFortress2.getServerVersion();
  await client.gameCoordinatorVersion.dota2.getClientVersion();
  await client.gameCoordinatorVersion.dota2.getServerVersion();
  await client.gameCoordinatorVersion.app583950.getClientVersion();
  await client.gameCoordinatorVersion.app583950.getServerVersion();
  await client.gameCoordinatorVersion.counterStrike2.getServerVersion();
  await client.portal2Leaderboards.getBucketizedData("challenge_portal");
  await client.tfSystem.getWorldStatus();

  assert.equal(requestPath(0), "https://api.steampowered.com/IClientStats_1046930/ReportEvent/v0001/");
  assert.equal(fetchCalls[0].init.method, "POST");

  const expectedPaths = [
    "https://api.steampowered.com/IGCVersion_1046930/GetClientVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_1046930/GetServerVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_1269260/GetClientVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_1269260/GetServerVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_1422450/GetClientVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_1422450/GetServerVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_440/GetClientVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_440/GetServerVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_570/GetClientVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_570/GetServerVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_583950/GetClientVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_583950/GetServerVersion/v0001/",
    "https://api.steampowered.com/IGCVersion_730/GetServerVersion/v0001/",
    "https://api.steampowered.com/IPortal2Leaderboards_620/GetBucketizedData/v0001/",
    "https://api.steampowered.com/ITFSystem_440/GetWorldStatus/v0001/"
  ];
  expectedPaths.forEach((expectedPath, index) => {
    assert.equal(requestPath(index + 1), expectedPath);
    assert.equal(fetchCalls[index + 1].init.method, "GET");
  });

  const portalUrl = new URL(fetchCalls[14].url);
  assert.equal(portalUrl.searchParams.get("leaderboardName"), "challenge_portal");
  assert.equal(portalUrl.searchParams.get("key"), "secret");
  assert.equal(typeof steam.webApi.clientStats1046930.reportEvent, "function");
  assert.equal(typeof steam.webApi.gameCoordinatorVersion.dota2.getServerVersion, "function");
  assert.equal(typeof steam.webApi.portal2Leaderboards.getBucketizedData, "function");
  assert.equal(typeof steam.webApi.tfSystem.getWorldStatus, "function");
});

test("web API remote storage and economy facades map indexed fields", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "publisher-secret", fetch: fetchImpl });

  t.after(clearSteamBridgeCache);

  await client.remoteStorage.getPublishedFileDetails([111n, 222n]);
  await client.remoteStorage.getCollectionDetails([333n]);
  await client.remoteStorage.getUgcFileDetails({
    appId: 480,
    ugcId: 444n,
    steamId64: 76561198000000000n
  });
  await client.remoteStorage.enumerateUserSubscribedFiles({
    appId: 480,
    steamId64: 76561198000000000n,
    listType: 1
  });
  await client.remoteStorage.subscribePublishedFile({
    appId: 480,
    steamId64: 76561198000000000n,
    publishedFileId: 555n
  });
  await client.economy.getAssetClassInfo({
    appId: 480,
    classes: [{ classId: 1000n, instanceId: 2000n }],
    language: "en"
  });
  await client.economy.getAssetPrices({ appId: 480, currency: "USD", language: "en" });
  await client.economy.startAssetTransaction({
    appId: 480,
    steamId64: 76561198000000000n,
    assets: [{ assetId: "sku-1", quantity: 2 }],
    currency: "USD",
    language: "en",
    ipAddress: "127.0.0.1",
    referrer: "https://example.com/store",
    clientAuth: true
  });
  await client.economy.finalizeAssetTransaction({
    appId: 480,
    steamId64: 76561198000000000n,
    transactionId: "txn-1",
    language: "en"
  });
  await client.economy.canTrade({
    appId: 480,
    steamId64: 76561198000000000n,
    targetSteamId64: 76561198000000001n
  });
  await client.remoteStorage.setUgcUsedByGc({
    appId: 480,
    steamId64: 76561198000000000n,
    ugcId: 444n,
    used: false
  });
  await client.remoteStorage.unsubscribePublishedFile({
    appId: 480,
    steamId64: 76561198000000000n,
    publishedFileId: 555n
  });
  await client.economy.getExportedAssetsForUser({
    appId: 480,
    steamId64: 76561198000000000n,
    contextId: 2n
  });
  await client.economy.getMarketPrices(480);
  await client.economy.startTrade({
    appId: 480,
    partyA: 76561198000000000n,
    partyB: 76561198000000001n
  });

  assert.equal(
    fetchCalls[0].url,
    "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(fetchCalls[0].init.body, "publishedfileids%5B0%5D=111&publishedfileids%5B1%5D=222&itemcount=2");
  assert.equal(
    fetchCalls[1].url,
    "https://api.steampowered.com/ISteamRemoteStorage/GetCollectionDetails/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(fetchCalls[1].init.body, "publishedfileids%5B0%5D=333&collectioncount=1");
  assert.equal(
    fetchCalls[2].url,
    "https://api.steampowered.com/ISteamRemoteStorage/GetUGCFileDetails/v0001/?key=publisher-secret&format=json&ugcid=444&appid=480&steamid=76561198000000000"
  );
  assert.equal(fetchCalls[3].init.body, "steamid=76561198000000000&appid=480&listtype=1");
  assert.equal(
    fetchCalls[4].url,
    "https://partner.steam-api.com/ISteamRemoteStorage/SubscribePublishedFile/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(fetchCalls[4].init.body, "steamid=76561198000000000&appid=480&publishedfileid=555");
  assert.equal(
    fetchCalls[5].url,
    "https://api.steampowered.com/ISteamEconomy/GetAssetClassInfo/v0001/?key=publisher-secret&format=json&classid0=1000&instanceid0=2000&appid=480&class_count=1&language=en"
  );
  assert.equal(
    fetchCalls[6].url,
    "https://api.steampowered.com/ISteamEconomy/GetAssetPrices/v0001/?key=publisher-secret&format=json&appid=480&currency=USD&language=en"
  );
  assert.equal(
    fetchCalls[7].url,
    "https://partner.steam-api.com/ISteamEconomy/StartAssetTransaction/v0001/?key=publisher-secret&format=json"
  );
  assert.match(fetchCalls[7].init.body, /assetid0=sku-1/);
  assert.match(fetchCalls[7].init.body, /assetquantity0=2/);
  assert.match(fetchCalls[7].init.body, /clientauth=1/);
  assert.equal(fetchCalls[8].init.body, "appid=480&steamid=76561198000000000&txnid=txn-1&language=en");
  assert.equal(
    fetchCalls[9].url,
    "https://partner.steam-api.com/ISteamEconomy/CanTrade/v0001/?key=publisher-secret&format=json&appid=480&steamid=76561198000000000&targetid=76561198000000001"
  );
  assert.equal(
    fetchCalls[10].url,
    "https://partner.steam-api.com/ISteamRemoteStorage/SetUGCUsedByGC/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(fetchCalls[10].init.body, "steamid=76561198000000000&ugcid=444&appid=480&used=0");
  assert.equal(
    fetchCalls[11].url,
    "https://partner.steam-api.com/ISteamRemoteStorage/UnsubscribePublishedFile/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(fetchCalls[11].init.body, "steamid=76561198000000000&appid=480&publishedfileid=555");
  assert.equal(
    fetchCalls[12].url,
    "https://partner.steam-api.com/ISteamEconomy/GetExportedAssetsForUser/v0001/?key=publisher-secret&format=json&steamid=76561198000000000&appid=480&contextid=2"
  );
  assert.equal(
    fetchCalls[13].url,
    "https://partner.steam-api.com/ISteamEconomy/GetMarketPrices/v0001/?key=publisher-secret&format=json&appid=480"
  );
  assert.equal(
    fetchCalls[14].url,
    "https://partner.steam-api.com/ISteamEconomy/StartTrade/v0001/?key=publisher-secret&format=json&appid=480&partya=76561198000000000&partyb=76561198000000001"
  );
});

test("web API cloud service facade maps OAuth file operations", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "publisher-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const bodyParams = (index) => new URLSearchParams(fetchCalls[index].init.body);
  const bodyInputJson = (index) => JSON.parse(bodyParams(index).get("input_json"));

  t.after(clearSteamBridgeCache);

  await client.cloudService.enumerateUserFiles({
    accessToken: "oauth-token",
    appId: 480,
    extendedDetails: true,
    count: 2,
    startIndex: 1
  });
  await client.cloudService.beginAppUploadBatch({
    accessToken: "oauth-token",
    appId: 480,
    machineName: "Steam Deck",
    filesToUpload: ["save.sav"],
    filesToDelete: ["old-save.sav"]
  });
  await client.cloudService.completeAppUploadBatch({
    accessToken: "oauth-token",
    appId: 480,
    batchId: 123n,
    batchEResult: 1
  });
  await client.cloudService.beginHttpUpload({
    accessToken: "oauth-token",
    appId: 480,
    fileSize: 7448889,
    fileName: "save.sav",
    fileSha: "FDFE308499263F9361B472648E9F49DC0B8799C8",
    platformsToSync: ["all"],
    uploadBatchId: 123n,
    isPublic: false
  });
  await client.cloudService.commitHttpUpload({
    accessToken: "oauth-token",
    appId: 480,
    transferSucceeded: true,
    fileName: "save.sav",
    fileSha: "FDFE308499263F9361B472648E9F49DC0B8799C8"
  });
  await client.cloudService.deleteFile({
    accessToken: "oauth-token",
    appId: 480,
    fileName: "old-save.sav"
  });

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://api.steampowered.com/ICloudService/EnumerateUserFiles/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "GET");
  assert.equal(requestUrl(0).searchParams.has("key"), false);
  assert.equal(requestUrl(0).searchParams.get("format"), "json");
  assert.equal(requestUrl(0).searchParams.get("access_token"), "oauth-token");
  assert.equal(requestUrl(0).searchParams.get("appid"), "480");
  assert.equal(requestUrl(0).searchParams.get("extended_details"), "1");
  assert.equal(requestUrl(0).searchParams.get("count"), "2");
  assert.equal(requestUrl(0).searchParams.get("start_index"), "1");

  for (const [index, methodName] of [
    [1, "BeginAppUploadBatch"],
    [2, "CompleteAppUploadBatch"],
    [3, "BeginHTTPUpload"],
    [4, "CommitHTTPUpload"],
    [5, "Delete"]
  ]) {
    assert.equal(requestUrl(index).origin + requestUrl(index).pathname, `https://api.steampowered.com/ICloudService/${methodName}/v0001/`);
    assert.equal(requestUrl(index).searchParams.has("key"), false);
    assert.equal(fetchCalls[index].init.method, "POST");
    assert.equal(fetchCalls[index].init.headers["content-type"], "application/x-www-form-urlencoded");
    assert.equal(bodyParams(index).get("access_token"), "oauth-token");
  }

  assert.deepEqual(bodyInputJson(1), {
    appid: 480,
    machine_name: "Steam Deck",
    files_to_upload: ["save.sav"],
    files_to_delete: ["old-save.sav"]
  });
  assert.deepEqual(bodyInputJson(2), { appid: 480, batch_id: "123", batch_eresult: 1 });
  assert.deepEqual(bodyInputJson(3), {
    appid: 480,
    file_size: 7448889,
    filename: "save.sav",
    file_sha: "FDFE308499263F9361B472648E9F49DC0B8799C8",
    is_public: false,
    platforms_to_sync: ["all"],
    upload_batch_id: "123"
  });
  assert.deepEqual(bodyInputJson(4), {
    appid: 480,
    transfer_succeeded: true,
    filename: "save.sav",
    file_sha: "FDFE308499263F9361B472648E9F49DC0B8799C8"
  });
  assert.deepEqual(bodyInputJson(5), { appid: 480, filename: "old-save.sav" });
  assert.equal(typeof steam.webApi.cloudService.enumerateUserFiles, "function");
});

test("web API cheat reporting service facade maps anti-cheat methods", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "anti-cheat-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const bodyInputJson = (index) => JSON.parse(new URLSearchParams(fetchCalls[index].init.body).get("input_json"));
  const queryInputJson = (index) => JSON.parse(requestUrl(index).searchParams.get("input_json"));

  t.after(clearSteamBridgeCache);

  await client.cheatReportingService.reportPlayerCheating({
    appId: 480,
    steamId64: 76561198000000000n,
    reporterSteamId64: 76561198000000001n,
    appData: 2n,
    heuristic: true,
    detection: false,
    playerReport: true,
    noReportId: false,
    gameMode: 3,
    suspicionStartTime: 1700000000,
    severity: 4
  });
  await client.cheatReportingService.requestPlayerGameBan({
    appId: 480,
    steamId64: 76561198000000000n,
    reportId: 9001n,
    cheatDescription: "Example anti-cheat signal",
    duration: 3600,
    delayBan: true,
    flags: 0
  });
  await client.cheatReportingService.removePlayerGameBan({ appId: 480, steamId64: 76561198000000000n });
  await client.cheatReportingService.getCheatingReports({
    appId: 480,
    timeBegin: 1700000000,
    timeEnd: 1700003600,
    reportIdMin: 0n,
    includeReports: true,
    includeBans: true,
    steamId64: 76561198000000000n
  });
  await client.cheatReportingService.requestVacStatusForUser({
    appId: 480,
    steamId64: 76561198000000000n,
    sessionId: 42n
  });
  await client.cheatReportingService.startSecureMultiplayerSession({ appId: 480, steamId64: 76561198000000000n });
  await client.cheatReportingService.endSecureMultiplayerSession({
    appId: 480,
    steamId64: 76561198000000000n,
    sessionId: 42n
  });

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://partner.steam-api.com/ICheatReportingService/ReportPlayerCheating/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.equal(requestUrl(0).searchParams.get("key"), "anti-cheat-secret");
  assert.deepEqual(bodyInputJson(0), {
    steamid: "76561198000000000",
    appid: 480,
    steamidreporter: "76561198000000001",
    appdata: "2",
    heuristic: true,
    detection: false,
    playerreport: true,
    noreportid: false,
    gamemode: 3,
    suspicionstarttime: 1700000000,
    severity: 4
  });
  assert.deepEqual(bodyInputJson(1), {
    steamid: "76561198000000000",
    appid: 480,
    reportid: "9001",
    cheatdescription: "Example anti-cheat signal",
    duration: 3600,
    delayban: true,
    flags: 0
  });
  assert.deepEqual(bodyInputJson(2), { steamid: "76561198000000000", appid: 480 });
  assert.equal(
    requestUrl(3).origin + requestUrl(3).pathname,
    "https://partner.steam-api.com/ICheatReportingService/GetCheatingReports/v0001/"
  );
  assert.equal(fetchCalls[3].init.method, "GET");
  assert.equal(requestUrl(3).searchParams.get("format"), "json");
  assert.deepEqual(queryInputJson(3), {
    appid: 480,
    timeend: 1700003600,
    timebegin: 1700000000,
    reportidmin: "0",
    includereports: true,
    includebans: true,
    steamid: "76561198000000000"
  });
  assert.deepEqual(bodyInputJson(4), { steamid: "76561198000000000", appid: 480, session_id: "42" });
  assert.deepEqual(bodyInputJson(5), { steamid: "76561198000000000", appid: 480 });
  assert.deepEqual(bodyInputJson(6), { steamid: "76561198000000000", appid: 480, session_id: "42" });
  assert.match(fetchCalls[6].url, /ICheatReportingService\/EndSecureMultiplayerSession\/v0001/);
  assert.equal(typeof steam.webApi.cheatReportingService.requestPlayerGameBan, "function");
});

test("web API broadcast and market service facades map partner methods", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "market-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const queryInputJson = (index) => JSON.parse(requestUrl(index).searchParams.get("input_json"));
  const bodyInputJson = (index) => JSON.parse(new URLSearchParams(fetchCalls[index].init.body).get("input_json"));

  t.after(clearSteamBridgeCache);

  await client.broadcastService.postGameDataFrame({
    appId: 480,
    steamId64: 76561198000000000n,
    broadcastId: 123456789n,
    frameData: "{\"round\":1,\"score\":9001}"
  });
  await client.econMarketService.getMarketEligibility({ steamId64: 76561198000000000n });
  await client.econMarketService.cancelAppListingsForUser({
    appId: 480,
    steamId64: 76561198000000000n,
    synchronous: true
  });
  await client.econMarketService.getAssetId({
    appId: 480,
    listingId: 987654321n
  });
  await client.econMarketService.getPopular({
    language: "en",
    rows: 10,
    start: 0,
    filterAppId: 480,
    currency: 1
  });
  await client.broadcastService.postGameDataFrameRtmp({
    appId: 480,
    steamId64: 76561198000000000n,
    rtmpToken: "rtmp-token",
    frameData: "{\"round\":2,\"score\":42}"
  });

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://partner.steam-api.com/IBroadcastService/PostGameDataFrame/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.equal(requestUrl(0).searchParams.get("key"), "market-secret");
  assert.deepEqual(bodyInputJson(0), {
    appid: 480,
    steamid: "76561198000000000",
    broadcast_id: "123456789",
    frame_data: "{\"round\":1,\"score\":9001}"
  });

  assert.equal(
    requestUrl(1).origin + requestUrl(1).pathname,
    "https://partner.steam-api.com/IEconMarketService/GetMarketEligibility/v0001/"
  );
  assert.equal(fetchCalls[1].init.method, "GET");
  assert.deepEqual(queryInputJson(1), { steamid: "76561198000000000" });

  assert.equal(
    requestUrl(2).origin + requestUrl(2).pathname,
    "https://partner.steam-api.com/IEconMarketService/CancelAppListingsForUser/v0001/"
  );
  assert.equal(fetchCalls[2].init.method, "POST");
  assert.deepEqual(bodyInputJson(2), {
    appid: 480,
    steamid: "76561198000000000",
    synchronous: true
  });

  assert.equal(
    requestUrl(3).origin + requestUrl(3).pathname,
    "https://partner.steam-api.com/IEconMarketService/GetAssetID/v0001/"
  );
  assert.deepEqual(queryInputJson(3), { appid: 480, listingid: "987654321" });

  assert.equal(
    requestUrl(4).origin + requestUrl(4).pathname,
    "https://partner.steam-api.com/IEconMarketService/GetPopular/v0001/"
  );
  assert.deepEqual(queryInputJson(4), {
    language: "en",
    rows: 10,
    start: 0,
    filter_appid: 480,
    ecurrency: 1
  });
  assert.equal(
    requestUrl(5).origin + requestUrl(5).pathname,
    "https://partner.steam-api.com/IBroadcastService/PostGameDataFrameRTMP/v0001/"
  );
  assert.equal(fetchCalls[5].init.method, "POST");
  assert.deepEqual(bodyInputJson(5), {
    appid: 480,
    steamid: "76561198000000000",
    rtmp_token: "rtmp-token",
    frame_data: "{\"round\":2,\"score\":42}"
  });
  assert.equal(typeof steam.webApi.broadcastService.postGameDataFrame, "function");
  assert.equal(typeof steam.webApi.broadcastService.postGameDataFrameRtmp, "function");
  assert.equal(typeof steam.webApi.econMarketService.cancelAppListingsForUser, "function");
});

test("web API econ service facade maps trade and cache service methods", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "trader-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const queryInputJson = (index) => JSON.parse(requestUrl(index).searchParams.get("input_json"));
  const bodyInputJson = (index) => JSON.parse(new URLSearchParams(fetchCalls[index].init.body).get("input_json"));

  t.after(clearSteamBridgeCache);

  await client.econService.getTradeHistory({
    maxTrades: 25,
    startAfterTime: 1700000000,
    startAfterTradeId: 123456789n,
    navigatingBack: false,
    getDescriptions: true,
    language: "en",
    includeFailed: false,
    includeTotal: true
  });
  await client.econService.flushInventoryCache({
    steamId64: 76561198000000000n,
    appId: 480,
    contextId: 2n
  });
  await client.econService.flushAssetAppearanceCache(480);
  await client.econService.flushContextCache(480);
  await client.econService.getTradeOffers({
    getSentOffers: true,
    getReceivedOffers: true,
    getDescriptions: false,
    language: "en",
    activeOnly: true,
    historicalOnly: false,
    timeHistoricalCutoff: 1700000100
  });
  await client.econService.getTradeOffer({ tradeOfferId: 987654321n, language: "en" });
  await client.econService.getTradeOffersSummary({ timeLastVisit: 1700000200 });

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://api.steampowered.com/IEconService/GetTradeHistory/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "GET");
  assert.equal(requestUrl(0).searchParams.get("key"), "trader-secret");
  assert.deepEqual(queryInputJson(0), {
    max_trades: 25,
    start_after_time: 1700000000,
    start_after_tradeid: "123456789",
    navigating_back: false,
    get_descriptions: true,
    language: "en",
    include_failed: false,
    include_total: true
  });

  assert.equal(
    requestUrl(1).origin + requestUrl(1).pathname,
    "https://partner.steam-api.com/IEconService/FlushInventoryCache/v0001/"
  );
  assert.equal(fetchCalls[1].init.method, "POST");
  assert.equal(fetchCalls[1].init.headers["content-type"], "application/x-www-form-urlencoded");
  assert.deepEqual(bodyInputJson(1), {
    steamid: "76561198000000000",
    appid: 480,
    contextid: "2"
  });
  assert.equal(
    requestUrl(2).origin + requestUrl(2).pathname,
    "https://partner.steam-api.com/IEconService/FlushAssetAppearanceCache/v0001/"
  );
  assert.deepEqual(bodyInputJson(2), { appid: 480 });
  assert.equal(
    requestUrl(3).origin + requestUrl(3).pathname,
    "https://partner.steam-api.com/IEconService/FlushContextCache/v0001/"
  );
  assert.deepEqual(bodyInputJson(3), { appid: 480 });

  assert.equal(
    requestUrl(4).origin + requestUrl(4).pathname,
    "https://api.steampowered.com/IEconService/GetTradeOffers/v0001/"
  );
  assert.deepEqual(queryInputJson(4), {
    get_sent_offers: true,
    get_received_offers: true,
    get_descriptions: false,
    language: "en",
    active_only: true,
    historical_only: false,
    time_historical_cutoff: 1700000100
  });
  assert.equal(
    requestUrl(5).origin + requestUrl(5).pathname,
    "https://api.steampowered.com/IEconService/GetTradeOffer/v0001/"
  );
  assert.deepEqual(queryInputJson(5), { tradeofferid: "987654321", language: "en" });
  assert.equal(
    requestUrl(6).origin + requestUrl(6).pathname,
    "https://api.steampowered.com/IEconService/GetTradeOffersSummary/v0001/"
  );
  assert.deepEqual(queryInputJson(6), { time_last_visit: 1700000200 });
  assert.equal(typeof steam.webApi.econService.getTradeOffersSummary, "function");
});

test("web API inventory service facade maps item service methods", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { success: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "inventory-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const queryInputJson = (index) => JSON.parse(requestUrl(index).searchParams.get("input_json"));
  const bodyInputJson = (index) => JSON.parse(new URLSearchParams(fetchCalls[index].init.body).get("input_json"));

  t.after(clearSteamBridgeCache);

  await client.inventoryService.addItem({
    appId: 480,
    steamId64: 76561198000000000n,
    itemDefIds: [100n, 101n],
    itemPropsJson: "{\"quality\":\"rare\"}",
    notify: true,
    requestId: 9001n,
    tradeRestriction: false
  });
  await client.inventoryService.addPromoItem({
    appId: 480,
    steamId64: 76561198000000000n,
    itemDefId: 102n,
    notify: false,
    requestId: 9002n
  });
  await client.inventoryService.consumeItem({
    appId: 480,
    steamId64: 76561198000000000n,
    itemId: 5000n,
    quantity: "2",
    requestId: 9003n
  });
  await client.inventoryService.exchangeItem({
    appId: 480,
    steamId64: 76561198000000000n,
    materials: [
      { itemId: 5001n, quantity: 1 },
      { itemId: 5002n, quantity: 3 }
    ],
    outputItemDefId: 120n
  });
  await client.inventoryService.getInventory({ appId: 480, steamId64: 76561198000000000n });
  await client.inventoryService.getItemDefs({
    appId: 480,
    modifiedSince: "20260625T010203Z",
    itemDefIds: [100n],
    workshopIds: [123456789n],
    cacheMaxAgeSeconds: 60
  });
  await client.inventoryService.getPriceSheet(1);
  await client.inventoryService.consolidate({
    appId: 480,
    steamId64: 76561198000000000n,
    itemDefIds: [100n, 101n],
    force: true
  });
  await client.inventoryService.getQuantity({
    appId: 480,
    steamId64: 76561198000000000n,
    itemDefIds: [100n],
    force: false
  });
  await client.inventoryService.modifyItems({
    appId: 480,
    steamId64: 76561198000000000n,
    timestamp: 1760000000,
    updates: [
      {
        itemId: 5001n,
        propertyName: "fx",
        propertyValueString: "blue_flames"
      },
      {
        itemId: 5002n,
        propertyName: "visible",
        propertyValueBool: true
      },
      {
        itemId: 5003n,
        propertyName: "quality",
        propertyValueInt: 5n,
        propertyValueFloat: "1.5"
      },
      {
        itemId: 5004n,
        propertyName: "legacy",
        removeProperty: true
      }
    ]
  });

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://partner.steam-api.com/IInventoryService/AddItem/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.deepEqual(bodyInputJson(0), {
    appid: 480,
    itemdefid: ["100", "101"],
    itempropsjson: "{\"quality\":\"rare\"}",
    steamid: "76561198000000000",
    notify: true,
    requestid: "9001",
    trade_restriction: false
  });
  assert.equal(
    requestUrl(1).origin + requestUrl(1).pathname,
    "https://partner.steam-api.com/IInventoryService/AddPromoItem/v0001/"
  );
  assert.deepEqual(bodyInputJson(1), {
    appid: 480,
    itemdefid: "102",
    steamid: "76561198000000000",
    notify: false,
    requestid: "9002"
  });
  assert.deepEqual(bodyInputJson(2), {
    appid: 480,
    itemid: "5000",
    quantity: "2",
    steamid: "76561198000000000",
    requestid: "9003"
  });
  assert.deepEqual(bodyInputJson(3), {
    appid: 480,
    steamid: "76561198000000000",
    materialsitemid: ["5001", "5002"],
    materialsquantity: [1, 3],
    outputitemdefid: "120"
  });
  assert.equal(
    requestUrl(4).origin + requestUrl(4).pathname,
    "https://partner.steam-api.com/IInventoryService/GetInventory/v0001/"
  );
  assert.deepEqual(queryInputJson(4), { appid: 480, steamid: "76561198000000000" });
  assert.deepEqual(queryInputJson(5), {
    appid: 480,
    modifiedsince: "20260625T010203Z",
    itemdefids: ["100"],
    workshopids: ["123456789"],
    cache_max_age_seconds: 60
  });
  assert.equal(
    requestUrl(6).origin + requestUrl(6).pathname,
    "https://api.steampowered.com/IInventoryService/GetPriceSheet/v0001/"
  );
  assert.deepEqual(queryInputJson(6), { ecurrency: 1 });
  assert.deepEqual(bodyInputJson(7), {
    appid: 480,
    steamid: "76561198000000000",
    itemdefid: ["100", "101"],
    force: true
  });
  assert.deepEqual(queryInputJson(8), {
    appid: 480,
    steamid: "76561198000000000",
    itemdefid: ["100"],
    force: false
  });
  assert.deepEqual(bodyInputJson(9), {
    appid: 480,
    steamid: "76561198000000000",
    timestamp: 1760000000,
    updates: [
      {
        itemid: "5001",
        property_name: "fx",
        property_value_string: "blue_flames"
      },
      {
        itemid: "5002",
        property_name: "visible",
        property_value_bool: true
      },
      {
        itemid: "5003",
        property_name: "quality",
        property_value_int: "5",
        property_value_float: "1.5"
      },
      {
        itemid: "5004",
        property_name: "legacy",
        remove_property: true
      }
    ]
  });
  assert.equal(typeof steam.webApi.inventoryService.modifyItems, "function");
});

test("web API game inventory facade maps history and item definition methods", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { success: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "game-inventory-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const bodyParams = (index) => new URLSearchParams(fetchCalls[index].init.body);

  t.after(clearSteamBridgeCache);

  await client.gameInventory.getHistoryCommandDetails({
    appId: 480,
    steamId64: 76561198000000000n,
    command: "grant",
    contextId: 2n,
    commandArguments: "{\"itemdefid\":100}"
  });
  await client.gameInventory.getUserHistory({
    appId: 480,
    steamId64: 76561198000000000n,
    contextId: 2n,
    startTime: 1760000000,
    endTime: 1760003600
  });
  await client.gameInventory.historyExecuteCommands({
    appId: 480,
    steamId64: 76561198000000000n,
    contextId: 2n,
    actorId: 42
  });
  await client.gameInventory.supportGetAssetHistory({
    appId: 480,
    assetId: 5001n,
    contextId: 2n
  });
  await client.gameInventory.updateItemDefs({
    appId: 480,
    itemDefs: [
      {
        appid: 480,
        itemdefid: 100n,
        type: "item",
        name: "Example Item",
        tradable: true,
        tags: "class:example"
      }
    ]
  });

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://partner.steam-api.com/IGameInventory/GetHistoryCommandDetails/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "GET");
  assert.equal(requestUrl(0).searchParams.get("key"), "game-inventory-secret");
  assert.equal(requestUrl(0).searchParams.get("appid"), "480");
  assert.equal(requestUrl(0).searchParams.get("steamid"), "76561198000000000");
  assert.equal(requestUrl(0).searchParams.get("command"), "grant");
  assert.equal(requestUrl(0).searchParams.get("contextid"), "2");
  assert.equal(requestUrl(0).searchParams.get("arguments"), "{\"itemdefid\":100}");

  assert.equal(
    requestUrl(1).origin + requestUrl(1).pathname,
    "https://partner.steam-api.com/IGameInventory/GetUserHistory/v0001/"
  );
  assert.equal(requestUrl(1).searchParams.get("appid"), "480");
  assert.equal(requestUrl(1).searchParams.get("steamid"), "76561198000000000");
  assert.equal(requestUrl(1).searchParams.get("contextid"), "2");
  assert.equal(requestUrl(1).searchParams.get("starttime"), "1760000000");
  assert.equal(requestUrl(1).searchParams.get("endtime"), "1760003600");

  assert.equal(
    requestUrl(2).origin + requestUrl(2).pathname,
    "https://partner.steam-api.com/IGameInventory/HistoryExecuteCommands/v0001/"
  );
  assert.equal(fetchCalls[2].init.method, "POST");
  assert.equal(fetchCalls[2].init.headers["content-type"], "application/x-www-form-urlencoded");
  assert.equal(bodyParams(2).get("appid"), "480");
  assert.equal(bodyParams(2).get("steamid"), "76561198000000000");
  assert.equal(bodyParams(2).get("contextid"), "2");
  assert.equal(bodyParams(2).get("actorid"), "42");

  assert.equal(
    requestUrl(3).origin + requestUrl(3).pathname,
    "https://partner.steam-api.com/IGameInventory/SupportGetAssetHistory/v0001/"
  );
  assert.equal(requestUrl(3).searchParams.get("appid"), "480");
  assert.equal(requestUrl(3).searchParams.get("assetid"), "5001");
  assert.equal(requestUrl(3).searchParams.get("contextid"), "2");

  assert.equal(
    requestUrl(4).origin + requestUrl(4).pathname,
    "https://partner.steam-api.com/IGameInventory/UpdateItemDefs/v0001/"
  );
  assert.equal(fetchCalls[4].init.method, "POST");
  assert.equal(bodyParams(4).get("appid"), "480");
  assert.deepEqual(JSON.parse(bodyParams(4).get("itemdefs")), [
    {
      appid: 480,
      itemdefid: "100",
      type: "item",
      name: "Example Item",
      tradable: true,
      tags: "class:example"
    }
  ]);
  assert.equal(typeof steam.webApi.gameInventory.updateItemDefs, "function");
});

test("web API game servers service facade maps account administration methods", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "server-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const queryInputJson = (index) => JSON.parse(requestUrl(index).searchParams.get("input_json"));
  const bodyInputJson = (index) => JSON.parse(new URLSearchParams(fetchCalls[index].init.body).get("input_json"));

  t.after(clearSteamBridgeCache);

  await client.gameServersService.getAccountList();
  await client.gameServersService.createAccount({ appId: 480, memo: "SpaceWar test shard" });
  await client.gameServersService.setMemo({
    steamId64: 90123456789012345n,
    memo: "rotated test server"
  });
  await client.gameServersService.resetLoginToken({ steamId64: 90123456789012345n });
  await client.gameServersService.deleteAccount({ steamId64: 90123456789012345n });
  await client.gameServersService.getAccountPublicInfo(90123456789012345n);
  await client.gameServersService.queryLoginToken("abcdef123456");
  await client.gameServersService.getServerSteamIdsByIp(["203.0.113.10:27015", "203.0.113.11:27015"]);
  await client.gameServersService.getServerIpsBySteamId([90123456789012345n, "90123456789012346"]);

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://api.steampowered.com/IGameServersService/GetAccountList/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "GET");
  assert.deepEqual(queryInputJson(0), {});
  assert.equal(
    requestUrl(1).origin + requestUrl(1).pathname,
    "https://api.steampowered.com/IGameServersService/CreateAccount/v0001/"
  );
  assert.equal(fetchCalls[1].init.method, "POST");
  assert.deepEqual(bodyInputJson(1), { appid: 480, memo: "SpaceWar test shard" });
  assert.equal(
    requestUrl(2).origin + requestUrl(2).pathname,
    "https://api.steampowered.com/IGameServersService/SetMemo/v0001/"
  );
  assert.deepEqual(bodyInputJson(2), {
    steamid: "90123456789012345",
    memo: "rotated test server"
  });
  assert.deepEqual(bodyInputJson(3), { steamid: "90123456789012345" });
  assert.deepEqual(bodyInputJson(4), { steamid: "90123456789012345" });
  assert.equal(
    requestUrl(5).origin + requestUrl(5).pathname,
    "https://api.steampowered.com/IGameServersService/GetAccountPublicInfo/v0001/"
  );
  assert.deepEqual(queryInputJson(5), { steamid: "90123456789012345" });
  assert.deepEqual(queryInputJson(6), { login_token: "abcdef123456" });
  assert.equal(
    requestUrl(7).origin + requestUrl(7).pathname,
    "https://api.steampowered.com/IGameServersService/GetServerSteamIDsByIP/v0001/"
  );
  assert.deepEqual(queryInputJson(7), { server_ips: "203.0.113.10:27015,203.0.113.11:27015" });
  assert.equal(
    requestUrl(8).origin + requestUrl(8).pathname,
    "https://api.steampowered.com/IGameServersService/GetServerIPsBySteamID/v0001/"
  );
  assert.deepEqual(queryInputJson(8), {
    server_steamids: "90123456789012345,90123456789012346"
  });
  assert.equal(typeof steam.webApi.gameServersService.createAccount, "function");
});

test("web API game notifications service facade maps session methods", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "notifications-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const queryInputJson = (index) => JSON.parse(requestUrl(index).searchParams.get("input_json"));
  const bodyInputJson = (index) => JSON.parse(new URLSearchParams(fetchCalls[index].init.body).get("input_json"));
  const userState = {
    steamId64: 76561198000000000n,
    state: "waiting",
    title: {
      token: "#TurnTitle",
      variables: [
        { key: "username", value: "Alex" },
        { key: "turn", value: 3n }
      ]
    },
    message: {
      token: "#TurnMessage",
      variables: [{ key: "city", value: "Bellevue" }]
    }
  };

  t.after(clearSteamBridgeCache);

  await client.gameNotificationsService.createSession({
    appId: 480,
    context: 31415926n,
    title: { token: "#SessionTitle", variables: [{ key: "mode", value: "async" }] },
    users: [userState],
    steamId64: 76561198000000000n
  });
  await client.gameNotificationsService.updateSession({
    sessionId: 12n,
    appId: 480,
    title: { token: "#UpdatedSession" },
    users: [{ ...userState, state: "ready" }]
  });
  await client.gameNotificationsService.enumerateSessionsForApp({
    steamId64: 76561198000000000n,
    appId: 480,
    includeAllUserMessages: false,
    includeAuthUserMessage: true,
    language: "en"
  });
  await client.gameNotificationsService.getSessionDetailsForApp({
    appId: 480,
    sessions: [
      { sessionId: 12n, includeAllUserMessages: false },
      { sessionId: "13", includeAuthUserMessage: true }
    ],
    language: "en"
  });
  await client.gameNotificationsService.requestNotifications({
    steamId64: 76561198000000000n,
    appId: 480
  });
  await client.gameNotificationsService.deleteSession({
    sessionId: 12n,
    appId: 480,
    steamId64: 76561198000000000n
  });
  await client.gameNotificationsService.deleteSessionBatch({
    sessionIds: [12n, "13"],
    appId: 480
  });
  await client.gameNotificationsService.userCreateSession({
    appId: 480,
    context: 27182818n,
    title: { token: "#UserSessionTitle" },
    users: [userState],
    steamId64: 76561198000000000n
  });
  await client.gameNotificationsService.userUpdateSession({
    sessionId: 14n,
    appId: 480,
    title: { token: "#UserUpdatedSession" },
    users: [{ ...userState, state: "done" }],
    steamId64: 76561198000000000n
  });
  await client.gameNotificationsService.userDeleteSession({
    sessionId: 14n,
    appId: 480,
    steamId64: 76561198000000000n
  });

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://partner.steam-api.com/IGameNotificationsService/CreateSession/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.equal(fetchCalls[0].init.headers["content-type"], "application/x-www-form-urlencoded");
  assert.deepEqual(bodyInputJson(0), {
    appid: 480,
    context: "31415926",
    title: { token: "#SessionTitle", variables: [{ key: "mode", value: "async" }] },
    users: [
      {
        steamid: "76561198000000000",
        state: "waiting",
        title: {
          token: "#TurnTitle",
          variables: [
            { key: "username", value: "Alex" },
            { key: "turn", value: "3" }
          ]
        },
        message: {
          token: "#TurnMessage",
          variables: [{ key: "city", value: "Bellevue" }]
        }
      }
    ],
    steamid: "76561198000000000"
  });
  assert.equal(
    requestUrl(1).origin + requestUrl(1).pathname,
    "https://partner.steam-api.com/IGameNotificationsService/UpdateSession/v0001/"
  );
  assert.deepEqual(bodyInputJson(1), {
    sessionid: "12",
    appid: 480,
    title: { token: "#UpdatedSession" },
    users: [
      {
        steamid: "76561198000000000",
        state: "ready",
        title: {
          token: "#TurnTitle",
          variables: [
            { key: "username", value: "Alex" },
            { key: "turn", value: "3" }
          ]
        },
        message: {
          token: "#TurnMessage",
          variables: [{ key: "city", value: "Bellevue" }]
        }
      }
    ]
  });
  assert.equal(
    requestUrl(2).origin + requestUrl(2).pathname,
    "https://partner.steam-api.com/IGameNotificationsService/EnumerateSessionsForApp/v0001/"
  );
  assert.equal(fetchCalls[2].init.method, "GET");
  assert.deepEqual(queryInputJson(2), {
    appid: 480,
    steamid: "76561198000000000",
    include_all_user_messages: false,
    include_auth_user_message: true,
    language: "en"
  });
  assert.equal(
    requestUrl(3).origin + requestUrl(3).pathname,
    "https://partner.steam-api.com/IGameNotificationsService/GetSessionDetailsForApp/v0001/"
  );
  assert.deepEqual(queryInputJson(3), {
    appid: 480,
    sessions: [
      { sessionid: "12", include_all_user_messages: false },
      { sessionid: "13", include_auth_user_message: true }
    ],
    language: "en"
  });
  assert.deepEqual(bodyInputJson(4), { steamid: "76561198000000000", appid: 480 });
  assert.deepEqual(bodyInputJson(5), {
    sessionid: "12",
    appid: 480,
    steamid: "76561198000000000"
  });
  assert.equal(
    requestUrl(6).origin + requestUrl(6).pathname,
    "https://partner.steam-api.com/IGameNotificationsService/DeleteSessionBatch/v0001/"
  );
  assert.deepEqual(bodyInputJson(6), { sessionid: ["12", "13"], appid: 480 });
  assert.equal(
    requestUrl(7).origin + requestUrl(7).pathname,
    "https://partner.steam-api.com/IGameNotificationsService/UserCreateSession/v0001/"
  );
  assert.deepEqual(bodyInputJson(7), {
    appid: 480,
    context: "27182818",
    title: { token: "#UserSessionTitle" },
    users: [
      {
        steamid: "76561198000000000",
        state: "waiting",
        title: {
          token: "#TurnTitle",
          variables: [
            { key: "username", value: "Alex" },
            { key: "turn", value: "3" }
          ]
        },
        message: {
          token: "#TurnMessage",
          variables: [{ key: "city", value: "Bellevue" }]
        }
      }
    ],
    steamid: "76561198000000000"
  });
  assert.equal(
    requestUrl(8).origin + requestUrl(8).pathname,
    "https://partner.steam-api.com/IGameNotificationsService/UserUpdateSession/v0001/"
  );
  assert.deepEqual(bodyInputJson(8), {
    sessionid: "14",
    appid: 480,
    title: { token: "#UserUpdatedSession" },
    users: [
      {
        steamid: "76561198000000000",
        state: "done",
        title: {
          token: "#TurnTitle",
          variables: [
            { key: "username", value: "Alex" },
            { key: "turn", value: "3" }
          ]
        },
        message: {
          token: "#TurnMessage",
          variables: [{ key: "city", value: "Bellevue" }]
        }
      }
    ],
    steamid: "76561198000000000"
  });
  assert.equal(
    requestUrl(9).origin + requestUrl(9).pathname,
    "https://partner.steam-api.com/IGameNotificationsService/UserDeleteSession/v0001/"
  );
  assert.deepEqual(bodyInputJson(9), {
    sessionid: "14",
    appid: 480,
    steamid: "76561198000000000"
  });
  assert.equal(typeof steam.webApi.gameNotificationsService.createSession, "function");
  assert.equal(typeof steam.webApi.gameNotificationsService.userCreateSession, "function");
});

test("web API published file service facade maps workshop service methods", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "workshop-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const queryInputJson = (index) => JSON.parse(requestUrl(index).searchParams.get("input_json"));
  const bodyInputJson = (index) => JSON.parse(new URLSearchParams(fetchCalls[index].init.body).get("input_json"));

  t.after(clearSteamBridgeCache);

  await client.publishedFileService.deleteFile({ appId: 480, publishedFileId: 111n });
  await client.publishedFileService.queryFiles({
    queryType: steam.SteamWebApiPublishedFileQueryType.RankedByTrend,
    page: 2,
    cursor: "AoIIPw",
    numPerPage: 10,
    creatorAppId: 480,
    appId: 480,
    requiredTags: ["co-op", "maps"],
    excludedTags: "spoiler",
    matchAllTags: true,
    requiredFlags: "consumer_app",
    omittedFlags: "incompatible",
    searchText: "arena",
    fileType: steam.SteamWebApiPublishedFileInfoMatchingFileType.Items,
    childPublishedFileId: 222n,
    days: 7,
    includeRecentVotesOnly: false,
    cacheMaxAgeSeconds: 60,
    language: 0,
    requiredKeyValueTags: { mode: "coop" },
    totalOnly: false,
    idsOnly: false,
    returnVoteData: true,
    returnTags: true,
    returnKeyValueTags: true,
    returnPreviews: true,
    returnChildren: true,
    returnShortDescription: true,
    returnForSaleData: false,
    returnMetadata: true,
    returnPlaytimeStats: 14
  });
  await client.publishedFileService.getUserVoteSummary({ publishedFileIds: [333n, 444n] });
  await client.publishedFileService.setDeveloperMetadata({
    appId: 480,
    publishedFileId: 111n,
    metadata: "{\"build\":\"beta\"}"
  });
  await client.publishedFileService.updateAppUgcBan({
    steamId64: 76561198000000000n,
    appId: 480,
    expirationTime: 1760000000,
    reason: "test moderation"
  });
  await client.publishedFileService.updateBanStatus({
    appId: 480,
    publishedFileId: 111n,
    banned: true,
    reason: "policy"
  });
  await client.publishedFileService.updateIncompatibleStatus({
    appId: 480,
    publishedFileId: 111n,
    incompatible: false
  });
  await client.publishedFileService.updateTags({
    appId: 480,
    publishedFileId: 111n,
    addTags: ["co-op"],
    removeTags: ["old"]
  });

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://api.steampowered.com/IPublishedFileService/Delete/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "GET");
  assert.deepEqual(queryInputJson(0), { publishedfileid: "111", appid: 480 });
  assert.equal(
    requestUrl(1).origin + requestUrl(1).pathname,
    "https://api.steampowered.com/IPublishedFileService/QueryFiles/v0001/"
  );
  assert.deepEqual(queryInputJson(1), {
    query_type: 3,
    page: 2,
    cursor: "AoIIPw",
    numperpage: 10,
    creator_appid: 480,
    appid: 480,
    requiredtags: ["co-op", "maps"],
    excludedtags: "spoiler",
    match_all_tags: true,
    required_flags: "consumer_app",
    omitted_flags: "incompatible",
    search_text: "arena",
    filetype: 0,
    child_publishedfileid: "222",
    days: 7,
    include_recent_votes_only: false,
    cache_max_age_seconds: 60,
    language: 0,
    required_kv_tags: [{ key: "mode", value: "coop" }],
    totalonly: false,
    ids_only: false,
    return_vote_data: true,
    return_tags: true,
    return_kv_tags: true,
    return_previews: true,
    return_children: true,
    return_short_description: true,
    return_for_sale_data: false,
    return_metadata: true,
    return_playtime_stats: 14
  });
  assert.equal(
    requestUrl(2).origin + requestUrl(2).pathname,
    "https://api.steampowered.com/IPublishedFileService/GetUserVoteSummary/v0001/"
  );
  assert.deepEqual(queryInputJson(2), { publishedfileids: ["333", "444"] });
  assert.equal(
    requestUrl(3).origin + requestUrl(3).pathname,
    "https://partner.steam-api.com/IPublishedFileService/SetDeveloperMetadata/v0001/"
  );
  assert.deepEqual(bodyInputJson(3), {
    publishedfileid: "111",
    appid: 480,
    metadata: "{\"build\":\"beta\"}"
  });
  assert.deepEqual(bodyInputJson(4), {
    steamid: "76561198000000000",
    appid: 480,
    expiration_time: 1760000000,
    reason: "test moderation"
  });
  assert.deepEqual(bodyInputJson(5), {
    publishedfileid: "111",
    appid: 480,
    banned: true,
    reason: "policy"
  });
  assert.deepEqual(bodyInputJson(6), {
    publishedfileid: "111",
    appid: 480,
    incompatible: false
  });
  assert.equal(
    requestUrl(7).origin + requestUrl(7).pathname,
    "https://partner.steam-api.com/IPublishedFileService/UpdateTags/v0001/"
  );
  assert.deepEqual(bodyInputJson(7), {
    publishedfileid: "111",
    appid: 480,
    add_tags: ["co-op"],
    remove_tags: ["old"]
  });
  assert.equal(typeof steam.webApi.publishedFileService.queryFiles, "function");
});

test("web API workshop service facade maps publisher workshop methods", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "workshop-service-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const queryInputJson = (index) => JSON.parse(requestUrl(index).searchParams.get("input_json"));
  const bodyInputJson = (index) => JSON.parse(new URLSearchParams(fetchCalls[index].init.body).get("input_json"));

  t.after(clearSteamBridgeCache);

  await client.workshopService.setItemPaymentRules({
    appId: 480,
    gameItemId: 1001,
    associatedWorkshopFiles: [
      { publishedfileid: 123456789n, revenue_percentage: 7500 },
      { publishedfileid: "987654321", revenue_percentage: 2500 }
    ],
    partnerAccounts: [
      { steamid: 76561198000000000n, revenue_percentage: 7000 },
      { steamid: "76561198000000001", revenue_percentage: 3000 }
    ],
    validateOnly: true,
    makeWorkshopFilesSubscribable: false
  });
  await client.workshopService.getFinalizedContributors({ appId: 480, gameItemId: 1001 });
  await client.workshopService.getItemDailyRevenue({
    appId: 480,
    itemId: 1001,
    dateStart: 1760000000,
    dateEnd: 1760086400
  });
  await client.workshopService.populateItemDescriptions({
    appId: 480,
    languages: [
      {
        language: "english",
        descriptions: [
          {
            item_id: 1001,
            title: "Example Workshop Item",
            description: "Generic description"
          }
        ]
      }
    ]
  });

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://partner.steam-api.com/IWorkshopService/SetItemPaymentRules/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.equal(fetchCalls[0].init.headers["content-type"], "application/x-www-form-urlencoded");
  assert.deepEqual(bodyInputJson(0), {
    appid: 480,
    gameitemid: 1001,
    associated_workshop_files: [
      { publishedfileid: "123456789", revenue_percentage: 7500 },
      { publishedfileid: "987654321", revenue_percentage: 2500 }
    ],
    partner_accounts: [
      { steamid: "76561198000000000", revenue_percentage: 7000 },
      { steamid: "76561198000000001", revenue_percentage: 3000 }
    ],
    validate_only: true,
    make_workshop_files_subscribable: false
  });
  assert.equal(
    requestUrl(1).origin + requestUrl(1).pathname,
    "https://partner.steam-api.com/IWorkshopService/GetFinalizedContributors/v0001/"
  );
  assert.equal(fetchCalls[1].init.method, "GET");
  assert.deepEqual(queryInputJson(1), { appid: 480, gameitemid: 1001 });
  assert.equal(
    requestUrl(2).origin + requestUrl(2).pathname,
    "https://partner.steam-api.com/IWorkshopService/GetItemDailyRevenue/v0001/"
  );
  assert.deepEqual(queryInputJson(2), {
    appid: 480,
    item_id: 1001,
    date_start: 1760000000,
    date_end: 1760086400
  });
  assert.equal(
    requestUrl(3).origin + requestUrl(3).pathname,
    "https://partner.steam-api.com/IWorkshopService/PopulateItemDescriptions/v0001/"
  );
  assert.equal(fetchCalls[3].init.method, "POST");
  assert.deepEqual(bodyInputJson(3), {
    appid: 480,
    languages: [
      {
        language: "english",
        descriptions: [
          {
            item_id: 1001,
            title: "Example Workshop Item",
            description: "Generic description"
          }
        ]
      }
    ]
  });
  assert.equal(typeof steam.webApi.workshopService.setItemPaymentRules, "function");
});

test("web API player and store service facades use input_json payloads", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "user-secret", fetch: fetchImpl });
  const inputJson = (index) => JSON.parse(new URL(fetchCalls[index].url).searchParams.get("input_json"));
  const bodyInputJson = (index) => JSON.parse(new URLSearchParams(fetchCalls[index].init.body).get("input_json"));

  t.after(clearSteamBridgeCache);

  await client.player.getRecentlyPlayedGames({ steamId64: 76561198000000000n, count: 3 });
  await client.player.getSingleGamePlaytime({ steamId64: 76561198000000000n, appId: 480 });
  await client.player.getOwnedGames({
    steamId64: 76561198000000000n,
    includeAppInfo: true,
    includePlayedFreeGames: false,
    appIdsFilter: [480, 481]
  });
  await client.player.getSteamLevel(76561198000000000n);
  await client.player.getBadges(76561198000000000n);
  await client.player.getCommunityBadgeProgress({ steamId64: 76561198000000000n, badgeId: 2 });
  await client.player.recordOfflinePlaytime({
    steamId64: 76561198000000000n,
    ticket: "ticket",
    playSessions: [{ appid: 480, playtime_seconds: 60n }]
  });
  await client.store.getAppList({
    ifModifiedSince: 1700000000,
    haveDescriptionLanguage: "en",
    includeGames: true,
    includeDlc: true,
    includeSoftware: false,
    includeVideos: false,
    includeHardware: false,
    lastAppId: 480,
    maxResults: 100
  });
  await client.store.getGamesFollowed(76561198000000000n);
  await client.store.getGamesFollowedCount(76561198000000000n);
  await client.store.getRecommendedTagsForUser({
    language: "en",
    countryCode: "US",
    favorRarerTags: true
  });

  assert.match(fetchCalls[0].url, /^https:\/\/partner\.steam-api\.com\/IPlayerService\/GetRecentlyPlayedGames\/v0001\//);
  assert.deepEqual(inputJson(0), { steamid: "76561198000000000", count: 3 });
  assert.match(fetchCalls[1].url, /IPlayerService\/GetSingleGamePlaytime\/v0001/);
  assert.deepEqual(inputJson(1), { steamid: "76561198000000000", appid: 480 });
  assert.match(fetchCalls[2].url, /IPlayerService\/GetOwnedGames\/v0001/);
  assert.deepEqual(inputJson(2), {
    steamid: "76561198000000000",
    include_appinfo: true,
    include_played_free_games: false,
    appids_filter: [480, 481]
  });
  assert.deepEqual(inputJson(3), { steamid: "76561198000000000" });
  assert.match(fetchCalls[4].url, /IPlayerService\/GetBadges\/v0001/);
  assert.deepEqual(inputJson(5), { steamid: "76561198000000000", badgeid: 2 });
  assert.match(fetchCalls[6].url, /^https:\/\/partner\.steam-api\.com\/IPlayerService\/RecordOfflinePlaytime\/v0001\//);
  assert.equal(fetchCalls[6].init.method, "POST");
  assert.deepEqual(bodyInputJson(6), {
    steamid: "76561198000000000",
    ticket: "ticket",
    play_sessions: [{ appid: 480, playtime_seconds: "60" }]
  });
  assert.match(fetchCalls[7].url, /^https:\/\/partner\.steam-api\.com\/IStoreService\/GetAppList\/v0001\//);
  assert.deepEqual(inputJson(7), {
    if_modified_since: 1700000000,
    have_description_language: "en",
    include_games: true,
    include_dlc: true,
    include_software: false,
    include_videos: false,
    include_hardware: false,
    last_appid: 480,
    max_results: 100
  });
  assert.equal(new URL(fetchCalls[7].url).searchParams.get("key"), "user-secret");
  assert.match(fetchCalls[8].url, /IStoreService\/GetGamesFollowed\/v0001/);
  assert.deepEqual(inputJson(8), { steamid: "76561198000000000" });
  assert.match(fetchCalls[9].url, /IStoreService\/GetGamesFollowedCount\/v0001/);
  assert.deepEqual(inputJson(9), { steamid: "76561198000000000" });
  assert.match(fetchCalls[10].url, /IStoreService\/GetRecommendedTagsForUser\/v0001/);
  assert.deepEqual(inputJson(10), {
    language: "en",
    country_code: "US",
    favor_rarer_tags: true
  });
});

test("web API directory, help logs, and wishlist service facades use input_json payloads", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "service-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const queryInputJson = (index) => JSON.parse(requestUrl(index).searchParams.get("input_json"));
  const bodyInputJson = (index) => JSON.parse(new URLSearchParams(fetchCalls[index].init.body).get("input_json"));

  t.after(clearSteamBridgeCache);

  await client.contentServerDirectoryService.getCdnForVideo({
    propertyType: 1,
    clientIp: "203.0.113.10",
    clientRegion: "US"
  });
  await client.contentServerDirectoryService.pickSingleContentServer({
    propertyType: 2,
    cellId: 1,
    clientIp: "203.0.113.11"
  });
  await client.contentServerDirectoryService.getServersForSteamPipe({
    cellId: 1,
    maxServers: 4,
    ipOverride: "203.0.113.12",
    launcherType: 2,
    ipv6Public: "2001:db8::1",
    currentConnections: { source_ids: [1, 2], active_downloads: 1n }
  });
  await client.contentServerDirectoryService.getClientUpdateHosts({ cachedSignature: "signature" });
  await client.contentServerDirectoryService.getDepotPatchInfo({
    appId: 480,
    depotId: 481,
    sourceManifestId: 111n,
    targetManifestId: 222n
  });
  await client.helpRequestLogsService.uploadUserApplicationLog({
    appId: 480,
    logType: "client",
    versionString: "1.0.0",
    logContents: "log line",
    requestId: 333n
  });
  await client.helpRequestLogsService.getApplicationLogDemand({ appId: 480 });
  await client.wishlistService.getWishlistSortedFiltered({
    steamId64: 76561198000000000n,
    context: { country_code: "US", language: "en" },
    dataRequest: { include_assets: true },
    filters: { tagids: [19, 21] },
    sortOrder: 0,
    startIndex: 5,
    pageSize: 10,
    shareToken: "share-token"
  });
  await client.wishlistService.getWishlist(76561198000000000n);
  await client.wishlistService.getWishlistItemCount(76561198000000000n);

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://api.steampowered.com/IContentServerDirectoryService/GetCDNForVideo/v0001/"
  );
  assert.deepEqual(queryInputJson(0), {
    property_type: 1,
    client_ip: "203.0.113.10",
    client_region: "US"
  });
  assert.equal(
    requestUrl(1).origin + requestUrl(1).pathname,
    "https://api.steampowered.com/IContentServerDirectoryService/PickSingleContentServer/v0001/"
  );
  assert.deepEqual(queryInputJson(1), {
    property_type: 2,
    cell_id: 1,
    client_ip: "203.0.113.11"
  });
  assert.equal(
    requestUrl(2).origin + requestUrl(2).pathname,
    "https://api.steampowered.com/IContentServerDirectoryService/GetServersForSteamPipe/v0001/"
  );
  assert.deepEqual(queryInputJson(2), {
    cell_id: 1,
    max_servers: 4,
    ip_override: "203.0.113.12",
    launcher_type: 2,
    ipv6_public: "2001:db8::1",
    current_connections: { source_ids: [1, 2], active_downloads: "1" }
  });
  assert.deepEqual(queryInputJson(3), { cached_signature: "signature" });
  assert.deepEqual(queryInputJson(4), {
    appid: 480,
    depotid: 481,
    source_manifestid: "111",
    target_manifestid: "222"
  });
  assert.equal(
    requestUrl(5).origin + requestUrl(5).pathname,
    "https://partner.steam-api.com/IHelpRequestLogsService/UploadUserApplicationLog/v0001/"
  );
  assert.equal(fetchCalls[5].init.method, "POST");
  assert.deepEqual(bodyInputJson(5), {
    appid: 480,
    log_type: "client",
    version_string: "1.0.0",
    log_contents: "log line",
    request_id: "333"
  });
  assert.equal(
    requestUrl(6).origin + requestUrl(6).pathname,
    "https://partner.steam-api.com/IHelpRequestLogsService/GetApplicationLogDemand/v0001/"
  );
  assert.deepEqual(bodyInputJson(6), { appid: 480 });
  assert.equal(
    requestUrl(7).origin + requestUrl(7).pathname,
    "https://api.steampowered.com/IWishlistService/GetWishlistSortedFiltered/v0001/"
  );
  assert.deepEqual(queryInputJson(7), {
    steamid: "76561198000000000",
    context: { country_code: "US", language: "en" },
    data_request: { include_assets: true },
    sort_order: 0,
    filters: { tagids: [19, 21] },
    start_index: 5,
    page_size: 10,
    share_token: "share-token"
  });
  assert.deepEqual(queryInputJson(8), { steamid: "76561198000000000" });
  assert.deepEqual(queryInputJson(9), { steamid: "76561198000000000" });
  assert.equal(typeof steam.webApi.contentServerDirectoryService.getServersForSteamPipe, "function");
  assert.equal(typeof steam.webApi.helpRequestLogsService.getApplicationLogDemand, "function");
  assert.equal(typeof steam.webApi.wishlistService.getWishlistItemCount, "function");
});

test("web API site license service facade maps cafe service methods", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "site-license-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);

  t.after(clearSteamBridgeCache);

  await client.siteLicenseService.getCurrentClientConnections({ siteId: 0n });
  await client.siteLicenseService.getTotalPlaytime({
    startTime: "2026-06-01T00:00:00Z",
    endTime: "2026-06-02T00:00:00Z",
    siteId: 123n
  });

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://api.steampowered.com/ISiteLicenseService/GetCurrentClientConnections/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "GET");
  assert.equal(requestUrl(0).searchParams.get("key"), "site-license-secret");
  assert.equal(requestUrl(0).searchParams.get("format"), "json");
  assert.equal(requestUrl(0).searchParams.get("siteid"), "0");
  assert.equal(requestUrl(0).searchParams.has("input_json"), false);

  assert.equal(
    requestUrl(1).origin + requestUrl(1).pathname,
    "https://api.steampowered.com/ISiteLicenseService/GetTotalPlaytime/v0001/"
  );
  assert.equal(fetchCalls[1].init.method, "GET");
  assert.equal(requestUrl(1).searchParams.get("key"), "site-license-secret");
  assert.equal(requestUrl(1).searchParams.get("format"), "json");
  assert.equal(requestUrl(1).searchParams.get("start_time"), "2026-06-01T00:00:00Z");
  assert.equal(requestUrl(1).searchParams.get("end_time"), "2026-06-02T00:00:00Z");
  assert.equal(requestUrl(1).searchParams.get("siteid"), "123");
  assert.equal(requestUrl(1).searchParams.has("input_json"), false);
  assert.equal(typeof steam.webApi.siteLicenseService.getTotalPlaytime, "function");
});

test("web API authentication service and OAuth facades map auth transport fields", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "auth-secret", fetch: fetchImpl });
  const requestUrl = (index) => new URL(fetchCalls[index].url);
  const queryInputJson = (index) => JSON.parse(requestUrl(index).searchParams.get("input_json"));
  const bodyInputJson = (index) => JSON.parse(new URLSearchParams(fetchCalls[index].init.body).get("input_json"));

  t.after(clearSteamBridgeCache);

  await client.authenticationService.pollAuthSessionStatus({
    clientId: 111n,
    requestId: "request-1",
    tokenToRevoke: 0n
  });
  await client.authenticationService.getAuthSessionInfo(111n);
  await client.authenticationService.getAuthSessionRiskInfo({ clientId: 111n, language: 0 });
  await client.authenticationService.notifyRiskQuizResults({
    clientId: 111n,
    results: { questions: [{ id: 1, correct: true }] },
    selectedAction: "approve",
    didConfirmLogin: true
  });
  await client.authenticationService.getPasswordRsaPublicKey("player@example.com");
  await client.authenticationService.beginAuthSessionViaCredentials({
    deviceFriendlyName: "Steam Bridge Test",
    accountName: "player",
    encryptedPassword: "encrypted-password",
    encryptionTimestamp: 222n,
    rememberLogin: false,
    platformType: 2,
    persistence: 1,
    websiteId: "steam-bridge",
    deviceDetails: { device_id: "device-1", platform: "desktop" },
    guardData: "guard-data",
    language: 0,
    qosLevel: 1
  });
  await client.authenticationService.updateAuthSessionWithSteamGuardCode({
    clientId: 111n,
    steamId64: 76561198000000000n,
    code: "ABCDE",
    codeType: 2
  });
  await client.authenticationService.beginAuthSessionViaQr({
    deviceFriendlyName: "Steam Bridge QR",
    platformType: 2,
    deviceDetails: { device_id: "device-qr" },
    websiteId: "steam-bridge"
  });
  await client.authenticationService.updateAuthSessionWithMobileConfirmation({
    version: 1,
    clientId: 111n,
    steamId64: 76561198000000000n,
    signature: "signature",
    confirm: true,
    persistence: 1
  });
  await client.userOAuth.getTokenDetails("oauth-token");

  assert.equal(
    requestUrl(0).origin + requestUrl(0).pathname,
    "https://api.steampowered.com/IAuthenticationService/PollAuthSessionStatus/v0001/"
  );
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.equal(requestUrl(0).searchParams.has("key"), false);
  assert.deepEqual(bodyInputJson(0), {
    client_id: "111",
    request_id: "request-1",
    token_to_revoke: "0"
  });
  assert.deepEqual(bodyInputJson(1), { client_id: "111" });
  assert.deepEqual(bodyInputJson(2), { client_id: "111", language: 0 });
  assert.deepEqual(bodyInputJson(3), {
    client_id: "111",
    results: { questions: [{ id: 1, correct: true }] },
    selected_action: "approve",
    did_confirm_login: true
  });
  assert.equal(
    requestUrl(4).origin + requestUrl(4).pathname,
    "https://api.steampowered.com/IAuthenticationService/GetPasswordRSAPublicKey/v0001/"
  );
  assert.equal(fetchCalls[4].init.method, "GET");
  assert.deepEqual(queryInputJson(4), { account_name: "player@example.com" });
  assert.deepEqual(bodyInputJson(5), {
    device_friendly_name: "Steam Bridge Test",
    account_name: "player",
    encrypted_password: "encrypted-password",
    encryption_timestamp: "222",
    remember_login: false,
    platform_type: 2,
    persistence: 1,
    website_id: "steam-bridge",
    device_details: { device_id: "device-1", platform: "desktop" },
    guard_data: "guard-data",
    language: 0,
    qos_level: 1
  });
  assert.deepEqual(bodyInputJson(6), {
    client_id: "111",
    steamid: "76561198000000000",
    code: "ABCDE",
    code_type: 2
  });
  assert.equal(
    requestUrl(7).origin + requestUrl(7).pathname,
    "https://api.steampowered.com/IAuthenticationService/BeginAuthSessionViaQR/v0001/"
  );
  assert.deepEqual(bodyInputJson(7), {
    device_friendly_name: "Steam Bridge QR",
    platform_type: 2,
    device_details: { device_id: "device-qr" },
    website_id: "steam-bridge"
  });
  assert.deepEqual(bodyInputJson(8), {
    version: 1,
    client_id: "111",
    steamid: "76561198000000000",
    signature: "signature",
    confirm: true,
    persistence: 1
  });
  assert.equal(
    fetchCalls[9].url,
    "https://api.steampowered.com/ISteamUserOAuth/GetTokenDetails/v0001/?format=json&access_token=oauth-token"
  );
  assert.equal(requestUrl(9).searchParams.has("key"), false);
  assert.equal(typeof steam.webApi.authenticationService.beginAuthSessionViaQr, "function");
  assert.equal(typeof steam.webApi.userOAuth.getTokenDetails, "function");
});

test("web API user auth and community facades map ticket and moderation fields", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "publisher-secret", fetch: fetchImpl });

  t.after(clearSteamBridgeCache);

  await client.userAuth.authenticateUser({
    steamId64: 76561198000000000n,
    sessionKey: Buffer.from([1, 2, 3]),
    encryptedLoginKey: Buffer.from([4, 5, 6])
  });
  await client.userAuth.authenticateUserTicket({
    appId: 480,
    ticket: Buffer.from([10, 11, 12]),
    identity: "steam-bridge-example"
  });
  await client.community.reportAbuse({
    actorSteamId64: 76561198000000000n,
    targetSteamId64: 76561198000000001n,
    appId: 480,
    abuseType: 1,
    contentType: 2,
    description: "Abuse report",
    gid: 123n
  });

  assert.equal(
    fetchCalls[0].url,
    "https://partner.steam-api.com/ISteamUserAuth/AuthenticateUser/v0001/?format=json"
  );
  assert.equal(fetchCalls[0].init.body, "steamid=76561198000000000&sessionkey=010203&encrypted_loginkey=040506");
  assert.equal(
    fetchCalls[1].url,
    "https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v0001/?key=publisher-secret&format=json&appid=480&ticket=0a0b0c&identity=steam-bridge-example"
  );
  assert.equal(
    fetchCalls[2].url,
    "https://partner.steam-api.com/ISteamCommunity/ReportAbuse/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(
    fetchCalls[2].init.body,
    "steamidActor=76561198000000000&steamidTarget=76561198000000001&appid=480&abuseType=1&contentType=2&description=Abuse+report&gid=123"
  );
});

test("web API published item search and voting facades map workshop fields", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "publisher-secret", fetch: fetchImpl });

  t.after(clearSteamBridgeCache);

  await client.publishedItemSearch.rankedByPublicationOrder({
    steamId64: 76561198000000000n,
    appId: 480,
    startIndex: 0,
    count: 10,
    tags: ["co-op"],
    userTags: ["favorite"],
    hasAppAdminAccess: true,
    fileType: 1
  });
  await client.publishedItemSearch.rankedByTrend({
    steamId64: 76561198000000000n,
    appId: 480,
    startIndex: 10,
    count: 5,
    days: 7
  });
  await client.publishedItemSearch.rankedByVote({
    steamId64: 76561198000000000n,
    appId: 480,
    startIndex: 20,
    count: 5
  });
  await client.publishedItemSearch.resultSetSummary({
    steamId64: 76561198000000000n,
    appId: 480n,
    tags: ["maps"],
    userTags: []
  });
  await client.publishedItemVoting.itemVoteSummary({
    steamId64: 76561198000000000n,
    appId: 480,
    publishedFileIds: [111n, 222n]
  });
  await client.publishedItemVoting.userVoteSummary({
    steamId64: 76561198000000000n,
    publishedFileIds: [333n]
  });

  assert.equal(
    fetchCalls[0].url,
    "https://partner.steam-api.com/ISteamPublishedItemSearch/RankedByPublicationOrder/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(
    fetchCalls[0].init.body,
    "steamid=76561198000000000&appid=480&startidx=0&count=10&tagcount=1&usertagcount=1&hasappadminaccess=1&fileType=1&tag%5B0%5D=co-op&usertag%5B0%5D=favorite"
  );
  assert.equal(
    fetchCalls[1].url,
    "https://partner.steam-api.com/ISteamPublishedItemSearch/RankedByTrend/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(
    fetchCalls[1].init.body,
    "steamid=76561198000000000&appid=480&startidx=10&count=5&tagcount=0&usertagcount=0&days=7"
  );
  assert.equal(
    fetchCalls[2].url,
    "https://partner.steam-api.com/ISteamPublishedItemSearch/RankedByVote/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(
    fetchCalls[2].init.body,
    "steamid=76561198000000000&appid=480&startidx=20&count=5&tagcount=0&usertagcount=0"
  );
  assert.equal(
    fetchCalls[3].url,
    "https://partner.steam-api.com/ISteamPublishedItemSearch/ResultSetSummary/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(
    fetchCalls[3].init.body,
    "steamid=76561198000000000&appid=480&tagcount=1&usertagcount=0&tag%5B0%5D=maps"
  );
  assert.equal(
    fetchCalls[4].url,
    "https://partner.steam-api.com/ISteamPublishedItemVoting/ItemVoteSummary/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(
    fetchCalls[4].init.body,
    "steamid=76561198000000000&appid=480&count=2&publishedfileid%5B0%5D=111&publishedfileid%5B1%5D=222"
  );
  assert.equal(
    fetchCalls[5].url,
    "https://partner.steam-api.com/ISteamPublishedItemVoting/UserVoteSummary/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(fetchCalls[5].init.body, "steamid=76561198000000000&count=1&publishedfileid%5B0%5D=333");
});

test("web API leaderboard and game server stats facades map ranking fields", async (t) => {
  const steam = loadSteamWithFakeNative(createFakeNative());
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: {
        forEach(callback) {
          callback("application/json", "content-type");
        }
      },
      async text() {
        return JSON.stringify({ response: { ok: true } });
      }
    };
  };
  const client = steam.createSteamWebApiClient({ apiKey: "publisher-secret", fetch: fetchImpl });

  t.after(clearSteamBridgeCache);

  await client.leaderboards.deleteLeaderboard({ appId: 480, name: "Daily Score" });
  await client.leaderboards.deleteLeaderboardScore({
    appId: 480,
    leaderboardId: 123n,
    steamId64: 76561198000000000n
  });
  await client.leaderboards.findOrCreateLeaderboard({
    appId: 480,
    name: "Daily Score",
    sortMethod: 1,
    displayType: 2,
    createIfNotFound: true,
    onlyTrustedWrites: false,
    onlyFriendsReads: true
  });
  await client.leaderboards.getLeaderboardEntries({
    appId: 480,
    leaderboardId: 123n,
    rangeStart: 1,
    rangeEnd: 10,
    steamId64: 76561198000000000n,
    dataRequest: 0
  });
  await client.leaderboards.getLeaderboardsForGame(480);
  await client.leaderboards.resetLeaderboard({ appId: 480, leaderboardId: 123n });
  await client.leaderboards.setLeaderboardScore({
    appId: 480,
    leaderboardId: 123n,
    steamId64: 76561198000000000n,
    score: 9001,
    scoreMethod: 1,
    details: Buffer.from([1, 2, 3])
  });
  await client.gameServerStats.getGameServerPlayerStatsForGame({
    gameId: 480n,
    appId: 480,
    rangeStart: "2026-06-01 00:00:00",
    rangeEnd: "2026-06-02 00:00:00",
    maxResults: 100
  });

  assert.equal(
    fetchCalls[0].url,
    "https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(fetchCalls[0].init.body, "appid=480&name=Daily+Score");
  assert.equal(
    fetchCalls[1].url,
    "https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboardScore/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(fetchCalls[1].init.body, "appid=480&leaderboardid=123&steamid=76561198000000000");
  assert.equal(
    fetchCalls[2].url,
    "https://partner.steam-api.com/ISteamLeaderboards/FindOrCreateLeaderboard/v0002/?key=publisher-secret&format=json"
  );
  assert.equal(
    fetchCalls[2].init.body,
    "appid=480&name=Daily+Score&sortmethod=1&displaytype=2&createifnotfound=1&onlytrustedwrites=0&onlyfriendsreads=1"
  );
  assert.equal(
    fetchCalls[3].url,
    "https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardEntries/v0001/?key=publisher-secret&format=json&appid=480&rangestart=1&rangeend=10&steamid=76561198000000000&leaderboardid=123&datarequest=0"
  );
  assert.equal(
    fetchCalls[4].url,
    "https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardsForGame/v0002/?key=publisher-secret&format=json&appid=480"
  );
  assert.equal(
    fetchCalls[5].url,
    "https://partner.steam-api.com/ISteamLeaderboards/ResetLeaderboard/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(fetchCalls[5].init.body, "appid=480&leaderboardid=123");
  assert.equal(
    fetchCalls[6].url,
    "https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v0001/?key=publisher-secret&format=json"
  );
  assert.equal(
    fetchCalls[6].init.body,
    "appid=480&leaderboardid=123&steamid=76561198000000000&score=9001&scoremethod=1&details=010203"
  );
  assert.equal(
    fetchCalls[7].url,
    "https://partner.steam-api.com/ISteamGameServerStats/GetGameServerPlayerStatsForGame/v0001/?key=publisher-secret&format=json&gameid=480&appid=480&rangestart=2026-06-01+00%3A00%3A00&rangeend=2026-06-02+00%3A00%3A00&maxresults=100"
  );
});
