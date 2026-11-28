/**
 * Avatar-front care coach: text / voice / sign mode.
 * Home shell + Smart Chart-style conversation thread; answers stay WHO-card grounded.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { avatarState } from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { useSpeechDictation } from '../hooks/useSpeechDictation';
import { useToday } from '../hooks/useToday';
import { askCareGuide } from '../services/careChat';
import { speakText } from '../services/speech';
import { Button } from '../ui/Button';
import { LangToggle } from '../ui/LangToggle';
import { NeemaAvatar } from '../ui/NeemaAvatar';
import {
  IconCopy,
  IconDots,
  IconFeel,
  IconMic,
  IconRefresh,
  IconSend,
  IconSpeaker,
  IconThumb,
} from '../ui/icons';

type Turn = {
  id: string;
  role: 'mama' | 'neema';
  text: string;
  title?: string;
  handoff?: boolean;
  cardIds?: string[];
  /** Mama query that produced this Neema reply (for retry). */
  sourceQuery?: string;
};

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

function turnSpeech(turn: Turn): string {
  return turn.title ? `${turn.title}. ${turn.text}` : turn.text;
}

/** Conversational WHO-guided coach with tutor home + conversation shell. */
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
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [turns, setTurns] = useState<Turn[]>([]);

  // Slides hand their words in so a question about "today" still has the cards.
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
  const chatting = turns.length > 0;
  // Her face follows the safety level. UNKNOWN is not shown as the calm smile.
  const mood = level === 'UNKNOWN' ? 'waiting' : avatarState(level, g.redAcknowledged);
  const lastNeemaId = turns.findLast((turn) => turn.role === 'neema')?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  async function ask(query: string, opts?: { replaceTurnId?: string }) {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setDraft('');

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
        sourceQuery: q,
      };

      setTurns((t) => {
        if (opts?.replaceTurnId) {
          return t.map((turn) => (turn.id === opts.replaceTurnId ? reply : turn));
        }
        return [...t, reply];
      });

      setSpeaking(true);
      void speakText(turnSpeech(reply), { lang: lang === 'sw' ? 'sw-KE' : 'en-KE' }).finally(() => {
        window.setTimeout(() => setSpeaking(false), 1200);
      });
    } finally {
      setBusy(false);
    }
  }

  async function listenAsk() {
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
    setSpeaking(true);
    void speakText(line, { lang: sw ? 'sw-KE' : 'en-KE' }).finally(() => {
      window.setTimeout(() => setSpeaking(false), 600);
    });
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

  function speakTurn(turn: Turn) {
    setSpeaking(true);
    void speakText(turnSpeech(turn), { lang: lang === 'sw' ? 'sw-KE' : 'en-KE' }).finally(() => {
      window.setTimeout(() => setSpeaking(false), 800);
    });
  }

  function retryTurn(turn: Turn) {
    if (!turn.sourceQuery || busy) return;
    void ask(turn.sourceQuery, { replaceTurnId: turn.id });
  }

  return (
    <main className="screen screen--wide care-chat" data-chatting={chatting}>
      <header className="care-chat__top">
        <button type="button" className="care-chat__orb-btn" onClick={goBack} aria-label={sw ? 'Rudi' : 'Back'}>
          ←
        </button>
        <h1 className="care-chat__title">{chatting ? (sw ? 'Mazungumzo' : 'Care chat') : 'Neema'}</h1>
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
          <div className="care-chat__orb" data-speaking={speaking || voice.listening}>
            <NeemaAvatar
              live
              framing="close"
              mood={mood}
              speaking={speaking}
              listening={voice.listening}
              label={sw ? 'Neema. Gusa umsikie' : 'Neema. Tap to hear her'}
              onPress={hearNeema}
            />
          </div>

          <p className="care-chat__hello">
            {sw ? 'Habari,' : 'Hello,'} {name}
          </p>
          {/* The daily check-in lands here, so the screen opens with the check-in question. */}
          <h2 className="care-chat__help">{sw ? 'Unajisikiaje leo?' : 'How are you feeling today?'}</h2>
          {level === 'RED' ? (
            <button type="button" className="care-chat__state-alert" onClick={() => nav('/alert')}>
              {STATUS_TEXT.RED[lang]} · {sw ? 'ona hatua' : 'see the steps'}
            </button>
          ) : (
            <p className="care-chat__state" data-level={level}>
              {STATUS_TEXT[level][lang]}
            </p>
          )}

          <div className="care-chat__cards">
            {voice.supported ? (
              <button type="button" className="care-chat__card" onClick={() => void listenAsk()}>
                <span className="care-chat__card-ico" data-tone="voice">
                  <IconMic />
                </span>
                <strong>{sw ? 'Mwambie Neema kwa sauti' : 'Tell Neema by voice'}</strong>
                <span>{sw ? 'Sema unavyojisikia. Neema atajibu kwa sauti.' : 'Say how you feel. Neema answers out loud.'}</span>
              </button>
            ) : null}

            <button type="button" className="care-chat__card" onClick={() => void ask(sw ? 'Nifanye nini?' : 'What should I do?')}>
              <span className="care-chat__card-ico" data-tone="guide">
                <IconFeel />
              </span>
              <strong>{sw ? 'Nifanye nini sasa?' : 'What should I do now?'}</strong>
              <span>{sw ? 'Hatua moja wazi, kulingana na vipimo vyako.' : 'One clear next step, based on your readings.'}</span>
            </button>
          </div>

          <div className="care-chat__feel">
            <p id="feel-label">{sw ? 'Au gusa unachohisi' : 'Or tap what you feel'}</p>
            <div className="care-chat__chips" role="group" aria-labelledby="feel-label">
              {FEELINGS[lang].map((f) => (
                <button key={f} type="button" className="care-chat__chip" disabled={busy} onClick={() => void ask(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="care-chat__thread" aria-live="polite">
          {turns.map((turn) =>
            turn.role === 'neema' ? (
              <article key={turn.id} className="care-msg" data-role="neema">
                <span className="care-msg__face">
                  <NeemaAvatar framing="face" mood={mood} speaking={speaking && turn.id === lastNeemaId} />
                </span>
                <div className="care-msg__stack">
                  <div className="care-msg__bubble" data-handoff={turn.handoff}>
                    {turn.title ? <strong>{turn.title}</strong> : null}
                    <p>{turn.text}</p>
                    {turn.handoff ? (
                      <Button variant="primary" style={{ marginTop: '0.55rem' }} onClick={() => nav('/alert')}>
                        {sw ? 'Fungua tahadhari' : 'Open alert steps'}
                      </Button>
                    ) : null}
                  </div>
                  <div className="care-msg__actions">
                    <button
                      type="button"
                      className="care-msg__action"
                      aria-label={sw ? 'Nakili' : 'Copy'}
                      onClick={() => void copyTurn(turn)}
                    >
                      <IconCopy />
                      {copiedId === turn.id ? <span className="care-msg__tip">{sw ? 'Imenakiliwa' : 'Copied'}</span> : null}
                    </button>
                    <button
                      type="button"
                      className="care-msg__action"
                      aria-pressed={Boolean(likedIds[turn.id])}
                      aria-label={sw ? 'Nimependa' : 'Helpful'}
                      onClick={() => setLikedIds((m) => ({ ...m, [turn.id]: !m[turn.id] }))}
                    >
                      <IconThumb />
                    </button>
                    <button
                      type="button"
                      className="care-msg__action"
                      aria-label={sw ? 'Sikiliza' : 'Listen'}
                      onClick={() => speakTurn(turn)}
                    >
                      <IconSpeaker />
                    </button>
                    <button
                      type="button"
                      className="care-msg__action care-msg__action--end"
                      aria-label={sw ? 'Jaribu tena' : 'Try again'}
                      disabled={busy || !turn.sourceQuery}
                      onClick={() => retryTurn(turn)}
                    >
                      <IconRefresh />
                    </button>
                  </div>
                </div>
              </article>
            ) : (
              <article key={turn.id} className="care-msg" data-role="mama">
                <div className="care-msg__bubble care-msg__bubble--mama">
                  <p>{turn.text}</p>
                </div>
                <span className="care-msg__face care-msg__face--mama" aria-hidden>
                  {name.charAt(0).toUpperCase()}
                </span>
              </article>
            ),
          )}
          {busy ? (
            <div className="care-msg care-msg--typing" aria-hidden>
              <span className="care-msg__face">
                <NeemaAvatar framing="face" mood={mood} />
              </span>
              <div className="care-msg__bubble care-msg__bubble--typing">
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
        <form
          className="care-chat__composer"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={sw ? 'Andika unavyojisikia, au uliza swali…' : 'Type how you feel, or ask a question…'}
            aria-label={sw ? 'Ujumbe wako' : 'Your message'}
            disabled={busy}
            rows={2}
          />
          <div className="care-chat__composer-bar">
            {/* The other ways to talk sit with the text box, each with its word. */}
            <div className="care-chat__ways">
              {voice.supported ? (
                <button type="button" className="care-chat__way" aria-pressed={voice.listening} onClick={() => void listenAsk()}>
                  <IconMic />
                  {voice.listening ? (sw ? 'Gusa kusimamisha' : 'Tap to stop') : sw ? 'Sema' : 'Speak'}
                </button>
              ) : null}
              <button type="button" className="care-chat__way" onClick={() => nav('/sign')}>
                {sw ? 'Lugha ya ishara' : 'Sign language'}
              </button>
            </div>
            <button type="submit" className="care-chat__send" disabled={busy || !draft.trim()} aria-label={sw ? 'Tuma' : 'Send'}>
              <IconSend />
            </button>
          </div>
        </form>

        {voice.error ? (
          <p className="field-error" role="alert">
            {voice.error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
