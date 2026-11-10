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

/** Metres the figure may drift from the camera's centre before the camera starts to follow it. */
export const FOLLOW_SLACK = 0.25;

/**
 * Next camera x. Between moves it eases to the figure's anchor (slow, so the ginga does not pull the
 * view around). During a move it follows the pelvis as soon as it leaves a small slack zone around
 * the centre, quickly enough that an au (1.6 m sideways, hands and legs reaching further) never
 * leaves the frame, and a kick that stays in place does not move the view at all.
 */
export function followX(camX, { anchorX, pelvisX, moving, dt }) {
  if (!moving) return camX + (anchorX - camX) * (1 - Math.exp(-dt / 0.9));
  const off = pelvisX - camX;
  const excess = Math.sign(off) * Math.max(0, Math.abs(off) - FOLLOW_SLACK);
  return camX + excess * (1 - Math.exp(-dt / 0.18));
}
