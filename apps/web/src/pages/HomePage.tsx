import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { avatarState } from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { useToday } from '../hooks/useToday';
import { latestCheckInToday } from '../services/checkIn';
import { latestEpds } from '../services/epdsStore';
import { listChase } from '../services/followUp';
import { EMPTY_BIRTH_PLAN, loadProfile } from '../services/passport';
import { getMessageTextFor } from '../services/speech';
import { recheckDelayMs } from '../services/recheck';
import { AvatarCompanion } from '../ui/AvatarCompanion';
import { BrandMark } from '../ui/BrandMark';
import { LangToggle } from '../ui/LangToggle';
import { LoadingScreen } from '../ui/LoadingScreen';
import { SigningSlot } from '../ui/SigningSlot';
import { levelLabel } from '../ui/levelLabel';
import { SosButton } from '../ui/SosButton';
import {
  IconBand,
  IconBell,
  IconCheck,
  IconChevron,
  IconHeart,
  IconPressure,
  IconQr,
  IconTemp,
} from '../ui/icons';

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


interface Row {
  key: string;
  title: string;
  meta: string;
  to: string;
  /** undefined = not a check-in, show an icon instead of a tick. */
  done?: boolean;
  icon?: ReactNode;
}

/** Home: greeting, one status card with one next step, live numbers, today's check-ins. */
export function HomePage() {
  const nav = useNavigate();
  const g = useGuardian();
  const { t, lang } = useLocale();
  const level = g.triage?.level ?? 'UNKNOWN';
  const today = useToday(`${level}:${g.recheck.status}`);

  const name = today.name ?? 'Mama';
  const alertActive = level === 'RED' || level === 'YELLOW';
  const recheckDue = g.recheck.status === 'due';
  const recheckScheduled = g.recheck.status === 'scheduled';
  const [awaitingArrival, setAwaitingArrival] = useState(false);
  const [openLoops, setOpenLoops] = useState(0);
  const [checkInDone, setCheckInDone] = useState(false);
  const [epdsMeta, setEpdsMeta] = useState<string | null>(null);
  const [birthReady, setBirthReady] = useState<number | null>(null);

  useEffect(() => {
    void listChase().then((open) => {
      setOpenLoops(open.length);
      setAwaitingArrival(open.some((f) => f.stage === 'chase' || f.stage === 'act'));
    });
    void latestCheckInToday().then((c) => setCheckInDone(Boolean(c)));
    void latestEpds().then((row) => {
      if (!row) {
        setEpdsMeta(null);
        return;
      }
      setEpdsMeta(clock(row.tsMs, lang));
    });
    void loadProfile()
      .then((p) => {
        const plan = { ...EMPTY_BIRTH_PLAN, ...p?.birthPlan };
        const done = [plan.skilledAttendant, plan.bloodDonor, plan.savings, plan.companion, plan.transport].filter(
          Boolean,
        ).length;
        setBirthReady(done);
      })
      .catch(() => setBirthReady(null));
  }, [level, g.activeAlertId, lang]);

  const companion = avatarState(level, awaitingArrival && level === 'RED');

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

  const todayWord = t('today');
  const rows: Row[] = [
    {
      key: 'bp',
      title: t('pressure'),
      meta:
        today.bpToday && today.lastBp
          ? `${todayWord}, ${clock(today.lastBp.tsMs, lang)} · ${today.lastBp.systolic}/${today.lastBp.diastolic}`
          : t('not_yet_today'),
      to: '/bp',
      done: today.bpToday,
    },
    {
      key: 'feel',
      title: t('how_feel'),
      meta:
        today.symptomsToday && today.lastSymptomTsMs !== null
          ? `${todayWord}, ${clock(today.lastSymptomTsMs, lang)}`
          : t('not_yet_today'),
      to: '/symptoms',
      done: today.symptomsToday,
    },
    {
      key: 'checkin',
      title: t('checkin_title'),
      meta: checkInDone ? todayWord : t('not_yet_today'),
      to: '/check-in',
      done: checkInDone,
    },
    {
      key: 'epds',
      title: t('epds_title'),
      meta: epdsMeta
        ? lang === 'sw'
          ? `Mwisho ${epdsMeta}`
          : `Last ${epdsMeta}`
        : t('epds_sub'),
      to: '/epds',
      done: Boolean(epdsMeta),
    },
    {
      key: 'birth',
      title: t('birth_plan_row'),
      meta:
        birthReady === null
          ? t('not_yet_today')
          : lang === 'sw'
            ? `${birthReady}/5 tayari`
            : `${birthReady}/5 ready`,
      to: '/passport',
      done: birthReady === 5,
    },
    { key: 'band', title: t('band'), meta: bandMeta, to: '/vitals', icon: <IconBand /> },
    { key: 'nurse', title: t('nurse_title'), meta: t('nurse_sub'), to: '/summary', icon: <IconQr /> },
  ];

  if (openLoops > 0) {
    rows.unshift({
      key: 'chase',
      title: t('chase_title'),
      meta: t('chase_open'),
      to: '/chase',
      icon: <IconBell />,
    });
  }

  const heart = g.sample?.heartRate ?? null;
  const temp = g.sample?.skinTempC ?? null;

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

      <div className="home-grid">
        <section>
          <div className="greet">
            <div>
              <h1 className="greet__title">
                {t(greetingKey(new Date().getHours()))}, {name}
              </h1>
              <p className="greet__sub">{t('greet_sub')}</p>
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

          <AvatarCompanion state={companion} lang={lang} />

          {g.triage && alertActive ? (
            <SigningSlot messageKey={g.triage.messageKey} lang={lang} />
          ) : null}

          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: '100%', marginBottom: '0.5rem' }}
            onClick={() => nav('/sign')}
          >
            {lang === 'sw' ? 'Zungumza kwa ishara (mstari kwa mstari)' : 'Talk in sign (line by line)'}
          </button>

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

          {alertActive ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={() => nav('/alert')}
            >
              {lang === 'sw' ? 'Ona hatua zote' : 'See all steps'}
            </button>
          ) : null}

          {today.hasRealChp === false ? (
            <button
              type="button"
              className="panel contact-warning"
              data-testid="no-chp-warning"
              style={{ width: '100%', textAlign: 'left', marginTop: '0.75rem', cursor: 'pointer', font: 'inherit' }}
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

          <div className="stat-row">
            <div className="stat-tile" data-tone="heart">
              <span className="stat-tile__icon">
                <IconHeart />
              </span>
              <span className="stat-tile__value">
                {heart ?? '—'}
                {heart !== null ? <small>bpm</small> : null}
              </span>
              <span className="stat-tile__label">{t('heart')}</span>
            </div>
            <div className="stat-tile" data-tone="pressure">
              <span className="stat-tile__icon">
                <IconPressure />
              </span>
              <span className="stat-tile__value">
                {today.lastBp ? `${today.lastBp.systolic}/${today.lastBp.diastolic}` : '—'}
              </span>
              <span className="stat-tile__label">{t('pressure')}</span>
            </div>
            <div className="stat-tile" data-tone="temp">
              <span className="stat-tile__icon">
                <IconTemp />
              </span>
              <span className="stat-tile__value">
                {temp !== null ? temp.toFixed(1) : '—'}
                {temp !== null ? <small>°C</small> : null}
              </span>
              <span className="stat-tile__label">{t('temp')}</span>
            </div>
          </div>
        </section>

        <section>
          <h2 className="section-title">{todayWord}</h2>
          <ul className="check-list">
            {rows.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  className="check-row"
                  data-done={row.done === true}
                  onClick={() => nav(row.to)}
                >
                  {row.icon ? (
                    <span className="check-row__mark check-row__mark--icon">{row.icon}</span>
                  ) : (
                    <span className="check-row__mark">
                      <IconCheck />
                    </span>
                  )}
                  <span>
                    <span className="check-row__title">{row.title}</span>
                    <span className="check-row__meta">{row.meta}</span>
                  </span>
                  <span className="check-row__chev">
                    <IconChevron />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="trust-line">{t('saved_here')}</p>
        </section>
      </div>
    </main>
  );
}
