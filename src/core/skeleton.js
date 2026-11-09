/**
 * The figure's skeleton: dimensions, two-bone IK for the limbs and forward kinematics from a
 * resolved pose to joint positions. No DOM.
 *
 * A resolved pose (what the animation layer produces every frame) is:
 *   {
 *     root:  { p: [x, y, z], r: [yaw, pitch, roll] },   // pelvis centre, world frame
 *     spine: [yaw, pitch, roll],                          // chest relative to pelvis
 *     targets: { lFoot, rFoot, lHand, rHand },            // world positions ([x, y, z])
 *     poles:   { lKnee, rKnee, lElbow, rElbow },          // world directions the joint bends towards
 *   }
 * Foot targets are ankle positions; hand targets are wrist positions.
 */

import { add, sub, scale, dot, normalize, length, cross, matMul, matVec, eulerToMatrix, clamp } from './math.js';

/** Proportions of a ~1.75 m adult, in metres. */
export const DIMS = Object.freeze({
  hipHalfWidth: 0.1,
  hipDrop: 0.05,
  thigh: 0.44,
  shin: 0.43,
  ankleHeight: 0.08,
  foot: 0.19,
  spine: 0.5,
  shoulderHalfWidth: 0.19,
  upperArm: 0.3,
  forearm: 0.28,
  neck: 0.1,
  headRadius: 0.11,
});

/** Height of the pelvis when standing with straight legs. */
export const STANDING_PELVIS = DIMS.ankleHeight + DIMS.shin + DIMS.thigh;

export const LIMBS = Object.freeze({
  lFoot: { root: 'lHip', mid: 'lKnee', a: 'thigh', b: 'shin', pole: 'lKnee' },
  rFoot: { root: 'rHip', mid: 'rKnee', a: 'thigh', b: 'shin', pole: 'rKnee' },
  lHand: { root: 'lShoulder', mid: 'lElbow', a: 'upperArm', b: 'forearm', pole: 'lElbow' },
  rHand: { root: 'rShoulder', mid: 'rElbow', a: 'upperArm', b: 'forearm', pole: 'rElbow' },
});

/**
 * Analytic two-bone IK.
 * Returns { mid, end }: the middle joint and the end effector. When the target is out of reach the
 * limb straightens towards it; when it is too close, it folds to the minimum length.
 */
export const SOFT_IK = 0.03;

export function solveTwoBone(rootPos, target, lenA, lenB, poleDir) {
  const toTarget = sub(target, rootPos);
  let d = length(toTarget);
  const u = d < 1e-9 ? [0, -1, 0] : scale(toTarget, 1 / d);
  // Soft IK: in the last few centimetres before full extension the limb approaches straight
  // asymptotically instead of snapping (the knee/elbow would otherwise jump in one frame).
  const hard = lenA + lenB;
  const softStart = hard - SOFT_IK;
  if (d > softStart) d = softStart + SOFT_IK * (1 - Math.exp(-(d - softStart) / SOFT_IK));
  d = clamp(d, Math.abs(lenA - lenB) + 1e-4, hard - 1e-6);
  const along = (lenA * lenA - lenB * lenB + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, lenA * lenA - along * along));
  let bend = sub(poleDir, scale(u, dot(poleDir, u)));
  if (length(bend) < 1e-6) {
    // Pole parallel to the limb: pick any perpendicular, deterministic.
    bend = cross(u, Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]);
  }
  bend = normalize(bend);
  const mid = add(add(rootPos, scale(u, along)), scale(bend, h));
  const end = add(rootPos, scale(u, d));
  return { mid, end };
}

const transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

/**
 * Apply to `v` the minimal rotation taking (0, -1, 0) onto the unit vector `s`
 * (Rodrigues without normalising the axis: v·c + w×v + w(w·v)/(1+c), w = a×s, c = a·s).
 */
export function rotateDownTo(s, v) {
  const a = [0, -1, 0];
  const c = Math.max(-0.999, dot(a, s));
  const w = cross(a, s);
  return add(add(scale(v, c), cross(w, v)), scale(w, dot(w, v) / (1 + c)));
}

/**
 * Forward kinematics + IK: resolved pose → joint positions (world frame) and the two frames.
 */
export function computeJoints(pose, dims = DIMS) {
  const rootM = eulerToMatrix(pose.root.r);
  const chestM = matMul(rootM, eulerToMatrix(pose.spine));
  const pelvis = pose.root.p;
  const inRoot = (v) => add(pelvis, matVec(rootM, v));

  const chest = add(pelvis, matVec(chestM, [0, dims.spine, 0]));
  const inChest = (v) => add(chest, matVec(chestM, v));

  const j = {
    pelvis,
    chest,
    neck: inChest([0, dims.neck, 0]),
    head: inChest([0, dims.neck + dims.headRadius * 1.05, 0.01]),
    lHip: inRoot([dims.hipHalfWidth, -dims.hipDrop, 0]),
    rHip: inRoot([-dims.hipHalfWidth, -dims.hipDrop, 0]),
    lShoulder: inChest([dims.shoulderHalfWidth, -0.02, 0]),
    rShoulder: inChest([-dims.shoulderHalfWidth, -0.02, 0]),
  };

  for (const [name, limb] of Object.entries(LIMBS)) {
    const { mid, end } = solveTwoBone(
      j[limb.root], pose.targets[name], dims[limb.a], dims[limb.b], pose.poles[limb.pole],
    );
    j[limb.mid] = mid;
    j[name] = end;
  }

  // Feet. In the air: take the foot of a standing leg (toes to the pelvis's front, shin straight
  // down) and carry it with the smallest rotation that turns "down" into the actual shin direction
  // (pelvis frame). That field is continuous everywhere except a shin pointing straight UP relative
  // to the pelvis, which no move uses — so the foot never flips. Gives toes up on a front push kick
  // and toes down on a recoiled leg, as a real foot does.
  // Near the floor the foot blends to lying flat, toes forward and just above the ground.
  const rootT = transpose(rootM);
  const flatFwd = matVec(eulerToMatrix([pose.root.r[0], 0, 0]), [0, 0, 1]);
  for (const side of ['l', 'r']) {
    const ankle = j[`${side}Foot`];
    const s = matVec(rootT, normalize(sub(ankle, j[`${side}Knee`])));
    const airToe = add(ankle, scale(normalize(matVec(rootM, rotateDownTo(s, [0, 0, 1]))), dims.foot));
    const flatToe = add(ankle, scale(flatFwd, dims.foot));
    flatToe[1] = Math.max(0.02, ankle[1] - 0.06);
    const w = clamp((ankle[1] - 0.12) / 0.25, 0, 1);
    j[`${side}Toe`] = [0, 1, 2].map((c) => flatToe[c] + (airToe[c] - flatToe[c]) * w);
  }

  return { joints: j, rootM, chestM };
}

/** Segments that keep a fixed length whatever the pose (used by tests and by the renderer). */
export const BONES = Object.freeze([
  ['lHip', 'lKnee', 'thigh'],
  ['lKnee', 'lFoot', 'shin'],
  ['rHip', 'rKnee', 'thigh'],
  ['rKnee', 'rFoot', 'shin'],
  ['lShoulder', 'lElbow', 'upperArm'],
  ['lElbow', 'lHand', 'forearm'],
  ['rShoulder', 'rElbow', 'upperArm'],
  ['rElbow', 'rHand', 'forearm'],
  ['pelvis', 'chest', 'spine'],
]);
