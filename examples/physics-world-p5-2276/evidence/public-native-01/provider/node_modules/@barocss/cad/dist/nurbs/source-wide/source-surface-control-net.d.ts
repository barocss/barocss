import type { SurfaceControlNetEdits, SurfaceControlNetResult, SurfacePoleField } from '../surfaces/surface-control-net.js';
import type { Model } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SourceSurfaceControlNetDiagnosticCode: Readonly<{
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
export type SourceSurfaceControlNetDiagnosticCode = typeof SourceSurfaceControlNetDiagnosticCode[keyof typeof SourceSurfaceControlNetDiagnosticCode];
export declare class SourceSurfaceControlNetError extends KernelError {
    readonly code: SourceSurfaceControlNetDiagnosticCode;
    constructor(code: SourceSurfaceControlNetDiagnosticCode, detail: string, cause?: unknown);
}
export interface SourceSurfaceControlNetRequest {
    source: string;
    sourceVersion: 0;
    surfaceId: string;
    edits: SurfaceControlNetEdits;
}
export interface SourceSurfaceControlNetPatch {
    uIndex: number;
    vIndex: number;
    field: SurfacePoleField;
    startUTF16: number;
    endUTF16: number;
    originalText: string;
    replacementText: string;
}
export interface SourceSurfaceControlNetReport {
    schema: 'barocss-source-surface-control-net-edit';
    version: 0;
    sourceVersion: 0;
    modelVersion: 0;
    lengthUnit: 'mm';
    modelName: string;
    surfaceId: string;
    selectedObjectIndex: number;
    objectCount: number;
    requestedPoleCount: number;
    requestedFieldCount: number;
    changedPoleCount: number;
    changedFieldCount: number;
    patchCount: number;
    noOp: boolean;
    originalSourceUTF16: number;
    candidateSourceUTF16: number;
    originalSourceUTF8: number;
    candidateSourceUTF8: number;
    preservation: {
        untouchedSourceSpans: true;
        modelHeaderBits: true;
        objectOrderAndIds: true;
        unselectedObjectBits: true;
        selectedSurfaceEqualsActualChild: true;
    };
    directCounts: {
        originalCompileCount: 1;
        candidateCompileCount: 1;
        nativeEditCount: 1;
    };
    workScope: 'direct-original-and-candidate-compiles-and-native-edit-parent-internal-work-excluded';
    quality: {
        geometricValidity: 'not-certified';
        topologyCertified: false;
        solid: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        editorDisplayCertified: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumPatches: 64;
        maximumEdits: 16;
        maximumModelObjects: 16;
        maximumSelectedDegree: 3;
        maximumSelectedGridAxis: 16;
        selectedCoordinateAbsMM: 10000;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        stringCharacters: 262144;
    };
    budgetFailure: 'atomic-no-partial-source-edit';
}
export interface SourceSurfaceControlNetResult {
    request: SourceSurfaceControlNetRequest;
    originalModel: Model;
    model: Model;
    source: string;
    edit: SurfaceControlNetResult;
    patches: SourceSurfaceControlNetPatch[];
    report: SourceSurfaceControlNetReport;
}
/** Edit only real changed numeric scalar spans in one selected Surface of the complete authoritative original Source0 file. */
export declare function editSourceSurfaceControlNet(input: SourceSurfaceControlNetRequest): SourceSurfaceControlNetResult;
/** Re-run the complete public operation once, including the actual child proof and both whole-source compiles. */
export declare function validateSourceSurfaceControlNetEdit(input: SourceSurfaceControlNetResult): SourceSurfaceControlNetReport;
