"use strict";

const output = document.querySelector("#output");
const status = document.querySelector("#status");
const error = document.querySelector("#error");
let latestFrame = null;

function show(value) {
  output.textContent = JSON.stringify(value, null, 2);
}

window.steamInput.onFrame((frame) => {
  latestFrame = frame;
  status.textContent = `Frame ${frame.sequence} · ${frame.controllers.length} individual controller(s)`;
  show(frame);
});
window.steamInput.onError((message) => {
  error.textContent = message;
});

document.querySelector("#jump-prompt").addEventListener("click", async () => {
  show(await window.steamInput.getPrompt("jump"));
});
document.querySelector("#pause-prompt").addEventListener("click", async () => {
  show(await window.steamInput.getPrompt("pause"));
});
document.querySelector("#binding-panel").addEventListener("click", async () => {
  error.textContent = (await window.steamInput.showBindingPanel()) ? "" : "Steam could not open the binding panel.";
  if (latestFrame) show(latestFrame);
});
document.querySelector("#diagnostics").addEventListener("click", async () => {
  show(await window.steamInput.getDiagnostics());
});

function tick() {
  window.steamInput.requestFrame();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
