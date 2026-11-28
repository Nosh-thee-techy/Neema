import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SymptomCode } from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { BrandMark } from '../ui/BrandMark';
import { BodyMap } from '../ui/BodyMap';
import { Button } from '../ui/Button';
import { LoadingScreen } from '../ui/LoadingScreen';
import { useWatchPlan } from '../hooks/useWatchPlan';
import { SYMPTOM_LABELS } from '../services/symptomLabels';

/** Tap-to-select how she feels, with an optional body map. */
export function SymptomsPage() {
  const g = useGuardian();
  const nav = useNavigate();
  const { t, lang } = useLocale();
  const [selected, setSelected] = useState<SymptomCode[]>([]);
  // The word list comes first: it is the quickest to read. The body picture is one tap away.
  const [showMap, setShowMap] = useState(false);
  // Her watch plan: the questions Neema asks her every day come first, with the reason.
  const { plan } = useWatchPlan();
  const watchCodes = plan?.ask ?? [];

  const options: { code: SymptomCode; label: string }[] =
    lang === 'sw'
      ? [
          { code: 'headache', label: 'Kichwa kinauma' },
          { code: 'blurred_vision', label: 'Kutoona vizuri' },
          { code: 'upper_abdominal_pain', label: 'Maumivu juu ya tumbo' },
          { code: 'heavy_bleeding', label: 'Kutokwa damu nyingi' },
          { code: 'fever_chills', label: 'Homa / baridi' },
          { code: 'baby_moving_less', label: 'Mtoto anasonga kidogo' },
          { code: 'swelling_face_hands', label: 'Uvimbe uso/mikono' },
          { code: 'low_mood', label: 'Hali mbaya ya moyo' },
          { code: 'other', label: 'Nyingine' },
        ]
      : [
          { code: 'headache', label: 'Headache' },
          { code: 'blurred_vision', label: 'Blurred vision' },
          { code: 'upper_abdominal_pain', label: 'Upper belly pain' },
          { code: 'heavy_bleeding', label: 'Heavy bleeding' },
          { code: 'fever_chills', label: 'Fever / chills' },
          { code: 'baby_moving_less', label: 'Baby moving less' },
          { code: 'swelling_face_hands', label: 'Swelling face/hands' },
          { code: 'low_mood', label: 'Low mood' },
          { code: 'other', label: 'Other' },
        ];

  function toggle(code: SymptomCode) {
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  function toggleCodes(codes: SymptomCode[]) {
    setSelected((prev) => {
      const allOn = codes.every((c) => prev.includes(c));
      if (allOn) return prev.filter((c) => !codes.includes(c));
      const next = new Set(prev);
      for (const c of codes) next.add(c);
      return [...next];
    });
  }

  async function save() {
    if (selected.length === 0) return;
    const result = await g.saveSymptoms(selected);
    if (result?.level === 'RED' || result?.level === 'YELLOW') nav('/alert');
    else nav('/home');
  }

  return (
    <main className="screen">
      {g.loading ? <LoadingScreen /> : null}
      <BrandMark />
      <h1 className="screen-title" style={{ marginTop: '1rem' }}>
        {t('how_feel')}
      </h1>
      <p className="screen-sub">
        {lang === 'sw' ? 'Gusa kila unachohisi leo. Unaweza kuchagua zaidi ya kimoja.' : 'Tap everything you feel today. You can choose more than one.'}
      </p>

      {watchCodes.length > 0 && plan ? (
        <section className="watch-ask" aria-labelledby="watch-ask-title">
          <h2 id="watch-ask-title" className="watch-ask__title">
            {lang === 'sw' ? 'Neema inakuuliza haya kila siku' : 'Neema asks you about these every day'}
          </h2>
          <p className="watch-ask__why">{plan.items.map((i) => (lang === 'sw' ? i.reason.sw : i.reason.en)).join(' ')}</p>
          <div className="chip-grid">
            {watchCodes.map((code) => (
              <button key={code} type="button" className="chip" aria-pressed={selected.includes(code)} onClick={() => toggle(code)}>
                {lang === 'sw' ? SYMPTOM_LABELS[code].sw : SYMPTOM_LABELS[code].en}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="chip-grid">
        {options.filter((opt) => !watchCodes.includes(opt.code)).map((opt) => (
          <button
            key={opt.code}
            type="button"
            className="chip"
            aria-pressed={selected.includes(opt.code)}
            onClick={() => toggle(opt.code)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="btn-row" style={{ margin: '1rem 0 0.75rem' }}>
        <Button variant="ghost" aria-expanded={showMap} onClick={() => setShowMap((v) => !v)}>
          {showMap
            ? lang === 'sw'
              ? 'Ficha picha ya mwili'
              : 'Hide the body picture'
            : lang === 'sw'
              ? 'Au onyesha kwenye picha ya mwili'
              : 'Or point on a body picture'}
        </Button>
      </div>

      {showMap ? (
        <div className="panel">
          <BodyMap selected={selected} onToggleCodes={toggleCodes} lang={lang} />
        </div>
      ) : null}
      {selected.includes('low_mood') ? (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <strong>{t('epds_title')}</strong>
          <p className="soft-note" style={{ margin: '0.35rem 0 0.65rem' }}>
            {t('epds_sub')}
          </p>
          <Button variant="secondary" style={{ width: '100%' }} onClick={() => nav('/epds')}>
            {lang === 'sw' ? 'Jibu maswali ya hisia' : 'Answer the mood questions'}
          </Button>
        </div>
      ) : null}

      <div className="btn-row" style={{ marginTop: '1.25rem' }}>
        <Button variant="secondary" onClick={() => nav('/home')}>
          {lang === 'sw' ? 'Ghairi' : 'Cancel'}
        </Button>
        <Button variant="primary" disabled={selected.length === 0} onClick={() => void save()}>
          {lang === 'sw' ? 'Hifadhi' : 'Save'}
        </Button>
      </div>
      <p className="trust-line">{t('saved_here')}</p>
    </main>
  );
}
