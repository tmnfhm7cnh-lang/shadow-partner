import test from 'node:test';
import assert from 'node:assert/strict';

import { distance } from '../src/core/math.js';
import { computeJoints } from '../src/core/skeleton.js';
import { buildLibrary, variantSide } from '../src/core/library.js';
import { createScheduler } from '../src/core/scheduler.js';
import { createEngine, crossed } from '../src/core/engine.js';
import { CAPOEIRA } from '../src/core/moves/capoeira.js';

const lib = buildLibrary(CAPOEIRA);
const allMoves = CAPOEIRA.moves.map((m) => m.id);

test('crossed() detects a phase passing a point, including across the wrap', () => {
  assert.ok(crossed(0.2, 0.3, 0.25));
  assert.ok(!crossed(0.2, 0.24, 0.25));
  assert.ok(crossed(0.95, 0.05, 0));
  assert.ok(crossed(0.95, 0.05, 0.99));
  assert.ok(!crossed(0.95, 0.05, 0.5));
});

test('scheduler: same seed → same sequence', () => {
  const a = createScheduler(lib, { active: allMoves, seed: 42 });
  const b = createScheduler(lib, { active: allMoves, seed: 42 });
  for (let i = 0; i < 100; i++) assert.equal(a.next().variantId, b.next().variantId);
});

test('scheduler: only active moves, never more than maxRepeat in a row', () => {
  const active = ['armada', 'au'];
  const s = createScheduler(lib, { active, seed: 3, maxRepeat: 2 });
  const seq = Array.from({ length: 500 }, () => s.next().moveId);
  assert.ok(seq.every((id) => active.includes(id)));
  for (let i = 2; i < seq.length; i++) {
    assert.ok(!(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]), `three in a row at ${i}`);
  }
});

test('scheduler: sides stay balanced', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = createScheduler(lib, { active: ['armada', 'meia-lua-de-frente', 'au'], seed });
    const count = { left: 0, right: 0 };
    for (let i = 0; i < 200; i++) {
      const side = variantSide(s.next());
      if (side in count) count[side]++;
    }
    assert.ok(Math.abs(count.left - count.right) <= 12, `seed ${seed}: ${JSON.stringify(count)}`);
  }
});

function run(speed, seconds, onFrame) {
  const events = [];
  const scheduler = createScheduler(lib, { active: allMoves, seed: 11 });
  const engine = createEngine(lib, { speed, frequency: 8, scheduler, onEvent: (e) => events.push(e) });
  engine.start(0.5);
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    engine.update(dt);
    onFrame(engine, dt);
  }
  return events;
}

test('engine: ten simulated minutes, moves launch at their phase, no NaN, no teleport', () => {
  let prev = null;
  let maxJump = 0;
  let where = '';
  const events = run(5, 600, (engine) => {
    const { joints } = computeJoints(engine.pose());
    for (const [name, p] of Object.entries(joints)) {
      assert.ok(p.every(Number.isFinite), name);
      if (prev) {
        const d = distance(p, prev[name]);
        if (d > maxJump) {
          maxJump = d;
          where = `${name} t=${engine.state.time.toFixed(2)} ${engine.state.move?.variant.variantId ?? 'base'}`;
        }
      }
    }
    prev = joints;
  });
  const starts = events.filter((e) => e.type === 'start');
  assert.ok(starts.length > 60, `only ${starts.length} moves in 10 min`);
  assert.ok(new Set(starts.map((e) => e.variant.moveId)).size === allMoves.length, 'every move appears');
  // 0.3 m in one 60 fps frame = 18 m/s: faster than any real kick, so it can only be a glitch.
  assert.ok(maxJump < 0.3, `largest per-frame jump ${maxJump.toFixed(3)} m at ${where}`);
});

test('engine: fastest speed still has no teleports', () => {
  let prev = null;
  let maxJump = 0;
  run(10, 240, (engine) => {
    const { joints } = computeJoints(engine.pose());
    if (prev) for (const n of Object.keys(joints)) maxJump = Math.max(maxJump, distance(joints[n], prev[n]));
    prev = joints;
  });
  assert.ok(maxJump < 0.6, `largest per-frame jump ${maxJump.toFixed(3)} m`);
});
