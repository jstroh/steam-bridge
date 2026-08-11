export interface OverlayFrameDeadlineState {
  frameRate?: number;
  nextFrameAtMs?: number;
}

/**
 * Return the delay to the next presentation deadline without adding the work
 * performed by the previous frame to every interval. Missed deadlines are
 * skipped instead of producing a burst of catch-up frames.
 */
export function nextOverlayFrameDelayMs(
  state: OverlayFrameDeadlineState,
  frameRate: number,
  nowMs: number
): number {
  const framePeriodMs = 1000 / frameRate;
  if (
    state.frameRate !== frameRate ||
    state.nextFrameAtMs === undefined ||
    !Number.isFinite(state.nextFrameAtMs)
  ) {
    state.frameRate = frameRate;
    state.nextFrameAtMs = nowMs + framePeriodMs;
    return framePeriodMs;
  }

  let nextFrameAtMs = state.nextFrameAtMs + framePeriodMs;
  if (nextFrameAtMs <= nowMs) {
    const missedFrameCount = Math.floor((nowMs - nextFrameAtMs) / framePeriodMs) + 1;
    nextFrameAtMs += missedFrameCount * framePeriodMs;
  }
  state.nextFrameAtMs = nextFrameAtMs;
  return Math.max(0, nextFrameAtMs - nowMs);
}

export function resetOverlayFrameDeadline(state: OverlayFrameDeadlineState): void {
  state.frameRate = undefined;
  state.nextFrameAtMs = undefined;
}

export function resolveManagedOverlayDisplayFrameRate(
  preferNative: boolean,
  electronFrameRate: number | undefined,
  nativeFrameRate: number | undefined
): number | undefined {
  const validElectronFrameRate = positiveFiniteFrameRate(electronFrameRate);
  const validNativeFrameRate = positiveFiniteFrameRate(nativeFrameRate);
  return preferNative
    ? validNativeFrameRate ?? validElectronFrameRate
    : validElectronFrameRate ?? validNativeFrameRate;
}

function positiveFiniteFrameRate(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}
