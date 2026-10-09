import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closestSegmentBox, referenceSweep, referencePointBox } from './reference.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const metadata = { gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceTreeDirty: !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
  nodeVersion: process.version, timestamp: new Date().toISOString() };
const floor = { id: 'floor', centerM: [0, -0.05, 0], halfExtentsM: [3, 0.05, 1], orientationXYZW: [0, 0, 0, 1] };
const wall = { id: 'wall', centerM: [0.5, 0.6, 0], halfExtentsM: [0.05, 1, 1], orientationXYZW: [0, 0, 0, 1] };
const step = { id: 'step', centerM: [0.5, 0.05, 0], halfExtentsM: [0.25, 0.05, 0.75], orientationXYZW: [0, 0, 0, 1] };
const results = [], refusals = [];
function near(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: ${actual} versus ${expected}`);
  return Math.abs(actual - expected);
}
function vectorError(actual, expected, tolerance, label) {
  assert.equal(actual.length, expected.length);
  const error = Math.hypot(...actual.map((value, axis) => value - expected[axis]));
  assert.ok(error <= tolerance, `${label}: ${error} exceeds ${tolerance}`); return error;
}
function rejection(label, action, code) {
  let error; try { action(); } catch (caught) { error = caught; }
  assert.ok(error instanceof Error, label); if (code) assert.equal(error.code, code);
  refusals.push({ label, name: error.name, code: error.code ?? null, message: error.message });
}
function sweepControl(name, center, displacement, box, expectedFraction, expectedNormal, expectedPoint) {
  const before = structuredClone({ center, displacement, box });
  const result = referenceSweep(center, displacement, box);
  assert.ok(result, name);
  const fractionError = near(result.fraction, expectedFraction, 1e-6, `${name} analytic fraction`);
  const normalError = vectorError(result.normalM, expectedNormal, 1e-6, `${name} analytic normal`);
  near(Math.hypot(...result.normalM), 1, 1e-12, `${name} unit normal`);
  const distance = Math.hypot(...result.segmentM.map((value, axis) => value - result.pointM[axis]));
  const gapErrorM = near(distance, 0.15, 1e-10, `${name} witness separation`);
  const membership = referencePointBox(result.pointM, box);
  near(membership.distanceM, 0, 1e-12, `${name} point membership`);
  near(membership.boundaryResidualM, 0, 1e-12, `${name} boundary membership`);
  const moved = center.map((value, axis) => value + result.fraction * displacement[axis]);
  near(result.segmentM[0], moved[0], 1e-12, `${name} segmentX`);
  near(result.segmentM[2], moved[2], 1e-12, `${name} segmentZ`);
  assert.ok(result.segmentM[1] >= moved[1] - 0.35 - 1e-12 && result.segmentM[1] <= moved[1] + 0.35 + 1e-12);
  const pointErrorM = expectedPoint ? vectorError(result.pointM, expectedPoint, 1e-6, `${name} unique point`) : null;
  assert.deepEqual({ center, displacement, box }, before);
  const copied = referenceSweep(center, displacement, box); result.normalM.fill(42); result.pointM.fill(42); result.segmentM.fill(42);
  assert.deepEqual(referenceSweep(center, displacement, box), copied);
  results.push({ name, fractionError, normalError, gapErrorM, pointErrorM });
}

try {
  const floorDistance = closestSegmentBox([0, 0.8, 0], floor);
  near(floorDistance.distanceM, 0.45, 1e-12, 'floor exact distance');
  vectorError(floorDistance.segmentM, [0, 0.45, 0], 1e-12, 'floor lower endpoint');
  vectorError(floorDistance.pointM, [0, 0, 0], 1e-12, 'floor closest point');
  vectorError(floorDistance.normalM, [0, 1, 0], 1e-12, 'floor normal');
  const corner = closestSegmentBox([0.1, 0.505, 0.83], step);
  near(corner.distanceM, Math.sqrt(0.15 ** 2 + 0.055 ** 2 + 0.08 ** 2), 1e-12, 'three-axis corner distance');
  vectorError(corner.pointM, [0.25, 0.1, 0.75], 1e-12, 'corner clamp point');
  const interior = closestSegmentBox([0.5, 0.6, 0], wall);
  assert.equal(interior.distanceM, 0); assert.equal(interior.normalM, null);
  near(referencePointBox([0.5, 0.6, 0], wall).boundaryResidualM, 0.05, 1e-12, 'point is interior rather than boundary');
  near(referencePointBox([0.3, 0.6, 0], wall).distanceM, 0.15, 1e-12, 'point outside wall');
  sweepControl('floor', [0, 0.8, 0], [0, -0.6, 0], floor, 0.5, [0, 1, 0]);
  sweepControl('wall', [-0.5, 0.6, 0], [2, 0, 0], wall, 0.4, [-1, 0, 0]);
  const cornerX = 0.25 - Math.sqrt(0.15 ** 2 - 0.055 ** 2);
  sweepControl('step-corner', [-0.5, 0.505, 0], [1.5, 0, 0], step, (cornerX + 0.5) / 1.5,
    [(cornerX - 0.25) / 0.15, 0.055 / 0.15, 0], [0.25, 0.1, 0]);
  const corner3X = 0.25 - Math.sqrt(0.15 ** 2 - 0.055 ** 2 - 0.08 ** 2);
  sweepControl('step-three-axis-corner', [-0.5, 0.505, 0.83], [1.5, 0, 0], step, (corner3X + 0.5) / 1.5,
    [(corner3X - 0.25) / 0.15, 0.055 / 0.15, 0.08 / 0.15], [0.25, 0.1, 0.75]);
  sweepControl('step-tangent', [-0.5, 0.6, 0], [1.5, 0, 0], step, 0.5, [0, 1, 0], [0.25, 0.1, 0]);
  const angleZ = Math.PI / 12, normalZ = [-Math.sin(angleZ), Math.cos(angleZ), 0];
  const slope = { id: 'slope', centerM: normalZ.map(value => -0.05 * value), halfExtentsM: [3, 0.05, 1],
    orientationXYZW: [0, 0, Math.sin(angleZ / 2), Math.cos(angleZ / 2)] };
  sweepControl('z-rotation15', [-0.75, Math.tan(angleZ) * -0.75 + 0.35 + 0.35 / Math.cos(angleZ), 0],
    [1, 0, 0], slope, 0.2 / Math.sin(angleZ), normalZ);
  const angleY = Math.PI / 6;
  const yaw = { ...wall, orientationXYZW: [0, Math.sin(angleY / 2), 0, Math.cos(angleY / 2)] };
  sweepControl('y-rotation30', [-0.5, 0.6, 0], [1.5, 0, 0], yaw,
    (1 - 0.2 / Math.cos(angleY)) / 1.5, [-Math.cos(angleY), 0, Math.sin(angleY)]);
  for (const displacement of [[0, 0, 0], [-0.2, 0, 0]]) {
    sweepControl('initial-wall-touch', [0.3, 0.6, 0], displacement, wall, 0, [-1, 0, 0]);
  }
  const clear = [
    ['zero-clear', [0, 0.8, 0], [0, 0, 0], floor],
    ['parallel-floor', [-1, 0.505, 0], [2, 0, 0], floor],
    ['wall-away', [-0.5, 0.6, 0], [-1, 0, 0], wall],
    ['tangent-plus-micron', [-0.5, 0.600001, 0], [1.5, 0, 0], step],
    ['z-clear', [-0.5, 0.505, 1], [1.5, 0, 0], step],
  ];
  for (const [name, center, displacement, box] of clear) {
    assert.equal(referenceSweep(center, displacement, box), null, name); results.push({ name, clear: true });
  }
  for (const center of [[0.4, 0.6, 0], [0.5, 0.6, 0]]) {
    rejection('initial-wall-overlap', () => referenceSweep(center, [1, 0, 0], wall), 'INITIAL_OVERLAP');
  }
  rejection('unresolved-presence-root-band', () => referenceSweep([-0.5, 0.6 + 5e-14, 0], [1.5, 0, 0], step), 'REF_UNRESOLVED');
  console.log(JSON.stringify({ ...metadata, result: 'ok', analyticAndMembershipControls: results, refusals,
    scalarDistances: { floorM: floorDistance.distanceM, cornerM: corner.distanceM, interiorM: interior.distanceM },
    timingsMeasured: false, scope: 'Reference-only authored scalar cases; no candidate campaign or exact global CCD theorem' }));
} catch (error) {
  console.log(JSON.stringify({ ...metadata, result: 'failed', firstFailure: error.stack || String(error),
    analyticAndMembershipControls: results, refusals, timingsMeasured: false }));
  process.exitCode = 1;
}
