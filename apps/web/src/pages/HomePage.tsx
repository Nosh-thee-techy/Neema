import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RECOVERY_EMERGENCY_SIGNS, babyStageFor, getDefaultTriageConfig, insightForWeek, nextAncContact, nextPncContact, recoveryStageFor, type BpReading } from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { useWatchPlan } from '../hooks/useWatchPlan';
import { WatchingCard } from '../ui/WatchingCard';
import { useToday } from '../hooks/useToday';
import { useVitalsTrend } from '../hooks/useVitalsTrend';
import { displayTemp } from '../ui/VitalsDashboard';
import { listChase } from '../services/followUp';
import { getMessageTextFor } from '../services/speech';
import { recheckDelayMs } from '../services/recheck';
import { openEmergencyDialer } from '../services/emergency';
import { LoadingScreen } from '../ui/LoadingScreen';
import { EmergencyHoldButton } from '../ui/EmergencyHoldButton';
import { BabyStageArt, NewbornArt } from '../ui/BabyStageArt';
import { SLEEP_TEXT, recoveryDayText } from '../ui/RecoveryParts';
import { IconBell, IconChevron, IconHeart, IconMoon, IconPlus, IconPressure, IconSettings, IconSpark, IconTemp } from '../ui/icons';

/** Thresholds come from the (placeholder, unsigned) triage config, never from this file. */
const CONFIG = getDefaultTriageConfig();
const DAY_MS = 86_400_000;
const SLEEP_HOURS = { '0_2': 1, '3_4': 3.5, '5_6': 5.5, '7_plus': 7.5 } as const;

type Tone = 'calm' | 'watch' | 'alert' | 'muted';

function greetingKey(hour: number): string {
  if (hour >= 5 && hour < 12) return 'greet_morning';
  if (hour >= 12 && hour < 17) return 'greet_afternoon';
  if (hour >= 17 && hour < 21) return 'greet_evening';
  return 'greet_night';
}

function countdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "08:15" today, "Yesterday 08:15", else "3 Dec". */
function when(tsMs: number, lang: 'en' | 'sw', nowMs: number): string {
  const loc = lang === 'sw' ? 'sw-KE' : 'en-KE';
  const time = new Date(tsMs).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  if (tsMs >= start.getTime()) return time;
  if (tsMs >= start.getTime() - DAY_MS) return `${lang === 'sw' ? 'Jana' : 'Yesterday'} ${time}`;
  return new Date(tsMs).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
}

/** Tiny line from real values only; nothing drawn when there are fewer than 2 points. */
function Spark({ values, tone }: { values: Array<number | null>; tone: Tone }) {
  const pts = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (pts.length < 2) return <span className="read-row__spark" aria-hidden />;
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = hi - lo || 1;
  const d = pts
    .map((v, i) => `${((i / (pts.length - 1)) * 60).toFixed(1)},${(18 - ((v - lo) / span) * 16).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="read-row__spark" data-tone={tone} viewBox="0 0 60 20" aria-hidden>
      <polyline points={d} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Action {
  label: string;
  onClick?: () => void;
  href?: string;
}

/**
 * Home: greeting + emergency hold, an alert banner only when something needs doing,
 * pregnancy progress, this week's card, daily check-in, and today's readings.
 */
export function HomePage() {
  const nav = useNavigate();
  const g = useGuardian();
  const { t, lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, swText: string) => (sw ? swText : en);
  const level = g.triage?.level ?? 'UNKNOWN';
  const today = useToday(`${level}:${g.recheck.status}`);
  const watch = useWatchPlan(`${level}:${g.recheck.status}`);
  const trend = useVitalsTrend(`${level}:${g.demoStep ?? ''}`);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [openLoops, setOpenLoops] = useState(0);
  const cardsRef = useRef<HTMLDivElement | null>(null);
  const [awaitingArrival, setAwaitingArrival] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Keep the guardian (rules + navigation) on the same stage as the saved profile,
  // e.g. right after registering after birth or recording the birth.
  useEffect(() => {
    if (today.stage && today.stage !== g.stage && !g.demoStep) void g.refreshTriage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today.stage, g.stage]);

  useEffect(() => {
    void listChase().then((open) => {
      setOpenLoops(open.length);
      setAwaitingArrival(open.some((f) => f.stage === 'chase' || f.stage === 'act'));
    });
  }, [level, g.activeAlertId]);

  const name = today.name ?? 'Mama';
  const alertActive = level === 'RED' || level === 'YELLOW';
  const recheckScheduled = g.recheck.status === 'scheduled';
  const recheckDue = g.recheck.status === 'due';

  function emergency() {
    // Raise the SOS alert (prepares SMS to CHP / family) and open the 999 dialer at once.
    void g.pressSos();
    nav('/alert?sos=1');
    openEmergencyDialer();
  }

  // ── Alert banner (only when there is something to do) ───────────────────
  let action: Action | null = null;
  const nextSms = g.pendingSms.find((p) => !p.opened);
  if (nextSms && alertActive) {
    action = { label: t('open_sms'), href: nextSms.href, onClick: () => g.markSmsOpened(nextSms.contactId) };
  } else if (openLoops > 0 && (awaitingArrival || (level === 'RED' && g.redAcknowledged))) {
    action = { label: tx('See steps', 'Ona hatua'), onClick: () => nav('/alert') };
  } else if (level === 'RED') {
    action = { label: g.redAcknowledged ? tx('See steps', 'Ona hatua') : t('call_chp'), onClick: () => nav('/alert') };
  } else if (recheckDue || level === 'YELLOW') {
    action = { label: t('recheck_now'), onClick: () => nav('/bp') };
  }

  const bannerBody =
    (g.triage ? getMessageTextFor(g.triage.messageKey, lang) : null) ??
    (level === 'RED' ? t('call_chp') : t('check_bp'));

  // ── Readings with attention flags from the triage rules ─────────────────
  const reasons = g.triage?.reasons ?? [];
  const hr = g.connected ? (g.sample?.heartRate ?? null) : null;
  const temp = g.connected ? displayTemp(g.sample) : null;
  const sampleTs = g.connected && g.sample ? g.sample.tsMs : null;
  const bp: BpReading | null = today.lastBp;

  let bpTone: Tone = 'muted';
  let bpFlag = tx('No reading yet', 'Hakuna kipimo bado');
  if (bp) {
    const ageH = (nowMs - bp.tsMs) / 3_600_000;
    if (bp.systolic >= CONFIG.bp.severeSys || bp.diastolic >= CONFIG.bp.severeDia) {
      bpTone = 'alert';
      bpFlag = tx('Very high', 'Juu sana');
    } else if (bp.systolic >= CONFIG.bp.raisedSys || bp.diastolic >= CONFIG.bp.raisedDia) {
      bpTone = 'watch';
      bpFlag = tx('High: check again', 'Juu: pima tena');
    } else {
      bpTone = 'calm';
      bpFlag = tx('Below alert level', 'Chini ya kiwango cha hatari');
    }
    if (ageH > 24 && bpTone === 'calm') {
      bpTone = 'muted';
      bpFlag = tx('Old reading: measure again', 'Kipimo cha zamani: pima tena');
    }
  }

  let hrTone: Tone = 'muted';
  let hrFlag = g.connected ? tx('Waiting for band', 'Inasubiri bendi') : tx('Band not connected', 'Bendi haijaunganishwa');
  if (hr !== null) {
    const band = trend.hr.range;
    if (reasons.some((r) => r.includes('pulse') || r.includes('shock'))) {
      hrTone = level === 'RED' ? 'alert' : 'watch';
      hrFlag = tx('Needs attention', 'Inahitaji uangalifu');
    } else if (band && (hr < band.low || hr > band.high)) {
      hrTone = 'watch';
      hrFlag = hr > band.high ? tx('Higher than your usual', 'Juu kuliko kawaida yako') : tx('Lower than your usual', 'Chini kuliko kawaida yako');
    } else if (band) {
      hrTone = 'calm';
      hrFlag = tx('Your usual range', 'Kiwango chako cha kawaida');
    } else {
      hrTone = 'muted';
      hrFlag = tx('Learning your usual', 'Inajifunza kawaida yako');
    }
  }

  let tempTone: Tone = 'muted';
  let tempFlag = g.connected ? tx('Waiting for band', 'Inasubiri bendi') : tx('Band not connected', 'Bendi haijaunganishwa');
  if (temp !== null) {
    if (reasons.some((r) => r.includes('fever')) || temp >= CONFIG.fever.tempC) {
      tempTone = level === 'RED' ? 'alert' : 'watch';
      tempFlag = tx('Raised', 'Imepanda');
    } else {
      tempTone = 'calm';
      tempFlag = tx('Below fever level', 'Chini ya kiwango cha homa');
    }
  }

  const anyAttention = [bpTone, hrTone, tempTone].some((x) => x === 'watch' || x === 'alert');
  const readsNote = anyAttention
    ? tx('Look at the note under the number that needs attention.', 'Angalia dokezo chini ya namba inayohitaji uangalifu.')
    : !bp && !g.connected
      ? tx('Blood pressure is the one you add yourself. Heart rate and temperature come from the band.', 'Shinikizo unaliongeza mwenyewe. Mapigo na joto vinatoka kwenye bendi.')
      : !g.connected
        ? tx('Heart rate and temperature show when the band is on.', 'Mapigo na joto vinaonekana bendi ikiwa imewashwa.')
        : tx('These are the latest numbers saved on this phone.', 'Hizi ndizo namba za karibuni zilizohifadhiwa kwenye simu hii.');

  // ── Pregnancy + this week ───────────────────────────────────────────────
  const preg = today.pregnancy;
  const insight = preg ? insightForWeek(preg.weeks) : null;
  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(sw ? 'sw-KE' : 'en-KE', { day: 'numeric', month: 'long', year: 'numeric' });


  const anc = preg ? nextAncContact(preg.weeks) : null;
  const postpartum = today.stage === 'postpartum';
  const showBaby = Boolean(today.delivery?.showBabyInfo);
  const lastCheck = today.recoveryCheckins.find((c) => c.sleep);
  const babyLabel = preg
    ? tx(`Illustration of a baby at about ${preg.weeks} weeks (not to scale)`, `Mchoro wa mtoto wa karibu wiki ${preg.weeks} (si kwa kipimo halisi)`)
    : '';

  // ── Daily insight cards (change with the week / day) ───────────────────
  interface Card {
    id: string;
    kicker: string;
    title: string;
    text: string;
    tone: 'peach' | 'lilac' | 'blue' | 'red' | 'green' | 'navy';
    to: string;
  }
  const L = (x: { en: string; sw: string }) => x[lang];
  /** "12 days" / "5 weeks, 3 days" — the baby's age (= days since birth). */
  const ageShort = (n: number) => {
    if (n === 0) return tx('Born today', 'Amezaliwa leo');
    if (n < 14) return tx(`${n} day${n === 1 ? '' : 's'} old`, `Siku ${n}`);
    const w = Math.floor(n / 7);
    const dd = n % 7;
    return dd ? tx(`${w} weeks, ${dd} days`, `Wiki ${w}, siku ${dd}`) : tx(`${w} weeks`, `Wiki ${w}`);
  };
  const cards: Card[] = [];
  if (postpartum && today.recovery) {
    const d = today.recovery.daysSinceBirth;
    const st = recoveryStageFor(d);
    const pnc = nextPncContact(d);
    cards.push({ id: 'recovery', kicker: `${tx('Your recovery', 'Kupona kwako')} · ${L(st.title)}`, title: L(st.range), text: L(st.intro), tone: 'peach', to: '/insights' });
    cards.push({ id: 'help', kicker: tx('When to get help', 'Wakati wa kutafuta msaada'), title: tx('Go now or call 999 if', 'Nenda sasa au piga 999 kama'), text: RECOVERY_EMERGENCY_SIGNS.slice(0, 3).map(L).join(' · '), tone: 'red', to: '/insights#help' });
    cards.push({ id: 'normal', kicker: tx('What may be normal', 'Kinachoweza kuwa kawaida'), title: L(st.normal[0]!), text: st.normal.slice(1, 3).map(L).join(' · '), tone: 'green', to: '/insights' });
    if (showBaby) {
      const bs = babyStageFor(d);
      cards.push({ id: 'baby', kicker: `${tx('Your baby', 'Mtoto wako')} · ${L(bs.title)}`, title: L(bs.headline), text: bs.doing.slice(0, 2).map(L).join(' · '), tone: 'lilac', to: '/insights#baby' });
    }
    if (pnc) cards.push({ id: 'check', kicker: pnc.dueNow ? tx('Due now', 'Sasa') : tx('Next check', 'Ukaguzi ujao'), title: pnc.contact[lang], text: tx('Recommended postnatal check. Your clinic sets the real date.', 'Ukaguzi unaopendekezwa. Kliniki yako huweka tarehe halisi.'), tone: 'blue', to: '/insights' });
    cards.push({ id: 'mood', kicker: tx('Sleep & mood', 'Usingizi na hisia'), title: tx('How are you sleeping?', 'Unalalaje?'), text: tx('See your sleep and mood, and people you can talk to.', 'Ona usingizi na hisia zako, na watu unaoweza kuzungumza nao.'), tone: 'navy', to: '/wellbeing' });
  } else if (preg && insight) {
    cards.push({ id: 'baby', kicker: tx(`Your baby · week ${preg.weeks}`, `Mtoto wako · wiki ${preg.weeks}`), title: sw ? insight.sizeSw : insight.sizeEn, text: sw ? insight.babySw : insight.babyEn, tone: 'peach', to: '/insights' });
    cards.push({ id: 'feel', kicker: tx('You may feel', 'Unaweza kuhisi'), title: tx('Your body this week', 'Mwili wako wiki hii'), text: sw ? insight.feelSw : insight.feelEn, tone: 'lilac', to: '/insights' });
    if (anc) cards.push({ id: 'expect', kicker: tx('What to expect', 'Cha kutarajia'), title: tx(`Clinic visit around week ${anc.week}`, `Kliniki karibu wiki ${anc.week}`), text: tx(`Visit ${anc.number} of 8 recommended. Your clinic gives your real date.`, `Ziara ${anc.number} kati ya 8 zinazopendekezwa. Kliniki hukupa tarehe halisi.`), tone: 'blue', to: '/insights' });
    cards.push({ id: 'help', kicker: tx('Get help straight away if', 'Tafuta msaada mara moja kama'), title: tx('Danger signs this week', 'Dalili za hatari wiki hii'), text: sw ? insight.watchSw : insight.watchEn, tone: 'red', to: '/insights#help' });
    cards.push({ id: 'do', kicker: tx('Good to do', 'Vizuri kufanya'), title: tx('This week', 'Wiki hii'), text: sw ? insight.doSw : insight.doEn, tone: 'green', to: '/insights' });
  }
  const cardKey = cards.map((c) => c.id).join(',');
  cards.push({ id: 'chat', kicker: 'CareChat', title: tx('Ask Neema anything', 'Muulize Neema chochote'), text: tx('Talk about how you feel, in English or Kiswahili.', 'Ongea kuhusu unavyojisikia, kwa Kiingereza au Kiswahili.'), tone: 'navy', to: '/care' });

  // Scroll snapping keeps the previously snapped card in view when cards load; start at the first.
  useEffect(() => {
    if (cardsRef.current) cardsRef.current.scrollLeft = 0;
  }, [cardKey]);

  return (
    <main className="screen screen--home today" data-level={level} data-stage={postpartum ? 'postpartum' : 'pregnancy'}>
      {g.loading ? <LoadingScreen /> : null}

      <header className="today-top">
        <button type="button" className="today-avatar" aria-label={tx('Settings', 'Mipangilio')} onClick={() => nav('/settings')}>
          {(name || 'M').charAt(0).toUpperCase()}
          {today.hasRealChp === false ? <span className="icon-btn__dot" aria-hidden /> : null}
          {/* A cog on the corner, so the initial reads as "my settings", not decoration. */}
          <span className="today-avatar__cog" aria-hidden>
            <IconSettings />
          </span>
        </button>
        <div className="today-top__mid">
          {/* Short month: the full name pushed the date onto two lines beside the emergency button. */}
          <p className="today-top__date">{new Date(nowMs).toLocaleDateString(sw ? 'sw-KE' : 'en-KE', { day: 'numeric', month: 'short' })}</p>
          <h1 className="home2__hello today-top__hello">
            {t(greetingKey(new Date(nowMs).getHours()))}, {name}
          </h1>
        </div>
        <div className="home2__actions">
          <button
            type="button"
            className="icon-btn home2__bell"
            aria-label={alertActive ? tx('Alerts: something needs attention', 'Tahadhari: kuna jambo la kuangalia') : tx('Alerts', 'Tahadhari')}
            onClick={() => nav(alertActive ? '/alert' : '/history#alerts')}
          >
            <IconBell />
            {alertActive || openLoops > 0 ? <span className="icon-btn__dot" aria-hidden /> : null}
          </button>
          <EmergencyHoldButton lang={lang} onTrigger={emergency} />
        </div>
      </header>

      <WeekStrip nowMs={nowMs} lang={lang} />

      {alertActive ? (
        <section className="home-alert" data-level={level} role="alert" aria-live="assertive">
          <strong className="home-alert__title">{level === 'RED' ? t('call_chp') : t('check_bp')}</strong>
          <p className="home-alert__body">{bannerBody}</p>
          {recheckScheduled && g.recheckDueInSec !== null ? (
            <div className="home-alert__timer">
              <div className="home-alert__bar" aria-hidden>
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, (1 - g.recheckDueInSec / (recheckDelayMs(g.recheck.trigger) / 1000)) * 100))}%`,
                  }}
                />
              </div>
              <span>
                {tx('Measure again in', 'Pima tena baada ya')} {countdown(g.recheckDueInSec)}
              </span>
            </div>
          ) : null}
          {action ? (
            action.href ? (
              <a className="home-alert__action" href={action.href} onClick={action.onClick}>
                {action.label}
                <IconChevron />
              </a>
            ) : (
              <button type="button" className="home-alert__action" onClick={action.onClick}>
                {action.label}
                <IconChevron />
              </button>
            )
          ) : null}
        </section>
      ) : null}

      {level === 'UNKNOWN' && g.connected && g.triage ? (
        <section className="home-alert" data-level="UNKNOWN" role="status">
          <strong className="home-alert__title">{t('waiting_signal')}</strong>
          <p className="home-alert__body">{getMessageTextFor(g.triage.messageKey, lang) ?? g.message}</p>
          <button type="button" className="home-alert__action" onClick={() => nav('/vitals')}>
            {tx('Check the band', 'Angalia bendi')}
            <IconChevron />
          </button>
        </section>
      ) : null}

      {/* Hero: the baby, floating */}
      <section className="today-hero" aria-labelledby="today-label">
        <div className="today-hero__art" aria-hidden={false}>
          <span className="today-hero__orb today-hero__orb--1" aria-hidden />
          <span className="today-hero__orb today-hero__orb--2" aria-hidden />
          <span className="today-hero__orb today-hero__orb--3" aria-hidden />
          <div className="today-float">
            {postpartum && today.recovery ? (
              showBaby ? (
                <NewbornArt ageDays={today.recovery.daysSinceBirth} label={tx(`Illustration of your baby at ${today.recovery.daysSinceBirth} days`, `Mchoro wa mtoto wako wa siku ${today.recovery.daysSinceBirth}`)} />
              ) : (
                <RecoveryArt label={tx('Your recovery', 'Kupona kwako')} />
              )
            ) : preg ? (
              <BabyStageArt week={preg.weeks} days={preg.days} label={babyLabel} />
            ) : (
              <RecoveryArt label={tx('Neema', 'Neema')} />
            )}
          </div>
        </div>

        {postpartum ? (
          today.recovery ? (
            <>
              <button type="button" id="today-label" className="today-label" onClick={() => nav('/insights')}>
                {ageShort(today.recovery.daysSinceBirth)}
                <span className="today-label__chev" aria-hidden>
                  <IconChevron />
                </span>
              </button>
              <p className="today-sub">
                {showBaby
                  ? `${today.babies.map((x) => x.name).filter(Boolean).join(tx(' & ', ' na ')) || tx('Your baby', 'Mtoto wako')} · ${recoveryDayText(today.recovery.daysSinceBirth, lang)}`
                  : recoveryDayText(today.recovery.daysSinceBirth, lang)}
              </p>
            </>
          ) : (
            <button type="button" id="today-label" className="today-label" onClick={() => nav('/record-birth')}>
              {tx('Add your baby\'s birth date', 'Ongeza tarehe ya kuzaliwa kwa mtoto')}
              <span className="today-label__chev" aria-hidden>
                <IconChevron />
              </span>
            </button>
          )
        ) : preg ? (
          <>
            <button type="button" id="today-label" className="today-label" onClick={() => nav('/insights')} aria-label={tx(`${preg.weeks} weeks, ${preg.days} days. Open this week's insights`, `Wiki ${preg.weeks}, siku ${preg.days}. Fungua maelezo ya wiki hii`)}>
              {tx(`${preg.weeks} weeks, ${preg.days} days`, `Wiki ${preg.weeks}, siku ${preg.days}`)}
              <span className="today-label__chev" aria-hidden>
                <IconChevron />
              </span>
            </button>
            <div
              className="preg__bar today-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={40}
              aria-valuenow={preg.weeks}
              aria-label={tx(`${preg.weeks} of 40 weeks`, `Wiki ${preg.weeks} kati ya 40`)}
            >
              <span style={{ width: `${Math.round(preg.fraction * 100)}%` }} />
            </div>
            <p className="today-sub">
              {tx(`Trimester ${preg.trimester}`, `Kipindi ${preg.trimester}`)} · {tx('due', 'kujifungua')} {fmtDate(preg.eddMs)}
            </p>
          </>
        ) : (
          <button type="button" id="today-label" className="today-label" onClick={() => nav('/profile#pregnancy')}>
            {tx('Add your pregnancy weeks', 'Ongeza wiki za mimba')}
            <span className="today-label__chev" aria-hidden>
              <IconChevron />
            </span>
          </button>
        )}

        <button type="button" className="btn btn-primary today-checkin" onClick={() => nav(postpartum ? '/recovery-check' : '/care')}>
          {postpartum && today.recoveryCheckinToday ? tx('Check in again', 'Jibu tena') : tx('Start Daily Check-in', 'Anza Ukaguzi wa Leo')}
        </button>
        <p className="today-checkin__q">
          {postpartum ? tx('How are you and your body feeling today?', 'Wewe na mwili wako mnajisikiaje leo?') : tx("How are you feeling today? Talk to Neema about how you're feeling.", 'Unajisikiaje leo? Ongea na Neema kuhusu unavyojisikia.')}
        </p>
      </section>

      {/* Quick actions */}
      <nav className="today-actions" aria-label={tx('Quick actions', 'Vitendo vya haraka')}>
        {(postpartum
          ? [
              [tx('Recovery', 'Kupona'), '/insights', <IconSpark key="i" />, true],
              [tx('Symptoms', 'Dalili'), '/recovery-check', <IconPlus key="i" />, false],
              [tx('Blood pressure', 'Shinikizo'), '/bp', <IconPressure key="i" />, false],
              [tx('Sleep & mood', 'Usingizi'), '/wellbeing', <IconMoon key="i" />, false],
            ]
          : [
              [tx('Baby growth', 'Ukuaji'), '/insights', <IconSpark key="i" />, true],
              [tx('Symptoms', 'Dalili'), '/symptoms', <IconPlus key="i" />, false],
              [tx('Blood pressure', 'Shinikizo'), '/bp', <IconPressure key="i" />, false],
              [tx('Sleep', 'Usingizi'), '/wellbeing', <IconMoon key="i" />, false],
            ]
        ).map(([label, to, icon, main]) => (
          <button key={to as string} type="button" className="today-action" data-main={main as boolean} onClick={() => nav(to as string)}>
            <span className="today-action__icon">{icon as React.ReactNode}</span>
            <span className="today-action__label">{label as string}</span>
          </button>
        ))}
      </nav>

      {/* Her watch plan: what Neema watches more closely for her, and why */}
      <WatchingCard snap={watch} sw={sw} />

      {/* Daily insights */}
      <section className="today-insights" aria-labelledby="insights-title">
        <div className="today-insights__head">
          <h2 id="insights-title">{tx('My daily insights', 'Maelezo yangu ya leo')}</h2>
          <span className="today-insights__links">
            <button type="button" className="today-insights__arrow" aria-label={tx("Open today's story", 'Fungua hadithi ya leo')} onClick={() => nav('/story')}>
              →
            </button>
            <button type="button" className="n-link" onClick={() => nav('/insights')}>
              {tx('See all', 'Ona yote')}
            </button>
          </span>
        </div>
        <div className="today-cards" role="list" ref={cardsRef}>
          {cards.map((c) => (
            <button key={c.id} type="button" role="listitem" className="today-card" data-tone={c.tone} onClick={() => nav('/story')}>
              <span className="today-card__kicker">{c.kicker}</span>
              <strong className="today-card__title">{c.title}</strong>
              <span className="today-card__text">{c.text}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Readings */}
      <section className="home-card reads" aria-labelledby="reads-title" data-attention={anyAttention}>
        <div className="reads__head">
          <h2 id="reads-title">{tx('Your latest readings', 'Vipimo vyako vya karibuni')}</h2>
          {anyAttention ? <span className="reads__chip">{tx('Needs attention', 'Inahitaji uangalifu')}</span> : null}
        </div>
        <p className="reads__insight">{readsNote}</p>

        <div className="reads__stats">
        <ReadRow
          icon={<IconPressure />}
          label={tx('Blood pressure', 'Shinikizo la damu')}
          value={bp ? `${bp.systolic}/${bp.diastolic}` : '—'}
          unit={bp ? 'mmHg' : ''}
          time={bp ? when(bp.tsMs, lang, nowMs) : ''}
          flag={bpFlag}
          tone={bpTone}
          spark={<Spark values={today.recentBp.map((r) => r.systolic)} tone={bpTone} />}
        />
        <ReadRow
          icon={<IconHeart />}
          label={tx('Heart rate', 'Mapigo ya moyo')}
          value={hr === null ? '—' : String(Math.round(hr))}
          unit={hr === null ? '' : 'bpm'}
          time={sampleTs ? when(sampleTs, lang, nowMs) : ''}
          flag={hrFlag}
          tone={hrTone}
          spark={<Spark values={trend.minutes.map((m) => m.hrMean)} tone={hrTone} />}
        />
        <ReadRow
          icon={<IconTemp />}
          label={tx('Skin temperature (band)', 'Joto la ngozi (bendi)')}
          value={temp === null ? '—' : temp.toFixed(1)}
          unit={temp === null ? '' : '°C'}
          time={sampleTs ? when(sampleTs, lang, nowMs) : ''}
          flag={tempFlag}
          tone={tempTone}
          spark={<Spark values={trend.minutes.map((m) => m.tempMeanC)} tone={tempTone} />}
        />
        {postpartum ? (
          <ReadRow
            icon={<IconMoon />}
            label={tx('Sleep last night', 'Usingizi usiku uliopita')}
            value={lastCheck?.sleep ? SLEEP_TEXT[lastCheck.sleep][sw ? 1 : 0] : '—'}
            unit=""
            time={lastCheck ? when(lastCheck.tsMs, lang, nowMs) : ''}
            flag={
              lastCheck
                ? lastCheck.sleep === '0_2' || lastCheck.sleep === '3_4'
                  ? tx('You reported very little sleep', 'Uliripoti usingizi kidogo sana')
                  : tx('You reported this in your check-in', 'Uliripoti hii kwenye ukaguzi')
                : tx('Answer the daily check-in to track sleep', 'Jibu ukaguzi wa kila siku kufuatilia usingizi')
            }
            tone={lastCheck && (lastCheck.sleep === '0_2' || lastCheck.sleep === '3_4') ? 'watch' : lastCheck ? 'calm' : 'muted'}
            spark={<Spark values={today.recoveryCheckins.slice().reverse().flatMap((c) => (c.sleep ? [SLEEP_HOURS[c.sleep]] : []))} tone="calm" />}
          />
        ) : null}
        </div>
        {postpartum && anyAttention ? (
          <div className="reads__ask">
            <p>{tx('A reading needs attention. Answer a few questions so Neema can tell you what to do next.', 'Kipimo kinahitaji uangalifu. Jibu maswali machache ili Neema akuambie hatua inayofuata.')}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => nav('/recovery-check')}>
              {tx('Answer a few questions', 'Jibu maswali machache')}
            </button>
          </div>
        ) : null}

        <div className="reads__btns">
          {/* Quiet rows on purpose: the daily check-in stays the one main action on this screen. */}
          <button type="button" className="reads__go" onClick={() => nav('/bp')}>
            <span>{tx('Add blood pressure', 'Ongeza shinikizo')}</span>
            <IconChevron />
          </button>
          {!g.connected ? (
            <button type="button" className="reads__go" onClick={() => nav('/vitals')}>
              <span>{tx('Connect band', 'Unganisha bendi')}</span>
              <IconChevron />
            </button>
          ) : null}
          <a
            className="reads__go reads__history"
            href="/history"
            onClick={(e) => {
              e.preventDefault();
              nav('/history');
            }}
          >
            <span className="n-link">{tx('View health history', 'Ona historia ya afya')}</span>
            <IconChevron />
          </a>
        </div>
        <p className="reads__note">
          {tx('Neema does not diagnose. Alert levels are set by your health team.', 'Neema hatambui ugonjwa. Viwango vya hatari huwekwa na timu ya afya.')}
        </p>
      </section>

      <button type="button" className="today-circle" onClick={() => nav('/circle')}>
        <span className="today-circle__mark" aria-hidden>
          ♡
        </span>
        <span>
          <strong>{tx("Mothers' circle", 'Duara la mama')}</strong>
          <small>{tx('Anonymous. A cartoon name, never yours.', 'Bila jina. Jina la katuni, si lako.')}</small>
        </span>
        <IconChevron />
      </button>

      <p className="trust-line">{t('saved_here')}</p>
    </main>
  );
}

/** Seven days of the current week with today highlighted (like a pocket calendar). */
function WeekStrip({ nowMs, lang }: { nowMs: number; lang: 'en' | 'sw' }) {
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const loc = lang === 'sw' ? 'sw-KE' : 'en-KE';
  return (
    <ol className="week-strip" aria-label={lang === 'sw' ? 'Wiki hii' : 'This week'}>
      {days.map((d) => {
        const isToday = d.getTime() === today.getTime();
        return (
          <li key={d.getTime()} data-today={isToday} aria-current={isToday ? 'date' : undefined}>
            <span className="week-strip__dow">{isToday ? (lang === 'sw' ? 'LEO' : 'TODAY') : d.toLocaleDateString(loc, { weekday: 'narrow' })}</span>
            <span className="week-strip__num">{d.getDate()}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Soft abstract art for when there is no baby picture to show. */
function RecoveryArt({ label }: { label: string }) {
  return (
    <svg className="baby-art" viewBox="0 0 120 124" role="img" aria-label={label}>
      <defs>
        <radialGradient id="rec-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#fff6ef" />
          <stop offset="100%" stopColor="#efc6b2" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="62" r="52" fill="url(#rec-glow)" />
      <path d="M60 88 C 30 66, 38 40, 60 52 C 82 40, 90 66, 60 88 Z" fill="#f4a9a0" stroke="#e48b82" strokeWidth="2" />
    </svg>
  );
}

function ReadRow({
  icon,
  label,
  value,
  unit,
  time,
  flag,
  tone,
  spark,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  time: string;
  flag: string;
  tone: Tone;
  spark: React.ReactNode;
}) {
  return (
    <div className="read-row" data-tone={tone}>
      <span className="read-row__icon" aria-hidden>
        {icon}
      </span>
      <div className="read-row__main">
        <span className="read-row__label">{label}</span>
        <span className="read-row__value">
          {value}
          {unit ? <small> {unit}</small> : null}
        </span>
        <span className="read-row__flag">
          <i aria-hidden />
          {flag}
          {time ? <span className="read-row__time"> · {time}</span> : null}
        </span>
      </div>
      {spark}
    </div>
  );
}
