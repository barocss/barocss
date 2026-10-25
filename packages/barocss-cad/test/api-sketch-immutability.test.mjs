// Source regression cases. Execution is deferred until the API improvement bundle is complete.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Plane, Location, Sketch, sketch } from '../dist/api/index.js';

test('built-in plane and location tuples cannot change shared construction inputs', () => {
  const tuples = [Plane.XY.origin, Plane.XY.normal, Plane.XY.xAxis,
    Plane.XZ.origin, Plane.XZ.normal, Plane.XZ.xAxis,
    Plane.YZ.origin, Plane.YZ.normal, Plane.YZ.xAxis,
    Location.IDENTITY.position, Location.IDENTITY.rotation];
  // Check every tuple before attempting writes, so a failure cannot corrupt a shared constant.
  for (const tuple of tuples) assert.ok(Object.isFrozen(tuple));
  for (const tuple of tuples) {
    const before = [...tuple];
    assert.throws(() => { tuple[0] = 99; }, TypeError);
    assert.throws(() => tuple.push(99), TypeError);
    assert.deepEqual(tuple, before);
  }
  assert.deepEqual(sketch().rectangle({ w: 2, d: 3 }).data, {
    profile: 'rectangle', min: [0, 0], max: [2, 3], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] },
  });
  assert.deepEqual(Location.IDENTITY.data, { position: [0, 0, 0], rotation: [0, 0, 0] });
});

test('custom planes and locations copy inputs, freeze tuples and return editable detached data', () => {
  const input = { origin: [1, 2, 3], normal: [0, 0, 1], xAxis: [1, 0, 0] };
  const pose = { position: [4, 5, 6], rotation: [10, 20, 30] };
  const plane = Plane.of(input), location = Location.of(pose), offset = plane.offset(7);
  input.origin[0] = 99; input.normal[0] = 99; input.xAxis[0] = 99;
  pose.position[0] = 99; pose.rotation[0] = 99;
  assert.deepEqual(plane.data, { origin: [1, 2, 3], normal: [0, 0, 1], xAxis: [1, 0, 0] });
  assert.deepEqual(location.data, { position: [4, 5, 6], rotation: [10, 20, 30] });
  assert.deepEqual(offset.origin, [1, 2, 10]);
  for (const tuple of [plane.origin, plane.normal, plane.xAxis, offset.origin, offset.normal, offset.xAxis, location.position, location.rotation]) {
    assert.ok(Object.isFrozen(tuple));
    assert.throws(() => { tuple[0] = 99; }, TypeError);
  }
  const plainPlane = plane.data, plainPose = location.data;
  plainPlane.origin[0] = 44; plainPose.position[0] = 44;
  assert.equal(plane.origin[0], 1);
  assert.equal(location.position[0], 4);
  assert.equal(Object.isFrozen(input.origin), false);
  assert.equal(Object.isFrozen(pose.position), false);
});

test('Sketch snapshots every profile and nested placement/tag data without freezing caller data', () => {
  const profiles = [
    { profile: 'rectangle', min: [0, 0], max: [2, 3] },
    { profile: 'circle', center: [1, 2], radius: 3 },
    { profile: 'polygon', points: [[0, 0], [2, 0], [0, 3]] },
    { profile: 'loop', segments: [
      { kind: 'line', start: [0, 0] },
      { kind: 'arc', start: [2, 0], center: [1, 0], direction: 'ccw' },
    ] },
  ];
  for (const profile of profiles) {
    const input = { ...profile, plane: Plane.XZ.data, sideTags: { outer: ['a', 'b', 'c'] } };
    const expected = structuredClone(input), built = new Sketch(input);
    input.plane.origin[0] = 99; input.sideTags.outer[0] = 'changed';
    if (input.profile === 'rectangle') input.min[0] = 99;
    if (input.profile === 'circle') { input.center[0] = 99; input.radius = 99; }
    if (input.profile === 'polygon') input.points[0][0] = 99;
    if (input.profile === 'loop') { input.segments[1].center[0] = 99; input.segments[0].start[0] = 99; }
    assert.deepEqual(built.data, expected);
    const returned = built.data;
    returned.plane.origin[0] = 88; returned.sideTags.outer.push('extra');
    assert.deepEqual(built.data, expected);
    assert.notEqual(built.data, built.data);
    assert.equal(Object.isFrozen(input.sideTags.outer), false);
  }
});
