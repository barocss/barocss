import type { AdmittedCommands } from './validation.js';
import type { Body, PhysicsContact } from './internal-types.js';
export declare function wakeForActions(bodies: Body[], previousContacts: PhysicsContact[], actions: Map<string, AdmittedCommands>, sleepFrames: number[]): void;
export declare function updateSleeping(bodies: Body[], contacts: PhysicsContact[], sleepFrames: number[]): void;
