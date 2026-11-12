import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBrep, type Brep, type BrepFace } from '@barocss/cad';
import { midpointPlaneOfBrep, nativeMidpointPlane, type NativeMidpointFace } from '../src/app/nativeMidpointPlane';
import { emptyDoc, withNode, type DocPlane, type StudioDoc } from '../src/engine/doc';
import { partBreps } from '../src/engine/evaluate';
import { dot, sub } from '../src/engine/vec3';

const solid = (node: number) => ({ node, side: 'solid' as const });
const tilt: DocPlane = { origin: [0, 0, 0], normal: [0, 0.6, 0.8], xAxis: [1, 0, 0] };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-12, `${actual} != ${expected}`);

function box(doc: StudioDoc, min: [number, number], max: [number, number], from: number, height: number, plane?: DocPlane) {
  return withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min, max, ...(plane ? { plane } : {}) }),
    { kind: 'extrude', sketch: doc.nodes.length, from, height });
}

function pick(face: BrepFace): NativeMidpointFace {
  assert.ok(face.name);
  return { id: face.id, name: face.name };
}

function named(brep: Brep, name: string): NativeMidpointFace {
  const face = brep.faces.find(face => face.name === name);
  assert.ok(face);
  return pick(face);
}

const caps = (brep: Brep): [NativeMidpointFace, NativeMidpointFace] => [named(brep, 'n1.bottom'), named(brep, 'n1.top')];

test('native axial midpoint retains the off-grid station and makes an independent extrusion', () => {
  const doc = box(emptyDoc(), [0, 0], [20, 5], 2.0002, 8.0004);
  const before = JSON.stringify(doc), [{ brep }] = partBreps(doc);
  const [a, b] = caps(brep);
  const frame = nativeMidpointPlane(doc, 'b1', [a, b]);
  assert.deepEqual(frame, { origin: [0, 0, 6.0004], normal: [0, 0, 1], xAxis: [1, 0, 0] });
  assert.deepEqual(nativeMidpointPlane(doc, 'b1', [b, a]), frame);
  assert.equal(JSON.stringify(doc), before);

  const result = box(doc, [30, 0], [40, 4], 0, 3, frame);
  const bodies = partBreps(result);
  assert.equal(bodies.length, 2);
  const made = bodies.find(body => body.key === 'b3');
  assert.ok(made && checkBrep(made.brep, { strict: true }).valid);
  assert.deepEqual([...new Set(made.brep.vertices.map(vertex => vertex.point[2]))].sort((a, b) => a - b), [6.0004, 6.0004 + 3]);
});

test('exact oblique supports use canonical axes and equal signed offsets in either pick order', () => {
  const doc = box(emptyDoc(), [0, 0], [20, 5], 5, 5, tilt);
  const [{ brep }] = partBreps(doc);
  const [a, b] = caps(brep), frame = nativeMidpointPlane(doc, 'b1', [a, b]);
  assert.deepEqual(frame, { origin: [0, 4.5, 6], normal: [0, 0.6, 0.8], xAxis: [1, 0, 0] });
  assert.deepEqual(nativeMidpointPlane(doc, 'b1', [b, a]), frame);
  near(dot(sub(frame.origin, [0, 3, 4]), frame.normal), 2.5);
  near(dot(sub([0, 6, 8], frame.origin), frame.normal), 2.5);
});

test('native midpoint refuses repeated, missing, mismatched and ambiguous face identities', () => {
  const doc = box(emptyDoc(), [0, 0], [20, 5], 2.0002, 8.0004);
  const [{ brep }] = partBreps(doc), [a, b] = caps(brep);
  assert.throws(() => nativeMidpointPlane(doc, 'b1', [a, a]), /two distinct native faces/);
  assert.throws(() => nativeMidpointPlane(doc, 'b1', [a, { ...b, id: 'absent' }]), /missing or ambiguous/);
  assert.throws(() => nativeMidpointPlane(doc, 'b1', [a, { ...b, name: 'other' }]), /missing or ambiguous/);
  assert.throws(() => nativeMidpointPlane(doc, 'b9', [a, b]), /one current native solid/);

  const duplicateBase = { ...brep, faces: brep.faces.map(face => face.name === 'n1.side0' ? { ...face, name: 'n1.top#1' } : face) };
  assert.throws(() => midpointPlaneOfBrep(duplicateBase, [a, b]), /missing or ambiguous/);
});

test('native midpoint refuses even small departures from exact parallel support', () => {
  const tilted = box(emptyDoc(), [0, 0], [20, 5], 2.0002, 8.0004, tilt);
  const [{ brep }] = partBreps(tilted);
  assert.ok(checkBrep(brep, { strict: true }).valid);
  assert.throws(() => nativeMidpointPlane(tilted, 'b1', caps(brep)), /exactly parallel native faces/);

  const sketch = withNode(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: [[0, 0], [10, 0], [10, 5 + 2 ** -28], [0, 5]] });
  const wedge = withNode(sketch, { kind: 'extrude', sketch: 0, height: 4 });
  const [{ brep: boundary }] = partBreps(wedge);
  assert.ok(checkBrep(boundary, { strict: true }).valid);
  assert.throws(() => nativeMidpointPlane(wedge, 'b1', [named(boundary, 'n1.side0'), named(boundary, 'n1.side2')]), /exactly parallel native faces/);
});

test('native midpoint refuses a frame that sketch coordinates would move off the support', () => {
  const nearAxis: DocPlane = { ...tilt, normal: [0, 2 ** -31, 1] };
  const doc = box(emptyDoc(), [0, 0], [20, 1024], 0, 1, nearAxis);
  const [{ brep }] = partBreps(doc);
  assert.ok(checkBrep(brep, { strict: true }).valid);
  assert.throws(() => nativeMidpointPlane(doc, 'b1', caps(brep)), /outside the sketch coordinate tolerance/);
});

test('distinct coincident native cap faces on one solid cannot define a midpoint', () => {
  const base = box(emptyDoc(), [0, 0], [20, 5], 0, 2);
  const parts = box(box(base, [0, 0], [5, 5], 0, 4), [15, 0], [20, 5], 0, 4);
  const joined = withNode(withNode(parts, { kind: 'union', left: solid(1), right: solid(3) }),
    { kind: 'union', left: solid(6), right: solid(5) });
  const [{ key, brep }] = partBreps(joined);
  const report = checkBrep(brep, { strict: true });
  assert.ok(report.valid && report.counts.bodies === 1);
  const top = brep.faces.filter(face => face.surface.kind === 'surface' && face.surface.controlPoints.flat().every(point => point[2] === 4));
  assert.equal(top.length, 2);
  assert.throws(() => nativeMidpointPlane(joined, key, [pick(top[0]), pick(top[1])]), /coincident or too close/);
});
