/**
 * Tap-to-place body map. A woman seen from the front, not a skeleton.
 * Regions map to the same SymptomCode vocabulary via REGION_TO_SYMPTOM.
 * Regions that only map to `other` track their own visual state so they do not all light up together.
 */

import { useState } from 'react';
import { REGION_TO_SYMPTOM, type BodyRegion, type SymptomCode } from '@neema/core';

const REGIONS: { id: BodyRegion; labelEn: string; labelSw: string; d: string; lx: number; ly: number }[] = [
  { id: 'head', labelEn: 'Head', labelSw: 'Kichwa', d: 'M70 18 a16 18 0 1 1 0.1 0', lx: 108, ly: 36 },
  { id: 'face_hands', labelEn: 'Hands', labelSw: 'Mikono', d: 'M18 118 a10 12 0 1 1 0.1 0 M122 118 a10 12 0 1 1 0.1 0', lx: 12, ly: 108 },
  { id: 'breast', labelEn: 'Chest', labelSw: 'Kifua', d: 'M48 92 h44 a8 10 0 0 1 0 20 h-44 a8 10 0 0 1 0-20', lx: 108, ly: 104 },
  { id: 'upper_abdomen', labelEn: 'Upper belly', labelSw: 'Tumbo juu', d: 'M50 118 h40 a6 8 0 0 1 0 16 h-40 a6 8 0 0 1 0-16', lx: 108, ly: 128 },
  { id: 'lower_abdomen', labelEn: 'Lower belly', labelSw: 'Tumbo chini', d: 'M46 140 h48 a16 18 0 0 1 0 32 h-48 a16 18 0 0 1 0-32', lx: 108, ly: 158 },
  { id: 'wound', labelEn: 'Side', labelSw: 'Upande', d: 'M96 150 a8 10 0 1 1 0.1 0', lx: 112, ly: 176 },
  { id: 'calf', labelEn: 'Leg', labelSw: 'Mguu', d: 'M52 210 h14 v28 h-14 z M74 210 h14 v28 h-14 z', lx: 108, ly: 226 },
];

function isOtherOnly(id: BodyRegion): boolean {
  const codes = REGION_TO_SYMPTOM[id];
  return codes.length === 1 && codes[0] === 'other';
}

/** Interactive woman. Tapping a place adds its mapped symptom codes. */
export function BodyMap({
  selected,
  onToggleCodes,
  lang = 'en',
}: {
  selected: SymptomCode[];
  onToggleCodes: (codes: SymptomCode[]) => void;
  lang?: 'en' | 'sw';
}) {
  const [otherRegions, setOtherRegions] = useState<Set<BodyRegion>>(() => new Set());

  function regionActive(id: BodyRegion): boolean {
    if (isOtherOnly(id)) return otherRegions.has(id) && selected.includes('other');
    return REGION_TO_SYMPTOM[id].some((c) => selected.includes(c));
  }

  function onRegion(id: BodyRegion) {
    const codes = REGION_TO_SYMPTOM[id];
    if (isOtherOnly(id)) {
      setOtherRegions((prev) => {
        const next = new Set(prev);
        const turningOff = next.has(id);
        if (turningOff) next.delete(id);
        else next.add(id);
        const stillNeedsOther = next.size > 0;
        const otherOn = selected.includes('other');
        if (stillNeedsOther && !otherOn) onToggleCodes(['other']);
        if (!stillNeedsOther && otherOn) onToggleCodes(['other']);
        return next;
      });
      return;
    }
    onToggleCodes(codes);
  }

  return (
    <div className="body-map">
      <svg viewBox="0 0 140 260" className="body-map__svg" role="group" aria-label={lang === 'sw' ? 'Ramani ya mwili' : 'Body map'}>
        <ellipse cx="70" cy="248" rx="46" ry="6" className="body-map__shadow" />
        <path
          className="body-map__silhouette"
          d="M70 22
             C58 22 50 32 50 44
             C50 54 56 62 62 66
             L58 74
             C40 78 28 96 26 118
             L18 150
             C16 158 22 162 28 158
             L36 132
             L40 150
             C44 168 48 190 50 210
             L46 248
             L62 248
             L66 214
             L74 214
             L78 248
             L94 248
             L90 210
             C92 190 96 168 100 150
             L104 132
             L112 158
             C118 162 124 158 122 150
             L114 118
             C112 96 100 78 82 74
             L78 66
             C84 62 90 54 90 44
             C90 32 82 22 70 22 Z"
        />
        <path className="body-map__hair" d="M50 40 C48 18 92 16 92 42 C86 28 74 24 70 24 C60 24 52 30 50 40 Z" />
        <ellipse cx="70" cy="148" rx="22" ry="16" className="body-map__belly" />
        {REGIONS.map((r) => (
          <g key={r.id}>
            <path
              d={r.d}
              className="body-map__hit"
              data-on={regionActive(r.id)}
              role="button"
              tabIndex={0}
              aria-pressed={regionActive(r.id)}
              aria-label={lang === 'sw' ? r.labelSw : r.labelEn}
              onClick={() => onRegion(r.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRegion(r.id);
                }
              }}
            />
            <text x={r.lx} y={r.ly} className="body-map__label">
              {lang === 'sw' ? r.labelSw : r.labelEn}
            </text>
          </g>
        ))}
      </svg>
      <p className="soft-note" style={{ margin: '0.5rem 0 0' }}>
        {lang === 'sw'
          ? 'Gusa panapokusumbua, hata tumbo la chini. Neema ataweka alama kwenye orodha.'
          : 'Tap where it bothers you, including the lower belly. Neema ticks the matching feeling in the list.'}
      </p>
    </div>
  );
}
