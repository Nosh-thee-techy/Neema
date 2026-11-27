import { describe, expect, it } from 'vitest';
import { nextAncContact } from '../src/anc.js';

describe('WHO ANC contacts', () => {
  it('finds the next contact', () => {
    expect(nextAncContact(8)).toEqual({ number: 1, week: 12, inWeeks: 4 });
    expect(nextAncContact(24)).toEqual({ number: 3, week: 26, inWeeks: 2 });
    expect(nextAncContact(36)).toEqual({ number: 6, week: 36, inWeeks: 0 });
    expect(nextAncContact(41)).toBeNull();
  });
});
