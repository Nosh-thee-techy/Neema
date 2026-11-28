/**
 * The band saw a sudden change (very low blood pressure with a fast heart)
 * that she may not feel. This screen asks her before anyone is called.
 * If she cannot answer, the message goes to her CHP, not to 999.
 * It stays quiet while she has said she is asleep.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';
import { buildSmsLink } from '../services/alerts';
import { listContacts } from '../services/contacts';
import '../styles/story.css';

const WAIT_MS = 90_000;
const DONE = 'neema.readingCheck';

export function ReadingCheckPage() {
  const nav = useNavigate();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);
  const [step, setStep] = useState<'ask' | 'ok' | 'unwell' | 'timeout'>('ask');
  const [sms, setSms] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 'ask') return;
    const id = window.setTimeout(() => setStep('timeout'), WAIT_MS);
    return () => window.clearTimeout(id);
  }, [step]);

  useEffect(() => {
    if (step !== 'timeout') return;
    void listContacts().then((all) => {
      const chp = all.find((c) => c.role === 'chp');
      const body = sw
        ? 'Neema: vipimo vilibadilika ghafla na mama hajajibu. Tafadhali angalia kama yuko salama. Hii si simu ya hospitali bado.'
        : 'Neema: her readings changed suddenly and she has not answered. Please check she is safe. This is not a hospital call yet.';
      setSms(buildSmsLink(chp?.phone ?? null, body));
    });
  }, [step, sw]);

  function feelOk() {
    try {
      sessionStorage.setItem(DONE, 'ok');
    } catch {
      /* ignore */
    }
    setStep('ok');
  }

  function feelUnwell() {
    try {
      sessionStorage.setItem(DONE, 'unwell');
    } catch {
      /* ignore */
    }
    setStep('unwell');
  }

  return (
    <main className="story reading-check">
      <header className="story__top">
        <button type="button" className="story__back" onClick={() => nav('/home')} aria-label={tx('Back', 'Rudi')}>
          <span aria-hidden>←</span>
        </button>
        <p className="story__count">{tx('A quick check', 'Ukaguzi wa haraka')}</p>
      </header>

      {step === 'ask' ? (
        <article className="story__card">
          <p className="story__kicker">{tx('Your readings', 'Vipimo vyako')}</p>
          <h1>{tx('Hi. Something changed suddenly.', 'Habari. Kitu kimebadilika ghafla.')}</h1>
          <p className="story__body">
            {tx(
              'Your blood pressure looks very low and your heart is beating fast. You may not feel it. Is everything okay?',
              'Shinikizo linaonekana chini sana na moyo unapiga haraka. Huenda uskihisi. Kila kitu kiko sawa?',
            )}
          </p>
        </article>
      ) : null}

      {step === 'ok' ? (
        <article className="story__card">
          <p className="story__kicker">{tx('Noted', 'Imerekodiwa')}</p>
          <h1>{tx('We will keep watching', 'Tutaendelea kuangalia')}</h1>
          <p className="story__body">
            {tx(
              'You feel okay, so this may be the band. Neema will not call anyone from this screen. If you start to feel worse, hold Emergency.',
              'Unajisikia sawa, kwa hiyo huenda ni bendi. Neema hatapiga mtu kutoka skrini hii. Ukianza kujisikia vibaya, shikilia Dharura.',
            )}
          </p>
        </article>
      ) : null}

      {step === 'unwell' ? (
        <article className="story__card">
          <p className="story__kicker">{tx('Next', 'Kifuatacho')}</p>
          <h1>{tx('Let us get you help', 'Tupate msaada')}</h1>
          <p className="story__body">
            {tx(
              'You do not feel okay. The next screen has the steps and the message for your CHP.',
              'Hujisikii sawa. Skrini inayofuata ina hatua na ujumbe kwa CHP wako.',
            )}
          </p>
        </article>
      ) : null}

      {step === 'timeout' ? (
        <article className="story__card">
          <p className="story__kicker">{tx('No answer', 'Hakuna jibu')}</p>
          <h1>{tx('Someone close by first', 'Mtu wa karibu kwanza')}</h1>
          <p className="story__body">
            {tx(
              'You did not answer in time. Neema will not call the hospital from here. A message is ready for your CHP, so a person near you can check on you.',
              'Hukujibu kwa wakati. Neema hatapiga hospitali kutoka hapa. Ujumbe uko tayari kwa CHP wako, ili mtu wa karibu akuangalie.',
            )}
          </p>
        </article>
      ) : null}

      <footer className="story__foot">
        {step === 'ask' ? (
          <div className="story__actions">
            <button type="button" className="btn btn-secondary" onClick={feelOk}>
              {tx('I feel okay', 'Niko sawa')}
            </button>
            <button type="button" className="btn btn-primary" onClick={feelUnwell}>
              {tx('I do not feel okay', 'Siko sawa')}
            </button>
          </div>
        ) : null}
        {step === 'ok' ? (
          <button type="button" className="btn btn-primary btn-block" onClick={() => nav('/home')}>
            {tx('Back to today', 'Rudi leo')}
          </button>
        ) : null}
        {step === 'unwell' ? (
          <button type="button" className="btn btn-primary btn-block" onClick={() => nav('/alert')}>
            {tx('See the steps', 'Ona hatua')}
          </button>
        ) : null}
        {step === 'timeout' && sms ? (
          <a className="btn btn-primary btn-block" href={sms}>
            {tx('Message your CHP', 'Tuma ujumbe kwa CHP')}
          </a>
        ) : null}
      </footer>
    </main>
  );
}
