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
    if (overlayTargetCount > 1) {
      resultFailures.push(`${caseName}: duplicate gameoverlayui targets detected (${overlayTargetCount})`);
    }

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
    assert(summary.caseSummaries.length === 1, "summary self-test should include one case");
    assert(summary.totalScreenshots === 1, "summary self-test should count one screenshot");
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
          value: {
            attached: true,
            nativeHostOpen: true,
            mode: "passive",
            currentFps: 0
          }
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
      { type: "event:callback:overlay-activated", payload: { active: false } },
      { type: "event:overlay:presenter-after-close-stable", payload: { presenter: { currentFps: 0 } } }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n") + "\n"
  );
  fs.writeFileSync(path.join(screensDir, "after-open.png"), "");
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
