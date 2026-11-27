import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isPlaceholderPhone } from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { saveOnboarding } from '../hooks/useOnboarding';
import { LangToggle } from '../ui/LangToggle';
import { IconChevron } from '../ui/icons';
import { loadConsent, loadProfile, saveConsent, type MamaProfile } from '../services/passport';
import { listContacts } from '../services/contacts';
import { undoDelivery } from '../services/delivery';
import { lockSession } from '../services/auth';
import { db, type ConsentRow } from '../storage/db';

/**
 * Settings: who she is (View profile), what Neema is tracking (pregnancy or after birth),
 * and the app's own settings. Patient details live under View profile.
 */
export function SettingsPage() {
  const nav = useNavigate();
  const g = useGuardian();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);

  const [profile, setProfile] = useState<MamaProfile | null>(null);
  const [consent, setConsent] = useState<ConsentRow | null>(null);
  const [hasChp, setHasChp] = useState<boolean | null>(null);
  const [confirm, setConfirm] = useState<null | 'pregnancy' | 'delete'>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const taps = useRef<number[]>([]);

  async function reload() {
    const [p, c, contacts] = await Promise.all([loadProfile().catch(() => null), loadConsent(), listContacts()]);
    setProfile(p);
    setConsent(c);
    setHasChp(contacts.some((x) => x.role === 'chp' && !isPlaceholderPhone(x.phone)));
  }

  useEffect(() => {
    void reload();
  }, []);

  const after = profile?.stage === 'postpartum';
  const name = profile?.displayName || tx('Mama', 'Mama');
  const d = (ms: number) => new Date(ms).toLocaleDateString(sw ? 'sw-KE' : 'en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

  function pickExperience(next: 'pregnancy' | 'postpartum') {
    if (next === 'postpartum' && !after) nav('/record-birth');
    if (next === 'pregnancy' && after) setConfirm('pregnancy');
  }

  async function backToPregnancy() {
    await undoDelivery();
    await g.refreshTriage();
    setConfirm(null);
    await reload();
  }

  async function toggleShare(key: 'chp' | 'family' | 'nurse') {
    if (!consent) return;
    const sharing = { ...consent.sharing, [key]: !consent.sharing[key] };
    if (!sharing.chp && !sharing.family) {
      setShareError(tx('At least the CHP or family must be able to get alerts.', 'Angalau CHP au familia lazima wapate tahadhari.'));
      return;
    }
    setShareError(null);
    setConsent(await saveConsent({ ...consent, language: lang, agreedAtMs: Date.now(), sharing }));
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

  const Row = ({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) => (
    <button type="button" className="prof-row" onClick={onClick}>
      <span>
        {label}
        {sub ? <small>{sub}</small> : null}
      </span>
      <IconChevron />
    </button>
  );

  return (
    <main className="screen set">
      <header className="set-top">
        <button type="button" className="set-close" aria-label={tx('Close settings', 'Funga mipangilio')} onClick={() => nav('/home')}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <h1>{tx('Settings', 'Mipangilio')}</h1>
      </header>

      <section className="set-id">
        <button type="button" className="set-avatar" aria-label={tx('Edit my details', 'Badilisha maelezo yangu')} onClick={() => nav('/profile#personal')}>
          <span className="set-avatar__letter" aria-hidden>
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="set-avatar__edit" aria-hidden>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
            </svg>
          </span>
          <span className="set-avatar__tag" aria-hidden>
            {after ? tx('After birth', 'Baada ya kujifungua') : tx('Pregnant', 'Mjamzito')}
          </span>
        </button>
        <p className="set-name">{profile?.fullName || name}</p>
        {profile?.phoneForAlerts ? <p className="set-phone">{profile.phoneForAlerts}</p> : null}
        <button type="button" className="btn btn-secondary set-view" onClick={() => nav('/profile')}>
          {tx('View profile', 'Ona wasifu')}
        </button>
      </section>

      {hasChp === false ? (
        <button type="button" className="home-alert home-alert--setup" data-testid="no-chp-warning" onClick={() => nav('/contacts?setup=1')}>
          <strong className="home-alert__title">{tx('No CHP number saved', 'Hakuna namba ya CHP')}</strong>
          <span className="home-alert__body">{tx('Alerts will reach no one. Tap here to add your CHP.', 'Tahadhari haitamfikia mtu. Gusa hapa kuongeza CHP wako.')}</span>
        </button>
      ) : null}

      <section aria-labelledby="exp-title">
        <h2 id="exp-title" className="set-h2">
          {tx('Your Neema experience', 'Neema yako')}
        </h2>
        <div className="set-exp" role="radiogroup" aria-labelledby="exp-title">
          <button type="button" role="radio" aria-checked={!after} className="set-exp__card" onClick={() => pickExperience('pregnancy')}>
            <span className="set-exp__icon set-exp__icon--preg" aria-hidden>
              <svg viewBox="0 0 48 48" width="40" height="40">
                <circle cx="24" cy="24" r="22" fill="#fde3dc" />
                <circle cx="20" cy="18" r="7" fill="#f28b74" />
                <path d="M20 25c9-2 14 6 9 12-4 5-12 4-13-2-1-4 2-8 4-10Z" fill="#f28b74" />
              </svg>
            </span>
            <span className="set-exp__label">{tx('Track pregnancy', 'Fuatilia mimba')}</span>
            {!after ? <span className="set-exp__check" aria-hidden>✓</span> : null}
          </button>
          <button type="button" role="radio" aria-checked={after} className="set-exp__card" onClick={() => pickExperience('postpartum')}>
            <span className="set-exp__icon set-exp__icon--after" aria-hidden>
              <svg viewBox="0 0 48 48" width="40" height="40">
                <circle cx="24" cy="24" r="22" fill="#ece0f7" />
                <ellipse cx="26" cy="30" rx="10" ry="11" fill="#a98bd0" />
                <circle cx="22" cy="18" r="7" fill="#f0c2a4" />
              </svg>
            </span>
            <span className="set-exp__label">{tx('Track after birth', 'Fuatilia baada ya kujifungua')}</span>
            {after ? <span className="set-exp__check" aria-hidden>✓</span> : null}
          </button>
        </div>
        <p className="n-hint">
          {after
            ? tx('Neema is caring for your recovery and your baby.', 'Neema anakusaidia kupona na kumtunza mtoto.')
            : tx('When your baby arrives, choose "Track after birth" to record the birth.', 'Mtoto akifika, chagua "Fuatilia baada ya kujifungua" kuandika kujifungua.')}
        </p>
        {confirm === 'pregnancy' ? (
          <div className="prof-danger" role="alertdialog" aria-labelledby="back-preg">
            <strong id="back-preg">{tx('Go back to tracking pregnancy?', 'Rudi kufuatilia mimba?')}</strong>
            <p>{tx('This removes the birth record. Use it only if the birth was recorded by mistake. Your readings and check-ins stay saved.', 'Hii inaondoa rekodi ya kujifungua. Tumia tu kama iliandikwa kwa makosa. Vipimo na ukaguzi vinabaki.')}</p>
            <div className="prof-edit-btns">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
                {tx('Keep after birth', 'Baki baada ya kujifungua')}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void backToPregnancy()}>
                {tx('Track pregnancy', 'Fuatilia mimba')}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="home-card set-group">
        <h2 className="set-h3">{tx('App', 'Programu')}</h2>
        <div className="prof-line">
          <span>{tx('Language', 'Lugha')}</span>
          <LangToggle />
        </div>
        <Row label={tx('How Neema talks to me', 'Neema anavyozungumza nami')} sub={tx('Text, voice or sign', 'Maandishi, sauti au ishara')} onClick={() => nav('/talk')} />
        <Row
          label={tx('Your band', 'Bendi yako')}
          sub={g.connected ? (g.bandMode === 'simulator' ? tx('Practice band connected', 'Bendi ya mazoezi imeunganishwa') : tx('Connected', 'Imeunganishwa')) : tx('Not connected', 'Haijaunganishwa')}
          onClick={() => nav('/vitals')}
        />
        <Row label={tx('Show my summary to the nurse (QR)', 'Onyesha muhtasari kwa muuguzi (QR)')} sub={tx('Nothing is sent over the internet.', 'Hakuna kinachotumwa mtandaoni.')} onClick={() => nav('/summary')} />
        <div className="prof-line prof-line--muted">
          <span>{tx('Reminders and notifications', 'Vikumbusho na arifa')}</span>
          <span className="prof-tag">{tx('Not available yet', 'Bado haipatikani')}</span>
        </div>
      </section>

      <section className="home-card set-group">
        <h2 className="set-h3">{tx('Security', 'Usalama')}</h2>
        <Row label={tx('Change PIN', 'Badilisha PIN')} onClick={() => nav('/unlock?change=1')} />
        <Row
          label={tx('Lock Neema now', 'Funga Neema sasa')}
          onClick={() => {
            lockSession();
            nav('/unlock');
          }}
        />
      </section>

      <section className="home-card set-group" id="privacy">
        <h2 className="set-h3">{tx('Privacy and alerts', 'Faragha na tahadhari')}</h2>
        <p className="prof-sub">{tx('Who may get an alert', 'Nani apate tahadhari')}</p>
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
        {shareError ? (
          <p className="field-error" role="alert">
            {shareError}
          </p>
        ) : null}
        <p className="prof-sub">
          {tx(
            'Readings stay on this phone. An alert SMS goes only to the people ticked. Voice and chat questions are sent online to be answered.',
            'Vipimo vinabaki kwenye simu hii. SMS ya tahadhari huenda kwa waliowekewa alama tu. Maswali ya sauti na gumzo hutumwa mtandaoni kujibiwa.',
          )}
        </p>
        <p className="prof-sub">
          {consent?.termsAcceptedAtMs ? tx(`Terms accepted on ${d(consent.termsAcceptedAtMs)}.`, `Masharti yalikubaliwa ${d(consent.termsAcceptedAtMs)}.`) : null}{' '}
          <a
            className="n-link"
            href="/terms"
            onClick={(e) => {
              e.preventDefault();
              nav('/terms');
            }}
          >
            {tx('Read the Terms and Conditions', 'Soma Masharti na Vigezo')}
          </a>
        </p>
        {confirm === 'delete' ? (
          <div className="prof-danger" role="alertdialog" aria-labelledby="del-title">
            <strong id="del-title">{tx('Delete everything on this phone?', 'Futa kila kitu kwenye simu hii?')}</strong>
            <p>{tx('Your profile, readings, alerts, contacts and notes will be removed. This cannot be undone.', 'Wasifu, vipimo, tahadhari, watu na maelezo vitafutwa. Haiwezi kurudishwa.')}</p>
            <div className="prof-edit-btns">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
                {tx('Keep my data', 'Baki na data')}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void deleteEverything()}>
                {tx('Delete', 'Futa')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="prof-delete" onClick={() => setConfirm('delete')}>
            {tx('Delete my data', 'Futa data yangu')}
          </button>
        )}
      </section>

      <p className="prof-version" onClick={versionTap}>
        Neema · {tx('decision support, not a diagnosis', 'msaada wa maamuzi, si utambuzi')} · v{import.meta.env.VITE_APP_VERSION ?? '0.3'}
      </p>
    </main>
  );
}
