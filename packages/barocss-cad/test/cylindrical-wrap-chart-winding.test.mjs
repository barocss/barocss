import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartContext, createChartLoopContext, prepareChartCurve, isCylindricalWrapChartError } from '../dist/features/cylindrical-wrap-chart.js';
import { prepareChartWindingUse, chartWindingPointFromWorld, chartWindingPointFromVertex, certifyChartWinding } from '../dist/features/cylindrical-wrap-chart-winding.js';

const FRACTIONS = [0, 0.25, 0.75, 1];
function edge(id, start, end, weights = [1, 1, 1, 1]) {
  const controlPoints = [];
  for (const t of FRACTIONS) controlPoints.push([1, start[0] + t * (end[0] - start[0]), start[1] + t * (end[1] - start[1])]);
  return { kind: 'curve', id, degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints, weights: [...weights] };
}
function ring(points, prefix = 'ring') {
  const curves = [];
  for (let i = 0; i < points.length; i++) curves.push(edge(`${prefix}${i}`, points[i], points[(i + 1) % points.length]));
  return curves;
}
function prepared(curves, options) {
  const ctx = createChartLoopContext(options), charts = [], uses = [];
  for (const curve of curves) { const chart = prepareChartCurve(curve, ctx); charts.push(chart); uses.push(prepareChartWindingUse(chart, 'forward', ctx)); }
  return { ctx, charts, uses };
}
function query(uses, world, ctx) { return certifyChartWinding(uses, chartWindingPointFromWorld(world, ctx), ctx); }
function throwsCode(action, code) { assert.throws(action, error => isCylindricalWrapChartError(error) && error.code === code); }
function rectangle() { return ring([[1, -2], [3, -2], [3, 2], [1, 2]]); }
function diagonal(id = 'diagonal') { return edge(id, [1, 0], [2, 1]); }

test('independent rectangle orientation and reversed uses preserve canonical data and signed winding', () => {
  const curves = rectangle(), before = structuredClone(curves), { ctx, charts, uses } = prepared(curves);
  const result = query(uses, [1, 2, 0], ctx);
  assert.equal(result.winding, 1); assert.deepEqual(result.edges.map(e => e.contribution), [0, 0, 1, 0]);
  assert.equal(query(uses, [1, 4, 0], ctx).winding, 0); assert.equal(query(uses, [1, 2, -3], ctx).winding, 0);
  const backwards = [];
  for (let i = charts.length - 1; i >= 0; i--) backwards.push(prepareChartWindingUse(charts[i], 'reversed', ctx));
  assert.equal(query(backwards, [1, 2, 0], ctx).winding, -1);
  assert.deepEqual(curves, before);
  for (let i = 0; i < charts.length; i++) assert.deepEqual(charts[i].source, before[i]);
  assert.equal(result.method, 'exact-upward-ray-monotone-slope'); assert.equal(result.boundaryExcluded, true);
  assert.equal(result.halfOpen, 'minimum-inclusive-maximum-exclusive'); assert.deepEqual(result.axisUnits, { slope: 'dimensionless-y-over-x', height: 'mm' });
  for (const key of ['loopClosureCertified', 'loopSimplicityCertified', 'componentContainmentCertified', 'sourceCertified', 'carrierCertified', 'solidQualified', 'volumeCertified', 'globalEvaluatorErrorCertified']) assert.equal(result.meaning[key], false);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('maximum-q vertices and vertical boundaries are rejected before the half-open crossing rule', () => {
  const { ctx, uses } = prepared(rectangle());
  for (const point of [[1, 3, 2], [1, 3, -2], [1, 3, 0], [1, 1, 0], [1, 2, 2]]) throwsCode(() => query(uses, point, ctx), 'UNRESOLVED');
  assert.equal(query(uses, [1, 3, 3], ctx).winding, 0);
  const vertical = prepared([edge('vertical', [2, -1], [2, 2])]);
  assert.equal(vertical.uses[0].classification, 'constant-slope-height');
  throwsCode(() => query(vertical.uses, [1, 2, 0], vertical.ctx), 'UNRESOLVED');
  assert.equal(query(vertical.uses, [1, 2, 3], vertical.ctx).winding, 0); assert.equal(query(vertical.uses, [1, 2, -2], vertical.ctx).winding, 0);
});

test('local q extrema and endpoint crossings follow the independent upward-ray sign convention', () => {
  const { ctx, uses } = prepared(ring([[2, 0], [3, 1], [2, 2], [1, 1]], 'diamond'));
  assert.equal(query(uses, [1, 2, 1], ctx).winding, 1);
  assert.equal(query(uses, [1, 3, 0], ctx).winding, 0); assert.equal(query(uses, [1, 1, 0], ctx).winding, 0);
  throwsCode(() => query(uses, [1, 3, 1], ctx), 'UNRESOLVED'); throwsCode(() => query(uses, [1, 1, 1], ctx), 'UNRESOLVED');
  const single = prepared([diagonal()]);
  const low = query(single.uses, [1, 1, -1], single.ctx); assert.equal(low.winding, -1); assert.equal(low.edges[0].method, 'endpoint-above'); assert.deepEqual(low.edges[0].root, { endpoint: 0 });
  const high = query(single.uses, [1, 2, -1], single.ctx); assert.equal(high.winding, 0); assert.equal(high.edges[0].method, 'upper-endpoint-excluded');
  throwsCode(() => query(single.uses, [1, 2, 1], single.ctx), 'UNRESOLVED');
});

test('exact midpoint and non-dyadic unique q roots have strict height receipts without Number evaluation', () => {
  const { ctx, uses } = prepared([diagonal()]);
  const midpoint = query(uses, [1, 1.5, 0.25], ctx);
  assert.equal(midpoint.winding, -1); assert.equal(midpoint.edges[0].method, 'midpoint-above'); assert.deepEqual(midpoint.edges[0].root, { numerator: 1, depth: 1 });
  const above = query(uses, [1, 1.25, 0.1], ctx), below = query(uses, [1, 1.25, 0.9], ctx);
  assert.equal(above.winding, -1); assert.equal(below.winding, 0);
  assert.equal(above.edges[0].method, 'root-box-above'); assert.equal(below.edges[0].method, 'root-box-below');
  assert.ok(above.edges[0].interval.depth > 0); assert.ok(below.edges[0].interval.depth > 0);
  // q=1+f(t),z=f(t), f has cubic controls[0,1/4,3/4,1]. The boundary f(t)=1/4 has no rational root.
  // Exact boxes must remain unresolved here; stopping at depth8 cannot turn this boundary into an accepted point.
  throwsCode(() => query(uses, [1, 1.25, 0.25], ctx), 'UNRESOLVED');
});

test('height progress with nonconstant q is explicitly outside the first winding family', () => {
  const curve = diagonal('height_fallback'); curve.controlPoints = [[1, 1, 0], [1, 3, 0.25], [1, 1, 0.75], [1, 2, 1]];
  const before = structuredClone(curve), ctx = createChartLoopContext(), chart = prepareChartCurve(curve, ctx);
  assert.equal(chart.progress.coordinate, 'height');
  throwsCode(() => prepareChartWindingUse(chart, 'forward', ctx), 'SUPPORT'); assert.deepEqual(curve, before);
});

test('decreasing canonical q roots and reversed traversal use the same exact root with opposite contributions', () => {
  const curve = diagonal('decreasing'); curve.controlPoints.reverse(); curve.weights.reverse();
  const before = structuredClone(curve), { ctx, charts, uses } = prepared([curve]); assert.equal(charts[0].progress.sign, -1);
  const midpoint = query(uses, [1, 1.5, 0.25], ctx); assert.equal(midpoint.winding, 1); assert.equal(midpoint.edges[0].method, 'midpoint-above');
  const isolated = query(uses, [1, 1.25, 0.1], ctx); assert.equal(isolated.winding, 1); assert.equal(isolated.edges[0].method, 'root-box-above');
  const reverse = prepareChartWindingUse(charts[0], 'reversed', ctx); assert.equal(query([reverse], [1, 1.25, 0.1], ctx).winding, -1);
  assert.deepEqual(charts[0].source, before); assert.deepEqual(curve, before);
});

test('canonical vertex point construction is independent of use sense and preserves exact ratios', () => {
  const curve = edge('weighted', [1, -1], [2, 1], [0.5, 1, 0.5, 1]), { ctx, charts, uses } = prepared([curve]);
  const reverse = prepareChartWindingUse(charts[0], 'reversed', ctx), first = chartWindingPointFromVertex(uses[0], 0, ctx), same = chartWindingPointFromVertex(reverse, 0, ctx), last = chartWindingPointFromVertex(reverse, 1, ctx);
  assert.equal(first, same); assert.equal(first.origin, 'vertex');
  assert.equal(first.slope.n, first.slope.d); assert.equal(first.height.n, -first.height.d); assert.equal(last.slope.n, 2n * last.slope.d);
  throwsCode(() => certifyChartWinding(uses, first, ctx), 'UNRESOLVED');
  const tiny = chartWindingPointFromWorld([Number.MIN_VALUE, 1, -2], ctx);
  assert.equal(tiny.slope.n, 1n << 1074n); assert.equal(tiny.slope.d, 1n); assert.equal(tiny.height.n, -2n);
  assert.equal(certifyChartWinding(uses, tiny, ctx).winding, 0);
});

test('uses and query points require the same context brand before getters or arithmetic work', () => {
  const { ctx, charts, uses } = prepared([diagonal()]), point = chartWindingPointFromWorld([1, 1.5, -1], ctx), before = ctx.counts();
  let useReads = 0, pointReads = 0;
  const forgedUse = {}; Object.defineProperty(forgedUse, 'chart', { enumerable: true, get() { useReads++; throw new Error('use getter ran'); } });
  const forgedPoint = {}; Object.defineProperty(forgedPoint, 'slope', { enumerable: true, get() { pointReads++; throw new Error('point getter ran'); } });
  throwsCode(() => certifyChartWinding([forgedUse], point, ctx), 'INPUT'); throwsCode(() => certifyChartWinding(uses, forgedPoint, ctx), 'INPUT');
  assert.equal(useReads, 0); assert.equal(pointReads, 0); assert.deepEqual(ctx.counts(), before);
  throwsCode(() => certifyChartWinding([{ ...uses[0] }], point, ctx), 'INPUT'); throwsCode(() => certifyChartWinding(uses, { ...point }, ctx), 'INPUT');
  const foreign = createChartLoopContext(), foreignPoint = chartWindingPointFromWorld([1, 1.5, -1], foreign);
  throwsCode(() => certifyChartWinding(uses, foreignPoint, ctx), 'INPUT'); throwsCode(() => chartWindingPointFromVertex(uses[0], 0, foreign), 'INPUT');
  throwsCode(() => prepareChartWindingUse(charts[0], 'forward', foreign), 'INPUT');
  const fakeContext = { check() {}, requireCurve() {} };
  throwsCode(() => chartWindingPointFromWorld([1, 1.5, -1], fakeContext), 'INPUT'); throwsCode(() => prepareChartWindingUse(charts[0], 'forward', fakeContext), 'INPUT');
});

test('own finite query admission, use-count bounds and frozen serializable results preserve callers', () => {
  const input = diagonal(), before = structuredClone(input), { ctx, uses } = prepared([input]);
  for (const value of [[0, 1, 0], [-1, 1, 0], [1, Infinity, 0], [10001, 1, 0], [1, 1]]) throwsCode(() => chartWindingPointFromWorld(value, ctx), 'INPUT');
  const point = chartWindingPointFromWorld([1, 1.5, -1], ctx);
  throwsCode(() => certifyChartWinding([], point, ctx), 'INPUT'); throwsCode(() => certifyChartWinding(Array(33).fill(uses[0]), point, ctx), 'INPUT');
  const getterArray = []; let reads = 0; Object.defineProperty(getterArray, '0', { enumerable: true, get() { reads++; throw new Error('array getter ran'); } });
  throwsCode(() => certifyChartWinding(getterArray, point, ctx), 'INPUT'); assert.equal(reads, 0);
  const result = certifyChartWinding(uses, point, ctx); assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.edges)); assert.ok(Object.isFrozen(result.point.slope)); assert.ok(Object.isFrozen(result.counts));
  assert.equal(result.meaning.loopClosureCertified, false, 'One edge is an oriented chain, never a qualified loop.'); assert.doesNotThrow(() => JSON.stringify(result));
  assert.deepEqual(input, before);
});

test('root-depth uncertainty and cumulative request arithmetic keep their original refusal limits', () => {
  const shallow = prepared([diagonal()], { maxDepth: 0 });
  throwsCode(() => query(shallow.uses, [1, 1.5, 0.25], shallow.ctx), 'UNRESOLVED');
  const { ctx, uses } = prepared(rectangle()), first = query(uses, [1, 2, 0], ctx), second = query(uses, [1, 2, 0], ctx);
  assert.ok(second.counts.totalOperations > first.counts.totalOperations); assert.equal(second.counts.totalOperations, ctx.counts().totalOperations);
  assert.ok(second.counts.totalOperations <= 200000); assert.ok(second.counts.nodes <= 256);
  const base = createChartLoopContext(), source = diagonal('budget'), chart = prepareChartCurve(source, base); prepareChartWindingUse(chart, 'forward', base);
  const used = base.counts().totalOperations, tight = createChartLoopContext({ maxOperations: used + 1 }), candidate = prepareChartCurve(source, tight); prepareChartWindingUse(candidate, 'forward', tight);
  throwsCode(() => chartWindingPointFromWorld([1, 1.5, -1], tight), 'BUDGET');
  const ordinary = new ChartContext(); assert.equal(ordinary.limits.curves, 2); assert.equal(ctx.limits.curves, 32);
});
