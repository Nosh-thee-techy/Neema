/**
 * Procedural passport-framed woman attached to named glTF-style bones.
 * CC0 Neema authoring — research ASL visualisation, not KSL.
 */

import * as THREE from 'three';
import type { RetargetPose, Vec3 } from './retargetHow2Sign';

const SKIN = 0xc68642;
const SKIN_DEEP = 0x8d5524;
const HAIR = 0x1a0f0c;
const TEE = 0xf4f6f8;
const TEE_SHADOW = 0xd5dae0;
const LIP = 0xa33a3a;

export type WomanRig = {
  root: THREE.Group;
  bones: Record<string, THREE.Object3D>;
  fingerGroupL: THREE.Group;
  fingerGroupR: THREE.Group;
  dispose: () => void;
};

function mat(color: number, rough = 0.55, metal = 0.05) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
  });
}

function limbMesh(radius: number, length: number, color: number) {
  const geom = new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 4, 8);
  const mesh = new THREE.Mesh(geom, mat(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Capsule is Y-aligned; parent bone aims along -Y by default in our hierarchy.
  mesh.position.y = -length / 2;
  return mesh;
}

function v(p: Vec3) {
  return new THREE.Vector3(p.x, p.y, p.z);
}

/** Build a chest-up woman whose arm/hand nodes can be driven by retarget poses. */
export function buildWomanRig(): WomanRig {
  const root = new THREE.Group();
  root.name = 'passport_woman';

  const bones: Record<string, THREE.Object3D> = {};

  const chest = new THREE.Group();
  chest.name = 'chest';
  chest.position.set(0, 0.15, 0);
  root.add(chest);
  bones.chest = chest;

  // White tee torso (passport look).
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.42, 16),
    mat(TEE, 0.7),
  );
  torso.position.set(0, -0.05, 0);
  torso.castShadow = true;
  chest.add(torso);

  const neckline = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat(SKIN));
  neckline.position.set(0, 0.16, 0.02);
  neckline.scale.set(1, 0.7, 0.8);
  chest.add(neckline);

  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.01), mat(0x466eb4, 0.4));
  badge.position.set(-0.08, 0.02, 0.16);
  chest.add(badge);

  const neck = new THREE.Group();
  neck.name = 'neck';
  neck.position.set(0, 0.2, 0);
  chest.add(neck);
  bones.neck = neck;
  const neckMesh = limbMesh(0.045, 0.1, SKIN);
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.14, 0);
  neck.add(head);
  bones.head = head;

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), mat(SKIN, 0.45));
  skull.scale.set(0.92, 1.05, 0.95);
  skull.castShadow = true;
  head.add(skull);

  // Hair mass + braid falls.
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), mat(HAIR, 0.85));
  hair.position.set(0, 0.02, -0.02);
  hair.scale.set(1.05, 1.15, 1.1);
  head.add(hair);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const braid = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.022, 0.14 + i * 0.04, 3, 6),
        mat(HAIR, 0.9),
      );
      braid.position.set(side * (0.08 + i * 0.02), -0.08 - i * 0.04, -0.04);
      braid.rotation.z = side * 0.15;
      head.add(braid);
    }
  }

  // Soft face marks (eyes / lips) — fixed on head, not driven by pose.
  const eyeMat = mat(0x1c1410, 0.3);
  for (const side of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), mat(0xf5f2ea, 0.3));
    white.position.set(side * 0.035, 0.01, 0.095);
    white.scale.set(1.2, 0.9, 0.6);
    head.add(white);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), eyeMat);
    iris.position.set(side * 0.035, 0.01, 0.105);
    head.add(iris);
  }
  const lips = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(LIP, 0.35));
  lips.position.set(0, -0.04, 0.1);
  lips.scale.set(1.4, 0.45, 0.5);
  head.add(lips);

  const makeArm = (side: 'l' | 'r') => {
    const sign = side === 'l' ? 1 : -1;
    const shoulder = new THREE.Group();
    shoulder.name = `shoulder_${side}`;
    shoulder.position.set(sign * 0.18, 0.14, 0);
    chest.add(shoulder);
    bones[`shoulder_${side}`] = shoulder;

    const upper = new THREE.Group();
    upper.name = `upper_arm_${side}`;
    upper.position.set(sign * 0.02, 0, 0);
    shoulder.add(upper);
    bones[`upper_arm_${side}`] = upper;
    upper.add(limbMesh(0.045, 0.28, TEE_SHADOW));

    const lower = new THREE.Group();
    lower.name = `lower_arm_${side}`;
    lower.position.set(0, -0.28, 0);
    upper.add(lower);
    bones[`lower_arm_${side}`] = lower;
    lower.add(limbMesh(0.038, 0.26, SKIN));

    const hand = new THREE.Group();
    hand.name = `hand_${side}`;
    hand.position.set(0, -0.26, 0);
    lower.add(hand);
    bones[`hand_${side}`] = hand;
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat(SKIN));
    palm.scale.set(1.1, 0.7, 1.3);
    hand.add(palm);

    return hand;
  };

  const handL = makeArm('l');
  const handR = makeArm('r');

  const fingerGroupL = new THREE.Group();
  fingerGroupL.name = 'fingers_l';
  handL.add(fingerGroupL);
  const fingerGroupR = new THREE.Group();
  fingerGroupR.name = 'fingers_r';
  handR.add(fingerGroupR);

  // Idle resting arms.
  applyRetargetPose(bones, fingerGroupL, fingerGroupR, null);

  return {
    root,
    bones,
    fingerGroupL,
    fingerGroupR,
    dispose: () => {
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    },
  };
}

function aimBone(bone: THREE.Object3D, from: Vec3, to: Vec3) {
  const dir = v(to).sub(v(from));
  if (dir.lengthSq() < 1e-8) return;
  dir.normalize();
  // Default bone axis is -Y.
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  bone.quaternion.copy(q);
}

function drawFingers(group: THREE.Group, _wrist: Vec3, chains: Vec3[][], show: boolean) {
  while (group.children.length) {
    const child = group.children[0]!;
    group.remove(child);
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  }
  if (!show) return;
  // Prefer pose fingertip directions when present; else a readable fan.
  if (chains.length >= 3) {
    for (let i = 0; i < Math.min(5, chains.length); i += 1) {
      const tip = chains[i]![chains[i]!.length - 1];
      if (!tip) continue;
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.01, 0.05, 2, 4),
        mat(SKIN_DEEP, 0.5),
      );
      mesh.position.set((i - 2) * 0.018, -0.04, 0.02);
      mesh.rotation.z = (i - 2) * 0.12;
      group.add(mesh);
    }
    return;
  }
  for (let i = 0; i < 5; i += 1) {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.05, 2, 4), mat(SKIN_DEEP, 0.5));
    mesh.position.set((i - 2) * 0.018, -0.04, 0.02);
    mesh.rotation.z = (i - 2) * 0.12;
    group.add(mesh);
  }
}

/** Drive procedural bones from a How2Sign retarget pose (chest-local). */
export function applyRetargetPose(
  bones: Record<string, THREE.Object3D>,
  fingerL: THREE.Group,
  fingerR: THREE.Group,
  pose: RetargetPose | null,
): void {
  const chest = bones.chest;
  if (!chest) return;

  if (!pose) {
    bones.shoulder_l!.rotation.set(0.15, 0, 0.25);
    bones.shoulder_r!.rotation.set(0.15, 0, -0.25);
    bones.upper_arm_l!.rotation.set(0.2, 0, 0.1);
    bones.upper_arm_r!.rotation.set(0.2, 0, -0.1);
    bones.lower_arm_l!.rotation.set(0.35, 0, 0);
    bones.lower_arm_r!.rotation.set(0.35, 0, 0);
    drawFingers(fingerL, { x: 0, y: 0, z: 0 }, [], false);
    drawFingers(fingerR, { x: 0, y: 0, z: 0 }, [], false);
    return;
  }

  // Place shoulders in chest space; aim upper/lower arms toward elbows/wrists.
  bones.shoulder_l!.position.copy(v(pose.shoulderL));
  bones.shoulder_r!.position.copy(v(pose.shoulderR));
  bones.shoulder_l!.quaternion.identity();
  bones.shoulder_r!.quaternion.identity();

  bones.upper_arm_l!.position.set(0, 0, 0);
  bones.upper_arm_r!.position.set(0, 0, 0);
  aimBone(bones.upper_arm_l!, pose.shoulderL, pose.elbowL);
  aimBone(bones.upper_arm_r!, pose.shoulderR, pose.elbowR);

  const upperLen = 0.28;
  bones.lower_arm_l!.position.set(0, -upperLen, 0);
  bones.lower_arm_r!.position.set(0, -upperLen, 0);
  // Aim forearm in world: convert elbow→wrist direction into upper-arm local space.
  const aimLocal = (upper: THREE.Object3D, from: Vec3, to: Vec3) => {
    const worldDir = v(to).sub(v(from)).normalize();
    const localDir = worldDir.clone().applyQuaternion(upper.getWorldQuaternion(new THREE.Quaternion()).invert());
    upper.children; // keep reference
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), localDir);
    return q;
  };
  bones.lower_arm_l!.quaternion.copy(aimLocal(bones.upper_arm_l!, pose.elbowL, pose.wristL));
  bones.lower_arm_r!.quaternion.copy(aimLocal(bones.upper_arm_r!, pose.elbowR, pose.wristR));

  bones.hand_l!.position.set(0, -0.26, 0);
  bones.hand_r!.position.set(0, -0.26, 0);
  bones.hand_l!.quaternion.identity();
  bones.hand_r!.quaternion.identity();

  // Head tracks lightly toward average hand height (subtle).
  if (bones.head && bones.neck) {
    const lookY = (pose.wristL.y + pose.wristR.y) * 0.15;
    bones.neck.rotation.set(THREE.MathUtils.clamp(-lookY * 0.4, -0.2, 0.2), 0, 0);
  }

  drawFingers(fingerL, pose.wristL, pose.fingersL, pose.leftHand);
  drawFingers(fingerR, pose.wristR, pose.fingersR, pose.rightHand);
}
