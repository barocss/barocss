import type { PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import type { VelocityGeometryPoint } from './geometry-adapter.js';
export interface WarmCacheStats {
    testedPatches: number;
    compatiblePatches: number;
    incompatiblePatches: number;
    reusedPoints: number;
    coldPoints: number;
}
export declare function emptyWarmCacheStats(): WarmCacheStats;
/** Whole current/prior face-key equality only. Edge rows are always cold. */
export declare function compatiblePatch(cache: ReadonlyMap<string, PointImpulse>, pairKey: string, points: readonly VelocityGeometryPoint[], family: 'face' | 'edge'): boolean;
