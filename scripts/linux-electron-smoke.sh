#!/usr/bin/env bash
set -euo pipefail

mode="direct"
app_dir=""
result_file=""
diagnostic_dir=""
app_id="480"
action="none"
overlay_profile="diagnostic"
overlay_scrub_child_env=""
overlay_isolate_child_processes=""
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
achievement_name=""
achievement_current=""
achievement_max=""
result_delay_ms="8000"
keep_open_after_result="0"
timeout_seconds="90"
shortcut_game_id=""
app_name="Steam Bridge Smoke"
steam_user_id=""
require_steam_launch="0"
require_overlay_ready="0"
require_overlay_injection="0"
require_overlay_activated="0"
require_no_overlay_activation="0"
require_single_overlay_target="0"
require_passive_presenter="0"
require_idle_presenter="0"
require_electron_overlay="0"
require_presenter_mode=""
require_overlay_shortcut_target=""
require_restore_focus_delay_ms=""
require_action_error_code=""
require_action_error_reason=""
require_native_host_unavailable_reason=""
require_no_crashes="0"
require_steam_deck="0"
require_big_picture="0"
require_events=()
self_test_old_home=""
self_test_previous_result_file=""
self_test_temp_home=""

usage() {
  cat <<'EOF'
Usage:
  linux-electron-smoke.sh [options]

Modes:
  --mode direct                  Run SteamBridgeSmoke directly and verify it.
  --mode steam-launch            Launch the Steam shortcut and verify it.
  --mode verify                  Verify an existing smoke result log.
  --mode print-launch-options    Print launch options for a Steam shortcut.
  --mode print-shortcuts         Print matching Steam shortcut IDs.
  --mode self-test               Test shortcut discovery and result verification.

Options:
  --app-dir PATH                 Directory containing SteamBridgeSmoke.
  --result-file PATH             Result log path.
  --diagnostic-dir PATH          Diagnostic log/crash dump directory.
  --app-id ID                    Steam App ID to use. Defaults to 480.
  --action NAME                  none, dialog, friends, store, web, native-probe, native-dialog, native-store, native-web,
                                 presenter-dialog, presenter-dialog-auto, presenter-dialog-auto-open-and-wait,
                                 presenter-store, presenter-store-open-and-wait, presenter-web, presenter-web-open-and-wait,
                                 presenter-friends, presenter-friends-open-and-wait,
                                 presenter-profile, presenter-players, presenter-community, presenter-stats, presenter-achievements, presenter-user, presenter-checkout,
                                 presenter-shortcut, presenter-achievement-progress, presenter-achievement-unlock.
  --overlay-profile NAME         Electron overlay profile. Defaults to diagnostic.
  --overlay-scrub-child-env true|false
                                 Whether to scrub Steam overlay preload entries from Electron child env.
  --overlay-isolate-child-processes true|false
                                 Whether Linux Chromium children should be isolated from Steam overlay hooks.
  --window-mode NAME             Electron window mode: windowed, fullscreen, or borderless.
  --web-url URL                  URL for the web overlay action.
  --web-modal true|false         Whether the web overlay action should request a modal.
  --checkout-url URL             Full Steam checkout URL for presenter-checkout.
  --checkout-transaction-id ID   Steam checkout transaction ID for presenter-checkout.
  --checkout-return-url URL      Optional return URL for transaction checkout.
  --dialog NAME                  Dialog name for dialog/native-dialog/presenter-dialog actions. Defaults to Friends.
  --user-dialog NAME             User dialog name for presenter-user. Defaults to steamid.
  --shortcut-target NAME         Presenter shortcut target: friends, profile, web, store, community,
                                 stats, achievements, user, dialog, or checkout. Defaults to friends.
  --presenter-mode MODE          Managed Electron overlay presenter mode: persistent or session.
                                 Defaults to persistent.
  --achievement-name NAME        Achievement for presenter-achievement-progress or presenter-achievement-unlock.
                                 Defaults to the first suitable public test achievement.
  --achievement-current VALUE    Progress current value. Defaults to 1.
  --achievement-max VALUE        Progress max value. Defaults to the achievement limit or 2.
  --result-delay-ms MS           Autorun result delay. Defaults to 8000.
  --keep-open-after-result       Write the result but leave the app running.
  --timeout-seconds SECONDS      Result wait timeout. Defaults to 90.
  --shortcut-game-id ID|auto     Full steam://rungameid shortcut game ID.
  --app-name NAME                Shortcut name to auto-discover.
  --steam-user-id ID             Restrict shortcut discovery to one userdata ID.
  --require-steam-launch         Require Steam launch markers.
  --require-overlay-ready        Require overlay enabled and needs-present false.
  --require-overlay-injection    Require Linux overlay injection marker.
  --require-overlay-activated    Require callback:overlay-activated active=true.
  --require-no-overlay-activation
                                 Require no callback:overlay-activated active=true event.
  --require-single-overlay-target
                                 Require one gameoverlayui target attached to the app process.
  --require-passive-presenter    Require the reusable presenter to be passive/click-through/transparent.
  --require-idle-presenter       Require --require-passive-presenter plus zero current/idle FPS.
  --require-electron-overlay     Require managed Electron overlay diagnostics in the presenter snapshot.
  --require-presenter-mode MODE  Require managed Electron overlay presenter mode: persistent or session.
  --require-overlay-shortcut-target NAME
                                 Require managed Electron Shift+Tab target type.
  --require-restore-focus-delay-ms MS
                                 Require managed Electron overlay restore focus delay in milliseconds.
  --require-action-error-code CODE
                                 Require the autorun action to fail with this serialized error code.
  --require-action-error-reason REASON
                                 Require the autorun action to fail with this serialized error reason.
  --require-native-host-unavailable-reason REASON
                                 Require managed presenter diagnostics to report this native host unavailable reason.
  --require-no-crashes           Require no crash dumps or fatal Electron lifecycle events.
  --require-steam-deck           Require Steam Deck detection.
  --require-big-picture          Require Big Picture/Game Mode detection.
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
    --overlay-scrub-child-env)
      overlay_scrub_child_env="${2:?missing --overlay-scrub-child-env value}"
      shift 2
      ;;
    --overlay-isolate-child-processes)
      overlay_isolate_child_processes="${2:?missing --overlay-isolate-child-processes value}"
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
    --require-overlay-ready)
      require_overlay_ready="1"
      shift
      ;;
    --require-overlay-injection)
      require_overlay_injection="1"
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
    --require-single-overlay-target)
      require_single_overlay_target="1"
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
    --require-restore-focus-delay-ms)
      require_restore_focus_delay_ms="${2:?missing --require-restore-focus-delay-ms value}"
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
    --require-steam-deck)
      require_steam_deck="1"
      shift
      ;;
    --require-big-picture)
      require_big_picture="1"
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

if [ -z "$result_file" ]; then
  result_file="${TMPDIR:-/tmp}/steam-bridge-smoke-linux-direct.log"
fi
if [ -z "$diagnostic_dir" ]; then
  diagnostic_dir="$result_file.diagnostics"
fi

smoke_exe=""
result_prefix="STEAM_BRIDGE_SMOKE_RESULT "

smoke_args() {
  printf '%s\n' \
    "--no-sandbox" \
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
  if [ -n "$overlay_scrub_child_env" ]; then
    printf '%s\n' "--steam-bridge-electron-overlay-scrub-child-env=$overlay_scrub_child_env"
  fi
  if [ -n "$overlay_isolate_child_processes" ]; then
    printf '%s\n' "--steam-bridge-electron-overlay-isolate-child-processes=$overlay_isolate_child_processes"
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
  if [ -n "$achievement_name" ]; then
    printf '%s\n' "--steam-bridge-smoke-achievement-name=$achievement_name"
  fi
  if [ -n "$achievement_current" ]; then
    printf '%s\n' "--steam-bridge-smoke-achievement-current=$achievement_current"
  fi
  if [ -n "$achievement_max" ]; then
    printf '%s\n' "--steam-bridge-smoke-achievement-max=$achievement_max"
  fi
}

wait_for_result_file() {
  local deadline now
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

ensure_app() {
  resolve_app_dir
  if [ ! -x "$smoke_exe" ]; then
    echo "Missing executable $smoke_exe" >&2
    exit 1
  fi
}

resolve_app_dir() {
  if [ -z "$app_dir" ]; then
    if [ -x "$script_dir/SteamBridgeSmoke" ]; then
      app_dir="$script_dir"
    else
      app_dir="$(pwd)/dist/electron-smoke/x86_64-unknown-linux-gnu/SteamBridgeSmoke-linux-x64"
    fi
  fi

  app_dir="$(cd -- "$app_dir" && pwd)"
  smoke_exe="$app_dir/SteamBridgeSmoke"
}

discover_shortcuts() {
  APP_NAME="$app_name" STEAM_USER_ID="$steam_user_id" python3 <<'PY'
import glob
import json
import os
import sys

TYPE_OBJECT = 0
TYPE_STRING = 1
TYPE_UINT32 = 2
TYPE_END = 8
app_name = os.environ["APP_NAME"]
steam_user_id = os.environ.get("STEAM_USER_ID", "")
home = os.path.expanduser("~")

if steam_user_id:
    paths = [os.path.join(home, ".local/share/Steam/userdata", steam_user_id, "config/shortcuts.vdf")]
else:
    paths = sorted(glob.glob(os.path.join(home, ".local/share/Steam/userdata/*/config/shortcuts.vdf")))

def read_c_string(data, offset):
    end = data.find(b"\0", offset)
    if end < 0:
        raise ValueError("unterminated string")
    return data[offset:end].decode("utf-8"), end + 1

def read_object(data, offset):
    value = {}
    while offset < len(data):
        field_type = data[offset]
        offset += 1
        if field_type == TYPE_END:
            break
        name, offset = read_c_string(data, offset)
        if field_type == TYPE_OBJECT:
            value[name], offset = read_object(data, offset)
        elif field_type == TYPE_STRING:
            value[name], offset = read_c_string(data, offset)
        elif field_type == TYPE_UINT32:
            value[name] = int.from_bytes(data[offset:offset + 4], "little")
            offset += 4
        else:
            raise ValueError(f"unsupported field type {field_type} for {name}")
    return value, offset

matches = []
for path in paths:
    if not os.path.exists(path):
        continue
    data = open(path, "rb").read()
    if not data or data[0] != TYPE_OBJECT:
        continue
    root_name, offset = read_c_string(data, 1)
    shortcuts, _ = read_object(data, offset)
    user_id = path.split("/userdata/", 1)[1].split("/", 1)[0]
    for index, entry in shortcuts.items():
        if not isinstance(entry, dict) or entry.get("appname") != app_name:
            continue
        appid = int(entry["appid"]) & 0xFFFFFFFF
        game_id = (appid << 32) | 0x02000000
        matches.append({
            "userId": user_id,
            "index": index,
            "appid": appid,
            "gameId": str(game_id),
            "appname": entry.get("appname", ""),
            "exe": entry.get("Exe", ""),
            "startDir": entry.get("StartDir", ""),
            "launchOptions": entry.get("LaunchOptions", ""),
            "allowOverlay": entry.get("AllowOverlay"),
        })

for match in matches:
    print(json.dumps(match, sort_keys=True))
PY
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

  ids="$(printf '%s\n' "$matches" | python3 -c 'import json,sys; print("\\n".join(sorted({json.loads(line)["gameId"] for line in sys.stdin if line.strip()})))')"
  if [ "$(printf '%s\n' "$ids" | sed '/^$/d' | wc -l | tr -d ' ')" != "1" ]; then
    echo "Found multiple shortcut game IDs for \"$app_name\"; pass --shortcut-game-id explicitly:" >&2
    printf '%s\n' "$matches" >&2
    return 1
  fi

  resolved="$(printf '%s\n' "$ids" | sed -n '1p')"
  printf '%s\n' "$resolved"
}

verify_result() {
  RESULT_FILE="$result_file" \
  RESULT_PREFIX="$result_prefix" \
  APP_ID="$app_id" \
  ACTION="$action" \
  REQUIRE_STEAM_LAUNCH="$require_steam_launch" \
  REQUIRE_OVERLAY_READY="$require_overlay_ready" \
  REQUIRE_OVERLAY_INJECTION="$require_overlay_injection" \
  REQUIRE_OVERLAY_ACTIVATED="$require_overlay_activated" \
  REQUIRE_NO_OVERLAY_ACTIVATION="$require_no_overlay_activation" \
  REQUIRE_SINGLE_OVERLAY_TARGET="$require_single_overlay_target" \
  REQUIRE_PASSIVE_PRESENTER="$require_passive_presenter" \
  REQUIRE_IDLE_PRESENTER="$require_idle_presenter" \
  REQUIRE_ELECTRON_OVERLAY="$require_electron_overlay" \
  REQUIRE_PRESENTER_MODE="$require_presenter_mode" \
  REQUIRE_OVERLAY_SHORTCUT_TARGET="$require_overlay_shortcut_target" \
  REQUIRE_RESTORE_FOCUS_DELAY_MS="$require_restore_focus_delay_ms" \
  REQUIRE_ACTION_ERROR_CODE="$require_action_error_code" \
  REQUIRE_ACTION_ERROR_REASON="$require_action_error_reason" \
  REQUIRE_NATIVE_HOST_UNAVAILABLE_REASON="$require_native_host_unavailable_reason" \
  REQUIRE_NO_CRASHES="$require_no_crashes" \
  REQUIRE_STEAM_DECK="$require_steam_deck" \
  REQUIRE_BIG_PICTURE="$require_big_picture" \
  REQUIRE_EVENTS="$(IFS=$'\n'; printf '%s' "${require_events[*]}")" \
  python3 <<'PY'
import json
import os
import sys

path = os.environ["RESULT_FILE"]
prefix = os.environ["RESULT_PREFIX"]
expected_app_id = int(os.environ["APP_ID"])
expected_action = os.environ["ACTION"]
expected_action_error_code = os.environ.get("REQUIRE_ACTION_ERROR_CODE", "")
expected_action_error_reason = os.environ.get("REQUIRE_ACTION_ERROR_REASON", "")
expected_action_error = bool(expected_action_error_code or expected_action_error_reason)
expected_native_host_unavailable_reason = os.environ.get("REQUIRE_NATIVE_HOST_UNAVAILABLE_REASON", "")
required_events = [entry for entry in os.environ.get("REQUIRE_EVENTS", "").splitlines() if entry]

with open(path, "r", encoding="utf-8") as handle:
    lines = [line.rstrip("\n") for line in handle]

line = next((entry for entry in reversed(lines) if entry.startswith(prefix)), None)
if line is None:
    raise SystemExit(f"Missing {prefix.strip()} line in {path}")

result = json.loads(line[len(prefix):])
snapshot = result.get("snapshot") or {}
steam = snapshot.get("steam") or {}
app = snapshot.get("app") or {}
launch = snapshot.get("launch") or {}
process_info = snapshot.get("process") or {}
overlay_processes = snapshot.get("overlayProcesses") or {}
crash_diagnostics = snapshot.get("crashDiagnostics") or {}
overlay = snapshot.get("overlay") or {}
events = snapshot.get("events") or []
failures = []

def ok_value(entry):
    return entry.get("value") if isinstance(entry, dict) and entry.get("ok") is True else None

native_presenter = ok_value(overlay.get("nativePresenter"))
electron_overlay = native_presenter.get("electronOverlay") if isinstance(native_presenter, dict) else None

def overlay_active_event(event):
    if not isinstance(event, dict) or event.get("type") != "callback:overlay-activated":
        return False
    payload = event.get("payload")
    if payload is True or payload == 1:
        return True
    if not isinstance(payload, dict):
        return False
    active_payload = payload.get("0") if isinstance(payload.get("0"), dict) else payload
    return (
        active_payload.get("active") is True
        or active_payload.get("active") == 1
        or active_payload.get("m_bActive") is True
        or active_payload.get("m_bActive") == 1
    )

overlay_activated = any(overlay_active_event(event) for event in events)

def expect(condition, message):
    if not condition:
        failures.append(message)

if expected_action_error:
    expect(result.get("ok") is False, "smoke result failed with expected action error")
else:
    expect(result.get("ok") is True, "smoke result ok")
expect(steam.get("initialized") is True, "Steam initialized")
expect(ok_value(steam.get("running")) is True, "Steam running")
expect(ok_value(steam.get("appId")) == app.get("appId"), "Steam App ID matches app config")
expect(app.get("appId") == expected_app_id, f"app ID is {expected_app_id}")
expect(process_info.get("platform") == "linux", "platform is linux")
expect(process_info.get("arch") == "x64", "arch is x64")

if expected_action:
    action = result.get("action") or {}
    expect(action.get("action") == expected_action, f"autorun action is {expected_action}")
    if expected_action_error:
        expect(action.get("ok") is False, f"autorun action {expected_action} failed with expected error")
    else:
        expect(action.get("ok") is True, f"autorun action {expected_action} succeeded")
if expected_action_error:
    action_error = (result.get("action") or {}).get("error")
    expect(isinstance(action_error, dict), "autorun action error is serialized")
    if isinstance(action_error, dict):
        if expected_action_error_code:
            expect(
                action_error.get("code") == expected_action_error_code,
                f"autorun action error code is {expected_action_error_code}",
            )
        if expected_action_error_reason:
            expect(
                action_error.get("reason") == expected_action_error_reason,
                f"autorun action error reason is {expected_action_error_reason}",
            )
if expected_native_host_unavailable_reason:
    expect(isinstance(native_presenter, dict), "native presenter snapshot available")
    if isinstance(native_presenter, dict):
        expect(
            native_presenter.get("nativeHostUnavailableReason") == expected_native_host_unavailable_reason,
            f"native host unavailable reason is {expected_native_host_unavailable_reason}",
        )
        expect(native_presenter.get("attached") is False, "native presenter is not attached while host is unavailable")
        expect(native_presenter.get("nativeHostOpen") is False, "native presenter host is closed while unavailable")
        expect(native_presenter.get("currentFps") == 0, "native presenter current FPS is zero while unavailable")
        expected_environment = {
            "macos-screen-locked": {"screenLocked": True, "displayAsleep": False},
            "macos-display-asleep": {"screenLocked": False, "displayAsleep": True},
        }.get(expected_native_host_unavailable_reason)
        if expected_environment is not None:
            expect(
                native_presenter.get("macOverlayEnvironment") == expected_environment,
                f"mac overlay environment matches {expected_native_host_unavailable_reason}",
            )
if os.environ["REQUIRE_STEAM_LAUNCH"] == "1":
    expect(launch.get("steamLaunch") is True, "Steam launch marker detected")
if os.environ["REQUIRE_OVERLAY_READY"] == "1":
    expect(ok_value(steam.get("overlayEnabled")) is True, "overlay enabled")
    expect(
        ok_value(steam.get("overlayNeedsPresent")) is False or overlay_activated,
        "overlay does not need present or emitted active overlay callback",
    )
if os.environ["REQUIRE_OVERLAY_INJECTION"] == "1":
    expect(launch.get("overlayInjection") is True, "Steam overlay injection marker detected")
if os.environ["REQUIRE_OVERLAY_ACTIVATED"] == "1":
    expect(overlay_activated, "overlay activation callback active=true emitted")
if os.environ["REQUIRE_NO_OVERLAY_ACTIVATION"] == "1":
    expect(not overlay_activated, "overlay activation callback active=true was not emitted")
if os.environ["REQUIRE_SINGLE_OVERLAY_TARGET"] == "1":
    gameoverlayui = [
        entry
        for entry in overlay_processes.get("gameoverlayui") or []
        if isinstance(entry, dict) and entry.get("targetPid") is not None
    ]
    expect(overlay_processes.get("available") is True, "overlay process snapshot available")
    expect(len(gameoverlayui) == 1, "exactly one gameoverlayui target detected")
    if gameoverlayui:
        expect(gameoverlayui[0].get("targetPid") == process_info.get("pid"), "gameoverlayui targets the smoke app process")
if os.environ["REQUIRE_PASSIVE_PRESENTER"] == "1" or os.environ["REQUIRE_IDLE_PRESENTER"] == "1":
    expect(isinstance(native_presenter, dict), "native presenter snapshot available")
    if isinstance(native_presenter, dict):
        expect(native_presenter.get("attached") is True, "native presenter attached")
        expect(native_presenter.get("nativeHostOpen") is True, "native presenter host open")
        expect(native_presenter.get("mode") == "passive", "native presenter is passive")
        expect(native_presenter.get("clickThrough") is True, "native presenter is click-through")
        expect(native_presenter.get("focusable") is False, "native presenter is non-focusable")
        expect(native_presenter.get("transparent") is True, "native presenter is transparent")
        expect(native_presenter.get("overlayActive") is False, "native presenter overlay inactive")
if os.environ["REQUIRE_IDLE_PRESENTER"] == "1" and isinstance(native_presenter, dict):
    expect(native_presenter.get("idleFps") == 0, "native presenter idle FPS is zero")
    expect(native_presenter.get("currentFps") == 0, "native presenter current FPS is zero")
    expect(native_presenter.get("overlayNeedsPresent") is False, "native presenter overlay does not need present")
if (
    os.environ["REQUIRE_ELECTRON_OVERLAY"] == "1"
    or os.environ["REQUIRE_PRESENTER_MODE"]
    or os.environ["REQUIRE_OVERLAY_SHORTCUT_TARGET"]
    or os.environ["REQUIRE_RESTORE_FOCUS_DELAY_MS"]
):
    expect(isinstance(electron_overlay, dict), "managed Electron overlay diagnostics available")
    if isinstance(electron_overlay, dict):
        expect(
            electron_overlay.get("autoPrepareForNotifications") is True,
            "managed Electron overlay automatic notification priming is enabled",
        )
if os.environ["REQUIRE_PRESENTER_MODE"] and isinstance(electron_overlay, dict):
    expect(
        electron_overlay.get("presenterMode") == os.environ["REQUIRE_PRESENTER_MODE"],
        f"managed Electron presenter mode is {os.environ['REQUIRE_PRESENTER_MODE']}",
    )
if os.environ["REQUIRE_RESTORE_FOCUS_DELAY_MS"] and isinstance(electron_overlay, dict):
    expected_restore_focus_delay_ms = int(os.environ["REQUIRE_RESTORE_FOCUS_DELAY_MS"])
    expect(
        electron_overlay.get("restoreFocusDelayMs") == expected_restore_focus_delay_ms,
        f"managed Electron overlay restore focus delay is {expected_restore_focus_delay_ms}ms",
    )
if os.environ["REQUIRE_OVERLAY_SHORTCUT_TARGET"] and isinstance(electron_overlay, dict):
    overlay_shortcut = electron_overlay.get("overlayShortcut") or {}
    target_type = overlay_shortcut.get("targetType")
    configured_shortcut_target = app.get("shortcutTarget")
    expect(overlay_shortcut.get("enabled") is True, "managed Electron overlay shortcut is enabled")
    expect(
        target_type == os.environ["REQUIRE_OVERLAY_SHORTCUT_TARGET"]
        or (
            target_type == "function"
            and configured_shortcut_target == os.environ["REQUIRE_OVERLAY_SHORTCUT_TARGET"]
        ),
        f"managed Electron overlay shortcut target is {os.environ['REQUIRE_OVERLAY_SHORTCUT_TARGET']}",
    )
if os.environ["REQUIRE_NO_CRASHES"] == "1":
    crash_dumps = crash_diagnostics.get("crashDumps") if isinstance(crash_diagnostics.get("crashDumps"), list) else []
    fatal_lifecycle_events = (
        crash_diagnostics.get("fatalLifecycleEvents")
        if isinstance(crash_diagnostics.get("fatalLifecycleEvents"), list)
        else []
    )
    expect(crash_diagnostics.get("available") is True, "crash diagnostics available")
    expect(crash_diagnostics.get("ok") is True, "no crash diagnostics reported")
    expect(len(crash_dumps) == 0, "no crash dumps found")
    expect(len(fatal_lifecycle_events) == 0, "no fatal lifecycle events recorded")
if os.environ["REQUIRE_STEAM_DECK"] == "1":
    expect(ok_value(steam.get("steamDeck")) is True, "Steam Deck detected")
if os.environ["REQUIRE_BIG_PICTURE"] == "1":
    expect(ok_value(steam.get("bigPicture")) is True, "Big Picture/Game Mode detected")
for event_type in required_events:
    expect(any(event.get("type") == event_type for event in events if isinstance(event, dict)), f"event {event_type} emitted")

if failures:
    for failure in failures:
        print(f"Smoke result failed: {failure}", file=sys.stderr)
    raise SystemExit(1)

print(
    "Electron smoke result verified "
    f"appId={app.get('appId')} "
    f"platform={process_info.get('platform')}/{process_info.get('arch')} "
    f"steamDeck={ok_value(steam.get('steamDeck'))} "
    f"bigPicture={ok_value(steam.get('bigPicture'))} "
    f"overlayEnabled={ok_value(steam.get('overlayEnabled'))} "
    f"overlayNeedsPresent={ok_value(steam.get('overlayNeedsPresent'))} "
    f"overlayActivated={overlay_activated} "
    f"steamLaunch={launch.get('steamLaunch')} "
    f"overlayInjection={launch.get('overlayInjection')} "
    f"action={(result.get('action') or {}).get('action')} "
    f"diagnostics={app.get('diagnosticDir')}"
)
PY
}

steam_command() {
  if [ -n "${STEAM_BIN:-}" ]; then
    printf '%s\n' "$STEAM_BIN"
  elif command -v steam >/dev/null 2>&1; then
    command -v steam
  elif [ -x "$HOME/.steam/root/ubuntu12_32/steam" ]; then
    printf '%s\n' "$HOME/.steam/root/ubuntu12_32/steam"
  else
    echo "Could not find Steam command. Set STEAM_BIN=/path/to/steam." >&2
    return 1
  fi
}

launch_steam_shortcut() {
  local game_id steam_bin
  game_id="$(resolve_shortcut_game_id)"
  steam_bin="$(steam_command)"

  mkdir -p "$(dirname -- "$result_file")"
  rm -f "$result_file"
  rm -rf "$diagnostic_dir"

  local steam_args=()
  if pgrep -fa 'steam.*-steamdeck' >/dev/null 2>&1; then
    steam_args+=("-steamdeck" "-pipewire")
  fi

  echo "Launching steam://rungameid/$game_id"
  "$steam_bin" "${steam_args[@]}" "steam://rungameid/$game_id" >/tmp/steam-bridge-smoke-rungameid.out 2>/tmp/steam-bridge-smoke-rungameid.err &
  wait_for_result_file
  verify_result
}

cleanup_self_test() {
  if [ -n "$self_test_old_home" ]; then
    HOME="$self_test_old_home"
  fi
  result_file="$self_test_previous_result_file"
  if [ -n "$self_test_temp_home" ]; then
    rm -rf "$self_test_temp_home"
  fi
}

run_self_test() {
  local expected_game_id shortcut_file matches resolved
  self_test_temp_home="$(mktemp -d "${TMPDIR:-/tmp}/steam-bridge-linux-helper.XXXXXX")"
  self_test_old_home="$HOME"
  self_test_previous_result_file="$result_file"
  shortcut_file="$self_test_temp_home/.local/share/Steam/userdata/1686541554/config/shortcuts.vdf"
  expected_game_id="$(python3 - <<'PY'
appid = 3855287460
print((appid << 32) | 0x02000000)
PY
)"

  trap cleanup_self_test EXIT

  mkdir -p "$(dirname -- "$shortcut_file")"
  python3 - "$shortcut_file" <<'PY'
import sys

TYPE_OBJECT = 0
TYPE_STRING = 1
TYPE_UINT32 = 2
TYPE_END = 8
out = bytearray()

def byte(value):
    out.append(value)

def cstr(value):
    out.extend(str(value).encode("utf-8"))
    out.append(0)

def string(name, value):
    byte(TYPE_STRING)
    cstr(name)
    cstr(value)

def uint32(name, value):
    byte(TYPE_UINT32)
    cstr(name)
    out.extend(int(value).to_bytes(4, "little"))

byte(TYPE_OBJECT)
cstr("shortcuts")
byte(TYPE_OBJECT)
cstr("0")
uint32("appid", 3855287460)
string("appname", "Steam Bridge Smoke")
string("Exe", '"/tmp/SteamBridgeSmoke"')
string("StartDir", "/tmp/")
string("LaunchOptions", "--steam-bridge-app-id=480")
uint32("AllowOverlay", 1)
byte(TYPE_END)
byte(TYPE_END)
byte(TYPE_END)

with open(sys.argv[1], "wb") as handle:
    handle.write(out)
PY

  HOME="$self_test_temp_home"
  export HOME
  matches="$(discover_shortcuts)"
  if ! printf '%s\n' "$matches" | grep -q "\"gameId\": \"$expected_game_id\""; then
    echo "Self-test failed to discover expected Steam shortcut game ID." >&2
    printf '%s\n' "$matches" >&2
    exit 1
  fi

  resolved="$(resolve_shortcut_game_id)"
  if [ "$resolved" != "$expected_game_id" ]; then
    echo "Self-test resolved $resolved, expected $expected_game_id." >&2
    exit 1
  fi

  result_file="$self_test_temp_home/steam-bridge-smoke-result.log"
  cat >"$result_file" <<'EOF'
STEAM_BRIDGE_SMOKE_RESULT {"ok":true,"action":{"ok":true,"action":"dialog"},"snapshot":{"app":{"appId":480},"process":{"platform":"linux","arch":"x64"},"launch":{"steamLaunch":true,"overlayInjection":true},"crashDiagnostics":{"available":true,"ok":true,"crashDumps":[],"fatalLifecycleEvents":[]},"steam":{"initialized":true,"running":{"ok":true,"value":true},"appId":{"ok":true,"value":480},"steamDeck":{"ok":true,"value":true},"bigPicture":{"ok":true,"value":true},"overlayEnabled":{"ok":true,"value":true},"overlayNeedsPresent":{"ok":true,"value":false}},"events":[{"type":"overlay:dialog"},{"type":"callback:overlay-activated"}]}}
EOF

  action="dialog"
  require_steam_launch="1"
  require_overlay_ready="1"
  require_overlay_injection="1"
  require_steam_deck="1"
  require_big_picture="1"
  require_events=("overlay:dialog" "callback:overlay-activated")
  verify_result

  result_file="$self_test_temp_home/steam-bridge-smoke-single-target.log"
  cat >"$result_file" <<'EOF'
STEAM_BRIDGE_SMOKE_RESULT {"ok":true,"action":{"ok":true,"action":"presenter-web"},"snapshot":{"app":{"appId":480,"shortcutTarget":"friends"},"process":{"pid":4242,"platform":"linux","arch":"x64"},"launch":{"steamLaunch":true,"overlayInjection":true},"crashDiagnostics":{"available":true,"ok":true,"crashDumps":[],"fatalLifecycleEvents":[]},"overlayProcesses":{"available":true,"gameoverlayui":[{"pid":9001,"targetPid":4242,"gameId":"480","command":"gameoverlayui -pid 4242 -gameid 480"}]},"overlay":{"nativePresenter":{"ok":true,"value":{"attached":true,"nativeHostOpen":true,"mode":"passive","clickThrough":true,"focusable":false,"transparent":true,"overlayActive":false,"overlayNeedsPresent":false,"idleFps":0,"currentFps":0,"electronOverlay":{"presenterMode":"persistent","closeWithWindow":true,"autoPrepareForNotifications":true,"restoreFocusDelayMs":0,"activationBoostMs":0,"activeGraceMs":0,"overlayShortcut":{"enabled":true,"preventDefault":true,"targetType":"function"}}}}},"steam":{"initialized":true,"running":{"ok":true,"value":true},"appId":{"ok":true,"value":480},"steamDeck":{"ok":true,"value":true},"bigPicture":{"ok":true,"value":false},"overlayEnabled":{"ok":true,"value":true},"overlayNeedsPresent":{"ok":true,"value":false}},"events":[{"type":"overlay:presenter-open"},{"type":"callback:overlay-activated"}]}}
EOF

  action="presenter-web"
  require_big_picture="0"
  require_single_overlay_target="1"
  require_idle_presenter="1"
  require_passive_presenter="1"
  require_presenter_mode="persistent"
  require_overlay_shortcut_target="friends"
  require_restore_focus_delay_ms="0"
  require_no_crashes="1"
  require_events=("overlay:presenter-open" "callback:overlay-activated")
  verify_result
  require_single_overlay_target="0"
  require_idle_presenter="0"
  require_passive_presenter="0"
  require_presenter_mode=""
  require_overlay_shortcut_target=""
  require_restore_focus_delay_ms=""
  require_no_crashes="0"

  overlay_dialog="Achievements"
  user_dialog="steamid"
  presenter_mode="session"
  launch_options="$(smoke_args | paste -sd' ' -)"
  if [[ "$launch_options" != *"--steam-bridge-smoke-overlay-dialog=Achievements"* ]]; then
    echo "Self-test failed: Launch options must pass the requested overlay dialog." >&2
    exit 1
  fi
  if [[ "$launch_options" != *"--steam-bridge-smoke-user-dialog=steamid"* ]]; then
    echo "Self-test failed: Launch options must pass the requested user dialog." >&2
    exit 1
  fi
  if [[ "$launch_options" != *"--steam-bridge-smoke-presenter-mode=session"* ]]; then
    echo "Self-test failed: Launch options must pass the requested presenter mode." >&2
    exit 1
  fi
  user_dialog=""
  presenter_mode=""

  checkout_transaction_id="123456789"
  checkout_return_url="steam://open/main"
  launch_options="$(smoke_args | paste -sd' ' -)"
  if [[ "$launch_options" != *"--steam-bridge-smoke-checkout-transaction-id=123456789"* ]]; then
    echo "Self-test failed: Launch options must pass the checkout transaction ID." >&2
    exit 1
  fi
  if [[ "$launch_options" != *"--steam-bridge-smoke-checkout-return-url=steam://open/main"* ]]; then
    echo "Self-test failed: Launch options must pass the checkout return URL." >&2
    exit 1
  fi

  echo "Linux Electron smoke helper self-test passed."
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
    mapfile -t args < <(smoke_args)
    (cd "$app_dir" && "$smoke_exe" "${args[@]}")
    wait_for_result_file
    verify_result
    ;;
  steam-launch)
    if [ "${#require_events[@]}" -eq 0 ]; then
      if [ "$action" = "dialog" ]; then
        require_events+=("overlay:dialog")
      elif [ "$action" = "presenter-checkout" ]; then
        if [ -n "$checkout_url" ] || [ -n "$checkout_transaction_id" ]; then
          require_events+=("overlay:presenter-open")
          require_overlay_activated="1"
        else
          require_events+=("overlay:presenter-checkout-ready")
        fi
      fi
    fi
    require_steam_launch="1"
    if [ "$action" != "presenter-checkout" ] || { [ -n "$checkout_url" ] || [ -n "$checkout_transaction_id" ]; }; then
      require_overlay_ready="1"
    fi
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
