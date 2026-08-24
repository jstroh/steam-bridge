"use strict";

// This file is intentionally standalone. Sandboxed Electron preloads can only
// require Electron and a small built-in allow-list; they cannot import the
// package's compiled CommonJS modules.
const { contextBridge, ipcRenderer } = require("electron");

if (process.isMainFrame !== false) {
  const CONNECT_CHANNEL = "steam-bridge:steam-input";
  const REQUEST_CHANNEL = "steam-bridge:steam-input-request";
  const COMPLETE_CHANNEL = "steam-bridge:steam-input-complete";
  const NATIVE_INPUT_CHANNEL = "steam-bridge:native-input";
  const MAX_EVENTS = 256;
  const GAMEPAD_DISCOVERY_INTERVAL_MS = 1000;
  const EMPTY_GAMEPADS = Object.freeze([]);
  const UNAVAILABLE_BUTTON = Object.freeze({ available: false, pressed: false, touched: false, value: 0 });
  const UNAVAILABLE_STICK = Object.freeze({ available: false, x: 0, y: 0 });
  const keys = new Map();
  const pointers = new Map();
  const events = new Array(MAX_EVENTS);
  let eventHead = 0;
  let eventCount = 0;
  let droppedEventCount = 0;
  let sequence = 0;
  let captureDom = false;
  let domListenersInstalled = false;
  let requestPending = false;
  let steamPort;
  let steamInput = null;
  let wheelX = 0;
  let wheelY = 0;
  let wheelZ = 0;
  let lastActiveSource = null;
  let lastActivityAtMs = null;
  const previousGamepads = new Map();
  const seenGamepadIndexes = new Set();
  let gamepadConnectionDirty = true;
  let nextGamepadDiscoveryAtMs = 0;
  let primaryGamepadIndex = null;
  let nativeAuxiliaryButtons = 0;

  const now = () => performance.now();
  const modifierSnapshot = (event) => ({
    alt: event ? event.altKey === true : keys.has("AltLeft") || keys.has("AltRight"),
    control: event ? event.ctrlKey === true : keys.has("ControlLeft") || keys.has("ControlRight"),
    meta: event ? event.metaKey === true : keys.has("MetaLeft") || keys.has("MetaRight"),
    shift: event ? event.shiftKey === true : keys.has("ShiftLeft") || keys.has("ShiftRight"),
  });
  const recordActivity = (source, capturedAtMs) => {
    lastActiveSource = source;
    lastActivityAtMs = capturedAtMs;
  };
  const pushEvent = (event) => {
    if (event.type === "pointer-move" && eventCount > 0) {
      const lastIndex = (eventHead + eventCount - 1) % MAX_EVENTS;
      const previous = events[lastIndex];
      if (previous && previous.type === "pointer-move" && previous.pointer.id === event.pointer.id) {
        events[lastIndex] = event;
        return;
      }
    }
    if (eventCount < MAX_EVENTS) {
      events[(eventHead + eventCount) % MAX_EVENTS] = event;
      eventCount += 1;
    } else {
      events[eventHead] = event;
      eventHead = (eventHead + 1) % MAX_EVENTS;
      droppedEventCount += 1;
    }
  };
  const consumeEvents = () => {
    const result = new Array(eventCount);
    for (let index = 0; index < eventCount; index += 1) {
      result[index] = events[(eventHead + index) % MAX_EVENTS];
    }
    eventHead = 0;
    eventCount = 0;
    return result;
  };
  const pointerSnapshot = (event) => ({
    id: Number.isSafeInteger(event.pointerId) ? event.pointerId : 0,
    type: event.pointerType === "touch" || event.pointerType === "pen" ? event.pointerType : "mouse",
    primary: event.isPrimary !== false,
    x: Number.isFinite(event.clientX) ? event.clientX : 0,
    y: Number.isFinite(event.clientY) ? event.clientY : 0,
    buttons: Number.isSafeInteger(event.buttons) ? event.buttons : 0,
    pressure: Number.isFinite(event.pressure) ? event.pressure : 0,
    tiltX: Number.isFinite(event.tiltX) ? event.tiltX : 0,
    tiltY: Number.isFinite(event.tiltY) ? event.tiltY : 0,
    twist: Number.isFinite(event.twist) ? event.twist : 0,
  });
  const onPointer = (type, event) => {
    if (!captureDom) return;
    const capturedAtMs = now();
    const pointer = pointerSnapshot(event);
    if (type === "pointer-up" || type === "pointer-cancel") pointers.delete(pointer.id);
    else pointers.set(pointer.id, pointer);
    recordActivity(pointer.type === "mouse" ? "pointer" : pointer.type, capturedAtMs);
    pushEvent({
      type,
      atMs: capturedAtMs,
      pointer,
      button: Number.isSafeInteger(event.button) ? event.button : -1,
      modifiers: modifierSnapshot(event),
    });
  };
  const clearHeldState = () => {
    keys.clear();
    pointers.clear();
    previousGamepads.clear();
    seenGamepadIndexes.clear();
    primaryGamepadIndex = null;
    nativeAuxiliaryButtons = 0;
    gamepadConnectionDirty = true;
    nextGamepadDiscoveryAtMs = 0;
    steamInput = null;
    wheelX = 0;
    wheelY = 0;
    wheelZ = 0;
  };
  const focusEvent = (type) => pushEvent({
    type,
    atMs: now(),
    focus: focusSnapshot(),
  });
  const focusSnapshot = () => {
    const focused = document.hasFocus();
    const visible = document.visibilityState === "visible";
    return { focused, visible, active: focused && visible };
  };

  // Hot-plug discovery is the only controller listener installed eagerly. It
  // lets frame-loop reads skip navigator enumeration while no pad is present.
  window.addEventListener("gamepadconnected", (event) => {
    gamepadConnectionDirty = true;
    if (primaryGamepadIndex === null) primaryGamepadIndex = event.gamepad.index;
    if (!captureDom) return;
    const gamepad = event.gamepad;
    const capturedAtMs = now();
    recordActivity("gamepad", capturedAtMs);
    pushEvent({
      type: "gamepad-connected",
      atMs: capturedAtMs,
      index: gamepad.index,
      id: gamepad.id,
      mapping: gamepad.mapping,
    });
  }, true);
  window.addEventListener("gamepaddisconnected", (event) => {
    const gamepad = event.gamepad;
    previousGamepads.delete(gamepad.index);
    if (primaryGamepadIndex === gamepad.index) primaryGamepadIndex = null;
    gamepadConnectionDirty = true;
    if (captureDom) pushEvent({
      type: "gamepad-disconnected",
      atMs: now(),
      index: gamepad.index,
      id: gamepad.id,
      mapping: gamepad.mapping,
    });
  }, true);

  const installDomCapture = () => {
    if (domListenersInstalled) return;
    domListenersInstalled = true;
  window.addEventListener("keydown", (event) => {
    if (!captureDom) return;
    const capturedAtMs = now();
    keys.set(event.code, { code: event.code, key: event.key, location: event.location });
    recordActivity("keyboard", capturedAtMs);
    pushEvent({
      type: "key-down",
      atMs: capturedAtMs,
      code: event.code,
      key: event.key,
      location: event.location,
      repeat: event.repeat,
      composing: event.isComposing,
      modifiers: modifierSnapshot(event),
    });
  }, true);
  window.addEventListener("keyup", (event) => {
    if (!captureDom) return;
    const capturedAtMs = now();
    keys.delete(event.code);
    recordActivity("keyboard", capturedAtMs);
    pushEvent({
      type: "key-up",
      atMs: capturedAtMs,
      code: event.code,
      key: event.key,
      location: event.location,
      repeat: false,
      composing: event.isComposing,
      modifiers: modifierSnapshot(event),
    });
  }, true);
  window.addEventListener("pointerdown", (event) => onPointer("pointer-down", event), true);
  window.addEventListener("pointerup", (event) => onPointer("pointer-up", event), true);
  window.addEventListener("pointermove", (event) => onPointer("pointer-move", event), true);
  window.addEventListener("pointercancel", (event) => onPointer("pointer-cancel", event), true);
  window.addEventListener("wheel", (event) => {
    if (!captureDom) return;
    const capturedAtMs = now();
    const deltaX = Number.isFinite(event.deltaX) ? event.deltaX : 0;
    const deltaY = Number.isFinite(event.deltaY) ? event.deltaY : 0;
    const deltaZ = Number.isFinite(event.deltaZ) ? event.deltaZ : 0;
    wheelX += deltaX;
    wheelY += deltaY;
    wheelZ += deltaZ;
    recordActivity("pointer", capturedAtMs);
    pushEvent({
      type: "wheel",
      atMs: capturedAtMs,
      x: Number.isFinite(event.clientX) ? event.clientX : 0,
      y: Number.isFinite(event.clientY) ? event.clientY : 0,
      deltaX,
      deltaY,
      deltaZ,
      deltaMode: Number.isSafeInteger(event.deltaMode) ? event.deltaMode : 0,
      modifiers: modifierSnapshot(event),
    });
  }, { capture: true, passive: true });
  window.addEventListener("beforeinput", (event) => {
    if (!captureDom) return;
    const capturedAtMs = now();
    recordActivity("keyboard", capturedAtMs);
    pushEvent({
      type: "text",
      atMs: capturedAtMs,
      inputType: typeof event.inputType === "string" ? event.inputType : "",
      data: typeof event.data === "string" ? event.data : null,
      composing: event.isComposing === true,
    });
  }, true);
  for (const [domType, type] of [
    ["compositionstart", "composition-start"],
    ["compositionupdate", "composition-update"],
    ["compositionend", "composition-end"],
  ]) {
    window.addEventListener(domType, (event) => {
      if (!captureDom) return;
      pushEvent({
        type,
        atMs: now(),
        data: typeof event.data === "string" ? event.data : "",
      });
    }, true);
  }
  window.addEventListener("focus", () => {
    if (captureDom) focusEvent("focus");
  }, true);
  window.addEventListener("blur", () => {
    clearHeldState();
    if (captureDom) focusEvent("blur");
  }, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") clearHeldState();
    if (captureDom) focusEvent("visibility");
  }, true);
  };

  const validSteamFrame = (value) => Boolean(
    value &&
    typeof value === "object" &&
    typeof value.sequence === "string" &&
    /^(0|[1-9]\d*)$/.test(value.sequence) &&
    Array.isArray(value.controllers) &&
    Object.prototype.hasOwnProperty.call(value, "primaryController")
  );
  const hasSteamActionActivity = (controller) => {
    if (!controller || typeof controller !== "object") return false;
    const digital = controller.digital;
    if (digital && typeof digital === "object") {
      for (const name in digital) {
        if (!Object.prototype.hasOwnProperty.call(digital, name)) continue;
        const action = digital[name];
        if (action && action.active === true &&
          (action.isDown === true || action.pressedThisFrame === true || action.releasedThisFrame === true)) {
          return true;
        }
      }
    }
    const analog = controller.analog;
    if (analog && typeof analog === "object") {
      for (const name in analog) {
        if (!Object.prototype.hasOwnProperty.call(analog, name)) continue;
        const action = analog[name];
        if (action && action.active === true &&
          (Math.abs(clampAxis(action.x)) >= 0.20 || Math.abs(clampAxis(action.y)) >= 0.20)) {
          return true;
        }
      }
    }
    return false;
  };
  const closeSteamPort = () => {
    if (!steamPort) return;
    steamPort.onmessage = null;
    try { steamPort.close(); } catch {}
    steamPort = undefined;
    requestPending = false;
    steamInput = null;
  };
  ipcRenderer.on(CONNECT_CHANNEL, (event) => {
    const [nextPort, ...extraPorts] = event.ports || [];
    for (const port of extraPorts) {
      try { port.close(); } catch {}
    }
    if (!nextPort) return;
    closeSteamPort();
    steamPort = nextPort;
    nextPort.onmessage = (messageEvent) => {
      if (steamPort !== nextPort) return;
      const message = messageEvent.data;
      const frame = message && message.type === "frame" && message.version === 1 ? message.frame : null;
      if (!validSteamFrame(frame)) {
        closeSteamPort();
        return;
      }
      steamInput = frame;
      requestPending = false;
      if (hasSteamActionActivity(frame.primaryController)) recordActivity("steam-input", now());
      try {
        nextPort.postMessage({ type: "ack", sequence: frame.sequence });
      } catch {
        if (steamPort === nextPort) closeSteamPort();
      }
    };
    nextPort.start && nextPort.start();
  });
  ipcRenderer.on(COMPLETE_CHANNEL, () => { requestPending = false; });
  ipcRenderer.on(NATIVE_INPUT_CHANNEL, (_event, value) => {
    if (
      !captureDom || !value || value.version !== 1 ||
      (value.type !== "pointer-down" && value.type !== "pointer-up") ||
      (value.button !== 3 && value.button !== 4) ||
      !Number.isFinite(value.x) || !Number.isFinite(value.y)
    ) return;
    const buttonMask = value.button === 3 ? 8 : 16;
    if (value.type === "pointer-down") nativeAuxiliaryButtons |= buttonMask;
    else nativeAuxiliaryButtons &= ~buttonMask;
    const capturedAtMs = now();
    const pointer = {
      id: 1,
      type: "mouse",
      primary: true,
      x: value.x,
      y: value.y,
      buttons: nativeAuxiliaryButtons,
      pressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
    };
    if (value.type === "pointer-up") pointers.delete(pointer.id);
    else pointers.set(pointer.id, pointer);
    recordActivity("pointer", capturedAtMs);
    const names = Array.isArray(value.modifiers) ? value.modifiers : [];
    pushEvent({
      type: value.type,
      atMs: capturedAtMs,
      pointer,
      button: value.button,
      modifiers: {
        alt: names.includes("alt"),
        control: names.includes("control"),
        meta: names.includes("meta"),
        shift: names.includes("shift"),
      },
    });
  });

  const requestSteamFrame = () => {
    if (!steamPort || requestPending || !document.hasFocus() || document.visibilityState !== "visible") return;
    requestPending = true;
    ipcRenderer.send(REQUEST_CHANNEL);
  };
  const clampAxis = (value) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  const clampButton = (value) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const semanticStick = (gamepad, offset) => gamepad.axes.length >= offset + 2 ? {
    available: true,
    x: clampAxis(gamepad.axes[offset]),
    y: clampAxis(gamepad.axes[offset + 1]),
  } : UNAVAILABLE_STICK;
  const semanticControls = (gamepad, buttons) => {
    const button = (index) => buttons[index] || UNAVAILABLE_BUTTON;
    return {
      sticks: { left: semanticStick(gamepad, 0), right: semanticStick(gamepad, 2) },
      buttons: {
      south: button(0), east: button(1), west: button(2), north: button(3),
      leftBumper: button(4), rightBumper: button(5), leftTrigger: button(6), rightTrigger: button(7),
      view: button(8), menu: button(9), leftStick: button(10), rightStick: button(11),
      dpadUp: button(12), dpadDown: button(13), dpadLeft: button(14), dpadRight: button(15),
      home: button(16), touchpad: button(17),
      },
    };
  };
  const gamepadTouches = (gamepad) => Array.from(gamepad.touches || [], (touch) => {
    const dimensions = touch && touch.surfaceDimensions;
    const snapshot = {
      id: Number.isSafeInteger(touch && touch.touchId) ? touch.touchId : 0,
      surface: Number.isSafeInteger(touch && touch.surfaceId) ? touch.surfaceId : 0,
      position: [clampAxis(touch && touch.position && touch.position[0]), clampAxis(touch && touch.position && touch.position[1])],
    };
    return dimensions && dimensions.length >= 2 ? {
      ...snapshot,
      surfaceSize: [
        Number.isFinite(dimensions[0]) ? Math.max(0, dimensions[0]) : 0,
        Number.isFinite(dimensions[1]) ? Math.max(0, dimensions[1]) : 0,
      ],
    } : snapshot;
  });
  const gamepadSnapshot = (gamepad, timestamp) => {
    const buttons = Array.from(gamepad.buttons, (button) => ({
      available: true,
      pressed: button.pressed === true,
      touched: button.touched === true,
      value: clampButton(button.value),
    }));
    const axes = Array.from(gamepad.axes, clampAxis);
    const controls = semanticControls(gamepad, buttons);
    return {
      index: gamepad.index,
      id: gamepad.id,
      mapping: gamepad.mapping,
      connected: true,
      timestamp,
      mappingSource: gamepad.mapping === "standard" ? "standard" : "heuristic",
      sticks: controls.sticks,
      buttons: controls.buttons,
      touches: gamepadTouches(gamepad),
      raw: { axes, buttons },
    };
  };
  const gamepadChanged = (previous, gamepad) => {
    if (!previous || previous.id !== gamepad.id || previous.mapping !== gamepad.mapping) return true;
    if (previous.raw.axes.length !== gamepad.axes.length || previous.raw.buttons.length !== gamepad.buttons.length) return true;
    for (let index = 0; index < gamepad.axes.length; index += 1) {
      const value = clampAxis(gamepad.axes[index]);
      if (previous.raw.axes[index] !== value) return true;
    }
    for (let index = 0; index < gamepad.buttons.length; index += 1) {
      const before = previous.raw.buttons[index];
      const after = gamepad.buttons[index];
      const value = clampButton(after.value);
      if (before.pressed !== (after.pressed === true) || before.touched !== (after.touched === true) || before.value !== value) {
        return true;
      }
    }
    const touches = gamepad.touches || [];
    if (previous.touches.length !== touches.length) return true;
    for (let index = 0; index < touches.length; index += 1) {
      const before = previous.touches[index];
      const after = touches[index];
      if (
        before.id !== (Number.isSafeInteger(after.touchId) ? after.touchId : 0) ||
        before.surface !== (Number.isSafeInteger(after.surfaceId) ? after.surfaceId : 0) ||
        before.position[0] !== clampAxis(after.position && after.position[0]) ||
        before.position[1] !== clampAxis(after.position && after.position[1]) ||
        (before.surfaceSize && before.surfaceSize[0]) !==
          (after.surfaceDimensions && Number.isFinite(after.surfaceDimensions[0]) ? Math.max(0, after.surfaceDimensions[0]) : undefined) ||
        (before.surfaceSize && before.surfaceSize[1]) !==
          (after.surfaceDimensions && Number.isFinite(after.surfaceDimensions[1]) ? Math.max(0, after.surfaceDimensions[1]) : undefined)
      ) return true;
    }
    return false;
  };
  const meaningfulGamepadActivity = (previous, snapshot) => {
    if (!previous) {
      return snapshot.raw.buttons.some((button) => button.pressed || button.value >= 0.5) ||
        snapshot.raw.axes.some((axis) => Math.abs(axis) >= 0.20) || snapshot.touches.length > 0;
    }
    for (let index = 0; index < snapshot.raw.buttons.length; index += 1) {
      const before = previous.raw.buttons[index];
      const after = snapshot.raw.buttons[index];
      if (!before || before.pressed !== after.pressed || Math.abs(before.value - after.value) >= 0.05) return true;
    }
    for (let index = 0; index < snapshot.raw.axes.length; index += 1) {
      const before = previous.raw.axes[index] || 0;
      const after = snapshot.raw.axes[index];
      if (Math.abs(after) >= 0.20 && Math.abs(after - before) >= 0.01) return true;
    }
    if (snapshot.touches.length !== previous.touches.length) return true;
    for (let index = 0; index < snapshot.touches.length; index += 1) {
      const before = previous.touches[index];
      const after = snapshot.touches[index];
      if (
        before.id !== after.id || before.surface !== after.surface ||
        before.position[0] !== after.position[0] || before.position[1] !== after.position[1]
      ) return true;
    }
    return false;
  };
  const captureGamepads = (trackActivity) => {
    const capturedAtMs = now();
    if (
      previousGamepads.size === 0 &&
      !gamepadConnectionDirty &&
      capturedAtMs < nextGamepadDiscoveryAtMs
    ) {
      return EMPTY_GAMEPADS;
    }
    gamepadConnectionDirty = false;
    nextGamepadDiscoveryAtMs = capturedAtMs + GAMEPAD_DISCOVERY_INTERVAL_MS;
    const gamepads = [];
    seenGamepadIndexes.clear();
    const browserGamepads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    for (const gamepad of browserGamepads) {
      if (!gamepad || gamepad.connected !== true) continue;
      const previous = previousGamepads.get(gamepad.index);
      const changed = gamepadChanged(previous, gamepad);
      const timestamp = Number.isFinite(gamepad.timestamp) ? gamepad.timestamp : 0;
      const snapshot = changed
        ? gamepadSnapshot(gamepad, timestamp)
        : previous.timestamp === timestamp ? previous : { ...previous, timestamp };
      if (changed && meaningfulGamepadActivity(previous, snapshot)) {
        primaryGamepadIndex = snapshot.index;
        if (trackActivity) recordActivity("gamepad", capturedAtMs);
      }
      previousGamepads.set(snapshot.index, snapshot);
      seenGamepadIndexes.add(snapshot.index);
      gamepads.push(snapshot);
    }
    for (const index of previousGamepads.keys()) {
      if (!seenGamepadIndexes.has(index)) previousGamepads.delete(index);
    }
    if (primaryGamepadIndex !== null && !seenGamepadIndexes.has(primaryGamepadIndex)) primaryGamepadIndex = null;
    if (primaryGamepadIndex === null && gamepads.length > 0) primaryGamepadIndex = gamepads[0].index;
    return gamepads;
  };
  const primaryGamepad = (gamepads) => {
    if (primaryGamepadIndex === null) return null;
    for (const gamepad of gamepads) {
      if (gamepad.index === primaryGamepadIndex) return gamepad;
    }
    return null;
  };
  const readSnapshot = () => {
    installDomCapture();
    captureDom = true;
    requestSteamFrame();
    const focus = focusSnapshot();
    const gamepads = captureGamepads(true);
    const primary = focus.active ? primaryGamepad(gamepads) : null;
    const snapshot = {
      version: 2,
      sequence: ++sequence,
      timestampMs: now(),
      focus,
      lastInput: lastActiveSource !== null && lastActivityAtMs !== null
        ? { source: lastActiveSource, atMs: lastActivityAtMs }
        : null,
      keyboard: { modifiers: modifierSnapshot(), keys: Array.from(keys.values()) },
      pointers: Array.from(pointers.values()),
      wheel: { x: wheelX, y: wheelY, z: wheelZ },
      gamepads: { connected: gamepads, primary },
      steamActions: focus.active ? steamInput : null,
      events: consumeEvents(),
      droppedEvents: droppedEventCount,
    };
    wheelX = 0;
    wheelY = 0;
    wheelZ = 0;
    droppedEventCount = 0;
    return snapshot;
  };

  const readGamepads = () => {
    requestSteamFrame();
    const gamepads = captureGamepads(false);
    const focus = focusSnapshot();
    return {
      version: 2,
      sequence: ++sequence,
      timestampMs: now(),
      focus,
      connected: gamepads,
      primary: focus.active ? primaryGamepad(gamepads) : null,
      steamActions: focus.active ? steamInput : null,
    };
  };

  // Migration bridge for already-deployed Client-PX bundles. This is not a
  // 0.4 npm API: it preserves the shell/client protocol while pinned and
  // cached game deployments advance independently.
  const legacyButton = (button) => ({
    pressed: button.pressed,
    touched: button.touched,
    value: button.value,
  });
  const legacyGamepad = (gamepad) => {
    const button = (value) => value.available ? legacyButton(value) : null;
    const source = gamepad.mappingSource;
    return {
      index: gamepad.index,
      id: gamepad.id,
      mapping: gamepad.mapping,
      connected: true,
      timestamp: gamepad.timestamp,
      controls: {
        source,
        leftStick: gamepad.sticks.left.available
          ? { x: gamepad.sticks.left.x, y: gamepad.sticks.left.y, source }
          : null,
        rightStick: gamepad.sticks.right.available
          ? { x: gamepad.sticks.right.x, y: gamepad.sticks.right.y, source }
          : null,
        faceSouth: button(gamepad.buttons.south),
        faceEast: button(gamepad.buttons.east),
        faceWest: button(gamepad.buttons.west),
        faceNorth: button(gamepad.buttons.north),
        leftBumper: button(gamepad.buttons.leftBumper),
        rightBumper: button(gamepad.buttons.rightBumper),
        leftTrigger: button(gamepad.buttons.leftTrigger),
        rightTrigger: button(gamepad.buttons.rightTrigger),
        view: button(gamepad.buttons.view),
        menu: button(gamepad.buttons.menu),
        leftStickPress: button(gamepad.buttons.leftStick),
        rightStickPress: button(gamepad.buttons.rightStick),
        dpadUp: button(gamepad.buttons.dpadUp),
        dpadDown: button(gamepad.buttons.dpadDown),
        dpadLeft: button(gamepad.buttons.dpadLeft),
        dpadRight: button(gamepad.buttons.dpadRight),
        home: button(gamepad.buttons.home),
        touchpad: button(gamepad.buttons.touchpad),
      },
      axes: gamepad.raw.axes,
      buttons: gamepad.raw.buttons.map(legacyButton),
      touches: gamepad.touches.map((touch) => ({
        touchId: touch.id,
        surfaceId: touch.surface,
        position: touch.position,
        ...(touch.surfaceSize ? { surfaceDimensions: touch.surfaceSize } : {}),
      })),
    };
  };
  const readLegacyGamepads = () => {
    const frame = readGamepads();
    return {
      version: 1,
      sequence: frame.sequence,
      capturedAtMs: frame.timestampMs,
      focused: frame.focus.focused,
      visible: frame.focus.visible,
      active: frame.focus.active,
      gamepads: frame.connected.map(legacyGamepad),
      primaryGamepadIndex: frame.primary ? frame.primary.index : null,
      steamInput: frame.steamActions,
    };
  };

  const gamepadsApi = Object.freeze({ read: readGamepads });
  const inputApi = Object.freeze({ version: 2, read: readSnapshot, gamepads: gamepadsApi });
  contextBridge.exposeInMainWorld("steamBridge", Object.freeze({ version: 1, input: inputApi }));
  contextBridge.exposeInMainWorld("steamBridgeInput", Object.freeze({ readGamepads: readLegacyGamepads }));
}
