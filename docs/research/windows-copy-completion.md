# Windows shared-texture fence completion repair

## Evidence and scope

A complete 38-record Windows 11 / RTX 3050 laptop / 60 Hz capture shows fresh
texture delivery falling from 59.9 FPS to 6.4 and then 4.6 FPS after application
switching. Paint and native presentation remain near 60 FPS. The final snapshot
has two copies in flight, 2,704 admission drops, 39 nonfatal copy waits over
500 ms, 590.552 ms maximum completion latency and 515.858 ms maximum dispatch
delay. Foreground has returned and no Steam overlay is active. Present remains
below 0.3 ms in degraded samples. Shader fallback does not restore delivery.

This identifies the copy-completion path, not the precise driver or scheduling
cause. Completion duration includes worker dispatch and waiting; it is not a GPU
timestamp. Battery state is unchanged throughout the capture. The existing
nonblocking-Present repair alone does not establish a fix for this report.

## Primary-source contract

- Microsoft documents [GetCompletedValue](https://learn.microsoft.com/en-us/windows/win32/api/d3d11_3/nf-d3d11_3-id3d11fence-getcompletedvalue)
  as the fence's current value, with the same semantics as its D3D12 counterpart.
  That counterpart reserves [UINT64_MAX for device removal](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12fence-getcompletedvalue).
- [SetEventOnCompletion](https://learn.microsoft.com/en-us/windows/win32/api/d3d11_3/nf-d3d11_3-id3d11fence-seteventoncompletion)
  requests notification at a fence value. Microsoft's
  [sample](https://github.com/microsoft/DirectX-Graphics-Samples/blob/master/Samples/Desktop/D3D1211On12/src/D3D1211On12.cpp)
  checks completed values before registering an unnecessary wait.
- Electron's [shared-texture contract](https://www.electronjs.org/docs/latest/api/structures/offscreen-shared-texture)
  has a finite producer pool; a consumer must finish using a texture before
  releasing it. A timeout is not permission to reuse an unfinished producer.

No exact upstream fix for this particular laptop capture was established.

## Implementation

The old worker consulted the completed value only when event registration or
waiting failed. An accepted registration followed by repeated timeouts could
retain an already completed copy. It also accepted an event signal without
checking the target fence, and treated the device-removal sentinel as completion
in its polling fallback.

The worker now checks the authoritative value before waiting and after every
event result. Already completed copies skip registration and waiting. Missing
notifications can recover at the existing ten-millisecond wait boundary. A stale
signal cannot release a producer; it switches that wait to the existing bounded
one-millisecond polling fallback. Device removal fails release-unsafe through
the existing terminal-failure path. The sentinel is not issued as a fence value.

There are no new foreground waits, timers, threads, flushes, per-frame logs or
queue slots. The two-copy bound, producer ownership, query fallback and two-second
fatal guard remain. Four exceptional-path atomic counters are exposed through
existing snapshots under `sharedTextureCopy.fenceWait`:

- `eventTimeoutCount`: event waits that expired while the fence was inspected.
- `completedAfterTimeoutCount`: the fence was complete when inspected after a
  timeout. This does not distinguish a lost notification from completion racing
  the timeout boundary.
- `earlyEventCount`: an event signaled before its target value was observed.
- `eventFailureCount`: failed registration, failed wait or unexpected wait status.

The consumer forwards this object in existing low-rate diagnostics, using null
with older addons. These counters do not identify the cause of an actually
unfinished GPU fence or measure physical input-to-photon latency.

Native host diagnostics also separate copy time from queue delay and report
the adapter topology:

- `sharedTextureCopy.gpuTiming`: GPU timestamps around at most one copy in
  every 30 (`sampleInterval`; a sample is skipped while its query slot is still
  pending), read later without flushing. `meanMs`, `lastMs` and
  `maxMs` are GPU execution time only, so completion latency minus this value
  is time spent queued. `disjointCount` counts rejected samples.
- `frameLatencyWait`: the bypass latch (`bypassed`, `bypassCount`,
  `rearmCount`), timeouts that did not count because the host was iconic,
  hidden or occluded (`expectedTimeoutCount`), the consecutive-timeout count
  and its threshold, and `presentOccluded`.
- `adapters`: host, shared-texture and output adapter LUIDs, with
  `crossAdapterTexture` and `crossAdapterPresent` when both sides are known.
  The output adapter is the adapter whose DXGI output owns the window's
  monitor (`MonitorFromWindow`), falling back to the swap chain's containing
  output. It is read only when diagnostics are requested. On hybrid laptops,
  `GetContainingOutput` fails for a discrete-GPU swap chain, so the monitor
  lookup is what reports the cross-adapter present.

The session snapshot adds `nativeFrameWaitRecoveryCount`, the number of times
the JavaScript scheduler left its timeout fallback after the native waitable
re-armed.

## Dedicated copy device

The opt-in `windowsDedicatedCopyDevice` session option copies Electron's
shared texture on a second D3D11 device on the host adapter. The copy lands in
one of four host-owned shared textures. A shared copy fence orders the host's
first sample of a new texture after its copy, and a shared sampled fence orders
the next overwrite after the host's last sample. The producer is still released
only when the copy fence completes, and the two-copy admission bound is
unchanged. A partial update first copies the newest complete texture, then the
dirty rectangle, so every ring texture holds a whole frame. If the second
device cannot be created, copies fall back to the host context. If it is
removed, the import fails with the device-lost HRESULT, and the existing
recovery rebuilds the renderer with the option still set. This also holds when
removal is first seen by an in-flight copy wait: once a copy has stalled or
failed, the next import checks the host and copy devices, and reports device
loss rather than a plain stall if either was removed.
A synchronous import or CPU frame clears the ring's pending and newest frames,
so an older dedicated frame can never replace it. Turning the option off first
binds a pending frame that was never shown. If the copy device cannot wait for
host sampling of a slot, it skips that copy rather than overwrite the slot.
When a Present is busy, occluded or fails after the host signalled its
sample, the host context is flushed so the copy device does not wait on a
signal that never reached the GPU. A busy or occluded Present could not be
forced on the NVIDIA desktop, so only the decision is unit-tested.
`sharedTextureCopy.dedicatedDevice` reports whether it is requested and
active, its copy count, creation failures and last error. `gpuTiming` then
reports the copy device's timestamps. Evidence and the remaining hybrid-laptop
gate are in `WIN-FRAME-WAIT-BYPASS-LATCH-001`.

## Validation

Three regressions failed with the original logic: completed fence plus missing
notification, stale signal with unfinished copy, and the device-removal sentinel.
They pass after repair. Additional tests cover already-completed fast paths,
repeated pending timeouts, event failures, device removal during the wait and
diagnostic counters. Default native tests pass 77 cases with two hardware cases
ignored; both hardware cases were separately executed and passed three times.
The full JavaScript/type suite passes 466 cases with two platform skips. The
consumer passes 643 tests with six platform skips, lint and typecheck.

On the available AMD Radeon(TM) Graphics device, the hardware test performs a
real 1080p GPU copy with notification deliberately withheld, then interleaves 256
warmed old/new copy-completion measurements using separate event handles. Final
review moved the common post-test fence assertion outside both timed regions;
the initial comparison had included extra validation only in the baseline.
The corrected three trials measure old/new medians of 231.9/235.9, 234.8/234.3
and 233.4/233.6 us; means are 248.886/248.777, 247.282/247.567 and
247.000/243.126 us. P95 values are 349.5/359.3, 329.4/333.2 and 321.2/304.5 us.
Performance is approximately unchanged locally, with small mixed variations;
do not claim zero overhead or a consistent speedup. These are API microbenchmarks,
not cross-process Electron gameplay proof or an affected-NVIDIA qualification.

Next: exact-source CI, immutable candidate packaging and protected actual-game
focus/overlay/transition tests. An affected-device retest remains necessary to
close the reported incident. Never label this defensive repair a demonstrated
driver fix or publish a stale candidate/receipt.

## Live follow-up: reused event notifications

The cleared `v0.4.8` candidate reaches real gameplay on an AMD Windows system at
60 Hz. Across 460 gameplay samples, median paint, fresh texture and native
presentation are all 59.9 FPS. Copy timeouts, submission failures, saturation
drops and device losses remain zero. However, 27,094 completed copies accumulate
17,247 early event signals, exposing avoidable repeated fallback to polling.

An auto-reset event only consumes its signal when a wait succeeds. If completion
is instead observed through the fence-value fast path or polling, the old signal
can remain in the slot. Registering a new target without clearing it can select
polling again, leaving the new notification to repeat the cycle. Microsoft's
[ResetEvent contract](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-resetevent)
allows clearing that state. The correction resets once before the first new
registration, never afterward; reset failure uses the existing bounded fallback.
The authoritative fence still owns every completion decision.

A real Win32 event-reuse regression fails before the change and passes afterward,
including immediate new-notification preservation. Hardware checks also pass.
The separate source-linked live retest changes only the native addon, preserving
the cleared launcher and ASAR. It completes 10,239 copies with zero early signals,
slow copies, drops, copy timeouts, submission failures or device losses. Median
paint/fresh/native rates are 60/59.9/59.9 FPS across 172 gameplay samples; focus
return and clean exit pass. This closes the local stale-signal regression, not
the affected laptop's original incident or the exact next release's qualification.
