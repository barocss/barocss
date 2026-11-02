import type { SurfaceD1Result } from '../../core/derivatives.js';
import type { ReversedCurveResult } from '../curves/curve-reversal.js';
import type { Surface, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SurfaceAxisReversalDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly AXIS: "AXIS";
    readonly IDENTITY: "IDENTITY";
    readonly DOMAIN: "DOMAIN";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type SurfaceAxisReversalDiagnosticCode = typeof SurfaceAxisReversalDiagnosticCode[keyof typeof SurfaceAxisReversalDiagnosticCode];
export declare class SurfaceAxisReversalError extends KernelError {
    readonly code: SurfaceAxisReversalDiagnosticCode;
    constructor(code: SurfaceAxisReversalDiagnosticCode, detail: string, cause?: unknown);
}
export interface SurfaceAxisReversalDomain {
    u: [number, number];
    v: [number, number];
}
export interface SurfaceAxisReversalOptions {
    surfaceId: string;
    axis: 'u' | 'v';
    resultIdPrefix: string;
}
export type SurfaceAxisReversalD1State = {
    status: 'evaluated';
    value: SurfaceD1Result;
} | {
    status: 'native-refused';
    reason: string;
};
export interface SurfaceAxisReversalStrip {
    fixedPoleIndex: number;
    result: ReversedCurveResult;
}
export interface SurfaceAxisReversalCoefficientMapping {
    originalUIndex: number;
    originalVIndex: number;
    reversedUIndex: number;
    reversedVIndex: number;
    pointOrigin: 'original-bit-copy';
    weightOrigin: 'original-bit-copy';
}
export interface SurfaceAxisReversalProvenance {
    originalSurfaceId: string;
    outputSurfaceId: string;
    axis: 'u' | 'v';
    domain: SurfaceAxisReversalDomain;
    parameterMaps: {
        u: {
            orientation: 1 | -1;
            d1Factor: 1 | -1;
            formula: 'u=s' | 'u=a+(b-s)';
            domain: [number, number];
        };
        v: {
            orientation: 1 | -1;
            d1Factor: 1 | -1;
            formula: 'v=t' | 'v=a+(b-t)';
            domain: [number, number];
        };
    };
    strips: SurfaceAxisReversalStrip[];
    coefficients: SurfaceAxisReversalCoefficientMapping[];
}
export interface SurfaceAxisReversalObservation {
    u: number;
    v: number;
    originalU: number;
    originalV: number;
    originalPoint: Point;
    reversedPoint: Point;
    pointDifference: number;
    originalD1: SurfaceAxisReversalD1State;
    reversedD1: SurfaceAxisReversalD1State;
    expectedDu: Point | null;
    expectedDv: Point | null;
    duDifference: number | null;
    dvDifference: number | null;
}
export interface SurfaceAxisReversalGuardObservation {
    axis: 'u' | 'v';
    originalAuthoredU: number;
    originalAuthoredV: number;
    mappedOriginalU: number;
    mappedOriginalV: number;
    reversedU: number;
    reversedV: number;
    originalAtAuthoredKnot: SurfaceAxisReversalD1State;
    originalAtMappedParameters: SurfaceAxisReversalD1State;
    reversedAtReflectedParameters: SurfaceAxisReversalD1State;
}
export interface ReversedSurfaceAxisReport {
    family: 'own-native-surface-parameter-axis-reversal';
    dto: {
        schema: 'barocss-native-surface-axis-reversal';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-surface-not-face-topology';
    };
    originalSurfaceId: string;
    surfaceId: string;
    axis: 'u' | 'v';
    domain: SurfaceAxisReversalDomain;
    grid: {
        u: number;
        v: number;
        total: number;
    };
    stripCount: number;
    observations: SurfaceAxisReversalObservation[];
    guards: SurfaceAxisReversalGuardObservation[];
    maximumPointDifference: number;
    maximumRelativeDuDifference: number;
    maximumRelativeDvDifference: number;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        pointComparison: 1e-7;
        relativeD1Comparison: 1e-7;
        localObservationsOnly: true;
        globalShapeErrorCertified: false;
        manufacturingToleranceCertified: false;
        coefficientAndWeightBitsPreserved: true;
        nonselectedKnotBitsPreserved: true;
        generatedInteriorKnotBitsCertified: false;
        doubleReversalBitsCertified: false;
        derivativeSemantics: 'authored-mapped-reflected-combined-d1-states-distinct-no-g1-g2-claim';
    };
    limits: {
        maximumDegree: 3;
        maximumAxisPoles: 16;
        maximumTotalPoles: 256;
        maximumStrips: 16;
        maximumObservations: 128;
        maximumGuardRecords: 256;
        inputValues: 32768;
        inputDepth: 8;
        inputArrayElements: 64;
        inputRecordFields: 16;
        snapshotValues: 262144;
        snapshotDepth: 32;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
        resultIdPrefixCharacters: 20;
    };
}
export interface ReversedSurfaceAxisResult {
    original: Surface;
    options: SurfaceAxisReversalOptions;
    surface: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    originalSource: string;
    originalModel: Model;
    provenance: SurfaceAxisReversalProvenance;
    report: ReversedSurfaceAxisReport;
}
/** Axis orientation comes from actual native Curve reversal; no second scalar reflection evaluator. */
export declare function reverseSurfaceAxis(surfaceInput: Surface, inputOptions: SurfaceAxisReversalOptions): ReversedSurfaceAxisResult;
/** Rebuild every actual native strip and mapped Surface observation; cached diagnostics are never authority. */
export declare function validateReversedSurfaceAxis(input: ReversedSurfaceAxisResult): ReversedSurfaceAxisReport;
