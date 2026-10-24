// RS2: a robot's motions — poseAt and duration on ccd's timing (what plays is what Check path checks), checkPath's
// refusals, the saved motion's degrees ⇄ the timed path's radians, and robot.motions read back from a document. The
// 2R chain of the kernel's RM conformance (chain-2r); the trapezoid's closed form as the oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { treeOfDoc } from '../src/chat/robot';
import { readRobot, type JointTree } from '../src/robot/joints';
import { timePath, type TimedPath } from '../src/robot/ccd';
import { checkPath, duration, motionNamed, motionOf, poseAt, readMotions, timedPathOf } from '../src/robot/motion';

const CASES = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function chain(): Promise<{ doc: StudioDoc; tree: JointTree; keys: string[] }> {
  const doc: StudioDoc = JSON.parse(readFileSync(join(CASES, 'chain-2r', 'case.json'), 'utf8')).input.document;
  const r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate), keys = tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key);
  assert.equal(keys.length, 2, 'two moving joints');
  return { doc, tree, keys };
}
const near = (a: number, b: number, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('RS2: one segment — the trapezoid\'s closed form (v 1, a 2 over 1 rad: 0.5 s up, 0.5 s cruise, 0.5 s down)', async () => {
  const { tree, keys: [j1, j2] } = await chain();
  const path: TimedPath = { waypoints: [{}, { [j1]: 1 }], profile: 'trapezoid', limits: { default: { v: 1, a: 2 } } };
  near(duration(path), 1.5);
  near(poseAt(tree, path, 0)[j1], 0);
  near(poseAt(tree, path, 0.25)[j1], 0.5 * 2 * 0.25 ** 2);
  near(poseAt(tree, path, 0.75)[j1], 0.25 + 1 * 0.25);
  near(poseAt(tree, path, 1.5)[j1], 1);
  near(poseAt(tree, path, 9)[j1], 1, 0); // (clamped to the end)
  near(poseAt(tree, path, -1)[j1], 0, 0);
  assert.equal(poseAt(tree, path, 0.5)[j2] ?? 0, 0, 'a joint no waypoint moves stays');
});

test('RS2: three waypoints — each segment on its own profile, the waypoints met at the segments\' ends, as timePath times them', async () => {
  const { tree, keys: [j1, j2] } = await chain();
  const path: TimedPath = { waypoints: [{}, { [j1]: 1 }, { [j1]: 1, [j2]: -0.5 }], profile: 'trapezoid', limits: { default: { v: 1, a: 2 } } };
  const segs = timePath(tree, path), end0 = segs[0].t0 + segs[0].duration;
  near(duration(path), segs[1].t0 + segs[1].duration);
  near(poseAt(tree, path, end0)[j1], 1); near(poseAt(tree, path, end0)[j2] ?? 0, 0);
  const last = poseAt(tree, path, duration(path)); near(last[j1], 1); near(last[j2], -0.5);
  // (In the second segment j1 stays put while j2 moves.)
  near(poseAt(tree, path, end0 + segs[1].duration / 2)[j1], 1);
});

test('RS2: checkPath — unknown joints, waypoints past a limit, missing limits, a single waypoint', async () => {
  const { tree, keys: [j1] } = await chain();
  const limited = { ...tree, joints: tree.joints.map(j => j.key === j1 ? { ...j, limit: { lower: -1, upper: 1 } } : j) };
  assert.deepEqual(checkPath(limited, { waypoints: [{}, { [j1]: 0.5 }], profile: 'trapezoid', limits: { default: { v: 1, a: 1 } } }), []);
  const codes = (p: TimedPath, t = limited) => checkPath(t, p).map(x => x.code);
  assert.deepEqual(codes({ waypoints: [{}, { [j1]: 2 }], profile: 'trapezoid', limits: { default: { v: 1, a: 1 } } }), ['JOINT_LIMIT']);
  assert.deepEqual(codes({ waypoints: [{}, { nope: 1 }], profile: 'trapezoid', limits: { default: { v: 1, a: 1 } } }), ['JOINT_UNKNOWN']);
  assert.deepEqual(codes({ waypoints: [{}, { [j1]: 0.5 }], profile: 'trapezoid', limits: {} }), ['LIMITS_MISSING']);
  assert.deepEqual(codes({ waypoints: [{}], profile: 'trapezoid', limits: {} }), ['PATH_TOO_SHORT']);
});

test('RS2: a saved motion in degrees ⇄ the timed path in radians; robot.motions read from a document', async () => {
  const { doc, tree, keys: [j1] } = await chain();
  const saved = { waypoints: [{}, { [j1]: 90 }], profile: 'trapezoid' as const, limits: { default: { velocity: 45, acceleration: 90 }, [j1]: { velocity: 30, acceleration: 60 } } };
  const p = timedPathOf(tree, saved);
  near(p.waypoints[1][j1], Math.PI / 2);
  near(p.limits[j1]!.v, 30 * Math.PI / 180); near(p.limits.default!.v, 45, 0);
  const back = motionOf(tree, p);
  near(back.waypoints[1][j1], 90, 1e-12); near(back.limits![j1].velocity, 30, 1e-12);
  const read = readRobot({ ...doc.robot, version: 1, motions: [{ name: 'wave', path: saved }, { name: '', path: saved }, { nope: true }] });
  assert.deepEqual(read.motions?.map(m => m.name), ['wave'], 'malformed motions dropped, the rest kept');
  assert.equal(motionNamed(read.motions, 'wave').path.waypoints.length, 2);
  assert.throws(() => motionNamed(read.motions, 'other'), { code: 'MOTION_UNKNOWN', message: /^\[MOTION_UNKNOWN\] no motion other \(motions: wave\)$/ });
  assert.equal(readMotions('x'), undefined);
});
