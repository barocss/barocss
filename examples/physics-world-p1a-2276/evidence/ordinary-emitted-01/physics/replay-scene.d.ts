import type { PhysicsWorldConfig } from './types.js';
import type { PhysicsSceneV1 } from './replay-types.js';
export declare function admitPhysicsScene(value: unknown): PhysicsSceneV1;
export declare function createPhysicsScene(world: PhysicsWorldConfig, revisions: {
    revision: string;
    sourceRevision: string | null;
}): PhysicsSceneV1;
