/**
 * After unlock: pick how to talk — sign (avatar) or text language (home).
 */

import { useNavigate } from 'react-router-dom';
import { BrandMark } from '../ui/BrandMark';
import { LangToggle } from '../ui/LangToggle';
import { useLocale } from '../hooks/useLocale';

/** Simple gate: sign conversation vs English/Kiswahili text UI. */
export function TalkModePage() {
  const nav = useNavigate();
  const { lang } = useLocale();

  return (
    <main className="screen talk-mode">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <BrandMark showSub />
        <LangToggle />
      </div>

      <h1 className="screen-title" style={{ marginTop: '1.4rem' }}>
        {lang === 'sw' ? 'Unataka kuongea vipi?' : 'How do you want to talk?'}
      </h1>
      <p className="screen-sub">
        {lang === 'sw'
          ? 'Chagua ishara au maandishi. Unaweza kubadilisha baadaye.'
          : 'Choose sign or written language. You can change later.'}
      </p>

      <div className="talk-mode__choices" role="group" aria-label={lang === 'sw' ? 'Njia ya mazungumzo' : 'Talk mode'}>
        <button type="button" className="btn btn-primary talk-mode__choice" onClick={() => nav('/sign')}>
          <span className="talk-mode__choice-title">
            {lang === 'sw' ? 'Ishara' : 'Sign'}
          </span>
          <span className="talk-mode__choice-blurb">
            {lang === 'sw'
              ? 'Mtu anayefanya ishara na majibu chini. Utafiti wa ASL — si KSL.'
              : 'Signing figure with answers underneath. Research ASL — not KSL.'}
          </span>
        </button>

        <button type="button" className="btn btn-secondary talk-mode__choice" onClick={() => nav('/home')}>
          <span className="talk-mode__choice-title">
            {lang === 'sw' ? 'Lugha (maandishi)' : 'Language (text)'}
          </span>
          <span className="talk-mode__choice-blurb">
            {lang === 'sw'
              ? 'Endelea kwa Kiswahili au Kiingereza kwenye skrini.'
              : 'Continue in Kiswahili or English on screen.'}
          </span>
        </button>
      </div>

      <p className="trust-line">
        {lang === 'sw'
          ? 'Lugha unabadilisha juu kulia. Data inabaki kwenye simu hii.'
          : 'Switch language with the toggle above. Your data stays on this phone.'}
      </p>
    </main>
  );
}
