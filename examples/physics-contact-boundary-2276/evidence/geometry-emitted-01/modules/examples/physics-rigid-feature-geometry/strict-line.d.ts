/** Browser-only bounded exact geometry. No source basis, SAT, QP or Node imports. */
import type { Body, Vec3 } from '../../packages/barocss-physics/src/types.js';
export declare const STRICT_LINE_LIMITS: Readonly<{
    rationalOperations: 200000;
    integerOperations: 2000000;
    integerBits: 16384;
    roundingSteps: 16;
}>;
export declare class StrictLineFailure extends Error {
    constructor(message: string);
}
export interface FacePlane {
    axis: number;
    side: number;
}
export interface StrictLineStats {
    rationalOperations: number;
    integerOperations: number;
    peakIntegerBits: number;
}
/** One ULP, preserving an already equal value (including its original zero sign). */
export declare function nextAfterToward(value: number, target: number): number;
/** Exact normalized quaternion OBB context, shared only within one face call. */
export declare class StrictLineContext {
    private readonly m;
    private readonly boxes;
    private readonly normal;
    private readonly tolerance;
    constructor(a: Body, b: Body, normal: Vec3);
    stats(): StrictLineStats;
    private box;
    private local;
    private interval;
    /** Strict closed slabs. No epsilon, tolerance addition or direction threshold. */
    check(midpoint: Vec3): boolean;
    onFace(which: 0 | 1, plane: FacePlane, witness: Vec3): boolean;
    movementWithin(original: Vec3, moved: Vec3): boolean;
    projectedPair(seed: Vec3, faceA: FacePlane, faceB: FacePlane): [Vec3, Vec3];
}
