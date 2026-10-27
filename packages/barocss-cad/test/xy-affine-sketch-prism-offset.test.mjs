import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { buildXYAffineSketchPrism, validateXYAffineSketchPrism, XYAffineSketchPrismError } = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const options = () => ({ sourceId: 'src', sourceRevision: 0, orderedSegmentIds: ['a', 'b', 'c', 'd'], height: 3,
  capChart: { originXY: [-3, 2], spanXY: [3, 5] }, chartPolicy: { version: 1, kind: 'coordinate-span' }, solidId: 'solid', resultIdPrefix: 'offset', from: -2 });
const refuses = action => assert.throws(action, error => {
  assert.ok(error instanceof XYAffineSketchPrismError); assert.equal(error.stage, 'input'); return true;
});
// The sketch is intentionally unusable. Every case must fail in options admission,
// before even attempting whole-sketch reconstruction or any native constructor.
test('offset native options refuse nonfinite/range/inexact sums before sketch reconstruction', () => {
  for (const from of [undefined, null, '1', NaN, Infinity, -Infinity, 10001, -10001]) refuses(() => buildXYAffineSketchPrism({}, { ...options(), from }));
  for (const [from, height] of [[.1, .2], [9999, 2], [0, 0], [0, -1], [-10000, 10001], [1, Number.MIN_VALUE]])
    refuses(() => buildXYAffineSketchPrism({}, { ...options(), from, height }));
});
test('offset native shape requires the exact coordinate-span option inventory', () => {
  const o = options(); delete o.chartPolicy; refuses(() => buildXYAffineSketchPrism({}, o));
  for (const chartPolicy of [undefined, {}, { version: 2, kind: 'coordinate-span' }, { version: 1, kind: 'other' }])
    assert.throws(() => buildXYAffineSketchPrism({}, { ...options(), chartPolicy }), error => error instanceof XYAffineSketchPrismError && ['input', 'chart'].includes(error.stage));
  refuses(() => buildXYAffineSketchPrism({}, { ...options(), to: 1 }));
  let calls = 0; const accessor = options(); Object.defineProperty(accessor, 'from', { enumerable: true, get() { calls++; return -2; } });
  refuses(() => buildXYAffineSketchPrism({}, accessor)); assert.equal(calls, 0);
  refuses(() => buildXYAffineSketchPrism({}, { ...options(), [Symbol('offset')]: -2 }));
});
test('whole offset reconstruction retains admission before any geometry', () => {
  const result = { request: { sketch: {}, options: { ...options(), from: .1, height: .2 } }, solid: {}, lineage: {}, report: {} };
  refuses(() => validateXYAffineSketchPrism(result));
  assert.equal(result.request.options.from, .1); assert.equal(result.request.options.height, .2);
});
