import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';
import { createPhysicsScene, createPhysicsReplaySession,
  restorePhysicsReplaySession } from '../../packages/barocss-physics/dist/replay.js';

const dt = 1 / 120;
const material = { static: 1, dynamic: 0.7 };
const box = (id, x, y) => ({ id, kind: 'dynamic',
  shape: { kind: 'box', halfExtentsM: [0.25, 0.25, 0.25] },
  positionM: [x, y, 0], velocityMps: [0, 0, 0], massKg: 1,
  restitution: 0, friction: material });
const floor = { id: 'fixture:floor', kind: 'static',
  shape: { kind: 'box', halfExtentsM: [2, 0.1, 2] },
  positionM: [0, -0.1, 0], restitution: 0, friction: material };
const config = (offset) => ({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0],
  bodies: [box('part:lower', 0, 0.25), box('part:upper', offset, 0.75), floor],
  contactMode: 'persistent-box-v1' });
const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);

function run(offset) {
  const world = createPhysicsWorld(config(offset));
  const log = createHash('sha256');
  const times = [];
  let maxPenetrationM = 0;
  for (let index = 0; index < 480; index++) {
    const start = performance.now();
    const state = world.step(dt);
    times.push(performance.now() - start);
    log.update(JSON.stringify([state.contacts, state.events]));
    maxPenetrationM = Math.max(maxPenetrationM,
      ...state.contacts.map((contact) => contact.penetrationM));
  }
  const state = world.getState();
  world.dispose();
  const sorted = times.sort((a, b) => a - b);
  return { state, maxPenetrationM, logSha256: log.digest('hex'),
    p95StepMs: sorted[Math.ceil(sorted.length * 0.95) - 1] };
}

function checkRest(result, offset) {
  const lower = result.state.bodies.find((body) => body.id === 'part:lower');
  const upper = result.state.bodies.find((body) => body.id === 'part:upper');
  for (const [body, x, y] of [[lower, 0, 0.25], [upper, offset, 0.75]]) {
    near(body.positionM[0], x, 0.01, `${body.id} X`);
    near(body.positionM[1], y, 0.005, `${body.id} Y`);
    assert.ok(Math.hypot(...body.velocityMps) <= 0.02, `${body.id} linear speed`);
    assert.ok(Math.hypot(...body.angularVelocityRadps) <= 0.02,
      `${body.id} angular speed`);
  }
  assert.ok(result.maxPenetrationM <= 0.005, 'stack penetration');
  return { lower: lower.positionM, upper: upper.positionM,
    lowerAngularRadps: Math.hypot(...lower.angularVelocityRadps),
    upperAngularRadps: Math.hypot(...upper.angularVelocityRadps) };
}

const centered = run(0);
const offset = run(0.05);
const offsetRepeat = run(0.05);
const centeredState = checkRest(centered, 0);
const offsetState = checkRest(offset, 0.05);
assert.deepEqual(offsetRepeat.state, offset.state, 'repeated final state changed');
assert.equal(offsetRepeat.logSha256, offset.logSha256, 'contact/event order changed');
for (const damaged of [
  { ...config(0.05), contactMode: 'unsupported' },
  { ...config(0.05), bodies: [...config(0.05).bodies,
    box('part:extra1', 2, 0.25), box('part:extra2', 3, 0.25)] },
]) assert.throws(() => createPhysicsWorld(damaged),
  (error) => error instanceof PhysicsError && error.code === 'INVALID_CONFIG');

const accepted = createPhysicsWorld(config(0.05));
const control = createPhysicsWorld(config(0.05));
accepted.step(dt); control.step(dt);
const beforeInvalid = accepted.getState();
assert.throws(() => accepted.step(dt, [{ kind: 'impulse', bodyId: 'part:upper',
  impulseNs: [Number.NaN, 0, 0] }]),
(error) => error instanceof PhysicsError && error.code === 'INVALID_COMMAND');
assert.deepEqual(accepted.getState(), beforeInvalid);
assert.deepEqual(accepted.step(dt), control.step(dt), 'failed step changed warm-start state');
const copied = accepted.getState();
copied.contacts[0].pointM[0] = 99;
assert.notEqual(accepted.getState().contacts[0].pointM[0], 99);
accepted.dispose(); control.dispose();

const scene = createPhysicsScene(config(0.05), { revision: 'offsetStackRev1', sourceRevision: null });
const replay = createPhysicsReplaySession(scene);
for (let index = 0; index < 120; index++) replay.step();
const snapshot = replay.saveSnapshot();
const restored = restorePhysicsReplaySession(snapshot, scene);
assert.deepEqual(restored.getState(), replay.getState());
assert.deepEqual(restored.step(), replay.step());
replay.dispose(); restored.dispose();

const rotated = createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2: [0, 0, 0],
  bodies: [box('part:lower', 0, 0.25), { ...box('part:upper', 0.2, 0.68),
    orientation: [0, 0, Math.sin(Math.PI / 12), Math.cos(Math.PI / 12)] }, floor],
  contactMode: 'persistent-box-v1' });
const rotatedState = rotated.step(dt);
assert.ok(rotatedState.contacts.length > 0);
assert.ok(rotatedState.contacts.every((contact) =>
  [...contact.normalAtoB, ...contact.pointM, contact.penetrationM].every(Number.isFinite)));
rotated.dispose();

console.log(JSON.stringify({ result: 'ok', steps: 480, centered: centeredState,
  offset: offsetState, maxPenetrationM: offset.maxPenetrationM,
  p95StepMs: offset.p95StepMs, contactLogSha256: offset.logSha256,
  invalidAndReplayRetained: true }));
