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
achievement_name=""
achievement_current=""
achievement_max=""
result_delay_ms="8000"
keep_open_after_result="0"
timeout_seconds="90"
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
  --mode verify                  Verify an existing smoke result log.
  --mode print-launch-options    Print launch options for a Steam shortcut.
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
  --achievement-name NAME        Achievement for presenter-achievement-progress or unlock.
  --achievement-current VALUE    Progress current value.
  --achievement-max VALUE        Progress max value.
  --result-delay-ms MS           Autorun result delay. Defaults to 8000.
  --keep-open-after-result       Write the result but leave the app running.
  --timeout-seconds SECONDS      Result wait timeout. Defaults to 90.
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
  for event_type in "${require_events[@]}"; do
    args+=("--require-event" "$event_type")
  done

  node "${args[@]}"
}

run_self_test() {
  local temp_result launch_options
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

  overlay_dialog="Achievements"
  user_dialog="steamid"
  presenter_mode="session"
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
  verify)
    verify_result
    ;;
  *)
    echo "Unknown mode: $mode" >&2
    usage >&2
    exit 2
    ;;
esac
