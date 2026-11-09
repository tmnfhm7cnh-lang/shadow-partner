/**
 * Picks the next move. Random, but with the constraints a training partner needs:
 *   - only among the moves the user activated;
 *   - never the same move more than `maxRepeat` times in a row (when more than one is active);
 *   - sides balanced: the side used less so far is more likely next.
 * Seeded, so a test (or a "repeat this round" feature) gets the same sequence.
 */

import { variantSide } from './library.js';

/** mulberry32: tiny, fast, good enough for sequencing. Returns floats in [0, 1). */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScheduler(library, { active, seed = Date.now(), maxRepeat = 2 } = {}) {
  const rng = createRng(seed);
  const moves = (active ?? library.sport.moves.map((m) => m.id)).filter((id) => library.byMove(id).length);
  if (!moves.length) throw new Error('No active moves');
  const history = [];
  const sideCount = { left: 0, right: 0 };

  function pickMove() {
    const last = history.slice(-maxRepeat);
    const blocked = moves.length > 1 && last.length === maxRepeat && last.every((id) => id === last[0])
      ? last[0] : null;
    const pool = moves.filter((id) => id !== blocked);
    return pool[Math.floor(rng() * pool.length)];
  }

  function pickVariant(moveId) {
    const variants = library.byMove(moveId);
    const left = variants.filter((v) => variantSide(v) === 'left');
    const right = variants.filter((v) => variantSide(v) === 'right');
    if (left.length && right.length) {
      const { left: cl, right: cr } = sideCount;
      const pRight = Math.min(0.9, Math.max(0.1, 0.5 + 0.15 * (cl - cr)));
      const pool = rng() < pRight ? right : left;
      return pool[Math.floor(rng() * pool.length)];
    }
    return variants[Math.floor(rng() * variants.length)];
  }

  return {
    next() {
      const moveId = pickMove();
      const v = pickVariant(moveId);
      history.push(moveId);
      const side = variantSide(v);
      if (side === 'left' || side === 'right') sideCount[side]++;
      return v;
    },
    rng,
  };
}
