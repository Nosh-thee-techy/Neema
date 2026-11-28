/**
 * Msingi Sauti client — same provider as CareLoop voice lab.
 * Calls same-origin /api/tts so the API key stays on the server (Vite middleware / Node serve).
 *
 * Studio speech usually returns in a few seconds. A short abort made Care chat
 * give up and speak with the browser voice before Sauti answered.
 */

export class MsingiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MsingiError';
  }
}

const STUDIO_TIMEOUT_MS = 45_000;

let voiceCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentEl: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let inflight: AbortController | null = null;

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Call from the click or submit that will later play a reply.
 * Resuming the audio context in that gesture lets Sauti play after the network wait.
 */
export function primeMsingiPlayback(): void {
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  if (!voiceCtx) voiceCtx = new Ctor();
  if (voiceCtx.state === 'suspended') void voiceCtx.resume();
}

function stopMsingiPlayback(): void {
  try {
    currentSource?.stop();
  } catch {
    /* already stopped */
  }
  currentSource = null;
  if (currentEl) {
    currentEl.pause();
    currentEl.src = '';
    currentEl = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

/** Returns WAV bytes for an approved spoken line, or null when TTS is unavailable. */
export async function msingiSpeak(text: string, timeoutMs = STUDIO_TIMEOUT_MS): Promise<Blob | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  inflight?.abort();
  const ctrl = new AbortController();
  inflight = ctrl;
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
      signal: ctrl.signal,
    });
    if (res.status === 503) return null;
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new MsingiError(detail || 'Voice service could not complete that turn.');
    }
    const blob = await res.blob();
    if (blob.size < 100) return null;
    return blob;
  } catch (err) {
    if (err instanceof MsingiError) throw err;
    return null;
  } finally {
    window.clearTimeout(timer);
    if (inflight === ctrl) inflight = null;
  }
}

async function playBlob(blob: Blob): Promise<boolean> {
  if (voiceCtx) {
    try {
      if (voiceCtx.state === 'suspended') await voiceCtx.resume();
      if (voiceCtx.state === 'running') {
        const decoded = await voiceCtx.decodeAudioData((await blob.arrayBuffer()).slice(0));
        const src = voiceCtx.createBufferSource();
        src.buffer = decoded;
        src.connect(voiceCtx.destination);
        src.start();
        currentSource = src;
        return true;
      }
    } catch {
      /* fall through to an audio element */
    }
  }
  const url = URL.createObjectURL(blob);
  currentUrl = url;
  const audio = new Audio(url);
  currentEl = audio;
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/** Plays WAV from Msingi Sauti; returns false if unavailable. */
export async function playMsingiAudio(text: string, timeoutMs = STUDIO_TIMEOUT_MS): Promise<boolean> {
  stopMsingiPlayback();
  const blob = await msingiSpeak(text, timeoutMs);
  if (!blob) return false;
  return playBlob(blob);
}
