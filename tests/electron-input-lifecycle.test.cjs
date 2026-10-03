const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { createElectronSteamInputService } = require("../packages/steam-bridge/dist/electron.js");
const { configureSteamElectron } = require("../packages/steam-bridge/dist/electron-app.js");

function fixture(serviceOptions = {}, managed = false) {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const ipcListeners = new Map();
  const mainListeners = new Map();
  const queue = [];
  const requests = [];
  const bootstraps = [];
  let focused = true;
  let visibility = "visible";
  let held = false;
  let active = true;
  let epoch = "1";
  let sequence = 0n;
  let bridge;
  const add = map => (name, listener) => { const list = map.get(name) ?? []; list.push(listener); map.set(name, list); };
  const dispatch = (map, name) => { for (const callback of map.get(name) ?? []) callback({}); };
  const port = { start() {}, close() {}, postMessage(message) { mainListeners.get("message")({ data: message }); } };
  const mainPort = { start() {}, close() {}, on(name, listener) { mainListeners.set(name, listener); },
    off(name) { mainListeners.delete(name); }, postMessage(message) { queue.push(message); } };
  const ipcMain = { on(name, listener) { ipcListeners.set(`main:${name}`, listener); }, off(name) { ipcListeners.delete(`main:${name}`); } };
  const contents = { isDestroyed: () => false, on() {}, off() {},
    postMessage(_name, bootstrap) { bootstraps.push(bootstrap); ipcListeners.get("steam-bridge:steam-input")({ ports: [port] }, bootstrap); },
    send(name, ...args) { ipcListeners.get(name)?.({}, ...args); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../packages/steam-bridge/templates/electron-input-preload.cjs"), "utf8"), {
    process: { isMainFrame: true }, performance: { now: () => 100 },
    window: { addEventListener: add(windowListeners) },
    document: { get visibilityState() { return visibility; }, hasFocus: () => focused, addEventListener: add(documentListeners) },
    navigator: { getGamepads: () => [] },
    require(name) {
      assert.equal(name, "electron");
      return { contextBridge: { exposeInMainWorld(name, value) { if (name === "steamBridge") bridge = value; } },
        ipcRenderer: { on(name, listener) { ipcListeners.set(name, listener); },
          send(name, requestId) { requests.push(requestId); ipcListeners.get(`main:${name}`)({ sender: contents }, requestId); } } };
    },
  });
  const inputSession = { update() {
    return { sequence: ++sequence, inputEpoch: epoch, controllers: [{ handle: 42n, digital: { south: { active: true, isDown: held } } }],
      primaryController: null, mergedController: null };
  } };
  const options = { isActive: () => active, createMessageChannel: () => ({ port1: {}, port2: mainPort }), ...serviceOptions };
  let service;
  if (managed) {
    const integration = configureSteamElectron({ presentation: { profile: "off" } });
    const connection = integration.connectActionInput(inputSession, ipcMain, contents, options);
    service = { attach: connection.reconnect, update: connection.read, close() { connection.close(); integration.close(); } };
  } else service = createElectronSteamInputService(inputSession, ipcMain, contents, options);
  service.attach();
  return { read: () => bridge.input.gamepads.read(), requests, queue, service, bootstraps,
    deliver() { port.onmessage({ data: queue.shift() }); },
    blur() { focused = false; dispatch(windowListeners, "blur"); },
    focus() { focused = true; dispatch(windowListeners, "focus"); },
    hide() { visibility = "hidden"; dispatch(documentListeners, "visibilitychange"); },
    held() { held = true; },
    inactive() { active = false; },
    producerContext(value) { epoch = value; },
    context(value) { epoch = value; ipcListeners.get("steam-bridge:input-context")({}, { epoch, active: true }); },
    complete(requestId) { ipcListeners.get("steam-bridge:steam-input-complete")({}, false, requestId); } };
}

test("one delayed pre-blur frame cannot populate the cache or retire a newer request", () => {
  const f = fixture({ requestCorrelation: true });
  try {
    f.read(); f.deliver();
    assert.equal(f.read().steamActions.sequence, "1");
    const oldRequest = f.requests.at(-1);
    f.blur(); f.held(); f.focus();
    assert.equal(f.read().steamActions, null);
    const currentRequest = f.requests.at(-1);
    assert.notEqual(currentRequest, oldRequest);
    f.deliver();
    assert.equal(f.read().steamActions, null);
    assert.equal(f.requests.at(-1), currentRequest);
    f.complete(oldRequest); f.read();
    assert.equal(f.requests.at(-1), currentRequest);
    f.deliver();
    assert.equal(f.read().steamActions.controllers[0].digital.south.isDown, true);
  } finally { f.service.close(); }
});

test("producer input-context epochs reject in-flight samples across native focus or ownership changes", () => {
  const f = fixture({ requestCorrelation: true });
  try {
    f.context("1"); f.read();
    f.context("2"); f.read();
    f.deliver();
    assert.equal(f.read().steamActions, null);
    f.deliver();
    assert.equal(f.read().steamActions.inputEpoch, "2");
    f.hide();
    assert.equal(f.read().steamActions, null);
  } finally { f.service.close(); }
});

test("a matched inactive poll releases cached held actions without a consumer-specific context channel", () => {
  const f = fixture({ requestCorrelation: true });
  try {
    f.held(); f.read(); f.deliver();
    assert.equal(f.read().steamActions.controllers[0].digital.south.isDown, true);
    f.deliver();
    f.inactive();
    assert.equal(f.read().steamActions, null);
  } finally { f.service.close(); }
});

test("a matched new-epoch frame clears held cache before delayed context IPC arrives", () => {
  const f = fixture({ requestCorrelation: true });
  try {
    f.context("1"); f.held(); f.read(); f.deliver();
    assert.equal(f.read().steamActions.controllers[0].digital.south.isDown, true);
    f.deliver();
    f.producerContext("2"); f.read(); f.deliver();
    assert.equal(f.read().steamActions, null);
    const priorRequest = f.requests.at(-1);
    f.context("2"); f.read();
    const currentRequest = f.requests.at(-1);
    assert.notEqual(currentRequest, priorRequest);
    f.deliver();
    assert.equal(f.read().steamActions, null);
    assert.equal(f.requests.at(-1), currentRequest);
    f.deliver();
    assert.equal(f.read().steamActions.inputEpoch, "2");
  } finally { f.service.close(); }
});

for (const [name, options] of [["default", {}], ["explicit false", { requestCorrelation: false }]]) {
  test(`advanced ${name} mode preserves manual-scheduler frames in the actual input preload`, () => {
    const f = fixture(options);
    try {
      assert.equal(f.bootstraps.at(-1).requestCorrelationVersion, undefined);
      const frame = f.service.update();
      f.deliver();
      assert.equal(f.read().steamActions.sequence, String(frame.sequence));
      assert.equal(f.requests.at(-1), undefined);
    } finally { f.service.close(); }
  });
}

test("managed action input enables strict request correlation by default", () => {
  const f = fixture({}, true);
  try {
    assert.equal(f.bootstraps.at(-1).requestCorrelationVersion, 1);
    f.read(); f.deliver();
    assert.equal(f.read().steamActions.sequence, "1");
    const oldRequest = f.requests.at(-1);
    f.blur(); f.held(); f.focus();
    assert.equal(f.read().steamActions, null);
    assert.notEqual(f.requests.at(-1), oldRequest);
    f.deliver();
    assert.equal(f.read().steamActions, null);
    f.deliver();
    assert.equal(f.read().steamActions.controllers[0].digital.south.isDown, true);
  } finally { f.service.close(); }
});

test("managed explicit false honors compatibility-mode manual scheduling", () => {
  const f = fixture({ requestCorrelation: false }, true);
  try {
    assert.equal(f.bootstraps.at(-1).requestCorrelationVersion, undefined);
    const frame = f.service.update();
    f.deliver();
    assert.equal(f.read().steamActions.sequence, String(frame.sequence));
  } finally { f.service.close(); }
});
