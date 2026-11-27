import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  isPlaceholderPhone,
  isValidGestationalAge,
  normalizePhone,
  parseLocalIsoDate,
  pregnancyProgress,
  toLocalIsoDate,
  eddFromGestationalAge,
  isContradictory,
  type AllergyAnswer,
  type BirthPlan,
  type Contact,
} from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { AllergyPicker, allergyLabel } from '../ui/AllergyPicker';
import { RequiredMark } from '../ui/FormField';
import { IconChevron } from '../ui/icons';
import { EMPTY_BIRTH_PLAN, allergyAnswerOf, loadConsent, loadProfile, saveProfile, withAllergies, type MamaProfile } from '../services/passport';
import { listContacts } from '../services/contacts';
import { listClinicalNotes, type ClinicalNoteRow } from '../services/clinicalNotes';
import { progressFromProfile } from '../services/pregnancyProgress';
import { deliveryMsOf, listBabies, recoveryProgressOf, setShowBabyInfo, undoDelivery } from '../services/delivery';
import { latestEpds } from '../services/epdsStore';
import type { BabyRow, ConsentRow } from '../storage/db';

type Editing = null | 'personal' | 'pregnancy' | 'health' | 'provider';

const list = (xs?: string[]) => (xs && xs.length ? xs.join(', ') : '');
const split = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Profile & settings: her details, pregnancy, contacts, notes, nurse QR, band, account. */
export function ProfilePage() {
  const nav = useNavigate();
  const loc = useLocation();
  const g = useGuardian();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, swText: string) => (sw ? swText : en);

  const [profile, setProfile] = useState<MamaProfile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [clinical, setClinical] = useState<ClinicalNoteRow[]>([]);
  const [, setConsent] = useState<ConsentRow | null>(null);
  const [epdsAt, setEpdsAt] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [babies, setBabies] = useState<BabyRow[]>([]);
  const [allergyDraft, setAllergyDraft] = useState<AllergyAnswer>({ noneKnown: false, items: [] });

  async function reload() {
    const [p, c, n, cons, e] = await Promise.all([
      loadProfile().catch(() => null),
      listContacts(),
      listClinicalNotes(),
      loadConsent(),
      latestEpds().catch(() => null),
    ]);
    setProfile(p);
    setContacts(c);
    setClinical(n);
    setConsent(cons);
    setEpdsAt(e?.tsMs ?? null);
    setBabies(await listBabies());
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!loc.hash) return;
    const id = loc.hash.slice(1);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  }, [loc.hash, profile]);

  const p: MamaProfile = profile ?? { displayName: '', language: lang, stage: 'pregnancy' };
  const preg = p.stage === 'pregnancy' ? progressFromProfile(p) : null;
  const after = p.stage === 'postpartum';
  const recovery = after ? recoveryProgressOf(p) : null;
  const delivery = after ? p.delivery : undefined;
  const plan: BirthPlan = { ...EMPTY_BIRTH_PLAN, ...p.birthPlan };
  const loc2 = sw ? 'sw-KE' : 'en-KE';
  const d = (ms: number) => new Date(ms).toLocaleDateString(loc2, { day: 'numeric', month: 'long', year: 'numeric' });

  function startEdit(section: Exclude<Editing, null>) {
    setFormError(null);
    setSaved(null);
    if (section === 'personal')
      setForm({ displayName: p.displayName, fullName: p.fullName ?? '', dateOfBirth: p.dateOfBirth ?? '', phone: p.phoneForAlerts ?? '', location: p.location ?? '' });
    if (section === 'pregnancy')
      setForm({
        stage: p.stage,
        mode: p.gaWeeks !== undefined ? 'weeks' : p.expectedDeliveryDate ? 'due' : 'weeks',
        gaWeeks: preg ? String(preg.weeks) : '',
        gaDays: preg ? String(preg.days) : '0',
        dueDate: p.expectedDeliveryDate ?? '',
        first: p.firstPregnancy === undefined ? '' : p.firstPregnancy ? 'yes' : 'no',
        previous: p.previousPregnancies !== undefined ? String(p.previousPregnancies) : '',
      });
    if (section === 'health')
      setForm({ conditions: list(p.conditions), medications: list(p.medications), notes: p.healthNotes ?? '' });
    if (section === 'health') setAllergyDraft(allergyAnswerOf(p));
    if (section === 'provider') setForm({ facility: p.facilityName ?? '', nurse: p.nurseName ?? '', birthFacility: plan.facility ?? '' });
    setEditing(section);
  }

  async function persist(next: MamaProfile, label: string) {
    await saveProfile(next);
    setProfile(next);
    setEditing(null);
    setSaved(label);
  }

  async function saveSection() {
    setFormError(null);
    const f = form;
    const next: MamaProfile = { ...p };
    const opt = <K extends keyof MamaProfile>(k: K, v: MamaProfile[K] | '' | undefined) => {
      if (v === '' || v === undefined || (Array.isArray(v) && !v.length)) delete next[k];
      else next[k] = v as MamaProfile[K];
    };
    if (editing === 'personal') {
      if (!f.fullName?.trim() || f.fullName.trim().length < 2) return setFormError(tx('Enter your full name.', 'Andika jina lako kamili.'));
      if (f.phone?.trim()) {
        const n = normalizePhone(f.phone);
        if (!n || isPlaceholderPhone(n)) return setFormError(tx('Check the phone number.', 'Angalia namba ya simu.'));
        next.phoneForAlerts = n;
      } else delete next.phoneForAlerts;
      next.fullName = f.fullName!.trim();
      next.displayName = f.displayName?.trim() || next.fullName.split(/\s+/)[0]!;
      opt('dateOfBirth', f.dateOfBirth);
      opt('location', f.location?.trim());
    }
    if (editing === 'pregnancy') {
      next.stage = f.stage === 'postpartum' ? 'postpartum' : 'pregnancy';
      if (next.stage === 'pregnancy') {
        if (f.mode === 'weeks') {
          const w = Number(f.gaWeeks);
          const dd = Number(f.gaDays || 0);
          if (f.gaWeeks === '' || !isValidGestationalAge(w, dd) || w < 1 || w > 42)
            return setFormError(tx('Enter weeks 1–42 and days 0–6.', 'Andika wiki 1–42 na siku 0–6.'));
          const now = Date.now();
          next.gaWeeks = w;
          next.gaDays = dd;
          next.gaRecordedOnMs = now;
          next.gestationWeeks = w;
          next.expectedDeliveryDate = toLocalIsoDate(eddFromGestationalAge(w, dd, now));
        } else {
          const ms = parseLocalIsoDate(f.dueDate ?? '');
          const prog = ms !== null ? pregnancyProgress({ kind: 'edd', eddMs: ms }, Date.now()) : null;
          if (!prog) return setFormError(tx('That due date does not fit a current pregnancy.', 'Tarehe hiyo haiendani na mimba ya sasa.'));
          delete next.gaWeeks;
          delete next.gaDays;
          delete next.gaRecordedOnMs;
          next.expectedDeliveryDate = f.dueDate!;
          next.gestationWeeks = prog.weeks;
        }
        if (f.first) next.firstPregnancy = f.first === 'yes';
        opt('previousPregnancies', f.first === 'no' && f.previous ? Number(f.previous) : undefined);
      }
    }
    if (editing === 'health') {
      if (isContradictory(allergyDraft)) return setFormError(tx('"No known allergies" cannot be picked with an allergy.', '"Hakuna mzio" haiwezi kuchaguliwa pamoja na mzio.'));
      const withA = withAllergies(next, allergyDraft);
      delete next.allergies;
      delete next.allergyList;
      delete next.noKnownAllergies;
      Object.assign(next, withA);
      opt('conditions', split(f.conditions ?? ''));
      opt('medications', split(f.medications ?? ''));
      opt('healthNotes', f.notes?.trim());
    }
    if (editing === 'provider') {
      opt('facilityName', f.facility?.trim());
      opt('nurseName', f.nurse?.trim());
      next.birthPlan = { ...plan, ...(f.birthFacility?.trim() ? { facility: f.birthFacility.trim() } : {}) };
      if (!f.birthFacility?.trim()) delete next.birthPlan.facility;
    }
    await persist(next, editing!);
  }

  async function togglePlan(key: keyof Omit<BirthPlan, 'facility'>) {
    await persist({ ...p, birthPlan: { ...plan, [key]: !plan[key] } }, 'plan');
  }




  const field = (key: string, label: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}, required = false) => (
    <div className="field">
      <label htmlFor={`pf-${key}`}>
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <input id={`pf-${key}`} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...extra} />
    </div>
  );

  const editActions = (
    <>
      {formError ? (
        <p className="field-error" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="prof-edit-btns">
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
          {tx('Cancel', 'Ghairi')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void saveSection()}>
          {tx('Save', 'Hifadhi')}
        </button>
      </div>
    </>
  );

  const MODE = { vaginal: tx('Normal birth', 'Kawaida'), assisted: tx('Assisted', 'Kwa kusaidiwa'), caesarean: tx('Caesarean', 'Upasuaji') } as const;
  const COMP = {
    heavy_bleeding: tx('Heavy bleeding', 'Damu nyingi'),
    high_bp: tx('High blood pressure', 'Shinikizo la juu'),
    transfusion: tx('Blood transfusion', 'Kuongezewa damu'),
    infection: tx('Fever or infection', 'Homa au maambukizi'),
    long_labour: tx('Long or difficult labour', 'Uchungu mrefu'),
  } as const;

  function BirthSection() {
    if (!delivery) {
      return (
        <Section id="birth" title={tx('Birth', 'Kujifungua')}>
          <p className="prof-warn">{tx('Birth date not added yet.', 'Tarehe ya kuzaliwa haijaongezwa.')}</p>
          <Row label={tx('Add birth details', 'Ongeza maelezo ya kujifungua')} onClick={() => nav('/record-birth')} />
        </Section>
      );
    }
    return (
      <Section id="birth" title={tx('Birth', 'Kujifungua')}>
        <dl className="prof-dl">
          <Item k={tx('Born on', 'Alizaliwa')} v={`${d(deliveryMsOf(p) ?? 0)}${delivery.time ? ` · ${delivery.time}` : ''}`} />
          <Item k={tx('How', 'Jinsi')} v={MODE[delivery.mode]} />
          <Item k={tx('Where', 'Wapi')} v={delivery.place === 'facility' ? delivery.facilityName || tx('Health facility', 'Kituo cha afya') : delivery.place === 'home' ? tx('Home', 'Nyumbani') : delivery.place === 'on_the_way' ? tx('On the way', 'Njiani') : ''} />
          <Item k={tx('During birth', 'Wakati wa kujifungua')} v={[...delivery.complications.map((c) => COMP[c]), delivery.otherComplication ?? ''].filter(Boolean).join(', ') || tx('Nothing recorded', 'Hakuna kilichoandikwa')} />
          <Item k={tx('Babies', 'Watoto')} v={babyList || String(delivery.babiesCount)} />
          <Item
            k={tx('Recorded by', 'Imeandikwa na')}
            v={delivery.recordedBy.role === 'self' ? tx('Herself', 'Mwenyewe') : `${delivery.recordedBy.name ?? ''} (${delivery.recordedBy.role === 'nurse' ? tx('nurse', 'muuguzi') : 'CHW'})`}
          />
        </dl>
        <label className="row-divided">
          <input
            type="checkbox"
            checked={delivery.showBabyInfo}
            onChange={async (e) => {
              await setShowBabyInfo(e.target.checked);
              await reload();
            }}
          />
          <span>{tx("Show baby care tips on my dashboard", 'Onyesha vidokezo vya kumtunza mtoto kwenye ukurasa wangu')}</span>
        </label>
        <Row label={tx('Edit birth details', 'Badilisha maelezo ya kujifungua')} onClick={() => nav('/record-birth')} />
        {confirmUndo ? (
          <div className="prof-danger" role="alertdialog" aria-labelledby="undo-title">
            <strong id="undo-title">{tx('Undo the birth record?', 'Futa rekodi ya kujifungua?')}</strong>
            <p>{tx('Use this only if it was recorded by mistake. Neema goes back to pregnancy care. Your check-ins and readings stay saved.', 'Tumia hii tu kama iliandikwa kwa makosa. Neema atarudi kwenye huduma ya mimba. Ukaguzi na vipimo vyako vinabaki.')}</p>
            <div className="prof-edit-btns">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmUndo(false)}>
                {tx('Keep it', 'Iache')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await undoDelivery();
                  await g.refreshTriage();
                  setConfirmUndo(false);
                  await reload();
                }}
              >
                {tx('Undo', 'Futa')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="prof-delete" onClick={() => setConfirmUndo(true)}>
            {tx('Recorded by mistake? Undo', 'Imeandikwa kwa makosa? Futa')}
          </button>
        )}
      </Section>
    );
  }

  const babyList = babies
    .filter((b) => b.birthDateIso === delivery?.dateIso)
    .map((b, i) => b.name || tx(`Baby ${i + 1}`, `Mtoto ${i + 1}`))
    .join(', ');
  const chp = contacts.find((c) => c.role === 'chp');
  const family = contacts.filter((c) => c.role === 'family');
  const registrar = p.registeredBy;

  return (
    <main className="screen prof">
      <button type="button" className="n-link prof-back" onClick={() => nav('/settings')}>
        ‹ {tx('Settings', 'Mipangilio')}
      </button>
      <header className="prof-id">
        <span className="prof-id__avatar" aria-hidden>
          {(p.displayName || 'M').charAt(0).toUpperCase()}
        </span>
        <div>
          <h1>{p.displayName || tx('Your profile', 'Wasifu wako')}</h1>
          <p>
            {preg
              ? tx(`Week ${preg.weeks} · due ${d(preg.eddMs)}`, `Wiki ${preg.weeks} · kujifungua ${d(preg.eddMs)}`)
              : after
                ? recovery
                  ? tx(`Day ${recovery.daysSinceBirth} of recovery · baby born ${d(deliveryMsOf(p) ?? 0)}`, `Siku ${recovery.daysSinceBirth} ya kupona · mtoto alizaliwa ${d(deliveryMsOf(p) ?? 0)}`)
                  : tx('After birth', 'Baada ya kujifungua')
                : tx('Pregnancy dates not added', 'Tarehe za mimba hazijaongezwa')}
          </p>
        </div>
      </header>

      {saved ? (
        <p className="prof-saved" role="status">
          {tx('Saved on this phone.', 'Imehifadhiwa kwenye simu hii.')}
        </p>
      ) : null}

      {/* Personal */}
      <Section id="personal" title={tx('Personal details', 'Maelezo binafsi')} onEdit={editing ? undefined : () => startEdit('personal')} editLabel={tx('Edit', 'Badilisha')}>
        {editing === 'personal' ? (
          <>
            {field('fullName', tx('Full name', 'Jina kamili'), { autoComplete: 'name' }, true)}
            {field('displayName', tx('Name Neema uses', 'Jina Neema hutumia'))}
            {field('dateOfBirth', tx('Date of birth', 'Tarehe ya kuzaliwa'), { type: 'date', max: toLocalIsoDate(Date.now()) })}
            {field('phone', tx('Phone', 'Simu'), { type: 'tel', inputMode: 'tel', placeholder: '0712 345 678' })}
            {field('location', tx('Village / estate', 'Kijiji / mtaa'))}
            {editActions}
          </>
        ) : (
          <dl className="prof-dl">
            <Item k={tx('Name', 'Jina')} v={[p.displayName, p.fullName && p.fullName !== p.displayName ? `(${p.fullName})` : ''].filter(Boolean).join(' ')} />
            <Item k={tx('Born', 'Alizaliwa')} v={p.dateOfBirth ? d(parseLocalIsoDate(p.dateOfBirth) ?? Date.parse(p.dateOfBirth)) : ''} />
            <Item k={tx('Phone', 'Simu')} v={p.phoneForAlerts ?? ''} />
            <Item k={tx('Place', 'Mahali')} v={p.location ?? ''} />
            <Item
              k={tx('Registered by', 'Amesajiliwa na')}
              v={registrar ? (registrar.role === 'self' ? tx('Herself', 'Mwenyewe') : `${registrar.name ?? ''} (${registrar.role === 'nurse' ? tx('nurse', 'muuguzi') : 'CHW'})`) : ''}
            />
          </dl>
        )}
      </Section>

      {/* Pregnancy */}
      {after ? <BirthSection /> : null}

      <Section
        id="pregnancy"
        title={after ? tx('Pregnancy (completed)', 'Mimba (imekamilika)') : tx('Pregnancy', 'Mimba')}
        onEdit={editing || after ? undefined : () => startEdit('pregnancy')}
        editLabel={tx('Edit', 'Badilisha')}
      >
        {editing === 'pregnancy' ? (
          <>
            {form.stage === 'pregnancy' ? (
              <>
                <div className="field">
                  <label htmlFor="pf-mode">{tx('I know my…', 'Najua…')}</label>
                  <select id="pf-mode" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                    <option value="weeks">{tx('weeks today (from clinic)', 'wiki za leo (kutoka kliniki)')}</option>
                    <option value="due">{tx('due date', 'tarehe ya kujifungua')}</option>
                  </select>
                </div>
                {form.mode === 'weeks' ? (
                  <div className="reg-ga">
                    {field('gaWeeks', tx('Weeks', 'Wiki'), { type: 'number', inputMode: 'numeric', min: 1, max: 42 })}
                    {field('gaDays', tx('Days', 'Siku'), { type: 'number', inputMode: 'numeric', min: 0, max: 6 })}
                  </div>
                ) : (
                  field('dueDate', tx('Due date', 'Tarehe ya kujifungua'), { type: 'date' })
                )}
                <div className="field">
                  <label htmlFor="pf-first">{tx('First pregnancy?', 'Mimba ya kwanza?')}</label>
                  <select id="pf-first" value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })}>
                    <option value="">—</option>
                    <option value="yes">{tx('Yes', 'Ndiyo')}</option>
                    <option value="no">{tx('No', 'Hapana')}</option>
                  </select>
                </div>
                {form.first === 'no' ? field('previous', tx('Pregnancies before', 'Mimba kabla'), { type: 'number', inputMode: 'numeric', min: 1, max: 20 }) : null}
              </>
            ) : null}
            {editActions}
          </>
        ) : (
          <dl className="prof-dl">
            {after ? (
              <>
                <Item k={tx('Due date was', 'Tarehe ilikuwa')} v={p.expectedDeliveryDate ? d(parseLocalIsoDate(p.expectedDeliveryDate) ?? 0) : ''} />
                <Item
                  k={tx('Length at birth', 'Muda wakati wa kuzaliwa')}
                  v={delivery?.gestationAtBirth ? tx(`${delivery.gestationAtBirth.weeks} weeks ${delivery.gestationAtBirth.days} days`, `wiki ${delivery.gestationAtBirth.weeks} siku ${delivery.gestationAtBirth.days}`) : ''}
                />
              </>
            ) : (
              <>
                <Item k={tx('Today', 'Leo')} v={preg ? tx(`${preg.weeks} weeks ${preg.days} days · trimester ${preg.trimester}`, `wiki ${preg.weeks} siku ${preg.days} · kipindi ${preg.trimester}`) : tx('Not added', 'Haijaongezwa')} />
                <Item k={tx('Due', 'Kujifungua')} v={preg ? d(preg.eddMs) : ''} />
              </>
            )}
            <Item k={tx('First pregnancy', 'Mimba ya kwanza')} v={p.firstPregnancy === undefined ? '' : p.firstPregnancy ? tx('Yes', 'Ndiyo') : tx('No', 'Hapana')} />
            <Item k={tx('Before', 'Kabla')} v={p.previousPregnancies !== undefined ? String(p.previousPregnancies) : ''} />
          </dl>
        )}
        {!after && !editing ? <Row label={tx('My baby has arrived: record the birth', 'Mtoto amefika: andika kujifungua')} onClick={() => nav('/record-birth')} /> : null}
      </Section>

      {/* Contacts */}
      <Section id="contacts" title={tx('Emergency contacts', 'Watu wa dharura')}>
        {chp && !isPlaceholderPhone(chp.phone) ? (
          <p className="prof-contact">
            <strong>CHP</strong> {chp.name} · {chp.phone}
          </p>
        ) : (
          <p className="prof-warn">{tx('No CHP number: alerts will reach no one.', 'Hakuna namba ya CHP: tahadhari haitamfikia mtu.')}</p>
        )}
        {family.map((c) => (
          <p key={c.id} className="prof-contact">
            <strong>{tx('Family', 'Familia')}</strong> {c.name} · {c.phone}
          </p>
        ))}
        <Row label={tx('Manage contacts', 'Simamia watu')} onClick={() => nav('/contacts')} />
      </Section>

      {/* Health history */}
      <Section id="health" title={tx('Health notes', 'Maelezo ya afya')} onEdit={editing ? undefined : () => startEdit('health')} editLabel={tx('Edit', 'Badilisha')}>
        {editing === 'health' ? (
          <>
            {field('conditions', tx('Conditions (commas)', 'Magonjwa (koma)'))}
            <AllergyPicker idPrefix="pf-alg" lang={lang} value={allergyDraft} onChange={setAllergyDraft} />
            {field('medications', tx('Medicines', 'Dawa'))}
            <div className="field">
              <label htmlFor="pf-notes">{tx('My notes', 'Maelezo yangu')}</label>
              <textarea id="pf-notes" rows={3} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {editActions}
          </>
        ) : (
          <dl className="prof-dl">
            <Item k={tx('Conditions', 'Magonjwa')} v={list(p.conditions)} />
            <Item k={tx('Past problems', 'Matatizo ya zamani')} v={list(p.pastComplications)} />
            <Item
              k={tx('Allergies', 'Mzio')}
              v={(() => {
                const a = allergyAnswerOf(p);
                return a.noneKnown ? tx('No known allergies', 'Hakuna mzio unaojulikana') : a.items.map((e) => allergyLabel(e, lang)).join(' · ');
              })()}
            />
            <Item k={tx('Medicines', 'Dawa')} v={list(p.medications)} />
            <Item k={tx('My notes', 'Maelezo yangu')} v={p.healthNotes ?? ''} />
          </dl>
        )}
        <Row label={tx('Mood check (EPDS)', 'Kipimo cha hisia (EPDS)')} sub={epdsAt ? tx(`Last: ${d(epdsAt)}`, `Mwisho: ${d(epdsAt)}`) : undefined} onClick={() => nav('/epds')} />
      </Section>

      {/* Clinical notes (read-only) */}
      <Section id="clinical" title={tx('Notes from your nurse', 'Maelezo ya muuguzi')}>
        <p className="prof-sub">{tx('Only your health team can add these. You can read them.', 'Timu ya afya pekee ndio huongeza haya. Unaweza kuyasoma.')}</p>
        {clinical.length === 0 ? (
          <p className="hist-empty">{tx('None yet.', 'Bado hakuna.')}</p>
        ) : (
          <ul className="hist-notes">
            {clinical.slice(0, 3).map((n) => (
              <li key={n.id}>
                <p>{n.text}</p>
                <span>
                  {n.authorName} · {d(n.tsMs)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {clinical.length > 3 ? <Row label={tx('See all notes', 'Ona maelezo yote')} onClick={() => nav('/history#notes')} /> : null}
      </Section>

      {/* Birth plan */}
      <Section id="birth-plan" title={tx('Birth plan', 'Mpango wa kujifungua')}>
        <p className="prof-sub">{tx('Tick what is ready. This is a checklist, not a risk score.', 'Weka alama kilicho tayari. Hii ni orodha, si kipimo cha hatari.')}</p>
        {(
          [
            ['skilledAttendant', tx('Birth with a skilled health worker', 'Kujifungua na mhudumu mwenye ujuzi')],
            ['transport', tx('Transport arranged', 'Usafiri umepangwa')],
            ['savings', tx('Money saved', 'Pesa zimewekwa akiba')],
            ['companion', tx('Companion chosen', 'Mwandani amechaguliwa')],
            ['bloodDonor', tx('Possible blood donor', 'Mtoaji damu anayewezekana')],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="row-divided">
            <input type="checkbox" checked={plan[key]} onChange={() => void togglePlan(key)} />
            <span>{label}</span>
          </label>
        ))}
      </Section>

      {/* Provider */}
      <Section id="provider" title={tx('Clinic and nurse', 'Kliniki na muuguzi')} onEdit={editing ? undefined : () => startEdit('provider')} editLabel={tx('Edit', 'Badilisha')}>
        {editing === 'provider' ? (
          <>
            {field('facility', tx('Clinic', 'Kliniki'))}
            {field('nurse', tx('Nurse / midwife', 'Muuguzi / mkunga'))}
            {field('birthFacility', tx('Where you plan to give birth', 'Mahali unapanga kujifungua'))}
            {editActions}
          </>
        ) : (
          <dl className="prof-dl">
            <Item k={tx('Clinic', 'Kliniki')} v={p.facilityName ?? ''} />
            <Item k={tx('Nurse', 'Muuguzi')} v={p.nurseName ?? ''} />
            <Item k={tx('Birth place', 'Mahali pa kujifungua')} v={plan.facility ?? ''} />
          </dl>
        )}
      </Section>

    </main>
  );
}

function Section({ id, title, onEdit, editLabel, children }: { id: string; title: string; onEdit?: (() => void) | undefined; editLabel?: string; children: ReactNode }) {
  return (
    <section id={id} className="home-card prof-sec" aria-labelledby={`${id}-h`}>
      <div className="hist-head">
        <h2 id={`${id}-h`}>{title}</h2>
        {onEdit ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
            {editLabel}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="prof-dl__row">
      <dt>{k}</dt>
      <dd>{v || '—'}</dd>
    </div>
  );
}

function Row({ label, sub, onClick }: { label: string; sub?: string | undefined; onClick: () => void }) {
  return (
    <button type="button" className="prof-row" onClick={onClick}>
      <span>
        {label}
        {sub ? <small>{sub}</small> : null}
      </span>
      <IconChevron />
    </button>
  );
}
