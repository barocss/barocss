import { type KernelError } from '../core/barocss-error.js';
import { SectionRationalContext, type SectionFraction } from '../section-rational-internal.js';
import type { Curve, Point, Surface } from '../types.js';
type UV = readonly [number, number];
export type CylindricalWrapCurveCode = 'INPUT' | 'BUDGET' | 'GEOMETRY' | 'BINDING';
export type CylindricalWrapCurveError = KernelError & {
    readonly code: CylindricalWrapCurveCode;
};
export interface CylindricalWrapCurveLine {
    readonly start: UV;
    readonly end: UV;
}
export interface CylindricalWrapCurveOptions {
    readonly curveId: string;
    readonly pcurveId: string;
    /** May tighten the existing native binding floor; it may not increase it. */
    readonly errorBudget?: number;
    /** Previously admitted endpoint-table values, in canonical edge parameter direction. */
    readonly endpoints?: readonly [Point | null, Point | null];
    /** A tighter request budget only. The underlying rational context retains its original limits. */
    readonly maxOperations?: number;
}
export interface CylindricalWrapCurveResult {
    readonly original: Surface;
    readonly curve: Curve;
    /** Original native UV, in the same t direction/domain as curve; coedge sense is separate. */
    readonly pcurve: Curve;
    readonly proof: {
        readonly authority: 'stored-homogeneous-bernstein-coefficients';
        readonly sourceId: string;
        readonly originalDegree: readonly [2, 1];
        readonly composedDegree: 3;
        readonly residualDegree: 6;
        readonly exactDenominatorLower: SectionFraction;
        readonly storedDenominatorLower: SectionFraction;
        readonly homogeneousNumeratorResidual: readonly SectionFraction[];
        readonly homogeneousDenominatorResidual: SectionFraction;
        readonly crossResiduals: readonly (readonly SectionFraction[])[];
        readonly axisError: readonly SectionFraction[];
        readonly worldError: {
            readonly exact: SectionFraction;
            readonly upper: number;
        };
        readonly errorBudget: number;
        readonly endpointOrigins: readonly ['nearest' | 'table', 'nearest' | 'table'];
        /** World Curve/pcurve t domain; the source U/V domains remain in original knots. */
        readonly parameterDomain: readonly [0, 1];
        readonly coordinateFrame: 'original-surface-world';
        readonly exactStoredModelBound: true;
        readonly globalEvaluatorErrorCertified: false;
        readonly topologyCertified: false;
        readonly counts: ReturnType<SectionRationalContext['counts']>;
        readonly maxOperations: number;
    };
}
export declare function isCylindricalWrapCurveError(error: unknown): error is CylindricalWrapCurveError;
/** Private coefficient composition in original native UV; caller separately proves carrier/face provenance. */
export declare function composeCylindricalWrapCurve(surface: Surface, line: CylindricalWrapCurveLine, options: CylindricalWrapCurveOptions): CylindricalWrapCurveResult;
export {};
