/**
 * Her watch plan in the app: maps the saved profile onto @neema/core's buildWatchPlan.
 * See docs/WATCH_PLAN.md. The plan can only make Neema more careful.
 */

import { buildWatchPlan, getDefaultTriageConfig, type WatchPlan, type WatchPlanInput } from '@neema/core';
import type { MamaProfile } from './passport';
import { progressFromProfile } from './pregnancyProgress';

/** Facts from her profile that the plan reads. */
export function watchInputFromProfile(profile: MamaProfile, nowMs: number = Date.now()): WatchPlanInput {
  const stage = profile.stage;
  const weeks = stage === 'pregnancy' ? (progressFromProfile(profile, nowMs)?.weeks ?? profile.gestationWeeks ?? null) : null;
  const d = profile.delivery;
  return {
    nowMs,
    stage,
    gaWeeks: weeks,
    pastComplications: profile.pastComplications ?? [],
    conditions: profile.conditions ?? [],
    ...(stage === 'postpartum' && d
      ? { birth: { dateIso: d.dateIso, mode: d.mode, complications: d.complications ?? [] } }
      : {}),
  };
}

/** Her plan today. With no profile (locked, demo, not registered) the plan is empty. */
export function watchPlanFor(profile: MamaProfile | null | undefined, nowMs: number = Date.now()): WatchPlan {
  const base = getDefaultTriageConfig();
  if (!profile) return { items: [], config: base, ask: [], bpEveryDays: null };
  return buildWatchPlan(watchInputFromProfile(profile, nowMs), base);
}
