import { describe, expect, it } from 'vitest';
import { isPlaceholderPhone, normalizePhone } from '../src/phone.js';
import { DEMO_ESCALATION, FIELD_ESCALATION, dueEscalationSteps, planEscalation } from '../src/escalation.js';
import type { Contact } from '../src/types.js';

describe('normalizePhone', () => {
  it.each([
    ['0712 345 678', '+254712345678'],
    ['0712-345-678', '+254712345678'],
    ['712345678', '+254712345678'],
    ['254712345678', '+254712345678'],
    ['+254 712 345 678', '+254712345678'],
    ['0110 123 456', '+254110123456'],
    ['+256 772 123456', '+256772123456'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', 'abc', '12345', '0212345678', '+2547123', '07123456789'])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('isPlaceholderPhone', () => {
  it('flags the old demo numbers and junk', () => {
    expect(isPlaceholderPhone('+254700000000')).toBe(true);
    expect(isPlaceholderPhone('+254711111111')).toBe(true);
    expect(isPlaceholderPhone('+254722222222')).toBe(true);
    expect(isPlaceholderPhone('not a number')).toBe(true);
  });
  it('accepts real-looking numbers', () => {
    expect(isPlaceholderPhone('0712345678')).toBe(false);
  });
});

const c = (id: string, role: Contact['role'], order: number): Contact => ({
  id,
  name: id,
  role,
  phone: '+254712345678',
  escalationOrder: order,
});

describe('planEscalation', () => {
  const contacts = [c('chp', 'chp', 1), c('mum', 'family', 2), c('neighbour', 'family', 3), c('sup', 'supervisor', 4)];

  it('messages the next un-offered contact at 5 min and the supervisor at 10 min', () => {
    const plan = planEscalation(contacts, ['chp', 'mum']);
    expect(plan.map((s) => [s.contact.id, s.label, s.afterMs])).toEqual([
      ['neighbour', 'next', FIELD_ESCALATION.nextContactAfterMs],
      ['sup', 'supervisor', FIELD_ESCALATION.supervisorAfterMs],
    ]);
  });

  it('skips a missing next contact but still reaches the supervisor', () => {
    const plan = planEscalation([c('chp', 'chp', 1), c('sup', 'supervisor', 2)], ['chp']);
    expect(plan.map((s) => s.contact.id)).toEqual(['sup']);
  });

  it('returns nothing when everyone was already offered', () => {
    expect(planEscalation([c('chp', 'chp', 1)], ['chp'])).toEqual([]);
  });

  it('fires each step once, when due', () => {
    const plan = planEscalation(contacts, ['chp', 'mum'], DEMO_ESCALATION);
    expect(dueEscalationSteps(plan, 10_000, [])).toEqual([]);
    expect(dueEscalationSteps(plan, 31_000, []).map((s) => s.contact.id)).toEqual(['neighbour']);
    expect(dueEscalationSteps(plan, 61_000, ['neighbour']).map((s) => s.contact.id)).toEqual(['sup']);
    expect(dueEscalationSteps(plan, 61_000, ['neighbour', 'sup'])).toEqual([]);
  });
});
