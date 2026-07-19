const { spawnSync } = require("node:child_process");

const target = currentTarget();
run("cargo", ["check", "-p", "steam-bridge-native", "--target", target]);

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
    `Unsupported Steam Bridge check host ${process.platform}/${process.arch}. ` +
      "Supported hosts: macOS arm64, Windows x64, Linux x64."
  );
}

function run(command, args) {
  const result = spawnSync(command, args, {
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
