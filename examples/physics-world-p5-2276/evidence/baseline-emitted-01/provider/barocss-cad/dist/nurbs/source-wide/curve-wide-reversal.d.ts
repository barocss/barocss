import type { CurveReversalOptions, CurveReversalProvenance, CurveReversalObservation, CurveReversalGuardObservation } from '../curves/curve-reversal.js';
import type { Curve, Model } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const WideCurveReversalDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly DOMAIN: "DOMAIN";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type WideCurveReversalDiagnosticCode = typeof WideCurveReversalDiagnosticCode[keyof typeof WideCurveReversalDiagnosticCode];
export declare class WideCurveReversalError extends KernelError {
    readonly code: WideCurveReversalDiagnosticCode;
    constructor(code: WideCurveReversalDiagnosticCode, detail: string, cause?: unknown);
}
export interface WideReversedCurveReport {
    family: 'own-native-wide-positive-rational-curve-reversal';
    dto: {
        schema: 'barocss-native-wide-reversed-curve';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-curve-not-wire-topology';
    };
    originalCurveId: string;
    curveId: string;
    degree: number;
    poleCount: number;
    knotCount: number;
    domain: [number, number];
    observationCount: number;
    guardCount: number;
    observations: CurveReversalObservation[];
    guards: CurveReversalGuardObservation[];
    maximumPointDifference: number;
    maximumRelativeDerivativeDifference: number;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    inputProfile: {
        degreeRange: [1, 3];
        poleRange: [2, 64];
        maximumKnots: 70;
        coordinateAbs: 10000;
        weightRange: [1e-6, 1e6];
        positive: true;
        clamped: true;
        nonperiodic: true;
    };
    quality: {
        pointComparison: 1e-7;
        relativeD1Comparison: 1e-7;
        localObservationsOnly: true;
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        controlAndWeightBitsPreserved: true;
        generatedInteriorKnotBitsCertified: false;
        doubleReversalBitsCertified: false;
        derivativeSemantics: 'native-c0-guards-unchanged-no-g1-g2-claim';
        nativeGuardStates: 'original-knot-mapped-original-parameter-and-reversed-knot-observed-separately';
        arithmetic: '64-epsilon-nonzero-cancellation-and-order-refusal';
        sourceText: 'regenerated-from-supplied-native-curve-not-original-file-formatting';
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-result';
    limits: {
        maximumDegree: 3;
        maximumPoles: 64;
        nativeMathPoles: 64;
        nativeSourceKnots: 70;
        maximumObservations: 256;
        maximumGuards: 64;
        inputValues: 32768;
        inputDepth: 8;
        inputArrayElements: 128;
        inputRecordFields: 16;
        inputStringCharacters: 128;
        snapshotValues: 524288;
        snapshotDepth: 32;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
    };
}
export interface WideReversedCurveResult {
    original: Curve;
    options: CurveReversalOptions;
    curve: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    originalSource: string;
    originalModel: Model;
    provenance: CurveReversalProvenance;
    report: WideReversedCurveReport;
}
/** Wide admission around the unchanged trusted reflection, coefficient and native source operation. */
export declare function reverseCurveWide(curveInput: Curve, inputOptions: CurveReversalOptions): WideReversedCurveResult;
/** Rebuild all actual original/reversed sources, coefficient maps, point/D1 guards and report data. */
export declare function validateWideReversedCurveResult(input: WideReversedCurveResult): WideReversedCurveReport;
