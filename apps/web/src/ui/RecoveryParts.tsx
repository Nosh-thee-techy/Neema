import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NEWBORN_DANGER_SIGNS,
  NEWBORN_TIPS,
  RECOVERY_EMERGENCY_SIGNS,
  RECOVERY_STAGES,
  RECOVERY_TODAY_SIGNS,
  nextKepiVisit,
  nextPncContact,
  parseLocalIsoDate,
  recoveryStageFor,
  type PostpartumProgress,
} from '@neema/core';
import type { DeliveryRecord } from '../services/passport';
import type { BabyRow, RecoveryCheckinRow } from '../storage/db';
import { EMERGENCY_NUMBER, EMERGENCY_TEL } from '../services/emergency';
import { IconChat, IconChevron } from './icons';

type Lang = 'en' | 'sw';
const DAY = 86_400_000;

function makeTx(lang: Lang) {
  return (en: string, sw: string) => (lang === 'sw' ? sw : en);
}

/** "12 days old", "3 weeks 2 days old", "4 months old". */
export function babyAgeText(days: number, lang: Lang): string {
  const tx = (en: string, sw: string) => (lang === 'sw' ? sw : en);
  if (days === 0) return tx('born today', 'amezaliwa leo');
  if (days === 1) return tx('1 day old', 'siku 1');
  if (days < 14) return tx(`${days} days old`, `siku ${days}`);
  if (days < 84) {
    const w = Math.floor(days / 7);
    const d = days % 7;
    return d ? tx(`${w} weeks ${d} days old`, `wiki ${w} siku ${d}`) : tx(`${w} weeks old`, `wiki ${w}`);
  }
  const m = Math.floor(days / 30.44);
  return tx(`${m} months old`, `miezi ${m}`);
}

export function recoveryDayText(days: number, lang: Lang): string {
  const tx = makeTx(lang);
  if (days === 0) return tx('Birth day', 'Siku ya kujifungua');
  if (days < 14) return tx(`Day ${days} of your recovery`, `Siku ya ${days} ya kupona`);
  const w = Math.floor(days / 7);
  const d = days % 7;
  return d ? tx(`Week ${w}, day ${d} of your recovery`, `Wiki ${w}, siku ${d} ya kupona`) : tx(`Week ${w} of your recovery`, `Wiki ${w} ya kupona`);
}

// ── A. Welcome ─────────────────────────────────────────────────────────────

export function RecoveryWelcome({
  recovery,
  babies,
  showBaby,
  lang,
}: {
  recovery: PostpartumProgress;
  babies: BabyRow[];
  showBaby: boolean;
  lang: Lang;
}) {
  const tx = makeTx(lang);
  const d = recovery.daysSinceBirth;
  const babyNames = babies.map((b) => b.name).filter(Boolean) as string[];
  const babyLabel = babyNames.length
    ? babyNames.join(tx(' and ', ' na '))
    : babies.length > 1
      ? tx('Your babies are', 'Watoto wako wana')
      : tx('Your baby is', 'Mtoto wako ana');
  const message =
    d === 0
      ? tx('Your baby was born today. Rest as much as you can. Neema is watching with you.', 'Mtoto wako amezaliwa leo. Pumzika kadri uwezavyo. Neema yuko nawe.')
      : d < 2
        ? tx(`You're ${d} day into your recovery. Let's check how you're feeling today.`, `Uko siku ${d} ya kupona. Tuangalie unavyojisikia leo.`)
        : tx(`You're ${d} days into your recovery. Let's check how you're feeling today.`, `Uko siku ${d} za kupona. Tuangalie unavyojisikia leo.`);

  return (
    <section className="rec-welcome" aria-label={tx('Your recovery', 'Kupona kwako')}>
      <div className="rec-welcome__chips">
        <span className="rec-chip rec-chip--mother">{recoveryDayText(d, lang)}</span>
        {showBaby && babies.length ? (
          <span className="rec-chip rec-chip--baby">
            {babyNames.length ? `${babyLabel}: ` : ''}
            {babyNames.length ? babyAgeText(d, lang) : `${babyLabel} ${babyAgeText(d, lang)}`}
          </span>
        ) : null}
      </div>
      <p className="rec-welcome__msg">{message}</p>
      <p className="rec-welcome__note">{tx('Neema is now caring for your recovery after birth.', 'Neema sasa anakusaidia kupona baada ya kujifungua.')}</p>
    </section>
  );
}

/** Shown when the stage says "after birth" but no birth date is saved yet. */
export function RecordBirthPrompt({ lang }: { lang: Lang }) {
  const tx = makeTx(lang);
  const nav = useNavigate();
  return (
    <section className="home-card">
      <h2 className="preg2__h">{tx('When was your baby born?', 'Mtoto wako alizaliwa lini?')}</h2>
      <p className="preg__empty">
        {tx('Add the birth date so Neema can show the right recovery advice for each day.', 'Ongeza tarehe ya kuzaliwa ili Neema akuonyeshe ushauri sahihi wa kupona kila siku.')}
      </p>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => nav('/record-birth')}>
        {tx('Add birth details', 'Ongeza maelezo ya kujifungua')}
      </button>
    </section>
  );
}

// ── B. Daily check-in ─────────────────────────────────────────────────────

const MOOD: Record<RecoveryCheckinRow['mood'], [string, string]> = {
  good: ['good', 'nzuri'],
  okay: ['okay', 'sawa'],
  low: ['low', 'chini'],
  very_low: ['very low', 'chini sana'],
};
const PHYS: Record<RecoveryCheckinRow['physical'], [string, string]> = {
  good: ['good', 'vizuri'],
  okay: ['okay', 'sawa'],
  unwell: ['unwell', 'mgonjwa'],
};
export const SLEEP_TEXT: Record<NonNullable<RecoveryCheckinRow['sleep']>, [string, string]> = {
  '0_2': ['0–2 h', 'saa 0–2'],
  '3_4': ['3–4 h', 'saa 3–4'],
  '5_6': ['5–6 h', 'saa 5–6'],
  '7_plus': ['7 h or more', 'saa 7 au zaidi'],
};

export function RecoveryCheckinCard({ lang, last, doneToday }: { lang: Lang; last: RecoveryCheckinRow | undefined; doneToday: boolean }) {
  const tx = makeTx(lang);
  const nav = useNavigate();
  const i = lang === 'sw' ? 1 : 0;
  return (
    <section className="checkin2" aria-labelledby="rec-checkin-title">
      <span className="checkin2__icon" aria-hidden>
        <IconChat />
      </span>
      <h2 id="rec-checkin-title" className="checkin2__title">
        {tx('How are you and your body feeling today?', 'Wewe na mwili wako mnajisikiaje leo?')}
      </h2>
      <p className="checkin2__sub">
        {doneToday ? tx('Thank you for checking in today.', 'Asante kwa kujibu leo.') : tx('A few quick questions about your body, mood and sleep. About one minute.', 'Maswali machache kuhusu mwili, hisia na usingizi. Karibu dakika moja.')}
      </p>
      {doneToday && last ? (
        <ul className="rec-summary" aria-label={tx("Today's answers", 'Majibu ya leo')}>
          <li>
            {tx('Body', 'Mwili')}: <strong>{PHYS[last.physical][i]}</strong>
          </li>
          <li>
            {tx('Mood', 'Hisia')}: <strong>{MOOD[last.mood][i]}</strong>
          </li>
          {last.sleep ? (
            <li>
              {tx('Sleep', 'Usingizi')}: <strong>{SLEEP_TEXT[last.sleep][i]}</strong>
            </li>
          ) : null}
        </ul>
      ) : null}
      <button type="button" className="btn checkin2__btn" onClick={() => nav('/recovery-check')}>
        {doneToday ? tx('Check in again', 'Jibu tena') : tx('Start Daily Check-in', 'Anza Ukaguzi wa Leo')}
      </button>
      <button type="button" className="checkin2__alt" onClick={() => nav('/care')}>
        {tx('Or talk to Neema in CareChat', 'Au ongea na Neema kwenye CareChat')}
      </button>
    </section>
  );
}

// ── C/D. What to expect + normal vs when to seek help ────────────────────

export function RecoveryExpectCard({ lang, days, mode }: { lang: Lang; days: number; mode: DeliveryRecord['mode'] | undefined }) {
  const tx = makeTx(lang);
  const current = RECOVERY_STAGES.indexOf(recoveryStageFor(days));
  const [idx, setIdx] = useState(current);
  const [more, setMore] = useState(false);
  const stage = RECOVERY_STAGES[idx]!;
  const isNow = idx === current;
  const L = (b: { en: string; sw: string }) => b[lang];
  const pnc = nextPncContact(days);
  const visibleTopics = more ? stage.topics : stage.topics.slice(0, 2);

  return (
    <section className="home-card rec-expect" aria-labelledby="rec-expect-title">
      <h2 id="rec-expect-title" className="preg2__h">
        {tx('Your Recovery: What to Expect', 'Kupona Kwako: Cha Kutarajia')}
      </h2>

      <div className="rec-stage-nav">
        <button type="button" className="btn btn-secondary btn-sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} aria-label={tx('Previous stage', 'Hatua iliyopita')}>
          ‹ {tx('Earlier', 'Awali')}
        </button>
        <div className="rec-stage-nav__mid" aria-live="polite">
          <strong>{L(stage.title)}</strong>
          <span>{L(stage.range)}</span>
          {isNow ? <span className="rec-now">{tx('You are here', 'Uko hapa')}</span> : null}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={idx === RECOVERY_STAGES.length - 1}
          onClick={() => setIdx((i) => i + 1)}
          aria-label={tx('Next stage', 'Hatua inayofuata')}
        >
          {tx('Later', 'Baadaye')} ›
        </button>
      </div>
      <ol className="rec-dots" aria-label={tx('Recovery stages', 'Hatua za kupona')}>
        {RECOVERY_STAGES.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              aria-label={L(s.title)}
              aria-current={i === idx ? 'step' : undefined}
              data-state={i < current ? 'past' : i === current ? 'now' : 'next'}
              onClick={() => setIdx(i)}
            />
          </li>
        ))}
      </ol>
      {!isNow ? (
        <button type="button" className="n-link" onClick={() => setIdx(current)}>
          {tx('Back to my stage', 'Rudi kwenye hatua yangu')}
        </button>
      ) : null}

      <p className="rec-intro">{L(stage.intro)}</p>

      {isNow && pnc ? (
        <p className="rec-visit">
          <strong>{pnc.dueNow ? tx('Due now: ', 'Sasa: ') : tx('Next: ', 'Ijayo: ')}</strong>
          {pnc.contact[lang]}
          {tx(' (recommended postnatal check)', ' (ukaguzi unaopendekezwa)')}
        </p>
      ) : null}

      {mode === 'caesarean' && stage.caesareanNote ? <p className="rec-cs">{L(stage.caesareanNote)}</p> : null}

      <div className="rec-topics">
        {visibleTopics.map((t) => (
          <div key={t.heading.en} className="preg2__item">
            <h3>{L(t.heading)}</h3>
            <p>{L(t.text)}</p>
          </div>
        ))}
      </div>
      {stage.topics.length > 2 ? (
        <button type="button" className="btn btn-secondary btn-sm" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          {more ? tx('Show less', 'Onyesha kidogo') : tx('More about this stage', 'Zaidi kuhusu hatua hii')}
        </button>
      ) : null}

      <div className="rec-normal">
        <h3>{tx('What may be normal at this stage', 'Kinachoweza kuwa kawaida sasa')}</h3>
        <ul>
          {stage.normal.map((n) => (
            <li key={n.en}>{L(n)}</li>
          ))}
        </ul>
        <p className="n-hint">{tx('If something on this list feels worse, or you are worried, ask anyway.', 'Kitu kwenye orodha hii kikizidi, au ukiwa na wasiwasi, uliza hata hivyo.')}</p>
      </div>

      <div className="rec-help">
        <h3>{tx('When should I seek help?', 'Nitafute msaada lini?')}</h3>
        <div className="rec-emergency" role="group" aria-labelledby="rec-em-h">
          <h4 id="rec-em-h">{tx(`Emergency: go to a facility now or call ${EMERGENCY_NUMBER}`, `Dharura: nenda kituo cha afya sasa au piga ${EMERGENCY_NUMBER}`)}</h4>
          <ul>
            {RECOVERY_EMERGENCY_SIGNS.map((n) => (
              <li key={n.en}>{L(n)}</li>
            ))}
          </ul>
          <a className="btn btn-danger btn-sm" href={EMERGENCY_TEL}>
            {tx(`Call ${EMERGENCY_NUMBER}`, `Piga ${EMERGENCY_NUMBER}`)}
          </a>
        </div>
        <div className="rec-today" role="group" aria-labelledby="rec-today-h">
          <h4 id="rec-today-h">{tx('Contact your CHP or clinic today', 'Wasiliana na CHP au kliniki leo')}</h4>
          <ul>
            {[...stage.todayExtra, ...RECOVERY_TODAY_SIGNS].map((n) => (
              <li key={n.en}>{L(n)}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="rec-foot">
        {tx(
          'Every recovery is different. These stages are a guide, not deadlines. If you are worried, contact your health worker even if your sign is not listed.',
          'Kila mama hupona tofauti. Hatua hizi ni mwongozo, si tarehe za mwisho. Ukiwa na wasiwasi, wasiliana na mhudumu wa afya hata kama dalili yako haipo hapa.',
        )}
      </p>
      <p className="insight__src">
        {tx('Adapted from ', 'Imetoholewa kutoka ')}
        {stage.sources.map((s, i) => (
          <span key={s.url}>
            {i ? ', ' : ''}
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.name}
            </a>
          </span>
        ))}
        {stage.status !== 'reviewed' ? <span className="insight__draft">{tx('Draft: awaiting nurse review', 'Rasimu: inasubiri muuguzi')}</span> : null}
      </p>
    </section>
  );
}

// ── Baby: secondary ───────────────────────────────────────────────────────

export function BabyFirstWeeksCard({ lang, babies, birthDateIso }: { lang: Lang; babies: BabyRow[]; birthDateIso: string }) {
  const tx = makeTx(lang);
  const [open, setOpen] = useState(false);
  const birthMs = parseLocalIsoDate(birthDateIso) ?? Date.now();
  const ageDays = Math.max(0, Math.round((new Date().setHours(0, 0, 0, 0) - birthMs) / DAY));
  const visit = nextKepiVisit(ageDays);
  const visitDate = visit ? new Date(birthMs + visit.ageDays * DAY).toLocaleDateString(lang === 'sw' ? 'sw-KE' : 'en-KE', { day: 'numeric', month: 'long' }) : null;
  const names = babies.map((b) => b.name).filter(Boolean).join(tx(' and ', ' na '));
  const L = (b: { en: string; sw: string }) => b[lang];

  return (
    <section className="home-card rec-baby" aria-labelledby="rec-baby-title">
      <div className="hist-head">
        <h2 id="rec-baby-title">{tx("Your Baby's First Weeks", 'Wiki za Kwanza za Mtoto')}</h2>
        <button type="button" className="btn btn-secondary btn-sm" aria-expanded={open} aria-controls="rec-baby-body" onClick={() => setOpen((v) => !v)}>
          {open ? tx('Hide', 'Ficha') : tx('Open', 'Fungua')}
        </button>
      </div>
      <p className="rec-baby__line">
        {names ? `${names} · ` : ''}
        {babyAgeText(ageDays, lang)}
        {visit && visitDate ? (
          <>
            {' · '}
            {tx('Next clinic visit: ', 'Kliniki ijayo: ')}
            <strong>{visit.id === 'birth' ? visit[lang] : `${visit[lang]} (${tx('around', 'karibu')} ${visitDate})`}</strong>
          </>
        ) : null}
      </p>
      {open ? (
        <div id="rec-baby-body">
          {NEWBORN_TIPS.map((t) => (
            <div key={t.heading.en} className="preg2__item">
              <h3>{L(t.heading)}</h3>
              <p>{L(t.text)}</p>
            </div>
          ))}
          <div className="rec-emergency">
            <h4>{tx('Take your baby to a facility now if baby has:', 'Mpeleke mtoto kituo cha afya sasa kama ana:')}</h4>
            <ul>
              {NEWBORN_DANGER_SIGNS.map((n) => (
                <li key={n.en}>{L(n)}</li>
              ))}
            </ul>
          </div>
          {ageDays > 1 ? (
            <p className="n-hint">{tx('If your baby did not get BCG and polio drops at birth, ask the clinic at the next visit.', 'Kama mtoto hakupata BCG na matone ya polio wakati wa kuzaliwa, uliza kliniki ziara ijayo.')}</p>
          ) : null}
          <p className="n-hint">{tx("Your baby's own records belong to the child health clinic. Neema keeps only these reminders.", 'Rekodi za mtoto ziko kliniki ya afya ya mtoto. Neema huweka vikumbusho hivi tu.')}</p>
        </div>
      ) : null}
    </section>
  );
}

export function ChevronLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="n-link" onClick={onClick}>
      {label} <IconChevron />
    </button>
  );
}
