import { describe, expect, it } from 'vitest';
import { BASELINE_MIN_SAMPLES, baselineProgress, createBaseline, normalRange } from '../src/baseline.js';

describe('normalRange / baselineProgress', () => {
  it('shows no range while the baseline is still learning', () => {
    const state = { ...createBaseline('hr', 0), samples: 600, mean: 72, variance: 9 };
    expect(normalRange(state)).toBeNull();
    expect(baselineProgress(state)).toBeCloseTo(600 / BASELINE_MIN_SAMPLES);
  });

  it('gives mean ± 2 SD once ready', () => {
    const state = { ...createBaseline('hr', 0), samples: BASELINE_MIN_SAMPLES, mean: 72, variance: 9, ready: true };
    expect(normalRange(state)).toEqual({ low: 66, high: 78 });
    expect(baselineProgress(state)).toBe(1);
  });
});
