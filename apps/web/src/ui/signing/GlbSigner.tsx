/**
 * Passport Three.js woman driven by How2Sign pose packets.
 * Loads guide-woman.gltf for honesty metadata; meshes are procedural (CC0).
 * Research ASL — not KSL. Three.js is loaded on demand.
 */

import { useEffect, useRef, useState } from 'react';
import type { Camera, Scene, WebGLRenderer } from 'three';

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
};

type WomanRig = {
  root: import('three').Object3D;
  bones: Record<string, import('three').Object3D>;
  fingerGroupL: import('three').Group;
  fingerGroupR: import('three').Group;
  dispose: () => void;
};

const RIG_URL = '/signing/rig/guide-woman.gltf';

/** WebGL passport signer. Calls onReady(false) if Three.js / WebGL fails. */
export function GlbSigner({
  clip,
  paused = false,
  speed = 0.4,
  replay = 0,
  onReady,
}: {
  clip: Clip | null;
  paused?: boolean;
  speed?: number;
  replay?: number;
  onReady?: (ok: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const rigRef = useRef<WomanRig | null>(null);
  const clipRef = useRef(clip);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const frameIndexRef = useRef(0);
  const lastTickRef = useRef(0);
  const onReadyRef = useRef(onReady);
  clipRef.current = clip;
  pausedRef.current = paused;
  speedRef.current = speed;
  onReadyRef.current = onReady;

  useEffect(() => {
    frameIndexRef.current = 0;
    lastTickRef.current = 0;
  }, [clip?.id, replay]);

  useEffect(() => {
    let cancelled = false;
    let renderer: WebGLRenderer | null = null;
    let raf = 0;
    let removeResize: (() => void) | undefined;

    async function boot() {
      const node = host.current;
      if (!node) return;
      try {
        const THREE = await import('three');
        const { buildWomanRig, applyRetargetPose } = await import('./buildWomanRig');
        const { retargetHow2SignFrame } = await import('./retargetHow2Sign');

        try {
          await fetch(RIG_URL).then((r) => (r.ok ? r.json() : null));
        } catch {
          /* procedural rig still works */
        }

        const width = Math.max(1, node.clientWidth || 280);
        const height = Math.max(1, node.clientHeight || 360);
        const scene: Scene = new THREE.Scene();
        scene.background = new THREE.Color(0x152038);

        const camera: Camera = new THREE.PerspectiveCamera(32, width / height, 0.05, 20);
        camera.position.set(0, 0.22, 1.15);
        if ('lookAt' in camera) {
          (camera as import('three').PerspectiveCamera).lookAt(0, 0.12, 0);
        }

        const nextRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        nextRenderer.setSize(width, height, false);
        nextRenderer.shadowMap.enabled = true;
        node.replaceChildren(nextRenderer.domElement);
        nextRenderer.domElement.className = 'asl-player__canvas asl-player__canvas--glb';
        nextRenderer.domElement.setAttribute('role', 'img');
        nextRenderer.domElement.setAttribute('aria-label', '3D signing figure');
        renderer = nextRenderer;

        scene.add(new THREE.HemisphereLight(0xdde7ff, 0x1a2030, 0.85));
        const key = new THREE.DirectionalLight(0xffffff, 1.15);
        key.position.set(-0.6, 1.2, 0.8);
        key.castShadow = true;
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x88a0c8, 0.35);
        fill.position.set(0.8, 0.4, 0.5);
        scene.add(fill);

        const rig = buildWomanRig();
        if (cancelled) {
          rig.dispose();
          nextRenderer.dispose();
          return;
        }
        rigRef.current = rig;
        scene.add(rig.root);

        const onResize = () => {
          if (!host.current || !renderer) return;
          const w = Math.max(1, host.current.clientWidth);
          const h = Math.max(1, host.current.clientHeight);
          if (camera instanceof THREE.PerspectiveCamera) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
          }
          renderer.setSize(w, h, false);
        };
        window.addEventListener('resize', onResize);
        removeResize = () => window.removeEventListener('resize', onResize);

        const paint = (now: number) => {
          if (cancelled || !renderer || !rigRef.current) return;
          const current = clipRef.current;
          const frames = current?.frames ?? [];
          const rate = Math.max(1, (current?.fps || 24) * speedRef.current);
          if (!lastTickRef.current || now - lastTickRef.current >= 1000 / rate) {
            lastTickRef.current = now;
            const frame = frames.length ? frames[frameIndexRef.current % frames.length]! : null;
            applyRetargetPose(
              rigRef.current.bones,
              rigRef.current.fingerGroupL,
              rigRef.current.fingerGroupR,
              retargetHow2SignFrame(frame),
            );
            if (frames.length && !pausedRef.current) {
              frameIndexRef.current = (frameIndexRef.current + 1) % frames.length;
            }
          }
          renderer.render(scene, camera);
          raf = requestAnimationFrame(paint);
        };
        raf = requestAnimationFrame(paint);
        if (!cancelled) onReadyRef.current?.(true);
      } catch {
        if (!cancelled) {
          setFailed(true);
          onReadyRef.current?.(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      removeResize?.();
      rigRef.current?.dispose();
      rigRef.current = null;
      renderer?.dispose();
      if (host.current) host.current.replaceChildren();
    };
  }, []);

  if (failed) return null;
  return <div ref={host} className="asl-player__glb-host" />;
}
