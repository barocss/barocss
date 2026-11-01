import test from 'node:test';
// #region visual-model-import
import assert from 'node:assert/strict';
import { createPhysicsWorld } from '@barocss/physics';
import { createPhysicsRecorder } from '@barocss/physics/replay';
import { copyPhysicsModelPreset } from '../docs/public/physics/model-data.mjs';
// #endregion visual-model-import

// #region visual-model-step
function acceptVisualStep(profile) {
  const input=copyPhysicsModelPreset(profile),original=structuredClone(input.model);
  const world=createPhysicsWorld(input.model,input.options);
  try {
    const before=world.getState();
    assert.throws(()=>createPhysicsRecorder(world),error=>error.code===(profile.startsWith('cloth')?'WORLD_LIMIT':'INVALID_SNAPSHOT'));
    assert.deepEqual(world.getState(),before);
    const submitted=input.model.cloths[0]?.initialPositionsM ?? input.model.fluids[0].initialPositionsM;
    submitted[0][0]=999;
    assert.deepEqual(world.getModel(),original);
    const state=world.step([]),domain=state.cloths[0]??state.fluids[0];
    return {stepIndex:state.stepIndex,timeSeconds:state.timeSeconds,positionsM:domain.positionsM};
  } finally { world.dispose(); }
}
// #endregion visual-model-step

// Separate four-World/four-step example cohort; compilation is not runtime proof.
for (const profile of ['cloth-pinned-sphere-visual-v1','fluid-basin-visual-v1',
  'fluid-basin-xsph-visual-v1','fluid-static-box-visual-v1']) {
  test(`explicit model ${profile}: one accepted step and atomic recorder refusal`, () => {
    const accepted=acceptVisualStep(profile);
    assert.equal(accepted.stepIndex,1);assert.equal(accepted.timeSeconds,1/120);
    assert.equal(accepted.positionsM.length,profile.startsWith('cloth')?867:768);
    assert(accepted.positionsM instanceof Float64Array);assert(accepted.positionsM.every(Number.isFinite));
  });
}
