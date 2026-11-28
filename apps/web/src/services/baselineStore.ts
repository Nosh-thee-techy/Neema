/**
 * Persists personal baseline state in IndexedDB and updates it from sealed minutes.
 * Only resting-context samples should be passed in (night window or markedResting).
 */

import {
  createBaseline,
  updateBaseline,
  updateReference,
  type BaselineSignal,
  type BaselineState,
  type VitalsMinute,
} from '@neema/core';
import { db, type BaselineRow } from '../storage/db';

function rowToState(row: BaselineRow): BaselineState {
  return {
    signal: row.id as BaselineSignal,
    mean: row.mean,
    variance: row.variance,
    samples: row.samples,
    lastUpdatedMs: row.lastUpdatedMs,
    ready: row.ready,
  };
}

async function saveState(state: BaselineState): Promise<void> {
  await db.baseline.put({
    id: state.signal,
    mean: state.mean,
    variance: state.variance,
    samples: state.samples,
    lastUpdatedMs: state.lastUpdatedMs,
    ready: state.ready,
  });
}

/** Loads a baseline from IndexedDB, or creates an empty one. */
export async function loadBaseline(signal: BaselineSignal, nowMs: number = Date.now()): Promise<BaselineState> {
  const row = await db.baseline.get(signal);
  return row ? rowToState(row) : createBaseline(signal, nowMs);
}

/**
 * Feeds one sealed minute into HR and temp baselines when values are present.
 * Returns the updated states (and z-scores) after persistence.
 */
export async function ingestMinuteIntoBaseline(
  minute: VitalsMinute,
  opts?: { resting?: boolean },
): Promise<{ hr: BaselineState; temp: BaselineState; hrZ: number | null; tempZ: number | null }> {
  // ASSUMPTION: caller gates on resting context; default true for night pipeline use.
  if (opts?.resting === false) {
    const hr = await loadBaseline('hr', minute.tsMs);
    const temp = await loadBaseline('temp', minute.tsMs);
    return { hr, temp, hrZ: null, tempZ: null };
  }

  let hr = await loadBaseline('hr', minute.tsMs);
  let temp = await loadBaseline('temp', minute.tsMs);
  let hrZ: number | null = null;
  let tempZ: number | null = null;

  if (minute.hrMean !== null) {
    const updated = updateBaseline(hr, minute.hrMean, minute.tsMs);
    hr = updated.state;
    hrZ = updated.z;
    await saveState(hr);
    // Her settled pulse (slow, about a day) for the watch plan's slow-rise check.
    const settled = updateReference(await loadBaseline('hr_ref', minute.tsMs), minute.hrMean, minute.tsMs);
    await saveState(settled.state);
  }
  if (minute.tempMeanC !== null) {
    const updated = updateBaseline(temp, minute.tempMeanC, minute.tsMs);
    temp = updated.state;
    tempZ = updated.z;
    await saveState(temp);
  }

  return { hr, temp, hrZ, tempZ };
}

/**
 * Starts her settled pulse again. Called when the birth is recorded or removed:
 * pregnancy raises the resting pulse, so after birth her settled pulse is learned fresh.
 * The fast baseline is left alone (it re-learns within the hour on its own).
 */
export async function restartSettledPulse(): Promise<void> {
  await db.baseline.delete('hr_ref');
}
