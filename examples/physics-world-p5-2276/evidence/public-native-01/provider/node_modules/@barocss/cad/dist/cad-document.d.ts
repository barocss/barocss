import type { Model } from './types.js';
import { KernelError } from './core/barocss-error.js';
export declare const CadDocumentDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly VERSION: "VERSION";
    readonly PROFILE: "PROFILE";
    readonly IDENTITY: "IDENTITY";
    readonly REFERENCE: "REFERENCE";
    readonly SOURCE: "SOURCE";
    readonly FRAME: "FRAME";
    readonly BUDGET: "BUDGET";
    readonly JSON: "JSON";
    readonly OWNED: "OWNED";
}>;
export type CadDocumentDiagnosticCode = typeof CadDocumentDiagnosticCode[keyof typeof CadDocumentDiagnosticCode];
export declare class CadDocumentError extends KernelError {
    readonly code: CadDocumentDiagnosticCode;
    constructor(code: CadDocumentDiagnosticCode, detail: string, cause?: unknown);
}
export interface CadDocumentUnits {
    length: 'mm';
    angle: 'rad';
}
export interface CadDocumentSourceAsset {
    id: string;
    revision: number;
    role: 'authored-native-source';
    sourceVersion: 0;
    sourceFrame: 'authored-xyz-no-axis-conversion';
    source: string;
}
export interface CadDocumentBody {
    id: string;
    name: string;
    kind: 'direct-geometry-object';
    assetId: string;
    geometryId: string;
}
export interface CadDocumentV1 {
    schema: 'barocss-cad-document';
    version: 1;
    profile: 'direct-geometry';
    documentId: string;
    revision: number;
    units: CadDocumentUnits;
    nativeFrame: 'authored-xyz-no-axis-conversion';
    assets: CadDocumentSourceAsset[];
    bodies: CadDocumentBody[];
    features: [];
    parameters: [];
    constraints: [];
    placements: [];
    derivedCaches: [];
}
export interface CadDocumentCompiledAsset {
    assetId: string;
    sourceVersion: 0;
    source: string;
    model: Model;
}
export interface CadDocumentBodyBinding {
    bodyId: string;
    assetId: string;
    geometryId: string;
    geometryKind: 'curve' | 'surface';
}
export interface CadDocumentReport {
    schema: 'barocss-cad-document-report';
    version: 0;
    fileVersion: 1;
    profile: 'direct-geometry';
    sourceVersion: 0;
    units: CadDocumentUnits;
    nativeFrame: 'authored-xyz-no-axis-conversion';
    documentId: string;
    revision: number;
    assetCount: number;
    bodyCount: number;
    nativeObjectCount: number;
    aggregateSourceBytes: number;
    supportedDomains: ['document-identity-revision', 'authored-native-source0-assets', 'qualified-direct-geometry-object-bodies'];
    unsupportedDomains: ['feature-graphs', 'parameters', 'constraints', 'placements', 'derived-caches', 'brep-topology'];
    geometryAuthority: 'authored-native-source-text';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        sourceTextPreserved: true;
        sourceNumericBitsRemainInText: true;
        nativeModels: 'actual-source0-compiler-derived-only';
        referenceSemantics: 'geometry-id-qualified-by-asset-id';
        bodySemantics: 'native-object-reference-not-solid-certificate';
        frameSemantics: 'authored-xyz-no-axis-conversion';
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    limits: {
        maximumAssets: 4;
        maximumBodies: 16;
        maximumRevision: 2147483647;
        maximumSourceBytes: 262144;
        maximumSourceCodeUnits: 262144;
        maximumAggregateSourceBytes: 1048576;
        maximumFileBytes: 2097152;
        maximumFileCodeUnits: 2097152;
        inputValues: 65536;
        inputDepth: 12;
        inputArrayElements: 64;
        inputRecordFields: 16;
        snapshotValues: 262144;
        snapshotDepth: 24;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
        geometryIdCharacters: 128;
        nameBytes: 128;
    };
}
export interface CadDocumentResult {
    document: CadDocumentV1;
    compiledAssets: CadDocumentCompiledAsset[];
    bodyBindings: CadDocumentBodyBinding[];
    report: CadDocumentReport;
}
/** Count UTF-8 bytes without replacing an unpaired UTF-16 surrogate. */
declare function utf8Bytes(text: string, code: CadDocumentDiagnosticCode): number;
/** Adopt authored source text and derive native Models and asset-qualified body bindings. */
export declare function createCadDocument(documentInput: CadDocumentV1): CadDocumentResult;
/** Serialize only the fourteen authored wire fields in their declared order. */
export declare function serializeCadDocument(document: CadDocumentV1): string;
/** Bounded JSON grammar. Object keys are checked after decoding, before assignment. */
declare function parseJson(text: string): unknown;
/** Parse a new document candidate without rewriting its input text or any prior accepted result. */
export declare function parseCadDocument(text: string): CadDocumentResult;
/** Recompile every authoritative asset source and reconstruct all native bindings and report fields. */
export declare function validateCadDocumentResult(input: CadDocumentResult): CadDocumentReport;
export { parseJson as parseCadDocumentOwnJson, utf8Bytes as cadDocumentOwnUtf8Bytes };
