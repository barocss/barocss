import { makeModel, dynamicPart, staticPart } from '../physics-model-input/model.mjs';
import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 30;
const sphere = (id,x,vx,ccd=false) => dynamicPart(id,{kind:'sphere',radiusM:0.05},{positionM:[x,0,0],velocityMps:[vx,0,0]},1,{restitution:0,ccd});
const options={profile:'rigid-discrete-v1',fixedStepSeconds:dt,broadPhase:'direct'};
const scene=(parts,gravityMps2=[0,0,0])=>makeModel({gravityMps2,parts});
const bodies = [sphere('part:left', -0.5, 100, true), sphere('part:right', 0.5, -100)];
function refuses(action, code) {
  assert.throws(action, (cause) => cause instanceof PhysicsError && cause.code === code);
}
const discrete = createPhysicsWorld(scene(bodies.map(part => ({...part,collider:{...part.collider,ccd:false}}))), options);
const missed = discrete.step();
assert.equal(missed.contacts.length, 0);
assert.deepEqual(missed.bodies.map((body) => body.positionM[0]),
  [2.8333333333333335, -2.8333333333333335]);
discrete.dispose();

const world = createPhysicsWorld(scene(bodies), options);
const hit = world.step();
assert.equal(hit.contacts.length, 1);
assert.deepEqual(hit.bodies.map((body) => body.positionM[0]), [-0.05, 0.05]);
assert.deepEqual(hit.bodies.map((body) => body.velocityMps[0]), [0, 0]);
assert.deepEqual(hit.ccdHits.map(({ bodyId, colliderId, normalFixtureToBody }) =>
  [bodyId, colliderId, normalFixtureToBody]),
[['part:left', 'part:right.shape', [-1, 0, 0]]]);
assert.ok(Math.abs(hit.ccdHits[0].toiFraction - 0.135) <= 1e-12);
const retained = world.getState();
hit.ccdHits[0].normalFixtureToBody[0] = 99;
assert.deepEqual(world.getState(), retained);
refuses(() => world.step([{ kind: 'impulse', bodyId: 'part:left',
  impulseNs: [100000, 0, 0] }]), 'NUMERIC_LIMIT');
assert.deepEqual(world.getState(), retained);
const continued = world.step();
world.dispose();

const reversed = createPhysicsWorld(scene([...bodies].reverse()), options);
const reverseHit = reversed.step();
assert.deepEqual(reverseHit.contacts, retained.contacts);
assert.deepEqual(reverseHit.ccdHits, retained.ccdHits);
assert.deepEqual(reverseHit.bodies.map((body) => [body.id, body.positionM[0]]).sort(),
  retained.bodies.map((body) => [body.id, body.positionM[0]]).sort());
assert.deepEqual(reverseHit.bodies.map((body) => [body.id, body.velocityMps[0]]).sort(),
  retained.bodies.map((body) => [body.id, body.velocityMps[0]]).sort());
assert.deepEqual(reversed.step().bodies.map((body) => [body.id, body.positionM[0]]).sort(),
  continued.bodies.map((body) => [body.id, body.positionM[0]]).sort());
reversed.dispose();

const overlap = createPhysicsWorld(scene([sphere('part:left', -0.04, 0, true),
  sphere('part:right', 0.04, 0)]), options);
const overlapState = overlap.step();
assert.equal(overlapState.ccdHits.length, 0);
assert.equal(overlapState.contacts.length, 1);
overlap.dispose();
const separating = createPhysicsWorld(scene([sphere('part:left', -0.5, -100, true),
  sphere('part:right', 0.5, 100)]), options);
const separatingState = separating.step();
assert.equal(separatingState.ccdHits.length, 0);
assert.equal(separatingState.contacts.length, 0);
separating.dispose();

for (const invalid of [
  scene(bodies, [0, -9.81, 0]),
  scene([...bodies, sphere('part:third', 4, 0)]),
  scene([bodies[0], {...(bodies[1]), collider: {...(bodies[1]).collider, ccd: true}}]),
  scene([bodies[0], staticPart('fixture:other', { kind: 'sphere', radiusM: 0.05 }, {positionM: [0.5, 0, 0]}, {restitution: 0})]),
]) refuses(() => createPhysicsWorld(invalid, options), 'INVALID_CONFIG');

console.log(JSON.stringify({ result: 'ok', missedWithoutCcd: true, pairFraction: retained.ccdHits[0].toiFraction,
  stoppedX: retained.bodies.map((body) => body.positionM[0]), contactImpulseNs: retained.contacts[0].normalImpulseNs,
  initialOverlapUsesDiscrete: true, separationUsesDiscrete: true,
  reversedOrderMatches: true, copiedHitAndInvalidRetained: true }));
