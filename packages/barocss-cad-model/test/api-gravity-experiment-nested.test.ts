// This regression defines its own fixture; importing it does not run the original nine experiment tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BarocssError, Robot } from '../src/api';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';

const KEY = 'base~rod';
function rodDoc(): StudioDoc {
  const rod: StudioDoc = { ...emptyDoc(), nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, -5], max: [100, 5] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [0, 0, -5] },
  ], bodies: { b1: { material: 'al6061' } } };
  return { ...emptyDoc(), instances: [{ id: 'rod', name: 'Rod', doc: rod, position: [0, 0, 0], rotation: [0, 0, 0] }],
    mates: [
      { id: 'axis', kind: 'concentric', a: { part: 'base', face: 'origin:xz', at: {} }, b: { part: 'rod', face: 'origin:xz', at: {} } },
      { id: 'seat', kind: 'coincident', a: { part: 'base', face: 'origin:xz' }, b: { part: 'rod', face: 'origin:xz' } },
    ], robot: { version: 1, base: 'base' } };
}

test('gravity experiment: nested moving-part payloads are refused even when the top-level gravity reply appears ready', () => {
  const input = { values: { [KEY]: 0 }, gravity: [0, 0, -9806.65] as [number, number, number] };
  const base = new Robot(rodDoc()), ownInertia = base.inertia(), ownGravity = base.gravity(input.values, input.gravity);
  const payload: StudioDoc = { ...emptyDoc(), nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
  ], bodies: { b1: { material: 'al6061' } } };
  for (const hidden of [false, true]) {
    const doc = rodDoc();
    doc.instances![0].doc.instances = [{ id: 'payload', name: 'Payload', doc: structuredClone(payload),
      position: [100, 0, 0], rotation: [0, 0, 0], hidden }];
    const before = structuredClone(doc), robot = new Robot(doc), joints = robot.joints();
    assert.equal(joints.joints.length, 1);
    assert.equal(joints.joints[0].key, KEY); assert.equal(joints.joints[0].type, 'continuous');
    assert.deepEqual(joints.problems, []); assert.deepEqual(joints.loops, []);
    // Existing replies count the rod's own outputs, not this nested payload. Preserve that existing behavior,
    // but do not let its apparently complete reply certify the restricted experiment's moving mass.
    const inertia = robot.inertia(), gravity = robot.gravity(input.values, input.gravity);
    assert.deepEqual(inertia, ownInertia); assert.deepEqual(gravity, ownGravity);
    const moving = inertia.links.find(link => link.link === 'rod')!;
    assert.ok(moving); assert.ok(Math.abs(moving.mass - 27) <= 1e-9);
    assert.deepEqual(moving.issues, []); assert.ok(moving.bodies.every(body => !body.assumed && body.mass > 0));
    assert.equal(gravity.notReady, undefined); assert.ok(Number.isFinite(gravity.torques[KEY]));
    assert.throws(() => robot.gravityExperiment(input), error => error instanceof BarocssError
      && error.code === 'ROBOT' && /Nested part occurrences/.test(error.message), `hidden=${hidden}`);
    assert.deepEqual(doc, before); assert.deepEqual(robot.doc, before);
    assert.deepEqual(input, { values: { [KEY]: 0 }, gravity: [0, 0, -9806.65] });
  }
});
