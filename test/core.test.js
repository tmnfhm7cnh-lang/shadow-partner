import test from 'node:test';
import assert from 'node:assert/strict';

import { distance, eulerToMatrix, matVec, unwrapNear } from '../src/core/math.js';
import { pchip, pchipLoop } from '../src/core/interp.js';
import { solveTwoBone, computeJoints, BONES, DIMS } from '../src/core/skeleton.js';
import { completeKeys, evalKeys, mirrorKeys, STANCE } from '../src/core/pose.js';
import { createRng } from '../src/core/scheduler.js';
import { moveScale, baseScale, gapRange } from '../src/core/tempo.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('euler convention: yaw +90 turns the figure towards +x, pitch leans forward, roll leans to its right', () => {
  const f = matVec(eulerToMatrix([90, 0, 0]), [0, 0, 1]);
  assert.ok(close(f[0], 1) && close(f[2], 0));
  const up = matVec(eulerToMatrix([0, 30, 0]), [0, 1, 0]);
  assert.ok(up[2] > 0.49 && up[1] > 0.86);
  const upR = matVec(eulerToMatrix([0, 0, 30]), [0, 1, 0]);
  assert.ok(upR[0] < -0.49, 'roll > 0 tilts the head to -x (the figure\'s right when facing the user)');
});

test('unwrapNear moves an angle by whole turns only', () => {
  assert.equal(unwrapNear(-368, -10), -8);
  assert.equal(unwrapNear(10, 350), 370);
  assert.equal(unwrapNear(5, 0), 5);
});

test('pchip passes through knots, holds equal keys and never overshoots', () => {
  const ts = [0, 0.3, 0.5, 0.9, 1];
  const ys = [0, 2, 2, -1, 0];
  ts.forEach((t, i) => assert.ok(close(pchip(ts, ys, t), ys[i])));
  for (let x = 0.3; x <= 0.5; x += 0.01) assert.ok(close(pchip(ts, ys, x), 2, 1e-9), 'hold between equal keys');
  for (let k = 0; k < ts.length - 1; k++) {
    const lo = Math.min(ys[k], ys[k + 1]), hi = Math.max(ys[k], ys[k + 1]);
    for (let x = ts[k]; x <= ts[k + 1]; x += 0.005) {
      const y = pchip(ts, ys, x);
      assert.ok(y >= lo - 1e-9 && y <= hi + 1e-9, `overshoot at ${x}: ${y}`);
    }
  }
});

test('pchipLoop is continuous across the wrap', () => {
  const ts = [0, 0.25, 0.5, 0.75];
  const ys = [0, 1, 0, -1];
  assert.ok(close(pchipLoop(ts, ys, 0.9999), pchipLoop(ts, ys, 0), 1e-3));
  assert.ok(close(pchipLoop(ts, ys, 1.25), 1));
  ts.forEach((t, i) => assert.ok(close(pchipLoop(ts, ys, t), ys[i])));
});

test('two-bone IK reaches reachable targets and straightens towards unreachable ones', () => {
  const root = [0, 1, 0];
  const reach = solveTwoBone(root, [0.3, 0.4, 0.2], 0.44, 0.43, [0, 0, 1]);
  assert.ok(distance(reach.end, [0.3, 0.4, 0.2]) < 1e-6);
  assert.ok(close(distance(root, reach.mid), 0.44, 1e-9));
  assert.ok(close(distance(reach.mid, reach.end), 0.43, 1e-9));
  assert.ok(reach.mid[2] > 0, 'knee bends towards the pole');
  const far = solveTwoBone(root, [0, -2, 0], 0.44, 0.43, [0, 0, 1]);
  assert.ok(close(distance(root, far.end), 0.87, 1e-4));
});

test('bone lengths never change, whatever the pose', () => {
  const rng = createRng(7);
  const r = (a) => (rng() * 2 - 1) * a;
  for (let i = 0; i < 300; i++) {
    const pose = {
      root: { p: [r(1), 0.5 + rng(), r(1)], r: [r(360), r(180), r(180)] },
      spine: [r(40), r(40), r(40)],
      targets: { lFoot: [r(2), r(2), r(2)], rFoot: [r(2), r(2), r(2)], lHand: [r(2), r(2), r(2)], rHand: [r(2), r(2), r(2)] },
      poles: { lKnee: [0, 0, 1], rKnee: [r(1), r(1), 1], lElbow: [0, -1, 0], rElbow: [r(1), -1, r(1)] },
    };
    const { joints } = computeJoints(pose);
    for (const [a, b, dim] of BONES) {
      assert.ok(close(distance(joints[a], joints[b]), DIMS[dim], 1e-6), `${a}-${b}`);
    }
  }
});

test('the stance puts the feet on their targets and the pelvis at its height', () => {
  const [k] = completeKeys([{ t: 0.5 }]);
  const pose = evalKeys([k], 0.5);
  const { joints } = computeJoints(pose);
  assert.ok(distance(joints.lFoot, STANCE.lf.v) < 1e-6);
  assert.ok(distance(joints.rFoot, STANCE.rf.v) < 1e-6);
  assert.ok(close(joints.pelvis[1], STANCE.p[1]));
  assert.ok(joints.lKnee[2] > joints.lFoot[2], 'knees point forward');
});

test('mirrored keys produce the mirror image of every joint, left and right swapped', () => {
  const keys = completeKeys([
    { t: 0.2, p: [0.1, 0.9, -0.1], r: [-40, 12, -15], s: [-10, 5, 8], rf: { f: 'l', v: [-0.6, 0.3, 0.3] }, lh: { f: 'w', v: [0.5, 1.2, 0.3] } },
    { t: 0.7, p: [0.2, 0.8, 0], r: [-200, 4, -20], s: [-5, 0, 3], rk: { f: 'l', v: [-0.2, 0.4, 1] } },
  ]);
  const mirrored = mirrorKeys(keys);
  for (const t of [0.2, 0.45, 0.7]) {
    const a = computeJoints(evalKeys(keys, t)).joints;
    const b = computeJoints(evalKeys(mirrored, t)).joints;
    for (const name of Object.keys(a)) {
      const other = name[0] === 'l' && name[1] === name[1].toUpperCase() ? `r${name.slice(1)}`
        : name[0] === 'r' && name[1] === name[1].toUpperCase() ? `l${name.slice(1)}` : name;
      const m = [-a[name][0], a[name][1], a[name][2]];
      assert.ok(distance(m, b[other]) < 1e-6, `${name} at ${t}`);
    }
  }
});

test('tempo: speed and frequency map monotonically, 5 is the authored reference', () => {
  assert.equal(moveScale(5), 1);
  assert.equal(baseScale(5), 1);
  for (let v = 1; v < 10; v++) {
    assert.ok(moveScale(v + 1) < moveScale(v));
    assert.ok(baseScale(v + 1) < baseScale(v));
    assert.ok(gapRange(v + 1).min < gapRange(v).min);
    assert.ok(gapRange(v).min < gapRange(v).max);
  }
});
