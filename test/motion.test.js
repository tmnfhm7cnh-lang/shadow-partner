import test from 'node:test';
import assert from 'node:assert/strict';

import { distance, matVec } from '../src/core/math.js';
import { computeJoints, BONES, DIMS } from '../src/core/skeleton.js';
import { buildLibrary } from '../src/core/library.js';
import { createScheduler } from '../src/core/scheduler.js';
import { createEngine } from '../src/core/engine.js';
import { moveDurationScale, sequenceGapCycles, timing } from '../src/core/tempo.js';
import { CAPOEIRA } from '../src/core/moves/capoeira.js';

const lib = buildLibrary(CAPOEIRA);
const all = CAPOEIRA.moves.map((m) => m.id);
const DT = 1 / 60;

function simulate({ speed = 5, frequency = 5, sequence = null, seconds = 600, seed = 11, active = all }, onFrame = () => {}) {
  const events = [];
  const engine = createEngine(lib, {
    speed, frequency, sequence,
    scheduler: createScheduler(lib, { active, seed }),
    onEvent: (e) => events.push({ ...e }),
  });
  engine.start(1.5);
  for (let i = 0; i < seconds * 60; i++) {
    engine.update(DT);
    onFrame(engine);
  }
  return { engine, events };
}

// ── tempo ───────────────────────────────────────────────────────────────────

test('au and handstand follow the speed control only partly; a straight kick follows it fully', () => {
  const dur = (id, speed) => {
    const v = lib.byMove(id)[0];
    return v.duration * moveDurationScale(speed, v.tempoWeight);
  };
  const au = dur('au', 10) / dur('au', 5);
  const kick = dur('meia-lua-de-frente', 10) / dur('meia-lua-de-frente', 5);
  assert.ok(au > 0.7, `au at top speed is ${(au * 100).toFixed(0)}% of its normal duration`);
  assert.ok(kick < 0.5, `a kick should still get twice as fast, got ${(kick * 100).toFixed(0)}%`);
  assert.ok(dur('au', 5) >= 2.2, 'the au is a bit slower than before at the reference speed');
  for (let sp = 1; sp < 10; sp++) assert.ok(dur('au', sp + 1) < dur('au', sp), 'still monotonic in speed');
});

test('the gap between sequences goes from 4 ginga cycles (frequency 1) to 1 (frequency 10)', () => {
  assert.equal(sequenceGapCycles(1), 4);
  assert.equal(sequenceGapCycles(10), 1);
  assert.ok(sequenceGapCycles(5) > 1.9 && sequenceGapCycles(5) < 2.4, 'about a couple of gingas in the middle');
  assert.ok(timing({ speed: 5, frequency: 5 }).sequenceGap > timing({ speed: 5, frequency: 10 }).sequenceGap);
});

// ── sequences ───────────────────────────────────────────────────────────────

test('sequences: moves are chained with no ginga in between, then a gap of base loop', () => {
  const modeAtStart = [];
  let prevMode = 'base';
  let lastEndTime = null;
  const gaps = [];
  const { events } = simulate({ sequence: { min: 2, max: 4 }, seconds: 900 }, (engine) => {
    prevMode = engine.state.mode;
    modeAtStart.push(prevMode);
  });
  const starts = events.filter((e) => e.type === 'start');
  const lens = new Map();
  for (const e of starts) {
    assert.ok(e.seqLength >= 1 && e.seqLength <= 4, `sequence of ${e.seqLength}`);
    assert.equal(e.chained, e.seqIndex > 0);
    if (e.seqIndex === 0) {
      lens.set(e.time, e.seqLength);
    }
  }
  assert.ok([...lens.values()].some((n) => n >= 3), 'sequences of 3 or more do happen');
  assert.ok(starts.some((e) => e.chained), 'moves do get chained');

  // Chained: the 'end' of one move and the 'start' of the next share the same instant.
  for (let i = 0; i < events.length - 1; i++) {
    const a = events[i], b = events[i + 1];
    if (a.type === 'end' && b.type === 'start' && b.chained) assert.equal(a.time, b.time);
  }
  // Between sequences: base loop for at least the configured gap.
  const g = timing({ speed: 5, frequency: 5 }).sequenceGap;
  for (const e of events) {
    if (e.type === 'end') lastEndTime = e.time;
    if (e.type === 'start' && !e.chained && lastEndTime !== null) gaps.push(e.time - lastEndTime);
  }
  assert.ok(gaps.length > 20);
  assert.ok(Math.min(...gaps) >= g - 1e-6, `shortest gap ${Math.min(...gaps).toFixed(2)} s < ${g.toFixed(2)} s`);
});

test('sequences: a handstand never comes in the middle of one', () => {
  const { events } = simulate({ sequence: { min: 2, max: 4 }, seconds: 1800, active: all });
  const bananeiras = events.filter((e) => e.type === 'start' && e.variant.moveId === 'bananeira');
  assert.ok(bananeiras.length > 10, 'it still appears');
  for (const e of bananeiras) assert.equal(e.seqIndex, 0, 'bananeira only opens a sequence');
});

test('sequences: no teleports at any speed, bones keep their length, nothing under the floor', () => {
  for (const speed of [1, 5, 10]) {
    let prev = null;
    let maxJump = 0;
    let minY = Infinity;
    simulate({ speed, frequency: 10, sequence: { min: 2, max: 4 }, seconds: 300 }, (engine) => {
      const { joints } = computeJoints(engine.pose());
      for (const [name, p] of Object.entries(joints)) {
        assert.ok(p.every(Number.isFinite), name);
        minY = Math.min(minY, p[1]);
        if (prev) maxJump = Math.max(maxJump, distance(p, prev[name]));
      }
      for (const [a, b, dim] of BONES) {
        assert.ok(Math.abs(distance(joints[a], joints[b]) - DIMS[dim]) < 1e-6, `${a}-${b}`);
      }
      prev = joints;
    });
    assert.ok(maxJump < (speed === 10 ? 0.6 : 0.3), `speed ${speed}: largest per-frame jump ${maxJump.toFixed(3)} m`);
    assert.ok(minY > -0.04, `speed ${speed}: lowest joint ${minY.toFixed(3)} m`);
  }
});

test('without sequences, every move starts from the ginga as before', () => {
  const { events } = simulate({ seconds: 300 });
  for (const e of events.filter((x) => x.type === 'start')) {
    assert.equal(e.chained, false);
    assert.equal(e.seqLength, 1);
  }
});

// ── secondary motion and face ───────────────────────────────────────────────

test('head: in the ginga the face looks at the user; it never leaves the neck range', () => {
  let facing = 0;
  let n = 0;
  let worstYaw = 0;
  const engine = createEngine(lib, { speed: 5 });
  for (let i = 0; i < 20 * 60; i++) {
    engine.update(DT);
    const pose = engine.pose();
    const { headM, joints } = computeJoints(pose);
    const fwd = matVec(headM, [0, 0, 1]);
    const toUser = [0 - joints.head[0] + joints.pelvis[0], 1.45 - joints.head[1], 4.8 - joints.head[2]];
    const len = Math.hypot(...toUser);
    facing += (fwd[0] * toUser[0] + fwd[1] * toUser[1] + fwd[2] * toUser[2]) / len;
    n++;
    worstYaw = Math.max(worstYaw, Math.abs(pose.head[0]));
  }
  assert.ok(facing / n > 0.93, `average alignment with the user ${(facing / n).toFixed(3)}`);
  assert.ok(worstYaw <= 75 + 1e-6);
});

test('head: while the body spins (armada) the face still ends up toward the user', () => {
  const engine = createEngine(lib, { speed: 5 });
  engine.trigger(lib.get('armada'));
  let sawBackTurned = false;
  let last = null;
  for (let i = 0; i < 6 * 60; i++) {
    engine.update(DT);
    const { headM, chestM } = computeJoints(engine.pose());
    const chestFwd = matVec(chestM, [0, 0, 1]);
    if (chestFwd[2] < -0.3) sawBackTurned = true;
    last = matVec(headM, [0, 0, 1]);
  }
  assert.ok(sawBackTurned, 'the armada does turn the chest away from the user');
  assert.ok(last[2] > 0.9, `after the move the head faces the user (z = ${last[2].toFixed(2)})`);
});

test('secondary motion never moves a limb that is on the floor, and never strays far elsewhere', () => {
  let maxStray = 0;
  let planted = 0;
  simulate({ sequence: { min: 2, max: 4 }, seconds: 400, active: all }, (engine) => {
    const raw = engine.rawPose();
    const shown = engine.pose();
    for (const name of ['lFoot', 'rFoot', 'lHand', 'rHand']) {
      const d = distance(raw.targets[name], shown.targets[name]);
      maxStray = Math.max(maxStray, d);
      if (raw.targets[name][1] < 0.1) {
        planted++;
        assert.ok(d < 1e-9, `${name} slid ${d.toFixed(4)} m while planted`);
      }
    }
  });
  assert.ok(planted > 1000);
  assert.ok(maxStray < 0.25, `a limb lagged ${maxStray.toFixed(3)} m behind its authored position`);
});

test('secondary motion is deterministic: same seed and dt, same pose', () => {
  const snap = () => {
    let out = null;
    simulate({ seconds: 120, seed: 5 }, (engine) => { out = JSON.stringify(engine.pose()); });
    return out;
  };
  assert.equal(snap(), snap());
});
