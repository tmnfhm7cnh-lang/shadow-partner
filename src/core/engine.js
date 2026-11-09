/**
 * The training partner's clock. Runs the base loop, asks the scheduler for the next move, waits
 * for the right moment of the base loop to launch it, plays it and returns to the base loop.
 *
 * Two ways of playing:
 *   - single moves: ginga → move → ginga (for as long as the frequency says) → move …
 *   - sequences: several moves chained with NO ginga in between (each one blends straight into the
 *     next), then the base loop for a couple of cycles, then the next sequence.
 *
 * Pure and deterministic given (library, options, seed, dt sequence). No DOM.
 */

import { add, distance, clamp } from './math.js';
import { evalKeys, evalMove, blendPosesLocal, unwrapPoseNear } from './pose.js';
import { timing, moveDurationScale } from './tempo.js';
import { createSecondary } from './secondary.js';
import { easeInOut } from './math.js';

/** True when the phase went past `p` while moving from `prev` to `cur` (both in [0, 1), wrapping). */
export function crossed(prev, cur, p) {
  if (prev === cur) return false;
  if (prev < cur) return p > prev && p <= cur;
  return p > prev || p <= cur;
}

const TARGETS = ['lFoot', 'rFoot', 'lHand', 'rHand'];

/**
 * Seconds (at the reference tempo) to go from `from` to `to` when two moves are chained: long
 * enough that no limb needs to travel faster than a fast strike, never shorter than a blink.
 */
export function linkSeconds(from, to) {
  const f = unwrapPoseNear(from, to);
  let reach = 0;
  for (const name of TARGETS) reach = Math.max(reach, distance(f.targets[name], to.targets[name]));
  let turn = 0;
  f.root.r.forEach((a, i) => { turn = Math.max(turn, Math.abs(a - to.root.r[i])); });
  f.spine.forEach((a, i) => { turn = Math.max(turn, Math.abs(a - to.spine[i])); });
  return clamp(Math.max(reach / 4, turn / 520), 0.14, 0.7);
}

export function createEngine(library, {
  speed = 5, frequency = 5, scheduler = null, sequence = null, onEvent = () => {},
} = {}) {
  let tm = timing({ speed, frequency, basePeriod: library.sport.basePeriod });
  const secondary = createSecondary();
  const s = {
    time: 0,
    phase: 0,
    anchor: [0, 0, 0],
    mode: 'base',
    move: null,       // { variant, start, dur, anchor, from, link, uEnd, total, seqIndex, seqLength }
    pending: null,    // variant waiting for its launch window
    chain: [],        // variants that follow `pending` without ginga in between
    carry: null,      // a drawn variant that cannot be chained: it opens the next sequence
    nextAt: Infinity, // time from which the pending move may launch
    shown: null,      // pose after secondary motion, refreshed by update()
  };

  const basePose = (phase, anchor) => evalKeys(library.base, phase, anchor, true);
  const rng = scheduler ? scheduler.rng : Math.random;
  const durationOf = (variant) => variant.duration * moveDurationScale(speed, variant.tempoWeight);

  function gap() {
    return tm.gap.min + (tm.gap.max - tm.gap.min) * rng();
  }

  function drawSequence() {
    const n = sequence.min + Math.floor(rng() * (sequence.max - sequence.min + 1));
    const list = [];
    for (let i = 0; i < n; i++) {
      const v = (i === 0 && s.carry) ? s.carry : scheduler.next();
      if (i === 0) s.carry = null;
      if (i > 0 && v.chainIn === false) { s.carry = v; break; }
      list.push(v);
    }
    return list;
  }

  function queueNext(delay) {
    if (!scheduler) return;
    const list = sequence ? drawSequence() : [scheduler.next()];
    s.pending = list[0];
    s.chain = list.slice(1);
    s.seqLength = list.length;
    s.nextAt = s.time + delay;
  }

  /** `from`: resolved pose to start from when chained to a previous move (null: from the base loop). */
  function launch(variant, from = null, seqIndex = 0) {
    const dur = durationOf(variant);
    const t0 = variant.keys[0].t;
    const tN = variant.keys[variant.keys.length - 1].t;
    const tailless = s.chain.length > 0; // another move follows: no way back to the ginga in between
    const uEnd = tailless ? tN : 1;
    const anchor = s.anchor.slice();
    let link = 0;
    let start = from;
    if (from) {
      const scale = dur / variant.duration;
      link = linkSeconds(from, evalKeys(variant.keys, t0, anchor)) * scale ** 0.8;
    } else {
      start = basePose(s.phase, s.anchor);
    }
    s.move = {
      variant, start: s.time, dur, anchor, from: start, link, uEnd,
      total: link + dur * (uEnd - (from ? t0 : 0)),
      seqIndex, seqLength: s.seqLength ?? 1,
    };
    s.mode = 'move';
    s.pending = null;
    s.nextAt = Infinity;
    onEvent({
      type: 'start', variant, time: s.time, seqIndex, seqLength: s.move.seqLength, chained: Boolean(from),
    });
  }

  function finish() {
    const { variant, anchor, seqIndex } = s.move;
    s.anchor = add(anchor, variant.endOffset);
    onEvent({ type: 'end', variant, time: s.time });
    if (s.chain.length) {
      const last = evalKeys(variant.keys, variant.keys[variant.keys.length - 1].t, anchor);
      const next = s.chain.shift();
      launch(next, last, seqIndex + 1);
      return;
    }
    s.mode = 'base';
    s.move = null;
    queueNext(sequence ? tm.sequenceGap : gap());
  }

  /** Authored pose at this instant, before secondary motion. */
  function rawPose() {
    if (s.mode === 'base') return basePose(s.phase, s.anchor);
    const m = s.move;
    const { variant, anchor, from } = m;
    const e = s.time - m.start;
    const endAnchor = add(anchor, variant.endOffset);
    const toBase = () => basePose(s.phase, endAnchor);
    if (m.link > 0) {
      const t0 = variant.keys[0].t;
      if (e < m.link) {
        const first = evalKeys(variant.keys, t0, anchor);
        return blendPosesLocal(unwrapPoseNear(from, first), first, easeInOut(e / m.link));
      }
      return evalMove(variant.keys, Math.min(m.uEnd, t0 + (e - m.link) / m.dur), anchor, () => from, toBase);
    }
    return evalMove(variant.keys, Math.min(m.uEnd, e / m.dur), anchor, () => from, toBase);
  }

  /** How much slower than the reference the thing on screen is moving (scales the secondary lags). */
  function timeScale() {
    if (s.mode === 'base') return tm.period / library.sport.basePeriod;
    return s.move.dur / s.move.variant.duration;
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
      s.chain = [];
      s.seqLength = 1;
      s.nextAt = s.time;
    },
    setOptions(opts) {
      speed = opts.speed ?? speed;
      frequency = opts.frequency ?? frequency;
      if ('sequence' in opts) sequence = opts.sequence;
      tm = timing({ speed, frequency, basePeriod: library.sport.basePeriod });
    },
    get timing() {
      return tm;
    },
    /** Seconds a variant takes at the current speed. */
    duration: (variant) => durationOf(variant),
    update(dt) {
      const prev = s.phase;
      s.time += dt;
      s.phase = (s.phase + dt / tm.period) % 1;
      for (let guard = 0; s.mode === 'move' && s.time - s.move.start >= s.move.total && guard < 8; guard++) finish();
      if (s.mode === 'base' && s.pending && s.time >= s.nextAt
        && s.pending.launchPhases.some((p) => crossed(prev, s.phase, p))) {
        launch(s.pending);
      }
      s.shown = secondary.apply(rawPose(), dt, timeScale());
    },
    /** The pose to draw: authored pose plus secondary motion (head gaze, lagging limbs). */
    pose() {
      return s.shown ?? secondary.apply(rawPose(), 0, timeScale());
    },
    /** The authored pose alone, without secondary motion. */
    rawPose,
    /** Progress of the current move (0..1) or null. */
    get progress() {
      return s.move ? Math.min(1, (s.time - s.move.start) / s.move.total) : null;
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
