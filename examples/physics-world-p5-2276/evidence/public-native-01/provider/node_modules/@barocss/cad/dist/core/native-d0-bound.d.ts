import { type KernelError } from './barocss-error.js';
import { SectionRationalContext, type SectionFraction } from '../section-rational-internal.js';
import type { Curve, Surface } from '../types.js';
export type NativeD0Code = 'INPUT' | 'SUPPORT' | 'BUDGET';
export type NativeD0Error = KernelError & {
    readonly code: NativeD0Code;
};
export interface NativeD0Options {
    /** A tighter request limit only. */
    readonly maxOperations?: number;
    /** A positive L1 admission budget no larger than the existing native linear floor. */
    readonly errorBudgetL1?: number;
}
export interface NativeD0Bound {
    readonly exact: SectionFraction;
    readonly upper: number;
}
interface NativeD0Common {
    readonly authority: 'existing-native-basis-ordered-sum-projection';
    readonly axes: readonly [NativeD0Bound, NativeD0Bound, NativeD0Bound];
    readonly l1: NativeD0Bound;
    readonly constantAxes: readonly [boolean, boolean, boolean];
    readonly errorBudgetL1: number;
    readonly fractionBits: 128;
    readonly counts: ReturnType<SectionRationalContext['counts']> & {
        readonly directOperations: number;
        readonly totalOperations: number;
        readonly work: number;
        readonly maximumDirectBits: number;
    };
    readonly limits: {
        readonly operations: number;
        readonly integerBits: 8192;
        readonly work: 1048576;
    };
    readonly meaning: {
        readonly nativeD0Certified: true;
        readonly parameterAuthority: 'finite-binary64-inside-exact-stored-domain';
        readonly exactTarget: 'rational-evaluation-of-unchanged-stored-coefficients';
        readonly rounding: 'binary64-nearest-with-absolute-subnormal-allowance';
        readonly boundArithmetic: 'single-ledger-positive-outward-fixed128';
        readonly evaluatorReplacement: false;
        readonly derivatives: false;
        readonly pcurveBinding: false;
        readonly topology: false;
        readonly mass: false;
    };
}
export interface NativeCurveD0Certificate extends NativeD0Common {
    readonly source: Curve;
    readonly template: 'single-clamped-bezier-curve-degree1-to3';
    readonly domain: readonly [number, number];
}
export interface NativeSurfaceD0Certificate extends NativeD0Common {
    readonly source: Surface;
    readonly template: 'single-clamped-bezier-surface-degreeU1-to3-degreeV1';
    readonly domain: {
        readonly u: readonly [number, number];
        readonly v: readonly [number, number];
    };
}
export interface NativeD0FamilyInput {
    readonly curves: readonly Curve[];
    readonly surfaces: readonly Surface[];
}
export interface NativeD0FamilyCurve {
    readonly index: number;
    readonly source: Curve;
    readonly template: NativeCurveD0Certificate['template'] | 'quadratic-two-half-spans-five-poles';
    readonly domain: readonly [number, number];
    readonly spans: readonly (readonly [number, number])[];
}
export interface NativeD0FamilySurface {
    readonly index: number;
    readonly source: Surface;
    readonly template: NativeSurfaceD0Certificate['template'] | 'quadratic-two-half-spans-five-by-two-poles';
    readonly domain: NativeSurfaceD0Certificate['domain'];
    readonly spansU: readonly (readonly [number, number])[];
}
export interface NativeD0FamilyCertificate extends NativeD0Common {
    readonly curves: readonly NativeD0FamilyCurve[];
    readonly surfaces: readonly NativeD0FamilySurface[];
    readonly globalTemplate: 'degree3-by1-count8-no-constant-axis-shortcut';
    readonly envelope: {
        readonly minimumWeight: number;
        readonly maximumWeight: number;
        readonly coordinateAbs: readonly [number, number, number];
    };
    readonly family: {
        readonly objects: number;
        readonly storedPoles: number;
        readonly maximumObjects: 64;
        readonly maximumStoredPoles: 512;
        readonly structuralWork: number;
    };
}
export declare function isNativeD0Error(error: unknown): error is NativeD0Error;
/** Bounds the unchanged evaluateCurve/curveEvaluator D0 for every admitted binary64 parameter. */
export declare function certifyNativeCurveD0(input: Curve, given?: NativeD0Options): NativeCurveD0Certificate;
/** Bounds the unchanged evaluateSurface/surfaceEvaluator D0 on the admitted closed domain. */
export declare function certifyNativeSurfaceD0(input: Surface, given?: NativeD0Options): NativeSurfaceD0Certificate;
/**
 * One common bound for actual, immutable family snapshots. All recurrences are nonnegative
 * and monotone in degree, term count, maximum weight/coordinate and inverse minimum weight.
 * Degree3x1 with eight terms therefore bounds curves with <=4 active poles and every admitted
 * surface with <=4x2 active poles. Constant-axis restoration can only reduce their D0 errors.
 *
 * For the explicit degree2 two-span template, basisInto selects three active poles on either
 * half-span. At the repeated middle knot its binary span search selects the right span; at the
 * final endpoint it selects that same final span. Every fraction denominator is still 0.5,
 * scale is1, and the same global fraction/basis recurrence covers both endpoint branches.
 */
export declare function certifyNativeD0Family(input: NativeD0FamilyInput, given?: NativeD0Options): NativeD0FamilyCertificate;
export {};
