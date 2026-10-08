import { createFluidWorld } from '../../../packages/barocss-physics/src/fluid.ts';

export const fixedStepSeconds = 1 / 120;

export function createWaterWorld({ high = false, tuned = false } = {}) {
  const initialPositionsM = [];
  for (let z = 0; z < 4; z++) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        initialPositionsM.push([0.2 + x * 0.05, (high ? 0.85 : 0.45) + y * 0.05,
          0.3 + z * 0.05]);
      }
    }
  }
  return createFluidWorld({
    format: 'barocss-fluid-scene', version: tuned ? 2 : 1,
    revision: tuned ? `${high ? 'splash' : 'release'}ViscRev1`
      : (high ? 'splashRev1' : 'waterRev1'),
    basis: 'right-handed-xyz-metres', fixedStepSeconds,
    gravityMps2: [0, -9.81, 0], basinM: [0.7, 1.3, 0.5], initialPositionsM,
    ...(tuned ? { visualViscosity: { kind: 'xsph', coefficient: 0.15 } } : {}),
  });
}
