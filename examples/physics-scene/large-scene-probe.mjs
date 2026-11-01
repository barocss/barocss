import { makeModel, dynamicPart, staticPart, kinematicPart } from '../physics-model-input/model.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 120;
const floor = filter => staticPart('fixture:floor',{kind:'box',halfExtentsM:[4,0.1,4]},{positionM:[0,-0.1,0]},{restitution:0,...(filter?{filter}:{})});
const ball = (id,positionM,filter) => dynamicPart(id,{kind:'sphere',radiusM:0.1},{positionM,velocityMps:[0,0,0]},1,{restitution:0,...(filter?{filter}:{})});
function grid(count, largeMode) {
  const bodies = [floor(largeMode ? { categoryBits: 8, maskBits: 7 } : undefined)];
  for (let index = 0; index < count; index++) {
    const x = index % 7, z = Math.floor(index / 7);
    const category = [1, 2, 4][Math.floor(index / 21)];
    bodies.push(ball(`part:${String(index).padStart(2, '0')}`,
      [0.35 * (x - 3), 0.1, 0.35 * (z - 4)],
      largeMode ? { categoryBits: category, maskBits: category | 8 } : undefined));
  }
  return {model:makeModel({gravityMps2:[0,-9.81,0],parts:bodies}),options:{profile:largeMode?'rigid-large-v1':'rigid-discrete-v1',fixedStepSeconds:dt,broadPhase:'aabb'}};
}
function checkRefusal(action, code) {
  assert.throws(action, (cause) => cause instanceof PhysicsError && cause.code === code);
}
function run(config) {
  const world = createPhysicsWorld(config.model,config.options);
  const elapsed = [];
  let early, final;
  if (global.gc) global.gc();
  const heapStart = global.gc ? process.memoryUsage().heapUsed : null;
  for (let step = 1; step <= 180; step++) {
    const start = performance.now();
    const state = world.step();
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
const unfiltered=createPhysicsWorld({...largeConfig.model,colliders:largeConfig.model.colliders.map(collider=>({...collider,filter:{categoryBits:1,maskBits:65535}}))},largeConfig.options);
const unfilteredPairs = unfiltered.step().pairStats;
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
checkRefusal(() => large.world.step([{ kind: 'impulse', bodyId: 'part:missing',
  impulseNs: [0, 0.1, 0] }]), 'INVALID_COMMAND');
assert.deepEqual(large.world.getState(), prior);
checkRefusal(() => large.world.step([{ kind: 'impulse', bodyId: 'part:00',
  impulseNs: [0, 100000, 0] }]), 'NUMERIC_LIMIT');
assert.deepEqual(large.world.getState(), prior);
const woke = large.world.step([{ kind: 'impulse', bodyId: 'part:00', impulseNs: [0, 0.1, 0] }]);
assert.equal(woke.bodies.find((body) => body.id === 'part:00').sleeping, false);
assert.ok(woke.bodies.filter((body) => body.kind === 'dynamic' && body.sleeping).length >= 59);
large.world.dispose();

const repeated = run(largeConfig);
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const finalDigest = digest(large.final);
assert.equal(digest(repeated.final), finalDigest);
assert.deepEqual(repeated.world.step([{ kind: 'impulse', bodyId: 'part:00',
  impulseNs: [0, 0.1, 0] }]), woke);
repeated.world.dispose();

const baseline = run(grid(31, false));
assert.equal(baseline.final.bodies.length, 32);
baseline.world.dispose();

const crossing = [ball('part:a', [0, 0, 0], { categoryBits: 1, maskBits: 1 }),
  ball('part:b', [0.15, 0, 0], { categoryBits: 2, maskBits: 2 })];
const crossingConfig=makeModel({gravityMps2:[0,0,0],parts:crossing});
const largeOptions={profile:'rigid-large-v1',fixedStepSeconds:dt,broadPhase:'aabb'};
const excluded=createPhysicsWorld(crossingConfig,largeOptions);
assert.equal(excluded.step().contacts.length,0);
assert.equal(excluded.getState().pairStats.eligiblePairs,0);
excluded.dispose();
const allowed=createPhysicsWorld({...crossingConfig,colliders:crossingConfig.colliders.map(collider=>({...collider,filter:{...collider.filter,maskBits:3}}))},largeOptions);
assert.equal(allowed.step().contacts.length,1);
allowed.dispose();
const sensor=createPhysicsWorld(makeModel({gravityMps2:[0,0,0],parts:[crossing[0],staticPart('fixture:sensor',crossing[1].collider.geometry,crossing[1].body.initial,{restitution:0,sensor:true,filter:crossing[1].collider.filter})]}),largeOptions);
assert.equal(sensor.step().events.length,0);
sensor.dispose();

const stack = createPhysicsWorld(makeModel({gravityMps2: [0, -9.81, 0], parts: [floor(),
    ball('part:lower', [0, 0.1, 0]), ball('part:upper', [0, 0.3, 0])]}), {profile: 'rigid-large-v1', fixedStepSeconds: dt, broadPhase: 'aabb'});
for (let step = 0; step < 120; step++) stack.step();
assert.equal(stack.getState().bodies.filter((body) => body.sleeping).length, 2);
const stackWoke = stack.step([{ kind: 'impulse', bodyId: 'part:upper', impulseNs: [0, 0.1, 0] }]);
assert.equal(stackWoke.bodies.filter((body) => body.sleeping).length, 0);
stack.dispose();

const movingFixture=kinematicPart('fixture:moving',floor().collider.geometry,floor().body.initial,{restitution:0});
const moving = createPhysicsWorld(makeModel({gravityMps2: [0, -9.81, 0], parts: [movingFixture,
    ball('part:on-platform', [0, 0.1, 0])]}), {profile: 'rigid-large-v1', fixedStepSeconds: dt, broadPhase: 'aabb'});
for (let step = 0; step < 120; step++) moving.step();
assert.equal(moving.getState().bodies[1].sleeping, true);
const moved = moving.step([{ kind: 'kinematicTarget', bodyId: movingFixture.body.id,
  positionM: [0, -0.095, 0] }]);
assert.equal(moved.bodies[1].sleeping, false);
moving.dispose();

const extra=ball('part:extra',[0,0.1,0]);
for(const [model,options] of [
 [{...largeConfig.model,bodies:[...largeConfig.model.bodies,extra.body],colliders:[...largeConfig.model.colliders,extra.collider]},largeOptions],
 [largeConfig.model,{...largeOptions,broadPhase:undefined}],
 [largeConfig.model,{...largeOptions,profile:'rigid-persistent-box-v1'}],
 // Empty joints are required in P0. A nonempty joint remains refused by large-v1.
 [{...largeConfig.model,joints:[{id:'joint:forbidden',kind:'fixed',bodyAId:'fixture:floor',bodyBId:'part:00',anchorALocalM:[0,0,0],anchorBLocalM:[0,0,0]}]},largeOptions],
 [{...largeConfig.model,colliders:largeConfig.model.colliders.map((collider,index)=>index===1?{...collider,filter:{categoryBits:0,maskBits:8}}:collider)},largeOptions],
])checkRefusal(()=>createPhysicsWorld(model,options),'INVALID_CONFIG');

console.log(JSON.stringify({ result: 'ok', machine: `${process.platform}/${process.arch}/node-${process.version}`,
  bodies: large.final.bodies.length, steps: 180, sleeping, maxHeightErrorM,
  unfilteredPairs, earlyPairs: large.early.pairStats, finalPairs: large.final.pairStats,
  baselinePairs: baseline.final.pairStats, baseline: baseline.measurements,
  large: large.measurements, finalDigest, invalidRetained: true,
  directWake: true, islandWake: true, kinematicWake: true }));
