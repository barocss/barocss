import type { Point } from '../types.js';
import { QuadraticCutWork, type CutDyadic as D, type CutRefuse, type CutWorkCounts } from './quadratic-cut-arithmetic.js';
export interface CurveCutPathPlan {
    readonly offsets: Point[];
    readonly length: {
        readonly lower: number;
        readonly upper: number;
        readonly estimate: number;
    };
}
export interface QuadraticCutPlan extends CurveCutPathPlan {
    readonly work: CutWorkCounts;
}
export declare function cutNormBounds(w: QuadraticCutWork, coordinates: readonly D[], quantum: number): [D, D];
export declare function cutLengthNumbers(w: QuadraticCutWork, lower: D, upper: D, estimate?: number): CurveCutPathPlan['length'];
export declare function planQuadraticCut(points: readonly (readonly number[])[], spacing: number, count: number, limit: number, fail: CutRefuse, work?: QuadraticCutWork): QuadraticCutPlan;
