import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 120;
const ball = (overrides = {}) => ({ id: 'part:ball', kind: 'dynamic',
  shape: { kind: 'sphere', radiusM: 0.1 }, positionM: [0, 0.6, 0],
  velocityMps: [0, 0, 0], massKg: 1, restitution: 0, ...overrides });
const box = (id, positionM, halfExtentsM = [0.5, 0.5, 0.5]) => ({
  id, kind: 'static', shape: { kind: 'box', halfExtentsM }, positionM, restitution: 0 });
const config = (bodies, extras = {}) => ({ fixedStepSeconds: dt,
  gravityMps2: [0, -9.81, 0], bodies, ...extras });
const bodyPose = (state) => state.bodies.map(({ id, positionM, velocityMps, orientation, angularVelocityRadps }) =>
  ({ id, positionM, velocityMps, orientation, angularVelocityRadps }));
const equivalent = (left, right) => {
  assert.deepEqual(bodyPose(left), bodyPose(right));
  assert.deepEqual(left.contacts, right.contacts);
  assert.deepEqual(left.events, right.events);
  assert.deepEqual(left.joints, right.joints);
  assert.deepEqual(left.ccdHits, right.ccdHits);
};
const compare = (source, commands = []) => {
  const direct = createPhysicsWorld(source);
  const broad = createPhysicsWorld({ ...source, broadPhase: 'aabb' });
  const expected = direct.step(source.fixedStepSeconds, commands);
  const actual = broad.step(source.fixedStepSeconds, commands);
  equivalent(expected, actual);
  direct.dispose(); broad.dispose();
  return actual;
};

const crowded = [ball(), box('fixture:floor', [0, 0, 0]),
  ...Array.from({ length: 30 }, (_, index) => box(`fixture:far:${index}`, [20 * (index + 1), 0, 0]))];
const scene = config(crowded);
function run(extra = {}) {
  const world = createPhysicsWorld({ ...scene, ...extra });
  const states = [];
  const startHeap = process.memoryUsage().heapUsed;
  const start = performance.now();
  let eligiblePairs = 0, candidatePairs = 0, aabbTests = 0;
  for (let step = 0; step < 120; step++) {
    const state = world.step(dt);
    states.push(state);
    eligiblePairs += state.pairStats.eligiblePairs;
    candidatePairs += state.pairStats.candidatePairs;
    aabbTests += state.pairStats.aabbTests;
  }
  const wallMs = performance.now() - start;
  const heapDeltaBytes = process.memoryUsage().heapUsed - startHeap;
  world.dispose();
  return { states, eligiblePairs, candidatePairs, aabbTests, wallMs, heapDeltaBytes };
}
const direct = run();
const broad = run({ broadPhase: 'aabb' });
assert.equal(direct.eligiblePairs, 29_760);
assert.equal(direct.candidatePairs, 29_760);
assert.equal(direct.aabbTests, 0);
assert.equal(broad.eligiblePairs, direct.eligiblePairs);
assert.equal(broad.aabbTests, direct.eligiblePairs);
assert.ok(broad.candidatePairs < direct.candidatePairs / 10);
for (let index = 0; index < direct.states.length; index++) equivalent(direct.states[index], broad.states[index]);
assert.ok(broad.states.some((state) => state.contacts.length > 0));

const angle = Math.PI / 8;
const oriented = compare(config([ball({ positionM: [0, 0.82, 0], velocityMps: [0, -2, 0] }),
  { ...box('fixture:rotated', [0, 0.4, 0], [0.5, 0.02, 0.5]),
    orientation: [0, 0, Math.sin(angle), Math.cos(angle)] }]));
assert.ok(oriented.pairStats.candidatePairs > 0);
const capsule = compare(config([ball({ positionM: [0, 0.52, 0] }),
  { id: 'fixture:capsule', kind: 'static', shape: { kind: 'capsule', radiusM: 0.2, halfLengthM: 0.3 },
    positionM: [0, 0.3, 0], orientation: [0, 0, Math.sin(angle), Math.cos(angle)], restitution: 0 }]));
assert.ok(capsule.pairStats.candidatePairs > 0);
const cascade = compare(config([
  ball({ id: 'part:a', positionM: [0, 0, 0] }),
  ball({ id: 'part:b', positionM: [0.15, 0, 0] }),
  { id: 'part:c', kind: 'static', shape: { kind: 'sphere', radiusM: 0.1 },
    positionM: [0.36, 0, 0], restitution: 0 },
], { gravityMps2: [0, 0, 0] }));
assert.ok(cascade.contacts.some((contact) => contact.aId === 'part:b' && contact.bId === 'part:c'));
compare(config([ball({ positionM: [0, 0, 0] }),
  { ...box('fixture:moving', [1, 0, 0], [0.2, 0.2, 0.2]), kind: 'kinematic' }],
{ gravityMps2: [0, 0, 0] }), [{ kind: 'kinematicTarget', bodyId: 'fixture:moving', positionM: [0.3, 0, 0] }]);
const ccdDt = 1 / 30;
const ccd = compare(config([ball({ ccd: true, shape: { kind: 'sphere', radiusM: 0.05 },
  positionM: [0, 1, 0], velocityMps: [0, -100, 0] }),
  box('fixture:thin', [0, 0, 0], [0.5, 0.01, 0.5])],
{ fixedStepSeconds: ccdDt, gravityMps2: [0, 0, 0] }));
assert.equal(ccd.ccdHits.length, 1);

const refuses = (action, code) => assert.throws(action,
  (error) => error instanceof PhysicsError && error.code === code);
refuses(() => createPhysicsWorld({ ...scene, broadPhase: 'grid' }), 'INVALID_CONFIG');
refuses(() => createPhysicsWorld({ ...scene, broadPhase: undefined }), 'INVALID_CONFIG');
refuses(() => createPhysicsWorld(config([ball(), box('fixture:bad', [0, 0, 0], [NaN, 1, 1])],
  { broadPhase: 'aabb' })), 'INVALID_CONFIG');
const guarded = createPhysicsWorld({ ...scene, broadPhase: 'aabb' });
assert.deepEqual(guarded.getState().pairStats, { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 });
const accepted = guarded.step(dt);
accepted.pairStats.candidatePairs = 99;
assert.notEqual(guarded.getState().pairStats.candidatePairs, 99);
const before = JSON.stringify(guarded.getState());
refuses(() => guarded.step(dt, [{ kind: 'impulse', bodyId: 'part:ball',
  impulseNs: [0, -10_000, 0] }]), 'NUMERIC_LIMIT');
assert.equal(JSON.stringify(guarded.getState()), before);
guarded.dispose();
refuses(() => guarded.step(dt), 'DISPOSED');

console.log(JSON.stringify({ result: 'ok', machine: `${process.platform}/${process.arch}/node-${process.version}`,
  direct: { eligiblePairs: direct.eligiblePairs, candidatePairs: direct.candidatePairs,
    wallMs: direct.wallMs, heapDeltaBytes: direct.heapDeltaBytes },
  aabb: { eligiblePairs: broad.eligiblePairs, candidatePairs: broad.candidatePairs,
    aabbTests: broad.aabbTests, wallMs: broad.wallMs, heapDeltaBytes: broad.heapDeltaBytes },
  contactStatesMatch: true, ccdContact: ccd.contacts.length > 0, invalidRetainsState: true }));
