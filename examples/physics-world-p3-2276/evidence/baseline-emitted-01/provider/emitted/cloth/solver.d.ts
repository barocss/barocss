import type { ClothSheet } from './types.js';
/** The measured XPBD order: eight inner steps, two projections per inner step. */
export declare class ClothSolver {
    private readonly before;
    private readonly decay;
    step(sheet: ClothSheet, positions: Float64Array, velocities: Float64Array): void;
}
