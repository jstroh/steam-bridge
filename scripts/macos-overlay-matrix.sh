#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"

summary_runner="${STEAM_BRIDGE_MACOS_MATRIX_SUMMARY:-$script_dir/summarize-macos-overlay-matrix.cjs}"
mode="steam-launch"
suite="core"
app_id="480"
app_name="Steam Bridge Smoke"
steam_user_id=""
shortcut_game_id="auto"
shortcuts_path=""
artifact_root="${STEAM_BRIDGE_MACOS_MATRIX_ARTIFACT_ROOT:-/tmp/steam-bridge-macos-overlay-matrix-$(date +%Y%m%d-%H%M%S)}"
launcher_env_file="${STEAM_BRIDGE_MACOS_LAUNCHER_ENV_FILE:-/tmp/steam-bridge-macos-smoke.env}"
helper_path="$repo_root/dist/electron-smoke/aarch64-apple-darwin/SteamBridgeSmoke-darwin-arm64/macos-electron-smoke.sh"
app_exe="$repo_root/dist/electron-smoke/aarch64-apple-darwin/SteamBridgeSmoke-darwin-arm64/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke"
signing_verifier="$script_dir/verify-macos-steam-signing.cjs"
overlay_profile="compatibility"
native_host_backend=""
timeout_seconds="120"
skip_package="0"
dry_run="0"
restart_steam="1"
close_steam_after="0"
skip_summary="0"
expected_native_host_unavailable_reason=""

usage() {
  cat <<'EOF'
Usage:
  macos-overlay-matrix.sh [options]

Runs the macOS Apple Silicon Steam-launched overlay proof matrix with the
packaged Electron smoke app and SpaceWar App ID 480 by default.

Options:
  --mode steam-launch|self-test|summarize
                                  Run live, validate dry-run matrix shape, or summarize artifacts.
  --suite minimal|core|full|unavailable
                                  Matrix size. Defaults to core. "unavailable"
                                  captures expected macOS lock/asleep fail-fast
                                  artifacts instead of success overlay cases.
  --app-id ID                    Steam App ID inside the smoke app. Defaults to 480.
  --app-name NAME                Steam non-Steam shortcut name.
  --steam-user-id ID             Steam userdata ID containing shortcuts.vdf.
  --shortcut-game-id ID|auto     steam://rungameid ID. Defaults to auto.
  --shortcuts PATH               Explicit shortcuts.vdf path.
  --artifact-root PATH           Result and diagnostic output root.
  --launcher-env-file PATH       Stable native launcher env file.
  --helper-path PATH             Packaged macos-electron-smoke.sh path.
  --app-exe PATH                 Steam shortcut executable path.
  --signing-verifier PATH        macOS package signing verifier.
  --overlay-profile NAME         Electron overlay profile. Defaults to compatibility.
  --native-host-backend NAME     macOS native presenter backend: metal or opengl.
  --timeout-seconds SECONDS      Per-case result timeout. Defaults to 120.
  --skip-package                 Do not run npm run example:package:mac first.
  --no-restart-steam             Do not restart Steam after changing shortcut options.
  --close-steam-after            Close Steam after the matrix finishes.
  --skip-summary                 Do not summarize collected artifacts after the matrix.
  --expected-native-host-unavailable-reason REASON
                                  Expected unavailable reason for --suite unavailable:
                                  macos-screen-locked or macos-display-asleep.
                                  Live runs auto-detect when omitted.
  --dry-run                      Print commands without running them.
  --help                         Show this help.

Suites:
  minimal  web/store/Friends/dialog openAndWait plus passive achievement toast.
  core     minimal plus passive unlock, synthetic checkout approval route,
           all managed shortcut targets, profile, community, stats,
           achievements, and user chat/profile routes.
  full     core plus all known high-level dialog-equivalent routes.
  unavailable
           managed web and checkout fail-fast cases for locked/asleep macOS.
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
    --suite)
      suite="${2:?missing --suite value}"
      shift 2
      ;;
    --app-id)
      app_id="${2:?missing --app-id value}"
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
    --shortcut-game-id)
      shortcut_game_id="${2:?missing --shortcut-game-id value}"
      shift 2
      ;;
    --shortcuts)
      shortcuts_path="${2:?missing --shortcuts value}"
      shift 2
      ;;
    --artifact-root)
      artifact_root="${2:?missing --artifact-root value}"
      shift 2
      ;;
    --launcher-env-file)
      launcher_env_file="${2:?missing --launcher-env-file value}"
      shift 2
      ;;
    --helper-path)
      helper_path="${2:?missing --helper-path value}"
      shift 2
      ;;
    --app-exe)
      app_exe="${2:?missing --app-exe value}"
      shift 2
      ;;
    --signing-verifier)
      signing_verifier="${2:?missing --signing-verifier value}"
      shift 2
      ;;
    --overlay-profile)
      overlay_profile="${2:?missing --overlay-profile value}"
      shift 2
      ;;
    --native-host-backend)
      native_host_backend="${2:?missing --native-host-backend value}"
      shift 2
      ;;
    --timeout-seconds)
      timeout_seconds="${2:?missing --timeout-seconds value}"
      shift 2
      ;;
    --skip-package)
      skip_package="1"
      shift
      ;;
    --no-restart-steam)
      restart_steam="0"
      shift
      ;;
    --close-steam-after)
      close_steam_after="1"
      shift
      ;;
    --skip-summary)
      skip_summary="1"
      shift
      ;;
    --expected-native-host-unavailable-reason)
      expected_native_host_unavailable_reason="${2:?missing --expected-native-host-unavailable-reason value}"
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
  steam-launch|self-test|summarize)
    ;;
  *)
    echo "Unknown --mode: $mode" >&2
    exit 2
    ;;
esac

case "$suite" in
  minimal|core|full|unavailable)
    ;;
  *)
    echo "Unknown --suite: $suite" >&2
    exit 2
    ;;
esac

case "$expected_native_host_unavailable_reason" in
  ""|macos-screen-locked|macos-display-asleep)
    ;;
  *)
    echo "Unknown --expected-native-host-unavailable-reason: $expected_native_host_unavailable_reason" >&2
    exit 2
    ;;
esac

quote_command() {
  printf '%q ' "$@"
  printf '\n'
}

require_contains() {
  local haystack="$1"
  local needle="$2"
  local message="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "Self-test failed: $message" >&2
    exit 1
  fi
}

require_not_contains() {
  local haystack="$1"
  local needle="$2"
  local message="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "Self-test failed: $message" >&2
    exit 1
  fi
}

count_cases() {
  grep -c '^CASE ' || true
}

require_unique_case_ids() {
  local output="$1"
  local suite_name="$2"
  local total unique
  total="$(printf '%s\n' "$output" | awk '/^CASE / { print $2 }' | wc -l | tr -d ' ')"
  unique="$(printf '%s\n' "$output" | awk '/^CASE / { print $2 }' | sort -u | wc -l | tr -d ' ')"
  if [ "$total" != "$unique" ]; then
    echo "Self-test failed: $suite_name matrix has duplicate case IDs." >&2
    exit 1
  fi
}

case_command() {
  local output="$1"
  local case_id="$2"
  printf '%s\n' "$output" | awk -v id="$case_id" '
    $0 == "CASE " id { found = 1; next }
    found && /^RUN / { sub(/^RUN /, ""); print; exit }
  '
}

run_self_test() {
  local self_path minimal_output core_output full_output unavailable_output passive_case checkout_case web_case unavailable_web_case unavailable_checkout_case
  self_path="${BASH_SOURCE[0]}"
  minimal_output="$(
    bash "$self_path" \
      --mode steam-launch \
      --suite minimal \
      --skip-package \
      --dry-run \
      --helper-path "$script_dir/macos-electron-smoke.sh" \
      --app-exe /tmp/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke \
      --shortcuts /tmp/shortcuts.vdf \
      --artifact-root /tmp/steam-bridge-macos-overlay-matrix-self-test
  )"
  core_output="$(
    bash "$self_path" \
      --mode steam-launch \
      --suite core \
      --skip-package \
      --dry-run \
      --helper-path "$script_dir/macos-electron-smoke.sh" \
      --app-exe /tmp/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke \
      --shortcuts /tmp/shortcuts.vdf \
      --artifact-root /tmp/steam-bridge-macos-overlay-matrix-self-test
  )"
  full_output="$(
    bash "$self_path" \
      --mode steam-launch \
      --suite full \
      --skip-package \
      --dry-run \
      --helper-path "$script_dir/macos-electron-smoke.sh" \
      --app-exe /tmp/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke \
      --shortcuts /tmp/shortcuts.vdf \
      --artifact-root /tmp/steam-bridge-macos-overlay-matrix-self-test
  )"
  unavailable_output="$(
    bash "$self_path" \
      --mode steam-launch \
      --suite unavailable \
      --skip-package \
      --dry-run \
      --helper-path "$script_dir/macos-electron-smoke.sh" \
      --app-exe /tmp/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke \
      --shortcuts /tmp/shortcuts.vdf \
      --artifact-root /tmp/steam-bridge-macos-overlay-matrix-self-test \
      --expected-native-host-unavailable-reason macos-screen-locked
  )"

  if [ "$(printf '%s\n' "$minimal_output" | count_cases)" != "5" ]; then
    echo "Self-test failed: minimal matrix case count changed." >&2
    exit 1
  fi
  if [ "$(printf '%s\n' "$core_output" | count_cases)" != "24" ]; then
    echo "Self-test failed: core matrix case count changed." >&2
    exit 1
  fi
  if [ "$(printf '%s\n' "$full_output" | count_cases)" != "31" ]; then
    echo "Self-test failed: full matrix case count changed." >&2
    exit 1
  fi
  if [ "$(printf '%s\n' "$unavailable_output" | count_cases)" != "2" ]; then
    echo "Self-test failed: unavailable matrix case count changed." >&2
    exit 1
  fi
  require_unique_case_ids "$minimal_output" "minimal"
  require_unique_case_ids "$core_output" "core"
  require_unique_case_ids "$full_output" "full"
  require_unique_case_ids "$unavailable_output" "unavailable"

  require_contains "$core_output" "--action presenter-web-open-and-wait" "core matrix must include web openAndWait."
  require_contains "$core_output" "--require-zero-managed-overlay-timing" "core matrix must require zero managed overlay timing."
  require_contains "$core_output" "--steam-bridge-launch-env-file=/tmp/steam-bridge-macos-smoke.env" "matrix shortcut must use the stable launcher env file."
  require_contains "$core_output" "ENV /tmp/steam-bridge-macos-smoke.env" "matrix must write per-case launcher env."
  require_contains "$core_output" "SIGNING node $script_dir/verify-macos-steam-signing.cjs --app-exe /tmp/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke" "matrix must verify macOS package signing before live cases."
  require_contains "$core_output" "--action presenter-store-open-and-wait" "core matrix must include store openAndWait."
  require_contains "$core_output" "--action presenter-friends-open-and-wait" "core matrix must include Friends openAndWait."
  require_contains "$core_output" "--action presenter-dialog-auto-open-and-wait" "core matrix must include dialog openAndWait."
  require_contains "$core_output" "--action presenter-achievement-progress" "core matrix must include passive toast."
  require_contains "$core_output" "--action presenter-achievement-unlock" "core matrix must include passive unlock toast."
  require_contains "$core_output" "--action presenter-checkout" "core matrix must include synthetic checkout."
  require_contains "$core_output" "--checkout-transaction-id 123456789" "core matrix must include checkout approval-route plumbing."
  require_contains "$core_output" "--action presenter-shortcut" "core matrix must include managed shortcut routing."
  require_contains "$core_output" "--shortcut-target friends" "core matrix must include Friends shortcut routing."
  require_contains "$core_output" "--shortcut-target web" "core matrix must include web shortcut routing."
  require_contains "$core_output" "--shortcut-target store" "core matrix must include store shortcut routing."
  require_contains "$core_output" "--shortcut-target checkout" "core matrix must include checkout shortcut routing."
  require_contains "$core_output" "--shortcut-target profile" "core matrix must include profile shortcut routing."
  require_contains "$core_output" "--shortcut-target players" "core matrix must include players shortcut routing."
  require_contains "$core_output" "--shortcut-target community" "core matrix must include community shortcut routing."
  require_contains "$core_output" "--shortcut-target stats" "core matrix must include stats shortcut routing."
  require_contains "$core_output" "--shortcut-target achievements" "core matrix must include achievements shortcut routing."
  require_contains "$core_output" "--shortcut-target user" "core matrix must include user shortcut routing."
  require_contains "$core_output" "--shortcut-target dialog" "core matrix must include dialog shortcut routing."
  require_contains "$core_output" "--action presenter-profile-open-and-wait" "core matrix must include profile openAndWait."
  require_contains "$core_output" "--action presenter-players-open-and-wait" "core matrix must include players openAndWait."
  require_contains "$core_output" "--action presenter-community-open-and-wait" "core matrix must include community openAndWait."
  require_contains "$core_output" "--action presenter-stats-open-and-wait" "core matrix must include stats openAndWait."
  require_contains "$core_output" "--action presenter-achievements-open-and-wait" "core matrix must include achievements openAndWait."
  require_contains "$core_output" "--action presenter-user-open-and-wait" "core matrix must include user openAndWait."
  require_contains "$core_output" "--shortcut-open-probe" "shortcut proof must open through the managed Shift+Tab bridge."
  require_contains "$core_output" "--close-input toggle" "shortcut proof must close with Shift+Tab."
  require_contains "$core_output" "--require-passive-notification" "passive toast cases must use the passive notification gate."
  require_contains "$core_output" "--close-probe" "interactive overlay cases must close and verify back-to-app behavior."
  require_contains "$full_output" "--dialog Friends" "full matrix must include Friends dialog equivalent."
  require_contains "$full_output" "--dialog Players" "full matrix must include Players dialog equivalent."
  require_contains "$full_output" "--dialog Community" "full matrix must include Community dialog equivalent."
  require_contains "$full_output" "--dialog Stats" "full matrix must include Stats dialog equivalent."
  require_contains "$full_output" "--dialog Achievements" "full matrix must include Achievements dialog equivalent."
  require_contains "$full_output" "--action presenter-dialog-auto-open-and-wait" "full matrix dialog equivalents must use openAndWait."
  require_contains "$unavailable_output" "--action presenter-web-open-and-wait" "unavailable matrix must include web openAndWait fail-fast."
  require_contains "$unavailable_output" "--action presenter-checkout" "unavailable matrix must include checkout fail-fast."
  require_contains "$unavailable_output" "--require-action-error-code STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE" "unavailable matrix must require the native-host-unavailable error code."
  require_contains "$unavailable_output" "--require-action-error-reason macos-screen-locked" "unavailable matrix must require the expected unavailable reason."
  require_contains "$unavailable_output" "--require-native-host-unavailable-reason macos-screen-locked" "unavailable matrix must require the presenter unavailable reason."
  require_contains "$unavailable_output" "--require-no-overlay-activation" "unavailable matrix must reject Steam overlay activation."

  web_case="$(case_command "$core_output" "01-web-openwait")"
  passive_case="$(case_command "$core_output" "05-passive-toast")"
  checkout_case="$(case_command "$core_output" "07-checkout-approval")"
  unavailable_web_case="$(case_command "$unavailable_output" "01-unavailable-web-openwait")"
  unavailable_checkout_case="$(case_command "$unavailable_output" "02-unavailable-checkout")"
  require_contains "$web_case" "--web-modal true" "web proof should use modal Steam web overlay."
  require_contains "$passive_case" "--result-delay-ms 1200" "passive toast should use the short notification capture delay."
  require_not_contains "$passive_case" "--close-probe" "passive toast should not require modal close proof."
  require_contains "$checkout_case" "--close-probe" "checkout proof should close and verify parked state."
  require_not_contains "$unavailable_web_case" "--close-probe" "unavailable web case must not require close proof."
  require_not_contains "$unavailable_checkout_case" "--close-probe" "unavailable checkout case must not require close proof."

  echo "macOS overlay matrix self-test passed."
}

if [ "$mode" = "self-test" ]; then
  run_self_test
  node "$summary_runner" --self-test
  exit 0
fi

if [ "$mode" = "summarize" ]; then
  node "$summary_runner" --artifact-root "$artifact_root"
  exit 0
fi

resolve_shortcuts_path() {
  if [ -n "$shortcuts_path" ]; then
    printf '%s\n' "$shortcuts_path"
    return 0
  fi
  if [ -n "$steam_user_id" ]; then
    printf '%s\n' "$HOME/Library/Application Support/Steam/userdata/$steam_user_id/config/shortcuts.vdf"
    return 0
  fi

  local shortcut_lines user_id
  shortcut_lines="$("$helper_path" --mode print-shortcuts --app-name "$app_name")"
  if [ -z "$shortcut_lines" ]; then
    echo "Could not discover a Steam shortcut named \"$app_name\"; pass --steam-user-id or --shortcuts." >&2
    exit 1
  fi
  user_id="$(printf '%s\n' "$shortcut_lines" | node -e '
const fs = require("node:fs");
const ids = new Set();
for (const line of fs.readFileSync(0, "utf8").split(/\n/)) {
  if (!line.trim()) continue;
  const parsed = JSON.parse(line);
  if (parsed.userId) ids.add(parsed.userId);
}
if (ids.size === 1) {
  console.log([...ids][0]);
}
')"
  if [ -z "$user_id" ]; then
    echo "Could not discover exactly one Steam userdata ID for \"$app_name\"; pass --steam-user-id or --shortcuts." >&2
    exit 1
  fi
  printf '%s\n' "$HOME/Library/Application Support/Steam/userdata/$user_id/config/shortcuts.vdf"
}

ensure_ready() {
  if [ "$skip_package" != "1" ]; then
    npm run example:package:mac
  fi
  if [ ! -x "$helper_path" ]; then
    echo "Missing executable helper: $helper_path" >&2
    exit 1
  fi
  if [ "$dry_run" != "1" ] && [ ! -x "$app_exe" ]; then
    echo "Missing app executable: $app_exe" >&2
    exit 1
  fi
  verify_macos_package_signing
  shortcuts_path="$(resolve_shortcuts_path)"
  mkdir -p "$artifact_root"
  : > "$artifact_root/macos-matrix-cases.jsonl"
  require_macos_overlay_environment_for_suite
  ensure_stable_shortcut
  if [ "$dry_run" != "1" ]; then
    cleanup_macos_smoke_processes
  fi
}

verify_macos_package_signing() {
  local verify_cmd
  verify_cmd=(node "$signing_verifier" --app-exe "$app_exe")
  echo "SIGNING $(quote_command "${verify_cmd[@]}")"
  if [ "$dry_run" = "1" ]; then
    return 0
  fi
  "${verify_cmd[@]}"
}

cleanup_macos_smoke_processes() {
  pkill -TERM -f '/SteamBridgeSmoke\.app/' 2>/dev/null || true
  pkill -TERM -x 'gameoverlayui' 2>/dev/null || true
  if ! wait_for_macos_smoke_processes_exit 8; then
    pkill -KILL -f '/SteamBridgeSmoke\.app/' 2>/dev/null || true
    pkill -KILL -x 'gameoverlayui' 2>/dev/null || true
    wait_for_macos_smoke_processes_exit 3 || true
  fi
}

macos_smoke_processes_running() {
  pgrep -f '/SteamBridgeSmoke\.app/' >/dev/null 2>&1 || pgrep -x 'gameoverlayui' >/dev/null 2>&1
}

wait_for_macos_smoke_processes_exit() {
  local timeout_seconds="$1"
  local deadline=$((SECONDS + timeout_seconds))
  while macos_smoke_processes_running; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      return 1
    fi
    sleep 0.25
  done
  return 0
}

macos_steam_running() {
  pgrep -f 'steam_osx|Steam Helper|Steam\.AppBundle|gameoverlayui' >/dev/null 2>&1
}

wait_for_macos_steam_exit() {
  local deadline
  deadline=$((SECONDS + ${1:?missing wait seconds}))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if ! macos_steam_running; then
      return 0
    fi
    sleep 0.2
  done
  ! macos_steam_running
}

stop_macos_steam() {
  local quit_pid deadline
  cleanup_macos_smoke_processes
  osascript -e 'tell application "Steam" to quit' >/dev/null 2>&1 &
  quit_pid="$!"
  deadline=$((SECONDS + 5))
  while kill -0 "$quit_pid" >/dev/null 2>&1 && [ "$SECONDS" -lt "$deadline" ]; do
    sleep 0.2
  done
  if kill -0 "$quit_pid" >/dev/null 2>&1; then
    kill "$quit_pid" >/dev/null 2>&1 || true
  fi
  wait "$quit_pid" >/dev/null 2>&1 || true
  if wait_for_macos_steam_exit 5; then
    return 0
  fi
  pkill -TERM -f 'steam_osx|Steam Helper|Steam\.AppBundle|gameoverlayui' 2>/dev/null || true
  if wait_for_macos_steam_exit 5; then
    return 0
  fi
  pkill -KILL -f 'steam_osx|Steam Helper|Steam\.AppBundle|gameoverlayui' 2>/dev/null || true
  if ! wait_for_macos_steam_exit 5; then
    echo "Failed to stop macOS Steam processes." >&2
    return 1
  fi
}

start_macos_steam() {
  local started_at deadline
  started_at="$(date '+%Y-%m-%d %H:%M:%S')"
  open -a Steam
  deadline=$((SECONDS + 30))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if pgrep -f 'steam_osx' >/dev/null 2>&1 && macos_steam_logged_on_since "$started_at"; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for Steam to start and log on." >&2
  return 1
}

macos_steam_logged_on_since() {
  local started_at="$1"
  local log_file="$HOME/Library/Application Support/Steam/logs/connection_log.txt"
  [ -f "$log_file" ] || return 1
  awk -v started_at="$started_at" '
    /^\[[0-9-]+ [0-9:]+\]/ {
      timestamp = substr($0, 2, 19)
    }
    timestamp >= started_at && /\[Logged On,/ {
      found = 1
    }
    END {
      exit found ? 0 : 1
    }
  ' "$log_file"
}

require_interactive_macos_overlay_environment() {
  if [ "$dry_run" = "1" ]; then
    return 0
  fi
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "macOS overlay matrix must run on macOS." >&2
    exit 1
  fi

  node - "$repo_root" <<'NODE'
const path = require("node:path");
const repoRoot = process.argv[2];

let environment;
try {
  const steamBridge = require(path.join(repoRoot, "packages", "steam-bridge"));
  environment = steamBridge.getMacOverlayEnvironment?.();
} catch (error) {
  console.error(`Failed to read macOS overlay environment: ${error && error.message ? error.message : error}`);
  process.exit(1);
}

console.log(`MACOS_OVERLAY_ENVIRONMENT ${JSON.stringify(environment ?? null)}`);

if (!environment || typeof environment !== "object") {
  console.error("macOS overlay environment is unavailable; cannot run a success overlay matrix.");
  process.exit(1);
}

if (environment.screenLocked || environment.displayAsleep) {
  const reason = environment.screenLocked ? "macos-screen-locked" : "macos-display-asleep";
  console.error(
    `macOS overlay success matrix requires an interactive display; current environment is ${reason}. ` +
      "Unlock/wake the Mac before running the success matrix, or capture this state with the expected native-host-unavailable verifier flags."
  );
  process.exit(1);
}
NODE
}

read_macos_overlay_unavailable_reason() {
  if [ "$dry_run" = "1" ]; then
    if [ -z "$expected_native_host_unavailable_reason" ]; then
      expected_native_host_unavailable_reason="macos-screen-locked"
    fi
    return 0
  fi
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "macOS unavailable overlay matrix must run on macOS." >&2
    exit 1
  fi

  expected_native_host_unavailable_reason="$(
    node - "$repo_root" "$expected_native_host_unavailable_reason" <<'NODE'
const path = require("node:path");
const repoRoot = process.argv[2];
const expected = process.argv[3] || "";

let environment;
try {
  const steamBridge = require(path.join(repoRoot, "packages", "steam-bridge"));
  environment = steamBridge.getMacOverlayEnvironment?.();
} catch (error) {
  console.error(`Failed to read macOS overlay environment: ${error && error.message ? error.message : error}`);
  process.exit(1);
}

console.error(`MACOS_OVERLAY_ENVIRONMENT ${JSON.stringify(environment ?? null)}`);

if (!environment || typeof environment !== "object") {
  console.error("macOS overlay environment is unavailable; cannot run an expected native-host-unavailable matrix.");
  process.exit(1);
}

let reason = "";
if (environment.screenLocked) {
  reason = "macos-screen-locked";
} else if (environment.displayAsleep) {
  reason = "macos-display-asleep";
}

if (!reason) {
  console.error(
    "macOS unavailable matrix requires the screen to be locked or the display to be asleep. " +
      "Run a success matrix while interactive."
  );
  process.exit(1);
}

if (expected && expected !== reason) {
  console.error(`macOS unavailable matrix expected ${expected}, but current environment is ${reason}.`);
  process.exit(1);
}

console.log(reason);
NODE
  )"
}

require_macos_overlay_environment_for_suite() {
  if [ "$suite" = "unavailable" ]; then
    read_macos_overlay_unavailable_reason
    return 0
  fi

  require_interactive_macos_overlay_environment
}

restart_macos_steam() {
  if [ "$restart_steam" != "1" ]; then
    return 0
  fi
  stop_macos_steam
  start_macos_steam
}

ensure_stable_shortcut() {
  local launch_options start_dir upsert_cmd upsert_output

  launch_options="$(
    "$helper_path" \
      --mode print-launch-options \
      --macos-native-launcher \
      --launcher-env-file "$launcher_env_file" \
      --app-id "$app_id" |
      sed -n '2p'
  )"
  start_dir="$(dirname -- "$app_exe")"
  upsert_cmd=(
    node "$script_dir/upsert-steam-shortcut.cjs"
    --shortcuts "$shortcuts_path"
    --backup "$artifact_root/shortcuts-stable.vdf.bak"
    --app-name "$app_name"
    --exe "$app_exe"
    --start-dir "$start_dir"
    --launch-options "$launch_options"
  )

  echo "SHORTCUT $(quote_command "${upsert_cmd[@]}")"
  if [ "$dry_run" = "1" ]; then
    return 0
  fi

  upsert_output="$("${upsert_cmd[@]}")"
  printf '%s\n' "$upsert_output"
  if [[ "$upsert_output" != *"already up to date"* ]]; then
    restart_macos_steam
  fi
}

write_case_manifest() {
  local case_id="$1"
  local result_file="$2"
  local diagnostic_dir="$3"
  shift 3
  node - "$artifact_root/macos-matrix-cases.jsonl" "$case_id" "$result_file" "$diagnostic_dir" "$@" <<'NODE'
const fs = require("node:fs");
const [manifestPath, caseId, resultFile, diagnosticDir, ...command] = process.argv.slice(2);

function optionValue(name) {
  const index = command.indexOf(name);
  if (index === -1) {
    return null;
  }
  return command[index + 1] ?? "";
}

fs.appendFileSync(
  manifestPath,
  `${JSON.stringify({
    caseId,
    resultFile,
    diagnosticDir,
    command,
    action: optionValue("--action"),
    closeProbe: command.includes("--close-probe"),
    shortcutOpenProbe: command.includes("--shortcut-open-probe"),
    shortcutTarget: optionValue("--shortcut-target"),
    requireActionErrorCode: optionValue("--require-action-error-code"),
    requireActionErrorReason: optionValue("--require-action-error-reason"),
    requireNativeHostUnavailableReason: optionValue("--require-native-host-unavailable-reason"),
    requireNoOverlayActivation: command.includes("--require-no-overlay-activation")
  })}\n`
);
NODE
}

write_env_line() {
  local key="$1"
  local value="$2"
  printf '%s=%s\n' "$key" "$value" >> "$launcher_env_file"
}

write_case_launcher_env() {
  local result_file="$1"
  local diagnostic_dir="$2"
  shift 2

  local env_action="none"
  local env_result_delay="8000"
  local env_keep_open="0"
  local env_require_active="0"
  local env_window_mode=""
  local env_web_url=""
  local env_web_modal=""
  local env_checkout_url=""
  local env_checkout_transaction_id=""
  local env_checkout_return_url=""
  local env_overlay_dialog=""
  local env_user_dialog=""
  local env_shortcut_target=""
  local env_presenter_mode=""
  local env_achievement_name=""
  local env_achievement_current=""
  local env_achievement_max=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --action)
        env_action="${2:?missing --action value}"
        shift 2
        ;;
      --result-delay-ms)
        env_result_delay="${2:?missing --result-delay-ms value}"
        shift 2
        ;;
      --keep-open-after-result|--close-probe)
        env_keep_open="1"
        shift
        ;;
      --require-overlay-activated)
        env_require_active="1"
        shift
        ;;
      --window-mode)
        env_window_mode="${2:?missing --window-mode value}"
        shift 2
        ;;
      --web-url)
        env_web_url="${2:?missing --web-url value}"
        shift 2
        ;;
      --web-modal)
        env_web_modal="${2:?missing --web-modal value}"
        shift 2
        ;;
      --checkout-url)
        env_checkout_url="${2:?missing --checkout-url value}"
        shift 2
        ;;
      --checkout-transaction-id)
        env_checkout_transaction_id="${2:?missing --checkout-transaction-id value}"
        shift 2
        ;;
      --checkout-return-url)
        env_checkout_return_url="${2:?missing --checkout-return-url value}"
        shift 2
        ;;
      --dialog)
        env_overlay_dialog="${2:?missing --dialog value}"
        shift 2
        ;;
      --user-dialog)
        env_user_dialog="${2:?missing --user-dialog value}"
        shift 2
        ;;
      --shortcut-target)
        env_shortcut_target="${2:?missing --shortcut-target value}"
        shift 2
        ;;
      --presenter-mode)
        env_presenter_mode="${2:?missing --presenter-mode value}"
        shift 2
        ;;
      --achievement-name)
        env_achievement_name="${2:?missing --achievement-name value}"
        shift 2
        ;;
      --achievement-current)
        env_achievement_current="${2:?missing --achievement-current value}"
        shift 2
        ;;
      --achievement-max)
        env_achievement_max="${2:?missing --achievement-max value}"
        shift 2
        ;;
      --require-event)
        shift 2
        ;;
      --require-*)
        shift
        ;;
      --shortcut-open-probe)
        env_keep_open="1"
        shift
        ;;
      *)
        shift
        ;;
    esac
  done

  if [ "$dry_run" = "1" ]; then
    return 0
  fi

  mkdir -p "$(dirname -- "$launcher_env_file")"
  : > "$launcher_env_file"
  write_env_line "SteamAppId" "$app_id"
  write_env_line "SteamGameId" "$app_id"
  write_env_line "SteamOverlayGameId" "$app_id"
  write_env_line "STEAM_BRIDGE_APP_ID" "$app_id"
  write_env_line "STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE" "$overlay_profile"
  write_env_line "STEAM_BRIDGE_SMOKE_AUTORUN" "1"
  write_env_line "STEAM_BRIDGE_SMOKE_AUTORUN_ACTION" "$env_action"
  write_env_line "STEAM_BRIDGE_SMOKE_AUTORUN_RESULT_DELAY_MS" "$env_result_delay"
  write_env_line "STEAM_BRIDGE_SMOKE_KEEP_OPEN_AFTER_RESULT" "$env_keep_open"
  write_env_line "STEAM_BRIDGE_SMOKE_REQUIRE_OVERLAY_ACTIVE" "$env_require_active"
  write_env_line "STEAM_BRIDGE_SMOKE_RESULT_FILE" "$result_file"
  write_env_line "STEAM_BRIDGE_SMOKE_DIAGNOSTIC_DIR" "$diagnostic_dir"
  if [ -n "$native_host_backend" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_NATIVE_HOST_BACKEND" "$native_host_backend"
  fi
  if [ -n "$env_window_mode" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_WINDOW_MODE" "$env_window_mode"
  fi
  if [ -n "$env_web_url" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_WEB_URL" "$env_web_url"
  fi
  if [ -n "$env_web_modal" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_WEB_MODAL" "$env_web_modal"
  fi
  if [ -n "$env_checkout_url" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_CHECKOUT_URL" "$env_checkout_url"
  fi
  if [ -n "$env_checkout_transaction_id" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_CHECKOUT_TRANSACTION_ID" "$env_checkout_transaction_id"
  fi
  if [ -n "$env_checkout_return_url" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_CHECKOUT_RETURN_URL" "$env_checkout_return_url"
  fi
  if [ -n "$env_overlay_dialog" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_OVERLAY_DIALOG" "$env_overlay_dialog"
  fi
  if [ -n "$env_user_dialog" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_USER_DIALOG" "$env_user_dialog"
  fi
  if [ -n "$env_shortcut_target" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_SHORTCUT_TARGET" "$env_shortcut_target"
  fi
  if [ -n "$env_presenter_mode" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_PRESENTER_MODE" "$env_presenter_mode"
    write_env_line "STEAM_BRIDGE_ELECTRON_OVERLAY_PRESENTER" "$env_presenter_mode"
  fi
  if [ -n "$env_achievement_name" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_ACHIEVEMENT_NAME" "$env_achievement_name"
  fi
  if [ -n "$env_achievement_current" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_ACHIEVEMENT_CURRENT" "$env_achievement_current"
  fi
  if [ -n "$env_achievement_max" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_ACHIEVEMENT_MAX" "$env_achievement_max"
  fi
}

run_case() {
  local case_id="$1"
  shift
  local result_file="$artifact_root/$case_id.log"
  local diagnostic_dir="$result_file.diagnostics"
  local run_cmd
  local case_args=("$@")
  if case_uses_presenter_action "${case_args[@]}" && ! case_has_managed_timing_requirement "${case_args[@]}"; then
    case_args+=(--require-zero-managed-overlay-timing)
  fi
  run_cmd=(
    "$helper_path"
    --mode steam-launch
    --app-id "$app_id"
    --app-name "$app_name"
    --shortcut-game-id "$shortcut_game_id"
    --result-file "$result_file"
    --diagnostic-dir "$diagnostic_dir"
    --timeout-seconds "$timeout_seconds"
  )
  if [ -n "$steam_user_id" ]; then
    run_cmd+=(--steam-user-id "$steam_user_id")
  fi
  run_cmd+=("${case_args[@]}")

  echo "CASE $case_id"
  echo "ENV $launcher_env_file"
  echo "RUN $(quote_command "${run_cmd[@]}")"

  if [ "$dry_run" = "1" ]; then
    return 0
  fi

  mkdir -p "$(dirname -- "$result_file")"
  write_case_manifest "$case_id" "$result_file" "$diagnostic_dir" "${case_args[@]}"
  write_case_launcher_env "$result_file" "$diagnostic_dir" "${case_args[@]}"
  "${run_cmd[@]}"
  cleanup_macos_smoke_processes
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

run_matrix() {
  if [ "$suite" = "unavailable" ]; then
    run_unavailable_matrix
    return 0
  fi

  run_case "01-web-openwait" \
    --action presenter-web-open-and-wait \
    --web-url "https://store.steampowered.com/app/$app_id/" \
    --web-modal true \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open-and-wait-start \
    --require-no-crashes \
    --close-probe

  run_case "02-store-openwait" \
    --action presenter-store-open-and-wait \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open-and-wait-start \
    --require-no-crashes \
    --close-probe

  run_case "03-friends-openwait" \
    --action presenter-friends-open-and-wait \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open-and-wait-start \
    --require-no-crashes \
    --close-probe

  run_case "04-dialog-official-openwait" \
    --action presenter-dialog-auto-open-and-wait \
    --dialog OfficialGameGroup \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open-and-wait-start \
    --require-no-crashes \
    --close-probe

  run_case "05-passive-toast" \
    --action presenter-achievement-progress \
    --result-delay-ms 1200 \
    --keep-open-after-result \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-passive-notification \
    --require-no-crashes

  if [ "$suite" = "minimal" ]; then
    return 0
  fi

  run_case "06-passive-unlock-toast" \
    --action presenter-achievement-unlock \
    --result-delay-ms 1200 \
    --keep-open-after-result \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-passive-notification \
    --require-no-crashes

  run_case "07-checkout-approval" \
    --action presenter-checkout \
    --checkout-transaction-id 123456789 \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open \
    --require-no-crashes \
    --close-probe

  run_shortcut_case() {
    local case_id="$1"
    local target="$2"
    shift 2
    run_case "$case_id" \
      --action presenter-shortcut \
      --shortcut-target "$target" \
      --require-steam-launch \
      --require-overlay-injection \
      --require-overlay-enabled \
      --require-electron-overlay \
      --require-overlay-shortcut-target "$target" \
      --require-event overlay:presenter-shortcut-ready \
      --require-no-crashes \
      --shortcut-open-probe \
      --close-probe \
      --close-input toggle \
      "$@"
  }

  run_shortcut_case "08-shortcut-friends" friends

  run_shortcut_case "09-shortcut-web" web \
    --web-url "https://store.steampowered.com/app/$app_id/" \
    --web-modal true

  run_shortcut_case "10-shortcut-store" store

  run_shortcut_case "11-shortcut-checkout" checkout \
    --checkout-transaction-id 123456789

  run_shortcut_case "12-shortcut-profile" profile

  run_shortcut_case "13-shortcut-players" players

  run_shortcut_case "14-shortcut-community" community

  run_shortcut_case "15-shortcut-stats" stats

  run_shortcut_case "16-shortcut-achievements" achievements

  run_shortcut_case "17-shortcut-user-chat" user \
    --user-dialog chat

  run_shortcut_case "18-shortcut-dialog" dialog \
    --dialog OfficialGameGroup

  run_case "19-profile" \
    --action presenter-profile-open-and-wait \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open-and-wait-start \
    --require-no-crashes \
    --close-probe

  run_case "20-players" \
    --action presenter-players-open-and-wait \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open-and-wait-start \
    --require-no-crashes \
    --close-probe

  run_case "21-community" \
    --action presenter-community-open-and-wait \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open-and-wait-start \
    --require-no-crashes \
    --close-probe

  run_case "22-stats" \
    --action presenter-stats-open-and-wait \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open-and-wait-start \
    --require-no-crashes \
    --close-probe

  run_case "23-achievements" \
    --action presenter-achievements-open-and-wait \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open-and-wait-start \
    --require-no-crashes \
    --close-probe

  run_case "24-user-chat" \
    --action presenter-user-open-and-wait \
    --user-dialog chat \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open-and-wait-start \
    --require-no-crashes \
    --close-probe

  if [ "$suite" = "core" ]; then
    return 0
  fi

  run_case "25-user-steamid" \
    --action presenter-user-open-and-wait \
    --user-dialog steamid \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-overlay-activated \
    --require-event overlay:presenter-open-and-wait-start \
    --require-no-crashes \
    --close-probe

  local dialog_index=26
  for dialog in Friends Players Community OfficialGameGroup Stats Achievements; do
    run_case "$(printf '%02d-dialog-%s' "$dialog_index" "$dialog")" \
      --action presenter-dialog-auto-open-and-wait \
      --dialog "$dialog" \
      --require-steam-launch \
      --require-overlay-injection \
      --require-overlay-enabled \
      --require-overlay-activated \
      --require-event overlay:presenter-open-and-wait-start \
      --require-no-crashes \
      --close-probe
    dialog_index=$((dialog_index + 1))
  done
}

run_unavailable_matrix() {
  local reason
  reason="${expected_native_host_unavailable_reason:?missing expected native host unavailable reason}"

  run_case "01-unavailable-web-openwait" \
    --action presenter-web-open-and-wait \
    --web-url "https://store.steampowered.com/app/$app_id/" \
    --web-modal true \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-action-error-code STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE \
    --require-action-error-reason "$reason" \
    --require-native-host-unavailable-reason "$reason" \
    --require-no-overlay-activation \
    --require-no-crashes

  run_case "02-unavailable-checkout" \
    --action presenter-checkout \
    --checkout-transaction-id 123456789 \
    --require-steam-launch \
    --require-overlay-injection \
    --require-overlay-enabled \
    --require-action-error-code STEAM_OVERLAY_NATIVE_HOST_UNAVAILABLE \
    --require-action-error-reason "$reason" \
    --require-native-host-unavailable-reason "$reason" \
    --require-no-overlay-activation \
    --require-no-crashes
}

ensure_ready
trap 'if [ "$close_steam_after" = "1" ] && [ "$dry_run" != "1" ]; then stop_macos_steam; fi' EXIT
run_matrix

echo "macOS overlay matrix complete. Artifacts: $artifact_root"

if [ "$dry_run" != "1" ] && [ "$skip_summary" != "1" ]; then
  echo
  node "$summary_runner" --artifact-root "$artifact_root"
fi
