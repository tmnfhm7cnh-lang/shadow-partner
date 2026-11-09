/**
 * Animation layer: authored key poses → resolved pose at any time.
 *
 * Authoring format (one key):
 *   {
 *     t,                       // 0..1 inside the move (base loop: 0..1 inside one cycle)
 *     p: [x, y, z],            // pelvis position, world frame, relative to the move's anchor
 *     r: [yaw, pitch, roll],   // pelvis rotation
 *     s: [yaw, pitch, roll],   // chest relative to pelvis
 *     lf, rf, lh, rh,          // ankle / wrist targets: W(x, y, z) world, L(x, y, z) pelvis-local
 *     lk, rk, le, re,          // optional bend directions (knees, elbows): W(...) / L(...); null = default
 *   }
 * Missing fields are inherited from the previous key (the first key inherits from STANCE).
 *
 * A move's keys live strictly inside (0, 1). Before its first key the figure blends from wherever
 * the base loop left it; after its last key it blends back into the live base loop. That is what
 * lets any move start from the ginga and return to it without hand-matching poses.
 */

import { add, lerp, lerp3, matVec, eulerToMatrix, easeInOut, normalize, unwrapNear } from './math.js';
import { pchip, pchipLoop, segmentAt } from './interp.js';

export const W = (x, y, z) => ({ f: 'w', v: [x, y, z] });
export const L = (x, y, z) => ({ f: 'l', v: [x, y, z] });

const LIMB_KEYS = ['lf', 'rf', 'lh', 'rh'];
const POLE_KEYS = ['lk', 'rk', 'le', 're'];
const TARGET_NAME = { lf: 'lFoot', rf: 'rFoot', lh: 'lHand', rh: 'rHand' };
const POLE_NAME = { lk: 'lKnee', rk: 'rKnee', le: 'lElbow', re: 'rElbow' };

/** Neutral parallel stance, knees soft. Used as the implicit "previous key" of every first key. */
export const STANCE = Object.freeze({
  p: [0, 0.86, 0],
  r: [0, 0, 0],
  s: [0, 0, 0],
  lf: W(0.22, 0.08, 0.02),
  rf: W(-0.22, 0.08, 0.02),
  lh: L(0.3, 0.2, 0.15),
  rh: L(-0.3, 0.2, 0.15),
  lk: null, rk: null, le: null, re: null,
});

/** Fill inherited fields so every key is complete. Returns a new array. */
export function completeKeys(keys) {
  const out = [];
  let prev = STANCE;
  for (const key of keys) {
    const k = { ...prev, ...key };
    out.push(k);
    prev = k;
  }
  return out;
}

/** Default knee direction: the pelvis's facing direction (yaw only), slightly outwards. */
function defaultKnee(side, r) {
  return matVec(eulerToMatrix([r[0], 0, 0]), [side === 'l' ? 0.25 : -0.25, 0, 1]);
}

/**
 * Default elbow direction, chest frame: mostly outwards, then down and a little back. "Outwards"
 * dominates on purpose: a guard hand in front of the face points up-forward, which is exactly
 * opposite to "down and back", and an IK pole parallel to the limb flips the elbow.
 */
function defaultElbow(side, r, s) {
  const m = eulerToMatrix(r);
  const ms = eulerToMatrix(s);
  const local = [side === 'l' ? 0.8 : -0.8, -0.6, -0.35];
  return matVec(m, matVec(ms, local));
}

function resolvePoint(spec, pelvis, rootM, anchor) {
  return spec.f === 'w' ? add(spec.v, anchor) : add(pelvis, matVec(rootM, spec.v));
}

function resolveDir(spec, rootM) {
  return spec.f === 'w' ? spec.v : matVec(rootM, spec.v);
}

function interp3(ts, values, x, loop) {
  const f = loop ? pchipLoop : pchip;
  return [0, 1, 2].map((c) => f(ts, values.map((v) => v[c]), x));
}

/** Small lift for a foot that slides along the floor between two keys, so it reads as a step. */
export function stepLift(a, b, s) {
  if (a[1] > 0.15 || b[1] > 0.15) return 0;
  const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (d < 0.04) return 0;
  return Math.min(0.1, 0.25 * d) * Math.sin(Math.PI * s);
}

/**
 * Evaluate complete keys at `x`. `anchor` offsets everything authored in the world frame.
 * `loop` makes the curve periodic (the base loop).
 */
export function evalKeys(keys, x, anchor = [0, 0, 0], loop = false) {
  const ts = keys.map((k) => k.t);
  const pelvis = add(interp3(ts, keys.map((k) => k.p), x, loop), anchor);
  const r = interp3(ts, keys.map((k) => k.r), x, loop);
  const s = interp3(ts, keys.map((k) => k.s), x, loop);
  const rootM = eulerToMatrix(r);

  const targets = {};
  for (const lk of LIMB_KEYS) {
    const pts = keys.map((k) => resolvePoint(k[lk], pelvis, rootM, anchor));
    let v = interp3(ts, pts, x, loop);
    if ((lk === 'lf' || lk === 'rf') && keys.length > 1) {
      const u = loop ? x - Math.floor(x) : x;
      const ext = loop ? [...ts, ts[0] + 1] : ts;
      const extPts = loop ? [...pts, pts[0]] : pts;
      const uu = loop && u < ts[0] ? u + 1 : u;
      const { k, s: frac } = segmentAt(ext, uu);
      v = [v[0], v[1] + stepLift(extPts[k], extPts[k + 1], frac), v[2]];
    }
    targets[TARGET_NAME[lk]] = v;
  }

  const poles = {};
  for (const pk of POLE_KEYS) {
    const side = pk[0];
    const dirs = keys.map((k) => {
      if (k[pk]) return resolveDir(k[pk], rootM);
      return pk[1] === 'k' ? defaultKnee(side, r) : defaultElbow(side, r, s);
    });
    poles[POLE_NAME[pk]] = normalize(interp3(ts, dirs, x, loop));
  }

  return { root: { p: pelvis, r }, spine: s, targets, poles };
}

/** Copy of `pose` with every angle shifted by whole turns to sit within 180° of `ref`'s. */
export function unwrapPoseNear(pose, ref) {
  return {
    ...pose,
    root: { p: pose.root.p, r: pose.root.r.map((a, i) => unwrapNear(a, ref.root.r[i])) },
    spine: pose.spine.map((a, i) => unwrapNear(a, ref.spine[i])),
  };
}

/** Linear blend of two resolved poses; feet that slide along the floor get a small step lift. */
export function blendPoses(a, b, t) {
  const targets = {};
  for (const name of Object.keys(a.targets)) {
    const v = lerp3(a.targets[name], b.targets[name], t);
    if (name === 'lFoot' || name === 'rFoot') v[1] += stepLift(a.targets[name], b.targets[name], t);
    targets[name] = v;
  }
  const poles = {};
  for (const name of Object.keys(a.poles)) poles[name] = normalize(lerp3(a.poles[name], b.poles[name], t));
  return {
    root: { p: lerp3(a.root.p, b.root.p, t), r: a.root.r.map((v, i) => lerp(v, b.root.r[i], t)) },
    spine: a.spine.map((v, i) => lerp(v, b.spine[i], t)),
    targets,
    poles,
  };
}

/**
 * Pose of a move at fraction u ∈ [0, 1].
 *   from(): resolved pose the move starts from (snapshot of the base when it launched);
 *   to():   resolved pose it returns to (the live base, already at the move's end anchor).
 */
export function evalMove(keys, u, anchor, from, to) {
  const t0 = keys[0].t;
  const tN = keys[keys.length - 1].t;
  if (u < t0) {
    const first = evalKeys(keys, t0, anchor);
    return blendPoses(unwrapPoseNear(from(), first), first, easeInOut(u / t0));
  }
  if (u > tN) {
    const last = evalKeys(keys, tN, anchor);
    return blendPoses(last, unwrapPoseNear(to(), last), easeInOut((u - tN) / (1 - tN)));
  }
  return evalKeys(keys, u, anchor);
}

/** Mirror a spec across the x = 0 plane (works for both frames: M·R·M keeps local axes mirrored). */
const mirrorSpec = (spec) => (spec ? { f: spec.f, v: [-spec.v[0], spec.v[1], spec.v[2]] } : spec);

/** Mirror complete keys: left ↔ right. */
export function mirrorKeys(keys) {
  return keys.map((k) => ({
    t: k.t,
    p: [-k.p[0], k.p[1], k.p[2]],
    r: [-k.r[0], k.r[1], -k.r[2]],
    s: [-k.s[0], k.s[1], -k.s[2]],
    lf: mirrorSpec(k.rf), rf: mirrorSpec(k.lf),
    lh: mirrorSpec(k.rh), rh: mirrorSpec(k.lh),
    lk: mirrorSpec(k.rk), rk: mirrorSpec(k.lk),
    le: mirrorSpec(k.re), re: mirrorSpec(k.le),
  }));
}

export const mirrorX = (v) => [-v[0], v[1], v[2]];
