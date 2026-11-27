/**
 * Local Mama Passport store (Dexie / IndexedDB).
 * Per-second vitals are never persisted — only minute aggregates (7-day retention).
 */

import Dexie, { type Table } from 'dexie';
import type {
  AlertRecord,
  BpReading,
  CheckIn,
  Contact,
  EpdsResult,
  FollowUp,
  SymptomReport,
  VitalsMinute,
} from '@neema/core';

export interface ProfileRow {
  id: string;
  /** Encrypted JSON blob when a PIN is set; otherwise plaintext JSON. */
  payload: string;
  encrypted: boolean;
  saltB64?: string;
  updatedAtMs: number;
}

export interface ConsentRow {
  id: string;
  version: string;
  language: string;
  agreedAtMs: number;
  sharing: { chp: boolean; family: boolean; nurse: boolean };
  /** Terms and Conditions version accepted at registration, and when. */
  termsVersion?: string;
  termsAcceptedAtMs?: number;
}

export interface BaselineRow {
  id: string; // 'hr' | 'temp'
  mean: number;
  variance: number;
  samples: number;
  lastUpdatedMs: number;
  ready: boolean;
}

/** Kept after minute rows expire (project doc retention). */
export interface DailyVitalsSummary {
  /** Start of UTC day. */
  dayTsMs: number;
  hrMean: number | null;
  hrMin: number | null;
  hrMax: number | null;
  tempMeanC: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  alertCount: number;
  minuteCount: number;
}

/** Antenatal / postnatal visit note supporting the official handbook. */
export interface VisitRecord {
  id: string;
  tsMs: number;
  type: 'antenatal' | 'postnatal' | 'other';
  facilityName?: string;
  clinicSystolic?: number;
  clinicDiastolic?: number;
  urineProtein?: string;
  notes?: string;
  nextAppointmentTsMs?: number;
}

export interface AuthRow {
  id: string;
  pinEnabled: boolean;
  saltB64?: string;
  pinVerifier?: string;
  pinLength?: number;
  updatedAtMs: number;
}

export interface SignOffRow {
  id: string; // 'triage'
  configVersion: string;
  reviewerName: string;
  reviewerRole: string;
  reviewedOn: string;
  attestation: string;
  signed: boolean;
  notes?: string;
  savedAtMs: number;
}

export interface MessageReviewRow {
  key: string;
  status: 'draft' | 'in_review' | 'reviewed' | 'rejected';
  sw: string;
  enGloss: string;
  reviewerName?: string;
  reviewedOn?: string;
  notes?: string;
}

export interface HardwareReportRow {
  id: string;
  deviceLabel: string;
  operatorName: string;
  startedAtMs: number;
  finishedAtMs?: number;
  outcomesJson: string;
  engineeringPass: boolean;
  disclaimer: string;
}

/**
 * A note written by a nurse or CHW. The mother can read it but not edit or delete it
 * in the app. NOTE: on-device only — not tamper-proof until a clinic backend signs notes.
 */
export interface ClinicalNoteRow {
  id: string;
  tsMs: number;
  authorRole: 'nurse' | 'chw';
  authorName: string;
  facilityName?: string;
  text: string;
}

export class NeemaDb extends Dexie {
  profile!: Table<ProfileRow, string>;
  vitalsMinutes!: Table<VitalsMinute, number>;
  vitalsDaily!: Table<DailyVitalsSummary, number>;
  bp!: Table<BpReading, string>;
  symptoms!: Table<SymptomReport, string>;
  alerts!: Table<AlertRecord, string>;
  contacts!: Table<Contact, string>;
  consent!: Table<ConsentRow, string>;
  baseline!: Table<BaselineRow, string>;
  visits!: Table<VisitRecord, string>;
  auth!: Table<AuthRow, string>;
  signOff!: Table<SignOffRow, string>;
  messageReviews!: Table<MessageReviewRow, string>;
  hardwareReports!: Table<HardwareReportRow, string>;
  followups!: Table<FollowUp, string>;
  checkins!: Table<CheckIn, string>;
  epds!: Table<EpdsResult, string>;
  clinicalNotes!: Table<ClinicalNoteRow, string>;

  constructor() {
    super('neema-mama-passport');
    this.version(1).stores({
      profile: 'id',
      vitalsMinutes: 'tsMs',
      bp: 'id, tsMs',
      symptoms: 'id, tsMs',
      alerts: 'id, tsMs',
      contacts: 'id, escalationOrder',
      consent: 'id',
      baseline: 'id',
    });
    this.version(2).stores({
      profile: 'id',
      vitalsMinutes: 'tsMs',
      vitalsDaily: 'dayTsMs',
      bp: 'id, tsMs',
      symptoms: 'id, tsMs',
      alerts: 'id, tsMs',
      contacts: 'id, escalationOrder',
      consent: 'id',
      baseline: 'id',
      visits: 'id, tsMs',
    });
    this.version(3).stores({
      profile: 'id',
      vitalsMinutes: 'tsMs',
      vitalsDaily: 'dayTsMs',
      bp: 'id, tsMs',
      symptoms: 'id, tsMs',
      alerts: 'id, tsMs',
      contacts: 'id, escalationOrder',
      consent: 'id',
      baseline: 'id',
      visits: 'id, tsMs',
      auth: 'id',
      signOff: 'id',
      messageReviews: 'key',
      hardwareReports: 'id, startedAtMs',
    });
    this.version(4).stores({
      profile: 'id',
      vitalsMinutes: 'tsMs',
      vitalsDaily: 'dayTsMs',
      bp: 'id, tsMs',
      symptoms: 'id, tsMs',
      alerts: 'id, tsMs',
      contacts: 'id, escalationOrder',
      consent: 'id',
      baseline: 'id',
      visits: 'id, tsMs',
      auth: 'id',
      signOff: 'id',
      messageReviews: 'key',
      hardwareReports: 'id, startedAtMs',
      followups: 'alertId, stage',
    });
    this.version(5).stores({
      profile: 'id',
      vitalsMinutes: 'tsMs',
      vitalsDaily: 'dayTsMs',
      bp: 'id, tsMs',
      symptoms: 'id, tsMs',
      alerts: 'id, tsMs',
      contacts: 'id, escalationOrder',
      consent: 'id',
      baseline: 'id',
      visits: 'id, tsMs',
      auth: 'id',
      signOff: 'id',
      messageReviews: 'key',
      hardwareReports: 'id, startedAtMs',
      followups: 'alertId, stage',
      checkins: 'id, tsMs',
      epds: 'id, tsMs',
    });
    // v6: nurse clinical notes, kept apart from the mother's own notes.
    this.version(6).stores({
      clinicalNotes: 'id, tsMs',
    });
  }
}

export const db = new NeemaDb();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Downs samples expired minute rows into daily summaries, then deletes them.
 * Alerts / BP / symptoms are kept for the life of the profile unless deleted by the mother.
 */
export async function enforceVitalsRetention(nowMs: number = Date.now()): Promise<number> {
  const cutoff = nowMs - SEVEN_DAYS_MS;
  const expired = await db.vitalsMinutes.where('tsMs').below(cutoff).toArray();
  if (expired.length === 0) return 0;

  const byDay = new Map<number, VitalsMinute[]>();
  for (const row of expired) {
    const day = row.tsMs - (row.tsMs % 86_400_000);
    const list = byDay.get(day) ?? [];
    list.push(row);
    byDay.set(day, list);
  }

  for (const [dayTsMs, minutes] of byDay) {
    const hrs = minutes.map((m) => m.hrMean).filter((v): v is number => v !== null);
    const temps = minutes.map((m) => m.tempMeanC).filter((v): v is number => v !== null);
    const dayEnd = dayTsMs + 86_400_000;
    const alertCount = await db.alerts.where('tsMs').between(dayTsMs, dayEnd, true, false).count();
    const existing = await db.vitalsDaily.get(dayTsMs);
    const summary: DailyVitalsSummary = {
      dayTsMs,
      hrMean: hrs.length ? avg(hrs) : existing?.hrMean ?? null,
      hrMin: hrs.length ? Math.min(...hrs, existing?.hrMin ?? Infinity) : existing?.hrMin ?? null,
      hrMax: hrs.length ? Math.max(...hrs, existing?.hrMax ?? -Infinity) : existing?.hrMax ?? null,
      tempMeanC: temps.length ? avg(temps) : existing?.tempMeanC ?? null,
      tempMinC: temps.length
        ? Math.min(...temps, existing?.tempMinC ?? Infinity)
        : existing?.tempMinC ?? null,
      tempMaxC: temps.length
        ? Math.max(...temps, existing?.tempMaxC ?? -Infinity)
        : existing?.tempMaxC ?? null,
      alertCount: (existing?.alertCount ?? 0) + alertCount,
      minuteCount: (existing?.minuteCount ?? 0) + minutes.length,
    };
    if (summary.hrMin === Infinity) summary.hrMin = null;
    if (summary.hrMax === -Infinity) summary.hrMax = null;
    if (summary.tempMinC === Infinity) summary.tempMinC = null;
    if (summary.tempMaxC === -Infinity) summary.tempMaxC = null;
    await db.vitalsDaily.put(summary);
  }

  return db.vitalsMinutes.where('tsMs').below(cutoff).delete();
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
