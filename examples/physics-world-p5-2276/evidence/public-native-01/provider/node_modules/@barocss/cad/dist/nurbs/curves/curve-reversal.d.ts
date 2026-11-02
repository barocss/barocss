import type { CurveD1Result } from '../../core/derivatives.js';
import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const CurveReversalDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly DOMAIN: "DOMAIN";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CurveReversalDiagnosticCode = typeof CurveReversalDiagnosticCode[keyof typeof CurveReversalDiagnosticCode];
export declare class CurveReversalError extends KernelError {
    readonly code: CurveReversalDiagnosticCode;
    constructor(code: CurveReversalDiagnosticCode, detail: string);
}
export interface CurveReversalOptions {
    curveId: string;
}
export type CurveReversalD1State = {
    status: 'evaluated';
    value: CurveD1Result;
} | {
    status: 'native-refused';
    reason: string;
};
export interface CurveReversalKnotMapping {
    originalIndex: number;
    reversedIndex: number;
    originalValue: number;
    reversedValue: number;
    origin: 'copied-domain-min' | 'copied-domain-max' | 'generated-reflection';
}
export interface CurveReversalProvenance {
    originalCurveId: string;
    reversedCurveId: string;
    domain: [number, number];
    decreasingParameterMap: {
        formula: 'u=a+(b-v)';
        orientation: -1;
        d1Factor: -1;
        endpointAssignments: {
            reversedStart: {
                reversed: number;
                original: number;
            };
            reversedEnd: {
                reversed: number;
                original: number;
            };
        };
    };
    controlPointMappings: {
        originalIndex: number;
        reversedIndex: number;
        origin: 'original-bit-copy';
    }[];
    weightMappings: {
        originalIndex: number;
        reversedIndex: number;
        origin: 'original-bit-copy';
    }[];
    knotMappings: CurveReversalKnotMapping[];
}
export interface CurveReversalObservation {
    reversedParameter: number;
    originalParameter: number;
    originalPointMM: Point;
    reversedPointMM: Point;
    pointDifferenceMM: number;
    originalD1: CurveReversalD1State;
    reversedD1: CurveReversalD1State;
    expectedDerivativeMM: Point | null;
    derivativeDifferenceMM: number | null;
}
export interface CurveReversalGuardObservation {
    originalParameter: number;
    reversedParameter: number;
    originalAtOriginalKnot: CurveReversalD1State;
    originalAtMappedParameter: CurveReversalD1State;
    reversedAtReversedKnot: CurveReversalD1State;
}
export interface ReversedCurveReport {
    family: 'own-native-positive-rational-curve-reversal';
    dto: {
        schema: 'barocss-native-reversed-curve';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-curve-not-wire-topology';
    };
    originalCurveId: string;
    curveId: string;
    degree: number;
    poleCount: number;
    domain: [number, number];
    observations: CurveReversalObservation[];
    guards: CurveReversalGuardObservation[];
    maximumPointDifferenceMM: number;
    maximumRelativeDerivativeDifference: number;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        pointComparisonMM: 1e-7;
        relativeD1Comparison: 1e-7;
        localObservationsOnly: true;
        globalShapeErrorCertified: false;
        manufacturingToleranceCertified: false;
        controlAndWeightBitsPreserved: true;
        generatedInteriorKnotBitsCertified: false;
        doubleReversalBitsCertified: false;
        derivativeSemantics: 'native-c0-guards-unchanged-no-g1-g2-claim';
        arithmetic: '64-epsilon-nonzero-cancellation-and-order-refusal';
    };
    limits: {
        maximumDegree: 3;
        maximumPoles: 31;
        nativeMathPoles: 64;
        nativeSourceKnots: 70;
        maximumObservations: 128;
        inputValues: 4096;
        inputDepth: 8;
        inputArrayElements: 64;
        inputRecordFields: 16;
        snapshotValues: 131072;
        snapshotDepth: 24;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
    };
}
export interface ReversedCurveResult {
    original: Curve;
    options: CurveReversalOptions;
    curve: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    originalSource: string;
    originalModel: Model;
    provenance: CurveReversalProvenance;
    report: ReversedCurveReport;
}
/** Trusted admitted-geometry reversal; callers own profile/snapshot and observation capacity. */
export declare function reverseCurveGeometryTrusted(original: Curve, options: CurveReversalOptions, maximumObservations: number): {
    original: Curve;
    options: CurveReversalOptions;
    curve: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    originalSource: string;
    originalModel: Model;
    provenance: CurveReversalProvenance;
    domain: [number, number];
    observations: CurveReversalObservation[];
    guards: CurveReversalGuardObservation[];
    maximumPointDifferenceMM: number;
    maximumRelativeDerivativeDifference: number;
};
/** Reverse native coefficients by bit-preserving copies; reflect parameters without fitting or snapping. */
export declare function reverseCurve(curveInput: Curve, inputOptions: CurveReversalOptions): ReversedCurveResult;
/** Full original/source/bit/map/guard rebuild; stored diagnostics or flags are not authority. */
export declare function validateReversedCurveResult(input: ReversedCurveResult): ReversedCurveReport;
