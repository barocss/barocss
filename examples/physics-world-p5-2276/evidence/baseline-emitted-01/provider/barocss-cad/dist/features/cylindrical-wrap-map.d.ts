import { type KernelError } from '../core/barocss-error.js';
import { SectionRationalContext, type SectionFraction } from '../section-rational-internal.js';
import type { Curve } from '../types.js';
export type CylindricalWrapMapCode = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'REPRESENTABILITY';
export type CylindricalWrapMapError = KernelError & {
    readonly code: CylindricalWrapMapCode;
};
export interface CylindricalWrapMapOptions {
    readonly radius: number;
    /** Maximum nominal R*theta error. Source radial/actual-arclength errors are reported separately. */
    readonly tolerance: number;
}
export interface WrapMapBound {
    readonly exact: SectionFraction;
    readonly upper: number;
}
export interface WrapMapNode {
    /** Exact dyadic share of the original full span, not a newly restricted derivative parameter. */
    readonly share: number;
    readonly u: number;
    readonly s: number;
    readonly angle: {
        readonly lower: SectionFraction;
        readonly upper: SectionFraction;
    };
    readonly error: SectionFraction;
}
export interface WrapMapInterval {
    readonly first: number;
    readonly last: number;
    readonly interpolation: SectionFraction;
    readonly error: SectionFraction;
}
export interface CylindricalWrapMap {
    readonly source: Curve;
    readonly options: CylindricalWrapMapOptions;
    readonly domain: readonly [number, number];
    readonly chartDomain: readonly [number, number];
    readonly nodes: readonly WrapMapNode[];
    readonly intervals: readonly WrapMapInterval[];
    readonly bounds: {
        readonly nominal: WrapMapBound;
        readonly radial: WrapMapBound;
        readonly arclengthDrift: WrapMapBound;
        readonly basePosition: WrapMapBound;
        readonly actualLengthResidual: WrapMapBound;
        readonly secondDerivative: WrapMapBound;
    };
    readonly proof: {
        readonly denominator: readonly SectionFraction[];
        readonly squaredRadiusNumerator: readonly SectionFraction[];
        readonly angularNumerator: readonly SectionFraction[];
        readonly circleResidual: readonly SectionFraction[];
        readonly secondNumerator: readonly SectionFraction[];
        readonly denominatorMinimum: SectionFraction;
        readonly squaredRadiusMinimum: SectionFraction;
        readonly angularMinimum: SectionFraction;
        readonly radialDerivative: SectionFraction;
        readonly piHalf: {
            readonly lower: SectionFraction;
            readonly upper: SectionFraction;
        };
    };
    readonly counts: {
        readonly rational: ReturnType<SectionRationalContext['counts']>;
        readonly integerOperations: number;
        readonly integerMaximumBits: number;
        readonly work: number;
    };
    readonly limits: {
        readonly intervals: 256;
        readonly depth: 8;
        readonly taylorTerms: 24;
        readonly intervalBits: 128;
        readonly work: 1048576;
        readonly rationalOperations: 200000;
        readonly rationalGcdSteps: 200000;
        readonly rationalIntegerBits: 8192;
        readonly fractionCharacters: 5000;
        readonly floatSearchStepsPerConversion: 64;
    };
    readonly meaning: {
        readonly chart: 'nominal-radius-times-original-carrier-angle';
        readonly parameter: 'piecewise-affine-inverse-of-stored-nodes';
        readonly derivatives: 'normalized-original-full-span';
        readonly source: 'copied-original-binary64-poles-weights-and-knots';
        readonly guarantee: 'analytic-whole-interval-bound-not-sample-fit';
        readonly family: 'quantified-near-quarter-caller-retains-native-provenance';
        readonly evaluation: 'exact-affine-certificate-no-number-interpolation-bound';
        readonly outerThickness: 'future-homothety-has-error-at-most-height-times-radial-bound-over-radius';
        readonly composition: false;
        readonly surfaceBinding: false;
        readonly trim: false;
        readonly solid: false;
        readonly globalNativeEvaluationError: false;
    };
}
export interface CylindricalWrapCarrierOptions {
    readonly radius: number;
}
/** Original-coefficient certificate only. No nominal chart, arclength nodes or inverse is constructed. */
export interface CylindricalWrapCarrierCertificate {
    readonly source: Curve;
    readonly options: CylindricalWrapCarrierOptions;
    readonly domain: readonly [number, number];
    readonly bounds: {
        readonly radial: WrapMapBound;
    };
    readonly proof: Pick<CylindricalWrapMap['proof'], 'denominator' | 'squaredRadiusNumerator' | 'angularNumerator' | 'circleResidual' | 'denominatorMinimum' | 'squaredRadiusMinimum' | 'angularMinimum'>;
    readonly counts: CylindricalWrapMap['counts'];
    readonly limits: Pick<CylindricalWrapMap['limits'], 'work' | 'rationalOperations' | 'rationalGcdSteps' | 'rationalIntegerBits' | 'fractionCharacters' | 'floatSearchStepsPerConversion'>;
    readonly meaning: {
        readonly guarantee: 'analytic-original-carrier-coefficients-only';
        readonly parameter: 'original-native-domain-no-inverse-map';
        readonly derivatives: 'normalized-original-full-span';
        readonly source: 'copied-original-binary64-poles-weights-and-knots';
        readonly family: 'quantified-near-quarter-caller-retains-native-provenance';
        readonly chart: false;
        readonly inverse: false;
        readonly nodes: false;
        readonly composition: false;
        readonly surfaceBinding: false;
        readonly trim: false;
        readonly solid: false;
        readonly globalNativeEvaluationError: false;
    };
}
export declare function isCylindricalWrapMapError(error: unknown): error is CylindricalWrapMapError;
/** Private original-carrier proof for native-UV consumers; no arclength/inverse work is requested. */
export declare function certifyCylindricalWrapCarrier(sourceInput: Curve, optionsInput: CylindricalWrapCarrierOptions): CylindricalWrapCarrierCertificate;
/** Private proof/data for a later cubic composition. No Curve, Surface, glyph, B-rep or part is generated. */
export declare function buildCylindricalWrapMap(sourceInput: Curve, optionsInput: CylindricalWrapMapOptions): CylindricalWrapMap;
