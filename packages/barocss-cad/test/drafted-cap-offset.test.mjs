import test from 'node:test';
import assert from 'node:assert/strict';
import { draftedExtrusion, evaluateCadPart, checkBrep, faceGeometry } from '../dist/index.js';
import { brepMassProperties } from '../dist/brep/solid-mass.js';
import { draftedCapOffsetAnchor, offsetDraftedCap } from '../dist/features/drafted-cap-offset.js';

const rect = (width, depth) => [[0, 0], [width, 0], [width, depth], [0, depth]].map(start => ({ kind: 'line', start }));
const slope = Math.tan(Math.PI / 18);
const close = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);

function stock(kind) {
  if (kind === 'all walls') return draftedExtrusion({ profile: rect(40, 30), z0: 0, z1: 10, draft: 10, tag: 'box' });
  return evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
    { id: 'box', kind: 'extrude', sketch: 's', height: 10 },
    { id: 'd', kind: 'draft', target: 'box', faces: ['box.side1', 'box.side2'], angle: 10 },
  ] }).outputs[0].brep;
}

function faceOf(brep, name) { return brep.faces.find(face => face.name === name); }

for (const [kind, sides] of [['all walls', 2], ['adjacent walls', 1]]) {
  test(`offset of the ${kind} drafted +Z cap continues the four source supports`, () => {
    const source = stock(kind), before = structuredClone(source);
    const anchor = draftedCapOffsetAnchor(source, 'box.top');
    assert.ok(anchor);
    close(anchor[0], sides === 2 ? 20 : 20 - 5 * slope);
    close(anchor[1], sides === 2 ? 15 : 15 - 5 * slope);
    close(anchor[2], 10);
    assert.equal(draftedCapOffsetAnchor(source, 'box.bottom'), undefined);
    assert.equal(offsetDraftedCap(source, 'box.top', 0), source);
    for (const distance of [3, -2]) {
      const out = offsetDraftedCap(source, 'box.top', distance), h = 10 + distance, t = sides * slope;
      const expected = 40 * 30 * h - 70 * t * h ** 2 / 2 + t ** 2 * h ** 3 / 3;
      const report = checkBrep(out, { strict: true });
      assert.equal(report.valid, true, report.issues.join('\n'));
      assert.deepEqual(report.counts, { bodies: 1, shells: 1, faces: 6, loops: 6, coedges: 24, edges: 12, vertices: 8 });
      assert.equal(report.topology[0].genus, 0);
      assert.deepEqual(out.bodies, source.bodies);
      assert.deepEqual(out.shells, source.shells);
      assert.deepEqual(out.loops, source.loops);
      assert.equal(faceOf(out, 'box.bottom'), faceOf(source, 'box.bottom'));
      assert.deepEqual(out.vertices.filter(v => v.point[2] === 0), source.vertices.filter(v => v.point[2] === 0));
      assert.deepEqual(out.edges.map(({ id, name, tolerance }) => ({ id, name, tolerance })),
        source.edges.map(({ id, name, tolerance }) => ({ id, name, tolerance })));
      assert.deepEqual(out.vertices.map(v => v.tolerance), source.vertices.map(v => v.tolerance));
      const mass = brepMassProperties(out, 1);
      assert.equal(mass.method, 'planar-exact');
      close(mass.volume, expected, 1e-7);
      const [minX, minY] = sides === 2 ? [h * slope, h * slope] : [0, 0];
      for (const x of [minX, 40 - h * slope]) for (const y of [minY, 30 - h * slope]) {
        assert.ok(out.vertices.some(({ point }) => Math.hypot(point[0] - x, point[1] - y, point[2] - h) < 1e-9));
      }
      for (const face of out.faces.filter(f => f.name?.includes('.side'))) {
        const plane = faceGeometry(faceOf(source, face.name)), candidate = faceGeometry(face);
        assert.equal(candidate.kind, 'plane');
        close(Math.hypot(...plane.n.map((n, i) => n - candidate.n[i])), 0);
        for (const p of face.surface.controlPoints.flat()) close(p.reduce((sum, value, i) => sum + (value - plane.o[i]) * plane.n[i], 0), 0);
      }
    }
    assert.deepEqual(source, before);
  });
}

test('drafted cap offset refuses unsupported input, collapse, vanishing distance and coordinate overflow', () => {
  const source = stock('all walls');
  assert.throws(() => offsetDraftedCap(source, 'missing', 3), /missing or ambiguous/);
  assert.throws(() => offsetDraftedCap(source, 'box.bottom', 3), /pick the \+Z cap/);
  assert.throws(() => offsetDraftedCap(source, 'box.top', NaN), /distance must be finite/);
  assert.throws(() => offsetDraftedCap(source, 'box.top', Number.EPSILON), /too small/);
  for (const distance of [-10, -11, 30 / (2 * slope) - 10, 100]) {
    assert.throws(() => offsetDraftedCap(source, 'box.top', distance), /close a wall or cross the opposite cap/);
  }
  const atEdge = draftedExtrusion({ profile: rect(40, 30), z0: 9980, z1: 9990, draft: 10, tag: 'box' });
  assert.ok(offsetDraftedCap(atEdge, 'box.top', 10).vertices.some(v => v.point[2] === 10000));
  assert.throws(() => offsetDraftedCap(atEdge, 'box.top', 10.1), /modeling coordinate range/);
  const boundaryProfile = rect(40, 30).map(s => ({ ...s, start: [s.start[0] + 9960, s.start[1]] }));
  const paddedBase = draftedExtrusion({ profile: boundaryProfile, z0: 0, z1: 10, draft: 10, tag: 'box' });
  assert.equal(Math.max(...paddedBase.vertices.map(v => v.point[0])), 10000);
  assert.throws(() => offsetDraftedCap(paddedBase, 'box.top', 1), /modeling coordinate range/);
  const vertical = draftedExtrusion({ profile: rect(40, 30), z0: 0, z1: 10, draft: 0, tag: 'box' });
  assert.equal(draftedCapOffsetAnchor(vertical, 'box.top'), undefined);
  assert.throws(() => offsetDraftedCap(vertical, 'box.top', 3), /tapered planar walls/);
});

test('a translated rectangular cap stays eligible through two offsets', () => {
  const profile = rect(40, 30).map(s => ({ ...s, start: [s.start[0] - 3.125, s.start[1] + 2.75] }));
  const source = draftedExtrusion({ profile, z0: -4.5, z1: 5.5, draft: 10, tag: 'box' });
  const first = offsetDraftedCap(source, 'box.top', 2.25);
  const anchor = draftedCapOffsetAnchor(first, 'box.top');
  assert.ok(anchor);
  for (const [i, value] of [16.875, 17.75, 7.75].entries()) close(anchor[i], value);
  const second = offsetDraftedCap(first, 'box.top', -1);
  const direct = offsetDraftedCap(source, 'box.top', 1.25);
  assert.equal(checkBrep(second, { strict: true }).valid, true);
  for (let i = 0; i < direct.vertices.length; i++) close(Math.hypot(...direct.vertices[i].point.map((x, k) => x - second.vertices[i].point[k])), 0);
  close(brepMassProperties(second, 1).volume, brepMassProperties(direct, 1).volume, 1e-7);
});

test('an inward offset close to the opposite cap keeps authenticated wall planes for later extension', () => {
  const profile = rect(40, 30).map(s => ({ ...s, start: [s.start[0] + 9000, s.start[1] + 9000] }));
  const source = draftedExtrusion({ profile, z0: 0, z1: 10, draft: 10, tag: 'box' });
  const thin = offsetDraftedCap(source, 'box.top', -10 + 2e-7);
  assert.equal(checkBrep(thin, { strict: true }).valid, true);
  for (const wall of source.faces.filter(face => face.name.includes('.side'))) assert.equal(faceOf(thin, wall.name), wall);
  const extended = offsetDraftedCap(thin, 'box.top', 1);
  const direct = offsetDraftedCap(source, 'box.top', -9 + 2e-7);
  for (const [i, vertex] of direct.vertices.entries())
    close(Math.hypot(...vertex.point.map((x, k) => x - extended.vertices[i].point[k])), 0, 1e-10);
  assert.deepEqual(extended.faces, direct.faces);
});

test('the native offset-face feature returns one exact output under its own id and retains the source names', () => {
  const features = [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
    { id: 'box', kind: 'extrude', sketch: 's', height: 10, draft: 10 },
  ];
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features };
  const [parent] = evaluateCadPart(doc).outputs;
  const next = { ...doc, features: [...features, { id: 'change', kind: 'offset-face', target: 'box', face: 'box.top', distance: 3 }] };
  const snapshot = evaluateCadPart(next);
  assert.deepEqual(snapshot.outputs.map(({ id, feature }) => [id, feature]), [['change', 'change']]);
  assert.deepEqual(snapshot.outputs[0].brep, offsetDraftedCap(parent.brep, 'box.top', 3));
  assert.equal(checkBrep(snapshot.outputs[0].brep, { strict: true }).valid, true);
});

test('drafted cap offset refuses a nearby side surface that no longer supports its trim', () => {
  const source = structuredClone(stock('all walls'));
  const side = faceOf(source, 'box.side1');
  side.surface.controlPoints.forEach(row => row.forEach(point => { point[0] += 5e-8; }));
  assert.equal(checkBrep(source, { strict: true }).valid, true, 'general B-rep tolerance admits the mismatch');
  assert.equal(draftedCapOffsetAnchor(source, 'box.top'), undefined);
  assert.throws(() => offsetDraftedCap(source, 'box.top', 3), /tapered planar walls/);
});
