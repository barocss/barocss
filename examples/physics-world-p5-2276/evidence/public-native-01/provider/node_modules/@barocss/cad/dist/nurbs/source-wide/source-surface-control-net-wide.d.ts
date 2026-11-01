import type { SurfaceControlNetEdits, SurfacePoleField, SurfacePoleEditProvenance } from '../surfaces/surface-control-net.js';
import type { SurfaceD1Result } from '../../core/derivatives.js';
import type { Surface, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SourceSurfaceControlNetWideDiagnosticCode: Readonly<{
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
export type SourceSurfaceControlNetWideDiagnosticCode = typeof SourceSurfaceControlNetWideDiagnosticCode[keyof typeof SourceSurfaceControlNetWideDiagnosticCode];
export declare class SourceSurfaceControlNetWideError extends KernelError {
    readonly code: SourceSurfaceControlNetWideDiagnosticCode;
    constructor(code: SourceSurfaceControlNetWideDiagnosticCode, detail: string, cause?: unknown);
}
export interface SourceSurfaceControlNetWideRequest {
    source: string;
    sourceVersion: 0;
    surfaceId: string;
    edits: SurfaceControlNetEdits;
}
export interface SourceSurfaceControlNetWidePatch {
    uIndex: number;
    vIndex: number;
    field: SurfacePoleField;
    startUTF16: number;
    endUTF16: number;
    originalText: string;
    replacementText: string;
}
type Observation = {
    u: number;
    v: number;
    beforePoint: Point;
    afterPoint: Point;
    observedChange: number;
};
type D1Evaluation = {
    kind: 'evaluated';
    result: SurfaceD1Result;
} | {
    kind: 'refused';
    message: string;
};
type D1Observation = {
    u: number;
    v: number;
    before: D1Evaluation;
    after: D1Evaluation;
};
export interface SourceSurfaceControlNetWideReport {
    schema: 'barocss-source-surface-control-net-wide-edit';
    version: 0;
    sourceVersion: 0;
    modelVersion: 0;
    lengthUnit: 'mm';
    modelName: string;
    surfaceId: string;
    selectedObjectIndex: number;
    objectCount: number;
    degrees: {
        u: number;
        v: number;
    };
    controlPointCounts: {
        u: number;
        v: number;
        total: number;
    };
    domain: {
        u: [number, number];
        v: [number, number];
    };
    parameters: {
        u: [number, number, number];
        v: [number, number, number];
    };
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
    derivativeObservations: D1Observation[];
    preservation: {
        untouchedSourceSpans: true;
        modelHeaderBits: true;
        objectOrderAndIds: true;
        unselectedObjectBits: true;
        selectedSurfaceEqualsActualEditedSurface: true;
        degreesKnotsDomainsAndGrid: true;
    };
    directCounts: {
        originalCompileCount: 1;
        candidateCompileCount: 1;
        nativeSurfaceValidationCount: 1;
        domainQueryCount: 1;
        surfacePointEvaluationCount: 18;
        surfaceDerivativeEvaluationCount: 18;
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
        parametricRecipeBindingCertified: false;
        derivativeSemantics: 'native-guards-unchanged';
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumPatches: 1024;
        maximumEdits: 256;
        maximumRequestedFields: 1024;
        maximumModelObjects: 16;
        maximumSelectedDegree: 5;
        maximumSelectedGridAxis: 16;
        maximumSelectedPoles: 256;
        maximumSelectedKnotsPerAxis: 22;
        selectedCoordinateAbs: 1000000;
        minimumWeight: 0.000001;
        maximumWeight: 1000000;
        maximumReplacementLiteralCharacters: 512;
        maximumPointObservations: 9;
        maximumDerivativeObservations: 9;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        stringCharacters: 262144;
    };
    workScope: 'direct-original-candidate-compiles-edited-native-validation-and-fixed-observations-inherited-work-excluded';
    budgetFailure: 'atomic-no-partial-source-surface-edit';
}
export interface SourceSurfaceControlNetWideResult {
    request: SourceSurfaceControlNetWideRequest;
    originalModel: Model;
    model: Model;
    source: string;
    surface: Surface;
    provenance: SurfacePoleEditProvenance[];
    patches: SourceSurfaceControlNetWidePatch[];
    report: SourceSurfaceControlNetWideReport;
}
/** Edit literal scalars on the complete native Surface profile while retaining the whole original Model source. */
export declare function editSourceSurfaceControlNetWide(input: SourceSurfaceControlNetWideRequest): SourceSurfaceControlNetWideResult;
/** Rebuild the entire source operation and its native observations, comparing every retained bit. */
export declare function validateSourceSurfaceControlNetWideEdit(input: SourceSurfaceControlNetWideResult): SourceSurfaceControlNetWideReport;
export {};
