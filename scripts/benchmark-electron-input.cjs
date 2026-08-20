"use strict";

const { app, BrowserWindow } = require("electron");
const path = require("node:path");

const ITERATIONS = 20_000;
const MAX_AVERAGE_READ_MS = 0.20;

async function main() {
  await app.whenReady();
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "..", "tests", "fixtures", "electron-input-benchmark-preload.cjs")
    }
  });
  try {
    await window.loadURL("data:text/html,<meta charset=utf-8><title>Steam Bridge input benchmark</title>");
    const result = await window.webContents.executeJavaScript(`(() => {
      const api = window.steamBridgeInput;
      if (!api || typeof api.readGamepads !== "function") throw new Error("input preload unavailable");
      for (let index = 0; index < 1000; index += 1) api.readGamepads();
      const started = performance.now();
      let snapshot;
      for (let index = 0; index < ${ITERATIONS}; index += 1) snapshot = api.readGamepads();
      const elapsedMs = performance.now() - started;
      return {
        iterations: ${ITERATIONS},
        elapsedMs,
        averageReadMs: elapsedMs / ${ITERATIONS},
        gamepadCount: snapshot.gamepads.length,
        primaryGamepadIndex: snapshot.primaryGamepadIndex,
        leftStick: snapshot.gamepads[0].controls.leftStick
      };
    })()`);
    console.log(JSON.stringify(result));
    if (
      result.gamepadCount !== 1 || result.primaryGamepadIndex !== 0 ||
      result.leftStick?.x !== 0.25 || result.leftStick?.y !== -0.75
    ) throw new Error("Electron benchmark received an invalid semantic controller snapshot");
    if (result.averageReadMs > MAX_AVERAGE_READ_MS) {
      throw new Error(
        `Electron readGamepads averaged ${result.averageReadMs.toFixed(4)} ms; ` +
        `limit is ${MAX_AVERAGE_READ_MS.toFixed(2)} ms`
      );
    }
  } finally {
    if (!window.isDestroyed()) window.destroy();
    app.quit();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  app.exit(1);
});
