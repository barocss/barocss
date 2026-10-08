import type { PhysicsState, PhysicsStepCommand, PhysicsWorldConfig } from './types.js';

export interface PhysicsSceneV1 {
  format: 'barocss-physics-scene';
  version: 1;
  revision: string;
  sourceRevision: string | null;
  world: PhysicsWorldConfig;
}

export interface PhysicsSnapshotV1 {
  format: 'barocss-physics-snapshot';
  version: 1;
  scene: PhysicsSceneV1;
  frames: Array<{ commands: PhysicsStepCommand[] }>;
  finalState: PhysicsState;
}

export interface PhysicsReplaySession {
  getScene(): PhysicsSceneV1;
  getState(): PhysicsState;
  step(commands?: PhysicsStepCommand[]): PhysicsState;
  saveSnapshot(): PhysicsSnapshotV1;
  dispose(): void;
}
