#!/usr/bin/env node

const supportedTarget = "aarch64-apple-darwin";

if (process.platform !== "darwin" || process.arch !== "arm64") {
  throw new Error(
    `Steam Bridge CI and native builds require Apple Silicon macOS; got ${process.platform}/${process.arch}.`
  );
}

if (process.env.STEAM_BRIDGE_TARGET && process.env.STEAM_BRIDGE_TARGET !== supportedTarget) {
  throw new Error(
    `Steam Bridge only supports ${supportedTarget}; got ${process.env.STEAM_BRIDGE_TARGET}.`
  );
}

console.log(`Apple Silicon macOS target confirmed (${supportedTarget}).`);
