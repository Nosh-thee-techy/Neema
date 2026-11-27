import { useEffect, useRef, useState } from 'react';

const HOLD_MS = 2000;

interface EmergencyHoldButtonProps {
  lang: 'en' | 'sw';
  onTrigger: () => void;
}

/**
 * Header emergency action (rule R9 + phone dialer). Press and hold for 2 seconds so a
 * pocket tap never raises an emergency. Works with touch, mouse and keyboard.
 * On trigger the caller raises the SOS alert (SMS to CHP/family) and opens the 999 dialer.
 */
export function EmergencyHoldButton({ lang, onTrigger }: EmergencyHoldButtonProps) {
  const sw = lang === 'sw';
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
      }, 1500);
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

  const holding = progress > 0 && progress < 1;
  const line1 = progress >= 1 ? (sw ? 'Inapiga…' : 'Calling…') : holding ? (sw ? 'Endelea kushikilia' : 'Keep holding') : sw ? 'SHIKILIA' : 'HOLD';
  const line2 = sw ? '999 + CHP' : '999 + CHP';

  return (
    <button
      type="button"
      className="sos-hold"
      data-testid="sos-button"
      data-holding={holding}
      aria-label={
        sw
          ? 'Dharura: shikilia sekunde 2 kupiga 999 na kumjulisha CHP wako'
          : 'Emergency: hold for 2 seconds to call 999 and alert your CHP'
      }
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
      style={{ ['--hold' as string]: `${progress * 360}deg` }}
    >
      <span className="sos-hold__ring" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
        </svg>
      </span>
      <span className="sos-hold__text">
        <strong>{line1}</strong>
        <small>{line2}</small>
      </span>
    </button>
  );
}
