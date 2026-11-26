/**
 * Browser speech-to-text for form help (Web Speech API).
 * Works in Chromium; gracefully unavailable elsewhere.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecCtor = new () => SpeechRec;

function recognitionCtor(): SpeechRecCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecCtor;
    webkitSpeechRecognition?: SpeechRecCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechDictationAvailable(): boolean {
  return recognitionCtor() !== null;
}

/** Digits from spoken phone numbers ("zero seven one two…"). */
export function digitsFromSpeech(raw: string): string {
  const wordMap: Record<string, string> = {
    zero: '0',
    oh: '0',
    o: '0',
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    sifuri: '0',
    moja: '1',
    mbili: '2',
    tatu: '3',
    nne: '4',
    tano: '5',
    sita: '6',
    saba: '7',
    nane: '8',
    tisa: '9',
  };
  const tokens = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  let out = '';
  for (const t of tokens) {
    if (/^\d+$/.test(t)) out += t;
    else if (wordMap[t]) out += wordMap[t];
  }
  if (!out) out = raw.replace(/\D/g, '');
  return out.slice(0, 15);
}

/** Listen once; return transcript or null. */
export function useSpeechDictation(lang: 'en' | 'sw' = 'en') {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => speechDictationAvailable());
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const listen = useCallback(
    (opts?: { mode?: 'text' | 'phone' }) =>
      new Promise<string | null>((resolve) => {
        const Ctor = recognitionCtor();
        if (!Ctor) {
          setError(lang === 'sw' ? 'Sauti haipatikani kwenye kivinjari hiki.' : 'Voice is not available in this browser.');
          resolve(null);
          return;
        }
        setError(null);
        try {
          recRef.current?.abort();
        } catch {
          /* ignore */
        }
        const rec = new Ctor();
        recRef.current = rec;
        rec.lang = lang === 'sw' ? 'sw-KE' : 'en-KE';
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        setListening(true);

        rec.onresult = (ev) => {
          const raw = ev.results[0]?.[0]?.transcript?.trim() ?? '';
          const value = opts?.mode === 'phone' ? digitsFromSpeech(raw) : raw;
          resolve(value || null);
        };
        rec.onerror = (ev) => {
          if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
            setError(
              lang === 'sw'
                ? 'Sikuskia vizuri. Jaribu tena karibu na mikrofoni.'
                : 'Could not hear clearly. Try again near the mic.',
            );
          }
          resolve(null);
        };
        rec.onend = () => setListening(false);

        try {
          rec.start();
        } catch {
          setListening(false);
          setError(lang === 'sw' ? 'Mikrofoni haikuanza.' : 'Could not start the microphone.');
          resolve(null);
        }
      }),
    [lang],
  );

  return { supported, listening, error, listen, stop, clearError: () => setError(null) };
}
