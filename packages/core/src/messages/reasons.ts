/**
 * Plain-language alert reasons for the SMS to the CHP and family.
 *
 * The SMS must stay short, carry no raw vitals and no diagnosis (project doc §10, §12),
 * so each triage reason code maps to a short action-neutral phrase.
 * Swahili wording is a DRAFT and needs native-speaker + CHP review before field use.
 */

import type { TriageLevel } from '../types.js';

/** A short phrase in both languages for one reason code. */
export interface ReasonPhrase {
  sw: string;
  en: string;
}

/**
 * Reason phrases, ordered from most to least urgent.
 * The order decides which reason is "top" when several rules fire.
 */
const REASONS: [code: string, phrase: ReasonPhrase][] = [
  ['sos', { sw: 'ameomba msaada (SOS)', en: 'she pressed SOS' }],
  ['bp_severe', { sw: 'shinikizo la damu juu sana', en: 'very high blood pressure' }],
  [
    'bp_raised_with_symptom',
    { sw: 'shinikizo la damu juu na dalili za hatari', en: 'high blood pressure with danger signs' },
  ],
  ['emergency_sign', { sw: 'ana dalili ya hatari ya dharura', en: 'an emergency danger sign' }],
  ['thoughts_of_harm', { sw: 'anahitaji kuzungumza na mtu sasa', en: 'needs someone to talk to now' }],
  ['heavy_bleeding', { sw: 'anatoka damu nyingi', en: 'heavy bleeding' }],
  [
    'fever_fast_pulse',
    { sw: 'homa na mapigo ya moyo ya haraka', en: 'fever and fast pulse' },
  ],
  [
    'bp_raised_persists',
    { sw: 'shinikizo la damu bado liko juu', en: 'blood pressure still high on recheck' },
  ],
  ['bp_raised', { sw: 'shinikizo la damu limeinuka', en: 'raised blood pressure' }],
  ['fever', { sw: 'homa', en: 'fever' }],
  [
    'pulse_above_baseline',
    { sw: 'mapigo ya moyo juu ya kawaida yake', en: 'pulse above her normal' },
  ],
  ['baby_moving_less', { sw: 'mtoto anacheza kidogo', en: 'baby moving less' }],
  ['review_sign_today', { sw: 'dalili inayohitaji kuonwa leo', en: 'a sign that needs review today' }],
];

const BY_CODE = new Map(REASONS);
const RANK = new Map(REASONS.map(([code], i) => [code, i]));

/**
 * Picks the most urgent reason from a triage result's reason codes.
 * Unknown codes rank last so a known, urgent reason always wins.
 */
export function topReason(reasons: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const code of reasons) {
    const rank = RANK.get(code) ?? REASONS.length;
    if (rank < bestRank) {
      best = code;
      bestRank = rank;
    }
  }
  return best;
}

/** Short phrase for a reason code; falls back to a neutral "needs help" phrase. */
export function reasonPhrase(code: string | undefined, lang: 'sw' | 'en' = 'sw'): string {
  const phrase = code ? BY_CODE.get(code) : undefined;
  if (phrase) return phrase[lang];
  return lang === 'sw' ? 'anahitaji msaada' : 'she needs help';
}

/** What goes into an alert SMS. Nothing else leaves the phone. */
export interface AlertSmsDraft {
  level: Exclude<TriageLevel, 'GREEN' | 'UNKNOWN'>;
  motherName: string;
  /** Reason codes from the triage result; the most urgent one is used. */
  reasons: readonly string[];
  /** Maps link from geolocation, when she allowed it. */
  locationUrl?: string;
}

/**
 * Builds the alert SMS body (project doc §10 format).
 * RED asks the CHP to reach her now; YELLOW is a quiet heads-up.
 * No raw vitals, no diagnosis.
 */
export function buildAlertSmsText(draft: AlertSmsDraft): string {
  // "Mama Amina"; with no saved name just "Mama" (never "Mama Mama").
  const trimmed = draft.motherName.trim().replace(/^mama\s+/i, '');
  const who = trimmed && trimmed.toLowerCase() !== 'mama' ? `Mama ${trimmed}` : 'Mama';
  const reason = reasonPhrase(topReason(draft.reasons), 'sw');
  const place = draft.locationUrl ?? '(mahali hakijulikani)';
  if (draft.level === 'RED') {
    return `NEEMA: ${who} yuko RED. Sababu: ${reason}. Mahali: ${place}. Tafadhali mfikie sasa.`;
  }
  return `NEEMA: ${who} yuko YELLOW. Sababu: ${reason}. Tunapima tena. Tafadhali mfuatilie leo.`;
}
