import type { Vec3 } from '../types.js';

export interface FluidSceneV1 {
  format: 'barocss-fluid-scene';
  version: 1;
  revision: string;
  basis: 'right-handed-xyz-metres';
  fixedStepSeconds: number;
  gravityMps2: Vec3;
  basinM: Vec3;
  initialPositionsM: Vec3[];
}

/** Fixed visual smoothing profile; no physical viscosity calibration. */
export interface FluidSceneV2 extends Omit<FluidSceneV1, 'version'> {
  version: 2;
  visualViscosity: { kind: 'xsph'; coefficient: 0.15 };
}

export interface FluidDiagnostics {
  meanAbsoluteDensityError: number;
  p95Compression: number;
  boundaryHits: number;
}

export interface FluidStateV1 {
  sceneRevision: string;
  stepIndex: number;
  timeSeconds: number;
  particleCount: number;
  basinM: Vec3;
  positionsM: Float64Array;
  velocitiesMps: Float64Array;
  diagnostics: FluidDiagnostics;
}

export interface FluidWorld {
  getState(): FluidStateV1;
  step(fixedStepSeconds: number): FluidStateV1;
  reset(): FluidStateV1;
  dispose(): void;
}

export interface AcceptedFluidScene {
  revision: string;
  initialPositionsM: Float64Array;
  visualViscosityCoefficient: number;
}
