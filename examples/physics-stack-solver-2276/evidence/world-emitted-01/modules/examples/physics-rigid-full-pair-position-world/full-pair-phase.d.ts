import { type Body } from '../../packages/barocss-physics/src/types.js';
import type { FullPairPositionAttempt, FullPairPositionOptions, FullPairPositionStats, PositionPair } from './world-types.js';
export { FULL_PAIR_ERRORS } from './full-pair-rows.js';
export declare function zeroFullPairPositionStats(): FullPairPositionStats;
/** One full PRE problem and solve. Only private working positions can commit here. */
export declare function runFullPairPositionPhase(workingBodies: Body[], sortedPairs: readonly PositionPair[], options?: FullPairPositionOptions): {
    stats: FullPairPositionStats;
    attempt: FullPairPositionAttempt;
};
