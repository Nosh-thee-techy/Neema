/**
 * Neema, drawn in code so she can respond: she blinks, breathes, looks toward a touch,
 * moves her mouth while she speaks, leans in while she listens, and smiles and waves
 * when tapped. Her face follows the triage mood but never decides it.
 */

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import type { AvatarState } from '@neema/core';
import '../styles/neema-avatar.css';

type Look = (x: number, y: number) => void;

/** One pair of window listeners shared by every live avatar on the page. */
const lookers = new Set<Look>();

function onPointer(e: PointerEvent) {
  for (const look of lookers) look(e.clientX, e.clientY);
}

function watchPointer(look: Look): () => void {
  if (lookers.size === 0) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
  }
  lookers.add(look);
  return () => {
    lookers.delete(look);
    if (lookers.size === 0) {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
    }
  };
}

const clamp = (n: number) => Math.max(-1, Math.min(1, n));

const SKIN = '#a9653d';
const SKIN_SHADE = '#8d4d2c';
const HAIR = '#2b1d1a';
const HAIR_LIGHT = '#4d362c';
const INK = '#1f1412';
const LIP = '#8a3b30';
const MOUTH_DARK = '#4b1b18';
const BLOUSE = '#f6e6c8';
const BLOUSE_LINE = '#d9bf93';

/** Curly outline of her hair: circles around the edge of the main shape. */
const CURLS = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2;
  return {
    cx: Math.round((100 + Math.cos(a) * 56) * 10) / 10,
    cy: Math.round((90 + Math.sin(a) * 50) * 10) / 10,
    r: 12 + (i % 3),
  };
});

/** Small lighter strokes that read as curls inside the hair. */
const CURL_MARKS: Array<[number, number]> = [
  [50, 80],
  [58, 58],
  [78, 40],
  [122, 40],
  [142, 58],
  [150, 80],
  [48, 108],
  [152, 108],
  [60, 132],
  [140, 132],
  [100, 34],
];

function Eye({ cx, clipId, pupilRef, outer }: { cx: number; clipId: string; pupilRef: RefObject<SVGGElement | null>; outer: -1 | 1 }) {
  const shape = `M${cx - 10} 94 Q${cx} 84.5 ${cx + 10} 94 Q${cx} 101.5 ${cx - 10} 94Z`;
  return (
    <g className="neema__eye">
      <clipPath id={clipId}>
        <path d={shape} />
      </clipPath>
      <path d={shape} fill="#fffaf2" />
      <g clipPath={`url(#${clipId})`}>
        <g className="neema__pupil" ref={pupilRef}>
          <circle cx={cx} cy={93.6} r={5.4} fill="#3b2116" />
          <circle cx={cx} cy={93.6} r={2.5} fill="#150c09" />
          <circle cx={cx + 1.8} cy={91.6} r={1.4} fill="#fff" />
        </g>
      </g>
      <path
        d={`M${cx - 10.6} 94.4 Q${cx} 84 ${cx + 10.6} 94.4 M${cx + outer * 10.6} 94.4 l${outer * 2.2} -1.8`}
        fill="none"
        stroke={INK}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </g>
  );
}

export interface NeemaAvatarProps {
  /** Her expression. Comes from the triage level; she never decides it. */
  mood?: AvatarState;
  /** Mouth moves while her voice is playing. */
  speaking?: boolean;
  /** She leans in while the microphone is open. */
  listening?: boolean;
  /** Blink, breathe and look toward touches. Leave off for small faces in lists. */
  live?: boolean;
  /** Giving her a name makes her a button: she reacts to a tap, then `onPress` runs. */
  label?: string;
  onPress?: () => void;
  /** How much of her shows: head and shoulders, a closer crop for small circles, or the face only for tiny ones. */
  framing?: keyof typeof FRAMING;
  className?: string;
}

const FRAMING = {
  bust: '0 0 200 200',
  close: '16 10 168 168',
  face: '32 26 136 136',
} as const;

/** Illustrated Neema. Fills its parent; the parent sets the size and the rounded shape. */
export function NeemaAvatar({
  mood = 'calm',
  speaking = false,
  listening = false,
  live = false,
  label,
  onPress,
  framing = 'bust',
  className,
}: NeemaAvatarProps) {
  const uid = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  const headBackRef = useRef<SVGGElement | null>(null);
  const headRef = useRef<SVGGElement | null>(null);
  const pupilLeftRef = useRef<SVGGElement | null>(null);
  const pupilRightRef = useRef<SVGGElement | null>(null);
  const reactTimer = useRef<number | null>(null);
  const [react, setReact] = useState<'none' | 'happy' | 'nod'>('none');

  // Look toward the pointer or the last touch. Written straight to the moving parts, no re-render.
  useEffect(() => {
    const root = rootRef.current;
    if (!live || !root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let rest = 0;
    let onScreen = true;
    let px = 0;
    let py = 0;

    const write = (nx: number, ny: number) => {
      const eyes = `translate(${(nx * 3.2).toFixed(2)}px, ${(ny * 2.2).toFixed(2)}px)`;
      const head = `translate(${(nx * 1.6).toFixed(2)}px, ${(ny * 1.2).toFixed(2)}px) rotate(${(nx * 2.2).toFixed(2)}deg)`;
      if (pupilLeftRef.current) pupilLeftRef.current.style.transform = eyes;
      if (pupilRightRef.current) pupilRightRef.current.style.transform = eyes;
      if (headRef.current) headRef.current.style.transform = head;
      if (headBackRef.current) headBackRef.current.style.transform = head;
    };

    const aim = () => {
      frame = 0;
      const box = root.getBoundingClientRect();
      const reach = Math.max(box.width, 140) * 1.6;
      write(clamp((px - (box.left + box.width / 2)) / reach), clamp((py - (box.top + box.height * 0.45)) / reach));
    };

    const stopWatching = watchPointer((x, y) => {
      if (!onScreen) return;
      px = x;
      py = y;
      if (!frame) frame = requestAnimationFrame(aim);
      window.clearTimeout(rest);
      // After a moment she looks back at the mother.
      rest = window.setTimeout(() => write(0, 0), 2400);
    });

    // Off screen: stop following and pause the looping motion.
    const seen = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      root.dataset.offscreen = String(!onScreen);
    });
    seen.observe(root);

    return () => {
      stopWatching();
      seen.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(rest);
    };
  }, [live]);

  useEffect(
    () => () => {
      if (reactTimer.current) window.clearTimeout(reactTimer.current);
    },
    [],
  );

  function press() {
    // No grin while something is urgent: she nods to show she heard.
    setReact(mood === 'urgent' ? 'nod' : 'happy');
    if (reactTimer.current) window.clearTimeout(reactTimer.current);
    reactTimer.current = window.setTimeout(() => setReact('none'), 1600);
    onPress?.();
  }

  const mouth = react === 'happy' ? 'big' : speaking ? 'talk' : mood === 'calm' ? 'smile' : mood === 'urgent' ? 'concerned' : 'soft';
  const bg = `${uid}bg`;

  const art = (
    <span className="neema__art" aria-hidden>
      <svg viewBox={FRAMING[framing]} preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <radialGradient id={bg} cx="50%" cy="36%" r="78%">
            <stop offset="0" stopColor="#fcf0de" />
            <stop offset="1" stopColor="#ecd2ae" />
          </radialGradient>
        </defs>
        <rect width="200" height="200" fill={`url(#${bg})`} />

        {/* Hair behind her shoulders. Moves with the head. */}
        <g className="neema__tilt">
          <g className="neema__track" ref={headBackRef}>
            <ellipse cx="100" cy="90" rx="58" ry="52" fill={HAIR} />
            {CURLS.map((c) => (
              <circle key={`${c.cx}-${c.cy}`} cx={c.cx} cy={c.cy} r={c.r} fill={HAIR} />
            ))}
            {CURL_MARKS.map(([x, y]) => (
              <path key={`${x}-${y}`} d={`M${x - 5} ${y} q5 -6 10 0`} fill="none" stroke={HAIR_LIGHT} strokeWidth="2" strokeLinecap="round" />
            ))}
          </g>
        </g>

        {/* Neck, chest and linen blouse. Breathes. */}
        <g className="neema__body">
          <path d="M88 126 L88 150 L72 157 L100 188 L128 157 L112 150 L112 126Z" fill={SKIN} />
          <path d="M88 132 Q100 147 112 132 L112 126 L88 126Z" fill={SKIN_SHADE} />
          <path d="M18 200 C20 172 46 160 80 152 L100 186 L100 200Z" fill={BLOUSE} />
          <path d="M182 200 C180 172 154 160 120 152 L100 186 L100 200Z" fill={BLOUSE} />
          <path d="M80 152 L100 186 L120 152 M100 186 L100 200" fill="none" stroke={BLOUSE_LINE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M50 174 Q57 186 54 200 M150 174 Q143 186 146 200" fill="none" stroke={BLOUSE_LINE} strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
        </g>

        <g className="neema__tilt">
          <g className="neema__track" ref={headRef}>
            <path d="M65 90 C65 48 135 48 135 90 C135 116 121 138 100 138 C79 138 65 116 65 90Z" fill={SKIN} />
            <ellipse cx="77" cy="110" rx="6.5" ry="4" fill="#d0714f" opacity="0.28" />
            <ellipse cx="123" cy="110" rx="6.5" ry="4" fill="#d0714f" opacity="0.28" />

            {/* Hair in front, parted in the middle. */}
            <path d="M100 44 L100 57 C89 58 77 62 71 72 C68 78 66.5 85 66 93 L66 112 L52 112 C46 66 72 40 100 44Z" fill={HAIR} />
            <path d="M100 44 L100 57 C111 58 123 62 129 72 C132 78 133.5 85 134 93 L134 112 L148 112 C154 66 128 40 100 44Z" fill={HAIR} />
            <circle cx="63" cy="114" r="2.8" fill="#dba545" />
            <circle cx="137" cy="114" r="2.8" fill="#dba545" />

            <g className="neema__brows" fill="none" stroke={HAIR} strokeWidth="2.8" strokeLinecap="round">
              <path className="neema__brow neema__brow--left" d="M74 80 Q83 74.5 93.5 78.5" />
              <path className="neema__brow neema__brow--right" d="M126 80 Q117 74.5 106.5 78.5" />
            </g>

            <g className="neema__eyes neema__eyes--open">
              <Eye cx={84} clipId={`${uid}el`} pupilRef={pupilLeftRef} outer={-1} />
              <Eye cx={116} clipId={`${uid}er`} pupilRef={pupilRightRef} outer={1} />
            </g>
            <g className="neema__eyes neema__eyes--happy" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round">
              <path d="M75 95 Q84 86.5 93 95" />
              <path d="M107 95 Q116 86.5 125 95" />
            </g>

            <path d="M96 108 Q100 111.5 104 108" fill="none" stroke="#7f4326" strokeWidth="2" strokeLinecap="round" />

            <path className="neema__mouth neema__mouth--smile" d="M86 118 Q100 124 114 118 Q100 133 86 118Z" fill={LIP} />
            <path
              className="neema__mouth neema__mouth--soft"
              d="M90 120 Q100 126 110 120"
              fill="none"
              stroke={LIP}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              className="neema__mouth neema__mouth--concerned"
              d="M91 122.6 Q100 121.2 109 122.6"
              fill="none"
              stroke={LIP}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <g className="neema__mouth neema__mouth--talk">
              <g className="neema__jaw">
                <ellipse cx="100" cy="122" rx="8.5" ry="6.5" fill={MOUTH_DARK} stroke={LIP} strokeWidth="2.6" />
                <ellipse cx="100" cy="125.6" rx="4.8" ry="2.4" fill="#c9665c" />
              </g>
            </g>
            <g className="neema__mouth neema__mouth--big">
              <path d="M86 117 Q100 121.5 114 117 Q111 132 100 132 Q89 132 86 117Z" fill={MOUTH_DARK} stroke={LIP} strokeWidth="2.2" strokeLinejoin="round" />
              <path d="M90 119.4 Q100 123 110 119.4 L109.2 122.2 Q100 125.6 90.8 122.2Z" fill="#fff8ee" />
            </g>
          </g>
        </g>

        {/* Her hand comes up to wave when she is tapped. */}
        <g transform="translate(152 164)">
          <g className="neema__hand">
            <rect x="-8" y="8" width="16" height="34" rx="6" fill={BLOUSE} stroke={BLOUSE_LINE} strokeWidth="1.6" />
            <rect x="-10" y="-12" width="20" height="23" rx="8" fill={SKIN} />
            <rect x="-10" y="-24" width="4.6" height="16" rx="2.3" fill={SKIN} />
            <rect x="-4.8" y="-27" width="4.6" height="19" rx="2.3" fill={SKIN} />
            <rect x="0.4" y="-26" width="4.6" height="18" rx="2.3" fill={SKIN} />
            <rect x="5.6" y="-22" width="4.6" height="14" rx="2.3" fill={SKIN} />
            <rect x="-16.5" y="-9" width="5" height="13" rx="2.5" fill={SKIN} transform="rotate(-32 -14 -2)" />
          </g>
        </g>
      </svg>
    </span>
  );

  const shared = {
    className: `neema${className ? ` ${className}` : ''}`,
    'data-mood': mood,
    'data-mouth': mouth,
    'data-react': react,
    'data-listening': listening,
    'data-live': live,
  };

  if (label) {
    return (
      <button
        type="button"
        {...shared}
        ref={(el) => {
          rootRef.current = el;
        }}
        aria-label={label}
        onClick={press}
      >
        {art}
      </button>
    );
  }

  return (
    <span
      {...shared}
      ref={(el) => {
        rootRef.current = el;
      }}
      aria-hidden
    >
      {art}
    </span>
  );
}
