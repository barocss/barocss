import type { Body, Joint, PhysicsJointState } from './internal-types.js';
/** Symmetric, bounded projection for the one admitted two-sphere fixed pair. */
export declare function projectDynamicFixedJoint(joint: Joint, bodies: Body[], dt: number): PhysicsJointState;
