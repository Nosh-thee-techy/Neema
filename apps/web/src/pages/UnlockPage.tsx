import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../ui/Button';
import { BrandMark } from '../ui/BrandMark';
import { LangToggle } from '../ui/LangToggle';
import { useLocale } from '../hooks/useLocale';
import { getAuthMeta, setPin, unlockWithPin } from '../services/auth';
import { PinInput } from '../ui/PinInput';
import { LoadingScreen } from '../ui/LoadingScreen';

/** Local PIN — private on this phone. Set (with confirm) or unlock. */
export function UnlockPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const changing = params.get('change') === '1';
  const { t, lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, swText: string) => (sw ? swText : en);
  const [mode, setMode] = useState<'loading' | 'set' | 'confirm' | 'unlock'>('loading');
  const [length, setLength] = useState(4);
  const [pin, setPinValue] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bumps to remount the boxes (re-focus) after a reset. */
  const [round, setRound] = useState(0);

  useEffect(() => {
    void getAuthMeta().then((meta) => {
      if (meta?.pinEnabled) {
        // Older installs did not store the length: show 6 boxes and allow 4+.
        setLength(meta.pinLength ?? 6);
        setMode('unlock');
      } else setMode('set');
    });
  }, []);

  function reset(message: string | null) {
    setPinValue('');
    setError(message);
    setRound((r) => r + 1);
  }

  async function submit(value: string) {
    if (busy || value.length < 4) return;
    setError(null);
    if (mode === 'set') {
      setFirstPin(value);
      setMode('confirm');
      reset(null);
      return;
    }
    if (mode === 'confirm' && value !== firstPin) {
      setMode('set');
      setFirstPin('');
      reset(tx('The two PINs did not match. Choose your PIN again.', 'PIN mbili hazilingani. Chagua PIN tena.'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'confirm') {
        await setPin(value);
        nav(changing ? '/profile#account' : '/home', { replace: true });
        return;
      }
      await unlockWithPin(value);
      if (changing) {
        // Current PIN is right: now choose the new one.
        setMode('set');
        setLength(4);
        reset(null);
        return;
      }
      nav('/home', { replace: true });
    } catch {
      reset(mode === 'unlock' ? tx('That PIN is not right. Try again.', 'PIN si sahihi. Jaribu tena.') : tx('Could not save the PIN. Try again.', 'Imeshindwa kuhifadhi PIN. Jaribu tena.'));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'loading') return <LoadingScreen />;

  const legacyUnlock = mode === 'unlock' && length === 6;
  const ready = pin.length >= (legacyUnlock ? 4 : length) && !busy;

  const title =
    mode === 'set'
      ? changing
        ? tx('Choose a new PIN', 'Chagua PIN mpya')
        : tx('Set your PIN', 'Weka PIN yako')
      : mode === 'confirm'
        ? tx('Enter it again', 'Iandike tena')
        : changing
          ? tx('Enter your current PIN', 'Ingiza PIN yako ya sasa')
          : tx('Welcome back', 'Karibu tena');
  const sub =
    mode === 'set'
      ? tx(`Choose ${length} numbers you will remember. Your PIN keeps your information private on this phone.`, `Chagua namba ${length} utakazokumbuka. PIN inalinda taarifa zako kwenye simu hii.`)
      : mode === 'confirm'
        ? tx('Type the same PIN once more to be sure.', 'Andika PIN ileile tena kuhakikisha.')
        : tx('Enter your PIN to open Neema.', 'Ingiza PIN yako kufungua Neema.');

  return (
    <main className="screen auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-card__top">
          <BrandMark />
          <LangToggle />
        </header>

        <span className="auth-card__lock" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
            <circle cx="12" cy="15.5" r="1.2" />
          </svg>
        </span>

        <h1 id="auth-title" className="auth-card__title">
          {title}
        </h1>
        <p className="auth-card__sub">{sub}</p>

        <form
          className="auth-card__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) void submit(pin);
          }}
        >
          <PinInput
            key={`${mode}-${length}-${round}`}
            length={length}
            value={pin}
            onChange={(v) => {
              setError(null);
              setPinValue(v);
            }}
            onComplete={(v) => {
              if (!legacyUnlock) void submit(v);
            }}
            autoFocus
            invalid={Boolean(error)}
            describedBy={error ? 'pin-error' : undefined}
            label={title}
            digitLabel={(i, n) => tx(`Digit ${i} of ${n}`, `Namba ${i} kati ya ${n}`)}
            disabled={busy}
          />

          {error ? (
            <p id="pin-error" className="auth-card__error" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" className="auth-card__submit" disabled={!ready}>
            {busy
              ? tx('Please wait…', 'Subiri…')
              : mode === 'set'
                ? tx('Next', 'Endelea')
                : mode === 'confirm'
                  ? tx('Save PIN', 'Hifadhi PIN')
                  : tx('Unlock', 'Fungua')}
          </Button>

          {mode === 'set' ? (
            <button
              type="button"
              className="auth-card__switch"
              onClick={() => {
                setLength((n) => (n === 4 ? 6 : 4));
                reset(null);
              }}
            >
              {length === 4 ? tx('Use 6 numbers instead', 'Tumia namba 6 badala yake') : tx('Use 4 numbers instead', 'Tumia namba 4 badala yake')}
            </button>
          ) : null}
          {changing ? (
            <button type="button" className="auth-card__switch" onClick={() => nav('/profile#account')}>
              {tx('Cancel', 'Ghairi')}
            </button>
          ) : null}
          {mode === 'confirm' ? (
            <button
              type="button"
              className="auth-card__switch"
              onClick={() => {
                setMode('set');
                setFirstPin('');
                reset(null);
              }}
            >
              {tx('Start again', 'Anza upya')}
            </button>
          ) : null}
        </form>

        <p className="auth-card__trust">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
            <path d="M8.5 12l2.5 2.5 4.5-5" />
          </svg>
          {t('saved_here')}
        </p>
      </section>
      <p className="auth-foot">
        {tx('No online account. Your PIN never leaves this phone.', 'Hakuna akaunti ya mtandaoni. PIN haitoki kwenye simu hii.')}
      </p>
    </main>
  );
}
