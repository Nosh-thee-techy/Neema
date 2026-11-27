/**
 * Original, simplified illustration of the baby inside the womb for the current week.
 * Six stages; size and proportions change (big head early, longer body later,
 * head-down from 32 weeks). Illustrative only, not to scale or anatomically exact.
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
  headDown: boolean;
}

function shapeFor(week: number): StageShape {
  if (week < 8) return { scale: 0.36, head: 15, body: 0.8, limbs: 0, embryo: true, headDown: false };
  if (week < 12) return { scale: 0.48, head: 17, body: 0.85, limbs: 0.4, embryo: false, headDown: false };
  if (week < 16) return { scale: 0.6, head: 16, body: 0.95, limbs: 0.8, embryo: false, headDown: false };
  if (week < 24) return { scale: 0.72, head: 15, body: 1, limbs: 1, embryo: false, headDown: false };
  if (week < 32) return { scale: 0.84, head: 14.5, body: 1.05, limbs: 1, embryo: false, headDown: false };
  return { scale: 0.95, head: 14, body: 1.1, limbs: 1, embryo: false, headDown: true };
}

export function BabyStageArt({ week, label }: { week: number; label: string }) {
  const s = shapeFor(week);
  const skin = '#f0c2a4';
  const skinEdge = '#d79878';
  const shade = '#e7ad8c';

  // Baby drawn in a 100×100 box around (50,50), then scaled and rotated into the womb.
  const transform = `translate(60 62) scale(${s.scale}) rotate(${s.headDown ? 160 : -10}) translate(-50 -50)`;

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
          d={s.headDown ? 'M50 60 C 70 70, 90 96, 110 120' : 'M52 62 C 30 70, 10 40, -16 -10'}
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
            {s.limbs > 0.6 ? <ellipse cx={40} cy={72 + 6 * s.body} rx={4.5} ry={3} fill={skin} stroke={skinEdge} strokeWidth="1.2" /> : null}
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
            {s.limbs >= 1 ? <path d="M45 30 q 4 2 2 6" fill="none" stroke={skinEdge} strokeWidth="1.3" /> : null}
            {/* Nose hint */}
            <circle cx={26 + (17 - s.head) * 0.6} cy="36" r="1.2" fill={shade} />
          </>
        )}
      </g>
      </g>
    </svg>
  );
}
