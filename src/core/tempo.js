/**
 * Maps the two user controls (1–10) to timing.
 *   speed     → how fast the base loop runs and how fast each move is executed;
 *   frequency → how much base loop there is between two moves.
 * 5 is the reference: the durations authored in the move files are the speed-5 durations.
 */

import { clamp } from './math.js';

const level = (v) => clamp(Math.round(v), 1, 10);

/** Multiplier on a move's authored duration. Speed 1 ≈ 1.85× slower, speed 10 ≈ 0.46×. */
export function moveScale(speed) {
  return 2 ** ((5 - level(speed)) / 4.5);
}

/**
 * Multiplier on one move's authored duration. `weight` says how much that move follows the speed
 * control: 1 = fully (a kick can be as fast as you like), 0 = not at all. A wheel (au) or a handstand
 * has a physical floor on how fast it can be done, so it follows the control only partly.
 */
export function moveDurationScale(speed, weight = 1) {
  return moveScale(speed) ** weight;
}

/** Multiplier on the base loop period. Gentler than moves: a frantic ginga reads as noise. */
export function baseScale(speed) {
  return 2 ** ((5 - level(speed)) / 7);
}

/** Pause range (seconds of base loop) between the end of a move and the next launch window. */
export function gapRange(frequency) {
  const f = (level(frequency) - 1) / 9;
  return { min: 5 * (0.4 / 5) ** f, max: 8 * (1.6 / 8) ** f };
}

/** Full ginga cycles between one sequence and the next: 4 at frequency 1, 1 at frequency 10. */
export function sequenceGapCycles(frequency) {
  const f = (level(frequency) - 1) / 9;
  return 4 * 0.25 ** f;
}

export function timing({ speed = 5, frequency = 5, basePeriod = 2 }) {
  return {
    period: basePeriod * baseScale(speed),
    moveScale: moveScale(speed),
    gap: gapRange(frequency),
    sequenceGap: sequenceGapCycles(frequency) * basePeriod * baseScale(speed),
  };
}
