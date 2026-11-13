import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode, type DocPlane } from '../src/engine/doc';
import { partBreps } from '../src/engine/evaluate';
import { partSnapshot } from '../src/engine/part';
import { roundCorner } from '../src/sketch/corner';
import { planPinnedLineArcRadiusEdit } from '../src/sketch/internal/pinnedLineArcRound';
import { profileOf } from '../src/sketch/loops';
import { arcOf, type P2 } from '../src/sketch/profile';
import { sketchShapes } from '../src/sketch/reopen';
import { applyConstraint, checkEdit, commitDimension, constraintOptions, commitInlineDimension, removeConstraint, type Polygon } from '../src/sketch/rules';
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
const reversedPinned = (): Polygon => ({
  ...pinned(), points: [[0, 20], [0, 40], [20, 40], [40, 20]],
  bulges: [0, 0, -Math.tan(Math.PI / 8), 0], ids: ['e4', 'e3', 'e2', 'e1'],
  hv: { h: [1, 3], v: [0] }, radii: { 2: 20 },
});
const near = (actual: number, expected: number, tolerance = 1e-7) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};
const nearPoint = (actual: P2, expected: P2) => { near(actual[0], expected[0]); near(actual[1], expected[1]); };
const xzPlane: DocPlane = { origin: [0, 5, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };

function checkRoundedGeometry(shape: Polygon, r: number, direction: 1 | -1 = 1, R = 20, datum = 20, reverse = false) {
  // In the fixture's inward coordinates the fixed end is (20,20). Subtract
  // the squared vertical offset from the inner radius squared and factor:
  // (R − r)² − (R + r − 20)² = (20 − 2r)(2R − 20).
  const ordinate = (v: number) => datum + direction * v;
  const x = Math.sqrt((20 - 2 * r) * (2 * R - 20)), y = R + r - 20;
  const center: P2 = [20 + x, ordinate(r)], sourceCenter: P2 = [20, ordinate(20 - R)];
  const line: P2 = [20 + x, datum], join: P2 = [20 + R * x / (R - r), ordinate(20 - R + R * y / (R - r))];
  const theta = Math.atan2(y, x), roundSweep = Math.PI / 2 + theta, sourceSweep = Math.PI / 2 - theta;
  const [a, p, q, b, d] = reverse ? [shape.points[0], ...shape.points.slice(1).reverse()] : shape.points;
  nearPoint(a, [0, datum]);
  nearPoint(b, [20, ordinate(20)]);
  nearPoint(d, [0, ordinate(20)]);
  nearPoint(p, line);
  nearPoint(q, join);
  const sharpX = 20 + Math.sqrt(40 * (R - 10)), inward = direction * (q[1] - datum);
  assert.ok(p[0] > 0 && p[0] < sharpX && q[0] > 20 && inward > 0 && inward < 20);
  const fillet = reverse ? arcOf(q, p, shape.bulges![3]) : arcOf(p, q, shape.bulges![1]);
  const source = reverse ? arcOf(b, q, shape.bulges![2]) : arcOf(q, b, shape.bulges![2]);
  nearPoint(fillet.center, center);
  nearPoint(source.center, sourceCenter);
  near(fillet.radius, r);
  near(source.radius, R);
  const authoredDirection = reverse ? -direction : direction;
  near(fillet.sweep, authoredDirection * roundSweep, 1e-9);
  near(source.sweep, authoredDirection * sourceSweep, 1e-9);
  const tangentAtJoin = ([cx, cy]: P2) => Math.atan2(direction * (q[0] - cx), direction * (cy - q[1]));
  near(tangentAtJoin(fillet.center), tangentAtJoin(source.center), 1e-9);
  near(fillet.center[0], p[0]);

  const construction = { kind: 'polygon' as const, points: [[2, 24], [3, 24]] as P2[], closed: false, construction: true as const, ids: ['e7', 'e6'] };
  const profile = profileOf([shape, construction]);
  assert.ok('node' in profile);
  const filletId = shape.ids?.[reverse ? 3 : 1] || 'e8';
  const ids = reverse ? ['e4', 'e3', 'e2', filletId, 'e1'] : ['e1', filletId, 'e2', 'e3', 'e4'];
  assert.deepEqual(profile.node.sideTags?.outer, ids);
  assert.deepEqual(construction.ids, ['e7', 'e6']);
  const node = direction === -1 ? { ...profile.node, plane: xzPlane } : profile.node;
  const doc = withNode(withNode(emptyDoc(), node), { kind: 'extrude', sketch: 0, height: 10 });
  const [body] = partBreps(doc);
  assert.ok(body && checkBrep(body.brep, { strict: true }).valid);
  for (const id of ids) {
    assert.equal(body.brep.faces.filter(face => face.name === `n1.side[${id}]`).length, 1, id);
  }
  if (direction === -1 || reverse) {
    const axis = direction === -1 ? 1 : 2, ordinateAxis = direction === -1 ? 2 : 1;
    for (const [id, point, radius] of [[filletId, center, r], ['e2', sourceCenter, R]] as const) {
      const face = body.brep.faces.find(f => f.name === `n1.side[${id}]`);
      assert.ok(face);
      const cylinder = faceGeometry(face);
      assert.equal(cylinder.kind, 'cylinder');
      nearPoint([cylinder.c[0], cylinder.c[ordinateAxis]], [point[0], point[1]]);
      near(cylinder.a[0], 0);
      near(cylinder.a[axis], 1);
      near(cylinder.a[ordinateAxis], 0);
      near(cylinder.r, radius);
    }
    for (const [name, sign] of [['bottom', 1], ['top', -1]] as const) {
      const face = body.brep.faces.find(f => f.name === `n1.${name}`);
      assert.ok(face);
      const cap = faceGeometry(face);
      assert.equal(cap.kind, 'plane');
      near(cap.o[axis], direction === -1 ? 5 * sign : sign > 0 ? 0 : 10);
      near(cap.n[0], 0);
      near(cap.n[axis], direction === -1 ? sign : -sign);
      near(cap.n[ordinateAxis], 0);
    }
  }
  const points = [a, line, join, b, d];
  const polygonArea = points.reduce((sum, [x0, y0], i) => {
    const [x1, y1] = points[(i + 1) % points.length];
    return sum + (x0 * y1 - y0 * x1) / 2;
  }, 0);
  const area = direction * polygonArea + r * r * (roundSweep - Math.sin(roundSweep)) / 2
    + R * R * (sourceSweep - Math.sin(sourceSweep)) / 2;
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

test('clockwise line–arc Round preserves reflected XZ geometry through both radius edit routes and reopen', () => {
  const source: Polygon = {
    ...pinned(), points: [[0, 20], [40, 20], [20, 0], [0, 0]], bulges: [0, -Math.tan(Math.PI / 8), 0, 0],
    rules: [{ kind: 'fix', point: 2, at: [20, 0] }],
  };
  const before = structuredClone(source), rounded = roundCorner(source, 1, 3);
  if ('error' in rounded) assert.fail(rounded.error);
  assert.deepEqual(source, before);
  let current = rounded.shape;
  assert.deepEqual(current.ids, ['e1', '', 'e2', 'e3', 'e4']);
  assert.deepEqual(current.rules, [{ kind: 'fix', point: 3, at: [20, 0] }]);
  assert.deepEqual(current.hv, { h: [0, 3], v: [4] });
  assert.deepEqual(current.tangents, [1, 2, 3]);
  checkRoundedGeometry(current, 3, -1);

  for (const radius of [4, 5]) {
    const locked = settleShape({ ...current, radii: { ...current.radii, 1: radius } }, current);
    assert.equal(locked.error, null);
    const edited = commitDimension(current, 'rad1', radius);
    if (!edited.ok) assert.fail(edited.reason);
    const settled = settleShape(edited.shape, current);
    assert.equal(settled.error, null);
    assert.equal(settled.shape?.kind, 'polygon');
    assert.deepEqual(settled.shape, locked.shape);
    assert.deepEqual(settled.shape.ids, current.ids);
    assert.deepEqual(settled.shape.radii, { 1: radius, 2: 20 });
    checkRoundedGeometry(settled.shape, radius, -1);
    const profile = profileOf([settled.shape]);
    assert.ok('node' in profile);
    const { shape } = sketchShapes({ ...profile.node, plane: xzPlane });
    assert.equal(shape?.kind, 'polygon');
    assert.deepEqual(shape.ids, ['e1', 'e5', 'e2', 'e3', 'e4']);
    current = shape;
  }

  assert.ok('error' in roundCorner(source, 1, 10));
  const oversized = commitDimension(current, 'rad1', 10);
  assert.ok(!oversized.ok);
  assert.match(oversized.reason, /does not fit on both finite sides/);
  const locked = settleShape({ ...current, radii: { ...current.radii, 1: 10 } }, current);
  assert.equal(locked.shape, current);
  assert.match(locked.error ?? '', /does not fit on both finite sides/);

  const bulges = [...current.bulges!];
  bulges[2] = -bulges[2];
  const mixed = settleShape({ ...current, bulges, radii: { ...current.radii, 1: 4 } }, current);
  assert.equal(mixed.shape, current);
  assert.match(mixed.error ?? '', /keep both arcs in their original direction/);
});

test('pinned source-radius edits replan both tangencies and refuse the exact finite limit in both windings', () => {
  for (const direction of [1, -1] as const) {
    const datum = direction === 1 ? 0 : 20, endY = datum + direction * 20;
    const source: Polygon = {
      ...pinned(), points: [[0, datum], [40, datum], [20, endY], [0, endY]],
      bulges: [0, direction * Math.tan(Math.PI / 8), 0, 0], rules: [{ kind: 'fix', point: 2, at: [20, endY] }],
    };
    const rounded = roundCorner(source, 1, 4);
    if ('error' in rounded) assert.fail(rounded.error);
    const before = structuredClone(rounded.shape);
    const panel = settleShape({ ...rounded.shape, radii: { 1: 4, 2: 16 } }, rounded.shape);
    assert.equal(panel.error, null);
    assert.equal(panel.shape?.kind, 'polygon');
    assert.deepEqual(rounded.shape, before);
    assert.deepEqual(panel.shape.radii, { 1: 4, 2: 16 });
    assert.deepEqual(panel.shape.ids, rounded.shape.ids);
    assert.deepEqual(panel.shape.rules, [{ kind: 'fix', point: 3, at: [20, endY] }]);
    assert.deepEqual(panel.shape.hv, { h: [0, 3], v: [4] });
    assert.deepEqual(panel.shape.tangents, [1, 2, 3]);
    checkRoundedGeometry(panel.shape, 4, direction, 16, datum);

    const unlocked = checkEdit({ ...panel.shape, radii: { 1: 4 } }, panel.shape);
    if (!unlocked.ok) assert.fail(unlocked.reason);
    assert.deepEqual(unlocked.shape.radii, { 1: 4 });
    const beforeRelock = structuredClone(unlocked.shape);
    const invalidRelock = commitDimension(unlocked.shape, 'rad2', 10);
    assert.ok(!invalidRelock.ok);
    assert.match(invalidRelock.reason, /does not fit on both finite sides/);
    const refusedRelock = settleShape({ ...unlocked.shape, radii: { 1: 4, 2: 10 } }, unlocked.shape);
    assert.equal(refusedRelock.shape, unlocked.shape);
    assert.match(refusedRelock.error ?? '', /does not fit on both finite sides/);
    assert.deepEqual(unlocked.shape, beforeRelock);
    const relocked = settleShape({ ...unlocked.shape, radii: { 1: 4, 2: 18 } }, unlocked.shape);
    assert.equal(relocked.error, null);
    assert.equal(relocked.shape?.kind, 'polygon');
    assert.deepEqual(relocked.shape.radii, { 1: 4, 2: 18 });
    assert.deepEqual(relocked.shape.ids, unlocked.shape.ids);
    checkRoundedGeometry(relocked.shape, 4, direction, 18, datum);

    const profile = profileOf([panel.shape]);
    assert.ok('node' in profile);
    const { shape: opened } = sketchShapes(profile.node);
    assert.equal(opened?.kind, 'polygon');
    const ids = ['e1', 'e5', 'e2', 'e3', 'e4'];
    assert.deepEqual(opened.ids, ids);
    for (const radius of [10, 9]) {
      const invalid = commitDimension(opened, 'rad2', radius);
      assert.ok(!invalid.ok);
      assert.match(invalid.reason, /does not fit on both finite sides/);
      const refused = settleShape({ ...opened, radii: { 1: 4, 2: radius } }, opened);
      assert.equal(refused.shape, opened);
      assert.match(refused.error ?? '', /does not fit on both finite sides/);
    }

    const edited = commitDimension(opened, 'rad2', 18);
    if (!edited.ok) assert.fail(edited.reason);
    const final = settleShape(edited.shape, opened);
    assert.equal(final.error, null);
    assert.equal(final.shape?.kind, 'polygon');
    assert.deepEqual(final.shape.ids, ids);
    assert.deepEqual(final.shape.radii, { 1: 4, 2: 18 });
    assert.deepEqual(final.shape.rules, opened.rules);
    checkRoundedGeometry(final.shape, 4, direction, 18, datum);
  }
});

test('reverse pinned arc–line Round preserves authored order, radii and native wall names', () => {
  const source = reversedPinned();
  const before = structuredClone(source), rounded = roundCorner(source, 3, 3);
  if ('error' in rounded) assert.fail(rounded.error);
  const first = rounded.shape;
  assert.deepEqual(source, before);
  assert.deepEqual(first.ids, ['e4', 'e3', 'e2', '', 'e1']);
  assert.deepEqual(first.rules, source.rules);
  assert.deepEqual(first.hv, { h: [1, 4], v: [0] });
  assert.deepEqual(first.tangents, [2, 3, 4]);
  assert.deepEqual(first.radii, { 2: 20, 3: 3 });
  checkRoundedGeometry(first, 3, 1, 20, 20, true);
  assert.ok('error' in roundCorner(source, 3, 10));
  assert.ok('error' in roundCorner({ ...source, lengths: { 3: 40 } }, 3, 3));
  assert.ok('error' in roundCorner({ ...source, hv: { h: [0, 2], v: [3] } }, 3, 3));

  const panel = settleShape({ ...first, radii: { 2: 20, 3: 4 } }, first);
  assert.equal(panel.error, null);
  assert.equal(panel.shape?.kind, 'polygon');
  const profile = profileOf([panel.shape]);
  assert.ok('node' in profile);
  const { shape: opened } = sketchShapes(profile.node);
  assert.equal(opened?.kind, 'polygon');
  const ids = ['e4', 'e3', 'e2', 'e5', 'e1'];
  assert.deepEqual(opened.ids, ids);
  checkRoundedGeometry(opened, 4, 1, 20, 20, true);

  for (const index of [2, 3]) {
    const invalid = commitDimension(opened, `rad${index}`, 10);
    assert.ok(!invalid.ok);
    assert.match(invalid.reason, /does not fit on both finite sides/);
    const locked = settleShape({ ...opened, radii: { ...opened.radii, [index]: 10 } }, opened);
    assert.equal(locked.shape, opened);
    assert.match(locked.error ?? '', /does not fit on both finite sides/);
  }
  const filletEdit = commitDimension(opened, 'rad3', 5);
  if (!filletEdit.ok) assert.fail(filletEdit.reason);
  const r5 = settleShape(filletEdit.shape, opened);
  assert.equal(r5.error, null);
  assert.equal(r5.shape?.kind, 'polygon');
  assert.deepEqual(r5.shape.ids, ids);
  assert.deepEqual(r5.shape.radii, { 2: 20, 3: 5 });
  checkRoundedGeometry(r5.shape, 5, 1, 20, 20, true);

  const sourceEdit = commitDimension(opened, 'rad2', 16);
  if (!sourceEdit.ok) assert.fail(sourceEdit.reason);
  const r16 = settleShape(sourceEdit.shape, opened);
  assert.equal(r16.error, null);
  assert.equal(r16.shape?.kind, 'polygon');
  assert.deepEqual(r16.shape.ids, ids);
  assert.deepEqual(r16.shape.radii, { 2: 16, 3: 4 });
  checkRoundedGeometry(r16.shape, 4, 1, 16, 20, true);

  const clear = settleShape({ ...r16.shape, radii: { 3: 4 } }, r16.shape);
  assert.equal(clear.error, null);
  assert.equal(clear.shape?.kind, 'polygon');
  assert.deepEqual(clear.shape.radii, { 3: 4 });
  const invalid = commitDimension(clear.shape, 'rad2', 10);
  assert.ok(!invalid.ok);
  assert.match(invalid.reason, /does not fit on both finite sides/);
  const relocked = commitDimension(clear.shape, 'rad2', 18);
  if (!relocked.ok) assert.fail(relocked.reason);
  assert.deepEqual(relocked.shape.ids, ids);
  checkRoundedGeometry(relocked.shape, 4, 1, 18, 20, true);
});

test('pinned Round guards the fillet radius when re-locking in either traversal', () => {
  for (const reverse of [false, true]) {
    const index = reverse ? 3 : 1, key = `rad${index}`;
    const rounded = roundCorner(reverse ? reversedPinned() : pinned(), index, 4);
    if ('error' in rounded) assert.fail(rounded.error);
    const { shape: unlocked, error } = settleShape(removeConstraint(rounded.shape, `rad:${index}`), rounded.shape);
    assert.equal(error, null);
    assert.equal(unlocked?.kind, 'polygon');
    assert.deepEqual(unlocked.radii, { 2: 20 });
    assert.deepEqual(unlocked.ids, rounded.shape.ids);
    const profile = profileOf([unlocked]);
    assert.ok('node' in profile);
    const { shape: opened } = sketchShapes(profile.node);
    assert.equal(opened?.kind, 'polygon');
    assert.deepEqual(opened.radii, { 2: 20 });
    assert.deepEqual(opened.ids, reverse ? ['e4', 'e3', 'e2', 'e5', 'e1'] : ['e1', 'e5', 'e2', 'e3', 'e4']);
    checkRoundedGeometry(opened, 4, 1, 20, 20, reverse);

    const before = structuredClone(opened);
    for (const radius of [9.99999999, 10]) {
      const inline = commitInlineDimension(opened, key, radius);
      assert.ok(!inline.ok);
      assert.match(inline.reason, /does not fit on both finite sides/);
      const panel = settleShape({ ...opened, radii: { 2: 20, [index]: radius } }, opened);
      assert.equal(panel.shape, opened);
      assert.match(panel.error ?? '', /does not fit on both finite sides/);
    }
    assert.deepEqual(opened, before);

    const radius = 5.0000004;
    const inline = commitInlineDimension(opened, key, radius);
    if (!inline.ok) assert.fail(inline.reason);
    const final = settleShape(inline.shape, opened);
    const panel = settleShape({ ...opened, radii: { 2: 20, [index]: radius } }, opened);
    assert.equal(panel.error, null);
    assert.equal(final.error, null);
    assert.equal(final.shape?.kind, 'polygon');
    assert.deepEqual(final.shape, panel.shape);
    assert.deepEqual(final.shape.ids, opened.ids);
    assert.deepEqual(final.shape.radii, { 2: 20, [index]: radius });
    checkRoundedGeometry(final.shape, radius, 1, 20, 20, reverse);

    const bothUnlocked = settleShape(removeConstraint(opened, 'rad:2'), opened);
    assert.equal(bothUnlocked.error, null);
    assert.equal(bothUnlocked.shape?.kind, 'polygon');
    assert.deepEqual(bothUnlocked.shape.radii, {});
    const noLocks = bothUnlocked.shape;
    for (const radius of [9.99999999, 10]) {
      const filletFirstRefusal = commitInlineDimension(noLocks, key, radius);
      assert.ok(!filletFirstRefusal.ok);
      assert.match(filletFirstRefusal.reason, /does not fit on both finite sides/);
      const refusedPanel = settleShape({ ...noLocks, radii: { [index]: radius } }, noLocks);
      assert.equal(refusedPanel.shape, noLocks);
      assert.match(refusedPanel.error ?? '', /does not fit on both finite sides/);
    }
    const filletFirst = commitInlineDimension(noLocks, key, 5);
    if (!filletFirst.ok) assert.fail(filletFirst.reason);
    assert.deepEqual(filletFirst.shape.radii, { [index]: 5 });
    const lockedBoth = commitDimension(filletFirst.shape, 'rad2', 20);
    if (!lockedBoth.ok) assert.fail(lockedBoth.reason);
    assert.deepEqual(lockedBoth.shape.ids, noLocks.ids);
    checkRoundedGeometry(lockedBoth.shape, 5, 1, 20, 20, reverse);
    assert.equal(planPinnedLineArcRadiusEdit({ ...bothUnlocked.shape, radii: { 2: 20 } }, bothUnlocked.shape), null);
    const sourceFirst = commitDimension(bothUnlocked.shape, 'rad2', 20);
    if (!sourceFirst.ok) assert.fail(sourceFirst.reason);
    assert.deepEqual(sourceFirst.shape.radii, { 2: 20 });
    const second = commitInlineDimension(sourceFirst.shape, key, 10);
    assert.ok(!second.ok);
    assert.match(second.reason, /does not fit on both finite sides/);
  }
});

test('pinned Round rejects the source radius limit while its fillet is unlocked', () => {
  for (const reverse of [false, true]) {
    const index = reverse ? 3 : 1;
    const rounded = roundCorner(reverse ? reversedPinned() : pinned(), index, 4);
    if ('error' in rounded) assert.fail(rounded.error);
    const { shape: openFillet } = settleShape(removeConstraint(rounded.shape, `rad:${index}`), rounded.shape);
    assert.equal(openFillet?.kind, 'polygon');
    for (const radius of [9, 10, 10.00000001]) {
      const inline = commitInlineDimension(openFillet, 'rad2', radius);
      assert.ok(!inline.ok);
      assert.match(inline.reason, /does not fit on both finite sides/);
      const panel = settleShape({ ...openFillet, radii: { 2: radius } }, openFillet);
      assert.equal(panel.shape, openFillet);
      assert.match(panel.error ?? '', /does not fit on both finite sides/);
    }
    const inline = commitInlineDimension(openFillet, 'rad2', 16);
    if (!inline.ok) assert.fail(inline.reason);
    const { shape: panel, error } = settleShape({ ...openFillet, radii: { 2: 16 } }, openFillet);
    assert.equal(error, null);
    assert.deepEqual(inline.shape, panel);
    assert.deepEqual(inline.shape.radii, { 2: 16 });
    const radius = arcOf(inline.shape.points[index], inline.shape.points[index + 1], inline.shape.bulges![index]).radius;
    assert.ok(radius > 2.57 && radius < 2.58);
    checkRoundedGeometry(inline.shape, radius, 1, 16, 20, reverse);
  }
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
  // At the top of the CCW quarter circle, both the arc tangent and the retained line point left.
  refused(source, 2, /this one has an arc/);

  // The fixed arc end and the last point coincide, leaving a zero-length retained line.
  refused({ ...source, points: [[20, 20], [40, 20], [20, 40], [20, 40]] }, 1, /convex outline/);

  const leftBranch: Polygon = {
    ...source, points: [[-10, 20], [0, 20], [20, 40], [-10, 40]],
    bulges: [0, -source.bulges![1], 0, 0],
  };
  // The other intersection with y=20 gives a clockwise quarter arc whose end tangent points right.
  // The retained line still points left, so this branch doubles back at the fixed end.
  refused(leftBranch, 1, /convex outline/);
  // The closing side x=10 intersects that arc at y=20+sqrt(300), inside both segments.
  refused({ ...leftBranch, points: [[10, 20], [0, 20], [20, 40], [10, 40]] }, 1, /convex outline/);

  // On the open reverse chain, the last point has an incoming arc and no outgoing side.
  refused({ ...reversedPinned(), closed: false }, 3, /between two edges/);
});

test('selected adjacent line and arc restore the same Round tangent joint', () => {
  for (const reverse of [false, true]) {
    const rounded = roundCorner(reverse ? reversedPinned() : pinned(), reverse ? 3 : 1, 4);
    if ('error' in rounded) assert.fail(rounded.error);
    const line = reverse ? 4 : 0, arc = reverse ? 3 : 1, joint = reverse ? 4 : 1;
    const outline = removeConstraint(rounded.shape, `tan:${joint}`);
    const pick = (i: number) => ({ kind: 'edge' as const, i });
    for (const pair of [[pick(line), pick(arc)], [pick(arc), pick(line)]]) {
      assert.equal(constraintOptions(outline, pair).tangent, null);
      const restored = applyConstraint(outline, pair, 'tangent');
      if (!restored.ok) assert.fail(restored.reason);
      assert.deepEqual(restored.shape.tangents, rounded.shape.tangents);
      assert.equal(constraintOptions(restored.shape, pair).tangent, 'Already tangent');
      checkRoundedGeometry(restored.shape, 4, 1, 20, 20, reverse);
    }
    for (const invalid of [[pick(arc), pick(arc)], [pick(arc), pick(0 === line ? 4 : 0)], [pick(arc), pick(7)], [pick(arc), pick(2)]]) {
      assert.ok(constraintOptions(outline, invalid).tangent);
      assert.equal(applyConstraint(outline, invalid, 'tangent').ok, false);
    }
  }
  const wrap: Polygon = { kind: 'polygon', closed: true, points: [[4, 0], [40, 0], [40, 30], [0, 30], [0, 4]],
    bulges: [0, 0, 0, 0, Math.SQRT2 - 1], hv: { h: [0, 2], v: [1, 3] } };
  const seam = applyConstraint(wrap, [{ kind: 'edge', i: 4 }, { kind: 'edge', i: 0 }], 'tangent');
  if (!seam.ok) assert.fail(seam.reason);
  assert.deepEqual(seam.shape.tangents, [0]);
});
