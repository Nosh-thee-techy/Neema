import { describe, expect, it } from 'vitest';
import { validateRegistration, type RegistrationInput } from '../src/registration.js';
import { allergiesFromLegacy, isContradictory, setNoneKnown, toggleAllergy, EMPTY_ALLERGIES } from '../src/allergies.js';

const now = new Date(2026, 10, 27, 10).getTime();
const ok: RegistrationInput = {
  registrarRole: 'self',
  fullName: 'Wanjiru Kamau',
  stage: 'pregnancy',
  dating: { mode: 'weeks', weeks: 24, days: 3 },
  firstPregnancy: true,
  termsAccepted: true,
  shareChp: true,
  shareFamily: true,
  nowMs: now,
};

describe('validateRegistration', () => {
  it('accepts a complete record', () => {
    expect(validateRegistration(ok)).toEqual({});
  });

  it('requires full name, gestational age and terms', () => {
    const e = validateRegistration({ ...ok, fullName: '  ', dating: null, termsAccepted: false });
    expect(e).toMatchObject({ fullName: 'required', gestationalAge: 'required', terms: 'required' });
  });

  it('rejects impossible weeks and due dates', () => {
    expect(validateRegistration({ ...ok, dating: { mode: 'weeks', weeks: 50, days: 0 } }).gestationalAge).toBe('ga_out_of_range');
    expect(validateRegistration({ ...ok, dating: { mode: 'due', dueDateMs: now - 200 * 86_400_000 } }).dueDate).toBe('due_date_out_of_range');
  });

  it('after birth: no weeks, but the birth date and how the baby was born are required', () => {
    expect(validateRegistration({ ...ok, stage: 'postpartum', dating: null, firstPregnancy: null })).toEqual({ deliveryDate: 'required', deliveryMode: 'required' });
    expect(
      validateRegistration({ ...ok, stage: 'postpartum', dating: null, firstPregnancy: null, deliveryDateMs: now - 5 * 86_400_000, deliveryMode: 'caesarean' }),
    ).toEqual({});
    expect(validateRegistration({ ...ok, stage: 'postpartum', deliveryDateMs: now + 86_400_000, deliveryMode: 'vaginal' }).deliveryDate).toBe('future_date');
  });

  it('health workers must give their name; basic phones need a number', () => {
    const e = validateRegistration({ ...ok, registrarRole: 'chw', phoneKind: 'basic' });
    expect(e).toMatchObject({ registrarName: 'required', phone: 'phone_required_for_calls' });
  });

  it('checks contacts as pairs and rejects placeholder numbers', () => {
    const e = validateRegistration({ ...ok, chpName: 'Grace', chpPhone: '0700 000 000', familyPhone: '0712345678' });
    expect(e).toMatchObject({ chpPhone: 'invalid_phone', familyName: 'name_required_with_phone' });
  });

  it('refuses "no known allergies" together with an allergy', () => {
    expect(validateRegistration({ ...ok, allergies: { noneKnown: true, items: [{ code: 'latex' }] } }).allergies).toBe('contradictory');
  });
});

describe('allergies', () => {
  it('ticking none clears the list; adding one clears none', () => {
    let a = toggleAllergy(EMPTY_ALLERGIES, { code: 'penicillin' });
    a = setNoneKnown(a, true);
    expect(a).toEqual({ noneKnown: true, items: [] });
    a = toggleAllergy(a, { code: 'other', name: ' Mango ' });
    expect(a).toEqual({ noneKnown: false, items: [{ code: 'other', name: 'Mango' }] });
    expect(isContradictory(a)).toBe(false);
  });

  it('dedupes and removes', () => {
    let a = toggleAllergy(EMPTY_ALLERGIES, { code: 'other', name: 'Mango' });
    a = toggleAllergy(a, { code: 'other', name: 'mango' });
    expect(a.items).toEqual([]);
  });

  it('converts an old comma list into separate entries', () => {
    expect(allergiesFromLegacy(['penicillin, Mango', 'latex'])).toEqual([
      { code: 'penicillin' },
      { code: 'other', name: 'Mango' },
      { code: 'latex' },
    ]);
  });
});
