import type { Body } from './internal-types.js';
export declare function filterAllowsPair(a: Body, b: Body): boolean;
export declare function dormantPair(a: Body, b: Body): boolean;
export declare function wakeOnContact(a: Body, b: Body, sleepFrames: number[], aIndex: number, bIndex: number): void;
