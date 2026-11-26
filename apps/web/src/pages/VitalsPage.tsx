import { useNavigate } from 'react-router-dom';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { LoadingScreen } from '../ui/LoadingScreen';
import { ErrorScreen } from '../ui/ErrorScreen';
import { BandArt } from '../ui/BandArt';
import { useVitalsTrend } from '../hooks/useVitalsTrend';
import { TonightCard, TrendCard, VitalRings } from '../ui/VitalsDashboard';

/** Live band presence — human states, not BLE jargon. */
export function VitalsPage() {
  const g = useGuardian();
  const nav = useNavigate();
  const { t, lang } = useLocale();
  const trend = useVitalsTrend(`${g.connected}:${g.triage?.level ?? ''}`);

  if (g.error) {
    return (
      <ErrorScreen
        title={lang === 'sw' ? 'Bendi haitaji' : 'Band needs attention'}
        detail={g.error}
        onRetry={() => g.clearError()}
        onHome={() => nav('/home')}
      />
    );
  }

  const q = g.sample?.signalQuality ?? 0;
  let presence = t('band_away');
  if (g.connected && q >= 50) presence = t('band_watching');
  else if (g.connected && q > 0) presence = t('band_weak');
  else if (g.connected) presence = t('waiting_signal');

  return (
    <main className="screen screen--wide">
      {g.loading ? <LoadingScreen message={t('waiting_signal')} /> : null}
      <BrandMark />
      <h1 className="screen-title" style={{ marginTop: '1rem' }}>
        {lang === 'sw' ? 'Bendi yako' : 'Your band'}
      </h1>
      <p className="screen-sub">{presence}</p>

      <div className="band-hero" data-connected={g.connected}>
        <BandArt className="band-hero__art" compact />
      </div>

      <VitalRings
        lang={lang}
        sample={g.sample}
        connected={g.connected}
        trend={trend}
        triage={g.triage}
        show={['hr', 'temp', 'signal', 'battery']}
      />

      {g.sample?.sos ? (
        <p className="panel" role="alert" style={{ marginTop: '0.9rem', color: 'var(--danger-deep)', fontWeight: 700 }}>
          {lang === 'sw' ? 'SOS imewashwa' : 'SOS is on'}
        </p>
      ) : null}

      <TonightCard lang={lang} sample={g.sample} connected={g.connected} trend={trend} />
      <TrendCard lang={lang} trend={trend} />

      <div className="btn-row" style={{ marginTop: '1rem' }}>
        {!g.connected ? (
          <>
            <Button variant="primary" onClick={() => void g.connectSimulator()}>
              {t('start_watch')}
            </Button>
            <Button variant="secondary" onClick={() => void g.connectBluetooth()}>
              {t('connect_band')}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => void g.disconnect()}>
            {lang === 'sw' ? 'Achana na bendi' : 'Disconnect band'}
          </Button>
        )}
      </div>
      <p className="trust-line">{t('saved_here')}</p>
    </main>
  );
}
