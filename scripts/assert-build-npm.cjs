const { execFileSync } = require("node:child_process");
const { packageManager } = require("../package.json");

const expected = /^npm@([0-9]+\.[0-9]+\.[0-9]+)$/.exec(packageManager)?.[1];
const cli = process.env.npm_execpath;
if (!expected || !cli) {
  throw new Error("Run npm run check:build-npm using the repository's pinned package manager.");
}
const actual = execFileSync(process.execPath, [cli, "--version"], {
  encoding: "utf8", timeout: 10000
}).trim();
if (actual !== expected) {
  throw new Error(`Build npm ${expected} is required; received ${actual}. The older resolver can select incompatible dependency majors.`);
}
console.log(`Build npm ${actual} confirmed.`);
