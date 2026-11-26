import { describe, expect, it } from 'vitest';
import { answerCareQuestion, enforceCareGuardrails, retrieveCareCards } from '../src/careCards.js';

describe('WHO care cards', () => {
  it('forces go-now on RED', () => {
    const cards = retrieveCareCards({
      level: 'RED',
      reasons: ['bp_severe'],
      query: 'what should I do',
      lang: 'en',
    });
    expect(cards[0]?.id).toBe('who_red_go_now');
    const ans = enforceCareGuardrails(
      answerCareQuestion({ level: 'RED', reasons: ['bp_severe'], query: 'help', lang: 'en' }),
      { level: 'RED', reasons: ['bp_severe'], query: 'help', lang: 'en' },
    );
    expect(ans.handoff).toBe(true);
    expect(ans.urgency).toBe('urgent');
    expect(ans.body.toLowerCase()).toMatch(/facility|go/);
  });

  it('suggests side rest when stressed', () => {
    const cards = retrieveCareCards({
      level: 'YELLOW',
      reasons: ['bp_raised'],
      query: 'I am stressed and dizzy',
      lang: 'en',
    });
    expect(cards.some((c) => c.id === 'who_yellow_side_rest' || c.id === 'who_yellow_bp_recheck')).toBe(
      true,
    );
  });

  it('does not call UNKNOWN calm-only', () => {
    const ans = answerCareQuestion({
      level: 'UNKNOWN',
      query: 'am I fine',
      lang: 'en',
    });
    expect(ans.urgency).not.toBe('calm');
  });
});
