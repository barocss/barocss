import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBrep } from '@barocss/cad';
import { emptyDoc, placedBase, placedDoc, withNode, type PartInstance } from '@barocss/cad-model/engine/doc';
import { evaluatePlaced, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { partSnapshot } from '@barocss/cad-model/engine/part';
import { placementOf } from '@barocss/cad-model/engine/placement';
import { offsetPlane, standardPlane, tiltPlane, xyPlane } from '@barocss/cad-model/sketch/plane';
import { placedBoxSnapPoints } from '../src/viewport/placedBoxSnap';

function definition() {
  return withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 12], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] } }),
    { kind: 'extrude', sketch: 0, height: 6 });
}
const instance = (id: string, position: PartInstance['position'], doc = definition()): PartInstance =>
  ({ id, name: id, doc, position, rotation: [0, 0, 0] });

function evaluated(inst: PartInstance) {
  const result = evaluatePlaced(placedDoc(inst), placedBase(inst), placementOf(inst), 1);
  assert.ok(result.ok, JSON.stringify(result));
  assert.equal(result.bodies.length, 1);
  return result.bodies[0];
}

test('two accepted translated native boxes keep distinct occurrence identity and world coordinates', () => {
  const doc = definition();
  const occurrences = [instance('left', [10.25, 14.25, 0], doc), instance('right', [55.75, 34.25, 0], doc)];
  for (const [i, occurrence] of occurrences.entries()) {
    const body = evaluated(occurrence);
    assert.equal(body.key, 'b1');
    assert.ok(body.mesh.edges.every(edge => edge.nativeVertices && !edge.nativeLine));
    const snaps = placedBoxSnapPoints(occurrence, body, xyPlane());
    const ends = snaps.filter(snap => snap.kind === 'end'), middles = snaps.filter(snap => snap.kind === 'mid');
    assert.equal(ends.length, 4, JSON.stringify(body.mesh.edges));
    assert.equal(middles.length, 4);
    assert.equal(new Set(ends.map(snap => snap.vertexId)).size, 4);
    assert.ok(snaps.every(snap => snap.occurrenceId === occurrence.id && snap.bodyKey === 'b1'));
    const wantA = i === 0 ? [10.25, 14.25] : [55.75, 34.25];
    const wantB = i === 0 ? [30.25, 14.25] : [75.75, 34.25];
    const wantedMid = i === 0 ? [20.25, 14.25] : [65.75, 34.25];
    const hit = middles.find(snap => snap.at[0] === wantedMid[0] && snap.at[1] === wantedMid[1]);
    assert.ok(hit);
    assert.equal(hit.edgeName, 'n1.bottom|n1.side[e1]');
    const [native] = partSnapshot(placedDoc(occurrence)).outputs;
    assert.ok(checkBrep(native.brep, { strict: true }).valid);
    const named = native.brep.edges.filter(edge => edge.name === hit.edgeName);
    assert.equal(named.length, 1);
    assert.equal(named[0].curve.degree, 1);
    const endpoints = named[0].vertices.map(id => native.brep.vertices.find(vertex => vertex.id === id)!.point);
    assert.ok([wantA, wantB].every(wanted => endpoints.some(p => p[0] === wanted[0] && p[1] === wanted[1] && p[2] === 0)));
    assert.deepEqual(hit.at, wantedMid);
    assert.ok(ends.some(snap => snap.at[0] === wantA[0] && snap.at[1] === wantA[1]));
  }
  const left = evaluated(occurrences[0]);
  assert.deepEqual(placedBoxSnapPoints(occurrences[1], left, xyPlane()), [], 'same body key is insufficient for another placement');
});

test('placed endpoints retain raw fractions and only full edges on one cardinal plane are offered', () => {
  const occurrence = instance('fractional', [10.25003125, 14.2500375, 0]);
  const body = evaluated(occurrence);
  const base = placedBoxSnapPoints(occurrence, body, xyPlane());
  assert.ok(base.some(snap => snap.kind === 'end' && snap.at[0] === 10.25003125 && snap.at[1] === 14.2500375));
  assert.deepEqual(placedBoxSnapPoints(occurrence, body, xyPlane(0.0005)), base);
  assert.deepEqual(placedBoxSnapPoints(occurrence, body, xyPlane(0.0011)), []);
  assert.deepEqual(placedBoxSnapPoints(occurrence, body, xyPlane(3)), []);
  assert.deepEqual(placedBoxSnapPoints(occurrence, body, tiltPlane(xyPlane(), 10)), []);
  const top = placedBoxSnapPoints(occurrence, body, xyPlane(6));
  assert.equal(top.length, 8);
  assert.ok(top.every(snap => snap.edgeName.includes('n1.top')));
  assert.equal(placedBoxSnapPoints(occurrence, body, offsetPlane(standardPlane('xz'), -14.2500375)).length, 8);
  const elevated = instance('up', [10.25, 14.25, 0.01]);
  assert.deepEqual(placedBoxSnapPoints(elevated, evaluated(elevated), xyPlane()), []);
});

test('only exact visible edge packets supply candidates and a mismatched box is unavailable', () => {
  const occurrence = instance('left', [10.25, 14.25, 0]), source = evaluated(occurrence);
  const hit = placedBoxSnapPoints(occurrence, source, xyPlane()).find(snap => snap.kind === 'mid' && snap.at[0] === 20.25 && snap.at[1] === 14.25);
  assert.ok(hit);
  const hiddenEdge = structuredClone(source), { edgeLines, edgeOfSegment } = hiddenEdge.mesh;
  const start = Array.from(edgeOfSegment).findIndex((index, i) => i % 2 === 0 && index === hit.edgeIndex) * 3;
  assert.ok(start >= 0);
  hiddenEdge.mesh.edgeLines = Float64Array.from([...edgeLines.slice(0, start), ...edgeLines.slice(start + 6)]);
  hiddenEdge.mesh.edgeOfSegment = Float32Array.from([...edgeOfSegment.slice(0, start / 3), ...edgeOfSegment.slice(start / 3 + 2)]);
  const remaining = placedBoxSnapPoints(occurrence, hiddenEdge, xyPlane());
  assert.equal(remaining.filter(snap => snap.kind === 'mid').length, 3);
  assert.ok(remaining.every(snap => snap.edgeIndex !== hit.edgeIndex));

  const corruptions: Array<(body: BodyResult) => void> = [
    b => { b.key = 'b2'; }, b => { b.ref = { node: 0, side: 'solid' }; }, b => { b.family = 'faceted'; },
    b => { b.mesh.bounds.min[0] += 1; },
    b => { b.mesh.positions[0] += 1; },
    b => { b.mesh.edges[hit.edgeIndex].a[2] += 1e-8; },
    b => { delete b.mesh.edges[hit.edgeIndex].nativeVertices; },
    b => { b.mesh.edges[hit.edgeIndex].nativeVertices = ['n7_v0', 'n7_v1']; },
    b => { b.mesh.edges[hit.edgeIndex].names.push('another'); },
    b => { b.mesh.edgeLines.fill(0); },
    b => { b.mesh.edgeOfSegment[1] = 99; },
  ];
  for (const corrupt of corruptions) {
    const body = structuredClone(source);
    corrupt(body);
    assert.deepEqual(placedBoxSnapPoints(occurrence, body, xyPlane()), [], String(corrupt));
  }
});

test('source and body visibility, malformed placements and out-of-scope authored geometry fail closed', () => {
  const occurrence = instance('left', [10.25, 14.25, 0]), body = evaluated(occurrence);
  const hiddenDoc = { ...occurrence.doc, bodies: { b1: { hidden: true } } };
  const draft = structuredClone(occurrence);
  assert.equal(draft.doc.nodes[1].kind, 'extrude');
  draft.doc.nodes[1].draft = 2;
  const suppressed = structuredClone(occurrence);
  suppressed.doc.nodes[1].suppressed = true;
  const literal = structuredClone(occurrence);
  const sketch = literal.doc.nodes[0];
  assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle');
  sketch.max[0] = { parameter: 'width' };
  literal.doc.parameters.width = 20;
  const circle = { ...occurrence, doc: withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 }), { kind: 'extrude', sketch: 0, height: 6 }) };
  for (const other of [
    { ...occurrence, id: 'nested/left' }, { ...occurrence, hidden: true },
    { ...occurrence, looks: { b1: { hidden: true } } }, { ...occurrence, doc: hiddenDoc },
    { ...occurrence, rotation: [0, 0, 90] as PartInstance['rotation'] },
    { ...occurrence, position: [NaN, 0, 0] as PartInstance['position'] },
    { ...occurrence, pattern: { id: 'copy', k: 1 } }, draft, suppressed, literal, circle,
  ]) assert.deepEqual(placedBoxSnapPoints(other, body, xyPlane()), []);
  assert.equal(placedBoxSnapPoints({ ...occurrence, doc: hiddenDoc, looks: { b1: { hidden: false } } }, body, xyPlane()).length, 8);
});
