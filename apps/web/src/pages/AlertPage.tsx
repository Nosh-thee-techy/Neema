import { useEffect, useRef, useState, useTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { EMERGENCY_NUMBER, EMERGENCY_TEL } from '../services/emergency';
import { phoneFromSmsHref, placeSosNotice } from '../services/sosNotice';
import { reasonPhrase, topReason } from '@neema/core';

type AckKind = 'chp_replied' | 'mother_on_the_way';

/** Guided alert ritual — breathe → message → wait, with live feedback. */
export function AlertPage() {
  const g = useGuardian();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const fromSos = params.get('sos') === '1';
  const { t, lang } = useLocale();
  const level = g.triage?.level ?? 'UNKNOWN';
  const sms = g.pendingSms;
  const isRed = level === 'RED';
  const why = g.triage ? reasonPhrase(topReason(g.triage.reasons), lang) : null;
  const roleLabel = (role: string) =>
    role === 'chp' ? 'CHP' : role === 'family' ? (lang === 'sw' ? 'Familia' : 'Family') : lang === 'sw' ? 'Msimamizi' : 'Supervisor';

  const [mounted, setMounted] = useState(false);
  const [openedFlash, setOpenedFlash] = useState<string | null>(null);
  const [ackBusy, setAckBusy] = useState<AckKind | null>(null);
  const [smsPressed, setSmsPressed] = useState(false);
  const [placed, setPlaced] = useState<{ calls: number; sms: number } | null>(null);
  const noticeOnce = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!isRed || !g.alertBody || sms.length === 0 || noticeOnce.current) return;
    const targets = sms.flatMap((item) => {
      const to = phoneFromSmsHref(item.href);
      return to ? [to] : [];
    });
    if (targets.length === 0) return;
    noticeOnce.current = true;
    const message = g.alertBody;
    void placeSosNotice({
      calls: targets.map((to) => ({ to, message })),
      sms: targets.map((to) => ({ to, message })),
    }).then((result) => {
      if (result.callsPlaced > 0 || result.smsSent > 0) {
        setPlaced({ calls: result.callsPlaced, sms: result.smsSent });
      }
    });
  }, [isRed, g.alertBody, sms]);

  const anySmsOpened = sms.some((item) => item.opened);
  const activeStep = g.redAcknowledged ? 3 : anySmsOpened || smsPressed ? 2 : 1;

  async function acknowledge(kind: AckKind) {
    if (ackBusy) return;
    setAckBusy(kind);
    try {
      await g.acknowledgeActiveRed(kind);
      startTransition(() => nav('/home'));
    } finally {
      setAckBusy(null);
    }
  }

  function markOpened(contactId: string) {
    g.markSmsOpened(contactId);
    setOpenedFlash(contactId);
    setSmsPressed(true);
    window.setTimeout(() => setOpenedFlash((id) => (id === contactId ? null : id)), 1800);
  }


  const call999 = (
    <div className="call-999" data-testid="call-999">
      <a className="btn btn-danger call-999__btn" href={EMERGENCY_TEL}>
        {lang === 'sw' ? `Piga ${EMERGENCY_NUMBER} sasa` : `Call ${EMERGENCY_NUMBER} now`}
      </a>
      {fromSos ? (
        <p className="soft-note call-999__note">
          {placed && placed.calls > 0
            ? lang === 'sw'
              ? 'Neema anampigia mtu wako wa afya. '
              : 'Neema is calling your health person. '
            : ''}
          {lang === 'sw'
            ? `Simu yako inafungua ${EMERGENCY_NUMBER}. Bonyeza kitufe cha kijani kupiga.`
            : `Your phone is opening ${EMERGENCY_NUMBER}. Press the green call button.`}{' '}
          {/* Only promise a sent text when the gateway accepted it. Otherwise the button is still hers to send. */}
          {placed && placed.sms > 0
            ? lang === 'sw'
              ? 'Ujumbe umetumwa pia. Unaweza kuutuma tena hapa chini.'
              : 'A text was sent as well. You can send it again below.'
            : sms.length > 0
              ? lang === 'sw'
                ? 'SMS kwa CHP zimeandaliwa hapa chini.'
                : 'SMS to your CHP is ready below.'
              : lang === 'sw'
                ? 'Neema inaandaa SMS kwa CHP wako.'
                : 'Neema is getting the SMS for your CHP ready.'}
        </p>
      ) : null}
    </div>
  );

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

  // SOS just pressed: the alert is still being prepared. Never show "nothing now" here.
  if (fromSos && !isRed) {
    return (
      <main className="screen alert-page" data-level="RED">
        <BrandMark />
        <h1 className="screen-title" style={{ textAlign: 'center' }}>
          {lang === 'sw' ? 'Tunaomba msaada…' : 'Getting help…'}
        </h1>
        {call999}
      </main>
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
    <main className="screen alert-page" data-mounted={mounted} data-level={level}>
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

      {isRed ? call999 : null}

      {isRed && g.redAcknowledged ? (
        <div className="panel alert-card alert-card--ok" role="status">
          <strong>{lang === 'sw' ? 'Imethibitishwa' : 'Confirmed'}</strong>
          <p className="soft-note" style={{ marginTop: '0.35rem' }}>
            {g.lastChainNote ??
              (lang === 'sw' ? 'Mtu anashughulikia. Endelea kwenda kituo cha afya.' : 'Someone is acting on this. Keep going to the facility.')}
          </p>
          <p className="soft-note" style={{ marginTop: '0.35rem' }}>
            {lang === 'sw'
              ? 'Kuthibitisha si kuwasili. CHP au muuguzi ndiye anathibitisha amefika.'
              : 'Confirming is not arrival. A CHP or nurse confirms when they arrive.'}
          </p>
        </div>
      ) : null}

      {g.escalationNotice && isRed && !g.redAcknowledged ? (
        <div className="panel escalation-notice alert-card" role="alert" data-testid="escalation-notice">
          <strong>{lang === 'sw' ? 'Hakuna aliyethibitisha bado' : 'No one has confirmed yet'}</strong>
          <p style={{ margin: '0.35rem 0 0' }}>
            {lang === 'sw'
              ? `Tuma SMS kwa ${g.escalationNotice.name} sasa.`
              : `Send the SMS to ${g.escalationNotice.name} now.`}
          </p>
        </div>
      ) : null}

      {g.chpReply ? (
        <div className="panel chp-reply alert-card alert-card--pop" role="status" aria-live="assertive">
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

      <div className="btn-row alert-page__tools">
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

      <ol className="ritual-steps" data-active={activeStep}>
        <li data-done={activeStep > 1} data-current={activeStep === 1}>
          <span className="step-n">1</span>
          <div>
            <strong>{lang === 'sw' ? 'Pumua' : 'Breathe'}</strong>
            <p className="soft-note">{t('breathe')}</p>
          </div>
        </li>
        <li data-done={activeStep > 2} data-current={activeStep === 2}>
          <span className="step-n">2</span>
          <div>
            <strong>{lang === 'sw' ? 'Fungua ujumbe' : 'Open the message'}</strong>
            <p className="soft-note">
              {lang === 'sw'
                ? placed && placed.sms > 0
                  ? 'Ujumbe umetumwa. Fungua hapa chini ikiwa unataka kuutuma tena.'
                  : 'Neema imeandaa SMS fupi kwa CHP yako — fungua na utume.'
                : placed && placed.sms > 0
                  ? 'The text was sent. Open it below if you want to send it again.'
                  : 'Neema prepared a short SMS for your CHP — open it and send.'}
            </p>
          </div>
        </li>
        <li data-done={activeStep >= 3} data-current={activeStep === 3 || (activeStep === 2 && anySmsOpened)}>
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
          {sms.map((item, i) => {
            const primary = (i === 0 || item.escalated) && !item.opened;
            return (
              <a
                key={item.contactId}
                className={`btn alert-cta ${
                  primary ? (isRed ? 'btn-danger alert-cta--pulse' : 'btn-primary alert-cta--pulse') : 'btn-secondary'
                }`}
                href={item.href}
                data-opened={item.opened}
                data-flash={openedFlash === item.contactId}
                style={{ width: '100%', marginTop: i === 0 ? 0 : '0.6rem' }}
                onClick={() => markOpened(item.contactId)}
              >
                <span className="alert-cta__label">
                  {item.opened || openedFlash === item.contactId ? '✓ ' : ''}
                  {lang === 'sw' ? 'Tuma SMS kwa' : 'Send SMS to'} {roleLabel(item.role)}
                  {[item.role, roleLabel(item.role), 'family', 'familia'].some(
                    (r) => r.toLowerCase() === item.name.trim().toLowerCase(),
                  )
                    ? ''
                    : ` · ${item.name}`}
                </span>
                {openedFlash === item.contactId ? (
                  <span className="alert-cta__toast">{lang === 'sw' ? 'SMS iko tayari' : 'SMS ready'}</span>
                ) : null}
              </a>
            );
          })}
        </div>
      ) : g.alertBody && !g.redAcknowledged ? (
        <div className="panel alert-card alert-card--action" role="alert" data-testid="no-contacts">
          <strong>{lang === 'sw' ? 'Hakuna namba ya CHP iliyohifadhiwa' : 'No CHP number saved'}</strong>
          <p className="soft-note" style={{ margin: '0.35rem 0 0.85rem' }}>
            {lang === 'sw'
              ? 'Fungua SMS na uchague mtu wa kumtumia, au piga simu kwa mtu wa karibu.'
              : 'Open the SMS and choose who to send it to, or call someone near you.'}
          </p>
          <a
            className={`btn alert-cta alert-cta--pulse ${isRed ? 'btn-danger' : 'btn-primary'}`}
            href={buildSmsLink(null, g.alertBody)}
            style={{ width: '100%' }}
            onClick={() => setSmsPressed(true)}
          >
            <span className="alert-cta__label">
              {lang === 'sw' ? 'Chagua wa kumtumia SMS' : 'Choose who to text'}
            </span>
          </a>
          <Button
            variant="secondary"
            className="alert-cta"
            style={{ width: '100%', marginTop: '0.65rem' }}
            onClick={() => nav('/contacts?setup=1')}
          >
            {lang === 'sw' ? 'Ongeza namba ya CHP' : 'Add a CHP number'}
          </Button>
        </div>
      ) : isRed && !g.redAcknowledged ? (
        // The SMS is built after the spoken message and the location check, which takes a few seconds.
        <p className="soft-note sms-preparing" role="status" data-testid="sms-preparing">
          {lang === 'sw' ? 'Neema inaandaa SMS kwa CHP wako…' : 'Getting the SMS for your CHP ready…'}
        </p>
      ) : null}

      {isRed && !g.redAcknowledged && g.escalationDueInSec !== null ? (
        <p className="soft-note alert-countdown" data-testid="escalation-countdown">
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
        <div className="ack-group">
          <p className="soft-note ack-group__note">
            {lang === 'sw'
              ? 'Hali ya RED inabaki hadi mtu athibitishe anachukua hatua.'
              : 'RED stays on until someone confirms they are acting.'}
          </p>
          <Button
            variant={g.chpReply ? 'primary' : 'secondary'}
            className="alert-cta"
            style={{ width: '100%' }}
            disabled={Boolean(ackBusy)}
            aria-busy={ackBusy === 'chp_replied'}
            onClick={() => void acknowledge('chp_replied')}
          >
            {ackBusy === 'chp_replied'
              ? lang === 'sw'
                ? 'Inathibitisha…'
                : 'Confirming…'
              : lang === 'sw'
                ? 'CHP wangu amejibu'
                : 'My CHP replied'}
          </Button>
          <Button
            variant="secondary"
            className="alert-cta"
            style={{ width: '100%', marginTop: '0.65rem' }}
            disabled={Boolean(ackBusy)}
            aria-busy={ackBusy === 'mother_on_the_way'}
            onClick={() => void acknowledge('mother_on_the_way')}
          >
            {ackBusy === 'mother_on_the_way'
              ? lang === 'sw'
                ? 'Inathibitisha…'
                : 'Confirming…'
              : lang === 'sw'
                ? 'Niko njiani kwenda kituo'
                : 'I’m on my way to the facility'}
          </Button>
        </div>
      ) : (
        <>
          <Button variant="ghost" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => nav('/home')}>
            {t('go_home')}
          </Button>
        </>
      )}
    </main>
  );
}
