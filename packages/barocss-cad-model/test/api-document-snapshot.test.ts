import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Assembly, Robot, RobotPath } from '../src/api';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';

const document = () => {
  const doc = emptyDoc(), child = emptyDoc();
  child.parameters = { width: 12 };
  doc.instances = [{ id: 'p1', name: 'arm', doc: child, position: [10, 20, 30], rotation: [0, 0, 90] }];
  doc.robot = { version: 1, joints: { hinge: { lower: -30, upper: 30 } }, motions: [
    { name: 'turn', path: { waypoints: [{ hinge: 0 }, { hinge: 30 }], limits: { default: { velocity: 90, acceleration: 180 } } } },
  ] };
  return doc;
};

test('Robot snapshots external nested document input before later caller edits', () => {
  const input = document(), expected = structuredClone(input), robot = new Robot(input);
  input.robot!.joints!.hinge.upper = 180;
  input.robot!.motions![0].path.waypoints[1].hinge = 120;
  input.robot!.motions![0].path.limits!.default.velocity = 1;
  input.instances![0].doc.parameters.width = 99;
  input.instances!.push({ id: 'p2', name: 'extra', doc: emptyDoc(), position: [0, 0, 0], rotation: [0, 0, 0] });
  assert.deepEqual(robot.doc, expected);
  assert.equal(robot.motion('turn').waypoints[1].hinge, 30);
});

test('Robot document getter edits cannot alter its constructor snapshot', () => {
  const input = document(), robot = new Robot(input), copy = robot.doc;
  copy.robot!.motions![0].path.waypoints[1].hinge = -90;
  copy.instances![0].position[0] = 100;
  copy.instances![0].doc.parameters.width = 100;
  assert.deepEqual(robot.doc, input);
  assert.notEqual(robot.doc, robot.doc);
});

test('Assembly snapshots nested input, part identities and placement tuples', () => {
  const input = document(), expected = structuredClone(input), assembly = new Assembly('fixture', input);
  input.instances![0].name = 'changed';
  input.instances![0].position[0] = 99;
  input.instances![0].rotation[2] = 180;
  input.instances![0].doc.parameters.width = 99;
  input.robot!.motions![0].path.waypoints[1].hinge = 90;
  assert.equal(assembly.name, 'fixture');
  assert.deepEqual(assembly.doc, expected);
  assert.deepEqual(assembly.parts(), [{ id: 'base', name: 'base' }, { id: 'p1', name: 'arm' }]);
  assert.deepEqual(assembly.placements(), [{ part: 'p1', name: 'arm', position: [10, 20, 30], rotation: [0, 0, 90] }]);
});

test('Assembly document and placement getters cannot expose its stored document', () => {
  const input = document(), assembly = new Assembly('fixture', input), copy = assembly.doc;
  copy.instances![0].doc.parameters.width = 100;
  copy.instances![0].position[0] = 100;
  copy.robot!.joints!.hinge.upper = 100;
  const placements = assembly.placements();
  (placements[0].position as number[])[0] = 100;
  assert.deepEqual(assembly.doc, input);
  assert.equal(assembly.placements()[0].position[0], 10);
  assert.notEqual(assembly.doc, assembly.doc);
});

test('direct RobotPath keeps the document joint bounds from construction', () => {
  const input = JSON.parse(readFileSync(join(import.meta.dirname, '../samples/robots/scara.bcad'), 'utf8')) as StudioDoc;
  const path = new RobotPath(input, {
    waypoints: [{ 'base~arm1': 0 }, { 'base~arm1': 90 }],
    limits: { default: { velocity: 90, acceleration: 180 } },
  });
  // This later edit would make the path invalid if it still read the caller's document.
  input.robot!.joints!['base~arm1'].upper = 1;
  assert.deepEqual(path.problems(), []);
  assert.ok(Math.abs(path.duration() - 1.5) <= 1e-12, '90 degrees: 0.5 s acceleration, 0.5 s cruise, 0.5 s braking');
  assert.ok(Math.abs(path.poseAt(1.5)['base~arm1'] - 90) <= 1e-9);
});
