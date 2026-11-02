import type { Body, Joint, PhysicsJointState } from './internal-types.js';
export declare function parseJoints(value: unknown, bodies: Body[]): Joint[];
export declare function projectJoint(joint: Joint, next: Body[], previous: Body[], dt: number): PhysicsJointState;
