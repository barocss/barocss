export const CLOTH_STEP_SECONDS = 1 / 120;
export const CLOTH_MAX_STEPS = 240;
export const CLOTH_SUBSTEPS = 8;
export const CLOTH_ITERATIONS = 2;
export const CLOTH_PROFILE_NAME = 'pinned-sheet-sphere-v1';

// Preserve the measured #825 profile and arithmetic order. No tunable inputs.
export const CLOTH_PROFILE = Object.freeze({
  size: 17, sideM: 1, heightM: 0.55, densityKgM2: 0.2,
  dt: CLOTH_STEP_SECONDS / CLOTH_SUBSTEPS,
  gravityMps2: Object.freeze([0, -9.81, 0]), velocityDecayPerSecond: 1,
  sphereCentreM: Object.freeze([0, 0.1, 0]), sphereRadiusM: 0.3, collisionOffsetM: 0.002,
  stretchComplianceMPerN: 0.001, bendComplianceMPerN: 0.1,
});
