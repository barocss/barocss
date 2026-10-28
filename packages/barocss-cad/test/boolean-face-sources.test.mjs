import test from 'node:test';
import assert from 'node:assert/strict';
import * as cad from '../dist/index.js';
import { booleanAnalyticTraced, stitchFreezing } from '../dist/brep/analytic-boolean.js';

const documentOf = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const output = (features, id) => cad.outputOf(cad.evaluateCadPart(documentOf(features)), id).brep;
// Both operands deliberately reuse their authored ids. Provenance must distinguish operand 0/1, not just a face id.
const box = (x, width = 2) => output([
  { id: 's', kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + width, 2] },
  { id: 'b', kind: 'extrude', sketch: 's', height: 2 },
], 'b');
const cylinder = (from, height) => output([
  { id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 2 },
  { id: 'b', kind: 'extrude', sketch: 's', from, height },
], 'b');

function receiptFor(a, b, operation, id) {
  const beforeA = structuredClone(a), beforeB = structuredClone(b);
  const ordinary = cad.booleanAnalytic(a, b, operation, { id });
  const traced = booleanAnalyticTraced(a, b, operation, { id });
  // Compare complete numeric geometry, topology, names and JSON, not source text or a checksum pin.
  assert.deepEqual(traced.brep, ordinary);
  assert.deepEqual(a, beforeA); assert.deepEqual(b, beforeB);
  assert.equal(traced.complete, true);
  assert.equal(traced.faceSources.size, traced.brep.faces.length);
  const inputIds = [new Set(a.faces.map(face => face.id)), new Set(b.faces.map(face => face.id))];
  for (const face of traced.brep.faces) {
    const set = traced.faceSources.get(face.id);
    assert.ok(set, face.id); assert.equal(set.complete, true); assert.ok(set.sources.length > 0);
    const seen = new Set();
    for (const source of set.sources) {
      assert.ok(source.operand === 0 || source.operand === 1);
      assert.ok(inputIds[source.operand].has(source.faceId), JSON.stringify(source));
      const key = JSON.stringify([source.operand, source.faceId]);
      assert.ok(!seen.has(key), `duplicate ${key}`); seen.add(key);
    }
  }
  assert.equal(cad.checkBrep(traced.brep, { strict: true }).valid, true);
  assert.ok(!Object.hasOwn(traced.brep, 'faceSources'));
  assert.equal(JSON.stringify(traced.brep), JSON.stringify(ordinary));
  return traced;
}

test('internal Boolean face sources distinguish A/B when coplanar inputs share ids and names', () => {
  const a = box(0), b = box(2), trace = receiptFor(a, b, 'union', 'u');
  assert.equal('booleanAnalyticTraced' in cad, false, 'the package entrypoint remains unchanged');
  const topA = a.faces.find(face => face.name === 'b.top'), topB = b.faces.find(face => face.name === 'b.top');
  assert.ok(topA && topB); assert.equal(topA.id, topB.id);
  const top = trace.brep.faces.find(face => face.name === 'b.top');
  assert.ok(top);
  const sources = trace.faceSources.get(top.id).sources;
  assert.ok(sources.some(source => source.operand === 0 && source.faceId === topA.id));
  assert.ok(sources.some(source => source.operand === 1 && source.faceId === topB.id));
});

test('internal Boolean face sources retain split target faces and reversed tool faces in a difference', () => {
  const a = box(0, 3), b = box(2, 2), trace = receiptFor(a, b, 'difference', 'd');
  assert.equal(trace.brep.bodies.length, 1);
  const sources = [...trace.faceSources.values()].flatMap(set => set.sources);
  assert.ok(sources.some(source => source.operand === 0));
  assert.ok(sources.some(source => source.operand === 1));
  // The tool's left wall x=2 closes the cut; the target's old right wall x=3 is wholly removed.
  const leftTool = b.faces.find(face => face.name === 'b.side3'), rightTarget = a.faces.find(face => face.name === 'b.side1');
  assert.ok(leftTool && rightTarget);
  assert.ok(sources.some(source => source.operand === 1 && source.faceId === leftTool.id));
  assert.ok(!sources.some(source => source.operand === 0 && source.faceId === rightTarget.id));
});

test('internal Boolean face sources cross whole-turn cylinder seam splitting and merging', () => {
  const a = cylinder(0, 2), b = cylinder(2, 2), trace = receiptFor(a, b, 'union', 'c');
  const walls = trace.brep.faces.filter(face => cad.faceGeometry(face).kind === 'cylinder');
  assert.ok(walls.length >= 2);
  for (const wall of walls) {
    const sources = trace.faceSources.get(wall.id).sources;
    assert.ok(sources.some(source => source.operand === 0));
    assert.ok(sources.some(source => source.operand === 1));
  }
});

test('internal Boolean face sources keep complete receipts under each frozen-stitch setting', () => {
  const a = box(0), b = box(10), was = stitchFreezing.on;
  // Vary the setting without claiming that a failed frozen attempt actually retried.
  try {
    for (const frozen of [true, false]) {
      stitchFreezing.on = frozen;
      const trace = receiptFor(a, b, 'union', 'apart');
      assert.equal(trace.brep.bodies.length, 2);
      for (const set of trace.faceSources.values()) assert.equal(set.sources.length, 1);
      assert.equal(trace.brep.faces.length, a.faces.length + b.faces.length);
    }
  } finally { stitchFreezing.on = was; }
});

test('internal Boolean face sources map both outer and cavity shell ids to the correct operand and face', () => {
  const a = output([
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [6, 6] },
    { id: 'b', kind: 'extrude', sketch: 's', height: 6 },
  ], 'b');
  const b = output([
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [2, 2], max: [4, 4] },
    { id: 'b', kind: 'extrude', sketch: 's', from: 2, height: 2 },
  ], 'b');
  const trace = receiptFor(a, b, 'difference', 'cavity');
  assert.equal(trace.brep.bodies.length, 1);
  const [outer, inner] = trace.brep.bodies[0].shells;
  assert.equal(trace.brep.bodies[0].shells.length, 2);
  assert.equal(trace.brep.shells.find(shell => shell.id === outer).faces.length, 6);
  assert.equal(trace.brep.shells.find(shell => shell.id === inner).faces.length, 6);
  for (const face of trace.brep.faces) {
    const operand = face.shell === outer ? 0 : 1, source = operand === 0 ? a : b;
    assert.ok(face.shell === outer || face.shell === inner);
    const geometry = cad.faceGeometry(face), matches = [];
    assert.equal(geometry.kind, 'plane');
    // The cavity's faces lie on the tool's original planes with their outward sense reversed.
    for (const input of source.faces) {
      const own = cad.faceGeometry(input);
      if (own.kind !== 'plane') continue;
      const alignment = own.n[0] * geometry.n[0] + own.n[1] * geometry.n[1] + own.n[2] * geometry.n[2];
      const distance = own.n[0] * (geometry.o[0] - own.o[0]) + own.n[1] * (geometry.o[1] - own.o[1]) + own.n[2] * (geometry.o[2] - own.o[2]);
      if (Math.abs(alignment - (operand === 0 ? 1 : -1)) <= 1e-12 && Math.abs(distance) <= 1e-9) matches.push(input);
    }
    assert.equal(matches.length, 1, face.id);
    assert.deepEqual(trace.faceSources.get(face.id).sources, [{ operand, faceId: matches[0].id }]);
  }
});

test('internal Boolean face sources are empty and complete for an empty intersection', () => {
  const trace = receiptFor(box(0), box(10), 'intersection', 'empty');
  assert.equal(trace.brep.faces.length, 0); assert.equal(trace.faceSources.size, 0);
});

test('internal Boolean face sources describe the accepted result of the existing tangent-lump fixture', () => {
  // D205's two tangent lumps, both rotated 30 degrees about X. No new geometric acceptance is introduced.
  // This checks the returned result; it does not count or guarantee a retry or rejudgement branch.
  const features = [
    { id: 'bs', kind: 'sketch', profile: 'rectangle', min: [-8, 0], max: [0, 3] },
    { id: 'b0', kind: 'extrude', sketch: 'bs', height: 8, from: -2 },
    { id: 'b', kind: 'rotate', target: 'b0', axis: 'x', angle: 30, pivot: [0, 0, 0] },
    { id: 'cs', kind: 'sketch', profile: 'circle', center: [-2, -2], radius: 2 },
    { id: 'c0', kind: 'extrude', sketch: 'cs', height: 4, from: 1 },
    { id: 'c', kind: 'rotate', target: 'c0', axis: 'x', angle: 30, pivot: [0, 0, 0] },
  ];
  const snapshot = cad.evaluateCadPart(documentOf(features));
  const a = cad.outputOf(snapshot, 'b').brep, b = cad.outputOf(snapshot, 'c').brep;
  const trace = receiptFor(a, b, 'union', 'touch');
  assert.equal(trace.brep.bodies.length, 2);
});
