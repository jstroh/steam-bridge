#!/usr/bin/env bash
set -euo pipefail

host="${STEAM_DECK_HOST:-deck@192.168.1.13}"
local_app_dir="${STEAM_BRIDGE_SMOKE_LOCAL_APP_DIR:-}"
remote_app_dir="${STEAM_DECK_SMOKE_REMOTE_APP_DIR:-/home/deck/steam-bridge-smoke/SteamBridgeSmoke-linux-x64}"
mode="game"
app_id="480"
action="dialog"
result_file="/tmp/steam-bridge-smoke-steam-launch.log"
result_delay_ms="8000"
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

usage() {
  cat <<'EOF'
Usage:
  steam-deck-smoke.sh [options]

Modes:
  --mode game                   Run the Steam-launched Game Mode gate.
  --mode desktop                Run the Steam-launched Desktop Mode gate.
  --mode direct                 Run the app directly on the Deck and verify init.
  --mode discover               Scan a local /24 for Steam Deck SSH candidates.
  --mode preflight              Check SSH, remote package, Steam, and shortcuts.
  --mode print-shortcuts        Print matching Deck Steam shortcuts.
  --mode print-launch-options   Print shortcut launch options from the Deck helper.
  --mode self-test              Validate this host runner without SSH.

Options:
  --host USER@HOST              SSH target. Defaults to deck@192.168.1.13.
  --local-app-dir PATH          Local Linux x64 SteamBridgeSmoke package directory.
  --remote-app-dir PATH         Remote package directory. Defaults under ~/steam-bridge-smoke.
  --skip-copy                   Use the existing remote package directory.
  --app-id ID                   Steam App ID used inside the smoke app. Defaults to 480.
  --action NAME                 Autorun action. Defaults to dialog.
  --result-file PATH            Remote result log path.
  --result-delay-ms MS          Autorun result delay. Defaults to 8000.
  --timeout-seconds SECONDS     Result wait timeout. Defaults to 90.
  --shortcut-game-id ID|auto    Full steam://rungameid shortcut ID. Defaults to auto.
  --app-name NAME               Shortcut name to auto-discover.
  --steam-user-id ID            Restrict shortcut discovery to one userdata ID.
  --discover-subnet PREFIX      IPv4 /24 prefix to scan, for example 192.168.1.
  --exclude-host IP             Skip an IP during discovery. May be repeated.
  --scan-timeout SECONDS        SSH port scan timeout. Defaults to 1.
  --no-keep-awake               Do not start a temporary systemd sleep inhibitor.
  --inhibit-seconds SECONDS     Sleep inhibitor duration. Defaults to 900.
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
    --skip-copy)
      copy_app="0"
      shift
      ;;
    --app-id)
      app_id="${2:?missing --app-id value}"
      shift 2
      ;;
    --action)
      action="${2:?missing --action value}"
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

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
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
  if [ ! -x "$local_app_dir/SteamBridgeSmoke" ]; then
    echo "Missing Linux smoke executable: $local_app_dir/SteamBridgeSmoke" >&2
    echo "Run npm run example:package:linux before using this runner." >&2
    exit 1
  fi

  if [ ! -x "$local_app_dir/linux-electron-smoke.sh" ]; then
    echo "Missing packaged Deck helper: $local_app_dir/linux-electron-smoke.sh" >&2
    echo "Run npm run example:package:linux before using this runner." >&2
    exit 1
  fi
}

copy_to_deck() {
  local remote_q
  remote_q="$(quote_arg "$remote_app_dir")"
  assert_local_app
  check_ssh
  echo "Copying $local_app_dir to $host:$remote_app_dir"
  COPYFILE_DISABLE=1 tar --no-xattrs -C "$local_app_dir" -czf - . | remote_exec "mkdir -p $remote_q && tar -xzf - -C $remote_q && chmod +x $remote_q/SteamBridgeSmoke $remote_q/linux-electron-smoke.sh"
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

helper_args=()

append_common_helper_args() {
  helper_args+=(
    "--app-id" "$app_id"
    "--action" "$action"
    "--result-file" "$result_file"
    "--result-delay-ms" "$result_delay_ms"
    "--timeout-seconds" "$timeout_seconds"
    "--app-name" "$app_name"
  )

  if [ -n "$steam_user_id" ]; then
    helper_args+=("--steam-user-id" "$steam_user_id")
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
  elif [ "$action" = "native-probe" ]; then
    helper_args+=("--require-event" "overlay:native-probe-open")
  fi

  helper_args+=("--require-event" "callback:overlay-activated")

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

run_helper() {
  local args
  local remote_q
  remote_q="$(quote_arg "$remote_app_dir")"
  args="$(quote_args "$@")"
  remote_exec "cd $remote_q && ./linux-electron-smoke.sh $args"
}

run_preflight() {
  local remote_q matches
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

  remote_exec "set -e; echo \"Remote host: \$(uname -n 2>/dev/null || printf unknown)\"; echo \"Remote kernel: \$(uname -srmo 2>/dev/null || uname -a)\"; if [ -x $remote_q/SteamBridgeSmoke ] && [ -x $remote_q/linux-electron-smoke.sh ]; then echo \"Remote package: present\"; else echo \"Remote package: missing at $remote_app_dir\"; fi; if command -v steam >/dev/null 2>&1; then echo \"Steam command: \$(command -v steam)\"; elif [ -x \"\$HOME/.steam/root/ubuntu12_32/steam\" ]; then echo \"Steam command: \$HOME/.steam/root/ubuntu12_32/steam\"; else echo \"Steam command: missing\"; fi; if command -v systemd-inhibit >/dev/null 2>&1; then echo \"Sleep inhibitor: available\"; else echo \"Sleep inhibitor: missing\"; fi; if ls \"\$HOME/.local/share/Steam/userdata\"/*/config/shortcuts.vdf >/dev/null 2>&1; then echo \"Shortcut files: present\"; else echo \"Shortcut files: missing\"; fi"

  if [ "$copy_app" = "0" ]; then
    remote_exec "test -x $remote_q/SteamBridgeSmoke && test -x $remote_q/linux-electron-smoke.sh" || {
      echo "Remote package is required when --skip-copy is used." >&2
      return 1
    }
  fi

  if remote_exec "test -x $remote_q/linux-electron-smoke.sh" >/dev/null 2>&1; then
    build_print_shortcuts_args
    matches="$(run_helper "${helper_args[@]}")"
    echo "Matching shortcuts:"
    if [ -n "$matches" ]; then
      printf '%s\n' "$matches"
    else
      echo "(none)"
    fi
  else
    echo "Matching shortcuts: skipped until the package is copied"
  fi
}

run_remote_mode() {
  case "$mode" in
    game|desktop)
      if [ "$copy_app" = "1" ]; then
        copy_to_deck
      fi
      start_keep_awake
      trap stop_keep_awake EXIT
      build_steam_launch_args
      run_helper "${helper_args[@]}"
      ;;
    direct)
      if [ "$copy_app" = "1" ]; then
        copy_to_deck
      fi
      start_keep_awake
      trap stop_keep_awake EXIT
      build_direct_args
      run_helper "${helper_args[@]}"
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
  local game_args desktop_args direct_check
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

  mode="desktop"
  build_steam_launch_args
  desktop_args="$(quote_args "${helper_args[@]}")"
  if [[ "$desktop_args" == *"--require-big-picture"* ]]; then
    echo "Self-test failed: Desktop Mode args must not require Big Picture." >&2
    exit 1
  fi

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
