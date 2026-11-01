import type { Body, Joint, PhysicsJointState, Vec3 } from './internal-types.js';
import type { AdmittedCommands } from './validation.js';
export declare function admitDynamicHingeScene(joint: Joint, bodies: Body[], gravity: Vec3): void;
export declare function admitDynamicHingeCommands(joint: Joint, bodies: Body[], actions: Map<string, AdmittedCommands>): void;
export declare function projectDynamicHingeJoint(joint: Joint, bodies: Body[], dt: number): PhysicsJointState;
