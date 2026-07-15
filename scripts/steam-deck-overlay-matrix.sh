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
resume_from=""
resume_case_index="0"

usage() {
  cat <<'EOF'
Usage:
  steam-deck-overlay-matrix.sh [options]

Runs the Steam Deck Desktop Mode managed product overlay matrix or the bounded
Game Mode compositor-native proof with the packaged Electron smoke app and
SpaceWar App ID 480 by default.

Options:
  --host USER@HOST             Steam Deck SSH target. Defaults to deck@steamdeck.local.
  --mode desktop|game|self-test|summarize
                               Steam launch mode. Defaults to desktop.
  --suite core|full|minimal|game
                               Matrix contract. Defaults to core.
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
  --resume-from CASE_ID        Retain the exact validated prefix before CASE_ID and rerun from it.
  --dry-run                    Print commands without running them.
  --help                       Show this help.

Suites:
  minimal  presenter web, Friends, shortcut, checkout prepare, and passive toast.
  core     minimal plus unlock toast, store, profile, community, stats, achievements,
           user profile dialog, OfficialGameGroup dialog equivalent, checkout approval-route
           plumbing, and web shortcut.
  full     core plus all known high-level dialog-equivalent routes.
  game     Game Mode managed presenter readiness plus compositor-native store
           activation, Gamescope capture, Escape back-to-app, and cleanup.
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
    --resume-from)
      resume_from="${2:?missing --resume-from value}"
      shift 2
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
  minimal|core|full|game)
    ;;
  *)
    echo "Unknown --suite: $suite" >&2
    usage >&2
    exit 2
    ;;
esac

if [ "$mode" = "game" ] && [ "$suite" != "game" ]; then
  echo "Game Mode requires --suite game; Desktop managed suites do not activate through Gamescope." >&2
  exit 2
fi
if [ "$suite" = "game" ] && [ "$mode" != "game" ]; then
  echo "--suite game requires --mode game." >&2
  exit 2
fi

expected_case_ids=()
case "$suite" in
  game)
    expected_case_ids=(
      01-presenter-ready
      02-store
    )
    ;;
  minimal)
    expected_case_ids=(
      01-web-modal
      02-friends
      03-friends-open-and-wait
      04-shortcut-friends
      05-checkout-prepare
      06-passive-toast
    )
    ;;
  core)
    expected_case_ids=(
      01-web-modal
      02-friends
      03-friends-open-and-wait
      04-shortcut-friends
      05-checkout-prepare
      06-checkout-approval-route
      07-passive-toast
      08-passive-unlock-toast
      09-store
      10-profile
      11-players
      12-community
      13-stats
      14-achievements
      15-user-steamid
      16-user-chat
      17-dialog-officialgamegroup
      18-web-open-and-wait
      19-shortcut-web
      20-store-open-and-wait
      21-dialog-auto-open-and-wait
    )
    ;;
  full)
    expected_case_ids=(
      01-web-modal
      02-friends
      03-friends-open-and-wait
      04-shortcut-friends
      05-checkout-prepare
      06-checkout-approval-route
      07-passive-toast
      08-passive-unlock-toast
      09-store
      10-profile
      11-players
      12-community
      13-stats
      14-achievements
      15-user-steamid
      16-user-chat
      17-dialog-officialgamegroup
      18-web-open-and-wait
      19-shortcut-web
      20-store-open-and-wait
      21-dialog-auto-open-and-wait
      22-dialog-friends
      23-dialog-players
      24-dialog-community
      25-dialog-stats
      26-dialog-achievements
    )
    ;;
esac

if [ -n "$resume_from" ]; then
  for expected_index in "${!expected_case_ids[@]}"; do
    if [ "${expected_case_ids[$expected_index]}" = "$resume_from" ]; then
      resume_case_index=$((expected_index + 1))
      break
    fi
  done
  if [ "$resume_case_index" -eq 0 ]; then
    echo "Unknown --resume-from case for $suite suite: $resume_from" >&2
    exit 2
  fi
  if [ "$skip_package" != "1" ]; then
    echo "--resume-from requires --skip-package so the retained prefix stays bound to the same package." >&2
    exit 2
  fi
  if [ "$skip_preflight" = "1" ]; then
    echo "--resume-from requires preflight to validate the retained remote package before continuing." >&2
    exit 2
  fi
  if [ "$copy_each_case" = "1" ]; then
    echo "--resume-from cannot be combined with --copy-each-case." >&2
    exit 2
  fi
fi

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
  run_or_print bash "$deck_runner" \
    --host "$host" \
    --mode cleanup \
    --connect-timeout "$connect_timeout"
}

summarize_matrix_artifacts() {
  local root="$1"
  node "$summary_runner" --artifact-root "$root"
}

write_matrix_manifest() {
  if [ "$dry_run" = "1" ]; then
    echo "Matrix contract: mode=$mode suite=$suite expectedCases=${#expected_case_ids[@]}"
    return 0
  fi

  node - "$matrix_manifest" "$mode" "$suite" "$app_id" "${expected_case_ids[@]}" <<'NODE'
const fs = require("node:fs");

const [file, mode, suite, appIdText, ...expectedCaseIds] = process.argv.slice(2);
const appId = Number(appIdText);
if (!Number.isSafeInteger(appId) || appId <= 0) {
  throw new Error(`Invalid matrix App ID: ${appIdText}`);
}
fs.writeFileSync(
  file,
  `${JSON.stringify({
    kind: "steam-bridge-deck-overlay-matrix",
    schemaVersion: 1,
    mode,
    suite,
    appId,
    expectedCaseCount: expectedCaseIds.length,
    expectedCaseIds
  }, null, 2)}\n`
);
NODE
}

prepare_matrix_artifacts() {
  mkdir -p "$artifact_root"
  node - "$matrix_manifest" "$case_manifest" "$cleanup_evidence" "$mode" "$suite" "$app_id" "$resume_from" "${expected_case_ids[@]}" <<'NODE'
const fs = require("node:fs");

const [manifestFile, casesFile, cleanupFile, mode, suite, appIdText, resumeFrom, ...expectedCaseIds] =
  process.argv.slice(2);
const appId = Number(appIdText);
if (!Number.isSafeInteger(appId) || appId <= 0) {
  throw new Error(`Invalid matrix App ID: ${appIdText}`);
}
const contract = {
  kind: "steam-bridge-deck-overlay-matrix",
  schemaVersion: 1,
  mode,
  suite,
  appId,
  expectedCaseCount: expectedCaseIds.length,
  expectedCaseIds
};

if (!resumeFrom) {
  fs.writeFileSync(manifestFile, `${JSON.stringify(contract, null, 2)}\n`);
  fs.writeFileSync(casesFile, "");
  fs.rmSync(cleanupFile, { force: true });
  process.exit(0);
}

if (!fs.existsSync(manifestFile) || !fs.existsSync(casesFile)) {
  throw new Error("Deck matrix resume requires an existing manifest and case metadata file.");
}
const existingContract = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
if (JSON.stringify(existingContract) !== JSON.stringify(contract)) {
  throw new Error("Deck matrix resume contract does not match the existing artifact root.");
}
const resumeIndex = expectedCaseIds.indexOf(resumeFrom);
if (resumeIndex < 0) {
  throw new Error(`Unknown Deck matrix resume case: ${resumeFrom}`);
}
const lines = fs
  .readFileSync(casesFile, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim())
  .map((line) => ({ line, metadata: JSON.parse(line) }));
const retained = lines.slice(0, resumeIndex);
const retainedIds = retained.map(({ metadata }) => metadata.caseId);
const expectedPrefix = expectedCaseIds.slice(0, resumeIndex);
if (JSON.stringify(retainedIds) !== JSON.stringify(expectedPrefix)) {
  throw new Error(
    `Deck matrix resume prefix mismatch: expected ${expectedPrefix.join(",")}, got ${retainedIds.join(",")}`
  );
}
if (new Set(retainedIds).size !== retainedIds.length) {
  throw new Error("Deck matrix resume prefix contains duplicate case metadata.");
}
fs.writeFileSync(casesFile, retained.length ? `${retained.map(({ line }) => line).join("\n")}\n` : "");
fs.rmSync(cleanupFile, { force: true });
NODE
}

write_cleanup_evidence() {
  local state smoke_processes inhibitor_processes overlay_processes steam_processes plasma_processes
  if [ "$dry_run" = "1" ]; then
    echo "Cleanup evidence: dry-run"
    return 0
  fi

  cleanup_remote_smoke
  state="$(ssh -o BatchMode=yes -o ConnectTimeout="$connect_timeout" "$host" 'process_live() { [ -r "/proc/$1/stat" ] || return 1; process_stat=$(cat "/proc/$1/stat" 2>/dev/null || true); process_state=${process_stat##*) }; process_state=${process_state%% *}; case "$process_state" in Z|X|"") return 1 ;; *) return 0 ;; esac; }; count_matching() { count=0; match_mode=$1; pattern=$2; for pid in $(pgrep "$match_mode" "$pattern" 2>/dev/null || true); do process_live "$pid" && count=$((count + 1)); done; printf "%s" "$count"; }; smoke=$(count_matching -f "/home/deck/steam-bridge-smoke/.*/[S]teamBridgeSmoke"); inhibitor=$(count_matching -f "[s]ystemd-inhibit --what=sleep --why=Steam Bridge smoke"); overlay=$(count_matching -x gameoverlayui); steam=$(count_matching -x steam); plasma=$(count_matching -x plasmashell); printf "%s %s %s %s %s\n" "$smoke" "$inhibitor" "$overlay" "$steam" "$plasma"')"
  read -r smoke_processes inhibitor_processes overlay_processes steam_processes plasma_processes <<<"$state"
  node - "$cleanup_evidence" "$mode" "$smoke_processes" "$inhibitor_processes" "$overlay_processes" "$steam_processes" "$plasma_processes" <<'NODE'
const fs = require("node:fs");

const [file, mode, ...counts] = process.argv.slice(2);
const [smokeProcesses, sleepInhibitors, gameOverlayProcesses, steamProcesses, plasmaProcesses] = counts.map(Number);
if ([smokeProcesses, sleepInhibitors, gameOverlayProcesses, steamProcesses, plasmaProcesses].some((value) => !Number.isSafeInteger(value) || value < 0)) {
  throw new Error(`Invalid Deck cleanup counts: ${counts.join(" ")}`);
}
const ok = smokeProcesses === 0 && sleepInhibitors === 0 && gameOverlayProcesses === 0 && steamProcesses >= 1;
fs.writeFileSync(
  file,
  `${JSON.stringify({
    kind: "steam-bridge-deck-overlay-matrix-cleanup",
    schemaVersion: 1,
    mode,
    ok,
    smokeProcesses,
    sleepInhibitors,
    gameOverlayProcesses,
    steamProcesses,
    plasmaProcesses
  }, null, 2)}\n`
);
if (!ok) {
  throw new Error(`Deck cleanup evidence failed: smoke=${smokeProcesses} inhibitors=${sleepInhibitors} overlay=${gameOverlayProcesses} steam=${steamProcesses}`);
}
NODE
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
  userDialog: optionValue("--user-dialog"),
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
  local case_args=("$@")
  if case_uses_presenter_action "${case_args[@]}" && ! case_has_managed_timing_requirement "${case_args[@]}"; then
    case_args+=(--require-zero-managed-overlay-timing)
  fi
  if case_uses_presenter_action "${case_args[@]}" && ! case_has_managed_overlay_isolation_requirement "${case_args[@]}"; then
    case_args+=(--require-managed-overlay-isolation)
  fi

  case_index=$((case_index + 1))
  local case_id
  case_id="$(printf '%02d-%s' "$case_index" "$name")"

  if [ "$resume_case_index" -gt 0 ] && [ "$case_index" -lt "$resume_case_index" ]; then
    echo
    echo "== Deck overlay matrix: $case_id (retained validated prefix) =="
    copy_done="1"
    return 0
  fi

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

  cmd+=("${case_args[@]}")

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

case_uses_presenter_action() {
  local previous=""
  local arg
  for arg in "$@"; do
    if [ "$previous" = "--action" ] && [[ "$arg" == presenter-* ]]; then
      return 0
    fi
    previous="$arg"
  done
  return 1
}

case_has_managed_timing_requirement() {
  local arg
  for arg in "$@"; do
    if [ "$arg" = "--require-restore-focus-delay-ms" ] || [ "$arg" = "--require-zero-managed-overlay-timing" ]; then
      return 0
    fi
  done
  return 1
}

case_has_managed_overlay_isolation_requirement() {
  local arg
  for arg in "$@"; do
    if [ "$arg" = "--require-managed-overlay-isolation" ]; then
      return 0
    fi
  done
  return 1
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
  if [[ "$output" != *"$pattern"* ]]; then
    echo "Self-test failed: $message" >&2
    exit 1
  fi
}

require_not_contains() {
  local output="$1"
  local pattern="$2"
  local message="$3"
  if [[ "$output" == *"$pattern"* ]]; then
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
  local self_path minimal_output core_output full_output game_output first_core_case second_core_case shortcut_friends_case checkout_prepare_case passive_toast_case passive_unlock_case user_case user_chat_case shortcut_web_case store_open_wait_case game_presenter_case game_store_case
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
  game_output="$(
    bash "$self_path" \
      --host deck@example.invalid \
      --mode game \
      --suite game \
      --skip-package \
      --skip-preflight \
      --dry-run \
      --artifact-root /tmp/steam-bridge-deck-overlay-matrix-self-test
  )"

  require_case_count "$minimal_output" "6" "minimal matrix"
  require_case_count "$core_output" "21" "core matrix"
  require_case_count "$full_output" "26" "full matrix"
  require_case_count "$game_output" "2" "Game Mode matrix"
  require_contains "$minimal_output" "Matrix contract: mode=desktop suite=minimal expectedCases=6" "minimal matrix must declare its completion contract."
  require_contains "$core_output" "Matrix contract: mode=desktop suite=core expectedCases=21" "core matrix must declare its completion contract."
  require_contains "$full_output" "Matrix contract: mode=desktop suite=full expectedCases=26" "full matrix must declare its completion contract."
  require_contains "$game_output" "Matrix contract: mode=game suite=game expectedCases=2" "Game Mode matrix must declare its completion contract."
  require_contains "$core_output" "Cleanup evidence: dry-run" "matrix must produce final cleanup evidence."
  require_contains "$core_output" "--mode cleanup" "matrix cleanup must delegate to the Deck runner."
  if sed -n '/^cleanup_remote_smoke()/,/^}/p' "$self_path" | grep -Fq 'pkill -f'; then
    echo "Self-test failed: Matrix cleanup must not duplicate runtime ownership logic." >&2
    exit 1
  fi

  require_contains "$core_output" "--action presenter-web" "core matrix must include presenter web."
  require_contains "$core_output" "--require-zero-managed-overlay-timing" "core matrix must require zero managed overlay timing."
  require_contains "$core_output" "--require-managed-overlay-isolation" "core matrix must require managed overlay isolation."
  require_contains "$core_output" "--action presenter-web-open-and-wait" "core matrix must include presenter openAndWait web."
  require_contains "$core_output" "--action presenter-store-open-and-wait" "core matrix must include presenter openAndWait store."
  require_contains "$core_output" "--action presenter-dialog-auto-open-and-wait" "core matrix must include dialog-equivalent openAndWait."
  require_contains "$core_output" "--action presenter-friends" "core matrix must include Friends."
  require_contains "$core_output" "--action presenter-friends-open-and-wait" "core matrix must include Friends openAndWait."
  require_contains "$core_output" "--action presenter-shortcut" "core matrix must include shortcut probes."
  require_contains "$core_output" "--action presenter-checkout" "core matrix must include checkout."
  require_contains "$core_output" "--action presenter-achievement-progress" "core matrix must include passive toast."
  require_contains "$core_output" "--action presenter-achievement-unlock" "core matrix must include passive unlock toast."
  require_contains "$core_output" "--action presenter-store" "core matrix must include store."
  require_contains "$core_output" "--action presenter-profile" "core matrix must include profile."
  require_contains "$core_output" "--action presenter-players" "core matrix must include players."
  require_contains "$core_output" "--action presenter-community" "core matrix must include community."
  require_contains "$core_output" "--action presenter-stats" "core matrix must include stats."
  require_contains "$core_output" "--action presenter-achievements" "core matrix must include achievements."
  require_contains "$core_output" "--action presenter-user --user-dialog steamid" "core matrix must include user dialog equivalent routing."
  require_contains "$core_output" "--action presenter-user --user-dialog chat" "core matrix must include user chat routing."
  require_contains "$core_output" "--action presenter-dialog-auto --dialog OfficialGameGroup" "core matrix must include a dialog-equivalent route."
  require_contains "$core_output" "--checkout-transaction-id 123456789" "core matrix must include synthetic checkout approval-route plumbing."
  require_contains "$core_output" "--shortcut-target web" "core matrix must include configurable shortcut target proof."
  require_contains "$core_output" "--visual-close-input web" "core matrix must close web-backed overlays through the Steam web close control."
  require_contains "$full_output" "--dialog Friends" "full matrix must include Friends dialog equivalent."
  require_contains "$full_output" "--dialog Players" "full matrix must include Players dialog equivalent."
  require_contains "$full_output" "--dialog Community" "full matrix must include Community dialog equivalent."
  require_contains "$full_output" "--dialog Stats" "full matrix must include Stats dialog equivalent."
  require_contains "$full_output" "--dialog Achievements" "full matrix must include Achievements dialog equivalent."

  first_core_case="$(matrix_case_command "$core_output" "01-web-modal")"
  second_core_case="$(matrix_case_command "$core_output" "02-friends")"
  shortcut_friends_case="$(matrix_case_command "$core_output" "04-shortcut-friends")"
  checkout_prepare_case="$(matrix_case_command "$core_output" "05-checkout-prepare")"
  passive_toast_case="$(matrix_case_command "$core_output" "07-passive-toast")"
  passive_unlock_case="$(matrix_case_command "$core_output" "08-passive-unlock-toast")"
  user_case="$(matrix_case_command "$core_output" "15-user-steamid")"
  user_chat_case="$(matrix_case_command "$core_output" "16-user-chat")"
  shortcut_web_case="$(matrix_case_command "$core_output" "19-shortcut-web")"
  store_open_wait_case="$(matrix_case_command "$core_output" "20-store-open-and-wait")"
  game_presenter_case="$(matrix_case_command "$game_output" "01-presenter-ready")"
  game_store_case="$(matrix_case_command "$game_output" "02-store")"

  require_not_contains "$first_core_case" "--skip-copy" "first matrix case must copy the package."
  require_contains "$second_core_case" "--skip-copy" "later matrix cases should reuse the copied package."
  require_contains "$shortcut_friends_case" "--visual-close-input toggle" "shortcut proof should close with Shift+Tab-only toggle input."
  require_not_contains "$checkout_prepare_case" "--result-delay-ms" "checkout readiness must use the normal settling delay."
  require_contains "$passive_toast_case" "--result-delay-ms 1200" "passive toast should use the short notification capture delay."
  require_contains "$passive_unlock_case" "--result-delay-ms 1200" "passive unlock toast should use the short notification capture delay."
  require_contains "$user_case" "--user-dialog steamid" "user dialog proof should pass the user dialog name."
  require_contains "$user_chat_case" "--user-dialog chat" "user chat proof should pass the chat dialog name."
  require_not_contains "$shortcut_web_case" "--visual-toggle-open-delay" "web shortcut proof should use lifecycle evidence instead of a fixed open delay."
  require_contains "$shortcut_web_case" "--visual-close-input toggle" "web shortcut proof should close with Shift+Tab-only toggle input."
  require_contains "$store_open_wait_case" "--visual-close-input toggle" "store openAndWait proof should close through Steam's Shift+Tab toggle."
  require_not_contains "$store_open_wait_case" "--visual-close-input web" "store openAndWait proof must not use its unreliable visible web close control."
  require_contains "$game_presenter_case" "--action presenter-ready" "Game Mode must prove managed presenter readiness without opening a web route."
  require_contains "$game_store_case" "--action store" "Game Mode must use its compositor-native store activation route."
  require_contains "$game_store_case" "--visual-close-input escape" "Game Mode store proof must return through SteamUI Escape."
  require_contains "$game_store_case" "--require-close-deactivated" "Game Mode store proof must require active=false and app focus return."
  require_not_contains "$game_output" "--action presenter-web" "Game Mode must not run the known non-activating managed web route."
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
matrix_manifest="$artifact_root/matrix-manifest.json"
cleanup_evidence="$artifact_root/matrix-cleanup.json"

if [ "$dry_run" = "1" ]; then
  write_matrix_manifest
else
  prepare_matrix_artifacts
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

if [ "$suite" = "game" ]; then
  run_deck_case "presenter-ready" \
    --action presenter-ready

  run_deck_case "store" \
    --keep-open-after-result \
    --visual-close-probe \
    --visual-close-input escape \
    --require-close-deactivated \
    --require-no-crashes \
    --action store
else
run_web_surface_case "web-modal" \
  --action presenter-web \
  --web-url "https://store.steampowered.com/app/$app_id/" \
  --web-modal true

run_web_surface_case "friends" \
  --action presenter-friends

run_web_surface_case "friends-open-and-wait" \
  --action presenter-friends-open-and-wait

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
  run_deck_case "passive-unlock-toast" \
    --action presenter-achievement-unlock \
    --result-delay-ms 1200 \
    --keep-open-after-result

  run_web_surface_case "store" \
    --action presenter-store

  run_web_surface_case "profile" \
    --action presenter-profile

  run_web_surface_case "players" \
    --action presenter-players

  run_web_surface_case "community" \
    --action presenter-community

  run_web_surface_case "stats" \
    --action presenter-stats

  run_web_surface_case "achievements" \
    --action presenter-achievements

  run_web_surface_case "user-steamid" \
    --action presenter-user \
    --user-dialog steamid

  run_web_surface_case "user-chat" \
    --action presenter-user \
    --user-dialog chat

  run_dialog_auto_case "OfficialGameGroup"

  run_web_surface_case "web-open-and-wait" \
    --action presenter-web-open-and-wait \
    --web-url "https://store.steampowered.com/app/$app_id/" \
    --web-modal true

  run_shortcut_case "shortcut-web" \
    --shortcut-target web \
    --web-modal true \
    --web-url "https://store.steampowered.com/app/$app_id/"

  run_deck_case "store-open-and-wait" \
    --keep-open-after-result \
    --visual-close-probe \
    --visual-close-input toggle \
    --action presenter-store-open-and-wait

  run_web_surface_case "dialog-auto-open-and-wait" \
    --action presenter-dialog-auto-open-and-wait \
    --dialog OfficialGameGroup
fi

if [ "$suite" = "full" ]; then
  run_dialog_auto_case "Friends"
  run_dialog_auto_case "Players"
  run_dialog_auto_case "Community"
  run_dialog_auto_case "Stats"
  run_dialog_auto_case "Achievements"
fi
fi

write_cleanup_evidence

echo
echo "Steam Deck overlay matrix passed."
echo "Diagnostics: $artifact_root/diagnostics"
echo "Screenshots: $artifact_root/screens"

if [ "$dry_run" != "1" ] && [ "$skip_summary" != "1" ]; then
  echo
  summarize_matrix_artifacts "$artifact_root"
fi
