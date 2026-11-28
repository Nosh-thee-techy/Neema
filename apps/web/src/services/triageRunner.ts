/**
 * Loads recent local data and runs evaluateTriage.
 * Sticky RED is always loaded from IndexedDB (unacknowledged RED stays active).
 */

import {
  evaluateTriage,
  referenceValue,
  zScore,
  type TriageConfig,
  type BpReading,
  type Stage,
  type SymptomReport,
  type TriageResult,
} from '@neema/core';
import { db } from '../storage/db';
import { activeRedAlert } from './alerts';

export interface RunnerOptions {
  nowMs?: number;
  stage: Stage;
  gestationWeeks?: number;
  sosActive: boolean;
  markedResting: boolean;
  /** IANA zone for sleep window; default Africa/Nairobi. */
  timeZone?: string;
  /** Her watch-plan settings (stricter than the general ones). Default: general settings. */
  config?: TriageConfig;
}

/**
 * Returns the active unacknowledged RED alert result shape if one exists.
 */
export async function loadStickyRed(nowMs: number = Date.now()): Promise<TriageResult | null> {
  const active = await activeRedAlert();
  if (!active) return null;
  return {
    level: 'RED',
    firedRules: active.firedRules,
    reasons: active.reasons?.length ? [...active.reasons, 'sticky_red'] : ['sticky_red'],
    messageKey: active.firedRules.includes('R5_HEAVY_BLEEDING')
      ? 'red_bleeding'
      : active.firedRules.includes('R9_SOS')
        ? 'red_sos'
        : 'red_go_now',
    configVersion: 'sticky',
    evaluatedAtMs: nowMs,
  };
}

/**
 * Runs triage against IndexedDB history + current SOS/rest flags.
 * Unacknowledged RED from the alerts table always wins until cleared.
 */
export async function runTriage(options: RunnerOptions): Promise<TriageResult> {
  const nowMs = options.nowMs ?? Date.now();
  const sticky = await loadStickyRed(nowMs);
  if (sticky) return sticky;

  const since = nowMs - 30 * 60_000;
  const vitals = await db.vitalsMinutes.where('tsMs').aboveOrEqual(since).sortBy('tsMs');
  const bp = (await db.bp.orderBy('tsMs').toArray()).filter((b) => b.tsMs >= since) as BpReading[];
  const symptoms = (await db.symptoms.orderBy('tsMs').toArray()).filter(
    (s) => s.tsMs >= since,
  ) as SymptomReport[];

  const hrBaseline = await db.baseline.get('hr');
  const tempBaseline = await db.baseline.get('temp');
  const settled = await db.baseline.get('hr_ref');
  const latest = vitals[vitals.length - 1];

  const input = {
    nowMs,
    stage: options.stage,
    ...(options.gestationWeeks !== undefined ? { gestationWeeks: options.gestationWeeks } : {}),
    vitals,
    bp,
    symptoms,
    sosActive: options.sosActive,
    markedResting: options.markedResting,
    timeZone: options.timeZone ?? 'Africa/Nairobi',
    baselineZ: {
      hr:
        hrBaseline && latest?.hrMean !== null && latest?.hrMean !== undefined
          ? zScore(
              {
                signal: 'hr',
                mean: hrBaseline.mean,
                variance: hrBaseline.variance,
                samples: hrBaseline.samples,
                lastUpdatedMs: hrBaseline.lastUpdatedMs,
                ready: hrBaseline.ready,
              },
              latest.hrMean,
            )
          : null,
      temp:
        tempBaseline && latest?.tempMeanC !== null && latest?.tempMeanC !== undefined
          ? zScore(
              {
                signal: 'temp',
                mean: tempBaseline.mean,
                variance: tempBaseline.variance,
                samples: tempBaseline.samples,
                lastUpdatedMs: tempBaseline.lastUpdatedMs,
                ready: tempBaseline.ready,
              },
              latest.tempMeanC,
            )
          : null,
    },
    hrReference: settled
      ? referenceValue({
          signal: 'hr_ref',
          mean: settled.mean,
          variance: settled.variance,
          samples: settled.samples,
          lastUpdatedMs: settled.lastUpdatedMs,
          ready: settled.ready,
        })
      : null,
  };
  return options.config ? evaluateTriage(input, options.config) : evaluateTriage(input);
}
