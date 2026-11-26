import { useNavigate } from 'react-router-dom';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { LoadingScreen } from '../ui/LoadingScreen';
import { ErrorScreen } from '../ui/ErrorScreen';
import { BandArt } from '../ui/BandArt';

/** Live band presence — human states, not BLE jargon. */
export function VitalsPage() {
  const g = useGuardian();
  const nav = useNavigate();
  const { t, lang } = useLocale();

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
    <main className="screen">
      {g.loading ? <LoadingScreen message={t('waiting_signal')} /> : null}
      <BrandMark />
      <h1 className="screen-title" style={{ marginTop: '1rem' }}>
        {lang === 'sw' ? 'Bendi yako' : 'Your band'}
      </h1>
      <p className="screen-sub">{presence}</p>

      <div className="band-hero" data-connected={g.connected}>
        <BandArt className="band-hero__art" compact />
      </div>

      <div className="metric-row">
        <div className="panel metric">
          <span style={{ color: 'var(--ink-muted)' }}>{lang === 'sw' ? 'Mapigo' : 'Heart rate'}</span>
          <b>{g.sample?.heartRate ?? '—'}</b>
          <span>bpm</span>
        </div>
        <div className="panel metric">
          <span style={{ color: 'var(--ink-muted)' }}>{lang === 'sw' ? 'Joto' : 'Skin temp'}</span>
          <b>{g.sample?.skinTempC?.toFixed(1) ?? '—'}</b>
          <span>°C</span>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{lang === 'sw' ? 'Ishara' : 'Signal'}</span>
          <strong>{q}%</strong>
        </div>
        <div className="meter" aria-hidden>
          <span style={{ width: `${q}%` }} />
        </div>
        {g.sample?.sos ? (
          <p style={{ margin: '0.8rem 0 0', color: 'var(--danger-deep)', fontWeight: 700 }}>
            {lang === 'sw' ? 'SOS imewashwa' : 'SOS is on'}
          </p>
        ) : null}
      </div>

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
