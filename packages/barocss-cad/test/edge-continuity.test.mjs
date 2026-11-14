import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brepFromPrismatic, brepFromTriangles, checkBrep, measureBrepEdgeContinuity, prismaticFromProfile } from '../dist/index.js';

const capsule = [
  { kind: 'line', start: [0, -4] },
  { kind: 'arc', start: [20, -4], center: [20, 0], direction: 'ccw' },
  { kind: 'line', start: [20, 4] },
  { kind: 'arc', start: [0, 4], center: [0, 0], direction: 'ccw' },
];
const skewBox = [[0, 0], [6, 0], [9, 4], [3, 4]].map(start => ({ kind: 'line', start }));

function prism(outer, height = 6) {
  const brep = brepFromPrismatic(prismaticFromProfile({ outer, height, tag: 'stock' }), { id: 'stock' });
  assert.deepEqual(checkBrep(brep).issues, []);
  return brep;
}

function edgeNamed(brep, name) {
  const edge = brep.edges.find(edge => edge.name === name);
  assert.ok(edge, name);
  return edge;
}

function assertMeasured(brep, edgeName, expectedDegrees) {
  const edge = edgeNamed(brep, edgeName);
  const result = measureBrepEdgeContinuity(brep, edge.id);
  assert.equal(result.status, 'measured', JSON.stringify(result));
  assert.equal(result.edgeId, edge.id);
  assert.equal(result.edgeName, edge.name);
  assert.notEqual(result.faces[0].id, result.faces[1].id);
  assert.deepEqual(result.faces.map(face => face.name).sort(), edgeName.split('|'));
  assert.equal(result.sampleCount, 8);
  assert.equal(result.sampleCount, result.samples.length);
  for (const [i, sample] of result.samples.entries()) {
    assert.equal(sample.parameter, (i + 0.5) / 8);
    assert.ok(Math.abs(sample.angleDegrees - expectedDegrees) <= 1e-10, JSON.stringify(sample));
  }
  const angles = result.samples.map(sample => sample.angleDegrees);
  assert.equal(result.minimumAngleDegrees, Math.min(...angles));
  assert.equal(result.maximumAngleDegrees, Math.max(...angles));
}

test('samples a sharp planar joint using oriented normals, including an obtuse angle', () => {
  const brep = prism(skewBox);
  // The profile goes east at one wall and follows the 3–4–5 slope at the next.
  // On the opposite side that slope is reversed. The outward unit normals have dots +3/5 and -3/5.
  assertMeasured(brep, 'stock.side0|stock.side1', Math.acos(3 / 5) * 180 / Math.PI);
  assertMeasured(brep, 'stock.side0|stock.side3', Math.acos(-3 / 5) * 180 / Math.PI);
});

test('samples a tangent plane–cylinder joint and a perpendicular cylinder rim', () => {
  const brep = prism(capsule);
  // At (20,-4,z) the radial normal of the cylinder centered at (20,0) and the wall normal both point along -Y.
  assertMeasured(brep, 'stock.side0|stock.side1', 0);
  // At the cylinder rim its radial normals are horizontal and the top cap normal points along +Z.
  assertMeasured(brep, 'stock.side1|stock.top', 90);
});

test('declines mesh-derived planar faces and a same-face seam from a valid cylinder', () => {
  const mesh = brepFromTriangles([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], [
    0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3,
  ]);
  const meshEdge = mesh.edges[0].id;
  assert.deepEqual(measureBrepEdgeContinuity(mesh, meshEdge), { status: 'unsupported', edgeId: meshEdge, reason: 'faceted-geometry' });

  const cylinder = JSON.parse(readFileSync(new URL('./fixtures/legacy-inputs/brep-cylinder.json', import.meta.url), 'utf8'));
  assert.deepEqual(checkBrep(cylinder).issues, []);
  const loopFaces = new Map(cylinder.loops.map(loop => [loop.id, loop.face]));
  const seam = cylinder.edges.find(edge => {
    const uses = cylinder.coedges.filter(use => use.edge === edge.id);
    return uses.length === 2 && loopFaces.get(uses[0].loop) === loopFaces.get(uses[1].loop);
  });
  assert.ok(seam);
  assert.deepEqual(measureBrepEdgeContinuity(cylinder, seam.id), { status: 'unsupported', edgeId: seam.id, reason: 'same-face-seam' });
});

test('bounds inspection to a native shared edge with valid pcurve binding and available derivatives', () => {
  const original = prism(skewBox, 0.01);
  const edge = edgeNamed(original, 'stock.side0|stock.side1');
  const refused = (reason, change) => {
    const brep = structuredClone(original);
    const use = brep.coedges.find(use => use.edge === edge.id);
    const nativeEdge = brep.edges.find(candidate => candidate.id === edge.id);
    change(use, nativeEdge, brep);
    assert.deepEqual(measureBrepEdgeContinuity(brep, edge.id), { status: 'unsupported', edgeId: edge.id, reason });
  };
  assert.equal(measureBrepEdgeContinuity(original, 'stock.side0|stock.side1').reason, 'edge-not-found');
  refused('invalid-incidence', use => { use.twin = null; });
  refused('missing-pcurve', use => { use.pcurve = null; });
  refused('binding-mismatch', use => { use.pcurve.knots = [2, 2, 3, 3]; });
  refused('binding-mismatch', use => { use.pcurve.controlPoints.reverse(); });
  refused('binding-mismatch', use => {
    // Stay within positional tolerance along the edge but change the canonical parameter speed.
    use.pcurve.controlPoints[1][1] -= 1e-6;
  });
  refused('derivative-unavailable', (_use, nativeEdge, brep) => {
    // The geometric edge is still exactly the same line and has the same parameterization.
    // The native D1 evaluator refuses an exact C0 knot in its representation.
    const firstSample = 1 / 16;
    const curve = nativeEdge.curve;
    const [start, end] = curve.controlPoints;
    curve.controlPoints.splice(1, 0, start.map((coordinate, i) => coordinate + (end[i] - coordinate) * firstSample));
    curve.knots = [0, 0, firstSample, 1, 1];
    curve.weights = [1, 1, 1];
    assert.deepEqual(checkBrep(brep).issues, []);
  });
});
