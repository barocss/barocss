import type { PhysicsModel, WorldOptions } from '../types.js';
import type { Body, Joint } from '../internal-types.js';
import type { ParsedPair } from './types.js';
/** Parsed model data only. All other existing profiles retain their original parser. */
export declare function parseDisjointHingeProfile(model: PhysicsModel, options: WorldOptions, inputs: readonly Record<string, unknown>[], bodies: Body[]): {
    joints: Joint[];
    pairs: [ParsedPair, ParsedPair];
} | null;
