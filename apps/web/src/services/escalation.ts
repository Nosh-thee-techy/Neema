/**
 * Escalation timer for unacknowledged RED alerts.
 * Uses the pure plan from @neema/core: after 5 minutes the next contact, after 10 minutes
 * the CHP supervisor. Each due step hands the UI a contact so it can offer a new SMS
 * and sound an alarm (a web app cannot send SMS silently).
 */

import {
  FIELD_ESCALATION,
  dueEscalationSteps,
  planEscalation,
  type Contact,
  type EscalationStepPlan,
  type EscalationTiming,
} from '@neema/core';
import { acknowledgeRed } from './alerts';
import { db } from '../storage/db';

export type EscalationStep =
  | { kind: 'idle' }
  | { kind: 'notify'; contact: Contact; dueAtMs: number; label: 'next' | 'supervisor' }
  | { kind: 'acknowledged' }
  | { kind: 'exhausted' };

export interface EscalationHandle {
  /** Poll the next due step; safe to call every second from the UI. One step per call. */
  tick(nowMs?: number): Promise<EscalationStep>;
  /** When the next step is due, or null when nothing is left. */
  nextDueAtMs(): number | null;
  /** Stop timers without acknowledging the alert. */
  stop(): void;
}

/**
 * Starts escalation for a RED alert.
 * `alreadyOfferedIds` are the contacts who got an SMS when the alert was raised.
 * `startedAtMs` is the alert's own time, so escalation resumes correctly after a reload.
 */
export function startEscalation(
  alertId: string,
  contacts: Contact[],
  alreadyOfferedIds: string[] = [],
  timing: EscalationTiming = FIELD_ESCALATION,
  startedAtMs: number = Date.now(),
): EscalationHandle {
  const plan: EscalationStepPlan[] = planEscalation(contacts, alreadyOfferedIds, timing);
  const fired: string[] = [];
  let stopped = false;

  return {
    async tick(nowMs: number = Date.now()): Promise<EscalationStep> {
      if (stopped) return { kind: 'idle' };
      const alert = await db.alerts.get(alertId);
      if (!alert || alert.level !== 'RED') return { kind: 'idle' };
      if (alert.acknowledgedAtMs !== undefined) {
        stopped = true;
        return { kind: 'acknowledged' };
      }
      const [step] = dueEscalationSteps(plan, nowMs - startedAtMs, fired);
      if (step) {
        fired.push(step.contact.id);
        return { kind: 'notify', contact: step.contact, dueAtMs: startedAtMs + step.afterMs, label: step.label };
      }
      return fired.length === plan.length ? { kind: 'exhausted' } : { kind: 'idle' };
    },
    nextDueAtMs() {
      if (stopped) return null;
      const next = plan.find((s) => !fired.includes(s.contact.id));
      return next ? startedAtMs + next.afterMs : null;
    },
    stop() {
      stopped = true;
    },
  };
}

/** Convenience: acknowledge RED and stop escalation. */
export async function acknowledgeAndStop(
  alertId: string,
  handle: EscalationHandle,
  atMs: number = Date.now(),
): Promise<void> {
  await acknowledgeRed(alertId, atMs);
  handle.stop();
}
