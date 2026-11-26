import type { ReactNode } from 'react';

/** Colour meaning of a gauge. Comes from the same thresholds the rules use, never invented. */
export type GaugeTone = 'calm' | 'watch' | 'alert' | 'accent' | 'muted';

interface RingGaugeProps {
  label: string;
  value: string;
  unit?: string;
  /** 0..1 arc fill; null draws only the track (no reading). */
  fraction: number | null;
  tone: GaugeTone;
  icon?: ReactNode;
  /** Short caption under the label, e.g. "her normal 66–78". */
  note?: string;
  onClick?: () => void;
}

const R = 30;
const C = 2 * Math.PI * R;

/** A small ring with a reading in the middle, in a row of rings at the top of a dashboard. */
export function RingGauge({ label, value, unit, fraction, tone, icon, note, onClick }: RingGaugeProps) {
  const f = fraction === null ? 0 : Math.max(0.02, Math.min(1, fraction));
  const body = (
    <>
      <span className="ring__dial">
        <svg viewBox="0 0 72 72" aria-hidden>
          <circle className="ring__track" cx="36" cy="36" r={R} />
          {fraction !== null ? (
            <circle
              className="ring__arc"
              cx="36"
              cy="36"
              r={R}
              strokeDasharray={`${C * f} ${C}`}
              transform="rotate(-90 36 36)"
            />
          ) : null}
        </svg>
        <span className="ring__value">
          {value}
          {unit ? <small>{unit}</small> : null}
        </span>
      </span>
      <span className="ring__label">
        {icon ? <span className="ring__icon">{icon}</span> : null}
        {label}
      </span>
      {note ? <span className="ring__note">{note}</span> : null}
    </>
  );

  return onClick ? (
    <button type="button" className="ring" data-tone={tone} onClick={onClick} aria-label={`${label}: ${value}${unit ?? ''}`}>
      {body}
    </button>
  ) : (
    <div className="ring" data-tone={tone} role="group" aria-label={`${label}: ${value}${unit ?? ''}`}>
      {body}
    </div>
  );
}
