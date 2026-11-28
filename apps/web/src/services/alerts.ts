/**
 * Alert service: builds prefilled SMS links and tracks acknowledgment.
 * RED stays sticky until acknowledgeRed() is called.
 * Privacy: only status, top reason, and a location link leave the phone.
 */

import { buildAlertSmsText, type AlertRecord, type Contact, type RuleId, type TriageLevel } from '@neema/core';
import { db } from '../storage/db';
import { requireShareConsent } from './auth';
import { assertFieldReady } from './readiness';

export interface AlertDraft {
  level: Exclude<TriageLevel, 'GREEN' | 'UNKNOWN'>;
  firedRules: RuleId[];
  motherName: string;
  /** Reason codes from the triage result; the SMS uses the most urgent one in plain words. */
  reasons: readonly string[];
  /** Optional maps link; ASSUMPTION: caller supplies after geolocation consent. */
  locationUrl?: string;
  /** Why her watch plan watches her more closely (Swahili). YELLOW SMS only. */
  watching?: string;
}

/** Builds a short alert body. Swahili wording still needs native review. */
export function buildAlertSmsBody(draft: AlertDraft): string {
  return buildAlertSmsText({
    level: draft.level,
    motherName: draft.motherName,
    reasons: draft.reasons,
    ...(draft.locationUrl ? { locationUrl: draft.locationUrl } : {}),
    ...(draft.watching ? { watching: draft.watching } : {}),
  });
}

/**
 * Who gets the first SMS (project doc §10).
 * YELLOW: a quiet heads-up to the CHP only. RED: the CHP and one family contact.
 * Each gets their own SMS: a group text would become MMS and need mobile data.
 * Further contacts are reached by the escalation timer.
 */
export function firstRecipients(level: AlertDraft['level'], contacts: Contact[]): Contact[] {
  const ordered = [...contacts].sort((a, b) => a.escalationOrder - b.escalationOrder);
  const chp = ordered.find((c) => c.role === 'chp') ?? ordered.find((c) => c.role !== 'supervisor');
  if (level === 'YELLOW') return chp ? [chp] : [];
  const family = ordered.find((c) => c.role === 'family' && c.id !== chp?.id);
  return [chp, family].filter((c): c is Contact => c !== undefined);
}

/**
 * Builds an sms: URI for the prototype (user taps send).
 * With no phone it opens the SMS app with only the text, so she can pick who to send it to.
 */
export function buildSmsLink(phone: string | null, body: string): string {
  const normalized = (phone ?? '').replace(/\s+/g, '');
  return `sms:${normalized}?&body=${encodeURIComponent(body)}`;
}

export interface RaiseAlertOptions {
  /**
   * Demo/harness may set allowDemo: true to skip field-readiness gates.
   * Real field use must leave this false/undefined.
   */
  allowDemo?: boolean;
  /** Skip CHP consent check only when allowDemo is true. */
  skipConsent?: boolean;
}

/** Persists a new alert and returns SMS links for contacts in escalation order. */
export async function raiseAlert(
  draft: AlertDraft,
  contacts: Contact[],
  options: RaiseAlertOptions = {},
): Promise<{ alert: AlertRecord; body: string; smsLinks: { contact: Contact; href: string }[] }> {
  await assertFieldReady({ allowDemo: options.allowDemo === true });
  if (!options.allowDemo || !options.skipConsent) {
    await requireShareConsent('chp');
  }
  const body = buildAlertSmsBody(draft);
  const ordered = firstRecipients(draft.level, contacts);
  const now = Date.now();
  const alert: AlertRecord = {
    id: crypto.randomUUID(),
    tsMs: now,
    level: draft.level,
    firedRules: draft.firedRules,
    reasons: [...draft.reasons],
    smsBody: body,
    notified: [],
  };
  await db.alerts.put(alert);
  return {
    body,
    alert,
    smsLinks: ordered.map((contact) => ({
      contact,
      href: buildSmsLink(contact.phone, body),
    })),
  };
}

/** Who confirmed that someone is acting on a RED (project doc safety principle 4). */
export type AcknowledgedBy = NonNullable<AlertRecord['acknowledgedBy']>;

/**
 * Marks a RED alert as acknowledged so triage can leave RED.
 * Only a CHP reply, the mother confirming she is on her way, or a clinician may clear it.
 */
export async function acknowledgeRed(
  alertId: string,
  atMs: number = Date.now(),
  by: AcknowledgedBy = 'mother_on_the_way',
): Promise<void> {
  const row = await db.alerts.get(alertId);
  if (!row) return;
  const outcome: AlertRecord['outcome'] =
    row.outcome ?? (by === 'clinician_cleared' ? 'resolved' : by === 'mother_on_the_way' ? 'went_to_facility' : undefined);
  await db.alerts.put({
    ...row,
    acknowledgedAtMs: atMs,
    acknowledgedBy: by,
    ...(outcome ? { outcome } : {}),
  });
}

/** Latest unacknowledged RED alert, if any (survives reloads). */
export async function activeRedAlert(): Promise<AlertRecord | null> {
  const rows = await db.alerts.orderBy('tsMs').reverse().toArray();
  return rows.find((a) => a.level === 'RED' && a.acknowledgedAtMs === undefined) ?? null;
}

/** Records that an sms: link was opened for a contact. */
export async function markNotified(alertId: string, contactId: string, atMs: number = Date.now()): Promise<void> {
  const row = await db.alerts.get(alertId);
  if (!row) return;
  await db.alerts.put({
    ...row,
    notified: [...row.notified, { contactId, method: 'sms_link', atMs }],
  });
}
