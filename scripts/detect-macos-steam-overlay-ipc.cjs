#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const resultPrefix = "STEAM_BRIDGE_SMOKE_RESULT ";

main();

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    return;
  }

  const result = detectSteamOverlayIpcFailure({
    resultFile: requiredArg(args, "resultFile", "--result-file"),
    consoleLog: args.consoleLog || defaultSteamConsoleLog(),
    appId: String(args.appId || "480")
  });

  if (!result.detected) {
    process.exit(1);
  }

  if (args.writeArtifact && args.diagnosticDir) {
    fs.mkdirSync(args.diagnosticDir, { recursive: true });
    fs.writeFileSync(path.join(args.diagnosticDir, "steam-overlay-ipc-diagnostics.txt"), result.message);
  }

  if (!args.quiet) {
    process.stderr.write(result.message);
  }
}

function detectSteamOverlayIpcFailure({ resultFile, consoleLog, appId }) {
  const smokeResult = readSmokeResult(resultFile);
  if (!smokeResult) {
    return { detected: false, message: "" };
  }

  const pid = smokeResult?.snapshot?.process?.pid;
  if (!Number.isInteger(pid) || pid <= 0 || !fs.existsSync(consoleLog)) {
    return { detected: false, message: "" };
  }

  const lines = fs.readFileSync(consoleLog, "utf8").split(/\r?\n/);
  const pidText = String(pid);
  const overlayEnabled = smokeResult?.snapshot?.steam?.overlayEnabled?.value;
  const overlayTargets = Array.isArray(smokeResult?.snapshot?.overlayProcesses?.gameoverlayui)
    ? smokeResult.snapshot.overlayProcesses.gameoverlayui
    : [];
  const firstPidLine = lines.findIndex((line) => line.includes(`ProcID ${pidText}`) || line.includes(`game process ${pidText}`));
  const scanStart = firstPidLine >= 0 ? Math.max(0, firstPidLine - 20) : Math.max(0, lines.length - 500);
  const steamGameStream = `SteamGameStream_${pidText}`;
  const steamOverlayRunning = `SteamOverlayRunning_${appId}`;
  const interesting = [];
  let overlayStartsForPid = 0;
  let hasIpcFailure = false;

  for (let index = scanStart; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes("GameOverlay: started") && line.includes(`game process ${pidText}`)) {
      overlayStartsForPid += 1;
      interesting.push(line);
      continue;
    }

    const relatedToCurrentProcess =
      line.includes(steamGameStream) ||
      line.includes(steamOverlayRunning) ||
      line.includes(`game process ${pidText}`) ||
      line.includes(`ProcID ${pidText}`);
    const isIpcFailure =
      /Failed to create (?:BinarySemaphore|Posix(?:Mutex|AutoResetEvent))/.test(line) ||
      /errno:\s*28\b/.test(line);
    if (relatedToCurrentProcess && isIpcFailure) {
      hasIpcFailure = true;
      interesting.push(line);
      const nextLine = lines[index + 1] || "";
      if (/errno:\s*28\b/.test(nextLine)) {
        interesting.push(nextLine);
      }
    }
  }

  const detected =
    hasIpcFailure ||
    (overlayStartsForPid > 1 && overlayTargets.length === 0 && overlayEnabled === false);

  if (!detected) {
    return { detected: false, message: "" };
  }

  const uniqueLines = [...new Set(interesting)].slice(-16);
  const messageLines = [
    `Steam overlay IPC/resource failure detected for smoke PID ${pidText}.`,
    `Steam overlay enabled=${format(overlayEnabled)}, live gameoverlayui targets=${overlayTargets.length}, gameoverlayui launches for this PID=${overlayStartsForPid}.`,
    "Steam started or attempted to start overlay UI, but its IPC resources failed or the helper exited before the smoke snapshot could observe a live overlay target.",
    "This is a Steam client state failure; recover by fully quitting Steam and clearing stale Steam IPC state or rebooting macOS before re-running overlay proof.",
    "",
    "Relevant Steam console log lines:",
    ...(uniqueLines.length > 0 ? uniqueLines.map((line) => `  ${line}`) : ["  (none captured)"])
  ];

  return { detected: true, message: `${messageLines.join("\n")}\n` };
}

function readSmokeResult(file) {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const line = text
    .split(/\r?\n/)
    .reverse()
    .find((entry) => entry.startsWith(resultPrefix));
  if (!line) {
    return null;
  }
  try {
    return JSON.parse(line.slice(resultPrefix.length));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--result-file":
        args.resultFile = argv[++index];
        break;
      case "--diagnostic-dir":
        args.diagnosticDir = argv[++index];
        break;
      case "--console-log":
        args.consoleLog = argv[++index];
        break;
      case "--app-id":
        args.appId = argv[++index];
        break;
      case "--quiet":
        args.quiet = true;
        break;
      case "--write-artifact":
        args.writeArtifact = true;
        break;
      case "--self-test":
        args.selfTest = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return args;
}

function requiredArg(args, key, flag) {
  const value = args[key];
  if (!value) {
    throw new Error(`Missing ${flag}`);
  }
  return value;
}

function defaultSteamConsoleLog() {
  return path.join(os.homedir(), "Library", "Application Support", "Steam", "logs", "console_log.txt");
}

function format(value) {
  return value == null ? "unknown" : JSON.stringify(value);
}

function runSelfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-ipc-detector-"));
  try {
    const resultFile = path.join(tempRoot, "result.log");
    const consoleLog = path.join(tempRoot, "console_log.txt");
    const diagnosticDir = path.join(tempRoot, "diagnostics");

    writeResult(resultFile, {
      snapshot: {
        process: { pid: 4242 },
        steam: { overlayEnabled: { value: false } },
        overlayProcesses: { gameoverlayui: [] }
      }
    });
    fs.writeFileSync(
      consoleLog,
      [
        "[2026-06-30 18:07:56] Game process added : AppID 480 \"\", ProcID 4242, IP 0.0.0.0:0",
        "[2026-06-30 18:07:56] Failed to create PosixMutex: SteamGameStream_4242_mutex - /MTX/5a1c8ccf",
        "[2026-06-30 18:07:57] GameOverlay: started '/Steam/gameoverlayui' (pid 5001) for game process 4242"
      ].join("\n")
    );
    let result = detectSteamOverlayIpcFailure({ resultFile, consoleLog, appId: "480" });
    assert(result.detected, "detects per-process PosixMutex failures");
    assert(result.message.includes("SteamGameStream_4242_mutex"), "includes matched SteamGameStream line");

    fs.writeFileSync(
      consoleLog,
      [
        "[2026-06-30 18:07:57] GameOverlay: started '/Steam/gameoverlayui' (pid 5001) for game process 4242",
        "[2026-06-30 18:07:58] GameOverlay: started '/Steam/gameoverlayui' (pid 5002) for game process 4242"
      ].join("\n")
    );
    result = detectSteamOverlayIpcFailure({ resultFile, consoleLog, appId: "480" });
    assert(result.detected, "detects repeated overlay launches with no live target");

    writeResult(resultFile, {
      snapshot: {
        process: { pid: 4242 },
        steam: { overlayEnabled: { value: true } },
        overlayProcesses: { gameoverlayui: [{ pid: 5001, targetPid: 4242, gameId: "480" }] }
      }
    });
    result = detectSteamOverlayIpcFailure({ resultFile, consoleLog, appId: "480" });
    assert(!result.detected, "does not flag a live overlay target");

    writeResult(resultFile, {
      snapshot: {
        process: { pid: 4242 },
        steam: { overlayEnabled: { value: false } },
        overlayProcesses: { gameoverlayui: [] }
      }
    });
    fs.writeFileSync(
      consoleLog,
      [
        "[2026-06-30 18:07:56] Game process added : AppID 480 \"\", ProcID 4242, IP 0.0.0.0:0",
        "[2026-06-30 18:07:56] Failed to create BinarySemaphore: SteamOverlayRunning_480.BinSemLock - /BSem/cca47a3f",
        "[2026-06-30 18:07:56]\terrno: 28, bCreator: false"
      ].join("\n")
    );
    result = detectSteamOverlayIpcFailure({ resultFile, consoleLog, appId: "480" });
    assert(result.detected, "detects app overlay semaphore failures");

    const artifactMessage = result.message;
    fs.mkdirSync(diagnosticDir, { recursive: true });
    fs.writeFileSync(path.join(diagnosticDir, "steam-overlay-ipc-diagnostics.txt"), artifactMessage);
    assert(
      fs.readFileSync(path.join(diagnosticDir, "steam-overlay-ipc-diagnostics.txt"), "utf8").includes("Steam overlay IPC"),
      "writes artifact-compatible message"
    );

    console.log("macOS Steam overlay IPC detector self-test passed.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function writeResult(file, payload) {
  fs.writeFileSync(file, `${resultPrefix}${JSON.stringify(payload)}\n`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
