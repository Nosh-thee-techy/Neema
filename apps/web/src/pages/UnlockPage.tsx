import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { BrandMark } from '../ui/BrandMark';
import { LangToggle } from '../ui/LangToggle';
import { useLocale } from '../hooks/useLocale';
import { getAuthMeta, setPin, unlockWithPin } from '../services/auth';
import { contactReadiness } from '../services/contacts';
import { LoadingScreen } from '../ui/LoadingScreen';
import { ErrorScreen } from '../ui/ErrorScreen';

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
      const { hasRealChp } = await contactReadiness();
      nav(mode === 'set' && !hasRealChp ? '/contacts?setup=1' : '/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'loading') return <LoadingScreen />;
  if (error) {
    return (
      <ErrorScreen
        title={lang === 'sw' ? 'Haikuweza kufungua' : 'Could not unlock'}
        detail={error}
        onRetry={() => setError(null)}
        onHome={() => nav('/start')}
      />
    );
  }

  return (
    <main className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <BrandMark showSub />
        <LangToggle />
      </div>
      <h1 className="screen-title" style={{ marginTop: '1.2rem' }}>
        {mode === 'set'
          ? lang === 'sw'
            ? 'Weka PIN yako'
            : 'Set your PIN'
          : lang === 'sw'
            ? 'Karibu tena'
            : 'Welcome back'}
      </h1>
      <p className="screen-sub">
        {mode === 'set'
          ? lang === 'sw'
            ? 'PIN ya ndani inalinda taarifa zako kwenye simu hii.'
            : 'A local PIN keeps your story private on this phone.'
          : lang === 'sw'
            ? 'Ingiza PIN kufungua Neema.'
            : 'Enter your PIN to open Neema.'}
      </p>
      <div className="field">
        <label htmlFor="pin">PIN</label>
        <input
          id="pin"
          inputMode="numeric"
          type="password"
          autoComplete="one-time-code"
          value={pin}
          onChange={(e) => setPinValue(e.target.value)}
          placeholder="••••"
        />
      </div>
      <Button variant="primary" disabled={busy || pin.length < 4} onClick={() => void submit()}>
        {mode === 'set'
          ? lang === 'sw'
            ? 'Hifadhi PIN'
            : 'Save PIN'
          : lang === 'sw'
            ? 'Fungua'
            : 'Unlock'}
      </Button>
      <p className="trust-line">{t('saved_here')}</p>
    </main>
  );
}
