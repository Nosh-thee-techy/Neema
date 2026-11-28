import { useNavigate } from 'react-router-dom';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { LoadingScreen } from '../ui/LoadingScreen';
import { ErrorScreen } from '../ui/ErrorScreen';
import { BandArt } from '../ui/BandArt';
import { useVitalsTrend } from '../hooks/useVitalsTrend';
import { TonightCard, TrendCard, VitalRings, displayTemp } from '../ui/VitalsDashboard';
import { KpiTile, sparkFromValues, type KpiTone } from '../ui/KpiTile';
import { IconBand, IconHeart, IconTemp } from '../ui/icons';

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

  const hr = g.connected ? (g.sample?.heartRate ?? null) : null;
  const temp = g.connected ? displayTemp(g.sample) : null;
  const battery = g.connected ? (g.sample?.batteryPct ?? null) : null;
  const hrBand = trend.hr.range;

  let hrTone: KpiTone = 'muted';
  if (hr !== null) {
    if (hrBand && (hr < hrBand.low || hr > hrBand.high)) hrTone = 'watch';
    else hrTone = 'calm';
  }

  let tempTone: KpiTone = 'muted';
  if (temp !== null) tempTone = temp >= 38 ? 'watch' : 'calm';

  const hrSpark = sparkFromValues(
    trend.minutes.map((m) => m.hrMean),
    50,
    140,
  );
  const tempSpark = sparkFromValues(
    trend.minutes.map((m) => m.tempMeanC),
    35.5,
    39,
  );

  return (
    <main className="screen screen--wide">
      {g.loading ? <LoadingScreen message={t('waiting_signal')} /> : null}
      <BrandMark />
      <h1 className="screen-title" style={{ marginTop: '1rem' }}>
        {lang === 'sw' ? 'Bendi yako' : 'Your band'}
      </h1>
      <p className="screen-sub">{presence}</p>

      {/* Not connected: the way to connect comes first, before any empty readings. */}
      {!g.connected ? (
        <div className="band-connect">
          {/* Her real band is the main action. The practice band is named as practice. */}
          <Button variant="primary" onClick={() => void g.connectBluetooth()}>
            {t('connect_band')}
          </Button>
          <Button variant="secondary" onClick={() => void g.connectSimulator()}>
            {t('start_watch')}
          </Button>
          <p className="soft-note">
            {lang === 'sw'
              ? 'Huna bendi bado? Bendi ya mazoezi inaonyesha vipimo vya mfano, si vyako halisi.'
              : 'No band yet? The practice band shows example readings, not your real ones.'}
          </p>
        </div>
      ) : null}

      <div className="bento">
        <div className="bento__kpis" role="group" aria-label={lang === 'sw' ? 'Vipimo vya bendi' : 'Band readings'}>
          <KpiTile
            label={lang === 'sw' ? 'Mapigo' : 'Heart'}
            value={hr === null ? '—' : String(Math.round(hr))}
            unit={hr === null ? undefined : 'bpm'}
            note={
              hr === null
                ? presence
                : hrBand
                  ? `${Math.round(hrBand.low)}–${Math.round(hrBand.high)}`
                  : lang === 'sw'
                    ? 'Inajifunza'
                    : 'Learning'
            }
            tone={hrTone}
            spark={hrSpark}
            icon={<IconHeart />}
          />
          <KpiTile
            label={lang === 'sw' ? 'Joto' : 'Temp'}
            value={temp === null ? '—' : temp.toFixed(1)}
            unit={temp === null ? undefined : '°'}
            note={temp === null ? presence : lang === 'sw' ? 'Homa kuanzia 38°' : 'Fever from 38°'}
            tone={tempTone}
            spark={tempSpark}
            icon={<IconTemp />}
          />
          <KpiTile
            label={lang === 'sw' ? 'Ishara' : 'Signal'}
            value={g.connected ? String(q) : '—'}
            unit={g.connected ? '%' : undefined}
            note={
              battery !== null
                ? lang === 'sw'
                  ? `Betri ${battery}%`
                  : `Battery ${battery}%`
                : presence
            }
            tone={!g.connected ? 'muted' : q >= 50 ? 'calm' : 'watch'}
            spark={g.connected ? sparkFromValues([q * 0.7, q * 0.85, q * 0.9, q * 0.95, q], 0, 100) : []}
            icon={<IconBand />}
          />
        </div>

        <div className="bento__main">
          <div className="band-hero" data-connected={g.connected}>
            <BandArt className="band-hero__art" compact />
          </div>
          <TonightCard lang={lang} sample={g.sample} connected={g.connected} trend={trend} />
        </div>

        <aside className="bento__side">
          {g.sample?.sos ? (
            <p className="panel" role="alert" style={{ color: 'var(--danger-deep)', fontWeight: 700, margin: 0 }}>
              {lang === 'sw' ? 'SOS imewashwa' : 'SOS is on'}
            </p>
          ) : null}

          <VitalRings
            lang={lang}
            sample={g.sample}
            connected={g.connected}
            trend={trend}
            triage={g.triage}
            show={['hr', 'temp', 'signal', 'battery']}
          />

          {g.connected ? (
            <Button variant="secondary" onClick={() => void g.disconnect()}>
              {lang === 'sw' ? 'Achana na bendi' : 'Disconnect band'}
            </Button>
          ) : null}
        </aside>

        <div className="bento__trend">
          <TrendCard lang={lang} trend={trend} />
        </div>

        <div className="bento__checks">
          <p className="trust-line">{t('saved_here')}</p>
        </div>
      </div>
    </main>
  );
}
