/**
 * Plays a How2Sign pose packet. Prefers passport 3D (Three.js); falls back to canvas.
 * Research demo only — not KSL.
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ASL_CITATION, ASL_LABEL, clipUrl } from './aslLibrary';
import { paintWomanSigner } from './paintWoman';

const GlbSigner = lazy(() =>
  import('./GlbSigner').then((m) => ({ default: m.GlbSigner })),
);

type Frame = {
  proj: number[][];
  left_hand: boolean;
  right_hand: boolean;
};

type Clip = {
  id: string;
  sentence: string;
  fps: number;
  frames: Frame[];
  label?: string;
  citation?: string;
};

export type SignedLine = {
  id: string;
  sentence: string;
  label: string;
  citation: string;
};

/** Readable default: How2Sign mocap is too fast for learners; ~0.4× feels human. */
export const ASL_PLAYBACK_RATE = 0.4;

/** Plays one How2Sign clip by id from the static packets folder. */
export function AslPlayer({
  clipId,
  paused = false,
  speed = ASL_PLAYBACK_RATE,
  replay = 0,
  tall = false,
  passport = false,
  prefer3d = true,
  showCaption = true,
  onLine,
  onProblem,
}: {
  clipId: string;
  paused?: boolean;
  /** Multiplier on clip fps (1 = raw mocap; prefer ~0.4). */
  speed?: number;
  /** Bump to restart from frame 0. */
  replay?: number;
  tall?: boolean;
  /** Passport-card framing (chest-up portrait). */
  passport?: boolean;
  /** Try WebGL woman first; canvas fallback if WebGL fails. */
  prefer3d?: boolean;
  showCaption?: boolean;
  onLine?: (line: SignedLine | null) => void;
  onProblem?: (message: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [problem, setProblem] = useState('');
  const [use3d, setUse3d] = useState(prefer3d && passport);

  useEffect(() => {
    let cancelled = false;
    setClip(null);
    setProblem('');
    onLine?.(null);
    void fetch(clipUrl(clipId))
      .then(async (res) => {
        if (!res.ok) throw new Error('Clip missing');
        return res.json() as Promise<Clip>;
      })
      .then((body) => {
        if (cancelled) return;
        const next = {
          ...body,
          label: body.label ?? ASL_LABEL,
          citation: body.citation ?? ASL_CITATION,
        };
        setClip(next);
        onLine?.({
          id: next.id,
          sentence: next.sentence,
          label: next.label ?? ASL_LABEL,
          citation: next.citation ?? ASL_CITATION,
        });
      })
      .catch(() => {
        if (cancelled) return;
        const message = 'Signed line could not load.';
        setProblem(message);
        onProblem?.(message);
        onLine?.(null);
      });
    return () => {
      cancelled = true;
    };
  }, [clipId, onLine, onProblem]);

  useEffect(() => {
    if (use3d) return;
    const frames = clip?.frames ?? [];
    let index = 0;
    let last = 0;
    let handle = 0;
    const rate = (clip?.fps || 24) * speed;
    const draw = (now: number) => {
      const node = canvas.current;
      if (node) {
        const rect = node.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(rect.width * ratio));
        const height = Math.max(1, Math.round(rect.height * ratio));
        if (node.width !== width || node.height !== height) {
          node.width = width;
          node.height = height;
        }
      }
      if (!last || now - last >= 1000 / rate) {
        last = now;
        paintWomanSigner(canvas.current, clip, frames.length ? index % frames.length : 0);
        if (frames.length && !paused) index = (index + 1) % frames.length;
      }
      handle = requestAnimationFrame(draw);
    };
    handle = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(handle);
  }, [clip, paused, speed, replay, use3d]);

  const shell = [
    'asl-player',
    tall ? 'asl-player--tall' : '',
    passport ? 'asl-player--passport' : '',
    use3d ? 'asl-player--glb' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shell}>
      {use3d ? (
        <Suspense fallback={<div className="asl-player__glb-host" aria-hidden />}>
          <GlbSigner
            clip={clip}
            paused={paused}
            speed={speed}
            replay={replay}
            onReady={(ok) => {
              if (!ok) setUse3d(false);
            }}
          />
        </Suspense>
      ) : (
        <canvas
          ref={canvas}
          role="img"
          aria-label={clip ? `Signing figure: ${clip.sentence}` : 'Signing figure'}
          className="asl-player__canvas"
        />
      )}
      {problem ? <p className="asl-player__problem">{problem}</p> : null}
      {showCaption && clip ? (
        <p className="asl-player__caption soft-note">
          {clip.sentence} · {clip.label ?? ASL_LABEL}
        </p>
      ) : null}
    </div>
  );
}
