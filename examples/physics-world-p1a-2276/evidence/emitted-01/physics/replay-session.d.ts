import type { PhysicsReplaySession, PhysicsSceneV1, PhysicsSnapshotV1 } from './replay-types.js';
export declare function createPhysicsReplaySession(scene: PhysicsSceneV1): PhysicsReplaySession;
export declare function restorePhysicsReplaySession(snapshotInput: PhysicsSnapshotV1, expectedSceneInput: PhysicsSceneV1): PhysicsReplaySession;
