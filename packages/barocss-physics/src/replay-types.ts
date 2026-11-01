import type { PhysicsState, PhysicsCommand, PhysicsModel, WorldOptions, Identity } from './types.js';

export interface PhysicsSceneV1 {
  format: 'barocss-physics-scene';
  version: 1;
  revision: string;
  sourceRevision: string | null;
  model: PhysicsModel;
  options: WorldOptions;
  identity: Identity;
}

export interface PhysicsSnapshotV1 {
  format: 'barocss-physics-snapshot';
  version: 1;
  scene: PhysicsSceneV1;
  frames: Array<{ commands: readonly PhysicsCommand[] }>;
  finalState: PhysicsState;
}

export interface PhysicsReplaySession {
  getScene(): PhysicsSceneV1;
  getState(): PhysicsState;
  step(commands?: readonly PhysicsCommand[]): PhysicsState;
  saveSnapshot(): PhysicsSnapshotV1;
  dispose(): void;
}
