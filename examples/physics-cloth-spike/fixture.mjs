export const CLOTH_FIXTURE = Object.freeze({
  version: 0, size: 17, sideM: 1, heightM: 0.55, densityKgM2: 0.2,
  dt: 1 / 120, gravityMps2: [0, -9.81, 0], velocityDecayPerSecond: 1,
  sphereCentreM: [0, 0.1, 0], sphereRadiusM: 0.3, collisionOffsetM: 0.002,
  stretchComplianceMPerN: 0.001, bendComplianceMPerN: 0.1,
  stretchStiffness: 0.8, bendStiffness: 0.1,
});

export const FEASIBILITY = Object.freeze({
  maxExtension: 0.1, maxPenetrationM: 1e-6, maxPinDriftM: 0,
  maxP95StepMs: 1000 / 120, steps: 240,
});
