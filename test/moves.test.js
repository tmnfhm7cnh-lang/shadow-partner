import test from 'node:test';
import assert from 'node:assert/strict';

import { distance } from '../src/core/math.js';
import { computeJoints, LIMBS } from '../src/core/skeleton.js';
import { evalKeys } from '../src/core/pose.js';
import { buildLibrary } from '../src/core/library.js';
import { previewPose } from '../src/core/engine.js';
import { CAPOEIRA } from '../src/core/moves/capoeira.js';

const lib = buildLibrary(CAPOEIRA);
const SAMPLES = 240;

function trajectory(variant) {
  const out = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    out.push({ u, joints: computeJoints(previewPose(lib, variant, u)).joints });
  }
  return out;
}

test('every move is well formed', () => {
  for (const m of CAPOEIRA.moves) {
    assert.ok(m.duration > 0, m.id);
    let prev = 0;
    for (const k of m.keys) {
      assert.ok(k.t > prev && k.t < 1, `${m.id}: key times strictly inside (0, 1) and increasing`);
      prev = k.t;
    }
    for (const p of m.launchPhases) assert.ok(p >= 0 && p < 1, m.id);
    assert.ok(['attack', 'displacement', 'floreio'].includes(m.kind), m.id);
    assert.deepEqual(m.responses ?? [], [], `${m.id}: responses are the coach's to write`);
  }
  for (const id of CAPOEIRA.defaultActive) assert.ok(lib.byMove(id).length, id);
});

test('arrivesFrom matches what the animation actually does, seen from the user', () => {
  for (const v of lib.variants.filter((x) => x.kind === 'attack')) {
    const tr = trajectory(v);
    const eff = (s) => s.joints[v.effector];
    // The striking part enters the "strike zone": in front of the figure, towards the user, and
    // off the floor. Which side of the figure it enters from is the side the user sees it coming.
    const entry = tr.find((s) => eff(s)[2] >= s.joints.pelvis[2] + 0.35 && eff(s)[1] >= 0.5);
    assert.ok(entry, `${v.variantId}: never reaches the strike zone`);
    const dx = eff(entry)[0] - entry.joints.pelvis[0];
    const seen = dx > 0.25 ? 'right' : dx < -0.25 ? 'left' : 'center';
    assert.equal(seen, v.arrivesFrom, `${v.variantId}: enters at dx=${dx.toFixed(2)} (u=${entry.u.toFixed(2)})`);
  }
});

test('displacements travel to the side they announce', () => {
  for (const v of lib.variants.filter((x) => x.travels)) {
    const tr = trajectory(v);
    const dx = tr[SAMPLES].joints.pelvis[0] - tr[0].joints.pelvis[0];
    assert.equal(dx > 0.5 ? 'right' : dx < -0.5 ? 'left' : 'none', v.travels, v.variantId);
  }
});

test('nothing goes through the floor, at any moment of any move', () => {
  for (const v of lib.variants) {
    for (const s of trajectory(v)) {
      for (const [name, p] of Object.entries(s.joints)) {
        assert.ok(p[1] >= -0.03, `${v.variantId} u=${s.u.toFixed(2)} ${name} y=${p[1].toFixed(3)}`);
      }
    }
  }
});

test('feet and hands planted on the floor in a key really reach it (no floating supports)', () => {
  const check = (keys, id, anchor = [0, 0, 0], loop = false) => {
    for (const k of keys) {
      const { joints } = computeJoints(evalKeys(keys, k.t, anchor, loop));
      for (const [key, name] of [['lf', 'lFoot'], ['rf', 'rFoot'], ['lh', 'lHand'], ['rh', 'rHand']]) {
        const spec = k[key];
        if (spec.f !== 'w' || spec.v[1] > 0.12) continue;
        const target = [spec.v[0] + anchor[0], spec.v[1], spec.v[2] + anchor[2]];
        const gap = distance(joints[name], target);
        assert.ok(gap < 0.04, `${id} t=${k.t} ${name} misses the floor point by ${gap.toFixed(3)} m`);
      }
    }
  };
  check(lib.base, 'ginga', [0, 0, 0], true);
  for (const v of lib.variants) check(v.keys, v.variantId);
  void LIMBS;
});

test('mirrored variants announce the other side and launch half a cycle later', () => {
  for (const v of lib.variants.filter((x) => x.mirrored)) {
    const o = lib.get(v.moveId);
    if (o.arrivesFrom === 'left' || o.arrivesFrom === 'right') assert.notEqual(v.arrivesFrom, o.arrivesFrom);
    assert.ok(Math.abs(((v.launchPhases[0] - o.launchPhases[0] + 1) % 1) - 0.5) < 1e-9);
  }
});
