import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 120;
const near = (actual, expected, label, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
const capsuleShape = { kind: 'capsule', radiusM: 0.2, halfLengthM: 0.3 };
const dynamicCapsule = (id = 'a:capsule', positionM = [0, 0, 0], orientation) => ({
  id, kind: 'dynamic', shape: capsuleShape, positionM, velocityMps: [0, 0, 0],
  massKg: 1, restitution: 0, ...(orientation ? { orientation } : {}),
});
const staticCapsule = (id = 'z:capsule', positionM = [0.35, 0, 0], orientation) => ({
  id, kind: 'static', shape: capsuleShape, positionM, restitution: 0,
  ...(orientation ? { orientation } : {}),
});
const staticBox = (id = 'z:box', positionM = [0.35, 0, 0], orientation) => ({
  id, kind: 'static', shape: { kind: 'box', halfExtentsM: [0.2, 0.2, 0.2] },
  positionM, restitution: 0, ...(orientation ? { orientation } : {}),
});
const world = (bodies, broadPhase) => createPhysicsWorld({ fixedStepSeconds: dt,
  gravityMps2: [0, 0, 0], bodies, ...(broadPhase ? { broadPhase } : {}) });

function contact(bodies, broadPhase) {
  const instance = world(bodies, broadPhase);
  const state = instance.step(dt);
  instance.dispose();
  return state;
}

function reference(state, normalX, pointX, label) {
  assert.equal(state.contacts.length, 1, `${label}: expected one contact`);
  const hit = state.contacts[0];
  near(hit.normalAtoB[0], normalX, `${label} normal X`, 1e-9);
  near(Math.hypot(...hit.normalAtoB), 1, `${label} normal length`, 1e-9);
  near(hit.penetrationM, 0.05, `${label} penetration`);
  near(hit.pointM[0], pointX, `${label} contact X`);
  near(hit.pointM[1], 0, `${label} contact Y`);
  near(hit.pointM[2], 0, `${label} contact Z`);
  assert.ok([...hit.normalAtoB, ...hit.pointM, hit.penetrationM].every(Number.isFinite));
  return hit;
}

const capsuleBox = reference(contact([dynamicCapsule(), staticBox()]), 1, 0.15, 'capsule/box');
reference(contact([staticBox(), dynamicCapsule()]), 1, 0.15, 'input order');
const reversedBox = contact([staticBox('a:box'), dynamicCapsule('z:capsule')]);
reference(reversedBox, -1, 0.15, 'box/capsule');
const capsuleCapsule = reference(contact([dynamicCapsule(), staticCapsule()]), 1,
  0.15, 'capsule/capsule');
reference(contact([staticCapsule('a:right'), dynamicCapsule('z:left')]), -1,
  0.15, 'reversed capsule/capsule');

const quarterTurn = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
for (const [label, bodies] of [
  ['rotated box', [dynamicCapsule(), staticBox('z:box', [0.22, 0, 0], quarterTurn)]],
  ['crossing capsules', [dynamicCapsule(), staticCapsule('z:capsule', [0, 0, 0], quarterTurn)]],
]) {
  const direct = contact(bodies);
  const aabb = contact(bodies, 'aabb');
  assert.equal(direct.contacts.length, 1, `${label} missed contact`);
  assert.deepEqual(aabb.contacts, direct.contacts, `${label} AABB changed contact`);
  near(Math.hypot(...direct.contacts[0].normalAtoB), 1, `${label} normal`, 1e-9);
  if (label === 'crossing capsules') {
    assert.deepEqual(direct.contacts[0].normalAtoB, [1, 0, 0],
      'coincident axes need a deterministic ID-based normal');
  }
}
assert.equal(contact([dynamicCapsule(), staticBox('z:box', [2, 0, 0])]).contacts.length, 0);
assert.equal(contact([dynamicCapsule(), staticCapsule('z:capsule', [2, 0, 0])]).contacts.length, 0);

for (const damaged of [
  { ...dynamicCapsule(), shape: { kind: 'mesh' } },
  { ...dynamicCapsule(), shape: { kind: 'capsule', radiusM: Number.NaN, halfLengthM: 0.3 } },
]) assert.throws(() => world([damaged, staticBox()]),
  (error) => error instanceof PhysicsError && error.code === 'INVALID_CONFIG');
const retained = world([dynamicCapsule(), staticBox()]);
retained.step(dt);
const before = retained.getState();
assert.throws(() => retained.step(Number.NaN),
  (error) => error instanceof PhysicsError && error.code === 'INVALID_STEP');
assert.deepEqual(retained.getState(), before);
const copied = retained.getState();
copied.contacts[0].pointM[0] = 99;
assert.notEqual(retained.getState().contacts[0].pointM[0], 99);
retained.dispose();

console.log(JSON.stringify({ result: 'ok', capsuleBoxPenetrationM: capsuleBox.penetrationM,
  capsuleBoxPointM: capsuleBox.pointM, capsuleCapsulePenetrationM: capsuleCapsule.penetrationM,
  capsuleCapsulePointM: capsuleCapsule.pointM, reversedNormalX: reversedBox.contacts[0].normalAtoB[0],
  orientedPairs: 2, invalidRetainsState: true }));
