import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { BrandMark } from '../ui/BrandMark';
import { LangToggle } from '../ui/LangToggle';
import { useLocale } from '../hooks/useLocale';
import { getAuthMeta, setPin, unlockWithPin } from '../services/auth';
import { contactReadiness } from '../services/contacts';
import { LoadingScreen } from '../ui/LoadingScreen';

/** Local PIN — private on this phone. */
export function UnlockPage() {
  const nav = useNavigate();
  const { t, lang } = useLocale();
  const [mode, setMode] = useState<'loading' | 'set' | 'unlock'>('loading');
  const [pin, setPinValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAuthMeta().then((meta) => setMode(meta?.pinEnabled ? 'unlock' : 'set'));
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'set') await setPin(pin);
      else await unlockWithPin(pin);
      // First-time setup: ask who to alert before anything else.
      // Then pick sign vs text language (talk mode).
      const { hasRealChp } = await contactReadiness();
      nav(mode === 'set' && !hasRealChp ? '/contacts?setup=1' : '/talk');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'loading') return <LoadingScreen />;

  const sw = lang === 'sw';
  const slots = Math.min(6, Math.max(4, pin.length));
  const ready = pin.length >= 4 && !busy;

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
          {mode === 'set' ? (sw ? 'Weka PIN yako' : 'Set your PIN') : sw ? 'Karibu tena' : 'Welcome back'}
        </h1>
        <p className="auth-card__sub">
          {mode === 'set'
            ? sw
              ? 'Chagua namba 4 hadi 6. PIN inalinda taarifa zako kwenye simu hii.'
              : 'Choose 4 to 6 digits. Your PIN keeps your story private on this phone.'
            : sw
              ? 'Ingiza PIN yako kufungua Neema.'
              : 'Enter your PIN to open Neema.'}
        </p>

        <form
          className="auth-card__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) void submit();
          }}
        >
          <label htmlFor="pin" className="sr-only">
            PIN
          </label>
          <div className="pin-boxes" data-error={Boolean(error)}>
            <input
              id="pin"
              className="pin-boxes__input"
              inputMode="numeric"
              type="password"
              autoComplete={mode === 'set' ? 'new-password' : 'current-password'}
              maxLength={6}
              autoFocus
              value={pin}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'pin-error' : undefined}
              onChange={(e) => {
                setError(null);
                setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
            />
            {Array.from({ length: slots }, (_, i) => (
              <span key={i} className="pin-boxes__slot" data-filled={i < pin.length} data-active={i === pin.length} aria-hidden />
            ))}
          </div>

          {error ? (
            <p id="pin-error" className="auth-card__error" role="alert">
              {mode === 'unlock'
                ? sw
                  ? 'PIN si sahihi. Jaribu tena.'
                  : 'That PIN is not right. Try again.'
                : error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" className="auth-card__submit" disabled={!ready}>
            {busy
              ? sw
                ? 'Subiri…'
                : 'Please wait…'
              : mode === 'set'
                ? sw
                  ? 'Hifadhi PIN'
                  : 'Save PIN'
                : sw
                  ? 'Fungua'
                  : 'Unlock'}
          </Button>
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
        {sw ? 'Hakuna akaunti wala mtandao. PIN haitoki kwenye simu hii.' : 'No account, no internet. Your PIN never leaves this phone.'}
      </p>
    </main>
  );
}
