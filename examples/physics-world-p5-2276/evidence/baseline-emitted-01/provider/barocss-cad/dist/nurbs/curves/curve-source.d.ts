import type { Curve, Model, Point } from '../../types.js';
export declare function requireCurveValue(condition: boolean, detail: string, label?: string): asserts condition;
export declare function snapshotCurveRequest(input: unknown, label?: string): unknown;
/** Expand the shortest round-trippable binary64 spelling into current decimals. */
export declare function curveDecimal(value: number, label?: string): string;
/** Internal trusted family coefficients adopted only from actual source0. */
export declare function compileCurveSource(id: string, degree: number, controlPoints: Point[], knots: number[], weights: number[], label?: string): {
    source: string;
    model: Model;
    curve: Curve;
};
