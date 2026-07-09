# Steam Bridge Agent Guide

This file applies to the entire repository. Read it before changing code or
running live Steam tests.

## Recovery After Compaction

If the session was compacted, resumed, or the task state is unclear:

1. Run `git status --short --branch` and `git log -5 --oneline --decorate`.
2. Read `docs/research/current-work.md` completely.
3. Search `docs/research/test-findings-ledger.md` for the platform, route, or
   failure being investigated. Do not repeat an unchanged experiment whose
   entry says not to rerun it.
4. Reconcile the checkpoint with commits and worktree changes newer than its
   review anchor. Code, tests, and Git history outrank the checkpoint.
5. Read the relevant sections of
   `docs/research/cross-platform-overlay-status.md` for detailed live evidence
   and `docs/research/native-overlay-presenter-plan.md` for architecture. These
   are long evidence logs, not the fast recovery entry point.
6. Inspect the implementation and tests involved before relying on a written
   conclusion.

## Where Information Belongs

| Information | Location |
| --- | --- |
| Stable repo-wide recovery, privacy, platform, and workflow rules | `AGENTS.md` |
| Active goal, current blocker, next actions, and last verification | `docs/research/current-work.md` |
| Expensive, manual, live, negative, or environment-sensitive test findings and rerun conditions | `docs/research/test-findings-ledger.md` |
| Detailed platform artifact history and live evidence | `docs/research/cross-platform-overlay-status.md` |
| Presenter architecture, decisions, milestones, and non-goals | `docs/research/native-overlay-presenter-plan.md` |
| Public install, API, and product guidance | `README.md` and `packages/steam-bridge/README.md` |
| Smoke and live matrix commands | `examples/electron-basic/README.md` |
| Contribution checks and stable development policy | `CONTRIBUTING.md` |

Update the existing entry instead of copying the same conclusion into more
places. Link to detailed evidence rather than pasting raw logs.

## Project Invariants

- Steam Bridge is generic open-source Steamworks infrastructure. Public smoke
  coverage uses Valve SpaceWar App ID `480` only.
- Private configured app/product data may be used only at runtime for real
  purchase proof. Never commit or document private app/product/account names or
  IDs, item IDs, order/transaction/Steam IDs, publisher keys, prices, checkout
  URLs, private fixture paths, or raw private artifacts.
- Supported targets are Windows x64, Linux x64/Steam Deck, and macOS Apple
  Silicon. Intel macOS, Rosetta, and universal macOS builds are unsupported.
- Windows managed overlays use the D3D11 presenter by default. Direct Chromium
  hooking, WGL, in-process GPU, and DirectComposition-off paths are diagnostics.
- Avoid timing hacks. Timeouts are failure guardrails; presenter lifecycle must
  remain callback/state driven.
- Avoid unnecessary Steam restarts. Use readiness and health evidence first.
- Preserve user changes and never discard unrelated worktree edits.

## Recording Test Findings

Before an expensive or live test, search the ledger. After a meaningful new
result, update the ledger in the same change that records the conclusion:

- record the tested premise and environment generically;
- mark the outcome as settled, open, environment-blocker, diagnostic-only, or
  superseded;
- state what the result proves and what it does not prove;
- add a precise **Repeat only when** condition;
- link to the detailed evidence section or relevant code/test;
- keep all committed fields sanitized.

Routine green unit checks belong in `current-work.md` and CI, not as repeated
ledger rows. Preserve negative and inconclusive findings; supersede them when
new evidence changes the interpretation.

## Meaningful-Slice Workflow

For requested repository changes:

1. Review the diff and relevant user-facing claims.
2. Update `current-work.md` whenever the active finding or next step changes.
3. Update the test ledger whenever a live/manual result changes what should be
   tried again.
4. Run proportionate checks. The normal full set is documented in
   `CONTRIBUTING.md`; also run `npm run package:smoke` for packaging, helper,
   matrix, or recovery-context changes and always run `git diff --check`.
5. Scan tracked changes for private names, identifiers, URLs, keys, prices, and
   fixture paths before committing.
6. Commit intentionally, push, and verify GitHub CI after each meaningful slice
   when the user has authorized repository changes.
