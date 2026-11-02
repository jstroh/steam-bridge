const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const test = require("node:test");
const provenance = require("../vendor/glob-hardening-provenance.json");

test("build-tool pins retain exact archives, enforce the resolver and leave runtime support unchanged", () => {
  const root = require("../package.json");
  const lock = require("../package-lock.json");
  assert.equal(root.packageManager, "npm@11.17.0");
  assert.equal(root.engines.npm, ">=11.17.0 <12");
  assert.equal(require("../packages/steam-bridge/package.json").engines.node, ">=18");
  let foundation;
  for (const pin of provenance.packages) {
    const name = `steam-bridge-build-${pin.directory}`;
    const url = root.devDependencies[name];
    const match = /^https:\/\/raw\.githubusercontent\.com\/jstroh\/steam-bridge\/([a-f0-9]{40})\/(vendor\/archives\/[^/]+\.tgz)$/.exec(url);
    assert.ok(match, url);
    foundation ??= match[1];
    assert.equal(match[1], foundation);
    assert.equal(match[2], pin.archive.path);
    const records = Object.values(lock.packages).filter(entry => entry.name === name || entry.resolved === url);
    assert.ok(records.length > 0, name);
    for (const record of records) {
      assert.equal(record.dev, true);
      assert.equal(record.resolved, url);
      assert.equal(record.integrity, pin.archive.integrity);
    }
  }
  for (const file of ["ci.yml", "release.yml"]) {
    const workflow = fs.readFileSync(path.join(__dirname, "../.github/workflows", file), "utf8");
    assert.equal((workflow.match(/npm install --global npm@11\.17\.0 --ignore-scripts/g) || []).length, file === "ci.yml" ? 3 : 2);
    assert.equal((workflow.match(/npm run check:build-npm/g) || []).length, file === "ci.yml" ? 3 : 2);
  }
  const publish = fs.readFileSync(path.join(__dirname, "../.github/workflows/publish.yml"), "utf8");
  assert.ok(publish.indexOf("Verify exact tooling and candidate epochs") < publish.indexOf("npm install --global npm@11.17.0 --ignore-scripts"));
  assert.ok(publish.indexOf("npm run check:build-npm") < publish.indexOf("npm ci --ignore-scripts"));
  const rootTemp = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-build-npm-"));
  try {
    const cli = path.join(rootTemp, "version.cjs");
    for (const version of ["10.9.9", "11.17.0", "12.2.1"]) {
      fs.writeFileSync(cli, `process.stdout.write(${JSON.stringify(version)});`);
      const result = spawnSync(process.execPath, [path.join(__dirname, "../scripts/assert-build-npm.cjs")], {
        encoding: "utf8", env: { ...process.env, npm_execpath: cli }, timeout: 10000
      });
      assert.equal(result.status === 0, version === "11.17.0");
      if (version !== "11.17.0") assert.match(result.stderr, /Build npm 11\.17\.0 is required/);
    }
  } finally {
    fs.rmSync(rootTemp, { recursive: true });
  }
});

const asar4Require = Module.createRequire(require.resolve("@electron/asar"));
const builderRequire = Module.createRequire(require.resolve("app-builder-lib"));
const asar3Require = Module.createRequire(builderRequire.resolve("@electron/asar"));
const universalRequire = Module.createRequire(builderRequire.resolve("@electron/universal"));
const filelistRequire = Module.createRequire(require.resolve("filelist"));
const requirements = [
  [asar4Require, "glob", "glob13", "13.0.6-steam-bridge.1"],
  [asar4Require, "minimatch", "minimatch10", "10.2.6-steam-bridge.1"],
  [builderRequire, "minimatch", "minimatch10", "10.2.6-steam-bridge.1"],
  [universalRequire, "minimatch", "minimatch9", "9.0.9-steam-bridge.1"],
  [asar3Require, "minimatch", "minimatch3", "3.1.5-steam-bridge.1"],
  [Module.createRequire(asar3Require.resolve("glob")), "minimatch", "minimatch3", "3.1.5-steam-bridge.1"],
  [Module.createRequire(require.resolve("dir-compare")), "minimatch", "minimatch3", "3.1.5-steam-bridge.1"],
  [filelistRequire, "minimatch", "minimatch5", "5.1.9-steam-bridge.1"]
];

test("actual build callers load the reviewed matching-major derivatives", () => {
  for (const [caller, dependency, directory, version] of requirements) {
    const metadata = caller(`${dependency}/package.json`);
    assert.equal(metadata.name, `steam-bridge-build-${directory}`);
    assert.equal(metadata.version, version);
    const installed = path.dirname(caller.resolve(`${dependency}/package.json`));
    const source = path.join(__dirname, "../vendor", directory);
    for (const entry of walkFiles(source)) {
      assert.deepEqual(fs.readFileSync(path.join(installed, entry)), fs.readFileSync(path.join(source, entry)), `${directory}/${entry}`);
    }
  }
  assert.equal(asar3Require("glob/package.json").version, "7.2.3");
  assert.equal(builderRequire("app-builder-lib/package.json").version, "26.18.1");
});

function walkFiles(root, relative = "") {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const name = path.join(relative, entry.name);
    if (entry.name === "node_modules") return [];
    return entry.isDirectory() ? walkFiles(root, name) : [name];
  });
}

const legacyGuard = /function assertGlobPartsBudget \(patterns\) \{[\s\S]*?\n\}\n\n/;
function withoutRepair(source, modern) {
  if (!modern) return source.replace(/^[ ]*assertGlobPartsBudget\(set\)\r?\n\r?\n/m, "").replace(legacyGuard, "");
  return source.replace("        const { braceExpandMax = 100_000 } = this.options;\n", "")
    .replace("                        p2 === '..' ||\n                        globParts.length >= braceExpandMax)", "                        p2 === '..')")
    .replace("        if (globParts.length > 1000)\n            return globParts;\n", "");
}

function control(caller, modern) {
  const filename = caller.resolve("minimatch");
  const original = new Module(filename, module);
  original.filename = filename;
  original.paths = Module._nodeModulePaths(path.dirname(filename));
  const source = withoutRepair(fs.readFileSync(filename, "utf8").replace(/\r\n/g, "\n"), modern);
  const metadata = caller("minimatch/package.json");
  const pin = provenance.packages.find(entry => metadata.name === `steam-bridge-build-${entry.directory}`);
  const sourcePath = modern ? "lib/commonjs/index.js" : "minimatch.js";
  assert.equal(createHash("sha256").update(source.replace(/[ \t]+$/gm, "").trimEnd()).digest("hex"),
    pin.files.find(entry => entry.path === sourcePath).upstreamNormalizedSha256);
  original._compile(source, filename);
  return original.exports;
}

test("retained dependency archives equal their complete reviewed source inventories", async () => {
  const tar = require("tar");
  for (const pin of provenance.packages) {
    const archivePath = path.join(__dirname, "..", pin.archive.path);
    const bytes = fs.readFileSync(archivePath);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), pin.archive.sha256);
    assert.equal("sha512-" + createHash("sha512").update(bytes).digest("base64"), pin.archive.integrity);
    const contents = new Map();
    const seen = new Set();
    await tar.t({ file: archivePath, onReadEntry(entry) {
      assert.equal(entry.type, "File");
      assert.equal(seen.has(entry.path), false, `duplicate archive entry: ${entry.path}`);
      seen.add(entry.path);
      const chunks = [];
      entry.on("data", chunk => chunks.push(chunk));
      entry.on("end", () => contents.set(entry.path, Buffer.concat(chunks)));
    } });
    assert.deepEqual([...contents.keys()].sort(), pin.files.map(entry => `package/${entry.path}`).sort());
    for (const file of pin.files) {
      const content = contents.get(`package/${file.path}`);
      assert.equal(content.length, file.bytes);
      assert.equal(createHash("sha256").update(content).digest("hex"), file.sha256);
      assert.deepEqual(content, fs.readFileSync(path.join(__dirname, "../vendor", pin.directory, file.path)));
    }
  }
});

for (const [label, caller] of [["3", asar3Require], ["5", filelistRequire]]) {
  test(`legacy minimatch${label} bounds expanded components before splitting or parsing`, () => {
    const api = caller("minimatch");
    const before = control(caller, false);
    const pattern = "{0..2047}/" + "x/".repeat(64);
    assert.equal(new before.Minimatch(pattern).globParts.reduce((sum, parts) => sum + parts.length, 0), 135168);
    let parsed = 0;
    let split = 0;
    const parse = api.Minimatch.prototype.parse;
    const originalSplit = String.prototype.split;
    api.Minimatch.prototype.parse = function (...args) { parsed++; return parse.apply(this, args); };
    String.prototype.split = function (separator, ...args) {
      if (separator instanceof RegExp && separator.source === "\\/+") split++;
      return originalSplit.call(this, separator, ...args);
    };
    try {
      assert.throws(() => new api.Minimatch(pattern), { name: "RangeError", message: "glob pattern exceeds 100000 path components" });
      assert.equal(parsed, 0);
      assert.equal(split, 0);
    } finally {
      api.Minimatch.prototype.parse = parse;
      String.prototype.split = originalSplit;
    }
    assert.equal(new api.Minimatch("{0..1999}/" + "x/".repeat(48)).globParts.reduce((sum, parts) => sum + parts.length, 0), 100000);
    assert.throws(() => new api.Minimatch("{0..2000}/" + "x/".repeat(48)), RangeError);
    assert.equal(new api.Minimatch("{0..1999}///" + "x///".repeat(48)).globParts.reduce((sum, parts) => sum + parts.length, 0), 100000);
    for (const options of [{}, { dot: true }, { nocase: true }, { nobrace: true }, { matchBase: true }, { nonegate: true }]) {
      for (const glob of ["**/*.js", "*.{js,ts}", "!*.txt", "a/**/../b/c", "a//b/**", "[ab]*", "a\\*", "#comment", ""]) {
        for (const file of ["a.js", "x/a.js", ".hidden.js", "b.ts", "a/b/c", "a/b/z", "other.txt", "", "a*"]) {
          assert.equal(api(file, glob, options), before(file, glob, options));
          assert.equal(api.defaults(options)(file, glob), before.defaults(options)(file, glob));
        }
        assert.deepEqual(api.braceExpand(glob, options), before.braceExpand(glob, options));
        assert.equal(String(api.makeRe(glob, options)), String(before.makeRe(glob, options)));
        assert.deepEqual(api.match(["a.js", "b.ts", "a/b/c"], glob, options), before.match(["a.js", "b.ts", "a/b/c"], glob, options));
      }
    }
  });
}

for (const [label, caller] of [["9", universalRequire], ["10", asar4Require]]) {
  test(`minimatch${label} limits optimizer amplification and quadratic deduplication`, async () => {
    const api = caller("minimatch");
    const before = control(caller, true);
    const pattern = Array(8).fill("**/../a/b").join("/");
    assert.equal(new before.Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 32 }).set.length, 256);
    assert.equal(new api.Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 32 }).set.length, 32);
    const small = new api.Minimatch("**/../a/b/**/../c/d", { optimizationLevel: 2 });
    assert.equal(small.set.length, 4);
    assert.equal(small.match("../a/b/../c/d"), true);
    assert.equal(small.match("x/a/b/y/c/d"), true);
    const rows = Array.from({ length: 1001 }, (_, i) => [String(i), "x"]);
    let compared = 0;
    small.partsMatch = () => { compared++; return false; };
    assert.equal(small.secondPhasePreProcess(rows), rows);
    assert.equal(compared, 0);
    const sourceRoot = path.dirname(caller.resolve("minimatch/package.json"));
    const esm = await import(pathToFileURL(path.join(sourceRoot, "lib/esm/index.js")).href);
    assert.equal(new esm.Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 32 }).set.length, 32);
  });
}

test("glob stops new filesystem traversal after cancellation while retaining normal APIs", () => {
  const script = `
    const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), Module = require('node:module');
    const req = Module.createRequire(require.resolve('@electron/asar'));
    const entry = req.resolve('glob');
    const walker = path.join(path.dirname(entry), 'walker.js');
    if (process.argv[1] === 'control') {
      const loader = Module._extensions['.js'];
      Module._extensions['.js'] = (m, name) => {
        if (name !== walker) return loader(m, name);
        let source = fs.readFileSync(name, 'utf8').replace(/(if \\(this\\.signal\\?\\.aborted\\)\\n\\s+)return cb\\(\\);/g, '$1cb();');
        source = source.replace('    onResume(fn) {\\n', '    onResume(fn) {\\n        if (this.signal?.aborted)\\n            return;\\n');
        const pin = require('./vendor/glob-hardening-provenance.json').packages.find(p => p.directory === 'glob13');
        const hash = require('node:crypto').createHash('sha256').update(source.replace(/\\r\\n/g, '\\n').replace(/[ \\t]+$/gm, '').trimEnd()).digest('hex');
        if (hash !== pin.files.find(f => f.path === 'lib/commonjs/walker.js').upstreamNormalizedSha256) throw new Error('Control does not equal pinned upstream');
        m._compile(source, name);
      };
    }
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-glob-cancel-'));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) fs.mkdirSync(path.join(root, String(i), String(j)), {recursive: true});
    const signal = new AbortController(); let after = 0, pending = 0;
    const io = { ...fs, readdir(p, opts, callback) {
      if (signal.signal.aborted) after++;
      pending++;
      fs.readdir(p, opts, (error, entries) => {
        signal.abort(new Error('bounded-test-cancel'));
        callback(error, entries); pending--;
      });
    }};
    (async () => {
      try { await req('glob').glob('**/*', {cwd: root, fs: io, signal: signal.signal}); } catch (e) { if (e.message !== 'bounded-test-cancel') throw e; }
      while (pending) await new Promise(resolve => setImmediate(resolve));
      const sync = req('glob').globSync('**/*', {cwd: root});
      const asyncRows = await req('glob').glob('**/*', {cwd: root});
      if (JSON.stringify(sync.sort()) !== JSON.stringify(asyncRows.sort())) throw new Error('API mismatch');
      fs.rmSync(root, {recursive: true});
      console.log(JSON.stringify({after, normal: sync.length}));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const run = mode => {
    const result = spawnSync(process.execPath, ["-e", script, mode], { cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    return JSON.parse(result.stdout);
  };
  const before = run("control");
  const after = run("patched");
  assert.ok(before.after > 0, JSON.stringify(before));
  assert.equal(after.after, 0);
  assert.equal(after.normal, before.normal);
});

test("all four aborted glob walk entry points complete once without processing", async () => {
  const entry = asar4Require.resolve("glob");
  const { GlobUtil } = require(path.join(path.dirname(entry), "walker.js"));
  for (const name of ["walkCB", "walkCB2", "walkCBSync", "walkCB2Sync"]) {
    const controller = new AbortController();
    const host = new GlobUtil([], {}, { signal: controller.signal });
    controller.abort();
    let completions = 0;
    let processed = 0;
    const processor = { processPatterns() { processed++; throw new Error("processed after abort"); } };
    host.walkCB2 = host.walkCB2Sync = () => { processed++; };
    const args = name.includes("CB2") ? [{}, [], processor, () => completions++] : [{}, [], () => completions++];
    GlobUtil.prototype[name].apply(host, args);
    assert.equal(completions, 1, name);
    assert.equal(processed, 0, name);
  }
  const esm = await import(pathToFileURL(path.join(path.dirname(asar4Require.resolve("glob/package.json")), "lib/esm/index.js")).href);
  assert.deepEqual(esm.globSync("missing-*", { cwd: __dirname }), []);
});

test("real ASAR3/4 packaging callers retain native-file unpacking contracts", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-glob-asar-"));
  try {
    const src = path.join(root, "source");
    fs.mkdirSync(path.join(src, "nested"), { recursive: true });
    fs.writeFileSync(path.join(src, "nested", "fixture.node"), "not an executable");
    fs.writeFileSync(path.join(src, "main.js"), "module.exports = 480;\n");
    const files = new (require("filelist").FileList)(src.replace(/\\/g, "/") + "/**/*", { allowWindowsEscape: false });
    files.exclude(/\.node$/);
    assert.deepEqual(files.toArray().map(file => path.basename(file)), ["main.js", "nested"]);
    const other = path.join(root, "other");
    fs.mkdirSync(path.join(other, "nested"), { recursive: true });
    fs.writeFileSync(path.join(other, "main.js"), "module.exports = 480;\n");
    fs.writeFileSync(path.join(other, "ignored.node"), "different fixture");
    assert.equal(require("dir-compare").compareSync(src, other, { includeFilter: "*.js", compareContent: true }).same, true);
    for (const [name, api] of [["old", builderRequire("@electron/asar")], ["current", require("@electron/asar")]]) {
      const dest = path.join(root, `${name}.asar`);
      await api.createPackageWithOptions(src, dest, { unpack: "**/*.node" });
      assert.equal(fs.readFileSync(dest + ".unpacked/nested/fixture.node", "utf8"), "not an executable");
      assert.ok(api.listPackage(dest).map(entry => entry.replace(/\\/g, "/")).includes("/main.js"));
      assert.equal(api.extractFile(dest, "main.js").toString(), "module.exports = 480;\n");
    }
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});
