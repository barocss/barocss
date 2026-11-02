import type { CurveControlPolygonEdits, CurvePoleField, CurvePoleEditProvenance, CurveControlPolygonD1Observation } from '../curves/curve-control-polygon.js';
import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SourceCurveControlPolygonDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly VERSION: "VERSION";
    readonly IDENTITY: "IDENTITY";
    readonly SOURCE: "SOURCE";
    readonly TARGET: "TARGET";
    readonly BINDING: "BINDING";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
}>;
export type SourceCurveControlPolygonDiagnosticCode = typeof SourceCurveControlPolygonDiagnosticCode[keyof typeof SourceCurveControlPolygonDiagnosticCode];
export declare class SourceCurveControlPolygonError extends KernelError {
    readonly code: SourceCurveControlPolygonDiagnosticCode;
    constructor(code: SourceCurveControlPolygonDiagnosticCode, detail: string, cause?: unknown);
}
export interface SourceCurveControlPolygonRequest {
    source: string;
    sourceVersion: 0;
    curveId: string;
    edits: CurveControlPolygonEdits;
}
export interface SourceCurveControlPolygonPatch {
    index: number;
    field: CurvePoleField;
    startUTF16: number;
    endUTF16: number;
    originalText: string;
    replacementText: string;
}
type Observation = {
    parameter: number;
    beforePoint: Point;
    afterPoint: Point;
    observedChange: number;
};
export interface SourceCurveControlPolygonReport {
    schema: 'barocss-source-curve-control-polygon-edit';
    version: 0;
    sourceVersion: 0;
    modelVersion: 0;
    lengthUnit: 'mm';
    modelName: string;
    curveId: string;
    selectedObjectIndex: number;
    objectCount: number;
    degree: number;
    controlPointCount: number;
    domain: [number, number];
    requestedPoleCount: number;
    requestedFieldCount: number;
    changedPoleCount: number;
    changedFieldCount: number;
    untouchedPoleCount: number;
    untouchedFieldCount: number;
    patchCount: number;
    noOp: boolean;
    originalSourceUTF16: number;
    candidateSourceUTF16: number;
    originalSourceUTF8: number;
    candidateSourceUTF8: number;
    observations: Observation[];
    maximumObservedChange: number;
    derivativeObservations: CurveControlPolygonD1Observation[];
    preservation: {
        untouchedSourceSpans: true;
        modelHeaderBits: true;
        objectOrderAndIds: true;
        unselectedObjectBits: true;
        selectedCurveEqualsActualEditedCurve: true;
        degreeKnotsDomainAndCount: true;
    };
    directCounts: {
        originalCompileCount: 1;
        candidateCompileCount: 1;
        nativeCurveValidationCount: 1;
        domainQueryCount: 1;
        curvePointEvaluationCount: 6;
        curveDerivativeEvaluationCount: 6;
        derivativeSuccessCount: number;
        derivativeRefusalCount: number;
        decimalEmissionCount: number;
    };
    quality: {
        geometricValidity: 'not-certified';
        topologyCertified: false;
        solid: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        editorDisplayCertified: false;
        persistentTopologyBindingCertified: false;
        derivativeSemantics: 'native-guards-unchanged';
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumPatches: 256;
        maximumEdits: 64;
        maximumRequestedFields: 256;
        maximumModelObjects: 16;
        maximumSelectedDegree: 5;
        maximumSelectedPoles: 64;
        maximumSelectedKnots: 70;
        selectedCoordinateAbs: 1000000;
        minimumWeight: 0.000001;
        maximumWeight: 1000000;
        maximumReplacementLiteralCharacters: 512;
        maximumPointObservations: 3;
        maximumDerivativeObservations: 3;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        stringCharacters: 262144;
    };
    workScope: 'direct-original-candidate-compiles-edited-native-validation-and-fixed-observations-inherited-work-excluded';
    budgetFailure: 'atomic-no-partial-source-curve-edit';
}
export interface SourceCurveControlPolygonResult {
    request: SourceCurveControlPolygonRequest;
    originalModel: Model;
    model: Model;
    source: string;
    curve: Curve;
    provenance: CurvePoleEditProvenance[];
    patches: SourceCurveControlPolygonPatch[];
    report: SourceCurveControlPolygonReport;
}
/** Edit requested literal scalars on the actual full native Curve profile, preserving the complete original Model source. */
export declare function editSourceCurveControlPolygon(input: SourceCurveControlPolygonRequest): SourceCurveControlPolygonResult;
/** Rebuild the complete original-source operation and all actual native observations, comparing every retained bit. */
export declare function validateSourceCurveControlPolygonEdit(input: SourceCurveControlPolygonResult): SourceCurveControlPolygonReport;
export {};
