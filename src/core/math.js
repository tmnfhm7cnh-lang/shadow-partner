/**
 * Small vector / rotation helpers. No DOM, no dependencies.
 *
 * World frame (shared by every module):
 *   +x = the user's right (screen right), +y = up, +z = towards the user (out of the screen).
 * A figure with zero rotation faces the user (+z), so its own left side is at +x.
 *
 * Euler angles are in degrees, as [yaw, pitch, roll], composed R = Ry(yaw) · Rx(pitch) · Rz(roll):
 *   yaw   > 0 turns the figure towards +x (its own left);
 *   pitch > 0 leans the figure forward (its head towards its own front);
 *   roll  > 0 leans the figure towards its own right (-x when it faces the user).
 */

export const DEG = Math.PI / 180;

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
export const distance = (a, b) => length(sub(a, b));
export const normalize = (a) => {
  const l = length(a);
  return l < 1e-9 ? [0, 0, 0] : scale(a, 1 / l);
};
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Cosine ease in-out on [0, 1]. */
export const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));

/** 3x3 matrices are row-major arrays of 9 numbers. */
export function matMul(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return r;
}

export function matVec(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function rotY(deg) {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

export function rotX(deg) {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

export function rotZ(deg) {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** R = Ry(yaw) · Rx(pitch) · Rz(roll). */
export function eulerToMatrix([yaw, pitch, roll]) {
  return matMul(matMul(rotY(yaw), rotX(pitch)), rotZ(roll));
}

/** Shift `angle` by whole turns so it lies within 180° of `reference`. */
export function unwrapNear(angle, reference) {
  return angle + 360 * Math.round((reference - angle) / 360);
}
