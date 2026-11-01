import type { Body, PhysicsJointState } from '../internal-types.js';
import type { AdmittedCommands } from '../validation.js';
import type { ParsedPair } from './types.js';
type Pairs = readonly [ParsedPair, ParsedPair];
/** Generic parsing precedes this function. No physical stage runs on refusal. */
export declare function admitDisjointHingeCommands(pairs: Pairs, bodies: Body[], actions: Map<string, AdmittedCommands>, commandCount: number): void;
/** One motor per component, Z0 then Z1, using previous accepted report memory. */
export declare function driveDisjointHingeMotors(pairs: Pairs, bodies: Body[], reports: readonly PhysicsJointState[], impulses: number[]): void;
/** Compose the qualified package phase; never repeat angular, motor, FREE or contact. */
export declare function applyDisjointHingePostContact(pairs: Pairs, bodies: Body[], reports: PhysicsJointState[], motorImpulses: readonly number[], sourceStepIndex: number, sourceTimeSeconds: number): void;
export {};
