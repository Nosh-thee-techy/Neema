import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { LoadingScreen } from '../ui/LoadingScreen';

/** What a home cuff can display. Outside this is a typing mistake, not a reading. */
const TOP_RANGE = [60, 260] as const;
const BOTTOM_RANGE = [30, 200] as const;

/** BP entry + YELLOW recheck coaching. */
export function BpPage() {
  const g = useGuardian();
  const nav = useNavigate();
  const { t, lang } = useLocale();
  // Start empty: a pre-filled number could be saved as a reading she never took.
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isRecheck = g.recheck.status === 'due' || g.recheck.status === 'scheduled';
  const sw = lang === 'sw';
  const filled = sys.trim() !== '' && dia.trim() !== '';

  /** Typing-mistake guard only (not a clinical threshold): is this a number a cuff can show? */
  function problem(): string | null {
    const top = Number(sys);
    const bottom = Number(dia);
    const whole = /^\d{2,3}$/;
    if (!whole.test(sys.trim()) || !whole.test(dia.trim()) || top < TOP_RANGE[0] || top > TOP_RANGE[1] || bottom < BOTTOM_RANGE[0] || bottom > BOTTOM_RANGE[1]) {
      return sw
        ? 'Angalia namba kwenye kipimo chako na uziandike tena.'
        : 'Check the numbers on your cuff and type them again.';
    }
    if (top <= bottom) {
      return sw
        ? 'Namba ya juu inapaswa kuwa kubwa kuliko ya chini. Angalia kipimo chako.'
        : 'The top number should be bigger than the bottom number. Check your cuff.';
    }
    return null;
  }

  async function save() {
    const found = problem();
    setError(found);
    if (found) return;
    const result = await g.saveBp(Number(sys), Number(dia));
    const level = result?.level;
    if (level === 'RED' || level === 'YELLOW') nav('/alert');
    else nav('/home');
  }

  return (
    <main className="screen">
      {g.loading ? <LoadingScreen message={lang === 'sw' ? 'Inahifadhi…' : 'Saving…'} /> : null}
      <BrandMark />
      <h1 className="screen-title" style={{ marginTop: '1rem' }}>
        {isRecheck ? t('recheck_now') : t('add_bp')}
      </h1>
      <p className="screen-sub">{isRecheck ? t('sit_rest') : lang === 'sw'
        ? 'Tumia cuff ya mkono. Kaa, pumzika, kisha pima.'
        : 'Use your upper-arm cuff. Sit, rest, then measure.'}</p>

      {isRecheck ? (
        <ol className="ritual-steps" style={{ marginBottom: '1rem' }}>
          <li>
            <span className="step-n">1</span>
            <div>
              <strong>{lang === 'sw' ? 'Kaa sawa' : 'Sit upright'}</strong>
              <p className="soft-note">
                {lang === 'sw' ? 'Miguu chini, mkono umetulia.' : 'Feet flat, arm resting.'}
              </p>
            </div>
          </li>
          <li>
            <span className="step-n">2</span>
            <div>
              <strong>{lang === 'sw' ? 'Pumzika' : 'Rest a minute'}</strong>
              <p className="soft-note">{t('sit_rest')}</p>
            </div>
          </li>
          <li>
            <span className="step-n">3</span>
            <div>
              <strong>{lang === 'sw' ? 'Andika namba' : 'Enter the numbers'}</strong>
              <p className="soft-note">
                {lang === 'sw' ? 'Namba ya juu kwanza, kisha ya chini.' : 'The top number first, then the bottom number.'}
              </p>
            </div>
          </li>
        </ol>
      ) : null}

      <div className="panel">
        <div className="field">
          <label htmlFor="sys">{sw ? 'Namba ya juu' : 'Top number'}</label>
          <input
            id="sys"
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            value={sys}
            aria-describedby="sys-hint"
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setSys(e.target.value);
              setError(null);
            }}
          />
          <p className="soft-note" id="sys-hint" style={{ margin: '0.35rem 0 0' }}>
            {sw ? 'Namba kubwa kwenye kipimo. Mara nyingi imeandikwa SYS.' : 'The bigger number on your cuff. Often marked SYS.'}
          </p>
        </div>
        <div className="field">
          <label htmlFor="dia">{sw ? 'Namba ya chini' : 'Bottom number'}</label>
          <input
            id="dia"
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            value={dia}
            aria-describedby="dia-hint"
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setDia(e.target.value);
              setError(null);
            }}
          />
          <p className="soft-note" id="dia-hint" style={{ margin: '0.35rem 0 0' }}>
            {sw ? 'Namba ndogo kwenye kipimo. Mara nyingi imeandikwa DIA.' : 'The smaller number on your cuff. Often marked DIA.'}
          </p>
        </div>
        {error ? (
          <p className="field-error" role="alert" id="bp-error">
            {error}
          </p>
        ) : null}
      </div>

      <div className="btn-row" style={{ marginTop: '1rem' }}>
        <Button variant="secondary" onClick={() => nav(-1)}>
          {lang === 'sw' ? 'Rudi' : 'Back'}
        </Button>
        <Button variant="primary" disabled={!filled} onClick={() => void save()}>
          {sw ? 'Hifadhi' : 'Save'}
        </Button>
      </div>
      <p className="trust-line">{t('saved_here')}</p>
    </main>
  );
}
