/**
 * Maps triage level to band LED / vibration commands.
 * Safety UX: RED is loud; UNKNOWN asks her to check the band.
 */

import type { BandCommand, TriageLevel } from '@neema/core';
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
