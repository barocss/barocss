import test from 'node:test';
import assert from 'node:assert/strict';
import type { JointTree } from '../src/robot/joints';
import { readDuty } from '../src/robot/native/duty';
import { dutyJson } from '../src/robot/reports';

const tree: JointTree = { version: 1, base: 'base', links: [], joints: [
  { key: 'turn', type: 'revolute', parent: 'base', child: 'arm', origin: [0, 0, 0], axis: [0, 0, 1], mates: [] },
  { key: 'slide', type: 'prismatic', parent: 'base', child: 'slide', origin: [0, 0, 0], axis: [0, 0, 1], mates: [] },
], loops: [], couplings: [], problems: [], notes: [] };
const publicDuty = { moves: [{ from: { turn: 30, slide: 2 }, to: { turn: 90, slide: 12 }, profile: 's-curve', joint_limits: { turn: { velocity: 60, acceleration: 120, jerk: 240 }, slide: { velocity: 5, acceleration: 10, jerk: 20 } }, dwell: .5 }], serviceLife: 7200, inertia_ratio_max: 10, clearance: .25, g: [0, 0, -9810], actuators: { turn: { motor: 'm', reducer: 'r' } } };

test('public duty converts mixed degree/mm limits, seconds and gravity once and serializes only canonical unit names', () => {
  const before = JSON.stringify(publicDuty), duty = readDuty(tree, publicDuty); assert.ok(!('error' in duty));
  const angle = Math.PI / 180, m = duty.moves[0];
  assert.deepEqual(m.from, { turn: 30 * angle, slide: 2 }); assert.deepEqual(m.to, { turn: 90 * angle, slide: 12 });
  assert.deepEqual(m.joint_limits!.turn, { velocity: 60 * angle, acceleration: 120 * angle, jerk: 240 * angle });
  assert.deepEqual(m.joint_limits!.slide, { velocity: 5, acceleration: 10, jerk: 20 });
  assert.equal(m.dwell_s, .5); assert.equal(duty.life_h, 2); assert.equal(duty.clearance_mm, .25); assert.deepEqual(duty.g, [0, 0, -9.81]);
  const output = dutyJson(tree, duty); assert.equal(output.serviceLife, 7200); assert.equal(output.moves[0].dwell, .5); assert.equal(output.clearance, .25);
  assert.deepEqual(output.moves[0].from, publicDuty.moves[0].from); assert.deepEqual(output.moves[0].to, publicDuty.moves[0].to); assert.deepEqual(output.g, publicDuty.g);
  assert.equal(output.inertia_ratio_max, 10); assert.ok(output.moves[0].joint_limits);
  const replay = readDuty(tree, output); assert.ok(!('error' in replay));
  for (const key of ['turn', 'slide']) for (const quantity of ['velocity', 'acceleration', 'jerk'] as const) assert.ok(Math.abs(replay.moves[0].joint_limits![key][quantity]! - m.joint_limits![key][quantity]!) <= Math.abs(m.joint_limits![key][quantity]!) * 1e-12);
  for (const old of ['dwell_s', 'life_h', 'clearance_mm']) assert.ok(!JSON.stringify(output).includes(`"${old}"`));
  assert.equal(JSON.stringify(publicDuty), before);
});

test('public duty refuses old unit aliases and non-finite inputs; original gravity default stays physical', () => {
  for (const patch of [{ life_h: 2 }, { clearance_mm: .1 }, { serviceLife: Infinity }, { clearance: NaN }, { g: [0, 0, Infinity] }]) assert.ok('error' in readDuty(tree, { ...publicDuty, ...patch }));
  for (const patch of [{ dwell_s: .5 }, { dwell: Infinity }, { dwell: NaN }, { dwell: -1 }, { from: { turn: NaN } }, { joint_limits: { turn: { velocity: Infinity, acceleration: 10, jerk: 20 }, slide: publicDuty.moves[0].joint_limits.slide } }]) assert.ok('error' in readDuty(tree, { ...publicDuty, moves: [{ ...publicDuty.moves[0], ...patch }] }));
  const d = readDuty(tree, { moves: [{ from: {}, to: {}, profile: 'trapezoid' }] }); assert.ok(!('error' in d)); assert.deepEqual(d.g, [0, 0, -9.80665]);
});
