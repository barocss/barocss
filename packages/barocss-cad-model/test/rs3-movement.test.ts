// RS3 (b): the agent moves the robot — set_pose, set_waypoint, check_path and play_motion on the RS1 sample robots, in
// degrees and mm in and out. The oracles: FK at the same values in radians (set_pose), poseAt at the same times
// (play_motion), the trapezoid's closed form for the stored motion's duration, and the joints' own limits (refusals).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { dispatchTool, runTool, type ChatState } from '../src/chat/tools';
import { treeOfDoc } from '../src/chat/robot';
import { readRobot } from '../src/robot/joints';
import { duration, poseAt, timedPathOf } from '../src/robot/motion';
import { robotViewOf, poseOf, withWaypoint } from '../src/robot/verbs';
import { isRefusal } from '../src/engine/refusal';

const DIR = resolve(resolve(import.meta.dirname, '..'), 'samples/robots');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const DEG = Math.PI / 180;
async function opened(id: string): Promise<ChatState> {
  const read = readStudioDoc(readFileSync(join(DIR, `${id}.bcad`), 'utf8')); assert.ok('doc' in read, id);
  const r = await evaluate(read.doc); assert.ok(r.ok, id);
  return { doc: read.doc, bodies: r.bodies, turnBase: read.doc };
}
const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const call = async (s: ChatState, name: string, args: object) => { const out = await dispatchTool(s, name, args, evaluate); return { out, json: out.isError ? null : JSON.parse(out.content) }; };

test('RS3 set_pose: degrees in and out, the links where FK puts them in radians; past a limit, an unknown key or a gear follower refused, typed; nothing stored', async () => {
  const s = await opened('arm-2r');
  const { out, json } = await call(s, 'set_pose', { values: { 'base~a': 30, 'a~b': -45 } });
  assert.ok(!out.isError && !out.changed, out.content); assert.equal(out.state.doc, s.doc, 'a preview: the document as it was');
  assert.deepEqual(json.values, { 'base~a': 30, 'a~b': -45 });
  const fk = poseOf(await robotViewOf(s.doc, s.bodies, evaluate), { 'base~a': 30 * DEG, 'a~b': -45 * DEG }).reply;
  assert.deepEqual(json.links, fk.links, 'the placements FK gives at the same values in radians');
  for (const [values, code] of [[{ 'a~b': 151 }, 'JOINT_LIMIT'], [{ nope: 1 }, 'JOINT_UNKNOWN']] as const) {
    const bad = await call(s, 'set_pose', { values });
    assert.ok(bad.out.isError && bad.out.state === s, JSON.stringify(values)); assert.match(bad.out.content, new RegExp(`\\[${code}\\]`));
  }
  // (In the units given: degrees.)
  assert.match((await call(s, 'set_pose', { values: { 'a~b': 151 } })).out.content, /\[JOINT_LIMIT\] a~b = 151° is outside its limits -150° to 150°/);
  const g = await opened('gripper');
  const mimic = await call(g, 'set_pose', { values: { 'base~right': 10 } });
  assert.ok(mimic.out.isError); assert.match(mimic.out.content, /\[JOINT_MIMIC\]/);
  const lead = await call(g, 'set_pose', { values: { 'base~left': 20 } });
  near(lead.json.values['base~right'], -20, 1e-9);
});

test('RS3 set_waypoint: a motion recorded (made, inserted, removed, its limits), checked as it will play; the robot\'s, so proposed', async () => {
  const s = await opened('arm-2r'), view = await robotViewOf(s.doc, s.bodies, evaluate);
  // Directly: refused at the session gate (the robot's settings); in a proposal: approval robot.
  const direct = await runTool(s, 'set_waypoint', { motion: 'reach', values: { 'base~a': 45 } }, evaluate);
  assert.equal(JSON.parse(direct.content).code, 'needs_approval', direct.content);
  const p = await runTool(s, 'propose', { title: 'a reach', ops: [{ tool: 'set_waypoint', args: { motion: 'reach', values: { 'base~a': 45 } } }] }, evaluate);
  assert.ok(!p.isError, p.content); assert.deepEqual(JSON.parse(p.content).risk.approval, ['robot']);
  // Through dispatch: written.
  let doc = withWaypoint(view, { motion: 'reach', values: { 'base~a': 45 }, limits: { default: { velocity: 90, acceleration: 180 } } });
  doc = withWaypoint({ ...view, doc }, { motion: 'reach', values: { 'base~a': 10, 'a~b': 20 }, at: 1 });
  const reach = readRobot(doc.robot).motions!.find(m => m.name === 'reach')!;
  assert.deepEqual(reach.path.waypoints, [{}, { 'base~a': 10, 'a~b': 20 }, { 'base~a': 45 }]);
  assert.deepEqual(readRobot(doc.robot).motions!.map(m => m.name), ['wave', 'reach'], 'the sample\'s own motion kept');
  doc = withWaypoint({ ...view, doc }, { motion: 'reach', remove: 1 });
  assert.deepEqual(readRobot(doc.robot).motions!.find(m => m.name === 'reach')!.path.waypoints, [{}, { 'base~a': 45 }]);
  const set = await call(s, 'set_waypoint', { motion: 'wave', values: { 'a~b': 60 } });
  assert.ok(!set.out.isError && set.out.changed, set.out.content); assert.equal(set.json.waypoints.length, 5);
  // Refusals, typed, the state the same.
  for (const [args, code] of [[{ motion: 'wave', values: { 'a~b': 170 } }, 'JOINT_LIMIT'], [{ motion: 'wave', values: { nope: 1 } }, 'JOINT_UNKNOWN'], [{ motion: 'none', remove: 0 }, 'MOTION_UNKNOWN'], [{ motion: 'wave', remove: 9 }, 'VALUE'], [{ motion: 'wave' }, 'VALUE']] as const) {
    const bad = await call(s, 'set_waypoint', args);
    assert.ok(bad.out.isError && bad.out.state === s, JSON.stringify(args)); assert.match(bad.out.content, new RegExp(`\\[${code}\\]`), bad.out.content);
  }
  for (const args of [{ motion: 'wave', values: { 'a~b': 'x' } }, { motion: 'wave', limits: { default: { velocity: 0, acceleration: 1 } } }, { motion: 'wave', limits: { default: { v: 1, a: 1 } } }, { motion: 'wave', at: 1.5, values: {} }]) {
    const bad = await call(s, 'set_waypoint', args); assert.ok(bad.out.isError && bad.out.state === s, JSON.stringify(args));
  }
  // (A waypoint past the joint's limit is refused through the verb too, as a typed refusal.)
  assert.throws(() => withWaypoint(view, { motion: 'wave', values: { 'base~a': 151 } }), (e: unknown) => isRefusal(e, 'JOINT_LIMIT') && /waypoint 4: base~a = 151° is outside its limits -150° to 150°$/.test((e as Error).message));
  const gantry = await opened('gantry-ppp');
  assert.match((await call(gantry, 'set_waypoint', { motion: 'box', values: { 'y~z': 45 } })).out.content, /\[JOINT_LIMIT\] waypoint 5: y~z = 45 mm is outside its limits -40 mm to 40 mm/);
});

test('RS3 check_path: the SCARA\'s pick clear along its timing, its duration the trapezoid\'s closed form; a motion that cannot play refused', async () => {
  const s = await opened('scara'), tree = await treeOfDoc(s.doc, s.bodies, evaluate);
  const { out, json } = await call(s, 'check_path', { motion: 'pick' });
  assert.ok(!out.isError && !out.changed, out.content);
  assert.equal(json.clear, true, out.content); assert.equal(json.contact, undefined);
  assert.ok(json.min_clearance === null || json.min_clearance.mm > 0);
  const pick = readRobot(s.doc.robot).motions!.find(m => m.name === 'pick')!, path = timedPathOf(tree, pick.path);
  near(json.duration, duration(path), 1e-6);
  // (The closed form: each segment one trapezoid on its tightest joint — a distance d at v, a reaches v when d ≥ v²/a.)
  let T = 0;
  for (let i = 1; i < pick.path.waypoints.length; i++) {
    const a = pick.path.waypoints[i - 1], b = pick.path.waypoints[i];
    T += Math.max(0, ...[...new Set([...Object.keys(a), ...Object.keys(b)])].map(k => {
      const l = pick.path.limits![k] ?? pick.path.limits!.default!, d = Math.abs((b[k] ?? 0) - (a[k] ?? 0));
      return d === 0 ? 0 : d >= l.velocity ** 2 / l.acceleration ? d / l.velocity + l.velocity / l.acceleration : 2 * Math.sqrt(d / l.acceleration);
    }));
  }
  near(json.duration, T, 1e-6);
  // (Limits in degrees: the sample's default 90 deg/s is 90° a second on each turn, not 90 rad/s.)
  near(path.limits['base~arm1']!.v, 90 * DEG); near(path.limits['arm2~quill']!.v, 60);
  // (The gantry's box clear too: its ram goes up, not down into the X carriage it rides above.)
  const box = await call(await opened('gantry-ppp'), 'check_path', { motion: 'box' }); assert.equal(box.json.clear, true, box.out.content);
  const none = await call(s, 'check_path', { motion: 'nope' }); assert.ok(none.out.isError); assert.match(none.out.content, /\[MOTION_UNKNOWN\]/);
  const unlimited: ChatState = { ...s, doc: { ...s.doc, robot: { ...readRobot(s.doc.robot), motions: [{ name: 'bare', path: { waypoints: [{}, { 'base~arm1': 10 }] } }] } } };
  const bare = await call(unlimited, 'check_path', { motion: 'bare' }); assert.ok(bare.out.isError); assert.match(bare.out.content, /\[LIMITS_MISSING\]/);
});

test('RS3 play_motion: the stored motion\'s poses at even times, each poseAt\'s in degrees, its links FK\'s', async () => {
  const s = await opened('pan-tilt'), tree = await treeOfDoc(s.doc, s.bodies, evaluate), view = await robotViewOf(s.doc, s.bodies, evaluate);
  const m = readRobot(s.doc.robot).motions![0], path = timedPathOf(tree, m.path), T = duration(path);
  const { out, json } = await call(s, 'play_motion', { motion: m.name, samples: 7 });
  assert.ok(!out.isError && !out.changed, out.content);
  near(json.duration, T, 1e-6); assert.equal(json.samples.length, 7);
  json.samples.forEach((f: { time: number; values: Record<string, number>; links: unknown }, k: number) => {
    near(f.time, (T * k) / 6, 1e-6);
    const q = poseAt(tree, path, (T * k) / 6);
    for (const [key, v] of Object.entries(q)) near(f.values[key], v / DEG, 1e-6);
    assert.deepEqual(f.links, poseOf(view, q).reply.links);
  });
  assert.deepEqual(json.samples[0].values, Object.fromEntries(Object.keys(json.samples[0].values).map(k => [k, m.path.waypoints[0][k] ?? 0])), 'it starts at the first waypoint');
  const last = m.path.waypoints[m.path.waypoints.length - 1];
  for (const [k, v] of Object.entries(last)) near(json.samples[6].values[k], v, 1e-6);
  assert.equal((await call(s, 'play_motion', { motion: m.name, samples: 1000 })).json.samples.length, 200, 'at most 200');
});
