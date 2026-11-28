/**
 * CareLoop patient-card pattern: signed line → tap answers → next line.
 * Shell matches the animated assistant home (orb + glass actions).
 * Clips are How2Sign research ASL, not KSL. Camera stays off.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToday } from '../../hooks/useToday';
import { IconDots, IconFeel, IconMic, IconPlus, IconSpark } from '../icons';
import { ASL_PLAYBACK_RATE, AslPlayer, warmSignClips, type SignedLine } from './AslPlayer';
import { ASL_CITATION, ASL_LABEL } from './aslLibrary';
import { SIGN_OPENING, SIGN_TALK, signBeat, type GuideReply, type SignChoice } from './signScript';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type SignHandoff = NonNullable<GuideReply['handoff']>;

/** Full-screen signed conversation: Neema signs, she answers on the chips. */
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
  const nav = useNavigate();
  const today = useToday('sign');
  const name = today.name ?? 'Mama';

  const [beatId, setBeatId] = useState(SIGN_OPENING);
  const [youSaid, setYouSaid] = useState('');
  const [line, setLine] = useState<SignedLine | null>(null);
  const [problem, setProblem] = useState('');
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [slow, setSlow] = useState(true);
  const [replay, setReplay] = useState(0);
  const [done, setDone] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    warmSignClips(SIGN_TALK.map((item) => item.clipId));
  }, []);

  const beat = useMemo(() => signBeat(beatId), [beatId]);
  const clipId = beat.clipId;
  const says = lang === 'sw' ? beat.saysSw : beat.saysEn;
  const note = lang === 'sw' ? beat.noteSw : beat.noteEn;
  const signing = started && !done && !problem;

  const showLine = useCallback((next: SignedLine | null) => setLine(next), []);
  const showProblem = useCallback((message: string) => setProblem(message), []);

  function onChoice(choice: SignChoice) {
    setYouSaid(lang === 'sw' ? choice.chipSw : choice.chipEn);
    setStarted(true);
    setPaused(false);
    const next = signBeat(choice.next);
    setBeatId(next.id);
    setReplay((n) => n + 1);
    if (next.choices.length === 0) setDone(true);
    if (choice.handoff && choice.handoff !== 'continue') onHandoff?.(choice.handoff);
  }

  function begin() {
    setStarted(true);
    setPaused(false);
    setReplay((n) => n + 1);
  }

  if (problem) {
    return (
      <main className="screen sign-session">
        <div className="sign-session__panel">
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
    <main className="screen sign-session" data-signing={signing}>
      <header className="sign-session__top">
        <button
          type="button"
          className="sign-session__orb-btn"
          aria-label={lang === 'sw' ? 'Rudi' : 'Back'}
          onClick={onLeave}
        >
          ←
        </button>
        <p className="sign-session__greet">
          {lang === 'sw' ? `Habari, ${name}!` : `Hello, ${name}!`}{' '}
          <span>{lang === 'sw' ? 'Naweza kukusaidiaje leo?' : 'How can I help you today?'}</span>
        </p>
        <div className="sign-session__menu-wrap">
          <button
            type="button"
            className="sign-session__orb-btn"
            aria-label={lang === 'sw' ? 'Mipangilio' : 'Settings'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <IconDots />
          </button>
          {menuOpen ? (
            <div className="sign-session__menu" role="menu">
              <button
                type="button"
                role="menuitem"
                aria-pressed={slow}
                onClick={() => setSlow((v) => !v)}
              >
                {lang === 'sw' ? (slow ? 'Kasi ya kawaida' : 'Polepole') : slow ? 'Normal speed' : 'Slower'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setReplay((n) => n + 1);
                  setPaused(false);
                  setMenuOpen(false);
                }}
              >
                {lang === 'sw' ? 'Cheza tena' : 'Play again'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onLeave();
                }}
              >
                {lang === 'sw' ? 'Tumia maandishi' : 'Use text instead'}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <section className="sign-session__hero" aria-label={lang === 'sw' ? 'Maneno kwa mama' : 'Words for her'}>
        <div className={beat.urgent ? 'sign-session__stage sign-session__stage--urgent' : 'sign-session__stage'}>
          <AslPlayer
            clipId={clipId}
            tall
            showCaption={false}
            paused={paused}
            speed={slow ? ASL_PLAYBACK_RATE * 0.65 : ASL_PLAYBACK_RATE}
            replay={replay}
            onLine={showLine}
            onProblem={showProblem}
          />
        </div>

        {youSaid ? (
          <p className="sign-session__you">
            {lang === 'sw' ? 'Umesema' : 'You said'} <strong>{youSaid}</strong>
          </p>
        ) : null}
        <p className="sign-session__means">
          {beat.urgent
            ? lang === 'sw'
              ? 'Neema anasema — msaada'
              : 'Neema says — help'
            : lang === 'sw'
              ? 'Neema anasema'
              : 'Neema says'}
        </p>
        <p
          className={beat.urgent ? 'sign-session__line sign-session__line--urgent' : 'sign-session__line'}
          aria-live="polite"
        >
          {says}
        </p>
        {note ? <p className="sign-session__note">{note}</p> : null}
        {beat.choices.length > 0 ? (
          <>
            <p className="sign-session__answer-label" id="sign-answer-heading">
              {lang === 'sw' ? 'Jibu lako' : 'Your answer'}
            </p>
            <div className="sign-session__phrases" role="group" aria-labelledby="sign-answer-heading">
              {beat.choices.map((item) => (
                <button
                  key={`${beat.id}-${item.id}-${item.next}`}
                  type="button"
                  className={item.urgent ? 'sign-session__phrase sign-session__phrase--urgent' : 'sign-session__phrase'}
                  onClick={() => onChoice(item)}
                >
                  {lang === 'sw' ? item.chipSw : item.chipEn}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {!started ? (
        <section className="sign-session__actions" aria-label={lang === 'sw' ? 'Anza' : 'Start'}>
          <button type="button" className="sign-session__action" onClick={begin}>
            <span className="sign-session__action-ico" data-tone="a">
              <IconSpark />
            </span>
            {lang === 'sw' ? 'Anza ishara' : 'Start signing'}
          </button>
          <button
            type="button"
            className="sign-session__action"
            onClick={() => {
              setSlow(true);
              begin();
            }}
          >
            <span className="sign-session__action-ico" data-tone="b">
              <IconFeel />
            </span>
            {lang === 'sw' ? 'Anza polepole' : 'Start slower'}
          </button>
          <button type="button" className="sign-session__action" onClick={() => nav('/care')}>
            <span className="sign-session__action-ico" data-tone="c">
              <IconPlus />
            </span>
            {lang === 'sw' ? 'Ongea na Neema' : 'Talk with Neema'}
          </button>
          <button type="button" className="sign-session__action" onClick={onLeave}>
            <span className="sign-session__action-ico" data-tone="d">
              <IconMic />
            </span>
            {lang === 'sw' ? 'Tumia maandishi' : 'Use text instead'}
          </button>
        </section>
      ) : !done ? (
        <div className="sign-session__playback">
          <button type="button" className="sign-session__chip" aria-pressed={paused} onClick={() => setPaused((v) => !v)}>
            {paused ? (lang === 'sw' ? 'Cheza' : 'Play') : lang === 'sw' ? 'Simamisha' : 'Pause'}
          </button>
          <button
            type="button"
            className="sign-session__chip"
            onClick={() => {
              setReplay((n) => n + 1);
              setPaused(false);
            }}
          >
            {lang === 'sw' ? 'Tena' : 'Again'}
          </button>
          <button type="button" className="sign-session__chip" aria-pressed={slow} onClick={() => setSlow((v) => !v)}>
            {lang === 'sw' ? 'Polepole' : 'Slower'}
          </button>
        </div>
      ) : (
        <div className="sign-session__done">
          <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={onLeave}>
            {lang === 'sw' ? 'Maliza' : 'Done'}
          </button>
        </div>
      )}

      <div className="sign-session__dock">
        <button type="button" className="sign-session__ask" onClick={() => nav('/care')}>
          <span className="sign-session__ask-plus" aria-hidden>
            <IconPlus />
          </span>
          <span>{lang === 'sw' ? 'Niulize chochote…' : 'Ask me anything…'}</span>
        </button>
        <button
          type="button"
          className="sign-session__mic"
          aria-label={lang === 'sw' ? 'Ongea kwa sauti' : 'Talk with voice'}
          onClick={() => nav('/care')}
        >
          <IconMic />
        </button>
      </div>

      <details className="sign-session__about">
        <summary>{lang === 'sw' ? 'Kuhusu klipu hizi' : 'About these clips'}</summary>
        <p className="soft-note">{line?.label ?? ASL_LABEL}</p>
        <p className="soft-note">{line?.citation ?? ASL_CITATION}</p>
        <p className="soft-note">
          {lang === 'sw'
            ? 'Majibu ni mguso. Kamera inazimwa. Klipu ni utafiti wa ASL — si KSL.'
            : 'Answers are taps. The camera stays off. Clips are research ASL — not KSL.'}
        </p>
      </details>
    </main>
  );
}
