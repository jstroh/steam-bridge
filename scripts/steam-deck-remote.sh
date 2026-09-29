#!/usr/bin/env bash

default_app_dir="/home/deck/steam-bridge-smoke/SteamBridgeSmoke-linux-x64"
default_inhibit_pid_file="/tmp/steam-bridge-smoke-inhibit.pid"

usage() {
  cat <<'EOF'
Usage:
  steam-deck-remote.sh COMMAND [options]

Deck-side helper that steam-deck-smoke.sh installs and calls over SSH. It owns
the Deck session environment (DISPLAY, XAUTHORITY, and the session bus), Game
Mode display selection (SteamUI on :0, the app on :1), Gamescope or Spectacle
capture, key input, focus and state probes, and exact runtime cleanup.

Commands:
  status [--app-dir DIR]        Report the host, package, Steam, OS release, session mode,
                                Desktop Mode display power, runner tools, and /dev/uinput access.
  screenshot PATH               Capture the screen: gamescopectl in Game Mode, Spectacle in
                                Desktop Mode.
  state                         Print focus, window, overlay process, and redacted env-key state.
  focus [--app-name NAME]       Send Escape, then focus the smoke app window.
  clear-shells                  Send Escape to the app display.
  key toggle|close|guide|steamui-escape
                                toggle sends Shift+Tab. close sends Shift+Tab then Escape. guide
                                presses the controller Guide button through a temporary uinput
                                device. steamui-escape sends Escape to SteamUI's Xwayland display.
  web-close --result-file PATH  Click the detected Steam web close control.
  wait-shortcut-open --result-file PATH
                                Wait for managed shortcut-open and active=true lifecycle evidence.
  verify-close --result-file PATH [--app-name NAME] [--action NAME]
               [--require-shortcut-open 0|1] [--require-presenter-parking 0|1]
               [--kwin-probe PATH]
                                Verify close, presenter parking, focus return, and crash evidence.
  cleanup [--app-dir DIR] [--inhibit-pid-file PATH]
                                Retire the exact smoke runtime, its sleep inhibitor, and overlay
                                helpers whose target is gone.
  keep-awake start [--seconds N] [--pid-file PATH]
  keep-awake stop [--pid-file PATH]
  write-wrapper --wrapper-path PATH --env-file PATH
                                Write the Steam shortcut wrapper and its env file from stdin.
  launch [--app-dir DIR] [--] HELPER_ARGS...
                                Run the packaged linux-electron-smoke.sh in the graphical
                                session environment.
  session game|desktop [--timeout SECONDS]
                                Switch modes with steamos-session-select (gamescope or
                                plasma-wayland), then wait for the mode, and for Steam in Game
                                Mode. Does not switch when the Deck is already in that mode.
  wake-display                  Turn the Desktop Mode panel back on through KScreen DPMS. KWin
                                cannot capture a panel that power management turned off.
  self-test                     Validate this helper with stub tools. Sends no real input.
EOF
}

require_value() {
  if [ "$2" -lt 2 ]; then
    echo "Missing value for $1." >&2
    exit 2
  fi
}

unknown_option() {
  echo "Unknown option for $1: $2" >&2
  exit 2
}

use_default_display() {
  export DISPLAY="${DISPLAY:-:0}"
}

game_mode_active() {
  systemctl --user is-active --quiet gamescope-session.service 2>/dev/null
}

use_game_app_display() {
  if game_mode_active &&
    DISPLAY=:1 xdotool getdisplaygeometry >/dev/null 2>&1; then
    export DISPLAY=:1
  fi
}

use_first_xauthority() {
  if [ -z "${XAUTHORITY:-}" ]; then
    XAUTHORITY="$(ls /run/user/1000/xauth_* 2>/dev/null | head -n 1 || true)"
    export XAUTHORITY
  fi
}

use_newest_xauthority() {
  if [ -z "${XAUTHORITY:-}" ]; then
    XAUTHORITY="$(ls -t /run/user/1000/xauth_* 2>/dev/null | head -n 1 || true)"
    export XAUTHORITY
  fi
}

use_session_bus() {
  export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/1000/bus}"
}

process_running() {
  pgrep -x "$1" >/dev/null 2>&1
}

session_mode() {
  if game_mode_active; then
    printf '%s\n' "game"
  elif process_running plasmashell; then
    printf '%s\n' "desktop"
  else
    printf '%s\n' "unknown"
  fi
}

session_mode_description() {
  case "$(session_mode)" in
    game)
      printf '%s\n' "game (Gamescope)"
      ;;
    desktop)
      if process_running kwin_wayland; then
        printf '%s\n' "desktop (Plasma Wayland)"
      elif process_running kwin_x11; then
        printf '%s\n' "desktop (Plasma X11)"
      else
        printf '%s\n' "desktop"
      fi
      ;;
    *)
      printf '%s\n' "unknown"
      ;;
  esac
}

run_bounded() {
  if command -v timeout >/dev/null 2>&1; then
    timeout 5 "$@"
  else
    "$@"
  fi
}

desktop_display_power() {
  command -v kscreen-doctor >/dev/null 2>&1 || return 1
  WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}" run_bounded kscreen-doctor --dpms show 2>/dev/null |
    tr -d '\033' | sed 's/\[[0-9;]*m//g' | awk '/dpms mode for screen/ { print $NF; exit }'
}

print_session_status() {
  local login_mode display_power
  echo "Session mode: $(session_mode_description)"
  if command -v steamosctl >/dev/null 2>&1; then
    login_mode="$(run_bounded steamosctl get-default-login-mode 2>/dev/null | head -n 1)"
    echo "Default login mode: ${login_mode:-unknown}"
  fi
  if process_running steam; then
    echo "Steam client: running"
  else
    echo "Steam client: not running"
  fi
  if [ "$(session_mode)" = "desktop" ]; then
    display_power="$(desktop_display_power || true)"
    echo "Display power: ${display_power:-unknown}"
  fi
}

cmd_status() {
  local app_dir="$default_app_dir"
  local tool os_release
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --app-dir)
        require_value "$1" "$#"
        app_dir="$2"
        shift 2
        ;;
      *)
        unknown_option status "$1"
        ;;
    esac
  done

  echo "Remote host: $(uname -n 2>/dev/null || printf unknown)"
  echo "Remote kernel: $(uname -srmo 2>/dev/null || uname -a)"
  if [ -x "$app_dir/SteamBridgeSmoke" ] && [ -x "$app_dir/linux-electron-smoke.sh" ] && [ -x "$app_dir/chrome_crashpad_handler" ] && [ -x "$app_dir/chrome-sandbox" ]; then
    echo "Remote package: present"
  else
    echo "Remote package: incomplete or non-executable at $app_dir"
  fi
  if command -v steam >/dev/null 2>&1; then
    echo "Steam command: $(command -v steam)"
  elif [ -x "$HOME/.steam/root/ubuntu12_32/steam" ]; then
    echo "Steam command: $HOME/.steam/root/ubuntu12_32/steam"
  else
    echo "Steam command: missing"
  fi
  if command -v systemd-inhibit >/dev/null 2>&1; then
    echo "Sleep inhibitor: available"
  else
    echo "Sleep inhibitor: missing"
  fi
  if ls "$HOME/.local/share/Steam/userdata"/*/config/shortcuts.vdf >/dev/null 2>&1; then
    echo "Shortcut files: present"
  else
    echo "Shortcut files: missing"
  fi

  os_release="unknown"
  if [ -r /etc/os-release ]; then
    os_release="$(. /etc/os-release && printf '%s %s (build %s)' "${NAME:-unknown}" "${VERSION_ID:-unknown}" "${BUILD_ID:-unknown}")"
  fi
  echo "OS release: $os_release"
  use_session_bus
  print_session_status
  for tool in xdotool gamescopectl spectacle python3 systemd-inhibit steamos-session-select; do
    echo "Tool $tool: $(command -v "$tool" 2>/dev/null || printf missing)"
  done
  if [ ! -e /dev/uinput ]; then
    echo "uinput: missing"
  elif [ -w /dev/uinput ]; then
    echo "uinput: writable"
  else
    echo "uinput: not writable"
  fi
}

cmd_screenshot() {
  local output="${1:-}"
  if [ -z "$output" ] || [ "$#" -ne 1 ]; then
    echo "screenshot requires exactly one output path." >&2
    exit 2
  fi

  use_default_display
  use_first_xauthority
  use_session_bus
  rm -f "$output"
  if game_mode_active && command -v gamescopectl >/dev/null 2>&1; then
    gamescopectl screenshot "$output"
    for attempt in $(seq 1 50); do
      [ -s "$output" ] && break
      sleep 0.1
    done
    [ -s "$output" ] || { echo 'Gamescope screenshot was not written.' >&2; exit 1; }
  elif command -v spectacle >/dev/null 2>&1; then
    for attempt in 1 2 3; do
      rm -f "$output"
      if timeout 15 spectacle -b -n -o "$output" >/dev/null 2>&1 && [ -s "$output" ]; then
        break
      fi
      sleep 0.5
    done
    [ -s "$output" ] || { echo 'Spectacle screenshot was not written after three attempts.' >&2; exit 1; }
  elif command -v gnome-screenshot >/dev/null 2>&1; then
    gnome-screenshot -f "$output"
  else
    echo 'No screenshot tool found on Deck.' >&2
    exit 127
  fi
}

cmd_state() {
  if [ "$#" -gt 0 ]; then
    unknown_option state "$1"
  fi

  use_default_display
  use_game_app_display
  use_first_xauthority
  use_session_bus
  capture_pid="$$"

  echo '== timestamp =='
  date -Is 2>/dev/null || date
  echo

  echo '== focused-window =='
  if command -v xdotool >/dev/null 2>&1; then
    focus_id="$(xdotool getwindowfocus 2>/dev/null || true)"
    echo "focus_id=$focus_id"
    if [ -n "$focus_id" ]; then
      echo -n 'focus_name='
      xdotool getwindowname "$focus_id" 2>/dev/null || true
      echo -n 'focus_pid='
      xdotool getwindowpid "$focus_id" 2>/dev/null || true
      if command -v xprop >/dev/null 2>&1; then
        xprop -id "$focus_id" WM_CLASS WM_NAME _NET_WM_PID _NET_WM_STATE 2>/dev/null || true
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
  for pid in $(pgrep -f '[S]teamBridgeSmoke|[g]ameoverlayui|[s]teamwebhelper' 2>/dev/null | awk -v self="$capture_pid" '$1 != self' || true); do
    comm="$(cat "/proc/$pid/comm" 2>/dev/null || printf unknown)"
    ppid="$(awk '/^PPid:/ { print $2 }' "/proc/$pid/status" 2>/dev/null || true)"
    printf 'pid=%s ppid=%s comm=%s\n' "$pid" "${ppid:-unknown}" "$comm"
  done
  echo

  echo '== overlay-env =='
  for pid in $(pgrep -f '[S]teamBridgeSmoke|[g]ameoverlayui' 2>/dev/null | awk -v self="$capture_pid" '$1 != self' || true); do
    if [ -r "/proc/$pid/environ" ]; then
      echo "-- pid $pid --"
      tr '\000' '\n' < "/proc/$pid/environ" 2>/dev/null |
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
}

cmd_focus() {
  local app_name="Steam Bridge Smoke"
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --app-name)
        require_value "$1" "$#"
        app_name="$2"
        shift 2
        ;;
      *)
        unknown_option focus "$1"
        ;;
    esac
  done

  use_default_display
  use_game_app_display
  use_first_xauthority
  if command -v xdotool >/dev/null 2>&1; then
    xdotool key Escape >/dev/null 2>&1 || true
    sleep 0.2
    window_id=""
    for pattern in "Steam Bridge Electron Smoke" "$app_name" "SteamBridgeSmoke"; do
      window_id="$(xdotool search --name "$pattern" 2>/dev/null | tail -n 1 || true)"
      if [ -n "$window_id" ]; then
        break
      fi
    done
    if [ -n "$window_id" ]; then
      xdotool windowactivate --sync "$window_id" >/dev/null 2>&1 || xdotool windowfocus "$window_id" >/dev/null 2>&1 || true
      sleep 0.35
    fi
  fi
}

cmd_clear_shells() {
  if [ "$#" -gt 0 ]; then
    unknown_option clear-shells "$1"
  fi

  use_default_display
  use_game_app_display
  use_first_xauthority
  use_session_bus
  if command -v xdotool >/dev/null 2>&1; then
    xdotool key Escape >/dev/null 2>&1 || true
  fi
}

send_close_keys() {
  if [ -w /dev/uinput ] && command -v python3 >/dev/null 2>&1; then
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
  fi
}

send_toggle_keys() {
  if [ -w /dev/uinput ] && command -v python3 >/dev/null 2>&1; then
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
  fi
}

send_guide_button() {
  if [ -w /dev/uinput ] && command -v python3 >/dev/null 2>&1; then
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
  fi
}

send_steamui_escape() {
  if ! command -v xdotool >/dev/null 2>&1; then
    echo 'SteamUI Escape probe requires xdotool.' >&2
    exit 127
  fi
  use_newest_xauthority
  escape_display="${DISPLAY:-:0}"
  if game_mode_active &&
    DISPLAY=:0 xdotool getdisplaygeometry >/dev/null 2>&1; then
    escape_display=:0
  fi
  if ! DISPLAY="$escape_display" xdotool getdisplaygeometry >/dev/null 2>&1; then
    echo "SteamUI Escape probe could not authenticate to X11 display $escape_display." >&2
    exit 1
  fi
  DISPLAY="$escape_display" xdotool key Escape
}

cmd_key() {
  if [ "$#" -ne 1 ]; then
    echo "key requires one input: toggle, close, guide, or steamui-escape." >&2
    exit 2
  fi
  case "$1" in
    toggle)
      send_toggle_keys
      ;;
    close)
      send_close_keys
      ;;
    guide)
      send_guide_button
      ;;
    steamui-escape)
      send_steamui_escape
      ;;
    *)
      echo "Unknown key input: $1" >&2
      exit 2
      ;;
  esac
}

wait_for_web_overlay_closed() {
  CLOSE_WAIT_SECONDS="${1:-2.5}" python3 - <<'PY'
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
                if '"active":true' in line or '"m_bActive":true' in line or '"active":1' in line:
                    saw_active = True
                elif saw_active and (
                    '"active":false' in line or '"m_bActive":false' in line or '"active":0' in line
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

cmd_web_close() {
  local result_file=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --result-file)
        require_value "$1" "$#"
        result_file="$2"
        shift 2
        ;;
      *)
        unknown_option web-close "$1"
        ;;
    esac
  done

  use_default_display
  RESULT_FILE="$result_file"
  use_first_xauthority
  if ! command -v xdotool >/dev/null 2>&1; then
    echo 'No xdotool web overlay close helper found on Deck.' >&2
    exit 127
  fi
  clear_kwin_overview_if_active
  set -- $(xdotool getdisplaygeometry)
  display_width="${1:-1280}"
  display_height="${2:-800}"
  host_window="$(xdotool search --name 'Steam Bridge Native Overlay' 2>/dev/null | tail -n 1 || true)"
  if [ -z "$host_window" ]; then
    echo 'Steam web close probe could not find the native overlay host.' >&2
    exit 1
  fi
  eval "$(xdotool getwindowgeometry --shell "$host_window" 2>/dev/null || true)"
  host_x="${X:-0}"
  host_y="${Y:-0}"
  host_width="${WIDTH:-$display_width}"
  host_height="${HEIGHT:-$display_height}"
  close_image=/tmp/steam-bridge-smoke-web-close.png
  close_gray=/tmp/steam-bridge-smoke-web-close.gray
  rm -f "$close_image" "$close_gray"
  if ! command -v spectacle >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
    echo 'Steam web close probe requires spectacle and ffmpeg.' >&2
    exit 127
  fi
  spectacle -b -n -o "$close_image" >/dev/null 2>&1
  ffmpeg -v error -y -i "$close_image" -f rawvideo -pix_fmt gray "$close_gray"
  close_point="$(python3 - "$close_gray" "$display_width" "$display_height" "$host_x" "$host_y" "$host_width" "$host_height" <<'PY'
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
)"
  rm -f "$close_image" "$close_gray"
  set -- $close_point
  click_x="$1"
  click_y="$2"
  close_score="$3"
  echo "Detected Steam web close control (score=$close_score)."
  xdotool mousemove "$click_x" "$click_y" click 1
  wait_for_web_overlay_closed 3.0 || true
}

cmd_wait_shortcut_open() {
  local result_file=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --result-file)
        require_value "$1" "$#"
        result_file="$2"
        shift 2
        ;;
      *)
        unknown_option wait-shortcut-open "$1"
        ;;
    esac
  done

  RESULT_FILE="$result_file" python3 - <<'PY'
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
PY
}

cmd_verify_close() {
  local result_file="" app_name="" action="" require_shortcut_open="0" require_presenter_parking="1" kwin_probe=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --result-file)
        require_value "$1" "$#"
        result_file="$2"
        shift 2
        ;;
      --app-name)
        require_value "$1" "$#"
        app_name="$2"
        shift 2
        ;;
      --action)
        require_value "$1" "$#"
        action="$2"
        shift 2
        ;;
      --require-shortcut-open)
        require_value "$1" "$#"
        require_shortcut_open="$2"
        shift 2
        ;;
      --require-presenter-parking)
        require_value "$1" "$#"
        require_presenter_parking="$2"
        shift 2
        ;;
      --kwin-probe)
        require_value "$1" "$#"
        kwin_probe="$2"
        shift 2
        ;;
      *)
        unknown_option verify-close "$1"
        ;;
    esac
  done

  RESULT_FILE="$result_file" APP_NAME="$app_name" ACTION="$action" REQUIRE_SHORTCUT_OPEN="$require_shortcut_open" REQUIRE_PRESENTER_PARKING="$require_presenter_parking" KWIN_ACTIVE_WINDOW_PROBE="$kwin_probe" python3 - <<'PY'
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
PY
}

target_process_live() {
  [ -r "/proc/$1/stat" ] || return 1
  target_stat="$(cat "/proc/$1/stat" 2>/dev/null || true)"
  target_state="${target_stat##*) }"
  target_state="${target_state%% *}"
  case "$target_state" in
    Z|X|'') return 1 ;;
    *) return 0 ;;
  esac
}

cmd_cleanup() {
  local app_dir="$default_app_dir" inhibit_pid_file="$default_inhibit_pid_file"
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --app-dir)
        require_value "$1" "$#"
        app_dir="$2"
        shift 2
        ;;
      --inhibit-pid-file)
        require_value "$1" "$#"
        inhibit_pid_file="$2"
        shift 2
        ;;
      *)
        unknown_option cleanup "$1"
        ;;
    esac
  done

  for attempt in $(seq 1 20); do
    for process_dir in /proc/[0-9]*; do
      executable="$(readlink "$process_dir/exe" 2>/dev/null || true)"
      executable="${executable% (deleted)}"
      [ "$executable" = "$app_dir/SteamBridgeSmoke" ] || continue
      kill "${process_dir##*/}" >/dev/null 2>&1 || true
    done
    if [ -f "$inhibit_pid_file" ]; then
      inhibit_pid="$(cat "$inhibit_pid_file" 2>/dev/null || true)"
      case "$inhibit_pid" in
        *[!0-9]*|'') ;;
        *) kill "$inhibit_pid" >/dev/null 2>&1 || true ;;
      esac
      rm -f "$inhibit_pid_file"
    fi
    for overlay_pid in $(pgrep -x gameoverlayui 2>/dev/null || true); do
      target_pid="$(tr '\000' '\n' < "/proc/$overlay_pid/cmdline" 2>/dev/null | awk 'previous == "-pid" { print; exit } { previous = $0 }')"
      case "$target_pid" in
        *[!0-9]*|'') ;;
        *) target_process_live "$target_pid" || kill "$overlay_pid" >/dev/null 2>&1 || true ;;
      esac
    done
    smoke_count=0
    for process_dir in /proc/[0-9]*; do
      executable="$(readlink "$process_dir/exe" 2>/dev/null || true)"
      executable="${executable% (deleted)}"
      [ "$executable" = "$app_dir/SteamBridgeSmoke" ] && smoke_count=$((smoke_count + 1))
    done
    orphan_overlay_count=0
    for overlay_pid in $(pgrep -x gameoverlayui 2>/dev/null || true); do
      target_pid="$(tr '\000' '\n' < "/proc/$overlay_pid/cmdline" 2>/dev/null | awk 'previous == "-pid" { print; exit } { previous = $0 }')"
      case "$target_pid" in
        *[!0-9]*|'') ;;
        *) target_process_live "$target_pid" || { target_process_live "$overlay_pid" && orphan_overlay_count=$((orphan_overlay_count + 1)); } ;;
      esac
    done
    if [ "$smoke_count" -eq 0 ] && [ "$orphan_overlay_count" -eq 0 ]; then
      echo 'Previous Deck smoke runtime cleaned.'
      exit 0
    fi
    sleep 0.5
  done
  echo 'Timed out cleaning previous Deck smoke runtime.' >&2
  exit 1
}

cmd_keep_awake() {
  local action="${1:-}"
  local seconds="900" pid_file="$default_inhibit_pid_file"
  if [ "$#" -gt 0 ]; then
    shift
  fi
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --seconds)
        require_value "$1" "$#"
        seconds="$2"
        shift 2
        ;;
      --pid-file)
        require_value "$1" "$#"
        pid_file="$2"
        shift 2
        ;;
      *)
        unknown_option keep-awake "$1"
        ;;
    esac
  done

  case "$action" in
    start)
      if command -v systemd-inhibit >/dev/null 2>&1; then nohup systemd-inhibit --what=sleep --why='Steam Bridge smoke' sleep "$seconds" >/tmp/steam-bridge-smoke-inhibit.log 2>&1 & echo $! > "$pid_file"; else echo 'systemd-inhibit not found; skipping sleep inhibitor' >&2; fi
      ;;
    stop)
      if [ -f "$pid_file" ]; then kill $(cat "$pid_file") >/dev/null 2>&1 || true; rm -f "$pid_file"; fi
      ;;
    *)
      echo "keep-awake requires start or stop." >&2
      exit 2
      ;;
  esac
}

write_wrapper_script() {
  cat <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
CONFIG_FILE="${STEAM_BRIDGE_SMOKE_WRAPPER_ENV_FILE:-$SCRIPT_DIR/${SCRIPT_NAME%.sh}.env}"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

APP_DIR="${APP_DIR:-/home/deck/steam-bridge-smoke/SteamBridgeSmoke-linux-x64}"
APP_ID="${APP_ID:-480}"
OVERLAY_GAME_ID="${OVERLAY_GAME_ID:-$APP_ID}"
AUTORUN_ACTION="${AUTORUN_ACTION:-none}"
OVERLAY_PROFILE="${OVERLAY_PROFILE:-diagnostic}"
OVERLAY_SCRUB_CHILD_ENV="${OVERLAY_SCRUB_CHILD_ENV:-}"
OVERLAY_ISOLATE_CHILD_PROCESSES="${OVERLAY_ISOLATE_CHILD_PROCESSES:-}"
WINDOW_MODE="${WINDOW_MODE:-}"
RESULT_FILE="${RESULT_FILE:-/tmp/steam-bridge-smoke-default.log}"
DIAGNOSTIC_DIR="${DIAGNOSTIC_DIR:-$RESULT_FILE.diagnostics}"
ACTION_DELAY_MS="${ACTION_DELAY_MS:-1500}"
RESULT_DELAY_MS="${RESULT_DELAY_MS:-8000}"
CONTROL_SERVER="${CONTROL_SERVER:-0}"
CONTROL_FILE="${CONTROL_FILE:-}"
CONTROL_TOKEN="${CONTROL_TOKEN:-}"
KEEP_OPEN_AFTER_RESULT="${KEEP_OPEN_AFTER_RESULT:-0}"
REQUIRE_OVERLAY_ACTIVE="${REQUIRE_OVERLAY_ACTIVE:-0}"
WEB_URL="${WEB_URL:-}"
WEB_MODAL="${WEB_MODAL:-}"
CHECKOUT_URL="${CHECKOUT_URL:-}"
CHECKOUT_TRANSACTION_ID="${CHECKOUT_TRANSACTION_ID:-}"
CHECKOUT_RETURN_URL="${CHECKOUT_RETURN_URL:-}"
OVERLAY_DIALOG="${OVERLAY_DIALOG:-}"
USER_DIALOG="${USER_DIALOG:-}"
SHORTCUT_TARGET="${SHORTCUT_TARGET:-}"
PRESENTER_MODE="${PRESENTER_MODE:-}"
ACHIEVEMENT_NAME="${ACHIEVEMENT_NAME:-}"
ACHIEVEMENT_CURRENT="${ACHIEVEMENT_CURRENT:-}"
ACHIEVEMENT_MAX="${ACHIEVEMENT_MAX:-}"

rm -f "$RESULT_FILE"
rm -rf "$DIAGNOSTIC_DIR"
export SteamAppId="$APP_ID"
export SteamGameId="$APP_ID"
if [ "$OVERLAY_GAME_ID" != "inherit" ]; then
  export SteamOverlayGameId="$OVERLAY_GAME_ID"
fi
export STEAM_BRIDGE_APP_ID="$APP_ID"
export STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE="$OVERLAY_PROFILE"
if [ -n "$OVERLAY_SCRUB_CHILD_ENV" ]; then
  export STEAM_BRIDGE_ELECTRON_OVERLAY_SCRUB_CHILD_ENV="$OVERLAY_SCRUB_CHILD_ENV"
fi
if [ -n "$OVERLAY_ISOLATE_CHILD_PROCESSES" ]; then
  export STEAM_BRIDGE_ELECTRON_OVERLAY_ISOLATE_CHILD_PROCESSES="$OVERLAY_ISOLATE_CHILD_PROCESSES"
fi
if [ -n "$WINDOW_MODE" ]; then
  export STEAM_BRIDGE_SMOKE_WINDOW_MODE="$WINDOW_MODE"
fi
export STEAM_BRIDGE_SMOKE_AUTORUN=1
export STEAM_BRIDGE_SMOKE_AUTORUN_ACTION="$AUTORUN_ACTION"
export STEAM_BRIDGE_SMOKE_AUTORUN_ACTION_DELAY_MS="$ACTION_DELAY_MS"
export STEAM_BRIDGE_SMOKE_AUTORUN_RESULT_DELAY_MS="$RESULT_DELAY_MS"
export STEAM_BRIDGE_SMOKE_KEEP_OPEN_AFTER_RESULT="$KEEP_OPEN_AFTER_RESULT"
export STEAM_BRIDGE_SMOKE_CONTROL_SERVER="$CONTROL_SERVER"
if [ -n "$CONTROL_FILE" ]; then
  export STEAM_BRIDGE_SMOKE_CONTROL_FILE="$CONTROL_FILE"
fi
if [ -n "$CONTROL_TOKEN" ]; then
  export STEAM_BRIDGE_SMOKE_CONTROL_TOKEN="$CONTROL_TOKEN"
fi
export STEAM_BRIDGE_SMOKE_RESULT_FILE="$RESULT_FILE"
export STEAM_BRIDGE_SMOKE_DIAGNOSTIC_DIR="$DIAGNOSTIC_DIR"
export STEAM_BRIDGE_SMOKE_REQUIRE_OVERLAY_ACTIVE="$REQUIRE_OVERLAY_ACTIVE"
if [ -n "$WEB_URL" ]; then
  export STEAM_BRIDGE_SMOKE_WEB_URL="$WEB_URL"
fi
if [ -n "$WEB_MODAL" ]; then
  export STEAM_BRIDGE_SMOKE_WEB_MODAL="$WEB_MODAL"
fi
if [ -n "$CHECKOUT_URL" ]; then
  export STEAM_BRIDGE_SMOKE_CHECKOUT_URL="$CHECKOUT_URL"
fi
if [ -n "$CHECKOUT_TRANSACTION_ID" ]; then
  export STEAM_BRIDGE_SMOKE_CHECKOUT_TRANSACTION_ID="$CHECKOUT_TRANSACTION_ID"
fi
if [ -n "$CHECKOUT_RETURN_URL" ]; then
  export STEAM_BRIDGE_SMOKE_CHECKOUT_RETURN_URL="$CHECKOUT_RETURN_URL"
fi
if [ -n "$OVERLAY_DIALOG" ]; then
  export STEAM_BRIDGE_SMOKE_OVERLAY_DIALOG="$OVERLAY_DIALOG"
fi
if [ -n "$USER_DIALOG" ]; then
  export STEAM_BRIDGE_SMOKE_USER_DIALOG="$USER_DIALOG"
fi
if [ -n "$SHORTCUT_TARGET" ]; then
  export STEAM_BRIDGE_SMOKE_SHORTCUT_TARGET="$SHORTCUT_TARGET"
fi
if [ -n "$PRESENTER_MODE" ]; then
  export STEAM_BRIDGE_SMOKE_PRESENTER_MODE="$PRESENTER_MODE"
  export STEAM_BRIDGE_ELECTRON_OVERLAY_PRESENTER="$PRESENTER_MODE"
fi
if [ -n "$ACHIEVEMENT_NAME" ]; then
  export STEAM_BRIDGE_SMOKE_ACHIEVEMENT_NAME="$ACHIEVEMENT_NAME"
fi
if [ -n "$ACHIEVEMENT_CURRENT" ]; then
  export STEAM_BRIDGE_SMOKE_ACHIEVEMENT_CURRENT="$ACHIEVEMENT_CURRENT"
fi
if [ -n "$ACHIEVEMENT_MAX" ]; then
  export STEAM_BRIDGE_SMOKE_ACHIEVEMENT_MAX="$ACHIEVEMENT_MAX"
fi

cd "$APP_DIR"
if command -v systemd-inhibit >/dev/null 2>&1; then
  exec systemd-inhibit --what=sleep --why="Steam Bridge smoke" ./SteamBridgeSmoke --no-sandbox
fi
exec ./SteamBridgeSmoke --no-sandbox
EOF
}

cmd_write_wrapper() {
  local wrapper_path="" env_file=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --wrapper-path)
        require_value "$1" "$#"
        wrapper_path="$2"
        shift 2
        ;;
      --env-file)
        require_value "$1" "$#"
        env_file="$2"
        shift 2
        ;;
      *)
        unknown_option write-wrapper "$1"
        ;;
    esac
  done
  if [ -z "$wrapper_path" ] || [ -z "$env_file" ]; then
    echo "write-wrapper requires --wrapper-path and --env-file." >&2
    exit 2
  fi

  mkdir -p "$(dirname -- "$wrapper_path")" || exit
  cat > "$env_file" || exit
  write_wrapper_script > "$wrapper_path" || exit
  chmod +x "$wrapper_path"
}

cmd_launch() {
  local app_dir="$default_app_dir"
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --app-dir)
        require_value "$1" "$#"
        app_dir="$2"
        shift 2
        ;;
      --)
        shift
        break
        ;;
      *)
        break
        ;;
    esac
  done

  use_default_display
  use_first_xauthority
  use_session_bus
  cd "$app_dir" && ./linux-electron-smoke.sh "$@"
}

session_matches() {
  case "$1" in
    game)
      game_mode_active
      ;;
    desktop)
      ! game_mode_active && process_running plasmashell && process_running kwin_wayland
      ;;
    *)
      return 1
      ;;
  esac
}

session_ready() {
  session_matches "$1" || return 1
  if [ "$1" = "game" ]; then
    process_running steam && process_running steamwebhelper
  fi
}

cmd_session() {
  local target="${1:-}"
  local timeout_seconds="180" select_session waited
  if [ "$#" -gt 0 ]; then
    shift
  fi
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --timeout)
        require_value "$1" "$#"
        timeout_seconds="$2"
        shift 2
        ;;
      *)
        unknown_option session "$1"
        ;;
    esac
  done
  case "$target" in
    game)
      select_session="gamescope"
      ;;
    desktop)
      select_session="plasma-wayland"
      ;;
    *)
      echo "session requires game or desktop." >&2
      exit 2
      ;;
  esac
  case "$timeout_seconds" in
    ''|*[!0-9]*)
      echo "session --timeout must be a whole number of seconds." >&2
      exit 2
      ;;
  esac

  use_session_bus
  if session_matches "$target"; then
    echo "Deck session already in $target mode; not switching."
  else
    if ! command -v steamos-session-select >/dev/null 2>&1; then
      echo "steamos-session-select not found on Deck." >&2
      exit 127
    fi
    echo "Switching Deck session to $target mode: steamos-session-select $select_session"
    steamos-session-select "$select_session" || exit
  fi

  waited=0
  while true; do
    if session_ready "$target"; then
      echo "Deck session ready in $target mode after about ${waited}s."
      print_session_status
      return 0
    fi
    if [ "$waited" -ge "$timeout_seconds" ]; then
      break
    fi
    sleep 2
    waited=$((waited + 2))
  done
  echo "Timed out after ${timeout_seconds}s waiting for Deck $target mode." >&2
  print_session_status >&2
  exit 1
}

cmd_wake_display() {
  local power=""
  if [ "$#" -gt 0 ]; then
    unknown_option wake-display "$1"
  fi

  use_session_bus
  if [ "$(session_mode)" != "desktop" ]; then
    echo "wake-display supports Desktop Mode only; KScreen does not manage the Game Mode display." >&2
    exit 2
  fi
  if ! command -v kscreen-doctor >/dev/null 2>&1; then
    echo "kscreen-doctor not found on Deck." >&2
    exit 127
  fi
  WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}" run_bounded kscreen-doctor --dpms on >/dev/null 2>&1
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    power="$(desktop_display_power || true)"
    if [ "$power" = "on" ]; then
      echo "Display power: on"
      return 0
    fi
    sleep 0.2
  done
  echo "Display power did not turn on (last state: ${power:-unknown})." >&2
  exit 1
}

self_test_fail() {
  echo "Self-test failed: $*" >&2
  exit 1
}

write_self_test_stub() {
  printf '#!/bin/sh\n%s\n' "$2" > "$self_test_stubs/$1"
  chmod +x "$self_test_stubs/$1"
}

run_helper_under_test() {
  DISPLAY= XAUTHORITY= DBUS_SESSION_BUS_ADDRESS= PATH="$self_test_stubs:$PATH" SELF_TEST_ROOT="$self_test_root" HOME="$self_test_root/home" bash "$self_test_script" "$@"
}

run_self_test() {
  local python_bin block_count output inhibit_pid
  self_test_script="$0"
  self_test_root="$(mktemp -d "${TMPDIR:-/tmp}/steam-deck-remote-self-test.XXXXXX")"
  self_test_stubs="$self_test_root/bin"
  trap 'rm -rf "$self_test_root"' EXIT
  mkdir -p "$self_test_stubs" "$self_test_root/home" "$self_test_root/app"

  write_self_test_stub systemctl 'quiet=0
for arg in "$@"; do [ "$arg" = "--quiet" ] && quiet=1; done
case "$*" in
  *gamescope-session.service*)
    if [ "$(cat "$SELF_TEST_ROOT/session" 2>/dev/null)" = game ]; then [ "$quiet" = 1 ] || echo active; exit 0; fi
    [ "$quiet" = 1 ] || echo inactive
    exit 3
    ;;
esac
exit 3'
  write_self_test_stub xdotool 'echo "DISPLAY=${DISPLAY:-} xdotool $*" >> "$SELF_TEST_ROOT/xdotool.log"
case "$1" in
  getdisplaygeometry) grep -qx "${DISPLAY:-}" "$SELF_TEST_ROOT/displays" 2>/dev/null && echo "1280 800" && exit 0; exit 1 ;;
  search) grep -qx "$3" "$SELF_TEST_ROOT/windows" 2>/dev/null && echo 4242 && exit 0; exit 1 ;;
  getwindowfocus) echo 4242 ;;
  getwindowname) echo "Steam Bridge Electron Smoke" ;;
  getwindowpid) echo 1234 ;;
esac
exit 0'
  write_self_test_stub gamescopectl 'echo "gamescopectl $*" >> "$SELF_TEST_ROOT/capture.log"
[ "$1" = screenshot ] && printf png > "$2"
exit 0'
  write_self_test_stub spectacle 'echo "spectacle $*" >> "$SELF_TEST_ROOT/capture.log"
failures="$(cat "$SELF_TEST_ROOT/spectacle-failures" 2>/dev/null || echo 0)"
if [ "$failures" -gt 0 ]; then echo $((failures - 1)) > "$SELF_TEST_ROOT/spectacle-failures"; exit 1; fi
printf png > "$4"
exit 0'
  write_self_test_stub timeout 'shift
exec "$@"'
  write_self_test_stub pgrep 'if [ "$1" = "-x" ]; then grep -qx "$2" "$SELF_TEST_ROOT/procs" 2>/dev/null && echo 100 && exit 0; fi
exit 1'
  write_self_test_stub uname 'case "$1" in -n) echo deck-self-test ;; *) echo "Linux 6.0.0 x86_64 GNU/Linux" ;; esac'
  write_self_test_stub steamosctl '[ "$1" = get-default-login-mode ] && echo game
exit 0'
  write_self_test_stub steamos-session-select 'echo "steamos-session-select $*" >> "$SELF_TEST_ROOT/session.log"
[ -f "$SELF_TEST_ROOT/session-stuck" ] && exit 0
case "$1" in gamescope) echo game > "$SELF_TEST_ROOT/session" ;; plasma-wayland) echo desktop > "$SELF_TEST_ROOT/session" ;; esac
exit 0'
  write_self_test_stub kscreen-doctor 'case "$*" in
  "--dpms show") echo "dpms mode for screen eDP-1: $(cat "$SELF_TEST_ROOT/dpms" 2>/dev/null || echo off)" ;;
  "--dpms on") echo on > "$SELF_TEST_ROOT/dpms" ;;
esac
exit 0'
  for tool in xprop wmctrl xwininfo gnome-screenshot; do
    write_self_test_stub "$tool" 'exit 1'
  done

  printf '%s\n' plasmashell kwin_wayland steam steamwebhelper > "$self_test_root/procs"

  echo desktop > "$self_test_root/session"
  output="$(run_helper_under_test status --app-dir "$self_test_root/app")" || self_test_fail "status exited non-zero."
  for expected in "Remote host: deck-self-test" "Remote package: incomplete or non-executable at $self_test_root/app" "Shortcut files: missing" "Session mode: desktop (Plasma Wayland)" "Default login mode: game" "Steam client: running" "Display power: off" "Tool xdotool: $self_test_stubs/xdotool" "Tool gamescopectl: $self_test_stubs/gamescopectl" "Tool steamos-session-select: $self_test_stubs/steamos-session-select"; do
    printf '%s\n' "$output" | grep -Fxq "$expected" || self_test_fail "status is missing \"$expected\"."
  done
  for prefix in "Remote kernel: " "Steam command: " "Sleep inhibitor: " "OS release: " "Tool spectacle: " "Tool python3: " "Tool systemd-inhibit: " "uinput: "; do
    printf '%s\n' "$output" | grep -q "^$prefix" || self_test_fail "status is missing a \"$prefix\" line."
  done
  echo game > "$self_test_root/session"
  output="$(run_helper_under_test status)" || self_test_fail "Game Mode status exited non-zero."
  printf '%s\n' "$output" | grep -Fxq "Session mode: game (Gamescope)" || self_test_fail "status must report Game Mode from gamescope-session.service."
  if printf '%s\n' "$output" | grep -q '^Display power: '; then
    self_test_fail "status must not query KScreen display power in Game Mode."
  fi
  if run_helper_under_test wake-display >/dev/null 2>&1; then
    self_test_fail "wake-display must refuse Game Mode."
  fi
  echo desktop > "$self_test_root/session"
  output="$(run_helper_under_test wake-display)" || self_test_fail "wake-display failed in Desktop Mode."
  [ "$output" = "Display power: on" ] && [ "$(cat "$self_test_root/dpms")" = on ] || self_test_fail "wake-display must turn the Desktop panel on through KScreen DPMS."
  echo game > "$self_test_root/session"

  printf '%s\n' ":0" ":1" > "$self_test_root/displays"
  run_helper_under_test screenshot "$self_test_root/game.png" || self_test_fail "Game Mode screenshot failed."
  [ -s "$self_test_root/game.png" ] && grep -Fq "gamescopectl screenshot $self_test_root/game.png" "$self_test_root/capture.log" || self_test_fail "Game Mode screenshots must use gamescopectl."
  echo desktop > "$self_test_root/session"
  echo 2 > "$self_test_root/spectacle-failures"
  : > "$self_test_root/capture.log"
  run_helper_under_test screenshot "$self_test_root/desktop.png" || self_test_fail "Desktop screenshot did not retry transient Spectacle failures."
  [ "$(grep -c '^spectacle ' "$self_test_root/capture.log")" = 3 ] && [ -s "$self_test_root/desktop.png" ] || self_test_fail "Desktop screenshots must use Spectacle with three attempts."
  echo 3 > "$self_test_root/spectacle-failures"
  if output="$(run_helper_under_test screenshot "$self_test_root/failed.png" 2>&1)"; then
    self_test_fail "Desktop screenshot must fail after three Spectacle failures."
  fi
  printf '%s\n' "$output" | grep -Fq 'Spectacle screenshot was not written after three attempts.' || self_test_fail "Spectacle failure must be reported."
  if run_helper_under_test screenshot >/dev/null 2>&1; then
    self_test_fail "screenshot must require an output path."
  fi

  echo game > "$self_test_root/session"
  : > "$self_test_root/xdotool.log"
  output="$(run_helper_under_test state)" || self_test_fail "state exited non-zero."
  [ "$(printf '%s\n' "$output" | grep '^== ' | tr '\n' ' ')" = "== timestamp == == focused-window == == active-window == == overlay-processes == == overlay-env == == wmctrl == == xwininfo-filtered == " ] || self_test_fail "state must keep its section order."
  grep -Fq "DISPLAY=:1 xdotool getwindowfocus" "$self_test_root/xdotool.log" || self_test_fail "Game Mode state must read the app's :1 display."
  echo desktop > "$self_test_root/session"
  : > "$self_test_root/xdotool.log"
  run_helper_under_test state >/dev/null || self_test_fail "Desktop state exited non-zero."
  grep -Fq "DISPLAY=:0 xdotool getwindowfocus" "$self_test_root/xdotool.log" || self_test_fail "Desktop state must read display :0."

  echo game > "$self_test_root/session"
  echo "Steam Bridge Electron Smoke" > "$self_test_root/windows"
  : > "$self_test_root/xdotool.log"
  run_helper_under_test focus --app-name "Steam Bridge Smoke" || self_test_fail "focus exited non-zero."
  grep -Fq "DISPLAY=:1 xdotool key Escape" "$self_test_root/xdotool.log" && grep -Fq "DISPLAY=:1 xdotool windowactivate --sync 4242" "$self_test_root/xdotool.log" || self_test_fail "Game Mode focus must dismiss shells and activate the app on :1."
  : > "$self_test_root/xdotool.log"
  run_helper_under_test clear-shells || self_test_fail "clear-shells exited non-zero."
  grep -Fq "DISPLAY=:1 xdotool key Escape" "$self_test_root/xdotool.log" || self_test_fail "Game Mode clear-shells must send Escape to :1."

  : > "$self_test_root/xdotool.log"
  run_helper_under_test key steamui-escape || self_test_fail "SteamUI Escape exited non-zero."
  grep -Fq "DISPLAY=:0 xdotool key Escape" "$self_test_root/xdotool.log" || self_test_fail "Game Mode Escape must target SteamUI on :0."
  : > "$self_test_root/displays"
  if output="$(run_helper_under_test key steamui-escape 2>&1)"; then
    self_test_fail "SteamUI Escape must fail when the display does not authenticate."
  fi
  printf '%s\n' "$output" | grep -Fq 'SteamUI Escape probe could not authenticate to X11 display :0.' || self_test_fail "SteamUI Escape must report the display it could not use."
  if run_helper_under_test key shift >/dev/null 2>&1; then
    self_test_fail "key must reject unknown inputs."
  fi

  printf '%s\n' '#!/bin/sh' 'printf "DISPLAY=%s BUS=%s ARGS=%s\n" "$DISPLAY" "$DBUS_SESSION_BUS_ADDRESS" "$*"' > "$self_test_root/app/linux-electron-smoke.sh"
  chmod +x "$self_test_root/app/linux-electron-smoke.sh"
  output="$(run_helper_under_test launch --app-dir "$self_test_root/app" -- --mode print-shortcuts --app-name "Steam Bridge Smoke")" || self_test_fail "launch exited non-zero."
  [ "$output" = "DISPLAY=:0 BUS=unix:path=/run/user/1000/bus ARGS=--mode print-shortcuts --app-name Steam Bridge Smoke" ] || self_test_fail "launch must run the packaged helper in the graphical session environment."

  printf '%s\n' "APP_ID=480" "WEB_URL=''" | run_helper_under_test write-wrapper --wrapper-path "$self_test_root/wrapper/run-smoke-autorun.sh" --env-file "$self_test_root/wrapper/run-smoke-autorun.env" || self_test_fail "write-wrapper exited non-zero."
  [ "$(cat "$self_test_root/wrapper/run-smoke-autorun.env")" = "APP_ID=480
WEB_URL=''" ] || self_test_fail "write-wrapper must write the runner's env lines unchanged."
  [ -x "$self_test_root/wrapper/run-smoke-autorun.sh" ] || self_test_fail "The Steam shortcut wrapper must be executable."
  bash -n "$self_test_root/wrapper/run-smoke-autorun.sh" || self_test_fail "The Steam shortcut wrapper must parse."
  for expected in 'OVERLAY_GAME_ID="${OVERLAY_GAME_ID:-$APP_ID}"' 'export SteamOverlayGameId="$OVERLAY_GAME_ID"' 'export STEAM_BRIDGE_SMOKE_CONTROL_SERVER="$CONTROL_SERVER"' 'export STEAM_BRIDGE_SMOKE_CONTROL_FILE="$CONTROL_FILE"' 'export STEAM_BRIDGE_SMOKE_CONTROL_TOKEN="$CONTROL_TOKEN"' 'exec systemd-inhibit --what=sleep --why="Steam Bridge smoke" ./SteamBridgeSmoke --no-sandbox'; do
    grep -Fq -- "$expected" "$self_test_root/wrapper/run-smoke-autorun.sh" || self_test_fail "The Steam shortcut wrapper is missing: $expected"
  done

  (sleep 30 >/dev/null 2>&1 & echo "$!" > "$self_test_root/inhibit.pid")
  inhibit_pid="$(cat "$self_test_root/inhibit.pid")"
  output="$(run_helper_under_test cleanup --app-dir "$self_test_root/app" --inhibit-pid-file "$self_test_root/inhibit.pid")" || self_test_fail "cleanup exited non-zero."
  [ "$output" = "Previous Deck smoke runtime cleaned." ] || self_test_fail "cleanup must report a clean runtime."
  [ ! -f "$self_test_root/inhibit.pid" ] || self_test_fail "cleanup must remove the inhibitor pid file."
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$inhibit_pid" 2>/dev/null || break
    sleep 0.1
  done
  if kill -0 "$inhibit_pid" 2>/dev/null; then
    kill "$inhibit_pid" 2>/dev/null
    self_test_fail "cleanup must stop the recorded sleep inhibitor."
  fi

  echo game > "$self_test_root/session"
  : > "$self_test_root/session.log"
  output="$(run_helper_under_test session game)" || self_test_fail "session game exited non-zero in Game Mode."
  printf '%s\n' "$output" | grep -Fq "already in game mode" && [ ! -s "$self_test_root/session.log" ] || self_test_fail "session must not restart an already active mode."
  output="$(run_helper_under_test session desktop --timeout 4)" || self_test_fail "session desktop did not reach Desktop Mode."
  grep -Fxq "steamos-session-select plasma-wayland" "$self_test_root/session.log" || self_test_fail "Desktop switching must request Plasma Wayland, not the X11 plasma session."
  printf '%s\n' "$output" | grep -Fq "Session mode: desktop (Plasma Wayland)" || self_test_fail "session must report the reached mode."
  : > "$self_test_root/session.log"
  output="$(run_helper_under_test session game --timeout 4)" || self_test_fail "session game did not reach Game Mode."
  grep -Fxq "steamos-session-select gamescope" "$self_test_root/session.log" || self_test_fail "Game switching must request the gamescope session."
  touch "$self_test_root/session-stuck"
  if run_helper_under_test session desktop --timeout 0 >/dev/null 2>&1; then
    self_test_fail "session must fail when the mode never changes."
  fi
  rm -f "$self_test_root/session-stuck"
  echo desktop > "$self_test_root/session"
  printf '%s\n' plasmashell kwin_wayland > "$self_test_root/procs"
  : > "$self_test_root/session.log"
  output="$(run_helper_under_test session desktop --timeout 0)" || self_test_fail "Desktop readiness must not require the Steam client."
  [ ! -s "$self_test_root/session.log" ] || self_test_fail "session must not switch when Desktop Mode is already active."
  echo game > "$self_test_root/session"
  if run_helper_under_test session game --timeout 0 >/dev/null 2>&1; then
    self_test_fail "Game Mode readiness must wait for the Steam client."
  fi
  [ ! -s "$self_test_root/session.log" ] || self_test_fail "session must not restart Game Mode while Steam is still starting."
  printf '%s\n' plasmashell kwin_wayland steam steamwebhelper > "$self_test_root/procs"
  if run_helper_under_test session plasma >/dev/null 2>&1; then
    self_test_fail "session must only accept game or desktop."
  fi

  if run_helper_under_test no-such-command >/dev/null 2>&1; then
    self_test_fail "Unknown commands must fail."
  fi

  python_bin="$(command -v python3 || true)"
  if [ -n "$python_bin" ]; then
    block_count="$(awk '/<<.PY.$/ { count += 1 } END { print count + 0 }' "$self_test_script")"
    [ "$block_count" = 7 ] || self_test_fail "Expected 7 embedded Python blocks, found $block_count."
    for index in 1 2 3 4 5 6 7; do
      awk -v want="$index" '/<<.PY.$/ { count += 1; if (count == want) { inside = 1; next } } inside && /^PY$/ { exit } inside { print }' "$self_test_script" > "$self_test_root/block-$index.py"
      "$python_bin" -c 'import sys; compile(open(sys.argv[1]).read(), sys.argv[1], "exec")' "$self_test_root/block-$index.py" || self_test_fail "Embedded Python block $index does not compile."
    done
  else
    echo "python3 not found; skipped embedded Python compile checks." >&2
  fi

  echo "Steam Deck remote helper self-test passed."
}

command_name="${1:-}"
if [ "$#" -gt 0 ]; then
  shift
fi
case "$command_name" in
  status)
    cmd_status "$@"
    ;;
  screenshot)
    cmd_screenshot "$@"
    ;;
  state)
    cmd_state "$@"
    ;;
  focus)
    cmd_focus "$@"
    ;;
  clear-shells)
    cmd_clear_shells "$@"
    ;;
  key)
    cmd_key "$@"
    ;;
  web-close)
    cmd_web_close "$@"
    ;;
  wait-shortcut-open)
    cmd_wait_shortcut_open "$@"
    ;;
  verify-close)
    cmd_verify_close "$@"
    ;;
  cleanup)
    cmd_cleanup "$@"
    ;;
  keep-awake)
    cmd_keep_awake "$@"
    ;;
  write-wrapper)
    cmd_write_wrapper "$@"
    ;;
  launch)
    cmd_launch "$@"
    ;;
  session)
    cmd_session "$@"
    ;;
  wake-display)
    cmd_wake_display "$@"
    ;;
  self-test)
    run_self_test
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    echo "Unknown command: $command_name" >&2
    usage >&2
    exit 2
    ;;
esac
