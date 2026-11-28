/**
 * Recording the birth: moves the mother from pregnancy to recovery (postpartum)
 * without deleting anything from her pregnancy.
 */
import { parseLocalIsoDate, postpartumProgress, pregnancyProgress, type PostpartumProgress } from '@neema/core';
import { db, type BabyRow } from '../storage/db';
import { loadProfile, saveProfile, type DeliveryRecord, type MamaProfile } from './passport';
import { datingFromProfile } from './pregnancyProgress';

export function deliveryMsOf(p: MamaProfile | null | undefined): number | null {
  if (!p?.delivery?.dateIso) return null;
  const day = parseLocalIsoDate(p.delivery.dateIso);
  if (day === null) return null;
  if (p.delivery.time && /^\d{2}:\d{2}$/.test(p.delivery.time)) {
    const [h, m] = p.delivery.time.split(':').map(Number);
    return day + (h! * 60 + m!) * 60_000;
  }
  return day;
}

export function recoveryProgressOf(p: MamaProfile | null | undefined, nowMs = Date.now()): PostpartumProgress | null {
  const ms = deliveryMsOf(p);
  return ms === null ? null : postpartumProgress(ms, nowMs);
}

/** Saves the birth, switches the stage, and creates the baby record(s). */
export async function recordDelivery(
  record: Omit<DeliveryRecord, 'gestationAtBirth' | 'recordedAtMs'>,
  babyNames: string[] = [],
): Promise<MamaProfile> {
  const existing = await loadProfile().catch(() => null);
  if (!existing) throw new Error('No profile on this phone yet.');
  const birthMs = parseLocalIsoDate(record.dateIso);
  if (birthMs === null) throw new Error('Invalid birth date.');

  // Pregnancy length at birth, from the saved dating, for the history.
  const dating = datingFromProfile(existing);
  const atBirth = dating ? pregnancyProgress(dating, birthMs) : null;

  const delivery: DeliveryRecord = {
    ...record,
    recordedAtMs: Date.now(),
    ...(atBirth ? { gestationAtBirth: { weeks: atBirth.weeks, days: atBirth.days } } : {}),
  };
  const next: MamaProfile = { ...existing, stage: 'postpartum', delivery };
  await saveProfile(next);

  // Replace baby rows for this birth date (re-recording edits them).
  await db.babies.where('birthDateIso').equals(record.dateIso).delete();
  const rows: BabyRow[] = Array.from({ length: Math.max(1, record.babiesCount) }, (_, i) => {
    const name = babyNames[i]?.trim();
    return {
      id: `baby_${record.dateIso}_${i + 1}`,
      birthDateIso: record.dateIso,
      createdAtMs: Date.now(),
      ...(name ? { name } : {}),
    };
  });
  await db.babies.bulkPut(rows);
  return next;
}

/** Undo a birth recorded by mistake: back to pregnancy; the pregnancy data was never removed. */
export async function undoDelivery(): Promise<MamaProfile | null> {
  const existing = await loadProfile().catch(() => null);
  if (!existing?.delivery) return existing;
  const { delivery, ...rest } = existing;
  await db.babies.where('birthDateIso').equals(delivery.dateIso).delete();
  const next: MamaProfile = { ...rest, stage: 'pregnancy' };
  await saveProfile(next);
  return next;
}

export async function listBabies(): Promise<BabyRow[]> {
  return db.babies.orderBy('birthDateIso').toArray();
}

export async function setShowBabyInfo(show: boolean): Promise<void> {
  const p = await loadProfile().catch(() => null);
  if (!p?.delivery) return;
  await saveProfile({ ...p, delivery: { ...p.delivery, showBabyInfo: show } });
}
