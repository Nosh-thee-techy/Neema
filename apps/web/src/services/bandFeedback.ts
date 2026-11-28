/**
 * Maps triage level to band LED / vibration commands.
 * Safety UX: RED is loud; UNKNOWN asks her to check the band.
 */

import { dueCheckNudge, type BandCommand, type TriageLevel, type WatchPlan } from '@neema/core';
import type { BandSource } from './bandSource';

/** Commands to send when the triage level changes. */
export function commandsForLevel(level: TriageLevel): BandCommand[] {
  switch (level) {
    case 'GREEN':
      return [{ kind: 'led', color: 'green' }];
    case 'YELLOW':
      return [
        { kind: 'led', color: 'yellow' },
        { kind: 'vibrate', pattern: 'short' },
      ];
    case 'RED':
      return [
        { kind: 'led', color: 'red' },
        { kind: 'vibrate', pattern: 'sos' },
      ];
    case 'UNKNOWN':
      return [
        { kind: 'led', color: 'off' },
        { kind: 'vibrate', pattern: 'short' },
      ];
  }
}

/**
 * Sends band feedback for a new triage level.
 * No-ops quietly when the band is disconnected.
 */
export async function applyBandFeedback(
  band: BandSource,
  level: TriageLevel,
): Promise<void> {
  if (!band.isConnected()) return;
  for (const command of commandsForLevel(level)) {
    await band.sendCommand(command);
  }
}

const NUDGE_KEY = 'neema.dueNudgeDay';

/**
 * One gentle buzz (no light change) when a check her watch plan asks for is due,
 * such as a blood pressure reading. At most once a day, daytime only.
 * The Today card shows what is due. No-ops quietly when the band is disconnected.
 */
export async function nudgeIfCheckDue(
  band: BandSource,
  plan: WatchPlan,
  lastBpMs: number | null,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!band.isConnected()) return false;
  let last: string | null = null;
  try {
    last = localStorage.getItem(NUDGE_KEY);
  } catch {
    last = null;
  }
  const { nudge, dayIso } = dueCheckNudge(plan, lastBpMs, nowMs, last);
  if (!nudge) return false;
  try {
    localStorage.setItem(NUDGE_KEY, dayIso);
  } catch {
    // Without storage it may buzz again later today; that is the safer side.
  }
  await band.sendCommand({ kind: 'vibrate', pattern: 'short' });
  return true;
}
