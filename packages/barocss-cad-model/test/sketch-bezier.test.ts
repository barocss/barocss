import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { bezierCurve, bezierError, bezierPoint, bezierSamples, bezierTangent, wellFormedBezier } from '../src/sketch/bezier';
import { shapeNode, shapeOutline } from '../src/sketch/loops';
import { cornersOf } from '../src/sketch/entityIds';
import { nearestSnap, shapeSnaps } from '../src/sketch/osnap';
import { extendAt, splitAt, trimAt } from '../src/sketch/trim';
import { offsetShape } from '../src/sketch/offset';
import { sketchDxf } from '../src/sketch/dxf';
import { startPicking } from '../src/sketch/select';
import { outlineCurve, curvesSource } from '../src/engine/curveSource';
import { toWorld, tiltPlane, xyPlane } from '../src/sketch/plane';
import { profileOf } from '../src/sketch/loops';
import { sidesOf, withIds } from '../src/sketch/entityIds';
import { sketchShapes } from '../src/sketch/reopen';
import { emptyDirect, importSource } from '../src/engine/direct';
import { loadDirect } from '../src/engine/directModule';
import { copyLoftGuide } from '../src/app/loftGuides';
import type { SketchShape } from '../src/sketch/types';
import type { SketchNode } from '../src/engine/doc';

type P2 = [number, number];
const Q: P2[] = [[0, 0], [2, 4], [4, 0]], C: P2[] = [[0, 0], [1, 3], [3, 3], [4, 0]];
before(async () => { await loadDirect(); });

test('a quadratic Bezier evaluates exactly at dyadic parameters and leaves and arrives along its legs', () => {
  assert.deepEqual(bezierPoint(Q, 0), [0, 0]);
  assert.deepEqual(bezierPoint(Q, 1), [4, 0]);
  assert.deepEqual(bezierPoint(Q, 0.5), [2, 2]);
  assert.deepEqual(bezierPoint(Q, 0.25), [1, 1.5]);
  // (Derivative 2(P1 − P0) at the start, 2(P2 − P1) at the end.)
  assert.deepEqual(bezierTangent(Q, 0), [4, 8]);
  assert.deepEqual(bezierTangent(Q, 1), [4, -8]);
  assert.deepEqual(bezierTangent(Q, 0.5), [4, 0]);
});

test('a cubic Bezier: de Casteljau equals the Bernstein form, tangents are 3 × the end legs', () => {
  for (const t of [0, 0.125, 0.25, 0.5, 0.75, 1]) {
    const s = 1 - t, b = [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t];
    assert.deepEqual(bezierPoint(C, t), [0, 1].map(k => C.reduce((a, p, i) => a + b[i] * p[k], 0)), `t = ${t}`);
  }
  assert.deepEqual(bezierTangent(C, 0), [3, 9]);
  assert.deepEqual(bezierTangent(C, 1), [3, -9]);
});

test('the curve does not pass through its middle control point; the samples run from the first pole to the last', () => {
  const samples = bezierSamples(Q, 64);
  assert.equal(samples.length, 65);
  assert.deepEqual(samples[0], Q[0]); assert.deepEqual(samples[64], Q[2]);
  assert.ok(Math.min(...samples.map(p => Math.hypot(p[0] - 2, p[1] - 4))) > 1.9, 'never nearer than 1.9 mm to (2, 4)');
  assert.ok(Math.min(...bezierSamples(C, 64).flatMap(p => [Math.hypot(p[0] - 1, p[1] - 3), Math.hypot(p[0] - 3, p[1] - 3)])) > 0.3);
});

test('bezierCurve: degree, clamped knots, weights 1 and poles mapped through the plane as outlineCurve maps them', () => {
  for (const plane of [xyPlane(), tiltPlane({ origin: [5, -2, 7], normal: [0, 0, 1], xAxis: [1, 0, 0] }, 30)]) {
    const q = bezierCurve(plane, Q), c = bezierCurve(plane, C);
    assert.equal(q.degree, 2); assert.deepEqual(q.knots, [0, 0, 0, 1, 1, 1]); assert.deepEqual(q.weights, [1, 1, 1]);
    assert.equal(c.degree, 3); assert.deepEqual(c.knots, [0, 0, 0, 0, 1, 1, 1, 1]); assert.deepEqual(c.weights, [1, 1, 1, 1]);
    assert.deepEqual(q.points, Q.map(p => toWorld(plane, p)));
    assert.deepEqual(c.points, C.map(p => toWorld(plane, p)));
    // (Same mapping as a sketch line's poles.)
    assert.deepEqual(outlineCurve(plane, [Q[0], Q[2]], undefined, false).points.filter((_, i) => i !== 1), [q.points[0], q.points[2]]);
  }
});

test('a Bezier is never part of a profile; beside a rectangle the rectangle profile is unchanged; it has one side id', () => {
  const bezier: SketchShape = { kind: 'bezier', poles: Q }, rect: SketchShape = { kind: 'rectangle', a: [0, 0], b: [10, 6] };
  const alone = profileOf([rect]), beside = profileOf([rect, bezier]);
  assert.ok('node' in alone && 'node' in beside);
  assert.deepEqual(beside, alone);
  assert.ok('error' in profileOf([bezier]));
  assert.equal(sidesOf(bezier), 1);
  assert.deepEqual(withIds([bezier])[0].ids, ['e1']);
  assert.deepEqual(withIds([rect, bezier]).map(s => s.ids?.length), [4, 1]);
});

test('Finish keeps a Bezier in the node\'s construction array and reopen restores it, with the main profile first', () => {
  const bezier: SketchShape = { kind: 'bezier', poles: C }, rect: SketchShape = { kind: 'rectangle', a: [0, 0], b: [10, 6] };
  const profile = profileOf([rect, bezier]); assert.ok('node' in profile);
  const stored = JSON.parse(JSON.stringify({ ...profile.node, construction: [bezier] })) as SketchNode;
  const back = sketchShapes(stored);
  assert.equal(back.shape?.kind, 'rectangle');
  assert.deepEqual(back.done, [bezier]);
  assert.equal(Object.hasOwn(back.done[0], 'construction'), false);
});

test('the made curve is a direct source object and a loft guide admits it as one Bezier span (tilted plane, non-integer poles, within the source rounding)', () => {
  const plane = tiltPlane({ origin: [1.5, -2.25, 3.125], normal: [0, 0, 1], xAxis: [1, 0, 0] }, 30);
  const Qn: P2[] = [[0.1234567, 0.3], [1.7777777, 3.3333333], [3.14159265, 2.71828183]], Cn: P2[] = [[0.1, 0.2], [1.1111111, 3.7777777], [3.3333333, 3.1415926], [4.4444444, -0.5]];
  for (const [poles, kind] of [[Qn, 'quadratic-bezier'], [Cn, 'cubic-bezier']] as const) {
    const curve = bezierCurve(plane, poles), direct = importSource(emptyDirect(), curvesSource('sketch', [curve]), 'Sketch curve 1');
    assert.equal(direct.objects.length, 1);
    const copied = copyLoftGuide({ direct }, direct.objects[0].id);
    assert.ok(copied.ok, copied.ok ? '' : copied.reason);
    if (!copied.ok) return;
    assert.equal(copied.guide.kind, kind);
    assert.equal(copied.guide.controlPoints.length, curve.points.length);
    // (The source keeps 1e-9 mm decimals: equal up to that rounding, not bit for bit.)
    copied.guide.controlPoints.forEach((p, i) => p.forEach((v, k) => assert.ok(Math.abs(v - curve.points[i][k]) <= 1e-9, `pole ${i}.${k}: ${v} vs ${curve.points[i][k]}`)));
    assert.ok(copied.guide.controlPoints.some((p, i) => p.some((v, k) => v !== curve.points[i][k])), 'the plane is tilted: the poles are not integers');
  }
});

const bz: SketchShape = { kind: 'bezier', poles: Q }, bzC: SketchShape = { kind: 'bezier', poles: C };
const line = (a: P2, b: P2): SketchShape => ({ kind: 'polygon', points: [a, b], closed: false });
const onlyOthers = (shapes: SketchShape[]) => shapes.filter(x => x.kind !== 'bezier');

test('object snaps: a Bezier snaps to its two end poles only; a malformed one snaps to nothing', () => {
  assert.deepEqual(shapeSnaps(bz), [{ at: [0, 0], kind: 'end' }, { at: [4, 0], kind: 'end' }]);
  assert.deepEqual(shapeSnaps(bzC, true), [{ at: [0, 0], kind: 'end' }, { at: [4, 0], kind: 'end' }]);
  for (const bad of [{ kind: 'bezier' }, { kind: 'bezier', poles: [] }, { kind: 'bezier', poles: [[0, 0], [1, 1]] }]) assert.deepEqual(shapeSnaps(bad as never), []);
  assert.equal(nearestSnap(shapeSnaps({ kind: 'bezier', poles: [] } as never), p => p, [0, 0]), null);
});

test('trim, extend and split: a Bezier is no cutting edge and is left untouched; the lines act as without it', () => {
  const a = line([-10, 0], [10, 0]), b = line([4, -5], [4, 5]), across: SketchShape = { kind: 'bezier', poles: [[6, -6], [6, 0], [6, 6]] };
  const shapes = [a, b, across];
  for (const [op, at] of [[trimAt, [8, 0]], [splitAt, [8, 0]]] as const) {
    const without = op([a, b], at as P2, 0.5), withIt = op(shapes, at as P2, 0.5);
    assert.ok('shapes' in without && 'shapes' in withIt);
    assert.deepEqual(onlyOthers(withIt.shapes).map(x => ({ ...x, ids: undefined })), onlyOthers(without.shapes).map(x => ({ ...x, ids: undefined })));
    const kept = withIt.shapes.filter(x => x.kind === 'bezier'); assert.equal(kept.length, 1);
    assert.deepEqual({ ...kept[0], ids: undefined }, { ...across, ids: undefined });
  }
  // (Extend: the open end runs on to the vertical line at x = 10, not to the Bezier at x = 6.)
  const short = line([0, 0], [3, 0]), wall = line([10, -5], [10, 5]);
  const ext = extendAt([short, wall], [3, 0], 0.5), extWith = extendAt([short, wall, across], [3, 0], 0.5);
  assert.ok('shapes' in ext && 'shapes' in extWith);
  assert.deepEqual(onlyOthers(extWith.shapes), ext.shapes);
  // (Clicking the Bezier itself finds no piece: an error, no crash.)
  for (const op of [trimAt, splitAt]) assert.ok('error' in op([bz], [2, 2], 5));
  assert.ok('error' in extendAt([bz], [0, 0], 5));
});

test('the DXF of a sketch skips a Bezier; offset refuses it; it is no profile node, no corners, and its outline is its samples', () => {
  const rect: SketchShape = { kind: 'rectangle', a: [0, 0], b: [10, 6] }, profile = profileOf([rect]); assert.ok('node' in profile);
  const ref = line([0, 8], [5, 8]), withBez = sketchDxf({ ...profile.node, construction: [bz, bzC, ref] } as SketchNode, {}), without = sketchDxf({ ...profile.node, construction: [ref] } as SketchNode, {});
  assert.equal(withBez.text, without.text);
  assert.deepEqual(offsetShape(bz, 1), { error: 'A Bézier curve is not offset.' });
  assert.equal(shapeNode(bz), null); assert.equal(cornersOf(bz), null);
  assert.deepEqual(shapeOutline(bz), bezierSamples(Q)); assert.equal(shapeOutline(bz).length, 33);
  assert.notDeepEqual(shapeOutline(bz), Q);
  assert.equal(bezierSamples(C).length, 33, 'the default is 32 steps');
  assert.deepEqual(shapeOutline({ kind: 'bezier', poles: [[0, 0]] } as never), []);
});

test('bezierCurve refuses poles that make no curve with the reason', () => {
  assert.throws(() => bezierCurve(xyPlane(), [[1, 1], [1, 1], [1, 1]]), /coincide/);
  assert.throws(() => bezierCurve(xyPlane(), [[0, 0], [5, 5], [0, 0]]), /doubles back/);
  assert.throws(() => bezierCurve(xyPlane(), [[0, 0], [1, 1]]), /three or four/);
});

test('wellFormedBezier: kind bezier with three or four finite [x, y] poles', () => {
  assert.ok(wellFormedBezier(bz)); assert.ok(wellFormedBezier(bzC));
  for (const bad of [null, undefined, 3, {}, { kind: 'bezier' }, { kind: 'bezier', poles: 'x' }, { kind: 'bezier', poles: [[0, 0], [1, 1]] }, { kind: 'bezier', poles: [[0, 0], [1, 1], [2, 0], [3, 3], [4, 0]] },
    { kind: 'bezier', poles: [[NaN, 0], [1, 1], [2, 0]] }, { kind: 'bezier', poles: [[0, Infinity], [1, 1], [2, 0]] }, { kind: 'bezier', poles: [[0, 0], [1, 1], [2]] }, { kind: 'bezier', poles: [[0, 0], [1, 1], '2,0'] },
    { kind: 'polygon', poles: Q }]) assert.equal(wellFormedBezier(bad), false, JSON.stringify(bad));
});

test('bezierError: null for a curve; a reason for malformed, all-coincident and doubled-back poles', () => {
  assert.equal(bezierError(Q), null); assert.equal(bezierError(C), null);
  // (Collinear poles with distinct ends make a straight curve: allowed. Coincident ends with a pole off the line make a loop: allowed.)
  assert.equal(bezierError([[0, 0], [1, 1], [2, 2]]), null);
  assert.equal(bezierError([[0, 0], [3, 0], [3, 3], [0, 0]]), null);
  assert.match(bezierError([[0, 0], [0, 0], [0, 0]])!, /coincide/);
  assert.match(bezierError([[2, 2], [2, 2], [2, 2], [2, 2]])!, /coincide/);
  assert.match(bezierError([[0, 0], [5, 5], [0, 0]])!, /doubles back/);
  assert.match(bezierError([[0, 0], [1, 1], [2, 2], [0, 0]])!, /doubles back/);
  assert.match(bezierError([[0, 0], [0, 0], [5, 0], [0, 0]])!, /doubles back/);
  for (const bad of [null, 'x', [], [[0, 0], [1, 1]], [[0, 0], [1, 1], [2, 0], [3, 3], [4, 0]], [[NaN, 0], [1, 1], [2, 0]], [[0, 0], [1, 1], [2]]]) assert.match(bezierError(bad)!, /three or four finite control points/, JSON.stringify(bad));
});

test('reopen ignores malformed stored Beziers (no throw) and keeps good ones and other construction shapes', () => {
  const rect: SketchShape = { kind: 'rectangle', a: [0, 0], b: [10, 6] }, profile = profileOf([rect]); assert.ok('node' in profile);
  const ref: SketchShape = { kind: 'polygon', points: [[0, 9], [5, 9]], closed: false, construction: true };
  const bad = [{ kind: 'bezier' }, { kind: 'bezier', poles: [[0, 0], [1, 1]] }, { kind: 'bezier', poles: [[0, 0], [1, 1], [2, 0], [3, 3], [4, 0]] }, { kind: 'bezier', poles: [[null, 0], [1, 1], [2, 0]] }, { kind: 'bezier', poles: 'x' }];
  for (const b of bad) {
    const back = sketchShapes(JSON.parse(JSON.stringify({ ...profile.node, construction: [b, bzC, ref] })) as SketchNode);
    assert.deepEqual(back.done.map(d => d.kind), ['bezier', 'polygon'], JSON.stringify(b));
    assert.deepEqual(back.done[0], bzC);
  }
});

test('Select: a current Bezier goes aside like a circle and the profile is picked as without it', () => {
  const plane = xyPlane(), rect: SketchShape = { kind: 'rectangle', a: [0, 0], b: [10, 6] };
  const settled: SketchShape = { kind: 'polygon', points: [[20, 0], [30, 0], [30, 5]], closed: true, bulges: [0, 0, 0] };
  const pick = (shape: SketchShape | null, done: SketchShape[]) => startPicking({ plane, tool: 'bezier', shape, done }, 'select');
  // Current Bezier, a rectangle before it: the rectangle comes back as the outline, the Bezier waits beside it.
  let r = pick(bz, [rect]); assert.equal(r.shape?.kind, 'polygon'); assert.deepEqual(r.done, [bz]); assert.equal(r.tool, 'select');
  // Current Bezier, an outline before it.
  r = pick(bzC, [settled]); assert.deepEqual(r.shape, settled); assert.deepEqual(r.done, [bzC]);
  // Current Bezier and nothing to pick: no current shape, the Bezier is kept.
  r = pick(bz, []); assert.equal(r.shape, null); assert.deepEqual(r.done, [bz]);
  r = pick(bz, [line([0, 0], [1, 1])]); assert.equal(r.shape, null); assert.equal(r.done?.length, 2);
  // No current shape, a Bezier last in done: the rectangle before it still comes back; so with several Beziers after it.
  r = pick(null, [rect, bz]); assert.equal(r.shape?.kind, 'polygon'); assert.deepEqual(r.done, [bz]);
  r = pick(null, [settled, bz, bzC]); assert.deepEqual(r.shape, settled); assert.deepEqual(r.done, [bz, bzC]);
  r = pick(null, [bz, settled]); assert.deepEqual(r.shape, settled); assert.deepEqual(r.done, [bz]);
  r = pick(null, [bz]); assert.equal(r.shape, null); assert.deepEqual(r.done, [bz]);
  // Without any Bezier nothing changes: the rectangle comes back.
  r = pick(null, [rect]); assert.equal(r.shape?.kind, 'polygon'); assert.deepEqual(r.done, []);
});
