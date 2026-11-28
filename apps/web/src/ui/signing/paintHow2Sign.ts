/**
 * Draws one How2Sign pose frame from the packet's own joints.
 * The motion is the dataset sign, not a restyled face. Research ASL — not KSL.
 */

type Frame = {
  proj: number[][];
  left_hand: boolean;
  right_hand: boolean;
};

type Clip = {
  frames: Frame[];
};

const STAGE = '#f7f3ee';
const STAGE_DEEP = '#efe6da';
const INK = '#1c1916';
const CLOTH = '#2a2622';
const SKIN = '#e4b98a';
const SKIN_DEEP = '#c49262';

const HEAD = 15;
const NECK = 12;
const SHOULDER_L = 16;
const SHOULDER_R = 17;
const ELBOW_L = 18;
const ELBOW_R = 19;
const WRIST_L = 20;
const WRIST_R = 21;

export function paintHow2Sign(
  canvas: HTMLCanvasElement | null,
  clip: Clip | null,
  index: number,
): void {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;

  const bg = context.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, STAGE);
  bg.addColorStop(1, STAGE_DEEP);
  context.fillStyle = bg;
  context.fillRect(0, 0, width, height);

  const frame = clip?.frames[index];
  if (!frame?.proj?.length) return;

  const used: number[] = [HEAD, NECK, SHOULDER_L, SHOULDER_R, ELBOW_L, ELBOW_R, WRIST_L, WRIST_R];
  if (frame.left_hand) {
    for (let joint = 25; joint <= 39; joint += 1) used.push(joint);
  }
  if (frame.right_hand) {
    for (let joint = 40; joint <= 54; joint += 1) used.push(joint);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const joint of used) {
    const point = frame.proj[joint];
    if (!point) continue;
    minX = Math.min(minX, point[0]!);
    minY = Math.min(minY, point[1]!);
    maxX = Math.max(maxX, point[0]!);
    maxY = Math.max(maxY, point[1]!);
  }
  if (!Number.isFinite(minX)) return;

  const padX = (maxX - minX) * 0.08;
  const padY = (maxY - minY) * 0.08;
  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;

  const scale = Math.min(
    (width * 0.96) / Math.max(maxX - minX, 1),
    (height * 0.94) / Math.max(maxY - minY, 1),
  );
  const originX = width / 2 - ((minX + maxX) / 2) * scale;
  const originY = height / 2 - ((minY + maxY) / 2) * scale;
  const at = (joint: number): [number, number] | null => {
    const point = frame.proj[joint];
    if (!point) return null;
    return [originX + point[0]! * scale, originY + point[1]! * scale];
  };

  const left = at(SHOULDER_L);
  const right = at(SHOULDER_R);
  const neck = at(NECK);
  const head = at(HEAD);
  if (!left || !right || !neck || !head) return;

  const span = Math.hypot(left[0] - right[0], left[1] - right[1]) || 48;
  const thick = Math.max(8, span * 0.22);
  const midX = (left[0] + right[0]) / 2;
  const shoulderY = (left[1] + right[1]) / 2;
  const hemY = shoulderY + span * 1.05;

  context.fillStyle = 'rgba(44, 40, 36, 0.08)';
  context.beginPath();
  context.ellipse(midX, hemY + span * 0.08, span * 0.55, span * 0.08, 0, 0, Math.PI * 2);
  context.fill();

  const limb = (a: number, b: number, color: string, weight: number) => {
    const start = at(a);
    const end = at(b);
    if (!start || !end) return;
    context.strokeStyle = color;
    context.lineWidth = weight;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(start[0], start[1]);
    context.lineTo(end[0], end[1]);
    context.stroke();
  };

  // Sleeves first, then the shirt covers the shoulder join so the arms do not draw an X.
  limb(SHOULDER_L, ELBOW_L, CLOTH, thick * 0.7);
  limb(SHOULDER_R, ELBOW_R, CLOTH, thick * 0.7);

  context.fillStyle = CLOTH;
  context.beginPath();
  context.moveTo(midX - span * 0.42, shoulderY - span * 0.02);
  context.quadraticCurveTo(midX - span * 0.5, shoulderY + span * 0.45, midX - span * 0.36, hemY);
  context.lineTo(midX + span * 0.36, hemY);
  context.quadraticCurveTo(midX + span * 0.5, shoulderY + span * 0.45, midX + span * 0.42, shoulderY - span * 0.02);
  context.quadraticCurveTo(midX, shoulderY - span * 0.16, midX - span * 0.42, shoulderY - span * 0.02);
  context.closePath();
  context.fill();

  limb(ELBOW_L, WRIST_L, SKIN_DEEP, thick * 0.46);
  limb(ELBOW_R, WRIST_R, SKIN_DEEP, thick * 0.46);

  // Keep the head on the shoulders. Some How2Sign frames stretch the neck.
  const lean = Math.max(-1, Math.min(1, (head[0] - midX) / span));
  const headR = span * 0.32;
  const headX = midX + lean * span * 0.12;
  const headY = shoulderY - headR * 1.15;
  const neckW = Math.max(10, span * 0.2);
  context.strokeStyle = SKIN;
  context.lineWidth = neckW;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(midX, shoulderY + span * 0.02);
  context.lineTo(headX, headY + headR * 0.35);
  context.stroke();

  context.fillStyle = SKIN;
  context.beginPath();
  context.arc(headX, headY, headR, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = SKIN_DEEP;
  context.lineWidth = Math.max(1.5, headR * 0.06);
  context.stroke();

  const hand = (wrist: number, start: number, show: boolean) => {
    if (!show) return;
    const palm = at(wrist);
    if (!palm) return;
    const bone = Math.max(5, thick * 0.28);
    const strokeChain = (weight: number, color: string) => {
      context.strokeStyle = color;
      context.lineWidth = weight;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      for (let finger = 0; finger < 5; finger += 1) {
        const joint = start + finger * 3;
        const chain = [wrist, joint, joint + 1, joint + 2];
        for (let link = 0; link < chain.length - 1; link += 1) {
          const from = at(chain[link]!);
          const to = at(chain[link + 1]!);
          if (!from || !to) continue;
          context.moveTo(from[0], from[1]);
          context.lineTo(to[0], to[1]);
        }
      }
      context.stroke();
    };
    strokeChain(bone + 3, INK);
    strokeChain(bone, SKIN);
    context.fillStyle = SKIN;
    context.strokeStyle = INK;
    context.lineWidth = Math.max(2, thick * 0.08);
    context.beginPath();
    context.arc(palm[0], palm[1], thick * 0.42, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  };

  hand(WRIST_L, 25, frame.left_hand);
  hand(WRIST_R, 40, frame.right_hand);
}
