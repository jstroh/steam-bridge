const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const builderRequire = createRequire(require.resolve("app-builder-lib"));
const getPath = builderRequire.resolve("@electron/get");
const api = builderRequire("@electron/get");
const gotRequire = createRequire(createRequire(getPath).resolve("got"));
const policyPath = createRequire(gotRequire.resolve("cacheable-request")).resolve("http-cache-semantics");
const CachePolicy = require(policyPath);
const { HttpProxyAgent } = require("http-proxy-agent");
const request = { url: "https://cache.example.test/fixture", method: "GET", headers: { host: "cache.example.test" } };

test("the actual builder downloader loads the explicitly versioned corrected policy", () => {
  const metadata = JSON.parse(fs.readFileSync(path.join(path.dirname(policyPath), "package.json"), "utf8"));
  assert.equal(metadata.name, "http-cache-semantics");
  assert.equal(metadata.version, "4.3.0-steam-bridge.1");
  assert.equal(createHash("sha256").update(fs.readFileSync(policyPath)).digest("hex"),
    "f42f7737958de7759c6676b62677ca444dbd9fa97e913371a65edd9ef3e1b15c");
});

const cases = [
  { id: "shared cookie", headers: { "cache-control": "max-age=600", "set-cookie": "synthetic=fixture" }, shared: true, reuse: false },
  { id: "shared proxy-revalidate", headers: { "cache-control": "max-age=600, proxy-revalidate" }, shared: true, reuse: false },
  { id: "response no-cache shared", headers: { "cache-control": "no-cache" }, shared: true, reuse: false },
  { id: "response no-cache private", headers: { "cache-control": "no-cache" }, shared: false, reuse: false },
  { id: "response no-cache with stale-while-revalidate", headers: { "cache-control": "no-cache, stale-while-revalidate=600" }, shared: true, reuse: false },
  { id: "shared private response", headers: { "cache-control": "private, max-age=600" }, shared: true, reuse: false },
  { id: "response no-store", headers: { "cache-control": "no-store, max-age=600" }, shared: true, reuse: false },
  { id: "must-revalidate", headers: { "cache-control": "max-age=0, must-revalidate" }, shared: true, reuse: false },
  { id: "public stale", headers: { "cache-control": "public, max-age=0" }, shared: true, reuse: true },
  { id: "public fresh", headers: { "cache-control": "public, max-age=600" }, shared: true, reuse: true },
  { id: "private cookie", headers: { "cache-control": "max-age=600", "set-cookie": "synthetic=fixture" }, shared: false, reuse: true },
  { id: "explicit public cookie", headers: { "cache-control": "public, max-age=600", "set-cookie": "synthetic=fixture" }, shared: true, reuse: true },
  { id: "explicit immutable cookie", headers: { "cache-control": "immutable, max-age=600", "set-cookie": "synthetic=fixture" }, shared: true, reuse: true },
  { id: "private proxy-revalidate", headers: { "cache-control": "max-age=600, proxy-revalidate" }, shared: false, reuse: true },
  { id: "request no-cache", headers: { "cache-control": "public, max-age=600" }, shared: true, requestCc: "no-cache", reuse: false },
  { id: "Vary mismatch", headers: { "cache-control": "public, max-age=600", vary: "accept" }, shared: true, newHeaders: { accept: "different" }, reuse: false },
  { id: "private cache private response", headers: { "cache-control": "private, max-age=600" }, shared: false, reuse: true },
  { id: "different URL", headers: { "cache-control": "public, max-age=600" }, shared: true, newUrl: "https://cache.example.test/other", reuse: false },
];
for (const item of cases) test(`cache policy: ${item.id}`, () => {
  const policy = new CachePolicy(request, { status: 200, headers: { age: "10", ...item.headers } }, { shared: item.shared });
  const next = { ...request, url: item.newUrl || request.url,
    headers: { ...request.headers, ...item.newHeaders, "cache-control": item.requestCc || "max-stale=999999" } };
  for (const candidate of [policy, CachePolicy.fromObject(policy.toObject())]) {
    assert.equal(candidate.satisfiesWithoutRevalidation(next), item.reuse);
    const result = candidate.evaluateRequest(next);
    if (!item.reuse) {
      assert.equal(result.response, undefined);
      assert.equal(result.revalidation.synchronous, true);
    }
  }
});

test("corrected policy preserves the real get3 downloader contracts", async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "steam-bridge-build-cache-"));
  const payload = Buffer.from("public synthetic downloader contract fixture\n");
  const checksum = createHash("sha256").update(payload).digest("hex");
  const counts = new Map(); const timers = new Set(); let proxyRequests = 0;
  const oldProgress = process.env.ELECTRON_GET_NO_PROGRESS;
  process.env.ELECTRON_GET_NO_PROGRESS = "1";
  const origin = http.createServer((req, res) => {
    counts.set(req.url, (counts.get(req.url) || 0) + 1);
    if (req.url === "/slow") {
      const timer = setTimeout(() => { timers.delete(timer); res.end(payload); }, 180); timers.add(timer);
    } else if (req.url === "/503") { res.writeHead(503); res.end("synthetic unavailable"); }
    else res.end(payload);
  });
  const proxy = http.createServer((_req, res) => { proxyRequests++; res.end("synthetic proxy bytes"); });
  const listen = async server => {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    return `http://127.0.0.1:${server.address().port}`;
  };
  let proxyAgent;
  try {
    const originUrl = await listen(origin); const proxyUrl = await listen(proxy);
    proxyAgent = new HttpProxyAgent(proxyUrl);
    const artifact = route => ({ version: "9.9.9", artifactName: "payload.bin", isGeneric: true,
      cacheRoot: path.join(root, route.slice(1)), tempDirectory: root,
      mirrorOptions: { resolveAssetURL: async () => originUrl + route }, checksums: { "payload.bin": checksum },
      downloadOptions: { quiet: true, retry: { limit: 0 } } });
    await t.test("request timeout retains ETIMEDOUT", async () => {
      await assert.rejects(new api.GotDownloader().download(originUrl + "/slow", path.join(root, "timeout.bin"),
        { quiet: true, timeout: { request: 30 }, retry: { limit: 0 } }), error => error.code === "ETIMEDOUT");
    });
    await t.test("explicit proxy retains proxy routing", async () => {
      const target = path.join(root, "proxy.bin");
      await new api.GotDownloader().download(originUrl + "/proxy", target,
        { quiet: true, agent: { http: proxyAgent }, retry: { limit: 0 } });
      assert.equal(proxyRequests, 1); assert.equal(counts.has("/proxy"), false);
      assert.equal(await fsp.readFile(target, "utf8"), "synthetic proxy bytes");
    });
    await t.test("HTTP503 retains builder retry classification", async () => {
      await assert.rejects(new api.GotDownloader().download(originUrl + "/503", path.join(root, "503.bin"),
        { quiet: true, retry: { limit: 0 } }), error => error.name === "HTTPError" && error.response.statusCode === 503);
    });
    await t.test("mirror, artifact caches and bad checksums retain their contracts", async () => {
      const config = artifact("/artifact");
      for (let i = 0; i < 2; i++) assert.deepEqual(await fsp.readFile(await api.downloadArtifact(config)), payload);
      assert.equal(counts.get("/artifact"), 1);
      await api.downloadArtifact({ ...config, cacheMode: api.ElectronDownloadCacheMode.ReadOnly });
      assert.equal(counts.get("/artifact"), 1);
      await api.downloadArtifact({ ...config, cacheMode: api.ElectronDownloadCacheMode.WriteOnly });
      assert.equal(counts.get("/artifact"), 2);
      await assert.rejects(api.downloadArtifact({ ...config, cacheMode: api.ElectronDownloadCacheMode.Bypass,
        checksums: { "payload.bin": "0".repeat(64) } }));
      assert.equal(counts.get("/artifact"), 3);
      const readOnly = { ...artifact("/readonly-miss"), cacheMode: api.ElectronDownloadCacheMode.ReadOnly };
      await api.downloadArtifact(readOnly); await api.downloadArtifact(readOnly);
      assert.equal(counts.get("/readonly-miss"), 2);
    });
  } finally {
    for (const timer of timers) clearTimeout(timer);
    proxyAgent?.destroy(); origin.closeAllConnections(); proxy.closeAllConnections();
    await Promise.all([origin, proxy].map(server => new Promise(resolve => server.close(resolve))));
    if (oldProgress === undefined) delete process.env.ELECTRON_GET_NO_PROGRESS;
    else process.env.ELECTRON_GET_NO_PROGRESS = oldProgress;
    const realRoot = await fsp.realpath(root); const realTemp = await fsp.realpath(os.tmpdir());
    assert.equal(path.dirname(realRoot), realTemp); assert.ok(path.basename(realRoot).startsWith("steam-bridge-build-cache-"));
    await fsp.rm(realRoot, { recursive: true, force: true });
  }
});
