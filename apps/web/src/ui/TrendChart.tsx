/**
 * Small line chart of minute readings, with her normal band and an optional rule line.
 * Hand-drawn SVG, so it works offline and adds no dependency.
 */

export interface TrendPoint {
  tsMs: number;
  value: number;
}

interface TrendChartProps {
  points: TrendPoint[];
  /** Window shown, ending now. */
  windowMinutes: number;
  nowMs: number;
  band?: { low: number; high: number } | null;
  /** A threshold from the rules (e.g. fever 38.0 °C), drawn as a dashed line. */
  limit?: { value: number; label: string } | null;
  /** Y range; widened automatically to fit data, band and limit. */
  yMin: number;
  yMax: number;
  format: (v: number) => string;
  emptyLabel: string;
  nowLabel: string;
  ariaLabel: string;
}

const W = 360;
const H = 188;
const PAD = { l: 36, r: 12, t: 14, b: 26 };

export function TrendChart(props: TrendChartProps) {
  const { points, windowMinutes, nowMs, band, limit, format, emptyLabel, nowLabel, ariaLabel } = props;
  const start = nowMs - windowMinutes * 60_000;
  const values = [
    ...points.map((p) => p.value),
    ...(band ? [band.low, band.high] : []),
    ...(limit ? [limit.value] : []),
  ];
  const lo = Math.min(props.yMin, ...values);
  const hi = Math.max(props.yMax, ...values);
  const span = hi - lo || 1;

  const x = (ts: number) => PAD.l + ((ts - start) / (nowMs - start)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);

  const visible = points.filter((p) => p.tsMs >= start);
  const line = visible.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.tsMs).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area =
    visible.length > 1
      ? `${line} L ${x(visible[visible.length - 1]!.tsMs).toFixed(1)} ${H - PAD.b} L ${x(visible[0]!.tsMs).toFixed(1)} ${H - PAD.b} Z`
      : '';
  const ticks = [lo, (lo + hi) / 2, hi];
  const last = visible[visible.length - 1];

  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {ticks.map((v) => (
        <g key={v}>
          <line className="trend__grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
          <text className="trend__tick" x={PAD.l - 6} y={y(v) + 3} textAnchor="end">
            {format(v)}
          </text>
        </g>
      ))}
      {band ? (
        <rect
          className="trend__band"
          x={PAD.l}
          width={W - PAD.l - PAD.r}
          y={y(band.high)}
          height={Math.max(2, y(band.low) - y(band.high))}
          rx="4"
        />
      ) : null}
      {limit ? (
        <g>
          <line className="trend__limit" x1={PAD.l} x2={W - PAD.r} y1={y(limit.value)} y2={y(limit.value)} />
          <text className="trend__limit-label" x={W - PAD.r} y={y(limit.value) - 4} textAnchor="end">
            {limit.label}
          </text>
        </g>
      ) : null}
      {area ? <path className="trend__area" d={area} /> : null}
      {line ? <path className="trend__line" d={line} /> : null}
      {last ? <circle className="trend__now" cx={x(last.tsMs)} cy={y(last.value)} r="4.5" /> : null}
      {visible.length === 0 ? (
        <text className="trend__empty" x={(W + PAD.l) / 2} y={H / 2} textAnchor="middle">
          {emptyLabel}
        </text>
      ) : null}
      <text className="trend__tick" x={PAD.l} y={H - 6}>
        −{windowMinutes} min
      </text>
      <text className="trend__tick" x={W - PAD.r} y={H - 6} textAnchor="end">
        {nowLabel}
      </text>
    </svg>
  );
}
