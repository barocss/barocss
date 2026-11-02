import type { CadAssemblyResult, CadAssemblyMatrix, CadAssemblyPlacement } from './cad-assembly.js';
import type { CadGeometryReferenceV0, CadDocumentPointQuery, CadDocumentPointResult } from './cad-document-reference.js';
import type { Point } from '../types.js';
export interface CadAssemblyInstancePointQuery {
    assemblyId: string;
    assemblyRevision: number;
    instanceId: string;
    reference: CadGeometryReferenceV0;
    query: CadDocumentPointQuery;
}
export interface CadAssemblyInstancePointReport {
    schema: 'barocss-cad-assembly-instance-point';
    version: 0;
    assemblyId: string;
    assemblyRevision: number;
    instanceId: string;
    reference: CadGeometryReferenceV0;
    lengthUnit: 'mm';
    originalLocalFrame: 'authored-xyz-no-axis-conversion';
    outputFrame: {
        kind: 'assembly-space-xyz';
        assemblyId: string;
        lengthUnit: 'mm';
    };
    nativePoint: CadDocumentPointResult;
    lineage: {
        instanceId: string;
        parentId: string | null;
        reference: CadGeometryReferenceV0;
        placement: CadAssemblyPlacement;
        localMatrix: CadAssemblyMatrix;
        worldMatrix: CadAssemblyMatrix;
    }[];
    geometryAuthority: 'embedded-current-cad-document-source0';
    placementAuthority: 'authored-assembly-instance-graph';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        querySemantics: 'original-native-parameter-then-explicit-assembly-world-matrix';
        composition: 'parent-world-times-local-no-euler-addition';
        matrixConvention: 'row-major-column-vector';
        bindingSemantics: 'exact-assembly-revision-instance-and-qualified-part-reference';
        lineageOrder: 'root-through-selected-instance';
        originalGeometryAndSourcePreserved: true;
        originalLocalQueriesRemainUnposed: true;
        nativeFrameUpCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        topologyNamingCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    limits: {
        maximumInstances: 32;
        maximumDepth: 16;
        maximumNativePointQueries: 1;
        pointCoordinateAbsMM: 10000000;
        ownedValues: 1048576;
        ownedDepth: 40;
        arrayElements: 8192;
        recordFields: 64;
        stringCharacters: 262144;
    };
}
export interface CadAssemblyInstancePointResult {
    assemblyId: string;
    assemblyRevision: number;
    instanceId: string;
    reference: CadGeometryReferenceV0;
    query: CadDocumentPointQuery;
    originalLocalPointMM: Point;
    assemblyPointMM: Point;
    ancestors: string[];
    localMatrix: CadAssemblyMatrix;
    worldMatrix: CadAssemblyMatrix;
    report: CadAssemblyInstancePointReport;
}
/** Query original native geometry, then apply the explicitly authored instance hierarchy. */
export declare function queryCadAssemblyInstancePoint(input: CadAssemblyResult, inputQuery: CadAssemblyInstancePointQuery): CadAssemblyInstancePointResult;
/** Rebuild the actual current graph, original point and complete posed lineage. */
export declare function validateCadAssemblyInstancePoint(assembly: CadAssemblyResult, input: CadAssemblyInstancePointResult): CadAssemblyInstancePointReport;
