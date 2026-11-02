import test from 'node:test';
// #region imports
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assembly, part, BarocssError } from '@barocss/cad-model/api';
// #endregion imports
// #region ik-imports
import { solveIk } from '@barocss/cad-model/robot/ik';
import { applyTo, forwardKinematics } from '@barocss/cad-model/robot/fk';
// #endregion ik-imports

const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${actual} vs ${expected}; tolerance ${tolerance}`);
const refuses = code => error => error instanceof BarocssError && error.code === code;

// #region open-scara
// Repository sample: this file runs from apps/library-docs/samples.
const samplePath = resolve(import.meta.dirname, '../../../packages/barocss-cad-model/samples/robots/scara.bcad');
const scaraDocument = JSON.parse(readFileSync(samplePath, 'utf8'));
const scara = assembly('scara', part('scara', scaraDocument)).robot().setJoints({ joints: {
  'base~arm1': { lower: -90, upper: 90, velocity: 60 },
  'arm2~quill': { lower: -40, upper: 40, velocity: 15 },
} });
const turn = 'base~arm1', slide = 'arm2~quill';
// #endregion open-scara

// #region mixed-path
const waypoints = [
  { [turn]: 0, [slide]: 0 },
  { [turn]: 0, [slide]: 0 }, // Repeated waypoint: zero duration.
  { [turn]: 60, [slide]: -30 },
  { [turn]: 0, [slide]: 0 },
];
const limits = {
  default: { velocity: 60, acceleration: 120 }, // deg/s and deg/s² for a turn.
  [slide]: { velocity: 15, acceleration: 30 },  // mm/s and mm/s² for this slide.
};
const path = scara.path(waypoints, { profile: 'trapezoid', limits });
const recorded = scara.withMotion('turn-and-lower', path);
const motion = recorded.motion('turn-and-lower');
assert.deepEqual(motion.problems(), []);
// The limiting slide takes 30/15 + 15/30 = 2.5 s, each way.
assert.ok(Math.abs(motion.duration() - 5) <= 1e-12);
// #endregion mixed-path

test('robot motion guide: mixed turn/slide timing, saved motion and analytic SCARA FK', t => {
  let maxReportedFkErrorMm = 0, maxReportingQuantizationMm = 0, maxJointSampleError = 0;
  assert.deepEqual(scara.joints().joints.filter(j => [turn, slide].includes(j.key)).map(j => j.type), ['revolute', 'prismatic']);
  assert.equal(scara.doc.robot.motions.some(m => m.name === 'turn-and-lower'), false);
  assert.deepEqual(motion.waypoints, waypoints);
  // #region sample-and-pose
  const values = motion.poseAt(1.25); // Seconds. Returns degrees and mm.
  assert.ok(Math.abs(values[turn] - 30) <= 1e-9);
  assert.ok(Math.abs(values[slide] + 15) <= 1e-9);
  const pose = recorded.pose(values); // Link positions in mm, rotations in degrees.
  const quill = pose.links.find(link => link.link === 'quill');
  assert.deepEqual(pose.out_of_limits, []);
  // After solving the mates, the quill origin is (225,25,-30), with pivot (40,40).
  const angle = 30 * Math.PI / 180;
  const analyticPoint = [40 + 185 * Math.cos(angle) + 15 * Math.sin(angle),
    40 + 185 * Math.sin(angle) - 15 * Math.cos(angle), -45];
  // Public pose positions are reported to six decimal places in mm.
  const expected = analyticPoint.map(value => Math.round(value * 1e6) / 1e6);
  quill.position.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) <= 1e-9));
  // #endregion sample-and-pose
  assert.deepEqual(recorded.pose().links.find(link => link.link === 'quill').position, [225, 25, -30]);

  // Independent scalar trapezoid, normalized v=.5/s, a=1/s² and duration2.5s.
  const progress = t => t <= .5 ? t * t / 2 : t <= 2 ? .125 + .5 * (t - .5) : 1 - (2.5 - t) ** 2 / 2;
  for (let leg = 0; leg < 2; leg++) for (let k = 0; k <= 10; k++) {
    const local = 2.5 * k / 10, fraction = leg === 0 ? progress(local) : 1 - progress(local);
    const q = motion.poseAt(leg * 2.5 + local);
    near(q[turn], fraction * 60);
    near(q[slide], -fraction * 30);
    maxJointSampleError = Math.max(maxJointSampleError, Math.abs(q[turn] - fraction * 60), Math.abs(q[slide] + fraction * 30));
    const theta = fraction * Math.PI / 3;
    const point = recorded.pose(q).links.find(link => link.link === 'quill').position;
    const analytic = [40 + 185 * Math.cos(theta) + 15 * Math.sin(theta),
      40 + 185 * Math.sin(theta) - 15 * Math.cos(theta), -30 - fraction * 30];
    const oracle = analytic.map(value => Math.round(value * 1e6) / 1e6);
    point.forEach((value, axis) => {
      near(value, oracle[axis]);
      // Separate facade reporting bound, not the 1e-9 rounded-oracle comparison.
      assert.ok(Math.abs(value - analytic[axis]) <= 0.5e-6);
      maxReportedFkErrorMm = Math.max(maxReportedFkErrorMm, Math.abs(value - oracle[axis]));
      maxReportingQuantizationMm = Math.max(maxReportingQuantizationMm, Math.abs(value - analytic[axis]));
    });
  }
  assert.deepEqual(motion.poseAt(-1), { [turn]: 0, [slide]: 0 });
  assert.deepEqual(motion.poseAt(8), { [turn]: 0, [slide]: 0 });
  t.diagnostic(JSON.stringify({ metric: 'scara-analytic', samples: 22, maxReportedFkErrorMm,
    maxReportingQuantizationMm, maxJointSampleError, durationErrorS: Math.abs(motion.duration() - 5),
    solvedHomeQuillMm: [225, 25, -30], comparisonToleranceMm: 1e-9 }));
});

test('robot motion guide: jerk-limited path keeps synchronized endpoints and finite samples', () => {
  // #region s-curve
  const smooth = scara.path([{ [turn]: 0, [slide]: 0 }, { [turn]: 60, [slide]: -30 }], {
    profile: 's-curve', limits: {
      default: { velocity: 60, acceleration: 120, jerk: 240 },
      [slide]: { velocity: 15, acceleration: 30, jerk: 60 },
    },
  });
  assert.deepEqual(smooth.problems(), []);
  const duration = smooth.duration();
  const middle = smooth.poseAt(duration / 2);
  assert.ok(Math.abs(middle[turn] - 30) <= 1e-9);
  assert.ok(Math.abs(middle[slide] + 15) <= 1e-9);
  // #endregion s-curve
  // Independent normalized S-curve: j=2/s³, a=1/s², v=.5/s.
  // Two .5s jerk ramps on each side and a1s cruise give T=3s.
  near(duration, 3, 1e-12);
  assert.deepEqual(smooth.poseAt(-1), { [turn]: 0, [slide]: 0 });
  const end = smooth.poseAt(duration + 1);
  near(end[turn], 60); near(end[slide], -30);
  for (let k = 0; k <= 20; k++) {
    const q = smooth.poseAt(duration * k / 20);
    assert.ok(Number.isFinite(q[turn]) && Number.isFinite(q[slide]));
    near(q[turn] / 60, q[slide] / -30);
    assert.deepEqual(scara.pose(q).out_of_limits, []);
  }
});

test('robot motion guide: typed invalid-input and joint-limit refusals', () => {
  // #region refusals
  const beyondTravel = scara.path([{}, { [slide]: -41 }], { limits });
  assert.deepEqual(beyondTravel.problems().map(problem => problem.code), ['JOINT_LIMIT']);
  assert.throws(() => beyondTravel.poseAt(0), error => error instanceof BarocssError && error.code === 'JOINT_LIMIT');
  assert.throws(() => motion.poseAt(NaN), error => error instanceof BarocssError && error.code === 'VALUE');
  // A direct pose preview reports an out-of-limit value; it does not clamp it.
  assert.deepEqual(scara.pose({ [slide]: -41 }).out_of_limits, [slide]);
  // #endregion refusals
  for (const value of [NaN, Infinity, -Infinity]) {
    const bad = scara.path([{}, { [turn]: value }], { limits });
    assert.deepEqual(bad.problems().map(p => p.code), ['VALUE']);
    assert.throws(() => bad.duration(), refuses('VALUE'));
    assert.throws(() => motion.poseAt(value), refuses('VALUE'));
    const rates = scara.path([{}, { [turn]: 30 }], { limits: { default: { velocity: value, acceleration: 120 } } });
    assert.deepEqual(rates.problems().map(p => p.code), ['LIMITS_BAD']);
    assert.throws(() => rates.duration(), refuses('LIMITS_BAD'));
  }
  const noJerk = scara.path([{}, { [turn]: 30 }], { profile: 's-curve', limits });
  assert.deepEqual(noJerk.problems().map(p => p.code), ['LIMITS_MISSING']);
  assert.throws(() => noJerk.duration(), refuses('LIMITS_MISSING'));
});

// #region ik-model
// A separate analytic RP tree. This is not the SCARA assembly or a collision model.
const tree = {
  version: 1, base: 'base', links: ['base', 'arm', 'tool'].map(id => ({ id, name: id, part: id })),
  joints: [
    { key: 'turn', type: 'revolute', parent: 'base', child: 'arm', origin: [0, 0, 0], axis: [0, 0, 1],
      limit: { lower: -Math.PI / 2, upper: Math.PI / 2 }, mates: [] },
    { key: 'slide', type: 'prismatic', parent: 'arm', child: 'tool', origin: [40, 0, 0], axis: [1, 0, 0],
      limit: { lower: -20, upper: 80 }, mates: [] },
  ], loops: [], couplings: [], problems: [], notes: [],
};
const tool = [40, 0, 0]; // The tool point at the solved home pose, in mm.
function targetMotion(angleRad, slideMm) {
  const c = Math.cos(angleRad), s = Math.sin(angleRad);
  return { R: Float64Array.of(c, -s, 0, s, c, 0, 0, 0, 1),
    t: Float64Array.of(slideMm * c, slideMm * s, 0) };
}
// #endregion ik-model

test('robot motion guide: analytic IK targets, independent residuals and joint bounds', t => {
  // #region ik-residuals
  const metrics = [];
  for (const [degrees, travel] of [[-60, 25], [0, -10], [45, 60]]) {
    const angle = degrees * Math.PI / 180;
    const result = solveIk(tree, { link: 'tool', tool, motion: targetMotion(angle, travel) });
    const q = result.q; // Radians for turn, mm for slide.
    const expectedPoint = [(40 + travel) * Math.cos(angle), (40 + travel) * Math.sin(angle), 0];
    const actualPoint = [(40 + q.slide) * Math.cos(q.turn), (40 + q.slide) * Math.sin(q.turn), 0];
    const errorM = Math.hypot(...actualPoint.map((v, i) => v - expectedPoint[i])) / 1000;
    const errorRad = Math.abs(Math.atan2(Math.sin(q.turn - angle), Math.cos(q.turn - angle)));
    assert.equal(result.reached, true);
    assert.ok(errorM <= 1e-4 && errorRad <= 1e-3);
    assert.ok(q.turn >= -Math.PI / 2 && q.turn <= Math.PI / 2);
    assert.ok(q.slide >= -20 && q.slide <= 80);
    assert.ok(Math.abs(result.errorM - errorM) <= 1e-9);
    assert.ok(Math.abs(result.errorRad - errorRad) <= 1e-7);
    const fk = forwardKinematics(tree, q);
    applyTo(fk.motions.get('tool'), tool).forEach((v, i) => assert.ok(Math.abs(v - actualPoint[i]) <= 1e-9));
    assert.deepEqual(fk.outOfLimits, []);
    metrics.push({ targetDegrees: degrees, slideMm: travel, errorM, errorRad,
      fkErrorMm: Math.max(...applyTo(fk.motions.get('tool'), tool).map((v, i) => Math.abs(v - actualPoint[i]))) });
  }
  // #endregion ik-residuals
  metrics.forEach(metric => t.diagnostic(JSON.stringify({ metric: 'ik-analytic', ...metric })));
});

test('robot motion guide: IK target outside travel stays unreached with a measured residual', t => {
  // #region unreachable
  const targetAngle = Math.PI / 6;
  const result = solveIk(tree, { link: 'tool', tool, motion: targetMotion(targetAngle, 120) });
  const q = result.q;
  const errorM = Math.hypot((40 + q.slide) * Math.cos(q.turn) - 160 * Math.cos(targetAngle),
    (40 + q.slide) * Math.sin(q.turn) - 160 * Math.sin(targetAngle)) / 1000;
  assert.equal(result.reached, false);
  assert.ok(errorM >= 0.0399); // At least about40mm outside the allowed radius.
  assert.deepEqual(forwardKinematics(tree, q).outOfLimits, []);
  // #endregion unreachable
  near(result.errorM, errorM, 1e-9);
  t.diagnostic(JSON.stringify({ reached: result.reached, errorM, returnedSlideMm: q.slide }));
});
