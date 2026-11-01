import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTo, composeInto, forwardKinematics, invert, type Motion } from '@barocss/cad-model/robot/fk';
import { solveIk } from '@barocss/cad-model/robot/ik';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { checkPath, duration, motionOf, poseAt, timedPathOf } from '@barocss/cad-model/robot/motion';
import { timePath, type TimedPath } from '@barocss/cad-model/robot/ccd';

// Frozen limits and independent oracles: see kinematics-contract.md.
const MM_TOL = 1e-9;
const NUM_TOL = 1e-12;
const IK_M_TOL = 1e-4;
const IK_RAD_TOL = 1e-3;
const DEG = Math.PI / 180;
const PIVOT = [137, -83, 29] as const;
const TOOL = [177, -83, 29] as const;
const near = (got: number, want: number, tol = NUM_TOL) =>
  assert.ok(Number.isFinite(got) && Math.abs(got - want) <= tol, `${got} vs ${want}; tolerance ${tol}`);
const vectorNear = (got: ArrayLike<number>, want: ArrayLike<number>, tol = MM_TOL) => {
  assert.equal(got.length, want.length);
  for (let i = 0; i < got.length; i++) near(got[i], want[i], tol);
};
const blankMotion = (): Motion => ({ R: new Float64Array(9), t: new Float64Array(3) });
const identity = (): Motion => ({ R: Float64Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1), t: new Float64Array(3) });

function robot(): JointTree {
  return {
    version: 1, base: 'base',
    links: ['base', 'arm', 'tool'].map(id => ({ id, name: id, part: id })),
    joints: [
      { key: 'turn', type: 'revolute', parent: 'base', child: 'arm', origin: [...PIVOT], axis: [0, 0, 1],
        limit: { lower: -Math.PI / 2, upper: Math.PI / 2 }, mates: [] },
      { key: 'slide', type: 'prismatic', parent: 'arm', child: 'tool', origin: [...TOOL], axis: [1, 0, 0],
        limit: { lower: -20, upper: 80 }, mates: [] },
    ], loops: [], couplings: [], problems: [], notes: [],
  };
}

// Scalar RP closed form. This is a test oracle, not a production solver.
function analyticPoint(theta: number, slide: number): number[] {
  return [PIVOT[0] + (40 + slide) * Math.cos(theta), PIVOT[1] + (40 + slide) * Math.sin(theta), PIVOT[2]];
}
function analyticMotion(theta: number, slide: number): Motion {
  const c = Math.cos(theta), s = Math.sin(theta);
  return {
    R: Float64Array.of(c, -s, 0, s, c, 0, 0, 0, 1),
    t: Float64Array.of(PIVOT[0] - c * PIVOT[0] + s * PIVOT[1] + c * slide,
      PIVOT[1] - s * PIVOT[0] - c * PIVOT[1] + s * slide, 0),
  };
}
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
const wrapAngle = (v: number) => Math.abs(Math.atan2(Math.sin(v), Math.cos(v)));

test('public transforms: fixed quarter turn and translation preserve composition order', () => {
  const turn = { R: Float64Array.of(0, -1, 0, 1, 0, 0, 0, 0, 1), t: Float64Array.of(7, -11, 3) };
  const slide = { ...identity(), t: Float64Array.of(13, -5, 2) };
  vectorNear(applyTo(composeInto(blankMotion(), turn, slide), [2, 4, 6]), [8, 4, 11]);
  vectorNear(applyTo(composeInto(blankMotion(), slide, turn), [2, 4, 6]), [16, -14, 11]);
});

test('public FK: off-origin mixed RP chain agrees with an analytic point and matrix', t => {
  const tree = robot();
  let maxPointMm = 0, maxRotationEntry = 0, maxInverseMm = 0;
  for (const degrees of [-90, -30, 0, 30, 90]) for (const slide of [-20, 0, 25, 80]) {
    const theta = degrees * DEG, fk = forwardKinematics(tree, { turn: theta, slide });
    assert.deepEqual(fk.outOfLimits, []);
    assert.deepEqual(fk.unknown, []);
    const m = fk.motions.get('tool')!, oracle = analyticMotion(theta, slide);
    const point = applyTo(m, TOOL), expected = analyticPoint(theta, slide), recovered = applyTo(invert(m), expected);
    maxPointMm = Math.max(maxPointMm, distance(point, expected));
    maxInverseMm = Math.max(maxInverseMm, distance(recovered, TOOL));
    maxRotationEntry = Math.max(maxRotationEntry, ...m.R.map((entry, i) => Math.abs(entry - oracle.R[i])));
    vectorNear(point, expected);
    vectorNear(m.R, oracle.R, NUM_TOL);
    vectorNear(m.t, oracle.t);
    vectorNear(recovered, TOOL);
    vectorNear(applyTo(fk.motions.get('base')!, PIVOT), PIVOT);
  }
  t.diagnostic(JSON.stringify({ metric: 'fk-analytic', poses: 20, maxPointMm, maxRotationEntry, maxInverseMm }));
});

test('public IK: independently constructed RP targets satisfy residual and joint bounds', t => {
  const tree = robot();
  for (const [degrees, slide] of [[-60, 25], [35, 60], [0, -10]]) {
    const theta = degrees * DEG, want = analyticPoint(theta, slide);
    const result = solveIk(tree, { link: 'tool', tool: TOOL, motion: analyticMotion(theta, slide) }, { turn: 0.1, slide: 5 });
    const point = analyticPoint(result.q.turn, result.q.slide);
    const errorM = distance(point, want) / 1000, errorRad = wrapAngle(result.q.turn - theta);
    assert.equal(result.reached, errorM <= IK_M_TOL && errorRad <= IK_RAD_TOL);
    assert.equal(result.reached, true, JSON.stringify(result));
    assert.ok(result.q.turn >= -Math.PI / 2 - NUM_TOL && result.q.turn <= Math.PI / 2 + NUM_TOL);
    assert.ok(result.q.slide >= -20 - NUM_TOL && result.q.slide <= 80 + NUM_TOL);
    near(result.errorM, errorM, 1e-9);
    near(result.errorRad, errorRad, 1e-7);
    const fk = forwardKinematics(tree, result.q);
    vectorNear(applyTo(fk.motions.get('tool')!, TOOL), point);
    assert.deepEqual(fk.outOfLimits, []);
    t.diagnostic(JSON.stringify({ metric: 'ik-analytic-target', targetDegrees: degrees, targetSlideMm: slide,
      reached: result.reached, positionErrorM: errorM, angleErrorRad: errorRad,
      reportedPositionErrorM: result.errorM, reportedAngleErrorRad: result.errorRad }));
  }
});

test('public IK: target beyond slide travel remains unreached with an independent residual', t => {
  const tree = robot(), theta = 30 * DEG;
  const result = solveIk(tree, { link: 'tool', tool: TOOL, motion: analyticMotion(theta, 120) });
  const errorM = distance(analyticPoint(result.q.turn, result.q.slide), analyticPoint(theta, 120)) / 1000;
  assert.equal(result.reached, false);
  assert.ok(errorM >= 0.0399, `independent residual ${errorM} m`);
  near(result.errorM, errorM, 1e-9);
  assert.deepEqual(forwardKinematics(tree, result.q).outOfLimits, []);
  t.diagnostic(JSON.stringify({ metric: 'ik-unreachable', reached: result.reached, positionErrorM: errorM,
    reportedPositionErrorM: result.errorM, returnedTurnRad: result.q.turn, returnedSlideMm: result.q.slide }));
});

// Independent normalized trapezoid: v=0.5, a=1, T=2.5 seconds.
function progress(t: number): number {
  if (t <= 0.5) return t * t / 2;
  if (t <= 2) return 0.125 + 0.5 * (t - 0.5);
  return 1 - (2.5 - t) ** 2 / 2;
}

test('saved mixed deg/mm path: analytic simultaneous motion, repeated waypoint and return', t => {
  const tree = robot();
  let maxTurnRad = 0, maxSlideMm = 0, maxPointMm = 0;
  const saved = {
    waypoints: [{ turn: 0, slide: 0 }, { turn: 0, slide: 0 }, { turn: 60, slide: 30 }, { turn: 0, slide: 0 }],
    profile: 'trapezoid' as const,
    limits: { default: { velocity: 60, acceleration: 120 }, slide: { velocity: 15, acceleration: 30 } },
  };
  const path = timedPathOf(tree, saved);
  near(path.waypoints[2].turn, Math.PI / 3);
  near(path.waypoints[2].slide, 30);
  near(path.limits.turn!.v, Math.PI / 3);
  near(path.limits.turn!.a, 2 * Math.PI / 3);
  near(path.limits.slide!.v, 15);
  near(path.limits.slide!.a, 30);
  assert.equal(path.limits.default, undefined);
  assert.deepEqual(checkPath(tree, path), []);
  const segments = timePath(tree, path);
  assert.equal(segments[0].duration, 0);
  near(segments[1].duration, 2.5);
  near(segments[2].t0, 2.5);
  near(segments[2].duration, 2.5);
  near(duration(path), 5);
  const back = motionOf(tree, path);
  near(back.waypoints[2].turn, 60);
  near(back.waypoints[2].slide, 30);
  near(back.limits!.turn.velocity, 60);
  near(back.limits!.slide.velocity, 15);
  for (const leg of [0, 1]) for (let k = 0; k <= 100; k++) {
    const local = 2.5 * k / 100, u = leg === 0 ? progress(local) : 1 - progress(local);
    const q = poseAt(tree, path, leg * 2.5 + local);
    maxTurnRad = Math.max(maxTurnRad, Math.abs(q.turn - u * Math.PI / 3));
    maxSlideMm = Math.max(maxSlideMm, Math.abs(q.slide - u * 30));
    near(q.turn, u * Math.PI / 3);
    near(q.slide, u * 30);
    const fk = forwardKinematics(tree, q);
    assert.deepEqual(fk.outOfLimits, []);
    const point = applyTo(fk.motions.get('tool')!, TOOL), expected = analyticPoint(u * Math.PI / 3, u * 30);
    maxPointMm = Math.max(maxPointMm, distance(point, expected));
    vectorNear(point, expected);
  }
  assert.deepEqual(poseAt(tree, path, -10), { turn: 0, slide: 0 });
  assert.deepEqual(poseAt(tree, path, 10), { turn: 0, slide: 0 });
  t.diagnostic(JSON.stringify({ metric: 'trapezoid-analytic', samples: 202, durationS: duration(path),
    maxTurnRad, maxSlideMm, maxPointMm }));
});

test('public trajectory: triangular slide matches both analytic halves over 101 samples', t => {
  const tree = robot();
  let maxSlideMm = 0;
  const path: TimedPath = { waypoints: [{ slide: 0 }, { slide: 10 }], profile: 'trapezoid', limits: { slide: { v: 20, a: 40 } } };
  near(duration(path), 1);
  for (let k = 0; k <= 100; k++) {
    const time = k / 100, want = time <= 0.5 ? 20 * time * time : 10 - 20 * (1 - time) ** 2;
    const got = poseAt(tree, path, time).slide;
    maxSlideMm = Math.max(maxSlideMm, Math.abs(got - want));
    near(got, want, MM_TOL);
  }
  t.diagnostic(JSON.stringify({ metric: 'triangular-analytic', samples: 101, durationS: duration(path), maxSlideMm }));
});

test('public path checks distinguish expected typed refusals from valid finite paths', () => {
  const tree = robot();
  const base: TimedPath = { waypoints: [{}, { slide: 10 }], profile: 'trapezoid', limits: { default: { v: 20, a: 40 } } };
  const codes = (path: TimedPath, t = tree) => checkPath(t, path).map(p => p.code);
  assert.deepEqual(codes(base), []);
  assert.deepEqual(codes({ ...base, waypoints: [{}] }), ['PATH_TOO_SHORT']);
  assert.deepEqual(codes({ ...base, waypoints: [{}, { absent: 1 }] }), ['JOINT_UNKNOWN']);
  assert.deepEqual(codes({ ...base, waypoints: [{}, { slide: 81 }] }), ['JOINT_LIMIT']);
  assert.deepEqual(codes({ ...base, limits: {} }), ['LIMITS_MISSING']);
  assert.deepEqual(codes({ ...base, profile: 's-curve' }), ['LIMITS_MISSING']);
  const mimicTree = { ...tree, joints: tree.joints.map(j => j.key === 'slide'
    ? { ...j, mimic: { joint: 'turn', multiplier: 1, offset: 0 } } : j) };
  assert.deepEqual(codes(base, mimicTree), ['JOINT_MIMIC']);
});
