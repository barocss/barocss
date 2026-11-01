import type { CapsuleControllerConfigV1, UprightCapsuleController } from './character/types.js';
export type { CapsuleControllerConfigV1, CapsuleControllerStepV1, CapsuleControllerStateV1, CapsuleControllerSupportV1, CapsuleControllerAssistV1, UprightCapsuleController, } from './character/types.js';
/** Fixed upright capsule gameplay movement against an immutable bounded box scene. */
export declare function createUprightCapsuleController(config: CapsuleControllerConfigV1): UprightCapsuleController;
