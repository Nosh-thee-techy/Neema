import { describe, expect, it } from 'vitest';
import { WEEKLY_INSIGHTS, insightForWeek, weeklyInsightsReviewed } from '../src/weeklyInsights.js';

describe('weekly insights', () => {
  it('covers every week from 4 to 42 with no gaps or overlaps', () => {
    for (let w = 4; w <= 42; w++) {
      const hits = WEEKLY_INSIGHTS.filter((c) => w >= c.fromWeek && w <= c.toWeek);
      expect(hits.length, `week ${w}`).toBe(1);
    }
  });

  it('early weeks show the first card; beyond 42 shows none', () => {
    expect(insightForWeek(2)?.id).toBe('w04_07');
    expect(insightForWeek(24)?.id).toBe('w24_27');
    expect(insightForWeek(43)).toBeNull();
  });

  it('every card has both languages, a source link, and a watch-for line', () => {
    for (const c of WEEKLY_INSIGHTS) {
      for (const k of ['babyEn', 'babySw', 'feelEn', 'feelSw', 'doEn', 'doSw', 'watchEn', 'watchSw'] as const) {
        expect(c[k].length, `${c.id}.${k}`).toBeGreaterThan(10);
      }
      expect(c.sourceUrl).toMatch(/^https:\/\/www\.nhs\.uk\//);
    }
  });

  it('stays draft until a clinician reviews it, and never uses diagnosis words', () => {
    expect(weeklyInsightsReviewed()).toBe(false);
    const all = WEEKLY_INSIGHTS.map((c) => Object.values(c).join(' ')).join(' ').toLowerCase();
    expect(all).not.toMatch(/pre-?eclampsia|you have|diagnos/);
  });
});
