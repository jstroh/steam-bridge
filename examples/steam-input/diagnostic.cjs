"use strict";

const path = require("node:path");
const steamworks = require("steam-bridge");

const appId = Number(process.env.STEAM_APP_ID || 480);
const durationMs = Number(process.env.STEAM_INPUT_DURATION_MS || 10_000);
if (!Number.isSafeInteger(appId) || appId <= 0) throw new Error("STEAM_APP_ID must be a positive integer");
if (!Number.isSafeInteger(durationMs) || durationMs < 100 || durationMs > 600_000) {
  throw new Error("STEAM_INPUT_DURATION_MS must be an integer from 100 through 600000");
}

const definition = steamworks.defineSteamInput({
  actionSets: { gameplay: "Gameplay" },
  actionLayers: { menu: "MenuLayer" },
  digital: { jump: "Jump", pause: "Pause" },
  analog: { move: "Move" }
});
const client = steamworks.init(appId);
const session = client.input.createSession({
  definition,
  controllers: "both",
  manifestPath: process.env.STEAM_INPUT_MANIFEST
    ? path.resolve(process.env.STEAM_INPUT_MANIFEST)
    : null
}).start();
let timer;
let stopped = false;
let actionSetActive = false;

function stop(exitCode = 0) {
  if (stopped) return;
  stopped = true;
  clearInterval(timer);
  session.dispose();
  steamworks.shutdown();
  process.exitCode = exitCode;
}

session.on("diagnostic", ({ code, message }) => console.warn(`${code}: ${message}`));
session.on("controller-connected", ({ controller }) => {
  if (controller) console.log(`connected: type=${controller.inputType} slot=${controller.gamepadIndex}`);
});
session.on("controller-disconnected", ({ releasedController }) => {
  console.log(`disconnected: releasedHeldActions=${
    releasedController ? Object.values(releasedController.digital).filter((value) => value.releasedThisFrame).length : 0
  }`);
});

timer = setInterval(() => {
  try {
    const frame = session.update();
    if (!actionSetActive && session.getDiagnostics().resolvedActionSetCount > 0) {
      session.activateActionSet("gameplay");
      actionSetActive = true;
    }
    const controller = frame.primaryController;
    if (controller?.digital.jump.pressedThisFrame) console.log("jump pressed");
    if (controller?.digital.pause.pressedThisFrame) console.log("pause pressed");
  } catch (error) {
    console.error(error);
    stop(1);
  }
}, 16);
timer.unref?.();
setTimeout(() => {
  const diagnostics = session.getDiagnostics();
  console.log(JSON.stringify({
    ...diagnostics,
    primaryControllerHandle: diagnostics.primaryControllerHandle == null ? null : "present",
    lastSequence: diagnostics.lastSequence.toString()
  }, null, 2));
  stop(0);
}, durationMs);
process.once("SIGINT", () => stop(130));
process.once("SIGTERM", () => stop(143));
