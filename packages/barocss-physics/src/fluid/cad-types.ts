import type { FluidSceneV1, FluidStateV1 } from './types.js';

export type CadFluidSceneV1 = FluidSceneV1;

export interface CurrentCadSource {
  sourceText: string;
  currentRevision: string;
}

export interface CadFluidObstacleInfo {
  sourceVersion: 0;
  sourceSnapshot: string;
  sourceRevision: string;
  bodyId: string;
  centerM: [number, number, number];
  halfExtentsM: [number, number, number];
  lossLabel: string;
}

export interface CadFluidState extends FluidStateV1 {
  obstacleHits: number;
}

export interface CadFluidWorld {
  getState(): CadFluidState;
  getObstacle(): CadFluidObstacleInfo;
  step(fixedStepSeconds: number, current: CurrentCadSource): CadFluidState;
  reset(current: CurrentCadSource): CadFluidState;
  dispose(): void;
}
