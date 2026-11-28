/**
 * Two demo mothers on one phone. Not one person at two times.
 *
 * Njoki is still pregnant (late, around week 35). Wanjiku has already given birth
 * and is the same composite already in the watch plan: she bled heavily at the birth
 * and is back at her stall within days. Neema never calls either of them high-risk.
 *
 * The app stores one active passport. Switching saves the active mother's stage-specific
 * rows, then writes only the other mother's rows, so check-ins and readings do not mix.
 * Demo only: hidden once the install is field-ready.
 */

import { BASELINE_MIN_SAMPLES, eddFromGestationalAge, toLocalIsoDate, type AlertRecord, type BpReading, type CheckIn, type SymptomReport, type VitalsMinute } from '@neema/core';
import { db, type BabyRow, type BaselineRow, type RecoveryCheckinRow } from '../storage/db';
import { setQuietWhenOut, isQuietWhenOut } from './quietMode';
import { loadProfile, saveProfile, type MamaProfile } from './passport';
import { demoToolsAllowed } from './demoPlayer';

export type DemoMotherId = 'njoki' | 'wanjiku';

export interface DemoMotherBundle {
  profile: MamaProfile;
  babies: BabyRow[];
  recoveryCheckins: RecoveryCheckinRow[];
  baseline: BaselineRow[];
  bp: BpReading[];
  symptoms: SymptomReport[];
  alerts: AlertRecord[];
  checkins: CheckIn[];
  /** "Quiet alerts when I am out" — on for Wanjiku, who is back at her stall. */
  quietWhenOut: boolean;
}

interface Store {
  active: DemoMotherId | null;
  mothers: Record<DemoMotherId, DemoMotherBundle>;
  /** A real passport that was on the phone before the first demo switch. */
  parked?: DemoMotherBundle;
}

const KEY = 'neema.demoMothers.v1';

function localIso(daysAgo: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return toLocalIsoDate(d.getTime());
}

function atHour(daysAgo: number, hour: number, now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, 30, 0, 0).getTime();
}

/** Late pregnancy. Recorded today so the week stays in the 34–36 range until time passes. */
function njokiBundle(nowMs: number): DemoMotherBundle {
  const weeks = 35;
  const days = 2;
  const profile: MamaProfile = {
    displayName: 'Njoki',
    fullName: 'Njoki',
    language: 'en',
    stage: 'pregnancy',
    dateOfBirth: '1997-03-14',
    location: 'Home',
    firstPregnancy: true,
    gaWeeks: weeks,
    gaDays: days,
    gaRecordedOnMs: nowMs,
    gestationWeeks: weeks,
    expectedDeliveryDate: toLocalIsoDate(eddFromGestationalAge(weeks, days, nowMs)),
    healthNotes: 'Heavily pregnant, still carrying the baby. Movements matter, and a clinic visit is close. The band is still learning my usual.',
    registeredBy: { role: 'self' },
    registeredAtMs: nowMs,
  };
  return {
    profile,
    babies: [],
    recoveryCheckins: [],
    // Not ready: the story and the heart-rate line say the band is still learning.
    baseline: [
      { id: 'hr', mean: 76, variance: 16, samples: 180, lastUpdatedMs: nowMs, ready: false },
      { id: 'temp', mean: 36.6, variance: 0.04, samples: 180, lastUpdatedMs: nowMs, ready: false },
    ],
    bp: [],
    symptoms: [],
    alerts: [],
    checkins: [],
    quietWhenOut: false,
  };
}

/**
 * Postpartum, day 2. Same facts as the watch-plan composite: vaginal birth,
 * heavy bleeding and a transfusion, back out within days. No pregnancy stage.
 */
function wanjikuBundle(nowMs: number): DemoMotherBundle {
  const dateIso = localIso(2, new Date(nowMs));
  const profile: MamaProfile = {
    displayName: 'Wanjiku',
    fullName: 'Wanjiku',
    language: 'en',
    stage: 'postpartum',
    dateOfBirth: '1993-08-02',
    location: 'Market',
    healthNotes: 'I have given birth and I am back at my stall. I bled heavily at the birth. Check-ins are for my body, bleeding, mood and sleep. The band still watches heart rate and temperature.',
    registeredBy: { role: 'self' },
    registeredAtMs: nowMs,
    delivery: {
      dateIso,
      time: '06:40',
      mode: 'vaginal',
      place: 'facility',
      complications: ['heavy_bleeding', 'transfusion'],
      babiesCount: 1,
      showBabyInfo: true,
      recordedBy: { role: 'self' },
      recordedAtMs: nowMs,
    },
  };
  const birthDateIso = dateIso;
  return {
    profile,
    babies: [{ id: `baby_${birthDateIso}_1`, birthDateIso, createdAtMs: nowMs }],
    recoveryCheckins: [
      {
        id: 'rc_wanjiku_day1',
        tsMs: atHour(1, 20, new Date(nowMs)),
        dayAfterBirth: 1,
        physical: 'okay',
        mood: 'okay',
        sleep: '3_4',
        bleeding: 'lighter',
        dangerCodes: [],
      },
    ],
    // Ready, around a calm night, so the band can say this is her usual — and the
    // watch plan still watches pulse more closely because of the bleeding at birth.
    baseline: [
      { id: 'hr', mean: 74, variance: 16, samples: BASELINE_MIN_SAMPLES, lastUpdatedMs: nowMs, ready: true },
      { id: 'temp', mean: 36.6, variance: 0.04, samples: BASELINE_MIN_SAMPLES, lastUpdatedMs: nowMs, ready: true },
      { id: 'hr_ref', mean: 74, variance: 9, samples: BASELINE_MIN_SAMPLES, lastUpdatedMs: nowMs, ready: true },
    ],
    bp: [],
    symptoms: [],
    alerts: [],
    checkins: [],
    quietWhenOut: true,
  };
}

function freshStore(nowMs: number): Store {
  return { active: null, mothers: { njoki: njokiBundle(nowMs), wanjiku: wanjikuBundle(nowMs) } };
}

function readStore(): Store {
  const fresh = freshStore(Date.now());
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<Store>;
    const active = parsed.active === 'njoki' || parsed.active === 'wanjiku' ? parsed.active : null;
    return {
      active,
      mothers: {
        njoki: parsed.mothers?.njoki ?? fresh.mothers.njoki,
        wanjiku: parsed.mothers?.wanjiku ?? fresh.mothers.wanjiku,
      },
      ...(parsed.parked ? { parked: parsed.parked } : {}),
    };
  } catch {
    return fresh;
  }
}

function writeStore(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

/** Which demo mother is currently written into the passport, if any. */
export function activeDemoMother(): DemoMotherId | null {
  return readStore().active;
}

async function captureLive(): Promise<DemoMotherBundle> {
  const profile = await loadProfile();
  if (!profile) throw new Error('No profile on this phone.');
  const [babies, recoveryCheckins, baseline, bp, symptoms, alerts, checkins] = await Promise.all([
    db.babies.toArray(),
    db.recoveryCheckins.toArray(),
    db.baseline.toArray(),
    db.bp.toArray(),
    db.symptoms.toArray(),
    db.alerts.toArray(),
    db.checkins.toArray(),
  ]);
  return {
    profile,
    babies,
    recoveryCheckins,
    baseline,
    bp,
    symptoms,
    alerts,
    checkins,
    quietWhenOut: isQuietWhenOut(),
  };
}

/** A few calm minutes so switching does not look like the band has gone quiet. */
function calmMinutes(nowMs: number, bundle: DemoMotherBundle): VitalsMinute[] {
  const hr = Math.round(bundle.baseline.find((row) => row.id === 'hr')?.mean ?? 74);
  const temp = bundle.baseline.find((row) => row.id === 'temp')?.mean ?? 36.6;
  const rows: VitalsMinute[] = [];
  for (let i = 12; i >= 0; i--) {
    const tsMs = nowMs - i * 60_000;
    rows.push({
      tsMs,
      hrMean: hr,
      hrMin: hr - 2,
      hrMax: hr + 2,
      tempMeanC: Math.round(temp * 10) / 10,
      validFraction: 1,
    });
  }
  return rows;
}

async function writeLive(bundle: DemoMotherBundle): Promise<void> {
  await db.transaction(
    'rw',
    [db.profile, db.babies, db.recoveryCheckins, db.baseline, db.bp, db.symptoms, db.alerts, db.checkins, db.vitalsMinutes, db.vitalsDaily],
    async () => {
      await Promise.all([
        db.babies.clear(),
        db.recoveryCheckins.clear(),
        db.baseline.clear(),
        db.bp.clear(),
        db.symptoms.clear(),
        db.alerts.clear(),
        db.checkins.clear(),
        // Drop the shared minute stream so a scripted fever does not follow the other mother.
        db.vitalsMinutes.clear(),
        db.vitalsDaily.clear(),
      ]);
      await db.vitalsMinutes.bulkPut(calmMinutes(Date.now(), bundle));
      if (bundle.babies.length) await db.babies.bulkPut(bundle.babies);
      if (bundle.recoveryCheckins.length) await db.recoveryCheckins.bulkPut(bundle.recoveryCheckins);
      if (bundle.baseline.length) await db.baseline.bulkPut(bundle.baseline);
      if (bundle.bp.length) await db.bp.bulkPut(bundle.bp);
      if (bundle.symptoms.length) await db.symptoms.bulkPut(bundle.symptoms);
      if (bundle.alerts.length) await db.alerts.bulkPut(bundle.alerts);
      if (bundle.checkins.length) await db.checkins.bulkPut(bundle.checkins);
      await saveProfile(bundle.profile);
    },
  );
  setQuietWhenOut(bundle.quietWhenOut);
}

/**
 * Saves whoever is on screen, then loads Njoki or Wanjiku.
 * A second tap on the mother already showing does nothing.
 */
export async function activateDemoMother(id: DemoMotherId): Promise<void> {
  if (!(await demoToolsAllowed())) {
    throw new Error('Demo mothers are switched off once the app is field-ready.');
  }
  const store = readStore();
  if (store.active === id) return;

  if (store.active) {
    try {
      store.mothers[store.active] = await captureLive();
    } catch {
      // Keep the last saved bundle when the passport cannot be read.
    }
  } else if (!store.parked) {
    try {
      const live = await loadProfile();
      if (live) store.parked = await captureLive();
    } catch {
      // An encrypted passport stays untouched until it can be read. The demo write replaces the row.
    }
  }

  // Persist the snapshot before replacing the live passport.
  writeStore(store);
  await writeLive(store.mothers[id]);
  store.active = id;
  writeStore(store);
}
