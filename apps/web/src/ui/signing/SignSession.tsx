/**
 * CareLoop patient-card pattern: signed line → tap answers → next line.
 * One continuous night guide — no chapter menu. Camera stays off.
 * Clips are How2Sign research ASL, not KSL.
 */

import { useCallback, useMemo, useState } from 'react';
import { ASL_PLAYBACK_RATE, AslPlayer, type SignedLine } from './AslPlayer';
import { ASL_CITATION, ASL_LABEL } from './aslLibrary';
import {
  SIGN_ORDER,
  answersForClip,
  guideForAnswer,
  type GuideReply,
  type SignAnswer,
} from './signScript';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type SignHandoff = NonNullable<GuideReply['handoff']>;

/** Full-screen signed conversation: avatar + bottom tap answers. */
export function SignSession({
  lang = 'en',
  onLeave,
  onHandoff,
}: {
  lang?: 'en' | 'sw';
  onLeave: () => void;
  /** Called when a tap asks for SMS / facility / home / end. */
  onHandoff?: (kind: SignHandoff) => void;
}) {
  const [step, setStep] = useState(0);
  const [reply, setReply] = useState<GuideReply | null>(null);
  const [line, setLine] = useState<SignedLine | null>(null);
  const [problem, setProblem] = useState('');
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [slow, setSlow] = useState(true);
  const [replay, setReplay] = useState(0);
  const [done, setDone] = useState(false);

  const order = SIGN_ORDER;
  const clipId = order[Math.min(step, Math.max(order.length - 1, 0))] ?? '';
  const answers: SignAnswer[] = useMemo(
    () => (clipId ? answersForClip(clipId) : []),
    [clipId],
  );
  const total = order.length;

  const showLine = useCallback((next: SignedLine | null) => setLine(next), []);
  const showProblem = useCallback((message: string) => setProblem(message), []);

  function onAnswer(id: string) {
    const guide = guideForAnswer(id);
    setReply(guide);
    const handoff = guide.handoff ?? 'continue';

    if (handoff === 'end' || handoff === 'home') {
      setDone(true);
      onHandoff?.(handoff);
      return;
    }
    if (handoff === 'alert_sms' || handoff === 'facility') {
      onHandoff?.(handoff);
    }

    setStep((s) => {
      if (s >= total - 1) {
        setDone(true);
        return s;
      }
      return s + 1;
    });
    setReplay((n) => n + 1);
    setPaused(false);
  }

  if (problem) {
    return (
      <main className="screen sign-session">
        <div className="panel" style={{ textAlign: 'center', marginTop: '2rem' }}>
          <strong>{lang === 'sw' ? 'Ishara hazipatikani hapa' : 'Signed lines are not available here'}</strong>
          <p className="soft-note" style={{ marginTop: '0.5rem' }}>
            {lang === 'sw'
              ? 'Unaweza kuendelea kwa maandishi au sauti. Majibu yako hayakupotea.'
              : 'You can carry on with captions or voice. Nothing you answered is lost.'}
          </p>
          <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={onLeave}>
            {lang === 'sw' ? 'Endelea bila ishara' : 'Continue without signing'}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen sign-session">
      <header className="sign-session__top">
        <strong>{lang === 'sw' ? 'Mazungumzo ya ishara' : 'Sign conversation'}</strong>
        <button type="button" className="btn btn-ghost" onClick={onLeave}>
          {lang === 'sw' ? 'Tumia maandishi' : 'Use text instead'}
        </button>
      </header>

      <section className="sign-session__stage" aria-label={lang === 'sw' ? 'Mtu anayefanya ishara' : 'Signing figure'}>
        <span className="sign-session__badge">
          {lang === 'sw' ? `Mstari ${Math.min(step + 1, total)} / ${total}` : `Line ${Math.min(step + 1, total)} of ${total}`}
        </span>
        <AslPlayer
          clipId={clipId}
          tall
          passport
          showCaption={false}
          paused={paused}
          speed={slow ? ASL_PLAYBACK_RATE * 0.65 : ASL_PLAYBACK_RATE}
          replay={replay}
          onLine={showLine}
          onProblem={showProblem}
        />
        <p className="sign-session__sentence" aria-live="polite">
          {line?.sentence ?? (lang === 'sw' ? 'Inapakia mstari…' : 'Loading the line…')}
        </p>
        <div className="sign-session__controls">
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={paused}
            onClick={() => setPaused((v) => !v)}
          >
            {paused ? (lang === 'sw' ? 'Cheza' : 'Play') : lang === 'sw' ? 'Simamisha' : 'Pause'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setReplay((n) => n + 1);
              setPaused(false);
            }}
          >
            {lang === 'sw' ? 'Tena' : 'Again'}
          </button>
          <button type="button" className="btn btn-ghost" aria-pressed={slow} onClick={() => setSlow((v) => !v)}>
            {lang === 'sw' ? 'Polepole' : 'Slower'}
          </button>
        </div>
      </section>

      {reply ? (
        <section
          className={reply.danger ? 'sign-session__guide sign-session__guide--danger' : 'sign-session__guide'}
          role={reply.danger ? 'alert' : 'status'}
          aria-live={reply.danger ? 'assertive' : 'polite'}
        >
          <p className="soft-note" style={{ margin: 0 }}>
            {lang === 'sw' ? 'Mwongozo anasema' : 'The guide says'}
          </p>
          <p style={{ margin: '0.35rem 0 0', fontWeight: 600 }}>
            {lang === 'sw' ? reply.textSw : reply.textEn}
          </p>
        </section>
      ) : null}

      {!done ? (
        <section className="sign-session__answers" aria-labelledby="sign-answer-heading">
          <h2 id="sign-answer-heading" className="section-title">
            {lang === 'sw' ? 'Jibu lako' : 'Your answer'}
          </h2>
          <div className="sign-session__grid">
            {answers.map((item) => (
              <button
                key={item.id}
                type="button"
                className="btn btn-primary sign-session__tap"
                onClick={() => onAnswer(item.id)}
              >
                {lang === 'sw' ? item.labelSw : item.labelEn}
              </button>
            ))}
          </div>
          <p className="trust-line">
            {lang === 'sw'
              ? 'Majibu ni mguso. Kamera inazimwa. Ukijisikia vibaya, nenda kliniki. Klipu ni utafiti wa ASL — si KSL.'
              : 'Answers are taps. The camera stays off. If you feel worse, go to a clinic. Clips are research ASL — not KSL.'}
          </p>
        </section>
      ) : (
        <div className="btn-row" style={{ marginTop: '1rem', flexDirection: 'column', gap: '0.5rem' }}>
          <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={onLeave}>
            {lang === 'sw' ? 'Maliza' : 'Done'}
          </button>
        </div>
      )}

      <details className="sign-session__about">
        <summary>{lang === 'sw' ? 'Kuhusu klipu hizi' : 'About these clips'}</summary>
        <p className="soft-note">{line?.label ?? ASL_LABEL}</p>
        <p className="soft-note">{line?.citation ?? ASL_CITATION}</p>
      </details>
    </main>
  );
}
