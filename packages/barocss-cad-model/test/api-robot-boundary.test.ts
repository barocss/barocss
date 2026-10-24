// Latest public units: independent literal oracles, separate from core radian/SI calculations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Robot, part } from '../src/api';
import type { StudioDoc } from '../src/engine/doc';
import type { JointTree } from '../src/robot/joints';
import { treeOf, viewOf } from '../src/api/robotCore';
import { solveDoc } from '../src/assembly/edit';
import { jointTreeOut } from '../src/robot/units';

const docOf = (name: string): StudioDoc => JSON.parse(readFileSync(join(import.meta.dirname, `../samples/robots/${name}.bcad`), 'utf8'));
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);

test('joints and setJoints keep mixed turn/slide public settings in the latest document and project once', () => {
  const doc = docOf('scara'), turn = 'base~arm1', slide = 'arm2~quill';
  doc.robot = { version: 1, joints: {
    [turn]: { lower: -90, upper: 120, velocity: 180, effort: 2500 },
    [slide]: { lower: -40, upper: 10, velocity: 20, effort: 15 },
  } };
  const r = new Robot(doc), before = JSON.stringify(r.doc), publicTree = r.joints();
  const publicTurn = publicTree.joints.find(j => j.key === turn)!.limit!;
  for (const [key, value] of Object.entries(doc.robot.joints![turn])) close(publicTurn[key as keyof typeof publicTurn]!, value);
  assert.deepEqual(publicTree.joints.find(j => j.key === slide)!.limit, doc.robot.joints![slide]);
  const internal = treeOf(r.doc), coreTurn = internal.joints.find(j => j.key === turn)!.limit!;
  close(coreTurn.lower!, -Math.PI / 2); close(coreTurn.upper!, 2 * Math.PI / 3);
  close(coreTurn.velocity!, Math.PI); close(coreTurn.effort!, 2.5);
  assert.deepEqual(internal.joints.find(j => j.key === slide)!.limit, doc.robot.joints![slide]);

  const next = r.setJoints({ joints: { [turn]: { lower: -45 }, [slide]: { velocity: 25 } } });
  assert.deepEqual(next.doc.robot!.joints![turn], { lower: -45, upper: 120, velocity: 180, effort: 2500 });
  assert.deepEqual(next.doc.robot!.joints![slide], { lower: -40, upper: 10, velocity: 25, effort: 15 });
  const nextTurn = next.joints().joints.find(j => j.key === turn)!.limit!;
  for (const [key, value] of Object.entries(next.doc.robot!.joints![turn])) close(nextTurn[key as keyof typeof nextTurn]!, value);
  assert.equal(JSON.stringify(r.doc), before);
  assert.equal(r.setJoints({ joints: { [turn]: null } }).doc.robot!.joints![turn], undefined);
});

test('the shared public tree scales mixed mimic multipliers and offsets in both directions', () => {
  // Pure unit fixture: no row, catalogue or product-provenance claim.
  const tree: JointTree = { version: 1, base: 'base', links: [], loops: [], couplings: [], problems: [], notes: [], joints: [
    { key: 'turn', type: 'continuous', parent: 'base', child: 'a', origin: [0, 0, 0], axis: [0, 0, 1], mates: [] },
    { key: 'slide', type: 'prismatic', parent: 'a', child: 'b', origin: [0, 0, 0], axis: [0, 0, 1], mates: [], mimic: { joint: 'turn', multiplier: 180 / Math.PI, offset: 3 } },
    { key: 'follower', type: 'continuous', parent: 'b', child: 'c', origin: [0, 0, 0], axis: [0, 0, 1], mates: [], mimic: { joint: 'slide', multiplier: Math.PI / 180, offset: Math.PI / 6 } },
  ] };
  const before = JSON.stringify(tree), out = jointTreeOut(tree);
  close(out.joints[1].mimic!.multiplier, 1); close(out.joints[1].mimic!.offset, 3);
  close(out.joints[2].mimic!.multiplier, 1); close(out.joints[2].mimic!.offset, 30);
  assert.equal(JSON.stringify(tree), before);
});

test('a coupled gear facade keeps its dimensionless ratio and degree pose values', () => {
  const doc = docOf('gear-joint');
  // Local gear angles are +45/-30 degrees. Couplings use a common plane, not these local axes.
  for (const [id, angle] of [['g1', 45], ['g2', -30]] as const) {
    const gear = doc.instances!.find(i => i.id === id)!.doc.nodes.find(n => n.kind === 'gear');
    assert.ok(gear?.kind === 'gear');
    gear.rotation = angle;
  }
  const view = viewOf(doc), localG1 = view.parts.get('g1')![0].gear!, localG2 = view.parts.get('g2')![0].gear!;
  const beforeLocal = JSON.stringify([localG1, localG2]);
  close(localG1.rotation, Math.PI / 4); close(localG2.rotation, -Math.PI / 6);
  assert.deepEqual(solveDoc(doc).doc.instances!.map(i => i.rotation), [[0, 0, 0], [0, 0, 0]]);
  // For +Z, across(z) chooses x=+Y, y=-X. The solved gears' local +X is world +X.
  // worldX·x=0 and worldX·y=-1, so atan2(-1,0)=-pi/2: a -90 degree basis offset.
  const worldX = [1, 0, 0], x = [0, 1, 0], y = [-1, 0, 0];
  const dx = worldX.reduce((s, v, i) => s + v * x[i], 0), dy = worldX.reduce((s, v, i) => s + v * y[i], 0);
  assert.equal(dx, 0); assert.equal(dy, -1); close(Math.atan2(dy, dx), -Math.PI / 2);
  const raw = treeOf(doc), beforeRaw = JSON.stringify(raw), beforeDoc = JSON.stringify(doc);
  const projected = jointTreeOut(raw), r = new Robot(doc), publicTree = r.joints();
  assert.equal(publicTree.couplings.length, 1);
  assert.deepEqual(raw.couplings[0].g1.center, [0, 0]);
  assert.deepEqual(raw.couplings[0].g2.center, [0, -50]);
  // +45-90=-45; -30-90=-120. These literals follow the basis, not observed output.
  close(raw.couplings[0].g1.rotation, -Math.PI / 4);
  close(raw.couplings[0].g2.rotation, -2 * Math.PI / 3);
  close(publicTree.couplings[0].g1.rotation, -45);
  close(publicTree.couplings[0].g2.rotation, -120);
  assert.equal(JSON.stringify(raw), beforeRaw);
  assert.equal(JSON.stringify(doc), beforeDoc);
  assert.deepEqual(projected, publicTree);
  const follower = publicTree.joints.find(j => j.key === 'base~g2')!;
  close(follower.mimic!.multiplier, -2 / 3); close(follower.mimic!.offset, 0);
  close(r.pose({ 'base~g1': 30 }).values['base~g2'], -20);
  assert.equal(JSON.stringify(raw), beforeRaw);
  assert.equal(JSON.stringify(doc), beforeDoc);
  assert.equal(JSON.stringify([localG1, localG2]), beforeLocal);
});

test('sweep contact at the initial mixed pose returns exact degrees and mm before rounding', () => {
  const doc = docOf('scara');
  doc.instances = [...doc.instances!, { id: 'post', name: 'post', doc: part('post').box({ w: 1000, d: 1000, h: 1000, x: -500, y: -500, z: -500 }).doc, position: [0, 0, 0], rotation: [0, 0, 0], grounded: true }];
  const r = new Robot(doc), before = JSON.stringify(r.doc);
  const [sweep] = r.path([{ 'base~arm1': 45, 'arm2~quill': -12.5 }, { 'base~arm1': 60, 'arm2~quill': -20 }]).check();
  assert.equal(sweep.clear, false); assert.ok(sweep.contact);
  close(sweep.contact.s, 0);
  close(sweep.contact.values['base~arm1'], 45);
  close(sweep.contact.values['arm2~quill'], -12.5);
  assert.equal(JSON.stringify(r.doc), before);
});
