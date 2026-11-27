import { describe, expect, it } from 'vitest';
import {
  eddFromGestationalAge,
  isValidGestationalAge,
  pregnancyProgress,
  parseLocalIsoDate,
  toLocalIsoDate,
  trimesterFor,
} from '../src/pregnancy.js';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0, 0).getTime();

describe('pregnancy dating', () => {
  it('due date = recorded date + (280 − GA days)', () => {
    // 20 weeks 0 days on 1 Sep 2026 → 140 days left → 19 Jan 2027
    const edd = new Date(eddFromGestationalAge(20, 0, day(2026, 9, 1)));
    expect([edd.getFullYear(), edd.getMonth() + 1, edd.getDate()]).toEqual([2027, 1, 19]);
  });

  it('moves forward with the calendar instead of staying at the recorded week', () => {
    const p = pregnancyProgress({ kind: 'ga', weeks: 20, days: 0, recordedOnMs: day(2026, 9, 1) }, day(2026, 11, 27));
    // 1 Sep → 27 Nov = 87 days → 140 + 87 = 227 days = 32w 3d
    expect(p).not.toBeNull();
    expect(p!.weeks).toBe(32);
    expect(p!.days).toBe(3);
    expect(p!.trimester).toBe(3);
    expect(p!.daysToEdd).toBe(53);
  });

  it('uses gestational days when known', () => {
    const p = pregnancyProgress({ kind: 'ga', weeks: 12, days: 5, recordedOnMs: day(2026, 11, 27) }, day(2026, 11, 27));
    expect([p!.weeks, p!.days, p!.trimester]).toEqual([12, 5, 1]);
  });

  it('works from a known due date', () => {
    const p = pregnancyProgress({ kind: 'edd', eddMs: day(2027, 3, 1) }, day(2026, 11, 27));
    // 94 days to go → 186 days = 26w 4d
    expect([p!.weeks, p!.days, p!.trimester, p!.daysToEdd]).toEqual([26, 4, 2, 94]);
  });

  it('refuses dating that cannot be a current pregnancy', () => {
    expect(pregnancyProgress({ kind: 'edd', eddMs: day(2028, 1, 1) }, day(2026, 11, 27))).toBeNull();
    expect(pregnancyProgress({ kind: 'ga', weeks: 40, recordedOnMs: day(2026, 1, 1) }, day(2026, 11, 27))).toBeNull();
  });

  it('trimester boundaries and input checks', () => {
    expect(trimesterFor(13 * 7 + 6)).toBe(1);
    expect(trimesterFor(14 * 7)).toBe(2);
    expect(trimesterFor(27 * 7 + 6)).toBe(2);
    expect(trimesterFor(28 * 7)).toBe(3);
    expect(isValidGestationalAge(24, 3)).toBe(true);
    expect(isValidGestationalAge(24, 7)).toBe(false);
    expect(isValidGestationalAge(50, 0)).toBe(false);
  });

  it('local ISO date helpers round-trip without a UTC shift', () => {
    const ms = parseLocalIsoDate('2027-03-16')!;
    expect(new Date(ms).getDate()).toBe(16);
    expect(toLocalIsoDate(ms)).toBe('2027-03-16');
    expect(parseLocalIsoDate('2027-02-30')).toBeNull();
    expect(parseLocalIsoDate('16/03/2027')).toBeNull();
  });
});
