/**
 * Local-only auth for Neema.
 * No cloud accounts: PIN unlock, session lock, and consent gates before sharing.
 */

import { deriveKeyFromPin, encryptString, decryptString } from '../storage/crypto';
import { db } from '../storage/db';
import { loadConsent } from './passport';

const AUTH_ID = 'local';
const SESSION_KEY = 'neema.sessionUnlocked';

export interface AuthMeta {
  id: string;
  /** true when a PIN has been set. */
  pinEnabled: boolean;
  saltB64?: string;
  /** Encrypted verifier so we can check PIN without storing it. */
  pinVerifier?: string;
  /** How many digits the PIN has, so the unlock screen shows the right number of boxes. */
  pinLength?: number;
  updatedAtMs: number;
}

export type ShareTarget = 'chp' | 'family' | 'nurse';

/** Returns whether the in-memory/session unlock flag is set. */
export function isSessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function setSessionUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) sessionStorage.setItem(SESSION_KEY, '1');
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore storage failures in private mode
  }
}

export async function getAuthMeta(): Promise<AuthMeta | null> {
  return (await db.auth.get(AUTH_ID)) ?? null;
}

/**
 * Sets or rotates the local PIN. Unlocks the session on success.
 * PIN never leaves the device and is never stored in plaintext.
 */
export async function setPin(pin: string, nowMs: number = Date.now()): Promise<void> {
  if (pin.length < 4) throw new Error('PIN must be at least 4 characters.');
  const existing = await getAuthMeta();
  const material = await deriveKeyFromPin(pin, existing?.saltB64);
  const pinVerifier = await encryptString(material.key, 'neema-ok');
  const row: AuthMeta = {
    id: AUTH_ID,
    pinEnabled: true,
    saltB64: material.saltB64,
    pinVerifier,
    pinLength: pin.length,
    updatedAtMs: nowMs,
  };
  await db.auth.put(row);
  setSessionUnlocked(true);
}

/** Unlocks the session with the local PIN. */
export async function unlockWithPin(pin: string): Promise<void> {
  const meta = await getAuthMeta();
  if (!meta?.pinEnabled || !meta.saltB64 || !meta.pinVerifier) {
    throw new Error('No local PIN is set.');
  }
  const material = await deriveKeyFromPin(pin, meta.saltB64);
  try {
    const plain = await decryptString(material.key, meta.pinVerifier);
    if (plain !== 'neema-ok') throw new Error('Incorrect PIN.');
  } catch {
    throw new Error('Incorrect PIN.');
  }
  setSessionUnlocked(true);
}

/** Locks the session (e.g. discreet mode / leaving the app). */
export function lockSession(): void {
  setSessionUnlocked(false);
}

/**
 * Requires an unlocked session when a PIN is enabled.
 * Demo harness may call ensureUnlockedOrDemo(true) to allow unsigned demo use.
 */
export async function requireUnlockedSession(): Promise<void> {
  const meta = await getAuthMeta();
  if (!meta?.pinEnabled) return;
  if (!isSessionUnlocked()) throw new Error('Session locked. Unlock with your PIN.');
}

/**
 * Consent gate before SMS / nurse share.
 * Sharing choices are separate per the privacy section of the project doc.
 */
export async function requireShareConsent(target: ShareTarget): Promise<void> {
  await requireUnlockedSession();
  const consent = await loadConsent();
  if (!consent) {
    throw new Error('No consent on file. Record explicit consent before sharing.');
  }
  if (!consent.sharing[target]) {
    throw new Error(`Sharing with ${target} is not consented.`);
  }
}

/** True when PIN is enabled and session is locked (UI should show unlock). */
export async function needsUnlock(): Promise<boolean> {
  const meta = await getAuthMeta();
  return Boolean(meta?.pinEnabled && !isSessionUnlocked());
}
