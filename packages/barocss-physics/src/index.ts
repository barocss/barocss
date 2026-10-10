export { PhysicsError } from './types.js';
export type { Vec3, Quat, PhysicsErrorCode, SphereShape, BoxShape, CapsuleShape, PhysicsShape, PhysicsFriction, PhysicsCollisionFilter, PhysicsBodyConfig, PhysicsStepCommand, PhysicsJointConfig, PhysicsHingeMotorConfig, PhysicsWorldConfig, PhysicsBodyState, PhysicsContact, PhysicsEvent, PhysicsJointState, PhysicsCcdHit, PhysicsPairStats, PhysicsState, PhysicsOverlapSphereQuery, PhysicsRayQuery, PhysicsRayHit, PhysicsWorld } from './types.js';
export { createPhysicsWorld } from './world.js';

export { createUprightCapsuleQuery } from './capsule-query.js';
export type { CapsuleQueryBoxV1, CapsuleQuerySceneV1, CapsuleSweepInputV1, CapsuleSweepHitV1, UprightCapsuleQuery } from './capsule-query.js';

export { createUprightCapsuleController } from './character-controller.js';
export type { CapsuleControllerConfigV1, CapsuleControllerStepV1, CapsuleControllerStateV1, CapsuleControllerSupportV1, CapsuleControllerAssistV1, UprightCapsuleController } from './character-controller.js';
