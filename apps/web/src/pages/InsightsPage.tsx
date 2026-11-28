import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BABY_STAGES, WEEKLY_INSIGHTS, babyStageFor, insightForWeek, nextAncContact } from '@neema/core';
import { useLocale } from '../hooks/useLocale';
import { useToday } from '../hooks/useToday';
import { Segmented } from '../ui/Segmented';
import { BabyStageArt, NewbornArt } from '../ui/BabyStageArt';
import { BabyFirstWeeksCard, RecoveryExpectCard, babyAgeText } from '../ui/RecoveryParts';

/**
 * Insights: the full "what is happening now" guide, explorable.
 * Pregnancy: week-by-week cards. After birth: recovery stages and the baby's development.
 */
export function InsightsPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);
  const today = useToday('insights');
  const postpartum = today.stage === 'postpartum';
  const showBaby = Boolean(today.delivery?.showBabyInfo);
  const [tab, setTab] = useState<'recovery' | 'baby'>(loc.hash === '#baby' ? 'baby' : 'recovery');

  useEffect(() => {
    if (loc.hash === '#help') requestAnimationFrame(() => document.getElementById('help')?.scrollIntoView({ block: 'start' }));
  }, [loc.hash, today.stage]);

  return (
    <main className="screen hist insights">
      <h1 className="screen-title">{postpartum ? tx('Recovery and baby', 'Kupona na mtoto') : tx('Your pregnancy, week by week', 'Mimba yako, wiki kwa wiki')}</h1>

      {!today.loaded ? (
        <p className="hist-empty">{tx('Opening your weeks…', 'Inafungua wiki zako…')}</p>
      ) : postpartum ? (
        today.recovery ? (
          <>
            {showBaby ? (
              <Segmented
                mode="tabs"
                idPrefix="ins"
                ariaLabel={tx('Insights', 'Maelezo')}
                value={tab}
                onChange={(v) => {
                  setTab(v);
                  window.history.replaceState(null, '', v === 'baby' ? '#baby' : '#recovery');
                }}
                options={[
                  { value: 'recovery', label: tx('Your recovery', 'Kupona kwako') },
                  { value: 'baby', label: tx('Your baby', 'Mtoto wako') },
                ]}
              />
            ) : null}
            {tab === 'recovery' || !showBaby ? (
              <div id="ins-panel-recovery" role={showBaby ? 'tabpanel' : undefined} aria-labelledby={showBaby ? 'ins-tab-recovery' : undefined}>
                <RecoveryExpectCard lang={lang} days={today.recovery.daysSinceBirth} mode={today.delivery?.mode} />
              </div>
            ) : (
              <div id="ins-panel-baby" role="tabpanel" aria-labelledby="ins-tab-baby" className="hist-panel">
                <BabyExplorer ageDays={today.recovery.daysSinceBirth} lang={lang} />
                {today.delivery ? <BabyFirstWeeksCard lang={lang} babies={today.babies} birthDateIso={today.delivery.dateIso} defaultOpen /> : null}
              </div>
            )}
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => nav('/record-birth')}>
            {tx('Add birth details', 'Ongeza maelezo ya kujifungua')}
          </button>
        )
      ) : (
        <PregnancyExplorer key={today.pregnancy?.weeks ?? 'none'} week={today.pregnancy?.weeks ?? null} days={today.pregnancy?.days ?? 0} lang={lang} />
      )}
    </main>
  );
}

function PregnancyExplorer({ week, days, lang }: { week: number | null; days: number; lang: 'en' | 'sw' }) {
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);
  const currentCard = week !== null ? insightForWeek(week) : WEEKLY_INSIGHTS[0]!;
  const currentIdx = Math.max(0, WEEKLY_INSIGHTS.indexOf(currentCard ?? WEEKLY_INSIGHTS[0]!));
  const [idx, setIdx] = useState(currentIdx);
  const card = WEEKLY_INSIGHTS[idx]!;
  const isNow = week !== null && idx === currentIdx;
  const showWeek = isNow ? week! : Math.round((card.fromWeek + card.toWeek) / 2);
  const anc = nextAncContact(showWeek);

  return (
    <section className="home-card rec-expect" aria-labelledby="pw-title">
      <div className="rec-stage-nav">
        <button type="button" className="btn btn-secondary btn-sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} aria-label={tx('Earlier weeks', 'Wiki za awali')}>
          ‹ {tx('Earlier', 'Awali')}
        </button>
        <div className="rec-stage-nav__mid" aria-live="polite">
          <strong id="pw-title">{isNow ? tx(`Week ${week}, day ${days}`, `Wiki ${week}, siku ${days}`) : tx(`Weeks ${card.fromWeek}–${card.toWeek}`, `Wiki ${card.fromWeek}–${card.toWeek}`)}</strong>
          {isNow ? <span className="rec-now">{tx('You are here', 'Uko hapa')}</span> : null}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={idx === WEEKLY_INSIGHTS.length - 1}
          onClick={() => setIdx((i) => i + 1)}
          aria-label={tx('Later weeks', 'Wiki zijazo')}
        >
          {tx('Later', 'Baadaye')} ›
        </button>
      </div>
      {week === null ? (
        <p className="hist-empty">
          {tx(
            'Your own week shows here once it is saved on this phone. You can still read every week.',
            'Wiki yako itaonekana hapa ikishahifadhiwa kwenye simu hii. Bado unaweza kusoma kila wiki.',
          )}
        </p>
      ) : null}
      <div className="ins-art">
        <BabyStageArt week={showWeek} label={tx(`Illustration of a baby at about ${showWeek} weeks (not to scale)`, `Mchoro wa mtoto wa karibu wiki ${showWeek}`)} />
      </div>
      <div className="preg2__item">
        <h3>{tx('Your baby', 'Mtoto wako')}</h3>
        <p>
          <strong>{sw ? card.sizeSw : card.sizeEn}.</strong> {sw ? card.babySw : card.babyEn}
        </p>
      </div>
      <div className="preg2__item">
        <h3>{tx('What you may feel', 'Unachoweza kuhisi')}</h3>
        <p>{sw ? card.feelSw : card.feelEn}</p>
      </div>
      <div className="preg2__item">
        <h3>{tx('Good to do', 'Vizuri kufanya')}</h3>
        <p>{sw ? card.doSw : card.doEn}</p>
      </div>
      {anc ? (
        <div className="preg2__item">
          <h3>{tx('What to expect', 'Cha kutarajia')}</h3>
          <p>{tx(`Recommended clinic visit around week ${anc.week} (visit ${anc.number} of 8). Your clinic gives your real date.`, `Ziara ya kliniki inayopendekezwa karibu wiki ${anc.week} (ziara ${anc.number} kati ya 8). Kliniki hukupa tarehe halisi.`)}</p>
        </div>
      ) : null}
      <div className="preg2__watch" id="help">
        <h3>{tx('Get help straight away if', 'Tafuta msaada mara moja kama')}</h3>
        <p>{sw ? card.watchSw : card.watchEn}</p>
      </div>
      <p className="insight__src">
        {tx('Adapted from the ', 'Imetoholewa kutoka ')}
        <a href={card.sourceUrl} target="_blank" rel="noreferrer">
          {tx('NHS guide', 'mwongozo wa NHS')}
        </a>
        {tx(' and WHO ANC guidance', ' na mwongozo wa WHO')}
        {card.status !== 'reviewed' ? <span className="insight__draft">{tx('Draft: awaiting nurse review', 'Rasimu: inasubiri muuguzi')}</span> : null}
      </p>
    </section>
  );
}

function BabyExplorer({ ageDays, lang }: { ageDays: number; lang: 'en' | 'sw' }) {
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);
  const L = (x: { en: string; sw: string }) => x[lang];
  const currentIdx = BABY_STAGES.indexOf(babyStageFor(ageDays));
  const [idx, setIdx] = useState(currentIdx);
  const st = BABY_STAGES[idx]!;
  const isNow = idx === currentIdx;
  const artAge = isNow ? ageDays : Math.round((st.fromDay + Math.min(st.toDay, 90)) / 2);

  return (
    <section className="home-card rec-expect" aria-labelledby="bd-title">
      <h2 className="preg2__h" id="bd-title">
        {tx("Your baby's development", 'Ukuaji wa mtoto wako')}
      </h2>
      <div className="rec-stage-nav">
        <button type="button" className="btn btn-secondary btn-sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} aria-label={tx('Earlier stage', 'Hatua ya awali')}>
          ‹ {tx('Earlier', 'Awali')}
        </button>
        <div className="rec-stage-nav__mid" aria-live="polite">
          <strong>{L(st.title)}</strong>
          {isNow ? <span className="rec-now">{babyAgeText(ageDays, lang)}</span> : null}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" disabled={idx === BABY_STAGES.length - 1} onClick={() => setIdx((i) => i + 1)} aria-label={tx('Later stage', 'Hatua ijayo')}>
          {tx('Later', 'Baadaye')} ›
        </button>
      </div>
      <div className="ins-art">
        <NewbornArt ageDays={artAge} label={tx('Illustration of your baby', 'Mchoro wa mtoto wako')} />
      </div>
      <p className="rec-intro">{L(st.headline)}</p>
      <div className="rec-normal">
        <h3>{tx('What many babies do now', 'Watoto wengi hufanya nini sasa')}</h3>
        <ul>
          {st.doing.map((x) => (
            <li key={x.en}>{L(x)}</li>
          ))}
        </ul>
      </div>
      <div className="preg2__item">
        <h3>{tx('How you can help', 'Jinsi unavyoweza kusaidia')}</h3>
        {st.tips.map((x) => (
          <p key={x.en}>{L(x)}</p>
        ))}
      </div>
      <div className="rec-today">
        <h4>{tx('Talk to the clinic if your baby', 'Ongea na kliniki kama mtoto wako')}</h4>
        <ul>
          {st.askClinic.map((x) => (
            <li key={x.en}>{L(x)}</li>
          ))}
        </ul>
      </div>
      <p className="rec-foot">{tx('Every baby develops at their own pace. These are guides, not tests.', 'Kila mtoto hukua kwa kasi yake. Huu ni mwongozo, si mtihani.')}</p>
      <p className="insight__src">
        {tx('Adapted from ', 'Imetoholewa kutoka ')}
        {st.sources.map((s, i) => (
          <span key={s.url}>
            {i ? ', ' : ''}
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.name}
            </a>
          </span>
        ))}
        {st.status !== 'reviewed' ? <span className="insight__draft">{tx('Draft: awaiting nurse review', 'Rasimu: inasubiri muuguzi')}</span> : null}
      </p>
    </section>
  );
}
