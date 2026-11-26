/**
 * Attention alarm for escalation steps: a short beep pattern and phone vibration.
 * Uses Web Audio (no audio file, works offline). Fails quietly where unsupported.
 */

let ctx: AudioContext | null = null;

/** Plays three rising beeps and vibrates the phone. */
export function soundAlarm(): void {
  try {
    navigator.vibrate?.([400, 150, 400, 150, 400]);
  } catch {
    // vibration unsupported
  }
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    void ctx.resume();
    const start = ctx.currentTime + 0.05;
    [660, 784, 988].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = start + i * 0.32;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  } catch {
    // audio blocked until the user has interacted; vibration still fired
  }
}
