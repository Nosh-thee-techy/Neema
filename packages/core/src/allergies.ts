/**
 * Structured allergies: one entry per allergy, never a comma-separated string.
 * "No known allergies" is a separate, explicit answer and cannot be combined with
 * listed allergies. Leaving everything empty means "not answered", which is different.
 */

export const ALLERGY_CODES = [
  'penicillin',
  'sulfa_drugs',
  'nsaids',
  'latex',
  'peanuts_nuts',
  'eggs',
  'milk',
  'seafood',
] as const;

export type AllergyCode = (typeof ALLERGY_CODES)[number];

export type AllergyEntry = { code: AllergyCode } | { code: 'other'; name: string };

export interface AllergyAnswer {
  /** She (or the clinic) confirmed there are no known allergies. */
  noneKnown: boolean;
  items: AllergyEntry[];
}

export const EMPTY_ALLERGIES: AllergyAnswer = { noneKnown: false, items: [] };

function key(e: AllergyEntry): string {
  return e.code === 'other' ? `other:${e.name.trim().toLowerCase()}` : e.code;
}

/** Trims, drops blanks and duplicates, keeps known codes only. */
export function cleanAllergyItems(items: readonly AllergyEntry[]): AllergyEntry[] {
  const seen = new Set<string>();
  const out: AllergyEntry[] = [];
  for (const e of items) {
    let entry: AllergyEntry | null = null;
    if (e.code === 'other') {
      const name = e.name.trim().replace(/\s+/g, ' ').slice(0, 60);
      if (name) entry = { code: 'other', name };
    } else if ((ALLERGY_CODES as readonly string[]).includes(e.code)) {
      entry = { code: e.code };
    }
    if (!entry) continue;
    const k = key(entry);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(entry);
  }
  return out;
}

/** Ticking "no known allergies" clears the list. */
export function setNoneKnown(answer: AllergyAnswer, noneKnown: boolean): AllergyAnswer {
  return noneKnown ? { noneKnown: true, items: [] } : { ...answer, noneKnown: false };
}

/** Adding or removing an allergy always clears "no known allergies". */
export function toggleAllergy(answer: AllergyAnswer, entry: AllergyEntry): AllergyAnswer {
  const k = key(entry);
  const has = answer.items.some((e) => key(e) === k);
  const items = has ? answer.items.filter((e) => key(e) !== k) : cleanAllergyItems([...answer.items, entry]);
  return { noneKnown: false, items };
}

/** True when the answer contradicts itself (never saved). */
export function isContradictory(answer: AllergyAnswer): boolean {
  return answer.noneKnown && answer.items.length > 0;
}

/** Turns an older comma-separated list (strings) into structured entries. */
export function allergiesFromLegacy(list: readonly string[] | undefined): AllergyEntry[] {
  if (!list?.length) return [];
  return cleanAllergyItems(
    list
      .flatMap((s) => s.split(/[,;\n]/))
      .map((name) => {
        const n = name.trim().toLowerCase();
        const code = (ALLERGY_CODES as readonly string[]).find((c) => c.replace('_', ' ') === n || c === n);
        return code ? ({ code } as AllergyEntry) : ({ code: 'other', name } as AllergyEntry);
      }),
  );
}
