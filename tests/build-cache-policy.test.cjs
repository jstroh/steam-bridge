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
  assert.equal(metadata.version, "4.3.0-steam-bridge.2");
  assert.equal(createHash("sha256").update(fs.readFileSync(policyPath)).digest("hex"),
    "07116662fec83d8b195aec37b7893c8b2234b60cb60830420fe0689b718026d0");
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

const extensionCases = [
  { id: "shared cookie", cc: "max-age=600", headers: { "set-cookie": "synthetic=fixture" }, shared: true, reuse: false },
  { id: "shared proxy-revalidate", cc: "max-age=600, proxy-revalidate", shared: true, reuse: false },
  { id: "response no-cache shared", cc: "no-cache", shared: true, reuse: false },
  { id: "response no-cache private", cc: "no-cache", shared: false, reuse: false },
  { id: "response no-store", cc: "no-store, max-age=600", shared: true, reuse: false },
  { id: "request no-store", cc: "public, max-age=0", requestCc: "no-store", shared: true, reuse: false },
  { id: "shared private response", cc: "private, max-age=600", shared: true, reuse: false },
  { id: "must-revalidate", cc: "max-age=0, must-revalidate", shared: true, reuse: false },
  { id: "shared stale s-maxage", cc: "public, s-maxage=1, max-age=600", shared: true, reuse: false },
  { id: "shared fresh s-maxage", cc: "public, s-maxage=600", shared: true, reuse: true },
  { id: "public stale", cc: "public, max-age=0", shared: true, reuse: true },
  { id: "private cookie", cc: "max-age=0", headers: { "set-cookie": "synthetic=fixture" }, shared: false, reuse: true },
  { id: "explicit public cookie", cc: "public, max-age=0", headers: { "set-cookie": "synthetic=fixture" }, shared: true, reuse: true },
  { id: "explicit immutable cookie", cc: "immutable, max-age=0", headers: { "set-cookie": "synthetic=fixture" }, shared: true, reuse: true },
  { id: "private proxy-revalidate", cc: "max-age=0, proxy-revalidate", shared: false, reuse: true },
  { id: "private cache private response", cc: "private, max-age=0", shared: false, reuse: true },
  { id: "private s-maxage", cc: "max-age=0, s-maxage=1", shared: false, reuse: true },
  { id: "expired extension windows", cc: "public, max-age=0", window: 1, shared: true, reuse: false },
];
for (const item of extensionCases) test(`cache extensions: ${item.id}`, () => {
  const first = { ...request, headers: { ...request.headers, "cache-control": item.requestCc || "" } };
  const extension = item.window ?? 600;
  const policy = new CachePolicy(first, { status: 200, headers: { age: "10", etag: '"synthetic"',
    ...item.headers, "cache-control": `${item.cc}, stale-if-error=${extension}, stale-while-revalidate=${extension}` } },
  { shared: item.shared });
  for (const candidate of [policy, CachePolicy.fromObject(policy.toObject())]) {
    assert.equal(candidate.useStaleWhileRevalidate(), item.reuse);
    for (const status of [500, 502, 503, 504]) {
      const result = candidate.revalidatedPolicy(first, { status, headers: {} });
      assert.equal(result.modified, !item.reuse);
      assert.equal(result.matches, item.reuse);
      assert.equal(result.policy === candidate, item.reuse);
    }
    if (item.reuse) assert.equal(candidate.revalidatedPolicy(first, undefined).policy, candidate);
    else assert.throws(() => candidate.revalidatedPolicy(first, undefined), /Response headers missing/);
    const changed = candidate.revalidatedPolicy(first, { status: 200, headers: {} });
    assert.equal(changed.modified, true);
    assert.equal(changed.matches, false);
    if (candidate.storable()) {
      const headers = candidate.revalidationHeaders(first);
      assert.equal(headers["if-none-match"], '"synthetic"');
      const validated = candidate.revalidatedPolicy({ ...first, headers }, { status: 304, headers: { etag: '"synthetic"' } });
      assert.equal(validated.modified, false);
      assert.equal(validated.matches, true);
      assert.equal(validated.policy.responseHeaders().etag, '"synthetic"');
    }
  }
});

const failedRequestCases = [
  { id: "request no-cache", headers: { "cache-control": "no-cache" } },
  { id: "request pragma no-cache", headers: { pragma: "no-cache" } },
  { id: "different URL", url: "https://cache.example.test/other" },
  { id: "different host", headers: { host: "other.example.test" } },
  { id: "different method", method: "POST" },
  { id: "Vary mismatch", headers: { accept: "different" } },
];
for (const item of failedRequestCases) test(`failed validation cannot bypass ${item.id}`, () => {
  const policy = new CachePolicy(request, { status: 200, headers: { age: "10", vary: "accept",
    "cache-control": "public, max-age=0, stale-if-error=600" } });
  const next = { ...request, ...item, headers: { ...request.headers, ...item.headers } };
  for (const candidate of [policy, CachePolicy.fromObject(policy.toObject())]) {
    const result = candidate.revalidatedPolicy(next, { status: 503, headers: {} });
    assert.equal(result.modified, true);
    assert.equal(result.matches, false);
    assert.notEqual(result.policy, candidate);
    assert.throws(() => candidate.revalidatedPolicy(next, undefined), /Response headers missing/);
  }
});

test("shared stale s-maxage cannot be overridden by request max-stale", () => {
  const policy = new CachePolicy(request, { status: 200, headers: { age: "10",
    "cache-control": "public, max-age=600, s-maxage=1" } });
  for (const candidate of [policy, CachePolicy.fromObject(policy.toObject())]) {
    const result = candidate.evaluateRequest({ ...request, headers: { ...request.headers, "cache-control": "max-stale=600" } });
    assert.equal(result.response, undefined);
    assert.equal(result.revalidation.synchronous, true);
  }
});

test("corrected policy preserves the real get3 downloader contracts", async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "steam-bridge-build-cache-"));
  const payload = Buffer.from("public synthetic downloader contract fixture\n");
  const checksum = createHash("sha256").update(payload).digest("hex");
  const counts = new Map(); const timers = new Set(); let proxyRequests = 0;
  const conditionalRequests = new Set();
  const oldProgress = process.env.ELECTRON_GET_NO_PROGRESS;
  process.env.ELECTRON_GET_NO_PROGRESS = "1";
  const origin = http.createServer((req, res) => {
    counts.set(req.url, (counts.get(req.url) || 0) + 1);
    if (req.url?.startsWith("/cached-")) {
      const cc = req.url === "/cached-public" ? "public, max-age=0" :
        req.url === "/cached-must-revalidate" ? "max-age=0, must-revalidate" :
        req.url === "/cached-s-maxage" ? "public, s-maxage=1, max-age=600" : "no-cache";
      if (counts.get(req.url) === 1) {
        res.writeHead(200, { "cache-control": `${cc}, stale-if-error=600`, age: "10", etag: '"synthetic"' });
        res.end(payload);
      } else if (req.url === "/cached-304") {
        if (req.headers["if-none-match"] === '"synthetic"') conditionalRequests.add(req.url);
        res.writeHead(304, { etag: '"synthetic"' }); res.end();
      } else { res.writeHead(503); res.end("synthetic unavailable"); }
    } else if (req.url === "/slow") {
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
    await t.test("actual cached downloader refuses forbidden error fallback and retains permitted reuse", async () => {
      for (const route of ["/cached-no-cache", "/cached-must-revalidate", "/cached-s-maxage", "/cached-public", "/cached-304"]) {
        const cache = new Map(); const downloader = new api.GotDownloader();
        const options = { quiet: true, cache, retry: { limit: 0 } };
        const target = path.join(root, route.slice(1) + ".bin");
        await downloader.download(originUrl + route, target, options);
        assert.deepEqual(await fsp.readFile(target), payload);
        assert.ok(cache.size > 0);
        if (route === "/cached-public" || route === "/cached-304") {
          await downloader.download(originUrl + route, target, options);
          assert.deepEqual(await fsp.readFile(target), payload);
        } else {
          await assert.rejects(downloader.download(originUrl + route, target, options),
            error => error.name === "HTTPError" && error.response.statusCode === 503);
        }
        assert.equal(counts.get(route), 2);
      }
      assert.equal(conditionalRequests.has("/cached-304"), true);
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
