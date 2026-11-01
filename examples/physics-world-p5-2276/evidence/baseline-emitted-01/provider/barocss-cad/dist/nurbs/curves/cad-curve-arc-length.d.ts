import type { CadGeometryReferenceV0 } from '../../document/cad-document-reference.js';
import type { CadDocumentResult } from '../../cad-document.js';
import type { Curve, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const CadCurveArcLengthDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly REFERENCE: "REFERENCE";
    readonly STALE: "STALE";
    readonly INTERVAL: "INTERVAL";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CadCurveArcLengthDiagnosticCode = typeof CadCurveArcLengthDiagnosticCode[keyof typeof CadCurveArcLengthDiagnosticCode];
export declare class CadCurveArcLengthError extends KernelError {
    readonly code: CadCurveArcLengthDiagnosticCode;
    constructor(code: CadCurveArcLengthDiagnosticCode, detail: string, cause?: unknown);
}
export interface CadCurveArcLengthOptions {
    interval: [number, number] | null;
    absoluteToleranceMM: number;
    relativeTolerance: number;
    maximumEvaluations: number;
    maximumSubdivisions: number;
    maximumDepth: number;
}
export interface CadCurveArcLengthPanel {
    panelIndex: number;
    domain: [number, number];
    depth: number;
    originalSpanIndex: number;
    Q3: number;
    Q5: number;
    gaussDifferenceMM: number;
    roundoffFloorMM: number;
    chordShortfallMM: number;
    nativeChordSumMM: number;
    errorEstimateMM: number;
    nodes: {
        parameter: number;
        speed: number;
        pointMM: Point;
    }[];
    endpointPointsMM: [Point, Point];
}
export interface CadCurveArcLengthReport {
    schema: 'barocss-cad-curve-arc-length';
    version: 0;
    reference: CadGeometryReferenceV0;
    documentVersion: 1;
    sourceVersion: 0;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    originalDomain: [number, number];
    requestedInterval: [number, number] | null;
    interval: [number, number];
    originalBreaks: number[];
    initialBreaks: number[];
    initialPanelCount: number;
    finalPanelCount: number;
    panelMeasurementCount: number;
    evaluationCount: number;
    pointEvaluationCount: number;
    guardEvaluationCount: number;
    subdivisionCount: number;
    guards: {
        parameter: number;
        multiplicity: number;
        status: 'native-refused';
        nativeErrorName: string;
        nativeErrorCode: string | null;
        message: string;
    }[];
    subdivisions: {
        index: number;
        parent: CadCurveArcLengthPanel;
        midpoint: number;
        lower: CadCurveArcLengthPanel;
        upper: CadCurveArcLengthPanel;
        evaluationCountAfterSubdivision: number;
        pointEvaluationCountAfterSubdivision: number;
    }[];
    estimatedLengthMM: number;
    errorEstimateMM: number;
    requestedAbsoluteToleranceMM: number;
    requestedRelativeTolerance: number;
    achievedToleranceMM: number;
    criterion: 'aggregate-panel-estimator-not-certified-upper-bound';
    criterionSatisfied: true;
    rule: {
        family: 'own-closed-form-three-and-five-point-gauss-legendre';
        normalizedNodes: number[];
        G3Weights: [number, number, number];
        G5Weights: [number, number, number, number, number];
        sharedCentreEvaluatedOnce: true;
        derivativeCallsPerPanel: 7;
        endpointPointCallsPerPanel: 2;
    };
    geometryAuthority: 'actual-original-source0-curve-and-native-d1';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        lengthEstimate: 'five-point-rule-only-no-chord-substitution';
        estimator: 'maximum-gauss-difference64-epsilon-floor-and-native-chord-shortfall';
        nativeChordSanity: 'ordered-native-point-polyline-heuristic-not-certified-bound';
        derivativeNodes: 'seven-distinct-strict-interior-native-parameters';
        knotGuards: 'separate-genuine-native-c0-refusals-not-quadrature-samples';
        panelIdentity: 'measurement-order-id-including-discarded-parents-final-array-is-u-order';
        discardedParentWorkCounted: true;
        zeroNativeSpeedSupported: true;
        globalErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        g1g2Certified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-result';
    limits: {
        maximumDegree: 3;
        maximumCurvePoles: 64;
        maximumKnots: 70;
        coordinateAbsMM: 10000;
        weightRange: [1e-6, 1e6];
        maximumEvaluations: 16384;
        maximumSubdivisions: 512;
        maximumDepth: 16;
        maximumGuards: 64;
        ownedValues: 262144;
        ownedDepth: 32;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        optionValues: 32768;
        optionDepth: 8;
        optionArrayElements: 128;
        optionRecordFields: 16;
        optionStringCharacters: 128;
    };
}
export interface CadCurveArcLengthResult {
    reference: CadGeometryReferenceV0;
    geometry: Curve;
    source: string;
    options: CadCurveArcLengthOptions;
    estimatedLengthMM: number;
    errorEstimateMM: number;
    panels: CadCurveArcLengthPanel[];
    report: CadCurveArcLengthReport;
}
/** Bounded native D1 quadrature with separately recorded original C0 guards and chord sanity. */
export declare function queryCadDocumentCurveArcLength(documentInput: CadDocumentResult, referenceInput: CadGeometryReferenceV0, optionInput: CadCurveArcLengthOptions): CadCurveArcLengthResult;
/** Re-resolve and reproduce all actual native nodes, chord sanity, discarded work and estimator data. */
export declare function validateCadDocumentCurveArcLength(document: CadDocumentResult, input: CadCurveArcLengthResult): CadCurveArcLengthReport;
