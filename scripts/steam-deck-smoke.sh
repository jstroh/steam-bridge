#!/usr/bin/env bash
set -euo pipefail

host="${STEAM_DECK_HOST:-deck@steamdeck.local}"
local_app_dir="${STEAM_BRIDGE_SMOKE_LOCAL_APP_DIR:-}"
remote_app_dir="${STEAM_DECK_SMOKE_REMOTE_APP_DIR:-/home/deck/steam-bridge-smoke/SteamBridgeSmoke-linux-x64}"
remote_wrapper_path="${STEAM_DECK_SMOKE_WRAPPER_PATH:-/home/deck/steam-bridge-smoke/run-smoke-autorun.sh}"
remote_wrapper_env_file="${STEAM_DECK_SMOKE_WRAPPER_ENV_FILE:-/home/deck/steam-bridge-smoke/run-smoke-autorun.env}"
mode="game"
app_id="480"
overlay_game_id="app"
action="dialog"
overlay_profile=""
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
result_file="/tmp/steam-bridge-smoke-steam-launch.log"
result_delay_ms="8000"
keep_open_after_result="0"
control_server="0"
control_file=""
control_token=""
timeout_seconds="90"
shortcut_game_id="auto"
app_name="Steam Bridge Smoke"
steam_user_id=""
connect_timeout="6"
scan_timeout="1"
discover_subnet="${STEAM_DECK_DISCOVERY_SUBNET:-}"
exclude_hosts=()
copy_app="1"
keep_awake="1"
inhibit_seconds="900"
remote_inhibit_pid_file="/tmp/steam-bridge-smoke-inhibit.pid"
collect_diagnostics_dir=""
visual_capture_dir=""
visual_close_probe="0"
visual_close_input="keyboard"
visual_toggle_probe="0"
visual_toggle_input="keyboard"
visual_toggle_open_delay="2"
visual_toggle_open_delay_explicit="0"
require_close_deactivated="0"
require_single_overlay_target="0"
require_passive_presenter="0"
require_idle_presenter="0"
require_electron_overlay="0"
require_presenter_mode=""
require_overlay_shortcut_target=""
require_managed_overlay_isolation="0"
require_restore_focus_delay_ms=""
require_zero_managed_overlay_timing="0"
require_no_crashes="0"

usage() {
  cat <<'EOF'
Usage:
  steam-deck-smoke.sh [options]

Modes:
  --mode game                   Run the Steam-launched Game Mode gate.
  --mode desktop                Run the Steam-launched Desktop Mode gate.
  --mode direct                 Run the app directly on the Deck and verify init.
  --mode cleanup                Retire the exact smoke runtime and orphaned overlay.
  --mode discover               Scan a local /24 for Steam Deck SSH candidates.
  --mode preflight              Check SSH, remote package, Steam, and shortcuts.
  --mode print-shortcuts        Print matching Deck Steam shortcuts.
  --mode print-launch-options   Print shortcut launch options from the Deck helper.
  --mode self-test              Validate this host runner without SSH.

Options:
  --host USER@HOST              SSH target. Defaults to deck@steamdeck.local.
  --local-app-dir PATH          Local Linux x64 SteamBridgeSmoke package directory.
  --remote-app-dir PATH         Remote package directory. Defaults under ~/steam-bridge-smoke.
  --wrapper-path PATH           Remote wrapper script used by the Steam shortcut.
  --skip-copy                   Use the existing remote package directory.
  --app-id ID                   Steam App ID used inside the smoke app. Defaults to 480.
  --overlay-game-id ID|app|shortcut|inherit
                                SteamOverlayGameId value for the wrapper. Defaults to app.
                                app uses --app-id; shortcut uses the full non-Steam shortcut
                                game ID; inherit leaves SteamOverlayGameId untouched.
  --action NAME                 Autorun action. Defaults to dialog. Supports raw dialog/store/web,
                                managed native-* variants, and presenter-* variants,
                                including presenter-ready, presenter-web-open-and-wait,
                                presenter-duplicate-open-guard, presenter-store-open-and-wait,
                                presenter-dialog-auto-open-and-wait,
                                presenter-friends-open-and-wait, presenter-user, and presenter-checkout.
  --overlay-profile NAME        Electron overlay profile. Desktop defaults to repaint.
  --overlay-scrub-child-env true|false
                                Whether to scrub Steam overlay preload entries from Electron child env.
  --overlay-isolate-child-processes true|false
                                Whether Linux Chromium children should be isolated from Steam overlay hooks.
  --window-mode NAME            Electron window mode: windowed, fullscreen, or borderless.
  --web-url URL                 URL for the web overlay action.
  --web-modal true|false        Whether the web overlay action should request a modal.
  --checkout-url URL            Full Steam checkout URL for presenter-checkout.
  --checkout-transaction-id ID  Steam checkout transaction ID for presenter-checkout.
  --checkout-return-url URL     Optional return URL for transaction checkout.
  --dialog NAME                 Dialog name for dialog/native-dialog/presenter-dialog actions.
                                Defaults to Friends.
  --user-dialog NAME            User dialog name for presenter-user. Defaults to steamid.
  --shortcut-target NAME        Presenter shortcut target: friends, profile, players, web, store,
                                community, stats, achievements, user, dialog, or checkout. Defaults to friends.
  --presenter-mode MODE         Managed Electron overlay presenter mode: persistent or session.
                                Defaults to persistent.
  --achievement-name NAME       Achievement for presenter-achievement-progress or presenter-achievement-unlock.
                                Defaults to the first suitable public test achievement.
  --achievement-current VALUE   Progress current value. Defaults to 1.
  --achievement-max VALUE       Progress max value. Defaults to the achievement limit or 2.
  --result-file PATH            Remote result log path.
  --result-delay-ms MS          Autorun result delay. Defaults to 8000.
  --keep-open-after-result      Write the result but leave the app running.
  --control-server              Start the smoke app's localhost control server.
  --control-file PATH           File where the smoke app writes control connection JSON.
  --control-token TOKEN         Token required by the localhost control server.
  --timeout-seconds SECONDS     Result wait timeout. Defaults to 90.
  --shortcut-game-id ID|auto    Full steam://rungameid shortcut ID. Defaults to auto.
  --app-name NAME               Shortcut name to auto-discover.
  --steam-user-id ID            Restrict shortcut discovery to one userdata ID.
  --discover-subnet PREFIX      IPv4 /24 prefix to scan, for example 192.168.1.
  --exclude-host IP             Skip an IP during discovery. May be repeated.
  --scan-timeout SECONDS        SSH port scan timeout. Defaults to 1.
  --no-keep-awake               Do not start a temporary systemd sleep inhibitor.
  --inhibit-seconds SECONDS     Sleep inhibitor duration. Defaults to 900.
  --collect-diagnostics-dir PATH
                                Copy the remote result log and diagnostics dir to this local path.
  --visual-capture-dir PATH     Capture Deck screenshots to this local path after the run returns.
  --visual-close-probe          With --visual-capture-dir and --keep-open-after-result, send a
                                close probe and capture the result.
  --visual-close-input MODE     Close input for --visual-close-probe: keyboard, toggle, escape, web, or both.
                                keyboard sends Shift+Tab then Escape. toggle sends Shift+Tab only.
                                escape sends Escape to SteamUI's Xwayland display. web clicks the Steam
                                web overlay close control. Defaults to keyboard.
  --require-close-deactivated   After --visual-close-probe, require active=false, app focus, and no crash evidence.
  --visual-toggle-probe         With --visual-capture-dir and --keep-open-after-result, capture
                                before toggling, after opening, and after closing the overlay.
  --visual-toggle-input MODE    Toggle input for --visual-toggle-probe: keyboard, guide, or both.
                                keyboard sends Shift+Tab. guide sends the controller Guide/Steam
                                button through a temporary uinput device. Defaults to keyboard.
  --visual-toggle-open-delay SECONDS
                                Extra delay before capturing the opened overlay during
                                --visual-toggle-probe. Managed shortcut probes first wait
                                for lifecycle evidence. Defaults to 2 for raw probes.
  --require-single-overlay-target
                                Require one gameoverlayui target attached to the smoke app.
  --require-passive-presenter   Require the reusable presenter to be passive/click-through/transparent.
  --require-idle-presenter      Require --require-passive-presenter plus zero current/idle FPS.
  --require-electron-overlay    Require managed Electron overlay diagnostics in the presenter snapshot.
  --require-presenter-mode MODE Require managed Electron overlay presenter mode: persistent or session.
  --require-overlay-shortcut-target NAME
                                Require managed Electron Shift+Tab target type.
  --require-managed-overlay-isolation
                                Require managed Electron child-process overlay isolation diagnostics.
  --require-restore-focus-delay-ms MS
                                Require managed Electron overlay restore focus delay in milliseconds.
  --require-zero-managed-overlay-timing
                                Require managed Electron restore-focus, activation boost, and active grace timing to be zero.
  --require-no-crashes          Require no crash dumps or fatal Electron lifecycle events.
  --connect-timeout SECONDS     SSH connect timeout. Defaults to 6.
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
    --host)
      host="${2:?missing --host value}"
      shift 2
      ;;
    --local-app-dir)
      local_app_dir="${2:?missing --local-app-dir value}"
      shift 2
      ;;
    --remote-app-dir)
      remote_app_dir="${2:?missing --remote-app-dir value}"
      shift 2
      ;;
    --wrapper-path)
      remote_wrapper_path="${2:?missing --wrapper-path value}"
      remote_wrapper_env_file="${remote_wrapper_path%/*}/$(basename -- "$remote_wrapper_path" .sh).env"
      shift 2
      ;;
    --skip-copy)
      copy_app="0"
      shift
      ;;
    --app-id)
      app_id="${2:?missing --app-id value}"
      shift 2
      ;;
    --overlay-game-id)
      overlay_game_id="${2:?missing --overlay-game-id value}"
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
    --result-file)
      result_file="${2:?missing --result-file value}"
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
    --control-server)
      control_server="1"
      shift
      ;;
    --control-file)
      control_file="${2:?missing --control-file value}"
      shift 2
      ;;
    --control-token)
      control_token="${2:?missing --control-token value}"
      shift 2
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
    --discover-subnet)
      discover_subnet="${2:?missing --discover-subnet value}"
      shift 2
      ;;
    --exclude-host)
      exclude_hosts+=("${2:?missing --exclude-host value}")
      shift 2
      ;;
    --scan-timeout)
      scan_timeout="${2:?missing --scan-timeout value}"
      shift 2
      ;;
    --no-keep-awake)
      keep_awake="0"
      shift
      ;;
    --inhibit-seconds)
      inhibit_seconds="${2:?missing --inhibit-seconds value}"
      shift 2
      ;;
    --collect-diagnostics-dir)
      collect_diagnostics_dir="${2:?missing --collect-diagnostics-dir value}"
      shift 2
      ;;
    --visual-capture-dir)
      visual_capture_dir="${2:?missing --visual-capture-dir value}"
      shift 2
      ;;
    --visual-close-probe)
      visual_close_probe="1"
      shift
      ;;
    --visual-close-input)
      visual_close_input="${2:?missing --visual-close-input value}"
      shift 2
      ;;
    --require-close-deactivated)
      require_close_deactivated="1"
      shift
      ;;
    --visual-toggle-probe)
      visual_toggle_probe="1"
      shift
      ;;
    --visual-toggle-input)
      visual_toggle_input="${2:?missing --visual-toggle-input value}"
      shift 2
      ;;
    --visual-toggle-open-delay)
      visual_toggle_open_delay="${2:?missing --visual-toggle-open-delay value}"
      visual_toggle_open_delay_explicit="1"
      shift 2
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
    --require-managed-overlay-isolation)
      require_managed_overlay_isolation="1"
      require_electron_overlay="1"
      shift
      ;;
    --require-restore-focus-delay-ms)
      require_restore_focus_delay_ms="${2:?missing --require-restore-focus-delay-ms value}"
      require_electron_overlay="1"
      shift 2
      ;;
    --require-zero-managed-overlay-timing)
      require_zero_managed_overlay_timing="1"
      require_electron_overlay="1"
      shift
      ;;
    --require-no-crashes)
      require_no_crashes="1"
      shift
      ;;
    --connect-timeout)
      connect_timeout="${2:?missing --connect-timeout value}"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$visual_toggle_input" in
  keyboard|guide|both)
    ;;
  *)
    echo "Unknown --visual-toggle-input: $visual_toggle_input" >&2
    usage >&2
    exit 2
    ;;
esac

case "$visual_close_input" in
  keyboard|toggle|escape|web|both)
    ;;
  *)
    echo "Unknown --visual-close-input: $visual_close_input" >&2
    usage >&2
    exit 2
    ;;
esac

presenter_mode="$(printf '%s' "$presenter_mode" | tr '[:upper:]' '[:lower:]')"
case "$presenter_mode" in
  ""|persistent|session)
    ;;
  *)
    echo "Unknown --presenter-mode: $presenter_mode" >&2
    usage >&2
    exit 2
    ;;
esac

if [ "$control_server" = "1" ] && [ -z "$control_file" ]; then
  echo "--control-server requires --control-file so a later QA action can discover the localhost endpoint." >&2
  exit 2
fi
if [ "$control_server" != "1" ] && { [ -n "$control_file" ] || [ -n "$control_token" ]; }; then
  echo "--control-file and --control-token require --control-server." >&2
  exit 2
fi

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
kwin_active_window_probe="$repo_root/scripts/kwin-active-window-probe.js"
remote_kwin_active_window_probe="/tmp/steam-bridge-kwin-active-window-probe.js"
if [ -z "$local_app_dir" ]; then
  local_app_dir="$repo_root/dist/electron-smoke/x86_64-unknown-linux-gnu/SteamBridgeSmoke-linux-x64"
fi

quote_arg() {
  printf '%q' "$1"
}

quote_args() {
  local quoted=()
  local arg
  for arg in "$@"; do
    quoted+=("$(quote_arg "$arg")")
  done
  printf '%s' "${quoted[*]}"
}

remote_exec() {
  ssh -o BatchMode=yes -o ConnectTimeout="$connect_timeout" "$host" "$1"
}

copy_kwin_active_window_probe() {
  scp -q -o BatchMode=yes -o ConnectTimeout="$connect_timeout" \
    "$kwin_active_window_probe" \
    "$host:$remote_kwin_active_window_probe"
}

collect_remote_diagnostics() {
  if [ -z "$collect_diagnostics_dir" ]; then
    return 0
  fi

  local result_q diagnostics_q result_target
  result_q="$(quote_arg "$result_file")"
  diagnostics_q="$(quote_arg "$result_file.diagnostics")"
  result_target="$collect_diagnostics_dir/$(basename -- "$result_file")"

  mkdir -p "$collect_diagnostics_dir"
  echo "Collecting Deck diagnostics into $collect_diagnostics_dir"

  if remote_exec "test -f $result_q" >/dev/null 2>&1; then
    scp -q -o BatchMode=yes -o ConnectTimeout="$connect_timeout" "$host:$result_file" "$result_target"
    echo "Collected result log: $result_target"
  else
    echo "Remote result log was not found: $result_file" >&2
  fi

  if remote_exec "test -d $diagnostics_q" >/dev/null 2>&1; then
    scp -qr -o BatchMode=yes -o ConnectTimeout="$connect_timeout" "$host:$result_file.diagnostics" "$collect_diagnostics_dir/"
    echo "Collected diagnostics dir: $collect_diagnostics_dir/$(basename -- "$result_file").diagnostics"
  else
    echo "Remote diagnostics dir was not found: $result_file.diagnostics" >&2
  fi
}

capture_deck_screenshot() {
  local label="$1"
  if [ -z "$visual_capture_dir" ]; then
    return 0
  fi

  local remote_path local_path remote_path_q
  remote_path="/tmp/steam-bridge-smoke-$label.png"
  local_path="$visual_capture_dir/$label.png"
  remote_path_q="$(quote_arg "$remote_path")"

  mkdir -p "$visual_capture_dir"
  echo "Capturing Deck screenshot: $label"
  remote_exec "export DISPLAY=\"\${DISPLAY:-:0}\"; if [ -z \"\${XAUTHORITY:-}\" ]; then XAUTHORITY=\"\$(ls /run/user/1000/xauth_* 2>/dev/null | head -n 1 || true)\"; export XAUTHORITY; fi; export DBUS_SESSION_BUS_ADDRESS=\"\${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/1000/bus}\"; rm -f $remote_path_q; if systemctl --user is-active --quiet gamescope-session.service 2>/dev/null && command -v gamescopectl >/dev/null 2>&1; then
  gamescopectl screenshot $remote_path_q
  for attempt in \$(seq 1 50); do
    [ -s $remote_path_q ] && break
    sleep 0.1
  done
  [ -s $remote_path_q ] || { echo 'Gamescope screenshot was not written.' >&2; exit 1; }
elif command -v spectacle >/dev/null 2>&1; then
  for attempt in 1 2 3; do
    rm -f $remote_path_q
    if timeout 15 spectacle -b -n -o $remote_path_q >/dev/null 2>&1 && [ -s $remote_path_q ]; then
      break
    fi
    sleep 0.5
  done
  [ -s $remote_path_q ] || { echo 'Spectacle screenshot was not written after three attempts.' >&2; exit 1; }
elif command -v gnome-screenshot >/dev/null 2>&1; then
  gnome-screenshot -f $remote_path_q
else
  echo 'No screenshot tool found on Deck.' >&2
  exit 127
fi"
  scp -q -o BatchMode=yes -o ConnectTimeout="$connect_timeout" "$host:$remote_path" "$local_path"
  echo "Screenshot saved: $local_path"
}

capture_deck_overlay_state() {
  local label="$1"
  if [ -z "$visual_capture_dir" ]; then
    return 0
  fi

  local local_path
  local_path="$visual_capture_dir/$label-state.txt"

  mkdir -p "$visual_capture_dir"
  echo "Capturing Deck overlay state: $label"
  remote_exec "export DISPLAY=\"\${DISPLAY:-:0}\"
if systemctl --user is-active --quiet gamescope-session.service 2>/dev/null &&
  DISPLAY=:1 xdotool getdisplaygeometry >/dev/null 2>&1; then
  export DISPLAY=:1
fi
if [ -z \"\${XAUTHORITY:-}\" ]; then
  XAUTHORITY=\"\$(ls /run/user/1000/xauth_* 2>/dev/null | head -n 1 || true)\"
  export XAUTHORITY
fi
export DBUS_SESSION_BUS_ADDRESS=\"\${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/1000/bus}\"
capture_pid=\"\$\$\"

echo '== timestamp =='
date -Is 2>/dev/null || date
echo

echo '== focused-window =='
if command -v xdotool >/dev/null 2>&1; then
  focus_id=\"\$(xdotool getwindowfocus 2>/dev/null || true)\"
  echo \"focus_id=\$focus_id\"
  if [ -n \"\$focus_id\" ]; then
    echo -n 'focus_name='
    xdotool getwindowname \"\$focus_id\" 2>/dev/null || true
    echo -n 'focus_pid='
    xdotool getwindowpid \"\$focus_id\" 2>/dev/null || true
    if command -v xprop >/dev/null 2>&1; then
      xprop -id \"\$focus_id\" WM_CLASS WM_NAME _NET_WM_PID _NET_WM_STATE 2>/dev/null || true
    fi
  fi
else
  echo 'xdotool unavailable'
fi
echo

echo '== active-window =='
if command -v xprop >/dev/null 2>&1; then
  xprop -root _NET_ACTIVE_WINDOW 2>/dev/null || true
else
  echo 'xprop unavailable'
fi
echo

echo '== overlay-processes =='
for pid in \$(pgrep -f '[S]teamBridgeSmoke|[g]ameoverlayui|[s]teamwebhelper' 2>/dev/null | awk -v self=\"\$capture_pid\" '\$1 != self' || true); do
  comm=\"\$(cat \"/proc/\$pid/comm\" 2>/dev/null || printf unknown)\"
  ppid=\"\$(awk '/^PPid:/ { print \$2 }' \"/proc/\$pid/status\" 2>/dev/null || true)\"
  printf 'pid=%s ppid=%s comm=%s\n' \"\$pid\" \"\${ppid:-unknown}\" \"\$comm\"
done
echo

echo '== overlay-env =='
for pid in \$(pgrep -f '[S]teamBridgeSmoke|[g]ameoverlayui' 2>/dev/null | awk -v self=\"\$capture_pid\" '\$1 != self' || true); do
  if [ -r \"/proc/\$pid/environ\" ]; then
    echo \"-- pid \$pid --\"
    tr '\\000' '\\n' < \"/proc/\$pid/environ\" 2>/dev/null |
      grep -E '^(SteamAppId|SteamGameId|SteamOverlayGameId|LD_PRELOAD|STEAM_BRIDGE_|DISPLAY=)' |
      sed 's/=.*$/=<redacted>/' || true
  fi
done
echo

echo '== wmctrl =='
if command -v wmctrl >/dev/null 2>&1; then
  wmctrl -lp 2>/dev/null | grep -Ei 'steam|overlay|smoke|electron|gameoverlayui' || true
else
  echo 'wmctrl unavailable'
fi
echo

echo '== xwininfo-filtered =='
if command -v xwininfo >/dev/null 2>&1; then
  xwininfo -root -tree 2>/dev/null | grep -Ei 'steam|overlay|smoke|electron|gameoverlayui' | head -n 160 || true
else
  echo 'xwininfo unavailable'
fi
" > "$local_path" 2>&1 || true
  echo "Overlay state saved: $local_path"
}

focus_deck_smoke_window() {
  local app_name_q
  app_name_q="$(quote_arg "$app_name")"
  echo "Focusing Deck smoke app window before visual probe"
  remote_exec "export DISPLAY=\"\${DISPLAY:-:0}\"; if systemctl --user is-active --quiet gamescope-session.service 2>/dev/null && DISPLAY=:1 xdotool getdisplaygeometry >/dev/null 2>&1; then export DISPLAY=:1; fi; if [ -z \"\${XAUTHORITY:-}\" ]; then XAUTHORITY=\"\$(ls /run/user/1000/xauth_* 2>/dev/null | head -n 1 || true)\"; export XAUTHORITY; fi; if command -v xdotool >/dev/null 2>&1; then
  xdotool key Escape >/dev/null 2>&1 || true
  sleep 0.2
  app_name=$app_name_q
  window_id=\"\"
  for pattern in \"Steam Bridge Electron Smoke\" \"\$app_name\" \"SteamBridgeSmoke\"; do
    window_id=\"\$(xdotool search --name \"\$pattern\" 2>/dev/null | tail -n 1 || true)\"
    if [ -n \"\$window_id\" ]; then
      break
    fi
  done
  if [ -n \"\$window_id\" ]; then
    xdotool windowactivate --sync \"\$window_id\" >/dev/null 2>&1 || xdotool windowfocus \"\$window_id\" >/dev/null 2>&1 || true
    sleep 0.35
  fi
fi"
}

clear_deck_transient_shells() {
  echo "Clearing Deck transient desktop shell state"
  remote_exec "export DISPLAY=\"\${DISPLAY:-:0}\"; if systemctl --user is-active --quiet gamescope-session.service 2>/dev/null && DISPLAY=:1 xdotool getdisplaygeometry >/dev/null 2>&1; then export DISPLAY=:1; fi; if [ -z \"\${XAUTHORITY:-}\" ]; then XAUTHORITY=\"\$(ls /run/user/1000/xauth_* 2>/dev/null | head -n 1 || true)\"; export XAUTHORITY; fi; export DBUS_SESSION_BUS_ADDRESS=\"\${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/1000/bus}\"; if command -v xdotool >/dev/null 2>&1; then
  xdotool key Escape >/dev/null 2>&1 || true
fi"
}

cleanup_deck_smoke_runtime() {
  local remote_q inhibit_pid_q
  remote_q="$(quote_arg "$remote_app_dir")"
  inhibit_pid_q="$(quote_arg "$remote_inhibit_pid_file")"
  check_ssh
  echo "Cleaning previous Deck smoke runtime"
  remote_exec "app_dir=$remote_q
inhibit_pid_file=$inhibit_pid_q
target_process_live() {
  [ -r \"/proc/\$1/stat\" ] || return 1
  target_stat=\"\$(cat \"/proc/\$1/stat\" 2>/dev/null || true)\"
  target_state=\"\${target_stat##*) }\"
  target_state=\"\${target_state%% *}\"
  case \"\$target_state\" in
    Z|X|'') return 1 ;;
    *) return 0 ;;
  esac
}
for attempt in \$(seq 1 20); do
  for process_dir in /proc/[0-9]*; do
    executable=\"\$(readlink \"\$process_dir/exe\" 2>/dev/null || true)\"
    executable=\"\${executable% (deleted)}\"
    [ \"\$executable\" = \"\$app_dir/SteamBridgeSmoke\" ] || continue
    kill \"\${process_dir##*/}\" >/dev/null 2>&1 || true
  done
  if [ -f \"\$inhibit_pid_file\" ]; then
    inhibit_pid=\"\$(cat \"\$inhibit_pid_file\" 2>/dev/null || true)\"
    case \"\$inhibit_pid\" in
      *[!0-9]*|'') ;;
      *) kill \"\$inhibit_pid\" >/dev/null 2>&1 || true ;;
    esac
    rm -f \"\$inhibit_pid_file\"
  fi
  for overlay_pid in \$(pgrep -x gameoverlayui 2>/dev/null || true); do
    target_pid=\"\$(tr '\\000' '\\n' < \"/proc/\$overlay_pid/cmdline\" 2>/dev/null | awk 'previous == \"-pid\" { print; exit } { previous = \$0 }')\"
    case \"\$target_pid\" in
      *[!0-9]*|'') ;;
      *) target_process_live \"\$target_pid\" || kill \"\$overlay_pid\" >/dev/null 2>&1 || true ;;
    esac
  done
  smoke_count=0
  for process_dir in /proc/[0-9]*; do
    executable=\"\$(readlink \"\$process_dir/exe\" 2>/dev/null || true)\"
    executable=\"\${executable% (deleted)}\"
    [ \"\$executable\" = \"\$app_dir/SteamBridgeSmoke\" ] && smoke_count=\$((smoke_count + 1))
  done
  orphan_overlay_count=0
  for overlay_pid in \$(pgrep -x gameoverlayui 2>/dev/null || true); do
    target_pid=\"\$(tr '\\000' '\\n' < \"/proc/\$overlay_pid/cmdline\" 2>/dev/null | awk 'previous == \"-pid\" { print; exit } { previous = \$0 }')\"
    case \"\$target_pid\" in
      *[!0-9]*|'') ;;
      *) target_process_live \"\$target_pid\" || { target_process_live \"\$overlay_pid\" && orphan_overlay_count=\$((orphan_overlay_count + 1)); } ;;
    esac
  done
  if [ \"\$smoke_count\" -eq 0 ] && [ \"\$orphan_overlay_count\" -eq 0 ]; then
    echo 'Previous Deck smoke runtime cleaned.'
    exit 0
  fi
  sleep 0.5
done
echo 'Timed out cleaning previous Deck smoke runtime.' >&2
exit 1"
}

send_deck_overlay_close_probe() {
  echo "Sending Deck overlay close probe"
  remote_exec "if [ -w /dev/uinput ] && command -v python3 >/dev/null 2>&1; then
python3 - <<'PY'
import fcntl
import os
import struct
import time

EV_SYN = 0
EV_KEY = 1
SYN_REPORT = 0
KEY_ESC = 1
KEY_TAB = 15
KEY_LEFTSHIFT = 42
UI_SET_EVBIT = 0x40045564
UI_SET_KEYBIT = 0x40045565
UI_DEV_CREATE = 0x5501
UI_DEV_DESTROY = 0x5502

def emit(fd, event_type, code, value):
    os.write(fd, struct.pack('llHHI', 0, 0, event_type, code, value))

def sync(fd):
    emit(fd, EV_SYN, SYN_REPORT, 0)

def tap(fd, key):
    emit(fd, EV_KEY, key, 1)
    sync(fd)
    time.sleep(0.05)
    emit(fd, EV_KEY, key, 0)
    sync(fd)

fd = os.open('/dev/uinput', os.O_WRONLY | os.O_NONBLOCK)
try:
    fcntl.ioctl(fd, UI_SET_EVBIT, EV_KEY)
    for key in (KEY_ESC, KEY_TAB, KEY_LEFTSHIFT):
        fcntl.ioctl(fd, UI_SET_KEYBIT, key)
    user_dev = struct.pack('80sHHHH', b'steam-bridge-virtual-keyboard', 0x03, 0x1234, 0x5678, 1)
    os.write(fd, user_dev + bytes(1028))
    fcntl.ioctl(fd, UI_DEV_CREATE)
    time.sleep(0.2)
    emit(fd, EV_KEY, KEY_LEFTSHIFT, 1)
    sync(fd)
    tap(fd, KEY_TAB)
    emit(fd, EV_KEY, KEY_LEFTSHIFT, 0)
    sync(fd)
    time.sleep(0.35)
    tap(fd, KEY_ESC)
    time.sleep(0.2)
finally:
    try:
        fcntl.ioctl(fd, UI_DEV_DESTROY)
    finally:
        os.close(fd)
PY
elif command -v xdotool >/dev/null 2>&1; then
  xdotool key Shift+Tab
  sleep 0.35
  xdotool key Escape
else
  echo 'No /dev/uinput or xdotool close input helper found on Deck.' >&2
  exit 127
fi"
}

send_deck_web_overlay_close_probe() {
  local result_file_q
  result_file_q="$(quote_arg "$result_file")"
  echo "Sending Deck web overlay close probe"
  remote_exec "export DISPLAY=\"\${DISPLAY:-:0}\"; RESULT_FILE=$result_file_q; if [ -z \"\${XAUTHORITY:-}\" ]; then XAUTHORITY=\"\$(ls /run/user/1000/xauth_* 2>/dev/null | head -n 1 || true)\"; export XAUTHORITY; fi
if ! command -v xdotool >/dev/null 2>&1; then
  echo 'No xdotool web overlay close helper found on Deck.' >&2
  exit 127
fi
wait_for_web_overlay_closed() {
  CLOSE_WAIT_SECONDS=\"\${1:-2.5}\" python3 - <<'PY'
import os
import sys
import time

result_file = os.environ.get('RESULT_FILE') or ''
lifecycle_path = result_file + '.diagnostics/lifecycle.jsonl'
deadline = time.monotonic() + float(os.environ.get('CLOSE_WAIT_SECONDS') or 2.5)

def has_closed_after_active():
    try:
        with open(lifecycle_path, 'r', encoding='utf-8') as handle:
            saw_active = False
            for line in handle:
                if 'event:callback:overlay-activated' not in line:
                    continue
                if '\"active\":true' in line or '\"m_bActive\":true' in line or '\"active\":1' in line:
                    saw_active = True
                elif saw_active and (
                    '\"active\":false' in line or '\"m_bActive\":false' in line or '\"active\":0' in line
                ):
                    return True
    except FileNotFoundError:
        return False
    return False

while time.monotonic() < deadline:
    if has_closed_after_active():
        sys.exit(0)
    time.sleep(0.1)
sys.exit(1)
PY
}
active_kwin_effects() {
  if command -v qdbus >/dev/null 2>&1; then
    qdbus org.kde.KWin /Effects activeEffects 2>/dev/null || true
  elif command -v qdbus6 >/dev/null 2>&1; then
    qdbus6 org.kde.KWin /Effects activeEffects 2>/dev/null || true
  fi
}
kwin_overview_active() {
  active_kwin_effects | grep -Eq '^(overview|windowview|scale)$'
}
clear_kwin_overview_if_active() {
  if ! kwin_overview_active; then
    return 0
  fi
  xdotool key Escape >/dev/null 2>&1 || true
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    if ! kwin_overview_active; then
      return 0
    fi
    sleep 0.1
  done
}
clear_kwin_overview_if_active
set -- \$(xdotool getdisplaygeometry)
display_width=\"\${1:-1280}\"
display_height=\"\${2:-800}\"
host_window=\"\$(xdotool search --name 'Steam Bridge Native Overlay' 2>/dev/null | tail -n 1 || true)\"
if [ -z \"\$host_window\" ]; then
  echo 'Steam web close probe could not find the native overlay host.' >&2
  exit 1
fi
eval \"\$(xdotool getwindowgeometry --shell \"\$host_window\" 2>/dev/null || true)\"
host_x=\"\${X:-0}\"
host_y=\"\${Y:-0}\"
host_width=\"\${WIDTH:-\$display_width}\"
host_height=\"\${HEIGHT:-\$display_height}\"
close_image=/tmp/steam-bridge-smoke-web-close.png
close_gray=/tmp/steam-bridge-smoke-web-close.gray
rm -f \"\$close_image\" \"\$close_gray\"
if ! command -v spectacle >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
  echo 'Steam web close probe requires spectacle and ffmpeg.' >&2
  exit 127
fi
spectacle -b -n -o \"\$close_image\" >/dev/null 2>&1
ffmpeg -v error -y -i \"\$close_image\" -f rawvideo -pix_fmt gray \"\$close_gray\"
close_point=\"\$(python3 - \"\$close_gray\" \"\$display_width\" \"\$display_height\" \"\$host_x\" \"\$host_y\" \"\$host_width\" \"\$host_height\" <<'PY'
import sys
from pathlib import Path

gray_path = Path(sys.argv[1])
display_width, display_height, host_x, host_y, host_width, host_height = map(int, sys.argv[2:])
pixels = gray_path.read_bytes()
if len(pixels) != display_width * display_height:
    print('Steam web close probe received an unexpected screenshot size.', file=sys.stderr)
    sys.exit(1)

minimum_x = max(8, host_x + host_width * 75 // 100)
maximum_x = min(display_width - 9, host_x + host_width * 90 // 100)
minimum_y = max(8, host_y + host_height * 7 // 100)
maximum_y = min(display_height - 9, host_y + host_height * 20 // 100)

def pixel(x, y):
    return pixels[y * display_width + x]

best = None
for y in range(minimum_y, maximum_y + 1):
    for x in range(minimum_x, maximum_x + 1):
        diagonal = []
        off_axis = []
        for offset in range(-5, 6):
            diagonal.extend((pixel(x + offset, y + offset), pixel(x - offset, y + offset)))
            if abs(offset) >= 3:
                off_axis.extend((pixel(x, y + offset), pixel(x + offset, y)))
        if max(diagonal) - min(diagonal) < 50:
            continue
        local = sorted(
            pixel(x + offset_x, y + offset_y)
            for offset_y in range(-8, 9)
            for offset_x in range(-8, 9)
        )
        background = local[len(local) // 2]
        if background >= 60:
            continue
        score_threshold = background + 28
        bright_threshold = background + 53
        score = sum(max(0, value - score_threshold) for value in diagonal)
        score -= sum(max(0, value - score_threshold) for value in off_axis)
        bright = sum(value >= bright_threshold for value in diagonal)
        if score < 900 or bright < 20:
            continue
        candidate = (score, bright, x, y)
        if best is None or candidate > best:
            best = candidate

if best is None:
    print('Steam web close probe could not detect the close glyph.', file=sys.stderr)
    sys.exit(1)

score, _bright, click_x, click_y = best
print(f'{click_x} {click_y} {score}')
PY
)\"
rm -f \"\$close_image\" \"\$close_gray\"
set -- \$close_point
click_x=\"\$1\"
click_y=\"\$2\"
close_score=\"\$3\"
echo \"Detected Steam web close control (score=\$close_score).\"
xdotool mousemove \"\$click_x\" \"\$click_y\" click 1
wait_for_web_overlay_closed 3.0 || true"
}

verify_deck_overlay_closed_after_probe() {
  local require_shortcut_open="${1:-0}"
  local require_presenter_parking="${2:-1}"
  local result_file_q app_name_q
  result_file_q="$(quote_arg "$result_file")"
  app_name_q="$(quote_arg "$app_name")"
  echo "Verifying Deck overlay close/deactivation evidence"
  remote_exec "RESULT_FILE=$result_file_q APP_NAME=$app_name_q ACTION=$(quote_arg "$action") REQUIRE_SHORTCUT_OPEN=$require_shortcut_open REQUIRE_PRESENTER_PARKING=$require_presenter_parking KWIN_ACTIVE_WINDOW_PROBE=$(quote_arg "$remote_kwin_active_window_probe") python3 - <<'PY'
import glob
import json
import os
import shutil
import subprocess
import sys
import time

result_file = os.environ['RESULT_FILE']
app_name = os.environ.get('APP_NAME') or 'Steam Bridge Smoke'
action = os.environ.get('ACTION') or ''
require_shortcut_open = os.environ.get('REQUIRE_SHORTCUT_OPEN') == '1'
require_presenter_parking = os.environ.get('REQUIRE_PRESENTER_PARKING') == '1'
require_open_and_wait_completion = action in {
    'presenter-web-open-and-wait',
    'presenter-store-open-and-wait',
    'presenter-dialog-auto-open-and-wait',
    'presenter-friends-open-and-wait'
}
diagnostic_dir = result_file + '.diagnostics'
lifecycle_path = os.path.join(diagnostic_dir, 'lifecycle.jsonl')
crash_dump_dir = os.path.join(diagnostic_dir, 'crash-dumps')
fatal_types = {
    'app:render-process-gone',
    'app:child-process-gone',
    'app:gpu-process-crashed',
    'process:uncaught-exception',
    'process:unhandled-rejection',
}
failures = []

def active_value(payload):
    if payload is True or payload == 1:
        return True
    if payload is False or payload == 0:
        return False
    if not isinstance(payload, dict):
        return None
    active_payload = payload.get('0') if isinstance(payload.get('0'), dict) else payload
    for key in ('active', 'm_bActive'):
        value = active_payload.get(key)
        if value is True or value == 1:
            return True
        if value is False or value == 0:
            return False
    return None

def read_lifecycle_entries():
    loaded_entries = []
    load_failures = []
    try:
        with open(lifecycle_path, 'r', encoding='utf-8') as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    loaded_entries.append(json.loads(line))
                except json.JSONDecodeError as error:
                    load_failures.append(f'invalid lifecycle JSON: {error}')
    except FileNotFoundError:
        load_failures.append(f'missing lifecycle log: {lifecycle_path}')
    return loaded_entries, load_failures

def presenter_payload(entry):
    payload = entry.get('payload')
    if not isinstance(payload, dict):
        return None
    presenter = payload.get('presenter')
    return presenter if isinstance(presenter, dict) else None

def expect_presenter_field(presenter, key, expected, label):
    actual = presenter.get(key)
    if actual != expected:
        failures.append(f'{label} after close expected {expected!r}, got {actual!r}')

def find_overlay_state_indices(loaded_entries):
    states = []
    for index, entry in enumerate(loaded_entries):
        if entry.get('type') == 'event:callback:overlay-activated':
            states.append((index, active_value(entry.get('payload'))))
    first_active = next((index for index, state in states if state is True), None)
    inactive_after_active = None
    if first_active is not None:
        inactive_after_active = next((index for index, state in states if index > first_active and state is False), None)
    return first_active, inactive_after_active

def has_presenter_after_close_stable_event(loaded_entries):
    _first_active, inactive_after_active = find_overlay_state_indices(loaded_entries)
    if inactive_after_active is None:
        return False
    return any(
        index > inactive_after_active and entry.get('type') == 'event:overlay:presenter-after-close-stable'
        for index, entry in enumerate(loaded_entries)
    )

def has_required_close_evidence(loaded_entries):
    _first_active, inactive_after_active = find_overlay_state_indices(loaded_entries)
    if inactive_after_active is None:
        return False
    if require_presenter_parking:
        if not has_presenter_after_close_stable_event(loaded_entries):
            return False
    if require_open_and_wait_completion:
        return any(
            index > inactive_after_active and entry.get('type') == 'event:overlay:presenter-open-and-wait-complete'
            for index, entry in enumerate(loaded_entries)
        )
    return True

def expect_parked_presenter(presenter, label):
    expect_presenter_field(presenter, 'closed', False, f'native presenter closed {label}')
    expect_presenter_field(presenter, 'attached', True, f'native presenter attached {label}')
    expect_presenter_field(presenter, 'nativeHostOpen', True, f'native presenter host open {label}')
    expect_presenter_field(presenter, 'mode', 'passive', f'native presenter mode {label}')
    expect_presenter_field(presenter, 'clickThrough', True, f'native presenter click-through {label}')
    expect_presenter_field(presenter, 'focusable', False, f'native presenter focusable {label}')
    expect_presenter_field(presenter, 'transparent', True, f'native presenter transparent {label}')
    expect_presenter_field(presenter, 'overlayActive', False, f'native presenter overlay active {label}')
    expect_presenter_field(presenter, 'idleFps', 0, f'native presenter idle FPS {label}')
    expect_presenter_field(presenter, 'currentFps', 0, f'native presenter current FPS {label}')
    expect_presenter_field(presenter, 'overlayNeedsPresent', False, f'native presenter overlay needs present {label}')

entries = []
lifecycle_failures = []
deadline = time.monotonic() + 5
while True:
    entries, lifecycle_failures = read_lifecycle_entries()
    if not lifecycle_failures and (has_required_close_evidence(entries) or time.monotonic() >= deadline):
        break
    if lifecycle_failures and time.monotonic() >= deadline:
        failures.extend(lifecycle_failures)
        break
    time.sleep(0.2)

if not failures and lifecycle_failures:
    failures.extend(lifecycle_failures)

first_active_index, inactive_after_active_index = find_overlay_state_indices(entries)
if first_active_index is None:
    failures.append('no active=true overlay callback in lifecycle log')
elif inactive_after_active_index is None:
    failures.append('no active=false overlay callback after active=true')
else:
    reactivated_after_close = any(
        index > inactive_after_active_index
        and entry.get('type') == 'event:callback:overlay-activated'
        and active_value(entry.get('payload')) is True
        for index, entry in enumerate(entries)
    )
    if reactivated_after_close:
        failures.append('overlay reactivated after close probe')

    if require_presenter_parking:
        first_after_close_entries = [
            (index, presenter_payload(entry))
            for index, entry in enumerate(entries)
            if index > inactive_after_active_index and entry.get('type') == 'event:overlay:presenter-after-close'
        ]
        stable_after_close_entries = [
            (index, presenter_payload(entry))
            for index, entry in enumerate(entries)
            if index > inactive_after_active_index and entry.get('type') == 'event:overlay:presenter-after-close-stable'
        ]
        first_after_close_presenters = [(index, presenter) for index, presenter in first_after_close_entries if presenter]
        stable_after_close_presenters = [(index, presenter) for index, presenter in stable_after_close_entries if presenter]
        if not first_after_close_entries:
            failures.append('no overlay:presenter-after-close event after active=false in lifecycle log')
        elif not first_after_close_presenters:
            failures.append('overlay:presenter-after-close did not include a presenter snapshot')
        if not stable_after_close_entries:
            failures.append('no overlay:presenter-after-close-stable event after active=false in lifecycle log')
        elif not stable_after_close_presenters:
            failures.append('overlay:presenter-after-close-stable did not include a presenter snapshot')
        if first_after_close_presenters and stable_after_close_presenters:
            _first_presenter_index, first_presenter = first_after_close_presenters[-1]
            _stable_presenter_index, stable_presenter = stable_after_close_presenters[-1]
            expect_parked_presenter(first_presenter, 'first sample')
            expect_parked_presenter(stable_presenter, 'stable sample')
            first_pump_count = first_presenter.get('pumpCount')
            stable_pump_count = stable_presenter.get('pumpCount')
            if first_pump_count != stable_pump_count:
                failures.append(
                    f'native presenter pump count changed after close: first={first_pump_count!r}, stable={stable_pump_count!r}'
                )

        wait_shown_presenters = [
            presenter_payload(entry)
            for index, entry in enumerate(entries)
            if index > first_active_index and entry.get('type') == 'event:overlay:presenter-wait-shown'
        ]
        wait_closed_presenters = [
            presenter_payload(entry)
            for index, entry in enumerate(entries)
            if index > inactive_after_active_index and entry.get('type') == 'event:overlay:presenter-wait-closed'
        ]
        wait_parked_presenters = [
            presenter_payload(entry)
            for index, entry in enumerate(entries)
            if index > inactive_after_active_index and entry.get('type') == 'event:overlay:presenter-parked'
        ]
        if not wait_shown_presenters:
            failures.append('no overlay:presenter-wait-shown event after active=true in lifecycle log')
        elif not any(wait_shown_presenters):
            failures.append('overlay:presenter-wait-shown did not include a presenter snapshot')
        if not wait_closed_presenters:
            failures.append('no overlay:presenter-wait-closed event after active=false in lifecycle log')
        elif not any(wait_closed_presenters):
            failures.append('overlay:presenter-wait-closed did not include a presenter snapshot')
        if not wait_parked_presenters:
            failures.append('no overlay:presenter-parked event after active=false in lifecycle log')
        elif not any(wait_parked_presenters):
            failures.append('overlay:presenter-parked did not include a presenter snapshot')

        if require_open_and_wait_completion:
            open_and_wait_entries = [
                entry
                for index, entry in enumerate(entries)
                if index > inactive_after_active_index and entry.get('type') == 'event:overlay:presenter-open-and-wait-complete'
            ]
            if not open_and_wait_entries:
                failures.append('no overlay:presenter-open-and-wait-complete event after active=false in lifecycle log')
            else:
                payload = open_and_wait_entries[-1].get('payload')
                if not isinstance(payload, dict):
                    failures.append('overlay:presenter-open-and-wait-complete did not include a payload')
                else:
                    shown = payload.get('shown')
                    parked = payload.get('parked')
                    if not isinstance(shown, dict):
                        failures.append('overlay:presenter-open-and-wait-complete did not include a shown snapshot')
                    elif shown.get('overlayActive') is not True:
                        failures.append('openAndWait shown snapshot did not report overlayActive=true')
                    if not isinstance(parked, dict):
                        failures.append('overlay:presenter-open-and-wait-complete did not include a parked snapshot')
                    else:
                        expect_parked_presenter(parked, 'openAndWait parked result')

if require_shortcut_open and not any(entry.get('type') == 'event:overlay:shortcut-open' for entry in entries):
    failures.append('no overlay:shortcut-open event in lifecycle log')

fatal_entries = [entry for entry in entries if entry.get('type') in fatal_types]
if fatal_entries:
    failures.append('fatal lifecycle events recorded after close probe: ' + ', '.join(entry.get('type', 'unknown') for entry in fatal_entries))

crash_dumps = []
for root, _dirs, files in os.walk(crash_dump_dir):
    for name in files:
        normalized = name.lower()
        if normalized.endswith(('.dmp', '.mdmp', '.dump', '.crash')):
            crash_dumps.append(os.path.relpath(os.path.join(root, name), crash_dump_dir))
if crash_dumps:
    failures.append('crash dump files found after close probe: ' + ', '.join(crash_dumps))

process_check = subprocess.run(
    ['pgrep', '-af', '[S]teamBridgeSmoke'],
    text=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.DEVNULL,
)
if process_check.returncode != 0 or not process_check.stdout.strip():
    failures.append('SteamBridgeSmoke process is not running after close probe')

def read_kwin_active_window():
    probe_path = os.environ.get('KWIN_ACTIVE_WINDOW_PROBE') or ''
    qdbus = shutil.which('qdbus6') or shutil.which('qdbus')
    journalctl = shutil.which('journalctl')
    if not probe_path or not os.path.isfile(probe_path) or not qdbus or not journalctl:
        return False, None

    plugin_name = 'steam-bridge-focus-probe'
    cursor_result = subprocess.run(
        [journalctl, '--user', '-n', '0', '--show-cursor', '--no-pager'],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    cursor = next(
        (
            line.split(':', 1)[1].strip()
            for line in cursor_result.stdout.splitlines()
            if line.startswith('-- cursor:')
        ),
        '',
    )
    unload = [
        qdbus,
        'org.kde.KWin',
        '/Scripting',
        'org.kde.kwin.Scripting.unloadScript',
        plugin_name,
    ]
    subprocess.run(unload, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        loaded = subprocess.run(
            [
                qdbus,
                'org.kde.KWin',
                '/Scripting',
                'org.kde.kwin.Scripting.loadScript',
                probe_path,
                plugin_name,
            ],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        if loaded.returncode != 0:
            return False, None
        started = subprocess.run(
            [qdbus, 'org.kde.KWin', '/Scripting', 'org.kde.kwin.Scripting.start'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if started.returncode != 0:
            return False, None
        time.sleep(0.25)
        journal_args = [journalctl, '--user', '--no-pager', '-o', 'cat']
        if cursor:
            journal_args.extend(['--after-cursor', cursor])
        else:
            journal_args.append('--since=5sec')
        journal = subprocess.run(
            journal_args,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        marker = 'STEAM_BRIDGE_KWIN_ACTIVE '
        for line in reversed(journal.stdout.splitlines()):
            marker_index = line.find(marker)
            if marker_index < 0:
                continue
            try:
                return True, json.loads(line[marker_index + len(marker):])
            except json.JSONDecodeError:
                return True, None
        return False, None
    finally:
        subprocess.run(unload, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

expected = [app_name.lower(), 'steam bridge electron smoke', 'steambridgesmoke']
kwin_focus_read, kwin_active_window = read_kwin_active_window()
if kwin_focus_read:
    if not isinstance(kwin_active_window, dict):
        failures.append('KWin reported no active window after close probe')
    else:
        active_identity = ' '.join(
            str(kwin_active_window.get(key) or '').lower()
            for key in ('caption', 'resourceClass', 'resourceName')
        )
        if not any(name and name in active_identity for name in expected):
            failures.append('KWin active window after close probe is not the smoke app')
else:
    focus_env = os.environ.copy()
    if not focus_env.get('XAUTHORITY'):
        xauth_candidates = glob.glob('/run/user/1000/xauth_*')
        if xauth_candidates:
            focus_env['XAUTHORITY'] = xauth_candidates[0]

    if shutil.which('xdotool') is None:
        failures.append('could not read focused X11 window after close probe')
    else:
        game_mode = subprocess.run(
            ['systemctl', '--user', 'is-active', '--quiet', 'gamescope-session.service'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).returncode == 0
        display_candidates = [':1', ':0'] if game_mode else [focus_env.get('DISPLAY') or ':0', ':0']
        focused_window_read = False
        smoke_app_focused = False
        for display in dict.fromkeys(display_candidates):
            display_env = focus_env.copy()
            display_env['DISPLAY'] = display
            focus_id = subprocess.run(
                ['xdotool', 'getwindowfocus'],
                env=display_env,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
            if focus_id.returncode != 0 or not focus_id.stdout.strip():
                continue
            focus_name_result = subprocess.run(
                ['xdotool', 'getwindowname', focus_id.stdout.strip()],
                env=display_env,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
            if focus_name_result.returncode != 0:
                continue
            focused_window_read = True
            focus_name_lower = focus_name_result.stdout.strip().lower()
            if any(name and name in focus_name_lower for name in expected):
                smoke_app_focused = True
                break
        if not focused_window_read:
            failures.append('could not read focused X11 window after close probe')
        elif not smoke_app_focused:
            failures.append('focused window after close probe is not the smoke app')

if failures:
    for failure in failures:
        print(f'Deck close verification failed: {failure}', file=sys.stderr)
    raise SystemExit(1)

print('Deck overlay close verified: active=false observed, managed presenter parking verified when required, app focused, no crash evidence.')
PY"
}

send_deck_overlay_toggle_probe() {
  local input="${1:-keyboard}"
  case "$input" in
    keyboard)
      send_deck_overlay_keyboard_toggle_probe
      ;;
    guide)
      send_deck_overlay_guide_toggle_probe
      ;;
    *)
      echo "Unknown Deck overlay toggle input: $input" >&2
      return 2
      ;;
  esac
}

send_deck_overlay_keyboard_toggle_probe() {
  echo "Sending Deck overlay keyboard toggle probe"
  remote_exec "if [ -w /dev/uinput ] && command -v python3 >/dev/null 2>&1; then
python3 - <<'PY'
import fcntl
import os
import struct
import time

EV_SYN = 0
EV_KEY = 1
SYN_REPORT = 0
KEY_TAB = 15
KEY_LEFTSHIFT = 42
UI_SET_EVBIT = 0x40045564
UI_SET_KEYBIT = 0x40045565
UI_DEV_CREATE = 0x5501
UI_DEV_DESTROY = 0x5502

def emit(fd, event_type, code, value):
    os.write(fd, struct.pack('llHHI', 0, 0, event_type, code, value))

def sync(fd):
    emit(fd, EV_SYN, SYN_REPORT, 0)

def tap(fd, key):
    emit(fd, EV_KEY, key, 1)
    sync(fd)
    time.sleep(0.05)
    emit(fd, EV_KEY, key, 0)
    sync(fd)

fd = os.open('/dev/uinput', os.O_WRONLY | os.O_NONBLOCK)
try:
    fcntl.ioctl(fd, UI_SET_EVBIT, EV_KEY)
    for key in (KEY_TAB, KEY_LEFTSHIFT):
        fcntl.ioctl(fd, UI_SET_KEYBIT, key)
    user_dev = struct.pack('80sHHHH', b'steam-bridge-virtual-keyboard', 0x03, 0x1234, 0x5678, 1)
    os.write(fd, user_dev + bytes(1028))
    fcntl.ioctl(fd, UI_DEV_CREATE)
    time.sleep(0.2)
    emit(fd, EV_KEY, KEY_LEFTSHIFT, 1)
    sync(fd)
    tap(fd, KEY_TAB)
    emit(fd, EV_KEY, KEY_LEFTSHIFT, 0)
    sync(fd)
    time.sleep(0.2)
finally:
    try:
        fcntl.ioctl(fd, UI_DEV_DESTROY)
    finally:
        os.close(fd)
PY
elif command -v xdotool >/dev/null 2>&1; then
  xdotool key Shift+Tab
else
  echo 'No /dev/uinput or xdotool toggle input helper found on Deck.' >&2
  exit 127
fi"
}

send_deck_overlay_guide_toggle_probe() {
  echo "Sending Deck overlay Guide/Steam-button toggle probe"
  remote_exec "if [ -w /dev/uinput ] && command -v python3 >/dev/null 2>&1; then
python3 - <<'PY'
import fcntl
import os
import struct
import time

EV_SYN = 0
EV_KEY = 1
EV_ABS = 3
SYN_REPORT = 0
ABS_X = 0
ABS_Y = 1
ABS_Z = 2
ABS_RX = 3
ABS_RY = 4
ABS_RZ = 5
ABS_HAT0X = 16
ABS_HAT0Y = 17
BTN_SOUTH = 304
BTN_EAST = 305
BTN_NORTH = 307
BTN_WEST = 308
BTN_TL = 310
BTN_TR = 311
BTN_SELECT = 314
BTN_START = 315
BTN_MODE = 316
BTN_THUMBL = 317
BTN_THUMBR = 318
UI_SET_EVBIT = 0x40045564
UI_SET_KEYBIT = 0x40045565
UI_SET_ABSBIT = 0x40045567
UI_DEV_CREATE = 0x5501
UI_DEV_DESTROY = 0x5502
ABS_CNT = 64

def emit(fd, event_type, code, value):
    os.write(fd, struct.pack('llHHI', 0, 0, event_type, code, value))

def sync(fd):
    emit(fd, EV_SYN, SYN_REPORT, 0)

def user_dev():
    data = bytearray(80 + 8 + 4 + ABS_CNT * 4 * 4)
    struct.pack_into('80sHHHHI', data, 0, b'steam-bridge-virtual-gamepad', 0x03, 0x28de, 0x11ff, 1, 0)
    absmax_offset = 92
    absmin_offset = absmax_offset + ABS_CNT * 4
    absfuzz_offset = absmin_offset + ABS_CNT * 4
    absflat_offset = absfuzz_offset + ABS_CNT * 4
    for axis in (ABS_X, ABS_Y, ABS_RX, ABS_RY):
        struct.pack_into('i', data, absmin_offset + axis * 4, -32768)
        struct.pack_into('i', data, absmax_offset + axis * 4, 32767)
        struct.pack_into('i', data, absflat_offset + axis * 4, 4096)
    for axis in (ABS_Z, ABS_RZ):
        struct.pack_into('i', data, absmin_offset + axis * 4, 0)
        struct.pack_into('i', data, absmax_offset + axis * 4, 255)
    for axis in (ABS_HAT0X, ABS_HAT0Y):
        struct.pack_into('i', data, absmin_offset + axis * 4, -1)
        struct.pack_into('i', data, absmax_offset + axis * 4, 1)
    return data

fd = os.open('/dev/uinput', os.O_WRONLY | os.O_NONBLOCK)
try:
    fcntl.ioctl(fd, UI_SET_EVBIT, EV_KEY)
    fcntl.ioctl(fd, UI_SET_EVBIT, EV_ABS)
    for key in (BTN_SOUTH, BTN_EAST, BTN_NORTH, BTN_WEST, BTN_TL, BTN_TR, BTN_SELECT, BTN_START, BTN_MODE, BTN_THUMBL, BTN_THUMBR):
        fcntl.ioctl(fd, UI_SET_KEYBIT, key)
    for axis in (ABS_X, ABS_Y, ABS_Z, ABS_RX, ABS_RY, ABS_RZ, ABS_HAT0X, ABS_HAT0Y):
        fcntl.ioctl(fd, UI_SET_ABSBIT, axis)
    os.write(fd, user_dev())
    fcntl.ioctl(fd, UI_DEV_CREATE)
    time.sleep(1.2)
    for axis, value in ((ABS_X, 0), (ABS_Y, 0), (ABS_RX, 0), (ABS_RY, 0), (ABS_Z, 0), (ABS_RZ, 0), (ABS_HAT0X, 0), (ABS_HAT0Y, 0)):
        emit(fd, EV_ABS, axis, value)
    sync(fd)
    time.sleep(0.2)
    emit(fd, EV_KEY, BTN_MODE, 1)
    sync(fd)
    time.sleep(0.15)
    emit(fd, EV_KEY, BTN_MODE, 0)
    sync(fd)
    time.sleep(1.0)
finally:
    try:
        fcntl.ioctl(fd, UI_DEV_DESTROY)
    finally:
        os.close(fd)
PY
else
  echo 'No /dev/uinput Guide-button input helper found on Deck.' >&2
  exit 127
fi"
}

send_deck_overlay_escape_probe() {
  echo "Sending Deck overlay SteamUI Escape probe"
  remote_exec "if ! command -v xdotool >/dev/null 2>&1; then
  echo 'SteamUI Escape probe requires xdotool.' >&2
  exit 127
fi
if [ -z \"\${XAUTHORITY:-}\" ]; then
  XAUTHORITY=\"\$(ls -t /run/user/1000/xauth_* 2>/dev/null | head -n 1 || true)\"
  export XAUTHORITY
fi
escape_display=\"\${DISPLAY:-:0}\"
if systemctl --user is-active --quiet gamescope-session.service 2>/dev/null &&
  DISPLAY=:0 xdotool getdisplaygeometry >/dev/null 2>&1; then
  escape_display=:0
fi
if ! DISPLAY=\"\$escape_display\" xdotool getdisplaygeometry >/dev/null 2>&1; then
  echo \"SteamUI Escape probe could not authenticate to X11 display \$escape_display.\" >&2
  exit 1
fi
DISPLAY=\"\$escape_display\" xdotool key Escape"
}

run_visual_capture() {
  local status=0
  if [ -z "$visual_capture_dir" ]; then
    return 0
  fi

  if [ "$keep_open_after_result" != "1" ]; then
    echo "Visual capture is most useful with --keep-open-after-result; skipping screenshots." >&2
    return 0
  fi

  capture_deck_screenshot "overlay-open" || status=$?
  capture_deck_overlay_state "overlay-open" || status=$?
  if [ "$visual_toggle_probe" = "1" ]; then
    if [ "$visual_toggle_input" = "keyboard" ]; then
      run_visual_toggle_probe_for_input "keyboard" "" "1" || status=$?
    elif [ "$visual_toggle_input" = "guide" ]; then
      run_visual_toggle_probe_for_input "guide" "" "0" || status=$?
    else
      run_visual_toggle_probe_for_input "keyboard" "keyboard-" "1" || status=$?
      run_visual_toggle_probe_for_input "guide" "guide-" "0" || status=$?
    fi
  fi
  if [ "$visual_close_probe" = "1" ]; then
    if [ "$require_close_deactivated" != "1" ] && supports_close_deactivation_check; then
      require_close_deactivated="1"
    fi
    if [ "$visual_close_input" = "keyboard" ]; then
      send_deck_overlay_close_probe || status=$?
    elif [ "$visual_close_input" = "toggle" ]; then
      send_deck_overlay_keyboard_toggle_probe || status=$?
    elif [ "$visual_close_input" = "escape" ]; then
      send_deck_overlay_escape_probe || status=$?
    elif [ "$visual_close_input" = "web" ]; then
      send_deck_web_overlay_close_probe || status=$?
    else
      send_deck_overlay_close_probe || status=$?
      sleep 0.5
      send_deck_web_overlay_close_probe || status=$?
    fi
    sleep 1
    capture_deck_screenshot "after-close-probe" || status=$?
    capture_deck_overlay_state "after-close-probe" || status=$?
    if [ "$require_close_deactivated" = "1" ]; then
      verify_deck_overlay_closed_after_probe "0" "$(persistent_presenter_parking_required)" || status=$?
    fi
  fi
  return "$status"
}

wait_for_deck_shortcut_overlay_open() {
  local result_file_q
  result_file_q="$(quote_arg "$result_file")"
  remote_exec "RESULT_FILE=$result_file_q python3 - <<'PY'
import json
import os
import sys
import time

result_file = os.environ['RESULT_FILE']
lifecycle_path = os.path.join(result_file + '.diagnostics', 'lifecycle.jsonl')
deadline = time.monotonic() + 12

def active_value(payload):
    if not isinstance(payload, dict):
        return None
    if isinstance(payload.get('active'), bool):
        return payload.get('active')
    first = payload.get('0')
    if isinstance(first, dict) and isinstance(first.get('active'), bool):
        return first.get('active')
    return None

while time.monotonic() < deadline:
    shortcut_open = False
    overlay_active = False
    try:
        with open(lifecycle_path, 'r', encoding='utf-8') as handle:
            for line in handle:
                if not line.strip():
                    continue
                entry = json.loads(line)
                if entry.get('type') == 'event:overlay:shortcut-open':
                    shortcut_open = True
                elif entry.get('type') == 'event:callback:overlay-activated' and active_value(entry.get('payload')) is True:
                    overlay_active = True
    except FileNotFoundError:
        pass
    except json.JSONDecodeError as error:
        print(f'Invalid lifecycle JSON while waiting for shortcut overlay open: {error}', file=sys.stderr)
        sys.exit(1)

    if shortcut_open and overlay_active:
        print('Deck shortcut overlay open verified from lifecycle log.')
        sys.exit(0)
    time.sleep(0.1)

print(f'Timed out waiting for managed shortcut overlay open in {lifecycle_path}', file=sys.stderr)
sys.exit(1)
PY"
}

run_visual_toggle_probe_for_input() {
  local input="$1"
  local label_prefix="$2"
  local use_close_probe="$3"
  local status=0
  local waited_for_open="0"

  focus_deck_smoke_window || status=$?
  capture_deck_screenshot "${label_prefix}before-toggle-probe" || status=$?
  capture_deck_overlay_state "${label_prefix}before-toggle-probe" || status=$?
  send_deck_overlay_toggle_probe "$input" || status=$?
  if [ "$action" = "presenter-shortcut" ] && [ "$input" = "keyboard" ]; then
    wait_for_deck_shortcut_overlay_open || status=$?
    waited_for_open="1"
  fi
  if [ "$waited_for_open" != "1" ] || [ "$visual_toggle_open_delay_explicit" = "1" ]; then
    sleep "$visual_toggle_open_delay"
  fi
  capture_deck_screenshot "${label_prefix}after-toggle-open" || status=$?
  capture_deck_overlay_state "${label_prefix}after-toggle-open" || status=$?
  if [ "$use_close_probe" = "1" ]; then
    if [ "$visual_close_input" = "web" ]; then
      send_deck_web_overlay_close_probe || status=$?
    elif [ "$visual_close_input" = "toggle" ]; then
      send_deck_overlay_keyboard_toggle_probe || status=$?
    elif [ "$visual_close_input" = "both" ]; then
      send_deck_overlay_close_probe || status=$?
      sleep 0.5
      send_deck_web_overlay_close_probe || status=$?
    else
      send_deck_overlay_close_probe || status=$?
    fi
  else
    send_deck_overlay_toggle_probe "$input" || status=$?
  fi
  sleep 1
  capture_deck_screenshot "${label_prefix}after-toggle-close" || status=$?
  capture_deck_overlay_state "${label_prefix}after-toggle-close" || status=$?
  if [ "$action" = "presenter-shortcut" ] && [ "$input" = "keyboard" ]; then
    verify_deck_overlay_closed_after_probe "1" "$(persistent_presenter_parking_required)" || status=$?
  fi
  return "$status"
}

print_ssh_hint() {
  cat >&2 <<EOF
Steam Deck SSH is not reachable at $host.
Check that the Deck is awake, on the same network, has SSH enabled, and still has this IP address.
If the Deck moved addresses, pass --host deck@<ip-address> or set STEAM_DECK_HOST.
EOF
}

check_ssh() {
  echo "Checking SSH reachability for $host"
  if remote_exec "true" >/dev/null; then
    echo "SSH reachable."
    return 0
  fi

  local status=$?
  print_ssh_hint
  return "$status"
}

detect_ipv4_prefix() {
  local ip="" normalized

  if [ -n "$discover_subnet" ]; then
    normalized="${discover_subnet%/24}"
    normalized="${normalized%.0}"
    if printf '%s\n' "$normalized" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
      printf '%s\n' "$normalized"
      return 0
    fi
    if printf '%s\n' "$normalized" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
      printf '%s\n' "${normalized%.*}"
      return 0
    fi

    echo "Invalid --discover-subnet value: $discover_subnet. Use a /24 prefix like 192.168.1." >&2
    return 1
  fi

  if command -v ipconfig >/dev/null 2>&1; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
  fi

  if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") {print $(i + 1); exit}}')"
  fi

  if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi

  if ! printf '%s\n' "$ip" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "Could not auto-detect a local IPv4 address. Pass --discover-subnet, for example --discover-subnet 192.168.1." >&2
    return 1
  fi

  printf '%s\n' "${ip%.*}"
}

exclude_csv() {
  local joined="" entry
  if [ "${#exclude_hosts[@]}" -eq 0 ]; then
    printf '\n'
    return 0
  fi

  for entry in "${exclude_hosts[@]}"; do
    if [ -z "$joined" ]; then
      joined="$entry"
    else
      joined="$joined,$entry"
    fi
  done
  printf '%s\n' "$joined"
}

scan_ssh_hosts() {
  local prefix excludes
  if ! command -v nc >/dev/null 2>&1; then
    echo "Discovery requires nc/netcat on the host." >&2
    return 1
  fi

  prefix="$(detect_ipv4_prefix)"
  excludes="$(exclude_csv)"

  echo "Scanning $prefix.0/24 for SSH on port 22..." >&2
  seq 1 254 | xargs -I{} -P 64 bash -c '
    prefix="$1"
    timeout="$2"
    excludes="$3"
    suffix="$4"
    ip="$prefix.$suffix"

    case ",$excludes," in
      *",$ip,"*) exit 0 ;;
    esac

    if nc -h 2>&1 | grep -q -- "-G"; then
      if nc -z -G "$timeout" "$ip" 22 >/dev/null 2>&1; then
        printf "%s\n" "$ip"
      fi
    elif nc -z -w "$timeout" "$ip" 22 >/dev/null 2>&1; then
      printf "%s\n" "$ip"
    fi
    exit 0
  ' _ "$prefix" "$scan_timeout" "$excludes" {} | sort -t . -k1,1n -k2,2n -k3,3n -k4,4n
}

run_discover() {
  local candidates ip output
  candidates="$(scan_ssh_hosts)"

  if [ -z "$candidates" ]; then
    echo "No SSH hosts found on the scanned subnet."
    return 1
  fi

  echo "SSH candidates:"
  printf '%s\n' "$candidates"
  echo
  echo "Checking candidates for deck SSH login..."

  while IFS= read -r ip; do
    [ -n "$ip" ] || continue
    output="$(
      ssh \
        -o BatchMode=yes \
        -o ConnectTimeout="$connect_timeout" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        "deck@$ip" \
        'printf "host=%s user=%s kernel=%s\n" "$(uname -n 2>/dev/null || printf unknown)" "$(whoami)" "$(uname -srmo 2>/dev/null || uname -a)"' \
        2>/dev/null || true
    )"
    if [ -n "$output" ]; then
      echo "Deck candidate: deck@$ip"
      printf '%s\n' "$output"
    else
      echo "Not deck@$ip"
    fi
  done <<<"$candidates"
}

assert_local_app() {
  local required_file
  for required_file in SteamBridgeSmoke linux-electron-smoke.sh chrome_crashpad_handler chrome-sandbox; do
    if [ ! -f "$local_app_dir/$required_file" ] || [ ! -r "$local_app_dir/$required_file" ]; then
      echo "Missing packaged Linux runtime file: $local_app_dir/$required_file" >&2
      echo "Run npm run example:package:linux before using this runner." >&2
      exit 1
    fi
  done
}

copy_to_deck() {
  local remote_q
  remote_q="$(quote_arg "$remote_app_dir")"
  assert_local_app
  check_ssh
  echo "Copying $local_app_dir to $host:$remote_app_dir"
  COPYFILE_DISABLE=1 tar --no-xattrs -C "$local_app_dir" -czf - . | remote_exec "mkdir -p $remote_q && tar -xzf - -C $remote_q && chmod +x $remote_q/SteamBridgeSmoke $remote_q/linux-electron-smoke.sh $remote_q/chrome_crashpad_handler $remote_q/chrome-sandbox"
}

start_keep_awake() {
  if [ "$keep_awake" != "1" ]; then
    return 0
  fi

  local pid_q seconds_q
  pid_q="$(quote_arg "$remote_inhibit_pid_file")"
  seconds_q="$(quote_arg "$inhibit_seconds")"
  remote_exec "if command -v systemd-inhibit >/dev/null 2>&1; then nohup systemd-inhibit --what=sleep --why='Steam Bridge smoke' sleep $seconds_q >/tmp/steam-bridge-smoke-inhibit.log 2>&1 & echo \$! > $pid_q; else echo 'systemd-inhibit not found; skipping sleep inhibitor' >&2; fi"
}

stop_keep_awake() {
  if [ "$keep_awake" != "1" ]; then
    return 0
  fi

  local pid_q
  pid_q="$(quote_arg "$remote_inhibit_pid_file")"
  remote_exec "if [ -f $pid_q ]; then kill \$(cat $pid_q) >/dev/null 2>&1 || true; rm -f $pid_q; fi" >/dev/null 2>&1 || true
}

resolved_overlay_profile() {
  if [ -n "$overlay_profile" ]; then
    printf '%s\n' "$overlay_profile"
  elif [ "$mode" = "desktop" ]; then
    printf '%s\n' "repaint"
  else
    printf '%s\n' "diagnostic"
  fi
}

checkout_opens_overlay() {
  [ -n "$checkout_url" ] || [ -n "$checkout_transaction_id" ]
}

uses_persistent_presenter() {
  [ -z "$presenter_mode" ] || [ "$presenter_mode" = "persistent" ]
}

effective_presenter_mode() {
  if [ -n "$presenter_mode" ]; then
    printf '%s\n' "$presenter_mode"
  else
    printf '%s\n' "persistent"
  fi
}

resolved_shortcut_target() {
  if [ -n "$shortcut_target" ]; then
    printf '%s\n' "$shortcut_target"
  else
    printf '%s\n' "friends"
  fi
}

persistent_presenter_parking_required() {
  if is_presenter_product_action && uses_persistent_presenter; then
    printf '%s\n' "1"
  else
    printf '%s\n' "0"
  fi
}

is_presenter_product_action() {
  case "$action" in
    presenter-store|presenter-store-open-and-wait|presenter-web|presenter-web-open-and-wait|presenter-duplicate-open-guard|presenter-friends|presenter-friends-open-and-wait|presenter-profile|presenter-players|presenter-dialog-auto|presenter-dialog-auto-open-and-wait|presenter-community|presenter-stats|presenter-achievements|presenter-user|presenter-checkout|presenter-shortcut|presenter-shortcut-open-and-wait|presenter-achievement-progress|presenter-achievement-unlock)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

supports_close_deactivation_check() {
  case "$action" in
    presenter-store|presenter-store-open-and-wait|presenter-web|presenter-web-open-and-wait|presenter-duplicate-open-guard|presenter-friends|presenter-friends-open-and-wait|presenter-profile|presenter-players|presenter-dialog-auto|presenter-dialog-auto-open-and-wait|presenter-community|presenter-stats|presenter-achievements|presenter-user)
      return 0
      ;;
    presenter-checkout)
      checkout_opens_overlay
      return $?
      ;;
    *)
      return 1
      ;;
  esac
}

prepare_remote_wrapper() {
  local app_dir_q env_q wrapper_q wrapper_dir_q
  local app_id_q overlay_game_id_q action_q profile_q scrub_child_env_q isolate_child_processes_q window_mode_q result_file_q diagnostic_dir_q action_delay_q result_delay_q keep_open_q control_server_q control_file_q control_token_q require_active_q web_url_q web_modal_q checkout_url_q checkout_transaction_id_q checkout_return_url_q overlay_dialog_q user_dialog_q shortcut_target_q presenter_mode_q achievement_name_q achievement_current_q achievement_max_q
  local require_overlay_active="0"

  if [ "$action" = "store" ] || [ "$action" = "web" ] || [ "$action" = "presenter-store" ] || [ "$action" = "presenter-store-open-and-wait" ] || [ "$action" = "presenter-web" ] || [ "$action" = "presenter-web-open-and-wait" ] || [ "$action" = "presenter-duplicate-open-guard" ] || [ "$action" = "presenter-friends" ] || [ "$action" = "presenter-friends-open-and-wait" ] || [ "$action" = "presenter-profile" ] || [ "$action" = "presenter-players" ] || [ "$action" = "presenter-dialog-auto" ] || [ "$action" = "presenter-dialog-auto-open-and-wait" ] || [ "$action" = "presenter-community" ] || [ "$action" = "presenter-stats" ] || [ "$action" = "presenter-achievements" ] || [ "$action" = "presenter-user" ]; then
    require_overlay_active="1"
  fi
  if [ "$action" = "presenter-checkout" ] && checkout_opens_overlay; then
    require_overlay_active="1"
  fi

  app_dir_q="$(quote_arg "$remote_app_dir")"
  env_q="$(quote_arg "$remote_wrapper_env_file")"
  wrapper_q="$(quote_arg "$remote_wrapper_path")"
  wrapper_dir_q="$(quote_arg "$(dirname -- "$remote_wrapper_path")")"
  app_id_q="$(quote_arg "$app_id")"
  overlay_game_id_q="$(quote_arg "$(resolve_overlay_game_id)")"
  action_q="$(quote_arg "$action")"
  profile_q="$(quote_arg "$(resolved_overlay_profile)")"
  scrub_child_env_q="$(quote_arg "$overlay_scrub_child_env")"
  isolate_child_processes_q="$(quote_arg "$overlay_isolate_child_processes")"
  window_mode_q="$(quote_arg "$window_mode")"
  result_file_q="$(quote_arg "$result_file")"
  diagnostic_dir_q="$(quote_arg "$result_file.diagnostics")"
  action_delay_q="$(quote_arg "1500")"
  result_delay_q="$(quote_arg "$result_delay_ms")"
  keep_open_q="$(quote_arg "$keep_open_after_result")"
  control_server_q="$(quote_arg "$control_server")"
  control_file_q="$(quote_arg "$control_file")"
  control_token_q="$(quote_arg "$control_token")"
  require_active_q="$(quote_arg "$require_overlay_active")"
  web_url_q="$(quote_arg "$web_url")"
  web_modal_q="$(quote_arg "$web_modal")"
  checkout_url_q="$(quote_arg "$checkout_url")"
  checkout_transaction_id_q="$(quote_arg "$checkout_transaction_id")"
  checkout_return_url_q="$(quote_arg "$checkout_return_url")"
  overlay_dialog_q="$(quote_arg "$overlay_dialog")"
  user_dialog_q="$(quote_arg "$user_dialog")"
  shortcut_target_q="$(quote_arg "$shortcut_target")"
  presenter_mode_q="$(quote_arg "$presenter_mode")"
  achievement_name_q="$(quote_arg "$achievement_name")"
  achievement_current_q="$(quote_arg "$achievement_current")"
  achievement_max_q="$(quote_arg "$achievement_max")"

  echo "Writing Steam shortcut wrapper config to $host:$remote_wrapper_env_file"
  remote_exec "set -e
mkdir -p $wrapper_dir_q
cat > $env_q <<EOF
APP_DIR=$app_dir_q
APP_ID=$app_id_q
OVERLAY_GAME_ID=$overlay_game_id_q
AUTORUN_ACTION=$action_q
OVERLAY_PROFILE=$profile_q
OVERLAY_SCRUB_CHILD_ENV=$scrub_child_env_q
OVERLAY_ISOLATE_CHILD_PROCESSES=$isolate_child_processes_q
WINDOW_MODE=$window_mode_q
RESULT_FILE=$result_file_q
DIAGNOSTIC_DIR=$diagnostic_dir_q
ACTION_DELAY_MS=$action_delay_q
RESULT_DELAY_MS=$result_delay_q
KEEP_OPEN_AFTER_RESULT=$keep_open_q
CONTROL_SERVER=$control_server_q
CONTROL_FILE=$control_file_q
CONTROL_TOKEN=$control_token_q
REQUIRE_OVERLAY_ACTIVE=$require_active_q
WEB_URL=$web_url_q
WEB_MODAL=$web_modal_q
CHECKOUT_URL=$checkout_url_q
CHECKOUT_TRANSACTION_ID=$checkout_transaction_id_q
CHECKOUT_RETURN_URL=$checkout_return_url_q
OVERLAY_DIALOG=$overlay_dialog_q
USER_DIALOG=$user_dialog_q
SHORTCUT_TARGET=$shortcut_target_q
PRESENTER_MODE=$presenter_mode_q
ACHIEVEMENT_NAME=$achievement_name_q
ACHIEVEMENT_CURRENT=$achievement_current_q
ACHIEVEMENT_MAX=$achievement_max_q
EOF
cat > $wrapper_q <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=\"\$(cd -- \"\$(dirname -- \"\${BASH_SOURCE[0]}\")\" && pwd)\"
SCRIPT_NAME=\"\$(basename -- \"\${BASH_SOURCE[0]}\")\"
CONFIG_FILE=\"\${STEAM_BRIDGE_SMOKE_WRAPPER_ENV_FILE:-\$SCRIPT_DIR/\${SCRIPT_NAME%.sh}.env}\"
if [ -f \"\$CONFIG_FILE\" ]; then
  # shellcheck disable=SC1090
  source \"\$CONFIG_FILE\"
fi

APP_DIR=\"\${APP_DIR:-/home/deck/steam-bridge-smoke/SteamBridgeSmoke-linux-x64}\"
APP_ID=\"\${APP_ID:-480}\"
OVERLAY_GAME_ID=\"\${OVERLAY_GAME_ID:-\$APP_ID}\"
AUTORUN_ACTION=\"\${AUTORUN_ACTION:-none}\"
OVERLAY_PROFILE=\"\${OVERLAY_PROFILE:-diagnostic}\"
OVERLAY_SCRUB_CHILD_ENV=\"\${OVERLAY_SCRUB_CHILD_ENV:-}\"
OVERLAY_ISOLATE_CHILD_PROCESSES=\"\${OVERLAY_ISOLATE_CHILD_PROCESSES:-}\"
WINDOW_MODE=\"\${WINDOW_MODE:-}\"
RESULT_FILE=\"\${RESULT_FILE:-/tmp/steam-bridge-smoke-default.log}\"
DIAGNOSTIC_DIR=\"\${DIAGNOSTIC_DIR:-\$RESULT_FILE.diagnostics}\"
ACTION_DELAY_MS=\"\${ACTION_DELAY_MS:-1500}\"
RESULT_DELAY_MS=\"\${RESULT_DELAY_MS:-8000}\"
CONTROL_SERVER=\"\${CONTROL_SERVER:-0}\"
CONTROL_FILE=\"\${CONTROL_FILE:-}\"
CONTROL_TOKEN=\"\${CONTROL_TOKEN:-}\"
KEEP_OPEN_AFTER_RESULT=\"\${KEEP_OPEN_AFTER_RESULT:-0}\"
REQUIRE_OVERLAY_ACTIVE=\"\${REQUIRE_OVERLAY_ACTIVE:-0}\"
WEB_URL=\"\${WEB_URL:-}\"
WEB_MODAL=\"\${WEB_MODAL:-}\"
CHECKOUT_URL=\"\${CHECKOUT_URL:-}\"
CHECKOUT_TRANSACTION_ID=\"\${CHECKOUT_TRANSACTION_ID:-}\"
CHECKOUT_RETURN_URL=\"\${CHECKOUT_RETURN_URL:-}\"
OVERLAY_DIALOG=\"\${OVERLAY_DIALOG:-}\"
USER_DIALOG=\"\${USER_DIALOG:-}\"
SHORTCUT_TARGET=\"\${SHORTCUT_TARGET:-}\"
PRESENTER_MODE=\"\${PRESENTER_MODE:-}\"
ACHIEVEMENT_NAME=\"\${ACHIEVEMENT_NAME:-}\"
ACHIEVEMENT_CURRENT=\"\${ACHIEVEMENT_CURRENT:-}\"
ACHIEVEMENT_MAX=\"\${ACHIEVEMENT_MAX:-}\"

rm -f \"\$RESULT_FILE\"
rm -rf \"\$DIAGNOSTIC_DIR\"
export SteamAppId=\"\$APP_ID\"
export SteamGameId=\"\$APP_ID\"
if [ \"\$OVERLAY_GAME_ID\" != \"inherit\" ]; then
  export SteamOverlayGameId=\"\$OVERLAY_GAME_ID\"
fi
export STEAM_BRIDGE_APP_ID=\"\$APP_ID\"
export STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE=\"\$OVERLAY_PROFILE\"
if [ -n \"\$OVERLAY_SCRUB_CHILD_ENV\" ]; then
  export STEAM_BRIDGE_ELECTRON_OVERLAY_SCRUB_CHILD_ENV=\"\$OVERLAY_SCRUB_CHILD_ENV\"
fi
if [ -n \"\$OVERLAY_ISOLATE_CHILD_PROCESSES\" ]; then
  export STEAM_BRIDGE_ELECTRON_OVERLAY_ISOLATE_CHILD_PROCESSES=\"\$OVERLAY_ISOLATE_CHILD_PROCESSES\"
fi
if [ -n \"\$WINDOW_MODE\" ]; then
  export STEAM_BRIDGE_SMOKE_WINDOW_MODE=\"\$WINDOW_MODE\"
fi
export STEAM_BRIDGE_SMOKE_AUTORUN=1
export STEAM_BRIDGE_SMOKE_AUTORUN_ACTION=\"\$AUTORUN_ACTION\"
export STEAM_BRIDGE_SMOKE_AUTORUN_ACTION_DELAY_MS=\"\$ACTION_DELAY_MS\"
export STEAM_BRIDGE_SMOKE_AUTORUN_RESULT_DELAY_MS=\"\$RESULT_DELAY_MS\"
export STEAM_BRIDGE_SMOKE_KEEP_OPEN_AFTER_RESULT=\"\$KEEP_OPEN_AFTER_RESULT\"
export STEAM_BRIDGE_SMOKE_CONTROL_SERVER=\"\$CONTROL_SERVER\"
if [ -n \"\$CONTROL_FILE\" ]; then
  export STEAM_BRIDGE_SMOKE_CONTROL_FILE=\"\$CONTROL_FILE\"
fi
if [ -n \"\$CONTROL_TOKEN\" ]; then
  export STEAM_BRIDGE_SMOKE_CONTROL_TOKEN=\"\$CONTROL_TOKEN\"
fi
export STEAM_BRIDGE_SMOKE_RESULT_FILE=\"\$RESULT_FILE\"
export STEAM_BRIDGE_SMOKE_DIAGNOSTIC_DIR=\"\$DIAGNOSTIC_DIR\"
export STEAM_BRIDGE_SMOKE_REQUIRE_OVERLAY_ACTIVE=\"\$REQUIRE_OVERLAY_ACTIVE\"
if [ -n \"\$WEB_URL\" ]; then
  export STEAM_BRIDGE_SMOKE_WEB_URL=\"\$WEB_URL\"
fi
if [ -n \"\$WEB_MODAL\" ]; then
  export STEAM_BRIDGE_SMOKE_WEB_MODAL=\"\$WEB_MODAL\"
fi
if [ -n \"\$CHECKOUT_URL\" ]; then
  export STEAM_BRIDGE_SMOKE_CHECKOUT_URL=\"\$CHECKOUT_URL\"
fi
if [ -n \"\$CHECKOUT_TRANSACTION_ID\" ]; then
  export STEAM_BRIDGE_SMOKE_CHECKOUT_TRANSACTION_ID=\"\$CHECKOUT_TRANSACTION_ID\"
fi
if [ -n \"\$CHECKOUT_RETURN_URL\" ]; then
  export STEAM_BRIDGE_SMOKE_CHECKOUT_RETURN_URL=\"\$CHECKOUT_RETURN_URL\"
fi
if [ -n \"\$OVERLAY_DIALOG\" ]; then
  export STEAM_BRIDGE_SMOKE_OVERLAY_DIALOG=\"\$OVERLAY_DIALOG\"
fi
if [ -n \"\$USER_DIALOG\" ]; then
  export STEAM_BRIDGE_SMOKE_USER_DIALOG=\"\$USER_DIALOG\"
fi
if [ -n \"\$SHORTCUT_TARGET\" ]; then
  export STEAM_BRIDGE_SMOKE_SHORTCUT_TARGET=\"\$SHORTCUT_TARGET\"
fi
if [ -n \"\$PRESENTER_MODE\" ]; then
  export STEAM_BRIDGE_SMOKE_PRESENTER_MODE=\"\$PRESENTER_MODE\"
  export STEAM_BRIDGE_ELECTRON_OVERLAY_PRESENTER=\"\$PRESENTER_MODE\"
fi
if [ -n \"\$ACHIEVEMENT_NAME\" ]; then
  export STEAM_BRIDGE_SMOKE_ACHIEVEMENT_NAME=\"\$ACHIEVEMENT_NAME\"
fi
if [ -n \"\$ACHIEVEMENT_CURRENT\" ]; then
  export STEAM_BRIDGE_SMOKE_ACHIEVEMENT_CURRENT=\"\$ACHIEVEMENT_CURRENT\"
fi
if [ -n \"\$ACHIEVEMENT_MAX\" ]; then
  export STEAM_BRIDGE_SMOKE_ACHIEVEMENT_MAX=\"\$ACHIEVEMENT_MAX\"
fi

cd \"\$APP_DIR\"
if command -v systemd-inhibit >/dev/null 2>&1; then
  exec systemd-inhibit --what=sleep --why=\"Steam Bridge smoke\" ./SteamBridgeSmoke --no-sandbox
fi
exec ./SteamBridgeSmoke --no-sandbox
EOF
chmod +x $wrapper_q"
}

helper_args=()

append_common_helper_args() {
  local resolved_profile
  resolved_profile="$(resolved_overlay_profile)"

  helper_args+=(
    "--app-id" "$app_id"
    "--action" "$action"
    "--overlay-profile" "$resolved_profile"
    "--result-file" "$result_file"
    "--result-delay-ms" "$result_delay_ms"
    "--timeout-seconds" "$timeout_seconds"
    "--app-name" "$app_name"
  )

  if [ -n "$overlay_scrub_child_env" ]; then
    helper_args+=("--overlay-scrub-child-env" "$overlay_scrub_child_env")
  fi
  if [ -n "$overlay_isolate_child_processes" ]; then
    helper_args+=("--overlay-isolate-child-processes" "$overlay_isolate_child_processes")
  fi

  if [ "$keep_open_after_result" = "1" ]; then
    helper_args+=("--keep-open-after-result")
  fi

  if [ -n "$window_mode" ]; then
    helper_args+=("--window-mode" "$window_mode")
  fi

  if [ -n "$steam_user_id" ]; then
    helper_args+=("--steam-user-id" "$steam_user_id")
  fi
  if [ -n "$web_url" ]; then
    helper_args+=("--web-url" "$web_url")
  fi
  if [ -n "$web_modal" ]; then
    helper_args+=("--web-modal" "$web_modal")
  fi
  if [ -n "$checkout_url" ]; then
    helper_args+=("--checkout-url" "$checkout_url")
  fi
  if [ -n "$checkout_transaction_id" ]; then
    helper_args+=("--checkout-transaction-id" "$checkout_transaction_id")
  fi
  if [ -n "$checkout_return_url" ]; then
    helper_args+=("--checkout-return-url" "$checkout_return_url")
  fi
  if [ -n "$overlay_dialog" ]; then
    helper_args+=("--dialog" "$overlay_dialog")
  fi
  if [ -n "$user_dialog" ]; then
    helper_args+=("--user-dialog" "$user_dialog")
  fi
  if [ -n "$shortcut_target" ]; then
    helper_args+=("--shortcut-target" "$shortcut_target")
  fi
  if [ -n "$presenter_mode" ]; then
    helper_args+=("--presenter-mode" "$presenter_mode")
  fi
  if [ -n "$achievement_name" ]; then
    helper_args+=("--achievement-name" "$achievement_name")
  fi
  if [ -n "$achievement_current" ]; then
    helper_args+=("--achievement-current" "$achievement_current")
  fi
  if [ -n "$achievement_max" ]; then
    helper_args+=("--achievement-max" "$achievement_max")
  fi
  if [ "$require_single_overlay_target" = "1" ]; then
    helper_args+=("--require-single-overlay-target")
  fi
  if [ "$require_passive_presenter" = "1" ]; then
    helper_args+=("--require-passive-presenter")
  fi
  if [ "$require_idle_presenter" = "1" ]; then
    helper_args+=("--require-idle-presenter")
  fi
  if [ "$require_electron_overlay" = "1" ]; then
    helper_args+=("--require-electron-overlay")
  fi
  if [ -n "$require_presenter_mode" ]; then
    helper_args+=("--require-presenter-mode" "$require_presenter_mode")
  fi
  if [ -n "$require_overlay_shortcut_target" ]; then
    helper_args+=("--require-overlay-shortcut-target" "$require_overlay_shortcut_target")
  fi
  if [ "$require_managed_overlay_isolation" = "1" ]; then
    helper_args+=("--require-managed-overlay-isolation")
  fi
  if [ -n "$require_restore_focus_delay_ms" ]; then
    helper_args+=("--require-restore-focus-delay-ms" "$require_restore_focus_delay_ms")
  fi
  if [ "$require_zero_managed_overlay_timing" = "1" ]; then
    helper_args+=("--require-zero-managed-overlay-timing")
  fi
  if [ "$require_no_crashes" = "1" ]; then
    helper_args+=("--require-no-crashes")
  fi
}

build_steam_launch_args() {
  helper_args=("--mode" "steam-launch")
  append_common_helper_args
  helper_args+=(
    "--shortcut-game-id" "$shortcut_game_id"
    "--require-steam-deck"
    "--require-overlay-injection"
  )

  if [ "$action" = "dialog" ] || [ "$action" = "friends" ]; then
    helper_args+=("--require-event" "overlay:dialog")
  elif [ "$action" = "store" ] || [ "$action" = "web" ]; then
    helper_args+=("--require-event" "overlay:$action")
    helper_args+=("--require-overlay-activated")
  elif [ "$action" = "native-probe" ] || [ "$action" = "native-dialog" ] || [ "$action" = "native-store" ] || [ "$action" = "native-web" ]; then
    helper_args+=("--require-event" "overlay:native-session-open")
  elif [ "$action" = "presenter-ready" ]; then
    helper_args+=("--require-event" "overlay:presenter-ready")
    helper_args+=("--require-no-overlay-activation")
  elif [ "$action" = "renderer-frame-rate" ]; then
    helper_args+=("--require-event" "renderer:frame-rate-sample")
    helper_args+=("--require-no-overlay-activation")
    helper_args+=("--require-no-crashes")
  elif [ "$action" = "presenter-shortcut" ]; then
    helper_args+=("--require-event" "overlay:presenter-shortcut-ready")
  elif [ "$action" = "presenter-checkout" ]; then
    if checkout_opens_overlay; then
      helper_args+=("--require-event" "overlay:presenter-open")
      helper_args+=("--require-overlay-activated")
    else
      helper_args+=("--require-event" "overlay:presenter-checkout-ready")
    fi
  elif [ "$action" = "presenter-web-open-and-wait" ] || [ "$action" = "presenter-duplicate-open-guard" ] || [ "$action" = "presenter-store-open-and-wait" ] || [ "$action" = "presenter-dialog-auto-open-and-wait" ] || [ "$action" = "presenter-friends-open-and-wait" ] || [ "$action" = "presenter-shortcut-open-and-wait" ]; then
    helper_args+=("--require-event" "overlay:presenter-open-and-wait-start")
    if [ "$action" = "presenter-duplicate-open-guard" ]; then
      helper_args+=("--require-event" "overlay:presenter-duplicate-open-guard")
    fi
    helper_args+=("--require-overlay-activated")
  elif [ "$action" = "presenter-dialog" ] || [ "$action" = "presenter-dialog-auto" ] || [ "$action" = "presenter-store" ] || [ "$action" = "presenter-web" ] || [ "$action" = "presenter-friends" ] || [ "$action" = "presenter-profile" ] || [ "$action" = "presenter-players" ] || [ "$action" = "presenter-community" ] || [ "$action" = "presenter-stats" ] || [ "$action" = "presenter-achievements" ] || [ "$action" = "presenter-user" ]; then
    helper_args+=("--require-event" "overlay:presenter-open")
    if [ "$action" = "presenter-store" ] || [ "$action" = "presenter-web" ] || [ "$action" = "presenter-friends" ] || [ "$action" = "presenter-profile" ] || [ "$action" = "presenter-players" ] || [ "$action" = "presenter-dialog-auto" ] || [ "$action" = "presenter-community" ] || [ "$action" = "presenter-stats" ] || [ "$action" = "presenter-achievements" ] || [ "$action" = "presenter-user" ]; then
      helper_args+=("--require-overlay-activated")
    fi
  elif [ "$action" = "presenter-achievement-progress" ]; then
    helper_args+=("--require-event" "overlay:presenter-attach")
    helper_args+=("--require-event" "achievement:progress")
  elif [ "$action" = "presenter-achievement-unlock" ]; then
    helper_args+=("--require-event" "overlay:presenter-attach")
    helper_args+=("--require-event" "achievement:unlock")
  fi

  if [ "$action" != "none" ] &&
    [ "$action" != "presenter-ready" ] &&
    [ "$action" != "renderer-frame-rate" ] &&
    [ "$action" != "presenter-achievement-progress" ] &&
    [ "$action" != "presenter-achievement-unlock" ] &&
    [ "$action" != "presenter-dialog" ] &&
    [ "$action" != "presenter-shortcut" ] &&
    { [ "$action" != "presenter-checkout" ] || checkout_opens_overlay; }; then
    helper_args+=("--require-event" "callback:overlay-activated")
  fi

  if is_presenter_product_action && uses_persistent_presenter; then
    helper_args+=("--require-single-overlay-target")
  fi
  if is_presenter_product_action; then
    helper_args+=("--require-no-crashes")
    if [ -z "$require_presenter_mode" ]; then
      helper_args+=("--require-presenter-mode" "$(effective_presenter_mode)")
    fi
    if [ "$require_zero_managed_overlay_timing" != "1" ] && [ -z "$require_restore_focus_delay_ms" ]; then
      helper_args+=("--require-zero-managed-overlay-timing")
    fi
    if [ "$require_managed_overlay_isolation" != "1" ]; then
      helper_args+=("--require-managed-overlay-isolation")
    fi
  fi
  if [ "$action" = "presenter-ready" ]; then
    helper_args+=("--require-no-crashes")
    helper_args+=("--require-idle-presenter")
    if [ -z "$require_presenter_mode" ]; then
      helper_args+=("--require-presenter-mode" "$(effective_presenter_mode)")
    fi
    if [ "$require_zero_managed_overlay_timing" != "1" ] && [ -z "$require_restore_focus_delay_ms" ]; then
      helper_args+=("--require-zero-managed-overlay-timing")
    fi
    if [ "$require_managed_overlay_isolation" != "1" ]; then
      helper_args+=("--require-managed-overlay-isolation")
    fi
  fi
  if { [ "$action" = "presenter-shortcut" ] || [ "$action" = "presenter-shortcut-open-and-wait" ]; } && [ -z "$require_overlay_shortcut_target" ]; then
    helper_args+=("--require-overlay-shortcut-target" "$(resolved_shortcut_target)")
  fi
  if uses_persistent_presenter; then
    if [ "$action" = "presenter-shortcut" ] ||
      { [ "$action" = "presenter-checkout" ] && ! checkout_opens_overlay; }; then
      helper_args+=("--require-idle-presenter")
    elif [ "$action" = "presenter-achievement-progress" ] || [ "$action" = "presenter-achievement-unlock" ]; then
      helper_args+=("--require-passive-presenter")
    fi
  fi

  if [ "$mode" = "game" ]; then
    helper_args+=("--require-big-picture")
  fi
}

build_direct_args() {
  helper_args=("--mode" "direct")
  append_common_helper_args
  helper_args+=("--require-steam-deck")
}

build_print_launch_options_args() {
  helper_args=("--mode" "print-launch-options")
  append_common_helper_args
  if [ -n "$shortcut_game_id" ]; then
    helper_args+=("--shortcut-game-id" "$shortcut_game_id")
  fi
}

build_print_shortcuts_args() {
  helper_args=("--mode" "print-shortcuts" "--app-name" "$app_name")
  if [ -n "$steam_user_id" ]; then
    helper_args+=("--steam-user-id" "$steam_user_id")
  fi
}

resolve_overlay_game_id() {
  case "$overlay_game_id" in
    ""|app)
      printf '%s\n' "$app_id"
      ;;
    inherit)
      printf '%s\n' "inherit"
      ;;
    shortcut)
      resolve_overlay_shortcut_game_id
      ;;
    *[!0-9]*)
      echo "Invalid --overlay-game-id: $overlay_game_id" >&2
      return 2
      ;;
    *)
      printf '%s\n' "$overlay_game_id"
      ;;
  esac
}

resolve_overlay_shortcut_game_id() {
  if [ -n "$shortcut_game_id" ] && [ "$shortcut_game_id" != "auto" ]; then
    printf '%s\n' "$shortcut_game_id"
    return 0
  fi

  local matches ids count
  local shortcut_args=("--mode" "print-shortcuts" "--app-name" "$app_name")
  if [ -n "$steam_user_id" ]; then
    shortcut_args+=("--steam-user-id" "$steam_user_id")
  fi
  matches="$(run_helper "${shortcut_args[@]}")"
  if [ -z "$matches" ]; then
    echo "Could not find Steam shortcut named \"$app_name\" to resolve --overlay-game-id shortcut." >&2
    return 1
  fi

  ids="$(printf '%s\n' "$matches" | python3 -c 'import json,sys; print("\n".join(sorted({json.loads(line)["gameId"] for line in sys.stdin if line.strip()})))')"
  count="$(printf '%s\n' "$ids" | sed '/^$/d' | wc -l | tr -d ' ')"
  if [ "$count" != "1" ]; then
    echo "Found multiple shortcut game IDs for \"$app_name\"; pass --shortcut-game-id explicitly:" >&2
    printf '%s\n' "$matches" >&2
    return 1
  fi

  printf '%s\n' "$ids" | sed -n '1p'
}

run_helper() {
  local args
  local remote_q
  remote_q="$(quote_arg "$remote_app_dir")"
  args="$(quote_args "$@")"
  remote_exec "export DISPLAY=\"\${DISPLAY:-:0}\"; if [ -z \"\${XAUTHORITY:-}\" ]; then XAUTHORITY=\"\$(ls /run/user/1000/xauth_* 2>/dev/null | head -n 1 || true)\"; export XAUTHORITY; fi; export DBUS_SESSION_BUS_ADDRESS=\"\${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/1000/bus}\"; cd $remote_q && ./linux-electron-smoke.sh $args"
}

run_helper_with_artifacts() {
  local status visual_status
  set +e
  run_helper "$@"
  status=$?
  run_visual_capture
  visual_status=$?
  collect_remote_diagnostics
  if [ "$status" -eq 0 ] && [ "$visual_status" -ne 0 ]; then
    status=$visual_status
  fi
  set -e

  return "$status"
}

run_preflight() {
  local remote_q matches match_count overlay_enabled_count
  remote_q="$(quote_arg "$remote_app_dir")"

  echo "Steam Deck smoke preflight"
  echo "Target: $host"
  echo "Remote app dir: $remote_app_dir"

  if [ "$copy_app" = "1" ]; then
    assert_local_app
    echo "Local package: $local_app_dir"
  else
    echo "Local package copy: skipped"
  fi

  check_ssh

  remote_exec "set -e; echo \"Remote host: \$(uname -n 2>/dev/null || printf unknown)\"; echo \"Remote kernel: \$(uname -srmo 2>/dev/null || uname -a)\"; if [ -x $remote_q/SteamBridgeSmoke ] && [ -x $remote_q/linux-electron-smoke.sh ] && [ -x $remote_q/chrome_crashpad_handler ] && [ -x $remote_q/chrome-sandbox ]; then echo \"Remote package: present\"; else echo \"Remote package: incomplete or non-executable at $remote_app_dir\"; fi; if command -v steam >/dev/null 2>&1; then echo \"Steam command: \$(command -v steam)\"; elif [ -x \"\$HOME/.steam/root/ubuntu12_32/steam\" ]; then echo \"Steam command: \$HOME/.steam/root/ubuntu12_32/steam\"; else echo \"Steam command: missing\"; fi; if command -v systemd-inhibit >/dev/null 2>&1; then echo \"Sleep inhibitor: available\"; else echo \"Sleep inhibitor: missing\"; fi; if ls \"\$HOME/.local/share/Steam/userdata\"/*/config/shortcuts.vdf >/dev/null 2>&1; then echo \"Shortcut files: present\"; else echo \"Shortcut files: missing\"; fi"

  if [ "$copy_app" = "0" ]; then
    remote_exec "test -x $remote_q/SteamBridgeSmoke && test -x $remote_q/linux-electron-smoke.sh && test -x $remote_q/chrome_crashpad_handler && test -x $remote_q/chrome-sandbox" || {
      echo "Remote package is required when --skip-copy is used." >&2
      return 1
    }
  fi

  if remote_exec "test -x $remote_q/linux-electron-smoke.sh" >/dev/null 2>&1; then
    build_print_shortcuts_args
    matches="$(run_helper "${helper_args[@]}")"
    if [ -n "$matches" ]; then
      match_count="$(printf '%s\n' "$matches" | awk 'NF { count += 1 } END { print count + 0 }')"
      overlay_enabled_count="$(printf '%s\n' "$matches" | grep -Ec '"allowOverlay"[[:space:]]*:[[:space:]]*1' || true)"
      echo "Matching shortcuts: $match_count (overlay-enabled: $overlay_enabled_count)"
    else
      echo "Matching shortcuts: 0"
    fi
  else
    echo "Matching shortcuts: skipped until the package is copied"
  fi
}

run_remote_mode() {
  case "$mode" in
    game|desktop)
      cleanup_deck_smoke_runtime
      if [ "$copy_app" = "1" ]; then
        copy_to_deck
      fi
      if [ "$mode" = "desktop" ]; then
        copy_kwin_active_window_probe
      fi
      clear_deck_transient_shells
      start_keep_awake
      trap stop_keep_awake EXIT
      build_steam_launch_args
      prepare_remote_wrapper
      run_helper_with_artifacts "${helper_args[@]}"
      ;;
    direct)
      cleanup_deck_smoke_runtime
      if [ "$copy_app" = "1" ]; then
        copy_to_deck
      fi
      clear_deck_transient_shells
      start_keep_awake
      trap stop_keep_awake EXIT
      build_direct_args
      run_helper_with_artifacts "${helper_args[@]}"
      ;;
    cleanup)
      cleanup_deck_smoke_runtime
      ;;
    discover)
      run_discover
      ;;
    preflight)
      run_preflight
      ;;
    print-launch-options)
      build_print_launch_options_args
      run_helper "${helper_args[@]}"
      ;;
    print-shortcuts)
      build_print_shortcuts_args
      run_helper "${helper_args[@]}"
      ;;
    *)
      echo "Unknown mode: $mode" >&2
      usage >&2
      exit 2
      ;;
  esac
}

run_self_test() {
  local game_args desktop_args renderer_args dialog_args friends_args open_wait_args community_args stats_args achievements_args checkout_args real_checkout_args toast_args unlock_toast_args direct_check original_local_app_dir package_fixture
  original_local_app_dir="$local_app_dir"
  package_fixture="$(mktemp -d)"
  printf '%s\n' smoke >"$package_fixture/SteamBridgeSmoke"
  printf '%s\n' helper >"$package_fixture/linux-electron-smoke.sh"
  printf '%s\n' crashpad >"$package_fixture/chrome_crashpad_handler"
  printf '%s\n' sandbox >"$package_fixture/chrome-sandbox"
  chmod 0644 "$package_fixture/SteamBridgeSmoke" "$package_fixture/linux-electron-smoke.sh" "$package_fixture/chrome_crashpad_handler" "$package_fixture/chrome-sandbox"
  local_app_dir="$package_fixture"
  assert_local_app
  local_app_dir="$original_local_app_dir"
  rm -rf "$package_fixture"

  mode="game"
  build_steam_launch_args
  game_args="$(quote_args "${helper_args[@]}")"
  if [[ "$game_args" != *"--require-big-picture"* ]]; then
    echo "Self-test failed: Game Mode args must require Big Picture." >&2
    exit 1
  fi
  if [[ "$game_args" != *"--shortcut-game-id auto"* ]]; then
    echo "Self-test failed: Game Mode args must use shortcut auto-discovery by default." >&2
    exit 1
  fi
  if [[ "$game_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Steam launch args must require the overlay callback." >&2
    exit 1
  fi
  if [[ "$game_args" != *"--overlay-profile diagnostic"* ]]; then
    echo "Self-test failed: Game Mode args must default to the diagnostic overlay profile." >&2
    exit 1
  fi

  mode="desktop"
  build_steam_launch_args
  desktop_args="$(quote_args "${helper_args[@]}")"
  if [[ "$desktop_args" == *"--require-big-picture"* ]]; then
    echo "Self-test failed: Desktop Mode args must not require Big Picture." >&2
    exit 1
  fi
  if [[ "$desktop_args" != *"--overlay-profile repaint"* ]]; then
    echo "Self-test failed: Desktop Mode args must default to the repaint overlay profile." >&2
    exit 1
  fi
  action="renderer-frame-rate"
  build_steam_launch_args
  renderer_args="$(quote_args "${helper_args[@]}")"
  if [[ "$renderer_args" != *"--require-event renderer:frame-rate-sample"* ]] ||
    [[ "$renderer_args" != *"--require-no-overlay-activation"* ]] ||
    [[ "$renderer_args" == *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Renderer FPS diagnostics must require their sample without requiring overlay activation." >&2
    exit 1
  fi
  action="dialog"
  if ! grep -Fq 'export STEAM_BRIDGE_SMOKE_CONTROL_SERVER=\"\$CONTROL_SERVER\"' "$0" ||
    ! grep -Fq 'export STEAM_BRIDGE_SMOKE_CONTROL_FILE=\"\$CONTROL_FILE\"' "$0" ||
    ! grep -Fq 'export STEAM_BRIDGE_SMOKE_CONTROL_TOKEN=\"\$CONTROL_TOKEN\"' "$0"; then
    echo "Self-test failed: Steam shortcut wrapper must forward bounded localhost control configuration." >&2
    exit 1
  fi
  if ! grep -Fq 'export SteamOverlayGameId=\"\$OVERLAY_GAME_ID\"' "$0"; then
    echo "Self-test failed: Steam shortcut wrapper must export configurable SteamOverlayGameId." >&2
    exit 1
  fi
  if ! grep -Fq 'OVERLAY_GAME_ID=\"\${OVERLAY_GAME_ID:-\$APP_ID}\"' "$0"; then
    echo "Self-test failed: Steam shortcut wrapper must default overlay game ID to the app ID." >&2
    exit 1
  fi
  overlay_game_id="123456789"
  if [ "$(resolve_overlay_game_id)" != "123456789" ]; then
    echo "Self-test failed: explicit overlay game ID did not resolve." >&2
    exit 1
  fi
  overlay_game_id="app"
  if [ "$(resolve_overlay_game_id)" != "$app_id" ]; then
    echo "Self-test failed: app overlay game ID did not resolve to app ID." >&2
    exit 1
  fi
  if ! grep -Fq 'capture_deck_overlay_state "${label_prefix}after-toggle-open"' "$0"; then
    echo "Self-test failed: Visual toggle probes must capture Deck overlay state." >&2
    exit 1
  fi
  if sed -n '/^capture_deck_overlay_state()/,/^}/p' "$0" | grep -Fq "pgrep -af '[S]teamBridgeSmoke|[g]ameoverlayui|[s]teamwebhelper'"; then
    echo "Self-test failed: Deck overlay state must not retain full process command lines." >&2
    exit 1
  fi
  if ! sed -n '/^capture_deck_overlay_state()/,/^}/p' "$0" | grep -Fq "sed 's/=.*$/=<redacted>/'"; then
    echo "Self-test failed: Deck overlay state must redact captured environment values." >&2
    exit 1
  fi
  if ! sed -n '/^run_helper()/,/^}/p' "$0" | grep -Fq 'export DISPLAY=\"\${DISPLAY:-:0}\"'; then
    echo "Self-test failed: Deck helper runs must inherit the graphical session environment." >&2
    exit 1
  fi
  if ! grep -Fq 'verify_deck_overlay_closed_after_probe "1"' "$0"; then
    echo "Self-test failed: Managed shortcut toggle probes must verify close/deactivation evidence." >&2
    exit 1
  fi
  if ! grep -Fq "event:overlay:presenter-after-close" "$0"; then
    echo "Self-test failed: Deck close verification must require post-close presenter parking evidence." >&2
    exit 1
  fi
  if ! grep -Fq "event:overlay:presenter-after-close-stable" "$0"; then
    echo "Self-test failed: Deck close verification must require stable post-close presenter parking evidence." >&2
    exit 1
  fi
  if ! grep -Fq "native presenter pump count changed after close" "$0"; then
    echo "Self-test failed: Deck close verification must require no post-close presenter pumping." >&2
    exit 1
  fi
  if ! grep -Fq "wait_for_web_overlay_closed 3.0 || true" "$0"; then
    echo "Self-test failed: Web close probe must wait for close evidence after clicking the Steam web close control." >&2
    exit 1
  fi
  if [ "$(awk '/^send_deck_web_overlay_close_probe[(][)]/ { inside=1; next } inside && /^verify_deck_overlay_closed_after_probe[(][)]/ { print clicks + 0; exit } inside && /xdotool mousemove .* click 1/ { clicks += 1 }' "$0")" != "1" ]; then
    echo "Self-test failed: Web close probe must use one Steam web close-control click." >&2
    exit 1
  fi
  if ! grep -Fq "clear_kwin_overview_if_active" "$0"; then
    echo "Self-test failed: Web close probe must clear KWin overview before clicking the Steam web close control." >&2
    exit 1
  fi
  if ! awk '/^send_deck_web_overlay_close_probe[(][)]/ { inside=1 } /^verify_deck_overlay_closed_after_probe[(][)]/ { inside=0 } inside' "$0" | grep -Fq 'Detected Steam web close control'; then
    echo "Self-test failed: Web close probe must detect the Steam close glyph before clicking." >&2
    exit 1
  fi
  if awk '/^send_deck_web_overlay_close_probe[(][)]/ { inside=1 } /^verify_deck_overlay_closed_after_probe[(][)]/ { inside=0 } inside' "$0" | grep -Eq 'host_(width|height) \* [0-9]+ / 100'; then
    echo "Self-test failed: Web close probe must not use a fixed percentage click target." >&2
    exit 1
  fi
  if ! grep -Fq "clear_deck_transient_shells" "$0"; then
    echo "Self-test failed: Deck launch path must clear transient desktop shell state before visual proofs." >&2
    exit 1
  fi
  if ! sed -n '/^capture_deck_screenshot()/,/^}/p' "$0" | grep -Fq 'gamescopectl screenshot'; then
    echo "Self-test failed: Game Mode screenshots must use Gamescope capture." >&2
    exit 1
  fi
  if ! sed -n '/^capture_deck_screenshot()/,/^}/p' "$0" | grep -Fq 'gamescope-session.service'; then
    echo "Self-test failed: Screenshot capture must select its tool from the active Deck session." >&2
    exit 1
  fi
  if ! sed -n '/^capture_deck_screenshot()/,/^}/p' "$0" | grep -Fq 'Spectacle screenshot was not written after three attempts.'; then
    echo "Self-test failed: Desktop screenshot capture must retry transient Spectacle failures." >&2
    exit 1
  fi
  if ! awk '/^run_visual_capture[(][)]/ { inside=1 } /^wait_for_deck_shortcut_overlay_open[(][)]/ { inside=0 } inside' "$0" | grep -Fq 'send_deck_overlay_escape_probe'; then
    echo "Self-test failed: Game Mode close capture must support SteamUI Escape input." >&2
    exit 1
  fi
  if ! sed -n '/^send_deck_overlay_escape_probe()/,/^}/p' "$0" | grep -Fq 'XAUTHORITY='; then
    echo "Self-test failed: SteamUI Escape input must discover the active X11 authority for SSH-driven probes." >&2
    exit 1
  fi
  if ! sed -n '/^send_deck_overlay_escape_probe()/,/^}/p' "$0" | grep -Fq 'xdotool getdisplaygeometry'; then
    echo "Self-test failed: SteamUI Escape input must authenticate its target display before sending input." >&2
    exit 1
  fi
  if ! sed -n '/^persistent_presenter_parking_required()/,/^}/p' "$0" | grep -Fq 'is_presenter_product_action && uses_persistent_presenter'; then
    echo "Self-test failed: Raw Game Mode routes must not require managed presenter parking events." >&2
    exit 1
  fi
  if [ "$(sed -n '/^run_remote_mode()/,/^}/p' "$0" | grep -c '^[[:space:]]*cleanup_deck_smoke_runtime$')" != "3" ]; then
    echo "Self-test failed: Deck launch paths and explicit cleanup mode must share exact runtime cleanup." >&2
    exit 1
  fi
  if ! awk '/^cleanup_deck_smoke_runtime[(][)]/ { inside=1 } /^send_deck_overlay_close_probe[(][)]/ { inside=0 } inside' "$0" | grep -Fq 'target_process_live'; then
    echo "Self-test failed: Deck runtime cleanup must classify process state." >&2
    exit 1
  fi
  if ! awk '/^cleanup_deck_smoke_runtime[(][)]/ { inside=1 } /^send_deck_overlay_close_probe[(][)]/ { inside=0 } inside' "$0" | grep -Fq "Z|X|'') return 1"; then
    echo "Self-test failed: Deck runtime cleanup must treat zombie and exited targets as non-live." >&2
    exit 1
  fi
  if [ "$(awk '/^cleanup_deck_smoke_runtime[(][)]/ { inside=1 } /^send_deck_overlay_close_probe[(][)]/ { inside=0 } inside' "$0" | grep -Fc 'executable=\"\${executable% (deleted)}\"')" != "2" ]; then
    echo "Self-test failed: Deck runtime cleanup must recognize replaced executable images." >&2
    exit 1
  fi
  if ! sed -n '/^run_remote_mode()/,/^}/p' "$0" | awk '
    /^[[:space:]]*cleanup_deck_smoke_runtime$/ { cleanup = NR; next }
    /^[[:space:]]*copy_to_deck$/ {
      copies += 1
      if (!cleanup || cleanup > NR) exit 1
      cleanup = 0
    }
    END { if (copies != 2) exit 1 }
  '; then
    echo "Self-test failed: Deck launch paths must clean the previous runtime before copying the package." >&2
    exit 1
  fi
  if ! grep -Fq "event:overlay:presenter-wait-shown" "$0"; then
    echo "Self-test failed: Deck close verification must require managed overlay shown wait evidence." >&2
    exit 1
  fi
  if ! grep -Fq "event:overlay:presenter-wait-closed" "$0"; then
    echo "Self-test failed: Deck close verification must require managed overlay closed wait evidence." >&2
    exit 1
  fi
  if ! grep -Fq "event:overlay:presenter-parked" "$0"; then
    echo "Self-test failed: Deck close verification must require managed overlay parked wait evidence." >&2
    exit 1
  fi

  action="presenter-dialog"
  overlay_dialog="Achievements"
  build_steam_launch_args
  dialog_args="$(quote_args "${helper_args[@]}")"
  if [[ "$dialog_args" != *"--dialog Achievements"* ]]; then
    echo "Self-test failed: Presenter dialog args must pass the requested dialog target." >&2
    exit 1
  fi
  if [[ "$dialog_args" == *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter dialog investigation args must not require overlay activation." >&2
    exit 1
  fi
  overlay_dialog=""

  action="presenter-dialog-auto"
  overlay_dialog="Achievements"
  build_steam_launch_args
  dialog_args="$(quote_args "${helper_args[@]}")"
  if [[ "$dialog_args" != *"--dialog Achievements"* ]]; then
    echo "Self-test failed: Presenter dialog auto args must pass the requested dialog target." >&2
    exit 1
  fi
  if [[ "$dialog_args" != *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter dialog auto args must require overlay activation." >&2
    exit 1
  fi
  if [[ "$dialog_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Presenter dialog auto args must require the overlay callback." >&2
    exit 1
  fi
  overlay_dialog=""

  action="presenter-friends"
  build_steam_launch_args
  friends_args="$(quote_args "${helper_args[@]}")"
  if [[ "$friends_args" != *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter friends args must require overlay activation." >&2
    exit 1
  fi
  if [[ "$friends_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Presenter friends args must require the overlay callback." >&2
    exit 1
  fi
  if [[ "$friends_args" != *"--require-no-crashes"* ]]; then
    echo "Self-test failed: Presenter product args must require no crash diagnostics." >&2
    exit 1
  fi
  if [[ "$friends_args" != *"--require-presenter-mode persistent"* ]]; then
    echo "Self-test failed: Presenter product args must require persistent presenter mode by default." >&2
    exit 1
  fi
  if [[ "$friends_args" != *"--require-zero-managed-overlay-timing"* ]]; then
    echo "Self-test failed: Presenter product args must require zero managed overlay timing by default." >&2
    exit 1
  fi
  if [[ "$friends_args" != *"--require-managed-overlay-isolation"* ]]; then
    echo "Self-test failed: Presenter product args must require managed overlay isolation by default." >&2
    exit 1
  fi

  action="presenter-web-open-and-wait"
  build_steam_launch_args
  open_wait_args="$(quote_args "${helper_args[@]}")"
  if [[ "$open_wait_args" != *"--require-event overlay:presenter-open-and-wait-start"* ]]; then
    echo "Self-test failed: Presenter openAndWait args must require the start event." >&2
    exit 1
  fi
  if [[ "$open_wait_args" != *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter openAndWait args must require overlay activation." >&2
    exit 1
  fi
  if [[ "$open_wait_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Presenter openAndWait args must require the overlay callback." >&2
    exit 1
  fi
  if [[ "$open_wait_args" != *"--require-no-crashes"* ]]; then
    echo "Self-test failed: Presenter openAndWait args must require no crash diagnostics." >&2
    exit 1
  fi
  if [[ "$open_wait_args" != *"--require-presenter-mode persistent"* ]]; then
    echo "Self-test failed: Presenter openAndWait args must require persistent presenter diagnostics." >&2
    exit 1
  fi
  if [[ "$open_wait_args" != *"--require-zero-managed-overlay-timing"* ]]; then
    echo "Self-test failed: Presenter openAndWait args must require zero managed overlay timing diagnostics." >&2
    exit 1
  fi
  if [[ "$open_wait_args" != *"--require-managed-overlay-isolation"* ]]; then
    echo "Self-test failed: Presenter openAndWait args must require managed overlay isolation diagnostics." >&2
    exit 1
  fi

  action="presenter-store-open-and-wait"
  build_steam_launch_args
  store_open_wait_args="$(quote_args "${helper_args[@]}")"
  if [[ "$store_open_wait_args" != *"--require-event overlay:presenter-open-and-wait-start"* ]]; then
    echo "Self-test failed: Presenter store openAndWait args must require the start event." >&2
    exit 1
  fi
  if [[ "$store_open_wait_args" != *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter store openAndWait args must require overlay activation." >&2
    exit 1
  fi
  if [[ "$store_open_wait_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Presenter store openAndWait args must require the overlay callback." >&2
    exit 1
  fi
  if [[ "$store_open_wait_args" != *"--require-no-crashes"* ]]; then
    echo "Self-test failed: Presenter store openAndWait args must require no crash diagnostics." >&2
    exit 1
  fi
  if [[ "$store_open_wait_args" != *"--require-presenter-mode persistent"* ]]; then
    echo "Self-test failed: Presenter store openAndWait args must require persistent presenter diagnostics." >&2
    exit 1
  fi

  action="presenter-dialog-auto-open-and-wait"
  overlay_dialog="OfficialGameGroup"
  build_steam_launch_args
  dialog_open_wait_args="$(quote_args "${helper_args[@]}")"
  if [[ "$dialog_open_wait_args" != *"--dialog OfficialGameGroup"* ]]; then
    echo "Self-test failed: Presenter dialog openAndWait args must pass the requested dialog target." >&2
    exit 1
  fi
  if [[ "$dialog_open_wait_args" != *"--require-event overlay:presenter-open-and-wait-start"* ]]; then
    echo "Self-test failed: Presenter dialog openAndWait args must require the start event." >&2
    exit 1
  fi
  if [[ "$dialog_open_wait_args" != *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter dialog openAndWait args must require overlay activation." >&2
    exit 1
  fi
  if [[ "$dialog_open_wait_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Presenter dialog openAndWait args must require the overlay callback." >&2
    exit 1
  fi
  if [[ "$dialog_open_wait_args" != *"--require-no-crashes"* ]]; then
    echo "Self-test failed: Presenter dialog openAndWait args must require no crash diagnostics." >&2
    exit 1
  fi
  if [[ "$dialog_open_wait_args" != *"--require-presenter-mode persistent"* ]]; then
    echo "Self-test failed: Presenter dialog openAndWait args must require persistent presenter diagnostics." >&2
    exit 1
  fi
  overlay_dialog=""

  action="presenter-friends-open-and-wait"
  build_steam_launch_args
  friends_open_wait_args="$(quote_args "${helper_args[@]}")"
  if [[ "$friends_open_wait_args" != *"--require-event overlay:presenter-open-and-wait-start"* ]]; then
    echo "Self-test failed: Presenter Friends openAndWait args must require the start event." >&2
    exit 1
  fi
  if [[ "$friends_open_wait_args" != *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter Friends openAndWait args must require overlay activation." >&2
    exit 1
  fi
  if [[ "$friends_open_wait_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Presenter Friends openAndWait args must require the overlay callback." >&2
    exit 1
  fi
  if [[ "$friends_open_wait_args" != *"--require-no-crashes"* ]]; then
    echo "Self-test failed: Presenter Friends openAndWait args must require no crash diagnostics." >&2
    exit 1
  fi
  if [[ "$friends_open_wait_args" != *"--require-presenter-mode persistent"* ]]; then
    echo "Self-test failed: Presenter Friends openAndWait args must require persistent presenter diagnostics." >&2
    exit 1
  fi

  action="presenter-community"
  build_steam_launch_args
  community_args="$(quote_args "${helper_args[@]}")"
  if [[ "$community_args" != *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter community args must require overlay activation." >&2
    exit 1
  fi
  if [[ "$community_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Presenter community args must require the overlay callback." >&2
    exit 1
  fi

  action="presenter-stats"
  build_steam_launch_args
  stats_args="$(quote_args "${helper_args[@]}")"
  if [[ "$stats_args" != *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter stats args must require overlay activation." >&2
    exit 1
  fi
  if [[ "$stats_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Presenter stats args must require the overlay callback." >&2
    exit 1
  fi

  action="presenter-achievements"
  build_steam_launch_args
  achievements_args="$(quote_args "${helper_args[@]}")"
  if [[ "$achievements_args" != *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter achievements args must require overlay activation." >&2
    exit 1
  fi
  if [[ "$achievements_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Presenter achievements args must require the overlay callback." >&2
    exit 1
  fi

  action="presenter-user"
  user_dialog="steamid"
  build_steam_launch_args
  user_args="$(quote_args "${helper_args[@]}")"
  if [[ "$user_args" != *"--user-dialog steamid"* ]]; then
    echo "Self-test failed: Presenter user args must pass the requested user dialog." >&2
    exit 1
  fi
  if [[ "$user_args" != *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter user args must require overlay activation." >&2
    exit 1
  fi
  if [[ "$user_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Presenter user args must require the overlay callback." >&2
    exit 1
  fi
  user_dialog=""

  action="presenter-shortcut"
  shortcut_target="web"
  presenter_mode="session"
  build_steam_launch_args
  shortcut_args="$(quote_args "${helper_args[@]}")"
  if [[ "$shortcut_args" != *"--require-event overlay:presenter-shortcut-ready"* ]]; then
    echo "Self-test failed: Presenter shortcut args must require the shortcut-ready event." >&2
    exit 1
  fi
  if [[ "$shortcut_args" != *"--shortcut-target web"* ]]; then
    echo "Self-test failed: Presenter shortcut args must pass the requested shortcut target." >&2
    exit 1
  fi
  if [[ "$shortcut_args" != *"--presenter-mode session"* ]]; then
    echo "Self-test failed: Presenter shortcut args must pass the requested presenter mode." >&2
    exit 1
  fi
  if [[ "$shortcut_args" != *"--require-presenter-mode session"* ]]; then
    echo "Self-test failed: Session presenter shortcut args must require session presenter diagnostics." >&2
    exit 1
  fi
  if [[ "$shortcut_args" != *"--require-zero-managed-overlay-timing"* ]]; then
    echo "Self-test failed: Session presenter shortcut args must require zero managed overlay timing diagnostics." >&2
    exit 1
  fi
  if [[ "$shortcut_args" != *"--require-managed-overlay-isolation"* ]]; then
    echo "Self-test failed: Session presenter shortcut args must require managed overlay isolation diagnostics." >&2
    exit 1
  fi
  if [[ "$shortcut_args" != *"--require-overlay-shortcut-target web"* ]]; then
    echo "Self-test failed: Presenter shortcut args must require the requested shortcut target diagnostics." >&2
    exit 1
  fi
  if [[ "$shortcut_args" == *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Presenter shortcut args must not require overlay activation before the visual toggle probe." >&2
    exit 1
  fi
  if [[ "$shortcut_args" == *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Presenter shortcut args must not require the overlay callback before the visual toggle probe." >&2
    exit 1
  fi
  if [[ "$shortcut_args" == *"--require-single-overlay-target"* ]]; then
    echo "Self-test failed: Session presenter shortcut args must not require a persistent overlay target before the visual toggle probe." >&2
    exit 1
  fi
  if [[ "$shortcut_args" == *"--require-idle-presenter"* ]]; then
    echo "Self-test failed: Session presenter shortcut args must not require persistent idle presenter parking." >&2
    exit 1
  fi
  if [[ "$shortcut_args" != *"--require-no-crashes"* ]]; then
    echo "Self-test failed: Session presenter shortcut args must still require no crash diagnostics." >&2
    exit 1
  fi
  shortcut_target=""
  presenter_mode=""

  require_single_overlay_target="1"
  require_no_crashes="1"
  build_steam_launch_args
  shortcut_args="$(quote_args "${helper_args[@]}")"
  if [[ "$shortcut_args" != *"--require-single-overlay-target"* ]]; then
    echo "Self-test failed: Deck args must pass the single overlay target requirement when requested." >&2
    exit 1
  fi
  if [[ "$shortcut_args" != *"--require-no-crashes"* ]]; then
    echo "Self-test failed: Deck args must pass the no crash requirement when requested." >&2
    exit 1
  fi
  if [[ "$shortcut_args" != *"--require-idle-presenter"* ]]; then
    echo "Self-test failed: Persistent presenter shortcut args must require idle presenter parking." >&2
    exit 1
  fi
  if [[ "$shortcut_args" != *"--require-presenter-mode persistent"* ]]; then
    echo "Self-test failed: Persistent presenter shortcut args must require persistent presenter diagnostics." >&2
    exit 1
  fi
  if [[ "$shortcut_args" != *"--require-overlay-shortcut-target friends"* ]]; then
    echo "Self-test failed: Persistent presenter shortcut args must require default shortcut target diagnostics." >&2
    exit 1
  fi
  require_single_overlay_target="0"
  require_no_crashes="0"

  action="presenter-checkout"
  checkout_url=""
  checkout_transaction_id=""
  checkout_return_url=""
  build_steam_launch_args
  checkout_args="$(quote_args "${helper_args[@]}")"
  if [[ "$checkout_args" != *"--require-event overlay:presenter-checkout-ready"* ]]; then
    echo "Self-test failed: Prepare-only checkout args must require the checkout-ready event." >&2
    exit 1
  fi
  if [[ "$checkout_args" == *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Prepare-only checkout args must not require overlay activation." >&2
    exit 1
  fi
  if [[ "$checkout_args" == *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Prepare-only checkout args must not require the overlay callback." >&2
    exit 1
  fi
  if [[ "$checkout_args" != *"--require-no-crashes"* ]]; then
    echo "Self-test failed: Checkout args must require no crash diagnostics." >&2
    exit 1
  fi
  if [[ "$checkout_args" != *"--require-presenter-mode persistent"* ]]; then
    echo "Self-test failed: Checkout args must require persistent presenter diagnostics." >&2
    exit 1
  fi

  checkout_transaction_id="123456789"
  build_steam_launch_args
  real_checkout_args="$(quote_args "${helper_args[@]}")"
  if [[ "$real_checkout_args" != *"--checkout-transaction-id 123456789"* ]]; then
    echo "Self-test failed: Real checkout args must pass the transaction ID." >&2
    exit 1
  fi
  if [[ "$real_checkout_args" != *"--require-event overlay:presenter-open"* ]]; then
    echo "Self-test failed: Real checkout args must require presenter-open." >&2
    exit 1
  fi
  if [[ "$real_checkout_args" != *"--require-overlay-activated"* ]]; then
    echo "Self-test failed: Real checkout args must require overlay activation." >&2
    exit 1
  fi
  if [[ "$real_checkout_args" != *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Real checkout args must require the overlay callback." >&2
    exit 1
  fi
  checkout_transaction_id=""

  action="presenter-achievement-progress"
  build_steam_launch_args
  toast_args="$(quote_args "${helper_args[@]}")"
  if [[ "$toast_args" != *"--require-event achievement:progress"* ]]; then
    echo "Self-test failed: Toast args must require the achievement progress event." >&2
    exit 1
  fi
  if [[ "$toast_args" == *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Toast args must not require modal overlay activation." >&2
    exit 1
  fi
  if [[ "$toast_args" != *"--require-no-crashes"* ]]; then
    echo "Self-test failed: Toast args must require no crash diagnostics." >&2
    exit 1
  fi
  if [[ "$toast_args" != *"--require-passive-presenter"* ]]; then
    echo "Self-test failed: Toast args must require passive presenter diagnostics." >&2
    exit 1
  fi
  if [[ "$toast_args" != *"--require-presenter-mode persistent"* ]]; then
    echo "Self-test failed: Toast args must require persistent presenter diagnostics." >&2
    exit 1
  fi
  if [[ "$toast_args" != *"--require-zero-managed-overlay-timing"* ]]; then
    echo "Self-test failed: Toast args must require zero managed overlay timing diagnostics." >&2
    exit 1
  fi
  if [[ "$toast_args" != *"--require-managed-overlay-isolation"* ]]; then
    echo "Self-test failed: Toast args must require managed overlay isolation diagnostics." >&2
    exit 1
  fi

  action="presenter-achievement-unlock"
  build_steam_launch_args
  unlock_toast_args="$(quote_args "${helper_args[@]}")"
  if [[ "$unlock_toast_args" != *"--require-event achievement:unlock"* ]]; then
    echo "Self-test failed: Unlock toast args must require the achievement unlock event." >&2
    exit 1
  fi
  if [[ "$unlock_toast_args" == *"--require-event callback:overlay-activated"* ]]; then
    echo "Self-test failed: Unlock toast args must not require modal overlay activation." >&2
    exit 1
  fi
  if [[ "$unlock_toast_args" != *"--require-no-crashes"* ]]; then
    echo "Self-test failed: Unlock toast args must require no crash diagnostics." >&2
    exit 1
  fi
  if [[ "$unlock_toast_args" != *"--require-passive-presenter"* ]]; then
    echo "Self-test failed: Unlock toast args must require passive presenter diagnostics." >&2
    exit 1
  fi
  if [[ "$unlock_toast_args" != *"--require-presenter-mode persistent"* ]]; then
    echo "Self-test failed: Unlock toast args must require persistent presenter diagnostics." >&2
    exit 1
  fi

  action="dialog"
  build_direct_args
  direct_check="$(quote_args "${helper_args[@]}")"
  if [[ "$direct_check" != *"--mode direct"* || "$direct_check" != *"--require-steam-deck"* ]]; then
    echo "Self-test failed: Direct args must verify a Deck init result." >&2
    exit 1
  fi

  discover_subnet="192.168.50"
  if [ "$(detect_ipv4_prefix)" != "192.168.50" ]; then
    echo "Self-test failed: Discovery subnet prefix was not preserved." >&2
    exit 1
  fi

  echo "Steam Deck smoke host runner self-test passed."
}

if [ "$mode" = "self-test" ]; then
  run_self_test
else
  run_remote_mode
fi
