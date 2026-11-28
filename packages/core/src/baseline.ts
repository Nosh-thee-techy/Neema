/**
 * Personal baseline: exponentially weighted mean/variance per signal.
 * Produces z-scores used only to escalate (never to lower a triage level).
 */

/** 'hr_ref' is her settled pulse: a slow average (about a day), restarted at birth. */
export type BaselineSignal = 'hr' | 'temp' | 'hr_ref';

/** Running personal baseline state for one mother / one signal. */
export interface BaselineState {
  signal: BaselineSignal;
  mean: number;
  /** Population-style EW variance. */
  variance: number;
  samples: number;
  lastUpdatedMs: number;
  /** Learning period before z-scores are trusted. */
  ready: boolean;
}

export interface BaselineUpdate {
  state: BaselineState;
  /** null until the learning period completes. */
  z: number | null;
}

const DEFAULT_ALPHA = 0.05;
/** ASSUMPTION: ~3 days of minute samples before baseline is trusted. */
const DEFAULT_MIN_SAMPLES = 3 * 24 * 60;

/**
 * Creates an empty baseline. Call updateBaseline with resting samples only.
 */
export function createBaseline(signal: BaselineSignal, nowMs: number): BaselineState {
  return {
    signal,
    mean: 0,
    variance: 0,
    samples: 0,
    lastUpdatedMs: nowMs,
    ready: false,
  };
}

/**
 * Updates the EWMA baseline with one resting sample and returns the new z-score.
 * During the learning period, z is null so triage ignores R8.
 */
export function updateBaseline(
  state: BaselineState,
  value: number,
  nowMs: number,
  opts?: { alpha?: number; minSamples?: number },
): BaselineUpdate {
  const alpha = opts?.alpha ?? DEFAULT_ALPHA;
  const minSamples = opts?.minSamples ?? DEFAULT_MIN_SAMPLES;

  if (state.samples === 0) {
    const next: BaselineState = {
      ...state,
      mean: value,
      variance: 0,
      samples: 1,
      lastUpdatedMs: nowMs,
      ready: false,
    };
    return { state: next, z: null };
  }

  const delta = value - state.mean;
  const mean = state.mean + alpha * delta;
  const variance = (1 - alpha) * (state.variance + alpha * delta * delta);
  const samples = state.samples + 1;
  const ready = samples >= minSamples;
  const std = Math.sqrt(Math.max(variance, 1e-6));
  const z = ready ? (value - mean) / std : null;

  return {
    state: {
      ...state,
      mean,
      variance,
      samples,
      lastUpdatedMs: nowMs,
      ready,
    },
    z,
  };
}

/**
 * Computes a z-score against an existing baseline without mutating it.
 * Returns null if the baseline is not ready.
 */
export function zScore(state: BaselineState, value: number): number | null {
  if (!state.ready || state.samples === 0) return null;
  const std = Math.sqrt(Math.max(state.variance, 1e-6));
  return (value - state.mean) / std;
}

/**
 * Settled pulse ("reference"): about one day of memory, so a rise over an afternoon
 * still stands out. The fast baseline above forgets within the hour by design.
 * ASSUMPTION: 6 hours of minutes before it is used. DRAFT, pending clinician review.
 */
export const REFERENCE_ALPHA = 1 / (24 * 60);
export const REFERENCE_MIN_SAMPLES = 6 * 60;

/** Updates her settled pulse with one minute. */
export function updateReference(state: BaselineState, value: number, nowMs: number): BaselineUpdate {
  return updateBaseline(state, value, nowMs, { alpha: REFERENCE_ALPHA, minSamples: REFERENCE_MIN_SAMPLES });
}

/** Her settled pulse in bpm, or null while it is still learning. */
export function referenceValue(state: BaselineState | null | undefined): number | null {
  if (!state || !state.ready || state.samples === 0) return null;
  return state.mean;
}

/** Minute samples needed before a baseline is trusted (about three days). */
export const BASELINE_MIN_SAMPLES = DEFAULT_MIN_SAMPLES;

/**
 * Her normal range: mean ± k standard deviations, for display.
 * Null until the learning period completes, so the UI never shows an untrusted range.
 */
export function normalRange(state: BaselineState, k = 2): { low: number; high: number } | null {
  if (!state.ready || state.samples === 0) return null;
  const std = Math.sqrt(Math.max(state.variance, 1e-6));
  return { low: state.mean - k * std, high: state.mean + k * std };
}

/** Share of the learning period completed, 0..1 (1 once the baseline is ready). */
export function baselineProgress(state: BaselineState, minSamples: number = DEFAULT_MIN_SAMPLES): number {
  if (state.ready) return 1;
  return Math.max(0, Math.min(1, state.samples / minSamples));
}
