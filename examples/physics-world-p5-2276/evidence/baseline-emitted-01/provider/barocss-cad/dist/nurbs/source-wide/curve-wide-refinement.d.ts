import type { CurveD1Result } from '../../core/derivatives.js';
import type { CurveKnotUnchangedPole, CurveKnotUnchangedKnot, CurveKnotInsertionStep, CurveHomogeneousInsertionStep } from '../curves/curve-knot-insertion.js';
import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const WideCurveRefinementDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly REQUEST: "REQUEST";
    readonly IDENTITY: "IDENTITY";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly NATIVE_CAPACITY: "NATIVE_CAPACITY";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type WideCurveRefinementDiagnosticCode = typeof WideCurveRefinementDiagnosticCode[keyof typeof WideCurveRefinementDiagnosticCode];
export declare class WideCurveRefinementError extends KernelError {
    readonly code: WideCurveRefinementDiagnosticCode;
    constructor(code: WideCurveRefinementDiagnosticCode, detail: string, cause?: unknown);
}
export interface WideCurveInsertionRequest {
    parameter: number;
    count: number;
}
export interface WideCurveRefinementOptions {
    curveId: string;
    insertions: WideCurveInsertionRequest[];
    resultIdPrefix: string;
}
export type WideCurveRefinementD1State = {
    status: 'evaluated';
    value: CurveD1Result;
} | {
    status: 'native-refused';
    reason: string;
};
export type WideCurveHomogeneousPole = [number, number, number, number];
export interface WideCurveRefinementOperation {
    index: number;
    request: WideCurveInsertionRequest;
    prior: Curve;
    refined: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: {
        unchangedPoles: CurveKnotUnchangedPole[];
        unchangedKnots: CurveKnotUnchangedKnot[];
        steps: CurveKnotInsertionStep[];
        homogeneousSteps: CurveHomogeneousInsertionStep[];
    };
}
export interface WideCurveRefinementProvenance {
    originalCurveId: string;
    outputCurveId: string;
    domain: [number, number];
    parameterMap: {
        kind: 'identity';
        formula: 'u=t';
        d1Factor: 1;
    };
    operations: WideCurveRefinementOperation[];
    originalCopiedPoles: CurveKnotUnchangedPole[];
    originalCopiedKnots: CurveKnotUnchangedKnot[];
    requestedKnotSlots: {
        requestIndex: number;
        insertion: number;
        refinedKnotIndex: number;
        value: number;
    }[];
}
export interface WideCurveRefinementObservation {
    parameter: number;
    originalPointMM: Point;
    refinedPointMM: Point;
    pointDifferenceMM: number;
    originalD1: WideCurveRefinementD1State;
    refinedD1: WideCurveRefinementD1State;
    derivativeDifferenceMM: number | null;
}
export interface WideCurveRefinementGuardObservation {
    parameter: number;
    originalMultiplicity: number;
    refinedMultiplicity: number;
    originalD1: WideCurveRefinementD1State;
    refinedD1: WideCurveRefinementD1State;
}
export interface WideCurveRefinementReport {
    family: 'own-native-wide-positive-rational-curve-refinement';
    dto: {
        schema: 'barocss-native-wide-curve-refinement';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-curve-not-wire-topology';
    };
    originalCurveId: string;
    curveId: string;
    degree: number;
    domain: [number, number];
    poleCounts: {
        original: number;
        refined: number;
    };
    knotCounts: {
        original: number;
        refined: number;
    };
    operationCount: number;
    insertionCount: number;
    observations: WideCurveRefinementObservation[];
    guards: WideCurveRefinementGuardObservation[];
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
        derivativeSemantics: 'actual-original-and-refined-native-guards-no-invented-original-discontinuity-or-g1-g2-claim';
    };
    limits: {
        maximumDegree: 3;
        maximumOriginalPoles: 31;
        maximumRefinedPoles: 64;
        maximumKnots: 70;
        maximumRequests: 16;
        maximumObservations: 128;
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
export interface WideCurveRefinementResult {
    original: Curve;
    options: WideCurveRefinementOptions;
    curve: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    originalSource: string;
    originalModel: Model;
    provenance: WideCurveRefinementProvenance;
    report: WideCurveRefinementReport;
}
/** Bounded wider admission over the SAME trusted homogeneous coefficient calculation as the old16 API. */
export declare function refineCurveWide(curveInput: Curve, inputOptions: WideCurveRefinementOptions): WideCurveRefinementResult;
/** Rebuild original/options, shared coefficient stages, copied slots and complete source/guard metadata. */
export declare function validateWideCurveRefinement(input: WideCurveRefinementResult): WideCurveRefinementReport;
