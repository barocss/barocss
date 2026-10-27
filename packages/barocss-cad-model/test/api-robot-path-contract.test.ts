// Source-only regression cases: expected units/timing and refusal codes do not come from facade conversions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BarocssError, Robot, RobotPath } from '../src/api';
import type { StudioDoc } from '../src/engine/doc';
import type { MotionPath } from '../src/robot/motion';

const robot = (name: string) => new Robot(JSON.parse(readFileSync(join(import.meta.dirname, `../samples/robots/${name}.bcad`), 'utf8')) as StudioDoc);
const rates = () => ({ default: { velocity: 90, acceleration: 180 } });
const code = (expected: string) => (e: unknown) => e instanceof BarocssError && e.code === expected;
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);

test('direct RobotPath snapshots nested waypoints, limits and profile at construction', () => {
  const r = robot('scara');
  const input: MotionPath = { waypoints: [{}, { 'base~arm1': 90, 'arm2~quill': -30 }], profile: 'trapezoid', limits: rates() };
  const path = new RobotPath(r.doc, input);
  input.waypoints[1]['base~arm1'] = 10;
  input.waypoints.push({ 'arm2~quill': -100 });
  input.limits!.default.velocity = 1;
  input.profile = 's-curve';
  assert.deepEqual(path.motion, { waypoints: [{}, { 'base~arm1': 90, 'arm2~quill': -30 }], profile: 'trapezoid', limits: rates() });
  // Turn: 0.5 s acceleration + 0.5 s cruise + 0.5 s braking. The 30 mm slide shares this slower turn's timing.
  close(path.duration(), 1.5);
  assert.deepEqual(path.poseAt(1.5), { 'base~arm1': 90, 'arm2~quill': -30 });
});

test('motion and waypoints getters return independent copies of the constructor snapshot', () => {
  const path = new RobotPath(robot('scara').doc, { waypoints: [{}, { 'base~arm1': 90 }], limits: rates() });
  const copy = path.motion;
  copy.waypoints[1]['base~arm1'] = -90;
  copy.limits!.default.acceleration = 1;
  const waypoints = path.waypoints as Record<string, number>[];
  waypoints[1]['base~arm1'] = 45;
  assert.deepEqual(path.motion, { waypoints: [{}, { 'base~arm1': 90 }], limits: rates() });
  close(path.poseAt(0.5)['base~arm1'], 22.5);
});

test('duration and poseAt refuse unknown joints with the same first problem and details', () => {
  const path = robot('scara').path([{ missing: 0 }, { missing: 90 }], { limits: rates() });
  const problems = path.problems();
  assert.deepEqual(problems.map(p => p.code), ['JOINT_UNKNOWN', 'JOINT_UNKNOWN']);
  for (const invoke of [() => path.duration(), () => path.poseAt(0)]) {
    assert.throws(invoke, (e: unknown) => {
      assert.ok(e instanceof BarocssError);
      assert.equal(e.code, 'JOINT_UNKNOWN');
      assert.equal(e.message, problems[0].message);
      assert.equal(e.where, 'evaluate');
      assert.deepEqual(e.details, { problems });
      return true;
    });
  }
});

test('duration refuses a gear follower rather than timing an independent follower move', () => {
  const path = robot('gripper').path([{}, { 'base~right': 10 }], { limits: rates() });
  assert.deepEqual(path.problems().map(p => p.code), ['JOINT_MIMIC']);
  assert.throws(() => path.duration(), code('JOINT_MIMIC'));
  assert.throws(() => path.poseAt(0), code('JOINT_MIMIC'));
});

test('duration enforces public degree bounds and missing timing limits like poseAt', () => {
  const r = robot('pan-tilt').setJoints({ joints: { 'pan~tilt': { lower: -60, upper: 60 } } });
  const beyond = r.path([{}, { 'pan~tilt': 80 }], { limits: rates() });
  assert.deepEqual(beyond.problems().map(p => p.code), ['JOINT_LIMIT']);
  assert.throws(() => beyond.duration(), code('JOINT_LIMIT'));
  assert.throws(() => beyond.poseAt(0), code('JOINT_LIMIT'));
  const untimed = r.path([{}, { 'pan~tilt': 30 }]);
  assert.deepEqual(untimed.problems().map(p => p.code), ['LIMITS_MISSING']);
  assert.throws(() => untimed.duration(), code('LIMITS_MISSING'));
  assert.throws(() => untimed.poseAt(0), code('LIMITS_MISSING'));
});

test('withMotion validates the destination robot even when a path came from another robot', () => {
  const source = robot('scara');
  const path = source.path([{}, { 'base~arm1': 30 }], { limits: rates() });
  const target = robot('pan-tilt'), before = target.doc;
  assert.throws(() => target.withMotion('wrong-tree', path), code('JOINT_UNKNOWN'));
  assert.deepEqual(target.doc, before);
});

test('withMotion checks a single recorded waypoint for unknown, mimic, range and finite inputs', () => {
  const scara = robot('scara');
  assert.throws(() => scara.withMotion('unknown', new RobotPath(scara.doc, { waypoints: [{ missing: 1 }] })), code('JOINT_UNKNOWN'));
  const gripper = robot('gripper');
  assert.throws(() => gripper.withMotion('follower', new RobotPath(gripper.doc, { waypoints: [{ 'base~right': 10 }] })), code('JOINT_MIMIC'));
  const tilt = robot('pan-tilt').setJoints({ joints: { 'pan~tilt': { lower: -60, upper: 60 } } });
  assert.throws(() => tilt.withMotion('beyond', new RobotPath(tilt.doc, { waypoints: [{ 'pan~tilt': 80 }] })), code('JOINT_LIMIT'));
  assert.throws(() => scara.withMotion('infinite', new RobotPath(scara.doc, { waypoints: [{ 'base~arm1': Infinity }] })), code('VALUE'));
});

test('withMotion preserves empty, single-waypoint and untimed recording drafts', () => {
  const r = robot('scara'), before = r.doc;
  const drafts: MotionPath[] = [{ waypoints: [] }, { waypoints: [{ 'base~arm1': 30 }] }, { waypoints: [{}, { 'base~arm1': 60 }] }];
  for (const [i, draft] of drafts.entries()) {
    const saved = r.withMotion(`draft-${i}`, new RobotPath(r.doc, draft));
    assert.deepEqual(saved.motion(`draft-${i}`).motion, draft);
    assert.deepEqual(r.doc, before);
    assert.throws(() => saved.motion(`draft-${i}`).duration(), code(i < 2 ? 'PATH_TOO_SHORT' : 'LIMITS_MISSING'));
  }
});

test('withMotion snapshots the saved path and replaces only the named motion', () => {
  const r = robot('scara'), path = r.path([{}, { 'base~arm1': 90 }], { limits: rates() });
  const originalPick = r.doc.robot!.motions!.find(m => m.name === 'pick');
  assert.ok(originalPick, 'the SCARA fixture already contains pick');
  const saved = r.withMotion('turn', path).withMotion('other', path);
  const replacement = r.path([{}, { 'base~arm1': 45 }], { limits: rates() });
  const next = saved.withMotion('turn', replacement), exported = next.doc;
  const exportedTurn = exported.robot!.motions!.find(m => m.name === 'turn');
  assert.ok(exportedTurn, 'the exported copy contains the replaced turn');
  exportedTurn.path.waypoints[1]['base~arm1'] = -90;
  assert.deepEqual(next.doc.robot!.motions!.map(m => m.name), ['pick', 'turn', 'other']);
  assert.deepEqual(next.doc.robot!.motions!.find(m => m.name === 'pick'), originalPick);
  assert.deepEqual(saved.doc.robot!.motions!.find(m => m.name === 'pick'), originalPick);
  close(next.motion('turn').poseAt(100)['base~arm1'], 45);
  close(next.motion('other').duration(), 1.5);
  close(saved.motion('turn').poseAt(100)['base~arm1'], 90);
});

test('saving loop drivers retains passive-driver refusal and sweep/finite-passive-bound boundaries', () => {
  const r = robot('four-bar'), limits = rates();
  const passive = r.path([{ 'base~crank': 0, 'base~rocker': 0 }, { 'base~crank': 20, 'base~rocker': 10 }], { limits });
  assert.throws(() => r.withMotion('passive', passive), code('LOOP_PASSIVE'));
  const drivers = r.path([{}, { 'base~crank': 60 }], { limits });
  const saved = r.withMotion('drivers', drivers).motion('drivers');
  assert.deepEqual(saved.motion, drivers.motion);
  assert.throws(() => saved.check(), code('LOOP_OPEN'));
  const bounded = r.setJoints({ joints: { 'base~rocker': { lower: -180, upper: 180 } } });
  assert.throws(() => bounded.path([{}, { 'base~crank': 60 }], { limits }).duration(), code('LOOP_OPEN'));
});
