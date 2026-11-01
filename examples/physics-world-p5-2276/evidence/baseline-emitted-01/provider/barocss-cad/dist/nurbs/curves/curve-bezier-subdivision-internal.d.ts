import type { CurveKnotCoefficientResult } from './curve-knot-insertion.js';
import type { Curve, Model, Point } from '../../types.js';
type PoleMap = {
    refinedPoleIndex: number;
    childPoleIndex: number;
};
type KnotMap = {
    childKnotIndex: number;
    refinedKnotIndex: number | null;
    value: number;
    origin: 'refined-copy' | 'requested-clamp';
};
type ChildMap = {
    side: 'lower' | 'upper';
    curveId: string;
    poleMappings: PoleMap[];
    knots: KnotMap[];
};
export interface BezierSubdivisionResult {
    input: Curve;
    parameter: number;
    coefficientResult: CurveKnotCoefficientResult;
    lower: Curve;
    upper: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: {
        firstRefinedKnotIndex: number;
        lower: ChildMap;
        upper: ChildMap;
        shared: {
            refinedPoleIndex: number;
            lowerPoleIndex: number;
            upperPoleIndex: 0;
            pointMM: Point;
            weight: number;
        };
    };
    directCounts: {
        coefficientHelperInvocationCount: number;
        sourceCompileCount: number;
    };
}
/** Private admitted-Bezier wrapper; no D0/D1 calls or widening of the existing public providers. */
export declare function splitBezierCurveTrusted(curve: Curve, parameter: number, lowerCurveId: string, upperCurveId: string, modelName: string): BezierSubdivisionResult;
export {};
