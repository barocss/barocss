import type { PhysicsBodyConfig, PhysicsBodyState, Quat, Vec3 } from './types.js';

export interface CadSurfaceProxyRequest {
  sourceVersion: 0;
  sourceRevision: string;
  modelId: string;
  surfaceId: string;
  kind: 'dynamic' | 'static';
  proxy: 'sphere' | 'box';
  massKg?: number;
  initialOffsetM?: Vec3;
  minimumHalfExtentM?: number;
}

export interface CadSurfaceProxy {
  sourceSnapshot: string;
  sourceRevision: string;
  modelId: string;
  surfaceId: string;
  bodyId: string;
  sourceCenterMM: Vec3;
  sourceBoundsMM: { min: Vec3; max: Vec3 };
  lossLabel: string;
  body: PhysicsBodyConfig;
}

export interface CadProxyPose {
  targetId: string;
  translation: Vec3;
  rotation: Quat;
}

export type CadProxyBodyState = Pick<PhysicsBodyState, 'id' | 'positionM' | 'orientation'>;
