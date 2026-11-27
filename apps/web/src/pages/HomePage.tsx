import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDefaultTriageConfig, insightForWeek, nextAncContact, type BpReading } from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { useToday } from '../hooks/useToday';
import { useVitalsTrend } from '../hooks/useVitalsTrend';
import { displayTemp } from '../ui/VitalsDashboard';
import { listChase } from '../services/followUp';
import { getMessageTextFor } from '../services/speech';
import { recheckDelayMs } from '../services/recheck';
import { openEmergencyDialer } from '../services/emergency';
import { LoadingScreen } from '../ui/LoadingScreen';
import { EmergencyHoldButton } from '../ui/EmergencyHoldButton';
import { BabyStageArt } from '../ui/BabyStageArt';
import { IconBell, IconChat, IconChevron, IconHeart, IconPressure, IconTemp } from '../ui/icons';

/** Thresholds come from the (placeholder, unsigned) triage config, never from this file. */
const CONFIG = getDefaultTriageConfig();
const DAY_MS = 86_400_000;

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
  const trend = useVitalsTrend(`${level}:${g.demoStep ?? ''}`);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [openLoops, setOpenLoops] = useState(0);
  const [awaitingArrival, setAwaitingArrival] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

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
    action = { label: t('chase_cta'), onClick: () => nav('/chase') };
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

  // ── Pregnancy + this week ───────────────────────────────────────────────
  const preg = today.pregnancy;
  const insight = preg ? insightForWeek(preg.weeks) : null;
  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(sw ? 'sw-KE' : 'en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

  const dateLine = new Date(nowMs).toLocaleDateString(sw ? 'sw-KE' : 'en-KE', { weekday: 'long', day: 'numeric', month: 'long' });

  const anc = preg ? nextAncContact(preg.weeks) : null;
  const babyLabel = preg
    ? tx(`Illustration of a baby at about ${preg.weeks} weeks (not to scale)`, `Mchoro wa mtoto wa karibu wiki ${preg.weeks} (si kwa kipimo halisi)`)
    : '';

  return (
    <main className="screen screen--home home2" data-level={level}>
      {g.loading ? <LoadingScreen /> : null}

      <header className="home2__bar">
        <p className="home2__date">{dateLine}</p>
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

      {/* FIRST: greeting */}
      <h1 className="home2__hello">
        {t(greetingKey(new Date(nowMs).getHours()))}, {name}
      </h1>

      {/* Safety: an active alert always shows right under the greeting. */}
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

      {today.hasRealChp === false ? (
        <button type="button" className="home-alert home-alert--setup" data-testid="no-chp-warning" onClick={() => nav('/contacts?setup=1')}>
          <strong className="home-alert__title">{tx('No CHP number saved', 'Hakuna namba ya CHP')}</strong>
          <span className="home-alert__body">
            {today.placeholderContacts > 0
              ? tx('Only sample numbers are saved. Add a real number so alerts reach someone.', 'Kuna namba za mfano tu. Weka namba halisi ili tahadhari imfikie mtu.')
              : tx('Alerts will reach no one. Tap here to add your CHP.', 'Tahadhari haitamfikia mtu. Gusa hapa kuongeza CHP wako.')}
          </span>
        </button>
      ) : null}

      {/* SECOND: daily check-in */}
      <section className="checkin2" aria-labelledby="checkin-title">
        <span className="checkin2__icon" aria-hidden>
          <IconChat />
        </span>
        <h2 id="checkin-title" className="checkin2__title">
          {tx('How are you feeling today?', 'Unajisikiaje leo?')}
        </h2>
        <p className="checkin2__sub">{tx("Talk to Neema about how you're feeling.", 'Ongea na Neema kuhusu unavyojisikia.')}</p>
        {today.symptomsToday ? (
          <p className="checkin2__done">{tx('You shared how you feel today. Tell Neema if anything changes.', 'Umeeleza unavyojisikia leo. Mwambie Neema kitu kikibadilika.')}</p>
        ) : null}
        <button type="button" className="btn checkin2__btn" onClick={() => nav('/care')}>
          {tx('Start Daily Check-in', 'Anza Ukaguzi wa Leo')}
        </button>
        <button type="button" className="checkin2__alt" onClick={() => nav('/symptoms')}>
          {tx('Or log a symptom', 'Au andika dalili')}
        </button>
      </section>

      {/* THIRD: pregnancy progress + this week, one card */}
      <section className="home-card preg2" aria-labelledby="preg-title">
        {preg ? (
          <>
            <div className="preg2__top">
              <BabyStageArt week={preg.weeks} days={preg.days} label={babyLabel} />
              <div className="preg2__stats">
                <p className="home-card__eyebrow" id="preg-title">
                  {tx('Your pregnancy', 'Mimba yako')}
                </p>
                <p className="preg__week">
                  {tx(`Week ${preg.weeks}`, `Wiki ${preg.weeks}`)}
                  <span> {tx(`· day ${preg.days}`, `· siku ${preg.days}`)}</span>
                </p>
                <span className="preg__tri">{tx(`Trimester ${preg.trimester}`, `Kipindi ${preg.trimester}`)}</span>
              </div>
            </div>
            <div
              className="preg__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={40}
              aria-valuenow={preg.weeks}
              aria-label={tx(`${preg.weeks} of 40 weeks`, `Wiki ${preg.weeks} kati ya 40`)}
            >
              <span style={{ width: `${Math.round(preg.fraction * 100)}%` }} />
              <i style={{ left: '35%' }} aria-hidden />
              <i style={{ left: '70%' }} aria-hidden />
            </div>
            <p className="preg__due">
              {tx('Estimated due date', 'Tarehe ya kujifungua (makadirio)')}: <strong>{fmtDate(preg.eddMs)}</strong>
              {' · '}
              {preg.daysToEdd > 0
                ? tx(`${preg.daysToEdd} days to go`, `siku ${preg.daysToEdd} zimebaki`)
                : preg.daysToEdd === 0
                  ? tx('due today', 'ni leo')
                  : tx(`${-preg.daysToEdd} days past due date`, `siku ${-preg.daysToEdd} baada ya tarehe`)}
            </p>

            {insight ? (
              <div className="preg2__week">
                <h2 className="preg2__h">{tx('This week and your pregnancy', 'Wiki hii na mimba yako')}</h2>
                <div className="preg2__item">
                  <h3>{tx('Your baby', 'Mtoto wako')}</h3>
                  <p>
                    <strong>{sw ? insight.sizeSw : insight.sizeEn}.</strong> {sw ? insight.babySw : insight.babyEn}
                  </p>
                </div>
                <div className="preg2__item">
                  <h3>{tx('What you may feel', 'Unachoweza kuhisi')}</h3>
                  <p>{sw ? insight.feelSw : insight.feelEn}</p>
                </div>
                <div className="preg2__item">
                  <h3>{tx('What to expect', 'Cha kutarajia')}</h3>
                  <p>
                    {anc
                      ? anc.inWeeks === 0
                        ? tx(`A clinic visit is recommended this week (visit ${anc.number} of 8).`, `Ziara ya kliniki inapendekezwa wiki hii (ziara ${anc.number} kati ya 8).`)
                        : tx(
                            `Next recommended clinic visit: around week ${anc.week} (visit ${anc.number} of 8). Your clinic gives your real date.`,
                            `Ziara ijayo ya kliniki inayopendekezwa: karibu wiki ${anc.week} (ziara ${anc.number} kati ya 8). Kliniki yako hukupa tarehe halisi.`,
                          )
                      : tx('You are past 40 weeks. Stay in close touch with your clinic.', 'Umepita wiki 40. Wasiliana na kliniki yako kwa karibu.')}
                  </p>
                </div>
                {insightOpen ? (
                  <div className="preg2__item" id="insight-more">
                    <h3>{tx('Good to do', 'Vizuri kufanya')}</h3>
                    <p>{sw ? insight.doSw : insight.doEn}</p>
                  </div>
                ) : null}
                <div className="preg2__watch">
                  <h3>{tx('Get help straight away if', 'Tafuta msaada mara moja kama')}</h3>
                  <p>{sw ? insight.watchSw : insight.watchEn}</p>
                </div>
                <div className="preg2__foot">
                  <button type="button" className="btn btn-secondary btn-sm" aria-expanded={insightOpen} aria-controls="insight-more" onClick={() => setInsightOpen((v) => !v)}>
                    {insightOpen ? tx('Show less', 'Onyesha kidogo') : tx('More guidance', 'Ushauri zaidi')}
                  </button>
                  <p className="insight__src">
                    {tx('Adapted from the ', 'Imetoholewa kutoka ')}
                    <a href={insight.sourceUrl} target="_blank" rel="noreferrer">
                      {tx('NHS guide', 'mwongozo wa NHS')}
                    </a>
                    {tx(' and WHO ANC guidance', ' na mwongozo wa WHO')}
                    {insight.status !== 'reviewed' ? <span className="insight__draft">{tx('Draft: awaiting nurse review', 'Rasimu: inasubiri muuguzi')}</span> : null}
                  </p>
                </div>
              </div>
            ) : null}
          </>
        ) : today.stage === 'postpartum' ? (
          <>
            <p className="home-card__eyebrow" id="preg-title">
              {tx('After birth', 'Baada ya kujifungua')}
            </p>
            <p className="preg__empty">{tx('Neema keeps watching your readings in the weeks after birth.', 'Neema anaendelea kuangalia vipimo vyako wiki baada ya kujifungua.')}</p>
          </>
        ) : (
          <>
            <p className="home-card__eyebrow" id="preg-title">
              {tx('Your pregnancy', 'Mimba yako')}
            </p>
            <p className="preg__empty">{tx('Add your weeks or due date from the clinic card to see your progress.', 'Ongeza wiki au tarehe ya kujifungua kutoka kadi ya kliniki kuona maendeleo.')}</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => nav('/profile#pregnancy')}>
              {tx('Add pregnancy details', 'Ongeza maelezo ya mimba')}
            </button>
          </>
        )}
      </section>

      {/* FOURTH: readings */}
      <section className="home-card reads" aria-labelledby="reads-title" data-attention={anyAttention}>
        <div className="reads__head">
          <h2 id="reads-title">{tx('Your latest readings', 'Vipimo vyako vya karibuni')}</h2>
          {anyAttention ? <span className="reads__chip">{tx('Needs attention', 'Inahitaji uangalifu')}</span> : null}
        </div>

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
          label={tx('Body temperature', 'Joto la mwili')}
          value={temp === null ? '—' : temp.toFixed(1)}
          unit={temp === null ? '' : '°C'}
          time={sampleTs ? when(sampleTs, lang, nowMs) : ''}
          flag={tempFlag}
          tone={tempTone}
          spark={<Spark values={trend.minutes.map((m) => m.tempMeanC)} tone={tempTone} />}
        />

        <div className="reads__btns">
          <button type="button" className="btn btn-primary" onClick={() => nav('/bp')}>
            {tx('Add blood pressure', 'Ongeza shinikizo')}
          </button>
          {!g.connected ? (
            <button type="button" className="btn btn-secondary" onClick={() => nav('/vitals')}>
              {tx('Connect band', 'Unganisha bendi')}
            </button>
          ) : null}
        </div>
        <a
          className="n-link reads__history"
          href="/history"
          onClick={(e) => {
            e.preventDefault();
            nav('/history');
          }}
        >
          {tx('View health history', 'Ona historia ya afya')} →
        </a>
        <p className="reads__note">
          {tx('Neema does not diagnose. Alert levels are set by your health team.', 'Neema hatambui ugonjwa. Viwango vya hatari huwekwa na timu ya afya.')}
        </p>
      </section>

      <p className="trust-line">{t('saved_here')}</p>
    </main>
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
