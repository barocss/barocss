import type { Vec3 } from '../types.js';
import type { CharacterState, CapsuleControllerStateV1, ErrorRecord } from './types.js';
export declare function initialState(positionM: Vec3, sceneRevision: string): CharacterState;
export declare function projectState(state: CharacterState): CapsuleControllerStateV1;
export declare function validateState(position: Vec3, velocity: Vec3, request: Vec3, previous: CharacterState): void;
export declare function errorRecord(error: unknown): ErrorRecord;
