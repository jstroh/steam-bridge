#!/usr/bin/env bash
set -euo pipefail

mode="direct"
app_dir=""
result_file=""
diagnostic_dir=""
app_id="480"
action="none"
overlay_profile="compatibility"
window_mode=""
web_url=""
web_modal=""
checkout_url=""
checkout_transaction_id=""
checkout_return_url=""
overlay_dialog=""
user_dialog=""
shortcut_target=""
presenter_mode=""
native_host_backend=""
achievement_name=""
achievement_current=""
achievement_max=""
action_delay_ms=""
result_delay_ms="8000"
keep_open_after_result="0"
timeout_seconds="90"
shortcut_game_id=""
app_name="Steam Bridge Smoke"
steam_user_id=""
require_steam_launch="0"
require_overlay_injection="0"
require_overlay_enabled="0"
require_overlay_ready="0"
require_overlay_activated="0"
require_native_probe_open="0"
require_passive_presenter="0"
require_idle_presenter="0"
require_electron_overlay="0"
require_presenter_mode=""
require_overlay_shortcut_target=""
require_no_crashes="0"
require_events=()

usage() {
  cat <<'EOF'
Usage:
  macos-electron-smoke.sh [options]

Modes:
  --mode direct                  Run SteamBridgeSmoke directly and verify it.
  --mode steam-launch            Launch the Steam shortcut and verify it.
  --mode verify                  Verify an existing smoke result log.
  --mode print-launch-options    Print launch options for a Steam shortcut.
  --mode print-shortcuts         Print matching Steam shortcut IDs.
  --mode self-test               Test argument assembly and result verification.

Options:
  --app-dir PATH                 Path to SteamBridgeSmoke.app.
  --result-file PATH             Result log path.
  --diagnostic-dir PATH          Diagnostic log/crash dump directory.
  --app-id ID                    Steam App ID to use. Defaults to 480.
  --action NAME                  Smoke autorun action. Defaults to none.
  --overlay-profile NAME         Electron overlay profile. Defaults to compatibility.
  --window-mode NAME             Electron window mode: windowed, fullscreen, or borderless.
  --web-url URL                  URL for the web overlay action.
  --web-modal true|false         Whether the web overlay action should request a modal.
  --checkout-url URL             Full Steam checkout URL for presenter-checkout.
  --checkout-transaction-id ID   Steam checkout transaction ID for presenter-checkout.
  --checkout-return-url URL      Optional return URL for transaction checkout.
  --dialog NAME                  Dialog name for dialog/native-dialog/presenter-dialog actions.
  --user-dialog NAME             User dialog name for presenter-user.
  --shortcut-target NAME         Managed presenter shortcut target.
  --presenter-mode MODE          Managed Electron overlay presenter mode: persistent or session.
  --native-host-backend NAME     macOS native presenter backend: metal or opengl.
  --achievement-name NAME        Achievement for presenter-achievement-progress or unlock.
  --achievement-current VALUE    Progress current value.
  --achievement-max VALUE        Progress max value.
  --action-delay-ms MS           Autorun delay before the action. Defaults to app default.
  --result-delay-ms MS           Autorun result delay. Defaults to 8000.
  --keep-open-after-result       Write the result but leave the app running.
  --timeout-seconds SECONDS      Result wait timeout. Defaults to 90.
  --shortcut-game-id ID|auto     Full steam://rungameid shortcut game ID.
  --app-name NAME                Shortcut name to auto-discover.
  --steam-user-id ID             Restrict shortcut discovery to one userdata ID.
  --require-steam-launch         Require Steam launch markers.
  --require-overlay-injection    Require macOS overlay injection marker.
  --require-overlay-enabled      Require overlayEnabled=true.
  --require-overlay-ready        Require overlayEnabled=true and no pending present.
  --require-overlay-activated    Require callback:overlay-activated active=true.
  --require-native-probe-open    Require the lower-level native probe to be open.
  --require-passive-presenter    Require the reusable presenter to be passive.
  --require-idle-presenter       Require passive presenter plus zero current/idle FPS.
  --require-electron-overlay     Require managed Electron overlay diagnostics.
  --require-presenter-mode MODE  Require managed Electron overlay presenter mode.
  --require-overlay-shortcut-target NAME
                                 Require managed Electron Shift+Tab target type.
  --require-no-crashes           Require no crash dumps or fatal Electron lifecycle events.
  --require-event TYPE           Require an emitted event. May be repeated.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --mode)
      mode="${2:?missing --mode value}"
      shift 2
      ;;
    --app-dir)
      app_dir="${2:?missing --app-dir value}"
      shift 2
      ;;
    --result-file)
      result_file="${2:?missing --result-file value}"
      shift 2
      ;;
    --diagnostic-dir)
      diagnostic_dir="${2:?missing --diagnostic-dir value}"
      shift 2
      ;;
    --app-id)
      app_id="${2:?missing --app-id value}"
      shift 2
      ;;
    --action)
      action="${2:?missing --action value}"
      shift 2
      ;;
    --overlay-profile)
      overlay_profile="${2:?missing --overlay-profile value}"
      shift 2
      ;;
    --window-mode)
      window_mode="${2:?missing --window-mode value}"
      shift 2
      ;;
    --web-url)
      web_url="${2:?missing --web-url value}"
      shift 2
      ;;
    --web-modal)
      web_modal="${2:?missing --web-modal value}"
      shift 2
      ;;
    --checkout-url)
      checkout_url="${2:?missing --checkout-url value}"
      shift 2
      ;;
    --checkout-transaction-id)
      checkout_transaction_id="${2:?missing --checkout-transaction-id value}"
      shift 2
      ;;
    --checkout-return-url)
      checkout_return_url="${2:?missing --checkout-return-url value}"
      shift 2
      ;;
    --dialog)
      overlay_dialog="${2:?missing --dialog value}"
      shift 2
      ;;
    --user-dialog)
      user_dialog="${2:?missing --user-dialog value}"
      shift 2
      ;;
    --shortcut-target)
      shortcut_target="${2:?missing --shortcut-target value}"
      shift 2
      ;;
    --presenter-mode)
      presenter_mode="${2:?missing --presenter-mode value}"
      shift 2
      ;;
    --native-host-backend)
      native_host_backend="${2:?missing --native-host-backend value}"
      shift 2
      ;;
    --achievement-name)
      achievement_name="${2:?missing --achievement-name value}"
      shift 2
      ;;
    --achievement-current)
      achievement_current="${2:?missing --achievement-current value}"
      shift 2
      ;;
    --achievement-max)
      achievement_max="${2:?missing --achievement-max value}"
      shift 2
      ;;
    --action-delay-ms)
      action_delay_ms="${2:?missing --action-delay-ms value}"
      shift 2
      ;;
    --result-delay-ms)
      result_delay_ms="${2:?missing --result-delay-ms value}"
      shift 2
      ;;
    --keep-open-after-result)
      keep_open_after_result="1"
      shift
      ;;
    --timeout-seconds)
      timeout_seconds="${2:?missing --timeout-seconds value}"
      shift 2
      ;;
    --shortcut-game-id)
      shortcut_game_id="${2:?missing --shortcut-game-id value}"
      shift 2
      ;;
    --app-name)
      app_name="${2:?missing --app-name value}"
      shift 2
      ;;
    --steam-user-id)
      steam_user_id="${2:?missing --steam-user-id value}"
      shift 2
      ;;
    --require-steam-launch)
      require_steam_launch="1"
      shift
      ;;
    --require-overlay-injection)
      require_overlay_injection="1"
      shift
      ;;
    --require-overlay-enabled)
      require_overlay_enabled="1"
      shift
      ;;
    --require-overlay-ready)
      require_overlay_ready="1"
      shift
      ;;
    --require-overlay-activated)
      require_overlay_activated="1"
      shift
      ;;
    --require-native-probe-open)
      require_native_probe_open="1"
      shift
      ;;
    --require-passive-presenter)
      require_passive_presenter="1"
      shift
      ;;
    --require-idle-presenter)
      require_idle_presenter="1"
      require_passive_presenter="1"
      shift
      ;;
    --require-electron-overlay)
      require_electron_overlay="1"
      shift
      ;;
    --require-presenter-mode)
      require_presenter_mode="${2:?missing --require-presenter-mode value}"
      require_electron_overlay="1"
      shift 2
      ;;
    --require-overlay-shortcut-target)
      require_overlay_shortcut_target="${2:?missing --require-overlay-shortcut-target value}"
      require_electron_overlay="1"
      shift 2
      ;;
    --require-no-crashes)
      require_no_crashes="1"
      shift
      ;;
    --require-event)
      require_events+=("${2:?missing --require-event value}")
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
result_prefix="STEAM_BRIDGE_SMOKE_RESULT "
smoke_exe=""

if [ -z "$result_file" ]; then
  result_file="${TMPDIR:-/tmp}/steam-bridge-smoke-macos-direct.log"
fi
if [ -z "$diagnostic_dir" ]; then
  diagnostic_dir="$result_file.diagnostics"
fi

smoke_args() {
  printf '%s\n' \
    "--steam-bridge-app-id=$app_id" \
    "--steam-bridge-electron-overlay-profile=$overlay_profile" \
    "--steam-bridge-smoke-autorun" \
    "--steam-bridge-smoke-autorun-action=$action" \
    "--steam-bridge-smoke-autorun-result-delay-ms=$result_delay_ms" \
    "--steam-bridge-smoke-result-file=$result_file" \
    "--steam-bridge-smoke-diagnostic-dir=$diagnostic_dir"

  if [ "$require_overlay_activated" = "1" ]; then
    printf '%s\n' "--steam-bridge-smoke-require-overlay-active"
  fi
  if [ "$keep_open_after_result" = "1" ]; then
    printf '%s\n' "--steam-bridge-smoke-keep-open-after-result"
  fi
  if [ -n "$window_mode" ]; then
    printf '%s\n' "--steam-bridge-smoke-window-mode=$window_mode"
  fi
  if [ -n "$web_url" ]; then
    printf '%s\n' "--steam-bridge-smoke-web-url=$web_url"
  fi
  if [ -n "$web_modal" ]; then
    printf '%s\n' "--steam-bridge-smoke-web-modal=$web_modal"
  fi
  if [ -n "$checkout_url" ]; then
    printf '%s\n' "--steam-bridge-smoke-checkout-url=$checkout_url"
  fi
  if [ -n "$checkout_transaction_id" ]; then
    printf '%s\n' "--steam-bridge-smoke-checkout-transaction-id=$checkout_transaction_id"
  fi
  if [ -n "$checkout_return_url" ]; then
    printf '%s\n' "--steam-bridge-smoke-checkout-return-url=$checkout_return_url"
  fi
  if [ -n "$overlay_dialog" ]; then
    printf '%s\n' "--steam-bridge-smoke-overlay-dialog=$overlay_dialog"
  fi
  if [ -n "$user_dialog" ]; then
    printf '%s\n' "--steam-bridge-smoke-user-dialog=$user_dialog"
  fi
  if [ -n "$shortcut_target" ]; then
    printf '%s\n' "--steam-bridge-smoke-shortcut-target=$shortcut_target"
  fi
  if [ -n "$presenter_mode" ]; then
    printf '%s\n' "--steam-bridge-smoke-presenter-mode=$presenter_mode"
  fi
  if [ -n "$native_host_backend" ]; then
    printf '%s\n' "--steam-bridge-smoke-native-host-backend=$native_host_backend"
  fi
  if [ -n "$achievement_name" ]; then
    printf '%s\n' "--steam-bridge-smoke-achievement-name=$achievement_name"
  fi
  if [ -n "$achievement_current" ]; then
    printf '%s\n' "--steam-bridge-smoke-achievement-current=$achievement_current"
  fi
  if [ -n "$achievement_max" ]; then
    printf '%s\n' "--steam-bridge-smoke-achievement-max=$achievement_max"
  fi
  if [ -n "$action_delay_ms" ]; then
    printf '%s\n' "--steam-bridge-smoke-autorun-action-delay-ms=$action_delay_ms"
  fi
}

resolve_app_dir() {
  if [ -z "$app_dir" ]; then
    if [ -d "$script_dir/Contents/MacOS" ]; then
      app_dir="$script_dir"
    elif [ -x "$script_dir/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke" ]; then
      app_dir="$script_dir/SteamBridgeSmoke.app"
    else
      app_dir="$(pwd)/dist/electron-smoke/aarch64-apple-darwin/SteamBridgeSmoke-darwin-arm64/SteamBridgeSmoke.app"
    fi
  fi

  app_dir="$(cd -- "$app_dir" && pwd)"
  smoke_exe="$app_dir/Contents/MacOS/SteamBridgeSmoke"
}

ensure_app() {
  resolve_app_dir
  if [ ! -x "$smoke_exe" ]; then
    echo "Missing executable $smoke_exe" >&2
    exit 1
  fi
}

wait_for_result_file() {
  local deadline
  deadline=$((SECONDS + timeout_seconds))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ -s "$result_file" ] && grep -q "^$result_prefix" "$result_file"; then
      return 0
    fi
    sleep 0.5
  done

  echo "Timed out waiting for smoke result file $result_file" >&2
  return 1
}

discover_shortcuts() {
  node - "$app_name" "$steam_user_id" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [appName, steamUserId] = process.argv.slice(2);
const TYPE_OBJECT = 0;
const TYPE_STRING = 1;
const TYPE_UINT32 = 2;
const TYPE_END = 8;
const home = process.env.HOME || "";
const userdataRoot = path.join(home, "Library", "Application Support", "Steam", "userdata");
const paths = [];

if (steamUserId) {
  paths.push(path.join(userdataRoot, steamUserId, "config", "shortcuts.vdf"));
} else if (fs.existsSync(userdataRoot)) {
  for (const entry of fs.readdirSync(userdataRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      paths.push(path.join(userdataRoot, entry.name, "config", "shortcuts.vdf"));
    }
  }
}

for (const shortcutPath of paths.sort()) {
  if (!fs.existsSync(shortcutPath)) {
    continue;
  }

  let root;
  try {
    root = readBinaryKeyValues(fs.readFileSync(shortcutPath));
  } catch {
    continue;
  }
  if (root.name !== "shortcuts" || !root.value || typeof root.value !== "object") {
    continue;
  }

  const userId = shortcutPath.split(`${path.sep}userdata${path.sep}`)[1]?.split(path.sep)[0] || "";
  for (const [index, entry] of Object.entries(root.value)) {
    if (!entry || typeof entry !== "object" || entry.appname !== appName) {
      continue;
    }
    const appid = Number(entry.appid) >>> 0;
    const gameId = ((BigInt(appid) << 32n) | 0x02000000n).toString();
    console.log(JSON.stringify({
      userId,
      index,
      appid,
      gameId,
      appname: entry.appname || "",
      exe: entry.Exe || "",
      startDir: entry.StartDir || "",
      launchOptions: entry.LaunchOptions || "",
      allowOverlay: entry.AllowOverlay
    }));
  }
}

function readBinaryKeyValues(buffer) {
  let offset = 0;
  const rootType = readByte();
  if (rootType !== TYPE_OBJECT) {
    throw new Error(`Expected binary VDF root object, got type ${rootType}.`);
  }
  const name = readCString();
  return { name, value: readObject() };

  function readObject() {
    const object = {};
    while (offset < buffer.length) {
      const type = readByte();
      if (type === TYPE_END) {
        break;
      }

      const fieldName = readCString();
      switch (type) {
        case TYPE_OBJECT:
          object[fieldName] = readObject();
          break;
        case TYPE_STRING:
          object[fieldName] = readCString();
          break;
        case TYPE_UINT32:
          object[fieldName] = readUInt32();
          break;
        default:
          throw new Error(`Unsupported binary VDF field type ${type} for ${fieldName}.`);
      }
    }
    return object;
  }

  function readByte() {
    if (offset >= buffer.length) {
      throw new Error("Unexpected end of binary VDF.");
    }
    return buffer[offset++];
  }

  function readCString() {
    const start = offset;
    while (offset < buffer.length && buffer[offset] !== 0) {
      offset += 1;
    }
    if (offset >= buffer.length) {
      throw new Error("Unterminated binary VDF string.");
    }
    const value = buffer.toString("utf8", start, offset);
    offset += 1;
    return value;
  }

  function readUInt32() {
    if (offset + 4 > buffer.length) {
      throw new Error("Unexpected end of binary VDF uint32.");
    }
    const value = buffer.readUInt32LE(offset);
    offset += 4;
    return value;
  }
}
NODE
}

resolve_shortcut_game_id() {
  if [ -n "$shortcut_game_id" ] && [ "$shortcut_game_id" != "auto" ]; then
    printf '%s\n' "$shortcut_game_id"
    return 0
  fi

  local matches ids resolved
  matches="$(discover_shortcuts)"
  if [ -z "$matches" ]; then
    echo "Could not find Steam shortcut named \"$app_name\"." >&2
    echo "Add it as a non-Steam game or pass --shortcut-game-id explicitly." >&2
    return 1
  fi

  ids="$(printf '%s\n' "$matches" | node -e 'const fs=require("node:fs"); const ids=new Set(); for (const line of fs.readFileSync(0,"utf8").split(/\n/)) { if (!line.trim()) continue; ids.add(JSON.parse(line).gameId); } console.log([...ids].sort().join("\n"));')"
  if [ "$(printf '%s\n' "$ids" | sed '/^$/d' | wc -l | tr -d ' ')" != "1" ]; then
    echo "Found multiple shortcut game IDs for \"$app_name\"; pass --shortcut-game-id explicitly:" >&2
    printf '%s\n' "$matches" >&2
    return 1
  fi

  resolved="$(printf '%s\n' "$ids" | sed -n '1p')"
  printf '%s\n' "$resolved"
}

launch_steam_shortcut() {
  local game_id
  game_id="$(resolve_shortcut_game_id)"

  mkdir -p "$(dirname -- "$result_file")"
  rm -f "$result_file"
  rm -rf "$diagnostic_dir"

  echo "Launching steam://rungameid/$game_id"
  open "steam://rungameid/$game_id"
  wait_for_result_file
  verify_result
}

verifier_path() {
  if [ -f "$script_dir/verify-electron-smoke-result.cjs" ]; then
    printf '%s\n' "$script_dir/verify-electron-smoke-result.cjs"
  else
    printf '%s\n' "$script_dir/verify-electron-smoke-result.cjs"
  fi
}

verify_result() {
  local verifier args
  verifier="$(verifier_path)"
  if [ ! -f "$verifier" ]; then
    echo "Missing verifier $verifier" >&2
    echo "Run from a packaged app that includes verify-electron-smoke-result.cjs." >&2
    exit 1
  fi

  args=(
    "$verifier"
    "--file" "$result_file"
    "--app-id" "$app_id"
    "--platform" "darwin/arm64"
  )
  if [ -n "$action" ]; then
    args+=("--action" "$action")
  fi
  if [ "$require_steam_launch" = "1" ]; then
    args+=("--require-steam-launch")
  fi
  if [ "$require_overlay_injection" = "1" ]; then
    args+=("--require-overlay-injection")
  fi
  if [ "$require_overlay_enabled" = "1" ]; then
    args+=("--require-overlay-enabled")
  fi
  if [ "$require_overlay_ready" = "1" ]; then
    args+=("--require-overlay-ready")
  fi
  if [ "$require_overlay_activated" = "1" ]; then
    args+=("--require-overlay-activated")
  fi
  if [ "$require_native_probe_open" = "1" ]; then
    args+=("--require-native-probe-open")
  fi
  if [ "$require_passive_presenter" = "1" ]; then
    args+=("--require-passive-presenter")
  fi
  if [ "$require_idle_presenter" = "1" ]; then
    args+=("--require-idle-presenter")
  fi
  if [ "$require_electron_overlay" = "1" ]; then
    args+=("--require-electron-overlay")
  fi
  if [ -n "$require_presenter_mode" ]; then
    args+=("--require-presenter-mode" "$require_presenter_mode")
  fi
  if [ -n "$require_overlay_shortcut_target" ]; then
    args+=("--require-overlay-shortcut-target" "$require_overlay_shortcut_target")
  fi
  if [ "$require_no_crashes" = "1" ]; then
    args+=("--require-no-crashes")
  fi
  if [ "${#require_events[@]}" -gt 0 ]; then
    for event_type in "${require_events[@]}"; do
      args+=("--require-event" "$event_type")
    done
  fi

  node "${args[@]}"
}

run_self_test() {
  local temp_result launch_options temp_home old_home shortcut_file expected_game_id matches resolved
  temp_result="$(mktemp "${TMPDIR:-/tmp}/steam-bridge-macos-helper.XXXXXX")"
  result_file="$temp_result"
  cat >"$result_file" <<'EOF'
STEAM_BRIDGE_SMOKE_RESULT {"ok":true,"action":{"ok":true,"action":"presenter-web"},"snapshot":{"app":{"appId":480,"shortcutTarget":"friends"},"process":{"pid":4242,"platform":"darwin","arch":"arm64"},"launch":{"steamLaunch":true,"overlayInjection":true},"crashDiagnostics":{"available":true,"ok":true,"crashDumps":[],"fatalLifecycleEvents":[]},"overlay":{"nativePresenter":{"ok":true,"value":{"backend":"macos-metal","attached":true,"nativeHostOpen":true,"mode":"passive","clickThrough":true,"focusable":false,"transparent":true,"overlayActive":false,"overlayNeedsPresent":false,"idleFps":0,"currentFps":0,"electronOverlay":{"presenterMode":"persistent","closeWithWindow":true,"autoPrepareForNotifications":true,"overlayShortcut":{"enabled":true,"preventDefault":true,"targetType":"friends","target":{"type":"friends"}}}}}},"steam":{"initialized":true,"running":{"ok":true,"value":true},"appId":{"ok":true,"value":480},"steamDeck":{"ok":true,"value":false},"bigPicture":{"ok":true,"value":false},"overlayEnabled":{"ok":true,"value":true},"overlayNeedsPresent":{"ok":true,"value":false}},"events":[{"type":"overlay:presenter-open"},{"type":"callback:overlay-activated","payload":{"active":true}}]}}
EOF

  action="presenter-web"
  require_steam_launch="1"
  require_overlay_injection="1"
  require_overlay_ready="1"
  require_idle_presenter="1"
  require_electron_overlay="1"
  require_presenter_mode="persistent"
  require_overlay_shortcut_target="friends"
  require_no_crashes="1"
  require_events=("overlay:presenter-open" "callback:overlay-activated")
  verify_result

  temp_home="$(mktemp -d "${TMPDIR:-/tmp}/steam-bridge-macos-helper-home.XXXXXX")"
  old_home="$HOME"
  shortcut_file="$temp_home/Library/Application Support/Steam/userdata/1686541554/config/shortcuts.vdf"
  expected_game_id="$(node - <<'NODE'
const appid = 3855287460;
console.log(((BigInt(appid) << 32n) | 0x02000000n).toString());
NODE
)"

  mkdir -p "$(dirname -- "$shortcut_file")"
  node - "$shortcut_file" <<'NODE'
const fs = require("node:fs");

const TYPE_OBJECT = 0;
const TYPE_STRING = 1;
const TYPE_UINT32 = 2;
const TYPE_END = 8;
const chunks = [];

byte(TYPE_OBJECT);
cstr("shortcuts");
byte(TYPE_OBJECT);
cstr("0");
uint32("appid", 3855287460);
string("appname", "Steam Bridge Smoke");
string("Exe", '"/tmp/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke"');
string("StartDir", "/tmp/SteamBridgeSmoke.app/Contents/MacOS/");
string("LaunchOptions", "--steam-bridge-app-id=480");
uint32("AllowOverlay", 1);
byte(TYPE_END);
byte(TYPE_END);
byte(TYPE_END);

fs.writeFileSync(process.argv[2], Buffer.concat(chunks));

function byte(value) {
  chunks.push(Buffer.from([value]));
}

function cstr(value) {
  chunks.push(Buffer.from(String(value), "utf8"), Buffer.from([0]));
}

function string(name, value) {
  byte(TYPE_STRING);
  cstr(name);
  cstr(value);
}

function uint32(name, value) {
  const buffer = Buffer.allocUnsafe(4);
  byte(TYPE_UINT32);
  cstr(name);
  buffer.writeUInt32LE(Number(value) >>> 0, 0);
  chunks.push(buffer);
}
NODE

  HOME="$temp_home"
  export HOME
  matches="$(discover_shortcuts)"
  if ! printf '%s\n' "$matches" | grep -q "\"gameId\":\"$expected_game_id\""; then
    echo "Self-test failed to discover expected Steam shortcut game ID." >&2
    printf '%s\n' "$matches" >&2
    exit 1
  fi

  resolved="$(resolve_shortcut_game_id)"
  if [ "$resolved" != "$expected_game_id" ]; then
    echo "Self-test resolved $resolved, expected $expected_game_id." >&2
    exit 1
  fi

  HOME="$old_home"
  export HOME
  rm -rf "$temp_home"

  overlay_dialog="Achievements"
  user_dialog="steamid"
  presenter_mode="session"
  native_host_backend="opengl"
  action_delay_ms="2500"
  launch_options="$(smoke_args | paste -sd' ' -)"
  if [[ "$launch_options" != *"--steam-bridge-smoke-overlay-dialog=Achievements"* ]]; then
    echo "Self-test failed: launch options must pass the requested overlay dialog." >&2
    exit 1
  fi
  if [[ "$launch_options" != *"--steam-bridge-smoke-user-dialog=steamid"* ]]; then
    echo "Self-test failed: launch options must pass the requested user dialog." >&2
    exit 1
  fi
  if [[ "$launch_options" != *"--steam-bridge-smoke-presenter-mode=session"* ]]; then
    echo "Self-test failed: launch options must pass the requested presenter mode." >&2
    exit 1
  fi
  if [[ "$launch_options" != *"--steam-bridge-smoke-native-host-backend=opengl"* ]]; then
    echo "Self-test failed: launch options must pass the requested native host backend." >&2
    exit 1
  fi
  if [[ "$launch_options" != *"--steam-bridge-smoke-autorun-action-delay-ms=2500"* ]]; then
    echo "Self-test failed: launch options must pass the requested action delay." >&2
    exit 1
  fi

  rm -f "$temp_result"
  echo "macOS Electron smoke helper self-test passed."
}

case "$mode" in
  self-test)
    run_self_test
    ;;
  print-launch-options)
    printf 'Steam shortcut launch options:\n'
    smoke_args | paste -sd' ' -
    if [ -n "$shortcut_game_id" ]; then
      printf 'Launch URL: steam://rungameid/%s\n' "$(resolve_shortcut_game_id)"
    fi
    ;;
  print-shortcuts)
    discover_shortcuts
    ;;
  direct)
    ensure_app
    mkdir -p "$(dirname -- "$result_file")"
    rm -f "$result_file"
    rm -rf "$diagnostic_dir"
    args=()
    while IFS= read -r arg; do
      args+=("$arg")
    done < <(smoke_args)
    (cd "$app_dir" && "$smoke_exe" "${args[@]}")
    wait_for_result_file
    verify_result
    ;;
  steam-launch)
    require_steam_launch="1"
    launch_steam_shortcut
    ;;
  verify)
    verify_result
    ;;
  *)
    echo "Unknown mode: $mode" >&2
    usage >&2
    exit 2
    ;;
esac
