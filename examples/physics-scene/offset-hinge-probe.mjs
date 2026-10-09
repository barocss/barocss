import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 120;
const body = (id, x) => ({ id, kind: 'dynamic',
  shape: { kind: 'sphere', radiusM: 0.1 }, positionM: [x, 0, 0],
  velocityMps: [0, 0, 0], massKg: 1, restitution: 0 });
const bodies = [body('part:a', -0.1), body('part:b', 0.1)];
const joint = { id: 'joint:pivot', kind: 'hinge', aId: 'part:a', bId: 'part:b',
  anchorALocalM: [0.1, 0, 0], anchorBLocalM: [-0.1, 0, 0],
  axisWorld: [0, 0, 1], limitRad: [-0.8, 0.8],
  motor: { targetSpeedRadps: 0.5, maxImpulseNms: 0.0001, maxReactionNms: 0.01 } };
const create = (changes = {}) => createPhysicsWorld({ fixedStepSeconds: dt,
  gravityMps2: [0, 0, 0], bodies, joints: [joint], ...changes });
const expectCode = (action, code) => assert.throws(action,
  (cause) => cause instanceof PhysicsError && cause.code === code);
const rotatedAnchor = (body, localX) => [
  body.positionM[0] + localX * (1 - 2 * body.orientation[2] ** 2),
  body.positionM[1] + localX * 2 * body.orientation[2] * body.orientation[3],
  body.positionM[2],
];
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
const metrics = (state) => {
  const [a, b] = state.bodies;
  const gap = distance(rotatedAnchor(a, 0.1), rotatedAnchor(b, -0.1));
  const com = a.positionM.map((value, i) => (value + b.positionM[i]) / 2);
  const linear = a.velocityMps.map((value, i) => value + b.velocityMps[i]);
  const angular = state.bodies.reduce((sum, item) => sum +
    item.positionM[0] * item.velocityMps[1] - item.positionM[1] * item.velocityMps[0] +
    0.004 * item.angularVelocityRadps[2], 0);
  const energy = state.bodies.reduce((sum, item) => sum +
    0.5 * item.velocityMps.reduce((s, velocity) => s + velocity ** 2, 0) +
    0.002 * item.angularVelocityRadps.reduce((s, speed) => s + speed ** 2, 0), 0);
  return { gap, com: Math.hypot(...com), linear: Math.hypot(...linear),
    angular: Math.abs(angular), energy };
};

expectCode(() => create({ joints: [{ ...joint, anchorALocalM: [0.101, 0, 0] }] }), 'INVALID_CONFIG');
expectCode(() => create({ bodies: [body('part:a', -0.1), body('part:b', 0.101)] }), 'INVALID_CONFIG');
const world = create();
const replay = create();
const times = [];
const peaks = { gap: 0, com: 0, linear: 0, angular: 0, reaction: 0 };
const trace = [];
for (let step = 1; step <= 120; step++) {
  const start = performance.now();
  const state = world.step(dt);
  times.push(performance.now() - start);
  replay.step(dt);
  const measurement = metrics(state);
  for (const key of ['gap', 'com', 'linear', 'angular']) {
    peaks[key] = Math.max(peaks[key], measurement[key]);
  }
  peaks.reaction = Math.max(peaks.reaction,
    Math.hypot(...state.joints[0].angularImpulseNms));
  if ([1, 60, 120].includes(step)) trace.push({ step, angleRad: state.joints[0].angleRad,
    energyJ: measurement.energy, motorImpulseNms: state.joints[0].motorImpulseNms,
    reactionNms: state.joints[0].angularImpulseNms,
    anchorGapM: measurement.gap });
}
assert.equal(JSON.stringify(world.getState()), JSON.stringify(replay.getState()));
assert.ok(peaks.gap <= 1e-5, `anchor gap ${peaks.gap}`);
assert.ok(peaks.com <= 1e-5, `COM drift ${peaks.com}`);
assert.ok(peaks.linear <= 1e-7, `linear momentum drift ${peaks.linear}`);
assert.ok(peaks.angular <= 1e-7, `angular momentum drift ${peaks.angular}`);
const accepted = JSON.stringify(world.getState());
expectCode(() => world.step(dt, [{ kind: 'impulse', bodyId: 'part:a',
  impulseNs: [0.001, 0, 0] }]), 'INVALID_COMMAND');
expectCode(() => world.step(dt, [{ kind: 'angularImpulse', bodyId: 'part:a',
  angularImpulseNms: [0.001, 0, 0] }]), 'INVALID_COMMAND');
assert.equal(JSON.stringify(world.getState()), accepted);
expectCode(() => world.step(dt, [{ kind: 'angularImpulse', bodyId: 'part:b',
  angularImpulseNms: [0, 0, 0.1] }]), 'NUMERIC_LIMIT');
assert.equal(JSON.stringify(world.getState()), accepted);
times.sort((a, b) => a - b);
console.log(JSON.stringify({ result: 'ok', peaks, trace,
  p95StepMs: times[Math.ceil(times.length * 0.95) - 1], overloadRetainedAt: 120 }));
world.dispose(); replay.dispose();
