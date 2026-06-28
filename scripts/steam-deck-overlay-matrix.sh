#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
deck_runner="${STEAM_BRIDGE_DECK_RUNNER:-$script_dir/steam-deck-smoke.sh}"

host="${STEAM_DECK_HOST:-deck@steamdeck.local}"
mode="desktop"
suite="core"
app_id="480"
window_mode="fullscreen"
timeout_seconds="120"
connect_timeout="6"
inhibit_seconds="1800"
artifact_root="${STEAM_BRIDGE_DECK_MATRIX_ARTIFACT_ROOT:-/tmp/steam-bridge-deck-overlay-matrix-$(date +%Y%m%d-%H%M%S)}"
skip_package="0"
skip_preflight="0"
copy_each_case="0"
dry_run="0"
local_app_dir=""
presenter_mode=""
overlay_profile=""

usage() {
  cat <<'EOF'
Usage:
  steam-deck-overlay-matrix.sh [options]

Runs the Steam Deck Desktop Mode product overlay proof matrix with the packaged
Electron smoke app and SpaceWar App ID 480 by default.

Options:
  --host USER@HOST             Steam Deck SSH target. Defaults to deck@steamdeck.local.
  --mode desktop|game          Steam launch mode. Defaults to desktop.
  --suite core|full|minimal    Matrix size. Defaults to core.
  --app-id ID                  Steam App ID inside the smoke app. Defaults to 480.
  --window-mode MODE           Smoke app window mode. Defaults to fullscreen.
  --artifact-root PATH         Local root for screenshots and diagnostics.
  --local-app-dir PATH         Local Linux x64 packaged smoke app directory.
  --presenter-mode MODE        persistent or session. Defaults to persistent.
  --overlay-profile NAME       Override runner overlay profile.
  --timeout-seconds SECONDS    Per-case result timeout. Defaults to 120.
  --connect-timeout SECONDS    SSH connect timeout. Defaults to 6.
  --inhibit-seconds SECONDS    Per-case Deck sleep inhibitor duration. Defaults to 1800.
  --skip-package               Do not run npm run example:package:linux first.
  --skip-preflight             Do not run the Deck preflight before the matrix.
  --copy-each-case             Re-copy the package before every case.
  --dry-run                    Print commands without running them.
  --help                       Show this help.

Suites:
  minimal  presenter web, Friends, shortcut, checkout prepare, and passive toast.
  core     minimal plus store, community, stats, achievements, OfficialGameGroup
           dialog equivalent, checkout approval-route plumbing, and web shortcut.
  full     core plus all known high-level dialog-equivalent routes.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --host)
      host="${2:?missing --host value}"
      shift 2
      ;;
    --mode)
      mode="${2:?missing --mode value}"
      shift 2
      ;;
    --suite)
      suite="${2:?missing --suite value}"
      shift 2
      ;;
    --app-id)
      app_id="${2:?missing --app-id value}"
      shift 2
      ;;
    --window-mode)
      window_mode="${2:?missing --window-mode value}"
      shift 2
      ;;
    --artifact-root)
      artifact_root="${2:?missing --artifact-root value}"
      shift 2
      ;;
    --local-app-dir)
      local_app_dir="${2:?missing --local-app-dir value}"
      shift 2
      ;;
    --presenter-mode)
      presenter_mode="${2:?missing --presenter-mode value}"
      shift 2
      ;;
    --overlay-profile)
      overlay_profile="${2:?missing --overlay-profile value}"
      shift 2
      ;;
    --timeout-seconds)
      timeout_seconds="${2:?missing --timeout-seconds value}"
      shift 2
      ;;
    --connect-timeout)
      connect_timeout="${2:?missing --connect-timeout value}"
      shift 2
      ;;
    --inhibit-seconds)
      inhibit_seconds="${2:?missing --inhibit-seconds value}"
      shift 2
      ;;
    --skip-package)
      skip_package="1"
      shift
      ;;
    --skip-preflight)
      skip_preflight="1"
      shift
      ;;
    --copy-each-case)
      copy_each_case="1"
      shift
      ;;
    --dry-run)
      dry_run="1"
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$mode" in
  desktop|game)
    ;;
  *)
    echo "Unknown --mode: $mode" >&2
    usage >&2
    exit 2
    ;;
esac

case "$suite" in
  minimal|core|full)
    ;;
  *)
    echo "Unknown --suite: $suite" >&2
    usage >&2
    exit 2
    ;;
esac

quote_command() {
  local arg
  printf '+'
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
  printf '\n'
}

run_or_print() {
  quote_command "$@"
  if [ "$dry_run" = "1" ]; then
    return 0
  fi
  "$@"
}

cleanup_remote_smoke() {
  local cleanup_cmd
  cleanup_cmd="pkill -f '/home/deck/steam-bridge-smoke/.*/[S]teamBridgeSmoke' >/dev/null 2>&1 || true; pkill -f '[s]ystemd-inhibit --what=sleep --why=Steam Bridge smoke' >/dev/null 2>&1 || true"
  if [ "$dry_run" = "1" ]; then
    quote_command ssh -o BatchMode=yes -o ConnectTimeout="$connect_timeout" "$host" "$cleanup_cmd"
    return 0
  fi
  ssh -o BatchMode=yes -o ConnectTimeout="$connect_timeout" "$host" "$cleanup_cmd" >/dev/null 2>&1 || true
}

case_index=0
copy_done="0"

run_deck_case() {
  local name="$1"
  shift

  case_index=$((case_index + 1))
  local case_id
  case_id="$(printf '%02d-%s' "$case_index" "$name")"

  local cmd=(
    bash "$deck_runner"
    --host "$host"
    --mode "$mode"
    --app-id "$app_id"
    --window-mode "$window_mode"
    --timeout-seconds "$timeout_seconds"
    --connect-timeout "$connect_timeout"
    --inhibit-seconds "$inhibit_seconds"
    --result-file "/tmp/steam-bridge-smoke-matrix-$case_id.log"
    --collect-diagnostics-dir "$artifact_root/diagnostics/$case_id"
    --visual-capture-dir "$artifact_root/screens/$case_id"
  )

  if [ -n "$local_app_dir" ]; then
    cmd+=(--local-app-dir "$local_app_dir")
  fi
  if [ -n "$presenter_mode" ]; then
    cmd+=(--presenter-mode "$presenter_mode")
  fi
  if [ -n "$overlay_profile" ]; then
    cmd+=(--overlay-profile "$overlay_profile")
  fi
  if [ "$copy_done" = "1" ] && [ "$copy_each_case" != "1" ]; then
    cmd+=(--skip-copy)
  fi

  cmd+=("$@")

  echo
  echo "== Deck overlay matrix: $case_id =="
  local status=0
  set +e
  run_or_print "${cmd[@]}"
  status=$?
  set -e
  copy_done="1"
  cleanup_remote_smoke
  return "$status"
}

run_web_surface_case() {
  local name="$1"
  shift
  run_deck_case "$name" \
    --keep-open-after-result \
    --visual-close-probe \
    --visual-close-input web \
    "$@"
}

run_shortcut_case() {
  local name="$1"
  shift
  run_deck_case "$name" \
    --action presenter-shortcut \
    --keep-open-after-result \
    --visual-toggle-probe \
    --visual-toggle-input keyboard \
    --visual-close-input web \
    --visual-toggle-open-delay 6 \
    "$@"
}

run_dialog_auto_case() {
  local dialog="$1"
  local slug
  slug="$(printf '%s' "$dialog" | tr '[:upper:]' '[:lower:]')"
  run_web_surface_case "dialog-$slug" \
    --action presenter-dialog-auto \
    --dialog "$dialog"
}

if [ "$dry_run" != "1" ]; then
  mkdir -p "$artifact_root"
fi

echo "Steam Deck overlay matrix"
echo "Host: $host"
echo "Mode: $mode"
echo "Suite: $suite"
echo "App ID: $app_id"
echo "Artifacts: $artifact_root"

if [ "$skip_package" != "1" ]; then
  echo
  echo "== Packaging Linux x64 Electron smoke app =="
  run_or_print npm run example:package:linux -- --overwrite
fi

if [ "$skip_preflight" != "1" ]; then
  preflight_cmd=(
    bash "$deck_runner"
    --host "$host"
    --mode preflight
    --app-id "$app_id"
    --connect-timeout "$connect_timeout"
  )
  if [ -n "$local_app_dir" ]; then
    preflight_cmd+=(--local-app-dir "$local_app_dir")
  fi
  echo
  echo "== Deck preflight =="
  run_or_print "${preflight_cmd[@]}"
fi

run_web_surface_case "web-modal" \
  --action presenter-web \
  --web-url "https://store.steampowered.com/app/$app_id/" \
  --web-modal true

run_web_surface_case "friends" \
  --action presenter-friends

run_shortcut_case "shortcut-friends"

run_deck_case "checkout-prepare" \
  --action presenter-checkout

run_deck_case "passive-toast" \
  --action presenter-achievement-progress \
  --result-delay-ms 1200 \
  --keep-open-after-result

if [ "$suite" = "core" ] || [ "$suite" = "full" ]; then
  run_web_surface_case "store" \
    --action presenter-store

  run_web_surface_case "community" \
    --action presenter-community

  run_web_surface_case "stats" \
    --action presenter-stats

  run_web_surface_case "achievements" \
    --action presenter-achievements

  run_dialog_auto_case "OfficialGameGroup"

  run_web_surface_case "checkout-approval-route" \
    --action presenter-checkout \
    --checkout-transaction-id 123456789

  run_shortcut_case "shortcut-web" \
    --shortcut-target web \
    --web-modal true \
    --web-url "https://store.steampowered.com/app/$app_id/"
fi

if [ "$suite" = "full" ]; then
  run_dialog_auto_case "Friends"
  run_dialog_auto_case "Community"
  run_dialog_auto_case "Stats"
  run_dialog_auto_case "Achievements"
fi

echo
echo "Steam Deck overlay matrix passed."
echo "Diagnostics: $artifact_root/diagnostics"
echo "Screenshots: $artifact_root/screens"
