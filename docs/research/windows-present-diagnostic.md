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
Immediate-mode retained-frame/overlay work stays timer-paced. A busy Present
preserves its consumed readiness permit for the retry: a rejected submission
must not wait for a new flip-completion signal that might never arrive.
The healthy standard/VSync path does not request high-resolution timers. Busy
retries acquire a one-millisecond period and release it after presentation
recovers. The existing readiness fallback and explicit immediate diagnostic
retain it while timer-paced; destruction balances any remaining request.
Native copy fences, the two-copy ceiling, swap-chain buffers and maximum frame
latency two are unchanged.

The Windows JavaScript boundary permits two asynchronous copies in flight and
rejects overflow immediately without retaining any unsubmitted frame. It never
replays older work after a newer synchronous or bitmap update. Active producers
remain retained until authoritative native completion, including across close,
overlay activation and another copy's failure. Unsafe submitted failures still
require process-lifetime quarantine. A skipped source forces the next accepted
viewport copy to be complete, including a synchronous compatibility update.
Native rejection invalidates damage immediately, before another same-turn call.
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
`sharedTextureQueue` keeps its diagnostic field name and reports policy
`bounded-two-copy-admission`, in-flight count, submission attempts, pre-submission
rejections and failure state. Compatibility fields for pending work, replacement,
cancellation and queue delay remain zero; there is no deferred submission queue.

The unit harness exercises an always-ready/busy producer, two-copy admission,
overflow/damage recovery, mixed update ordering, out-of-order completions,
older-addon rejection and close during pre-dispatch.
It also deliberately sleeps inside the mocked native frame call despite the
nonblocking policy. That test must report the residual stall and delayed
mid-call input, rather than assume the flags fix a driver.

The rejected single-active implementation improved frame age in a serial-service
model but regressed pipelining: a 100 Hz producer with 16 ms asynchronous
completion completed 62 frames versus the baseline's 99 in one second. Restored
two-copy admission matches that baseline and the four-producer shared-5-ms-service
model (199 frames, p95 age 40 ms). These models are regression coverage, not GPU
measurements or affected-device qualification.

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
