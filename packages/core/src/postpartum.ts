/**
 * Days and weeks since birth, from the real delivery date.
 * Day 0 is the day of birth; "day 12 of recovery" means 12 calendar days later.
 */

const DAY = 86_400_000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface PostpartumProgress {
  /** Whole calendar days since the birth day (0 on the birth day). */
  daysSinceBirth: number;
  /** Completed weeks since birth. */
  weeks: number;
  /** Extra days after the completed weeks. */
  days: number;
  /** True inside the WHO postnatal period (first 6 weeks = 42 days). */
  inPostnatalPeriod: boolean;
}

/** Null when the delivery date is in the future or more than a year ago. */
export function postpartumProgress(deliveryMs: number, nowMs = Date.now()): PostpartumProgress | null {
  const daysSinceBirth = Math.round((startOfDay(nowMs) - startOfDay(deliveryMs)) / DAY);
  if (!Number.isFinite(daysSinceBirth) || daysSinceBirth < 0 || daysSinceBirth > 366) return null;
  return {
    daysSinceBirth,
    weeks: Math.floor(daysSinceBirth / 7),
    days: daysSinceBirth % 7,
    inPostnatalPeriod: daysSinceBirth <= 42,
  };
}

/**
 * WHO postnatal care: care for at least 24 hours after a facility birth, then at least
 * three more contacts in the first six weeks — around day 3 (48–72 h), between days 7
 * and 14, and at six weeks. Sources: WHO 2022 postnatal guideline; WHO 2013/14 PNC
 * recommendations for timing. A guide only: the clinic sets real appointments.
 */
export const WHO_PNC_CONTACTS = [
  { id: 'pnc1', fromDay: 0, toDay: 1, en: 'Check within 24 hours of birth', sw: 'Ukaguzi ndani ya saa 24 baada ya kujifungua' },
  { id: 'pnc2', fromDay: 2, toDay: 3, en: 'Check on day 3', sw: 'Ukaguzi siku ya 3' },
  { id: 'pnc3', fromDay: 7, toDay: 14, en: 'Check between day 7 and day 14', sw: 'Ukaguzi kati ya siku ya 7 na 14' },
  { id: 'pnc4', fromDay: 42, toDay: 49, en: 'Six-week check', sw: 'Ukaguzi wa wiki sita' },
] as const;

export type PncContact = (typeof WHO_PNC_CONTACTS)[number];

/** The current or next recommended postnatal contact; null after the six-week check window. */
export function nextPncContact(daysSinceBirth: number): { contact: PncContact; dueNow: boolean } | null {
  for (const c of WHO_PNC_CONTACTS) {
    if (daysSinceBirth <= c.toDay) return { contact: c, dueNow: daysSinceBirth >= c.fromDay };
  }
  return null;
}

/**
 * Kenya routine immunisation (KEPI) visits in the first months: BCG and polio at birth;
 * pentavalent, polio, pneumococcal (and rotavirus at 6 and 10 weeks) at 6, 10 and 14 weeks;
 * measles-rubella at 9 months. Team to confirm against the current MoH schedule.
 */
export const KEPI_VISITS = [
  { id: 'birth', ageDays: 0, en: 'At birth: BCG and polio drops', sw: 'Wakati wa kuzaliwa: BCG na matone ya polio' },
  { id: 'w6', ageDays: 42, en: '6 weeks: first round of baby vaccines', sw: 'Wiki 6: chanjo za kwanza za mtoto' },
  { id: 'w10', ageDays: 70, en: '10 weeks: second round of baby vaccines', sw: 'Wiki 10: chanjo za pili za mtoto' },
  { id: 'w14', ageDays: 98, en: '14 weeks: third round of baby vaccines', sw: 'Wiki 14: chanjo za tatu za mtoto' },
  { id: 'm9', ageDays: 274, en: '9 months: measles-rubella vaccine', sw: 'Miezi 9: chanjo ya surua na rubella' },
] as const;

export type KepiVisit = (typeof KEPI_VISITS)[number];

/** Next baby vaccine visit at or after this age (the birth visit only on day 0–1). */
export function nextKepiVisit(babyAgeDays: number): KepiVisit | null {
  if (babyAgeDays <= 1) return KEPI_VISITS[0];
  return KEPI_VISITS.slice(1).find((v) => v.ageDays >= babyAgeDays - 3) ?? null;
}
