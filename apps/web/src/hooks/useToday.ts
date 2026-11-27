/**
 * What the home screen shows about today, read from the phone's own store.
 */

import { useEffect, useState } from 'react';
import type { BpReading, PregnancyProgress, Stage } from '@neema/core';
import { loadProfile } from '../services/passport';
import { contactReadiness } from '../services/contacts';
import { progressFromProfile } from '../services/pregnancyProgress';
import { db } from '../storage/db';

export interface TodaySnapshot {
  /** Name from the passport, or null when none is saved or it is locked. */
  name: string | null;
  gestationWeeks: number | null;
  /** Live pregnancy progress from the clinic dating; null when unknown or after birth. */
  pregnancy: PregnancyProgress | null;
  stage: Stage | null;
  lastBp: BpReading | null;
  /** Up to the last 7 real BP readings, oldest first (for the small trend line). */
  recentBp: BpReading[];
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
  pregnancy: null,
  stage: null,
  lastBp: null,
  recentBp: [],
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
      const [profile, recentDesc, lastSymptom, contacts] = await Promise.all([
        loadProfile().catch(() => null),
        db.bp.orderBy('tsMs').reverse().limit(7).toArray(),
        db.symptoms.orderBy('tsMs').last(),
        contactReadiness(),
      ]);
      if (cancelled) return;
      const pregnant = profile?.stage === 'pregnancy';
      const pregnancy = pregnant ? progressFromProfile(profile) : null;
      const lastBp = recentDesc[0];
      setSnapshot({
        name: profile?.displayName?.trim() || null,
        gestationWeeks: pregnant ? (pregnancy?.weeks ?? profile?.gestationWeeks ?? null) : null,
        pregnancy,
        stage: profile?.stage ?? null,
        lastBp: lastBp ?? null,
        recentBp: recentDesc.slice().reverse(),
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
