import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 60;
const near = (actual, expected, label, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} !== ${expected}`);
const code = (action, expected) => assert.throws(action,
  error => error instanceof PhysicsError && error.code === expected);
const world = (bodies, gravityMps2 = [0, 0, 0]) =>
  createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2, bodies });
const box = {
  id: 'part:box', kind: 'dynamic', shape: { kind: 'box', halfExtentsM: [0.2, 0.1, 0.1] },
  positionM: [0, 0.6, 0], velocityMps: [0, -2, 0], massKg: 1, restitution: 0,
  orientation: [0, 0, Math.sin(Math.PI / 12), Math.cos(Math.PI / 12)],
};
const sphere = { id: 'fixture:sphere', kind: 'static', shape: { kind: 'sphere', radiusM: 0.15 },
  positionM: [0.14, 0.15, 0], restitution: 0 };
const impact = world([box, sphere], [0, -9.81, 0]);
let impactState;
for (let index = 0; index < 30; index++) {
  impactState = impact.step(dt);
  if (impactState.contacts.length) break;
}
assert.ok(impactState.contacts.length, 'oriented box missed the sphere');
const moving = impactState.bodies.find(body => body.id === box.id);
const contact = impactState.contacts[0];
assert.ok(Math.abs(moving.angularVelocityRadps[2]) > 0.01, 'offset contact gave no angular response');
assert.ok(moving.velocityMps[1] > -4, 'normal impulse gave no linear response');
assert.ok(contact.pointM.every(Number.isFinite), 'world contact point is missing');
assert.ok(Math.abs(Math.hypot(...contact.normalAtoB) - 1) < 1e-12, 'contact normal is not unit length');
const copied = impact.getState();
copied.contacts[0].pointM[0] = 99;
copied.bodies[0].inertiaDiagonalKgM2[0] = 99;
assert.notEqual(impact.getState().contacts[0].pointM[0], 99);
assert.notEqual(impact.getState().bodies[0].inertiaDiagonalKgM2[0], 99);

const capsule = {
  id: 'part:capsule', kind: 'dynamic', shape: { kind: 'capsule', radiusM: 0.1, halfLengthM: 0.25 },
  positionM: [0, 0, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0,
  orientation: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
};
const capWorld = world([capsule, { ...sphere, shape: { kind: 'sphere', radiusM: 0.1 },
  positionM: [0.44, 0, 0] }]);
const capState = capWorld.step(dt);
assert.equal(capState.contacts.length, 1, 'rotated capsule endpoint should touch the sphere');
near(capState.contacts[0].pointM[0], 0.34, 'capsule contact point');
assert.deepEqual(capWorld.overlapSphere({ centerM: [-0.25, 0, 0], radiusM: 0.1 }), ['part:capsule']);
assert.equal(capWorld.raycast({ originM: [-1, 0, 0], direction: [1, 0, 0], maxDistanceM: 3 }).bodyId,
  'part:capsule');

const floor = { id: 'fixture:floor', kind: 'static', shape: { kind: 'box', halfExtentsM: [0.5, 0.5, 0.5] },
  positionM: [0, 0.5, 0], restitution: 0 };
const stack = world([{ ...box, positionM: [0, 1.1, 0], velocityMps: [0, 0, 0],
  orientation: [0, 0, 0, 1] }, floor]);
assert.equal(stack.step(dt).contacts.length, 1, 'aligned box/box contact missing');

const diagonal = world([{ ...box, positionM: [3, 3, 0], velocityMps: [0, 0, 0] },
  { ...floor, positionM: [0, 0, 0], shape: { kind: 'box', halfExtentsM: [0.3, 0.1, 0.1] },
    orientation: [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)] }]);
assert.deepEqual(diagonal.overlapSphere({ centerM: [0, 0, 0], radiusM: 0.02 }), ['fixture:floor']);
const boxRay = diagonal.raycast({ originM: [-1, 0, 0], direction: [1, 0, 0], maxDistanceM: 3 });
assert.equal(boxRay?.bodyId, 'fixture:floor');
assert.ok(boxRay.distanceM > 0.7 && boxRay.distanceM < 1, 'oriented box ray distance is wrong');

code(() => world([{ ...box, shape: { kind: 'box', halfExtentsM: [0, 0.1, 0.1] } }]), 'INVALID_CONFIG');
const capsuleFloor = world([capsule, floor]);
assert.ok(capsuleFloor.step(dt).contacts.length > 0,
  'capsule/box contact is now admitted');
capsuleFloor.dispose();
code(() => world([box, { ...sphere, orientation: [0, 0, 0, 2] }]), 'INVALID_CONFIG');
const prior = JSON.stringify(impact.getState());
code(() => impact.step(dt, [{ kind: 'angularImpulse', bodyId: box.id,
  angularImpulseNms: [100000, 0, 0] }]), 'NUMERIC_LIMIT');
assert.equal(JSON.stringify(impact.getState()), prior, 'failed angular step changed accepted world');

impact.dispose(); capWorld.dispose(); stack.dispose(); diagonal.dispose();
console.log(JSON.stringify({ result: 'ok', orientedBoxContact: true,
  boxAngularVelocityRadps: moving.angularVelocityRadps[2], capsuleContactPointX: 0.34,
  boxBoxContact: true, invalidRetainsState: true }));
