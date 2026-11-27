/**
 * Pregnancy dating: current gestational age, due date and trimester.
 *
 * Standard obstetric dating, not a clinical threshold: a pregnancy is counted as
 * 280 days (40 weeks) from the first day of the last period, so
 * due date = date recorded + (280 − gestational age in days on that date).
 * Trimesters: 1st up to 13 weeks 6 days, 2nd 14w0d–27w6d, 3rd from 28 weeks.
 */

export const FULL_TERM_DAYS = 280;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What was recorded, and when: either a gestational age or a due date. */
export type PregnancyDating =
  | { kind: 'ga'; weeks: number; days?: number; recordedOnMs: number }
  | { kind: 'edd'; eddMs: number };

export interface PregnancyProgress {
  /** Completed weeks and extra days today, e.g. 24 weeks 3 days. */
  weeks: number;
  days: number;
  totalDays: number;
  trimester: 1 | 2 | 3;
  /** Estimated due date (local midnight, ms). */
  eddMs: number;
  /** 0..1 share of 40 weeks (capped at 1). */
  fraction: number;
  /** Days until the due date (negative once past it). */
  daysToEdd: number;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Days between two moments counted in whole calendar days (local time). */
function calendarDaysBetween(fromMs: number, toMs: number): number {
  return Math.round((startOfDay(toMs) - startOfDay(fromMs)) / DAY_MS);
}

/** Trimester for a gestational age in days. */
export function trimesterFor(totalDays: number): 1 | 2 | 3 {
  if (totalDays < 14 * 7) return 1;
  if (totalDays < 28 * 7) return 2;
  return 3;
}

/** Due date from a gestational age recorded on a given day. */
export function eddFromGestationalAge(weeks: number, days: number, recordedOnMs: number): number {
  const gaDays = weeks * 7 + days;
  return startOfDay(recordedOnMs) + (FULL_TERM_DAYS - gaDays) * DAY_MS;
}

/** True when the recorded values make sense (0–44 weeks, 0–6 days). */
export function isValidGestationalAge(weeks: number, days = 0): boolean {
  return (
    Number.isInteger(weeks) && Number.isInteger(days) && weeks >= 0 && weeks <= 44 && days >= 0 && days <= 6
  );
}

/**
 * Today's pregnancy progress from what was recorded.
 * Returns null for dating that cannot be a current pregnancy (more than 44 weeks
 * or before conception), so the app asks again instead of showing a wrong week.
 */
export function pregnancyProgress(dating: PregnancyDating, nowMs: number = Date.now()): PregnancyProgress | null {
  const eddMs =
    dating.kind === 'edd'
      ? startOfDay(dating.eddMs)
      : eddFromGestationalAge(dating.weeks, dating.days ?? 0, dating.recordedOnMs);
  const daysToEdd = calendarDaysBetween(nowMs, eddMs);
  const totalDays = FULL_TERM_DAYS - daysToEdd;
  if (totalDays < 0 || totalDays > 44 * 7) return null;
  return {
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
    totalDays,
    trimester: trimesterFor(totalDays),
    eddMs,
    fraction: Math.min(1, totalDays / FULL_TERM_DAYS),
    daysToEdd,
  };
}

/** "YYYY-MM-DD" for the local calendar day of `ms` (no UTC shift). */
export function toLocalIsoDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parses "YYYY-MM-DD" as local midnight (Date.parse would use UTC). Null if invalid. */
export function parseLocalIsoDate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d.getTime();
}
