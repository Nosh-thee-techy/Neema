import { useState } from 'react';
import { ALLERGY_CODES, setNoneKnown, toggleAllergy, type AllergyAnswer, type AllergyCode, type AllergyEntry } from '@neema/core';

export const ALLERGY_LABELS: Record<AllergyCode, { en: string; sw: string }> = {
  penicillin: { en: 'Penicillin (amoxicillin)', sw: 'Penisilini (amoksilini)' },
  sulfa_drugs: { en: 'Sulfa medicines (e.g. Septrin, SP)', sw: 'Dawa za salfa (mf. Septrin, SP)' },
  nsaids: { en: 'Aspirin / ibuprofen', sw: 'Aspirini / ibuprofeni' },
  latex: { en: 'Latex (rubber gloves)', sw: 'Mpira (glavu)' },
  peanuts_nuts: { en: 'Groundnuts / nuts', sw: 'Njugu / karanga' },
  eggs: { en: 'Eggs', sw: 'Mayai' },
  milk: { en: 'Milk', sw: 'Maziwa' },
  seafood: { en: 'Fish / seafood', sw: 'Samaki / vyakula vya baharini' },
};

export function allergyLabel(e: AllergyEntry, lang: 'en' | 'sw'): string {
  return e.code === 'other' ? e.name : ALLERGY_LABELS[e.code][lang];
}

interface Props {
  value: AllergyAnswer;
  onChange: (next: AllergyAnswer) => void;
  lang: 'en' | 'sw';
  idPrefix?: string;
  error?: string | undefined;
}

/**
 * Allergies one at a time: tick common ones, add any other by name, or say
 * "No known allergies". The two can never be picked together.
 */
export function AllergyPicker({ value, onChange, lang, idPrefix = 'alg', error }: Props) {
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);
  const [other, setOther] = useState('');
  const others = value.items.filter((e): e is { code: 'other'; name: string } => e.code === 'other');
  const has = (code: AllergyCode) => value.items.some((e) => e.code === code);

  function addOther() {
    if (!other.trim()) return;
    onChange(toggleAllergy(value, { code: 'other', name: other }));
    setOther('');
  }

  return (
    <div className="alg" role="group" aria-labelledby={`${idPrefix}-title`} aria-describedby={error ? `${idPrefix}-error` : undefined}>
      <p className="n-label" id={`${idPrefix}-title`}>
        {tx('Allergies', 'Mzio')}
      </p>
      <p className="n-hint" style={{ margin: '0 0 0.55rem' }}>
        {tx('Tap each one that applies. Leave all empty if you are not sure.', 'Gusa kila kinachohusika. Acha tupu kama huna uhakika.')}
      </p>

      <button
        type="button"
        className="chip alg__none"
        aria-pressed={value.noneKnown}
        onClick={() => onChange(setNoneKnown(value, !value.noneKnown))}
      >
        {tx('No known allergies', 'Hakuna mzio unaojulikana')}
      </button>

      <div className="chip-grid alg__grid">
        {ALLERGY_CODES.map((code) => (
          <button
            key={code}
            type="button"
            className="chip"
            aria-pressed={has(code)}
            disabled={value.noneKnown}
            onClick={() => onChange(toggleAllergy(value, { code }))}
          >
            {ALLERGY_LABELS[code][lang]}
          </button>
        ))}
      </div>

      <div className="alg__other">
        <label htmlFor={`${idPrefix}-other`} className="n-label alg__other-label">
          {tx('Other allergy', 'Mzio mwingine')}
        </label>
        <div className="alg__other-row">
          <input
            id={`${idPrefix}-other`}
            value={other}
            disabled={value.noneKnown}
            placeholder={tx('e.g. mango', 'mf. embe')}
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOther();
              }
            }}
          />
          <button type="button" className="btn btn-secondary btn-sm" disabled={value.noneKnown || !other.trim()} onClick={addOther}>
            {tx('Add', 'Ongeza')}
          </button>
        </div>
      </div>

      {others.length ? (
        <ul className="alg__list" aria-label={tx('Other allergies added', 'Mzio mwingine ulioongezwa')}>
          {others.map((e) => (
            <li key={e.name}>
              <span>{e.name}</span>
              <button
                type="button"
                className="alg__remove"
                aria-label={tx(`Remove ${e.name}`, `Ondoa ${e.name}`)}
                onClick={() => onChange(toggleAllergy(value, e))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {value.noneKnown ? (
        <p className="n-hint">{tx('To add an allergy, first untick "No known allergies".', 'Kuongeza mzio, kwanza ondoa alama "Hakuna mzio unaojulikana".')}</p>
      ) : null}
      {error ? (
        <p className="field-error n-error" id={`${idPrefix}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
