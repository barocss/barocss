import type { Point } from '../types.js';
export type FillFeaturePatternRegion = {
    readonly points: readonly (readonly [number, number])[];
    /** Nonempty straight holes; all boundary rings share the existing 16-vertex allowance. */
    readonly holes?: readonly (readonly (readonly [number, number])[])[];
};
type Refuse = (code: 'INPUT' | 'CAPABILITY' | 'PARAMETER', message: string) => never;
export interface FillCutPlacement {
    readonly offset: Point;
    readonly suffix: string;
}
/** Own numeric data and qualify all rings before any placements or tool copies. */
export declare function fillCutSnapshot(region: unknown, anchor: unknown, fail: Refuse): {
    region: FillFeaturePatternRegion;
    anchor: [number, number];
};
/** Counts/product are checked by the caller before any mask work. Original (0,0) stays unconditional. */
export declare function fillCutPlacements(region: FillFeaturePatternRegion, anchor: readonly [number, number], spacing: number, count: number, spacing2: number, count2: number): FillCutPlacement[];
export {};
