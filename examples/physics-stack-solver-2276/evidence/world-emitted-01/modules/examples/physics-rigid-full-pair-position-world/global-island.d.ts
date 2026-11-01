import type { Body, PhysicsContact, PhysicsPairStats } from '../../packages/barocss-physics/src/types.js';
import { type PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import { type WarmCacheStats } from '../physics-rigid-feature-contact-reference/warm-cache.js';
export declare const GLOBAL_CONTACT_SWEEPS = 64;
import type { FullPairPositionStats, FullPairPositionAttempt, FullPairPositionOptions } from './world-types.js';
import type { PointLedger } from './world-types.js';
export declare const GLOBAL_PHASE_MESSAGE = "private global contact island phase order is invalid";
export type ContactPair = readonly [number, number];
export interface GlobalIslandStats {
    assemblyTests: number;
    patches: number;
    facePatches: number;
    edgePatches: number;
    points: number;
    globalSweeps: number;
    pointUpdates: number;
    positionSweeps: number;
    positionTests: number;
    /** Non-null fresh positional detects, including zero-penetration hits. */
    positionHits: number;
}
/** Detached copies become the world's accepted data only after its validation. */
export interface GlobalIslandResult {
    contacts: PhysicsContact[];
    pointsMap: Map<string, PointImpulse>;
    pairStats: PhysicsPairStats;
    globalStats: GlobalIslandStats;
    warmCacheStats: WarmCacheStats;
}
/**
 * One ephemeral world-step transaction. The world supplies private working
 * bodies and retains its working array for commit. No Body references escape
 * this class. World admission excludes sensors, CCD, joints and non-box bodies.
 * Velocity geometry is copied once. Positional detects do not build manifolds.
 */
export declare class FrozenContactIsland {
    #private;
    static zeroStats(): GlobalIslandStats;
    constructor(nextBodies: Body[], sortedPairs: readonly ContactPair[], prior: ReadonlyMap<string, PointImpulse>, options?: FullPairPositionOptions);
    /** Initialize every point, warm every eligible patch, then solve globally. */
    solve(): void;
    /** Fresh geometry for position-only correction; no new velocity/cache rows. */
    projectPositions(): void;
    getFullPairPositionStats(): FullPairPositionStats;
    getFullPairPositionAttempt(): FullPairPositionAttempt | null;
    /** Net step J uses final accumulators, including the warm impulse applied once. */
    getPointLedger(): PointLedger[];
    getGlobalStats(): GlobalIslandStats;
    getWarmCacheStats(): WarmCacheStats;
    /** Assembly geometry and final accumulated impulses, not final force data. */
    result(): GlobalIslandResult;
}
