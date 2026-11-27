/**
 * Original, simplified illustration of the baby inside the womb.
 * It grows a little every day: size, head-to-body proportions and limbs are
 * interpolated week by week (with days as fractions), and the baby gradually turns
 * head-down between 28 and 34 weeks. Illustrative only, not to scale or anatomically exact.
 */

interface StageShape {
  /** Overall scale of the baby inside the womb (0–1). */
  scale: number;
  /** Head radius relative to the baby. */
  head: number;
  /** Body length factor. */
  body: number;
  /** Limbs: 0 = buds, 1 = formed. */
  limbs: number;
  embryo: boolean;
  /** Rotation in degrees: -10 = head up, 160 = head down. */
  turn: number;
}

/** [week, scale, head, body, limbs] keyframes; values between them are blended. */
const KEYS: Array<[number, number, number, number, number]> = [
  [4, 0.26, 15, 0.8, 0],
  [8, 0.42, 17, 0.82, 0.3],
  [12, 0.55, 16.4, 0.9, 0.7],
  [16, 0.64, 15.6, 0.98, 1],
  [20, 0.71, 15.1, 1, 1],
  [24, 0.77, 14.8, 1.03, 1],
  [28, 0.83, 14.5, 1.05, 1],
  [32, 0.89, 14.2, 1.08, 1],
  [36, 0.94, 14, 1.1, 1],
  [40, 0.98, 13.8, 1.12, 1],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Shape for a gestational age in weeks (fractions allowed: 24 + 3/7 = 24w3d). */
export function shapeFor(weekExact: number): StageShape {
  const w = Math.min(42, Math.max(4, weekExact));
  let i = KEYS.findIndex((k) => k[0] > w);
  if (i === -1) i = KEYS.length - 1;
  const a = KEYS[Math.max(0, i - 1)]!;
  const b = KEYS[i]!;
  const t = b[0] === a[0] ? 1 : Math.min(1, Math.max(0, (w - a[0]) / (b[0] - a[0])));
  // Turning head-down: gradually between 28 and 34 weeks.
  const turnT = Math.min(1, Math.max(0, (w - 28) / 6));
  return {
    scale: lerp(a[1], b[1], t),
    head: lerp(a[2], b[2], t),
    body: lerp(a[3], b[3], t),
    limbs: lerp(a[4], b[4], t),
    embryo: w < 8,
    turn: lerp(-10, 160, turnT * turnT * (3 - 2 * turnT)),
  };
}

export function BabyStageArt({ week, days = 0, label }: { week: number; days?: number; label: string }) {
  const s = shapeFor(week + days / 7);
  const headDown = s.turn > 90;
  const skin = '#f0c2a4';
  const skinEdge = '#d79878';
  const shade = '#e7ad8c';

  // Baby drawn in a 100×100 box around (50,50), then scaled and rotated into the womb.
  const transform = `translate(60 62) scale(${s.scale}) rotate(${s.turn.toFixed(1)}) translate(-50 -50)`;

  return (
    <svg className="baby-art" viewBox="0 0 120 124" role="img" aria-label={label}>
      <defs>
        <radialGradient id="womb" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#fbeee7" />
          <stop offset="70%" stopColor="#f3d9cc" />
          <stop offset="100%" stopColor="#e8c3b2" />
        </radialGradient>
        <clipPath id="womb-in">
          <ellipse cx="60" cy="62" rx="45" ry="49" />
        </clipPath>
        <radialGradient id="fluid" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#fff8f3" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f6e2d8" stopOpacity="0.4" />
        </radialGradient>
      </defs>

      {/* Womb */}
      <ellipse cx="60" cy="62" rx="54" ry="58" fill="url(#womb)" />
      <ellipse cx="60" cy="62" rx="46" ry="50" fill="url(#fluid)" stroke="#ecc9b9" strokeWidth="1.2" />
      {/* Placenta */}
      <path d="M24 30 Q34 14 54 13 Q40 22 30 38 Z" fill="#d9a092" opacity="0.75" />

      <g clipPath="url(#womb-in)">
      <g transform={transform} strokeLinecap="round" strokeLinejoin="round">
        {/* Umbilical cord to the placenta */}
        <path
          d={headDown ? 'M50 60 C 70 70, 90 96, 110 120' : 'M52 62 C 30 70, 10 40, -16 -10'}
          fill="none"
          stroke="#e7a99a"
          strokeWidth="3.2"
          opacity="0.9"
        />

        {s.embryo ? (
          <>
            {/* Early embryo: a curled "C" with a large head and a small tail */}
            <path
              d="M46 22 C 28 22, 22 40, 28 56 C 34 72, 52 80, 64 74 C 70 70, 68 64, 62 64 C 50 66, 42 58, 42 48 C 42 40, 48 36, 56 36 C 66 36, 66 22, 46 22 Z"
              fill={skin}
              stroke={skinEdge}
              strokeWidth="1.5"
            />
            <circle cx="44" cy="30" r="4" fill={shade} />
            <ellipse cx="34" cy="52" rx="4" ry="2.4" fill={shade} transform="rotate(-30 34 52)" />
            <ellipse cx="46" cy="66" rx="4" ry="2.4" fill={shade} transform="rotate(20 46 66)" />
          </>
        ) : (
          <>
            {/* Back and bottom */}
            <path
              d={`M44 ${34 + s.head * 0.6} C 70 ${36 + s.head * 0.5}, 80 ${52 + 10 * s.body}, 70 ${66 + 10 * s.body} C 62 ${76 + 10 * s.body}, 44 ${76 + 8 * s.body}, 38 ${64 + 6 * s.body} C 32 ${54 + 4 * s.body}, 34 ${42 + s.head * 0.2}, 44 ${34 + s.head * 0.6} Z`}
              fill={skin}
              stroke={skinEdge}
              strokeWidth="1.5"
            />
            {/* Leg folded up (thigh + lower leg + foot) */}
            <path
              d={`M66 ${68 + 8 * s.body} C 58 ${60 + 6 * s.body}, 46 ${62 + 6 * s.body}, 42 ${70 + 6 * s.body}`}
              fill="none"
              stroke={skinEdge}
              strokeWidth={6 * s.limbs + 3}
              opacity="0.35"
            />
            <path
              d={`M66 ${68 + 8 * s.body} C 58 ${60 + 6 * s.body}, 46 ${62 + 6 * s.body}, 42 ${70 + 6 * s.body}`}
              fill="none"
              stroke={skin}
              strokeWidth={6 * s.limbs + 1.6}
            />
            {s.limbs > 0.55 ? <ellipse cx={40} cy={72 + 6 * s.body} rx={4.5} ry={3} fill={skin} stroke={skinEdge} strokeWidth="1.2" /> : null}
            {/* Arm tucked under the chin */}
            <path
              d={`M46 ${46 + s.head * 0.3} C 42 ${52 + s.head * 0.3}, 40 ${54 + s.head * 0.3}, 36 ${52 + s.head * 0.2}`}
              fill="none"
              stroke={skinEdge}
              strokeWidth={4.5 * s.limbs + 2.4}
              opacity="0.35"
            />
            <path
              d={`M46 ${46 + s.head * 0.3} C 42 ${52 + s.head * 0.3}, 40 ${54 + s.head * 0.3}, 36 ${52 + s.head * 0.2}`}
              fill="none"
              stroke={skin}
              strokeWidth={4.5 * s.limbs + 1.2}
            />
            {/* Head */}
            <circle cx="40" cy="32" r={s.head} fill={skin} stroke={skinEdge} strokeWidth="1.5" />
            {/* Closed eye and ear */}
            <path d={`M${31 - s.head * 0.05} 31 q 3 2 6 0`} fill="none" stroke="#9c6a55" strokeWidth="1.3" />
            {s.limbs > 0.9 ? <path d="M45 30 q 4 2 2 6" fill="none" stroke={skinEdge} strokeWidth="1.3" /> : null}
            {/* Nose hint */}
            <circle cx={26 + (17 - s.head) * 0.6} cy="36" r="1.2" fill={shade} />
          </>
        )}
      </g>
      </g>
    </svg>
  );
}
