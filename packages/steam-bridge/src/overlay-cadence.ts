export interface OverlayFrameDeadlineState {
  frameRate?: number;
  nextFrameAtMs?: number;
}

export interface AdaptiveOverlayFrameRateSample {
  sampledAtMs: number;
  surfaceGeneration: number;
  displayRefreshRate: number;
  requestedFrameRate: number;
  effectiveFrameRate: number;
  sourceFrameCount: number;
  presentCount: number;
}

export interface AdaptiveOverlayFrameRateState {
  previousSample?: AdaptiveOverlayFrameRateSample;
  consecutiveOverloadSamples: number;
}

export interface AdaptiveOverlayFrameRateDecision {
  frameRate: number;
  presentSyncInterval: number;
  displayRefreshRate: number;
  sourceFrameRate: number;
  presentFrameRate: number;
}

const ADAPTIVE_FRAME_RATE_MIN_SAMPLE_MS = 750;
const ADAPTIVE_FRAME_RATE_MAX_SAMPLE_MS = 2_500;
const ADAPTIVE_FRAME_RATE_MIN_ACTIVE_SOURCE_FPS = 30;
const ADAPTIVE_FRAME_RATE_OVERLOAD_RATIO = 0.85;
const ADAPTIVE_FRAME_RATE_REQUIRED_OVERLOAD_SAMPLES = 3;
const ADAPTIVE_FRAME_RATE_MAX_SYNC_INTERVAL = 4;

/**
 * Detect a sustained Windows OSR/DXGI throughput mismatch and choose the
 * smallest exact VBlank divisor the measured pipeline can sustain. The state
 * intentionally has no recovery timer: an explicit rate/display change owns
 * recovery, avoiding a recurring high/low oscillation while gameplay is busy.
 */
export function observeAdaptiveOverlayFrameRate(
  state: AdaptiveOverlayFrameRateState,
  sample: AdaptiveOverlayFrameRateSample
): AdaptiveOverlayFrameRateDecision | undefined {
  const previous = state.previousSample;
  state.previousSample = sample;

  if (
    !previous ||
    previous.surfaceGeneration !== sample.surfaceGeneration ||
    previous.displayRefreshRate !== sample.displayRefreshRate ||
    sample.sourceFrameCount < previous.sourceFrameCount ||
    sample.presentCount < previous.presentCount
  ) {
    state.consecutiveOverloadSamples = 0;
    return undefined;
  }

  const elapsedMs = sample.sampledAtMs - previous.sampledAtMs;
  if (
    !Number.isFinite(elapsedMs) ||
    elapsedMs < ADAPTIVE_FRAME_RATE_MIN_SAMPLE_MS ||
    elapsedMs > ADAPTIVE_FRAME_RATE_MAX_SAMPLE_MS
  ) {
    state.consecutiveOverloadSamples = 0;
    return undefined;
  }

  const displayRefreshRate = sample.displayRefreshRate;
  const requestedFrameRate = sample.requestedFrameRate;
  const effectiveFrameRate = sample.effectiveFrameRate;
  const requestedDisplayRatio = requestedFrameRate / displayRefreshRate;
  if (
    displayRefreshRate < 120 ||
    requestedDisplayRatio < 0.95 ||
    requestedDisplayRatio > 1.05 ||
    effectiveFrameRate < displayRefreshRate / ADAPTIVE_FRAME_RATE_MAX_SYNC_INTERVAL
  ) {
    state.consecutiveOverloadSamples = 0;
    return undefined;
  }

  const elapsedSeconds = elapsedMs / 1_000;
  const sourceFrameRate = (sample.sourceFrameCount - previous.sourceFrameCount) / elapsedSeconds;
  const presentFrameRate = (sample.presentCount - previous.presentCount) / elapsedSeconds;
  const sustainableFrameRate = Math.min(sourceFrameRate, presentFrameRate);
  const overloaded =
    sourceFrameRate >= ADAPTIVE_FRAME_RATE_MIN_ACTIVE_SOURCE_FPS &&
    sustainableFrameRate < effectiveFrameRate * ADAPTIVE_FRAME_RATE_OVERLOAD_RATIO;
  if (!overloaded) {
    state.consecutiveOverloadSamples = 0;
    return undefined;
  }

  state.consecutiveOverloadSamples += 1;
  if (state.consecutiveOverloadSamples < ADAPTIVE_FRAME_RATE_REQUIRED_OVERLOAD_SAMPLES) {
    return undefined;
  }
  state.consecutiveOverloadSamples = 0;

  for (let syncInterval = 2; syncInterval <= ADAPTIVE_FRAME_RATE_MAX_SYNC_INTERVAL; syncInterval += 1) {
    const candidateFrameRate = displayRefreshRate / syncInterval;
    if (
      candidateFrameRate <= sustainableFrameRate * 1.02 &&
      candidateFrameRate < effectiveFrameRate * 0.9
    ) {
      return {
        frameRate: Math.max(1, Math.round(candidateFrameRate)),
        presentSyncInterval: syncInterval,
        displayRefreshRate,
        sourceFrameRate,
        presentFrameRate
      };
    }
  }

  const minimumSynchronizedFrameRate =
    displayRefreshRate / ADAPTIVE_FRAME_RATE_MAX_SYNC_INTERVAL;
  return minimumSynchronizedFrameRate < effectiveFrameRate * 0.9
    ? {
        frameRate: Math.max(1, Math.round(minimumSynchronizedFrameRate)),
        presentSyncInterval: ADAPTIVE_FRAME_RATE_MAX_SYNC_INTERVAL,
        displayRefreshRate,
        sourceFrameRate,
        presentFrameRate
      }
    : undefined;
}

export function resetAdaptiveOverlayFrameRate(state: AdaptiveOverlayFrameRateState): void {
  state.previousSample = undefined;
  state.consecutiveOverloadSamples = 0;
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
