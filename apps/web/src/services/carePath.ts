/**
 * How Neema talks about this pregnancy, without ever calling her "high-risk".
 *
 * steady — nothing extra was known at the start, and nothing new is worrying now
 * watch  — something has changed in this pregnancy (a reading or a feeling)
 * known  — she already had care to continue: a condition, medicine, a past complication, or age under 18 or 35+
 *
 * known wins over watch, so her history is not forgotten when a new feeling appears.
 * The words high-risk are never shown.
 */

import type { TriageLevel } from '@neema/core';
import type { MamaProfile } from './passport';

export type CarePath = 'steady' | 'watch' | 'known';
/** before = early pregnancy, just finding her feet. during = the rest of pregnancy. after = birth. */
export type JourneyPhase = 'before' | 'during' | 'after';

export function ageYears(dateOfBirth: string | undefined, nowMs = Date.now()): number | null {
  if (!dateOfBirth) return null;
  const born = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date(nowMs);
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

export function carePath(profile: MamaProfile | null, level: TriageLevel | 'UNKNOWN' | null): CarePath {
  const age = ageYears(profile?.dateOfBirth);
  const known =
    (profile?.conditions?.length ?? 0) > 0 ||
    (profile?.medications?.length ?? 0) > 0 ||
    (profile?.pastComplications?.length ?? 0) > 0 ||
    (age !== null && (age < 18 || age >= 35));
  if (known) return 'known';
  if (level === 'YELLOW' || level === 'RED') return 'watch';
  return 'steady';
}

export function journeyPhase(stage: 'pregnancy' | 'postpartum' | null, weeks: number | null): JourneyPhase {
  if (stage === 'postpartum') return 'after';
  if (weeks !== null && weeks < 13) return 'before';
  return 'during';
}
