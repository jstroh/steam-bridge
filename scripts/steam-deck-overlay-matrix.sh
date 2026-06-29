#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
deck_runner="${STEAM_BRIDGE_DECK_RUNNER:-$script_dir/steam-deck-smoke.sh}"
summary_runner="${STEAM_BRIDGE_DECK_MATRIX_SUMMARY:-$script_dir/summarize-steam-deck-overlay-matrix.cjs}"

host="${STEAM_DECK_HOST:-deck@steamdeck.local}"
mode="desktop"
suite="core"
app_id="480"
window_mode="fullscreen"
timeout_seconds="120"
connect_timeout="6"
inhibit_seconds="1800"
artifact_root="${STEAM_BRIDGE_DECK_MATRIX_ARTIFACT_ROOT:-/tmp/steam-bridge-deck-overlay-matrix-$(date +%Y%m%d-%H%M%S)}"
case_manifest=""
skip_package="0"
skip_preflight="0"
skip_summary="0"
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
  --mode desktop|game|self-test|summarize
                               Steam launch mode. Defaults to desktop.
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
  --skip-summary               Do not summarize collected artifacts after the matrix.
  --copy-each-case             Re-copy the package before every case.
  --dry-run                    Print commands without running them.
  --help                       Show this help.

Suites:
  minimal  presenter web, Friends, shortcut, checkout prepare, and passive toast.
  core     minimal plus store, profile, community, stats, achievements, OfficialGameGroup
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
    --skip-summary)
      skip_summary="1"
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
  desktop|game|self-test|summarize)
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

summarize_matrix_artifacts() {
  local root="$1"
  node "$summary_runner" --artifact-root "$root"
}

write_case_metadata() {
  local case_id="$1"
  local case_name="$2"
  shift 2

  if [ "$dry_run" = "1" ]; then
    return 0
  fi

  mkdir -p "$artifact_root"
  node - "$case_manifest" "$case_id" "$case_name" "$@" <<'NODE'
const fs = require("node:fs");

const [file, caseId, caseName, ...command] = process.argv.slice(2);

function optionValue(name) {
  const index = command.indexOf(name);
  if (index === -1) {
    return null;
  }
  return command[index + 1] ?? "";
}

const metadata = {
  caseId,
  caseName,
  command,
  action: optionValue("--action"),
  appId: optionValue("--app-id"),
  mode: optionValue("--mode"),
  visualCloseInput: optionValue("--visual-close-input"),
  visualToggleInput: optionValue("--visual-toggle-input"),
  shortcutTarget: optionValue("--shortcut-target"),
  webModal: optionValue("--web-modal"),
  resultFile: optionValue("--result-file"),
  diagnosticsDir: optionValue("--collect-diagnostics-dir"),
  screenshotsDir: optionValue("--visual-capture-dir")
};

fs.appendFileSync(file, `${JSON.stringify(metadata)}\n`);
NODE
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
  write_case_metadata "$case_id" "$name" "${cmd[@]}"
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
    --visual-close-input toggle \
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

count_matrix_cases() {
  awk '/^== Deck overlay matrix:/ { count += 1 } END { print count + 0 }'
}

matrix_case_command() {
  local output="$1"
  local case_id="$2"
  printf '%s\n' "$output" | awk -v marker="== Deck overlay matrix: $case_id ==" '
    $0 == marker {
      getline
      print
      exit
    }
  '
}

require_contains() {
  local output="$1"
  local pattern="$2"
  local message="$3"
  if ! printf '%s\n' "$output" | grep -Fq -- "$pattern"; then
    echo "Self-test failed: $message" >&2
    exit 1
  fi
}

require_not_contains() {
  local output="$1"
  local pattern="$2"
  local message="$3"
  if printf '%s\n' "$output" | grep -Fq -- "$pattern"; then
    echo "Self-test failed: $message" >&2
    exit 1
  fi
}

require_case_count() {
  local output="$1"
  local expected="$2"
  local label="$3"
  local actual
  actual="$(printf '%s\n' "$output" | count_matrix_cases)"
  if [ "$actual" != "$expected" ]; then
    echo "Self-test failed: $label generated $actual cases, expected $expected." >&2
    exit 1
  fi
}

run_summary_self_test() {
  local summary_output
  summary_output="$(node "$summary_runner" --self-test)"
  require_contains "$summary_output" "Steam Deck overlay matrix summary self-test passed." "summary self-test must pass the fixture."
}

run_self_test() {
  local self_path minimal_output core_output full_output first_core_case second_core_case shortcut_friends_case checkout_prepare_case passive_toast_case shortcut_web_case
  self_path="${BASH_SOURCE[0]}"

  minimal_output="$(
    bash "$self_path" \
      --host deck@example.invalid \
      --suite minimal \
      --skip-package \
      --skip-preflight \
      --dry-run \
      --artifact-root /tmp/steam-bridge-deck-overlay-matrix-self-test
  )"
  core_output="$(
    bash "$self_path" \
      --host deck@example.invalid \
      --suite core \
      --skip-package \
      --skip-preflight \
      --dry-run \
      --artifact-root /tmp/steam-bridge-deck-overlay-matrix-self-test
  )"
  full_output="$(
    bash "$self_path" \
      --host deck@example.invalid \
      --suite full \
      --skip-package \
      --skip-preflight \
      --dry-run \
      --artifact-root /tmp/steam-bridge-deck-overlay-matrix-self-test
  )"

  require_case_count "$minimal_output" "5" "minimal matrix"
  require_case_count "$core_output" "13" "core matrix"
  require_case_count "$full_output" "17" "full matrix"

  require_contains "$core_output" "--action presenter-web" "core matrix must include presenter web."
  require_contains "$core_output" "--action presenter-friends" "core matrix must include Friends."
  require_contains "$core_output" "--action presenter-shortcut" "core matrix must include shortcut probes."
  require_contains "$core_output" "--action presenter-checkout" "core matrix must include checkout."
  require_contains "$core_output" "--action presenter-achievement-progress" "core matrix must include passive toast."
  require_contains "$core_output" "--action presenter-store" "core matrix must include store."
  require_contains "$core_output" "--action presenter-profile" "core matrix must include profile."
  require_contains "$core_output" "--action presenter-community" "core matrix must include community."
  require_contains "$core_output" "--action presenter-stats" "core matrix must include stats."
  require_contains "$core_output" "--action presenter-achievements" "core matrix must include achievements."
  require_contains "$core_output" "--action presenter-dialog-auto --dialog OfficialGameGroup" "core matrix must include a dialog-equivalent route."
  require_contains "$core_output" "--checkout-transaction-id 123456789" "core matrix must include synthetic checkout approval-route plumbing."
  require_contains "$core_output" "--shortcut-target web" "core matrix must include configurable shortcut target proof."
  require_contains "$core_output" "--visual-close-input web" "core matrix must close web-backed overlays through the Steam web close control."
  require_contains "$full_output" "--dialog Friends" "full matrix must include Friends dialog equivalent."
  require_contains "$full_output" "--dialog Community" "full matrix must include Community dialog equivalent."
  require_contains "$full_output" "--dialog Stats" "full matrix must include Stats dialog equivalent."
  require_contains "$full_output" "--dialog Achievements" "full matrix must include Achievements dialog equivalent."

  first_core_case="$(matrix_case_command "$core_output" "01-web-modal")"
  second_core_case="$(matrix_case_command "$core_output" "02-friends")"
  shortcut_friends_case="$(matrix_case_command "$core_output" "03-shortcut-friends")"
  checkout_prepare_case="$(matrix_case_command "$core_output" "04-checkout-prepare")"
  passive_toast_case="$(matrix_case_command "$core_output" "06-passive-toast")"
  shortcut_web_case="$(matrix_case_command "$core_output" "13-shortcut-web")"

  require_not_contains "$first_core_case" "--skip-copy" "first matrix case must copy the package."
  require_contains "$second_core_case" "--skip-copy" "later matrix cases should reuse the copied package."
  require_contains "$shortcut_friends_case" "--visual-close-input toggle" "shortcut proof should close with Shift+Tab-only toggle input."
  require_not_contains "$checkout_prepare_case" "--result-delay-ms" "checkout readiness must use the normal settling delay."
  require_contains "$passive_toast_case" "--result-delay-ms 1200" "passive toast should use the short notification capture delay."
  require_not_contains "$shortcut_web_case" "--visual-toggle-open-delay" "web shortcut proof should use lifecycle evidence instead of a fixed open delay."
  require_contains "$shortcut_web_case" "--visual-close-input toggle" "web shortcut proof should close with Shift+Tab-only toggle input."
  run_summary_self_test

  echo "Steam Deck overlay matrix self-test passed."
}

if [ "$mode" = "self-test" ]; then
  run_self_test
  exit 0
fi

if [ "$mode" = "summarize" ]; then
  summarize_matrix_artifacts "$artifact_root"
  exit 0
fi

case_manifest="$artifact_root/matrix-cases.jsonl"

if [ "$dry_run" != "1" ]; then
  mkdir -p "$artifact_root"
  : > "$case_manifest"
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

if [ "$suite" = "core" ] || [ "$suite" = "full" ]; then
  run_web_surface_case "checkout-approval-route" \
    --action presenter-checkout \
    --checkout-transaction-id 123456789
fi

run_deck_case "passive-toast" \
  --action presenter-achievement-progress \
  --result-delay-ms 1200 \
  --keep-open-after-result

if [ "$suite" = "core" ] || [ "$suite" = "full" ]; then
  run_web_surface_case "store" \
    --action presenter-store

  run_web_surface_case "profile" \
    --action presenter-profile

  run_web_surface_case "community" \
    --action presenter-community

  run_web_surface_case "stats" \
    --action presenter-stats

  run_web_surface_case "achievements" \
    --action presenter-achievements

  run_dialog_auto_case "OfficialGameGroup"

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

if [ "$dry_run" != "1" ] && [ "$skip_summary" != "1" ]; then
  echo
  summarize_matrix_artifacts "$artifact_root"
fi
