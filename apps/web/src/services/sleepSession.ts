/**
 * She tells Neema she is going to sleep. While this is on, a slower heart is rest,
 * and the "your readings changed" screen stays quiet.
 * Waking is her tap, or the morning (8 hours), whichever comes first.
 * This is not a detector of unconsciousness. That still needs a person who cannot wake her.
 */

const KEY = 'neema.sleep.until';
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

export function sleepUntilMs(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function sleepingNow(nowMs = Date.now()): boolean {
  const until = sleepUntilMs();
  return until !== null && nowMs < until;
}

export function startSleep(nowMs = Date.now()): number {
  const until = nowMs + EIGHT_HOURS;
  try {
    localStorage.setItem(KEY, String(until));
  } catch {
    /* private mode */
  }
  return until;
}

export function endSleep(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
