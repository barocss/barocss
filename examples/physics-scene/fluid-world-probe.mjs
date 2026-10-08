import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createFluidWorld, PhysicsError } from '../../packages/barocss-physics/dist/fluid.js';

function waterScene() {
  const initialPositionsM = [];
  for (let z = 0; z < 4; z++) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        initialPositionsM.push([0.2 + x * 0.05, 0.45 + y * 0.05, 0.3 + z * 0.05]);
      }
    }
  }
  return { format: 'barocss-fluid-scene', version: 1, revision: 'waterRev1',
    basis: 'right-handed-xyz-metres', fixedStepSeconds: 1 / 120,
    gravityMps2: [0, -9.81, 0], basinM: [0.7, 1.3, 0.5], initialPositionsM };
}

function hash(positions) {
  return createHash('sha256').update(Buffer.from(positions.buffer,
    positions.byteOffset, positions.byteLength)).digest('hex');
}

function refused(action, code) {
  assert.throws(action, (error) => error instanceof PhysicsError && error.code === code);
}

const scene = waterScene();
const world = createFluidWorld(scene);
const initial = world.getState();
assert.equal(initial.particleCount, 256);
assert.equal(initial.stepIndex, 0);
scene.initialPositionsM[0][0] = 0.6;
initial.positionsM[0] = -1;
initial.velocitiesMps[0] = 900;
initial.basinM[0] = 9;
initial.diagnostics.meanAbsoluteDensityError = 900;
assert.equal(world.getState().positionsM[0], 0.2);
assert.equal(world.getState().basinM[0], 0.7);
const beforeInvalid = world.getState();
refused(() => world.step(1 / 60), 'INVALID_STEP');
assert.deepEqual(world.getState(), beforeInvalid);

const fixture = waterScene();
for (const damaged of [
  { ...fixture, basis: 'left-handed-xyz-metres' },
  { ...fixture, initialPositionsM: fixture.initialPositionsM.slice(1) },
  { ...fixture, initialPositionsM: fixture.initialPositionsM.map((point, i) =>
    i === 1 ? fixture.initialPositionsM[0] : point) },
  { ...fixture, initialPositionsM: fixture.initialPositionsM.map((point, i) =>
    i === 0 ? [Number.NaN, point[1], point[2]] : point) },
  { ...fixture, basinM: [0.8, 1.3, 0.5] },
  { ...fixture, extra: true },
]) refused(() => createFluidWorld(damaged), 'INVALID_CONFIG');
const shiftedScene = waterScene();
shiftedScene.initialPositionsM[0][0] += 0.005;
const shifted = createFluidWorld(shiftedScene);
assert.equal(shifted.getState().positionsM[0], 0.2 + 0.005);
shifted.dispose();
for (const invalidStep of [Number.NaN, 0, 1 / 60, '1/120']) {
  refused(() => world.step(invalidStep), 'INVALID_STEP');
  assert.deepEqual(world.getState(), beforeInvalid);
}

if (global.gc) global.gc();
const baselineHeapBytes = global.gc ? process.memoryUsage().heapUsed : null;
const times = [];
let at60, at240;
for (let step = 1; step <= 240; step++) {
  const start = performance.now();
  const state = world.step(1 / 120);
  times.push(performance.now() - start);
  if (step === 60) at60 = state;
  if (step === 240) at240 = state;
}
assert.equal(at60.stepIndex, 60);
assert.equal(at240.stepIndex, 240);
assert.ok(at60.diagnostics.meanAbsoluteDensityError <= 0.35);
assert.ok(at240.diagnostics.meanAbsoluteDensityError <= 0.10);
assert.ok(at60.diagnostics.p95Compression <= 0.05);
assert.ok(at240.diagnostics.p95Compression <= 0.05);
assert.ok([...at240.positionsM, ...at240.velocitiesMps].every(Number.isFinite));
for (let index = 0; index < 256; index++) {
  for (let axis = 0; axis < 3; axis++) {
    const value = at240.positionsM[index * 3 + axis];
    assert.ok(value >= 0.0125 - 1e-9 && value <= at240.basinM[axis] - 0.0125 + 1e-9);
  }
}
const repeat = createFluidWorld(waterScene());
for (let step = 0; step < 240; step++) repeat.step(1 / 120);
assert.equal(hash(repeat.getState().positionsM), hash(at240.positionsM));
repeat.dispose();

const reset = world.reset();
assert.equal(reset.stepIndex, 0);
const fresh = createFluidWorld(waterScene());
assert.deepEqual(reset.positionsM, fresh.getState().positionsM);
fresh.dispose();
world.dispose();
refused(() => world.getState(), 'DISPOSED');
refused(() => world.step(1 / 120), 'DISPOSED');
refused(() => world.reset(), 'DISPOSED');
if (global.gc) global.gc();
const retainedHeapDeltaBytes = global.gc
  ? process.memoryUsage().heapUsed - baselineHeapBytes : null;
const sorted = times.sort((a, b) => a - b);
console.log(JSON.stringify({ result: 'ok', count: 256, steps: 240,
  densityError60: at60.diagnostics.meanAbsoluteDensityError,
  densityError240: at240.diagnostics.meanAbsoluteDensityError,
  compression60: at60.diagnostics.p95Compression,
  compression240: at240.diagnostics.p95Compression,
  medianStepMs: sorted[Math.ceil(sorted.length * 0.5) - 1],
  p95StepMs: sorted[Math.ceil(sorted.length * 0.95) - 1],
  retainedHeapDeltaBytes,
  finalPositionSha256: hash(at240.positionsM), copiedAndInvalidRetained: true }));
