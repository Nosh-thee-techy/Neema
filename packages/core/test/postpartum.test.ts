import { describe, expect, it } from 'vitest';
import { nextKepiVisit, nextPncContact, postpartumProgress } from '../src/postpartum.js';

const birth = new Date(2026, 10, 15, 22, 30).getTime(); // 15 Nov, late evening

describe('postpartumProgress', () => {
  it('counts calendar days from the birth day', () => {
    expect(postpartumProgress(birth, new Date(2026, 10, 15, 23, 0).getTime())?.daysSinceBirth).toBe(0);
    expect(postpartumProgress(birth, new Date(2026, 10, 16, 1, 0).getTime())?.daysSinceBirth).toBe(1);
    const p = postpartumProgress(birth, new Date(2026, 10, 27, 10).getTime())!;
    expect(p).toEqual({ daysSinceBirth: 12, weeks: 1, days: 5, inPostnatalPeriod: true });
  });
  it('rejects future and very old dates', () => {
    expect(postpartumProgress(birth, new Date(2026, 10, 14).getTime())).toBeNull();
    expect(postpartumProgress(birth, new Date(2028, 0, 1).getTime())).toBeNull();
  });
});

describe('schedules', () => {
  it('next WHO postnatal contact', () => {
    expect(nextPncContact(0)).toMatchObject({ contact: { id: 'pnc1' }, dueNow: true });
    expect(nextPncContact(5)).toMatchObject({ contact: { id: 'pnc3' }, dueNow: false });
    expect(nextPncContact(10)).toMatchObject({ contact: { id: 'pnc3' }, dueNow: true });
    expect(nextPncContact(50)).toBeNull();
  });
  it('next baby vaccine visit', () => {
    expect(nextKepiVisit(0)?.id).toBe('birth');
    expect(nextKepiVisit(3)?.id).toBe('w6');
    expect(nextKepiVisit(20)?.id).toBe('w6');
    expect(nextKepiVisit(44)?.id).toBe('w6');
    expect(nextKepiVisit(60)?.id).toBe('w10');
  });
});
