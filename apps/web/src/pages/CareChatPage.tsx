/**
 * Avatar-front care coach: text / voice / sign mode.
 * Home shell + conversation thread; answers stay WHO-card grounded.
 * Spoken replies use Msingi Sauti (studio voice) when it is configured.
 */

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { avatarState, type CareUrgency } from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { useSpeechDictation } from '../hooks/useSpeechDictation';
import { useToday } from '../hooks/useToday';
import { askCareGuide } from '../services/careChat';
import { primeMsingiPlayback } from '../services/msingi';
import { speakText } from '../services/speech';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { LangToggle } from '../ui/LangToggle';
import {
  IconBand,
  IconBreath,
  IconChevron,
  IconCopy,
  IconDots,
  IconFeel,
  IconHands,
  IconMic,
  IconRefresh,
  IconRest,
  IconSend,
  IconSide,
  IconSpeaker,
  IconThumb,
  IconWater,
} from '../ui/icons';

type Signal = 'green' | 'amber' | 'red' | 'waiting';

type Turn = {
  id: string;
  role: 'mama' | 'neema';
  text: string;
  title?: string;
  handoff?: boolean;
  cardIds?: string[];
  urgency?: CareUrgency;
  /** Mama query that produced this Neema reply (for retry). */
  sourceQuery?: string;
};

type StepId = 'rest' | 'water' | 'band' | 'side' | 'breath';

/** One-tap ways to say how she feels, so the check-in never starts from a blank box. */
const FEELINGS = {
  en: ['I feel dizzy', 'My head hurts', 'Baby is moving less', 'I am stressed'],
  sw: ['Naona kizunguzungu', 'Kichwa kinauma', 'Mtoto anasonga kidogo', 'Nina msongo'],
};

/**
 * The safety level in words a mother can act on. UNKNOWN is never worded as "fine":
 * it says Neema cannot see enough yet.
 */
const STATUS_TEXT = {
  GREEN: { en: 'No warning signs in your readings right now', sw: 'Hakuna dalili za hatari kwenye vipimo vyako sasa' },
  YELLOW: { en: 'Something needs checking today', sw: 'Kuna jambo la kuangalia leo' },
  RED: { en: 'Get help now', sw: 'Tafuta msaada sasa' },
  UNKNOWN: { en: 'Neema cannot see enough readings yet', sw: 'Neema hajapata vipimo vya kutosha bado' },
} as const;

const SIGNAL_WORD: Record<Signal, { en: string; sw: string }> = {
  green: { en: 'Okay', sw: 'Sawa' },
  amber: { en: 'Check', sw: 'Angalia' },
  red: { en: 'Go now', sw: 'Sasa' },
  waiting: { en: 'Waiting', sw: 'Inasubiri' },
};

const STEPS: Array<{
  id: StepId;
  en: string;
  sw: string;
  words: string[];
  Icon: ComponentType;
}> = [
  { id: 'rest', en: 'Rest', sw: 'Pumzika', words: ['rest', 'pumzika', 'lie down', 'lala'], Icon: IconRest },
  { id: 'water', en: 'Water', sw: 'Maji', words: ['water', 'maji', 'drink', 'kunywa'], Icon: IconWater },
  { id: 'band', en: 'Band', sw: 'Bendi', words: ['band', 'bendi'], Icon: IconBand },
  { id: 'side', en: 'Side', sw: 'Upande', words: ['side', 'upande'], Icon: IconSide },
  { id: 'breath', en: 'Breathing', sw: 'Pumzi', words: ['breath', 'breathe', 'breathing', 'pumua', 'pumzi'], Icon: IconBreath },
];

function turnSpeech(turn: Turn): string {
  return turn.title ? `${turn.title}. ${turn.text}` : turn.text;
}

function careSignal(urgency: CareUrgency | undefined, level: string): Signal {
  if (level === 'RED' || urgency === 'urgent') return 'red';
  if (urgency === 'watch' || level === 'YELLOW') return 'amber';
  if (urgency === 'calm' && level !== 'UNKNOWN') return 'green';
  if (level === 'GREEN') return 'green';
  return 'waiting';
}

function stepsIn(text: string): typeof STEPS {
  const hay = text.toLowerCase();
  return STEPS.filter((step) => step.words.some((word) => hay.includes(word)));
}

/** Conversational WHO-guided coach with a portrait thread and a studio voice. */
export function CareChatPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const g = useGuardian();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const level = g.triage?.level ?? 'UNKNOWN';
  const reasons = g.triage?.reasons ?? [];
  const voice = useSpeechDictation(lang);
  const today = useToday(`${level}`);
  const name = today.name ?? 'Mama';

  const [draft, setDraft] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [turns, setTurns] = useState<Turn[]>([]);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  const insightSeed = (loc.state as { insight?: string } | null)?.insight;
  useEffect(() => {
    if (!insightSeed) return;
    setTurns([
      {
        id: 'insight-seed',
        role: 'neema',
        title: sw ? 'Kutoka kadi za leo' : 'From today’s cards',
        text: insightSeed,
      },
    ]);
  }, [insightSeed, sw]);
  const endRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const speakHold = useRef(0);
  const chatting = turns.length > 0;
  const mood = level === 'UNKNOWN' ? 'waiting' : avatarState(level, g.redAcknowledged);
  const lastNeemaId = turns.findLast((turn) => turn.role === 'neema')?.id;
  const homeSignal = careSignal(undefined, level);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns, busy]);

  useEffect(() => {
    return () => window.clearTimeout(speakHold.current);
  }, []);

  function say(line: string) {
    primeMsingiPlayback();
    setSpeaking(true);
    window.clearTimeout(speakHold.current);
    speakHold.current = window.setTimeout(() => setSpeaking(false), Math.min(45_000, 1200 + line.length * 80));
    void speakText(line, { lang: sw ? 'sw-KE' : 'en-KE', studioFirst: true }).then((how) => {
      if (how === 'msingi') {
        setVoiceNote(null);
        return;
      }
      window.clearTimeout(speakHold.current);
      speakHold.current = window.setTimeout(() => setSpeaking(false), 1400);
      if (how === 'spoken') {
        setVoiceNote(
          sw
            ? 'Sauti ya studio haikujibu. Ninatumia sauti ya simu hii.'
            : 'Studio voice did not answer. Using this phone’s voice.',
        );
      }
    });
  }

  async function ask(query: string, opts?: { replaceTurnId?: string }) {
    primeMsingiPlayback();
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setDraft('');
    setVoiceNote(null);

    if (!opts?.replaceTurnId) {
      setTurns((t) => [...t, { id: crypto.randomUUID(), role: 'mama', text: q }]);
    }

    try {
      const answer = await askCareGuide({ query: q, lang, level, reasons });
      const reply: Turn = {
        id: crypto.randomUUID(),
        role: 'neema',
        title: answer.title,
        text: answer.body,
        handoff: answer.handoff,
        cardIds: answer.cardIds,
        urgency: answer.urgency,
        sourceQuery: q,
      };

      setTurns((t) => {
        if (opts?.replaceTurnId) {
          return t.map((turn) => (turn.id === opts.replaceTurnId ? reply : turn));
        }
        return [...t, reply];
      });

      say(turnSpeech(reply));
    } finally {
      setBusy(false);
    }
  }

  async function listenAsk() {
    primeMsingiPlayback();
    if (!voice.supported) {
      setVoiceNote(
        sw
          ? 'Kivinjari hiki hakisikii. Andika, na Neema atajibu kwa sauti.'
          : 'This browser cannot hear you. Type, and Neema will answer out loud.',
      );
      draftRef.current?.focus();
      return;
    }
    if (voice.listening) {
      voice.stop();
      return;
    }
    const heard = await voice.listen({ mode: 'text' });
    if (heard) await ask(heard);
  }

  /** Tapping Neema reads the screen out loud, for a mother who would rather listen than read. */
  function hearNeema() {
    if (voice.listening) return;
    const line =
      level === 'RED'
        ? sw
          ? `${STATUS_TEXT.RED.sw}. Gusa kitufe chekundu kuona hatua.`
          : `${STATUS_TEXT.RED.en}. Tap the red button to see the steps.`
        : sw
          ? `Habari, ${name}. Unajisikiaje leo? ${STATUS_TEXT[level].sw}.`
          : `Hello, ${name}. How are you feeling today? ${STATUS_TEXT[level].en}.`;
    say(line);
  }

  function goBack() {
    if (chatting) {
      setTurns([]);
      setMenuOpen(false);
      return;
    }
    nav(-1);
  }

  async function copyTurn(turn: Turn) {
    try {
      await navigator.clipboard.writeText(turnSpeech(turn));
      setCopiedId(turn.id);
      window.setTimeout(() => setCopiedId((id) => (id === turn.id ? null : id)), 1400);
    } catch {
      /* clipboard may be denied */
    }
  }

  function retryTurn(turn: Turn) {
    if (!turn.sourceQuery || busy) return;
    void ask(turn.sourceQuery, { replaceTurnId: turn.id });
  }

  const spoken = voice.error ?? voiceNote;

  return (
    <main className="screen screen--wide care-chat" data-chatting={chatting} data-mood={mood}>
      <header className="care-chat__top">
        <button type="button" className="care-chat__orb-btn" onClick={goBack} aria-label={sw ? 'Rudi' : 'Back'}>
          ←
        </button>
        <div className="care-chat__id">
          <BrandMark />
          <h1 className="care-chat__title">{sw ? 'Mazungumzo' : 'Care chat'}</h1>
        </div>
        <div className="care-chat__menu-wrap">
          <button
            type="button"
            className="care-chat__orb-btn"
            aria-label={sw ? 'Zaidi' : 'More'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <IconDots />
          </button>
          {menuOpen ? (
            <div className="care-chat__menu" role="menu">
              <LangToggle />
              {chatting ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setTurns([]);
                  }}
                >
                  {sw ? 'Anza upya' : 'New chat'}
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  nav('/home');
                }}
              >
                {sw ? 'Rudi Leo' : 'Back to Today'}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {!chatting ? (
        <section className="care-chat__home">
          <button
            type="button"
            className="care-chat__portrait-btn"
            data-speaking={speaking || voice.listening}
            data-signal={homeSignal}
            onClick={hearNeema}
            aria-label={sw ? 'Neema. Gusa umsikie' : 'Neema. Tap to hear her'}
          >
            <img src="/brand/neema-companion-cartoon.jpg" alt="" width={560} height={560} />
          </button>

          <p className="care-chat__hear">{sw ? 'Gusa usikie' : 'Tap her to hear'}</p>
          <p className="care-chat__hello">
            {sw ? 'Habari,' : 'Hello,'} {name}
          </p>
          <h2 className="care-chat__help">{sw ? 'Unajisikiaje leo?' : 'How are you feeling today?'}</h2>
          {level === 'RED' ? (
            <button type="button" className="care-chat__state-alert" onClick={() => nav('/alert')}>
              {STATUS_TEXT.RED[lang]} · {sw ? 'ona hatua' : 'see the steps'}
            </button>
          ) : (
            <p className="care-chat__state" data-level={level} data-signal={homeSignal}>
              <i aria-hidden />
              {STATUS_TEXT[level][lang]}
            </p>
          )}

          <div className="care-chat__feel">
            <p id="feel-label">{sw ? 'Gusa unachohisi' : 'Tap what you feel'}</p>
            <div className="care-chat__chips" role="group" aria-labelledby="feel-label">
              {FEELINGS[lang].map((f) => (
                <button
                  key={f}
                  type="button"
                  className="care-chat__chip"
                  data-chosen={chosen === f}
                  disabled={busy}
                  onClick={() => {
                    setChosen(f);
                    void ask(f);
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="care-chat__cards">
            <button type="button" className="care-chat__card" data-listening={voice.listening} onClick={() => void listenAsk()}>
              <span className="care-chat__card-ico" data-tone="voice">
                <IconMic />
              </span>
              <span className="care-chat__card-copy">
                <strong>{sw ? 'Mwambie Neema kwa sauti' : 'Tell Neema by voice'}</strong>
                <span>{sw ? 'Sema unavyojisikia. Neema atajibu kwa sauti.' : 'Say how you feel. Neema answers out loud.'}</span>
              </span>
              <IconChevron />
            </button>

            <button type="button" className="care-chat__card" onClick={() => nav('/sign')}>
              <span className="care-chat__card-ico" data-tone="sign">
                <IconHands />
              </span>
              <span className="care-chat__card-copy">
                <strong>{sw ? 'Lugha ya ishara' : 'Sign language'}</strong>
                <span>{sw ? 'Neema anaonyesha maneno kwa ishara.' : 'Neema shows the words in sign.'}</span>
              </span>
              <IconChevron />
            </button>

            <button type="button" className="care-chat__card" onClick={() => void ask(sw ? 'Nifanye nini?' : 'What should I do?')}>
              <span className="care-chat__card-ico" data-tone="guide">
                <IconFeel />
              </span>
              <span className="care-chat__card-copy">
                <strong>{sw ? 'Nifanye nini sasa?' : 'What should I do now?'}</strong>
                <span>{sw ? 'Hatua moja wazi, kulingana na vipimo vyako.' : 'One clear next step, based on your readings.'}</span>
              </span>
              <IconChevron />
            </button>
          </div>
        </section>
      ) : (
        <section className="care-chat__thread" aria-live="polite">
          {turns.map((turn) =>
            turn.role === 'neema' ? (
              <NeemaTurn
                key={turn.id}
                turn={turn}
                sw={sw}
                lang={lang}
                level={level}
                speaking={speaking && turn.id === lastNeemaId}
                copied={copiedId === turn.id}
                liked={Boolean(likedIds[turn.id])}
                busy={busy}
                onCopy={() => void copyTurn(turn)}
                onLike={() => setLikedIds((m) => ({ ...m, [turn.id]: !m[turn.id] }))}
                onSpeak={() => say(turnSpeech(turn))}
                onRetry={() => retryTurn(turn)}
                onAlert={() => nav('/alert')}
              />
            ) : (
              <article key={turn.id} className="care-msg" data-role="mama">
                <div className="care-msg__bubble care-msg__bubble--mama">
                  <span className="care-msg__who">{name}</span>
                  <p>{turn.text}</p>
                </div>
              </article>
            ),
          )}
          {busy ? (
            <div className="care-msg care-msg--typing" aria-hidden>
              <span className="care-portrait">
                <img src="/brand/neema-companion.jpg" alt="" width={240} height={240} />
              </span>
              <div className="care-card care-card--typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}
          <div ref={endRef} />
        </section>
      )}

      <div className="care-chat__dock">
        {voice.listening ? (
          <p className="care-chat__listen" role="status">
            {sw ? 'Nasikiliza… gusa Sema tena kusimamisha' : 'Listening… tap Speak again to stop'}
          </p>
        ) : null}
        <p className="visually-hidden" role="status">
          {speaking ? (sw ? 'Neema anaongea' : 'Neema is speaking') : ''}
        </p>
        <form
          className="care-chat__composer"
          data-open={composerOpen || draft.includes('\n')}
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
        >
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setComposerOpen(true)}
            onBlur={() => setComposerOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void ask(draft);
              }
            }}
            placeholder={sw ? 'Andika unavyojisikia, au uliza swali…' : 'Type how you feel, or ask a question…'}
            aria-label={sw ? 'Ujumbe wako' : 'Your message'}
            disabled={busy}
            rows={composerOpen || draft.includes('\n') ? 3 : 1}
          />
          <div className="care-chat__composer-bar">
            <div className="care-chat__ways">
              <button type="button" className="care-chat__way" aria-pressed={voice.listening} onClick={() => void listenAsk()}>
                <IconMic />
                {voice.listening ? (sw ? 'Simamisha' : 'Stop') : sw ? 'Sema' : 'Speak'}
              </button>
              <button type="button" className="care-chat__way" onClick={() => nav('/sign')}>
                <IconHands />
                {sw ? 'Ishara' : 'Sign language'}
              </button>
            </div>
            <button type="submit" className="care-chat__send" disabled={busy || !draft.trim()} aria-label={sw ? 'Tuma' : 'Send'}>
              <IconSend />
            </button>
          </div>
        </form>

        {spoken ? (
          <p className="field-error" role="alert">
            {spoken}
          </p>
        ) : null}
      </div>
    </main>
  );
}

function NeemaTurn({
  turn,
  sw,
  lang,
  level,
  speaking,
  copied,
  liked,
  busy,
  onCopy,
  onLike,
  onSpeak,
  onRetry,
  onAlert,
}: {
  turn: Turn;
  sw: boolean;
  lang: 'en' | 'sw';
  level: string;
  speaking: boolean;
  copied: boolean;
  liked: boolean;
  busy: boolean;
  onCopy: () => void;
  onLike: () => void;
  onSpeak: () => void;
  onRetry: () => void;
  onAlert: () => void;
}) {
  const signal = careSignal(turn.urgency, level);
  const steps = stepsIn(`${turn.title ?? ''} ${turn.text}`);
  return (
    <article className="care-msg" data-role="neema">
      <span className="care-portrait" data-speaking={speaking} data-signal={signal}>
        <img src="/brand/neema-companion.jpg" alt="" width={240} height={240} />
      </span>
      <div className="care-msg__stack">
        <div className="care-card" data-signal={signal} data-handoff={turn.handoff}>
          <p className="care-signal" data-signal={signal}>
            <i aria-hidden />
            {SIGNAL_WORD[signal][lang]}
          </p>
          {turn.title ? <h2 className="care-card__title">{turn.title}</h2> : null}
          <p className="care-card__body">{turn.text}</p>
          {steps.length > 0 ? (
            <ul className="care-steps" aria-label={sw ? 'Alichotaja' : 'What she named'}>
              {steps.map((step) => (
                <li key={step.id}>
                  <step.Icon />
                  <span>{sw ? step.sw : step.en}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {turn.handoff ? (
            <Button variant="primary" style={{ marginTop: '0.7rem' }} onClick={onAlert}>
              {sw ? 'Fungua tahadhari' : 'Open alert steps'}
            </Button>
          ) : null}
        </div>
        <div className="care-msg__actions">
          <button type="button" className="care-msg__action" aria-label={sw ? 'Nakili' : 'Copy'} onClick={onCopy}>
            <IconCopy />
            {copied ? <span className="care-msg__tip">{sw ? 'Imenakiliwa' : 'Copied'}</span> : null}
          </button>
          <button
            type="button"
            className="care-msg__action"
            aria-pressed={liked}
            aria-label={sw ? 'Nimependa' : 'Helpful'}
            onClick={onLike}
          >
            <IconThumb />
          </button>
          <button type="button" className="care-msg__action" aria-label={sw ? 'Sikiliza' : 'Listen'} onClick={onSpeak}>
            <IconSpeaker />
          </button>
          <button
            type="button"
            className="care-msg__action care-msg__action--end"
            aria-label={sw ? 'Jaribu tena' : 'Try again'}
            disabled={busy || !turn.sourceQuery}
            onClick={onRetry}
          >
            <IconRefresh />
          </button>
        </div>
      </div>
    </article>
  );
}
