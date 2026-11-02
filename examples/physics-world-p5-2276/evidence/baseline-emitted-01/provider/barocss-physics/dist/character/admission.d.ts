import type { Vec3 } from '../internal-types.js';
import type { CapsuleQuerySceneV1 } from '../capsule-query.js';
import type { CapsuleControllerStepV1 } from './types.js';
export declare function admitConfig(input: unknown): {
    scene: CapsuleQuerySceneV1;
    positionM: Vec3;
};
export declare function admitCommand(input: unknown): CapsuleControllerStepV1;
export declare function admitCoreCommand(dt: number, velocity: Vec3, revision: string, stateRevision: string, stepIndex: number): Vec3;
