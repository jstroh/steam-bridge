"use strict";

const pad = {
  connected: true,
  index: 0,
  id: "Steam Bridge benchmark controller",
  mapping: "standard",
  timestamp: 1,
  axes: Object.freeze([0.25, -0.75, 0.1, -0.1]),
  buttons: Object.freeze(Array.from({ length: 17 }, (_unused, index) => Object.freeze({
    pressed: index === 0,
    touched: index === 0,
    value: index === 0 ? 1 : 0
  }))),
  touches: Object.freeze([])
};

Object.defineProperty(navigator, "getGamepads", {
  configurable: true,
  value: () => [pad]
});

require("../../packages/steam-bridge/templates/electron-input-preload.cjs");
