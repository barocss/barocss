import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, outputOf, massPropertiesOf, checkOutput, saveCadPart, loadCadPart, CadPartError } from '../dist/index.js';
import { polynomialFaceFillet } from '../dist/blend/polynomial-face-fillet.js';
import { BrepError } from '../dist/brep/brep-core.js';

const doc = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const base = [
  { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20] },
  { id: 'L', kind: 'loft', sections: [{ sketch: 's', z: 0 }, { sketch: 's', z: 20 }],
    guide: { kind: 'nurbs', degree: 5, knots: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
      controlPoints: [[0, 0, 0], [0, 0, 4], [2, 0, 8], [-2, 0, 12], [0, 0, 16], [0, 0, 20]] } },
  { id: 'small', kind: 'face-fillet', target: 'L', faces: ['L.side0', 'L.side3'], radius: 0.25 },
];
const larger = (faces = ['L.side0', 'L.side3'], radius = 0.5, target = 'small') => ({ id: 'large', kind: 'face-fillet', target, faces, radius });
// Independent arc-length integral for C(t)=(20t²(1-t)²(1-2t),0,20t), Simpson with 16384 intervals.
// The square-corner removal is r²(1-π/4)L: both end tangents are vertical, so integrated signed curvature is zero.
const expected = 8000 - 0.5 ** 2 * (1 - Math.PI / 4) * 20.06333624702397;
function verify(output) {
  const report = checkOutput(output);
  assert.equal(report.valid, true, JSON.stringify(report.issues)); assert.equal(report.counts.bodies, 1);
  const volume = massPropertiesOf(output).volume;
  assert.ok(Math.abs(volume - expected) <= 1e-9 * expected, `${volume} vs ${expected}`);
}
function comparePoints(a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; }
function incidentPoints(body, face) {
  const loops = new Map(body.loops.map(loop => [loop.id, loop])), coedges = new Map(body.coedges.map(use => [use.id, use])), edges = new Map(body.edges.map(edge => [edge.id, edge])), vertices = new Map(body.vertices.map(vertex => [vertex.id, vertex]));
  const ids = new Set(), points = [];
  for (const id of face.loops) for (const cid of loops.get(id).coedges) for (const vid of edges.get(coedges.get(cid).edge).vertices) ids.add(vid);
  for (const id of ids) { const p = vertices.get(id).point; points.push([p[0], p[1], p[2]]); }
  return points.sort(comparePoints);
}
function protectedFacesPreserved(before, after) {
  for (const name of ['L.side1', 'L.side2']) {
    const original = before.faces.find(face => face.name === name), current = after.faces.find(face => face.name === name);
    assert.ok(original && current, name); assert.equal(current.sense, original.sense);
    const sourceSurface = structuredClone(original.surface), resultSurface = structuredClone(current.surface);
    delete sourceSurface.id; delete resultSurface.id;
    assert.deepEqual(resultSurface, sourceSurface, `${name} stored surface`);
    assert.deepEqual(incidentPoints(after, current), incidentPoints(before, original), `${name} exact incident representative coordinates`);
  }
}

test('polynomial corner: a larger face fillet replaces a smaller free-form bridge against an independent volume', () => {
  const source = doc([...base, larger()]), before = structuredClone(source), snapshot = evaluateCadPart(source);
  const output = outputOf(snapshot, 'large'); verify(output);
  assert.deepEqual(source, before);
  assert.ok(output.brep.faces.some(face => face.name?.startsWith('large.face')));
  assert.ok(!output.brep.faces.some(face => face.name?.startsWith('small.face')));
  assert.equal(output.fillet.length, 1);
  assert.ok(output.fillet[0].contact <= 2.5e-7); assert.ok(output.fillet[0].section <= 1e-6);
});

test('polynomial corner: reversed picks and native save/open preserve the authored larger round', () => {
  const input = doc([...base, larger(['L.side3', 'L.side0'])]), snapshot = evaluateCadPart(input);
  verify(outputOf(snapshot, 'large'));
  const opened = loadCadPart(saveCadPart(snapshot));
  assert.deepEqual(opened.document, input); verify(outputOf(opened, 'large'));
});

test('polynomial corner: a high-order planar side is admitted without changing input surface or trim records', () => {
  const body = outputOf(evaluateCadPart(doc(base)), 'small').brep, before = structuredClone(body);
  const plane = body.faces.find(face => face.name === 'L.side0');
  assert.ok(plane && plane.surface.kind === 'surface'); assert.equal(plane.surface.degreeV, 5);
  for (const row of plane.surface.controlPoints) for (const point of row) assert.equal(point[1], 0);
  const output = polynomialFaceFillet(body, ['L.side0', 'L.side3'], 0.5, 'large');
  assert.ok(output); assert.deepEqual(body, before);
  protectedFacesPreserved(before, output.brep);
});

test('polynomial corner: sheet-body and open-shell metadata are refused before solid replacement', () => {
  const body = outputOf(evaluateCadPart(doc(base)), 'small').brep, before = structuredClone(body);
  const sheet = { ...body, bodies: body.bodies.map(item => ({ ...item, kind: 'sheet' })) };
  const open = { ...body, shells: body.shells.map(item => ({ ...item, closed: false })) };
  for (const input of [sheet, open]) {
    const kept = structuredClone(input);
    assert.throws(() => polynomialFaceFillet(input, ['L.side0', 'L.side3'], 0.5, 'large'), error => error instanceof BrepError && /CAPABILITY: \[FACE_FILLET_FACES\].*closed solid/.test(error.message));
    assert.deepEqual(input, kept);
  }
  assert.deepEqual(body, before);
});

test('polynomial corner: an equal or smaller round is refused and the source document remains unchanged', () => {
  for (const radius of [0.25, 0.125]) {
    const source = doc([...base, larger(['L.side0', 'L.side3'], radius)]), before = structuredClone(source);
    assert.throws(() => evaluateCadPart(source), error => error instanceof CadPartError && !/unexpected kernel failure/.test(error.message) && /FACE_FILLET|CONTACT_LEAVES_FACE|APPROX_TOLERANCE_NOT_MET|TANGENT_FACES/.test(error.message));
    assert.deepEqual(source, before);
  }
});

test('polynomial corner: a cap with a hole is refused instead of replacing a larger region', () => {
  const features = [...base, { id: 'hole', kind: 'hole', target: 'small', center: [10, 10], radius: 1 }];
  // Establish the input independently of the new operation; an earlier feature failure cannot satisfy this check.
  assert.equal(checkOutput(outputOf(evaluateCadPart(doc(features)), 'hole')).valid, true);
  const source = doc([...features, larger(['L.side0', 'L.side3'], 0.5, 'hole')]), before = structuredClone(source);
  assert.throws(() => evaluateCadPart(source), error => error instanceof CadPartError && /FACE_FILLET_FACES/.test(error.message));
  assert.deepEqual(source, before);
});
