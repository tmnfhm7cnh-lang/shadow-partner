/**
 * Secondary motion: what makes a chain of rigid segments read as one body instead of as parts that
 * each follow their own curve. Applied on top of the authored pose, every frame, by the engine:
 *
 *   - head: looks at the user (the opponent), limited like a real neck, and reaches its look-at
 *     after the chest does. Without it the head is a ball glued to the torso;
 *   - chest: follows the pelvis with a small lag (the pelvis leads, the shoulders come after);
 *   - hands and feet: follow with an even smaller lag and a little overshoot (follow-through), but
 *     ONLY while in the air. A hand or foot on the floor keeps its authored position exactly, so
 *     supports never slide and the tests on planted limbs still hold.
 *
 * Each part is a damped spring chasing the authored value. Lags are in seconds at the reference
 * tempo and are multiplied by `timeScale`, so a slow move lags proportionally more. Pure and
 * deterministic given the sequence of dt. No DOM.
 */

import { add, sub, normalize, matMul, matVec, eulerToMatrix, clamp } from './math.js';

const transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

const DEG = 180 / Math.PI;

/** Where the user's eyes are, relative to the pelvis column of the figure (metres). */
export const GAZE = Object.freeze({ height: 1.45, distance: 4.8 });

/** Head limits relative to the chest, degrees: a spinning body hands over to the neck's range. */
export const HEAD_LIMITS = Object.freeze({ yaw: 75, pitch: 40, roll: 45 });

/** How much the head keeps itself level with the world (0 = glued to the chest, 1 = always upright). */
const UPRIGHT = 0.7;

// lag in seconds (≈ 1.4 / ω for the damping used), damping ratio ζ
const SPINE = { lag: 0.07, zeta: 0.85 };
const HEAD = { lag: 0.11, zeta: 0.85 };
const HAND = { lag: 0.05, zeta: 0.6 };
const FOOT = { lag: 0.04, zeta: 0.65 };
/**
 * Hip drive (kicks only). The hips are what make a kick look like one movement instead of a leg
 * waving: before the foot leaves, the weight goes over the standing leg; the pelvis opens (yaws)
 * towards the kicking leg and the hip tilts, and the trunk leans away from it.
 *   shift: fraction of the way from the pelvis to the standing foot (horizontal), at most maxShift m;
 *   yaw:   fraction of the kicking foot's bearing (seen from the pelvis) added to the hip, at most maxYaw°;
 *   roll:  degrees of lean away from the kick at a full lateral reach (0.6 m).
 */
const HIP = { lag: 0.09, zeta: 0.85, shift: 0.6, maxShift: 0.14, yaw: 0.4, maxYaw: 26, roll: 11 };

/** Most a hand / foot may trail (or overshoot) its authored position, metres. */
const MAX_LAG = { hand: 0.1, foot: 0.12 };

const smooth = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/** One damped-spring state per scalar. Sub-stepped, so it is stable at any frame rate. */
function makeChannel(n) {
  return { x: new Array(n).fill(0), v: new Array(n).fill(0), ready: false };
}

function stepChannel(ch, target, dt, { lag, zeta }, timeScale) {
  if (!ch.ready) {
    ch.x = target.slice();
    ch.v.fill(0);
    ch.ready = true;
    return ch.x;
  }
  const omega = 1.4 / (lag * Math.max(0.3, timeScale));
  const steps = Math.max(1, Math.ceil((dt * omega) / 0.25));
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < ch.x.length; i++) {
      const a = omega * omega * (target[i] - ch.x[i]) - 2 * zeta * omega * ch.v[i];
      ch.v[i] += a * h;
      ch.x[i] += ch.v[i] * h;
    }
  }
  return ch.x;
}

/** Yaw/pitch (degrees, chest frame) that point the head at `worldTarget`, within the neck's range. */
export function lookAt(chestM, neckPos, worldTarget) {
  const d = normalize(sub(worldTarget, neckPos));
  // chest frame = world rotated by the transpose of chestM (row-major: columns become rows)
  const m = chestM;
  const local = [
    m[0] * d[0] + m[3] * d[1] + m[6] * d[2],
    m[1] * d[0] + m[4] * d[1] + m[7] * d[2],
    m[2] * d[0] + m[5] * d[1] + m[8] * d[2],
  ];
  const yaw = clamp(Math.atan2(local[0], local[2]) * DEG, -HEAD_LIMITS.yaw, HEAD_LIMITS.yaw);
  const pitch = clamp(-Math.asin(clamp(local[1], -1, 1)) * DEG, -HEAD_LIMITS.pitch, HEAD_LIMITS.pitch);

  // Roll: a person leaning into a kick keeps the head mostly upright, eyes level with the opponent.
  // Aim the head's up towards a mix of "world up" and "chest up", then read the roll that does it.
  const M0 = matMul(chestM, eulerToMatrix([yaw, pitch, 0]));
  const fw = matVec(M0, [0, 0, 1]);
  const u0 = matVec(M0, [0, 1, 0]);
  const r0 = matVec(M0, [1, 0, 0]);
  const chestUp = matVec(chestM, [0, 1, 0]);
  const want = [chestUp[0] * (1 - UPRIGHT), chestUp[1] * (1 - UPRIGHT) + UPRIGHT, chestUp[2] * (1 - UPRIGHT)];
  const k = want[0] * fw[0] + want[1] * fw[1] + want[2] * fw[2];
  const flat = [want[0] - fw[0] * k, want[1] - fw[1] * k, want[2] - fw[2] * k];
  const roll = Math.atan2(-(flat[0] * r0[0] + flat[1] * r0[1] + flat[2] * r0[2]),
    flat[0] * u0[0] + flat[1] * u0[1] + flat[2] * u0[2]) * DEG;
  return [yaw, pitch, clamp(roll, -HEAD_LIMITS.roll, HEAD_LIMITS.roll)];
}

const NO_HIPS = [0, 0, 0, 0];

/** [dx, dz, yaw°, roll°] the hips should be at, given the authored pose; zero unless exactly one foot is free. */
function hipTarget(pose) {
  const { lFoot, rFoot, lHand, rHand } = pose.targets;
  const p = pose.root.p;
  const free = lFoot[1] > rFoot[1] ? lFoot : rFoot;
  const stand = free === lFoot ? rFoot : lFoot;
  const wFree = smooth((free[1] - 0.15) / 0.35);
  const wStand = smooth((0.2 - stand[1]) / 0.1);
  // a hand on the floor is a second support: the hips stay where the move put them
  const wHands = 1 - Math.max(smooth((0.2 - lHand[1]) / 0.1), smooth((0.2 - rHand[1]) / 0.1));
  const w = wFree * wStand * wHands;
  if (w < 1e-4) return NO_HIPS;

  const yaw0 = pose.root.r[0];
  const dx = free[0] - p[0], dz = free[2] - p[2];
  // bearing of the free foot relative to where the pelvis faces (0 = straight ahead, + = to the figure's left)
  let bearing = Math.atan2(dx, dz) * DEG - yaw0;
  bearing = ((bearing + 540) % 360) - 180;
  const lateral = clamp(dx / 0.6, -1, 1);

  let sx = (stand[0] - p[0]) * HIP.shift;
  let sz = (stand[2] - p[2]) * HIP.shift;
  const len = Math.hypot(sx, sz);
  if (len > HIP.maxShift) { sx *= HIP.maxShift / len; sz *= HIP.maxShift / len; }
  return [
    sx * w, sz * w,
    clamp(bearing * HIP.yaw, -HIP.maxYaw, HIP.maxYaw) * w,
    HIP.roll * lateral * w,
  ];
}

export function createSecondary() {
  const hip = makeChannel(4);
  const spine = makeChannel(3);
  const head = makeChannel(3);
  const hands = { lHand: makeChannel(3), rHand: makeChannel(3) };
  const feet = { lFoot: makeChannel(3), rFoot: makeChannel(3) };

  return {
    /** Forget the state (new round, library move): the next frame starts exactly on the authored pose. */
    reset() {
      for (const ch of [hip, spine, head, ...Object.values(hands), ...Object.values(feet)]) ch.ready = false;
    },

    /**
     * Returns a new pose = authored pose + secondary motion. `dt` in seconds.
     * `hipDrive`: the move is a kick, so the hips take part in it (see HIP).
     */
    apply(raw, dt, timeScale = 1, hipDrive = false) {
      const h = stepChannel(hip, hipDrive ? hipTarget(raw) : NO_HIPS, dt, HIP, timeScale);
      const pose = h.some((v) => Math.abs(v) > 1e-6) ? withHips(raw, h) : raw;
      const sp = stepChannel(spine, pose.spine, dt, SPINE, timeScale);

      const rootM = eulerToMatrix(pose.root.r);
      const chestM = matMul(rootM, eulerToMatrix(sp));
      const neck = add(pose.root.p, matVec(chestM, [0, 0.6, 0]));
      const eyes = [pose.root.p[0], GAZE.height, GAZE.distance];
      const hd = stepChannel(head, lookAt(chestM, neck, eyes), dt, HEAD, timeScale);

      const targets = {};
      for (const [name, ch] of Object.entries(hands)) {
        const goal = pose.targets[name];
        const s = stepChannel(ch, goal, dt, HAND, timeScale);
        const w = smooth((goal[1] - 0.1) / 0.3);
        targets[name] = blend(goal, s, w, MAX_LAG.hand);
      }
      for (const [name, ch] of Object.entries(feet)) {
        const goal = pose.targets[name];
        const s = stepChannel(ch, goal, dt, FOOT, timeScale);
        const w = smooth((goal[1] - 0.14) / 0.3);
        const out = blend(goal, s, w, MAX_LAG.foot);
        out[1] = Math.max(out[1], Math.min(goal[1], 0.08)); // an overshoot never digs into the floor
        targets[name] = out;
      }
      for (const name of ['lHand', 'rHand']) targets[name][1] = Math.max(targets[name][1], Math.min(pose.targets[name][1], 0.03));

      return {
        root: pose.root,
        spine: sp.slice(),
        head: hd.slice(),
        targets: { ...pose.targets, ...targets },
        poles: pose.poles,
      };
    },
  };
}

/**
 * The pose with the hips moved by [dx, dz, yaw, roll]. Everything that is not planted on the floor
 * (hands, the free foot, the knee and elbow directions) turns and moves with the pelvis, so the body
 * stays one piece; supports on the floor stay exactly where they were.
 */
function withHips(pose, [dx, dz, dyaw, droll]) {
  const r = [pose.root.r[0] + dyaw, pose.root.r[1], pose.root.r[2] + droll];
  const p = [pose.root.p[0] + dx, pose.root.p[1], pose.root.p[2] + dz];
  const M = matMul(eulerToMatrix(r), transpose(eulerToMatrix(pose.root.r)));
  const targets = {};
  for (const [name, goal] of Object.entries(pose.targets)) {
    const floorY = name.endsWith('Foot') ? 0.14 : 0.1;
    const w = smooth((goal[1] - floorY) / 0.3);
    const moved = add(p, matVec(M, sub(goal, pose.root.p)));
    targets[name] = [goal[0] + (moved[0] - goal[0]) * w, goal[1] + (moved[1] - goal[1]) * w, goal[2] + (moved[2] - goal[2]) * w];
  }
  const poles = {};
  for (const [name, dir] of Object.entries(pose.poles)) poles[name] = normalize(matVec(M, dir));
  return { ...pose, root: { p, r }, targets, poles };
}

/** goal + w · (state − goal), with the offset capped at `max` metres so a fast limb never trails far. */
function blend(goal, state, w, max) {
  let dx = state[0] - goal[0], dy = state[1] - goal[1], dz = state[2] - goal[2];
  const len = Math.hypot(dx, dy, dz);
  if (len > max) { const k = max / len; dx *= k; dy *= k; dz *= k; }
  return [goal[0] + dx * w, goal[1] + dy * w, goal[2] + dz * w];
}
