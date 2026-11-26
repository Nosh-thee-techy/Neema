/**
 * Escalation plan for an unacknowledged RED (project doc §10):
 * after 5 minutes message the next contact, after 10 minutes the CHP supervisor.
 * Pure planning only; timers and SMS links live in the app's services.
 */

import type { Contact } from './types.js';

/** Delays from the moment the RED alert was raised. Placeholders pending clinician review. */
export interface EscalationTiming {
  nextContactAfterMs: number;
  supervisorAfterMs: number;
}

/** Field timing from the project doc. */
export const FIELD_ESCALATION: EscalationTiming = {
  nextContactAfterMs: 5 * 60_000,
  supervisorAfterMs: 10 * 60_000,
};

/** Shortened timing for the stage demo only, so the audience sees escalation happen. */
export const DEMO_ESCALATION: EscalationTiming = {
  nextContactAfterMs: 30_000,
  supervisorAfterMs: 60_000,
};

/** One planned escalation message. */
export interface EscalationStepPlan {
  /** Milliseconds after the alert was raised. */
  afterMs: number;
  contact: Contact;
  label: 'next' | 'supervisor';
}

/**
 * Plans who to message next and when.
 * Skips anyone already offered an SMS for this alert; a missing role is simply skipped.
 */
export function planEscalation(
  contacts: readonly Contact[],
  alreadyOfferedIds: readonly string[],
  timing: EscalationTiming = FIELD_ESCALATION,
): EscalationStepPlan[] {
  const offered = new Set(alreadyOfferedIds);
  const ordered = [...contacts].sort((a, b) => a.escalationOrder - b.escalationOrder);
  const steps: EscalationStepPlan[] = [];

  const next = ordered.find((c) => c.role !== 'supervisor' && !offered.has(c.id));
  if (next) steps.push({ afterMs: timing.nextContactAfterMs, contact: next, label: 'next' });

  const supervisor = ordered.find((c) => c.role === 'supervisor' && !offered.has(c.id));
  if (supervisor) {
    steps.push({ afterMs: timing.supervisorAfterMs, contact: supervisor, label: 'supervisor' });
  }
  return steps;
}

/** Steps that are due at `elapsedMs` and have not been fired yet. */
export function dueEscalationSteps(
  plan: readonly EscalationStepPlan[],
  elapsedMs: number,
  firedContactIds: readonly string[],
): EscalationStepPlan[] {
  const fired = new Set(firedContactIds);
  return plan.filter((s) => elapsedMs >= s.afterMs && !fired.has(s.contact.id));
}
