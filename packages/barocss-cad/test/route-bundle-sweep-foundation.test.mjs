import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCurve, evaluateCadPart, reevaluate, outputOf, checkBrep, saveCadPart, CadPartError } from '../dist/index.js';

// Fixed independent cubic Bernstein oracle. Coordinates and radius are mm.
// These are two ordinary sweep features; no bundle schema or automatic route association is implied.
const EPS = 1e-7, RADIUS = 0.5, DELTA = [5, -3, 4];
const starts = [[-2, 0, 0], [2, 0, 0]], ends = [[-2, 0, 30], [2, 0, 30]];
const midpoints = [[-0.125, -1.125, 16.5], [3.875, -1.125, 16.5]];
const pointClose = (actual, expected) => assert.ok(Math.hypot(...actual.map((v, k) => v - expected[k])) <= EPS,
  `${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
const paths = () => [-2, 2].map(x => ({ degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1],
  controlPoints: [0, 10, 20, 30].map(z => [x, 0, z]), weights: [1, 1, 1, 1] }));
const editedPaths = original => original.map(path => ({ ...structuredClone(path),
  controlPoints: path.controlPoints.map((p, i) => p.map((v, k) => v + (i === 1 ? DELTA[k] : 0))) }));
const documentOf = routes => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
  features: routes.flatMap((path, i) => [
    { id: `s${i}`, kind: 'sketch', profile: 'circle', center: [0, 0], radius: RADIUS },
    { id: `w${i}`, kind: 'sweep-curve', sketch: `s${i}`, path },
  ]) });

// Only endpoint plane/radius observations: no absolute transported-frame or whole-sweep accuracy claim.
function capPoints(brep, center, tangent) {
  const length = Math.hypot(...tangent);
  const points = brep.vertices.map(v => v.point).filter(p =>
    Math.abs(p.reduce((sum, v, k) => sum + (v - center[k]) * tangent[k], 0)) / length <= EPS);
  assert.ok(points.length >= 3, 'endpoint section has at least three boundary vertices');
  for (const p of points) assert.ok(Math.abs(Math.hypot(...p.map((v, k) => v - center[k])) - RADIUS) <= EPS,
    `endpoint radius: ${JSON.stringify(p)} around ${JSON.stringify(center)}`);
}
function checkRoutes(snapshot, edited) {
  assert.deepEqual(snapshot.outputs.map(o => [o.id, o.feature]), [['w0', 'w0'], ['w1', 'w1']]);
  for (let i = 0; i < 2; i++) {
    const output = outputOf(snapshot, `w${i}`), brep = output.brep, report = checkBrep(brep);
    assert.equal(output.representation, 'planar'); // The existing sweep is sampled and faceted.
    assert.equal(output.bodyCount, 1);
    assert.equal(report.valid, true);
    assert.deepEqual(report.issues, []);
    assert.equal(brep.bodies.length, 1);
    assert.equal(brep.bodies[0].kind, 'solid');
    assert.equal(brep.shells.length, 1);
    assert.deepEqual(brep.bodies[0].shells, [brep.shells[0].id]);
    assert.equal(brep.shells[0].closed, true);
    assert.equal(report.topology.length, 1);
    assert.equal(report.topology[0].genus, 0);
    assert.ok(brep.vertices.length > 0);
    for (const vertex of brep.vertices) { assert.equal(vertex.point.length, 3); assert.ok(vertex.point.every(Number.isFinite)); }
    // Default XY axes are projected perpendicular to the start tangent, then transported.
    // Editing pole 1 changes the start direction to [5,-3,14]; the end remains along +Z.
    capPoints(brep, starts[i], edited ? [5, -3, 14] : [0, 0, 1]);
    capPoints(brep, ends[i], [0, 0, 1]);
  }
}

test('two cubic paths retain fixed endpoints and 4 mm offset after the same pole edit', () => {
  const original = paths(), before = structuredClone(original), edited = editedPaths(original), editedBefore = structuredClone(edited);
  assert.deepEqual(edited.map(path => path.controlPoints[1]), [[3, -3, 14], [7, -3, 14]]);
  for (let i = 0; i < 2; i++) {
    const curve = { kind: 'curve', id: `route${i}`, ...original[i] };
    const changed = { kind: 'curve', id: `route${i}`, ...edited[i] };
    pointClose(evaluateCurve(curve, 0), starts[i]);
    pointClose(evaluateCurve(curve, 0.5), [starts[i][0], 0, 15]);
    pointClose(evaluateCurve(curve, 1), ends[i]);
    pointClose(evaluateCurve(changed, 0), starts[i]);
    // Bernstein at 1/2 is [1,3,3,1]/8; pole 1 contributes (3/8)*DELTA.
    pointClose(evaluateCurve(changed, 0.5), midpoints[i]);
    pointClose(evaluateCurve(changed, 1), ends[i]);
    for (const pole of [0, 2, 3]) assert.deepEqual(edited[i].controlPoints[pole], original[i].controlPoints[pole]);
    assert.deepEqual(edited[i].knots, original[i].knots);
    assert.deepEqual(edited[i].weights, original[i].weights);
  }
  // The authored coefficient offset proves the relation independently of evaluating either curve.
  for (let pole = 0; pole < 4; pole++) pointClose(edited[1].controlPoints[pole].map((v, k) => v - edited[0].controlPoints[pole][k]), [4, 0, 0]);
  for (const t of [0, 0.5, 1]) {
    const points = edited.map((path, i) => evaluateCurve({ kind: 'curve', id: `route${i}`, ...path }, t));
    pointClose(points[1].map((v, k) => v - points[0][k]), [4, 0, 0]);
  }
  assert.deepEqual(original, before);
  assert.deepEqual(edited, editedBefore);
});

test('two radius 0.5 sweeps regenerate with their endpoint sections and preserve prior results on refusal', () => {
  const original = paths(), originalBefore = structuredClone(original), edited = editedPaths(original), editedBefore = structuredClone(edited);
  const document = documentOf(original), documentBefore = structuredClone(document), editedDocument = documentOf(edited), editedDocumentBefore = structuredClone(editedDocument);
  const before = evaluateCadPart(document), savedBefore = saveCadPart(before);
  checkRoutes(before, false);
  const beforeBreps = structuredClone(before.outputs.map(o => o.brep));
  const after = reevaluate(before, { document: editedDocument });
  checkRoutes(after, true);
  for (let i = 0; i < 2; i++) {
    assert.ok(after.recomputation.evaluated.includes(`w${i}`));
    assert.ok(after.recomputation.reused.includes(`s${i}`));
    assert.notDeepEqual(outputOf(after, `w${i}`).brep, beforeBreps[i]);
  }
  assert.deepEqual(after.document, editedDocumentBefore);
  const savedAfter = saveCadPart(after), afterBreps = structuredClone(after.outputs.map(o => o.brep));
  for (const kind of ['weights', 'zero-length']) {
    const rejected = structuredClone(editedDocument), path = rejected.features[3].path;
    if (kind === 'weights') path.weights.pop();
    else path.controlPoints = path.controlPoints.map(() => [...path.controlPoints[0]]);
    const rejectedBefore = structuredClone(rejected), category = kind === 'weights' ? 'INPUT' : 'GEOMETRY';
    assert.throws(() => reevaluate(after, { document: rejected }), error => {
      assert.ok(error instanceof CadPartError);
      assert.equal(error.code, category);
      assert.equal(error.details.category, category);
      assert.equal(error.feature, 'w1');
      assert.match(error.message, kind === 'weights' ? /weights must match control points/i : /path has no length/);
      return true;
    });
    assert.deepEqual(rejected, rejectedBefore);
    assert.equal(saveCadPart(after), savedAfter);
    assert.deepEqual(after.outputs.map(o => o.brep), afterBreps);
  }
  assert.deepEqual(document, documentBefore);
  assert.deepEqual(before.document, documentBefore);
  assert.equal(saveCadPart(before), savedBefore);
  assert.deepEqual(before.outputs.map(o => o.brep), beforeBreps);
  assert.deepEqual(editedDocument, editedDocumentBefore);
  assert.deepEqual(original, originalBefore);
  assert.deepEqual(edited, editedBefore);
  // No volume, mass, triangle count, global self-intersection or manufacturing oracle is asserted.
});
