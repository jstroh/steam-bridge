const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const target = currentTarget();

run("cargo", ["build", "-p", "steam-bridge-native", "--release", "--target", target]);
run("npm", ["run", "native:link", "-w", "steam-bridge", "--", "--target", target]);

function currentTarget() {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "aarch64-apple-darwin";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "x86_64-pc-windows-msvc";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "x86_64-unknown-linux-gnu";
  }

  throw new Error(
    `Unsupported Steam Bridge build host ${process.platform}/${process.arch}. ` +
      "Supported hosts: macOS arm64, Windows x64, Linux x64."
  );
}

function run(command, args) {
  const invocation = resolveCommand(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveCommand(command, args) {
  if (process.platform !== "win32" || command !== "npm") {
    return { command, args };
  }

  const npmCli =
    process.env.npm_execpath ||
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (!fs.existsSync(npmCli)) {
    throw new Error(`Could not locate npm CLI at ${npmCli}.`);
  }
  return { command: process.execPath, args: [npmCli, ...args] };
}
