import { useEffect, useState } from 'react';
import { bpCheckDue, type WatchPlan } from '@neema/core';
import { db } from '../storage/db';
import { loadProfile } from '../services/passport';
import { watchPlanFor } from '../services/watchPlan';

export interface WatchPlanSnapshot {
  plan: WatchPlan | null;
  /** Her latest blood pressure reading time, or null. */
  lastBpMs: number | null;
  /** True when her plan asks for a blood pressure reading and one is due. */
  bpDue: boolean;
}

/** Her watch plan today, reloaded when `refreshKey` changes (for example the triage level). */
export function useWatchPlan(refreshKey?: unknown): WatchPlanSnapshot {
  const [snap, setSnap] = useState<WatchPlanSnapshot>({ plan: null, lastBpMs: null, bpDue: false });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [profile, lastBp] = await Promise.all([
        loadProfile().catch(() => null),
        db.bp.orderBy('tsMs').last().catch(() => undefined),
      ]);
      if (cancelled) return;
      const now = Date.now();
      const plan = watchPlanFor(profile, now);
      const lastBpMs = lastBp?.tsMs ?? null;
      setSnap({ plan, lastBpMs, bpDue: bpCheckDue(plan, lastBpMs, now) });
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  return snap;
}
