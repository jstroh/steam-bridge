# Current Work Checkpoint

Last reviewed: 2026-07-15

Review anchor: `39f7e82` (`Align Windows lifecycle smoke assertions`).
Reconcile this checkpoint with newer Git history and worktree changes before
acting.

## Active Goal

The autonomous Windows x64 public release slice for exact signed candidate
`3abcc3f` is complete and published through `39f7e82`. Preserve that settled
proof and keep the separate real client-session `InitTxn` proof deferred until
the configured game, capable backend/application path, and complete private
runtime request handoff are available.

## Current State

Exact CI `29362884310` and candidate-only Release `29363098329` passed for
`3abcc3f`. The protected signed candidate contains 114 files / 398,128,652
bytes and retains content SHA-256
`f4b975e696bcdf0ab926db3ca7027b11402401f2c5d00f731bb62a9837959fce`
and binding SHA-256
`65469171fc83fa3e699e6ccb32db5ddf52659f6869006421e245b0a2f8375e7b`.
Its canonical ACL gives the interactive identity read/execute only while
SYSTEM and Administrators retain full control. The required app executable,
native addon, and two Steamworks DLL signatures are valid and the required
publisher comparisons pass. Signer identity remains omitted.

A local foreground-grant broker now replaces the rejected title-bar and
chat-timed click loops. Its deliberate broker-button activation calls the
documented `AllowSetForegroundWindow(ASFW_ANY)` path, while the matrix verifies
one challenge-bound request/acknowledgement per exact case. The audit binds the
broker path, SHA-256, PID, session, start time, foreground window, and fresh
acknowledgement; the matrix sends no input and explicitly forbids candidate
input. This works for checkout, shortcut, managed, and persistent-reuse
profiles without a user click or Steam restart.

The close probe now detects the Steam web close glyph from a physical
per-monitor-DPI screenshot and records its search box, sample score, panel,
scale, host geometry, and exact click coordinate. Persistent reuse directly
binds cycle one to the glyph and permits later same-host cycles to reuse that
exact coordinate when the cursor obscures the glyph. All legacy panel, scale,
foreground, point-owner, dispatch, close, park, and screenshot invariants
remain required.

The four receipt roots were collected in required order against one unchanged
Steam identity and the same protected candidate:

- `C:\Users\admin\steam-bridge-artifacts\windows-3abcc3f-receipt-currentsteam-persistent-20260715-033700`
- `C:\Users\admin\steam-bridge-artifacts\windows-3abcc3f-receipt-currentsteam-checkout-20260715-034000`
- `C:\Users\admin\steam-bridge-artifacts\windows-3abcc3f-receipt-currentsteam-shortcut-20260715-034500`
- `C:\Users\admin\steam-bridge-artifacts\windows-3abcc3f-receipt-currentsteam-managed-20260715-035200`

Strict summaries pass 1/1 persistent-reuse, 4/4 checkout, 10/10 shortcut, and
16/16 managed cases. That is 31 clean Steam-launched cases, 27 active routes,
three persistent shown/closed/parked cycles, 17/17 persistent D3D11 lifecycle
snapshots, complete presenter/native-host/renderer D3D11 agreement for every
attached case, clean crash evidence, exact focus return, and verified task,
runner, package-process, launch-environment, handoff-file, and Steam cleanup.

The durable local receipt is
`C:\Users\admin\steam-bridge-artifacts\release-3abcc3f-29363098329\windows-live-proof-receipt-20260715-041034.json`
with receipt SHA-256
`73ece31df4c6fc588299df88f2b79648983b2b8cf963f8a70b51a2b365b12517`.
Independent readback verifies four profiles, 31/31 clean cases, 27 active
cases, one candidate, and one Steam identity. Post-receipt fingerprint and ACL
audits pass; all four package-required signatures remain valid; the current
Steam process still matches the profile identity; and zero candidate
processes, live overlay tasks, or current-run task-stage directories remain.
Older unrelated `C:\sb` diagnostic directories are preserved.

Receipt validation now matches the actual lazy presenter contract: the direct
native-load gate and route `10-presenter-ready` prove selection-only D3D11 with
no attached host/renderer, while every attached live route requires full
three-way D3D11 agreement. Native-presenter cases also require the exact current
`overlayInjection=false` diagnostic rather than the obsolete legacy-injection
claim; Steam launch markers, overlay-enabled state where applicable,
activation callbacks, and native lifecycle evidence remain mandatory.

Public App ID `480` has no configured products and cannot prove a real
purchase. The public checkout root proves synthetic prepare, direct approval,
shortcut approval, and open-and-wait routing only. Do not run a private proof
until the complete non-empty request handoff and an `InitTxn`-capable configured
game path exist.

Commits `dd89b0b`, `0d755ef`, and `39f7e82` publish the broker, close-glyph and
receipt contracts, documentation, and aligned package-smoke assertions. Exact
CI run `29389571866` passes Windows x64, Linux x64, macOS Apple Silicon, and the
full Linux package smoke.

## Last Verification

- Receipt generator self-test and strict Windows matrix summary self-test pass.
- The four fresh strict live summaries pass with all cleanup and Steam
  continuity guards.
- Receipt generation and independent receipt readback pass with hash
  `73ece31df4c6fc588299df88f2b79648983b2b8cf963f8a70b51a2b365b12517`.
- Candidate fingerprint rebinds to 114 files / 398,128,652 bytes, exact content
  and binding hashes above.
- Candidate ACL audit reports canonical three-rule protection and
  `writeProtected=true`.
- The four package-required Authenticode entries are valid with required
  publisher agreement. Six upstream Electron runtime DLLs without embedded
  signatures are outside that closed required-signature set.
- Candidate process count, live overlay task count, and current-run task-stage
  count are zero. All four profile cleanup guards pass and current Steam still
  matches their one exact identity.
- `npm test` passes 196/196 tests. `check:platform`, `api:check`, native format,
  native check, receipt and matrix-summary self-tests, PowerShell parsing,
  broker compilation, and `git diff --check` pass.
- Native-Windows `package:smoke` reaches the packaged macOS preparation
  self-test and stops at its pre-existing POSIX `/tmp/...` resolved-path
  assertion because Node resolves that fixture as `C:\\tmp\\...`. Git Bash and
  bundled Python do not supply full Unix fixture semantics; exact Linux CI is
  the supported full package-smoke gate.
- Exact post-push CI `29389571866` passes all four jobs: Windows x64, Linux x64,
  macOS Apple Silicon, and package smoke. The package-smoke job includes the
  complete Windows helper static contract and matrix-summary self-test.

## Next Actions

1. Leave real client-session purchase proof blocked until the configured game,
   capable `InitTxn` path, and complete private runtime handoff exist.
2. Rerun the public Windows profiles only under their ledger conditions, not
   for additional confidence.

## Exact Next Step

No further public Windows action is required. The next meaningful live action
is the private configured-game purchase proof, and only after its documented
`InitTxn` prerequisites exist. Do not rerun the four public profiles unless
Steam, candidate binding, broker protocol, close-glyph evidence, presenter
lifecycle, or receipt semantics materially changes or a later audit regresses.

Detailed live evidence is in
`docs/research/cross-platform-overlay-status.md`; rerun contracts are in
`docs/research/test-findings-ledger.md`; architecture is in
`docs/research/native-overlay-presenter-plan.md`.
