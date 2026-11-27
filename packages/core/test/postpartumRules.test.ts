import { describe, expect, it } from 'vitest';
import { evaluateTriage } from '../src/triage.js';
import type { SymptomCode, TriageInput } from '../src/types.js';
import { RECOVERY_EMERGENCY_SIGNS, RECOVERY_STAGES, RECOVERY_TODAY_SIGNS, recoveryStageFor, recoveryContentReviewed } from '../src/recoveryTimeline.js';
import { topReason } from '../src/messages/reasons.js';
import { getMessageCatalog } from '../src/messages/catalog.js';

const now = Date.UTC(2026, 10, 27, 2, 0, 0);
function input(stage: 'pregnancy' | 'postpartum', codes: SymptomCode[]): TriageInput {
  return {
    nowMs: now,
    stage,
    vitals: [{ tsMs: now - 60_000, hrMean: 76, hrMin: 72, hrMax: 80, tempMeanC: 36.6, validFraction: 1 }],
    bp: [],
    symptoms: codes.length ? [{ id: 's', tsMs: now, codes, inputMethod: 'tap' }] : [],
    sosActive: false,
    markedResting: true,
    baselineZ: { hr: null, temp: null },
  };
}

describe('after-birth danger signs', () => {
  it.each(['dizzy_faint', 'chest_pain_breathless', 'fits', 'severe_abdominal_pain'] as SymptomCode[])('%s is RED', (code) => {
    const r = evaluateTriage(input('postpartum', [code]));
    expect(r.level).toBe('RED');
    expect(r.firedRules).toContain('R15_EMERGENCY_SIGN');
  });

  it('headache with blurred vision is RED after birth', () => {
    expect(evaluateTriage(input('postpartum', ['headache', 'blurred_vision'])).level).toBe('RED');
    expect(evaluateTriage(input('postpartum', ['headache'])).firedRules).not.toContain('R15_EMERGENCY_SIGN');
  });

  it('thoughts of harm need a person now, and the SMS does not name the reason', () => {
    const r = evaluateTriage(input('postpartum', ['thoughts_of_harm']));
    expect(r).toMatchObject({ level: 'RED', messageKey: 'red_talk_now' });
    expect(topReason(r.reasons)).toBe('thoughts_of_harm');
  });

  it.each(['foul_discharge', 'wound_problem', 'leg_pain_swelling', 'breast_red_painful', 'urine_problem', 'bleeding_heavier'] as SymptomCode[])('%s needs review today (YELLOW)', (code) => {
    const r = evaluateTriage(input('postpartum', [code]));
    expect(r.level).toBe('YELLOW');
    expect(r.messageKey).toBe('yellow_review_today');
  });

  it('an emergency sign wins over a review sign', () => {
    expect(evaluateTriage(input('postpartum', ['wound_problem', 'fits'])).level).toBe('RED');
  });

  it('new message keys exist in the Swahili catalog', () => {
    const keys = getMessageCatalog().map((e) => e.key);
    expect(keys).toEqual(expect.arrayContaining(['red_talk_now', 'yellow_review_today']));
  });
});

describe('recovery timeline', () => {
  it('covers every day from birth to 8 weeks without gaps', () => {
    for (let d = 0; d <= 56; d++) {
      const hits = RECOVERY_STAGES.filter((s) => d >= s.fromDay && d <= s.toDay);
      expect(hits.length, `day ${d}`).toBe(1);
    }
  });

  it('matches the examples in the brief', () => {
    expect(recoveryStageFor(5).id).toBe('days_2_7');
    expect(recoveryStageFor(18).id).toBe('weeks_3_4');
    expect(recoveryStageFor(45).id).toBe('weeks_7_8');
    expect(recoveryStageFor(200).id).toBe('weeks_7_8');
  });

  it('never lists a danger sign as normal', () => {
    const danger = /soak|faint|chest|fit|convuls|harm|smell|fever|large clot|hopeless|severe/i;
    for (const s of RECOVERY_STAGES) {
      for (const n of s.normal) expect(n.en, `${s.id}: ${n.en}`).not.toMatch(danger);
    }
  });

  it('every stage has both languages and a source; drafts until reviewed', () => {
    for (const s of RECOVERY_STAGES) {
      expect(s.sources.length).toBeGreaterThan(0);
      for (const t of [s.title, s.intro, ...s.normal, ...s.todayExtra, ...s.topics.map((x) => x.text)]) {
        expect(t.en.length).toBeGreaterThan(3);
        expect(t.sw.length).toBeGreaterThan(3);
      }
    }
    expect(RECOVERY_EMERGENCY_SIGNS.length).toBeGreaterThanOrEqual(7);
    expect(RECOVERY_TODAY_SIGNS.length).toBeGreaterThanOrEqual(6);
    expect(recoveryContentReviewed()).toBe(false);
  });
});
