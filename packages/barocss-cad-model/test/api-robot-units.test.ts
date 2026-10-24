// Independent public-unit checks. Do not use a facade conversion as the expected value.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Robot } from '../src/api';
import type { StudioDoc } from '../src/engine/doc';
import { viewOf } from '../src/api/robotCore';
import { poseOf as corePose } from '../src/robot/verbs';

const robot = (name: string) => new Robot(JSON.parse(readFileSync(join(import.meta.dirname, `../samples/robots/${name}.bcad`), 'utf8')) as StudioDoc);
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);

test('pose accepts and returns degrees for turns and mm for slides; the core still returns radians', () => {
  const r = robot('scara'), before = JSON.stringify(r.doc);
  const p = r.pose({ 'base~arm1': 90, 'arm2~quill': -30 });
  close(p.values['base~arm1'], 90);
  close(p.values['arm2~quill'], -30);
  const internal = corePose(viewOf(r.doc), { 'base~arm1': Math.PI / 2, 'arm2~quill': -30 }).reply;
  close(internal.values['base~arm1'], Math.PI / 2);
  close(internal.values['arm2~quill'], -30);
  assert.deepEqual(p.links, internal.links);
  assert.equal(JSON.stringify(r.doc), before);
});

for (const [name, leader, follower, input, expected] of [
  ['gripper', 'base~left', 'base~right', 25, -25],
  ['gear-joint', 'base~g1', 'base~g2', 30, -20],
] as const) {
  test(`${name}: pose returns the coupled follower in degrees`, t => {
    const r = robot(name), p = r.pose({ [leader]: input });
    t.diagnostic(JSON.stringify({ input, leader: p.values[leader], follower: p.values[follower], expected }));
    close(p.values[leader], input);
    close(p.values[follower], expected);
    assert.equal(p.gears[0].held, true);
    const internal = corePose(viewOf(r.doc), { [leader]: input * Math.PI / 180 }).reply;
    close(internal.values[follower], expected * Math.PI / 180);
    assert.deepEqual(p.links, internal.links);
  });
}

test('a timed path returns degrees and mm that pose accepts without another conversion', () => {
  const r = robot('scara'), path = r.path([{}, { 'base~arm1': 60, 'arm2~quill': -30 }], {
    limits: { default: { velocity: 90, acceleration: 180 } },
  });
  assert.deepEqual(path.problems(), []);
  const end = path.poseAt(path.duration()), p = r.pose(end);
  close(end['base~arm1'], 60); close(end['arm2~quill'], -30);
  close(p.values['base~arm1'], 60); close(p.values['arm2~quill'], -30);
  assert.deepEqual(path.motion.waypoints, [{}, { 'base~arm1': 60, 'arm2~quill': -30 }]);
});

test('pose reports an 80 degree tilt past the 60 degree stop without changing internal radian limits', () => {
  const r = robot('pan-tilt'), before = JSON.stringify(r.doc), p = r.pose({ 'pan~tilt': 80 });
  close(p.values['pan~tilt'], 80);
  assert.deepEqual(p.out_of_limits, ['pan~tilt']);
  const joint = r.joints().joints.find(j => j.key === 'pan~tilt')!;
  close(joint.limit!.lower!, -Math.PI / 3);
  close(joint.limit!.upper!, Math.PI / 3);
  assert.equal(JSON.stringify(r.doc), before);
});
