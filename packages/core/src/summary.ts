/**
 * Builds a one-page nurse summary payload for QR / on-screen handover,
 * and collapses per-second samples into a VitalsMinute.
 * Decision support only — no diagnosis wording.
 */

import type {
  AlertRecord,
  BpReading,
  Stage,
  SymptomReport,
  TriageLevel,
  VitalsMinute,
  VitalsSample,
} from './types.js';

/**
 * Collapse ~60 one-second samples into one stored minute.
 * Calibration offset is applied here once; raw per-second samples are never persisted.
 */
export function summariseMinute(
  samples: VitalsSample[],
  startMs: number,
  tempOffsetC: number,
): VitalsMinute {
  const hrs = samples.map((s) => s.heartRate).filter((h): h is number => h !== null);
  const temps = samples.map((s) => s.skinTempC).filter((t): t is number => t !== null);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return {
    tsMs: startMs,
    hrMean: mean(hrs),
    hrMin: hrs.length ? Math.min(...hrs) : null,
    hrMax: hrs.length ? Math.max(...hrs) : null,
    tempMeanC: temps.length ? mean(temps)! + tempOffsetC : null,
    validFraction: samples.length
      ? Math.max(hrs.length, temps.length) / samples.length
      : 0,
  };
}

/** Fields the mother can choose to share at a visit. */
export interface SummaryShareChoices {
  includeBpTrend: boolean;
  includeAlerts: boolean;
  includeSymptoms: boolean;
  includeDueDate: boolean;
}

export interface NurseSummaryInput {
  displayName: string;
  stage: Stage;
  /** ISO date string YYYY-MM-DD when known. */
  expectedDeliveryDate?: string;
  gestationWeeks?: number;
  /** After birth: local date (YYYY-MM-DD) and how the baby was born. */
  deliveryDate?: string;
  deliveryMode?: string;
  bp: BpReading[];
  symptoms: SymptomReport[];
  alerts: AlertRecord[];
  recentVitals: VitalsMinute[];
  latestLevel: TriageLevel;
  share: SummaryShareChoices;
  generatedAtMs: number;
}

export interface NurseSummary {
  title: string;
  generatedAtMs: number;
  mother: string;
  stage: Stage;
  expectedDeliveryDate?: string;
  gestationWeeks?: number;
  deliveryDate?: string;
  deliveryMode?: string;
  latestLevel: TriageLevel;
  bpTrend: Array<{ tsMs: number; systolic: number; diastolic: number }>;
  recentAlerts: Array<{ tsMs: number; level: string; rules: string[] }>;
  recentSymptoms: Array<{ tsMs: number; codes: string[] }>;
  questionsToAsk: string[];
  /** Compact JSON string suitable for QR encoding. */
  qrPayload: string;
}

const POSTPARTUM_QUESTIONS = [
  'Any heavy bleeding, bad-smelling discharge or fever?',
  'Any severe headache, blurred vision, chest pain or breathlessness?',
  'How is her mood and sleep? Any thoughts of harm? (consider EPDS)',
  'Wound or stitches healing? Breastfeeding going well?',
];

const DEFAULT_QUESTIONS = [
  'Any severe headache, blurred vision, or upper abdominal pain?',
  'Any heavy bleeding or reduced baby movement?',
  'Clinic blood pressure and urine protein today?',
];

/**
 * Builds the nurse one-page summary honouring the mother's share choices.
 * TODO(clinician): replace default questions with approved visit prompts.
 */
export function buildNurseSummary(input: NurseSummaryInput): NurseSummary {
  const bpTrend = input.share.includeBpTrend
    ? input.bp.slice(-8).map((b) => ({
        tsMs: b.tsMs,
        systolic: b.systolic,
        diastolic: b.diastolic,
      }))
    : [];

  const recentAlerts = input.share.includeAlerts
    ? input.alerts.slice(-5).map((a) => ({
        tsMs: a.tsMs,
        level: a.level,
        rules: a.firedRules,
      }))
    : [];

  const recentSymptoms = input.share.includeSymptoms
    ? input.symptoms.slice(-5).map((s) => ({
        tsMs: s.tsMs,
        codes: s.codes,
      }))
    : [];

  const summary: NurseSummary = {
    title: 'Neema visit summary',
    generatedAtMs: input.generatedAtMs,
    mother: input.displayName,
    stage: input.stage,
    latestLevel: input.latestLevel,
    bpTrend,
    recentAlerts,
    recentSymptoms,
    questionsToAsk: input.stage === 'postpartum' ? POSTPARTUM_QUESTIONS : DEFAULT_QUESTIONS,
    qrPayload: '',
  };

  if (input.share.includeDueDate && input.expectedDeliveryDate) {
    summary.expectedDeliveryDate = input.expectedDeliveryDate;
  }
  if (input.share.includeDueDate && input.gestationWeeks !== undefined && input.stage === 'pregnancy') {
    summary.gestationWeeks = input.gestationWeeks;
  }
  if (input.stage === 'postpartum' && input.deliveryDate) {
    summary.deliveryDate = input.deliveryDate;
    if (input.deliveryMode) summary.deliveryMode = input.deliveryMode;
  }

  summary.qrPayload = JSON.stringify({
    v: 1,
    mother: summary.mother,
    stage: summary.stage,
    level: summary.latestLevel,
    edd: summary.expectedDeliveryDate ?? null,
    born: summary.deliveryDate ?? null,
    bp: bpTrend,
    alerts: recentAlerts,
    symptoms: recentSymptoms,
  });

  return summary;
}
