/**
 * What the home screen shows about today, read from the phone's own store.
 */

import { useEffect, useState } from 'react';
import type { BpReading } from '@neema/core';
import { loadProfile } from '../services/passport';
import { contactReadiness } from '../services/contacts';
import { db } from '../storage/db';

export interface TodaySnapshot {
  /** Name from the passport, or null when none is saved or it is locked. */
  name: string | null;
  gestationWeeks: number | null;
  lastBp: BpReading | null;
  bpToday: boolean;
  lastSymptomTsMs: number | null;
  symptomsToday: boolean;
  /** null until loaded; false means alerts have no real CHP to go to. */
  hasRealChp: boolean | null;
  placeholderContacts: number;
}

const EMPTY: TodaySnapshot = {
  name: null,
  gestationWeeks: null,
  lastBp: null,
  bpToday: false,
  lastSymptomTsMs: null,
  symptomsToday: false,
  hasRealChp: null,
  placeholderContacts: 0,
};

function startOfLocalDay(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Loads today's snapshot. Reloads whenever `refreshKey` changes
 * (pass something that moves when new readings land, such as the triage level).
 */
export function useToday(refreshKey: unknown): TodaySnapshot {
  const [snapshot, setSnapshot] = useState<TodaySnapshot>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const dayStart = startOfLocalDay(Date.now());
      const [profile, lastBp, lastSymptom, contacts] = await Promise.all([
        loadProfile().catch(() => null),
        db.bp.orderBy('tsMs').last(),
        db.symptoms.orderBy('tsMs').last(),
        contactReadiness(),
      ]);
      if (cancelled) return;
      const pregnant = profile?.stage === 'pregnancy';
      setSnapshot({
        name: profile?.displayName?.trim() || null,
        gestationWeeks: pregnant ? (profile?.gestationWeeks ?? null) : null,
        lastBp: lastBp ?? null,
        bpToday: Boolean(lastBp && lastBp.tsMs >= dayStart),
        lastSymptomTsMs: lastSymptom?.tsMs ?? null,
        symptomsToday: Boolean(lastSymptom && lastSymptom.tsMs >= dayStart),
        hasRealChp: contacts.hasRealChp,
        placeholderContacts: contacts.placeholders.length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return snapshot;
}
