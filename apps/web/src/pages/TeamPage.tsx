import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { getReadiness, type ReadinessReport } from '../services/readiness';
import { addClinicalNote } from '../services/clinicalNotes';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';

/**
 * Health-team tools, hidden from mothers (reach via /team, or tap the version line
 * on Profile five times). Readiness gates, stage demo, sign-off, chase list, nurse notes.
 */
export function TeamPage() {
  const nav = useNavigate();
  const g = useGuardian();
  const { t, lang } = useLocale();
  const [ready, setReady] = useState<ReadinessReport | null>(null);
  const [noteAuthor, setNoteAuthor] = useState('');
  const [noteRole, setNoteRole] = useState<'nurse' | 'chw'>('nurse');
  const [noteFacility, setNoteFacility] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteMsg, setNoteMsg] = useState<string | null>(null);

  async function saveNote() {
    try {
      await addClinicalNote({ authorRole: noteRole, authorName: noteAuthor, text: noteText, ...(noteFacility.trim() ? { facilityName: noteFacility } : {}) });
      setNoteText('');
      setNoteMsg(lang === 'sw' ? 'Imehifadhiwa. Mama anaweza kusoma lakini si kubadilisha.' : 'Saved. The mother can read it but not change it.');
    } catch (e) {
      setNoteMsg(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void getReadiness().then(setReady);
  }, []);

  return (
    <main className="screen">
      <BrandMark />
      <h1 className="screen-title" style={{ marginTop: '1rem' }}>
        {lang === 'sw' ? 'Zana za timu ya afya' : 'Health team tools'}
      </h1>
      <p className="screen-sub">
        {lang === 'sw' ? 'Si kwa mama. Hali ya uwanja, maonyesho, sahihi na maelezo ya muuguzi.' : 'Not for mothers. Field readiness, demo, sign-off and nurse notes.'}
      </p>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <strong>{lang === 'sw' ? 'Hali ya uwanja' : 'Field readiness'}</strong>
        <p className="soft-note" style={{ marginTop: '0.4rem' }}>
          {ready?.fieldReady
            ? lang === 'sw'
              ? 'Tayari kwa matumizi yanayosimamiwa'
              : 'Ready for supervised field use'
            : lang === 'sw'
              ? 'Hali ya demo: mambo haya bado yanahitajika'
              : 'Demo mode: these are still needed'}
        </p>
        {ready && ready.blockers.length ? (
          <ul className="team-blockers" data-testid="readiness-blockers">
            {ready.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {ready && !ready.fieldReady ? (
        <div className="panel" style={{ marginBottom: '1rem' }} data-testid="demo-panel">
          <strong>{lang === 'sw' ? 'Maonyesho (hali za majaribio)' : 'Stage demo (scripted scenarios)'}</strong>
          <p className="soft-note" style={{ margin: '0.4rem 0 0' }}>
            {lang === 'sw'
              ? 'Kila hali inafuta vipimo na tahadhari kwenye simu hii, kisha inaendesha mnyororo kamili: sauti, SMS na ufuatiliaji.'
              : 'Each scenario clears readings and alerts on this phone, then runs the real chain: voice, SMS and escalation.'}
          </p>
          <div className="demo-grid">
            <Button variant="secondary" onClick={() => void g.playDemo('A').then(() => nav('/home'))}>
              A · {lang === 'sw' ? 'Usiku mwema' : 'Good night'}
            </Button>
            <Button variant="secondary" onClick={() => void g.playDemo('B_warning').then(() => nav('/home'))}>
              B1 · {lang === 'sw' ? 'Onyo 146/92' : 'Warning 146/92'}
            </Button>
            <Button variant="secondary" onClick={() => void g.playDemo('B_recheck').then(() => nav('/home'))}>
              B2 · {lang === 'sw' ? 'Pima tena 138/88' : 'Recheck 138/88'}
            </Button>
            <Button variant="secondary" onClick={() => void g.playDemo('C').then(() => nav('/alert'))}>
              C · {lang === 'sw' ? 'Dharura' : 'Emergency'}
            </Button>
            <Button variant="secondary" onClick={() => void g.playDemo('D').then(() => nav('/alert'))}>
              D · {lang === 'sw' ? 'Homa baada ya kujifungua' : 'Postpartum fever'}
            </Button>
            <Button variant="ghost" onClick={() => void g.resetDemo()}>
              {lang === 'sw' ? 'Anza upya' : 'Reset'}
            </Button>
          </div>
          {g.demoStep ? (
            <p className="soft-note" style={{ marginTop: '0.6rem' }} data-testid="demo-status">
              {lang === 'sw' ? 'Hali' : 'Running'}: {g.demoStep} · {g.triage?.level ?? '—'} ·{' '}
              {g.stage === 'postpartum'
                ? lang === 'sw'
                  ? 'baada ya kujifungua'
                  : 'postpartum'
                : lang === 'sw'
                  ? 'mimba'
                  : 'pregnancy'}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <strong>{lang === 'sw' ? 'Ongeza maelezo ya kitabibu' : 'Add a clinical note'}</strong>
        <p className="soft-note" style={{ margin: '0.35rem 0 0.7rem' }}>
          {lang === 'sw'
            ? 'Huonekana kwa mama kama "Maelezo ya muuguzi". Kwenye simu tu; haijathibitishwa na seva bado.'
            : 'Shows to the mother as "Notes from your nurse". On this phone only; not server-verified yet.'}
        </p>
        <div className="field">
          <label htmlFor="cn-author">{lang === 'sw' ? 'Jina lako' : 'Your name'}</label>
          <input id="cn-author" value={noteAuthor} onChange={(e) => setNoteAuthor(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cn-role">{lang === 'sw' ? 'Wewe ni' : 'Role'}</label>
          <select id="cn-role" value={noteRole} onChange={(e) => setNoteRole(e.target.value as 'nurse' | 'chw')}>
            <option value="nurse">{lang === 'sw' ? 'Muuguzi / mkunga' : 'Nurse / midwife'}</option>
            <option value="chw">CHW / CHP</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="cn-fac">{lang === 'sw' ? 'Kituo' : 'Facility'}</label>
          <input id="cn-fac" value={noteFacility} onChange={(e) => setNoteFacility(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cn-text">{lang === 'sw' ? 'Maelezo' : 'Note'}</label>
          <textarea id="cn-text" rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
        </div>
        <Button variant="secondary" style={{ width: '100%' }} disabled={!noteAuthor.trim() || !noteText.trim()} onClick={() => void saveNote()}>
          {lang === 'sw' ? 'Hifadhi maelezo' : 'Save note'}
        </Button>
        {noteMsg ? <p className="soft-note" role="status" style={{ marginTop: '0.5rem' }}>{noteMsg}</p> : null}
      </div>

      <div className="btn-row">
        <Button variant="secondary" onClick={() => nav('/chase')}>
          {lang === 'sw' ? 'Ufuatiliaji (CHP)' : 'Chase list (CHP)'}
        </Button>
        <Button variant="secondary" onClick={() => nav('/sign-off')}>
          {lang === 'sw' ? 'Sahihi ya kliniki' : 'Clinical sign-off'}
        </Button>
      </div>
      <div className="btn-row" style={{ marginTop: '0.75rem' }}>
        <Button variant="secondary" onClick={() => nav('/sign')}>
          {lang === 'sw' ? 'Ishara (majaribio)' : 'Sign talk (lab)'}
        </Button>
        <Button variant="secondary" onClick={() => nav('/check-in')}>
          {lang === 'sw' ? 'Ukaguzi wa CHP' : 'CHP check-in'}
        </Button>
      </div>
      <div className="btn-row" style={{ marginTop: '0.75rem' }}>
        <Button variant="secondary" onClick={() => nav('/vitals')}>
          {lang === 'sw' ? 'Bendi na QA' : 'Band and QA'}
        </Button>
        <Button variant="secondary" onClick={() => nav('/orient')}>
          {lang === 'sw' ? 'Hadithi tena' : 'Replay story'}
        </Button>
      </div>
      <Button variant="ghost" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => nav('/profile')}>
        {lang === 'sw' ? 'Rudi kwa Wasifu' : 'Back to Profile'}
      </Button>
      <p className="trust-line">{t('saved_here')}</p>
      <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
        {lang === 'sw'
          ? 'Msaada wa maamuzi tu — si utambuzi. Sensori za jaribio.'
          : 'Decision support only — not a diagnosis. Prototype sensors.'}
      </p>
    </main>
  );
}
