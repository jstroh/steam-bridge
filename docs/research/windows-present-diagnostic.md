# Windows nonblocking presentation and freshness repair

This unreleased source defaults matching Windows addons to nonblocking VSync;
it is not a published package or a confirmed fix for any particular GPU.
It addresses successful but slow DXGI `Present` calls while
the frame-latency waitable object reports ready. These can hold Electron's main
thread without triggering the existing readiness-timeout fallback.

## Modes

Set `STEAM_BRIDGE_QA_OVERLAY=1` and choose
`STEAM_BRIDGE_QA_PRESENT_MODE` before creating the native renderer:

| Mode | Normal submission | Input dispatch |
| --- | --- | --- |
| absent (new default) | Configured interval, `DXGI_PRESENT_DO_NOT_WAIT` | Before the normal frame transaction, and again afterward |
| `standard` | Existing configured sync interval, flags 0 | Existing post-pump dispatch |
| `nonblocking-vsync` | Configured interval, `DXGI_PRESENT_DO_NOT_WAIT` | Before the normal frame transaction, and again afterward |
| `nonblocking-immediate` | Interval 0, `DXGI_PRESENT_DO_NOT_WAIT` | Same pre/post dispatch |

An unresolved readiness timeout still selects the existing immediate fallback.
An explicit nonblocking opt-in requires a matching native addon; older addons
fail before creating a host. Without an opt-in, older addons keep their standard
compatibility path. Other platforms and the OpenGL diagnostic backend retain their existing
path. Invalid native environment values remain on the standard path; launchers
must validate spelling.

A busy return retains the dirty source and does not advance the presented-frame
counter. The session schedules one retry deadline using the existing bounded
Windows fallback cadence. New uploads may replace the retained source but cannot
postpone this deadline or spin through an always-ready waitable object.
Immediate-mode retained-frame/overlay work stays timer-paced. Nonblocking
renderers request a one-millisecond timer period for their lifetime and release
it on destruction. Native copy fences, two-copy admission, swap-chain buffers
and maximum frame latency two are unchanged.

The Windows JavaScript boundary submits one producer at a time and retains only
the newest unsubmitted producer. Replaced pending promises resolve false without
native use, allowing prompt release back to Electron's finite texture pool.
Active producers remain retained until authoritative native completion. Overlay,
close and failure discard only unsubmitted work; unsafe submitted failures still
require process-lifetime quarantine. A skipped source forces the next accepted
viewport copy to be complete so coalescing cannot lose intermediate dirty regions.
No background FPS cap, shader change or cursor-specific workaround is included.

Win32 modal move/resize and window-message repaint paths remain intact. The
pre-input pump can enter these paths; this is not a promise that every Win32 or
driver call is nonblocking, nor is it presentation-thread isolation. A driver or
hook ignoring the requested policy can still stall input arriving during its
call and must remain visible in the evidence.

## Evidence and failure injection

Native `presentDiagnostics` reports mode, actual last flags/result, the
frame-rate-derived budget, busy returns and calls exceeding that budget. Session
snapshots include mode, retry count, input-dispatch count, latest/maximum dispatch
delay and dispatches exceeding the target-frame budget. Input delay starts at
native event collection, not physical device polling; it is not input-to-photon
latency. Present duration snapshots are last-call samples, not full histograms.
`sharedTextureQueue` reports the one-active/one-pending bounds, replacements,
cancellations and receipt-to-submission delay, not GPU execution time.

The unit harness exercises an always-ready/busy producer, newest-frame
coalescing, cancellation, older-addon rejection and close during pre-dispatch.
It also deliberately sleeps inside the mocked native frame call despite the
nonblocking policy. That test must report the residual stall and delayed
mid-call input, rather than assume the flags fix a driver.

A deterministic four-producer 100 Hz contention model with a shared 5 ms copy
service completes 199 frames under both policies while p95 completion age drops
from 40 to 30 ms. That model demonstrates freshness under controlled contention,
not actual GPU throughput or a four-game-client hardware result. Single-active
copy throughput still needs high-refresh and integrated-GPU qualification.

Compare modes in separate runs on the same exact binary, client content,
display, GPU and driver. Keep warm-up separate. Collect at least three settled
samples during movement; repeat overlay activation/close, resize, fullscreen
and minimize/restore. An AMD pass does not establish a fix on untested NVIDIA
hardware. New addon bytes require normal trust qualification. Do not disable
Smart App Control or change DLL access controls to obtain a result.

## Basis

- [Microsoft nonblocking Present contract](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/dxgi-present)
- [Firsthand NVIDIA blocking-Present report](https://forums.developer.nvidia.com/t/bug-report-nvidia-geforce-drivers-cause-idxgiswapchain4-present1-to-block-when-it-should-not/250115)
- [DXGI window-thread/deadlock guidance](https://learn.microsoft.com/en-us/windows/win32/direct3darticles/dxgi-best-practices)
- [Electron shared-texture ownership and finite pool](https://www.electronjs.org/docs/latest/api/structures/offscreen-shared-texture)

The forum report is a similar reproduction, not vendor confirmation of this
incident. If a hardware comparison still shows blocking, capture DX11/WDDM
traces before considering broader presentation-thread ownership changes.
