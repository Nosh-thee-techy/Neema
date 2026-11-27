import { parseLocalIsoDate, pregnancyProgress, type PregnancyDating, type PregnancyProgress } from '@neema/core';
import type { MamaProfile } from './passport';

/**
 * Picks the best dating the profile has: clinic GA with its recorded date,
 * else a due date. A bare legacy `gestationWeeks` with no date cannot advance,
 * so it is not used (Home asks her to confirm her weeks instead of guessing).
 */
export function datingFromProfile(p: MamaProfile | null | undefined): PregnancyDating | null {
  if (!p) return null;
  if (typeof p.gaWeeks === 'number' && typeof p.gaRecordedOnMs === 'number') {
    return { kind: 'ga', weeks: p.gaWeeks, days: p.gaDays ?? 0, recordedOnMs: p.gaRecordedOnMs };
  }
  if (p.expectedDeliveryDate) {
    const ms = (parseLocalIsoDate(p.expectedDeliveryDate) ?? Date.parse(p.expectedDeliveryDate));
    if (Number.isFinite(ms)) return { kind: 'edd', eddMs: ms };
  }
  return null;
}

export function progressFromProfile(p: MamaProfile | null | undefined, nowMs = Date.now()): PregnancyProgress | null {
  const d = datingFromProfile(p);
  return d ? pregnancyProgress(d, nowMs) : null;
}
