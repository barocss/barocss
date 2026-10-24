import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StudioDoc } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import { readStudioDoc } from '../src/engine/migrate';
import { runRobotTool } from '../src/chat/robot';
import { readRobot, type Joint, type JointTree } from '../src/robot/joints';
import { poseOf, robotViewOf, setPose, sweepOf, treeOf, withJoints, withWaypoint } from '../src/robot/verbs';
import { jointTreeOut, jointValuesIn, jointValuesOut, moveLimitsIn } from '../src/robot/units';
import { rectanglePart } from '../src/engine/doc';
import { gearPairAt } from '../src/robot/fk';
import { isRefusal } from '../src/engine/refusal';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} vs ${expected}`);
const fixture = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../barocss-cad/conformance/rm/cylindrical/case.json'), 'utf8')).input.document as StudioDoc;

test('latest storage: a newly configured cylindrical joint resolves turn/slide types, saves public values and restores solver units once', async () => {
  const bare = { ...fixture, robot: undefined }, r = await evaluate(bare); assert.ok(r.ok);
  const view = await robotViewOf(bare, r.bodies, evaluate), initial = treeOf(view);
  const slide = initial.joints.find(j => j.type === 'prismatic')!.key, turn = initial.joints.find(j => j.type === 'continuous')!.key;
  const settings = { [slide]: { lower: -20, upper: 20, velocity: 10, effort: 40 }, [turn]: { lower: -90, upper: 90, velocity: 45, effort: 1200 } };
  const doc = withJoints(bare, { joints: settings });
  const read = readStudioDoc(JSON.stringify(doc)); assert.ok('doc' in read);
  assert.deepEqual(readRobot(read.doc.robot).joints, settings);
  const restored = { ...view, doc: read.doc }, tree = treeOf(restored), tj = tree.joints.find(j => j.key === turn)!;
  assert.equal(tj.type, 'revolute');
  near(tj.limit!.lower!, -Math.PI / 2); near(tj.limit!.upper!, Math.PI / 2);
  near(tj.limit!.velocity!, Math.PI / 4); near(tj.limit!.effort!, 1.2);
  assert.deepEqual(tree.joints.find(j => j.key === slide)!.limit, settings[slide]);
  const projected = jointTreeOut(tree);
  for (const j of projected.joints) for (const [key, value] of Object.entries(settings[j.key])) near(j.limit![key as keyof NonNullable<Joint['limit']>]!, value);
  const reply = await runRobotTool(read.doc, r.bodies, 'get_joints', {}, evaluate); assert.ok(!('error' in reply));
  assert.deepEqual(reply.content, projected);
  const pose = await runRobotTool(read.doc, r.bodies, 'forward_kinematics', { values: { [turn]: 90, [slide]: 12 } }, evaluate); assert.ok(!('error' in pose));
  const shown = pose.content as { values: Record<string, number>; links: { link: string; position: number[]; rotation: number[] }[] };
  assert.equal(shown.values[turn], 90); assert.equal(shown.values[slide], 12);
  const child = shown.links.find(l => l.link === tj.child)!;
  // The fixture's home height is 30 mm; the independent slide adds 12 mm.
  near(child.rotation[2], 90); near(child.position[2], 42);
  assert.deepEqual(setPose(restored, { [turn]: 90, [slide]: 12 }, tree).links, shown.links);
  const motion = withWaypoint(restored, { motion: 'mixed', values: { [turn]: 90, [slide]: 12 }, limits: { default: { velocity: 45, acceleration: 90 } } }, tree);
  assert.deepEqual(readRobot(motion.robot).motions![0].path.waypoints, [{}, { [turn]: 90, [slide]: 12 }]);
  assert.throws(() => setPose(restored, { [turn]: 91 }, tree), e => isRefusal(e, 'JOINT_LIMIT'));
  assert.throws(() => setPose(restored, { absent: 1 }, tree), e => isRefusal(e, 'JOINT_UNKNOWN'));
});

test('mixed coupling projections scale follower/leader ratios and offsets without changing solver values', () => {
  const joint = (key: string, type: Joint['type']): Joint => ({ key, type, parent: 'base', child: key, axis: [0, 0, 1], origin: [0, 0, 0], mates: [] });
  const turn = joint('turn', 'continuous'), slide = { ...joint('slide', 'prismatic'), mimic: { joint: 'turn', multiplier: 0.5, offset: 2 } };
  const follower = { ...joint('follower', 'continuous'), mimic: { joint: 'slide', multiplier: 0.25, offset: Math.PI / 6 } };
  const tree: JointTree = { version: 1, base: 'base', links: [], joints: [turn, slide, follower], loops: [], couplings: [], problems: [], notes: [], cams: [{ kind: 'push', mate: 'push', leader: 'turn', follower: 'slide', multiplier: 0.5, seat: { driver: 'turn', follower: 'slide', p: [0, 0, 0], n: [0, 0, 1] } }] };
  const before = JSON.stringify(tree), out = jointTreeOut(tree);
  near(out.joints[1].mimic!.multiplier * 90 + out.joints[1].mimic!.offset, Math.PI / 4 + 2);
  near(out.joints[2].mimic!.multiplier * 4 + out.joints[2].mimic!.offset, 180 / Math.PI + 30);
  near(out.cams![0].multiplier!, Math.PI / 360);
  assert.equal(JSON.stringify(tree), before);
  assert.deepEqual(jointValuesIn(tree, { turn: 90, slide: 12 }), { turn: Math.PI / 2, slide: 12 });
  assert.deepEqual(moveLimitsIn(tree, 'slide', { velocity: 10, acceleration: 20, jerk: 40 }), { velocity: 10, acceleration: 20, jerk: 40 });
  const limits = moveLimitsIn(tree, 'turn', { velocity: 90, acceleration: 180, jerk: 360 });
  near(limits.velocity, Math.PI / 2); near(limits.acceleration, Math.PI); near(limits.jerk!, 2 * Math.PI);
});

test('sweep keeps raw mixed-joint contact values until the public boundary: initial contact is exactly 45 degrees and 5 mm', async () => {
  const part = rectanglePart(200, 200, 200), r = await evaluate(part); assert.ok(r.ok);
  const doc: StudioDoc = { ...part, instances: ['turn', 'slide'].map(id => ({ id, name: id, doc: part, position: [0, 0, 0], rotation: [0, 0, 0], grounded: false })) };
  const tree: JointTree = { version: 1, base: 'base', links: ['base', 'turn', 'slide'].map(id => ({ id, part: id, name: id })), joints: [
    { key: 'turn', type: 'continuous', parent: 'base', child: 'turn', axis: [0, 0, 1], origin: [0, 0, 0], mates: [] },
    { key: 'slide', type: 'prismatic', parent: 'base', child: 'slide', axis: [0, 0, 1], origin: [0, 0, 0], mates: [] },
  ], loops: [], couplings: [], problems: [], notes: [] };
  const result = sweepOf({ doc, bodies: r.bodies, parts: new Map([['turn', r.bodies], ['slide', r.bodies]]) }, { turn: Math.PI / 4, slide: 5 }, { turn: Math.PI / 2, slide: 10 }, tree);
  assert.equal(result.reply.clear, false); assert.equal(result.reply.contact!.s, 0);
  assert.deepEqual(jointValuesOut(tree, result.rawContactValues!), { turn: 45, slide: 5 });
  assert.ok(Math.abs(result.reply.contact!.values.turn * 180 / Math.PI - 45) > 1e-9, 'the old rad-rounded reply loses the required degree precision');
  assert.equal('rawContactValues' in result.reply, false, 'internal data is not a public rad alias');
});


test('public nested gear placements use degrees once; phase and backlash metadata keep existing values with canonical names', async () => {
  const doc = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../barocss-cad/conformance/rm/gears/case.json'), 'utf8')).input.document as StudioDoc;
  const r = await evaluate(doc); assert.ok(r.ok);
  const view = await robotViewOf(doc, r.bodies, evaluate), tree = treeOf(view), coupling = tree.couplings[0]; assert.ok(coupling);
  const before = JSON.stringify(tree), projected = jointTreeOut(tree), shown = projected.couplings[0];
  for (const key of ['g1', 'g2'] as const) {
    assert.deepEqual(Object.keys(shown[key]).sort(), ['center', 'from', 'rotation', 'spec']);
    assert.equal(shown[key].rotation, coupling[key].rotation / (Math.PI / 180));
    assert.deepEqual(shown[key].spec, coupling[key].spec, 'spec pressure and helix angles are already degrees');
    assert.deepEqual(shown[key].center, coupling[key].center); assert.equal(shown[key].from, coupling[key].from);
  }
  const turned = { ...tree, couplings: [{ ...coupling, g1: { ...coupling.g1, rotation: Math.PI / 2 }, g2: { ...coupling.g2, rotation: -Math.PI / 4 } }] };
  assert.deepEqual([jointTreeOut(turned).couplings[0].g1.rotation, jointTreeOut(turned).couplings[0].g2.rotation], [90, -45]);
  const core = poseOf(view, { [coupling.leader]: .123456789 }, tree), phase = core.reply.gears[0], raw = gearPairAt(coupling, core.reply.values), home = gearPairAt(coupling, {});
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6 + 0;
  assert.deepEqual([phase.phase, phase.homePhase, phase.backlash], [r6(raw.phaseDeg), r6(home.phaseDeg), r6(raw.backlash)]);
  for (const old of ['phase_deg', 'home_phase_deg', 'backlash_mm']) assert.equal(old in phase, false);
  const publicReply = await runRobotTool(doc, r.bodies, 'get_joints', {}, evaluate); assert.ok(!('error' in publicReply)); assert.deepEqual(publicReply.content, projected);
  assert.equal(JSON.stringify(tree), before);
});
