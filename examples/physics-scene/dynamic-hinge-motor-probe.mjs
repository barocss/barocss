import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 120;
const sphere = (id, positionM = [0, 0, 0]) => ({ id, kind: 'dynamic',
  shape: { kind: 'sphere', radiusM: 0.1 }, positionM,
  velocityMps: [0, 0, 0], massKg: 1, restitution: 0 });
const bodies = [sphere('part:a'), sphere('part:b')];
const hinge = { id: 'joint:pair', kind: 'hinge', aId: 'part:a', bId: 'part:b',
  anchorALocalM: [0, 0, 0], anchorBLocalM: [0, 0, 0], axisWorld: [0, 0, 1],
  limitRad: [-0.51, 0.51], motor: { targetSpeedRadps: 0.5,
    maxImpulseNms: 0.0001, maxReactionNms: 0.0005 } };
const create = (scene = {}) => createPhysicsWorld({ fixedStepSeconds: dt,
  gravityMps2: [0, 0, 0], bodies, joints: [hinge], ...scene });
const code = (action, expected) => assert.throws(action,
  error => error instanceof PhysicsError && error.code === expected);
const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} ≠ ${expected}`);

code(() => create({ gravityMps2: [0, -9.81, 0] }), 'INVALID_CONFIG');
code(() => create({ bodies: [sphere('part:a'), sphere('part:b', [0.01, 0, 0])] }), 'INVALID_CONFIG');
code(() => create({ joints: [{ ...hinge, anchorALocalM: [0.01, 0, 0] }] }), 'INVALID_CONFIG');
code(() => create({ bodies: [...bodies, sphere('part:c')] }), 'INVALID_CONFIG');

const world = create();
let state;
for (let step = 1; step <= 120; step++) {
  state = world.step(dt);
  if (step <= 10) {
    assert.ok(state.joints[0].motorImpulseNms > 0 &&
      state.joints[0].motorImpulseNms <= 0.0001 + 1e-12);
  }
  near(state.bodies[0].positionM[0], 0, 1e-12, 'A centre');
  near(state.bodies[1].positionM[0], 0, 1e-12, 'B centre');
  const pairMomentum = 0.004 * (state.bodies[0].angularVelocityRadps[2] +
    state.bodies[1].angularVelocityRadps[2]);
  near(pairMomentum, 0, 1e-12, 'pair angular momentum');
  if (step === 10) {
    near(state.bodies[0].angularVelocityRadps[2], -0.25, 1e-9, 'A speed at 10');
    near(state.bodies[1].angularVelocityRadps[2], 0.25, 1e-9, 'B speed at 10');
  }
}
near(state.joints[0].angleRad, 0.48125, 1e-6, 'angle at 120');
near(state.joints[0].angularImpulseNms[2], 0, 1e-9, 'reaction at 120');
const energy = state.bodies.reduce((sum, body) =>
  sum + 0.5 * 0.004 * body.angularVelocityRadps[2] ** 2, 0);
near(energy, 0.00025, 1e-9, 'energy at 120');

state = world.step(dt, [{ kind: 'angularImpulse', bodyId: 'part:b',
  angularImpulseNms: [0, 0, 0.01] }]);
assert.equal(state.stepIndex, 121);
const accepted = JSON.stringify(world.getState());
code(() => world.step(dt), 'NUMERIC_LIMIT');
assert.equal(JSON.stringify(world.getState()), accepted);
code(() => world.step(dt, [{ kind: 'impulse', bodyId: 'part:a',
  impulseNs: [0, 0, 0] }]), 'INVALID_COMMAND');
code(() => world.step(dt, [{ kind: 'angularImpulse', bodyId: 'part:a',
  angularImpulseNms: [0.001, 0, 0] }]), 'INVALID_COMMAND');
assert.equal(JSON.stringify(world.getState()), accepted);

const replay = create(), replayAgain = create();
for (let step = 0; step < 30; step++) {
  replay.step(dt); replayAgain.step(dt);
}
assert.equal(JSON.stringify(replay.getState()), JSON.stringify(replayAgain.getState()));

world.dispose(); replay.dispose(); replayAgain.dispose();
console.log(JSON.stringify({ result: 'ok', angle120Rad: 0.48125,
  energy120J: energy, overloadRetainsStep: 121, replaySteps: 30 }));
