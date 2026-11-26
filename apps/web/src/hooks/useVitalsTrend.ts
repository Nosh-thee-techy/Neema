/**
 * Recent minute history and her personal baseline, for the dashboard charts.
 * Reads only the phone's own store; refreshes every 30 s and when `refreshKey` changes.
 */

import { useEffect, useState } from 'react';
import {
  baselineProgress,
  normalRange,
  type BaselineState,
  type VitalsMinute,
} from '@neema/core';
import { loadBaseline } from '../services/baselineStore';
import { db } from '../storage/db';

export interface SignalBaseline {
  /** Her normal range (mean ± 2 SD), or null while still learning. */
  range: { low: number; high: number } | null;
  /** 0..1 share of the ~3-day learning period done. */
  progress: number;
  mean: number | null;
}

export interface VitalsTrend {
  minutes: VitalsMinute[];
  hr: SignalBaseline;
  temp: SignalBaseline;
  loaded: boolean;
}

const EMPTY_BASELINE: SignalBaseline = { range: null, progress: 0, mean: null };
const EMPTY: VitalsTrend = { minutes: [], hr: EMPTY_BASELINE, temp: EMPTY_BASELINE, loaded: false };

function summarise(state: BaselineState): SignalBaseline {
  return {
    range: normalRange(state),
    progress: baselineProgress(state),
    mean: state.samples > 0 ? state.mean : null,
  };
}

/** Loads the last `windowMinutes` of stored minutes plus HR and temperature baselines. */
export function useVitalsTrend(refreshKey: unknown, windowMinutes = 60): VitalsTrend {
  const [trend, setTrend] = useState<VitalsTrend>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const since = Date.now() - windowMinutes * 60_000;
      const [minutes, hr, temp] = await Promise.all([
        db.vitalsMinutes.where('tsMs').aboveOrEqual(since).sortBy('tsMs'),
        loadBaseline('hr'),
        loadBaseline('temp'),
      ]);
      if (!cancelled) setTrend({ minutes, hr: summarise(hr), temp: summarise(temp), loaded: true });
    }
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refreshKey, windowMinutes]);

  return trend;
}
