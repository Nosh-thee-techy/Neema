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
          ? 'Chagua lugha ya ishara au maneno kwenye skrini. Unaweza kubadilisha baadaye kwenye Mipangilio.'
          : 'Choose sign language or words on the screen. You can change this later in Settings.'}
      </p>

      <div className="talk-mode__choices" role="group" aria-label={lang === 'sw' ? 'Njia ya mazungumzo' : 'Talk mode'}>
        <button type="button" className="btn btn-primary talk-mode__choice" onClick={() => nav('/sign')}>
          <span className="talk-mode__choice-title">
            {lang === 'sw' ? 'Lugha ya ishara' : 'Sign language'}
          </span>
          <span className="talk-mode__choice-blurb">
            {lang === 'sw'
              ? 'Mtu anayefanya ishara, na maneno chini yake. Kwa sasa ni Lugha ya Ishara ya Marekani. Ya Kenya bado haiko tayari.'
              : 'A signing figure with the words underneath. For now it uses American Sign Language. Kenyan Sign Language is not ready yet.'}
          </span>
        </button>

        <button type="button" className="btn btn-secondary talk-mode__choice" onClick={() => nav('/home')}>
          <span className="talk-mode__choice-title">
            {lang === 'sw' ? 'Maneno kwenye skrini' : 'Words on the screen'}
          </span>
          <span className="talk-mode__choice-blurb">
            {lang === 'sw'
              ? 'Soma na usikilize kwa Kiswahili au Kiingereza.'
              : 'Read and listen in Kiswahili or English.'}
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
