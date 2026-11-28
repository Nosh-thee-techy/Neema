import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';
import { latestEpds } from '../services/epdsStore';
import { loadProfile } from '../services/passport';
import { recoveryProgressOf } from '../services/delivery';
import { endSleep, sleepingNow, startSleep } from '../services/sleepSession';
import { db, type RecoveryCheckinRow } from '../storage/db';
import { SLEEP_TEXT } from '../ui/RecoveryParts';

const NIGHTS_KEY = 'neema.sleep.nights';

function loadNights(): { atMs: number; hours: number }[] {
  try {
    const raw = localStorage.getItem(NIGHTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as { atMs: number; hours: number }[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const SLEEP_HOURS = { '0_2': 1, '3_4': 3.5, '5_6': 5.5, '7_plus': 7.5 } as const;
const MOOD_SCORE = { very_low: 1, low: 2, okay: 3, good: 4 } as const;

/**
 * Sleep & mood after birth: last two weeks of check-ins (what she reported, never
 * invented), the EPDS mood check, and people to talk to.
 */
export function WellbeingPage() {
  const nav = useNavigate();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);
  const [rows, setRows] = useState<RecoveryCheckinRow[]>([]);
  const [epdsAt, setEpdsAt] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [pregnant, setPregnant] = useState(false);
  const [asleep, setAsleep] = useState(() => sleepingNow());
  const [nights, setNights] = useState(() => loadNights());

  useEffect(() => {
    void (async () => {
      const [r, e, p] = await Promise.all([
        db.recoveryCheckins.orderBy('tsMs').reverse().limit(14).toArray(),
        latestEpds().catch(() => null),
        loadProfile().catch(() => null),
      ]);
      setRows(r.reverse());
      setEpdsAt(e?.tsMs ?? null);
      setDays(recoveryProgressOf(p)?.daysSinceBirth ?? null);
      setPregnant(p?.stage !== 'postpartum');
    })();
  }, []);

  function logNight(hours: number) {
    const next = [{ atMs: Date.now(), hours }, ...nights].slice(0, 14);
    setNights(next);
    try {
      localStorage.setItem(NIGHTS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const loc = sw ? 'sw-KE' : 'en-KE';
  const dshort = (ms: number) => new Date(ms).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  const sleepRows = rows.filter((r) => r.sleep);
  const lowNights = sleepRows.filter((r) => r.sleep === '0_2' || r.sleep === '3_4').length;
  const lowMoodDays = rows.filter((r) => r.mood === 'low' || r.mood === 'very_low').length;
  const epdsDue = days !== null && ((days >= 10 && days <= 21) || (days >= 38 && days <= 56)) && (!epdsAt || Date.now() - epdsAt > 21 * 86_400_000);

  if (pregnant) {
    return (
      <main className="screen hist">
        <h1 className="screen-title">{tx('Sleep', 'Usingizi')}</h1>
        <p className="screen-sub">
          {tx(
            'Sleep is part of pregnancy, not only the weeks after birth. A slower heart while you are asleep is expected. Neema does not treat that as an emergency.',
            'Usingizi ni sehemu ya mimba, si wiki za baada ya kujifungua pekee. Moyo unaopiga polepole ukiwa umelala unatarajiwa. Neema haichukulii hilo kama dharura.',
          )}
        </p>

        <section className="home-card">
          <h2>{tx('Asleep or unconscious', 'Usingizi au kupoteza fahamu')}</h2>
          <p className="hist-sub">
            {tx(
              'Asleep, you can be woken: a touch, a voice, the baby. Unconscious, you cannot. The band cannot tell those apart by itself. If someone cannot wake you, they should get help. While you have told Neema you are sleeping, she stays quiet about a slower heart.',
              'Ukiwa umelala, unaweza kuamshwa: mguso, sauti, mtoto. Ukipoteza fahamu, huwezi. Bendi haiwezi kutofautisha peke yake. Mtu asipoweza kukuamsha, atafute msaada. Ukiwa umemwambia Neema unalala, yeye hukaa kimya kuhusu moyo unaopiga polepole.',
            )}
          </p>
          {asleep ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                endSleep();
                setAsleep(false);
              }}
            >
              {tx('I am awake', 'Nimeamka')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                startSleep();
                setAsleep(true);
              }}
            >
              {tx('I am going to sleep', 'Naenda kulala')}
            </button>
          )}
        </section>

        <section className="home-card">
          <h2>{tx('Last night', 'Usiku uliopita')}</h2>
          <p className="hist-sub">{tx('Only what you tell Neema. She does not invent hours.', 'Uliyonena tu. Haundi saa.')}</p>
          <div className="story__actions">
            {[4, 6, 8].map((h) => (
              <button key={h} type="button" className="btn btn-secondary btn-sm" onClick={() => logNight(h)}>
                {tx(`${h} hours`, `masaa ${h}`)}
              </button>
            ))}
          </div>
          {nights.length ? (
            <ul className="wb-lines">
              {nights.slice(0, 7).map((n) => (
                <li key={n.atMs}>
                  {dshort(n.atMs)} · {tx(`${n.hours} hours`, `masaa ${n.hours}`)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hist-empty">{tx('No nights saved yet.', 'Bado hakuna usiku uliohifadhiwa.')}</p>
          )}
        </section>

        <section className="home-card">
          <h2>{tx('What the band is for', 'Bendi iko kwa nini')}</h2>
          <p className="hist-sub">
            {tx(
              'Like a sleep ring, the useful part is the pattern: how long you rest, and that your heart and temperature settle while you do. Neema learns your usual from quiet minutes. She does not score your sleep, and she does not guess dream stages.',
              'Kama pete ya usingizi, kinachofaa ni mwenendo: muda unaopumzika, na moyo na joto vinavyotulia. Neema hujifunza kawaida yako kutoka dakika za utulivu. Hatoi alama ya usingizi, na hakisi hatua za ndoto.',
            )}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="screen hist">
      <h1 className="screen-title">{tx('Sleep and mood', 'Usingizi na hisia')}</h1>
      <p className="screen-sub">{tx('From your daily check-ins. Only what you reported is shown.', 'Kutoka ukaguzi wako wa kila siku. Kinaonyeshwa ulichoripoti tu.')}</p>

      <section className="home-card">
        <div className="hist-head">
          <h2>{tx('Sleep, last 2 weeks', 'Usingizi, wiki 2 zilizopita')}</h2>
        </div>
        {sleepRows.length ? (
          <>
            <div className="wb-bars" role="img" aria-label={tx('Hours of sleep you reported each day', 'Saa za usingizi ulizoripoti kila siku')}>
              {sleepRows.map((r) => (
                <div key={r.id} className="wb-bar" data-low={r.sleep === '0_2' || r.sleep === '3_4'}>
                  <span style={{ height: `${(SLEEP_HOURS[r.sleep!] / 8) * 100}%` }} />
                  <small>{dshort(r.tsMs)}</small>
                </div>
              ))}
            </div>
            <p className="n-hint">
              {lowNights
                ? tx(
                    `${lowNights} of ${sleepRows.length} nights with 4 hours or less. Broken sleep is common with a newborn; ask family to take a feed or chores so you can rest.`,
                    `Usiku ${lowNights} kati ya ${sleepRows.length} ulilala saa 4 au chini. Usingizi wa vipande ni kawaida ukiwa na mtoto mchanga; omba familia isaidie ili upumzike.`,
                  )
                : tx('You reported 5 hours or more on every night here.', 'Uliripoti saa 5 au zaidi kila usiku hapa.')}
            </p>
            <p className="n-hint">{tx(`Latest: ${SLEEP_TEXT[sleepRows[sleepRows.length - 1]!.sleep!][0]}`, `Karibuni: ${SLEEP_TEXT[sleepRows[sleepRows.length - 1]!.sleep!][1]}`)}</p>
          </>
        ) : (
          <p className="hist-empty">{tx('No sleep answers yet. Answer the daily check-in to see your pattern.', 'Bado hakuna majibu ya usingizi. Jibu ukaguzi wa kila siku kuona mwenendo wako.')}</p>
        )}
      </section>

      <section className="home-card">
        <div className="hist-head">
          <h2>{tx('Mood, last 2 weeks', 'Hisia, wiki 2 zilizopita')}</h2>
        </div>
        {rows.length ? (
          <>
            <div className="wb-mood" aria-label={tx('Mood you reported each day', 'Hisia ulizoripoti kila siku')}>
              {rows.map((r) => (
                <span key={r.id} className="wb-dot" data-mood={r.mood} title={`${dshort(r.tsMs)}: ${r.mood}`} style={{ ['--lvl' as string]: MOOD_SCORE[r.mood] }}>
                  <span className="sr-only">
                    {dshort(r.tsMs)}: {r.mood}
                  </span>
                </span>
              ))}
            </div>
            <p className="n-hint">
              {lowMoodDays >= 3
                ? tx(
                    'You reported low mood on several days. That is common and help works. Please tell your CHP or nurse, and take the mood check below.',
                    'Uliripoti huzuni siku kadhaa. Ni kawaida na msaada unasaidia. Tafadhali mwambie CHP au muuguzi, na ufanye kipimo cha hisia hapa chini.',
                  )
                : tx('Good and low days both happen after birth. If low days last more than 2 weeks, tell someone.', 'Siku nzuri na mbaya hutokea baada ya kujifungua. Siku mbaya zikizidi wiki 2, mwambie mtu.')}
            </p>
          </>
        ) : (
          <p className="hist-empty">{tx('No mood answers yet.', 'Bado hakuna majibu ya hisia.')}</p>
        )}
      </section>

      <section className="home-card">
        <h2>{tx('When the days feel heavy', 'Siku zinapokuwa nzito')}</h2>
        <p className="hist-sub">
          {tx(
            'Neema does not tell you that you have depression. She notices what you report: several low days, very little sleep, little interest, crying that will not stop, or a thought of harm. A thought of harm asks for a person today. The mood check below is the fuller set of questions, around 2 weeks and 6 weeks after birth.',
            'Neema hakuambii una huzuni ya baada ya kujifungua. Anaona unachoripoti: siku za chini kadhaa, usingizi mdogo sana, kutopendezwa, kulia kusikokoma, au wazo la kujidhuru. Wazo la kujidhuru linahitaji mtu leo. Kipimo hapa chini ni maswali kamili, karibu wiki 2 na wiki 6 baada ya kujifungua.',
          )}
        </p>
      </section>

      <section className="home-card" data-due={epdsDue}>
        <div className="hist-head">
          <h2>{tx('Mood check (EPDS)', 'Kipimo cha hisia (EPDS)')}</h2>
          {epdsDue ? <span className="reads__chip">{tx('Suggested now', 'Inashauriwa sasa')}</span> : null}
        </div>
        <p className="hist-sub">
          {tx('Ten short questions that help spot low mood after birth. Suggested around 2 weeks and 6 weeks after birth.', 'Maswali kumi mafupi yanayosaidia kugundua huzuni baada ya kujifungua. Yanashauriwa karibu wiki 2 na wiki 6 baada ya kujifungua.')}
        </p>
        <p className="hist-sub">{epdsAt ? tx(`Last done: ${dshort(epdsAt)}`, `Mara ya mwisho: ${dshort(epdsAt)}`) : tx('Not done yet.', 'Bado haijafanywa.')}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => nav('/epds')}>
          {tx('Take the mood check', 'Fanya kipimo cha hisia')}
        </button>
      </section>

      <section className="home-card">
        <h2 className="hist-h2">{tx('People you can talk to', 'Watu unaoweza kuzungumza nao')}</h2>
        <ul className="wb-lines">
          <li>
            <a className="btn btn-secondary btn-block" href="tel:1199">
              {tx('Kenya Red Cross: 1199 (free, 24 hours)', 'Kenya Red Cross: 1199 (bure, saa 24)')}
            </a>
          </li>
          <li>
            <a className="btn btn-secondary btn-block" href="tel:+254722178177">
              Befrienders Kenya: 0722 178 177
            </a>
          </li>
          <li>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => nav('/care')}>
              {tx('Talk to Neema (CareChat)', 'Ongea na Neema (CareChat)')}
            </button>
          </li>
        </ul>
        <p className="n-hint">{tx('If you have thoughts of harming yourself or your baby, call 1199 or your CHP now. If in immediate danger, call 999.', 'Ukiwa na mawazo ya kujidhuru au kumdhuru mtoto, piga 1199 au CHP wako sasa. Ukiwa hatarini sasa hivi, piga 999.')}</p>
      </section>

      <button type="button" className="btn btn-primary btn-block" onClick={() => nav('/recovery-check')}>
        {tx('Start Daily Check-in', 'Anza Ukaguzi wa Leo')}
      </button>
    </main>
  );
}
