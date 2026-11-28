/**
 * CareLoop patient-card pattern: signed line → tap answers → next line.
 * Shell matches the animated assistant home (orb + glass actions).
 * Clips are How2Sign research ASL, not KSL. Camera stays off.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToday } from '../../hooks/useToday';
import { IconDots, IconFeel, IconMic, IconPlus, IconRefresh, IconSpark } from '../icons';
import { ASL_PLAYBACK_RATE, AslPlayer, warmSignClips, type SignedLine } from './AslPlayer';
import { ASL_CITATION, ASL_LABEL } from './aslLibrary';
import {
  SIGN_SHOWCASE,
  answersForClip,
  guideForAnswer,
  type GuideReply,
  type SignAnswer,
} from './signScript';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type SignHandoff = NonNullable<GuideReply['handoff']>;

function answerIcon(id: string) {
  if (id.includes('help') || id.includes('worse') || id.includes('pain')) return <IconFeel />;
  if (id.includes('thank') || id.includes('hello') || id.includes("i'm here") || id === 'hello') return <IconSpark />;
  if (id.includes('ready') || id.includes('yes') || id.includes('better')) return <IconRefresh />;
  return <IconPlus />;
}

/** Full-screen signed conversation: animated orb + glass tap answers. */
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

  const [phrase, setPhrase] = useState(0);
  const [reply, setReply] = useState<GuideReply | null>(null);
  const [line, setLine] = useState<SignedLine | null>(null);
  const [problem, setProblem] = useState('');
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [slow, setSlow] = useState(true);
  const [replay, setReplay] = useState(0);
  const [done, setDone] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    warmSignClips(SIGN_SHOWCASE.map((item) => item.id));
  }, []);

  const order = SIGN_SHOWCASE.map((item) => item.id);
  const clipId = order[Math.min(phrase, Math.max(order.length - 1, 0))] ?? '';
  const shown = SIGN_SHOWCASE[Math.min(phrase, Math.max(SIGN_SHOWCASE.length - 1, 0))];
  const says = shown ? (lang === 'sw' ? shown.saysSw : shown.saysEn) : 'Hi';
  const answers: SignAnswer[] = useMemo(
    () => (clipId ? answersForClip(clipId) : []),
    [clipId],
  );
  const total = order.length;
  const signing = started && !done && !problem;

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

    setPhrase((s) => {
      if (s >= total - 1) {
        setDone(true);
        return s;
      }
      return s + 1;
    });
    setReplay((n) => n + 1);
    setPaused(false);
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
        <div className={shown?.urgent ? 'sign-session__stage sign-session__stage--urgent' : 'sign-session__stage'}>
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

        <p className="sign-session__means">
          {shown?.urgent
            ? lang === 'sw'
              ? 'Anahitaji msaada'
              : 'She needs help'
            : lang === 'sw'
              ? 'Neema anasema'
              : 'Neema says'}
        </p>
        <p
          className={shown?.urgent ? 'sign-session__line sign-session__line--urgent' : 'sign-session__line'}
          aria-live="polite"
        >
          {says}
        </p>
        <div className="sign-session__phrases" role="tablist" aria-label={lang === 'sw' ? 'Misemo' : 'Phrases'}>
          {SIGN_SHOWCASE.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className={item.urgent ? 'sign-session__phrase sign-session__phrase--urgent' : 'sign-session__phrase'}
              aria-selected={index === phrase}
              onClick={() => {
                setPhrase(index);
                setDone(false);
                setReplay((n) => n + 1);
                setPaused(false);
              }}
            >
              {lang === 'sw' ? item.chipSw : item.chipEn}
            </button>
          ))}
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
        <section className="sign-session__actions" aria-labelledby="sign-answer-heading">
          <h2 id="sign-answer-heading" className="visually-hidden">
            {lang === 'sw' ? 'Jibu lako' : 'Your answer'}
          </h2>
          {answers.map((item) => (
            <button
              key={item.id}
              type="button"
              className="sign-session__action"
              onClick={() => onAnswer(item.id)}
            >
              <span className="sign-session__action-ico" data-tone="a">
                {answerIcon(item.id)}
              </span>
              {lang === 'sw' ? item.labelSw : item.labelEn}
            </button>
          ))}
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
        </section>
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
