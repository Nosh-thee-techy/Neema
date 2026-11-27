import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  isPlaceholderPhone,
  isValidGestationalAge,
  normalizePhone,
  parseLocalIsoDate,
  pregnancyProgress,
  toLocalIsoDate,
  eddFromGestationalAge,
  type BirthPlan,
  type Contact,
} from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { LangToggle } from '../ui/LangToggle';
import { IconChevron } from '../ui/icons';
import { EMPTY_BIRTH_PLAN, loadConsent, loadProfile, saveConsent, saveProfile, type MamaProfile } from '../services/passport';
import { listContacts } from '../services/contacts';
import { listClinicalNotes, type ClinicalNoteRow } from '../services/clinicalNotes';
import { progressFromProfile } from '../services/pregnancyProgress';
import { lockSession } from '../services/auth';
import { latestEpds } from '../services/epdsStore';
import { db, type ConsentRow } from '../storage/db';
import { saveOnboarding } from '../hooks/useOnboarding';

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
  const [consent, setConsent] = useState<ConsentRow | null>(null);
  const [epdsAt, setEpdsAt] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const taps = useRef<number[]>([]);

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
  const preg = progressFromProfile(p);
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
      setForm({ conditions: list(p.conditions), allergies: list(p.allergies), medications: list(p.medications), notes: p.healthNotes ?? '' });
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
      if (!f.displayName?.trim()) return setFormError(tx('Please enter a name.', 'Tafadhali andika jina.'));
      if (f.phone?.trim()) {
        const n = normalizePhone(f.phone);
        if (!n || isPlaceholderPhone(n)) return setFormError(tx('Check the phone number.', 'Angalia namba ya simu.'));
        next.phoneForAlerts = n;
      } else delete next.phoneForAlerts;
      next.displayName = f.displayName.trim();
      opt('fullName', f.fullName?.trim());
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
      opt('conditions', split(f.conditions ?? ''));
      opt('allergies', split(f.allergies ?? ''));
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

  async function toggleShare(key: 'chp' | 'family' | 'nurse') {
    if (!consent) return;
    const sharing = { ...consent.sharing, [key]: !consent.sharing[key] };
    if (!sharing.chp && !sharing.family) {
      setSaved(null);
      setFormError(tx('At least the CHP or family must be able to get alerts.', 'Angalau CHP au familia lazima wapate tahadhari.'));
      return;
    }
    setFormError(null);
    const row = await saveConsent({ version: consent.version, language: lang, agreedAtMs: Date.now(), sharing });
    setConsent(row);
  }

  async function deleteEverything() {
    await db.delete();
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* storage may be unavailable */
    }
    saveOnboarding({ orientationDone: false, consentDone: false });
    window.location.assign('/start');
  }

  /** Hidden entry for the health team: tap the version line 5 times within 3 seconds. */
  function versionTap() {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      nav('/team');
    }
  }

  const field = (key: string, label: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <div className="field">
      <label htmlFor={`pf-${key}`}>{label}</label>
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

  const chp = contacts.find((c) => c.role === 'chp');
  const family = contacts.filter((c) => c.role === 'family');
  const registrar = p.registeredBy;

  return (
    <main className="screen prof">
      <header className="prof-id">
        <span className="prof-id__avatar" aria-hidden>
          {(p.displayName || 'M').charAt(0).toUpperCase()}
        </span>
        <div>
          <h1>{p.displayName || tx('Your profile', 'Wasifu wako')}</h1>
          <p>
            {preg
              ? tx(`Week ${preg.weeks} · due ${d(preg.eddMs)}`, `Wiki ${preg.weeks} · kujifungua ${d(preg.eddMs)}`)
              : p.stage === 'postpartum'
                ? tx('After birth', 'Baada ya kujifungua')
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
            {field('displayName', tx('Name Neema uses', 'Jina Neema hutumia'))}
            {field('fullName', tx('Full name', 'Jina kamili'))}
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
      <Section id="pregnancy" title={tx('Pregnancy', 'Mimba')} onEdit={editing ? undefined : () => startEdit('pregnancy')} editLabel={tx('Edit', 'Badilisha')}>
        {editing === 'pregnancy' ? (
          <>
            <div className="field">
              <label htmlFor="pf-stage">{tx('Stage', 'Hatua')}</label>
              <select id="pf-stage" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                <option value="pregnancy">{tx('Pregnant now', 'Mjamzito sasa')}</option>
                <option value="postpartum">{tx('Gave birth recently', 'Amejifungua karibuni')}</option>
              </select>
            </div>
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
            <Item k={tx('Today', 'Leo')} v={preg ? tx(`${preg.weeks} weeks ${preg.days} days · trimester ${preg.trimester}`, `wiki ${preg.weeks} siku ${preg.days} · kipindi ${preg.trimester}`) : p.stage === 'postpartum' ? tx('After birth', 'Baada ya kujifungua') : tx('Not added', 'Haijaongezwa')} />
            <Item k={tx('Due', 'Kujifungua')} v={preg ? d(preg.eddMs) : ''} />
            <Item k={tx('First pregnancy', 'Mimba ya kwanza')} v={p.firstPregnancy === undefined ? '' : p.firstPregnancy ? tx('Yes', 'Ndiyo') : tx('No', 'Hapana')} />
            <Item k={tx('Before', 'Kabla')} v={p.previousPregnancies !== undefined ? String(p.previousPregnancies) : ''} />
          </dl>
        )}
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
            {field('allergies', tx('Allergies', 'Mzio'))}
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
            <Item k={tx('Allergies', 'Mzio')} v={list(p.allergies)} />
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
        <Row
          label={tx('Show my summary to the nurse (QR)', 'Onyesha muhtasari kwa muuguzi (QR)')}
          sub={tx('The nurse scans it at your visit. Nothing is sent over the internet.', 'Muuguzi anaskani kwenye ziara. Hakuna kinachotumwa mtandaoni.')}
          onClick={() => nav('/summary')}
        />
      </Section>

      {/* Band */}
      <Section id="band" title={tx('Your band', 'Bendi yako')}>
        <p className="prof-contact">
          <span className="prof-dot" data-on={g.connected} aria-hidden />
          {g.connected
            ? g.bandMode === 'simulator'
              ? tx('Practice band connected', 'Bendi ya mazoezi imeunganishwa')
              : tx('Band connected', 'Bendi imeunganishwa')
            : tx('Not connected', 'Haijaunganishwa')}
          {g.connected && g.sample?.batteryPct != null ? ` · ${tx('battery', 'betri')} ${g.sample.batteryPct}%` : ''}
        </p>
        <details className="prof-help">
          <summary>{tx('Band not working?', 'Bendi haifanyi kazi?')}</summary>
          <ul>
            <li>{tx('Wear it snug on the wrist, above the wrist bone.', 'Ivae imebana kidogo juu ya kifundo cha mkono.')}</li>
            <li>{tx('Keep the phone within a few metres, with Bluetooth on.', 'Weka simu karibu, Bluetooth ikiwa imewashwa.')}</li>
            <li>{tx('Charge it if the battery is low.', 'Ichaji betri ikiwa chini.')}</li>
            <li>{tx('If readings stop, Neema shows “waiting for signal”. Add a BP reading meanwhile.', 'Vipimo vikisimama, Neema anaonyesha “inasubiri ishara”. Ongeza shinikizo wakati huo.')}</li>
          </ul>
        </details>
        <Row label={tx('Open band', 'Fungua bendi')} onClick={() => nav('/vitals')} />
      </Section>

      {/* Account */}
      <Section id="account" title={tx('Account and privacy', 'Akaunti na faragha')}>
        <div className="prof-line">
          <span>{tx('Language', 'Lugha')}</span>
          <LangToggle />
        </div>
        <Row label={tx('How Neema talks to me (text, voice, sign)', 'Neema anavyozungumza nami (maandishi, sauti, ishara)')} onClick={() => nav('/talk')} />
        <Row label={tx('Change PIN', 'Badilisha PIN')} onClick={() => nav('/unlock?change=1')} />
        <Row
          label={tx('Lock Neema now', 'Funga Neema sasa')}
          onClick={() => {
            lockSession();
            nav('/unlock');
          }}
        />
        <div className="prof-line prof-line--muted">
          <span>{tx('Reminders and notifications', 'Vikumbusho na arifa')}</span>
          <span className="prof-tag">{tx('Not available yet', 'Bado haipatikani')}</span>
        </div>

        <h3 className="prof-h3">{tx('Who may get an alert', 'Nani apate tahadhari')}</h3>
        {consent ? (
          (
            [
              ['chp', tx('Community health promoter (CHP)', 'Mhudumu wa afya ya jamii (CHP)')],
              ['family', tx('Family contact', 'Mwanafamilia')],
              ['nurse', tx('Nurse at clinic visits', 'Muuguzi kliniki')],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="row-divided">
              <input type="checkbox" checked={consent.sharing[key]} onChange={() => void toggleShare(key)} />
              <span>{label}</span>
            </label>
          ))
        ) : (
          <p className="prof-warn">{tx('No consent on file.', 'Hakuna idhini.')}</p>
        )}
        {formError && !editing ? (
          <p className="field-error" role="alert">
            {formError}
          </p>
        ) : null}
        <p className="prof-sub">
          {tx(
            'Readings stay on this phone. An alert SMS goes only to the people ticked. Voice and chat questions are sent online to be answered.',
            'Vipimo vinabaki kwenye simu hii. SMS ya tahadhari huenda kwa waliowekewa alama tu. Maswali ya sauti na gumzo hutumwa mtandaoni kujibiwa.',
          )}
        </p>

        {confirmDelete ? (
          <div className="prof-danger" role="alertdialog" aria-labelledby="del-title">
            <strong id="del-title">{tx('Delete everything on this phone?', 'Futa kila kitu kwenye simu hii?')}</strong>
            <p>
              {tx(
                'Your profile, readings, alerts, contacts and notes will be removed. This cannot be undone.',
                'Wasifu, vipimo, tahadhari, watu na maelezo vitafutwa. Haiwezi kurudishwa.',
              )}
            </p>
            <div className="prof-edit-btns">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                {tx('Keep my data', 'Baki na data')}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void deleteEverything()}>
                {tx('Delete', 'Futa')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="prof-delete" onClick={() => setConfirmDelete(true)}>
            {tx('Delete my data', 'Futa data yangu')}
          </button>
        )}
      </Section>

      <p className="prof-version" onClick={versionTap}>
        Neema · {tx('decision support, not a diagnosis', 'msaada wa maamuzi, si utambuzi')} · v{import.meta.env.VITE_APP_VERSION ?? '0.3'}
      </p>
    </main>
  );
}

function Section({ id, title, onEdit, editLabel, children }: { id: string; title: string; onEdit?: (() => void) | undefined; editLabel?: string; children: ReactNode }) {
  return (
    <section id={id} className="home-card prof-sec" aria-labelledby={`${id}-h`}>
      <div className="hist-head">
        <h2 id={`${id}-h`}>{title}</h2>
        {onEdit ? (
          <button type="button" className="home-link" onClick={onEdit}>
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
