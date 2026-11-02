import { basename } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { waterModelData } from './fluid-viewer/scene.js';


function hash(positions) {
  return createHash('sha256').update(Buffer.from(positions.buffer,
    positions.byteOffset, positions.byteLength)).digest('hex');
}

export function qualifyFluidWorld(provider) {

function refused(action, code) {
  assert.throws(action, (error) => error instanceof provider.PhysicsError && error.code === code);
}

const input = waterModelData();
let world = provider.createPhysicsWorld(input.model,input.options);
const initial = world.getState();
assert.equal(initial.fluids[0].positionsM.length / 3, 256);
assert.equal(initial.stepIndex, 0);
input.model.fluids[0].initialPositionsM[0][0] = 0.6;
initial.fluids[0].positionsM[0] = -1;
initial.fluids[0].velocitiesMps[0] = 900;
const returnedModel = world.getModel(); returnedModel.colliders[0].geometry.halfExtentsM[0] = 9;
initial.fluids[0].diagnostics.meanAbsoluteDensityError = 900;
assert.equal(world.getState().fluids[0].positionsM[0], 0.2);
assert.equal(world.getModel().colliders[0].geometry.halfExtentsM[0], 0.35);
const beforeInvalid = world.getState();
refused(() => world.step(1 / 60), 'INVALID_COMMAND');
assert.deepEqual(world.getState(), beforeInvalid);

const fixture = waterModelData();
for (const mutate of [
  x => { x.model.frame.basis = 'left-handed-xyz'; },
  x => { x.model.fluids[0].initialPositionsM.pop(); },
  x => { x.model.fluids[0].initialPositionsM[1] = [...x.model.fluids[0].initialPositionsM[0]]; },
  x => { x.model.fluids[0].initialPositionsM[0] = [NaN,.45,.3]; },
  x => { x.model.colliders[0].geometry.halfExtentsM[0] = .4; },
  x => { x.model.extra = true; },
]) { const damaged=structuredClone(fixture); mutate(damaged); refused(()=>provider.createPhysicsWorld(damaged.model,damaged.options),'INVALID_CONFIG'); }
const shiftedInput = waterModelData();
shiftedInput.model.fluids[0].initialPositionsM[0][0] += .005;
const shifted = provider.createPhysicsWorld(shiftedInput.model,shiftedInput.options);
assert.equal(shifted.getState().fluids[0].positionsM[0],.2+.005);shifted.dispose();
for (const invalidStep of [Number.NaN, 0, 1 / 60, '1/120']) {
  refused(() => world.step(invalidStep), 'INVALID_COMMAND');
  assert.deepEqual(world.getState(), beforeInvalid);
}

if (global.gc) global.gc();
const baselineHeapBytes = global.gc ? process.memoryUsage().heapUsed : null;
const times = [];
let at60, at240;
for (let step = 1; step <= 240; step++) {
  const start = performance.now();
  const state = world.step([]);
  times.push(performance.now() - start);
  if (step === 60) at60 = state;
  if (step === 240) at240 = state;
}
assert.equal(at60.stepIndex, 60);
assert.equal(at240.stepIndex, 240);
assert.ok(at60.fluids[0].diagnostics.meanAbsoluteDensityError <= 0.35);
assert.ok(at240.fluids[0].diagnostics.meanAbsoluteDensityError <= 0.10);
assert.ok(at60.fluids[0].diagnostics.p95Compression <= 0.05);
assert.ok(at240.fluids[0].diagnostics.p95Compression <= 0.05);
assert.ok([...at240.fluids[0].positionsM, ...at240.fluids[0].velocitiesMps].every(Number.isFinite));
for (let index = 0; index < 256; index++) {
  for (let axis = 0; axis < 3; axis++) {
    const value = at240.fluids[0].positionsM[index * 3 + axis];
    assert.ok(value >= 0.0125 - 1e-9 && value <= [0.7,1.3,0.5][axis] - 0.0125 + 1e-9);
  }
}
const repeatInput = waterModelData();
const repeat = provider.createPhysicsWorld(repeatInput.model,repeatInput.options);
for (let step = 0; step < 240; step++) repeat.step([]);
assert.equal(hash(repeat.getState().fluids[0].positionsM), hash(at240.fluids[0].positionsM));
repeat.dispose();

world.dispose();
world = provider.createPhysicsWorld(fixture.model,fixture.options);
const reset = world.getState();
assert.equal(reset.stepIndex, 0);
const fresh = provider.createPhysicsWorld(fixture.model,fixture.options);
assert.deepEqual(reset.fluids[0].positionsM, fresh.getState().fluids[0].positionsM);
fresh.dispose();
world.dispose();
refused(() => world.getState(), 'DISPOSED');
refused(() => world.step([]), 'DISPOSED');
assert.equal('reset' in world, false);
if (global.gc) global.gc();
const retainedHeapDeltaBytes = global.gc
  ? process.memoryUsage().heapUsed - baselineHeapBytes : null;
const sorted = times.sort((a, b) => a - b);
return { result: 'ok', count: 256, steps: 240,
  densityError60: at60.fluids[0].diagnostics.meanAbsoluteDensityError,
  densityError240: at240.fluids[0].diagnostics.meanAbsoluteDensityError,
  compression60: at60.fluids[0].diagnostics.p95Compression,
  compression240: at240.fluids[0].diagnostics.p95Compression,
  medianStepMs: sorted[Math.ceil(sorted.length * 0.5) - 1],
  p95StepMs: sorted[Math.ceil(sorted.length * 0.95) - 1],
  retainedHeapDeltaBytes,
  finalPositionSha256: hash(at240.fluids[0].positionsM), copiedAndInvalidRetained: true };
}
if(typeof process!=='undefined'&&basename(process.argv[1]??'')==='fluid-world-probe.mjs'){
 const nativeEntry=new URL('../../packages/barocss-physics/dist/index.js',import.meta.url).href;
 console.log(JSON.stringify(qualifyFluidWorld(await import(nativeEntry))));
}
