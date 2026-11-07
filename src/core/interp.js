/**
 * Monotone piecewise-cubic Hermite interpolation (PCHIP, Fritsch–Butland tangents) on
 * non-uniform knots. Chosen over Catmull-Rom because it never overshoots: two equal keys
 * hold still instead of wobbling, which is what an animator expects from a "hold".
 */

function tangents(ts, ys, zeroEnds) {
  const n = ts.length;
  const m = new Array(n).fill(0);
  if (n < 2) return m;
  const h = [], d = [];
  for (let k = 0; k < n - 1; k++) {
    h.push(ts[k + 1] - ts[k]);
    d.push((ys[k + 1] - ys[k]) / h[k]);
  }
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) continue;
    const w1 = 2 * h[k] + h[k - 1];
    const w2 = h[k] + 2 * h[k - 1];
    m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
  }
  if (!zeroEnds) {
    m[0] = d[0];
    m[n - 1] = d[n - 2];
  }
  return m;
}

function hermite(t0, t1, y0, y1, m0, m1, x) {
  const h = t1 - t0;
  const s = h <= 0 ? 0 : (x - t0) / h;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * m0
    + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * m1;
}

/**
 * Interpolate at `x`. `ts` must be strictly increasing. Outside the knots the end value is held.
 * End tangents are zero: the motion starts and finishes at rest.
 */
export function pchip(ts, ys, x) {
  const n = ts.length;
  if (n === 1 || x <= ts[0]) return ys[0];
  if (x >= ts[n - 1]) return ys[n - 1];
  let k = 0;
  while (k < n - 2 && x > ts[k + 1]) k++;
  const m = tangents(ts, ys, true);
  return hermite(ts[k], ts[k + 1], ys[k], ys[k + 1], m[k], m[k + 1], x);
}

/**
 * Periodic variant with period 1: knots in [0, 1), the curve wraps from the last knot to the first.
 */
export function pchipLoop(ts, ys, x) {
  const n = ts.length;
  if (n === 1) return ys[0];
  const ext = [ts[n - 1] - 1, ...ts, ts[0] + 1, ts[1] + 1];
  const eys = [ys[n - 1], ...ys, ys[0], ys[1]];
  let u = x - Math.floor(x);
  if (u < ts[0]) u += 1;
  const m = tangents(ext, eys, false);
  let k = 1;
  while (k < ext.length - 2 && u > ext[k + 1]) k++;
  return hermite(ext[k], ext[k + 1], eys[k], eys[k + 1], m[k], m[k + 1], u);
}

/** Index of the segment [ts[k], ts[k+1]] that contains x, and the fraction inside it. */
export function segmentAt(ts, x) {
  const n = ts.length;
  if (n < 2 || x <= ts[0]) return { k: 0, s: 0 };
  if (x >= ts[n - 1]) return { k: n - 2, s: 1 };
  let k = 0;
  while (k < n - 2 && x > ts[k + 1]) k++;
  return { k, s: (x - ts[k]) / (ts[k + 1] - ts[k]) };
}
