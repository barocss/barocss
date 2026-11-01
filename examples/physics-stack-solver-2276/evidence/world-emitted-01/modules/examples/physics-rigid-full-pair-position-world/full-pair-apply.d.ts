import type { Body } from '../../packages/barocss-physics/src/types.js';
import type { FullPairProblem, FullPairResult } from './full-pair-types.js';
import type { Rounding } from './world-types.js';
/** One copied fresh PRE+p operation; static bodies do not perform addition. */
export declare function applyFullPairTranslationsOnce(preBodies: readonly Body[], problem: FullPairProblem, result: FullPairResult): {
    bodies: Body[];
    rounding: Rounding[];
    applications: 1;
    worldCreated: false;
    worldStepped: false;
};
