/**
 * Avatar-front care coach: text / voice / sign mode.
 * Home shell + Smart Chart-style conversation thread; answers stay WHO-card grounded.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { useSpeechDictation } from '../hooks/useSpeechDictation';
import { useToday } from '../hooks/useToday';
import { askCareGuide } from '../services/careChat';
import { speakText } from '../services/speech';
import { Button } from '../ui/Button';
import { LangToggle } from '../ui/LangToggle';
import {
  IconCopy,
  IconDots,
  IconFeel,
  IconMic,
  IconPlus,
  IconRefresh,
  IconSend,
  IconSpark,
  IconSpeaker,
  IconThumb,
} from '../ui/icons';

type Mode = 'text' | 'voice' | 'sign';

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

const PROMPTS = {
  en: [
    'What should I do?',
    'I feel dizzy',
    'My head hurts',
    'Baby is moving less',
    'I am stressed',
  ],
  sw: ['Nifanye nini?', 'Naona kizunguzungu', 'Kichwa kinauma', 'Mtoto anasonga kidogo', 'Nina msongo'],
};

function turnSpeech(turn: Turn): string {
  return turn.title ? `${turn.title}. ${turn.text}` : turn.text;
}

/** Conversational WHO-guided coach with tutor home + conversation shell. */
export function CareChatPage() {
  const nav = useNavigate();
  const g = useGuardian();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const level = g.triage?.level ?? 'UNKNOWN';
  const reasons = g.triage?.reasons ?? [];
  const voice = useSpeechDictation(lang);
  const today = useToday(`${level}`);
  const name = today.name ?? 'Mama';

  const [mode, setMode] = useState<Mode>('voice');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [turns, setTurns] = useState<Turn[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const chatting = turns.length > 0;

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

      if (mode === 'voice' || mode === 'text') {
        setSpeaking(true);
        void speakText(turnSpeech(reply), { lang: lang === 'sw' ? 'sw-KE' : 'en-KE' }).finally(() => {
          window.setTimeout(() => setSpeaking(false), 1200);
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function listenAsk() {
    if (voice.listening) {
      voice.stop();
      return;
    }
    setMode('voice');
    const heard = await voice.listen({ mode: 'text' });
    if (heard) await ask(heard);
  }

  function insertPrompt() {
    const next = PROMPTS[lang][0];
    setDraft(next);
    setMode('text');
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
                  nav('/todo');
                }}
              >
                {sw ? 'Orodha ya leo' : 'Today’s list'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  nav('/home');
                }}
              >
                {sw ? 'Nyumbani' : 'Home'}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {!chatting ? (
        <section className="care-chat__home">
          <div className="care-chat__orb" data-speaking={speaking || voice.listening}>
            <img
              src="/brand/neema-companion.jpg"
              alt=""
              width={220}
              height={220}
              decoding="async"
              className="care-chat__orb-img"
            />
          </div>

          <p className="care-chat__hello">
            {sw ? 'Habari,' : 'Hello,'} {name}
          </p>
          <h2 className="care-chat__help">{sw ? 'Naweza kukusaidiaje?' : 'How can I help you?'}</h2>

          <div className="care-chat__cards">
            <button
              type="button"
              className="care-chat__card"
              onClick={() => {
                setMode('voice');
                void listenAsk();
              }}
            >
              <span className="care-chat__card-ico" data-tone="voice">
                <IconMic />
              </span>
              <span className="care-chat__card-arrow" aria-hidden>
                ↗
              </span>
              <strong>{sw ? 'Ongea kwa sauti' : 'Practice speaking'}</strong>
              <span>
                {sw
                  ? 'Sema jinsi unavyohisi — Neema anajibu kwa sauti.'
                  : 'Say how you feel — Neema answers out loud.'}
              </span>
            </button>

            <button
              type="button"
              className="care-chat__card"
              onClick={() => {
                setMode('text');
                void ask(sw ? 'Nifanye nini?' : 'What should I do?');
              }}
            >
              <span className="care-chat__card-ico" data-tone="guide">
                <IconFeel />
              </span>
              <span className="care-chat__card-arrow" aria-hidden>
                ↗
              </span>
              <strong>{sw ? 'Nifanye nini?' : 'What should I do?'}</strong>
              <span>
                {sw
                  ? 'Hatua moja kutoka kadi za WHO + hali yako.'
                  : 'One clear step from WHO cards + your state.'}
              </span>
            </button>
          </div>
        </section>
      ) : (
        <section className="care-chat__thread" aria-live="polite">
          {turns.map((turn) =>
            turn.role === 'neema' ? (
              <article key={turn.id} className="care-msg" data-role="neema">
                <img
                  className="care-msg__face"
                  src="/brand/neema-companion.jpg"
                  alt=""
                  width={40}
                  height={40}
                  decoding="async"
                />
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
              <img className="care-msg__face" src="/brand/neema-companion.jpg" alt="" width={40} height={40} />
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
        <div className="care-chat__status">
          <p>
            <strong>{level}</strong>{' '}
            {sw ? '· majibu kutoka kadi za WHO' : '· answers from WHO care cards'}
          </p>
          <button type="button" className="care-chat__status-link" onClick={() => nav('/sign')}>
            {sw ? 'Ishara' : 'Sign'}
          </button>
        </div>

        {mode === 'sign' ? (
          <div className="care-chat__composer care-chat__composer--sign">
            <p className="soft-note">
              {sw
                ? 'Ishara hutumia mazungumzo yaliyoruhusiwa. Fungua kikao au rudia sauti/maandishi.'
                : 'Sign uses allowlisted clips. Open the session, or switch back to voice/text.'}
            </p>
            <div className="care-chat__sign-row">
              <Button variant="primary" onClick={() => nav('/sign')}>
                {sw ? 'Fungua ishara' : 'Open sign'}
              </Button>
              <Button variant="secondary" onClick={() => setMode('voice')}>
                {sw ? 'Sauti' : 'Voice'}
              </Button>
            </div>
          </div>
        ) : (
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
              placeholder={sw ? 'Uliza chochote kuhusu afya yako…' : 'Ask anything about your care…'}
              aria-label={sw ? 'Ujumbe wako' : 'Your message'}
              disabled={busy}
              rows={2}
            />
            <div className="care-chat__composer-bar">
              <div className="care-chat__tools">
                <button
                  type="button"
                  className="care-chat__tool"
                  aria-label={sw ? 'Pendekezo' : 'Suggestion'}
                  onClick={insertPrompt}
                >
                  <IconSpark />
                </button>
                <button
                  type="button"
                  className="care-chat__tool"
                  aria-label={sw ? 'Ishara' : 'Sign'}
                  onClick={() => setMode('sign')}
                >
                  <IconPlus />
                </button>
                {voice.supported ? (
                  <button
                    type="button"
                    className="care-chat__tool"
                    aria-pressed={voice.listening}
                    aria-label={sw ? 'Sema' : 'Speak'}
                    onClick={() => void listenAsk()}
                  >
                    <IconMic />
                  </button>
                ) : null}
              </div>
              <button
                type="submit"
                className="care-chat__send"
                disabled={busy || !draft.trim()}
                aria-label={sw ? 'Tuma' : 'Send'}
              >
                <IconSend />
              </button>
            </div>
          </form>
        )}

        {voice.error ? (
          <p className="field-error" role="alert">
            {voice.error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
