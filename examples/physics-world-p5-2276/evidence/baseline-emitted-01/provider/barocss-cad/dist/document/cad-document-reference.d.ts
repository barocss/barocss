import type { CadDocumentResult } from '../cad-document.js';
import type { Curve, Surface, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const CadReferenceDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly VERSION: "VERSION";
    readonly REFERENCE: "REFERENCE";
    readonly STALE: "STALE";
    readonly QUERY: "QUERY";
    readonly FRAME: "FRAME";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CadReferenceDiagnosticCode = typeof CadReferenceDiagnosticCode[keyof typeof CadReferenceDiagnosticCode];
export declare class CadReferenceError extends KernelError {
    readonly code: CadReferenceDiagnosticCode;
    constructor(code: CadReferenceDiagnosticCode, detail: string, cause?: unknown);
}
export interface CadGeometryReferenceInput {
    bodyId: string;
}
export interface CadGeometryReferenceV0 {
    schema: 'barocss-cad-geometry-reference';
    version: 0;
    documentId: string;
    documentRevision: number;
    bodyId: string;
    assetId: string;
    assetRevision: number;
    geometryId: string;
    geometryKind: 'curve' | 'surface';
    sourceVersion: 0;
    sourceFrame: 'authored-xyz-no-axis-conversion';
    lengthUnit: 'mm';
}
export interface CadGeometryReferenceResult {
    reference: CadGeometryReferenceV0;
    geometry: Curve | Surface;
    source: string;
    report: CadReferenceReport;
}
export interface CadGeometryRebindResult {
    previousReference: CadGeometryReferenceV0;
    reference: CadGeometryReferenceV0;
    report: CadReferenceReport;
}
export type CadDocumentPointQuery = {
    kind: 'curve';
    parameter: number;
} | {
    kind: 'surface';
    u: number;
    v: number;
};
export interface CadDocumentPointResult {
    reference: CadGeometryReferenceV0;
    query: CadDocumentPointQuery;
    pointMM: Point;
    report: CadReferenceReport;
}
export interface CadFrameConversionOptions {
    targetFrameId: string;
    axisMap: 'identity' | 'x-z-minus-y';
    targetLengthUnit: 'mm' | 'm';
}
export interface CadFrameConversionResult {
    sourcePoint: CadDocumentPointResult;
    options: CadFrameConversionOptions;
    convertedPoint: Point;
    report: CadFrameConversionReport;
}
export interface CadReferenceReport {
    schema: 'barocss-cad-reference-report';
    version: 0;
    documentVersion: 1;
    referenceVersion: 0;
    operation: 'create' | 'resolve' | 'rebind' | 'point-query';
    documentId: string;
    documentRevision: number;
    bodyId: string;
    assetId: string;
    assetRevision: number;
    geometryId: string;
    geometryKind: 'curve' | 'surface';
    sourceVersion: 0;
    sourceFrame: 'authored-xyz-no-axis-conversion';
    lengthUnit: 'mm';
    previousDocumentRevision: number | null;
    previousAssetRevision: number | null;
    geometryAuthority: 'actual-authored-source0-model';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        bindingSemantics: 'exact-document-and-asset-revisions';
        rebindSemantics: 'unchanged-complete-native-coefficients-only';
        querySemantics: 'original-native-closed-parameter-domain';
        topologyNamingCertified: false;
        manufacturingToleranceCertified: false;
        globalBinary64ErrorCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    limits: {
        maximumGeometryObjectsPerReference: 1;
        inputValues: 262144;
        inputDepth: 24;
        inputArrayElements: 4096;
        inputRecordFields: 64;
        snapshotValues: 262144;
        snapshotDepth: 32;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
        geometryIdCharacters: 128;
        maximumRevision: 2147483647;
    };
}
export interface CadFrameConversionReport {
    schema: 'barocss-cad-frame-conversion-report';
    version: 0;
    documentVersion: 1;
    referenceVersion: 0;
    sourceVersion: 0;
    inputFrame: {
        id: 'authored-xyz-no-axis-conversion';
        basis: 'xyz';
        handedness: 'right-handed';
        lengthUnit: 'mm';
    };
    outputFrame: {
        id: string;
        basis: 'xyz' | 'x-z-minus-y';
        handedness: 'right-handed';
        lengthUnit: 'mm' | 'm';
    };
    axisMap: 'identity' | 'x-z-minus-y';
    basisRows: [Point, Point, Point];
    scale: number;
    transformOrder: 'axis-map-then-mm-scale';
    role: 'derived-display-frame-mapping-not-native-source-edit';
    nativeSourcePreserved: true;
    nativeFrameUpCertified: false;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        mappingSemantics: 'explicit-known-axis-map-and-unit-scale';
        manufacturingToleranceCertified: false;
        globalBinary64ErrorCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    limits: CadReferenceReport['limits'];
}
/** Capture one actual document/body/asset/native geometry binding at its authored revisions. */
export declare function createCadGeometryReference(documentInput: CadDocumentResult, input: CadGeometryReferenceInput): CadGeometryReferenceResult;
/** Resolve exact native identity and document/asset revisions. No nearest or topology fallback exists. */
export declare function resolveCadGeometryReference(documentInput: CadDocumentResult, referenceInput: CadGeometryReferenceV0): CadGeometryReferenceResult;
/** Explicit rebind requires the entire selected native object to remain bit-identical. */
export declare function rebindCadGeometryReference(previousDocument: CadDocumentResult, currentDocument: CadDocumentResult, previousReference: CadGeometryReferenceV0): CadGeometryRebindResult;
/** Query the actual source-backed native object in authored XYZ/mm and original parameter units. */
export declare function queryCadDocumentPoint(documentInput: CadDocumentResult, referenceInput: CadGeometryReferenceV0, queryInput: CadDocumentPointQuery): CadDocumentPointResult;
/** Rebuild every point and report field from the actual document source. */
export declare function validateCadDocumentPoint(documentInput: CadDocumentResult, input: CadDocumentPointResult): CadReferenceReport;
/** Apply a declared axis map, then a declared mm-to-target-unit scale, without editing native source. */
export declare function convertCadDocumentPoint(documentInput: CadDocumentResult, pointInput: CadDocumentPointResult, optionsInput: CadFrameConversionOptions): CadFrameConversionResult;
/** Rebuild the validated native point and the complete declared mapping result. */
export declare function validateCadFrameConversion(documentInput: CadDocumentResult, input: CadFrameConversionResult): CadFrameConversionReport;
