/**
 * Mama Passport profile save/load.
 * Sensitive fields are encrypted at rest when a PIN is provided.
 */

import { allergiesFromLegacy, type AllergyAnswer, type AllergyEntry, type BirthPlan, type Stage } from '@neema/core';
import { decryptString, deriveKeyFromPin, encryptString } from '../storage/crypto';
import { db, type ConsentRow, type ProfileRow } from '../storage/db';

const PROFILE_ID = 'primary';

/** Plain profile fields stored on-device. */
export interface MamaProfile {
  displayName: string;
  /** Optional age band or ISO birth date string. */
  ageOrDob?: string;
  language: 'sw' | 'en' | 'sheng';
  phoneForAlerts?: string;
  stage: Stage;
  expectedDeliveryDate?: string;
  gestationWeeks?: number;
  previousPregnancies?: number;
  pastComplications?: string[];
  medications?: string[];
  /** @deprecated older comma-style list; read via `allergyAnswerOf`. */
  allergies?: string[];
  /** One entry per allergy (structured). */
  allergyList?: AllergyEntry[];
  /** Explicit "no known allergies" (never combined with allergyList). */
  noKnownAllergies?: boolean;
  discreetMode?: boolean;
  /** Birth preparedness checklist — not a risk score. */
  birthPlan?: BirthPlan;

  // ── Registration v2 (mother-first redesign) ──────────────────────────
  /** Full name as on ID / clinic card. displayName is what Neema calls her. */
  fullName?: string;
  /** ISO date (YYYY-MM-DD). */
  dateOfBirth?: string;
  /** Village / estate / ward — free text, used by the CHP to find her. */
  location?: string;
  /** Gestational age as told by the clinic, plus the day it was recorded, so it advances. */
  gaWeeks?: number;
  gaDays?: number;
  gaRecordedOnMs?: number;
  firstPregnancy?: boolean;
  /** Ongoing conditions she or the nurse noted (free text items). */
  conditions?: string[];
  /** The mother's own notes. Clinical notes live in a separate table. */
  healthNotes?: string;
  registeredBy?: RegisteredBy;
  /** Clinic / provider info if known. */
  facilityName?: string;
  nurseName?: string;
  /** 'basic' = feature phone only: reach her by voice call / SMS (needs the calls backend). */
  phoneKind?: 'smartphone' | 'basic' | 'none';
  /** She agreed to automated voice calls / SMS on phoneForAlerts. Calls need a server (see BACKEND_CONTRACT.md). */
  automatedCallsConsent?: boolean;
  /** When the registration wizard finished. */
  registeredAtMs?: number;
}

export type RegistrarRole = 'self' | 'chw' | 'nurse';

export interface RegisteredBy {
  role: RegistrarRole;
  /** Name of the CHW / nurse who registered her (blank for self). */
  name?: string;
  /** Optional staff / CHW ID. */
  staffId?: string;
}

export const EMPTY_BIRTH_PLAN: BirthPlan = {
  skilledAttendant: false,
  bloodDonor: false,
  savings: false,
  companion: false,
  transport: false,
};

export interface SaveProfileOptions {
  /** When set, payload is encrypted with a PIN-derived key. */
  pin?: string;
  nowMs?: number;
}

/** Saves the profile; encrypts when a PIN is supplied. */
export async function saveProfile(profile: MamaProfile, options: SaveProfileOptions = {}): Promise<ProfileRow> {
  const nowMs = options.nowMs ?? Date.now();
  const json = JSON.stringify(profile);

  if (options.pin) {
    const existing = await db.profile.get(PROFILE_ID);
    const material = await deriveKeyFromPin(options.pin, existing?.saltB64);
    const payload = await encryptString(material.key, json);
    const row: ProfileRow = {
      id: PROFILE_ID,
      payload,
      encrypted: true,
      saltB64: material.saltB64,
      updatedAtMs: nowMs,
    };
    await db.profile.put(row);
    return row;
  }

  const row: ProfileRow = {
    id: PROFILE_ID,
    payload: json,
    encrypted: false,
    updatedAtMs: nowMs,
  };
  await db.profile.put(row);
  return row;
}

/**
 * Loads and decrypts the profile.
 * Throws if encrypted and PIN is missing/wrong.
 */
export async function loadProfile(pin?: string): Promise<MamaProfile | null> {
  const row = await db.profile.get(PROFILE_ID);
  if (!row) return null;

  if (!row.encrypted) {
    return JSON.parse(row.payload) as MamaProfile;
  }
  if (!pin) throw new Error('PIN required to unlock Mama Passport.');
  if (!row.saltB64) throw new Error('Encrypted profile is missing salt.');

  const material = await deriveKeyFromPin(pin, row.saltB64);
  try {
    const json = await decryptString(material.key, row.payload);
    return JSON.parse(json) as MamaProfile;
  } catch {
    throw new Error('Incorrect PIN or corrupted profile.');
  }
}

/** Deletes the local profile row (mother-initiated). */
export async function deleteProfile(): Promise<void> {
  await db.profile.delete(PROFILE_ID);
}

/** Records explicit sharing consent (Swahili/English versioned text lives in UI). */
export async function saveConsent(consent: Omit<ConsentRow, 'id'>): Promise<ConsentRow> {
  const row: ConsentRow = { id: 'latest', ...consent };
  await db.consent.put(row);
  return row;
}

export async function loadConsent(): Promise<ConsentRow | null> {
  return (await db.consent.get('latest')) ?? null;
}

/** Structured allergies for a profile, converting the older string list if needed. */
export function allergyAnswerOf(p: Pick<MamaProfile, 'allergyList' | 'noKnownAllergies' | 'allergies'> | null | undefined): AllergyAnswer {
  if (!p) return { noneKnown: false, items: [] };
  if (p.noKnownAllergies) return { noneKnown: true, items: [] };
  if (p.allergyList) return { noneKnown: false, items: p.allergyList };
  return { noneKnown: false, items: allergiesFromLegacy(p.allergies) };
}

/** Writes structured allergies onto a profile and drops the old string list. */
export function withAllergies(p: MamaProfile, a: AllergyAnswer): MamaProfile {
  const next: MamaProfile = { ...p };
  delete next.allergies;
  if (a.noneKnown) {
    next.noKnownAllergies = true;
    delete next.allergyList;
  } else {
    delete next.noKnownAllergies;
    if (a.items.length) next.allergyList = a.items;
    else delete next.allergyList;
  }
  return next;
}
