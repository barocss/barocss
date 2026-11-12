import assert from 'node:assert/strict';
import test from 'node:test';
import { nearestSnap, type SnapPoint } from '@barocss/cad-model/sketch/osnap';
import { defaultObjectSnapKinds, enabledObjectSnaps, OBJECT_SNAP_KINDS, toggleObjectSnapKind } from '../src/sketch/objectSnapKinds';

const identity = (point: [number, number]) => point;

test('session snap types default on and toggle independently without changing input', () => {
  const defaults = defaultObjectSnapKinds();
  const points = OBJECT_SNAP_KINDS.map(({ kind }, i): SnapPoint => ({ at: [i, 0], kind }));
  assert.deepEqual(enabledObjectSnaps(points, defaults), points);
  for (const { kind } of OBJECT_SNAP_KINDS) {
    const filtered = toggleObjectSnapKind(defaults, kind);
    assert.ok(defaults.has(kind));
    assert.deepEqual(enabledObjectSnaps(points, filtered), points.filter(point => point.kind !== kind));
    assert.deepEqual(toggleObjectSnapKind(filtered, kind), defaults);
  }
  assert.deepEqual(enabledObjectSnaps(points, new Set()), []);
  assert.deepEqual(defaultObjectSnapKinds(), defaults);
});

test('filtering happens before nearest selection and preserves tie and reach', () => {
  const end: SnapPoint = { at: [1, 0], kind: 'end' };
  const centre: SnapPoint = { at: [3, 0], kind: 'centre' };
  const same: SnapPoint = { at: [3, 0], kind: 'mid' };
  const reach: SnapPoint = { at: [8, 0], kind: 'centre' };
  const pointer: [number, number] = [0, 0];
  const points = [end, centre, same];
  const defaults = defaultObjectSnapKinds();
  assert.equal(nearestSnap(enabledObjectSnaps(points, defaults), identity, pointer), end);
  const filtered = toggleObjectSnapKind(defaults, 'end');
  assert.equal(nearestSnap(enabledObjectSnaps(points, filtered), identity, pointer), centre);
  assert.equal(nearestSnap(enabledObjectSnaps([same, end, centre], filtered), identity, pointer), same);
  assert.equal(nearestSnap(enabledObjectSnaps([end, reach], filtered), identity, pointer), null);
  assert.equal(nearestSnap(enabledObjectSnaps(points, new Set()), identity, pointer), null);
});
