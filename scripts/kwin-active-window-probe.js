const activeWindow = workspace.activeWindow;

function geometry(window, property) {
  const value = window[property];
  return value
    ? { x: value.x, y: value.y, width: value.width, height: value.height }
    : null;
}

if (activeWindow) {
  print(
    `STEAM_BRIDGE_KWIN_ACTIVE ${JSON.stringify({
      caption: activeWindow.caption,
      resourceClass: activeWindow.resourceClass,
      resourceName: activeWindow.resourceName,
      pid: activeWindow.pid,
      fullScreen: activeWindow.fullScreen,
      active: activeWindow.active,
      frameGeometry: geometry(activeWindow, "frameGeometry"),
      clientGeometry: geometry(activeWindow, "clientGeometry")
    })}`
  );
} else {
  print("STEAM_BRIDGE_KWIN_ACTIVE null");
}
