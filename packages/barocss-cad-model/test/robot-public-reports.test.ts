import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import { runRobotTool } from '../src/chat/robot';
import type { JointTree } from '../src/robot/joints';
import { gravityIn, gravityJson, inertiaJson, moveJson, PUBLIC_GRAVITY, sizeOptionsIn, sizingJson } from '../src/robot/reports';
import { MOTORS, type Sizing } from '../src/robot/actuators';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-9, `${a} vs ${b}`);
const tree: JointTree = { version: 1, base: 'base', links: [], joints: [
  { key: 'turn', type: 'continuous', parent: 'base', child: 'turn', origin: [0, 0, 0], axis: [0, 0, 1], mates: [] },
  { key: 'slide', type: 'prismatic', parent: 'base', child: 'slide', origin: [0, 0, 0], axis: [0, 0, 1], mates: [] },
], loops: [], couplings: [], problems: [], notes: [] };

test('public inertia: a 10 mm cube at 2.7 g/cm³ has 2.7 g, centre [5,5,5] mm and diagonal 45 g·mm²', async () => {
  const doc = rectanglePart(10, 10, 10), evaluate = async (d: typeof doc) => evaluatePart(d, 1), r = await evaluate(doc); assert.ok(r.ok);
  const out = await runRobotTool(doc, r.bodies, 'link_inertia', {}, evaluate); assert.ok(!('error' in out));
  const link = (out.content as { links: ReturnType<typeof inertiaJson>[] }).links[0];
  near(link.mass, 2.7); assert.deepEqual(link.centroid, [5, 5, 5]);
  // Match the established inertia suite's 1e-12 relative bound on the whole tensor.
  // The integration may leave a roundoff residual in an analytically zero product moment.
  const expected = [45, 0, 0, 0, 45, 0, 0, 0, 45];
  link.inertia.flat().forEach((x, i) => assert.ok(Math.abs(x - expected[i]) <= 45 * 1e-12));
  link.principal.moments.forEach(x => assert.ok(Math.abs(x - 45) <= 45 * 1e-12));
  assert.deepEqual(link.frame.origin, [0, 0, 0]); near(link.bodies[0].mass, 2.7);
  for (const old of ['mass_kg', 'com_m', 'inertia_kg_m2', 'moments_kg_m2', 'origin_mm', 'massKg']) assert.ok(!JSON.stringify(link).includes(`"${old}"`), old);
});

test('gravity preserves the physical default and mixed force units; explicit 9810 mm/s² is 9.81 m/s²', async () => {
  near(PUBLIC_GRAVITY, 9806.65); assert.deepEqual(gravityIn(), [0, 0, -9.80665]);
  assert.deepEqual(gravityIn([0, 0, -9810]), [0, 0, -9.81]);
  const input = { torques: { turn: 2, slide: 5 }, generalized: { turn: -3, slide: 7 } }, before = JSON.stringify(input);
  const out = gravityJson(tree, input, [0, 0, -9.81]);
  assert.deepEqual(out.torques, { turn: 2000, slide: 5 }); assert.deepEqual(out.generalized, { turn: -3000, slide: 7 });
  assert.deepEqual(out.units, { turn: 'N·mm', slide: 'N' }); assert.equal(out.gravity, 9810); assert.equal(JSON.stringify(input), before);
  const notReady = { code: 'ROBOT_NOT_READY' as const, links: ['unmated'], joints: [], message: 'unmated link' };
  assert.deepEqual(gravityJson(tree, { ...input, notReady }, [0, 0, -9.81]).notReady, notReady);
  const doc = rectanglePart(10, 10, 10), evaluate = async (d: typeof doc) => evaluatePart(d, 1), r = await evaluate(doc); assert.ok(r.ok);
  for (const [args, expected] of [[{}, 9806.65], [{ g: [0, 0, -9810] }, 9810]] as const) {
    const result = await runRobotTool(doc, r.bodies, 'gravity_torques', args, evaluate); assert.ok(!('error' in result));
    assert.equal((result.content as { gravity: number }).gravity, expected);
  }
});

test('motion converts unrounded kinematics first, then formats public degree/mm/N·mm/N and seconds', () => {
  const joint = { peak: 2, rms: 1, atPeak: 0.5, distance: Math.PI / 4, vPeak: Math.PI / 4, aPeak: Math.PI / 2, jPeak: Math.PI };
  const raw = { kind: 'trapezoid' as const, duration: 3, joints: { turn: joint, slide: { ...joint, distance: 12, vPeak: 10, aPeak: 20, jPeak: 40 } }, sampling: 'independent fixture' }, before = JSON.stringify(raw);
  const out = moveJson(tree, raw, [0, 0, -9.80665]);
  assert.equal(out.duration, 3); assert.equal(out.gravity, 9806.65);
  assert.deepEqual(out.joints.turn, { peak: 2000, rms: 1000, unit: 'N·mm', at: 0.5, distance: 45, peakVelocity: 45, peakAcceleration: 90, peakJerk: 180 });
  assert.deepEqual(out.joints.slide, { peak: 2, rms: 1, unit: 'N', at: 0.5, distance: 12, peakVelocity: 10, peakAcceleration: 20, peakJerk: 40 });
  assert.equal(JSON.stringify(raw), before);
});

test('sizing projects seconds and torque/speed checks while preserving catalogue source values and decisions', async () => {
  const catalogueBefore = JSON.stringify(MOTORS), input = sizeOptionsIn({ dwell: 0.5, serviceLife: 3600, stopDeceleration: 180, g: [0, 0, -9810] });
  assert.equal(input.dwell, 0.5); assert.equal(input.life, 1); near(input.estop!, Math.PI); assert.deepEqual(input.g, [0, 0, -9.81]);
  const sizing: Sizing = { kind: 'trapezoid', moveS: 2, cycleS: 5, sampling: 'fixture', pending: [], skipped: [], joints: [{ key: 'turn', choice: { motor: 'motor', reducer: 'reducer', ratio: 100, massKg: 0.2 },
    checks: [['torque', 2, 3, 'N·m'], ['speed', 60, 120, 'rpm'], ['life', 1, 2, 'h']].map(([name, value, limit, unit]) => ({ name: name as string, value: value as number, limit: limit as number, unit: unit as string, ok: false, margin: -0.5, limitSource: 'page' })),
    candidates: 1, feasible: 0, rejected: {}, estimates: [], sources: [{ field: 'nominalTorque', src: MOTORS[0].nominalTorque.src }] }] };
  const before = JSON.stringify(sizing), out = sizingJson(sizing);
  assert.equal(out.moveDuration, 2); assert.equal(out.cycleDuration, 5); assert.equal(out.joints[0].choice!.mass, 200);
  assert.deepEqual(out.joints[0].checks.map(c => [c.value, c.limit, c.unit, c.ok, c.margin]), [[2000, 3000, 'N·mm', false, -0.5], [360, 720, 'degree/s', false, -0.5], [3600, 7200, 's', false, -0.5]]);
  assert.equal(JSON.stringify(sizing), before); assert.equal(JSON.stringify(MOTORS), catalogueBefore);
  const doc = rectanglePart(10, 10, 10), evaluate = async (d: typeof doc) => evaluatePart(d, 1), r = await evaluate(doc); assert.ok(r.ok);
  for (const old of ['dwell_s', 'life_h', 'estop_rad_s2']) {
    const result = await runRobotTool(doc, r.bodies, 'size_actuators', { to: {}, profile: 'trapezoid', [old]: 1 }, evaluate);
    assert.ok('error' in result && result.error.includes(old), `${old} is refused, not an alias`);
  }
});
