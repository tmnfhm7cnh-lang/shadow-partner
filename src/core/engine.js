/**
 * The training partner's clock. Runs the base loop, asks the scheduler for the next move, waits
 * for the right moment of the base loop to launch it, plays it and returns to the base loop.
 * Pure and deterministic given (library, options, seed, dt sequence). No DOM.
 */

import { add } from './math.js';
import { evalKeys, evalMove } from './pose.js';
import { timing } from './tempo.js';

/** True when the phase went past `p` while moving from `prev` to `cur` (both in [0, 1), wrapping). */
export function crossed(prev, cur, p) {
  if (prev === cur) return false;
  if (prev < cur) return p > prev && p <= cur;
  return p > prev || p <= cur;
}

export function createEngine(library, {
  speed = 5, frequency = 5, scheduler = null, onEvent = () => {},
} = {}) {
  let tm = timing({ speed, frequency, basePeriod: library.sport.basePeriod });
  const s = {
    time: 0,
    phase: 0,
    anchor: [0, 0, 0],
    mode: 'base',
    move: null,       // { variant, start, dur, anchor, from }
    pending: null,    // variant waiting for its launch window
    nextAt: Infinity, // time from which the pending move may launch
  };

  const basePose = (phase, anchor) => evalKeys(library.base, phase, anchor, true);
  const rng = scheduler ? scheduler.rng : Math.random;

  function gap() {
    return tm.gap.min + (tm.gap.max - tm.gap.min) * rng();
  }

  function queueNext(delay) {
    if (!scheduler) return;
    s.pending = scheduler.next();
    s.nextAt = s.time + delay;
  }

  function launch(variant) {
    s.move = {
      variant,
      start: s.time,
      dur: variant.duration * tm.moveScale,
      anchor: s.anchor.slice(),
      from: basePose(s.phase, s.anchor),
    };
    s.mode = 'move';
    s.pending = null;
    s.nextAt = Infinity;
    onEvent({ type: 'start', variant, time: s.time });
  }

  function finish() {
    const { variant, anchor } = s.move;
    s.anchor = add(anchor, variant.endOffset);
    s.mode = 'base';
    s.move = null;
    onEvent({ type: 'end', variant, time: s.time });
    queueNext(gap());
  }

  return {
    state: s,
    /** Start scheduling moves (the first one after `firstDelay` seconds of base loop). */
    start(firstDelay = 1.5) {
      queueNext(firstDelay);
    },
    /** Queue a specific variant for the next launch window (library / preview use). */
    trigger(variant) {
      s.pending = variant;
      s.nextAt = s.time;
    },
    setOptions(opts) {
      tm = timing({ speed: opts.speed ?? speed, frequency: opts.frequency ?? frequency, basePeriod: library.sport.basePeriod });
      speed = opts.speed ?? speed;
      frequency = opts.frequency ?? frequency;
    },
    get timing() {
      return tm;
    },
    update(dt) {
      const prev = s.phase;
      s.time += dt;
      s.phase = (s.phase + dt / tm.period) % 1;
      if (s.mode === 'move' && s.time - s.move.start >= s.move.dur) finish();
      if (s.mode === 'base' && s.pending && s.time >= s.nextAt
        && s.pending.launchPhases.some((p) => crossed(prev, s.phase, p))) {
        launch(s.pending);
      }
    },
    pose() {
      if (s.mode === 'base') return basePose(s.phase, s.anchor);
      const { variant, start, dur, anchor, from } = s.move;
      const u = Math.min(1, (s.time - start) / dur);
      const endAnchor = add(anchor, variant.endOffset);
      return evalMove(variant.keys, u, anchor, () => from, () => basePose(s.phase, endAnchor));
    },
    /** Progress of the current move (0..1) or null. */
    get progress() {
      return s.move ? Math.min(1, (s.time - s.move.start) / s.move.dur) : null;
    },
  };
}

/**
 * Pose of a variant at fraction u, outside of any running session (library view, tests):
 * starts from and returns to the base loop at the variant's first launch phase.
 */
export function previewPose(library, variant, u, period = library.sport.basePeriod) {
  const phase0 = variant.launchPhases[0];
  const from = evalKeys(library.base, phase0, [0, 0, 0], true);
  const phaseEnd = (phase0 + (variant.duration * u) / period) % 1;
  return evalMove(variant.keys, u, [0, 0, 0], () => from,
    () => evalKeys(library.base, phaseEnd, variant.endOffset, true));
}
