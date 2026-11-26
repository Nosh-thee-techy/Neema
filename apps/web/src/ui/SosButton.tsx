import { useEffect, useRef, useState } from 'react';

const HOLD_MS = 2000;

interface SosButtonProps {
  lang: 'en' | 'sw';
  onTrigger: () => void;
}

/**
 * App SOS (rule R9). Press and hold for 2 seconds, like the band's long-press,
 * so a pocket tap never raises an emergency. Works with touch, mouse and keyboard.
 */
export function SosButton({ lang, onTrigger }: SosButtonProps) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const stop = () => {
    startRef.current = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (!firedRef.current) setProgress(0);
  };

  const tick = () => {
    if (startRef.current === null) return;
    const p = Math.min(1, (performance.now() - startRef.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      firedRef.current = true;
      stop();
      onTrigger();
      window.setTimeout(() => {
        firedRef.current = false;
        setProgress(0);
      }, 1200);
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (startRef.current !== null || firedRef.current) return;
    startRef.current = performance.now();
    frameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => stop, []);

  return (
    <button
      type="button"
      className="sos-btn"
      data-testid="sos-button"
      data-armed={progress > 0.5}
      aria-label={lang === 'sw' ? 'SOS: shikilia sekunde 2 kuomba msaada' : 'SOS: hold for 2 seconds to call for help'}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={stop}
      onContextMenu={(e) => e.preventDefault()}
      style={{ ['--sos-progress' as string]: `${progress * 100}%` }}
    >
      <span className="sos-btn__fill" aria-hidden />
      <span className="sos-btn__label">
        <strong>SOS</strong>
        <small>
          {progress >= 1
            ? lang === 'sw'
              ? 'Inaitwa…'
              : 'Calling…'
            : lang === 'sw'
              ? 'Shikilia 2s'
              : 'Hold 2s'}
        </small>
      </span>
    </button>
  );
}
