# Troubleshooting

[Documentation home](../README.md) · [Getting started](getting-started.md) · [Electron](electron.md) · [Steam Input](steam-input.md)

First identify the failing boundary: native loading, Steam initialization,
input, game rendering, or native presentation. Keep the exact failing version
and evidence before changing dependencies or runtime switches.

## Start with the symptom

| Symptom | Check first |
| --- | --- |
| Native module cannot load | OS/architecture, installed package contents, unpacked addon/runtime libraries, unexpected native-path override, exact OS/security error |
| Steam initialization fails | Steam running under the same desktop user, explicit App ID, account entitlement, installed-Steam launch |
| Steam initializes but no visible overlay | Correct platform window model, overlay availability, initialization before graphics creation, real Steam launch |
| Actions are missing or handles are zero | Exact manifest names, active set, published configuration, depot paths, controller connection, one session/frame owner |
| DOM gamepads work but Steam actions do not | Main-side `connectActionInput()`, correct session preload, connection before page load, trust and active-state checks |
| A button repeats an action every game frame | Held `pressed` versus edge, or repeated cached `steamActions.sequence` |
| Controls stop in a hidden renderer | Use visible native-host focus, not the hidden `BrowserWindow.isFocused()` |
| Wrong labels on a controller | Use action-origin glyphs, not hard-coded A/B/X/Y; refresh after rebinding |
| Input is offset or sticks after blur | Logical/physical size mapping, aspect-fit geometry, native focus/capture release, forwarder lifecycle |
| Linux launch works directly but fails from Steam | Launch the prepared wrapper, executable modes, required flags, X11/GLX/Xwayland availability |
| macOS development works but shipping fails | Native arm64 target, exact packaged launcher, signing/notarization, post-sign verification |
| FPS appears healthy despite a stall/restart | Separate sessions and sample windows; distinguish rAF, paint, copy and present counters |

Do not copy a workaround from a different platform or runtime generation without
checking whether it applies. The [platform policy](../README.md#platform-targets)
and [window model](electron.md#choose-the-window-model) are deliberate.

## Input problems

Inspect `actions.getDiagnostics()` on demand for lifecycle, controller count,
sequence, unresolved names and manifest override. Zero handles can be temporary;
the managed session retries them. A permanent zero often means a name or
Steamworks configuration mismatch, not a need for another polling timer.

For Electron, inspect `connection.diagnostics()`. Confirm that the intended
document completed loading, passes the trust check and is active. Connecting
after load requires `connection.reconnect()`. A high coalesced-frame count means
the renderer is behind; the transport is bounded.

The first sample intentionally has no invented edge. Check held state separately
from `pressedThisFrame`. On disconnect/focus loss, clear application movement
and one-shot state. Do not treat a stale cached frame as another press.

## Shared-texture failures

On Windows, preserve both the Electron producer and the native completion
result for the same paint event. Never release a pooled producer in a blanket
`finally` handler.

An unsafe copy failure requires quarantine for the remainder of the application
process followed by termination/relaunch. A host close or same-process device
reconstruction is not a proven release boundary. Follow the complete
[ownership table](electron.md#windows-texture-ownership).

A fatal copy timeout can be downstream of another stalled graphics operation.
It does not, by itself, prove that the copy code, a driver or a particular
overlay caused the stall. Keep background/focus transitions and native
`Present`/wait/copy timing together. Do not hide the signal by raising
timeouts, dropping ownership checks or switching to a CPU upload fallback.

## Collect useful diagnostics

Steam Bridge exposes diagnostics; it does not run a reporting backend or send
telemetry to its maintainers. Your application owns collection and retention.
Use existing counters, bounded periodic summaries and transition/error events.
Avoid per-frame JSON serialization, filesystem writes, IPC, console output,
or detailed whole-process snapshots.

Capture enough identity to compare like with like:

- App/source build, Steam Bridge and Electron versions, OS/architecture.
- A local session boundary and monotonic sample interval.
- Visible/focused/minimized/overlay state and transition times.
- Logical content size, physical backing size, DPR/DPI and active refresh target.
- Actual selected renderer/backend, hardware/software state and GPU/driver.
- Native error category, exit reason and relevant counter deltas.
- Workload context and short reproduction steps without player content.

Keep these measurements separate:

| Measurement | What it proves | What it does not prove |
| --- | --- | --- |
| Renderer rAF cadence | JavaScript callback cadence over that window | Every frame reached the screen |
| World CPU/GPU sample | Cost of the particular measured work/frame | A window-wide average unless actually accumulated |
| Electron paint/shared-texture arrival | Producer frames delivered to the main process | Completed native copies or visible presents |
| Copy completion/queue/wait counters | Bridge transfer progress and backpressure | Display presentation cadence |
| Native present count/call duration | Presenter submissions and blocking time | Unique fresh game frames on screen |
| DXGI statistics, when valid and available | Windows presentation/refresh evidence | A portable metric for macOS/Linux or an unavailable zero |

Correlate counters from the **same session and overlapping interval**. State
whether a value is cumulative, a window delta, or a single sample. Reject reset
deltas and mark missing/unavailable measurements as unavailable, not zero.
Never splice a healthy replacement session into the failed session's summary.

`steam.overlay.getDiagnostics()`, managed input diagnostics, and native-host
snapshots are useful entry points. Collect the fields needed for the question,
not every native snapshot on every frame. Average FPS alone can hide long stalls.

## Reporting a useful issue

Include exact versions, platform, reproduction, the expected/actual result,
and a short sanitized trace covering before/during/after the failure. Say
whether it reproduces in an installed Steam launch and whether focus, overlay,
display or controller transitions matter.

For native crashes, retain the crash dump and symbols matching the **exact
binary**. Rebuilding the same source does not recreate the same debug identity.
Provide sensitive artifacts privately; do not paste them into public issues.

Exclude publisher keys, tickets, order/transaction/Steam IDs, account names,
payment details, entered text, and private URLs/paths. Keep source-map/build
identity separate from native symbol identity. Review
[PRIVACY.md](../PRIVACY.md) before sharing application diagnostics.

A package upgrade can contain a fix, but a newer version alone is not evidence
that a particular failure is solved. Retest the failing boundary with the exact
candidate and record what remains unproven.
