/**
 * Doctor / nurse handoff from Health history.
 * Filters on-device rows to the period she picks, then reuses the nurse QR builder.
 * Nothing is uploaded. The payload stays inside the scannable size limit.
 */

import type { AlertRecord, BpReading, Stage, SymptomReport, SummaryShareChoices, TriageLevel } from '@neema/core';
import type { ClinicalNoteRow, VisitRecord } from '../storage/db';
import { buildSummaryForQr, QR_SOFT_MAX_CHARS } from './summaryQr';

export type SharePeriod = '7d' | '30d' | 'all';

export interface PeriodWindow {
  period: SharePeriod;
  /** Null means everything saved on the phone, up to `toMs`. */
  fromMs: number | null;
  toMs: number;
}

export interface DoctorShareCounts {
  bp: number;
  symptoms: number;
  alerts: number;
  visits: number;
  notes: number;
}

export interface DoctorShareResult {
  window: PeriodWindow;
  /** Empty when the period has no rows to encode. */
  payload: string;
  empty: boolean;
  /** True when older rows were left out so the code stays scannable. */
  truncated: boolean;
  counts: DoctorShareCounts;
}

interface DatedNote {
  tsMs: number;
  text: string;
}

interface CompactVisit {
  t: number;
  k: 'anc' | 'pnc' | 'other';
  s?: number;
  d?: number;
}

interface CompactNote {
  t: number;
  x: string;
}

const EMPTY_COUNTS: DoctorShareCounts = { bp: 0, symptoms: 0, alerts: 0, visits: 0, notes: 0 };

/** Calendar window: today plus the previous days, in local time. */
export function periodWindow(period: SharePeriod, nowMs: number): PeriodWindow {
  const end = new Date(nowMs);
  end.setHours(23, 59, 59, 999);
  if (period === 'all') return { period, fromMs: null, toMs: end.getTime() };
  const days = period === '7d' ? 7 : 30;
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return { period, fromMs: start.getTime(), toMs: end.getTime() };
}

export function inWindow(tsMs: number, window: PeriodWindow): boolean {
  if (tsMs > window.toMs) return false;
  if (window.fromMs === null) return true;
  return tsMs >= window.fromMs;
}

/** Plain-language dates for the chosen period (en or sw). */
export function formatShareWindow(window: PeriodWindow, lang: 'en' | 'sw'): string {
  const loc = lang === 'sw' ? 'sw-KE' : 'en-KE';
  const day = (ms: number) => new Date(ms).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
  if (window.period === 'all') {
    const end = day(window.toMs);
    return lang === 'sw' ? `Yote kwenye simu hii, hadi ${end}` : `Everything on this phone, up to ${end}`;
  }
  const start = day(window.fromMs ?? window.toMs);
  const end = day(window.toMs);
  return lang === 'sw' ? `${start} hadi ${end}` : `${start} to ${end}`;
}

function byTime<T extends { tsMs: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.tsMs - b.tsMs);
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, Math.max(0, max - 1))}…`;
}

function visitKind(type: VisitRecord['type']): CompactVisit['k'] {
  if (type === 'antenatal') return 'anc';
  if (type === 'postnatal') return 'pnc';
  return 'other';
}

function pushNote(list: DatedNote[], tsMs: number, text: string | undefined) {
  const trimmed = text?.trim();
  if (trimmed) list.push({ tsMs, text: trimmed });
}

function countsOf(payload: string): DoctorShareCounts {
  try {
    const parsed = JSON.parse(payload) as {
      bp?: unknown[];
      symptoms?: unknown[];
      alerts?: unknown[];
      visits?: unknown[];
      notes?: unknown[];
    };
    return {
      bp: parsed.bp?.length ?? 0,
      symptoms: parsed.symptoms?.length ?? 0,
      alerts: parsed.alerts?.length ?? 0,
      visits: parsed.visits?.length ?? 0,
      notes: parsed.notes?.length ?? 0,
    };
  } catch {
    return EMPTY_COUNTS;
  }
}

/**
 * Builds a QR payload for one period.
 * Share flags still gate blood pressure, alerts, symptoms, and the due date.
 * Visits and notes are included only when their timestamp is inside the window.
 */
export function buildDoctorShare(input: {
  displayName: string;
  stage: Stage;
  gestationWeeks?: number;
  expectedDeliveryDate?: string;
  deliveryDate?: string;
  deliveryMode?: string;
  /** Undated note she wrote. Included only for "everything on this phone". */
  healthNotes?: string;
  bp: BpReading[];
  symptoms: SymptomReport[];
  alerts: AlertRecord[];
  visits: VisitRecord[];
  clinical: ClinicalNoteRow[];
  share: SummaryShareChoices;
  latestLevel: TriageLevel;
  period: SharePeriod;
  nowMs: number;
}): DoctorShareResult {
  const window = periodWindow(input.period, input.nowMs);
  const bp = byTime(input.bp.filter((row) => inWindow(row.tsMs, window)));
  const symptoms = byTime(input.symptoms.filter((row) => inWindow(row.tsMs, window)));
  const alerts = byTime(input.alerts.filter((row) => inWindow(row.tsMs, window)));
  const visits = byTime(input.visits.filter((row) => inWindow(row.tsMs, window)));
  const clinical = byTime(input.clinical.filter((row) => inWindow(row.tsMs, window)));

  const sharedBp = input.share.includeBpTrend ? bp : [];
  const sharedSymptoms = input.share.includeSymptoms ? symptoms : [];
  const sharedAlerts = input.share.includeAlerts ? alerts : [];

  const notes: DatedNote[] = [];
  if (input.share.includeSymptoms) {
    for (const row of symptoms) pushNote(notes, row.tsMs, row.note);
  }
  for (const row of visits) pushNote(notes, row.tsMs, row.notes);
  for (const row of clinical) pushNote(notes, row.tsMs, row.text);
  if (input.period === 'all') pushNote(notes, input.nowMs, input.healthNotes);
  notes.sort((a, b) => a.tsMs - b.tsMs);

  const empty = sharedBp.length + sharedSymptoms.length + sharedAlerts.length + visits.length + notes.length === 0;
  if (empty) {
    return { window, payload: '', empty: true, truncated: false, counts: EMPTY_COUNTS };
  }

  const built = buildSummaryForQr({
    displayName: input.displayName,
    stage: input.stage,
    ...(input.gestationWeeks !== undefined ? { gestationWeeks: input.gestationWeeks } : {}),
    ...(input.expectedDeliveryDate ? { expectedDeliveryDate: input.expectedDeliveryDate } : {}),
    ...(input.deliveryDate ? { deliveryDate: input.deliveryDate, ...(input.deliveryMode ? { deliveryMode: input.deliveryMode } : {}) } : {}),
    bp: sharedBp,
    symptoms: sharedSymptoms,
    alerts: sharedAlerts,
    recentVitals: [],
    latestLevel: input.latestLevel,
    share: input.share,
    generatedAtMs: input.nowMs,
  });

  let base: Record<string, unknown>;
  try {
    base = JSON.parse(built.payload) as Record<string, unknown>;
  } catch {
    base = {};
  }

  const attempts: Array<{ noteLen: number; noteCount: number; visitCount: number }> = [
    { noteLen: 72, noteCount: 3, visitCount: 4 },
    { noteLen: 36, noteCount: 2, visitCount: 2 },
    { noteLen: 0, noteCount: 0, visitCount: 2 },
    { noteLen: 0, noteCount: 0, visitCount: 0 },
  ];

  let payload = built.payload;
  for (const attempt of attempts) {
    const visitRows: CompactVisit[] = visits.slice(-attempt.visitCount).map((row) => {
      const compact: CompactVisit = { t: row.tsMs, k: visitKind(row.type) };
      if (row.clinicSystolic !== undefined) compact.s = row.clinicSystolic;
      if (row.clinicDiastolic !== undefined) compact.d = row.clinicDiastolic;
      return compact;
    });
    const noteRows: CompactNote[] =
      attempt.noteLen === 0
        ? []
        : notes.slice(-attempt.noteCount).map((row) => ({ t: row.tsMs, x: clip(row.text, attempt.noteLen) }));
    const body: Record<string, unknown> = {
      ...base,
      win: input.period,
      from: window.fromMs,
      to: window.toMs,
    };
    if (visitRows.length) body.visits = visitRows;
    if (noteRows.length) body.notes = noteRows;
    payload = JSON.stringify(body);
    if (payload.length <= QR_SOFT_MAX_CHARS) break;
  }

  const counts = countsOf(payload);
  const truncated =
    built.truncated ||
    payload.length > QR_SOFT_MAX_CHARS ||
    counts.bp < sharedBp.length ||
    counts.symptoms < sharedSymptoms.length ||
    counts.alerts < sharedAlerts.length ||
    counts.visits < visits.length ||
    counts.notes < notes.length;

  return { window, payload, empty: false, truncated, counts };
}
