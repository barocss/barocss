// R7 phase A. Prepared on the contract base; execute only after the exact producer/API checkpoint is assembled.
// No skip or alternate SI/radian expectation turns an incomplete producer into a passing sample.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { part, assembly } from '@barocss/cad-model/api';
import { jointCase } from './robot-contract.fixture.mjs';

const samples = resolve(import.meta.dirname, '../../../packages/barocss-cad-model/samples/robots');
const open = id => assembly(id, part(id, JSON.parse(readFileSync(resolve(samples, `${id}.bcad`), 'utf8')))).robot();
const near = (actual, expected, field) => assert.ok(Math.abs(actual - expected) < 1e-9, `${field}: ${actual} != ${expected}`);

test('public and stored turn/slide settings keep degrees, mm, N·mm and N', () => {
  const original = open(jointCase.sample), before = original.doc, input = structuredClone(jointCase.joints);
  const robot = original.setJoints({ joints: input });
  assert.deepEqual(input, jointCase.joints, 'setJoints must not mutate caller settings');
  assert.deepEqual(original.doc, before, 'setJoints must not mutate the original robot');
  for (const [key, settings] of Object.entries(jointCase.joints)) {
    assert.deepEqual(robot.doc.robot.joints[key], settings, `${key}: stored public settings`);
    const joint = robot.joints().joints.find(j => j.key === key);
    assert.ok(joint, key);
    for (const [field, expected] of Object.entries(settings)) near(joint.limit[field], expected, `${key}.${field}`);
  }
  const reopened = assembly('reopened', part('reopened', robot.doc)).robot();
  assert.deepEqual(reopened.doc.robot.joints, robot.doc.robot.joints, 'a document read keeps public units');
});

test('updated limits and pose convert a turn once and keep a slide in mm', () => {
  const robot = open(jointCase.sample).setJoints({ joints: jointCase.joints });
  const pose = robot.pose(jointCase.pose);
  for (const [key, expected] of Object.entries(jointCase.pose)) near(pose.values[key], expected, key);
  assert.ok(!pose.out_of_limits.includes('base~arm1'), '90 degrees is at the upper limit');
  assert.ok(robot.pose({ 'base~arm1': 91 }).out_of_limits.includes('base~arm1'), '91 degrees exceeds the limit');
  const home = robot.pose().links.find(l => l.link === 'quill');
  const down = robot.pose({ 'arm2~quill': -30 }).links.find(l => l.link === 'quill');
  near(down.position[2] - home.position[2], -30, 'quill displacement in mm');
});

test('same-type gear mimic keeps its dimensionless ratio and public degree values', () => {
  const robot = open('gear-joint'), pose = robot.pose({ 'base~g1': 30 });
  near(pose.values['base~g1'], 30, 'leader degrees');
  near(pose.values['base~g2'], -20, 'follower degrees');
  const follower = robot.joints().joints.find(j => j.key === 'base~g2');
  near(follower.mimic.multiplier, -2 / 3, 'gear ratio');
});
