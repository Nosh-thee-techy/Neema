/**
 * Deterministic GREEN / YELLOW / RED / UNKNOWN triage.
 * Rules decide the level. Baseline z-scores may only escalate to YELLOW.
 * No diagnosis wording — action keys only.
 */

import triageConfig from './config/triage.config.json';
import type {
  RuleId,
  SymptomCode,
  SymptomReport,
  TriageInput,
  TriageLevel,
  TriageResult,
  VitalsMinute,
} from './types.js';

/** Shape of nested triage.config.json (placeholders pending clinician review). */
export interface TriageConfig {
  version: string;
  notes: string;
  bp: {
    severeSys: number;
    severeDia: number;
    raisedSys: number;
    raisedDia: number;
    persistMinutes: number;
  };
  fever: { tempC: number; windowMinutes: number };
  pulse: {
    postpartumFastBpm: number;
    baselineZ: number;
    /**
     * R18: a resting pulse at or above this, held for slowRise.sustainMinutes, asks her to check.
     * Null (off) in the general settings; her watch plan can switch it on. DRAFT.
     */
    restingFastBpm: number | null;
    /**
     * R19: pulse held this far above her settled pulse (the slow reference, not the
     * fast baseline that re-learns within the hour). Off in the general settings. DRAFT.
     */
    slowRise: { enabled: boolean; bpmAboveReference: number; sustainMinutes: number };
  };
  shockIndex: { referral: number; maxBpAgeMinutes: number };
  signal: { minValidFraction: number; staleMinutes: number };
  recheckMinutes: number;
  sleepWindow: { startHour: number; endHour: number };
  tempCalibrationOffsetC: number;
  warningBpSymptoms: SymptomCode[];
  reducedMovementMinGestationWeeks: number;
}

const DEFAULT_CONFIG = triageConfig as TriageConfig;

/** Severity rank: RED > YELLOW > UNKNOWN > GREEN. */
const LEVEL_RANK: Record<TriageLevel, number> = {
  GREEN: 0,
  UNKNOWN: 1,
  YELLOW: 2,
  RED: 3,
};

const MIN = 60_000;

interface PartialHit {
  level: TriageLevel;
  rule: RuleId;
  reason: string;
  messageKey: string;
  recheckInMinutes?: number;
}

/**
 * Evaluates triage from a pure input object.
 * Safety: UNKNOWN never becomes GREEN; ML/baseline can only raise to YELLOW.
 */
export function evaluateTriage(
  input: TriageInput,
  config: TriageConfig = DEFAULT_CONFIG,
): TriageResult {
  const hits: PartialHit[] = [];
  const add = (hit: PartialHit) => hits.push(hit);

  const symptoms = new Set(flattenCodes(input.symptoms));
  const bpLatest = latestReading(input.bp);
  const hasWarningSymptom = config.warningBpSymptoms.some((s) => symptoms.has(s));
  const resting = isRestContext(input.markedResting, input.nowMs, config, input.timeZone);

  const recent = input.vitals.filter(
    (v) => input.nowMs - v.tsMs <= config.fever.windowMinutes * MIN,
  );
  const temps = recent.map((v) => v.tempMeanC).filter((t): t is number => t !== null);
  const hrs = recent.map((v) => v.hrMean).filter((h): h is number => h !== null);
  const meanTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  const meanHr = hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : null;
  const haveVitals = temps.length > 0 || hrs.length > 0;
  const latest = latestMinute(input.vitals);
  const vitalsUsable =
    haveVitals &&
    !!latest &&
    latest.validFraction >= config.signal.minValidFraction &&
    input.nowMs - latest.tsMs <= config.signal.staleMinutes * MIN;

  // R9 SOS — immediate RED
  if (input.sosActive) {
    add({ level: 'RED', rule: 'R9_SOS', reason: 'sos', messageKey: 'red_sos' });
  }

  // Blood pressure R1–R4
  if (bpLatest) {
    const severe =
      bpLatest.systolic >= config.bp.severeSys || bpLatest.diastolic >= config.bp.severeDia;
    const raised =
      bpLatest.systolic >= config.bp.raisedSys || bpLatest.diastolic >= config.bp.raisedDia;
    if (severe) {
      add({ level: 'RED', rule: 'R1_SEVERE_BP', reason: 'bp_severe', messageKey: 'red_go_now' });
    } else if (raised) {
      add({
        level: 'YELLOW',
        rule: 'R2_RAISED_BP',
        reason: 'bp_raised',
        messageKey: 'yellow_recheck_bp',
        recheckInMinutes: config.recheckMinutes,
      });
    }
    if (raised && hasWarningSymptom) {
      add({
        level: 'RED',
        rule: 'R3_RAISED_BP_WITH_SYMPTOM',
        reason: 'bp_raised_with_symptom',
        messageKey: 'red_go_now',
      });
    }
    const earlierRaised = input.bp.slice(0, -1).some(
      (b) =>
        (b.systolic >= config.bp.raisedSys || b.diastolic >= config.bp.raisedDia) &&
        bpLatest.tsMs - b.tsMs >= config.bp.persistMinutes * MIN,
    );
    if (raised && earlierRaised) {
      add({
        level: 'RED',
        rule: 'R4_RAISED_BP_PERSISTS',
        reason: 'bp_raised_persists',
        messageKey: 'red_go_now',
      });
    }
  }

  // R5 heavy bleeding
  if (symptoms.has('heavy_bleeding')) {
    add({
      level: 'RED',
      rule: 'R5_HEAVY_BLEEDING',
      reason: 'heavy_bleeding',
      messageKey: 'red_bleeding',
    });
  }

  // R6 / R7 fever (+ postpartum fast pulse)
  const fever =
    (meanTemp !== null && meanTemp >= config.fever.tempC) || symptoms.has('fever_chills');
  if (fever) {
    add({
      level: 'YELLOW',
      rule: 'R6_FEVER',
      reason: 'fever',
      messageKey: 'yellow_fever',
      recheckInMinutes: config.recheckMinutes,
    });
    if (
      input.stage === 'postpartum' &&
      resting &&
      meanHr !== null &&
      meanHr >= config.pulse.postpartumFastBpm
    ) {
      add({
        level: 'RED',
        rule: 'R7_FEVER_FAST_PULSE_POSTPARTUM',
        reason: 'fever_fast_pulse',
        messageKey: 'red_go_now',
      });
    }
  }

  // R8 personal baseline — escalate only
  if (
    resting &&
    input.baselineZ.hr !== null &&
    input.baselineZ.hr >= config.pulse.baselineZ
  ) {
    add({
      level: 'YELLOW',
      rule: 'R8_PULSE_ABOVE_BASELINE',
      reason: 'pulse_above_baseline',
      messageKey: 'yellow_pulse_baseline',
      recheckInMinutes: config.recheckMinutes,
    });
  }

  // R18 / R19 her watch plan: a pulse that stays fast at rest, or keeps climbing.
  // Both read a sustained window, not one minute, and both only ask her to check (YELLOW).
  const sustained = sustainedHr(input.vitals, input.nowMs, config.pulse.slowRise.sustainMinutes);
  if (vitalsUsable && resting && sustained !== null) {
    const fastLimit = config.pulse.restingFastBpm;
    if (fastLimit !== null && sustained >= fastLimit) {
      add({
        level: 'YELLOW',
        rule: 'R18_PULSE_FAST_AT_REST',
        reason: 'pulse_fast_resting',
        messageKey: 'yellow_pulse_baseline',
        recheckInMinutes: config.recheckMinutes,
      });
    }
    const ref = input.hrReference ?? null;
    if (
      config.pulse.slowRise.enabled &&
      ref !== null &&
      sustained - ref >= config.pulse.slowRise.bpmAboveReference
    ) {
      add({
        level: 'YELLOW',
        rule: 'R19_PULSE_RISING',
        reason: 'pulse_rising',
        messageKey: 'yellow_pulse_baseline',
        recheckInMinutes: config.recheckMinutes,
      });
    }
  }

  // R13 shock index (HR / systolic), resting + fresh BP only
  if (
    bpLatest &&
    resting &&
    meanHr !== null &&
    input.nowMs - bpLatest.tsMs <= config.shockIndex.maxBpAgeMinutes * MIN &&
    bpLatest.systolic > 0 &&
    meanHr / bpLatest.systolic >= config.shockIndex.referral
  ) {
    add({
      level: 'RED',
      rule: 'R13_SHOCK_INDEX',
      reason: 'shock_index_high',
      messageKey: 'red_go_now',
    });
  }

  // R15 emergency danger signs reported by the mother (DRAFT rule: clinician sign-off pending).
  // Fainting, chest pain/breathlessness, fits and severe tummy pain are emergencies at any stage.
  // After birth, a headache together with blurred vision is also treated as an emergency
  // (dangerous blood pressure can start after birth, even before BP is measured).
  const emergencySign =
    symptoms.has('dizzy_faint') ||
    symptoms.has('chest_pain_breathless') ||
    symptoms.has('fits') ||
    symptoms.has('severe_abdominal_pain') ||
    (input.stage === 'postpartum' && symptoms.has('headache') && symptoms.has('blurred_vision'));
  if (emergencySign) {
    add({ level: 'RED', rule: 'R15_EMERGENCY_SIGN', reason: 'emergency_sign', messageKey: 'red_go_now' });
  }

  // R16 thoughts of harming herself or her baby: a person must respond now.
  if (symptoms.has('thoughts_of_harm')) {
    add({ level: 'RED', rule: 'R16_THOUGHTS_OF_HARM', reason: 'thoughts_of_harm', messageKey: 'red_talk_now' });
  }

  // R17 after-birth signs that need a health worker the same day (DRAFT rule).
  if (
    symptoms.has('foul_discharge') ||
    symptoms.has('wound_problem') ||
    symptoms.has('leg_pain_swelling') ||
    symptoms.has('breast_red_painful') ||
    symptoms.has('urine_problem') ||
    symptoms.has('bleeding_heavier')
  ) {
    add({
      level: 'YELLOW',
      rule: 'R17_POSTPARTUM_REVIEW_SIGN',
      reason: 'review_sign_today',
      messageKey: 'yellow_review_today',
    });
  }

  // R10 reduced baby movement (pregnancy only)
  if (input.stage === 'pregnancy' && symptoms.has('baby_moving_less')) {
    const weeks = input.gestationWeeks;
    if (weeks === undefined || weeks >= config.reducedMovementMinGestationWeeks) {
      add({
        level: 'YELLOW',
        rule: 'R10_REDUCED_BABY_MOVEMENT',
        reason: 'baby_moving_less',
        messageKey: 'yellow_baby_movement',
      });
    }
  }

  // R14 signal lost but symptoms present
  if (!vitalsUsable && symptoms.size > 0) {
    add({
      level: 'YELLOW',
      rule: 'R14_SIGNAL_LOST_WITH_SYMPTOMS',
      reason: 'signal_lost_with_symptoms',
      messageKey: 'yellow_signal_lost',
      recheckInMinutes: config.recheckMinutes,
    });
  }

  // R11 no usable data at all
  if (!vitalsUsable && !bpLatest && symptoms.size === 0 && !input.sosActive) {
    add({
      level: 'UNKNOWN',
      rule: 'R11_SIGNAL_INVALID',
      reason: 'signal_invalid',
      messageKey: 'unknown_check_band',
    });
  }

  if (hits.length === 0) {
    add({
      level: 'GREEN',
      rule: 'R12_NOTHING_CONCERNING',
      reason: 'nothing_concerning',
      messageKey: 'green_calm',
    });
  }

  return resultOf(hits, input.nowMs, config.version);
}

/** Applies skin-temperature calibration offset from config. */
export function calibrateSkinTempC(
  rawC: number,
  config: TriageConfig = DEFAULT_CONFIG,
): number {
  return rawC + config.tempCalibrationOffsetC;
}

function resultOf(hits: PartialHit[], nowMs: number, configVersion: string): TriageResult {
  let best = hits[0]!;
  for (const hit of hits) {
    if (LEVEL_RANK[hit.level] > LEVEL_RANK[best.level]) best = hit;
  }

  const firedRules = hits.map((h) => h.rule);
  const reasons = [...new Set(hits.map((h) => h.reason))];
  const recheck = hits.find(
    (h) => h.level === best.level && h.recheckInMinutes !== undefined,
  );

  const result: TriageResult = {
    level: best.level,
    firedRules,
    reasons,
    messageKey: best.messageKey,
    configVersion,
    evaluatedAtMs: nowMs,
  };
  if (recheck?.recheckInMinutes !== undefined) {
    result.recheckInMinutes = recheck.recheckInMinutes;
  }
  return result;
}

/**
 * Mean heart rate over the last `minutes`, or null when fewer than 60% of those
 * minutes carry a valid heart rate (a gap is not read as a calm pulse).
 */
function sustainedHr(vitals: VitalsMinute[], nowMs: number, minutes: number): number | null {
  const inWindow = vitals.filter((v) => nowMs - v.tsMs <= minutes * MIN && v.hrMean !== null);
  if (inWindow.length < Math.ceil(minutes * 0.6)) return null;
  return inWindow.reduce((a, v) => a + (v.hrMean as number), 0) / inWindow.length;
}

function latestMinute(vitals: VitalsMinute[]): VitalsMinute | undefined {
  return vitals.length ? vitals[vitals.length - 1] : undefined;
}

function latestReading<T extends { tsMs: number }>(items: T[]): T | undefined {
  return items.length ? items[items.length - 1] : undefined;
}

function flattenCodes(reports: SymptomReport[]): SymptomCode[] {
  return reports.flatMap((r) => r.codes);
}

/**
 * Local hour (0–23) in an IANA zone, or UTC when zone is omitted/invalid.
 */
export function localHour(nowMs: number, timeZone?: string): number {
  if (!timeZone) return new Date(nowMs).getUTCHours();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date(nowMs));
    const hourPart = parts.find((p) => p.type === 'hour')?.value;
    return hourPart ? Number(hourPart) : new Date(nowMs).getUTCHours();
  } catch {
    return new Date(nowMs).getUTCHours();
  }
}

function isRestContext(
  markedResting: boolean,
  nowMs: number,
  config: TriageConfig,
  timeZone?: string,
): boolean {
  if (markedResting) return true;
  const hour = localHour(nowMs, timeZone);
  const { startHour, endHour } = config.sleepWindow;
  if (startHour > endHour) return hour >= startHour || hour < endHour;
  return hour >= startHour && hour < endHour;
}

/** Exported for tests and the config UI later. */
export function getDefaultTriageConfig(): TriageConfig {
  return DEFAULT_CONFIG;
}
