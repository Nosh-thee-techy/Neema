/**
 * Compact glass KPI tile: big reading, mini spark bars, short note.
 */

import type { ReactNode } from 'react';

export type KpiTone = 'calm' | 'watch' | 'alert' | 'muted';

function KpiBody({
  label,
  value,
  unit,
  note,
  spark,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  spark: number[];
  icon?: ReactNode;
}) {
  return (
    <>
      <div className="kpi-tile__top">
        <span className="kpi-tile__label">
          {icon ? <span className="kpi-tile__icon">{icon}</span> : null}
          {label}
        </span>
        {spark.length > 0 ? (
          <span className="kpi-tile__spark" aria-hidden>
            {spark.map((h, i) => (
              <i key={i} style={{ height: `${Math.max(12, Math.round(h * 100))}%` }} />
            ))}
          </span>
        ) : null}
      </div>
      <p className="kpi-tile__value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </p>
      <p className="kpi-tile__note">{note}</p>
    </>
  );
}

/** One vital summary for the home bento top row. */
export function KpiTile({
  label,
  value,
  unit,
  note,
  tone = 'muted',
  spark = [],
  icon,
  onClick,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  tone?: KpiTone;
  /** 0..1 bar heights, oldest → newest. */
  spark?: number[];
  icon?: ReactNode;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button type="button" className="kpi-tile" data-tone={tone} onClick={onClick}>
        <KpiBody label={label} value={value} unit={unit} note={note} spark={spark} icon={icon} />
      </button>
    );
  }
  return (
    <div className="kpi-tile" data-tone={tone}>
      <KpiBody label={label} value={value} unit={unit} note={note} spark={spark} icon={icon} />
    </div>
  );
}

/** Turn recent values into 5 spark heights (0..1). */
export function sparkFromValues(values: Array<number | null | undefined>, min: number, max: number): number[] {
  const slice = values.filter((v): v is number => typeof v === 'number').slice(-5);
  if (slice.length === 0) return [];
  const span = Math.max(1, max - min);
  while (slice.length < 5) slice.unshift(slice[0]!);
  return slice.map((v) => Math.min(1, Math.max(0.12, (v - min) / span)));
}
