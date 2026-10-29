import test from 'node:test';
import assert from 'node:assert/strict';
import { part, fillFeaturePatternSpec, BarocssError } from '../dist/api/index.js';
import { evaluateCadPart, massPropertiesOf, checkBrep, saveCadPart, loadCadPart, reevaluate, CadPartError } from '../dist/index.js';
import { fillCutSnapshot, fillCutPlacements } from '../dist/features/fill-cut-pattern.js';
import { region, cells, material } from './helpers/fill-cut-holes-oracle.mjs';
import { stepStored } from './helpers/prismatic-mass-oracle.mjs';

const options = (mask = region) => ({ region: mask, anchor: [8, 8], spacing: 12, count: 4, spacing2: 10, count2: 3 });
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
function freeze(v) { if (v && typeof v === 'object') { for (const value of Object.values(v)) freeze(value); Object.freeze(v); } return v; }
function seed() {
  return { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { sy: 10 }, features: [
    { id: 'baseSketch', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] }, { id: 'base', kind: 'extrude', sketch: 'baseSketch', height: 10 },
    { id: 'toolSketch', kind: 'sketch', profile: 'rectangle', min: [0, 6], max: [3, 11] }, { id: 'tool', kind: 'extrude', sketch: 'toolSketch', height: 10 },
    { id: 'seedPosition', kind: 'translate', target: 'tool', offset: [7, 0, 0] }, { id: 'seed', kind: 'difference', target: 'base', tool: 'seedPosition' },
  ] };
}
function document(mask = region, extra = {}) { const doc = seed(); doc.features.push({ id: 'repeat', kind: 'fill-feature-pattern', target: 'seed', ...options(mask), spacing2: { parameter: 'sy' }, ...extra }); return doc; }
function geometry(snapshot, accepted, sy) {
  const [out] = snapshot.outputs; assert.equal(snapshot.outputs.length, 1); const expected = material(accepted, sy), mass = massPropertiesOf(out, 1);
  assert.equal(out.bodyCount, 1); assert.equal(checkBrep(out.brep, { strict: true }).valid, true); assert.ok(out.brep.shells.every(s => s.closed));
  assert.ok(Math.abs(mass.volume - expected.volume) <= 1e-7); mass.centroid.forEach((v, k) => assert.ok(Math.abs(v - expected.centroid[k]) <= 1e-7));
  const names = out.brep.faces.map(f => f.name).sort(); assert.equal(new Set(names).size, names.length);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
    const exists = accepted.some(([a, b]) => a === i && b === j), suffix = i || j ? `@${i},${j}` : '';
    if (exists) {
      for (let side = 0; side < 4; side++) assert.ok(names.includes(`tool.side${side}${suffix}`), `missing side ${side}${suffix}`);
      for (const x of [7 + i * 12, 10 + i * 12]) for (const y of [6 + j * sy, 11 + j * sy]) for (const z of [0, 10]) assert.ok(out.brep.vertices.some(v => v.point[0] === x && v.point[1] === y && v.point[2] === z), `missing cut corner ${x},${y},${z}`);
    } else assert.ok(!names.some(n => n.endsWith(suffix)), `masked suffix ${suffix}`);
  }
  return names;
}

test('fill cut holes: independent seven-to-nine placement/mass/corner/name oracle and native editable file', () => {
  assert.deepEqual(cells(10), [[0, 0], [1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2]]);
  assert.equal(material(cells(10), 10).volume, 22950); assert.deepEqual(material(cells(10), 10).centroid, [545 / 18, 6161 / 306, 5]);
  const input = document(), before = structuredClone(input), snapshot = evaluateCadPart(input), names = geometry(snapshot, cells(10), 10);
  const edited = reevaluate(snapshot, { parameters: { sy: 12 } }); assert.equal(material(cells(12), 12).volume, 22650); geometry(edited, cells(12), 12);
  for (const output of [snapshot, edited]) { const back = loadCadPart(saveCadPart(output)); assert.deepEqual(back.document, output.document); geometry(back, cells(back.document.parameters.sy), back.document.parameters.sy); }
  assert.deepEqual(geometry(evaluateCadPart(document({ points: [...region.points].reverse(), holes: [...region.holes].reverse().map(r => [...r].reverse()) })), cells(10), 10), names);
  assert.deepEqual(input, before);
});

test('fill cut holes: public facade and snapshot own every nested coordinate without changing no-hole shape', () => {
  const supplied = structuredClone(options()), before = structuredClone(supplied); freeze(supplied);
  const spec = fillFeaturePatternSpec(supplied); assert.deepEqual(spec.region, before.region); assert.notEqual(spec.region.holes[0], supplied.region.holes[0]);
  const mutable = structuredClone(options()), accepted = part('hole mask', seed()).fillFeaturePattern(mutable), old = accepted.doc;
  mutable.region.holes[0][0][0] = 999; mutable.region.points[0][0] = 999; assert.deepEqual(accepted.doc, old); geometry(evaluateCadPart(old), cells(10), 10);
  const noHole = fillFeaturePatternSpec(options({ points: region.points })); assert.deepEqual(noHole.region, { points: region.points }); assert.ok(!Object.hasOwn(noHole.region, 'holes'));
});

test('fill cut holes: hole boundary excludes, outer boundary includes, and exact anchor-plus-offset is not rounded', () => {
  const mask = { points: [[0, -1], [2, -1], [2, 1], [0, 1]], holes: [[[.5, -.5], [1, -.5], [1, .5], [.5, .5]]] };
  const own = fillCutSnapshot(mask, [0, 0], fail);
  assert.deepEqual(fillCutPlacements(own.region, [0, 0], 1, 2, 1, 1), []);
  assert.deepEqual(fillCutPlacements(own.region, [0, 0], stepStored(1, -1), 2, 1, 1), []);
  assert.deepEqual(fillCutPlacements(own.region, [0, 0], stepStored(1, 1), 2, 1, 1).map(p => p.suffix), ['@1,0']);
  assert.deepEqual(fillCutPlacements(own.region, [0, 0], 2, 2, 1, 1).map(p => p.suffix), ['@1,0']);
  assert.equal(1 + Number.MIN_VALUE, 1);
  assert.deepEqual(fillCutPlacements(own.region, [1, 0], Number.MIN_VALUE, 2, 1, 1).map(p => p.suffix), ['@1,0']);
});

test('fill cut holes: original seed is unconditional and admitted tools are not clipped to hole boundaries', () => {
  const seedHole = [[6, 6], [10, 6], [10, 10], [6, 10]], masked = { points: region.points, holes: [...region.holes, seedHole] };
  geometry(evaluateCadPart(document(masked)), cells(10), 10);
  const crossing = { points: region.points, holes: [[[19.25, 6], [19.75, 6], [19.75, 10], [19.25, 10]]] };
  const all = cells(10, { points: region.points }); assert.equal(all.length, 12);
  geometry(evaluateCadPart(document(crossing)), all, 10);
});

test('fill cut holes: disjoint collinear extensions and four holes at the shared sixteen-vertex bound qualify', () => {
  const points = [[0, 0], [20, 0], [20, 20], [0, 20]], extensions = [[[10, 10], [12, 10], [10, 8]], [[13, 10], [11, 12], [13, 12]]];
  assert.deepEqual(fillCutSnapshot({ points, holes: extensions }, [0, 0], fail).region.holes, extensions);
  const holes = [[[2, 2], [4, 2], [2, 4]], [[12, 2], [14, 2], [12, 4]], [[2, 12], [4, 12], [2, 14]], [[12, 12], [14, 12], [12, 14]]];
  assert.equal(fillCutSnapshot({ points, holes }, [0, 0], fail).region.holes.length, 4);
  assert.throws(() => fillCutSnapshot({ points, holes: [...holes, [[8, 8], [10, 8], [8, 10]]] }, [0, 0], fail), e => e.code === 'INPUT');
  const dense = [[0, 0], [4, 0], [8, 0], [12, 0], [16, 0], [16, 4], [16, 8], [16, 12], [16, 16], [12, 16], [8, 16], [4, 16], [0, 16], [0, 12], [0, 8], [0, 4]];
  assert.equal(fillCutSnapshot({ points: dense }, [0, 0], fail).region.points.length, 16);
  assert.throws(() => fillCutSnapshot({ points: dense, holes: [holes[0]] }, [0, 0], fail), e => e.code === 'INPUT');
});

test('fill cut holes: native finite binary64 loops have no hidden small-edge tolerance', () => {
  const m = Number.MIN_VALUE, hole = [[m, m], [2 * m, m], [m, 2 * m]], points = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const own = fillCutSnapshot({ points, holes: [hole] }, [0, m], fail);
  assert.deepEqual(fillCutPlacements(own.region, own.anchor, m, 2, 1, 1), []);
  assert.deepEqual(fillCutPlacements({ points }, own.anchor, m, 2, 1, 1).map(p => p.suffix), ['@1,0']);
});

test('fill cut holes: invalid containment, crossing, touching, nesting and malformed loops refuse atomically', () => {
  const rectangle = [[10, 10], [20, 10], [20, 20], [10, 20]], outer = region.points;
  const bad = [[], undefined, [[[54, 8], [58, 8], [58, 12], [54, 12]]], [[[4, 8], [8, 8], [8, 12], [4, 12]]], [[[4, 8], [8, 9], [8, 7]]], [[[2, 8], [8, 8], [8, 12], [2, 12]]], [rectangle, [[15, 15], [25, 15], [25, 25], [15, 25]]], [rectangle, [[20, 10], [25, 10], [25, 20], [20, 20]]], [rectangle, rectangle], [rectangle, [[12, 12], [18, 12], [18, 18], [12, 18]]], [[[8, 8], [12, 12], [8, 12], [12, 8]]], [[[8, 8], [12, 8], [10, 8], [10, 12]]], [[[8, 8], [10, 8], [8, 8]]], [[[8, 8], [10, 8], [NaN, 10]]]];
  for (const holes of bad) {
    const raw = { points: outer, holes }, before = structuredClone(raw);
    assert.throws(() => fillCutSnapshot(raw, [8, 8], fail), e => e.code === 'INPUT'); assert.deepEqual(raw, before);
    assert.throws(() => fillFeaturePatternSpec(options(raw)), e => e instanceof BarocssError && e.code === 'VALUE');
  }
  assert.throws(() => fillCutSnapshot({ points: outer, holes: [[[8, 8], [10001, 8], [8, 10]]] }, [8, 8], fail), e => e.code === 'PARAMETER');
});

test('fill cut holes: numeric snapshots reject sparse arrays, accessors and unknown own fields without invoking getters', () => {
  let called = 0; const variants = [];
  const field = { points: region.points }; Object.defineProperty(field, 'holes', { get() { called++; return region.holes; } }); variants.push(field);
  const array = [region.holes[0]]; Object.defineProperty(array, '0', { get() { called++; return region.holes[0]; } }); variants.push({ points: region.points, holes: array });
  const ring = [...region.holes[0]]; Object.defineProperty(ring, '0', { get() { called++; return [20, 16]; } }); variants.push({ points: region.points, holes: [ring] });
  const point = [20, 16]; Object.defineProperty(point, '0', { get() { called++; return 20; } }); variants.push({ points: region.points, holes: [[point, [34, 16], [34, 30], [20, 30]]] });
  variants.push({ points: region.points, holes: new Array(1) }); const extra = [region.holes[0]]; extra.extra = 1; variants.push({ points: region.points, holes: extra });
  const symbol = { ...region, [Symbol('extra')]: 1 }; variants.push(symbol); variants.push({ ...region, live: 'object' });
  for (const raw of variants) assert.throws(() => fillCutSnapshot(raw, [8, 8], fail), e => e.code === 'INPUT');
  assert.equal(called, 0);
});

test('fill cut holes: no extras and count one retain original but still validate the active CUT source', () => {
  const original = evaluateCadPart(seed()), names = original.outputs[0].brep.faces.map(f => f.name).sort();
  for (const extra of [{ count: 1, count2: 1 }, { anchor: [1000, 1000] }]) {
    const doc = document(region, extra), out = evaluateCadPart(doc).outputs[0]; assert.equal(massPropertiesOf(out, 1).volume, massPropertiesOf(original.outputs[0], 1).volume); assert.ok(Math.abs(massPropertiesOf(out, 1).volume - 23850) <= 1e-7); assert.deepEqual(out.brep.faces.map(f => f.name).sort(), names);
    const wrong = document(region, { ...extra, target: 'base' }); assert.throws(() => evaluateCadPart(wrong), e => e instanceof CadPartError && e.code === 'REFERENCE');
    const suppressed = document(region, extra); suppressed.features.find(f => f.id === 'seed').suppressed = true; assert.throws(() => evaluateCadPart(suppressed), e => e instanceof CadPartError && e.code === 'REFERENCE');
    const malformed = document({ points: region.points, holes: [] }, extra); assert.throws(() => evaluateCadPart(malformed), e => e instanceof CadPartError && e.code === 'INPUT');
  }
});
