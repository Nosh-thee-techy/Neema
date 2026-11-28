/**
 * First long-press on the band is a question, not an alert.
 * A tap means it was a mistake (a child, a pocket). A second long-press sends for help.
 * The phone speaks the line the band will say once the band itself can talk.
 */

import { useEffect } from 'react';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { speakText } from '../services/speech';
import '../styles/story.css';

const LINE = {
  en: 'We noticed that you pressed the SOS. If this is a mistake, press the button once. If it is not a mistake, long press the button.',
  sw: 'Tumegundua umebonyeza SOS. Ikiwa ni kosa, bonyeza mara moja. Ikiwa si kosa, bonyeza kwa muda.',
};

export function BandSosConfirm() {
  const g = useGuardian();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const open = g.bandSosAsk;

  useEffect(() => {
    if (!open) return;
    void speakText(LINE[sw ? 'sw' : 'en'], { lang: sw ? 'sw-KE' : 'en-KE' });
  }, [open, sw]);

  if (!open) return null;

  return (
    <div className="band-ask" role="alertdialog" aria-labelledby="band-ask-title" aria-describedby="band-ask-body">
      <div className="band-ask__card">
        <p className="band-ask__kicker">{sw ? 'Kutoka kwa bendi' : 'From the band'}</p>
        <h2 id="band-ask-title">{sw ? 'Umebonyeza SOS' : 'You pressed SOS'}</h2>
        <p id="band-ask-body">{LINE[sw ? 'sw' : 'en']}</p>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => g.dismissBandSos()}>
          {sw ? 'Ilikuwa kosa' : 'It was a mistake'}
        </button>
        <button type="button" className="btn btn-primary btn-block" onClick={() => void g.confirmBandSos()}>
          {sw ? 'Ninahitaji msaada' : 'I need help'}
        </button>
      </div>
    </div>
  );
}
