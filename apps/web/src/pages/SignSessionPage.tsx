/**
 * Full CareLoop-style signed conversation for Neema (offline scripted guide).
 */

import { useNavigate } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';
import { SignSession, type SignHandoff } from '../ui/signing/SignSession';

/** Route wrapper: signed line → tap → next line. */
export function SignSessionPage() {
  const nav = useNavigate();
  const { lang } = useLocale();

  function onHandoff(kind: SignHandoff) {
    if (kind === 'alert_sms' || kind === 'facility') {
      nav('/alert');
      return;
    }
    if (kind === 'home' || kind === 'end') {
      nav('/home');
    }
  }

  return (
    <SignSession
      lang={lang}
      onLeave={() => nav('/care')}
      onHandoff={onHandoff}
    />
  );
}
