import test from 'node:test';
import assert from 'node:assert/strict';
import type { P2 } from '@barocss/cad-model/sketch/profile';
import { nearestSnap, type SnapPoint } from '@barocss/cad-model/sketch/osnap';
import type { SketchShape } from '@barocss/cad-model/sketch/types';
import { arcExtensionGuide, arcExtensionPoint, prepareArcExtension, uniqueArcTerminal } from '../src/sketch/arcExtension';

const shape = (a: P2, b: P2, bulge: number): Extract<SketchShape, { kind: 'polygon' }> =>
  ({ kind: 'polygon', points: [a, b], closed: false, construction: true, bulges: [bulge, 0] });
const check = (actual: P2 | null, expected: P2) => {
  assert.ok(actual && Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 1e-10);
};
const q = Math.SQRT2 - 1, d = 5 * Math.SQRT2;

test('circular extension follows the signed direction through the angular seam', () => {
  const ccw = prepareArcExtension(shape([30, 20], [20, 30], q));
  const cw = prepareArcExtension(shape([20, 30], [30, 20], -q));
  const seam = prepareArcExtension(shape([0, 10], [-10, 0], q));
  assert.ok(ccw && cw && seam);
  check(arcExtensionPoint(ccw, [13, 27]), [20 - d, 20 + d]);
  check(arcExtensionPoint(cw, [27, 13]), [20 + d, 20 - d]);
  check(arcExtensionPoint(seam, [-7, -7]), [-d, -d]);
  const guide = arcExtensionGuide(ccw);
  check(guide[0], [20, 30]);
  check(guide.at(-1) ?? null, [10, 20]);
  assert.equal(arcExtensionPoint(ccw, [27, 27]), null);
  assert.equal(arcExtensionPoint(ccw, [20, 30]), null);
  assert.equal(arcExtensionPoint(ccw, [13, 13]), null);
  assert.equal(arcExtensionPoint(ccw, [19.9, 20.1]), null);
  assert.equal(arcExtensionPoint(ccw, [20, 20]), null);
  assert.equal(arcExtensionPoint(ccw, [Infinity, 0]), null);
});

test('circular extension stays inside the unused part of a major arc', () => {
  const major = prepareArcExtension(shape([0, 10], [10, 0], -(1 + Math.SQRT2)));
  assert.ok(major);
  check(arcExtensionPoint(major, [3, 3]), [10 - d, 10 - d]);
  assert.equal(arcExtensionPoint(major, [0, 10]), null);
  assert.equal(arcExtensionPoint(major, [3, 17]), null);
});

test('only a completed authored open construction arc can supply a guide', () => {
  const source = shape([30, 20], [20, 30], q);
  assert.equal(prepareArcExtension({ ...source, pending: true }), null);
  assert.equal(prepareArcExtension({ ...source, closed: true }), null);
  assert.equal(prepareArcExtension({ ...source, fromEllipse: true }), null);
  assert.equal(prepareArcExtension({ ...source, fromSpline: true }), null);
  assert.equal(prepareArcExtension({ ...source, construction: undefined }), null);
  for (const bulge of [0, NaN, Infinity, Number.MIN_VALUE, Number.MAX_VALUE])
    assert.equal(prepareArcExtension(shape([30, 20], [20, 30], bulge)), null);
  assert.equal(prepareArcExtension(shape([30, 20], [30, 20], q)), null);
  assert.equal(prepareArcExtension(shape([9899, 0], [9999, -100], q)), null);
});

test('terminal acquisition refuses the opposite endpoint and tied screen candidates', () => {
  const end: P2 = [3, 0], project = (point: P2) => point;
  const points: SnapPoint[] = [{ at: end, kind: 'end' }, { at: [0, 0], kind: 'end' }];
  const acquired = (pointer: P2) => uniqueArcTerminal(end, nearestSnap(points, project, pointer), points, project, pointer);
  assert.equal(acquired(end), true);
  assert.equal(acquired([0, 0]), false);
  assert.equal(acquired([1.5, 0]), false);
  points.push({ at: [...end], kind: 'end' });
  assert.equal(acquired(end), false);
});
