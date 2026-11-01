import { copyPhysicsModelPreset } from '../../physics-model-data-2276/model-data.mjs';

export const fixedStepSeconds = 1 / 120;

/** Authored public model data only. No Physics factory or old scene conversion. */
export function waterModelData({ high = false, tuned = false } = {}) {
  const input = copyPhysicsModelPreset(tuned ? 'fluid-basin-xsph-visual-v1' : 'fluid-basin-visual-v1');
  input.model.revision = tuned ? `${high ? 'splash' : 'release'}ViscRev1` : high ? 'splashRev1' : 'waterRev1';
  if (high) {
    const positions = [];
    for (let z=0;z<4;z++) for (let y=0;y<8;y++) for (let x=0;x<8;x++)
      positions.push([0.2+x*0.05,0.85+y*0.05,0.3+z*0.05]);
    input.model.fluids[0].initialPositionsM = positions;
  }
  return input;
}
