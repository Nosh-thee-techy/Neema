/**
 * Plays a How2Sign pose packet using that clip's own joints.
 * Research demo only — not KSL. Procedural Three.js rig stays opt-in only.
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ASL_CITATION, ASL_LABEL, clipUrl } from './aslLibrary';
import { paintHow2Sign } from './paintHow2Sign';

const clipCache = new Map<string, Clip>();
const clipLoading = new Map<string, Promise<Clip | null>>();

export function peekSignClip(clipId: string): Clip | null {
  return clipCache.get(clipId) ?? null;
}

export function loadSignClip(clipId: string): Promise<Clip | null> {
  const cached = clipCache.get(clipId);
  if (cached) return Promise.resolve(cached);
  const pending = clipLoading.get(clipId);
  if (pending) return pending;
  const next = fetch(clipUrl(clipId))
    .then(async (res) => {
      if (!res.ok) return null;
      const body = (await res.json()) as Clip;
      if (!body?.frames?.length) return null;
      const stored = {
        ...body,
        label: body.label ?? ASL_LABEL,
        citation: body.citation ?? ASL_CITATION,
      };
      clipCache.set(clipId, stored);
      return stored;
    })
    .catch(() => null)
    .finally(() => clipLoading.delete(clipId));
  clipLoading.set(clipId, next);
  return next;
}

/** Fetch the session clips while she is still looking at the hello figure. */
export function warmSignClips(ids: readonly string[]): void {
  for (const id of ids) void loadSignClip(id);
}

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
  prefer3d = false,
  showCaption = true,
  meaningLabel = 'This sign means',
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
  /** Opt-in WebGL capsule rig — off by default; canvas woman looks more human. */
  prefer3d?: boolean;
  showCaption?: boolean;
  /** Short label above the How2Sign sentence. */
  meaningLabel?: string;
  onLine?: (line: SignedLine | null) => void;
  onProblem?: (message: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [problem, setProblem] = useState('');
  const [use3d, setUse3d] = useState(prefer3d && passport);

  useEffect(() => {
    let cancelled = false;
    setProblem('');
    const ready = peekSignClip(clipId);
    if (ready) {
      setClip(ready);
      onLine?.({
        id: ready.id,
        sentence: ready.sentence,
        label: ready.label ?? ASL_LABEL,
        citation: ready.citation ?? ASL_CITATION,
      });
      return () => {
        cancelled = true;
      };
    }
    void loadSignClip(clipId).then((body) => {
      if (cancelled) return;
      if (!body) {
        const message = 'Signed line could not load.';
        setProblem(message);
        onProblem?.(message);
        return;
      }
      setClip(body);
      onLine?.({
        id: body.id,
        sentence: body.sentence,
        label: body.label ?? ASL_LABEL,
        citation: body.citation ?? ASL_CITATION,
      });
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
        paintHow2Sign(canvas.current, clip, frames.length ? index % frames.length : 0);
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
        <p className="asl-player__caption">
          <span className="asl-player__means">{meaningLabel}</span>
          <strong>{clip.sentence}</strong>
        </p>
      ) : null}
    </div>
  );
}
