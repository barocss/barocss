import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode } from '../src/engine/doc';
import { partBreps } from '../src/engine/evaluate';
import { partSnapshot } from '../src/engine/part';
import { roundCorner } from '../src/sketch/corner';
import { profileOf } from '../src/sketch/loops';
import { arcOf, type P2 } from '../src/sketch/profile';
import { sketchShapes } from '../src/sketch/reopen';
import { commitDimension, type Polygon } from '../src/sketch/rules';
import { settleShape } from '../src/sketch/settle';

test('rounding a corner: an arc tangent to both edges, ends cut back, constraints renumbered', () => {
  const sq = { kind: 'polygon' as const, points: [[0, 0], [20, 0], [20, 10], [0, 10]] as [number, number][], closed: true, bulges: [0, 0, 0, 0], lengths: { 0: 20, 1: 10, 2: 20 }, hv: { h: [0, 2], v: [1, 3] } };
  const r = roundCorner(sq, 1, 3);
  assert.ok('shape' in r);
  assert.deepEqual(r.shape.points, [[0, 0], [17, 0], [20, 3], [20, 10], [0, 10]]);
  const arc = arcOf(r.shape.points[1], r.shape.points[2], r.shape.bulges![1]);
  assert.deepEqual([Math.round(arc.center[0] * 1e6) / 1e6, Math.round(arc.center[1] * 1e6) / 1e6, Math.round(arc.radius * 1e6) / 1e6], [17, 3, 3]);
  assert.deepEqual([r.shape.lengths, r.shape.radii, r.shape.tangents, r.shape.hv], [{ 3: 20 }, { 1: 3 }, [1, 2], { h: [0, 3], v: [2, 4] }]);
  assert.ok('error' in roundCorner(sq, 1, 11), 'R11 does not fit the 10 mm edge');
  assert.ok('error' in roundCorner(r.shape, 2, 1), 'next to the arc');
});

const pinned = (): Polygon => ({
  kind: 'polygon', closed: true, points: [[0, 20], [40, 20], [20, 40], [0, 40]],
  bulges: [0, Math.tan(Math.PI / 8), 0, 0], ids: ['e1', 'e2', 'e3', 'e4'],
  hv: { h: [0, 2], v: [3] }, radii: { 1: 20 }, tangents: [2], rules: [{ kind: 'fix', point: 2, at: [20, 40] }],
});
const near = (actual: number, expected: number, tolerance = 1e-7) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};
const nearPoint = (actual: P2, expected: P2) => { near(actual[0], expected[0]); near(actual[1], expected[1]); };

function checkRoundedGeometry(shape: Polygon, r: number) {
  // Independently intersect the horizontal offset y = 20 + r with the inner
  // circle about (20,20), then project the result onto the source radius 20.
  const x = Math.sqrt(400 - 40 * r), y = 20 + r;
  const center: P2 = [20 + x, y], line: P2 = [20 + x, 20];
  const join: P2 = [20 + 20 * x / (20 - r), 20 + 20 * r / (20 - r)];
  const theta = Math.atan2(r, x), roundSweep = Math.PI / 2 + theta, sourceSweep = Math.PI / 2 - theta;
  const [a, p, q, b, d] = shape.points;
  nearPoint(a, [0, 20]);
  nearPoint(b, [20, 40]);
  nearPoint(d, [0, 40]);
  nearPoint(p, line);
  nearPoint(q, join);
  assert.ok(p[0] > 0 && p[0] < 40 && q[0] > 20 && q[0] < 40 && q[1] > 20 && q[1] < 40);
  const fillet = arcOf(p, q, shape.bulges![1]), source = arcOf(q, b, shape.bulges![2]);
  nearPoint(fillet.center, center);
  nearPoint(source.center, [20, 20]);
  near(fillet.radius, r);
  near(source.radius, 20);
  near(fillet.sweep, roundSweep, 1e-9);
  near(source.sweep, sourceSweep, 1e-9);
  const tangentAtJoin = ([cx, cy]: P2) => Math.atan2(q[0] - cx, cy - q[1]);
  near(tangentAtJoin(fillet.center), tangentAtJoin(source.center), 1e-9);
  near(fillet.center[0], p[0]);

  const construction = { kind: 'polygon' as const, points: [[2, 24], [3, 24]] as P2[], closed: false, construction: true as const, ids: ['e7', 'e6'] };
  const profile = profileOf([shape, construction]);
  assert.ok('node' in profile);
  assert.deepEqual(profile.node.sideTags?.outer, ['e1', 'e8', 'e2', 'e3', 'e4']);
  assert.deepEqual(construction.ids, ['e7', 'e6']);
  const doc = withNode(withNode(emptyDoc(), profile.node), { kind: 'extrude', sketch: 0, height: 10 });
  const [body] = partBreps(doc);
  assert.ok(body && checkBrep(body.brep, { strict: true }).valid);
  for (const id of ['e1', 'e8', 'e2', 'e3', 'e4']) {
    assert.equal(body.brep.faces.filter(face => face.name === `n1.side[${id}]`).length, 1, id);
  }
  const points = [a, line, join, b, d];
  const polygonArea = points.reduce((sum, [x0, y0], i) => {
    const [x1, y1] = points[(i + 1) % points.length];
    return sum + (x0 * y1 - y0 * x1) / 2;
  }, 0);
  const area = polygonArea + r * r * (roundSweep - Math.sin(roundSweep)) / 2
    + 200 * (sourceSweep - Math.sin(sourceSweep));
  const mass = massPropertiesOf(partSnapshot(doc).outputs[0], 1);
  near(mass.volume, 10 * area, 1e-5);
}

test('pinned line–arc Round creates R3 and the radius editor settles R4 then R5 on the same carriers', () => {
  const source = pinned(), original = structuredClone(source);
  const rounded = roundCorner(source, 1, 3);
  if ('error' in rounded) assert.fail(rounded.error);
  assert.deepEqual(source, original);
  const first = rounded.shape;
  assert.deepEqual(first.ids, ['e1', '', 'e2', 'e3', 'e4']);
  assert.deepEqual(first.hv, { h: [0, 3], v: [4] });
  assert.deepEqual(first.tangents, [1, 2, 3]);
  assert.deepEqual(first.rules, [{ kind: 'fix', point: 3, at: [20, 40] }]);
  assert.deepEqual(first.radii, { 1: 3, 2: 20 });
  checkRoundedGeometry(first, 3);

  let current = first;
  for (const r of [4, 5]) {
    const locked = settleShape({ ...current, radii: { ...current.radii, 1: r } }, current);
    assert.equal(locked.error, null);
    const edited = commitDimension(current, 'rad1', r);
    if (!edited.ok) assert.fail(edited.reason);
    const settled = settleShape(edited.shape, current);
    assert.equal(settled.error, null);
    assert.equal(settled.shape?.kind, 'polygon');
    assert.deepEqual(settled.shape.ids, first.ids);
    assert.deepEqual(settled.shape.radii, { 1: r, 2: 20 });
    assert.deepEqual(locked.shape, settled.shape);
    checkRoundedGeometry(settled.shape, r);
    current = settled.shape;
  }
  const before = structuredClone(current);
  for (const invalid of [9.99999999, 10, 11, 12]) {
    const oversized = commitDimension(current, 'rad1', invalid);
    assert.ok(!oversized.ok, `R${invalid} leaves no finite retained arc`);
    assert.match(oversized.reason, /does not fit on both finite sides/);
    const locked = settleShape({ ...current, radii: { ...current.radii, 1: invalid } }, current);
    assert.equal(locked.shape, current);
    assert.match(locked.error ?? '', /does not fit on both finite sides/);
  }
  assert.deepEqual(current, before);
});

test('pinned line–arc Round preserves off-grid radius and refuses invalid or oversized creation', () => {
  const radius = 3.0000004, source = pinned();
  const rounded = roundCorner(source, 1, radius);
  if ('error' in rounded) assert.fail(rounded.error);
  assert.equal(rounded.shape.radii?.[1], radius);
  checkRoundedGeometry(rounded.shape, radius);
  for (const invalid of [NaN, Infinity, -1, 0, 0.0005, 10, 11, 20]) assert.ok('error' in roundCorner(source, 1, invalid), String(invalid));
});

test('pinned line–arc Round keeps the radius guard when Finish allocates the largest safe side ID', () => {
  const source = pinned(), max = Number.MAX_SAFE_INTEGER;
  source.ids = ['e1', 'e2', 'e3', `e${max}`];
  assert.ok('error' in roundCorner(source, 1, 3), 'Creation needs one available ID');

  const retained = `e${max - 1}`, fillet = `e${max}`;
  source.ids = ['e1', 'e2', 'e3', retained];
  const rounded = roundCorner(source, 1, 3);
  if ('error' in rounded) assert.fail(rounded.error);
  const profile = profileOf([rounded.shape]);
  assert.ok('node' in profile);
  const ids = ['e1', fillet, 'e2', 'e3', retained];
  assert.deepEqual(profile.node.sideTags?.outer, ids);

  const { shape } = sketchShapes(profile.node);
  assert.equal(shape?.kind, 'polygon');
  assert.deepEqual(shape.ids, ids);
  const edited = commitDimension(shape, 'rad1', 4);
  if (!edited.ok) assert.fail(edited.reason);
  assert.deepEqual(edited.shape.ids, ids);
  const oversized = commitDimension(shape, 'rad1', 10);
  assert.ok(!oversized.ok);
  assert.match(oversized.reason, /does not fit on both finite sides/);
  const locked = settleShape({ ...shape, radii: { ...shape.radii, 1: 10 } }, shape);
  assert.equal(locked.shape, shape);
  assert.match(locked.error ?? '', /does not fit on both finite sides/);
});

test('line–arc Round refuses unpinned, ambiguous and unsupported profiles without changing constraints', () => {
  const source = pinned();
  const refused = (shape: Polygon, i = 1, reason?: RegExp) => {
    const before = structuredClone(shape), result = roundCorner(shape, i, 3);
    assert.ok('error' in result);
    if (reason) assert.match(result.error, reason);
    assert.deepEqual(shape, before);
  };
  refused({ ...source, points: [[0, 0], [40, 20], [20, 40], [0, 40]], hv: { h: [2], v: [3] }, rules: undefined });
  refused({ ...source, rules: undefined });
  refused({ ...source, lengths: { 0: 40 } }, 1, /length lock/);
  refused({ ...source, rules: [{ kind: 'fix', point: 1, at: [40, 20] }, ...source.rules!] }, 1, /fixed point at the corner/);
  refused({ ...source, rules: [...source.rules!, { kind: 'distance', a: 1, b: 3, value: 10 }] });
  refused({ ...source, ids: ['e1', 'e2', 'e2', 'e4'] }, 1, /distinct side IDs/);
  refused({ ...source, closed: false });
  refused({ ...source, pending: true });
  refused({ ...source, fromSpline: true });
  refused({ ...source, fromEllipse: true });
  refused({ ...source, bulges: [0, -source.bulges![1], 0, 0] });
  refused({ ...source, bulges: [0, source.bulges![1], 0.25, 0] });
  refused({ ...source, bulges: [0, source.bulges![1] / 2, 0, 0] });
  refused(source, 2);
});
