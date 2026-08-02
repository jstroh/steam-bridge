#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const tarballArguments = process.argv.slice(2);
assert.equal(tarballArguments.length, 1, "usage: smoke-node-runtime.cjs <steam-bridge.tgz>");
const tarball = path.resolve(tarballArguments[0]);
assert.ok(fs.statSync(tarball).isFile(), `package tarball does not exist: ${tarball}`);

const consumerRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-node-runtime-"));
try {
  fs.writeFileSync(
    path.join(consumerRoot, "package.json"),
    `${JSON.stringify({ name: "steam-bridge-node-runtime-smoke", private: true }, null, 2)}\n`
  );
  runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball]);

  runNode([
    "-e",
    [
      'const assert = require("node:assert/strict");',
      'const steam = require("steam-bridge");',
      'const server = require("steam-bridge/server");',
      'assert.equal(steam.buildSteamWebApiUrl({ interfaceName: "ITest", methodName: "Runtime", version: 1 }), "https://api.steampowered.com/ITest/Runtime/v0001/");',
      'assert.equal(typeof server.createPublisherWebApiClient, "function");',
      'assert.equal(steam.SteamworksEnums.EResult.k_EResultOK, 1);'
    ].join("\n")
  ]);
  runNode([
    "--input-type=module",
    "-e",
    [
      'import assert from "node:assert/strict";',
      'import steam, { buildSteamWebApiUrl, SteamworksEnums } from "steam-bridge";',
      'import { createPublisherWebApiClient } from "steam-bridge/server";',
      'assert.equal(buildSteamWebApiUrl({ interfaceName: "ITest", methodName: "Runtime", version: "v2" }), "https://api.steampowered.com/ITest/Runtime/v0002/");',
      'assert.equal(typeof createPublisherWebApiClient, "function");',
      'assert.equal(SteamworksEnums.EResult.k_EResultOK, 1);',
      'assert.equal(steam.SteamworksEnums, SteamworksEnums);'
    ].join("\n")
  ]);
} finally {
  fs.rmSync(consumerRoot, { recursive: true, force: true });
}

console.log(`steam-bridge packed runtime smoke passed on Node ${process.version}`);

function runNpm(args) {
  const adjacentNpmCli = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js"
  );
  const npmCli = [process.env.npm_execpath, adjacentNpmCli].find(
    (candidate) => typeof candidate === "string" && fs.existsSync(candidate)
  );
  if (npmCli) {
    run(process.execPath, [npmCli, ...args]);
    return;
  }
  if (process.platform === "win32") {
    throw new Error("Could not locate npm-cli.js beside Node or through npm_execpath.");
  }
  run("npm", args);
}

function runNode(args) {
  run(process.execPath, args);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: consumerRoot,
    encoding: "utf8",
    shell: false
  });
  if (result.error) {
    throw result.error;
  }
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed\n${result.stdout || ""}${result.stderr || ""}`
  );
}
