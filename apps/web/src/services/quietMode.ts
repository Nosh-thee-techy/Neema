/**
 * "Quiet alerts when I'm out": for a mother at the market or at work.
 * A YELLOW (please check) buzzes the band and shows on screen without speaking aloud.
 * RED is never quiet: the emergency is always spoken and loud. Stored on this phone only.
 */

const KEY = 'neema.quietWhenOut';

export function isQuietWhenOut(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setQuietWhenOut(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: stay with the default (spoken).
  }
}
