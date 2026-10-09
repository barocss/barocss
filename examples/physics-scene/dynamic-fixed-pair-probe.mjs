import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';
import { createPhysicsScene, createPhysicsReplaySession,
  restorePhysicsReplaySession } from '../../packages/barocss-physics/dist/replay.js';

const stepSeconds = 1 / 120;
const body = (id, x) => ({ id, kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.05 },
  positionM: [x, 0.3, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0 });
const joint = { id: 'joint:pair', kind: 'fixed', aId: 'part:a', bId: 'part:b',
  anchorALocalM: [0.1, 0, 0], anchorBLocalM: [-0.1, 0, 0] };
const scene = (selectedJoint = joint) => ({ fixedStepSeconds: stepSeconds,
  gravityMps2: [0, 0, 0], bodies: [body('part:a', 0), body('part:b', 0.2)],
  joints: [selectedJoint] });
assert.throws(() => createPhysicsWorld(scene({ ...joint, anchorBLocalM: [0, 0, 0] })),
  error => error instanceof PhysicsError && error.code === 'INVALID_CONFIG');
assert.throws(() => createPhysicsWorld(scene({ ...joint, kind: 'hinge',
  axisWorld: [0, 0, 1], limitRad: [-0.5, 0.5] })),
error => error instanceof PhysicsError && error.code === 'INVALID_CONFIG');
assert.throws(() => createPhysicsWorld({ ...scene(), bodies: [
  ...scene().bodies, body('part:c', 0.4)] }),
error => error instanceof PhysicsError && error.code === 'INVALID_CONFIG');

const world = createPhysicsWorld(scene());
let state, peakAnchorGap = 0, peakMomentumError = 0, peakEnergyDrift = 0;
let firstReactionA = null, firstReactionB = null;
const stepMs = [];
for (let step = 1; step <= 120; step++) {
  const start = performance.now();
  state = world.step(stepSeconds, step === 1
    ? [{ kind: 'impulse', bodyId: 'part:b', impulseNs: [0.2, 0, 0] }] : []);
  stepMs.push(performance.now() - start);
  const [a, b] = state.bodies;
  const separation = b.positionM[0] - a.positionM[0];
  const anchorGap = Math.abs(separation - 0.2);
  const momentum = a.velocityMps[0] + b.velocityMps[0];
  const energy = (a.velocityMps[0] ** 2 + b.velocityMps[0] ** 2) / 2;
  peakAnchorGap = Math.max(peakAnchorGap, anchorGap);
  peakMomentumError = Math.max(peakMomentumError, Math.abs(momentum - 0.2));
  if (step >= 30) peakEnergyDrift = Math.max(peakEnergyDrift, Math.abs(energy - 0.01));
  assert.ok(anchorGap <= 1e-4, `anchor gap at step ${step}: ${anchorGap}`);
  assert.ok(Math.abs(momentum - 0.2) <= 0.002, `momentum at step ${step}: ${momentum}`);
  assert.equal(state.contacts.length, 0, 'connected pair must not collide');
  if (step === 1) {
    firstReactionA = a.velocityMps[0];
    firstReactionB = state.joints[0].linearImpulseNs[0];
  }
}
const [a, b] = state.bodies;
const velocityCOM = (a.velocityMps[0] + b.velocityMps[0]) / 2;
assert.ok(Math.abs(velocityCOM - 0.1) <= 0.001);
assert.ok(Math.abs((a.positionM[0] + b.positionM[0]) / 2 - 0.2) <= 0.001);
assert.ok(peakEnergyDrift <= 0.001);
assert.ok(Math.abs(firstReactionB + 0.1) <= 0.002);
assert.ok(Math.abs(firstReactionA + firstReactionB) <= 0.002);
const before = JSON.stringify(world.getState());
assert.throws(() => world.step(stepSeconds, [{ kind: 'impulse', bodyId: 'part:b',
  impulseNs: [100000, 0, 0] }]), error => error instanceof PhysicsError &&
    (error.code === 'INVALID_COMMAND' || error.code === 'NUMERIC_LIMIT'));
assert.equal(JSON.stringify(world.getState()), before, 'failed step replaced accepted pair state');
world.dispose();
const replayScene = createPhysicsScene(scene(), { revision: 'pair1', sourceRevision: 'cad1' });
const replay = createPhysicsReplaySession(replayScene);
for (let step = 1; step <= 30; step++) replay.step(step === 1
  ? [{ kind: 'impulse', bodyId: 'part:b', impulseNs: [0.2, 0, 0] }] : []);
const snapshot = JSON.parse(JSON.stringify(replay.saveSnapshot()));
const restored = restorePhysicsReplaySession(snapshot, replayScene);
assert.deepEqual(restored.getState(), replay.getState(), 'dynamic pair replay changed state');
assert.throws(() => restorePhysicsReplaySession(snapshot,
  createPhysicsScene(scene(), { revision: 'pair1', sourceRevision: 'cad2' })),
error => error instanceof PhysicsError && error.code === 'STALE_SNAPSHOT');
replay.dispose(); restored.dispose();
const sortedStepMs = stepMs.slice().sort((left, right) => left - right);
console.log(JSON.stringify({ result: 'ok', stepIndex: state.stepIndex, velocityCOM,
  peakAnchorGap, peakMomentumError, peakEnergyDrift, firstReactionA, firstReactionB,
  stepP95Ms: sortedStepMs[Math.ceil(sortedStepMs.length * 0.95) - 1],
  invalidRetainsState: true, replayRetained: true, staleSourceRefused: true }));
