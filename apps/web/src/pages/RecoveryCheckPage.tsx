import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isPlaceholderPhone, type Contact, type SymptomCode, type TriageResult } from '@neema/core';
import { useLocale } from '../hooks/useLocale';
import { useGuardian } from '../hooks/useGuardian';
import { useWatchPlan } from '../hooks/useWatchPlan';
import { loadProfile } from '../services/passport';
import { recoveryProgressOf } from '../services/delivery';
import { listContacts } from '../services/contacts';
import { EMERGENCY_NUMBER, EMERGENCY_TEL } from '../services/emergency';
import { db, type RecoveryCheckinRow, type SleepBand } from '../storage/db';

/**
 * Guided after-birth check-in: a few taps a day, with follow-up questions only when
 * an answer needs them. Danger signs are saved as symptoms so the same triage rules
 * and alert chain (SMS to CHP / family) run. Answers that are only context (mood,
 * sleep, rest) are stored as the check-in itself; rules never read them.
 *
 * Support lines (TEAM TO CONFIRM before field use): Kenya Red Cross 1199 (toll-free, 24/7),
 * Befrienders Kenya +254 722 178 177.
 */

type Step = 'physical' | 'bleeding' | 'danger' | 'mood' | 'moodMore' | 'sleep' | 'sleepMore' | 'result';

type Danger =
  | 'dizzy_faint'
  | 'chest_pain_breathless'
  | 'headache_vision'
  | 'fits'
  | 'severe_abdominal_pain'
  | 'fever_chills'
  | 'foul_discharge'
  | 'wound_problem'
  | 'leg_pain_swelling'
  | 'breast_red_painful'
  | 'urine_problem';

const DANGERS: Array<{ key: Danger; en: string; sw: string; codes: SymptomCode[]; emergency: boolean }> = [
  { key: 'dizzy_faint', en: 'Fainted, or nearly fainted', sw: 'Nimezirai, au karibu kuzirai', codes: ['dizzy_faint'], emergency: true },
  { key: 'chest_pain_breathless', en: 'Chest pain or hard to breathe', sw: 'Maumivu ya kifua au shida kupumua', codes: ['chest_pain_breathless'], emergency: true },
  { key: 'headache_vision', en: 'Bad headache with blurred vision', sw: 'Kichwa kuuma sana na kuona ukungu', codes: ['headache', 'blurred_vision'], emergency: true },
  { key: 'severe_abdominal_pain', en: 'Severe tummy pain', sw: 'Maumivu makali ya tumbo', codes: ['severe_abdominal_pain'], emergency: true },
  { key: 'fits', en: 'A fit (convulsion)', sw: 'Degedege', codes: ['fits'], emergency: true },
  { key: 'fever_chills', en: 'Fever, chills or shivering', sw: 'Homa, baridi au kutetemeka', codes: ['fever_chills'], emergency: false },
  { key: 'foul_discharge', en: 'Bad-smelling discharge', sw: 'Uchafu wenye harufu mbaya', codes: ['foul_discharge'], emergency: false },
  { key: 'wound_problem', en: 'Stitches or wound red, swollen or leaking', sw: 'Mshono au kidonda chekundu, kimevimba au kinatoa usaha', codes: ['wound_problem'], emergency: false },
  { key: 'leg_pain_swelling', en: 'One leg painful or swollen', sw: 'Mguu mmoja unauma au umevimba', codes: ['leg_pain_swelling'], emergency: false },
  { key: 'breast_red_painful', en: 'Breast red, hot and painful', sw: 'Titi jekundu, la moto na linauma', codes: ['breast_red_painful'], emergency: false },
  { key: 'urine_problem', en: 'Pain or problems passing urine', sw: 'Maumivu au shida kukojoa', codes: ['urine_problem'], emergency: false },
];

interface Answers {
  physical?: RecoveryCheckinRow['physical'];
  dizzyWeak?: boolean;
  bleeding?: RecoveryCheckinRow['bleeding'];
  pain?: RecoveryCheckinRow['pain'];
  dangers: Danger[];
  noneOfThese?: boolean;
  mood?: RecoveryCheckinRow['mood'];
  sadOrAnxious?: boolean;
  overwhelmed?: boolean;
  supported?: RecoveryCheckinRow['supported'];
  harmThoughts?: boolean;
  sleep?: SleepBand;
  rested?: boolean;
  exhausted?: boolean;
}

export function RecoveryCheckPage() {
  // Her watch plan: the signs Neema asks her about most come first, with the reason.
  const { plan: watchPlan } = useWatchPlan();
  const watchAsk = watchPlan?.ask ?? [];
  const dangersInOrder = useMemo(() => {
    const mine = DANGERS.filter((d) => d.codes.some((c) => watchAsk.includes(c)));
    return [...mine, ...DANGERS.filter((d) => !mine.includes(d))];
  }, [watchAsk]);
  const nav = useNavigate();
  const g = useGuardian();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);

  const [days, setDays] = useState<number>(0);
  const [chp, setChp] = useState<Contact | null>(null);
  const [a, setA] = useState<Answers>({ dangers: [] });
  const [history, setHistory] = useState<Step[]>(['physical']);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const p = await loadProfile().catch(() => null);
      setDays(recoveryProgressOf(p)?.daysSinceBirth ?? 0);
      const contacts = await listContacts();
      setChp(contacts.find((c) => c.role === 'chp' && !isPlaceholderPhone(c.phone)) ?? null);
    })();
  }, []);

  const step = history[history.length - 1]!;
  const askBleeding = days <= 56;
  const askSupport = useMemo(() => days % 3 === 0, [days]);

  function go(next: Step) {
    setHistory((h) => [...h, next]);
    window.scrollTo({ top: 0 });
  }
  function back() {
    if (history.length <= 1) nav('/home');
    else setHistory((h) => h.slice(0, -1));
  }

  function afterPhysical() {
    go(askBleeding ? 'bleeding' : 'danger');
  }
  function afterMood(mood: RecoveryCheckinRow['mood']) {
    setA((x) => ({ ...x, mood }));
    go(mood === 'low' || mood === 'very_low' || askSupport ? 'moodMore' : 'sleep');
  }
  function afterSleep(sleep: SleepBand) {
    const next = { ...a, sleep };
    setA(next);
    if (sleep === '0_2' || sleep === '3_4') go('sleepMore');
    else void finish(next);
  }

  async function finish(final: Answers) {
    setSaving(true);
    const codes = new Set<SymptomCode>();
    for (const d of final.dangers) DANGERS.find((x) => x.key === d)?.codes.forEach((c) => codes.add(c));
    if (final.bleeding === 'soaking') codes.add('heavy_bleeding');
    if (final.bleeding === 'heavier') codes.add('bleeding_heavier');
    if (final.harmThoughts) codes.add('thoughts_of_harm');

    const row: RecoveryCheckinRow = {
      id: `rc_${Date.now().toString(36)}`,
      tsMs: Date.now(),
      dayAfterBirth: days,
      physical: final.physical ?? 'okay',
      mood: final.mood ?? 'okay',
      dangerCodes: [...codes],
      ...(final.sleep ? { sleep: final.sleep } : {}),
      ...(final.bleeding ? { bleeding: final.bleeding } : {}),
      ...(final.pain ? { pain: final.pain } : {}),
      ...(final.rested !== undefined ? { rested: final.rested } : {}),
      ...(final.exhausted !== undefined ? { exhausted: final.exhausted } : {}),
      ...(final.sadOrAnxious !== undefined ? { sadOrAnxious: final.sadOrAnxious } : {}),
      ...(final.overwhelmed !== undefined ? { overwhelmed: final.overwhelmed } : {}),
      ...(final.supported ? { supported: final.supported } : {}),
    };
    try {
      await db.recoveryCheckins.put(row);
      // Danger signs go through the same triage + alert chain as any symptom.
      const r = codes.size ? await g.saveSymptoms([...codes]) : null;
      setResult(r);
    } finally {
      setSaving(false);
      go('result');
    }
  }

  // ── UI helpers ───────────────────────────────────────────────────────────
  const stepsTotal = 5;
  const stepNo = { physical: 1, bleeding: 2, danger: 3, mood: 4, moodMore: 4, sleep: 5, sleepMore: 5, result: 5 }[step];

  const level = result?.level;
  const harm = a.harmThoughts === true;

  return (
    <main className="screen rcq">
      {step !== 'result' ? (
        <nav className="reg-steps" aria-label={tx('Check-in progress', 'Maendeleo ya ukaguzi')}>
          <div className="reg-steps__bar" aria-hidden>
            <span style={{ width: `${(stepNo / stepsTotal) * 100}%` }} />
          </div>
          <p className="reg-steps__count">
            {tx(`Question ${stepNo} of ${stepsTotal}`, `Swali ${stepNo} kati ya ${stepsTotal}`)} · {tx('Daily check-in', 'Ukaguzi wa leo')}
          </p>
        </nav>
      ) : null}

      <section className="reg-card" aria-live="polite">
        {step === 'physical' && (
          <>
            <h1 className="screen-title">{tx('How are you feeling physically today?', 'Unajisikiaje kimwili leo?')}</h1>
            <Choice
              value={a.physical}
              options={[
                ['good', tx('Good', 'Vizuri')],
                ['okay', tx('Okay', 'Sawa')],
                ['unwell', tx('Not well', 'Si vizuri'), tx('Tired, sore, weak or ill', 'Uchovu, maumivu, udhaifu au ugonjwa')],
              ]}
              onPick={(physical) => setA((x) => ({ ...x, physical }))}
            />
            {a.physical === 'unwell' || a.physical === 'okay' ? (
              <>
                <div className="field">
                  <span className="n-label">{tx('Are you in pain?', 'Una maumivu?')}</span>
                  <div className="n-tabs" role="radiogroup" aria-label={tx('Pain', 'Maumivu')} style={{ ['--n-tabs-count' as string]: 3 }}>
                    {(
                      [
                        ['none', tx('No', 'Hapana')],
                        ['mild', tx('A little', 'Kidogo')],
                        ['strong', tx('A lot', 'Sana')],
                      ] as const
                    ).map(([v, l]) => (
                      <button key={v} type="button" className="n-tab" role="radio" aria-checked={a.pain === v} onClick={() => setA((x) => ({ ...x, pain: v }))}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <YesNo yes={tx('Yes', 'Ndiyo')} no={tx('No', 'Hapana')} label={tx('Have you felt dizzy or weak?', 'Umejisikia kizunguzungu au udhaifu?')} value={a.dizzyWeak} onPick={(dizzyWeak) => setA((x) => ({ ...x, dizzyWeak }))} />
              </>
            ) : null}
          </>
        )}

        {step === 'bleeding' && (
          <>
            <h1 className="screen-title">{tx('How is your bleeding today?', 'Damu yako ikoje leo?')}</h1>
            <p className="screen-sub">{tx('Bleeding after birth (lochia) is normal and slowly gets lighter.', 'Damu baada ya kujifungua ni kawaida na hupungua taratibu.')}</p>
            <Choice
              value={a.bleeding}
              options={[
                ['lighter', tx('Getting lighter', 'Inapungua')],
                ['same', tx('About the same', 'Iko vilevile')],
                ['none', tx('No bleeding now', 'Hakuna damu sasa')],
                ['heavier', tx('Heavier again, or bright red again', 'Imeongezeka tena, au nyekundu tena')],
                ['soaking', tx('Soaking a pad in an hour or less, or big clots', 'Inalowesha pedi ndani ya saa moja, au mabonge makubwa'), tx('This is an emergency', 'Hii ni dharura')],
              ]}
              onPick={(bleeding) => setA((x) => ({ ...x, bleeding }))}
            />
          </>
        )}

        {step === 'danger' && (
          <>
            <h1 className="screen-title">{tx('Have you had any of these today?', 'Umepata lolote kati ya haya leo?')}</h1>
            <p className="screen-sub">{tx('Tap all that apply. This keeps you safe.', 'Gusa yote yanayohusika. Hii inakulinda.')}</p>
            {watchPlan && watchPlan.items.length > 0 ? (
              <p className="watch-ask__why">
                {tx('Neema asks you about the first ones especially. ', 'Neema inakuuliza hasa kuhusu ya kwanza. ')}
                {watchPlan.items.map((i) => tx(i.reason.en, i.reason.sw)).join(' ')}
              </p>
            ) : null}
            <div className="chip-grid rcq-dangers">
              {dangersInOrder.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className="chip"
                  data-emergency={d.emergency}
                  aria-pressed={a.dangers.includes(d.key)}
                  onClick={() =>
                    setA((x) => ({
                      ...x,
                      noneOfThese: false,
                      dangers: x.dangers.includes(d.key) ? x.dangers.filter((k) => k !== d.key) : [...x.dangers, d.key],
                    }))
                  }
                >
                  {tx(d.en, d.sw)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="chip rcq-none"
              aria-pressed={a.noneOfThese === true}
              onClick={() => setA((x) => ({ ...x, noneOfThese: !x.noneOfThese, dangers: [] }))}
            >
              {tx('None of these', 'Hakuna kati ya haya')}
            </button>
          </>
        )}

        {step === 'mood' && (
          <>
            <h1 className="screen-title">{tx('How has your mood been today?', 'Hisia zako zimekuwaje leo?')}</h1>
            <Choice
              value={a.mood}
              options={[
                ['good', tx('Good', 'Nzuri')],
                ['okay', tx('Okay', 'Sawa')],
                ['low', tx('Low', 'Chini')],
                ['very_low', tx('Very low', 'Chini sana')],
              ]}
              onPick={(m) => afterMood(m)}
            />
          </>
        )}

        {step === 'moodMore' && (
          <>
            <h1 className="screen-title">{tx('A little more about how you feel', 'Zaidi kidogo kuhusu unavyojisikia')}</h1>
            {a.mood === 'low' || a.mood === 'very_low' ? (
              <>
                <YesNo yes={tx('Yes', 'Ndiyo')} no={tx('No', 'Hapana')} label={tx('Have you been feeling sad or anxious?', 'Umekuwa ukijisikia huzuni au wasiwasi?')} value={a.sadOrAnxious} onPick={(v) => setA((x) => ({ ...x, sadOrAnxious: v }))} />
                <YesNo yes={tx('Yes', 'Ndiyo')} no={tx('No', 'Hapana')} label={tx('Have you felt overwhelmed?', 'Umejisikia kulemewa?')} value={a.overwhelmed} onPick={(v) => setA((x) => ({ ...x, overwhelmed: v }))} />
              </>
            ) : null}
            <div className="field">
              <span className="n-label">{tx('Do you feel you have support from people around you?', 'Unajisikia una msaada kutoka kwa watu wanaokuzunguka?')}</span>
              <div className="n-tabs" role="radiogroup" aria-label={tx('Support', 'Msaada')} style={{ ['--n-tabs-count' as string]: 3 }}>
                {(
                  [
                    ['yes', tx('Yes', 'Ndiyo')],
                    ['some', tx('Some', 'Kiasi')],
                    ['no', tx('No', 'Hapana')],
                  ] as const
                ).map(([v, l]) => (
                  <button key={v} type="button" className="n-tab" role="radio" aria-checked={a.supported === v} onClick={() => setA((x) => ({ ...x, supported: v }))}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {a.mood === 'low' || a.mood === 'very_low' ? (
              <YesNo
                yes={tx('Yes', 'Ndiyo')}
                no={tx('No', 'Hapana')}
                label={tx('Have you had thoughts of harming yourself or your baby?', 'Umekuwa na mawazo ya kujidhuru au kumdhuru mtoto wako?')}
                value={a.harmThoughts}
                onPick={(v) => setA((x) => ({ ...x, harmThoughts: v }))}
              />
            ) : null}
            <p className="n-hint">{tx('Your answers stay on this phone. Many mothers feel this way. You deserve support.', 'Majibu yako yanabaki kwenye simu hii. Mama wengi hujisikia hivi. Unastahili msaada.')}</p>
          </>
        )}

        {step === 'sleep' && (
          <>
            <h1 className="screen-title">{tx('How many hours did you sleep last night, in total?', 'Ulilala saa ngapi usiku uliopita, kwa jumla?')}</h1>
            <Choice
              value={a.sleep}
              options={[
                ['0_2', tx('0 to 2 hours', 'Saa 0 hadi 2')],
                ['3_4', tx('3 to 4 hours', 'Saa 3 hadi 4')],
                ['5_6', tx('5 to 6 hours', 'Saa 5 hadi 6')],
                ['7_plus', tx('7 hours or more', 'Saa 7 au zaidi')],
              ]}
              onPick={(s) => afterSleep(s)}
            />
          </>
        )}

        {step === 'sleepMore' && (
          <>
            <h1 className="screen-title">{tx('About your rest', 'Kuhusu kupumzika kwako')}</h1>
            <YesNo yes={tx('Yes', 'Ndiyo')} no={tx('No', 'Hapana')} label={tx('Do you feel rested?', 'Unajisikia umepumzika?')} value={a.rested} onPick={(v) => setA((x) => ({ ...x, rested: v }))} />
            <YesNo
                yes={tx('Yes', 'Ndiyo')}
                no={tx('No', 'Hapana')}
              label={tx('Are you so exhausted that it is hard to get up or care for your baby?', 'Umechoka kiasi kwamba ni vigumu kuamka au kumtunza mtoto?')}
              value={a.exhausted}
              onPick={(v) => setA((x) => ({ ...x, exhausted: v }))}
            />
          </>
        )}

        {step === 'result' && (
          <div className="rcq-result" data-level={harm ? 'RED' : (level ?? 'OK')}>
            {harm ? (
              <>
                <h1 className="screen-title">{tx('Please talk to someone now', 'Tafadhali zungumza na mtu sasa')}</h1>
                <p>
                  {tx(
                    'Thank you for telling Neema. You are not alone, and this can get better with help. Please reach a person now:',
                    'Asante kwa kumwambia Neema. Hauko peke yako, na hali hii inaweza kuboreka kwa msaada. Tafadhali wasiliana na mtu sasa:',
                  )}
                </p>
                <div className="rcq-actions">
                  <a className="btn btn-danger btn-block" href="tel:1199">
                    {tx('Call 1199 (free, any time)', 'Piga 1199 (bure, wakati wowote)')}
                  </a>
                  {chp ? (
                    <a className="btn btn-primary btn-block" href={`tel:${chp.phone}`}>
                      {tx(`Call your CHP (${chp.name})`, `Mpigie CHP wako (${chp.name})`)}
                    </a>
                  ) : null}
                  <a className="btn btn-secondary btn-block" href="tel:+254722178177">
                    {tx('Befrienders Kenya: 0722 178 177', 'Befrienders Kenya: 0722 178 177')}
                  </a>
                  <a className="btn btn-secondary btn-block" href={EMERGENCY_TEL}>
                    {tx(`In immediate danger: call ${EMERGENCY_NUMBER}`, `Hatari ya sasa hivi: piga ${EMERGENCY_NUMBER}`)}
                  </a>
                </div>
                <p className="n-hint">{tx('A short message asking your CHP to contact you is ready on the alert page. It does not say why.', 'Ujumbe mfupi wa kumwomba CHP akutafute uko tayari kwenye ukurasa wa tahadhari. Hausemi sababu.')}</p>
                <button type="button" className="btn btn-ghost btn-block" onClick={() => nav('/alert')}>
                  {tx('Open the message to my CHP', 'Fungua ujumbe kwa CHP wangu')}
                </button>
              </>
            ) : level === 'RED' ? (
              <>
                <h1 className="screen-title">{tx('Get help now', 'Tafuta msaada sasa')}</h1>
                <p>
                  {tx(
                    `What you reported can be an emergency. Go to a health facility now or call ${EMERGENCY_NUMBER}. Do not wait.`,
                    `Ulichoripoti kinaweza kuwa dharura. Nenda kituo cha afya sasa au piga ${EMERGENCY_NUMBER}. Usisubiri.`,
                  )}
                </p>
                <div className="rcq-actions">
                  <a className="btn btn-danger btn-block" href={EMERGENCY_TEL}>
                    {tx(`Call ${EMERGENCY_NUMBER}`, `Piga ${EMERGENCY_NUMBER}`)}
                  </a>
                  <button type="button" className="btn btn-primary btn-block" onClick={() => nav('/alert')}>
                    {tx('Alert my CHP and see steps', 'Mjulishe CHP wangu na uone hatua')}
                  </button>
                </div>
              </>
            ) : level === 'YELLOW' ? (
              <>
                <h1 className="screen-title">{tx('See a health worker today', 'Muone mhudumu wa afya leo')}</h1>
                <p>{tx('Something you reported needs to be checked today. Contact your CHP or go to the clinic today.', 'Ulichoripoti kinahitaji kuangaliwa leo. Wasiliana na CHP wako au nenda kliniki leo.')}</p>
                <div className="rcq-actions">
                  <button type="button" className="btn btn-primary btn-block" onClick={() => nav('/alert')}>
                    {tx('Message my CHP', 'Mtumie CHP ujumbe')}
                  </button>
                  {chp ? (
                    <a className="btn btn-secondary btn-block" href={`tel:${chp.phone}`}>
                      {tx(`Call ${chp.name}`, `Mpigie ${chp.name}`)}
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <h1 className="screen-title">{tx('Thank you for checking in', 'Asante kwa kujibu')}</h1>
                <p>{tx('Nothing you told Neema today needs urgent care.', 'Hakuna ulichomwambia Neema leo kinachohitaji huduma ya haraka.')}</p>
                <ul className="rcq-tips">
                  {a.sleep === '0_2' || a.sleep === '3_4' ? (
                    <li>{tx('You slept very little. Rest when your baby sleeps, and ask someone to help with chores or a night feed.', 'Ulilala kidogo sana. Pumzika mtoto akilala, na omba mtu akusaidie kazi au kunyonyesha usiku.')}</li>
                  ) : null}
                  {a.exhausted ? (
                    <li>{tx('Exhaustion that makes it hard to care for your baby is worth telling your CHP or nurse about.', 'Uchovu unaokufanya ushindwe kumtunza mtoto unafaa kuelezwa kwa CHP au muuguzi.')}</li>
                  ) : null}
                  {a.dizzyWeak ? (
                    <li>{tx('Feeling dizzy or weak: get up slowly, eat and drink regularly, and tell your CHP if it continues. If you faint, it is an emergency.', 'Kizunguzungu au udhaifu: inuka taratibu, kula na kunywa mara kwa mara, na mwambie CHP kikiendelea. Ukizirai, ni dharura.')}</li>
                  ) : null}
                  {a.mood === 'low' || a.mood === 'very_low' || a.supported === 'no' ? (
                    <li>
                      {tx('Low days are common after birth. If they last more than 2 weeks, please tell your CHP or nurse. A short mood check can help.', 'Siku za huzuni ni kawaida baada ya kujifungua. Zikizidi wiki 2, tafadhali mwambie CHP au muuguzi. Kipimo kifupi cha hisia kinaweza kusaidia.')}{' '}
                      <button type="button" className="n-link" onClick={() => nav('/epds')}>
                        {tx('Take the mood check', 'Fanya kipimo cha hisia')}
                      </button>
                    </li>
                  ) : null}
                  {a.bleeding === 'same' && days > 14 ? (
                    <li>{tx('If bleeding is not getting lighter after the first two weeks, mention it at your next check.', 'Damu isipopungua baada ya wiki mbili za kwanza, itaje kwenye ukaguzi ujao.')}</li>
                  ) : null}
                </ul>
              </>
            )}
            <div className="rcq-actions">
              <button type="button" className="btn btn-secondary btn-block" onClick={() => nav('/care')}>
                {tx('Talk more with Neema (CareChat)', 'Ongea zaidi na Neema (CareChat)')}
              </button>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => nav('/home')}>
                {tx('Back to my recovery', 'Rudi kwenye kupona kwangu')}
              </button>
            </div>
          </div>
        )}
      </section>

      {step !== 'result' ? (
        <div className="reg-actions">
          <button type="button" className="btn btn-secondary" onClick={back} disabled={saving}>
            {tx('Back', 'Rudi')}
          </button>
          {step === 'physical' ? (
            <button type="button" className="btn btn-primary" disabled={!a.physical} onClick={afterPhysical}>
              {tx('Next', 'Endelea')}
            </button>
          ) : step === 'bleeding' ? (
            <button type="button" className="btn btn-primary" disabled={!a.bleeding} onClick={() => go('danger')}>
              {tx('Next', 'Endelea')}
            </button>
          ) : step === 'danger' ? (
            <button type="button" className="btn btn-primary" disabled={!a.dangers.length && !a.noneOfThese} onClick={() => go('mood')}>
              {tx('Next', 'Endelea')}
            </button>
          ) : step === 'moodMore' ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={(a.mood === 'low' || a.mood === 'very_low') && a.harmThoughts === undefined}
              onClick={() => (a.harmThoughts ? void finish(a) : go('sleep'))}
            >
              {tx('Next', 'Endelea')}
            </button>
          ) : step === 'sleepMore' ? (
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void finish(a)}>
              {saving ? tx('Saving…', 'Inahifadhi…') : tx('Finish', 'Maliza')}
            </button>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </main>
  );
}

function Choice<T extends string>({ value, options, onPick }: { value: T | undefined; options: Array<[T, string, string?]>; onPick: (v: T) => void }) {
  return (
    <div className="rcq-choices" role="radiogroup">
      {options.map(([v, label, sub]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className="reg-choice" onClick={() => onPick(v)}>
          <strong>{label}</strong>
          {sub ? <span>{sub}</span> : null}
        </button>
      ))}
    </div>
  );
}

function YesNo({ label, value, onPick, yes, no }: { label: string; value: boolean | undefined; onPick: (v: boolean) => void; yes: string; no: string }) {
  return (
    <div className="field">
      <span className="n-label">{label}</span>
      <div className="n-tabs" role="radiogroup" aria-label={label} style={{ ['--n-tabs-count' as string]: 2 }}>
        <button type="button" className="n-tab" role="radio" aria-checked={value === true} onClick={() => onPick(true)}>
          {yes}
        </button>
        <button type="button" className="n-tab" role="radio" aria-checked={value === false} onClick={() => onPick(false)}>
          {no}
        </button>
      </div>
    </div>
  );
}
