import test from 'node:test';
import assert from 'node:assert/strict';
import { prismaticFromProfile, brepFromPrismatic } from '../dist/index.js';
import { buildCylindricalWrapUVSource } from '../dist/features/cylindrical-wrap-source.js';
import { composeCylindricalWrapCurve } from '../dist/features/cylindrical-wrap-curve.js';
import { certifyCylindricalWrapChartComponent } from '../dist/features/cylindrical-wrap-chart-component.js';
import { isCylindricalWrapChartError } from '../dist/features/cylindrical-wrap-chart.js';

function line(id, a, b, weights = [1, 1, 1, 1]) {
  const controlPoints = [];
  for (let i = 0; i < 4; i++) controlPoints.push([8, a[0] + (b[0] - a[0]) * i / 3, a[1] + (b[1] - a[1]) * i / 3]);
  return { kind: 'curve', id, degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints, weights: [...weights] };
}
function ring(prefix, points, hint, flip = false, weighted = false) {
  const curves = [], uses = [];
  for (let i = 0; i < points.length; i++) {
    const curve = line(`${prefix}_${i}`, points[i], points[(i + 1) % points.length], weighted ? [0.5, 0.75, 1, 0.625] : [1, 1, 1, 1]);
    const reversed = flip && i % 2 === 1;
    if (reversed) { curve.controlPoints.reverse(); curve.weights.reverse(); }
    curves.push(curve); uses.push({ curve: curve.id, sense: reversed ? 'reversed' : 'forward' });
  }
  return { curves, ring: { uses, interiorHint: [8, ...hint] } };
}
function rectangle(prefix, x0, z0, x1, z1, clockwise = false, flip = false, weighted = false) {
  const points = clockwise ? [[x0, z0], [x0, z1], [x1, z1], [x1, z0]] : [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  return ring(prefix, points, [(x0 + x1) / 2, (z0 + z1) / 2], flip, weighted);
}
function component(outer, ...holes) {
  const curves = [...outer.curves]; for (const hole of holes) curves.push(...hole.curves);
  return { curves, outer: outer.ring, holes: holes.map(hole => hole.ring) };
}
function refused(action, codes = ['INPUT', 'SUPPORT', 'BUDGET', 'UNRESOLVED']) {
  assert.throws(action, error => isCylindricalWrapChartError(error) && codes.includes(error.code));
}
function receipt(result, n, rings) {
  assert.deepEqual(result.cover, { curves: n, rings, adjacent: n, disjoint: n * (n - 1) / 2 - n, totalPairs: n * (n - 1) / 2, complete: true });
  assert.equal(result.pairs.length, n * (n - 1) / 2); assert.equal(result.counts.curves, n);
  assert.equal(result.limits.curves, 32); assert.equal(result.limits.operations, 200000);
  assert.ok(result.counts.totalOperations <= 200000);
  assert.equal(result.meaning.projectedLoopEmbeddingCertified, true); assert.equal(result.meaning.projectedComponentContainmentCertified, true);
  for (const key of ['sourceCarrierCertified', 'originalNativeUVBindingCertified', 'topologyCertified', 'solidQualified', 'representedVolumeCertified', 'globalNativeEvaluatorErrorCertified', 'generalTextSupported', 'combinedConstructionBudgetCertified']) assert.equal(result.meaning[key], false);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.original.curves[0].controlPoints[0]) && Object.isFrozen(result.counts.rational));
}

test('complete projected outer and clockwise hole use one ledger and preserve owned canonical data', () => {
  const input = component(rectangle('outer', 1, -3, 7, 5, false, true, true), rectangle('hole', 2, -1, 3, 2, true, true, true));
  const before = structuredClone(input), result = certifyCylindricalWrapChartComponent(input); receipt(result, 8, 2);
  assert.deepEqual(input, before); assert.deepEqual(result.original, before);
  assert.deepEqual(result.winding.map(query => query.certificate.winding), [1, -1, 1]);
  assert.equal(result.meaning.representativeRule, 'one-owned-vertex-after-complete-boundary-separation');
  input.curves[0].controlPoints[0][0] = 99; assert.equal(result.original.curves[0].controlPoints[0][0], 8);
});

test('two sibling holes have mutual zero winding after every cross-ring pair is separated', () => {
  const input = component(rectangle('outer', 1, 0, 7, 8), rectangle('hole_a', 2, 2, 3, 4, true), rectangle('hole_b', 5, 2, 6, 4, true));
  const result = certifyCylindricalWrapChartComponent(input); receipt(result, 12, 3);
  assert.deepEqual(result.winding.map(query => query.certificate.winding), [1, -1, -1, 1, 1, 0, 0]);
});

test('outer hint is an individual-ring witness and may lie in a hole without claiming material placement', () => {
  const input = component(rectangle('outer', 1, 0, 7, 6), rectangle('hole', 3, 2, 5, 4, true));
  const result = certifyCylindricalWrapChartComponent(input); receipt(result, 8, 2);
  assert.equal(result.meaning.hintMeaning, 'individual-ring-interior-and-orientation-only');
});

test('wrong orientation, outside holes and nested holes in either input order cannot certify roles', () => {
  refused(() => certifyCylindricalWrapChartComponent(component(rectangle('outer', 1, 0, 7, 8, true))), ['UNRESOLVED']);
  refused(() => certifyCylindricalWrapChartComponent(component(rectangle('outer', 1, 0, 7, 8), rectangle('hole', 2, 2, 3, 4))), ['UNRESOLVED']);
  refused(() => certifyCylindricalWrapChartComponent(component(rectangle('outer', 1, 0, 4, 8), rectangle('outside', 5, 2, 6, 4, true))), ['UNRESOLVED']);
  const outer = rectangle('outer', 1, 0, 7, 8), big = rectangle('big', 2, 1, 6, 7, true), small = rectangle('small', 3, 2, 5, 4, true);
  refused(() => certifyCylindricalWrapChartComponent(component(outer, big, small)), ['UNRESOLVED']);
  refused(() => certifyCylindricalWrapChartComponent(component(outer, small, big)), ['UNRESOLVED']);
});

test('touching/crossing boundaries and a bow tie never yield a partial component certificate', () => {
  const outer = rectangle('outer', 1, 0, 7, 8);
  refused(() => certifyCylindricalWrapChartComponent(component(outer, rectangle('touch', 1, 2, 3, 4, true))));
  refused(() => certifyCylindricalWrapChartComponent(component(outer, rectangle('cross', 6, 2, 8, 4, true))));
  refused(() => certifyCylindricalWrapChartComponent(component(ring('bow', [[1, 0], [7, 8], [1, 8], [7, 0]], [2, 2]))));
});

test('cycle closure, unique complete ownership and minimum ring length are exact input boundaries', () => {
  const input = component(rectangle('outer', 1, 0, 7, 8)), before = structuredClone(input);
  const broken = structuredClone(input); broken.curves[3].controlPoints[3][2] = 1; refused(() => certifyCylindricalWrapChartComponent(broken), ['INPUT']);
  const signed = structuredClone(input); signed.curves[0].controlPoints[0][2] = -0; refused(() => certifyCylindricalWrapChartComponent(signed), ['INPUT']);
  const repeated = structuredClone(input); repeated.outer.uses[1].curve = repeated.outer.uses[0].curve; refused(() => certifyCylindricalWrapChartComponent(repeated), ['INPUT']);
  const duplicate = structuredClone(input); duplicate.curves[1].id = duplicate.curves[0].id; refused(() => certifyCylindricalWrapChartComponent(duplicate), ['INPUT']);
  const unused = structuredClone(input); unused.curves.push(line('unused', [2, 2], [3, 3])); refused(() => certifyCylindricalWrapChartComponent(unused), ['INPUT']);
  const foreign = structuredClone(input); foreign.outer.uses[0].curve = 'unknown'; refused(() => certifyCylindricalWrapChartComponent(foreign), ['INPUT']);
  const wrongSense = structuredClone(input); wrongSense.outer.uses[1].sense = 'reversed'; refused(() => certifyCylindricalWrapChartComponent(wrongSense), ['INPUT']);
  const lens = structuredClone(input); lens.outer.uses.length = 2; refused(() => certifyCylindricalWrapChartComponent(lens), ['SUPPORT']);
  assert.deepEqual(input, before);
});

test('boundary and exterior hints, unknown options, getters and late tightened budget are atomic refusals', () => {
  const input = component(rectangle('outer', 1, 0, 7, 8)), before = structuredClone(input);
  for (const hint of [[8, 7, 8], [8, 7, 4], [8, 4, 0], [8, 8, 4]]) {
    const changed = structuredClone(input); changed.outer.interiorHint = hint; refused(() => certifyCylindricalWrapChartComponent(changed), ['UNRESOLVED']);
  }
  refused(() => certifyCylindricalWrapChartComponent(input, { maxOperations: 1 }), ['BUDGET']);
  refused(() => certifyCylindricalWrapChartComponent(input, { maxOperations: 200001 }), ['INPUT']);
  refused(() => certifyCylindricalWrapChartComponent(input, { maxDepth: 9 }), ['INPUT']);
  refused(() => certifyCylindricalWrapChartComponent(input, { maxCurves: 33 }), ['INPUT']);
  const result = certifyCylindricalWrapChartComponent(input);
  refused(() => certifyCylindricalWrapChartComponent(input, { maxOperations: result.counts.totalOperations - 1 }), ['BUDGET']);
  let called = false; const getter = { ...input }; Object.defineProperty(getter, 'outer', { enumerable: true, get() { called = true; return input.outer; } });
  refused(() => certifyCylindricalWrapChartComponent(getter), ['INPUT']); assert.equal(called, false); assert.deepEqual(input, before);
});

test('native original quarter diagonal triangle connects without asserting native trim or physical solid binding', () => {
  const solid = prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, tag: 'post' });
  const surface = buildCylindricalWrapUVSource({ solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) }, { id: 'wrap' }).quarter;
  const vertices = [[1 / 16, 1 / 4], [5 / 16, 1 / 4], [3 / 16, 5 / 8]], curves = [], uses = [];
  for (let i = 0; i < 3; i++) {
    const id = `native_${i}`, previous = i ? curves[i - 1].controlPoints[3] : null, last = i === 2 ? curves[0].controlPoints[0] : null;
    const curve = composeCylindricalWrapCurve(surface, { start: vertices[i], end: vertices[(i + 1) % 3] }, { curveId: id, pcurveId: `${id}_uv`, endpoints: [previous, last] }).curve;
    curves.push(curve); uses.push({ curve: id, sense: 'forward' });
  }
  const input = { curves, outer: { uses, interiorHint: [8, 4, 10] }, holes: [] }, before = structuredClone(input);
  const result = certifyCylindricalWrapChartComponent(input); receipt(result, 3, 1); assert.deepEqual(input, before);
});
