"use strict";

// Keep this plain JavaScript mirror aligned with steam-input.generated.ts so
// the runnable CommonJS examples resolve the bundled manifest's exact names.
module.exports = {
  actionSets: { gameplay: "gameplay", menu: "menu" },
  actionLayers: { inventory: "inventory" },
  digital: { accept: "accept", cancel: "cancel", jump: "jump", pause: "pause" },
  analog: { move: "move" }
};
