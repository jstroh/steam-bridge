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
macos_native_launcher="0"
launcher_env_file=""
result_delay_ms="8000"
keep_open_after_result="0"
timeout_seconds="90"
close_probe="0"
close_input="escape"
shortcut_open_probe="0"
require_close_deactivated="0"
shortcut_game_id=""
app_name="Steam Bridge Smoke"
steam_user_id=""
require_steam_launch="0"
require_overlay_injection="0"
require_overlay_enabled="0"
require_overlay_ready="0"
require_overlay_activated="0"
require_no_overlay_activation="0"
require_native_probe_open="0"
require_passive_presenter="0"
require_passive_notification="0"
require_idle_presenter="0"
require_electron_overlay="0"
require_presenter_mode=""
require_overlay_shortcut_target=""
require_action_error_code=""
require_action_error_reason=""
require_native_host_unavailable_reason=""
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
  --macos-native-launcher        Prefix launch options for the packaged native env launcher.
  --launcher-env-file PATH       Native launcher env file for stable Steam shortcuts.
  --result-delay-ms MS           Autorun result delay. Defaults to 8000.
  --keep-open-after-result       Write the result but leave the app running.
  --timeout-seconds SECONDS      Result wait timeout. Defaults to 90.
  --close-probe                  Keep the app open, send a macOS overlay close input,
                                 and require active=false plus presenter parking evidence.
  --close-input MODE             macOS close input: escape, keyboard, or toggle. Defaults to escape.
                                 keyboard is an alias for escape; toggle sends Shift+Tab.
  --shortcut-open-probe          Focus the app, send Shift+Tab, and require managed
                                 shortcut-open plus active overlay evidence.
  --require-close-deactivated    Verify existing lifecycle close/parking evidence.
  --shortcut-game-id ID|auto     Full steam://rungameid shortcut game ID.
  --app-name NAME                Shortcut name to auto-discover.
  --steam-user-id ID             Restrict shortcut discovery to one userdata ID.
  --require-steam-launch         Require Steam launch markers.
  --require-overlay-injection    Require macOS overlay injection marker.
  --require-overlay-enabled      Require overlayEnabled=true.
  --require-overlay-ready        Require overlayEnabled=true and no pending present.
  --require-overlay-activated    Require callback:overlay-activated active=true.
  --require-no-overlay-activation
                                 Require no callback:overlay-activated active=true event.
  --require-native-probe-open    Require the lower-level native probe to be open.
  --require-passive-presenter    Require the reusable presenter to be passive.
  --require-passive-notification Require passive Steam notification proof for toast actions.
  --require-idle-presenter       Require passive presenter plus zero current/idle FPS.
  --require-electron-overlay     Require managed Electron overlay diagnostics.
  --require-presenter-mode MODE  Require managed Electron overlay presenter mode.
  --require-overlay-shortcut-target NAME
                                 Require managed Electron Shift+Tab target type.
  --require-action-error-code CODE
                                 Require the autorun action to fail with this serialized error code.
  --require-action-error-reason REASON
                                 Require the autorun action to fail with this serialized error reason.
  --require-native-host-unavailable-reason REASON
                                 Require managed presenter diagnostics to report this native host unavailable reason.
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
    --macos-native-launcher)
      macos_native_launcher="1"
      shift
      ;;
    --launcher-env-file)
      launcher_env_file="${2:?missing --launcher-env-file value}"
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
    --close-probe)
      close_probe="1"
      require_close_deactivated="1"
      keep_open_after_result="1"
      shift
      ;;
    --close-input)
      close_input="${2:?missing --close-input value}"
      shift 2
      ;;
    --shortcut-open-probe)
      shortcut_open_probe="1"
      keep_open_after_result="1"
      shift
      ;;
    --require-close-deactivated)
      require_close_deactivated="1"
      shift
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
    --require-no-overlay-activation)
      require_no_overlay_activation="1"
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
    --require-passive-notification)
      require_passive_notification="1"
      require_electron_overlay="1"
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
    --require-action-error-code)
      require_action_error_code="${2:?missing --require-action-error-code value}"
      shift 2
      ;;
    --require-action-error-reason)
      require_action_error_reason="${2:?missing --require-action-error-reason value}"
      shift 2
      ;;
    --require-native-host-unavailable-reason)
      require_native_host_unavailable_reason="${2:?missing --require-native-host-unavailable-reason value}"
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

case "$close_input" in
  escape|keyboard|toggle)
    ;;
  *)
    echo "Unknown --close-input: $close_input" >&2
    usage >&2
    exit 2
    ;;
esac

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
  if [ "$macos_native_launcher" = "1" ]; then
    printf '%s\n' \
      "--steam-bridge-launch-app-id=$app_id" \
      "--steam-bridge-launch-overlay-game-id=$app_id"
    if [ -n "$launcher_env_file" ]; then
      printf '%s\n' "--steam-bridge-launch-env-file=$launcher_env_file"
      return 0
    fi
  fi

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
  local deadline no_steam_deadline steam_seen
  deadline=$((SECONDS + timeout_seconds))
  no_steam_deadline=$((SECONDS + 15))
  steam_seen="0"
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ -s "$result_file" ] && grep -q "^$result_prefix" "$result_file"; then
      return 0
    fi
    if [ "$mode" = "steam-launch" ]; then
      if pgrep -f 'steam_osx' >/dev/null 2>&1; then
        steam_seen="1"
      elif [ "$steam_seen" = "1" ]; then
        echo "Steam exited while waiting for smoke result file $result_file" >&2
        return 1
      elif [ "$SECONDS" -ge "$no_steam_deadline" ]; then
        echo "Steam did not start while waiting for smoke result file $result_file" >&2
        return 1
      fi
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
  if [ "$shortcut_open_probe" = "1" ]; then
    send_macos_overlay_shortcut_open_probe
    verify_macos_shortcut_open_after_probe
  fi
  if [ "$close_probe" = "1" ]; then
    send_macos_overlay_close_probe
    verify_macos_overlay_closed_after_probe
  fi
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
    "--diagnostic-dir" "$diagnostic_dir"
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
  if [ "$require_no_overlay_activation" = "1" ]; then
    args+=("--require-no-overlay-activation")
  fi
  if [ "$require_native_probe_open" = "1" ]; then
    args+=("--require-native-probe-open")
  fi
  if [ "$require_passive_presenter" = "1" ]; then
    args+=("--require-passive-presenter")
  fi
  if [ "$require_passive_notification" = "1" ]; then
    args+=("--require-passive-notification")
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
  if [ -n "$require_action_error_code" ]; then
    args+=("--require-action-error-code" "$require_action_error_code")
  fi
  if [ -n "$require_action_error_reason" ]; then
    args+=("--require-action-error-reason" "$require_action_error_reason")
  fi
  if [ -n "$require_native_host_unavailable_reason" ]; then
    args+=("--require-native-host-unavailable-reason" "$require_native_host_unavailable_reason")
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

send_macos_overlay_close_probe() {
  focus_macos_smoke_app_for_probe
  case "$close_input" in
    escape|keyboard)
      echo "Sending macOS overlay Escape close probe"
      osascript <<'OSA'
tell application "System Events"
  key code 53
end tell
OSA
      ;;
    toggle)
      echo "Sending macOS overlay Shift+Tab close probe"
      osascript <<'OSA'
tell application "System Events"
  key code 48 using shift down
end tell
OSA
      ;;
  esac
}

send_macos_overlay_shortcut_open_probe() {
  focus_macos_smoke_app_for_probe
  echo "Sending macOS overlay Shift+Tab shortcut open probe"
  osascript <<'OSA'
tell application "System Events"
  key code 48 using shift down
end tell
OSA
}

focus_macos_smoke_app_for_probe() {
  osascript <<'OSA'
tell application "System Events"
  set smokeProcesses to every application process whose name is "SteamBridgeSmoke.electron"
  if (count of smokeProcesses) is 0 then
    set smokeProcesses to every application process whose name is "SteamBridgeSmoke"
  end if
  if (count of smokeProcesses) is 0 then
    set smokeProcesses to every application process whose name contains "SteamBridgeSmoke" and name does not contain "Helper"
  end if
  if (count of smokeProcesses) > 0 then
    set frontmost of item 1 of smokeProcesses to true
  end if
end tell
OSA
}

verify_macos_shortcut_open_after_probe() {
  local open_timeout_seconds="${1:-12}"
  echo "Verifying macOS managed shortcut open evidence"
  RESULT_FILE="$result_file" DIAGNOSTIC_DIR="$diagnostic_dir" SHORTCUT_TARGET="$shortcut_target" OPEN_TIMEOUT_SECONDS="$open_timeout_seconds" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const resultFile = process.env.RESULT_FILE;
const diagnosticDir = process.env.DIAGNOSTIC_DIR || `${resultFile}.diagnostics`;
const expectedTarget = process.env.SHORTCUT_TARGET || "";
const timeoutSeconds = Number(process.env.OPEN_TIMEOUT_SECONDS || "12");
const lifecyclePath = path.join(diagnosticDir, "lifecycle.jsonl");
const crashDumpDir = path.join(diagnosticDir, "crash-dumps");
const fatalTypes = new Set([
  "app:render-process-gone",
  "app:child-process-gone",
  "app:gpu-process-crashed",
  "process:uncaught-exception",
  "process:unhandled-rejection"
]);
const failures = [];

let entries = [];
let lifecycleFailures = [];
const deadline = Date.now() + timeoutSeconds * 1000;
while (true) {
  ({ entries, lifecycleFailures } = readLifecycleEntries());
  if (lifecycleFailures.length === 0 && (hasRequiredOpenEvidence(entries) || Date.now() >= deadline)) {
    break;
  }
  if (lifecycleFailures.length > 0 && Date.now() >= deadline) {
    failures.push(...lifecycleFailures);
    break;
  }
  sleep(200);
}

if (failures.length === 0 && lifecycleFailures.length > 0) {
  failures.push(...lifecycleFailures);
}

const shortcutOpenIndex = entries.findIndex((entry) => entry.type === "event:overlay:shortcut-open");
if (shortcutOpenIndex < 0) {
  failures.push("no overlay:shortcut-open event in lifecycle log");
} else {
  const shortcutOpen = entries[shortcutOpenIndex];
  const payload = shortcutOpen.payload && typeof shortcutOpen.payload === "object" ? shortcutOpen.payload : {};
  if (expectedTarget && payload.target !== expectedTarget) {
    failures.push(`shortcut open target expected ${format(expectedTarget)}, got ${format(payload.target)}`);
  }
}

const activeAfterShortcutIndex = entries.findIndex((entry, index) => {
  return index > shortcutOpenIndex && entry.type === "event:callback:overlay-activated" && activeValue(entry.payload) === true;
});
if (shortcutOpenIndex >= 0 && activeAfterShortcutIndex < 0) {
  failures.push("no active=true overlay callback after shortcut-open");
}

const shownPresenter = entries
  .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
  .find(({ entry, index, presenter }) => {
    return index > activeAfterShortcutIndex && entry.type === "event:overlay:presenter-wait-shown" && presenter;
  });
if (activeAfterShortcutIndex >= 0 && !shownPresenter) {
  failures.push("no presenter-wait-shown snapshot after shortcut active=true");
}

const fatalEntries = entries.filter((entry) => fatalTypes.has(entry.type));
if (fatalEntries.length > 0) {
  failures.push(`fatal lifecycle events recorded after shortcut probe: ${fatalEntries.map((entry) => entry.type).join(", ")}`);
}

const crashDumps = listCrashDumps(crashDumpDir);
if (crashDumps.length > 0) {
  failures.push(`crash dump files found after shortcut probe: ${crashDumps.join(", ")}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`macOS shortcut open verification failed: ${failure}`);
  }
  process.exit(1);
}

console.log("macOS managed shortcut open verified: shortcut-open emitted, overlay activated, presenter shown, no crash evidence.");

function readLifecycleEntries() {
  const loadedEntries = [];
  const loadFailures = [];
  try {
    const text = fs.readFileSync(lifecyclePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      try {
        loadedEntries.push(JSON.parse(line));
      } catch (error) {
        loadFailures.push(`invalid lifecycle JSON: ${error.message}`);
      }
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      loadFailures.push(`missing lifecycle log: ${lifecyclePath}`);
    } else {
      loadFailures.push(`could not read lifecycle log: ${error.message}`);
    }
  }
  return { entries: loadedEntries, lifecycleFailures: loadFailures };
}

function hasRequiredOpenEvidence(loadedEntries) {
  const shortcutOpenIndex = loadedEntries.findIndex((entry) => entry.type === "event:overlay:shortcut-open");
  if (shortcutOpenIndex < 0) {
    return false;
  }
  const activeAfterShortcutIndex = loadedEntries.findIndex((entry, index) => {
    return index > shortcutOpenIndex && entry.type === "event:callback:overlay-activated" && activeValue(entry.payload) === true;
  });
  if (activeAfterShortcutIndex < 0) {
    return false;
  }
  return loadedEntries.some((entry, index) => {
    return index > activeAfterShortcutIndex && entry.type === "event:overlay:presenter-wait-shown" && presenterPayload(entry);
  });
}

function activeValue(payload) {
  if (payload === true || payload === 1) {
    return true;
  }
  if (payload === false || payload === 0) {
    return false;
  }
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const activePayload = payload["0"] && typeof payload["0"] === "object" ? payload["0"] : payload;
  for (const key of ["active", "m_bActive"]) {
    if (activePayload[key] === true || activePayload[key] === 1) {
      return true;
    }
    if (activePayload[key] === false || activePayload[key] === 0) {
      return false;
    }
  }
  return undefined;
}

function presenterPayload(entry) {
  const payload = entry && entry.payload;
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  return payload.presenter && typeof payload.presenter === "object" ? payload.presenter : undefined;
}

function listCrashDumps(root) {
  const crashDumps = [];
  walk(root);
  return crashDumps;

  function walk(currentPath) {
    let entriesForPath;
    try {
      entriesForPath = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return;
      }
      failures.push(`could not read crash dump directory: ${error.message}`);
      return;
    }
    for (const entry of entriesForPath) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (/\.(?:dmp|mdmp|dump|crash)$/i.test(entry.name)) {
        crashDumps.push(path.relative(root, entryPath));
      }
    }
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function format(value) {
  return JSON.stringify(value);
}
NODE
}

verify_macos_overlay_closed_after_probe() {
  local close_timeout_seconds="${1:-8}"
  local require_smoke_process="${2:-$close_probe}"
  echo "Verifying macOS overlay close/deactivation evidence"
  RESULT_FILE="$result_file" DIAGNOSTIC_DIR="$diagnostic_dir" ACTION="$action" CLOSE_TIMEOUT_SECONDS="$close_timeout_seconds" REQUIRE_SMOKE_PROCESS="$require_smoke_process" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const resultFile = process.env.RESULT_FILE;
const diagnosticDir = process.env.DIAGNOSTIC_DIR || `${resultFile}.diagnostics`;
const action = process.env.ACTION || "";
const timeoutSeconds = Number(process.env.CLOSE_TIMEOUT_SECONDS || "8");
const requireSmokeProcess = process.env.REQUIRE_SMOKE_PROCESS === "1";
const lifecyclePath = path.join(diagnosticDir, "lifecycle.jsonl");
const crashDumpDir = path.join(diagnosticDir, "crash-dumps");
const requireOpenAndWaitCompletion = new Set([
  "presenter-web-open-and-wait",
  "presenter-store-open-and-wait",
  "presenter-dialog-auto-open-and-wait",
  "presenter-friends-open-and-wait"
]).has(action);
const requireCheckoutCompletion = action === "presenter-checkout";
const fatalTypes = new Set([
  "app:render-process-gone",
  "app:child-process-gone",
  "app:gpu-process-crashed",
  "process:uncaught-exception",
  "process:unhandled-rejection"
]);
const failures = [];

let entries = [];
let lifecycleFailures = [];
const deadline = Date.now() + timeoutSeconds * 1000;
while (true) {
  ({ entries, lifecycleFailures } = readLifecycleEntries());
  if (lifecycleFailures.length === 0 && (hasRequiredCloseEvidence(entries) || Date.now() >= deadline)) {
    break;
  }
  if (lifecycleFailures.length > 0 && Date.now() >= deadline) {
    failures.push(...lifecycleFailures);
    break;
  }
  sleep(200);
}

if (failures.length === 0 && lifecycleFailures.length > 0) {
  failures.push(...lifecycleFailures);
}

const { firstActiveIndex, inactiveAfterActiveIndex } = findOverlayStateIndices(entries);
if (firstActiveIndex == null) {
  failures.push("no active=true overlay callback in lifecycle log");
} else if (inactiveAfterActiveIndex == null) {
  failures.push("no active=false overlay callback after active=true");
} else {
  const reactivatedAfterClose = entries.some((entry, index) => {
    return (
      index > inactiveAfterActiveIndex &&
      entry.type === "event:callback:overlay-activated" &&
      activeValue(entry.payload) === true
    );
  });
  if (reactivatedAfterClose) {
    failures.push("overlay reactivated after close probe");
  }

  const firstAfterClosePresenters = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(({ entry, index }) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-after-close");
  const stableAfterClosePresenters = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(({ entry, index }) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-after-close-stable");
  if (firstAfterClosePresenters.length === 0) {
    failures.push("no overlay:presenter-after-close event after active=false in lifecycle log");
  } else if (!firstAfterClosePresenters.some(({ presenter }) => presenter)) {
    failures.push("overlay:presenter-after-close did not include a presenter snapshot");
  }
  if (stableAfterClosePresenters.length === 0) {
    failures.push("no overlay:presenter-after-close-stable event after active=false in lifecycle log");
  } else if (!stableAfterClosePresenters.some(({ presenter }) => presenter)) {
    failures.push("overlay:presenter-after-close-stable did not include a presenter snapshot");
  }
  const firstPresenter = lastPresenter(firstAfterClosePresenters);
  const stablePresenter = lastPresenter(stableAfterClosePresenters);
  if (firstPresenter && stablePresenter) {
    expectParkedPresenter(firstPresenter, "first sample");
    expectParkedPresenter(stablePresenter, "stable sample");
    if (firstPresenter.pumpCount !== stablePresenter.pumpCount) {
      failures.push(
        `native presenter pump count changed after close: first=${format(firstPresenter.pumpCount)}, stable=${format(stablePresenter.pumpCount)}`
      );
    }
  }

  const waitShownPresenters = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(({ entry, index }) => index > firstActiveIndex && entry.type === "event:overlay:presenter-wait-shown");
  const waitClosedPresenters = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(({ entry, index }) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-wait-closed");
  const waitParkedPresenters = entries
    .map((entry, index) => ({ entry, index, presenter: presenterPayload(entry) }))
    .filter(({ entry, index }) => index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-parked");
  if (waitShownPresenters.length === 0) {
    failures.push("no overlay:presenter-wait-shown event after active=true in lifecycle log");
  } else if (!waitShownPresenters.some(({ presenter }) => presenter)) {
    failures.push("overlay:presenter-wait-shown did not include a presenter snapshot");
  }
  if (waitClosedPresenters.length === 0) {
    failures.push("no overlay:presenter-wait-closed event after active=false in lifecycle log");
  } else if (!waitClosedPresenters.some(({ presenter }) => presenter)) {
    failures.push("overlay:presenter-wait-closed did not include a presenter snapshot");
  }
  if (waitParkedPresenters.length === 0) {
    failures.push("no overlay:presenter-parked event after active=false in lifecycle log");
  } else if (!waitParkedPresenters.some(({ presenter }) => presenter)) {
    failures.push("overlay:presenter-parked did not include a presenter snapshot");
  }

  if (requireOpenAndWaitCompletion) {
    const openAndWaitEntries = entries.filter((entry, index) => {
      return index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-open-and-wait-complete";
    });
    if (openAndWaitEntries.length === 0) {
      failures.push("no overlay:presenter-open-and-wait-complete event after active=false in lifecycle log");
    } else {
      const payload = openAndWaitEntries[openAndWaitEntries.length - 1].payload;
      if (!payload || typeof payload !== "object") {
        failures.push("overlay:presenter-open-and-wait-complete did not include a payload");
      } else {
        const shown = payload.shown;
        const parked = payload.parked;
        if (!shown || typeof shown !== "object") {
          failures.push("overlay:presenter-open-and-wait-complete did not include a shown snapshot");
        } else if (shown.overlayActive !== true) {
          failures.push("openAndWait shown snapshot did not report overlayActive=true");
        }
        if (!parked || typeof parked !== "object") {
          failures.push("overlay:presenter-open-and-wait-complete did not include a parked snapshot");
        } else {
          expectParkedPresenter(parked, "openAndWait parked result");
        }
      }
    }
  }

  if (requireCheckoutCompletion) {
    const checkoutEntries = entries.filter((entry, index) => {
      return index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-checkout-open-and-wait-complete";
    });
    if (checkoutEntries.length === 0) {
      failures.push("no overlay:presenter-checkout-open-and-wait-complete event after active=false in lifecycle log");
    } else {
      const payload = checkoutEntries[checkoutEntries.length - 1].payload;
      if (!payload || typeof payload !== "object") {
        failures.push("overlay:presenter-checkout-open-and-wait-complete did not include a payload");
      } else {
        const shown = payload.shown;
        const parked = payload.parked;
        if (!shown || typeof shown !== "object") {
          failures.push("overlay:presenter-checkout-open-and-wait-complete did not include a shown snapshot");
        } else if (shown.overlayActive !== true) {
          failures.push("checkout shown snapshot did not report overlayActive=true");
        }
        if (!parked || typeof parked !== "object") {
          failures.push("overlay:presenter-checkout-open-and-wait-complete did not include a parked snapshot");
        } else {
          expectParkedPresenter(parked, "checkout parked result");
        }
      }
    }
  }
}

const fatalEntries = entries.filter((entry) => fatalTypes.has(entry.type));
if (fatalEntries.length > 0) {
  failures.push(`fatal lifecycle events recorded after close probe: ${fatalEntries.map((entry) => entry.type).join(", ")}`);
}

const crashDumps = listCrashDumps(crashDumpDir);
if (crashDumps.length > 0) {
  failures.push(`crash dump files found after close probe: ${crashDumps.join(", ")}`);
}

if (requireSmokeProcess) {
  const expectedSmokePid = readResultPid();
  const processSnapshot = childProcess.spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" });
  if (processSnapshot.status !== 0) {
    failures.push("could not read process list after close probe");
  } else if (!processSnapshot.stdout.split(/\r?\n/).some((line) => isSmokeAppMainProcess(line, expectedSmokePid))) {
    const expectedMessage = expectedSmokePid ? ` with pid ${expectedSmokePid}` : "";
    failures.push(`SteamBridgeSmoke process${expectedMessage} is not running after close probe`);
  }
  const frontmostSnapshot = childProcess.spawnSync(
    "osascript",
    ["-e", 'tell application "System Events" to get name of first application process whose frontmost is true'],
    { encoding: "utf8" }
  );
  const frontmostName = String(frontmostSnapshot.stdout || "").trim();
  if (frontmostSnapshot.status !== 0 || !/SteamBridgeSmoke/i.test(frontmostName)) {
    failures.push(`frontmost app after close probe is not SteamBridgeSmoke: ${format(frontmostName)}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`macOS close verification failed: ${failure}`);
  }
  process.exit(1);
}

const focusMessage = requireSmokeProcess ? ", app frontmost" : "";
console.log(`macOS overlay close verified: active=false observed, openAndWait completed after close when applicable, presenter parked idle without pumping${focusMessage}, no crash evidence.`);

function readLifecycleEntries() {
  const loadedEntries = [];
  const loadFailures = [];
  try {
    const text = fs.readFileSync(lifecyclePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      try {
        loadedEntries.push(JSON.parse(line));
      } catch (error) {
        loadFailures.push(`invalid lifecycle JSON: ${error.message}`);
      }
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      loadFailures.push(`missing lifecycle log: ${lifecyclePath}`);
    } else {
      loadFailures.push(`could not read lifecycle log: ${error.message}`);
    }
  }
  return { entries: loadedEntries, lifecycleFailures: loadFailures };
}

function activeValue(payload) {
  if (payload === true || payload === 1) {
    return true;
  }
  if (payload === false || payload === 0) {
    return false;
  }
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const activePayload = payload["0"] && typeof payload["0"] === "object" ? payload["0"] : payload;
  for (const key of ["active", "m_bActive"]) {
    if (activePayload[key] === true || activePayload[key] === 1) {
      return true;
    }
    if (activePayload[key] === false || activePayload[key] === 0) {
      return false;
    }
  }
  return undefined;
}

function findOverlayStateIndices(loadedEntries) {
  const states = loadedEntries
    .map((entry, index) => ({ index, state: entry.type === "event:callback:overlay-activated" ? activeValue(entry.payload) : undefined }))
    .filter(({ state }) => state === true || state === false);
  const firstActiveIndex = states.find(({ state }) => state === true)?.index;
  const inactiveAfterActiveIndex =
    firstActiveIndex == null ? undefined : states.find(({ index, state }) => index > firstActiveIndex && state === false)?.index;
  return { firstActiveIndex, inactiveAfterActiveIndex };
}

function hasRequiredCloseEvidence(loadedEntries) {
  const { inactiveAfterActiveIndex } = findOverlayStateIndices(loadedEntries);
  if (inactiveAfterActiveIndex == null) {
    return false;
  }
  const hasStableClose = loadedEntries.some((entry, index) => {
    return index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-after-close-stable";
  });
  if (!hasStableClose) {
    return false;
  }
  if (!requireOpenAndWaitCompletion && !requireCheckoutCompletion) {
    return true;
  }
  if (requireOpenAndWaitCompletion) {
    return loadedEntries.some((entry, index) => {
      return index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-open-and-wait-complete";
    });
  }
  return loadedEntries.some((entry, index) => {
    return index > inactiveAfterActiveIndex && entry.type === "event:overlay:presenter-checkout-open-and-wait-complete";
  });
}

function presenterPayload(entry) {
  const payload = entry && entry.payload;
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  return payload.presenter && typeof payload.presenter === "object" ? payload.presenter : undefined;
}

function lastPresenter(items) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index].presenter) {
      return items[index].presenter;
    }
  }
  return undefined;
}

function expectParkedPresenter(presenter, label) {
  expectPresenterField(presenter, "closed", false, `native presenter closed ${label}`);
  expectPresenterField(presenter, "attached", true, `native presenter attached ${label}`);
  expectPresenterField(presenter, "nativeHostOpen", true, `native presenter host open ${label}`);
  expectPresenterField(presenter, "mode", "passive", `native presenter mode ${label}`);
  expectPresenterField(presenter, "clickThrough", true, `native presenter click-through ${label}`);
  expectPresenterField(presenter, "focusable", false, `native presenter focusable ${label}`);
  expectPresenterField(presenter, "transparent", true, `native presenter transparent ${label}`);
  expectPresenterField(presenter, "overlayActive", false, `native presenter overlay active ${label}`);
  expectPresenterField(presenter, "idleFps", 0, `native presenter idle FPS ${label}`);
  expectPresenterField(presenter, "currentFps", 0, `native presenter current FPS ${label}`);
  expectPresenterField(presenter, "overlayNeedsPresent", false, `native presenter overlay needs present ${label}`);
}

function expectPresenterField(presenter, key, expected, label) {
  if (presenter[key] !== expected) {
    failures.push(`${label} expected ${format(expected)}, got ${format(presenter[key])}`);
  }
}

function listCrashDumps(root) {
  const crashDumps = [];
  walk(root);
  return crashDumps;

  function walk(currentPath) {
    let entriesForPath;
    try {
      entriesForPath = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return;
      }
      failures.push(`could not read crash dump directory: ${error.message}`);
      return;
    }
    for (const entry of entriesForPath) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (/\.(?:dmp|mdmp|dump|crash)$/i.test(entry.name)) {
        crashDumps.push(path.relative(root, entryPath));
      }
    }
  }
}

function readResultPid() {
  try {
    const resultText = fs.readFileSync(resultFile, "utf8");
    const resultLine = resultText
      .split(/\r?\n/)
      .reverse()
      .find((line) => line.startsWith("STEAM_BRIDGE_SMOKE_RESULT "));
    if (!resultLine) {
      return undefined;
    }
    const parsed = JSON.parse(resultLine.slice("STEAM_BRIDGE_SMOKE_RESULT ".length));
    const pid = parsed && parsed.snapshot && parsed.snapshot.process && parsed.snapshot.process.pid;
    return Number.isSafeInteger(pid) && pid > 0 ? pid : undefined;
  } catch (_error) {
    return undefined;
  }
}

function isSmokeAppMainProcess(processLine, expectedPid) {
  const match = String(processLine).match(/^\s*(\d+)\s+(.+)$/);
  const pid = match ? Number(match[1]) : undefined;
  const command = match ? match[2] : String(processLine);
  const executableMatches =
    /\/Contents\/MacOS\/SteamBridgeSmoke(?:\.electron)?(?:\s|$)/.test(command) &&
    !/\/Helpers\//.test(command);
  if (!executableMatches) {
    return false;
  }
  if (expectedPid) {
    return pid === expectedPid;
  }
  return (
    command.includes(`--steam-bridge-smoke-result-file=${resultFile}`)
  );
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function format(value) {
  return JSON.stringify(value);
}
NODE
}

run_self_test() {
  local temp_result launch_options temp_home old_home shortcut_file expected_game_id matches resolved
  temp_result="$(mktemp "${TMPDIR:-/tmp}/steam-bridge-macos-helper.XXXXXX")"
  result_file="$temp_result"
  diagnostic_dir="$result_file.diagnostics"
  cat >"$result_file" <<'EOF'
STEAM_BRIDGE_SMOKE_RESULT {"ok":true,"action":{"ok":true,"action":"presenter-web"},"snapshot":{"app":{"appId":480,"shortcutTarget":"friends"},"process":{"pid":4242,"platform":"darwin","arch":"arm64"},"launch":{"steamLaunch":true,"overlayInjection":true},"crashDiagnostics":{"available":true,"ok":true,"crashDumps":[],"fatalLifecycleEvents":[]},"overlay":{"nativePresenter":{"ok":true,"value":{"backend":"macos-metal","attached":true,"nativeHostOpen":true,"mode":"passive","clickThrough":true,"focusable":false,"transparent":true,"overlayActive":false,"overlayNeedsPresent":false,"idleFps":0,"currentFps":0,"electronOverlay":{"presenterMode":"persistent","closeWithWindow":true,"autoPrepareForNotifications":true,"overlayShortcut":{"enabled":true,"preventDefault":true,"targetType":"friends","target":{"type":"friends"}}}}}},"steam":{"initialized":true,"running":{"ok":true,"value":true},"appId":{"ok":true,"value":480},"steamDeck":{"ok":true,"value":false},"bigPicture":{"ok":true,"value":false},"overlayEnabled":{"ok":true,"value":true},"overlayNeedsPresent":{"ok":true,"value":false}},"events":[{"type":"overlay:presenter-open"},{"type":"callback:overlay-activated","payload":{"active":true}}]}}
EOF
  mkdir -p "$diagnostic_dir/crash-dumps"
  cat >"$diagnostic_dir/lifecycle.jsonl" <<'EOF'
{"type":"event:callback:overlay-activated","payload":{"active":true}}
{"type":"event:overlay:presenter-wait-shown","payload":{"presenter":{"closed":false,"attached":true,"nativeHostOpen":true,"mode":"active","clickThrough":false,"focusable":false,"transparent":false,"overlayActive":true,"idleFps":0,"currentFps":30,"overlayNeedsPresent":false,"pumpCount":5}}}
{"type":"event:callback:overlay-activated","payload":{"active":false}}
{"type":"event:overlay:presenter-wait-closed","payload":{"presenter":{"closed":false,"attached":true,"nativeHostOpen":true,"mode":"passive","clickThrough":true,"focusable":false,"transparent":true,"overlayActive":false,"idleFps":0,"currentFps":0,"overlayNeedsPresent":false,"pumpCount":10}}}
{"type":"event:overlay:presenter-after-close","payload":{"presenter":{"closed":false,"attached":true,"nativeHostOpen":true,"mode":"passive","clickThrough":true,"focusable":false,"transparent":true,"overlayActive":false,"idleFps":0,"currentFps":0,"overlayNeedsPresent":false,"pumpCount":10}}}
{"type":"event:overlay:presenter-parked","payload":{"presenter":{"closed":false,"attached":true,"nativeHostOpen":true,"mode":"passive","clickThrough":true,"focusable":false,"transparent":true,"overlayActive":false,"idleFps":0,"currentFps":0,"overlayNeedsPresent":false,"pumpCount":10}}}
{"type":"event:overlay:presenter-open-and-wait-complete","payload":{"shown":{"overlayActive":true},"parked":{"closed":false,"attached":true,"nativeHostOpen":true,"mode":"passive","clickThrough":true,"focusable":false,"transparent":true,"overlayActive":false,"idleFps":0,"currentFps":0,"overlayNeedsPresent":false,"pumpCount":10}}}
{"type":"event:overlay:presenter-after-close-stable","payload":{"presenter":{"closed":false,"attached":true,"nativeHostOpen":true,"mode":"passive","clickThrough":true,"focusable":false,"transparent":true,"overlayActive":false,"idleFps":0,"currentFps":0,"overlayNeedsPresent":false,"pumpCount":10}}}
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
  action="presenter-web-open-and-wait"
  verify_macos_overlay_closed_after_probe "0" "0"

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
  macos_native_launcher="1"
  launch_options="$(smoke_args | paste -sd' ' -)"
  if [[ "$launch_options" != *"--steam-bridge-launch-app-id=480"* ]]; then
    echo "Self-test failed: native launcher options must pass the Steam app ID." >&2
    exit 1
  fi
  if [[ "$launch_options" != *"--steam-bridge-launch-overlay-game-id=480"* ]]; then
    echo "Self-test failed: native launcher options must pass the overlay game ID." >&2
    exit 1
  fi
  if [[ "$launch_options" != *"--steam-bridge-smoke-overlay-dialog=Achievements"* ]]; then
    echo "Self-test failed: launch options must pass the requested overlay dialog." >&2
    exit 1
  fi
  launcher_env_file="/tmp/steam-bridge-macos-smoke.env"
  launch_options="$(smoke_args | paste -sd' ' -)"
  if [[ "$launch_options" != *"--steam-bridge-launch-env-file=/tmp/steam-bridge-macos-smoke.env"* ]]; then
    echo "Self-test failed: native launcher options must pass the launcher env file." >&2
    exit 1
  fi
  if [[ "$launch_options" == *"--steam-bridge-smoke-result-file="* ]]; then
    echo "Self-test failed: launcher env-file options must not include stale smoke result args." >&2
    exit 1
  fi
  if [[ "$launch_options" == *"--steam-bridge-smoke-overlay-dialog=Achievements"* ]]; then
    echo "Self-test failed: launcher env-file options must not include stale per-case smoke args." >&2
    exit 1
  fi
  launcher_env_file=""
  launch_options="$(smoke_args | paste -sd' ' -)"
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
  close_probe="1"
  keep_open_after_result="1"
  launch_options="$(smoke_args | paste -sd' ' -)"
  if [[ "$launch_options" != *"--steam-bridge-smoke-keep-open-after-result"* ]]; then
    echo "Self-test failed: close probes must keep the app open after the initial result." >&2
    exit 1
  fi
  if [[ "$launch_options" != *"--steam-bridge-smoke-autorun-action-delay-ms=2500"* ]]; then
    echo "Self-test failed: launch options must pass the requested action delay." >&2
    exit 1
  fi

  rm -f "$temp_result"
  rm -rf "$diagnostic_dir"
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
    if [ "$close_probe" = "1" ]; then
      echo "--close-probe is only supported with --mode steam-launch or --mode verify." >&2
      exit 2
    fi
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
    if [ "$require_close_deactivated" = "1" ]; then
      verify_macos_overlay_closed_after_probe
    fi
    ;;
  *)
    echo "Unknown mode: $mode" >&2
    usage >&2
    exit 2
    ;;
esac
