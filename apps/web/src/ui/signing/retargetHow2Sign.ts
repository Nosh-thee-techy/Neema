/**
 * Lift How2Sign 2D joint projections onto a passport 3D bone hierarchy.
 * Research ASL only — not KSL.
 */

export type PoseFrame = {
  proj: number[][];
  left_hand: boolean;
  right_hand: boolean;
};

export type Vec3 = { x: number; y: number; z: number };

export type RetargetPose = {
  head: Vec3;
  neck: Vec3;
  chest: Vec3;
  shoulderL: Vec3;
  shoulderR: Vec3;
  elbowL: Vec3;
  elbowR: Vec3;
  wristL: Vec3;
  wristR: Vec3;
  /** Fingertip chains relative to wrist (world-ish). */
  fingersL: Vec3[][];
  fingersR: Vec3[][];
  leftHand: boolean;
  rightHand: boolean;
};

const J = {
  neck: 12,
  head: 15,
  shoulderL: 16,
  shoulderR: 17,
  elbowL: 18,
  elbowR: 19,
  wristL: 20,
  wristR: 21,
} as const;

function pt(proj: number[][], index: number): [number, number] | null {
  const p = proj[index];
  if (!p || p.length < 2) return null;
  return [p[0]!, p[1]!];
}

function mid(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Map image-space How2Sign coords → local 3D (Y up, facing +Z toward camera). */
export function retargetHow2SignFrame(frame: PoseFrame | null | undefined): RetargetPose | null {
  if (!frame?.proj?.length) return null;
  const { proj } = frame;
  const shL = pt(proj, J.shoulderL);
  const shR = pt(proj, J.shoulderR);
  const head = pt(proj, J.head) ?? pt(proj, J.neck);
  const neck = pt(proj, J.neck) ?? head;
  const elL = pt(proj, J.elbowL);
  const elR = pt(proj, J.elbowR);
  const wrL = pt(proj, J.wristL);
  const wrR = pt(proj, J.wristR);
  if (!shL || !shR || !head || !neck) return null;

  const chest2 = mid(shL, shR);
  const shoulderSpan = Math.hypot(shL[0] - shR[0], shL[1] - shR[1]) || 1;
  const scale = 0.42 / shoulderSpan;
  // Origin at chest, flip Y (image Y grows down).
  const to3 = (p: [number, number], z = 0): Vec3 => ({
    x: (p[0] - chest2[0]) * scale,
    y: -(p[1] - chest2[1]) * scale,
    z,
  });

  // Slight depth so arms separate from torso (signing readability).
  const depth = (p: [number, number]) => {
    const dx = (p[0] - chest2[0]) / shoulderSpan;
    return 0.04 + Math.min(0.18, Math.abs(dx) * 0.12);
  };

  const fingers = (wristIndex: number, start: number, show: boolean): Vec3[][] => {
    if (!show) return [];
    const wrist = pt(proj, wristIndex);
    if (!wrist) return [];
    const chains: Vec3[][] = [];
    for (let finger = 0; finger < 5; finger += 1) {
      const chain: Vec3[] = [];
      for (let joint = 0; joint < 3; joint += 1) {
        const tip = pt(proj, start + finger * 3 + joint);
        if (!tip) continue;
        chain.push(to3(tip, depth(tip) + 0.02));
      }
      if (chain.length) chains.push(chain);
    }
    return chains;
  };

  return {
    head: to3(head, -0.02),
    neck: to3(neck, 0),
    chest: { x: 0, y: 0, z: 0 },
    shoulderL: to3(shL, 0.02),
    shoulderR: to3(shR, 0.02),
    elbowL: elL ? to3(elL, depth(elL)) : to3(shL, 0.08),
    elbowR: elR ? to3(elR, depth(elR)) : to3(shR, 0.08),
    wristL: wrL ? to3(wrL, depth(wrL) + 0.02) : to3(shL, 0.12),
    wristR: wrR ? to3(wrR, depth(wrR) + 0.02) : to3(shR, 0.12),
    fingersL: fingers(J.wristL, 25, frame.left_hand),
    fingersR: fingers(J.wristR, 40, frame.right_hand),
    leftHand: frame.left_hand,
    rightHand: frame.right_hand,
  };
}
