/**
 * Automatic alert chain for YELLOW/RED transitions.
 * Speaks the action, prepares sms: links, starts escalation on RED.
 * Web cannot silent-send SMS — returns hrefs the UI must open.
 */

import { FIELD_ESCALATION, type Contact, type EscalationTiming, type TriageResult } from '@neema/core';
import { raiseAlert, type RaiseAlertOptions } from './alerts';
import { contactReadiness } from './contacts';
import { startEscalation, type EscalationHandle } from './escalation';
import { LocationError, requestAlertLocation } from './location';
import { speakMessageKey } from './speech';
import { ensureFollowUp } from './followUp';
import { loadProfile } from './passport';

export interface AlertChainResult {
  alertId: string;
  level: 'YELLOW' | 'RED';
  smsLinks: { contact: Contact; href: string }[];
  primarySmsHref: string | null;
  /** The SMS text, so the UI can offer it to someone else (e.g. no CHP saved yet). */
  body: string;
  /** Contacts alerts may go to (placeholder numbers are excluded). */
  contacts: Contact[];
  spoken: boolean;
  locationAttached: boolean;
  escalation: EscalationHandle | null;
}

/**
 * Runs the product alert chain for a new YELLOW or RED result.
 * Idempotent callers should only invoke on level transitions.
 */
export async function runAlertChain(
  result: TriageResult,
  options: RaiseAlertOptions = { allowDemo: true, skipConsent: true },
  timing: EscalationTiming = FIELD_ESCALATION,
): Promise<AlertChainResult | null> {
  if (result.level !== 'YELLOW' && result.level !== 'RED') return null;

  const spokenResult = await speakMessageKey(result.messageKey);
  let locationUrl: string | undefined;
  let locationAttached = false;
  if (result.level === 'RED') {
    try {
      locationUrl = (await requestAlertLocation()).mapsUrl;
      locationAttached = true;
    } catch (err) {
      if (!(err instanceof LocationError)) throw err;
    }
  }

  const profile = await loadProfile().catch(() => null);
  // Never invent contacts: an SMS to a placeholder number reaches nobody.
  const contacts = (await contactReadiness()).usable;
  const { alert, body, smsLinks } = await raiseAlert(
    {
      level: result.level,
      firedRules: result.firedRules,
      motherName: profile?.displayName ?? 'Mama',
      reasons: result.reasons,
      ...(locationUrl ? { locationUrl } : {}),
    },
    contacts,
    options,
  );

  const escalation =
    result.level === 'RED'
      ? startEscalation(
          alert.id,
          contacts,
          smsLinks.map((l) => l.contact.id),
          timing,
          alert.tsMs,
        )
      : null;

  // Open a CareLoop-style chase loop for every YELLOW/RED alert.
  await ensureFollowUp(alert.id);

  return {
    alertId: alert.id,
    level: result.level,
    smsLinks,
    primarySmsHref: smsLinks[0]?.href ?? null,
    body,
    contacts,
    spoken: spokenResult !== 'text-only',
    locationAttached,
    escalation,
  };
}
