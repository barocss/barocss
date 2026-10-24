// RS5, cad-model's facade: an assembly read as a robot. Each reply — joints, a pose, a path's check, inertia, gravity
// torques, URDF and MJCF — is the agent's robot tool's on the same document, byte for byte (through dispatchTool, the
// tools without the session's gates); set_joints writes the same document; SDF and USD are the core exports the studio's
// Export menu makes. The document is the arm-6r fixture (packages/barocss-cad/conformance/rm), until RS1's samples land.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assembly, BarocssError, Robot, type StudioPart } from '../src/api';
import { part } from '../src/api';
import type { StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { robotOfDoc } from '../src/chat/robot';
import { closureOfDoc } from '../src/robot/loop';
import { exportSdf } from '../src/robot/sdf';
import { exportUsd } from '../src/robot/usd';

const CASES = resolve(import.meta.dirname, '../../barocss-cad/conformance/rm');
const arm6r = (): StudioDoc => JSON.parse(readFileSync(join(CASES, 'arm-6r', 'robot.bcad'), 'utf8'));
const robot = () => new Robot(arm6r());
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);

// (A tool's reply on the document, the text dispatchTool returns.)
async function tool(doc: StudioDoc, name: string, args: Record<string, unknown>) {
  const e = evaluateDoc(doc, 1); assert.ok(e.ok);
  const s: ChatState = { doc, bodies: e.bodies };
  const r = await dispatchTool(s, name, args, evaluate);
  assert.ok(!r.isError, `${name}: ${r.content}`);
  return r;
}
const rad = (deg: number) => deg * Math.PI / 180;
const keys = () => robot().joints().joints.map(j => j.key);
// (Some turning joints at some angles, in the facade's degrees and the tools' radians.)
const pose = () => { const k = keys(); return { deg: { [k[0]]: 30, [k[1]]: -45, [k[2]]: 60 }, rad: { [k[0]]: rad(30), [k[1]]: rad(-45), [k[2]]: rad(60) } }; };
const withoutData = (reply: { files: { path: string; bytes: number }[] }) => ({ ...reply, files: reply.files.map(f => ({ path: f.path, bytes: f.bytes })) });

test('joints, pose, inertia and gravity: the tools\' replies, byte for byte', async () => {
  const doc = arm6r(), r = robot(), p = pose();
  assert.ok(keys().length >= 3);
  assert.equal(JSON.stringify(r.joints()), (await tool(doc, 'get_joints', {})).content);
  assert.equal(JSON.stringify(r.pose(p.deg)), (await tool(doc, 'forward_kinematics', { values: p.rad })).content);
  assert.equal(JSON.stringify(r.inertia()), (await tool(doc, 'link_inertia', {})).content);
  assert.equal(JSON.stringify(r.gravity(p.deg)), (await tool(doc, 'gravity_torques', { values: p.rad })).content);
});

test('a path\'s check: sweep_path\'s reply for each segment between waypoints', async () => {
  const doc = arm6r(), k = keys(), a = { [k[1]]: 0 }, b = { [k[1]]: 90 }, c = { [k[1]]: 90, [k[2]]: -60 };
  const replies = robot().path([a, b, c]).check();
  assert.equal(replies.length, 2);
  const radian = (w: Record<string, number>) => Object.fromEntries(Object.entries(w).map(([key, v]) => [key, rad(v)]));
  assert.equal(JSON.stringify(replies[0]), (await tool(doc, 'sweep_path', { from: radian(a), to: radian(b) })).content);
  assert.equal(JSON.stringify(replies[1]), (await tool(doc, 'sweep_path', { from: radian(b), to: radian(c) })).content);
});

test('URDF and MJCF: the tools\' replies, each file\'s data besides; SDF and USD: the core exports the studio\'s menu makes', async () => {
  const doc = arm6r(), r = robot();
  assert.equal(JSON.stringify(withoutData(r.urdf('arm'))), (await tool(doc, 'export_urdf', { name: 'arm' })).content);
  assert.equal(JSON.stringify(withoutData(r.mjcf('arm'))), (await tool(doc, 'export_mjcf', { name: 'arm' })).content);
  const e = evaluateDoc(doc, 1); assert.ok(e.ok);
  const core = await robotOfDoc(doc, e.bodies, evaluate), closures = core.tree.loops.map(l => closureOfDoc(doc, core.tree, l));
  assert.equal(JSON.stringify(r.sdf('arm')), JSON.stringify(exportSdf(core.tree, core.partOf, 'arm', closures)));
  assert.equal(JSON.stringify(r.usd('arm')), JSON.stringify(exportUsd(core.tree, core.partOf, 'arm', closures)));
});

test('setJoints: what set_joints writes; a new robot, the old one as it was', async () => {
  const doc = arm6r(), k = keys(), limits = { [k[0]]: { lower: -1.5, upper: 1.5, effort: 20, velocity: 2 } };
  const next = robot().setJoints({ joints: limits });
  assert.equal(JSON.stringify(next.doc), JSON.stringify((await tool(doc, 'set_joints', { joints: limits })).state.doc));
  assert.equal(JSON.stringify(robot().doc), JSON.stringify(arm6r()));
});

test('the robot from an assembly, and the refusals: the tools\' own, and how it was called', () => {
  const base = (): StudioPart => part('base').box({ w: 40, d: 40, h: 10 });
  assert.ok(assembly('a', base()).robot() instanceof Robot);
  const refusal = (f: () => unknown) => { try { f(); } catch (e) { return e; } assert.fail('no refusal'); };
  const cases: [string, () => unknown][] = [
    ['VALUE', () => robot().path([{}])],
    ['VALUE', () => robot().pose({ [keys()[0]]: Number.NaN })],
    ['ROBOT', () => robot().pose({ nope: 10 })],
    ['ROBOT', () => robot().setJoints({ joints: { [keys()[0]]: { lower: 2, upper: 1 } } })],
  ];
  for (const [code, f] of cases) {
    const e = refusal(f);
    assert.ok(e instanceof BarocssError, `${code}: ${String(e)}`);
    assert.equal(e.code, code, e.message);
  }
});

// RS5 part 2: a path is RS2's motion — played in time by the core's poseAt over timedPathOf, in degrees and mm.
import { poseAt as corePoseAt, duration as coreDuration, timedPathOf, readMotions } from '../src/robot/motion';

test('poseAt and duration: the core\'s, in degrees; the path\'s ends at its first and last waypoints', () => {
  const r = robot(), k = keys(), limits = { default: { velocity: 90, acceleration: 180 } };
  const path = r.path([{ [k[0]]: 0, [k[1]]: 0 }, { [k[0]]: 90, [k[1]]: -30 }, { [k[0]]: 45, [k[1]]: 10 }], { limits });
  assert.deepEqual(path.problems(), []);
  const tree = r.joints(), timed = timedPathOf(tree, path.motion), T = path.duration();
  assert.equal(T, coreDuration(timed));
  assert.ok(T > 0);
  const mid = path.poseAt(T / 3), core = corePoseAt(tree, timed, T / 3);
  for (const key of Object.keys(core)) assert.ok(Math.abs(mid[key] - core[key] * 180 / Math.PI) < 1e-9, `${key}: ${mid[key]} vs ${core[key]}`);
  const end = path.poseAt(T);
  assert.ok(Math.abs(end[k[0]] - 45) < 1e-9 && Math.abs(end[k[1]] - 10) < 1e-9, JSON.stringify(end));
  // (Its pose there is the pose() of those values.)
  assert.equal(JSON.stringify(r.pose(path.poseAt(0))), JSON.stringify(r.pose({ [k[0]]: 0, [k[1]]: 0 })));
});

test('motions: saved under a name in the robot settings, read back, replaced by name; problems typed', () => {
  const r = robot(), k = keys(), limits = { default: { velocity: 90, acceleration: 180 } };
  const a = r.path([{ [k[0]]: 0 }, { [k[0]]: 60 }], { limits }), b = r.path([{ [k[0]]: 0 }, { [k[0]]: -60 }], { limits, profile: 's-curve' });
  const saved = r.withMotion('swing', a).withMotion('back', b).withMotion('swing', b);
  const motions = readMotions(saved.doc.robot?.motions);
  assert.deepEqual(motions?.map(m => m.name), ['swing', 'back']);
  assert.deepEqual(saved.motion('swing').motion, b.motion);
  assert.equal(JSON.stringify(robot().doc), JSON.stringify(arm6r()), 'the old robot as it was');
  // (No limits: the core's LIMITS_MISSING; no such motion: MOTION_UNKNOWN; a key that is no joint: JOINT_UNKNOWN.)
  const refusal = (f: () => unknown) => { try { f(); } catch (e) { return e; } assert.fail('no refusal'); };
  assert.equal((refusal(() => r.path([{ [k[0]]: 0 }, { [k[0]]: 60 }]).poseAt(0.1)) as BarocssError).code, 'LIMITS_MISSING');
  assert.equal((refusal(() => saved.motion('nope')) as BarocssError).code, 'MOTION_UNKNOWN');
  assert.deepEqual(r.path([{ nope: 0 }, { nope: 1 }], { limits }).problems().map(p => p.code), ['JOINT_UNKNOWN', 'JOINT_UNKNOWN']);
});
