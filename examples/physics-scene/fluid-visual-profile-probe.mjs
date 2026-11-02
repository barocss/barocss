import { basename } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { waterModelData } from './fluid-viewer/scene.js';

const dt = 1 / 120;
const sha = state => createHash('sha256').update(Buffer.from(state.fluids[0].positionsM.buffer,
  state.fluids[0].positionsM.byteOffset, state.fluids[0].positionsM.byteLength)).digest('hex');
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const speed95 = state => {
  const speeds = [];
  for (let index = 0; index < 256; index++) {
    speeds.push(Math.hypot(...state.fluids[0].velocitiesMps.slice(index * 3, index * 3 + 3)));
  }
  return p95(speeds);
};

function modelInput(high, version) { return waterModelData({ high, tuned: version === 2 }); }

function invalidProfiles(provider,valid) {
  for (const change of [
    input => { delete input.model.fluids[0].visualSmoothing; },
    input => { input.model.fluids[0].visualSmoothing.kind = 'unknown'; },
    input => { input.model.fluids[0].visualSmoothing.coefficient = 0.2; },
    input => { input.model.fluids[0].initialPositionsM[0][1] = 1.3; },
  ]) {
    const candidate = structuredClone(valid);
    change(candidate);
    assert.throws(() => provider.createPhysicsWorld(candidate.model,candidate.options), error =>
      error instanceof provider.PhysicsError && error.code === 'INVALID_CONFIG');
  }
}

function compare(provider,high,controls) {
  const originalInput = modelInput(high,1);
  const original = provider.createPhysicsWorld(originalInput.model,originalInput.options);
  const tunedScene = modelInput(high,2);
  const tuned = provider.createPhysicsWorld(tunedScene.model,tunedScene.options);
  if(controls) invalidProfiles(provider,tunedScene);
  const originalTimes = [], tunedTimes = [];
  const states = {};
  for (let step = 1; step <= 720; step++) {
    const advance = (world, times) => {
      const start = performance.now();
      const state = world.step([]);
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
        originalDensityError: v1.fluids[0].diagnostics.meanAbsoluteDensityError,
        tunedDensityError: v2.fluids[0].diagnostics.meanAbsoluteDensityError };
    }
  }
  assert.ok(states[720].tunedSpeed95 <= (high ? 0.029 : 0.020));
  assert.ok(states[240].tunedDensityError <= (high ? 0.033 : 0.026));
  if (high) assert.ok(states[60].tunedSpeed95 >= 3.25);
  const originalP95 = p95(originalTimes), tunedP95 = p95(tunedTimes);
  assert.ok(tunedP95 <= originalP95 * 1.5,
    `Visual profile cost ${tunedP95} ms exceeds 1.5× ${originalP95} ms`);
  const accepted = tuned.getState();
  if(controls) {
    assert.throws(() => tuned.step(1 / 60), error => error instanceof provider.PhysicsError && error.code === 'INVALID_COMMAND');
    assert.equal(sha(tuned.getState()), sha(accepted));
  }
  const repeated = provider.createPhysicsWorld(tunedScene.model,tunedScene.options);
  for (let step = 0; step < 720; step++) repeated.step([]);
  assert.equal(sha(repeated.getState()), sha(accepted));
  repeated.dispose(); original.dispose(); tuned.dispose();
  return { high, states, originalP95, tunedP95, costRatio: tunedP95 / originalP95 };
}

export function qualifyFluidVisualProfiles(provider,{controls=false}={}) { return {result:'ok',controlsIncluded:controls,fixtures:[compare(provider,false,controls),compare(provider,true,controls)]}; }
if(typeof process!=='undefined' && basename(process.argv[1]??'')==='fluid-visual-profile-probe.mjs') {
  const nativeEntry=new URL('../../packages/barocss-physics/dist/index.js',import.meta.url).href;
  console.log(JSON.stringify(qualifyFluidVisualProfiles(await import(nativeEntry),{controls:true})));
}
