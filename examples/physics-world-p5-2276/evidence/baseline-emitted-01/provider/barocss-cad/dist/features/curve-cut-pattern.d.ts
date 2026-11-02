import type { Point } from '../types.js';
import { type CurveCutPathPlan } from './quadratic-cut-plan.js';
/** The same raw NURBS fields accepted by the part model's sweep-curve feature. */
export type RawNurbsPath = {
    readonly degree: number;
    readonly knots: readonly number[];
    readonly controlPoints: readonly (readonly [number, number, number])[];
    readonly weights: readonly number[];
};
type Refuse = (code: 'INPUT' | 'CAPABILITY' | 'PARAMETER', message: string) => never;
/** Preserve the legacy offset leaf; only a single nonstraight three-pole quadratic uses certification. */
export declare function curveCutOffsets(path: unknown, spacing: number, count: number, lengthLimit: number, fail: Refuse): Point[];
/** Shared geometry query. Legacy offsets/admission retain their old Number contract; bounds are diagnostic. */
export declare function planCurveCutPath(raw: unknown, spacing: number, count: number, limit: number, fail: Refuse): CurveCutPathPlan;
export {};
