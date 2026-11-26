import { useNavigate } from 'react-router-dom';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { SigningSlot } from '../ui/SigningSlot';
import { StatusOrb } from '../ui/StatusOrb';
import { LoadingScreen } from '../ui/LoadingScreen';
import { ErrorScreen } from '../ui/ErrorScreen';
import { getMessageTextFor, speakMessageKey } from '../services/speech';
import { buildSmsLink } from '../services/alerts';
import { reasonPhrase, topReason } from '@neema/core';

/** Guided alert ritual — breathe → message → wait. */
export function AlertPage() {
  const g = useGuardian();
  const nav = useNavigate();
  const { t, lang } = useLocale();
  const level = g.triage?.level ?? 'UNKNOWN';
  const sms = g.pendingSms;
  const isRed = level === 'RED';
  const why = g.triage ? reasonPhrase(topReason(g.triage.reasons), lang) : null;
  const roleLabel = (role: string) =>
    role === 'chp' ? 'CHP' : role === 'family' ? (lang === 'sw' ? 'Familia' : 'Family') : lang === 'sw' ? 'Msimamizi' : 'Supervisor';

  if (g.error) {
    return (
      <ErrorScreen
        title={lang === 'sw' ? 'Haikuweza kuandaa ujumbe' : 'Could not prepare the message'}
        detail={g.error}
        onRetry={() => g.clearError()}
        onHome={() => nav('/home')}
      />
    );
  }

  // Nothing is wrong: never show warning steps for a calm or unknown status.
  if (!isRed && level !== 'YELLOW') {
    return (
      <main className="screen">
        <BrandMark />
        <StatusOrb level={level} />
        <h1 className="screen-title" style={{ textAlign: 'center' }}>
          {t('nothing_now')}
        </h1>
        <Button variant="primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => nav('/home')}>
          {t('go_home')}
        </Button>
      </main>
    );
  }

  return (
    <main className="screen">
      {g.loading ? <LoadingScreen message={t('loading')} /> : null}
      <BrandMark />
      <StatusOrb level={level} />

      <h1 className="screen-title" style={{ textAlign: 'center' }}>
        {isRed ? t('call_chp') : t('check_bp')}
      </h1>
      <p className="screen-sub" style={{ textAlign: 'center', marginInline: 'auto' }}>
        {(g.triage ? getMessageTextFor(g.triage.messageKey, lang) : null) ?? g.message}
      </p>
      {why ? (
        <p className="soft-note" style={{ textAlign: 'center' }} data-testid="alert-reason">
          {lang === 'sw' ? 'Sababu' : 'Why'}: {why}
        </p>
      ) : null}

      {isRed && g.redAcknowledged ? (
        <div className="panel" role="status" style={{ margin: '0.75rem 0' }}>
          <strong>{lang === 'sw' ? 'Imethibitishwa' : 'Confirmed'}</strong>
          <p className="soft-note" style={{ marginTop: '0.35rem' }}>
            {g.lastChainNote ??
              (lang === 'sw' ? 'Mtu anashughulikia. Endelea kwenda kituo cha afya.' : 'Someone is acting on this. Keep going to the facility.')}
          </p>
          <p className="soft-note" style={{ marginTop: '0.35rem' }}>
            {lang === 'sw'
              ? 'Kuthibitisha si kuwasili — CHP au muuguzi hufunga kitanzi kwenye orodha ya ufuatiliaji.'
              : 'Acknowledging is not arrival — a CHP or nurse closes the loop on the chase list.'}
          </p>
          <Button variant="secondary" style={{ width: '100%', marginTop: '0.65rem' }} onClick={() => nav('/chase')}>
            {t('chase_cta')}
          </Button>
        </div>
      ) : null}

      {g.escalationNotice && isRed && !g.redAcknowledged ? (
        <div className="panel escalation-notice" role="alert" data-testid="escalation-notice" style={{ margin: '0.75rem 0' }}>
          <strong>
            {lang === 'sw' ? 'Hakuna aliyethibitisha bado' : 'No one has confirmed yet'}
          </strong>
          <p style={{ margin: '0.35rem 0 0' }}>
            {lang === 'sw'
              ? `Tuma SMS kwa ${g.escalationNotice.name} sasa.`
              : `Send the SMS to ${g.escalationNotice.name} now.`}
          </p>
        </div>
      ) : null}

      {g.chpReply ? (
        <div className="panel chp-reply" role="status" aria-live="assertive" style={{ margin: '0.75rem 0' }}>
          <strong>
            {g.chpReply.name} · {lang === 'sw' ? 'amejibu' : 'replied'}
          </strong>
          <p style={{ margin: '0.35rem 0 0' }}>“{g.chpReply.text}”</p>
          {g.chpReply.scripted ? (
            <p className="soft-note" style={{ marginTop: '0.35rem' }}>
              {lang === 'sw' ? 'Jibu la maonyesho' : 'Scripted demo reply'}
            </p>
          ) : null}
        </div>
      ) : null}

      {g.triage ? <SigningSlot messageKey={g.triage.messageKey} lang={lang} /> : null}

      <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
        <Button variant="secondary" style={{ flex: 1 }} onClick={() => nav('/sign')}>
          {lang === 'sw' ? 'Zungumza kwa ishara' : 'Talk in sign'}
        </Button>
        {g.triage ? (
          <Button
            variant="secondary"
            style={{ flex: 1 }}
            onClick={() => void speakMessageKey(g.triage!.messageKey, { lang: lang === 'sw' ? 'sw-KE' : 'en-KE' })}
          >
            {lang === 'sw' ? 'Sikiliza' : 'Hear'}
          </Button>
        ) : null}
      </div>

      <ol className="ritual-steps">
        <li>
          <span className="step-n">1</span>
          <div>
            <strong>{lang === 'sw' ? 'Pumua' : 'Breathe'}</strong>
            <p className="soft-note">{t('breathe')}</p>
          </div>
        </li>
        <li>
          <span className="step-n">2</span>
          <div>
            <strong>{lang === 'sw' ? 'Fungua ujumbe' : 'Open the message'}</strong>
            <p className="soft-note">
              {lang === 'sw'
                ? 'Neema imeandaa SMS fupi kwa CHP yako — fungua na utume.'
                : 'Neema prepared a short SMS for your CHP — open it and send.'}
            </p>
          </div>
        </li>
        <li>
          <span className="step-n">3</span>
          <div>
            <strong>
              {isRed
                ? lang === 'sw'
                  ? 'Nenda kituo sasa'
                  : 'Go to a facility now'
                : lang === 'sw'
                  ? 'Subiri jibu'
                  : 'Wait for a reply'}
            </strong>
            <p className="soft-note">
              {isRed
                ? lang === 'sw'
                  ? 'Usisubiri asubuhi. Fungua ujumbe na uende kituo cha afya.'
                  : 'Do not wait for morning. Open the message and go to a health facility.'
                : t('wait_reply')}
            </p>
          </div>
        </li>
      </ol>

      {sms.length > 0 ? (
        <div className="sms-list">
          {sms.map((item, i) => (
            <a
              key={item.contactId}
              className={`btn ${
                (i === 0 || item.escalated) && !item.opened
                  ? isRed
                    ? 'btn-danger'
                    : 'btn-primary'
                  : 'btn-secondary'
              }`}
              href={item.href}
              data-opened={item.opened}
              style={{ width: '100%', marginTop: i === 0 ? 0 : '0.6rem' }}
              onClick={() => g.markSmsOpened(item.contactId)}
            >
              {item.opened ? '✓ ' : ''}
              {lang === 'sw' ? 'Tuma SMS kwa' : 'Send SMS to'} {roleLabel(item.role)}
              {[item.role, roleLabel(item.role), 'family', 'familia'].some(
                (r) => r.toLowerCase() === item.name.trim().toLowerCase(),
              )
                ? ''
                : ` · ${item.name}`}
            </a>
          ))}
        </div>
      ) : g.alertBody && !g.redAcknowledged ? (
        <div className="panel" role="alert" data-testid="no-contacts" style={{ marginBottom: '0.75rem' }}>
          <strong>{lang === 'sw' ? 'Hakuna namba ya CHP iliyohifadhiwa' : 'No CHP number saved'}</strong>
          <p className="soft-note" style={{ margin: '0.35rem 0 0.75rem' }}>
            {lang === 'sw'
              ? 'Fungua SMS na uchague mtu wa kumtumia, au piga simu kwa mtu wa karibu.'
              : 'Open the SMS and choose who to send it to, or call someone near you.'}
          </p>
          <a
            className={`btn ${isRed ? 'btn-danger' : 'btn-primary'}`}
            href={buildSmsLink(null, g.alertBody)}
            style={{ width: '100%' }}
          >
            {lang === 'sw' ? 'Chagua wa kumtumia SMS' : 'Choose who to text'}
          </a>
          <Button variant="secondary" style={{ width: '100%', marginTop: '0.6rem' }} onClick={() => nav('/contacts?setup=1')}>
            {lang === 'sw' ? 'Ongeza namba ya CHP' : 'Add a CHP number'}
          </Button>
        </div>
      ) : null}

      {isRed && !g.redAcknowledged && g.escalationDueInSec !== null ? (
        <p className="soft-note" style={{ textAlign: 'center', marginTop: '0.6rem' }} data-testid="escalation-countdown">
          {lang === 'sw'
            ? `Kama hakuna jibu, Neema itamfikia mtu mwingine baada ya ${Math.floor(g.escalationDueInSec / 60)}:${String(g.escalationDueInSec % 60).padStart(2, '0')}`
            : `If nobody confirms, Neema reaches the next person in ${Math.floor(g.escalationDueInSec / 60)}:${String(g.escalationDueInSec % 60).padStart(2, '0')}`}
        </p>
      ) : null}

      {(g.recheck.status === 'due' || g.recheck.status === 'scheduled') && !isRed ? (
        <Button variant="secondary" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => nav('/bp')}>
          {t('recheck_now')}
        </Button>
      ) : null}

      {isRed && !g.redAcknowledged ? (
        <div className="ack-group" style={{ marginTop: '1rem' }}>
          <p className="soft-note" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            {lang === 'sw'
              ? 'Hali ya RED inabaki hadi mtu athibitishe anachukua hatua.'
              : 'RED stays on until someone confirms they are acting.'}
          </p>
          <Button
            variant={g.chpReply ? 'primary' : 'secondary'}
            style={{ width: '100%' }}
            onClick={() => void g.acknowledgeActiveRed('chp_replied').then(() => nav('/home'))}
          >
            {lang === 'sw' ? 'CHP wangu amejibu' : 'My CHP replied'}
          </Button>
          <Button
            variant="secondary"
            style={{ width: '100%', marginTop: '0.6rem' }}
            onClick={() => void g.acknowledgeActiveRed('mother_on_the_way').then(() => nav('/home'))}
          >
            {lang === 'sw' ? 'Niko njiani kwenda kituo' : 'I’m on my way to the facility'}
          </Button>
        </div>
      ) : (
        <>
          {isRed ? (
            <Button variant="secondary" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => nav('/chase')}>
              {t('chase_cta')}
            </Button>
          ) : null}
          <Button variant="ghost" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => nav('/home')}>
            {t('go_home')}
          </Button>
        </>
      )}
    </main>
  );
}
