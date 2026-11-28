/**
 * She tells Neema she is going to sleep. While this is on, a slower heart is rest,
 * and the "your readings changed" screen stays quiet.
 * Waking is her tap, or the morning (8 hours), whichever comes first.
 * This is not a detector of unconsciousness. That still needs a person who cannot wake her.
 */

const KEY = 'neema.sleep.until';
const START_KEY = 'neema.sleep.started';
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

export function sleepStartedMs(): number | null {
  try {
    const raw = localStorage.getItem(START_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function startSleep(nowMs = Date.now()): number {
  const until = nowMs + EIGHT_HOURS;
  try {
    localStorage.setItem(KEY, String(until));
    localStorage.setItem(START_KEY, String(nowMs));
  } catch {
    /* private mode */
  }
  return until;
}

/** Clears the sleep flag. Returns hours asleep when she had tapped “going to sleep”. */
export function endSleep(nowMs = Date.now()): number | null {
  const start = sleepStartedMs();
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(START_KEY);
  } catch {
    /* ignore */
  }
  if (start === null) return null;
  const hours = (nowMs - start) / (60 * 60 * 1000);
  if (!Number.isFinite(hours) || hours < 0.25 || hours > 16) return null;
  return Math.round(hours * 10) / 10;
}
