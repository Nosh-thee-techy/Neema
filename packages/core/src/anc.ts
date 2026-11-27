/**
 * WHO 2016 antenatal care model: at least eight contacts — the first in the first
 * 12 weeks, then at 20, 26, 30, 34, 36, 38 and 40 weeks.
 * Source: WHO recommendations on antenatal care for a positive pregnancy experience (2016),
 * https://www.who.int/publications/i/item/9789241549912
 * Shown as a guide only; the mother's clinic sets her real appointments.
 */

export const WHO_ANC_CONTACT_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40] as const;

export interface AncContact {
  /** 1–8 */
  number: number;
  /** Gestational week of the contact ("by 12" for the first). */
  week: number;
  /** Whole weeks from now (0 = this week). */
  inWeeks: number;
}

/** The next recommended contact at or after this week; null after 40 weeks. */
export function nextAncContact(currentWeek: number): AncContact | null {
  const idx = WHO_ANC_CONTACT_WEEKS.findIndex((w) => w >= currentWeek);
  if (idx === -1) return null;
  const week = WHO_ANC_CONTACT_WEEKS[idx]!;
  return { number: idx + 1, week, inWeeks: Math.max(0, week - currentWeek) };
}
