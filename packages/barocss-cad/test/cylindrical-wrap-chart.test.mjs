import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartContext, prepareChartCurve, splitChartNode, chartBox, chartCompareRatios, isCylindricalWrapChartError } from '../dist/features/cylindrical-wrap-chart.js';

function curve() {
  return { kind: 'curve', id: 'edge', degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: [[4, 1, -2], [4, 2, -1], [4, 4, 1], [4, 8, 3]], weights: [1, 0.5, 0.75, 1] };
}
function fraction(n, d = 1n) { return { n, d }; }
function add(a, b) { return fraction(a.n * b.d + b.n * a.d, a.d * b.d); }
function sub(a, b) { return fraction(a.n * b.d - b.n * a.d, a.d * b.d); }
function mul(a, b) { return fraction(a.n * b.n, a.d * b.d); }
function div(a, b) { return fraction(a.n * b.d, a.d * b.n); }
function compare(a, b) { const l = a.n * b.d, r = b.n * a.d; return l < r ? -1 : l > r ? 1 : 0; }
function equal(a, b) { assert.equal(compare(a, b), 0); }
function dyadic(value) {
  if (value === 0) return fraction(0n);
  const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, value);
  const bits = bytes.getBigUint64(0), exponent = Number(bits >> 52n & 2047n), significand = (exponent ? 1n << 52n : 0n) + (bits & 0xfffffffffffffn), power = (exponent || 1) - 1075;
  const signed = bits >> 63n ? -significand : significand;
  return power >= 0 ? fraction(signed << BigInt(power)) : fraction(signed, 1n << BigInt(-power));
}
function homogeneous(source) {
  const out = [];
  for (let i = 0; i < 4; i++) { const weight = dyadic(source.weights[i]), p = source.controlPoints[i]; out.push([mul(dyadic(p[0]), weight), mul(dyadic(p[1]), weight), mul(dyadic(p[2]), weight), weight]); }
  return out;
}
function evaluate(values, t) {
  let row = values; const other = sub(fraction(1n), t);
  while (row.length > 1) { const next = []; for (let i = 0; i + 1 < row.length; i++) next.push(add(mul(other, row[i]), mul(t, row[i + 1]))); row = next; }
  return row[0];
}
function axis(rows, index) { const out = []; for (const row of rows) out.push(row[index]); return out; }
function derivative(values) { const out = [], degree = fraction(BigInt(values.length - 1)); for (let i = 0; i + 1 < values.length; i++) out.push(mul(degree, sub(values[i + 1], values[i]))); return out; }
function projectedDerivative(rows, a, b, t) {
  const x = axis(rows, a), y = axis(rows, b);
  return sub(mul(evaluate(x, t), evaluate(derivative(y), t)), mul(evaluate(y, t), evaluate(derivative(x), t)));
}
function projected(rows, t) { return [div(evaluate(axis(rows, 1), t), evaluate(axis(rows, 0), t)), div(evaluate(axis(rows, 2), t), evaluate(axis(rows, 3), t))]; }
function nodeRows(node) { const rows = []; for (const point of node.controls) { const row = []; for (const value of point) row.push(fraction(value)); rows.push(row); } return rows; }
function refuse(action, code) { assert.throws(action, error => isCylindricalWrapChartError(error) && (!code || error.code === code)); }
function halfOracle(rows) {
  const triangle = [rows], left = [rows[0]], right = [rows[3]], half = fraction(1n, 2n);
  for (let level = 1; level <= 3; level++) {
    const old = triangle.at(-1), next = [];
    for (let i = 0; i + 1 < old.length; i++) { const point = []; for (let k = 0; k < 4; k++) point.push(mul(add(old[i][k], old[i + 1][k]), half)); next.push(point); }
    triangle.push(next); left.push(next[0]); right.push(next.at(-1));
  }
  return [left, right.reverse()];
}

test('stored cubic homogeneous integers preserve every exact cp*weight and own a frozen snapshot', () => {
  const source = curve(), before = structuredClone(source), ctx = new ChartContext(), prepared = prepareChartCurve(source, ctx), oracle = homogeneous(source);
  assert.deepEqual(source, before); assert.deepEqual(prepared.source, before); assert.notEqual(prepared.source, source);
  assert.ok(prepared.denominator > 0n && (prepared.denominator & (prepared.denominator - 1n)) === 0n);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) equal(fraction(prepared.root.controls[i][k], prepared.denominator), oracle[i][k]);
  assert.ok(Object.isFrozen(prepared) && Object.isFrozen(prepared.root) && Object.isFrozen(prepared.root.controls[0]) && Object.isFrozen(prepared.source.controlPoints[0]));
  assert.throws(() => { prepared.root.controls[0][0] = 1n; }, TypeError);
  assert.throws(() => { prepared.source.controlPoints[0][0] = 1; }, TypeError);
  source.controlPoints[0][0] = 123; assert.deepEqual(prepared.source, before);
  assert.equal(ctx.counts().curves, 1); assert.equal(ctx.counts().nodes, 1);
});

test('strict degree-five progress has independent rational derivative values and preserves its sign scale', () => {
  const source = curve(), ctx = new ChartContext(), prepared = prepareChartCurve(source, ctx), rows = homogeneous(source);
  assert.equal(prepared.progress.coordinate, 'slope'); assert.equal(prepared.progress.sign, 1); assert.ok(prepared.progress.minimum > 0n);
  const coefficients = []; for (const value of prepared.progress.coefficients) coefficients.push(fraction(value, 10n * prepared.denominator ** 2n));
  for (const t of [fraction(0n), fraction(1n, 4n), fraction(1n, 2n), fraction(1n)]) equal(evaluate(coefficients, t), projectedDerivative(rows, 0, 1, t));
  const reversed = curve(); reversed.controlPoints.reverse(); reversed.weights.reverse();
  const backward = prepareChartCurve(reversed, ctx); assert.equal(backward.progress.sign, -1); assert.ok(backward.progress.minimum > 0n);
  assert.equal(ctx.counts().curves, 2); assert.ok(ctx.counts().totalOperations <= 200000);
});

test('axial progress is an independent fallback and mixed-sign or zero progress remains unresolved', () => {
  const vertical = curve(); vertical.controlPoints = [[2, 3, -4], [2, 3, -2], [2, 3, 1], [2, 3, 5]]; vertical.weights = [1, 1, 1, 1];
  const ctx = new ChartContext(), prepared = prepareChartCurve(vertical, ctx), rows = homogeneous(vertical);
  assert.equal(prepared.progress.coordinate, 'height'); assert.equal(prepared.progress.sign, 1);
  const coefficients = []; for (const value of prepared.progress.coefficients) coefficients.push(fraction(value, 10n * prepared.denominator ** 2n));
  for (const t of [fraction(0n), fraction(1n, 2n), fraction(1n)]) equal(evaluate(coefficients, t), projectedDerivative(rows, 3, 2, t));
  const loop = curve(); loop.controlPoints = [[2, 1, 0], [2, 3, 0], [2, 3, 0], [2, 1, 0]];
  refuse(() => prepareChartCurve(loop, new ChartContext()), 'UNRESOLVED');
  const stalled = curve(); stalled.controlPoints = [[2, 1, 0], [2, 1, 0], [2, 2, 0], [2, 3, 0]]; stalled.weights = [1, 1, 1, 1];
  refuse(() => prepareChartCurve(stalled, new ChartContext()), 'UNRESOLVED');
});

test('half subdivision uses a uniform8 scale and matches independent rational de Casteljau controls', () => {
  const source = curve(), ctx = new ChartContext(), prepared = prepareChartCurve(source, ctx), children = splitChartNode(prepared.root, ctx), oracle = halfOracle(homogeneous(source));
  for (let side = 0; side < 2; side++) {
    assert.equal(children[side].depth, 1); assert.equal(children[side].index, side); assert.equal(children[side].curve, prepared.root.curve);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) equal(fraction(children[side].controls[i][k], 8n * prepared.denominator), oracle[side][i][k]);
  }
  assert.deepEqual(children[0].controls[3], children[1].controls[0]);
  const quarter = splitChartNode(children[0], ctx)[1]; assert.equal(quarter.depth, 2); assert.equal(quarter.index, 1);
  for (const t of [fraction(0n), fraction(1n, 3n), fraction(1n)]) {
    const global = add(fraction(1n, 4n), mul(fraction(1n, 4n), t)), actual = projected(nodeRows(quarter), t), expected = projected(homogeneous(source), global);
    equal(actual[0], expected[0]); equal(actual[1], expected[1]);
  }
  const count = ctx.counts(); assert.equal(splitChartNode(prepared.root, ctx), children); assert.equal(ctx.counts().nodes, count.nodes); assert.equal(ctx.counts().directOperations, count.directOperations);
});

test('exact ratio hulls retain negative Z and bound projected descendants without Number division', () => {
  const ctx = new ChartContext(), prepared = prepareChartCurve(curve(), ctx), box = chartBox(prepared.root, ctx);
  equal(box.slope[0], fraction(1n, 4n)); equal(box.slope[1], fraction(2n)); equal(box.height[0], fraction(-2n)); equal(box.height[1], fraction(3n));
  assert.equal(chartCompareRatios(fraction(-1n, 2n), fraction(-2n, 3n), ctx), 1);
  const children = splitChartNode(prepared.root, ctx);
  for (const child of children) {
    const bounded = chartBox(child, ctx);
    assert.ok(compare(bounded.slope[0], box.slope[0]) >= 0 && compare(bounded.slope[1], box.slope[1]) <= 0);
    assert.ok(compare(bounded.height[0], box.height[0]) >= 0 && compare(bounded.height[1], box.height[1]) <= 0);
    for (const t of [fraction(0n), fraction(1n, 4n), fraction(1n, 2n), fraction(1n)]) {
      const p = projected(nodeRows(child), t);
      assert.ok(compare(p[0], bounded.slope[0]) >= 0 && compare(p[0], bounded.slope[1]) <= 0);
      assert.ok(compare(p[1], bounded.height[0]) >= 0 && compare(p[1], bounded.height[1]) <= 0);
    }
  }
  const count = ctx.counts(); assert.equal(chartBox(prepared.root, ctx), box); assert.equal(ctx.counts().directOperations, count.directOperations);
  refuse(() => chartCompareRatios(fraction(1n, 0n), fraction(1n), ctx), 'INPUT');
});

test('context ownership rejects copied or foreign graphs and source admission rejects unsupported data atomically', () => {
  const source = curve(), before = structuredClone(source), ctx = new ChartContext(), prepared = prepareChartCurve(source, ctx), foreign = new ChartContext();
  refuse(() => foreign.requireCurve(prepared), 'INPUT'); refuse(() => chartBox(prepared.root, foreign), 'INPUT');
  refuse(() => ctx.requireCurve({ ...prepared }), 'INPUT'); refuse(() => splitChartNode({ ...prepared.root }, ctx), 'INPUT');
  for (const mutate of [input => { input.controlPoints[0][0] = 0; }, input => { input.controlPoints[0][1] = -1; }, input => { input.controlPoints[0][2] = 10001; }, input => { input.weights[0] = 0.49; }, input => { input.knots = [2, 2, 2, 2, 3, 3, 3, 3]; }]) {
    const invalid = curve(); mutate(invalid); const old = structuredClone(invalid);
    refuse(() => prepareChartCurve(invalid, new ChartContext()), 'SUPPORT'); assert.deepEqual(invalid, old);
  }
  assert.deepEqual(source, before);
});

test('plain own source/options refuse getters, foreign arrays and malformed fields without invoking accessors', () => {
  const getter = curve(); let called = 0; Object.defineProperty(getter, 'degree', { enumerable: true, get() { called++; return 3; } });
  refuse(() => prepareChartCurve(getter, new ChartContext()), 'INPUT'); assert.equal(called, 0);
  const optionGetter = {}; Object.defineProperty(optionGetter, 'maxDepth', { enumerable: true, get() { called++; return 1; } });
  refuse(() => new ChartContext(optionGetter), 'INPUT'); assert.equal(called, 0);
  const typed = curve(); typed.weights = new Float64Array(typed.weights); refuse(() => prepareChartCurve(typed, new ChartContext()), 'INPUT');
  const sparse = curve(); delete sparse.controlPoints[1]; refuse(() => prepareChartCurve(sparse, new ChartContext()), 'INPUT');
  const extra = { ...curve(), extra: true }; refuse(() => prepareChartCurve(extra, new ChartContext()), 'INPUT');
  refuse(() => prepareChartCurve(Object.assign(Object.create({ foreign: true }), curve()), new ChartContext()), 'INPUT');
  for (const options of [{ maxOperations: 0 }, { maxOperations: 200001 }, { maxOperations: 2.5 }, { maxDepth: 9 }, { maxDepth: -1 }, { maxDepth: NaN }, { extra: true }]) refuse(() => new ChartContext(options), 'INPUT');
});

test('one ledger bounds rational plus direct work and separates depth uncertainty from global exhaustion', () => {
  const baseline = new ChartContext(); prepareChartCurve(curve(), baseline); const maximum = baseline.counts().totalOperations;
  const tight = new ChartContext({ maxOperations: maximum }); prepareChartCurve(curve(), tight); assert.equal(tight.counts().totalOperations, maximum);
  refuse(() => tight.add(1n, 2n), 'BUDGET');
  refuse(() => tight.requireCurve({}), 'INPUT'); refuse(() => tight.requireNode({}), 'INPUT');
  refuse(() => prepareChartCurve(curve(), new ChartContext({ maxOperations: 1 })), 'BUDGET');
  const depth = new ChartContext({ maxDepth: 0 }), root = prepareChartCurve(curve(), depth).root; refuse(() => splitChartNode(root, depth), 'UNRESOLVED');
  const two = new ChartContext(); prepareChartCurve(curve(), two); prepareChartCurve(curve(), two); refuse(() => prepareChartCurve(curve(), two), 'BUDGET');
  const bits = new ChartContext(); refuse(() => bits.integer(1n << 8192n), 'BUDGET');
  const work = new ChartContext(); refuse(() => work.charge(1048577), 'BUDGET');
  const division = new ChartContext(); refuse(() => division.div(1n, 2n), 'UNRESOLVED'); assert.equal(division.div(6n, 3n), 2n);
});

test('the shared node cap refuses before another child pair and preserves all admitted immutable nodes', () => {
  const ctx = new ChartContext(), root = prepareChartCurve(curve(), ctx).root;
  let row = [root];
  for (let depth = 0; depth < 7; depth++) { const next = []; for (const node of row) next.push(...splitChartNode(node, ctx)); row = next; }
  assert.equal(ctx.counts().nodes, 255); assert.equal(row[0].depth, 7);
  const before = structuredClone(row[0].controls); refuse(() => splitChartNode(row[0], ctx), 'BUDGET');
  assert.deepEqual(row[0].controls, before); assert.equal(ctx.counts().nodes, 255);
});
