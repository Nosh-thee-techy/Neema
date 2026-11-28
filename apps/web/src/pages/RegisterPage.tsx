import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EMPTY_ALLERGIES,
  TERMS_VERSION,
  eddFromGestationalAge,
  isPlaceholderPhone,
  isValidGestationalAge,
  normalizePhone,
  parseLocalIsoDate,
  pregnancyProgress,
  toLocalIsoDate,
  validateRegistration,
  type AllergyAnswer,
  type Contact,
  type RegistrationError,
  type RegistrationErrors,
  type RegistrationField,
} from '@neema/core';
import { BrandMark } from '../ui/BrandMark';
import { LangToggle } from '../ui/LangToggle';
import { Segmented } from '../ui/Segmented';
import { FieldError, FormField, RequiredMark, invalidProps } from '../ui/FormField';
import { AllergyPicker, allergyLabel } from '../ui/AllergyPicker';
import { TermsContent } from '../ui/TermsContent';
import { VoiceFill } from '../ui/VoiceFill';
import { useLocale } from '../hooks/useLocale';
import { loadOnboarding, saveOnboarding } from '../hooks/useOnboarding';
import {
  EMPTY_BIRTH_PLAN,
  allergyAnswerOf,
  loadProfile,
  saveConsent,
  saveProfile,
  withAllergies,
  type MamaProfile,
  type RegistrarRole,
} from '../services/passport';
import { listContacts, saveContact } from '../services/contacts';
import { addClinicalNote } from '../services/clinicalNotes';
import { db } from '../storage/db';

/**
 * Multi-step registration for the mother herself, a CHW, or a nurse.
 * Required: full name, how far along (while pregnant), Terms acceptance.
 * The same rules live in @neema/core `validateRegistration` for the future server.
 * Nothing is saved until Finish.
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
  phoneKind: 'smartphone' | 'basic' | 'none';
  callsConsent: boolean;
  location: string;
  stage: 'pregnancy' | 'postpartum';
  datingMode: 'weeks' | 'due';
  gaWeeks: string;
  gaDays: string;
  dueDate: string;
  firstPregnancy: '' | 'yes' | 'no';
  deliveryDate: string;
  deliveryMode: '' | 'vaginal' | 'assisted' | 'caesarean';
  previousPregnancies: string;
  pastComplications: string[];
  conditions: string[];
  otherCondition: string;
  allergies: AllergyAnswer;
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
  termsAccepted: boolean;
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
  phoneKind: 'smartphone',
  callsConsent: false,
  location: '',
  stage: 'pregnancy',
  datingMode: 'weeks',
  gaWeeks: '',
  gaDays: '0',
  dueDate: '',
  firstPregnancy: '',
  deliveryDate: '',
  deliveryMode: '',
  previousPregnancies: '',
  pastComplications: [],
  conditions: [],
  otherCondition: '',
  allergies: EMPTY_ALLERGIES,
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
  termsAccepted: false, // never pre-ticked
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

/** Which step shows each field, so Finish can jump back to the first problem. */
const FIELD_STEP: Record<RegistrationField, StepId> = {
  registrarName: 'who',
  fullName: 'about',
  dateOfBirth: 'about',
  phone: 'about',
  gestationalAge: 'pregnancy',
  dueDate: 'pregnancy',
  firstPregnancy: 'pregnancy',
  previousPregnancies: 'pregnancy',
  deliveryDate: 'pregnancy',
  deliveryMode: 'pregnancy',
  allergies: 'health',
  chpName: 'contacts',
  chpPhone: 'contacts',
  familyName: 'contacts',
  familyPhone: 'contacts',
  terms: 'consent',
  sharing: 'consent',
};

function splitList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function RegisterPage() {
  const nav = useNavigate();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);
  const [d, setD] = useState<Draft>(EMPTY);
  const [stepIdx, setStepIdx] = useState(0);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
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
              allergies: allergyAnswerOf(p),
            }
          : {}),
        ...(chp ? { chpName: chp.name, chpPhone: chp.phone } : {}),
        ...(fam ? { familyName: fam.name, familyPhone: fam.phone } : {}),
      }));
    })();
  }, []);

  const self = d.role === 'self';

  const steps: StepId[] = useMemo(
    () => ['who', 'about', 'pregnancy', 'health', 'contacts', ...(d.role === 'nurse' ? (['clinical'] as const) : []), 'consent', 'review'] as StepId[],
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
    consent: tx('Terms', 'Masharti'),
    review: tx('Review', 'Hakiki'),
  };

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setD((cur) => ({ ...cur, [key]: value }));
  }

  function toggleIn(key: 'pastComplications' | 'conditions', item: string) {
    const list = d[key];
    set(key, list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  // ── Validation (shared rules) ───────────────────────────────────────────
  function allErrors(): RegistrationErrors {
    const e = validateRegistration({
      registrarRole: d.role,
      registrarName: d.registrarName,
      fullName: d.fullName,
      ...(d.dateOfBirth ? { dateOfBirth: d.dateOfBirth } : {}),
      phone: d.phone,
      ...(self ? {} : { phoneKind: d.phoneKind }),
      stage: d.stage,
      dating:
        d.datingMode === 'weeks'
          ? { mode: 'weeks', weeks: d.gaWeeks === '' ? null : Number(d.gaWeeks), days: Number(d.gaDays || 0) }
          : { mode: 'due', dueDateMs: d.dueDate ? parseLocalIsoDate(d.dueDate) : null },
      firstPregnancy: d.firstPregnancy === '' ? null : d.firstPregnancy === 'yes',
      deliveryDateMs: d.deliveryDate ? parseLocalIsoDate(d.deliveryDate) : null,
      deliveryMode: d.deliveryMode || null,
      previousPregnancies: d.previousPregnancies === '' ? null : Number(d.previousPregnancies),
      allergies: d.allergies,
      chpName: d.chpName,
      chpPhone: d.chpPhone,
      familyName: d.familyName,
      familyPhone: d.familyPhone,
      termsAccepted: d.termsAccepted,
      shareChp: d.shareChp,
      shareFamily: d.shareFamily,
      nowMs,
    });
    return e;
  }

  function errorsFor(s: StepId): RegistrationErrors {
    const all = allErrors();
    const out: RegistrationErrors = {};
    for (const [f, code] of Object.entries(all) as Array<[RegistrationField, RegistrationError]>) {
      if (FIELD_STEP[f] === s) out[f] = code;
    }
    return out;
  }

  /** Words for each error, specific to the field. */
  function msg(field: RegistrationField): string | undefined {
    const code = errors[field];
    if (!code) return undefined;
    const her = !self;
    switch (field) {
      case 'registrarName':
        return tx('Enter your name so the record shows who registered her.', 'Andika jina lako ili ijulikane nani alimsajili.');
      case 'fullName':
        return code === 'too_short'
          ? tx('The name looks too short. Enter the full name.', 'Jina ni fupi mno. Andika jina kamili.')
          : her
            ? tx("Enter the mother's full name.", 'Andika jina kamili la mama.')
            : tx('Enter your full name.', 'Andika jina lako kamili.');
      case 'dateOfBirth':
        return tx('Check the date of birth: it should be a real date for someone 10 to 60 years old.', 'Angalia tarehe ya kuzaliwa: iwe ya mtu wa miaka 10 hadi 60.');
      case 'phone':
        return code === 'phone_required_for_calls'
          ? tx('Enter her phone number so the team can call her.', 'Andika namba yake ili timu impigie.')
          : tx('This does not look like a phone number. Example: 0712 345 678', 'Hii si namba sahihi. Mfano: 0712 345 678');
      case 'gestationalAge':
        return code === 'required'
          ? tx('Enter how many weeks pregnant (from the clinic card), or switch to due date.', 'Andika wiki za mimba (kutoka kadi ya kliniki), au chagua tarehe ya kujifungua.')
          : tx('Weeks must be 1 to 42, and days 0 to 6.', 'Wiki ziwe 1 hadi 42, na siku 0 hadi 6.');
      case 'dueDate':
        return code === 'required'
          ? tx('Enter the due date from the clinic card.', 'Andika tarehe ya kujifungua kutoka kadi ya kliniki.')
          : tx('That due date does not fit a current pregnancy. Check the clinic card.', 'Tarehe hiyo haiendani na mimba ya sasa. Angalia kadi ya kliniki.');
      case 'deliveryDate':
        return code === 'future_date'
          ? tx('The birth date cannot be in the future.', 'Tarehe ya kuzaliwa haiwezi kuwa ya baadaye.')
          : code === 'required'
            ? tx('Enter the date the baby was born.', 'Andika tarehe mtoto alizaliwa.')
            : tx('Check the date: it should be within the last year.', 'Angalia tarehe: iwe ndani ya mwaka mmoja uliopita.');
      case 'deliveryMode':
        return tx('Choose how the baby was born.', 'Chagua jinsi mtoto alivyozaliwa.');
      case 'firstPregnancy':
        return tx('Choose Yes or No.', 'Chagua Ndiyo au Hapana.');
      case 'previousPregnancies':
        return tx('Enter a number from 1 to 20.', 'Andika namba kutoka 1 hadi 20.');
      case 'allergies':
        return tx('"No known allergies" cannot be picked together with an allergy.', '"Hakuna mzio" haiwezi kuchaguliwa pamoja na mzio.');
      case 'chpName':
      case 'familyName':
        return tx('Add a name for this phone number.', 'Ongeza jina la namba hii.');
      case 'chpPhone':
      case 'familyPhone':
        return code === 'required'
          ? tx('Add a phone number for this person.', 'Ongeza namba ya simu ya mtu huyu.')
          : tx('Enter a real phone number. Example: 0712 345 678', 'Andika namba halisi. Mfano: 0712 345 678');
      case 'terms':
        return her
          ? tx('The mother must accept the Terms and Conditions before registering.', 'Mama lazima akubali Masharti na Vigezo kabla ya kusajiliwa.')
          : tx('Please accept the Terms and Conditions to continue.', 'Tafadhali kubali Masharti na Vigezo ili kuendelea.');
      case 'sharing':
        return tx('Choose at least one person who may get an alert.', 'Chagua angalau mtu mmoja wa kupokea tahadhari.');
    }
  }

  function focusFirstError() {
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  function next() {
    const e = errorsFor(step);
    setErrors(e);
    if (Object.keys(e).length) return focusFirstError();
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
      const ms = parseLocalIsoDate(d.dueDate);
      return ms !== null ? pregnancyProgress({ kind: 'edd', eddMs: ms }, nowMs) : null;
    }
    return null;
  }, [d.stage, d.datingMode, d.gaWeeks, d.gaDays, d.dueDate, nowMs]);

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(sw ? 'sw-KE' : 'en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Save ────────────────────────────────────────────────────────────────
  async function finish() {
    const all = allErrors();
    if (Object.keys(all).length) {
      const first = (Object.keys(all) as RegistrationField[])[0]!;
      const target = FIELD_STEP[first];
      goTo(target);
      setErrors(errorsFor(target));
      return focusFirstError();
    }
    setBusy(true);
    setSaveError(null);
    try {
      const existing = await loadProfile().catch(() => null);
      const conditions = [...d.conditions, ...(d.otherCondition.trim() ? [d.otherCondition.trim()] : [])];
      const fullName = d.fullName.trim();
      const now = Date.now();
      let profile: MamaProfile = {
        ...(existing ?? {}),
        fullName,
        displayName: d.displayName.trim() || fullName.split(/\s+/)[0]!,
        language: lang,
        stage: d.stage,
        birthPlan: existing?.birthPlan ?? { ...EMPTY_BIRTH_PLAN },
        registeredAtMs: now,
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
      opt('dateOfBirth', d.dateOfBirth);
      opt('phoneForAlerts', d.phone.trim() ? (normalizePhone(d.phone) ?? undefined) : undefined);
      opt('location', d.location.trim());
      opt('facilityName', d.facilityName.trim());
      opt('nurseName', d.role === 'nurse' ? d.registrarName.trim() : existing?.nurseName);
      opt('pastComplications', d.firstPregnancy === 'no' ? d.pastComplications : []);
      opt('conditions', conditions);
      opt('medications', splitList(d.medications));
      opt('healthNotes', d.healthNotes.trim());
      if (d.role !== 'self') {
        profile.phoneKind = d.phoneKind;
        profile.automatedCallsConsent = d.phoneKind !== 'none' && d.callsConsent;
      }
      profile = withAllergies(profile, d.allergies);

      if (d.stage === 'pregnancy') {
        profile.firstPregnancy = d.firstPregnancy === 'yes';
        opt('previousPregnancies', d.firstPregnancy === 'no' && d.previousPregnancies !== '' ? Number(d.previousPregnancies) : undefined);
        if (d.datingMode === 'weeks') {
          profile.gaWeeks = Number(d.gaWeeks);
          profile.gaDays = Number(d.gaDays || 0);
          profile.gaRecordedOnMs = now;
          profile.gestationWeeks = profile.gaWeeks;
          profile.expectedDeliveryDate = toLocalIsoDate(eddFromGestationalAge(profile.gaWeeks, profile.gaDays, now));
        } else {
          delete profile.gaWeeks;
          delete profile.gaDays;
          delete profile.gaRecordedOnMs;
          profile.expectedDeliveryDate = d.dueDate;
          if (progress) profile.gestationWeeks = progress.weeks;
        }
      }

      if (d.stage === 'postpartum' && d.deliveryDate && d.deliveryMode) {
        profile.delivery = {
          dateIso: d.deliveryDate,
          mode: d.deliveryMode,
          complications: [],
          babiesCount: 1,
          showBabyInfo: true,
          recordedBy: { role: d.role, ...(d.registrarName.trim() ? { name: d.registrarName.trim() } : {}) },
          recordedAtMs: now,
        };
        await db.babies.put({ id: `baby_${d.deliveryDate}_1`, birthDateIso: d.deliveryDate, createdAtMs: now });
      }

      await saveProfile(profile);

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
        agreedAtMs: now,
        sharing: { chp: d.shareChp, family: d.shareFamily, nurse: d.shareNurse },
        termsVersion: TERMS_VERSION,
        termsAcceptedAtMs: now,
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

  // ── Small helpers ───────────────────────────────────────────────────────
  const why = (en: string, s: string) => (
    <p className="reg-why">
      <span aria-hidden>ⓘ</span> {tx(en, s)}
    </p>
  );
  const optional = tx('optional', 'si lazima');
  const legend = (
    <p className="n-legend">
      <RequiredMark /> {tx('= required', '= lazima')}
    </p>
  );
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
          {tx(`Step ${stepIdx + 1} of ${steps.length}`, `Hatua ${stepIdx + 1} kati ya ${steps.length}`)} · <strong>{stepLabels[step]}</strong>
        </p>
        <ol className="reg-steps__dots">
          {steps.map((s, i) => (
            <li key={s} data-state={i < stepIdx ? 'done' : i === stepIdx ? 'now' : 'todo'} aria-current={i === stepIdx ? 'step' : undefined}>
              <span className="sr-only">{stepLabels[s]}</span>
            </li>
          ))}
        </ol>
      </nav>

      <section key={step} className="reg-card" aria-live="polite">
        {step === 'who' && (
          <>
            <h1 className="screen-title">{tx('Who is filling this in?', 'Nani anajaza fomu hii?')}</h1>
            <p className="screen-sub">{tx('A mother can register herself, or a CHW or nurse can help.', 'Mama anaweza kujisajili, au CHW au muuguzi akasaidia.')}</p>
            <div className="reg-choices" role="radiogroup" aria-label={tx('Who is registering', 'Nani anasajili')}>
              {(
                [
                  ['self', tx("I'm the mother", 'Mimi ni mama'), tx('Registering myself', 'Najisajili mwenyewe')],
                  ['chw', tx("I'm a CHW / CHP", 'Mimi ni CHW / CHP'), tx('Helping a mother in my area', 'Namsaidia mama wa eneo langu')],
                  ['nurse', tx("I'm a nurse / midwife", 'Mimi ni muuguzi / mkunga'), tx('Registering at the clinic', 'Nasajili kliniki')],
                ] as const
              ).map(([role, label, sub]) => (
                <button key={role} type="button" role="radio" aria-checked={d.role === role} className="reg-choice" onClick={() => set('role', role)}>
                  <strong>{label}</strong>
                  <span>{sub}</span>
                </button>
              ))}
            </div>
            {!self && (
              <>
                {legend}
                <FormField id="reg-registrar" label={tx('Your name', 'Jina lako')} required error={msg('registrarName')}>
                  <input id="reg-registrar" value={d.registrarName} onChange={(e) => set('registrarName', e.target.value)} autoComplete="name" {...invalidProps('reg-registrar', msg('registrarName'))} />
                </FormField>
                <FormField id="reg-staffid" label={d.role === 'nurse' ? tx('Staff number', 'Namba ya mfanyakazi') : tx('CHW number', 'Namba ya CHW')} optionalText={optional}>
                  <input id="reg-staffid" value={d.registrarId} onChange={(e) => set('registrarId', e.target.value)} />
                </FormField>
                <FormField id="reg-facility" label={tx('Clinic / link facility', 'Kliniki / kituo cha afya')} optionalText={optional}>
                  <input id="reg-facility" value={d.facilityName} onChange={(e) => set('facilityName', e.target.value)} />
                </FormField>
              </>
            )}
          </>
        )}

        {step === 'about' && (
          <>
            <h1 className="screen-title">{self ? tx('About you', 'Kuhusu wewe') : tx('About the mother', 'Kuhusu mama')}</h1>
            {legend}
            <FormField id="reg-full" label={self ? tx('Full name', 'Jina kamili') : tx("Mother's full name", 'Jina kamili la mama')} required error={msg('fullName')} hint={tx('As on the clinic card or ID.', 'Kama kwenye kadi ya kliniki au kitambulisho.')}>
              <span className="reg-with-voice">
                <input id="reg-full" value={d.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" {...invalidProps('reg-full', msg('fullName'))} />
                <VoiceFill lang={lang} onText={(v) => set('fullName', v)} />
              </span>
            </FormField>
            <FormField
              id="reg-display"
              label={self ? tx('What should Neema call you?', 'Neema akuite nani?') : tx('What should Neema call her?', 'Neema amwite nani?')}
              optionalText={optional}
              hint={tx('Leave empty to use the first name.', 'Acha tupu kutumia jina la kwanza.')}
            >
              <span className="reg-with-voice">
                <input id="reg-display" value={d.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder={tx('e.g. Mama Wanjiru', 'mfano: Mama Wanjiru')} />
                <VoiceFill lang={lang} onText={(v) => set('displayName', v)} />
              </span>
            </FormField>
            <FormField
              id="reg-dob"
              label={tx('Date of birth', 'Tarehe ya kuzaliwa')}
              optionalText={optional}
              error={msg('dateOfBirth')}
              hint={why('Age helps the nurse read results. It is not sent in alerts.', 'Umri humsaidia muuguzi kuelewa vipimo. Hautumwi kwenye tahadhari.')}
            >
              <input id="reg-dob" type="date" value={d.dateOfBirth} max={toLocalIsoDate(nowMs)} onChange={(e) => set('dateOfBirth', e.target.value)} {...invalidProps('reg-dob', msg('dateOfBirth'))} />
            </FormField>
            <FormField
              id="reg-phone"
              label={tx('Phone number', 'Namba ya simu')}
              required={!self && d.phoneKind === 'basic'}
              optionalText={optional}
              error={msg('phone')}
              hint={self ? why('So your CHP can call you back after an alert.', 'Ili CHP wako akupigie baada ya tahadhari.') : why('So her CHP can call her back after an alert.', 'Ili CHP wake ampigie baada ya tahadhari.')}
            >
              <span className="reg-with-voice">
                <input id="reg-phone" type="tel" inputMode="tel" value={d.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0712 345 678" autoComplete="tel" {...invalidProps('reg-phone', msg('phone'))} />
                <VoiceFill lang={lang} mode="phone" onText={(v) => set('phone', v)} />
              </span>
            </FormField>
            {!self && (
              <div className="field">
                <span className="n-label">{tx('What phone does she have?', 'Ana simu ya aina gani?')}</span>
                <Segmented
                  ariaLabel={tx('Phone type', 'Aina ya simu')}
                  value={d.phoneKind}
                  onChange={(v) => set('phoneKind', v)}
                  options={[
                    { value: 'smartphone', label: tx('Smartphone', 'Simu janja') },
                    { value: 'basic', label: tx('Basic phone', 'Simu ya kawaida') },
                    { value: 'none', label: tx('No phone', 'Hana simu') },
                  ]}
                />
                {d.phoneKind !== 'none' ? (
                  <label className="reg-agree">
                    <input type="checkbox" checked={d.callsConsent} onChange={(e) => set('callsConsent', e.target.checked)} />
                    <span>{tx('She agrees to receive automated check-in calls and SMS on this number.', 'Amekubali kupokea simu na SMS za ukaguzi za kiotomatiki kwa namba hii.')}</span>
                  </label>
                ) : null}
                {why('Automated calls are planned and need the Neema server. Saving this now means she is ready when it starts.', 'Simu za kiotomatiki zinapangwa na zinahitaji seva ya Neema. Kuhifadhi sasa kunamtayarisha zitakapoanza.')}
              </div>
            )}
            <FormField id="reg-loc" label={tx('Village / estate', 'Kijiji / mtaa')} optionalText={optional} hint={self ? why('Helps your CHP find you quickly.', 'Humsaidia CHP kukupata haraka.') : why('Helps the CHP find her quickly.', 'Humsaidia CHP kumpata haraka.')}>
              <input id="reg-loc" value={d.location} onChange={(e) => set('location', e.target.value)} autoComplete="address-level2" />
            </FormField>
          </>
        )}

        {step === 'pregnancy' && (
          <>
            <h1 className="screen-title">{tx('Pregnancy', 'Mimba')}</h1>
            {legend}
            <div className="field">
              <span className="n-label">{tx('Stage', 'Hatua')}</span>
              <Segmented
                ariaLabel={tx('Stage', 'Hatua')}
                value={d.stage}
                onChange={(v) => set('stage', v)}
                options={[
                  { value: 'pregnancy', label: tx('Pregnant now', 'Mjamzito sasa') },
                  { value: 'postpartum', label: tx('Gave birth recently', 'Amejifungua karibuni') },
                ]}
              />
            </div>

            {d.stage === 'postpartum' && (
              <>
                <FormField id="reg-birth-date" label={tx('Date the baby was born', 'Tarehe mtoto alizaliwa')} required error={msg('deliveryDate')}>
                  <input id="reg-birth-date" type="date" max={toLocalIsoDate(nowMs)} value={d.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} {...invalidProps('reg-birth-date', msg('deliveryDate'))} />
                </FormField>
                <div className="field">
                  <span className="n-label">
                    {tx('How was the baby born?', 'Mtoto alizaliwa vipi?')}
                    <RequiredMark />
                  </span>
                  <Segmented
                    ariaLabel={tx('How the baby was born', 'Jinsi mtoto alivyozaliwa')}
                    value={d.deliveryMode}
                    onChange={(v) => set('deliveryMode', v)}
                    invalid={Boolean(msg('deliveryMode'))}
                    describedBy={msg('deliveryMode') ? 'reg-mode-error' : undefined}
                    options={[
                      { value: 'vaginal', label: tx('Normal birth', 'Kawaida') },
                      { value: 'assisted', label: tx('Assisted', 'Kwa kusaidiwa') },
                      { value: 'caesarean', label: tx('Caesarean', 'Upasuaji') },
                    ]}
                  />
                  {msg('deliveryMode') ? <FieldError id="reg-mode-error" message={msg('deliveryMode')!} /> : null}
                </div>
                {why('Neema uses the birth date to show the right recovery advice each day.', 'Neema hutumia tarehe ya kuzaliwa kuonyesha ushauri sahihi wa kupona kila siku.')}
              </>
            )}

            {d.stage === 'pregnancy' && (
              <>
                <div className="field">
                  <span className="n-label" id="reg-ga-label">
                    {tx('How far along?', 'Mimba ina muda gani?')}
                    <RequiredMark />
                  </span>
                  <Segmented
                    ariaLabel={tx('How do you know how far along', 'Unajuaje muda wa mimba')}
                    value={d.datingMode}
                    onChange={(v) => set('datingMode', v)}
                    options={[
                      { value: 'weeks', label: tx('Weeks + days', 'Wiki + siku') },
                      { value: 'due', label: tx('Due date', 'Tarehe ya kujifungua') },
                    ]}
                  />
                </div>
                {d.datingMode === 'weeks' ? (
                  <>
                    <div className="reg-ga">
                      <div className="field">
                        <label htmlFor="reg-gaw" className="n-label">
                          {tx('Weeks', 'Wiki')}
                          <RequiredMark />
                        </label>
                        <input id="reg-gaw" type="number" inputMode="numeric" min={1} max={42} value={d.gaWeeks} onChange={(e) => set('gaWeeks', e.target.value)} {...invalidProps('reg-gaw', msg('gestationalAge'))} />
                      </div>
                      <div className="field">
                        <label htmlFor="reg-gad" className="n-label">
                          {tx('Days', 'Siku')}
                        </label>
                        <select id="reg-gad" value={d.gaDays} onChange={(e) => set('gaDays', e.target.value)}>
                          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {msg('gestationalAge') ? <FieldError id="reg-gaw-error" message={msg('gestationalAge')!} /> : null}
                  </>
                ) : (
                  <FormField id="reg-due" label={tx('Due date (from clinic card)', 'Tarehe ya kujifungua (kadi ya kliniki)')} required error={msg('dueDate')}>
                    <input id="reg-due" type="date" value={d.dueDate} onChange={(e) => set('dueDate', e.target.value)} {...invalidProps('reg-due', msg('dueDate'))} />
                  </FormField>
                )}
                <p className="n-hint" style={{ marginTop: '0.4rem' }}>
                  {tx('Not sure? Ask at the clinic, or look at the clinic card (mother and child booklet).', 'Huna uhakika? Uliza kliniki, au angalia kadi ya kliniki (kitabu cha mama na mtoto).')}
                </p>
                {progress && (
                  <p className="reg-calc">
                    {tx(
                      `Today: ${progress.weeks} weeks ${progress.days} days · trimester ${progress.trimester} · due around ${fmtDate(progress.eddMs)}`,
                      `Leo: wiki ${progress.weeks} siku ${progress.days} · kipindi ${progress.trimester} · kujifungua karibu ${fmtDate(progress.eddMs)}`,
                    )}
                  </p>
                )}

                <div className="field" style={{ marginTop: '1rem' }}>
                  <span className="n-label">
                    {tx('Is this the first pregnancy?', 'Hii ni mimba ya kwanza?')}
                    <RequiredMark />
                  </span>
                  <Segmented
                    ariaLabel={tx('First pregnancy', 'Mimba ya kwanza')}
                    value={d.firstPregnancy}
                    onChange={(v) => set('firstPregnancy', v)}
                    invalid={Boolean(msg('firstPregnancy'))}
                    describedBy={msg('firstPregnancy') ? 'reg-first-error' : undefined}
                    options={[
                      { value: 'yes', label: tx('Yes', 'Ndiyo') },
                      { value: 'no', label: tx('No', 'Hapana') },
                    ]}
                  />
                  {msg('firstPregnancy') ? <FieldError id="reg-first-error" message={msg('firstPregnancy')!} /> : null}
                </div>
                {d.firstPregnancy === 'no' && (
                  <>
                    <FormField id="reg-prev" label={tx('How many pregnancies before?', 'Mimba ngapi kabla?')} optionalText={optional} error={msg('previousPregnancies')}>
                      <input id="reg-prev" type="number" inputMode="numeric" min={1} max={20} value={d.previousPregnancies} onChange={(e) => set('previousPregnancies', e.target.value)} {...invalidProps('reg-prev', msg('previousPregnancies'))} />
                    </FormField>
                    <p className="n-label">
                      {tx('Any of these in past pregnancies?', 'Yoyote kati ya haya kwenye mimba zilizopita?')}
                      <span className="n-optional">{optional}</span>
                    </p>
                    <div className="chip-grid">
                      {COMPLICATIONS.map((c) => (
                        <button key={c.key} type="button" className="chip" aria-pressed={d.pastComplications.includes(c.key)} onClick={() => toggleIn('pastComplications', c.key)}>
                          {tx(c.en, c.sw)}
                        </button>
                      ))}
                    </div>
                    {why('Past problems help the nurse plan care, and let Neema watch more closely where it matters. They only ever make Neema more careful.', 'Matatizo ya zamani humsaidia muuguzi kupanga huduma, na humwezesha Neema kukuangalia kwa karibu zaidi inapohitajika. Yanamfanya Neema awe makini zaidi tu.')}
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
            <p className="n-label">{tx('Ongoing conditions', 'Magonjwa ya muda mrefu')}</p>
            <div className="chip-grid">
              {CONDITIONS.map((c) => (
                <button key={c.key} type="button" className="chip" aria-pressed={d.conditions.includes(c.key)} onClick={() => toggleIn('conditions', c.key)}>
                  {tx(c.en, c.sw)}
                </button>
              ))}
            </div>
            <FormField id="reg-other" label={tx('Other condition', 'Ugonjwa mwingine')}>
              <input id="reg-other" value={d.otherCondition} onChange={(e) => set('otherCondition', e.target.value)} />
            </FormField>
            <AllergyPicker idPrefix="reg-alg" lang={lang} value={d.allergies} onChange={(v) => set('allergies', v)} error={msg('allergies')} />
            <FormField id="reg-meds" label={tx('Medicines taken now', 'Dawa unazotumia sasa')}>
              <span className="reg-with-voice">
                <input id="reg-meds" value={d.medications} onChange={(e) => set('medications', e.target.value)} placeholder={tx('e.g. iron, folic acid', 'mfano: madini ya chuma, foliki')} />
                <VoiceFill lang={lang} onText={(v) => set('medications', v)} />
              </span>
            </FormField>
            <FormField id="reg-notes" label={self ? tx('Anything else your nurse should know', 'Lolote muuguzi anapaswa kujua') : tx("Mother's own notes", 'Maelezo ya mama mwenyewe')}>
              <textarea id="reg-notes" rows={3} value={d.healthNotes} onChange={(e) => set('healthNotes', e.target.value)} />
            </FormField>
            {why('This shows on the nurse summary at clinic visits. It stays on this phone.', 'Huonekana kwenye muhtasari wa muuguzi kliniki. Hubaki kwenye simu hii.')}
          </>
        )}

        {step === 'contacts' && (
          <>
            <h1 className="screen-title">{tx('Who should Neema alert?', 'Neema amjulishe nani?')}</h1>
            <p className="screen-sub">{tx('When readings look dangerous, Neema sends an SMS to these people.', 'Vipimo vikionyesha hatari, Neema hutuma SMS kwa watu hawa.')}</p>
            <fieldset className="reg-group">
              <legend>{tx('Community health promoter (CHP)', 'Mhudumu wa afya ya jamii (CHP)')}</legend>
              <FormField id="reg-chpn" label={tx('Name', 'Jina')} error={msg('chpName')}>
                <input id="reg-chpn" value={d.chpName} onChange={(e) => set('chpName', e.target.value)} {...invalidProps('reg-chpn', msg('chpName'))} />
              </FormField>
              <FormField id="reg-chpp" label={tx('Phone', 'Simu')} error={msg('chpPhone')}>
                <input id="reg-chpp" type="tel" inputMode="tel" value={d.chpPhone} onChange={(e) => set('chpPhone', e.target.value)} placeholder="0712 345 678" {...invalidProps('reg-chpp', msg('chpPhone'))} />
              </FormField>
            </fieldset>
            <fieldset className="reg-group">
              <legend>
                {tx('Family member', 'Mwanafamilia')} <span className="n-optional">{optional}</span>
              </legend>
              <FormField id="reg-famn" label={tx('Name', 'Jina')} error={msg('familyName')}>
                <input id="reg-famn" value={d.familyName} onChange={(e) => set('familyName', e.target.value)} {...invalidProps('reg-famn', msg('familyName'))} />
              </FormField>
              <FormField id="reg-famp" label={tx('Phone', 'Simu')} error={msg('familyPhone')}>
                <input id="reg-famp" type="tel" inputMode="tel" value={d.familyPhone} onChange={(e) => set('familyPhone', e.target.value)} placeholder="0712 345 678" {...invalidProps('reg-famp', msg('familyPhone'))} />
              </FormField>
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
            <FormField id="reg-clin" label={tx('Note', 'Maelezo')} optionalText={optional} hint={tx(`Signed as: ${d.registrarName || '—'} (nurse)`, `Imesainiwa na: ${d.registrarName || '—'} (muuguzi)`)}>
              <textarea id="reg-clin" rows={5} value={d.clinicalNote} onChange={(e) => set('clinicalNote', e.target.value)} />
            </FormField>
          </>
        )}

        {step === 'consent' && (
          <>
            <h1 className="screen-title">{tx('Terms and privacy', 'Masharti na faragha')}</h1>
            {legend}
            <ul className="reg-facts">
              <li>{tx('Everything is saved on this phone only. There is no online account.', 'Kila kitu kinahifadhiwa kwenye simu hii tu. Hakuna akaunti ya mtandaoni.')}</li>
              <li>{tx('When readings look dangerous, a short SMS goes to the people chosen below.', 'Vipimo vikionyesha hatari, SMS fupi hutumwa kwa watu waliochaguliwa hapa chini.')}</li>
              <li>{tx('Neema does not diagnose. In an emergency call 999.', 'Neema hatambui ugonjwa. Wakati wa dharura piga 999.')}</li>
            </ul>
            <p className="n-label" style={{ marginTop: '1rem' }}>
              {tx('Who may receive an alert?', 'Nani apokee tahadhari?')}
              <RequiredMark />
            </p>
            <div className="panel" aria-invalid={msg('sharing') ? true : undefined} tabIndex={msg('sharing') ? -1 : undefined}>
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
            {msg('sharing') ? <FieldError id="reg-sharing-error" message={msg('sharing')!} /> : null}

            <div className="reg-terms" data-invalid={msg('terms') ? 'true' : undefined}>
              <label className="reg-agree" htmlFor="reg-terms">
                <input
                  id="reg-terms"
                  type="checkbox"
                  checked={d.termsAccepted}
                  onChange={(e) => set('termsAccepted', e.target.checked)}
                  {...invalidProps('reg-terms', msg('terms'))}
                />
                <span>
                  {self
                    ? tx('I have read and accept the Terms and Conditions', 'Nimesoma na nakubali Masharti na Vigezo')
                    : tx('I read the Terms and Conditions to the mother and she accepts them', 'Nimemsomea mama Masharti na Vigezo na amekubali')}
                  <RequiredMark />
                </span>
              </label>
              <button type="button" className="n-link" onClick={() => setShowTerms(true)} aria-haspopup="dialog">
                {tx('Read the Terms and Conditions', 'Soma Masharti na Vigezo')}
              </button>
              {msg('terms') ? <FieldError id="reg-terms-error" message={msg('terms')!} /> : null}
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <h1 className="screen-title">{tx('Check and finish', 'Hakiki na umalize')}</h1>
            <p className="screen-sub">{tx('Tap Edit to fix anything.', 'Gusa Badilisha kurekebisha.')}</p>
            <ReviewBlock title={stepLabels.about} onEdit={() => goTo('about')} editLabel={tx('Edit', 'Badilisha')}>
              <Row k={tx('Full name', 'Jina kamili')} v={d.fullName} />
              <Row k={tx('Neema calls', 'Neema humwita')} v={d.displayName || d.fullName.trim().split(/\s+/)[0]} />
              <Row k={tx('Born', 'Alizaliwa')} v={d.dateOfBirth} />
              <Row k={tx('Phone', 'Simu')} v={d.phone ? (normalizePhone(d.phone) ?? d.phone) : ''} />
              <Row k={tx('Place', 'Mahali')} v={d.location} />
              {!self ? (
                <Row
                  k={tx('Phone type', 'Aina ya simu')}
                  v={`${d.phoneKind === 'basic' ? tx('Basic phone', 'Simu ya kawaida') : d.phoneKind === 'none' ? tx('No phone', 'Hana simu') : tx('Smartphone', 'Simu janja')}${d.callsConsent && d.phoneKind !== 'none' ? tx(' · automated calls OK', ' · simu za kiotomatiki sawa') : ''}`}
                />
              ) : null}
            </ReviewBlock>
            <ReviewBlock title={stepLabels.pregnancy} onEdit={() => goTo('pregnancy')} editLabel={tx('Edit', 'Badilisha')}>
              {d.stage === 'postpartum' ? (
                <>
                  <Row k={tx('Stage', 'Hatua')} v={tx('Gave birth recently', 'Amejifungua karibuni')} />
                  <Row k={tx('Baby born', 'Mtoto alizaliwa')} v={d.deliveryDate ? fmtDate(parseLocalIsoDate(d.deliveryDate) ?? 0) : ''} />
                </>
              ) : (
                <>
                  <Row k={tx('Today', 'Leo')} v={progress ? tx(`${progress.weeks} w ${progress.days} d · trimester ${progress.trimester}`, `wiki ${progress.weeks} siku ${progress.days} · kipindi ${progress.trimester}`) : ''} />
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
              <Row
                k={tx('Allergies', 'Mzio')}
                v={d.allergies.noneKnown ? tx('No known allergies', 'Hakuna mzio unaojulikana') : d.allergies.items.map((e) => allergyLabel(e, lang)).join(' · ') || tx('Not answered', 'Haijajibiwa')}
              />
              <Row k={tx('Medicines', 'Dawa')} v={d.medications} />
              <Row k={tx('Notes', 'Maelezo')} v={d.healthNotes} />
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
            <ReviewBlock title={stepLabels.consent} onEdit={() => goTo('consent')} editLabel={tx('Edit', 'Badilisha')}>
              <Row k={tx('Terms', 'Masharti')} v={d.termsAccepted ? tx('Accepted', 'Yamekubaliwa') : ''} warn={!d.termsAccepted ? tx('Not accepted yet', 'Bado hayajakubaliwa') : undefined} />
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
        <button type="button" className="btn btn-secondary" onClick={back} disabled={busy}>
          {tx('Back', 'Rudi')}
        </button>
        {step === 'review' ? (
          <button type="button" className="btn btn-primary" onClick={() => void finish()} disabled={busy}>
            {busy ? tx('Saving…', 'Inahifadhi…') : tx('Finish', 'Maliza')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={next}>
            {step === 'health' || step === 'clinical' ? tx('Next (or skip)', 'Endelea (au ruka)') : tx('Next', 'Endelea')}
          </button>
        )}
      </div>

      {showTerms ? (
        <div
          className="n-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="terms-title"
          onClick={() => setShowTerms(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowTerms(false);
          }}
        >
          <div className="n-modal__panel" onClick={(e) => e.stopPropagation()}>
            <h2 id="terms-title">{tx('Terms and Conditions', 'Masharti na Vigezo')}</h2>
            <TermsContent lang={lang} />
            <button type="button" className="btn btn-primary btn-block" autoFocus onClick={() => setShowTerms(false)}>
              {tx('Close', 'Funga')}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ReviewBlock({ title, onEdit, editLabel, children }: { title: string; onEdit: () => void; editLabel: string; children: React.ReactNode }) {
  return (
    <div className="reg-review">
      <div className="reg-review__head">
        <h2>{title}</h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
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
