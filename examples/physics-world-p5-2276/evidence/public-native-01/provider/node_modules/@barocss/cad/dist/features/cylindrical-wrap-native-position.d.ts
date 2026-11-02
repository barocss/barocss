import { KernelError } from '../core/barocss-error.js';
import type { SectionRationalContext, SectionRational } from '../section-rational-internal.js';
import type { Curve, Point, Surface } from '../types.js';
type R = SectionRational;
export type NativePositionCode = 'INPUT' | 'SUPPORT' | 'BUDGET';
export type NativePositionError = KernelError & {
    readonly code: NativePositionCode;
};
export interface NativePositionContext {
    readonly q: SectionRationalContext;
    charge(amount?: number): void;
    check(): void;
}
export interface NativePositionDomain {
    readonly low: R;
    readonly high: R;
    readonly guardLow: R;
    readonly guardHigh: R;
}
export interface NativePositionFace {
    readonly surface: Surface;
    readonly u: NativePositionDomain;
    readonly v: NativePositionDomain;
    /** Exact mathematical L1 derivative bounds; no native D1 evaluator is certified. */
    readonly lipschitz: {
        readonly u: R;
        readonly v: R;
    };
}
export declare function isNativePositionError(error: unknown): error is NativePositionError;
/** Prepare exact coefficient bounds for a supported actual native face. No B-rep qualification is returned. */
export declare function prepareNativePositionFace(surface: Surface, ctx: NativePositionContext): NativePositionFace;
export declare function requireNativePcurveRange(input: Curve, face: NativePositionFace, eU: R, eV: R, ctx: NativePositionContext): void;
/** Includes both independent world-curve and surface D0 terms, then exact UV propagation. */
export declare function nativePositionInflation(face: NativePositionFace, eL1: R, eU: R, eV: R, ctx: NativePositionContext): R;
export declare function checkedNativePositionBound(model: R, inflation: R, limit: number, ctx: NativePositionContext): R;
export declare function nativeEndpointPositionBound(input: Point, vertexInput: Point, eL1: R, limit: number, ctx: NativePositionContext): R;
/** Exact affine-extension residual only. A separate range check is mandatory before binding. */
export declare function nativeAffineCapResidual(world: Curve, pcurve: Curve, surface: Surface, ctx: NativePositionContext): R;
export {};
