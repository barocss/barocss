// Regression source only: execution waits until the API improvement group is complete.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BarocssError, Robot, RobotPath } from '../src/api';
import type { StudioDoc } from '../src/engine/doc';
import type { MotionPath } from '../src/robot/motion';

const robot = () => new Robot(JSON.parse(readFileSync(join(import.meta.dirname, '../samples/robots/scara.bcad'), 'utf8')) as StudioDoc);
const rates = { default: { velocity: 90, acceleration: 180 } };

test('open-chain motion rejects nonfinite waypoints before timing or interpolation', () => {
  for (const key of ['base~arm1', 'arm2~quill']) for (const bad of [NaN, Infinity, -Infinity]) {
    for (const at of [0, 1]) {
      const waypoints = [{ [key]: 0 }, { [key]: 10 }];
      waypoints[at][key] = bad;
      const path = robot().path(waypoints, { limits: rates }), problems = path.problems();
      assert.equal(problems.length, 1);
      assert.equal(problems[0].code, 'VALUE');
      assert.ok(problems[0].message.includes(key));
      for (const invoke of [() => path.duration(), () => path.poseAt(0), () => path.poseAt(1)]) {
        assert.throws(invoke, (error: unknown) => error instanceof BarocssError && error.code === 'VALUE'
          && error.message === problems[0].message && error.where === 'facade');
      }
    }
  }
});

test('finite open-chain motion keeps degree/mm and zero-distance timing', () => {
  const r = robot(), path = r.path([{}, { 'base~arm1': 90, 'arm2~quill': -30 }], { limits: rates });
  assert.deepEqual(path.problems(), []);
  assert.ok(Math.abs(path.duration() - 1.5) <= 1e-12);
  const end = path.poseAt(1.5);
  assert.ok(Math.abs(end['base~arm1'] - 90) <= 1e-9);
  assert.ok(Math.abs(end['arm2~quill'] + 30) <= 1e-9);
  const still = r.path([{ 'base~arm1': 0 }, { 'base~arm1': 0 }]);
  assert.deepEqual(still.problems(), []);
  assert.equal(still.duration(), 0);
  assert.deepEqual(still.poseAt(0), { 'base~arm1': 0 });
});

test('supplied nonfinite motion rates are typed refusals before playback or saving', () => {
  for (const profile of ['trapezoid', 's-curve'] as const) {
    for (const field of ['velocity', 'acceleration', 'jerk'] as const) for (const bad of [NaN, Infinity, -Infinity]) {
      const r = robot(), before = r.doc;
      const limits = { default: { velocity: 90, acceleration: 180, jerk: 360 } };
      limits.default[field] = bad;
      const path = r.path([{}, { 'base~arm1': 90 }], { profile, limits });
      const problems = path.problems();
      assert.equal(problems.length, 1);
      assert.equal(problems[0].code, 'LIMITS_BAD');
      assert.ok(problems[0].message.includes(`default.${field}`));
      for (const invoke of [() => path.duration(), () => path.poseAt(0), () => r.withMotion('bad-rates', path)]) {
        assert.throws(invoke, (error: unknown) => error instanceof BarocssError && error.code === 'LIMITS_BAD'
          && error.message === problems[0].message);
      }
      assert.deepEqual(r.doc, before);
    }
  }
});

test('zero and negative rates retain the existing core refusal for a moving joint', () => {
  for (const field of ['velocity', 'acceleration'] as const) for (const bad of [0, -1]) {
    const limits = { default: { velocity: 90, acceleration: 180 } };
    limits.default[field] = bad;
    const path = robot().path([{}, { 'base~arm1': 90 }], { limits });
    assert.deepEqual(path.problems().map(p => p.code), ['LIMITS_MISSING']);
    assert.throws(() => path.duration(), (error: unknown) => error instanceof BarocssError && error.code === 'LIMITS_MISSING');
  }
});

test('malformed path containers have the same typed boundary for reading and saving', () => {
  const cases: [unknown, string][] = [
    [null, 'VALUE'], [[], 'VALUE'], [{}, 'VALUE'], [{ waypoints: null }, 'VALUE'],
    [{ waypoints: new Array(2) }, 'VALUE'],
    [{ waypoints: [null] }, 'VALUE'], [{ waypoints: [[], {}] }, 'VALUE'],
    [{ waypoints: [{}, {}], limits: null }, 'LIMITS_BAD'],
    [{ waypoints: [{}, {}], limits: [] }, 'LIMITS_BAD'],
    [{ waypoints: [{}, {}], limits: { default: null } }, 'LIMITS_BAD'],
    [{ waypoints: [{}, {}], limits: { 'base~arm1': [] } }, 'LIMITS_BAD'],
    [{ waypoints: [{}, {}], limits: { default: 90 } }, 'LIMITS_BAD'],
  ];
  for (const [raw, expected] of cases) {
    const r = robot(), before = r.doc, path = new RobotPath(r.doc, raw as MotionPath);
    const problems = path.problems();
    assert.equal(problems.length, 1);
    assert.equal(problems[0].code, expected);
    for (const invoke of [() => path.duration(), () => path.poseAt(0), () => r.withMotion('malformed', path)]) {
      assert.throws(invoke, (error: unknown) => error instanceof BarocssError && error.code === expected
        && error.message === problems[0].message);
    }
    assert.deepEqual(r.doc, before);
  }
});

test('Robot.path rejects malformed waypoints before spreading can erase their shape', () => {
  for (const waypoint of [null, [], 1, 'joint']) {
    assert.throws(() => robot().path([{}, waypoint] as Record<string, number>[]),
      (error: unknown) => error instanceof BarocssError && error.code === 'VALUE');
  }
  assert.throws(() => robot().path(new Array(2)), (error: unknown) => error instanceof BarocssError && error.code === 'VALUE');
  const r = robot();
  assert.throws(() => r.path([{}, {}], null as unknown as Parameters<Robot['path']>[1]),
    (error: unknown) => error instanceof BarocssError && error.code === 'VALUE');
  const path = r.path([{}, {}], { limits: null } as unknown as Parameters<Robot['path']>[1]);
  assert.deepEqual(path.problems().map(p => p.code), ['LIMITS_BAD']);
});
