import { TERMS_VERSION } from '@neema/core';

/**
 * Plain-language Terms and Conditions. DRAFT: the team's legal / ethics adviser must
 * review this text (and the Swahili) before field use. Bump TERMS_VERSION in core
 * whenever the meaning changes so acceptance is recorded against the right text.
 */
export function TermsContent({ lang }: { lang: 'en' | 'sw' }) {
  const sw = lang === 'sw';
  const items = sw
    ? [
        ['Neema ni nini', 'Neema ni msaidizi wa afya ya mama. Huangalia vipimo vyako na kukuonyesha hatua inayofuata. Neema hatambui ugonjwa na si badala ya muuguzi, daktari au kliniki.'],
        ['Dharura', 'Neema si huduma ya dharura. Ukiwa hatarini, piga 999 au nenda kituo cha afya mara moja, hata kama programu haionyeshi tahadhari.'],
        ['Taarifa zako', 'Wasifu, vipimo na maelezo yako huhifadhiwa kwenye simu hii. Hakuna akaunti ya mtandaoni bado.'],
        ['Kinachotoka kwenye simu', 'Vipimo vikionyesha hatari, SMS fupi hutumwa kwa watu unaowachagua. Ukitumia sauti au gumzo, maneno hayo hutumwa kwa huduma za mtandaoni ili kujibiwa.'],
        ['Chaguo lako', 'Unaweza kubadilisha nani apokee tahadhari, au kufuta taarifa zako zote, kwenye Wasifu wakati wowote.'],
        ['Mhudumu akikusajili', 'CHW au muuguzi akikusajili, lazima akueleze masharti haya na upate kukubali kwako.'],
        ['Maelezo ya muuguzi', 'Maelezo yaliyoandikwa na timu ya afya yanaweza kusomwa nawe lakini hayabadilishwi na wewe.'],
      ]
    : [
        ['What Neema is', 'Neema is a maternal health helper. It watches your readings and shows you a next step. Neema does not diagnose and does not replace your nurse, doctor or clinic.'],
        ['Emergencies', 'Neema is not an emergency service. If you are in danger, call 999 or go to a health facility straight away, even if the app shows no alert.'],
        ['Your information', 'Your profile, readings and notes are saved on this phone. There is no online account yet.'],
        ['What leaves the phone', 'When readings look dangerous, a short SMS goes to the people you choose. If you use voice or chat, those words are sent to online services to be answered.'],
        ['Your choices', 'You can change who gets alerts, or delete all your information, in Profile at any time.'],
        ['If a health worker registers you', 'A CHW or nurse who registers you must explain these terms to you and get your agreement.'],
        ['Nurse notes', 'Notes written by your health team can be read by you but not changed by you.'],
      ];
  return (
    <div className="terms">
      <p className="terms__draft">
        {sw ? 'Rasimu: inasubiri ukaguzi wa kisheria.' : 'Draft: awaiting legal review.'} <span>{TERMS_VERSION}</span>
      </p>
      <ol>
        {items.map(([h, b]) => (
          <li key={h}>
            <strong>{h}</strong>
            <p>{b}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
