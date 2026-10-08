import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 120;
const floor = (collisionFilter) => ({ id: 'fixture:floor', kind: 'static',
  shape: { kind: 'box', halfExtentsM: [4, 0.1, 4] }, positionM: [0, -0.1, 0],
  restitution: 0, ...(collisionFilter ? { collisionFilter } : {}) });
const ball = (id, positionM, collisionFilter) => ({ id, kind: 'dynamic',
  shape: { kind: 'sphere', radiusM: 0.1 }, positionM, velocityMps: [0, 0, 0],
  massKg: 1, restitution: 0, ...(collisionFilter ? { collisionFilter } : {}) });
function grid(count, largeMode) {
  const bodies = [floor(largeMode ? { categoryBits: 8, maskBits: 7 } : undefined)];
  for (let index = 0; index < count; index++) {
    const x = index % 7, z = Math.floor(index / 7);
    const category = [1, 2, 4][Math.floor(index / 21)];
    bodies.push(ball(`part:${String(index).padStart(2, '0')}`,
      [0.35 * (x - 3), 0.1, 0.35 * (z - 4)],
      largeMode ? { categoryBits: category, maskBits: category | 8 } : undefined));
  }
  return { fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0], bodies,
    broadPhase: 'aabb', ...(largeMode ? { sceneMode: 'large-v1' } : {}) };
}
function checkRefusal(action, code) {
  assert.throws(action, (cause) => cause instanceof PhysicsError && cause.code === code);
}
function run(config) {
  const world = createPhysicsWorld(config);
  const elapsed = [];
  let early, final;
  if (global.gc) global.gc();
  const heapStart = global.gc ? process.memoryUsage().heapUsed : null;
  for (let step = 1; step <= 180; step++) {
    const start = performance.now();
    const state = world.step(dt);
    elapsed.push(performance.now() - start);
    if (step === 20) early = state;
    if (step === 180) final = state;
  }
  if (global.gc) global.gc();
  const heapDeltaBytes = global.gc ? process.memoryUsage().heapUsed - heapStart : null;
  const percentile95 = (values) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
  const initialWindowP95Ms = percentile95(elapsed.slice(0, 30));
  const sleepingWindowP95Ms = percentile95(elapsed.slice(-30));
  const sorted = elapsed.sort((a, b) => a - b);
  const measurements = { medianMs: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    initialWindowP95Ms, sleepingWindowP95Ms, heapDeltaBytes };
  return { world, early, final, measurements };
}

const largeConfig = grid(63, true);
const unfiltered = createPhysicsWorld({ ...largeConfig, bodies: largeConfig.bodies.map((body) => {
  const copy = { ...body };
  delete copy.collisionFilter;
  return copy;
}) });
const unfilteredPairs = unfiltered.step(dt).pairStats;
assert.equal(unfilteredPairs.eligiblePairs, 2016 * 8);
unfiltered.dispose();
const large = run(largeConfig);
const dynamic = large.final.bodies.filter((body) => body.kind === 'dynamic');
const sleeping = dynamic.filter((body) => body.sleeping).length;
const maxHeightErrorM = Math.max(...dynamic.map((body) => Math.abs(body.positionM[1] - 0.1)));
assert.equal(dynamic.length, 63);
assert.ok(sleeping >= 60);
assert.ok(maxHeightErrorM <= 0.01);
assert.ok(dynamic.every((body) => [...body.positionM, ...body.velocityMps].every(Number.isFinite)));
assert.ok(large.final.pairStats.eligiblePairs < 2016 * 8);
assert.ok(large.final.pairStats.candidatePairs < large.early.pairStats.candidatePairs);
const prior = structuredClone(large.world.getState());
checkRefusal(() => large.world.step(dt, [{ kind: 'impulse', bodyId: 'part:missing',
  impulseNs: [0, 0.1, 0] }]), 'INVALID_COMMAND');
assert.deepEqual(large.world.getState(), prior);
checkRefusal(() => large.world.step(dt, [{ kind: 'impulse', bodyId: 'part:00',
  impulseNs: [0, 100000, 0] }]), 'NUMERIC_LIMIT');
assert.deepEqual(large.world.getState(), prior);
const woke = large.world.step(dt, [{ kind: 'impulse', bodyId: 'part:00', impulseNs: [0, 0.1, 0] }]);
assert.equal(woke.bodies.find((body) => body.id === 'part:00').sleeping, false);
assert.ok(woke.bodies.filter((body) => body.kind === 'dynamic' && body.sleeping).length >= 59);
large.world.dispose();

const repeated = run(largeConfig);
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const finalDigest = digest(large.final);
assert.equal(digest(repeated.final), finalDigest);
assert.deepEqual(repeated.world.step(dt, [{ kind: 'impulse', bodyId: 'part:00',
  impulseNs: [0, 0.1, 0] }]), woke);
repeated.world.dispose();

const baseline = run(grid(31, false));
assert.equal(baseline.final.bodies.length, 32);
baseline.world.dispose();

const crossing = [ball('part:a', [0, 0, 0], { categoryBits: 1, maskBits: 1 }),
  ball('part:b', [0.15, 0, 0], { categoryBits: 2, maskBits: 2 })];
const crossingConfig = { fixedStepSeconds: dt, gravityMps2: [0, 0, 0],
  bodies: crossing, broadPhase: 'aabb', sceneMode: 'large-v1' };
const excluded = createPhysicsWorld(crossingConfig);
assert.equal(excluded.step(dt).contacts.length, 0);
assert.equal(excluded.getState().pairStats.eligiblePairs, 0);
excluded.dispose();
const allowed = createPhysicsWorld({ ...crossingConfig, bodies: crossing.map((body) =>
  ({ ...body, collisionFilter: { ...body.collisionFilter, maskBits: 3 } })) });
assert.equal(allowed.step(dt).contacts.length, 1);
allowed.dispose();
const sensor = createPhysicsWorld({ ...crossingConfig, bodies: [crossing[0],
  { id: 'fixture:sensor', kind: 'static', shape: crossing[1].shape,
    positionM: crossing[1].positionM, restitution: 0, sensor: true,
    collisionFilter: crossing[1].collisionFilter }] });
assert.equal(sensor.step(dt).events.length, 0);
sensor.dispose();

const stack = createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0],
  broadPhase: 'aabb', sceneMode: 'large-v1', bodies: [floor(),
    ball('part:lower', [0, 0.1, 0]), ball('part:upper', [0, 0.3, 0])] });
for (let step = 0; step < 120; step++) stack.step(dt);
assert.equal(stack.getState().bodies.filter((body) => body.sleeping).length, 2);
const stackWoke = stack.step(dt, [{ kind: 'impulse', bodyId: 'part:upper', impulseNs: [0, 0.1, 0] }]);
assert.equal(stackWoke.bodies.filter((body) => body.sleeping).length, 0);
stack.dispose();

const movingFixture = { ...floor(), id: 'fixture:moving', kind: 'kinematic' };
const moving = createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0],
  broadPhase: 'aabb', sceneMode: 'large-v1', bodies: [movingFixture,
    ball('part:on-platform', [0, 0.1, 0])] });
for (let step = 0; step < 120; step++) moving.step(dt);
assert.equal(moving.getState().bodies[1].sleeping, true);
const moved = moving.step(dt, [{ kind: 'kinematicTarget', bodyId: movingFixture.id,
  positionM: [0, -0.095, 0] }]);
assert.equal(moved.bodies[1].sleeping, false);
moving.dispose();

for (const invalid of [
  { ...largeConfig, bodies: [...largeConfig.bodies, ball('part:extra', [0, 0.1, 0])] },
  { ...largeConfig, broadPhase: undefined },
  { ...largeConfig, contactMode: 'persistent-box-v1' },
  { ...largeConfig, joints: [] },
  { ...largeConfig, bodies: largeConfig.bodies.map((body, index) => index === 1
    ? { ...body, collisionFilter: { categoryBits: 0, maskBits: 8 } } : body) },
]) checkRefusal(() => createPhysicsWorld(invalid), 'INVALID_CONFIG');

console.log(JSON.stringify({ result: 'ok', machine: `${process.platform}/${process.arch}/node-${process.version}`,
  bodies: large.final.bodies.length, steps: 180, sleeping, maxHeightErrorM,
  unfilteredPairs, earlyPairs: large.early.pairStats, finalPairs: large.final.pairStats,
  baselinePairs: baseline.final.pairStats, baseline: baseline.measurements,
  large: large.measurements, finalDigest, invalidRetained: true,
  directWake: true, islandWake: true, kinematicWake: true }));
