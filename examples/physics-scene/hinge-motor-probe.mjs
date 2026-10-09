import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 120;
const bodies = [
  { id: 'fixture:anchor', kind: 'static', shape: { kind: 'sphere', radiusM: 0.1 },
    positionM: [0, 0, 0], restitution: 0 },
  { id: 'part:rotor', kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.1 },
    positionM: [0, 0, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0 },
];
const hinge = { id: 'joint:hinge', kind: 'hinge', aId: 'fixture:anchor', bId: 'part:rotor',
  anchorALocalM: [0, 0, 0], anchorBLocalM: [0, 0, 0], axisWorld: [0, 0, 1],
  limitRad: [-0.5, 0.5], motor: { targetSpeedRadps: 0.5, maxImpulseNms: 0.0001,
    maxReactionNms: 0.0005 } };
const create = (joint = hinge) => createPhysicsWorld({ fixedStepSeconds: dt,
  gravityMps2: [0, 0, 0], bodies, joints: [joint] });
const code = (action, expected) => assert.throws(action,
  error => error instanceof PhysicsError && error.code === expected);

for (const motor of [{ ...hinge.motor, targetSpeedRadps: 3 },
  { ...hinge.motor, maxImpulseNms: -1 }, { ...hinge.motor, maxImpulseNms: 0 },
  { ...hinge.motor, maxReactionNms: 0 }, { ...hinge.motor, extra: 1 }]) {
  code(() => create({ ...hinge, motor }), 'INVALID_CONFIG');
}
const world = create();
let state;
for (let step = 1; step <= 120; step++) {
  state = world.step(dt);
  if (step <= 20) assert.ok(state.joints[0].motorImpulseNms > 0 &&
    state.joints[0].motorImpulseNms <= 0.0001 + 1e-12);
  if (step === 20) assert.ok(Math.abs(state.bodies[1].angularVelocityRadps[2] - 0.5) < 1e-9);
}
assert.ok(Math.abs(state.joints[0].angleRad - 0.4604166667) < 1e-6);
const angle120Rad = state.joints[0].angleRad;
assert.ok(Math.abs(state.joints[0].angularImpulseNms[2]) < 1e-9);
state = world.step(dt, [{ kind: 'angularImpulse', bodyId: 'part:rotor',
  angularImpulseNms: [0, 0, 0.01] }]);
assert.equal(state.stepIndex, 121);
const accepted = JSON.stringify(world.getState());
code(() => world.step(dt), 'NUMERIC_LIMIT');
assert.equal(JSON.stringify(world.getState()), accepted);

const replay = create();
for (let step = 0; step < 30; step++) replay.step(dt);
const replayState = JSON.stringify(replay.getState());
const replayAgain = create();
for (let step = 0; step < 30; step++) replayAgain.step(dt);
assert.equal(JSON.stringify(replayAgain.getState()), replayState);

const atLimit = create({ ...hinge, motor: { ...hinge.motor, maxReactionNms: 0.01 } });
for (let step = 0; step < 140; step++) state = atLimit.step(dt);
assert.equal(state.joints[0].angleRad, 0.5);
assert.equal(state.joints[0].motorImpulseNms, 0);
assert.equal(state.bodies[1].angularVelocityRadps[2], 0);
const unpoweredJoint = structuredClone(hinge);
delete unpoweredJoint.motor;
const unpowered = create(unpoweredJoint);
assert.equal(Object.hasOwn(unpowered.getState().joints[0], 'motorImpulseNms'), false);

world.dispose(); replay.dispose(); replayAgain.dispose(); atLimit.dispose(); unpowered.dispose();
console.log(JSON.stringify({ result: 'ok', angle120Rad,
  overloadRetainsStep: 121, replaySteps: 30 }));
