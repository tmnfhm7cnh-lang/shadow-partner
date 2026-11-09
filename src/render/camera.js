/**
 * Perspective camera standing where the user stands, looking at the figure.
 * Pure maths (no DOM), so the projection is testable.
 */

import { sub, dot, cross, normalize } from '../core/math.js';

/**
 * `viewLeft`: pixels on the left covered by a panel; the figure is framed in the rest.
 */
export function createCamera({ width, height: fullHeight, targetX = 0, viewLeft = 0, viewBottom = 0 }) {
  // `viewBottom`: pixels at the bottom covered by a sheet; the figure is framed above it.
  const height = Math.max(1, fullHeight - viewBottom);
  const eye = [targetX, 1.3, 4.8];
  const target = [targetX, 0.95, 0];
  const f = normalize(sub(target, eye));
  const r = normalize(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const depth0 = dot(sub(target, eye), f);
  const viewW = Math.max(1, width - viewLeft);
  // Fit a 3.4 m × 2.7 m window around the target (room for an au, a raised leg and the floor).
  const focal = Math.min((viewW * depth0) / 3.4, (height * depth0) / 2.7);
  const cx = viewLeft + viewW / 2;
  const cy = height * 0.5;

  return {
    eye,
    focal,
    /** World point → { x, y, z } with z the depth in metres (bigger = further). */
    project(p) {
      const d = sub(p, eye);
      const z = dot(d, f);
      return { x: cx + (focal * dot(d, r)) / z, y: cy - (focal * dot(d, u)) / z, z };
    },
    /** Size in pixels of `metres` seen at depth `z`. */
    size(metres, z) {
      return (focal * metres) / z;
    },
  };
}
