import { makeModel, dynamicPart, staticPart } from '../physics-model-input/model.mjs';
import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 120;
const ball = (id, positionM, velocityMps = [0, 0, 0], restitution = 0) => (dynamicPart(id, { kind: 'sphere', radiusM: 0.2 }, {positionM: positionM, velocityMps: velocityMps}, 1, {restitution: restitution}));
const box = () => (staticPart('fixture:box', { kind: 'box', halfExtentsM: [1, 0.25, 1] }, {positionM: [0, 0.25, 0]}, {restitution: 0}));
const create = (bodies, gravityMps2 = [0, -9.81, 0]) => createPhysicsWorld(makeModel({gravityMps2, parts: bodies}), {profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct'});

const fall = create([ball('part:fall', [0, 2, 0])]);
const untouchedInput = fall.getState();
const first = fall.step();
assert.equal(first.stepIndex, 1);
assert.equal(first.bodies[0].velocityMps[1], -9.81 * dt);
assert.equal(first.bodies[0].positionM[1], 2 - 9.81 * dt * dt);
first.bodies[0].positionM[1] = 900;
assert.notEqual(fall.getState().bodies[0].positionM[1], 900);
assert.equal(untouchedInput.bodies[0].positionM[1], 2);
const beforeRefusal = fall.getState();
assert.throws(() => fall.step(dt * 2), (error) => error instanceof PhysicsError && error.code === 'INVALID_COMMAND');
assert.deepEqual(fall.getState(), beforeRefusal);
fall.dispose();
fall.dispose();
assert.throws(() => fall.getState(), (error) => error.code === 'DISPOSED');

const landing = create([ball('part:landing', [0, 2, 0]), box()]);
let contactAt = -1;
for (let i = 0; i < 160; i++) {
  const state = landing.step();
  if (contactAt < 0 && state.contacts.length) contactAt = state.stepIndex;
}
assert.ok(contactAt > 0 && contactAt < 100);
let restContactCount = 0;
let minHeight = Infinity;
let maxHeight = -Infinity;
for (let i = 0; i < 120; i++) {
  const state = landing.step();
  const height = state.bodies[0].positionM[1];
  minHeight = Math.min(minHeight, height);
  maxHeight = Math.max(maxHeight, height);
  if (state.contacts.length) restContactCount++;
}
assert.ok(Math.abs(landing.getState().bodies[0].positionM[1] - 0.7) < 1e-9);
assert.ok(maxHeight - minHeight < 1e-9);
assert.equal(restContactCount, 120);
assert.deepEqual(landing.getState().contacts.map(({ bodyAId, bodyBId }) => [bodyAId, bodyBId]), [['fixture:box', 'part:landing']]);

const impact = create([ball('part:left', [-0.5, 0, 0], [1, 0, 0], 1), ball('part:right', [0.5, 0, 0], [-1, 0, 0], 1)], [0, 0, 0]);
let collision;
for (let i = 0; i < 50; i++) {
  const state = impact.step();
  if (state.contacts.length) { collision = state; break; }
}
assert.ok(collision, 'two spheres must collide');
assert.ok(collision.bodies[0].velocityMps[0] < -0.99);
assert.ok(collision.bodies[1].velocityMps[0] > 0.99);
assert.ok(collision.contacts[0].normalImpulseNs > 1.9);

const overlap = create([ball('part:inside', [0, 0.25, 0]), box()], [0, 0, 0]);
const resolved = overlap.step();
assert.equal(resolved.bodies[0].positionM[1], -0.2);
assert.ok(resolved.contacts[0].penetrationM > 0);

const atBound = create([ball('part:limit', [9999.99, 2, 0], [1000, 0, 0])], [0, 0, 0]);
const accepted = atBound.getState();
assert.throws(() => atBound.step(), (error) => error.code === 'NUMERIC_LIMIT');
assert.deepEqual(atBound.getState(), accepted);
const tooFast = createPhysicsWorld(makeModel({gravityMps2: [0, 0, 0], parts: [ball('part:fast', [0, 0, 0], [1000, 0, 0])]}), {profile: 'rigid-discrete-v1', fixedStepSeconds: 1 / 30, broadPhase: 'direct'});
assert.throws(() => tooFast.step(), (error) => error.code === 'NUMERIC_LIMIT');
assert.equal(tooFast.getState().stepIndex, 0);
const tooDeep = create([ball('part:deep', [0, 0, 0]),
  {...(box()), body: {...(box()).body, initial: {...(box()).body.initial, positionM: [0, 0, 0]}}, collider: {...(box()).collider, geometry: { kind: 'box', halfExtentsM: [20, 20, 20] }}}], [0, 0, 0]);
assert.throws(() => tooDeep.step(), (error) => error.code === 'NUMERIC_LIMIT');
assert.equal(tooDeep.getState().stepIndex, 0);
const repeatA = create([ball('part:repeat', [0, 2, 0]), box()]);
const repeatB = create([ball('part:repeat', [0, 2, 0]), box()]);
for (let i = 0; i < 90; i++) assert.deepEqual(repeatA.step(), repeatB.step());
assert.throws(() => create([ball('part:repeat', [0, 1, 0]), ball('part:repeat', [1, 1, 0])]),
  (error) => error.code === 'INVALID_CONFIG');
assert.throws(() => create([{...(ball('part:invalid', [0, 1, 0])), collider: {...(ball('part:invalid', [0, 1, 0])).collider, geometry: { kind: 'box', halfExtentsM: [1, 0, 1] }}}]),
  (error) => error.code === 'INVALID_CONFIG');

console.log(JSON.stringify({ freeFallY: beforeRefusal.bodies[0].positionM[1], firstContactStep: contactAt,
  restHeightM: landing.getState().bodies[0].positionM[1], restContactSteps: restContactCount,
  collisionImpulseNs: collision.contacts[0].normalImpulseNs, retainedOnInvalidStepAndNumericLimit: true }));
