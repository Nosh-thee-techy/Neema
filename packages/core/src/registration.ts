/**
 * Registration rules shared by the app and (later) the server, so both refuse the
 * same incomplete records. Returns one error code per field; the UI turns codes
 * into words in the mother's language.
 */

import { isValidGestationalAge, pregnancyProgress } from './pregnancy.js';
import { isPlaceholderPhone, normalizePhone } from './phone.js';
import { isContradictory, type AllergyAnswer } from './allergies.js';

/** Bump when the Terms text changes; acceptance is stored with this version. */
export const TERMS_VERSION = 'neema-terms-2026-11-draft';

export interface RegistrationInput {
  registrarRole: 'self' | 'chw' | 'nurse';
  registrarName?: string;
  fullName: string;
  dateOfBirth?: string;
  phone?: string;
  phoneKind?: 'smartphone' | 'basic' | 'none';
  stage: 'pregnancy' | 'postpartum';
  /** Required while pregnant: weeks+days from the clinic, or a due date. */
  dating: { mode: 'weeks'; weeks: number | null; days: number | null } | { mode: 'due'; dueDateMs: number | null } | null;
  firstPregnancy: boolean | null;
  previousPregnancies?: number | null;
  allergies?: AllergyAnswer;
  chpName?: string;
  chpPhone?: string;
  familyName?: string;
  familyPhone?: string;
  termsAccepted: boolean;
  shareChp: boolean;
  shareFamily: boolean;
  nowMs: number;
}

export type RegistrationField =
  | 'registrarName'
  | 'fullName'
  | 'dateOfBirth'
  | 'phone'
  | 'gestationalAge'
  | 'dueDate'
  | 'firstPregnancy'
  | 'previousPregnancies'
  | 'allergies'
  | 'chpName'
  | 'chpPhone'
  | 'familyName'
  | 'familyPhone'
  | 'terms'
  | 'sharing';

export type RegistrationError =
  | 'required'
  | 'too_short'
  | 'invalid_date'
  | 'age_out_of_range'
  | 'invalid_phone'
  | 'phone_required_for_calls'
  | 'ga_out_of_range'
  | 'due_date_out_of_range'
  | 'number_out_of_range'
  | 'contradictory'
  | 'name_required_with_phone';

export type RegistrationErrors = Partial<Record<RegistrationField, RegistrationError>>;

const DAY = 86_400_000;

function realPhone(p: string | undefined): boolean {
  if (!p?.trim()) return false;
  const n = normalizePhone(p);
  return Boolean(n && !isPlaceholderPhone(n));
}

export function validateRegistration(i: RegistrationInput): RegistrationErrors {
  const e: RegistrationErrors = {};

  if (i.registrarRole !== 'self' && !i.registrarName?.trim()) e.registrarName = 'required';

  const name = i.fullName.trim();
  if (!name) e.fullName = 'required';
  else if (name.length < 2) e.fullName = 'too_short';

  if (i.dateOfBirth) {
    const ms = Date.parse(i.dateOfBirth);
    if (!Number.isFinite(ms)) e.dateOfBirth = 'invalid_date';
    else {
      const age = (i.nowMs - ms) / (365.25 * DAY);
      if (age < 10 || age > 60) e.dateOfBirth = 'age_out_of_range';
    }
  }

  if (i.phone?.trim() && !realPhone(i.phone)) e.phone = 'invalid_phone';
  else if (!i.phone?.trim() && i.phoneKind === 'basic') e.phone = 'phone_required_for_calls';

  if (i.stage === 'pregnancy') {
    const d = i.dating;
    if (!d) e.gestationalAge = 'required';
    else if (d.mode === 'weeks') {
      if (d.weeks === null || !Number.isFinite(d.weeks)) e.gestationalAge = 'required';
      else if (!isValidGestationalAge(d.weeks, d.days ?? 0) || d.weeks < 1 || d.weeks > 42) e.gestationalAge = 'ga_out_of_range';
    } else if (d.dueDateMs === null || !Number.isFinite(d.dueDateMs)) e.dueDate = 'required';
    else if (!pregnancyProgress({ kind: 'edd', eddMs: d.dueDateMs }, i.nowMs)) e.dueDate = 'due_date_out_of_range';

    if (i.firstPregnancy === null) e.firstPregnancy = 'required';
    if (i.firstPregnancy === false && i.previousPregnancies != null) {
      const n = i.previousPregnancies;
      if (!Number.isInteger(n) || n < 1 || n > 20) e.previousPregnancies = 'number_out_of_range';
    }
  }

  if (i.allergies && isContradictory(i.allergies)) e.allergies = 'contradictory';

  for (const [nameKey, phoneKey] of [
    ['chpName', 'chpPhone'],
    ['familyName', 'familyPhone'],
  ] as const) {
    const n = i[nameKey]?.trim();
    const p = i[phoneKey]?.trim();
    if (!n && !p) continue;
    if (!n) e[nameKey] = 'name_required_with_phone';
    if (!realPhone(p)) e[phoneKey] = p ? 'invalid_phone' : 'required';
  }

  if (!i.termsAccepted) e.terms = 'required';
  if (!i.shareChp && !i.shareFamily) e.sharing = 'required';

  return e;
}
