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
checkout_json_file=""
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
  --suite minimal|core|full|persistent|unavailable
                                  Matrix size. Defaults to core. "unavailable"
                                  captures expected macOS lock/asleep fail-fast
                                  artifacts instead of success overlay cases.
                                  "persistent" launches one Steam-owned smoke
                                  process and drives several actions through
                                  the localhost control server.
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
  --checkout-json-file PATH      Private InitTxn/checkout response JSON for checkout cases.
                                  The Steam shortcut only receives the stable launcher env-file flag;
                                  matrix manifests record this as source=json-file without the path.
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
  persistent
           one Steam launch, then web/store/Friends/dialog openAndWait plus
           passive achievement toast through the smoke control server.
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
    --checkout-json-file)
      checkout_json_file="${2:?missing --checkout-json-file value}"
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
  minimal|core|full|persistent|unavailable)
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

case "$native_host_backend" in
  ""|metal|opengl)
    ;;
  *)
    echo "Unknown --native-host-backend: $native_host_backend" >&2
    exit 2
    ;;
esac

quote_command() {
  printf '%q ' "$@"
  printf '\n'
}

generate_control_token() {
  node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))'
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
  local self_path minimal_output core_output full_output persistent_output unavailable_output opengl_output checkout_json_output passive_case checkout_case checkout_json_case shortcut_checkout_json_case web_case persistent_web_case unavailable_web_case unavailable_checkout_case
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
  persistent_output="$(
    bash "$self_path" \
      --mode steam-launch \
      --suite persistent \
      --skip-package \
      --dry-run \
      --helper-path "$script_dir/macos-electron-smoke.sh" \
      --app-exe /tmp/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke \
      --shortcuts /tmp/shortcuts.vdf \
      --artifact-root /tmp/steam-bridge-macos-overlay-matrix-self-test
  )"
  opengl_output="$(
    bash "$self_path" \
      --mode steam-launch \
      --suite minimal \
      --skip-package \
      --dry-run \
      --helper-path "$script_dir/macos-electron-smoke.sh" \
      --app-exe /tmp/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke \
      --shortcuts /tmp/shortcuts.vdf \
      --artifact-root /tmp/steam-bridge-macos-overlay-matrix-self-test \
      --native-host-backend opengl
  )"
  checkout_json_output="$(
    bash "$self_path" \
      --mode steam-launch \
      --suite core \
      --skip-package \
      --dry-run \
      --helper-path "$script_dir/macos-electron-smoke.sh" \
      --app-exe /tmp/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke \
      --shortcuts /tmp/shortcuts.vdf \
      --artifact-root /tmp/steam-bridge-macos-overlay-matrix-self-test \
      --app-id 9000 \
      --checkout-json-file /tmp/private-init-txn-response.json
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
  if [ "$(printf '%s\n' "$persistent_output" | count_cases)" != "5" ]; then
    echo "Self-test failed: persistent matrix case count changed." >&2
    exit 1
  fi
  if [ "$(printf '%s\n' "$unavailable_output" | count_cases)" != "2" ]; then
    echo "Self-test failed: unavailable matrix case count changed." >&2
    exit 1
  fi
  require_unique_case_ids "$minimal_output" "minimal"
  require_unique_case_ids "$core_output" "core"
  require_unique_case_ids "$full_output" "full"
  require_unique_case_ids "$persistent_output" "persistent"
  require_unique_case_ids "$unavailable_output" "unavailable"

  require_contains "$core_output" "--action presenter-web-open-and-wait" "core matrix must include web openAndWait."
  require_contains "$core_output" "--require-zero-managed-overlay-timing" "core matrix must require zero managed overlay timing."
  require_contains "$core_output" "--steam-bridge-launch-env-file=/tmp/steam-bridge-macos-smoke.env" "matrix shortcut must use the stable launcher env file."
  require_contains "$core_output" "ENV /tmp/steam-bridge-macos-smoke.env" "matrix must write per-case launcher env."
  require_contains "$core_output" "SIGNING node $script_dir/verify-macos-steam-signing.cjs --app-exe /tmp/SteamBridgeSmoke.app/Contents/MacOS/SteamBridgeSmoke" "matrix must verify macOS package signing before live cases."
  require_contains "$opengl_output" "NATIVE_HOST_BACKEND opengl" "matrix must pass requested native host backend through the launcher env."
  require_contains "$checkout_json_output" "--app-id 9000" "matrix must pass the requested private proof app ID through helper commands."
  require_contains "$checkout_json_output" "--checkout-json-file /tmp/private-init-txn-response.json" "matrix must pass private checkout JSON into checkout cases."
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
  require_contains "$persistent_output" "--control-server" "persistent matrix must launch the smoke control server."
  require_contains "$persistent_output" "--mode control-action" "persistent matrix must drive actions through the control client."
  require_contains "$persistent_output" "CONTROL /tmp/steam-bridge-macos-overlay-matrix-self-test/persistent-control.json" "persistent matrix must use an artifact-scoped control file."
  require_contains "$persistent_output" "--action presenter-web-open-and-wait" "persistent matrix must include web openAndWait."
  require_contains "$persistent_output" "--action presenter-store-open-and-wait" "persistent matrix must include store openAndWait."
  require_contains "$persistent_output" "--action presenter-friends-open-and-wait" "persistent matrix must include Friends openAndWait."
  require_contains "$persistent_output" "--action presenter-dialog-auto-open-and-wait" "persistent matrix must include dialog openAndWait."
  require_contains "$persistent_output" "--action presenter-achievement-progress" "persistent matrix must include passive toast."
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
  checkout_json_case="$(case_command "$checkout_json_output" "07-checkout-approval")"
  shortcut_checkout_json_case="$(case_command "$checkout_json_output" "11-shortcut-checkout")"
  persistent_web_case="$(case_command "$persistent_output" "01-persistent-web-openwait")"
  unavailable_web_case="$(case_command "$unavailable_output" "01-unavailable-web-openwait")"
  unavailable_checkout_case="$(case_command "$unavailable_output" "02-unavailable-checkout")"
  require_contains "$web_case" "--web-modal true" "web proof should use modal Steam web overlay."
  require_contains "$passive_case" "--result-delay-ms 1200" "passive toast should use the short notification capture delay."
  require_not_contains "$passive_case" "--close-probe" "passive toast should not require modal close proof."
  require_contains "$checkout_case" "--close-probe" "checkout proof should close and verify parked state."
  require_contains "$checkout_json_case" "--checkout-json-file /tmp/private-init-txn-response.json" "private checkout proof should use the JSON-file handoff."
  require_contains "$shortcut_checkout_json_case" "--checkout-json-file /tmp/private-init-txn-response.json" "checkout shortcut proof should use the JSON-file handoff."
  require_not_contains "$checkout_json_case" "--checkout-transaction-id 123456789" "private checkout proof should not also use the synthetic transaction ID."
  require_not_contains "$shortcut_checkout_json_case" "--checkout-transaction-id 123456789" "checkout shortcut proof should not also use the synthetic transaction ID."
  require_contains "$persistent_web_case" "--close-probe" "persistent web proof should close and verify parked state."
  require_contains "$persistent_web_case" "--require-zero-managed-overlay-timing" "persistent web proof should require zero managed overlay timing."
  require_not_contains "$unavailable_web_case" "--close-probe" "unavailable web case must not require close proof."
  require_not_contains "$unavailable_checkout_case" "--close-probe" "unavailable checkout case must not require close proof."
  require_not_contains "$unavailable_web_case" "--require-overlay-enabled" "unavailable web case must not require overlay readiness while macOS is unavailable."
  require_not_contains "$unavailable_checkout_case" "--require-overlay-enabled" "unavailable checkout case must not require overlay readiness while macOS is unavailable."

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
  if ! wait_for_macos_smoke_processes_exit 8; then
    pkill -TERM -x 'gameoverlayui' 2>/dev/null || true
  fi
  if ! wait_for_macos_smoke_processes_exit 3; then
    pkill -KILL -f '/SteamBridgeSmoke\.app/' 2>/dev/null || true
    pkill -KILL -x 'gameoverlayui' 2>/dev/null || true
    wait_for_macos_smoke_processes_exit 3 || true
  fi
}

macos_steam_gameprocess_log() {
  printf '%s\n' "$HOME/Library/Application Support/Steam/logs/gameprocess_log.txt"
}

macos_steam_log_size() {
  local log_file="$1"
  if [ ! -f "$log_file" ]; then
    printf '0\n'
    return 0
  fi
  stat -f '%z' "$log_file"
}

read_smoke_result_pid() {
  local result_file="$1"
  RESULT_FILE="$result_file" node <<'NODE'
const fs = require("node:fs");
const resultFile = process.env.RESULT_FILE;
const prefix = "STEAM_BRIDGE_SMOKE_RESULT ";

if (!resultFile || !fs.existsSync(resultFile)) {
  process.exit(0);
}

const lines = fs.readFileSync(resultFile, "utf8").split(/\r?\n/).reverse();
for (const line of lines) {
  if (!line.startsWith(prefix)) {
    continue;
  }
  try {
    const parsed = JSON.parse(line.slice(prefix.length));
    const pid = parsed?.snapshot?.process?.pid;
    if (Number.isInteger(pid) && pid > 0) {
      console.log(pid);
    }
  } catch {}
  break;
}
NODE
}

wait_for_macos_steam_app_pid_untracked() {
  local pid="$1"
  local start_offset="$2"
  local timeout_seconds="$3"
  local log_file current_size tail_start pattern deadline
  if [ -z "$pid" ] || [ "$dry_run" = "1" ]; then
    return 0
  fi

  log_file="$(macos_steam_gameprocess_log)"
  pattern="AppID $app_id no longer tracking PID $pid"
  deadline=$((SECONDS + timeout_seconds))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ -f "$log_file" ]; then
      current_size="$(macos_steam_log_size "$log_file")"
      tail_start=$((start_offset + 1))
      if [ "$current_size" -lt "$start_offset" ]; then
        tail_start=1
      fi
      if tail -c +"$tail_start" "$log_file" 2>/dev/null | grep -Fq "$pattern"; then
        return 0
      fi
    fi
    sleep 0.25
  done

  echo "Timed out waiting for Steam to stop tracking AppID $app_id PID $pid in $log_file." >&2
  return 1
}

wait_for_macos_steam_app_removed_from_running_list() {
  local start_offset="$1"
  local timeout_seconds="$2"
  local log_file current_size tail_start pattern deadline
  if [ "$dry_run" = "1" ]; then
    return 0
  fi

  log_file="$(macos_steam_gameprocess_log)"
  pattern="Remove $app_id from running list"
  deadline=$((SECONDS + timeout_seconds))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ -f "$log_file" ]; then
      current_size="$(macos_steam_log_size "$log_file")"
      tail_start=$((start_offset + 1))
      if [ "$current_size" -lt "$start_offset" ]; then
        tail_start=1
      fi
      if tail -c +"$tail_start" "$log_file" 2>/dev/null | grep -Fq "$pattern"; then
        return 0
      fi
    fi
    sleep 0.25
  done

  echo "Timed out waiting for Steam to remove AppID $app_id from the running list in $log_file." >&2
  return 1
}

should_retry_macos_overlay_readiness_failure() {
  local result_file="$1"
  RESULT_FILE="$result_file" node <<'NODE'
const fs = require("node:fs");
const resultFile = process.env.RESULT_FILE;
const prefix = "STEAM_BRIDGE_SMOKE_RESULT ";

if (!resultFile || !fs.existsSync(resultFile)) {
  process.exit(1);
}

const line = fs.readFileSync(resultFile, "utf8")
  .split(/\r?\n/)
  .reverse()
  .find((entry) => entry.startsWith(prefix));

if (!line) {
  process.exit(1);
}

let result;
try {
  result = JSON.parse(line.slice(prefix.length));
} catch {
  process.exit(1);
}

const events = Array.isArray(result?.snapshot?.events) ? result.snapshot.events : [];
const readyTimeout = events.some((event) =>
  event?.type === "overlay:presenter-open-and-wait:error" &&
  event?.payload?.error?.code === "STEAM_OVERLAY_WAIT_TIMEOUT" &&
  event?.payload?.error?.state === "be ready"
);
const overlayEnabled = result?.snapshot?.steam?.overlayEnabled?.value;
const steamLaunch = result?.snapshot?.launch?.steamLaunch === true;
const overlayInjection = result?.snapshot?.launch?.overlayInjection === true;
const crashOk = result?.snapshot?.crashDiagnostics?.ok !== false;
const macEnvironment = result?.snapshot?.overlay?.nativePresenter?.value?.macOverlayEnvironment;
const macInteractive = !macEnvironment || (!macEnvironment.screenLocked && !macEnvironment.displayAsleep);

if (
  result?.ok === false &&
  result?.action?.ok === true &&
  readyTimeout &&
  overlayEnabled === false &&
  steamLaunch &&
  overlayInjection &&
  crashOk &&
  macInteractive
) {
  process.exit(0);
}

process.exit(1);
NODE
}

preserve_macos_retry_artifacts() {
  local result_file="$1"
  local diagnostic_dir="$2"
  local attempt="$3"
  local attempt_result_file attempt_diagnostic_dir
  if [[ "$result_file" == *.log ]]; then
    attempt_result_file="${result_file%.log}.attempt$attempt.log"
  else
    attempt_result_file="$result_file.attempt$attempt"
  fi
  attempt_diagnostic_dir="$attempt_result_file.diagnostics"

  rm -f "$attempt_result_file"
  rm -rf "$attempt_diagnostic_dir"
  if [ -f "$result_file" ]; then
    mv "$result_file" "$attempt_result_file"
  fi
  if [ -d "$diagnostic_dir" ]; then
    mv "$diagnostic_dir" "$attempt_diagnostic_dir"
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
  EXPECTED_NATIVE_HOST_BACKEND="$native_host_backend" EXPECTED_APP_ID="$app_id" node - "$artifact_root/macos-matrix-cases.jsonl" "$case_id" "$result_file" "$diagnostic_dir" "$@" <<'NODE'
const fs = require("node:fs");
const [manifestPath, caseId, resultFile, diagnosticDir, ...command] = process.argv.slice(2);
const requestedNativeHostBackend = process.env.EXPECTED_NATIVE_HOST_BACKEND || "";
const expectedNativeHostBackend = requestedNativeHostBackend ? `macos-${requestedNativeHostBackend}` : null;
const expectedAppId = Number(process.env.EXPECTED_APP_ID || "480");

function optionValue(name) {
  const index = command.indexOf(name);
  if (index === -1) {
    return null;
  }
  return command[index + 1] ?? "";
}

function redactCommand(args) {
  const sensitiveOptions = new Set([
    "--checkout-json-file",
    "--checkout-return-url",
    "--checkout-transaction-id",
    "--checkout-url"
  ]);
  const redacted = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const equalsIndex = typeof arg === "string" ? arg.indexOf("=") : -1;
    const optionName = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    if (sensitiveOptions.has(optionName)) {
      if (equalsIndex === -1) {
        redacted.push(arg);
        if (index + 1 < args.length) {
          redacted.push("<redacted>");
          index += 1;
        }
      } else {
        redacted.push(`${optionName}=<redacted>`);
      }
    } else {
      redacted.push(arg);
    }
  }
  return redacted;
}

fs.appendFileSync(
  manifestPath,
  `${JSON.stringify({
    caseId,
    resultFile,
    diagnosticDir,
    command: redactCommand(command),
    expectedAppId,
    action: optionValue("--action"),
    closeProbe: command.includes("--close-probe"),
    shortcutOpenProbe: command.includes("--shortcut-open-probe"),
    shortcutTarget: optionValue("--shortcut-target"),
    checkoutSource: command.includes("--checkout-json-file")
      ? "json-file"
      : command.includes("--checkout-url")
        ? "checkout-url"
        : command.includes("--checkout-transaction-id")
          ? "transaction-id"
          : null,
    expectedNativeHostBackend,
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
  local env_checkout_json_file=""
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
      --checkout-json-file)
        env_checkout_json_file="${2:?missing --checkout-json-file value}"
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
    if [ "$native_host_backend" = "opengl" ]; then
      write_env_line "STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT" "1"
    fi
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
  if [ -n "$env_checkout_json_file" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE" "$env_checkout_json_file"
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

write_control_launcher_env() {
  local result_file="$1"
  local diagnostic_dir="$2"
  local control_file="$3"
  local control_token="$4"

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
  write_env_line "STEAM_BRIDGE_SMOKE_CONTROL_SERVER" "1"
  write_env_line "STEAM_BRIDGE_SMOKE_CONTROL_FILE" "$control_file"
  write_env_line "STEAM_BRIDGE_SMOKE_CONTROL_TOKEN" "$control_token"
  write_env_line "STEAM_BRIDGE_SMOKE_RESULT_FILE" "$result_file"
  write_env_line "STEAM_BRIDGE_SMOKE_DIAGNOSTIC_DIR" "$diagnostic_dir"
  write_env_line "STEAM_BRIDGE_SMOKE_WEB_URL" "https://store.steampowered.com/app/$app_id/"
  write_env_line "STEAM_BRIDGE_SMOKE_WEB_MODAL" "true"
  write_env_line "STEAM_BRIDGE_SMOKE_OVERLAY_DIALOG" "OfficialGameGroup"
  if [ -n "$native_host_backend" ]; then
    write_env_line "STEAM_BRIDGE_SMOKE_NATIVE_HOST_BACKEND" "$native_host_backend"
    if [ "$native_host_backend" = "opengl" ]; then
      write_env_line "STEAM_BRIDGE_DISABLE_OVERLAY_NEEDS_PRESENT" "1"
    fi
  fi
}

run_case() {
  local case_id="$1"
  shift
  local result_file="$artifact_root/$case_id.log"
  local diagnostic_dir="$result_file.diagnostics"
  local run_cmd
  local status=0
  local case_args=("$@")
  local cleanup_status gameprocess_log_offset smoke_pid
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
  if [ -n "$native_host_backend" ]; then
    echo "NATIVE_HOST_BACKEND $native_host_backend"
  fi
  echo "RUN $(quote_command "${run_cmd[@]}")"

  if [ "$dry_run" = "1" ]; then
    return 0
  fi

  mkdir -p "$(dirname -- "$result_file")"
  write_case_manifest "$case_id" "$result_file" "$diagnostic_dir" "${case_args[@]}"

  local attempt=1
  local max_attempts=2
  while true; do
    status=0
    cleanup_status=0
    write_case_launcher_env "$result_file" "$diagnostic_dir" "${case_args[@]}"
    gameprocess_log_offset="$(macos_steam_log_size "$(macos_steam_gameprocess_log)")"
    "${run_cmd[@]}" || status=$?
    smoke_pid="$(read_smoke_result_pid "$result_file" || true)"
    cleanup_macos_smoke_processes
    if ! wait_for_macos_steam_app_pid_untracked "$smoke_pid" "$gameprocess_log_offset" 30; then
      cleanup_status=1
    fi
    if ! wait_for_macos_steam_app_removed_from_running_list "$gameprocess_log_offset" 30; then
      cleanup_status=1
    fi
    if [ "$status" -eq 0 ] && [ "$cleanup_status" -ne 0 ]; then
      status=1
    fi

    if [ "$status" -eq 0 ]; then
      return 0
    fi

    if [ "$cleanup_status" -ne 0 ] ||
      [ "$attempt" -ge "$max_attempts" ] ||
      ! should_retry_macos_overlay_readiness_failure "$result_file"; then
      return "$status"
    fi

    echo "RETRY $case_id after Steam overlay readiness timeout on attempt $attempt"
    preserve_macos_retry_artifacts "$result_file" "$diagnostic_dir" "$attempt"
    attempt=$((attempt + 1))
  done
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

run_persistent_case() {
  local control_file="$1"
  local control_token="$2"
  local shared_diagnostic_dir="$3"
  local case_id="$4"
  shift 4
  local result_file="$artifact_root/$case_id.log"
  local run_cmd
  local case_args=("$@")

  if case_uses_presenter_action "${case_args[@]}" && ! case_has_managed_timing_requirement "${case_args[@]}"; then
    case_args+=(--require-zero-managed-overlay-timing)
  fi

  run_cmd=(
    "$helper_path"
    --mode control-action
    --app-id "$app_id"
    --result-file "$result_file"
    --diagnostic-dir "$shared_diagnostic_dir"
    --control-file "$control_file"
    --control-token "$control_token"
    --timeout-seconds "$timeout_seconds"
  )
  run_cmd+=("${case_args[@]}")

  echo "CASE $case_id"
  echo "CONTROL $control_file"
  echo "RUN $(quote_command "${run_cmd[@]}")"

  if [ "$dry_run" = "1" ]; then
    return 0
  fi

  mkdir -p "$(dirname -- "$result_file")"
  write_case_manifest "$case_id" "$result_file" "$shared_diagnostic_dir" "${case_args[@]}"
  "${run_cmd[@]}"
}

run_persistent_matrix() {
  local control_file="$artifact_root/persistent-control.json"
  local control_token
  local launch_result_file="$artifact_root/persistent-launch.log"
  local shared_diagnostic_dir="$artifact_root/persistent.diagnostics"
  local launch_cmd quit_cmd status

  control_token="$(generate_control_token)"
  launch_cmd=(
    "$helper_path"
    --mode steam-launch
    --app-id "$app_id"
    --app-name "$app_name"
    --shortcut-game-id "$shortcut_game_id"
    --result-file "$launch_result_file"
    --diagnostic-dir "$shared_diagnostic_dir"
    --timeout-seconds "$timeout_seconds"
    --control-server
    --control-file "$control_file"
    --control-token "$control_token"
  )
  if [ -n "$steam_user_id" ]; then
    launch_cmd+=(--steam-user-id "$steam_user_id")
  fi

  echo "PERSISTENT persistent-launch"
  echo "ENV $launcher_env_file"
  echo "CONTROL $control_file"
  echo "RUN $(quote_command "${launch_cmd[@]}")"

  if [ "$dry_run" != "1" ]; then
    mkdir -p "$artifact_root"
    rm -f "$control_file" "$launch_result_file"
    rm -rf "$shared_diagnostic_dir"
    write_control_launcher_env "$launch_result_file" "$shared_diagnostic_dir" "$control_file" "$control_token"
    "${launch_cmd[@]}"
  fi

  status=0
  if [ "$status" -eq 0 ]; then
    run_persistent_case "$control_file" "$control_token" "$shared_diagnostic_dir" "01-persistent-web-openwait" \
      --action presenter-web-open-and-wait \
      --require-steam-launch \
      --require-overlay-injection \
      --require-overlay-enabled \
      --require-overlay-activated \
      --require-event overlay:presenter-open-and-wait-start \
      --require-no-crashes \
      --close-probe || status=1
  fi

  if [ "$status" -eq 0 ]; then
    run_persistent_case "$control_file" "$control_token" "$shared_diagnostic_dir" "02-persistent-store-openwait" \
      --action presenter-store-open-and-wait \
      --require-steam-launch \
      --require-overlay-injection \
      --require-overlay-enabled \
      --require-overlay-activated \
      --require-event overlay:presenter-open-and-wait-start \
      --require-no-crashes \
      --close-probe || status=1
  fi

  if [ "$status" -eq 0 ]; then
    run_persistent_case "$control_file" "$control_token" "$shared_diagnostic_dir" "03-persistent-friends-openwait" \
      --action presenter-friends-open-and-wait \
      --require-steam-launch \
      --require-overlay-injection \
      --require-overlay-enabled \
      --require-overlay-activated \
      --require-event overlay:presenter-open-and-wait-start \
      --require-no-crashes \
      --close-probe || status=1
  fi

  if [ "$status" -eq 0 ]; then
    run_persistent_case "$control_file" "$control_token" "$shared_diagnostic_dir" "04-persistent-dialog-official-openwait" \
      --action presenter-dialog-auto-open-and-wait \
      --require-steam-launch \
      --require-overlay-injection \
      --require-overlay-enabled \
      --require-overlay-activated \
      --require-event overlay:presenter-open-and-wait-start \
      --require-no-crashes \
      --close-probe || status=1
  fi

  if [ "$status" -eq 0 ]; then
    run_persistent_case "$control_file" "$control_token" "$shared_diagnostic_dir" "05-persistent-passive-toast" \
      --action presenter-achievement-progress \
      --result-delay-ms 1200 \
      --require-steam-launch \
      --require-overlay-injection \
      --require-overlay-enabled \
      --require-passive-notification \
      --require-no-crashes || status=1
  fi

  if [ "$dry_run" != "1" ]; then
    quit_cmd=(
      "$helper_path"
      --mode control-quit
      --control-file "$control_file"
      --control-token "$control_token"
      --timeout-seconds "$timeout_seconds"
    )
    echo "QUIT $(quote_command "${quit_cmd[@]}")"
    "${quit_cmd[@]}" || status=1
    cleanup_macos_smoke_processes
  fi

  return "$status"
}

run_matrix() {
  if [ "$suite" = "unavailable" ]; then
    run_unavailable_matrix
    return 0
  fi

  if [ "$suite" = "persistent" ]; then
    run_persistent_matrix
    return $?
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

  local checkout_args=()
  if [ -n "$checkout_json_file" ]; then
    checkout_args=(--checkout-json-file "$checkout_json_file")
  else
    checkout_args=(--checkout-transaction-id 123456789)
  fi

  run_case "07-checkout-approval" \
    --action presenter-checkout \
    "${checkout_args[@]}" \
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
    "${checkout_args[@]}"

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

if [ "$dry_run" != "1" ] && [ "$skip_summary" != "1" ] && [ "$suite" != "persistent" ]; then
  echo
  node "$summary_runner" --artifact-root "$artifact_root"
elif [ "$dry_run" != "1" ] && [ "$skip_summary" != "1" ] && [ "$suite" = "persistent" ]; then
  echo
  echo "Skipping aggregate summary for persistent suite; per-action helper verification already ran against the shared lifecycle log."
fi
