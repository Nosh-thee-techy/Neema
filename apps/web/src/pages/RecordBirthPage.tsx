import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { parseLocalIsoDate, toLocalIsoDate } from '@neema/core';
import { useLocale } from '../hooks/useLocale';
import { useGuardian } from '../hooks/useGuardian';
import { Segmented } from '../ui/Segmented';
import { FieldError, FormField, RequiredMark, invalidProps } from '../ui/FormField';
import { loadProfile, type DeliveryComplication, type DeliveryMode, type MamaProfile, type RegistrarRole } from '../services/passport';
import { listBabies, recordDelivery } from '../services/delivery';

const DAY = 86_400_000;

const COMPLICATIONS: Array<{ key: DeliveryComplication; en: string; sw: string }> = [
  { key: 'heavy_bleeding', en: 'Heavy bleeding', sw: 'Kutokwa damu nyingi' },
  { key: 'high_bp', en: 'High blood pressure / pre-eclampsia', sw: 'Shinikizo la juu / kifafa cha mimba' },
  { key: 'transfusion', en: 'Needed a blood transfusion', sw: 'Aliongezewa damu' },
  { key: 'infection', en: 'Fever or infection', sw: 'Homa au maambukizi' },
  { key: 'long_labour', en: 'Very long or difficult labour', sw: 'Uchungu mrefu au mgumu sana' },
];

/**
 * "My baby has arrived": records the birth and moves Neema from pregnancy to recovery.
 * The mother, a CHW or a nurse can fill it in. Nothing about the pregnancy is deleted.
 */
export function RecordBirthPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const g = useGuardian();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);
  const today = toLocalIsoDate(Date.now());

  const [profile, setProfile] = useState<MamaProfile | null>(null);
  const [role, setRole] = useState<RegistrarRole>((params.get('by') as RegistrarRole) || 'self');
  const [recorder, setRecorder] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [mode, setMode] = useState<DeliveryMode | ''>('');
  const [place, setPlace] = useState<'facility' | 'home' | 'on_the_way' | ''>('');
  const [facility, setFacility] = useState('');
  const [complications, setComplications] = useState<DeliveryComplication[]>([]);
  const [other, setOther] = useState('');
  const [count, setCount] = useState<'1' | '2' | '3'>('1');
  const [names, setNames] = useState<string[]>(['', '', '']);
  const [showBaby, setShowBaby] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Editing an existing record: prefill.
  useEffect(() => {
    void (async () => {
      const p = await loadProfile().catch(() => null);
      setProfile(p);
      const d = p?.delivery;
      if (!d) return;
      setDate(d.dateIso);
      setTime(d.time ?? '');
      setMode(d.mode);
      setPlace(d.place ?? '');
      setFacility(d.facilityName ?? '');
      setComplications(d.complications);
      setOther(d.otherComplication ?? '');
      setCount(String(Math.min(3, Math.max(1, d.babiesCount))) as '1' | '2' | '3');
      setShowBaby(d.showBabyInfo);
      setRole(d.recordedBy.role);
      setRecorder(d.recordedBy.name ?? '');
      const babies = await listBabies();
      setNames([0, 1, 2].map((i) => babies.filter((b) => b.birthDateIso === d.dateIso)[i]?.name ?? ''));
    })();
  }, []);

  const editing = Boolean(profile?.delivery);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (role !== 'self' && !recorder.trim()) e.recorder = tx('Enter your name so the record shows who recorded the birth.', 'Andika jina lako ili ijulikane nani aliandika kujifungua.');
    const ms = parseLocalIsoDate(date);
    if (!date || ms === null) e.date = tx("Enter the date your baby was born.", 'Andika tarehe mtoto alizaliwa.');
    else if (ms > Date.now()) e.date = tx('The birth date cannot be in the future.', 'Tarehe ya kuzaliwa haiwezi kuwa ya baadaye.');
    else if (Date.now() - ms > 365 * DAY) e.date = tx('That date is more than a year ago. Check the date.', 'Tarehe hiyo ni zaidi ya mwaka mmoja uliopita. Angalia tarehe.');
    if (!mode) e.mode = tx('Choose how your baby was born.', 'Chagua jinsi mtoto alivyozaliwa.');
    return e;
  }

  async function save() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      await recordDelivery(
        {
          dateIso: date,
          ...(time ? { time } : {}),
          mode: mode as DeliveryMode,
          ...(place ? { place } : {}),
          ...(facility.trim() ? { facilityName: facility.trim() } : {}),
          complications,
          ...(other.trim() ? { otherComplication: other.trim() } : {}),
          babiesCount: Number(count),
          showBabyInfo: showBaby,
          recordedBy: { role, ...(recorder.trim() ? { name: recorder.trim() } : {}) },
        },
        names.slice(0, Number(count)),
      );
      await g.refreshTriage(); // rules now use the after-birth stage
      nav('/home', { replace: true, state: { welcomeRecovery: !editing } });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k];

  return (
    <main className="screen birth">
      <h1 className="screen-title">{editing ? tx('Birth details', 'Maelezo ya kujifungua') : tx('Your baby has arrived', 'Mtoto wako amefika')}</h1>
      <p className="screen-sub">
        {editing
          ? tx('Correct anything that is wrong. Your pregnancy history stays saved.', 'Rekebisha kilicho kibaya. Historia ya mimba yako inabaki.')
          : tx(
              'Congratulations. Tell Neema about the birth and it will start caring for your recovery. Your pregnancy history stays saved.',
              'Hongera. Mwambie Neema kuhusu kujifungua na ataanza kukusaidia kupona. Historia ya mimba yako inabaki.',
            )}
      </p>

      <section className="reg-card">
        <p className="n-legend">
          <RequiredMark /> {tx('= required', '= lazima')}
        </p>

        <div className="field">
          <span className="n-label">{tx('Who is recording this?', 'Nani anaandika haya?')}</span>
          <Segmented
            ariaLabel={tx('Who is recording', 'Nani anaandika')}
            value={role}
            onChange={setRole}
            options={[
              { value: 'self', label: tx('Me (mother)', 'Mimi (mama)') },
              { value: 'chw', label: 'CHW' },
              { value: 'nurse', label: tx('Nurse', 'Muuguzi') },
            ]}
          />
        </div>
        {role !== 'self' ? (
          <FormField id="birth-recorder" label={tx('Your name', 'Jina lako')} required error={err('recorder')}>
            <input id="birth-recorder" value={recorder} onChange={(e) => setRecorder(e.target.value)} {...invalidProps('birth-recorder', err('recorder'))} />
          </FormField>
        ) : null}

        <div className="reg-ga">
          <FormField id="birth-date" label={tx('Date of birth', 'Tarehe ya kuzaliwa')} required error={err('date')}>
            <input id="birth-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} {...invalidProps('birth-date', err('date'))} />
          </FormField>
          <FormField id="birth-time" label={tx('Time', 'Saa')} optionalText={tx('optional', 'si lazima')}>
            <input id="birth-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </FormField>
        </div>

        <div className="field">
          <span className="n-label">
            {tx('How was your baby born?', 'Mtoto alizaliwa vipi?')}
            <RequiredMark />
          </span>
          <Segmented
            ariaLabel={tx('How the baby was born', 'Jinsi mtoto alivyozaliwa')}
            value={mode}
            onChange={setMode}
            invalid={Boolean(err('mode'))}
            describedBy={err('mode') ? 'birth-mode-error' : undefined}
            options={[
              { value: 'vaginal', label: tx('Normal birth', 'Kawaida') },
              { value: 'assisted', label: tx('Assisted (vacuum)', 'Kwa kusaidiwa') },
              { value: 'caesarean', label: tx('Caesarean', 'Upasuaji') },
            ]}
          />
          {err('mode') ? <FieldError id="birth-mode-error" message={err('mode')!} /> : null}
          <p className="n-hint">{tx('This changes the recovery advice (for example, caring for a caesarean wound).', 'Hii hubadilisha ushauri wa kupona (kwa mfano, kutunza kidonda cha upasuaji).')}</p>
        </div>

        <div className="field">
          <span className="n-label">
            {tx('Where?', 'Wapi?')} <span className="n-optional">{tx('optional', 'si lazima')}</span>
          </span>
          <Segmented
            ariaLabel={tx('Where the baby was born', 'Mahali mtoto alipozaliwa')}
            value={place}
            onChange={setPlace}
            options={[
              { value: 'facility', label: tx('Health facility', 'Kituo cha afya') },
              { value: 'home', label: tx('Home', 'Nyumbani') },
              { value: 'on_the_way', label: tx('On the way', 'Njiani') },
            ]}
          />
        </div>
        {place === 'facility' ? (
          <FormField id="birth-fac" label={tx('Facility name', 'Jina la kituo')} optionalText={tx('optional', 'si lazima')}>
            <input id="birth-fac" value={facility} onChange={(e) => setFacility(e.target.value)} />
          </FormField>
        ) : null}
        {place === 'home' || place === 'on_the_way' ? (
          <p className="soft-note reg-warn">
            {tx(
              'Please see a health worker within 24 hours of birth, for you and your baby. Your CHP can help.',
              'Tafadhali onana na mhudumu wa afya ndani ya saa 24 baada ya kujifungua, kwa ajili yako na mtoto. CHP wako anaweza kusaidia.',
            )}
          </p>
        ) : null}

        <p className="n-label">
          {tx('Did any of these happen during or after the birth?', 'Je, lolote kati ya haya lilitokea wakati au baada ya kujifungua?')}{' '}
          <span className="n-optional">{tx('optional', 'si lazima')}</span>
        </p>
        <div className="chip-grid">
          {COMPLICATIONS.map((c) => (
            <button
              key={c.key}
              type="button"
              className="chip"
              aria-pressed={complications.includes(c.key)}
              onClick={() => setComplications((cur) => (cur.includes(c.key) ? cur.filter((x) => x !== c.key) : [...cur, c.key]))}
            >
              {tx(c.en, c.sw)}
            </button>
          ))}
        </div>
        <FormField id="birth-other" label={tx('Anything else', 'Lingine')} optionalText={tx('optional', 'si lazima')} hint={tx('This helps your nurse and CHP watch you more closely if needed.', 'Hii humsaidia muuguzi na CHP kukuangalia kwa karibu zaidi ikihitajika.')}>
          <input id="birth-other" value={other} onChange={(e) => setOther(e.target.value)} />
        </FormField>

        <div className="field">
          <span className="n-label">{tx('How many babies?', 'Watoto wangapi?')}</span>
          <Segmented
            ariaLabel={tx('Number of babies', 'Idadi ya watoto')}
            value={count}
            onChange={setCount}
            options={[
              { value: '1', label: '1' },
              { value: '2', label: tx('2 (twins)', '2 (mapacha)') },
              { value: '3', label: '3' },
            ]}
          />
        </div>
        {Array.from({ length: Number(count) }, (_, i) => (
          <FormField
            key={i}
            id={`birth-name-${i}`}
            label={Number(count) > 1 ? tx(`Baby ${i + 1} name`, `Jina la mtoto ${i + 1}`) : tx("Baby's name", 'Jina la mtoto')}
            optionalText={tx('optional', 'si lazima')}
          >
            <input id={`birth-name-${i}`} value={names[i]} onChange={(e) => setNames((cur) => cur.map((n, j) => (j === i ? e.target.value : n)))} />
          </FormField>
        ))}

        <label className="reg-agree">
          <input type="checkbox" checked={showBaby} onChange={(e) => setShowBaby(e.target.checked)} />
          <span>
            {tx("Show baby care tips on my dashboard", 'Onyesha vidokezo vya kumtunza mtoto kwenye ukurasa wangu')}
            <span className="n-hint" style={{ display: 'block', fontWeight: 500 }}>
              {tx('You can turn this off at any time in Profile.', 'Unaweza kuzima hii wakati wowote kwenye Wasifu.')}
            </span>
          </span>
        </label>

        {saveError ? (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        ) : null}
      </section>

      <div className="reg-actions">
        <button type="button" className="btn btn-secondary" onClick={() => nav(-1)} disabled={busy}>
          {tx('Cancel', 'Ghairi')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? tx('Saving…', 'Inahifadhi…') : editing ? tx('Save changes', 'Hifadhi mabadiliko') : tx('Start my recovery care', 'Anza huduma ya kupona')}
        </button>
      </div>
    </main>
  );
}
