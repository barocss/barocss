import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createFluidWorld, PhysicsError } from '../../packages/barocss-physics/dist/fluid.js';

const dt = 1 / 120;
const sha = state => createHash('sha256').update(Buffer.from(state.positionsM.buffer,
  state.positionsM.byteOffset, state.positionsM.byteLength)).digest('hex');
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const speed95 = state => {
  const speeds = [];
  for (let index = 0; index < 256; index++) {
    speeds.push(Math.hypot(...state.velocitiesMps.slice(index * 3, index * 3 + 3)));
  }
  return p95(speeds);
};

function scene(high, version) {
  const initialPositionsM = [];
  for (let z = 0; z < 4; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    initialPositionsM.push([0.2 + x * 0.05, (high ? 0.85 : 0.45) + y * 0.05,
      0.3 + z * 0.05]);
  }
  return { format: 'barocss-fluid-scene', version,
    revision: version === 2 ? `${high ? 'splash' : 'release'}ViscRev1`
      : (high ? 'splashRev1' : 'waterRev1'),
    basis: 'right-handed-xyz-metres', fixedStepSeconds: dt,
    gravityMps2: [0, -9.81, 0], basinM: [0.7, 1.3, 0.5], initialPositionsM,
    ...(version === 2 ? { visualViscosity: { kind: 'xsph', coefficient: 0.15 } } : {}) };
}

function invalidProfiles(valid) {
  for (const change of [
    input => { delete input.visualViscosity; },
    input => { input.visualViscosity.kind = 'unknown'; },
    input => { input.visualViscosity.coefficient = 0.2; },
    input => { input.initialPositionsM[0][1] = 1.3; },
  ]) {
    const candidate = structuredClone(valid);
    change(candidate);
    assert.throws(() => createFluidWorld(candidate), error =>
      error instanceof PhysicsError && error.code === 'INVALID_CONFIG');
  }
}

function compare(high) {
  const original = createFluidWorld(scene(high, 1));
  const tunedScene = scene(high, 2);
  const tuned = createFluidWorld(tunedScene);
  invalidProfiles(tunedScene);
  const originalTimes = [], tunedTimes = [];
  const states = {};
  for (let step = 1; step <= 720; step++) {
    const advance = (world, times) => {
      const start = performance.now();
      const state = world.step(dt);
      times.push(performance.now() - start);
      return state;
    };
    let v1, v2;
    if (step % 2) {
      v1 = advance(original, originalTimes);
      v2 = advance(tuned, tunedTimes);
    } else {
      v2 = advance(tuned, tunedTimes);
      v1 = advance(original, originalTimes);
    }
    if ([60, 240, 720].includes(step)) {
      states[step] = { originalSHA: sha(v1), tunedSHA: sha(v2),
        originalSpeed95: speed95(v1), tunedSpeed95: speed95(v2),
        originalDensityError: v1.diagnostics.meanAbsoluteDensityError,
        tunedDensityError: v2.diagnostics.meanAbsoluteDensityError };
    }
  }
  assert.ok(states[720].tunedSpeed95 <= (high ? 0.029 : 0.020));
  assert.ok(states[240].tunedDensityError <= (high ? 0.033 : 0.026));
  if (high) assert.ok(states[60].tunedSpeed95 >= 3.25);
  const originalP95 = p95(originalTimes), tunedP95 = p95(tunedTimes);
  assert.ok(tunedP95 <= originalP95 * 1.5,
    `Visual profile cost ${tunedP95} ms exceeds 1.5× ${originalP95} ms`);
  const accepted = tuned.getState();
  assert.throws(() => tuned.step(1 / 60), error =>
    error instanceof PhysicsError && error.code === 'INVALID_STEP');
  assert.equal(sha(tuned.getState()), sha(accepted));
  const repeated = createFluidWorld(tunedScene);
  for (let step = 0; step < 720; step++) repeated.step(dt);
  assert.equal(sha(repeated.getState()), sha(accepted));
  repeated.dispose(); original.dispose(); tuned.dispose();
  return { high, states, originalP95, tunedP95, costRatio: tunedP95 / originalP95 };
}

console.log(JSON.stringify({ result: 'ok', fixtures: [compare(false), compare(true)] }));
