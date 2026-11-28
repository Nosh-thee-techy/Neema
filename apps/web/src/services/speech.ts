/**
 * Speech output for triage messages.
 * Prefer Msingi Sauti (CareLoop voice path) via /api/tts, then browser speechSynthesis,
 * then optional pre-recorded audioFallback URLs.
 */

import { getMessageCatalog } from '@neema/core';
import swMessages from '../../../../packages/core/src/messages/sw.json';
import { playMsingiAudio } from './msingi';

export type SpeakOptions = {
  /** BCP-47 tag; default sw-KE for synthesis fallback. */
  lang?: string;
  /** Optional map of messageKey -> audio URL for offline fallback. */
  audioFallback?: Record<string, string>;
  /** Skip Msingi and use browser synthesis only. */
  browserOnly?: boolean;
  /**
   * Wait for Msingi Sauti, then use the phone voice only if the studio
   * does not answer. Care chat uses this so her Kiswahili voice is the one heard.
   */
  studioFirst?: boolean;
};

function lookupMessage(messageKey: string): string | undefined {
  const record = swMessages as unknown as Record<string, unknown>;
  const value = record[messageKey];
  return typeof value === 'string' ? value : undefined;
}

const WOMAN_VOICE = /female|woman|zira|samantha|victoria|moira|karen|tessa|fiona|susan|hazel|aria|jenny|sonia|libby|natasha|amara|linda|heather|catherine|allison|ava|serena|joanna|kendra|salli|ivy|kimberly/i;
const MAN_VOICE = /\bmale\b|\bdavid\b|\bmark\b|\bguy\b|\bgeorge\b|\bravi\b|\bdaniel\b|\bjames\b|\bbrian\b|\bmatthew\b|\bjustin\b/i;

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const want = lang.toLowerCase().slice(0, 2);
  const ranked = voices.filter(
    (v) => v.lang.toLowerCase().startsWith(want) || v.lang.toLowerCase().startsWith('sw') || v.lang.toLowerCase().startsWith('en'),
  );
  return (
    ranked.find((v) => WOMAN_VOICE.test(v.name) && !MAN_VOICE.test(v.name)) ??
    ranked.find((v) => !MAN_VOICE.test(v.name)) ??
    ranked[0] ??
    null
  );
}

/**
 * Browser voice. Chrome drops a speak() that follows cancel() in the same turn,
 * and a paused queue never starts, so this resumes and speaks on the next tick.
 */
function speakBrowser(text: string, lang: string): boolean {
  if (!('speechSynthesis' in window)) return false;
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.96;
  const match = pickVoice(lang);
  if (match) utter.voice = match;
  if (synth.paused) synth.resume();
  synth.cancel();
  window.setTimeout(() => {
    if (synth.paused) synth.resume();
    synth.speak(utter);
  }, 40);
  return true;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices();
  });
}

/** A newer line supersedes an older one, so a cancelled Sauti call must not fall back out loud. */
let lineGen = 0;

/**
 * Msingi Sauti first when asked, otherwise the phone voice may start while
 * the studio line is still on its way and is replaced if Sauti answers.
 */
async function speakLine(
  text: string,
  options: SpeakOptions,
): Promise<'msingi' | 'spoken' | 'text-only'> {
  const gen = ++lineGen;
  const lang = options.lang ?? 'sw-KE';
  window.speechSynthesis?.cancel();
  if (options.browserOnly) {
    return speakBrowser(text, lang) ? 'spoken' : 'text-only';
  }
  if (options.studioFirst) {
    try {
      if (await playMsingiAudio(text)) return 'msingi';
    } catch {
      /* phone voice below */
    }
    if (gen !== lineGen) return 'text-only';
    return speakBrowser(text, lang) ? 'spoken' : 'text-only';
  }

  let started = false;
  const local = window.setTimeout(() => {
    if (gen !== lineGen) return;
    started = true;
    speakBrowser(text, lang);
  }, 400);
  try {
    if (await playMsingiAudio(text)) {
      window.clearTimeout(local);
      if (started) window.speechSynthesis?.cancel();
      return 'msingi';
    }
  } catch {
    /* phone voice below */
  }
  window.clearTimeout(local);
  if (gen !== lineGen) return started ? 'spoken' : 'text-only';
  if (started) return 'spoken';
  return speakBrowser(text, lang) ? 'spoken' : 'text-only';
}

/**
 * Speaks a message key from sw.json.
 * Returns 'msingi' | 'spoken' | 'audio' | 'text-only' so the UI can show fallbacks.
 */
export async function speakMessageKey(
  messageKey: string,
  options: SpeakOptions = {},
): Promise<'msingi' | 'spoken' | 'audio' | 'text-only'> {
  const text = lookupMessage(messageKey);
  if (!text || messageKey.startsWith('_')) return 'text-only';

  const heard = await speakLine(text, options);
  if (heard !== 'text-only') return heard;

  const url = options.audioFallback?.[messageKey];
  if (url) {
    const audio = new Audio(url);
    await audio.play();
    return 'audio';
  }

  return 'text-only';
}

/** Speaks arbitrary approved text (same cascade as message keys). */
export async function speakText(
  text: string,
  options: SpeakOptions = {},
): Promise<'msingi' | 'spoken' | 'text-only'> {
  const trimmed = text.trim();
  if (!trimmed) return 'text-only';
  return speakLine(trimmed, options);
}

/** Returns the Swahili draft text for a message key (for on-screen display). */
export function getMessageText(messageKey: string): string {
  return lookupMessage(messageKey) ?? messageKey;
}

/**
 * On-screen text for a message key in the mother's chosen language.
 * English uses the catalog gloss; returns null when the key has no text.
 */
export function getMessageTextFor(messageKey: string, lang: 'en' | 'sw'): string | null {
  if (lang === 'sw') return lookupMessage(messageKey) ?? null;
  const entry = getMessageCatalog().find((e) => e.key === messageKey);
  return entry?.enGloss || null;
}
