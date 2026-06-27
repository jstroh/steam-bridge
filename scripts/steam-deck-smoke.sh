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

check_ssh() {
  echo "Checking SSH reachability for $host"
  remote_exec "true" >/dev/null
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
  tar -C "$local_app_dir" -czf - . | remote_exec "mkdir -p $remote_q && tar -xzf - -C $remote_q && chmod +x $remote_q/SteamBridgeSmoke $remote_q/linux-electron-smoke.sh"
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

  echo "Steam Deck smoke host runner self-test passed."
}

if [ "$mode" = "self-test" ]; then
  run_self_test
else
  run_remote_mode
fi
