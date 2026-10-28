import test from 'node:test';
import assert from 'node:assert/strict';
import { prismaticFromProfile, brepFromPrismatic } from '../dist/index.js';
import { buildCylindricalWrapUVSource } from '../dist/features/cylindrical-wrap-source.js';
import { composeCylindricalWrapCurve } from '../dist/features/cylindrical-wrap-curve.js';
import { certifyCylindricalWrapChartPair } from '../dist/features/cylindrical-wrap-chart-pair.js';
import { isCylindricalWrapChartError } from '../dist/features/cylindrical-wrap-chart.js';

function line(id, a, b) {
  const poles = [];
  for (let i = 0; i < 4; i++) poles.push([a[0] + (b[0] - a[0]) * i / 3, a[1] + (b[1] - a[1]) * i / 3, a[2] + (b[2] - a[2]) * i / 3]);
  return { kind: 'curve', id, degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: poles, weights: [1, 1, 1, 1] };
}
function native() {
  const solid = prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, tag: 'post' });
  return buildCylindricalWrapUVSource({ solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) }, { id: 'wrap' }).quarter;
}
function composed(surface, start, end, id, endpoint = null) {
  return composeCylindricalWrapCurve(surface, { start, end }, { curveId: id, pcurveId: `${id}_uv`, endpoints: [endpoint, null] }).curve;
}
function receipt(result) {
  assert.equal(result.meaning.pairRelationCertified, true);
  for (const key of ['sourceCarrierCertified', 'loopEmbeddingCertified', 'topologyCertified', 'solidQualified', 'representedVolumeCertified', 'globalNativeEvaluatorErrorCertified', 'generalTextSupported']) assert.equal(result.meaning[key], false);
  assert.equal(result.original.length, 2); assert.equal(result.progress.length, 2);
  assert.ok(result.counts.totalOperations <= 200000);
  assert.equal(result.counts.curves, 2);
  assert.ok(Object.isFrozen(result.counts) && Object.isFrozen(result.counts.rational));
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.original) && Object.isFrozen(result.options));
}
function refused(action, codes = ['INPUT', 'SUPPORT', 'BUDGET', 'UNRESOLVED']) {
  assert.throws(action, error => isCylindricalWrapChartError(error) && codes.includes(error.code));
}

test('projected pair wrapper admits separated lines with bounded owned receipts and explicit false options', () => {
  const first = line('first', [10, 1, 2], [10, 4, 5]), second = line('second', [10, 5, 2], [10, 8, 5]), options = { kind: 'disjoint', maxDepth: 0, witnesses: false };
  const before = structuredClone({ first, second, options }), result = certifyCylindricalWrapChartPair(first, second, options); receipt(result);
  assert.equal(result.relation, 'disjoint'); assert.equal(result.options.maxDepth, 0); assert.equal(result.options.witnesses, false);
  assert.deepEqual({ first, second, options }, before);
  first.controlPoints[0][0] = 123; assert.equal(result.original[0].controlPoints[0][0], 10);
});

test('shared endpoint selection certifies only the common projected point, preserving canonical directions', () => {
  const first = line('first', [10, 1, 2], [10, 4, 5]), second = line('second', [10, 4, 5], [10, 7, 2]);
  const before = structuredClone({ first, second }), result = certifyCylindricalWrapChartPair(first, second, { kind: 'shared', endpoints: [1, 0], normalHint: [-1, 0] }); receipt(result);
  assert.equal(result.relation, 'shared-endpoint-only'); assert.deepEqual({ first, second }, before);
  refused(() => certifyCylindricalWrapChartPair(first, second, { kind: 'disjoint', maxDepth: 2 }), ['UNRESOLVED', 'BUDGET']);
  refused(() => certifyCylindricalWrapChartPair(first, second, { kind: 'shared', endpoints: [0, 0], normalHint: [-1, 0] }), ['INPUT', 'UNRESOLVED']);
});

test('original native quarter diagonal curves connect to projected separation and a shared-corner cone', () => {
  const surface = native(), before = structuredClone(surface);
  const first = composed(surface, [1 / 16, 1 / 4], [1 / 4, 5 / 8], 'diagonal_first');
  const separate = composed(surface, [5 / 16, 1 / 4], [3 / 8, 1 / 2], 'diagonal_separate');
  receipt(certifyCylindricalWrapChartPair(first, separate, { kind: 'disjoint', witnesses: true }));
  const adjacent = composed(surface, [1 / 4, 5 / 8], [3 / 8, 1 / 4], 'diagonal_adjacent', first.controlPoints[3]);
  receipt(certifyCylindricalWrapChartPair(first, adjacent, { kind: 'shared', endpoints: [1, 0], normalHint: [-1, 0] }));
  assert.deepEqual(surface, before);
  const crossing = composed(surface, [1 / 16, 5 / 8], [1 / 4, 1 / 4], 'diagonal_crossing');
  refused(() => certifyCylindricalWrapChartPair(first, crossing, { kind: 'disjoint', maxDepth: 3 }), ['UNRESOLVED', 'BUDGET']);
});

test('pair options, budgets, source getters and duplicate identifiers have typed refusal boundaries', () => {
  const first = line('first', [10, 1, 2], [10, 4, 5]), second = line('second', [10, 5, 2], [10, 8, 5]), before = structuredClone({ first, second });
  for (const options of [{ kind: 'unknown' }, { kind: 'shared' }, { kind: 'shared', endpoints: [2, 0] }, { kind: 'shared', endpoints: [1, 0], normalHint: [0, 0] }, { kind: 'disjoint', maxDepth: 9 }, { kind: 'disjoint', maxPairs: 513 }, { kind: 'disjoint', maxOperations: 200001 }, { kind: 'disjoint', witnesses: 0 }, { kind: 'disjoint', hidden: true }]) refused(() => certifyCylindricalWrapChartPair(first, second, options), ['INPUT']);
  refused(() => certifyCylindricalWrapChartPair(first, second, { kind: 'disjoint', maxOperations: 1 }), ['BUDGET']);
  refused(() => certifyCylindricalWrapChartPair(first, { ...second, id: first.id }, { kind: 'disjoint' }), ['INPUT']);
  let called = false;
  const getter = { ...first }; Object.defineProperty(getter, 'controlPoints', { enumerable: true, get() { called = true; return first.controlPoints; } });
  refused(() => certifyCylindricalWrapChartPair(getter, second, { kind: 'disjoint' }), ['INPUT']);
  assert.equal(called, false); assert.deepEqual({ first, second }, before);
});
