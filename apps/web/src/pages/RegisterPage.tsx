import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  eddFromGestationalAge,
  isPlaceholderPhone,
  isValidGestationalAge,
  normalizePhone,
  parseLocalIsoDate,
  pregnancyProgress,
  toLocalIsoDate,
  type Contact,
} from '@neema/core';
import { Button } from '../ui/Button';
import { BrandMark } from '../ui/BrandMark';
import { LangToggle } from '../ui/LangToggle';
import { useLocale } from '../hooks/useLocale';
import { loadOnboarding, saveOnboarding } from '../hooks/useOnboarding';
import {
  EMPTY_BIRTH_PLAN,
  loadProfile,
  saveConsent,
  saveProfile,
  type MamaProfile,
  type RegistrarRole,
} from '../services/passport';
import { listContacts, saveContact } from '../services/contacts';
import { addClinicalNote } from '../services/clinicalNotes';

/**
 * Multi-step registration. Can be filled by the mother herself, a CHW, or a nurse.
 * Nothing is saved until the last step ("Finish"), after consent.
 */

type StepId = 'who' | 'about' | 'pregnancy' | 'health' | 'contacts' | 'clinical' | 'consent' | 'review';

interface Draft {
  role: RegistrarRole;
  registrarName: string;
  registrarId: string;
  facilityName: string;
  displayName: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  location: string;
  stage: 'pregnancy' | 'postpartum';
  datingMode: 'weeks' | 'due' | 'unknown';
  gaWeeks: string;
  gaDays: string;
  dueDate: string;
  firstPregnancy: '' | 'yes' | 'no';
  previousPregnancies: string;
  pastComplications: string[];
  conditions: string[];
  otherCondition: string;
  allergies: string;
  medications: string;
  healthNotes: string;
  chpName: string;
  chpPhone: string;
  familyName: string;
  familyPhone: string;
  clinicalNote: string;
  shareChp: boolean;
  shareFamily: boolean;
  shareNurse: boolean;
  agreed: boolean;
}

const EMPTY: Draft = {
  role: 'self',
  registrarName: '',
  registrarId: '',
  facilityName: '',
  displayName: '',
  fullName: '',
  dateOfBirth: '',
  phone: '',
  location: '',
  stage: 'pregnancy',
  datingMode: 'weeks',
  gaWeeks: '',
  gaDays: '0',
  dueDate: '',
  firstPregnancy: '',
  previousPregnancies: '',
  pastComplications: [],
  conditions: [],
  otherCondition: '',
  allergies: '',
  medications: '',
  healthNotes: '',
  chpName: '',
  chpPhone: '',
  familyName: '',
  familyPhone: '',
  clinicalNote: '',
  shareChp: true,
  shareFamily: true,
  shareNurse: true,
  agreed: false,
};

const COMPLICATIONS = [
  { key: 'high_bp', en: 'High blood pressure in pregnancy', sw: 'Shinikizo la juu wakati wa mimba' },
  { key: 'bleeding', en: 'Heavy bleeding', sw: 'Kutokwa damu nyingi' },
  { key: 'caesarean', en: 'Caesarean (operation) birth', sw: 'Kujifungua kwa upasuaji' },
  { key: 'early_birth', en: 'Baby born early', sw: 'Mtoto alizaliwa mapema' },
  { key: 'loss', en: 'Pregnancy loss', sw: 'Mimba kuharibika' },
  { key: 'fits', en: 'Fits (convulsions)', sw: 'Degedege' },
] as const;

const CONDITIONS = [
  { key: 'high_bp', en: 'High blood pressure', sw: 'Shinikizo la juu' },
  { key: 'diabetes', en: 'Diabetes (sugar)', sw: 'Kisukari' },
  { key: 'anaemia', en: 'Anaemia (low blood)', sw: 'Upungufu wa damu' },
  { key: 'asthma', en: 'Asthma', sw: 'Pumu' },
  { key: 'heart', en: 'Heart problem', sw: 'Tatizo la moyo' },
] as const;

const DAY = 86_400_000;

function splitList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Age in whole years for an ISO date; null when not a date. */
function ageFrom(iso: string, nowMs: number): number | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.floor((nowMs - ms) / (365.25 * DAY));
}

export function RegisterPage() {
  const nav = useNavigate();
  const { lang } = useLocale();
  const tx = (en: string, sw: string) => (lang === 'sw' ? sw : en);
  const [d, setD] = useState<Draft>(EMPTY);
  const [stepIdx, setStepIdx] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());

  // Prefill from an earlier install so re-registering does not wipe anything.
  useEffect(() => {
    void (async () => {
      const [p, contacts] = await Promise.all([loadProfile().catch(() => null), listContacts()]);
      const chp = contacts.find((c) => c.role === 'chp' && !isPlaceholderPhone(c.phone));
      const fam = contacts.find((c) => c.role === 'family' && !isPlaceholderPhone(c.phone));
      setD((cur) => ({
        ...cur,
        ...(p
          ? {
              displayName: p.displayName ?? '',
              fullName: p.fullName ?? '',
              dateOfBirth: p.dateOfBirth ?? '',
              phone: p.phoneForAlerts ?? '',
              location: p.location ?? '',
              stage: p.stage ?? 'pregnancy',
              dueDate: p.expectedDeliveryDate ?? '',
              datingMode: p.expectedDeliveryDate && p.gaWeeks === undefined ? 'due' : 'weeks',
            }
          : {}),
        ...(chp ? { chpName: chp.name, chpPhone: chp.phone } : {}),
        ...(fam ? { familyName: fam.name, familyPhone: fam.phone } : {}),
      }));
    })();
  }, []);

  const self = d.role === 'self';
  /** "your" when she registers herself, "her" / "the mother's" when a health worker does. */
  const yourName = self ? tx('Your name', 'Jina lako') : tx("Mother's name", 'Jina la mama');

  const steps: StepId[] = useMemo(
    () =>
      ['who', 'about', 'pregnancy', 'health', 'contacts', ...(d.role === 'nurse' ? (['clinical'] as const) : []), 'consent', 'review'] as StepId[],
    [d.role],
  );
  const step = steps[Math.min(stepIdx, steps.length - 1)]!;

  const stepLabels: Record<StepId, string> = {
    who: tx('Who', 'Nani'),
    about: tx('About', 'Kuhusu'),
    pregnancy: tx('Pregnancy', 'Mimba'),
    health: tx('Health', 'Afya'),
    contacts: tx('Contacts', 'Watu'),
    clinical: tx('Nurse', 'Muuguzi'),
    consent: tx('Consent', 'Idhini'),
    review: tx('Review', 'Hakiki'),
  };

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setD((cur) => ({ ...cur, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }

  function toggleIn(key: 'pastComplications' | 'conditions', item: string) {
    const list = d[key];
    set(key, list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  // ── Validation ──────────────────────────────────────────────────────────
  function validate(s: StepId): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 'who' && !self && !d.registrarName.trim()) {
      e.registrarName = tx('Enter your name so the record shows who registered her.', 'Andika jina lako ili ijulikane nani alimsajili.');
    }
    if (s === 'about') {
      if (!d.displayName.trim()) e.displayName = tx('Please enter a name.', 'Tafadhali andika jina.');
      if (d.dateOfBirth) {
        const age = ageFrom(d.dateOfBirth, nowMs);
        if (age === null || age < 10 || age > 60) e.dateOfBirth = tx('Check the date of birth.', 'Angalia tarehe ya kuzaliwa.');
      }
      if (d.phone.trim()) {
        const n = normalizePhone(d.phone);
        if (!n || isPlaceholderPhone(n)) e.phone = tx('This does not look like a phone number. Example: 0712 345 678', 'Hii si namba sahihi. Mfano: 0712 345 678');
      }
    }
    if (s === 'pregnancy' && d.stage === 'pregnancy') {
      if (d.datingMode === 'weeks') {
        const w = Number(d.gaWeeks);
        const dd = Number(d.gaDays || '0');
        if (d.gaWeeks === '' || !isValidGestationalAge(w, dd) || w < 1 || w > 42) {
          e.gaWeeks = tx('Enter weeks between 1 and 42, and days 0 to 6.', 'Andika wiki kati ya 1 na 42, na siku 0 hadi 6.');
        }
      }
      if (d.datingMode === 'due') {
        const ms = (parseLocalIsoDate(d.dueDate) ?? NaN);
        const prog = Number.isFinite(ms) ? pregnancyProgress({ kind: 'edd', eddMs: ms }, nowMs) : null;
        if (!prog) e.dueDate = tx('That due date does not fit a current pregnancy. Check it with the clinic card.', 'Tarehe hiyo haiendani na mimba ya sasa. Angalia kadi ya kliniki.');
      }
      if (!d.firstPregnancy) e.firstPregnancy = tx('Please choose one.', 'Tafadhali chagua moja.');
      if (d.firstPregnancy === 'no') {
        const n = Number(d.previousPregnancies);
        if (d.previousPregnancies !== '' && (!Number.isInteger(n) || n < 1 || n > 20)) {
          e.previousPregnancies = tx('Enter a number from 1 to 20.', 'Andika namba kutoka 1 hadi 20.');
        }
      }
    }
    if (s === 'contacts') {
      const checkPhone = (key: 'chpPhone' | 'familyPhone', nameKey: 'chpName' | 'familyName') => {
        if (!d[key].trim() && !d[nameKey].trim()) return;
        if (!d[nameKey].trim()) e[nameKey] = tx('Add a name.', 'Ongeza jina.');
        const n = normalizePhone(d[key]);
        if (!n || isPlaceholderPhone(n)) e[key] = tx('Enter a real phone number. Example: 0712 345 678', 'Andika namba halisi. Mfano: 0712 345 678');
      };
      checkPhone('chpPhone', 'chpName');
      checkPhone('familyPhone', 'familyName');
    }
    if (s === 'clinical' && d.clinicalNote.trim() && !d.registrarName.trim()) {
      e.clinicalNote = tx('Go back to step 1 and add your name: notes must show who wrote them.', 'Rudi hatua ya 1 uweke jina lako: maelezo lazima yaonyeshe aliyeandika.');
    }
    if (s === 'consent') {
      if (!d.agreed) e.agreed = tx('Please read and agree to continue.', 'Tafadhali soma na ukubali ili kuendelea.');
      if (!d.shareChp && !d.shareFamily) e.shareChp = tx('Choose at least one person who may get an alert.', 'Chagua angalau mtu mmoja wa kupokea tahadhari.');
    }
    return e;
  }

  function next() {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) {
      // Move focus to the first problem so screen readers and small screens see it.
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
    window.scrollTo({ top: 0 });
  }

  function back() {
    setErrors({});
    if (stepIdx === 0) nav('/orient');
    else setStepIdx((i) => i - 1);
    window.scrollTo({ top: 0 });
  }

  function goTo(s: StepId) {
    const i = steps.indexOf(s);
    if (i >= 0) setStepIdx(i);
    window.scrollTo({ top: 0 });
  }

  // ── Derived pregnancy summary ───────────────────────────────────────────
  const progress = useMemo(() => {
    if (d.stage !== 'pregnancy') return null;
    if (d.datingMode === 'weeks' && d.gaWeeks !== '' && isValidGestationalAge(Number(d.gaWeeks), Number(d.gaDays || 0))) {
      return pregnancyProgress({ kind: 'ga', weeks: Number(d.gaWeeks), days: Number(d.gaDays || 0), recordedOnMs: nowMs }, nowMs);
    }
    if (d.datingMode === 'due' && d.dueDate) {
      const ms = (parseLocalIsoDate(d.dueDate) ?? NaN);
      return Number.isFinite(ms) ? pregnancyProgress({ kind: 'edd', eddMs: ms }, nowMs) : null;
    }
    return null;
  }, [d.stage, d.datingMode, d.gaWeeks, d.gaDays, d.dueDate, nowMs]);

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(lang === 'sw' ? 'sw-KE' : 'en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Save ────────────────────────────────────────────────────────────────
  async function finish() {
    for (const s of steps) {
      const e = validate(s);
      if (Object.keys(e).length) {
        setErrors(e);
        goTo(s);
        return;
      }
    }
    setBusy(true);
    setSaveError(null);
    try {
      const existing = await loadProfile().catch(() => null);
      const conditions = [...d.conditions, ...(d.otherCondition.trim() ? [d.otherCondition.trim()] : [])];
      const profile: MamaProfile = {
        ...(existing ?? {}),
        displayName: d.displayName.trim(),
        language: lang,
        stage: d.stage,
        birthPlan: existing?.birthPlan ?? { ...EMPTY_BIRTH_PLAN },
        registeredAtMs: Date.now(),
        registeredBy: {
          role: d.role,
          ...(d.registrarName.trim() ? { name: d.registrarName.trim() } : {}),
          ...(d.registrarId.trim() ? { staffId: d.registrarId.trim() } : {}),
        },
      };
      const opt = <K extends keyof MamaProfile>(k: K, v: MamaProfile[K] | undefined | '') => {
        if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete profile[k];
        else profile[k] = v as MamaProfile[K];
      };
      opt('fullName', d.fullName.trim());
      opt('dateOfBirth', d.dateOfBirth);
      opt('phoneForAlerts', d.phone.trim() ? normalizePhone(d.phone) ?? undefined : undefined);
      opt('location', d.location.trim());
      opt('facilityName', d.facilityName.trim());
      opt('nurseName', d.role === 'nurse' ? d.registrarName.trim() : existing?.nurseName);
      opt('pastComplications', d.firstPregnancy === 'no' ? d.pastComplications : []);
      opt('conditions', conditions);
      opt('allergies', splitList(d.allergies));
      opt('medications', splitList(d.medications));
      opt('healthNotes', d.healthNotes.trim());

      if (d.stage === 'pregnancy') {
        profile.firstPregnancy = d.firstPregnancy === 'yes';
        opt('previousPregnancies', d.firstPregnancy === 'no' && d.previousPregnancies !== '' ? Number(d.previousPregnancies) : undefined);
        if (d.datingMode === 'weeks') {
          const recorded = Date.now();
          profile.gaWeeks = Number(d.gaWeeks);
          profile.gaDays = Number(d.gaDays || 0);
          profile.gaRecordedOnMs = recorded;
          profile.gestationWeeks = profile.gaWeeks;
          profile.expectedDeliveryDate = toLocalIsoDate(eddFromGestationalAge(profile.gaWeeks, profile.gaDays, recorded));
        } else {
          delete profile.gaWeeks;
          delete profile.gaDays;
          delete profile.gaRecordedOnMs;
          opt('expectedDeliveryDate', d.datingMode === 'due' ? d.dueDate : undefined);
          if (d.datingMode === 'due' && progress) profile.gestationWeeks = progress.weeks;
          else delete profile.gestationWeeks;
        }
      }

      await saveProfile(profile);

      // Contacts: update the existing CHP / family entry, or add new ones.
      const contacts = await listContacts();
      let order = Math.max(0, ...contacts.map((c) => c.escalationOrder));
      const upsert = async (role: Contact['role'], name: string, phone: string) => {
        if (!name.trim() || !phone.trim()) return;
        const normalized = normalizePhone(phone)!;
        const current = contacts.find((c) => c.role === role);
        await saveContact({
          id: current?.id ?? `c_${role}_${Date.now().toString(36)}`,
          name: name.trim(),
          role,
          phone: normalized,
          escalationOrder: current?.escalationOrder ?? ++order,
        });
      };
      await upsert('chp', d.chpName, d.chpPhone);
      await upsert('family', d.familyName, d.familyPhone);

      await saveConsent({
        version: 'consent-sw-v2',
        language: lang,
        agreedAtMs: Date.now(),
        sharing: { chp: d.shareChp, family: d.shareFamily, nurse: d.shareNurse },
      });

      if (d.role === 'nurse' && d.clinicalNote.trim()) {
        await addClinicalNote({
          authorRole: 'nurse',
          authorName: d.registrarName,
          text: d.clinicalNote,
          ...(d.facilityName.trim() ? { facilityName: d.facilityName } : {}),
        });
      }

      saveOnboarding({ ...loadOnboarding(), orientationDone: true, consentDone: true, registrationDone: true });
      nav('/unlock', { replace: true });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // ── Small field helpers ─────────────────────────────────────────────────
  const err = (k: string) =>
    errors[k] ? (
      <p className="field-error" id={`err-${k}`} role="alert">
        {errors[k]}
      </p>
    ) : null;
  const aria = (k: string) =>
    errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `err-${k}` } : {};
  const why = (en: string, sw: string) => (
    <p className="reg-why">
      <span aria-hidden>ⓘ</span> {tx(en, sw)}
    </p>
  );
  const optional = <span className="reg-optional">{tx('optional', 'si lazima')}</span>;

  const pct = Math.round(((stepIdx + 1) / steps.length) * 100);

  return (
    <main className="screen reg">
      <div className="reg__top">
        <BrandMark />
        <LangToggle />
      </div>

      <nav className="reg-steps" aria-label={tx('Registration steps', 'Hatua za usajili')}>
        <div className="reg-steps__bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="reg-steps__count">
          {tx(`Step ${stepIdx + 1} of ${steps.length}`, `Hatua ${stepIdx + 1} kati ya ${steps.length}`)} ·{' '}
          <strong>{stepLabels[step]}</strong>
        </p>
        <ol className="reg-steps__dots">
          {steps.map((s, i) => (
            <li key={s} data-state={i < stepIdx ? 'done' : i === stepIdx ? 'now' : 'todo'} aria-current={i === stepIdx ? 'step' : undefined}>
              <span className="sr-only">{stepLabels[s]}</span>
            </li>
          ))}
        </ol>
      </nav>

      <section className="reg-card" aria-live="polite">
        {step === 'who' && (
          <>
            <h1 className="screen-title">{tx('Who is filling this in?', 'Nani anajaza fomu hii?')}</h1>
            <p className="screen-sub">{tx('A mother can register herself, or a CHW or nurse can help.', 'Mama anaweza kujisajili, au CHW au muuguzi akasaidia.')}</p>
            <div className="reg-choices" role="radiogroup">
              {(
                [
                  ['self', tx("I'm the mother", 'Mimi ni mama'), tx('Registering myself', 'Najisajili mwenyewe')],
                  ['chw', tx("I'm a CHW / CHP", 'Mimi ni CHW / CHP'), tx('Helping a mother in my area', 'Namsaidia mama wa eneo langu')],
                  ['nurse', tx("I'm a nurse / midwife", 'Mimi ni muuguzi / mkunga'), tx('Registering at the clinic', 'Nasajili kliniki')],
                ] as const
              ).map(([role, label, sub]) => (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={d.role === role}
                  className="reg-choice"
                  onClick={() => set('role', role)}
                >
                  <strong>{label}</strong>
                  <span>{sub}</span>
                </button>
              ))}
            </div>
            {!self && (
              <>
                <div className="field">
                  <label htmlFor="reg-registrar">{tx('Your name', 'Jina lako')}</label>
                  <input id="reg-registrar" value={d.registrarName} onChange={(e) => set('registrarName', e.target.value)} autoComplete="name" {...aria('registrarName')} />
                  {err('registrarName')}
                </div>
                <div className="field">
                  <label htmlFor="reg-staffid">
                    {d.role === 'nurse' ? tx('Staff number', 'Namba ya mfanyakazi') : tx('CHW number', 'Namba ya CHW')} {optional}
                  </label>
                  <input id="reg-staffid" value={d.registrarId} onChange={(e) => set('registrarId', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="reg-facility">
                    {tx('Clinic / link facility', 'Kliniki / kituo cha afya')} {optional}
                  </label>
                  <input id="reg-facility" value={d.facilityName} onChange={(e) => set('facilityName', e.target.value)} />
                </div>
              </>
            )}
          </>
        )}

        {step === 'about' && (
          <>
            <h1 className="screen-title">{self ? tx('About you', 'Kuhusu wewe') : tx('About the mother', 'Kuhusu mama')}</h1>
            <div className="field">
              <label htmlFor="reg-display">{self ? tx('What should Neema call you?', 'Neema akuite nani?') : tx('What should Neema call her?', 'Neema amwite nani?')}</label>
              <input id="reg-display" value={d.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder={tx('e.g. Mama Wanjiru', 'mfano: Mama Wanjiru')} {...aria('displayName')} />
              {err('displayName')}
            </div>
            <div className="field">
              <label htmlFor="reg-full">
                {yourName} ({tx('full, as on clinic card', 'kamili, kama kwenye kadi')}) {optional}
              </label>
              <input id="reg-full" value={d.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="reg-dob">
                {tx('Date of birth', 'Tarehe ya kuzaliwa')} {optional}
              </label>
              <input id="reg-dob" type="date" value={d.dateOfBirth} max={toLocalIsoDate(nowMs)} onChange={(e) => set('dateOfBirth', e.target.value)} {...aria('dateOfBirth')} />
              {err('dateOfBirth')}
              {why('Age helps the nurse read your results. It is not shared in alerts.', 'Umri humsaidia muuguzi kuelewa vipimo. Hautumwi kwenye tahadhari.')}
            </div>
            <div className="field">
              <label htmlFor="reg-phone">
                {tx('Phone number', 'Namba ya simu')} {optional}
              </label>
              <input id="reg-phone" type="tel" inputMode="tel" value={d.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0712 345 678" autoComplete="tel" {...aria('phone')} />
              {err('phone')}
              {why('So your CHP can call you back after an alert.', 'Ili CHP wako akupigie baada ya tahadhari.')}
            </div>
            <div className="field">
              <label htmlFor="reg-loc">
                {tx('Village / estate', 'Kijiji / mtaa')} {optional}
              </label>
              <input id="reg-loc" value={d.location} onChange={(e) => set('location', e.target.value)} autoComplete="address-level2" />
              {why('Helps your CHP find you quickly.', 'Humsaidia CHP kukupata haraka.')}
            </div>
          </>
        )}

        {step === 'pregnancy' && (
          <>
            <h1 className="screen-title">{tx('Pregnancy', 'Mimba')}</h1>
            <div className="reg-seg" role="radiogroup" aria-label={tx('Stage', 'Hatua')}>
              <button type="button" role="radio" aria-checked={d.stage === 'pregnancy'} onClick={() => set('stage', 'pregnancy')}>
                {tx('Pregnant now', 'Mjamzito sasa')}
              </button>
              <button type="button" role="radio" aria-checked={d.stage === 'postpartum'} onClick={() => set('stage', 'postpartum')}>
                {tx('Gave birth recently', 'Amejifungua karibuni')}
              </button>
            </div>

            {d.stage === 'pregnancy' && (
              <>
                <p className="reg-label">{tx('How far along?', 'Mimba ina muda gani?')}</p>
                <div className="reg-seg reg-seg--3" role="radiogroup">
                  {(
                    [
                      ['weeks', tx('Weeks', 'Wiki')],
                      ['due', tx('Due date', 'Tarehe ya kujifungua')],
                      ['unknown', tx("Don't know", 'Sijui')],
                    ] as const
                  ).map(([mode, label]) => (
                    <button key={mode} type="button" role="radio" aria-checked={d.datingMode === mode} onClick={() => set('datingMode', mode)}>
                      {label}
                    </button>
                  ))}
                </div>
                {d.datingMode === 'weeks' && (
                  <div className="reg-ga">
                    <div className="field">
                      <label htmlFor="reg-gaw">{tx('Weeks', 'Wiki')}</label>
                      <input id="reg-gaw" type="number" inputMode="numeric" min={1} max={42} value={d.gaWeeks} onChange={(e) => set('gaWeeks', e.target.value)} {...aria('gaWeeks')} />
                    </div>
                    <div className="field">
                      <label htmlFor="reg-gad">{tx('Days', 'Siku')}</label>
                      <select id="reg-gad" value={d.gaDays} onChange={(e) => set('gaDays', e.target.value)}>
                        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {err('gaWeeks')}
                {d.datingMode === 'due' && (
                  <div className="field">
                    <label htmlFor="reg-due">{tx('Due date (from clinic card)', 'Tarehe ya kujifungua (kadi ya kliniki)')}</label>
                    <input id="reg-due" type="date" value={d.dueDate} onChange={(e) => set('dueDate', e.target.value)} {...aria('dueDate')} />
                    {err('dueDate')}
                  </div>
                )}
                {d.datingMode === 'unknown' && (
                  <p className="soft-note">
                    {tx(
                      'That is okay. Ask at your next clinic visit and add it in Profile. Neema will still watch your readings.',
                      'Sawa. Uliza kliniki ijayo kisha uiongeze kwenye Wasifu. Neema bado ataangalia vipimo vyako.',
                    )}
                  </p>
                )}
                {progress && (
                  <p className="reg-calc">
                    {tx(
                      `Today: ${progress.weeks} weeks ${progress.days} days · trimester ${progress.trimester} · due around ${fmtDate(progress.eddMs)}`,
                      `Leo: wiki ${progress.weeks} siku ${progress.days} · kipindi ${progress.trimester} · kujifungua karibu ${fmtDate(progress.eddMs)}`,
                    )}
                  </p>
                )}
                {why('Neema uses this to show the right advice each week. It moves forward by itself.', 'Neema hutumia hii kuonyesha ushauri sahihi kila wiki. Husonga mbele yenyewe.')}

                <p className="reg-label">{tx('Is this the first pregnancy?', 'Hii ni mimba ya kwanza?')}</p>
                <div className="reg-seg" role="radiogroup" {...aria('firstPregnancy')} tabIndex={errors.firstPregnancy ? -1 : undefined}>
                  <button type="button" role="radio" aria-checked={d.firstPregnancy === 'yes'} onClick={() => set('firstPregnancy', 'yes')}>
                    {tx('Yes', 'Ndiyo')}
                  </button>
                  <button type="button" role="radio" aria-checked={d.firstPregnancy === 'no'} onClick={() => set('firstPregnancy', 'no')}>
                    {tx('No', 'Hapana')}
                  </button>
                </div>
                {err('firstPregnancy')}
                {d.firstPregnancy === 'no' && (
                  <>
                    <div className="field" style={{ marginTop: '0.8rem' }}>
                      <label htmlFor="reg-prev">
                        {tx('How many pregnancies before?', 'Mimba ngapi kabla?')} {optional}
                      </label>
                      <input id="reg-prev" type="number" inputMode="numeric" min={1} max={20} value={d.previousPregnancies} onChange={(e) => set('previousPregnancies', e.target.value)} {...aria('previousPregnancies')} />
                      {err('previousPregnancies')}
                    </div>
                    <p className="reg-label">
                      {tx('Any of these in past pregnancies?', 'Yoyote kati ya haya kwenye mimba zilizopita?')} {optional}
                    </p>
                    <div className="chip-grid">
                      {COMPLICATIONS.map((c) => (
                        <button key={c.key} type="button" className="chip" aria-pressed={d.pastComplications.includes(c.key)} onClick={() => toggleIn('pastComplications', c.key)}>
                          {tx(c.en, c.sw)}
                        </button>
                      ))}
                    </div>
                    {why('Past problems help the nurse plan your care. They do not change your alerts.', 'Matatizo ya zamani humsaidia muuguzi kupanga huduma. Hayabadilishi tahadhari.')}
                  </>
                )}
              </>
            )}
          </>
        )}

        {step === 'health' && (
          <>
            <h1 className="screen-title">{tx('Health notes', 'Maelezo ya afya')}</h1>
            <p className="screen-sub">{tx('All optional. Skip anything you are not sure about.', 'Yote si lazima. Ruka usichokuwa na uhakika nacho.')}</p>
            <p className="reg-label">{tx('Ongoing conditions', 'Magonjwa ya muda mrefu')}</p>
            <div className="chip-grid">
              {CONDITIONS.map((c) => (
                <button key={c.key} type="button" className="chip" aria-pressed={d.conditions.includes(c.key)} onClick={() => toggleIn('conditions', c.key)}>
                  {tx(c.en, c.sw)}
                </button>
              ))}
            </div>
            <div className="field" style={{ marginTop: '0.8rem' }}>
              <label htmlFor="reg-other">{tx('Other condition', 'Ugonjwa mwingine')}</label>
              <input id="reg-other" value={d.otherCondition} onChange={(e) => set('otherCondition', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="reg-allergy">{tx('Allergies (separate with commas)', 'Mzio (tenganisha kwa koma)')}</label>
              <input id="reg-allergy" value={d.allergies} onChange={(e) => set('allergies', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="reg-meds">{tx('Medicines taken now', 'Dawa unazotumia sasa')}</label>
              <input id="reg-meds" value={d.medications} onChange={(e) => set('medications', e.target.value)} placeholder={tx('e.g. iron, folic acid', 'mfano: madini ya chuma, foliki')} />
            </div>
            <div className="field">
              <label htmlFor="reg-notes">{self ? tx('Anything else you want your nurse to know', 'Lolote unalotaka muuguzi ajue') : tx("Mother's own notes", 'Maelezo ya mama mwenyewe')}</label>
              <textarea id="reg-notes" rows={3} value={d.healthNotes} onChange={(e) => set('healthNotes', e.target.value)} />
            </div>
            {why('This shows on the nurse summary at clinic visits. It stays on this phone.', 'Huonekana kwenye muhtasari wa muuguzi kliniki. Hubaki kwenye simu hii.')}
          </>
        )}

        {step === 'contacts' && (
          <>
            <h1 className="screen-title">{tx('Who should Neema alert?', 'Neema amjulishe nani?')}</h1>
            <p className="screen-sub">{tx('When readings look dangerous, Neema sends an SMS to these people.', 'Vipimo vikionyesha hatari, Neema hutuma SMS kwa watu hawa.')}</p>
            <fieldset className="reg-group">
              <legend>{tx('Community health promoter (CHP)', 'Mhudumu wa afya ya jamii (CHP)')}</legend>
              <div className="field">
                <label htmlFor="reg-chpn">{tx('Name', 'Jina')}</label>
                <input id="reg-chpn" value={d.chpName} onChange={(e) => set('chpName', e.target.value)} {...aria('chpName')} />
                {err('chpName')}
              </div>
              <div className="field">
                <label htmlFor="reg-chpp">{tx('Phone', 'Simu')}</label>
                <input id="reg-chpp" type="tel" inputMode="tel" value={d.chpPhone} onChange={(e) => set('chpPhone', e.target.value)} placeholder="0712 345 678" {...aria('chpPhone')} />
                {err('chpPhone')}
              </div>
            </fieldset>
            <fieldset className="reg-group">
              <legend>
                {tx('Family member', 'Mwanafamilia')} {optional}
              </legend>
              <div className="field">
                <label htmlFor="reg-famn">{tx('Name', 'Jina')}</label>
                <input id="reg-famn" value={d.familyName} onChange={(e) => set('familyName', e.target.value)} {...aria('familyName')} />
                {err('familyName')}
              </div>
              <div className="field">
                <label htmlFor="reg-famp">{tx('Phone', 'Simu')}</label>
                <input id="reg-famp" type="tel" inputMode="tel" value={d.familyPhone} onChange={(e) => set('familyPhone', e.target.value)} placeholder="0712 345 678" {...aria('familyPhone')} />
                {err('familyPhone')}
              </div>
            </fieldset>
            {!d.chpPhone.trim() && (
              <p className="soft-note reg-warn" role="status">
                {tx(
                  'Without a CHP number, alerts reach nobody. You can add it later in Profile, but please add it soon.',
                  'Bila namba ya CHP, tahadhari haimfikii mtu. Unaweza kuiongeza baadaye kwenye Wasifu, lakini tafadhali iongeze mapema.',
                )}
              </p>
            )}
          </>
        )}

        {step === 'clinical' && (
          <>
            <h1 className="screen-title">{tx('Clinical notes', 'Maelezo ya kitabibu')}</h1>
            <p className="screen-sub">
              {tx(
                'For the nurse only. The mother can read these notes but cannot change them. They are kept apart from her own notes.',
                'Kwa muuguzi tu. Mama anaweza kusoma maelezo haya lakini hawezi kuyabadilisha. Yanawekwa mbali na maelezo yake.',
              )}
            </p>
            <div className="field">
              <label htmlFor="reg-clin">
                {tx('Note', 'Maelezo')} {optional}
              </label>
              <textarea id="reg-clin" rows={5} value={d.clinicalNote} onChange={(e) => set('clinicalNote', e.target.value)} {...aria('clinicalNote')} />
              {err('clinicalNote')}
            </div>
            <p className="reg-why">
              {tx(`Signed as: ${d.registrarName || '—'} (nurse)`, `Imesainiwa na: ${d.registrarName || '—'} (muuguzi)`)}
            </p>
          </>
        )}

        {step === 'consent' && (
          <>
            <h1 className="screen-title">{tx('Privacy and consent', 'Faragha na idhini')}</h1>
            <ul className="reg-facts">
              <li>{tx('Everything is saved on this phone only. There is no online account.', 'Kila kitu kinahifadhiwa kwenye simu hii tu. Hakuna akaunti ya mtandaoni.')}</li>
              <li>{tx('When readings look dangerous, a short SMS goes to the people chosen below.', 'Vipimo vikionyesha hatari, SMS fupi hutumwa kwa watu uliowachagua hapa chini.')}</li>
              <li>{tx('If you use voice or chat, those words are sent online to be answered. Readings are not.', 'Ukitumia sauti au gumzo, maneno hayo hutumwa mtandaoni kujibiwa. Vipimo havitumwi.')}</li>
              <li>{tx('Neema does not diagnose. Your nurse and CHP make care decisions.', 'Neema hatambui ugonjwa. Muuguzi na CHP ndio huamua huduma.')}</li>
              <li>{tx('You can change these choices or delete your data in Profile.', 'Unaweza kubadilisha haya au kufuta data yako kwenye Wasifu.')}</li>
            </ul>
            <p className="reg-label">{tx('Who may receive an alert?', 'Nani apokee tahadhari?')}</p>
            <div className="panel">
              {(
                [
                  ['shareChp', tx('Community health promoter (CHP)', 'Mhudumu wa afya ya jamii (CHP)')],
                  ['shareFamily', tx('Family contact', 'Mwanafamilia')],
                  ['shareNurse', tx('Nurse at clinic visits (summary QR)', 'Muuguzi kliniki (QR ya muhtasari)')],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="row-divided">
                  <input type="checkbox" checked={d[key]} onChange={(e) => set(key, e.target.checked)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {err('shareChp')}
            <label className="reg-agree">
              <input type="checkbox" checked={d.agreed} onChange={(e) => set('agreed', e.target.checked)} {...aria('agreed')} />
              <span>
                {self
                  ? tx('I have read this and I agree.', 'Nimesoma haya na ninakubali.')
                  : tx('I explained this to the mother and she agrees.', 'Nimemweleza mama haya na amekubali.')}
              </span>
            </label>
            {err('agreed')}
          </>
        )}

        {step === 'review' && (
          <>
            <h1 className="screen-title">{tx('Check and finish', 'Hakiki na umalize')}</h1>
            <p className="screen-sub">{tx('Tap Edit to fix anything.', 'Gusa Badilisha kurekebisha.')}</p>
            <ReviewBlock title={stepLabels.about} onEdit={() => goTo('about')} editLabel={tx('Edit', 'Badilisha')}>
              <Row k={tx('Name', 'Jina')} v={[d.displayName, d.fullName && `(${d.fullName})`].filter(Boolean).join(' ')} />
              <Row k={tx('Born', 'Alizaliwa')} v={d.dateOfBirth} />
              <Row k={tx('Phone', 'Simu')} v={d.phone ? normalizePhone(d.phone) ?? d.phone : ''} />
              <Row k={tx('Place', 'Mahali')} v={d.location} />
            </ReviewBlock>
            <ReviewBlock title={stepLabels.pregnancy} onEdit={() => goTo('pregnancy')} editLabel={tx('Edit', 'Badilisha')}>
              {d.stage === 'postpartum' ? (
                <Row k={tx('Stage', 'Hatua')} v={tx('Gave birth recently', 'Amejifungua karibuni')} />
              ) : (
                <>
                  <Row
                    k={tx('Today', 'Leo')}
                    v={progress ? tx(`${progress.weeks} w ${progress.days} d · trimester ${progress.trimester}`, `wiki ${progress.weeks} siku ${progress.days} · kipindi ${progress.trimester}`) : tx('Not known yet', 'Bado haijulikani')}
                  />
                  <Row k={tx('Due', 'Kujifungua')} v={progress ? fmtDate(progress.eddMs) : ''} />
                  <Row k={tx('First pregnancy', 'Mimba ya kwanza')} v={d.firstPregnancy === 'yes' ? tx('Yes', 'Ndiyo') : d.firstPregnancy === 'no' ? tx('No', 'Hapana') : ''} />
                  <Row
                    k={tx('Past problems', 'Matatizo ya zamani')}
                    v={d.firstPregnancy === 'no' ? d.pastComplications.map((k) => COMPLICATIONS.find((c) => c.key === k)).filter(Boolean).map((c) => tx(c!.en, c!.sw)).join(', ') : ''}
                  />
                </>
              )}
            </ReviewBlock>
            <ReviewBlock title={stepLabels.health} onEdit={() => goTo('health')} editLabel={tx('Edit', 'Badilisha')}>
              <Row
                k={tx('Conditions', 'Magonjwa')}
                v={[...d.conditions.map((k) => CONDITIONS.find((c) => c.key === k)).filter(Boolean).map((c) => tx(c!.en, c!.sw)), d.otherCondition.trim()].filter(Boolean).join(', ')}
              />
              <Row k={tx('Allergies', 'Mzio')} v={d.allergies} />
              <Row k={tx('Medicines', 'Dawa')} v={d.medications} />
              <Row k={tx('Notes', 'Maelezo')} v={d.healthNotes} />
              {!d.conditions.length && !d.otherCondition.trim() && !d.allergies.trim() && !d.medications.trim() && !d.healthNotes.trim() && (
                <Row k="—" v={tx('Nothing added', 'Hakuna kilichoongezwa')} />
              )}
            </ReviewBlock>
            <ReviewBlock title={stepLabels.contacts} onEdit={() => goTo('contacts')} editLabel={tx('Edit', 'Badilisha')}>
              <Row k="CHP" v={d.chpName ? `${d.chpName} · ${normalizePhone(d.chpPhone) ?? d.chpPhone}` : ''} warn={!d.chpPhone.trim() ? tx('Missing: alerts will reach nobody', 'Haipo: tahadhari haitamfikia mtu') : undefined} />
              <Row k={tx('Family', 'Familia')} v={d.familyName ? `${d.familyName} · ${normalizePhone(d.familyPhone) ?? d.familyPhone}` : ''} />
            </ReviewBlock>
            {d.role === 'nurse' && (
              <ReviewBlock title={stepLabels.clinical} onEdit={() => goTo('clinical')} editLabel={tx('Edit', 'Badilisha')}>
                <Row k={tx('Note', 'Maelezo')} v={d.clinicalNote} />
              </ReviewBlock>
            )}
            <ReviewBlock title={stepLabels.who} onEdit={() => goTo('who')} editLabel={tx('Edit', 'Badilisha')}>
              <Row
                k={tx('Registered by', 'Amesajiliwa na')}
                v={self ? tx('The mother herself', 'Mama mwenyewe') : `${d.registrarName} (${d.role === 'nurse' ? tx('nurse', 'muuguzi') : 'CHW'})`}
              />
            </ReviewBlock>
            {saveError && (
              <p className="field-error" role="alert">
                {tx('Could not save: ', 'Imeshindwa kuhifadhi: ')}
                {saveError}
              </p>
            )}
            <p className="reg-why">{tx('Next you will choose a PIN to lock the app.', 'Kisha utachagua PIN ya kufunga programu.')}</p>
          </>
        )}
      </section>

      <div className="reg-actions">
        <Button variant="ghost" onClick={back} disabled={busy}>
          {tx('Back', 'Rudi')}
        </Button>
        {step === 'review' ? (
          <Button variant="primary" onClick={() => void finish()} disabled={busy}>
            {busy ? tx('Saving…', 'Inahifadhi…') : tx('Finish', 'Maliza')}
          </Button>
        ) : (
          <Button variant="primary" onClick={next}>
            {step === 'health' || step === 'clinical' ? tx('Next (or skip)', 'Endelea (au ruka)') : tx('Next', 'Endelea')}
          </Button>
        )}
      </div>
    </main>
  );
}

function ReviewBlock({ title, onEdit, editLabel, children }: { title: string; onEdit: () => void; editLabel: string; children: React.ReactNode }) {
  return (
    <div className="reg-review">
      <div className="reg-review__head">
        <h2>{title}</h2>
        <button type="button" className="reg-review__edit" onClick={onEdit}>
          {editLabel}
        </button>
      </div>
      <dl>{children}</dl>
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: string | undefined; warn?: string | undefined }) {
  if (!v && !warn) return null;
  return (
    <div className="reg-review__row">
      <dt>{k}</dt>
      <dd>{v || <span className="reg-review__warn">{warn}</span>}</dd>
    </div>
  );
}
