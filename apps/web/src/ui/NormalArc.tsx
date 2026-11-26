/**
 * Half-circle gauge: where a reading sits on a scale, with her own normal band highlighted.
 * Used for the "Tonight" card. The band only appears once her baseline is trusted.
 */

interface NormalArcProps {
  /** Scale ends, e.g. 40–160 bpm. */
  min: number;
  max: number;
  value: number | null;
  /** Her normal range, or null while learning. */
  band: { low: number; high: number } | null;
  /** Big centre text and caption. */
  display: string;
  caption: string;
  minLabel?: string;
  maxLabel?: string;
}

const CX = 150;
const CY = 150;
const R = 120;

function point(frac: number): [number, number] {
  const angle = Math.PI * (1 - frac); // 180° (left) → 0° (right)
  return [CX + R * Math.cos(angle), CY - R * Math.sin(angle)];
}

function arcPath(from: number, to: number): string {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  // A half-circle never spans more than 180°, so the small-arc flag is always right;
  // sweep 1 goes left → over the top → right.
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
}

export function NormalArc({ min, max, value, band, display, caption, minLabel, maxLabel }: NormalArcProps) {
  const frac = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min)));
  const marker = value === null ? null : point(frac(value));
  const outside = value !== null && band !== null && (value < band.low || value > band.high);

  return (
    <svg className="normal-arc" viewBox="0 0 300 180" role="img" aria-label={`${display} ${caption}`}>
      <path className="normal-arc__track" d={arcPath(0, 1)} />
      {band ? <path className="normal-arc__band" d={arcPath(frac(band.low), frac(band.high))} /> : null}
      {value !== null ? <path className="normal-arc__fill" d={arcPath(0, frac(value))} data-outside={outside} /> : null}
      {marker ? (
        <>
          <circle className="normal-arc__halo" cx={marker[0]} cy={marker[1]} r="13" data-outside={outside} />
          <circle className="normal-arc__dot" cx={marker[0]} cy={marker[1]} r="7" />
        </>
      ) : null}
      <text className="normal-arc__value" x={CX} y={CY - 14} textAnchor="middle">
        {display}
      </text>
      <text className="normal-arc__caption" x={CX} y={CY + 12} textAnchor="middle">
        {caption}
      </text>
      <text className="normal-arc__end" x={CX - R} y={CY + 24} textAnchor="middle">
        {minLabel ?? min}
      </text>
      <text className="normal-arc__end" x={CX + R} y={CY + 24} textAnchor="middle">
        {maxLabel ?? max}
      </text>
    </svg>
  );
}
