import type { CadDocumentV1, CadDocumentResult } from '../cad-document.js';
import type { CadGeometryReferenceV0 } from './cad-document-reference.js';
import type { Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const CadAssemblyDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly VERSION: "VERSION";
    readonly IDENTITY: "IDENTITY";
    readonly REFERENCE: "REFERENCE";
    readonly STALE: "STALE";
    readonly HIERARCHY: "HIERARCHY";
    readonly REVISION: "REVISION";
    readonly PLACEMENT: "PLACEMENT";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly JSON: "JSON";
    readonly OWNED: "OWNED";
    readonly QUERY: "QUERY";
    readonly NATIVE: "NATIVE";
}>;
export type CadAssemblyDiagnosticCode = typeof CadAssemblyDiagnosticCode[keyof typeof CadAssemblyDiagnosticCode];
export declare class CadAssemblyError extends KernelError {
    readonly code: CadAssemblyDiagnosticCode;
    constructor(code: CadAssemblyDiagnosticCode, detail: string, cause?: unknown);
}
export type CadAssemblyMatrix = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];
export interface CadAssemblyPlacement {
    translationMM: Point;
    rotationDegreesXYZ: Point;
}
export interface CadAssemblyInstance {
    id: string;
    parentId: string | null;
    reference: CadGeometryReferenceV0;
    placement: CadAssemblyPlacement;
}
export interface CadAssemblyV0 {
    schema: 'barocss-cad-assembly';
    version: 0;
    assemblyId: string;
    revision: number;
    lengthUnit: 'mm';
    rotationUnit: 'deg';
    frame: 'assembly-space-xyz';
    parts: CadDocumentV1[];
    instances: CadAssemblyInstance[];
}
export interface CadAssemblyEvaluatedInstance {
    instanceId: string;
    parentId: string | null;
    reference: CadGeometryReferenceV0;
    placement: CadAssemblyPlacement;
    ancestors: string[];
    depth: number;
    localMatrix: CadAssemblyMatrix;
    worldMatrix: CadAssemblyMatrix;
}
export interface CadAssemblyEdits {
    expectedRevision: number;
    revision: number;
    instanceEdits: {
        instanceId: string;
        parentId?: string | null;
        translationMM?: Point;
        rotationDegreesXYZ?: Point;
    }[];
}
export interface CadAssemblyReport {
    schema: 'barocss-cad-assembly-report';
    version: 0;
    assemblyId: string;
    revision: number;
    documentCount: number;
    instanceCount: number;
    rootInstanceCount: number;
    maximumDepth: number;
    uniquePartReferenceCount: number;
    sharedReferenceCount: number;
    sharedPartGroups: {
        reference: CadGeometryReferenceV0;
        instanceIds: string[];
        instanceCount: number;
    }[];
    lengthUnit: 'mm';
    rotationUnit: 'deg';
    frame: 'assembly-space-xyz';
    geometryAuthority: 'embedded-canonical-document-v1-original-source0';
    placementAuthority: 'authored-assembly-instance-hierarchy-and-placements';
    conventions: {
        matrixLayout: 'row-major';
        pointConvention: 'column-vector';
        rotationOrder: 'Rz*Ry*Rx';
        composition: 'parent-world-times-local';
        ancestorOrder: 'root-to-parent';
        rootDepth: 1;
        partSourceFrame: 'authored-xyz-no-axis-conversion';
        worldFrame: 'assembly-space-xyz';
    };
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        partSourceUnchanged: true;
        geometryNotBakedRenamedOrResampled: true;
        poseFieldsBitsPreserved: true;
        sharedReferencesAllowed: true;
        geometryIdAloneNeverMergesParts: true;
        logicalInstanceIdsNotTopologyIds: true;
        nativeReferenceBinding: 'exact-declared-document-and-asset-revisions-current-embedded-snapshot-only';
        sourceEditRevisionResponsibility: 'caller-must-advance-part-document-and-asset-revisions';
        contentHashCertified: false;
        hiddenHistoryOrExternalRefresh: 'none';
        numericRigidityCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-original-assembly-and-prior-results-retained';
    limits: {
        maximumParts: 4;
        maximumInstances: 32;
        maximumHierarchyDepth: 16;
        maximumRevision: 2147483647;
        authoredIdCharacters: 48;
        localTranslationAbsMM: 10000;
        rotationAbsDegrees: 360;
        worldTranslationAbsMM: 1000000;
        pointComponentAbsMM: 10000000;
        rotationBlockAllowance: 1e-9;
        ownValues: 1048576;
        ownDepth: 40;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
        maximumFileBytes: 16777216;
        maximumFileCodeUnits: 16777216;
        jsonValues: 65536;
        jsonDepth: 12;
        jsonArrayElements: 64;
        jsonRecordFields: 16;
        jsonStringCharacters: 262144;
    };
}
export interface CadAssemblyResult {
    assembly: CadAssemblyV0;
    documents: CadDocumentResult[];
    instances: CadAssemblyEvaluatedInstance[];
    report: CadAssemblyReport;
}
/** Internal shared plain-data snapshot. Repeated aliases are copied; ancestor cycles refuse. */
export declare function snapshotCadAssemblyData(input: unknown, mode?: 'input' | 'owned'): unknown;
/** Internal bit-aware complete data comparison, including qualified references. */
export declare function sameCadAssemblyData(a: unknown, b: unknown): boolean;
/** Internal derived point application; original native geometry and source are never transformed. */
export declare function applyCadAssemblyMatrixPoint(matrixInput: CadAssemblyMatrix, pointInput: Point): Point;
/** Resolve unchanged embedded canonical parts and evaluate authored hierarchy placements atomically. */
export declare function evaluateCadAssembly(input: CadAssemblyV0): CadAssemblyResult;
/** Internal complete owned reconstruction for validators and the instance-point module. */
export declare function rebuildCadAssemblyResult(input: CadAssemblyResult): CadAssemblyResult;
/** Rebuild all native embedded parts and derived hierarchy data. */
export declare function validateCadAssemblyResult(input: CadAssemblyResult): CadAssemblyReport;
/** Revision-checked placement/reparent patches only; untouched source/reference/order bits remain. */
export declare function updateCadAssembly(previousInput: CadAssemblyResult, editInput: CadAssemblyEdits): CadAssemblyResult;
/** Serialize authored fields only, preserving negative-zero tokens and every embedded source string. */
export declare function serializeCadAssembly(input: CadAssemblyV0): string;
/** Parse a new authored candidate with the unchanged strict duplicate-key JSON decoder. */
export declare function parseCadAssembly(text: string): CadAssemblyResult;
