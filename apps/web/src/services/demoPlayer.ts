/**
 * One-tap demo scenarios for the stage (project doc §14).
 *
 * Writes the scripted inputs from @neema/core's DEMO_SCENARIOS into the local store,
 * so the real triage runner, alert chain, speech and SMS run exactly as in field use.
 * The 10-minute fever window in scenario D is backfilled, so no one waits on stage.
 *
 * Only for demo mode: it clears readings and alerts on this phone first.
 */

import { BASELINE_MIN_SAMPLES, getDemoScenario, type DemoScenarioId, type Stage } from '@neema/core';
import { db } from '../storage/db';
import { getReadiness } from './readiness';

/** Steps the presenter can tap. B has two steps: the warning, then the recheck. */
export type DemoStep = 'A' | 'B_warning' | 'B_recheck' | 'C' | 'D';

export interface DemoStepPlan {
  step: DemoStep;
  /** Simulator band scenario that keeps the live numbers consistent with the story. */
  bandScenario: 1 | 2 | 3;
  stage: Stage;
  gestationWeeks?: number;
}

const PLANS: Record<DemoStep, DemoStepPlan> = {
  A: { step: 'A', bandScenario: 1, stage: 'pregnancy', gestationWeeks: 32 },
  B_warning: { step: 'B_warning', bandScenario: 1, stage: 'pregnancy', gestationWeeks: 32 },
  B_recheck: { step: 'B_recheck', bandScenario: 1, stage: 'pregnancy', gestationWeeks: 32 },
  C: { step: 'C', bandScenario: 1, stage: 'pregnancy', gestationWeeks: 32 },
  D: { step: 'D', bandScenario: 3, stage: 'postpartum' },
};

const CORE_ID: Record<DemoStep, DemoScenarioId> = {
  A: 'A',
  B_warning: 'B_yellow',
  B_recheck: 'B_settled',
  C: 'C',
  D: 'D',
};

/** Clears readings, alerts and daily summaries. Profile, contacts and consent stay. */
export async function resetDemoData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.vitalsMinutes, db.vitalsDaily, db.bp, db.symptoms, db.alerts, db.baseline],
    async () => {
      await Promise.all([
        db.vitalsMinutes.clear(),
        db.vitalsDaily.clear(),
        db.bp.clear(),
        db.symptoms.clear(),
        db.alerts.clear(),
        db.baseline.clear(),
      ]);
    },
  );
}

/**
 * A scripted "learned" baseline so the stage demo can show her normal band
 * (project doc demo script, 0:30). Real phones learn it over about three days.
 * Values sit around the scenario A night (heart rate 70–78, skin temperature ~36.9 °C).
 */
async function seedDemoBaseline(nowMs: number): Promise<void> {
  await db.baseline.bulkPut([
    { id: 'hr', mean: 73, variance: 9, samples: BASELINE_MIN_SAMPLES, lastUpdatedMs: nowMs, ready: true },
    { id: 'temp', mean: 36.9, variance: 0.04, samples: BASELINE_MIN_SAMPLES, lastUpdatedMs: nowMs, ready: true },
  ]);
}

/** True when demo tools may run (field-ready installs never get them). */
export async function demoToolsAllowed(): Promise<boolean> {
  const readiness = await getReadiness();
  return !readiness.fieldReady;
}

/**
 * Seeds one demo step and returns how the guardian should run it.
 * B_recheck adds only the second BP reading on top of B_warning, so the
 * recheck story (YELLOW → GREEN) is the real recheck logic, not a reset.
 */
export async function seedDemoStep(step: DemoStep, nowMs: number = Date.now()): Promise<DemoStepPlan> {
  if (!(await demoToolsAllowed())) {
    throw new Error('Demo scenarios are switched off once the app is field-ready.');
  }
  const input = getDemoScenario(CORE_ID[step]).buildInput(nowMs);

  if (step === 'B_recheck') {
    const recheck = input.bp[input.bp.length - 1];
    if (recheck) await db.bp.put({ ...recheck, id: crypto.randomUUID(), tsMs: nowMs });
    return PLANS[step];
  }

  await resetDemoData();
  await seedDemoBaseline(nowMs);
  await db.vitalsMinutes.bulkPut(input.vitals);
  if (input.bp.length) await db.bp.bulkPut(input.bp.map((b) => ({ ...b, id: crypto.randomUUID() })));
  if (input.symptoms.length) {
    await db.symptoms.bulkPut(input.symptoms.map((s) => ({ ...s, id: crypto.randomUUID() })));
  }
  return PLANS[step];
}
