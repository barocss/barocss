import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInterpolatingCurve, evaluateCurve, evaluateCadPart, outputOf, checkBrep,
  massPropertiesOf, saveCadPart, loadCadPart, CadPartError } from '../dist/index.js';

// Fixed independent Lagrange oracle, authored before this test. Coordinates are mm.
const parameters = [0, 1, 2, 3];
const pointsMM = [[0, 0, 0], [0, 0, 20], [5, 0, 40], [5, 5, 60]];
const outer = [[-2, -2], [2, -2], [2, 2], [-2, 2]];
const hole = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
const intermediate = [[0.5, [-1.25, 0.3125, 10]], [1.5, [2.5, -0.3125, 30]], [2.5, [6.25, 1.5625, 50]]];
const pointClose = (actual, expected) => assert.ok(Math.hypot(...actual.map((v, k) => v - expected[k])) <= 1e-7,
  `${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
function fixture() {
  const points = pointsMM.map((point, k) => ({ parameter: parameters[k], pointMM: [...point] }));
  const options = { curveId: 'xyz', degree: 3, maximumBasisEvaluations: 256, maximumEliminationSteps: 120 };
  const inputsBefore = structuredClone({ points, options });
  const interpolation = buildInterpolatingCurve(points, options), curve = interpolation.curve;
  // CadPart stores the resulting NURBS path, not the interpolation points or native report.
  const path = { degree: curve.degree, knots: [...curve.knots],
    controlPoints: curve.controlPoints.map(p => [...p]), weights: [...curve.weights] };
  const document = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 's', kind: 'sketch', profile: 'polygon', points: outer.map(p => [...p]),
      holes: [hole.map(start => ({ kind: 'line', start: [...start] }))] },
    { id: 'w', kind: 'sweep-curve', sketch: 's', path },
  ] };
  assert.deepEqual({ points, options }, inputsBefore);
  return { points, options, inputsBefore, interpolation, document };
}

test('public XYZ interpolation connects to an open nonplanar holed sweep and preserves its saved NURBS document', () => {
  const { points, options, inputsBefore, interpolation, document } = fixture();
  const documentBefore = structuredClone(document), curveBefore = structuredClone(interpolation.curve);
  for (const point of points) pointClose(evaluateCurve(interpolation.curve, point.parameter), point.pointMM);
  for (const [parameter, expected] of intermediate) pointClose(evaluateCurve(interpolation.curve, parameter), expected);
  // Authored edge vectors have scalar triple product 500 mm^3, so these four points are nonplanar.
  const [a, b, c] = pointsMM.slice(1).map(p => p.map((v, k) => v - pointsMM[0][k]));
  assert.equal(a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2])
    + a[2] * (b[0] * c[1] - b[1] * c[0]), 500);
  assert.notDeepEqual(pointsMM[0], pointsMM[3]);
  const snapshot = evaluateCadPart(document), output = outputOf(snapshot, 'w');
  assert.deepEqual(snapshot.outputs.map(o => o.id), ['w']);
  assert.equal(output.feature, 'w');
  // The sampled solid uses plane surfaces and line edges; the public representation is planar.
  assert.equal(output.representation, 'planar');
  assert.equal(output.bodyCount, 1);
  const brep = output.brep, report = checkBrep(brep);
  assert.equal(report.valid, true);
  assert.deepEqual(report.issues, []);
  assert.equal(brep.bodies.length, 1);
  assert.equal(brep.bodies[0].kind, 'solid');
  assert.equal(brep.shells.length, 1);
  assert.deepEqual(brep.bodies[0].shells, [brep.shells[0].id]);
  assert.equal(brep.shells[0].closed, true);
  assert.equal(report.topology.length, 1);
  assert.equal(report.topology[0].genus, 1);
  // Section area is 16-4=12 mm^2. This sampled faceted sweep has no exact 12*arcLength volume oracle.
  const mass = massPropertiesOf(output, 1); // Explicit fixture density 1 g/cm^3; output is MMGS.
  assert.ok(Number.isFinite(mass.volume) && mass.volume > 0);
  assert.ok(Number.isFinite(mass.mass) && mass.mass > 0);
  assert.equal(mass.centroid.length, 3);
  assert.ok(mass.centroid.every(Number.isFinite));
  assert.equal(mass.inertia.length, 3);
  for (const row of mass.inertia) { assert.equal(row.length, 3); assert.ok(row.every(Number.isFinite)); }

  const saved = saveCadPart(snapshot), parsed = JSON.parse(saved);
  assert.deepEqual(parsed, documentBefore);
  assert.deepEqual(parsed.features[1].path, documentBefore.features[1].path);
  assert.deepEqual(parsed.features[0].holes, documentBefore.features[0].holes);
  assert.equal(parsed.features[1].sketch, 's');
  assert.deepEqual(Object.keys(parsed.features[1].path).sort(), ['controlPoints', 'degree', 'knots', 'weights']);
  const restored = loadCadPart(saved), restoredOutput = outputOf(restored, 'w');
  assert.deepEqual(restored.document, documentBefore);
  assert.equal(saveCadPart(restored), saved);
  assert.deepEqual(restoredOutput.brep, brep);
  // Regeneration equality is preservation evidence, not an independent mass accuracy oracle.
  assert.deepEqual(massPropertiesOf(restoredOutput, 1), mass);
  assert.deepEqual(document, documentBefore);
  assert.deepEqual(interpolation.curve, curveBefore);
  assert.deepEqual({ points, options }, inputsBefore);
});

test('loading a saved interpolated sweep with mismatched weights gives typed INPUT at the sweep feature', () => {
  const { document } = fixture(), documentBefore = structuredClone(document);
  const snapshot = evaluateCadPart(document), saved = saveCadPart(snapshot);
  const damaged = JSON.parse(saved);
  damaged.features[1].path.weights = damaged.features[1].path.weights.slice(1);
  assert.notEqual(damaged.features[1].path.weights.length, damaged.features[1].path.controlPoints.length);
  const damagedText = JSON.stringify(damaged), damagedBefore = structuredClone(damaged);
  assert.throws(() => loadCadPart(damagedText), error => {
    assert.ok(error instanceof CadPartError);
    assert.equal(error.code, 'INPUT');
    assert.equal(error.details.category, 'INPUT');
    assert.equal(error.feature, 'w');
    return true;
  });
  assert.deepEqual(damaged, damagedBefore);
  assert.deepEqual(document, documentBefore);
  assert.deepEqual(snapshot.document, documentBefore);
  assert.equal(saveCadPart(snapshot), saved);
});
