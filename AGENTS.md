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
| Canonical continuity checkpoint: active goal, blocker, next actions, and last verification | `docs/research/current-work.md` |
| Expensive, manual, live, negative, or environment-sensitive test findings and rerun conditions | `docs/research/test-findings-ledger.md` |
| Detailed platform artifact history and live evidence | `docs/research/cross-platform-overlay-status.md` |
| Presenter architecture, decisions, milestones, and non-goals | `docs/research/native-overlay-presenter-plan.md` |
| Public install, API, and product guidance | `README.md` and `packages/steam-bridge/README.md` |
| Smoke and live matrix commands | `examples/electron-basic/README.md` |
| Contribution checks and stable development policy | `CONTRIBUTING.md` |

Update the existing entry instead of copying the same conclusion into more
places. Link to detailed evidence rather than pasting raw logs.

Keep `docs/research/current-work.md` concise and replace-in-place. Refresh it
after an objective, decision, blocker, file set, validation result, or rejected
approach materially changes, and before a long stop or likely compaction. It is
a checkpoint, not a transcript.

## Development Boundaries and Commands

- This is an npm monorepo with a Rust workspace. The main implementation areas
  are `packages/steam-bridge`, `crates/native`, and
  `examples/electron-basic`; public research and recovery state lives under
  `docs/research`.
- Use Node.js 22.13 or newer for repository development and Rust stable. The
  normal checks are `npm run check:platform`, `npm test`,
  `npm run native:fmt`, `npm run native:check`, and `npm run api:check`.
  `npm test` includes the TypeScript type check. There is no established lint
  command or JavaScript/TypeScript formatter; do not invent one.
- Treat `node_modules`, `dist`, `target`, `sdk`, native binaries and Steamworks
  redistributables, `steam_appid.txt`, and generated
  `packages/steam-bridge/index.d.ts` as generated or external areas. Do not
  hand-edit or commit them unless a task explicitly targets the relevant
  generation or packaging flow.
- Treat `.env`, ignored `.env.*` files other than the tracked `.env.example`,
  `.private/`, and `*.private.{env,json}` as private runtime inputs. Never read,
  copy, summarize, or commit their contents.
- Preserve the compatibility-shaped JavaScript export and existing TypeScript
  and Rust API shapes. Public behavior changes require proportionate tests and
  user-facing documentation review.
- If `.codex/hooks/reanchor.cjs` changes, refresh its embedded SHA-256 in both
  `.codex/hooks.json` handlers, rerun every synthetic lifecycle check, and
  expect the changed command hook to require review again through `/hooks`.

## Engineering Discipline

- Understand the real execution path and inspect the exact edit context before
  changing it; do not reconstruct an implementation from memory.
- Make the smallest safe change that addresses the actual task. Preserve public
  APIs, signatures, imports, events, field names, behavior, formatting, and
  file structure unless the task explicitly requires a change.
- Do not perform speculative cleanup, unrelated refactoring, or remove existing
  functionality while fixing a local issue. Do not add code comments unless
  the project requires them or the user asks for them.
- Prefer reproductions, tests, traces, benchmarks, and measurements over
  intuition. Revert experiments that perform worse or invalidate behavior.
- For complex or risky work, use a plan and a falsifiable hypothesis. Run the
  narrowest meaningful validation first, expand with risk, compare before and
  after evidence, and never infer runtime, visual, performance, device,
  networking, or integration success from a build alone.
- In runtime hot paths, avoid repeated allocations; allocate up front and
  retain, pool, or grow reusable buffers when appropriate.
- Review the exact diff before editing or validating and never use destructive
  Git recovery commands.

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
- A Windows backend claim requires an attached case whose top-level presenter,
  native-host diagnostics, and renderer diagnostics all agree. The lazy
  presenter-ready label alone does not prove which native renderer was created.
- On scaled Windows desktops, screenshot analysis, window rectangles, and
  `SendInput` must share physical per-monitor-DPI coordinates. Do not replace a
  coordinate mismatch with fixed click positions or longer waits.
- Do not start real-purchase live proof merely because a device and package are
  healthy. First confirm the configured app launch can reach an
  `InitTxn`-capable application/backend test path and that its private runtime
  handoff is available with a complete, non-empty product request shape.
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

## GPT-5.6 Ultra and Subagents

- The main thread owns the user goal, scope, constraints, architecture,
  evidence synthesis, implementation choice, integration, final validation,
  and `docs/research/current-work.md`.
- Delegate only genuinely independent work such as targeted exploration,
  documentation verification, test discovery, log, trace, benchmark, or test
  output analysis, isolated design comparisons, or independent correctness,
  performance, security, and regression review. Prefer read-only assignments;
  do not spawn agents merely because parallelism is available.
- Give each subagent a bounded question and require distilled findings with
  only the context it needs. Require exact paths, symbols, evidence, and
  unresolved uncertainty instead of raw logs. Wait for required investigations
  before making an architectural decision.
- Use one implementation owner for a coherent patch. Parallel writes are only
  for isolated file sets with no shared ownership or generated outputs; the
  main thread must inspect and integrate every subagent change.
- Keep nesting depth at one unless deeper delegation has a demonstrated
  benefit. Keep concurrency bounded, prefer built-in roles, and do not create
  custom profiles. Let the orchestrator choose model and reasoning settings
  unless a recurring, measured role requirement proves otherwise.
