/**
 * Her watch plan: what Neema watches more closely for this mother, and why.
 *
 * Built from what she (or her nurse / CHP) already told Neema at registration and when
 * the birth was recorded. The plan can only make Neema MORE careful: every limit it
 * touches can go down (more sensitive), never up, and a check it switches on can never
 * be switched off by another rule. Each item carries a plain reason and an end date.
 *
 * Every number here is a DRAFT placeholder, like triage.config.json, pending clinician
 * review. The plan never names an illness and never calls her "high-risk".
 */

import { parseLocalIsoDate, toLocalIsoDate } from './pregnancy.js';
import type { TriageConfig } from './triage.js';
import type { SymptomCode } from './types.js';

const DAY = 86_400_000;

/** How long after birth the after-birth items stay on (6 weeks). DRAFT. */
export const AFTER_BIRTH_WATCH_DAYS = 42;

/** The facts the plan needs. The app maps its saved profile onto this. */
export interface WatchPlanInput {
  nowMs: number;
  stage: 'pregnancy' | 'postpartum';
  /** Completed pregnancy weeks today (pregnancy only). */
  gaWeeks: number | null;
  /** Registration: problems in earlier pregnancies ('high_bp', 'bleeding', 'caesarean', 'loss', 'fits', ...). */
  pastComplications: readonly string[];
  /** Registration: ongoing conditions ('high_bp', 'anaemia', 'diabetes', 'heart', ...). */
  conditions: readonly string[];
  /** From Record birth (after birth only). */
  birth?: {
    /** Local calendar date of the birth, YYYY-MM-DD. */
    dateIso: string;
    mode: 'vaginal' | 'assisted' | 'caesarean';
    /** 'heavy_bleeding' | 'high_bp' | 'transfusion' | 'infection' | 'long_labour' */
    complications: readonly string[];
  };
}

/** What one rule tightens. Lower numbers are more careful. */
export interface WatchTighten {
  /** Temperature at which fever is flagged (°C). */
  feverTempC?: number;
  /** A resting pulse at or above this, held for a while, asks her to check (bpm). */
  restingFastBpm?: number;
  /** Switch on the slow-rise check: pulse this far above her settled pulse, held for a while (bpm). */
  slowRiseBpm?: number;
}

export interface WatchItem {
  id: WatchItemId;
  /**
   * Plain words. `en`/`sw` speak to her; `chpSw` is the same fact about her for the CHP's
   * SMS (third person, no full stop). No illness names except what she told us, no "high-risk".
   */
  reason: WatchReason;
  /** When this item eases back. Null while she is pregnant (ends at birth). */
  untilMs: number | null;
  tighten: WatchTighten;
  /** Questions added to every check-in while the item is on. */
  ask: SymptomCode[];
  /** Ask for a blood pressure reading this often (days). */
  bpEveryDays?: number;
}

export interface WatchReason {
  en: string;
  sw: string;
  chpSw: string;
}

export type WatchItemId =
  | 'pp_bleeding'
  | 'pp_bp'
  | 'pp_infection'
  | 'pp_caesarean'
  | 'preg_bp'
  | 'preg_after_loss'
  | 'anaemia';

export interface WatchPlan {
  items: WatchItem[];
  /** Triage settings for her: the general settings with her items applied, stricter wins. */
  config: TriageConfig;
  /** All extra check-in questions, in order, without repeats. */
  ask: SymptomCode[];
  /** Shortest blood pressure interval asked by any item, or null. */
  bpEveryDays: number | null;
}

interface WatchRule {
  id: WatchItemId;
  /** Returns the reason when the rule applies today, or null. */
  applies: (input: WatchPlanInput, ctx: RuleContext) => WatchReason | null;
  /** 'birth' = for AFTER_BIRTH_WATCH_DAYS after the birth; 'pregnancy' = while pregnant. */
  window: 'birth' | 'pregnancy' | 'pregnancy_and_birth';
  tighten: WatchTighten;
  ask: SymptomCode[];
  bpEveryDays?: number;
}

interface RuleContext {
  has: (list: readonly string[], key: string) => boolean;
  reducedMovementFromWeeks: number;
}

/**
 * The rules, one row each. DRAFT numbers, pending clinician review.
 * Order is the order she sees them in.
 */
const RULES: WatchRule[] = [
  {
    id: 'pp_bleeding',
    window: 'birth',
    applies: (i, c) => {
      const birth = i.birth?.complications ?? [];
      if (c.has(birth, 'heavy_bleeding') || c.has(birth, 'transfusion')) {
        return { en: 'You bled heavily when you gave birth.', sw: 'Ulitoka damu nyingi ulipojifungua.', chpSw: 'alitoka damu nyingi alipojifungua' };
      }
      if (c.has(i.pastComplications, 'bleeding')) {
        return { en: 'You bled heavily after an earlier birth.', sw: 'Ulitoka damu nyingi baada ya kujifungua awali.', chpSw: 'alitoka damu nyingi baada ya kujifungua awali' };
      }
      return null;
    },
    tighten: { restingFastBpm: 100, slowRiseBpm: 15 },
    ask: ['bleeding_heavier', 'dizzy_faint', 'chest_pain_breathless'],
  },
  {
    id: 'pp_bp',
    window: 'birth',
    applies: (i, c) => {
      if (c.has(i.birth?.complications ?? [], 'high_bp')) {
        return { en: 'Your blood pressure was high around the birth.', sw: 'Shinikizo lako la damu lilikuwa juu wakati wa kujifungua.', chpSw: 'shinikizo la damu lilikuwa juu alipojifungua' };
      }
      if (c.has(i.conditions, 'high_bp') || c.has(i.pastComplications, 'high_bp')) {
        return { en: 'You have had high blood pressure before.', sw: 'Umewahi kuwa na shinikizo la juu la damu.', chpSw: 'amewahi kuwa na shinikizo la juu la damu' };
      }
      return null;
    },
    tighten: {},
    ask: ['headache', 'blurred_vision', 'upper_abdominal_pain'],
    bpEveryDays: 2,
  },
  {
    id: 'pp_infection',
    window: 'birth',
    applies: (i, c) => {
      const birth = i.birth?.complications ?? [];
      if (c.has(birth, 'infection')) return { en: 'You had an infection around the birth.', sw: 'Ulipata maambukizi wakati wa kujifungua.', chpSw: 'alipata maambukizi alipojifungua' };
      if (c.has(birth, 'long_labour')) return { en: 'Your labour was long.', sw: 'Uchungu wako ulichukua muda mrefu.', chpSw: 'uchungu wake ulichukua muda mrefu' };
      return null;
    },
    tighten: { feverTempC: 37.8 },
    ask: ['fever_chills', 'foul_discharge'],
  },
  {
    id: 'pp_caesarean',
    window: 'birth',
    applies: (i) =>
      i.birth?.mode === 'caesarean'
        ? { en: 'Your baby was born by operation (caesarean).', sw: 'Mtoto wako alizaliwa kwa upasuaji.', chpSw: 'alijifungua kwa upasuaji' }
        : null,
    tighten: {},
    ask: ['wound_problem', 'fever_chills'],
  },
  {
    id: 'preg_bp',
    window: 'pregnancy',
    applies: (i, c) =>
      c.has(i.conditions, 'high_bp') || c.has(i.pastComplications, 'high_bp')
        ? { en: 'You have had high blood pressure before.', sw: 'Umewahi kuwa na shinikizo la juu la damu.', chpSw: 'amewahi kuwa na shinikizo la juu la damu' }
        : null,
    tighten: {},
    ask: ['headache', 'blurred_vision', 'upper_abdominal_pain', 'swelling_face_hands'],
    bpEveryDays: 2,
  },
  {
    id: 'preg_after_loss',
    window: 'pregnancy',
    applies: (i, c) =>
      c.has(i.pastComplications, 'loss') && i.gaWeeks !== null && i.gaWeeks >= c.reducedMovementFromWeeks
        ? { en: 'You lost a pregnancy before, so Neema asks about your baby’s movements every day.', sw: 'Uliwahi kupoteza mimba, kwa hivyo Neema inauliza kuhusu mwendo wa mtoto kila siku.', chpSw: 'aliwahi kupoteza mimba' }
        : null,
    tighten: {},
    ask: ['baby_moving_less'],
  },
  {
    id: 'anaemia',
    window: 'pregnancy_and_birth',
    applies: (i, c) =>
      c.has(i.conditions, 'anaemia')
        ? { en: 'You told us you have low blood (anaemia).', sw: 'Ulituambia una upungufu wa damu.', chpSw: 'ana upungufu wa damu' }
        : null,
    tighten: {},
    ask: ['dizzy_faint', 'chest_pain_breathless'],
  },
];

/**
 * Builds her plan for `input.nowMs`. Pure: it saves nothing and reads no clock.
 * With nothing in her history, the plan is empty and the config is the general one.
 */
export function buildWatchPlan(input: WatchPlanInput, base: TriageConfig): WatchPlan {
  const ctx: RuleContext = {
    has: (list, key) => list.includes(key),
    reducedMovementFromWeeks: base.reducedMovementMinGestationWeeks,
  };
  const birthStartMs = input.birth ? parseLocalIsoDate(input.birth.dateIso) : null;
  const birthUntilMs = birthStartMs === null ? null : birthStartMs + (AFTER_BIRTH_WATCH_DAYS + 1) * DAY;

  const items: WatchItem[] = [];
  for (const rule of RULES) {
    let untilMs: number | null;
    if (input.stage === 'pregnancy') {
      if (rule.window === 'birth') continue;
      untilMs = null;
    } else {
      if (rule.window === 'pregnancy') continue;
      // After birth without a usable birth date there is no window to count: skip quietly.
      if (birthUntilMs === null || input.nowMs >= birthUntilMs) continue;
      untilMs = birthUntilMs;
    }
    const reason = rule.applies(input, ctx);
    if (!reason) continue;
    items.push({
      id: rule.id,
      reason,
      untilMs,
      tighten: { ...rule.tighten },
      ask: [...rule.ask],
      ...(rule.bpEveryDays !== undefined ? { bpEveryDays: rule.bpEveryDays } : {}),
    });
  }

  let config = base;
  for (const item of items) config = applyStricter(config, item.tighten);

  const ask: SymptomCode[] = [];
  for (const item of items) for (const code of item.ask) if (!ask.includes(code)) ask.push(code);

  const intervals = items.map((i) => i.bpEveryDays).filter((d): d is number => d !== undefined);
  return {
    items,
    config,
    ask,
    bpEveryDays: intervals.length ? Math.min(...intervals) : null,
  };
}

/**
 * Applies one item's tightening to a config. Stricter always wins:
 * a limit only ever goes down, and the slow-rise check only ever switches on.
 * Returns a new object; `base` is never changed.
 */
export function applyStricter(base: TriageConfig, tighten: WatchTighten): TriageConfig {
  const lower = (current: number, next: number | undefined) => (next === undefined ? current : Math.min(current, next));
  const lowerOrOn = (current: number | null, next: number | undefined) =>
    next === undefined ? current : current === null ? next : Math.min(current, next);

  const slow = base.pulse.slowRise;
  return {
    ...base,
    fever: { ...base.fever, tempC: lower(base.fever.tempC, tighten.feverTempC) },
    pulse: {
      ...base.pulse,
      restingFastBpm: lowerOrOn(base.pulse.restingFastBpm, tighten.restingFastBpm),
      slowRise:
        tighten.slowRiseBpm === undefined
          ? { ...slow }
          : {
              ...slow,
              enabled: true,
              bpmAboveReference: slow.enabled ? Math.min(slow.bpmAboveReference, tighten.slowRiseBpm) : tighten.slowRiseBpm,
            },
    },
  };
}

/** Is a blood pressure reading due, given the plan and her latest reading time? */
export function bpCheckDue(plan: WatchPlan, lastBpMs: number | null, nowMs: number): boolean {
  if (plan.bpEveryDays === null) return false;
  if (lastBpMs === null) return true;
  return nowMs - lastBpMs >= plan.bpEveryDays * DAY;
}

/** Daytime hours (local) when a gentle band buzz for a due check is allowed. */
export const NUDGE_HOURS = { from: 7, to: 20 } as const;

/**
 * Should the band give one gentle buzz because a check her plan asks for is due?
 * At most once a day, only in daytime, never for a check already done.
 * Returns the local day to remember when it does buzz.
 */
export function dueCheckNudge(
  plan: WatchPlan,
  lastBpMs: number | null,
  nowMs: number,
  lastNudgedDayIso: string | null,
): { nudge: boolean; dayIso: string } {
  const dayIso = toLocalIsoDate(nowMs);
  const hour = new Date(nowMs).getHours();
  const daytime = hour >= NUDGE_HOURS.from && hour < NUDGE_HOURS.to;
  const nudge = daytime && lastNudgedDayIso !== dayIso && bpCheckDue(plan, lastBpMs, nowMs);
  return { nudge, dayIso };
}
