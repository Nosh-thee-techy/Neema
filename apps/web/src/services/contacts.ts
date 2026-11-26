/**
 * Contact book helpers for CHP / family / supervisor escalation.
 */

import { isPlaceholderPhone, type AlertRecord, type Contact } from '@neema/core';
import { db } from '../storage/db';

/** Upserts a contact. */
export async function saveContact(contact: Contact): Promise<void> {
  await db.contacts.put(contact);
}

export async function listContacts(): Promise<Contact[]> {
  return db.contacts.orderBy('escalationOrder').toArray();
}

export async function deleteContact(id: string): Promise<void> {
  await db.contacts.delete(id);
}

/** Contacts sorted for SMS escalation (CHP/family first, supervisor last by order). */
export async function contactsForEscalation(): Promise<Contact[]> {
  return listContacts();
}

/** Records the human outcome of an alert (impact metrics). */
export async function setAlertOutcome(
  alertId: string,
  outcome: NonNullable<AlertRecord['outcome']>,
): Promise<void> {
  const row = await db.alerts.get(alertId);
  if (!row) return;
  await db.alerts.put({ ...row, outcome });
}

/** Whether Neema has someone real to alert. */
export interface ContactReadiness {
  /** At least one CHP with a real (non-placeholder) number. */
  hasRealChp: boolean;
  hasRealFamily: boolean;
  /** Contacts whose numbers look fake (e.g. demo numbers from older builds). */
  placeholders: Contact[];
  /** Contacts that alerts may actually go to. */
  usable: Contact[];
}

/** Checks the contact book before relying on it for alerts. */
export async function contactReadiness(): Promise<ContactReadiness> {
  const all = await listContacts();
  const placeholders = all.filter((c) => isPlaceholderPhone(c.phone));
  const usable = all.filter((c) => !isPlaceholderPhone(c.phone));
  return {
    hasRealChp: usable.some((c) => c.role === 'chp'),
    hasRealFamily: usable.some((c) => c.role === 'family'),
    placeholders,
    usable,
  };
}
