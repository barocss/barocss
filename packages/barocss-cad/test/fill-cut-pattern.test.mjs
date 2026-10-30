// Independent arithmetic oracle: stock minus disjoint 3 x 5 x 10 prisms in an L-shaped mask.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, BarocssError, fillFeaturePatternSpec } from '../dist/api/index.js';
import { evaluateCadPart, reevaluate, saveCadPart, loadCadPart, massPropertiesOf, checkBrep, CadPartError } from '../dist/index.js';
import { fillCutSnapshot, fillCutPlacements } from '../dist/features/fill-cut-pattern.js';

const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const region = (notch = 28) => ({ points: [[4, 4], [52, 4], [52, 20], [notch, 20], [notch, 36], [4, 36]] });
const options = (extra = {}) => ({ region: region(), anchor: [8.5, 8.5], spacing: 12, count: 4, spacing2: 10, count2: 3, ...extra });
function seedDocument() {
  return {
    format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { seedX: 7, width: 3, spacing: 12, spacing2: 10, copies: 4 },
    features: [
      { id: 'baseSketch', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] },
      { id: 'base', kind: 'extrude', sketch: 'baseSketch', height: 10 },
      { id: 'toolSketch', kind: 'sketch', profile: 'rectangle', min: [0, 6], max: [{ parameter: 'width' }, 11] },
      { id: 'tool', kind: 'extrude', sketch: 'toolSketch', height: 10 },
      { id: 'seedPosition', kind: 'translate', target: 'tool', offset: [{ parameter: 'seedX' }, 0, 0] },
      { id: 'seed', kind: 'difference', target: 'base', tool: 'seedPosition' },
    ],
  };
}
const pattern = (extra = {}) => ({ id: 'repeat', kind: 'fill-feature-pattern', target: 'seed', ...options(), spacing: { parameter: 'spacing' }, spacing2: { parameter: 'spacing2' }, ...extra });
const document = (extra) => { const doc = seedDocument(); doc.features.push(pattern(extra)); return doc; };
const names = out => out.brep.faces.map(f => f.name).filter(Boolean).sort();
const baseCells = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2]];
const spacedCells = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [0, 2], [1, 2]];
const coreRefused = (doc, code, message) => assert.throws(() => evaluateCadPart(doc), e => e instanceof CadPartError && e.code === code && (!message || message.test(e.message)));
const facadeRefused = (run, code) => assert.throws(run, e => e instanceof BarocssError && e.code === code);
function geometry(snapshot, { cells = baseCells, spacing = 12, spacing2 = 10, seedX = 7, width = 3, volume = 22500, centroid = [4559 / 150, 607 / 30, 5] } = {}) {
  assert.equal(snapshot.outputs.length, 1);
  const out = snapshot.outputs[0], report = checkBrep(out.brep, { strict: true }), mass = massPropertiesOf(out);
  assert.equal(out.bodyCount, 1); assert.equal(out.brep.bodies[0].kind, 'solid');
  assert.ok(out.brep.shells.every(shell => shell.closed));
  assert.equal(report.valid, true, report.issues.join('\n'));
  close(mass.volume, volume); if (centroid) mass.centroid.forEach((v, k) => close(v, centroid[k]));
  for (let axis = 0; axis < 3; axis++) { close(Math.min(...out.brep.vertices.map(v => v.point[axis])), 0); close(Math.max(...out.brep.vertices.map(v => v.point[axis])), [60, 40, 10][axis]); }
  const allNames = names(out);
  for (const [i, j] of cells) {
    for (const x of [seedX + i * spacing, seedX + width + i * spacing]) for (const y of [6 + j * spacing2, 11 + j * spacing2]) for (const z of [0, 10]) {
      assert.ok(out.brep.vertices.some(v => v.point.every((c, axis) => Math.abs(c - [x, y, z][axis]) <= 1e-9)), `missing cut corner ${[x, y, z]}`);
    }
    const suffix = i === 0 && j === 0 ? '' : `@${i},${j}`;
    for (let side = 0; side < 4; side++) assert.ok(allNames.includes(`tool.side${side}${suffix}`), `missing tool.side${side}${suffix}`);
  }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) if (!cells.some(([x, y]) => x === i && y === j)) assert.ok(!allNames.some(name => name.endsWith(`@${i},${j}`)), `masked cell ${i},${j} exists`);
  assert.equal(new Set(allNames).size, allNames.length);
  return out;
}

test('fill cut: facade owns the region snapshot, retains complete history and binds both spacings', () => {
  const input = seedDocument(), before = structuredClone(input), source = part('fill cuts', input), sourceBefore = source.doc;
  const supplied = options({ spacing: param('spacing'), spacing2: param('spacing2') }), suppliedBefore = structuredClone(supplied);
  const accepted = source.fillFeaturePattern(supplied), feature = accepted.doc.features.at(-1);
  assert.deepEqual(feature, { ...pattern(), id: feature.id });
  assert.deepEqual(accepted.doc.features.slice(0, -1), input.features);
  assert.deepEqual(input, before); assert.deepEqual(source.doc, sourceBefore); assert.deepEqual(supplied, suppliedBefore);
  supplied.region.points[0][0] = 999; supplied.anchor[0] = 999;
  assert.deepEqual(accepted.doc.features.at(-1).region, region()); assert.deepEqual(accepted.doc.features.at(-1).anchor, [8.5, 8.5]);
  const specInput = options(), spec = fillFeaturePatternSpec(specInput); specInput.region.points[0][0] = 100;
  assert.deepEqual(spec.region, region()); assert.equal(spec.command, 'fill-feature-pattern');
  geometry(evaluateCadPart(accepted.doc)); close(accepted.mass({ density: 1 }).volume, 22500);
});

test('fill cut: independent mass, corners and names survive both windings and native save/read', () => {
  const input = document(), before = structuredClone(input), result = evaluateCadPart(input), expectedNames = names(geometry(result));
  const reversed = document({ region: { points: region().points.reverse() } }); assert.deepEqual(names(geometry(evaluateCadPart(reversed))), expectedNames);
  const reopened = loadCadPart(saveCadPart(result)); assert.deepEqual(reopened.document, result.document); assert.deepEqual(names(geometry(reopened)), expectedNames);
  assert.deepEqual(input, before);
  // @2,1's reference is inside, while its cutter reaches y=21 outside the L's y=20 arm.
  assert.ok(expectedNames.includes('tool.side0@2,1')); assert.ok(!expectedNames.some(name => name.endsWith('@2,2') || name.endsWith('@3,2')));
});

test('fill cut: spacing and region edits use original grid indices and independent centroids', () => {
  const result = evaluateCadPart(document()), before = structuredClone(result.document);
  const spaced = reevaluate(result, { parameters: { spacing2: 12 } });
  geometry(spaced, { cells: spacedCells, spacing2: 12, volume: 22800, centroid: [61 / 2, 765 / 38, 5] });
  const notch = evaluateCadPart(document({ region: region(16) })); geometry(notch, { cells: baseCells.slice(0, 9), volume: 22650, centroid: [9159 / 302, 6127 / 302, 5] });
  for (const edited of [spaced, notch]) assert.deepEqual(names(loadCadPart(saveCadPart(edited)).outputs[0]), names(edited.outputs[0]));
  assert.deepEqual(result.document, before); geometry(reevaluate(result, { parameters: {} }));
});

test('fill cut: source position and size recompute geometry without changing the authored mask anchor', () => {
  const result = evaluateCadPart(document()), originalNames = names(geometry(result));
  for (const [parameters, expected] of [[{ seedX: 9 }, { seedX: 9, centroid: null }], [{ width: 4 }, { width: 4, volume: 22000, centroid: null }]]) {
    const edited = reevaluate(result, { parameters }); assert.deepEqual(names(geometry(edited, expected)), originalNames);
    assert.deepEqual(edited.document.features.at(-1).anchor, [8.5, 8.5]);
  }
});

test('fill cut: original CUT remains when its reference is outside, and empty/no-extra/one-cell are seed identities', () => {
  const seed = evaluateCadPart(seedDocument()).outputs[0];
  for (const extra of [{ count: 1, count2: 1, anchor: [-100, -100] }, { region: { points: [[-4, -4], [-3, -4], [-3, -3], [-4, -3]] } }]) {
    const out = geometry(evaluateCadPart(document(extra)), { cells: [[0, 0]], volume: 23850, centroid: [9583 / 318, 6383 / 318, 5] }); assert.deepEqual(names(out), names(seed));
  }
  const outsideAnchor = document({ anchor: [-3.5, 8.5], count: 2, count2: 1 });
  geometry(evaluateCadPart(outsideAnchor), { cells: [[0, 0], [1, 0]], volume: 23700, centroid: null });
  const empty = document(); empty.features.splice(5, 0, { id: 'emptyTool', kind: 'difference', target: 'seedPosition', tool: 'seedPosition' }); empty.features.find(f => f.id === 'seed').tool = 'emptyTool';
  const out = evaluateCadPart(empty).outputs[0]; close(massPropertiesOf(out).volume, 24000); assert.ok(!names(out).some(name => name.includes('@')));
});

test('fill cut: exact boundary, adjacent binary64 values and rational reference sums have no rounding mask', () => {
  const fail = (code, message) => { throw new Error(`${code}: ${message}`); };
  const square = { points: [[0, 0], [1, 0], [1, 1], [0, 1]] };
  const snapshot = fillCutSnapshot(square, [0, 0.5], fail);
  const placements = (anchor, spacing) => fillCutPlacements(snapshot.region, anchor, spacing, 2, 1, 1);
  assert.equal(placements([0, 0.5], 1).length, 1);
  assert.equal(placements([0, 0.5], 1 - 2 ** -53).length, 1);
  assert.equal(placements([0, 0.5], 1 + 2 ** -52).length, 0);
  assert.equal(placements([0.5, 0.5], 0.5).length, 1);
  assert.equal(1 + 2 ** -53, 1); assert.equal(placements([1, 0.5], 2 ** -53).length, 0);
  const right = fillCutSnapshot({ points: [[1, 0], [2, 0], [2, 1], [1, 1]] }, [1, 0.5], fail);
  assert.equal(1 - 2 ** -54, 1); assert.equal(fillCutPlacements(right.region, right.anchor, -(2 ** -54), 2, 1, 1).length, 0);
  assert.deepEqual(fillCutPlacements(region(), [8.5, 8.5], 12, 4, 10, 3).map(p => p.suffix), baseCells.slice(1).map(([i, j]) => `@${i},${j}`));
});

test('fill cut: finite candidate bound precedes masking and tiny spacing never enumerates an automatic grid', () => {
  const far = { points: [[-4, -4], [-3, -4], [-3, -3], [-4, -3]] };
  const max = document({ count: 8, count2: 8, region: far, spacing: Number.MIN_VALUE, spacing2: Number.MIN_VALUE }); close(massPropertiesOf(evaluateCadPart(max).outputs[0]).volume, 23850);
  for (const extra of [{ count: 9, count2: 8 }, { count: 65 }, { count2: 65 }, { count: Number.MAX_SAFE_INTEGER }]) coreRefused(document({ region: null, ...extra }), 'INPUT', /count|candidate/);
  const signed = document({ anchor: [44.5, 28.5], spacing: -12, spacing2: -10 }); assert.ok(evaluateCadPart(signed).outputs.length === 1);
  const unboundedOffset = document({ spacing: 10000, count: 3, count2: 1, region: far }); close(massPropertiesOf(evaluateCadPart(unboundedOffset).outputs[0]).volume, 23850);
});

test('fill cut: malformed regions, holes, repeated vertices, backtracks and non-simple loops refuse atomically', () => {
  const badRegions = [null, [], { points: [] }, { points: [[0, 0], [1, 0]] }, { points: [[0, 0], [1, 0], [0, 1]], holes: [] }, { points: [[0, 0], [1, 0], [0, 1]], objectId: 's1' }, { points: [[0, 0], [1, 0], [0, 1]], curves: [] }, { points: [[0, 0], [1, 0], [0, 0]] }, { points: [[0, 0], [1, 1], [0, 1], [1, 0]] }, { points: [[0, 0], [2, 0], [1, 0], [1, 1]] }, { points: [[0, 0], [1, 0], [2, 0]] }, { points: [[0, 0], [3, 0], [3, 3], [1, 0], [0, 3]] }, { points: Array.from({ length: 17 }, (_, k) => [k, k % 2]) }, { points: [[0, 0, 0], [1, 0], [0, 1]] }, { points: [[0, 0], [NaN, 0], [0, 1]] }];
  for (const raw of badRegions) {
    const doc = document({ region: raw, count: 1, count2: 1 }), before = structuredClone(doc); coreRefused(doc, 'INPUT'); assert.deepEqual(doc, before);
    facadeRefused(() => fillFeaturePatternSpec(options({ region: raw })), 'VALUE');
  }
  coreRefused(document({ region: { points: [[0, 0], [10001, 0], [0, 1]] } }), 'PARAMETER');
  for (const anchor of [[], [0], [0, 1, 2], [NaN, 0], [{ parameter: 'seedX' }, 0]]) coreRefused(document({ anchor }), 'INPUT');
  coreRefused(document({ anchor: [0, 10001] }), 'PARAMETER');
});

test('fill cut: typed dimension/count failures and count binding refusal preserve the accepted part', () => {
  const source = part('source', seedDocument()), before = source.doc;
  for (const extra of [...[0, -1, NaN, Infinity, 10001].flatMap(spacing => [{ spacing }, { spacing2: spacing }]), ...[0, -1, 1.5, NaN, Infinity, 65, Number.MAX_SAFE_INTEGER + 1].flatMap(count => [{ count }, { count2: count }]), { count: 9, count2: 8 }]) facadeRefused(() => source.fillFeaturePattern(options(extra)), 'VALUE');
  for (const key of ['count', 'count2']) facadeRefused(() => source.fillFeaturePattern(options({ [key]: param('copies') })), 'PARAMETER_UNBINDABLE');
  for (const extra of [...[0, NaN, Infinity, 10001].flatMap(spacing => [{ spacing }, { spacing2: spacing }])]) coreRefused(document(extra), 'PARAMETER');
  for (const extra of [...[0, -1, 1.5, NaN, Infinity, 65, Number.MAX_SAFE_INTEGER + 1].flatMap(count => [{ count }, { count2: count }]), { count: 9, count2: 8 }]) coreRefused(document(extra), 'INPUT');
  facadeRefused(() => source.fillFeaturePattern(options({ spacing: param('spacing'), spacing2: param('spacing2') })).withParameters({ spacing2: 0 }), 'PARAMETER');
  assert.deepEqual(source.doc, before);
});

test('fill cut: source admission still runs for one-cell and zero-additional-placement recipes', () => {
  for (const extra of [{ count: 1, count2: 1 }, { region: { points: [[-4, -4], [-3, -4], [-3, -3], [-4, -3]] } }]) {
    for (const target of ['base', 'seedPosition', 'toolSketch', 'missing', 'repeat', 'seed/1']) { const doc = document({ ...extra, target }), before = structuredClone(doc); coreRefused(doc, 'REFERENCE'); assert.deepEqual(doc, before); }
    const suppressed = document(extra); suppressed.features.find(f => f.id === 'seed').suppressed = true; coreRefused(suppressed, 'REFERENCE', /unsuppressed difference/);
    const stale = seedDocument(); stale.features.push({ id: 'moved', kind: 'translate', target: 'seed', offset: [0, 0, 1] }, pattern(extra)); coreRefused(stale, 'REFERENCE', /must still be active/);
    const split = seedDocument(); Object.assign(split.features.find(f => f.id === 'toolSketch'), { min: [28, -1], max: [32, 41] }); split.parameters.seedX = 0; split.features.push(pattern(extra)); coreRefused(split, 'REFERENCE', /one nonempty solid/);
  }
});
