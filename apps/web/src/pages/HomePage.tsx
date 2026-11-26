import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { useToday } from '../hooks/useToday';
import { useVitalsTrend } from '../hooks/useVitalsTrend';
import { TonightCard, TrendCard, displayTemp } from '../ui/VitalsDashboard';
import { KpiTile, sparkFromValues, type KpiTone } from '../ui/KpiTile';
import { listChase } from '../services/followUp';
import { getMessageTextFor } from '../services/speech';
import { recheckDelayMs } from '../services/recheck';
import { BrandMark } from '../ui/BrandMark';
import { LangToggle } from '../ui/LangToggle';
import { LoadingScreen } from '../ui/LoadingScreen';
import { SigningSlot } from '../ui/SigningSlot';
import { levelLabel } from '../ui/levelLabel';
import { SosButton } from '../ui/SosButton';
import { IconBell, IconChevron, IconHeart, IconPressure, IconTemp } from '../ui/icons';

const FULL_TERM_WEEKS = 40;

function greetingKey(hour: number): string {
  if (hour >= 5 && hour < 12) return 'greet_morning';
  if (hour >= 12 && hour < 17) return 'greet_afternoon';
  if (hour >= 17 && hour < 21) return 'greet_evening';
  return 'greet_night';
}

function clock(tsMs: number, lang: 'en' | 'sw'): string {
  return new Date(tsMs).toLocaleTimeString(lang === 'sw' ? 'sw-KE' : 'en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function countdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Action {
  label: string;
  onClick?: () => void;
  href?: string;
}

/** Home: linen/glass bento — vitals, status, tonight. Care list lives on /todo. */
export function HomePage() {
  const nav = useNavigate();
  const g = useGuardian();
  const { t, lang } = useLocale();
  const level = g.triage?.level ?? 'UNKNOWN';
  const today = useToday(`${level}:${g.recheck.status}`);
  const trend = useVitalsTrend(`${level}:${g.demoStep ?? ''}`);

  const name = today.name ?? 'Mama';
  const alertActive = level === 'RED' || level === 'YELLOW';
  const recheckDue = g.recheck.status === 'due';
  const recheckScheduled = g.recheck.status === 'scheduled';
  const [awaitingArrival, setAwaitingArrival] = useState(false);
  const [openLoops, setOpenLoops] = useState(0);

  useEffect(() => {
    void listChase().then((open) => {
      setOpenLoops(open.length);
      setAwaitingArrival(open.some((f) => f.stage === 'chase' || f.stage === 'act'));
    });
  }, [level, g.activeAlertId]);

  const headline =
    level === 'GREEN'
      ? t('youre_okay')
      : level === 'YELLOW'
        ? t('check_bp')
        : level === 'RED'
          ? t('call_chp')
          : t('waiting_signal');

  const body =
    (g.triage ? getMessageTextFor(g.triage.messageKey, lang) : null) ??
    (level === 'GREEN'
      ? t('all_quiet')
      : lang === 'sw'
        ? 'Unganisha bendi au ongeza shinikizo ili Neema ianze.'
        : 'Connect your band or add a blood pressure so Neema can begin.');

  let action: Action | null = null;
  const nextSms = g.pendingSms.find((p) => !p.opened);
  if (nextSms && alertActive) {
    action = { label: t('open_sms'), href: nextSms.href, onClick: () => g.markSmsOpened(nextSms.contactId) };
  } else if (openLoops > 0 && (awaitingArrival || (level === 'RED' && g.redAcknowledged))) {
    action = { label: t('chase_cta'), onClick: () => nav('/chase') };
  } else if (level === 'RED' && g.redAcknowledged) {
    action = { label: lang === 'sw' ? 'Ona hatua' : 'See steps', onClick: () => nav('/alert') };
  } else if (level === 'RED') {
    action = { label: t('call_chp'), onClick: () => nav('/alert') };
  } else if (recheckDue || level === 'YELLOW') {
    action = { label: t('recheck_now'), onClick: () => nav('/bp') };
  } else if (!g.connected) {
    action = { label: t('start_watch'), onClick: () => void g.connectSimulator() };
  } else if (level === 'UNKNOWN') {
    action = { label: t('add_bp'), onClick: () => nav('/bp') };
  }

  let progress: { pct: number; label: string } | null = null;
  if (recheckScheduled && g.recheckDueInSec !== null) {
    const totalSec = recheckDelayMs(g.recheck.trigger) / 1000;
    const pct = Math.min(100, Math.max(0, (1 - g.recheckDueInSec / totalSec) * 100));
    progress = { pct, label: countdown(g.recheckDueInSec) };
  } else if (level !== 'RED' && today.gestationWeeks !== null) {
    const weeks = today.gestationWeeks;
    progress = {
      pct: Math.min(100, Math.max(0, (weeks / FULL_TERM_WEEKS) * 100)),
      label:
        lang === 'sw'
          ? `Wiki ${weeks} kati ya ${FULL_TERM_WEEKS}`
          : `Week ${weeks} of ${FULL_TERM_WEEKS}`,
    };
  }

  const signal = g.sample?.signalQuality ?? 0;
  let bandMeta = t('band_away');
  if (g.connected && g.bandMode === 'simulator') bandMeta = t('band_practice');
  else if (g.connected && !g.sample) bandMeta = t('waiting_signal');
  else if (g.connected && signal < 50) bandMeta = t('band_weak');
  else if (g.connected) bandMeta = t('band_watching');

  const hr = g.connected ? (g.sample?.heartRate ?? null) : null;
  const temp = g.connected ? displayTemp(g.sample) : null;
  const bp = today.lastBp;
  const hrBand = trend.hr.range;

  let hrTone: KpiTone = 'muted';
  if (hr !== null) {
    if (g.triage?.reasons.some((r) => r.includes('pulse'))) hrTone = level === 'RED' ? 'alert' : 'watch';
    else if (hrBand && (hr < hrBand.low || hr > hrBand.high)) hrTone = 'watch';
    else hrTone = 'calm';
  }

  let tempTone: KpiTone = 'muted';
  if (temp !== null) {
    if (g.triage?.reasons.some((r) => r.includes('fever'))) tempTone = level === 'RED' ? 'alert' : 'watch';
    else tempTone = temp >= 38 ? 'watch' : 'calm';
  }

  let bpTone: KpiTone = 'muted';
  if (bp) {
    if (bp.systolic >= 160 || bp.diastolic >= 110) bpTone = 'alert';
    else if (bp.systolic >= 140 || bp.diastolic >= 90) bpTone = 'watch';
    else bpTone = 'calm';
  }

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
  const bpSpark = bp
    ? sparkFromValues([bp.systolic - 20, bp.systolic - 8, bp.systolic - 4, bp.systolic - 2, bp.systolic], 90, 180)
    : [];

  return (
    <main className="screen screen--home">
      {g.loading ? <LoadingScreen /> : null}

      <header className="topbar">
        <BrandMark />
        <div className="topbar__actions">
          <LangToggle />
          {alertActive ? (
            <button type="button" className="icon-btn" aria-label={t('alerts')} onClick={() => nav('/alert')}>
              <IconBell />
              <span className="icon-btn__dot" aria-hidden />
            </button>
          ) : null}
        </div>
      </header>

      <div className="bento__head">
        <div className="greet">
          <div>
            <h1 className="greet__title">
              {t(greetingKey(new Date().getHours()))}, {name}
            </h1>
            <p className="greet__sub">{t('greet_sub')}</p>
          </div>
        </div>
        <button
          type="button"
          className="avatar"
          aria-label={t('your_passport')}
          onClick={() => nav('/passport')}
        >
          {name.charAt(0).toUpperCase()}
        </button>
      </div>

      <div className="bento">
        <div className="bento__kpis" role="group" aria-label={lang === 'sw' ? 'Vipimo' : 'Readings'}>
          <KpiTile
            label={lang === 'sw' ? 'Mapigo' : 'Heart'}
            value={hr === null ? '—' : String(Math.round(hr))}
            unit={hr === null ? undefined : 'bpm'}
            note={
              hr === null
                ? bandMeta
                : hrBand
                  ? `${Math.round(hrBand.low)}–${Math.round(hrBand.high)}`
                  : lang === 'sw'
                    ? 'Inajifunza'
                    : 'Learning'
            }
            tone={hrTone}
            spark={hrSpark}
            icon={<IconHeart />}
            onClick={() => nav('/vitals')}
          />
          <KpiTile
            label={lang === 'sw' ? 'Shinikizo' : 'BP'}
            value={bp ? String(bp.systolic) : '—'}
            unit={bp ? `/${bp.diastolic}` : undefined}
            note={
              bp
                ? clock(bp.tsMs, lang)
                : lang === 'sw'
                  ? 'Ongeza'
                  : 'Add one'
            }
            tone={bpTone}
            spark={bpSpark}
            icon={<IconPressure />}
            onClick={() => nav('/bp')}
          />
          <KpiTile
            label={lang === 'sw' ? 'Joto' : 'Temp'}
            value={temp === null ? '—' : temp.toFixed(1)}
            unit={temp === null ? undefined : '°'}
            note={lang === 'sw' ? 'Homa ≥38°' : 'Fever ≥38°'}
            tone={tempTone}
            spark={tempSpark}
            icon={<IconTemp />}
            onClick={() => nav('/vitals')}
          />
        </div>

        <div className="bento__main">
          <div className="hero-card" data-level={level} aria-live="polite">
            <span className="hero-card__pill">
              <i className="hero-card__dot" aria-hidden />
              {levelLabel(level, lang)}
            </span>
            <h2 className="hero-card__title">{headline}</h2>
            <p className="hero-card__sub">{body}</p>

            {progress ? (
              <div className="hero-card__progress">
                <div className="hero-card__bar" aria-hidden>
                  <span style={{ width: `${progress.pct}%` }} />
                </div>
                <span>{progress.label}</span>
              </div>
            ) : null}

            {action ? (
              action.href ? (
                <a className="hero-card__action" href={action.href} onClick={action.onClick}>
                  {action.label}
                  <IconChevron />
                </a>
              ) : (
                <button type="button" className="hero-card__action" onClick={action.onClick}>
                  {action.label}
                  <IconChevron />
                </button>
              )
            ) : null}
          </div>

          <TonightCard lang={lang} sample={g.sample} connected={g.connected} trend={trend} />
        </div>

        <aside className="bento__side">
          {g.triage && alertActive ? (
            <SigningSlot messageKey={g.triage.messageKey} lang={lang} />
          ) : null}

          {today.hasRealChp === false ? (
            <button
              type="button"
              className="panel contact-warning"
              data-testid="no-chp-warning"
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
              onClick={() => nav('/contacts?setup=1')}
            >
              <strong>{lang === 'sw' ? 'Hakuna namba ya CHP' : 'No CHP number saved'}</strong>
              <span className="soft-note" style={{ display: 'block', marginTop: '0.25rem' }}>
                {today.placeholderContacts > 0
                  ? lang === 'sw'
                    ? 'Kuna namba za mfano tu. Weka namba halisi ili tahadhari imfikie mtu.'
                    : 'Only sample numbers are saved. Add a real number so alerts reach someone.'
                  : lang === 'sw'
                    ? 'Tahadhari haitamfikia mtu. Gusa hapa kuongeza CHP wako.'
                    : 'Alerts will reach no one. Tap here to add your CHP.'}
              </span>
            </button>
          ) : null}

          <SosButton
            lang={lang}
            onTrigger={() => {
              void g.pressSos().then(() => nav('/alert'));
            }}
          />
        </aside>

        <div className="bento__checks">
          <TrendCard lang={lang} trend={trend} />
          {alertActive ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '0.75rem' }}
              onClick={() => nav('/alert')}
            >
              {lang === 'sw' ? 'Ona hatua zote' : 'See all steps'}
            </button>
          ) : null}
          <p className="trust-line">{t('saved_here')}</p>
        </div>
      </div>
    </main>
  );
}
