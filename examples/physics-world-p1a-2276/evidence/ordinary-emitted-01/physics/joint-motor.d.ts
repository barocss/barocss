import type { Body, Joint } from './types.js';
export declare function driveHingeMotor(joint: Joint, body: Body, angleRad: number): number;
export declare function driveDynamicHingeMotor(joint: Joint, a: Body, b: Body, angleRad: number): number;
