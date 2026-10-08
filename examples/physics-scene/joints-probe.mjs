import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const code = (action, expected) => assert.throws(action,
  error => error instanceof PhysicsError && error.code === expected);
const body = (id, kind, radiusM = 0.1) => kind === 'dynamic'
  ? { id, kind, shape: { kind: 'sphere', radiusM }, positionM: [0, 0, 0],
    velocityMps: [0, 0, 0], massKg: 1, restitution: 0 }
  : { id, kind, shape: { kind: 'sphere', radiusM }, positionM: [0, 0, 0], restitution: 0 };
const fixed = { id: 'joint:fixed', kind: 'fixed', aId: 'fixture:anchor', bId: 'part:held',
  anchorALocalM: [0, 0, 0], anchorBLocalM: [0, 0, 0] };
const create = (dt, bodies, joints, gravityMps2 = [0, 0, 0]) =>
  createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2, bodies, joints });
const anchored = create(1 / 120, [body('fixture:anchor', 'static'), body('part:held', 'dynamic')],
  [fixed], [0, -9.81, 0]);
let fixedState;
for (let index = 0; index < 120; index++) fixedState = anchored.step(1 / 120);
assert.ok(Math.abs(fixedState.bodies[1].positionM[1]) < 1e-6, 'fixed joint drifted');
assert.ok(fixedState.joints[0].linearImpulseNs[1] > 0, 'fixed reaction is missing');
assert.equal(fixedState.contacts.length, 0, 'connected bodies should not collide');
const returned = anchored.getState();
returned.joints[0].linearImpulseNs[1] = 99;
assert.notEqual(anchored.getState().joints[0].linearImpulseNs[1], 99, 'joint reaction was not copied');

const carried = create(1 / 60, [body('fixture:anchor', 'kinematic'), body('part:held', 'dynamic')], [fixed]);
const carriedState = carried.step(1 / 60, [{ kind: 'kinematicTarget', bodyId: 'fixture:anchor',
  positionM: [0.1, 0, 0] }]);
assert.ok(Math.abs(carriedState.bodies[1].positionM[0] - 0.1) < 1e-9);
assert.ok(Math.abs(carriedState.bodies[1].velocityMps[0] - 6) < 1e-9);
carried.dispose();

const hinge = { id: 'joint:hinge', kind: 'hinge', aId: 'fixture:anchor', bId: 'part:held',
  anchorALocalM: [0, 0, 0], anchorBLocalM: [0, 0, 0],
  axisWorld: [0, 0, 1], limitRad: [-0.5, 0.5] };
const rotating = create(1 / 60,
  [body('fixture:anchor', 'static'), body('part:held', 'dynamic', 1)], [hinge]);
let hingeState = rotating.step(1 / 60, [{ kind: 'angularImpulse', bodyId: 'part:held',
  angularImpulseNms: [0, 0, 0.4] }]);
let stoppedAt = null, reactionAtStop = 0;
for (let index = 1; index < 40; index++) {
  hingeState = rotating.step(1 / 60);
  assert.ok(hingeState.joints[0].angleRad <= 0.5 + 1e-9);
  if (stoppedAt === null && Math.abs(hingeState.joints[0].angularImpulseNms[2]) > 0.01) {
    stoppedAt = index + 1;
    reactionAtStop = hingeState.joints[0].angularImpulseNms[2];
  }
}
assert.ok(stoppedAt !== null && stoppedAt <= 40, 'hinge did not stop at the limit');
assert.ok(Math.abs(hingeState.joints[0].angleRad - 0.5) < 1e-9);
assert.equal(hingeState.bodies[1].angularVelocityRadps[2], 0);
assert.ok(reactionAtStop < 0, 'limit reaction points in the wrong direction');

const orbit = create(1 / 60, [body('fixture:anchor', 'static'),
  { ...body('part:held', 'dynamic', 1), positionM: [1, 0, 0] }],
  [{ ...hinge, anchorBLocalM: [-1, 0, 0] }]);
const orbitState = orbit.step(1 / 60, [{ kind: 'angularImpulse', bodyId: 'part:held',
  angularImpulseNms: [0, 0, 0.4] }]);
assert.ok(Math.abs(orbitState.bodies[1].positionM[0] - Math.cos(1 / 60)) < 1e-9);
assert.ok(Math.abs(orbitState.bodies[1].positionM[1] - Math.sin(1 / 60)) < 1e-9);
orbit.dispose();

const fixedBodies = [body('fixture:anchor', 'static'), body('part:held', 'dynamic')];
code(() => create(1 / 60, fixedBodies, [{ ...fixed, bId: 'missing:body' }]), 'INVALID_CONFIG');
code(() => create(1 / 60, fixedBodies, [{ ...fixed, anchorBLocalM: [1, 0, 0] }]), 'INVALID_CONFIG');
code(() => create(1 / 60, fixedBodies, [fixed, { ...fixed, id: 'joint:second' }]), 'INVALID_CONFIG');
code(() => create(1 / 60, fixedBodies, [{ ...hinge, limitRad: [0.3, -0.3] }]), 'INVALID_CONFIG');
const before = JSON.stringify(rotating.getState());
code(() => rotating.step(1 / 60, [{ kind: 'angularImpulse', bodyId: 'part:held',
  angularImpulseNms: [100000, 0, 0] }]), 'NUMERIC_LIMIT');
assert.equal(JSON.stringify(rotating.getState()), before, 'failed step replaced accepted joint state');

anchored.dispose(); rotating.dispose();
code(() => rotating.getState(), 'DISPOSED');
console.log(JSON.stringify({ result: 'ok', fixedY: fixedState.bodies[1].positionM[1],
  fixedReactionY: fixedState.joints[0].linearImpulseNs[1], hingeStopStep: stoppedAt,
  hingeAngleRad: hingeState.joints[0].angleRad, hingeReactionZ: reactionAtStop,
  invalidRetainsState: true }));
