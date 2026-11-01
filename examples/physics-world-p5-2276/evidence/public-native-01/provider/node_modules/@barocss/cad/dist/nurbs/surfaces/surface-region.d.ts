import type { SurfaceD1Result } from '../../core/derivatives.js';
import type { SurfaceParameterSplitResult } from './surface-parameter-split.js';
import type { Surface, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SurfaceRegionDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly INTERVAL: "INTERVAL";
    readonly IDENTITY: "IDENTITY";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly NATIVE_CAPACITY: "NATIVE_CAPACITY";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type SurfaceRegionDiagnosticCode = typeof SurfaceRegionDiagnosticCode[keyof typeof SurfaceRegionDiagnosticCode];
export declare class SurfaceRegionError extends KernelError {
    readonly code: SurfaceRegionDiagnosticCode;
    constructor(code: SurfaceRegionDiagnosticCode, detail: string, cause?: unknown);
}
export interface SurfaceRegionDomain {
    u: [number, number];
    v: [number, number];
}
export interface SurfaceRegionOptions {
    surfaceId: string;
    uInterval: [number, number];
    vInterval: [number, number];
    resultIdPrefix: string;
}
export type SurfaceRegionD1State = {
    status: 'evaluated';
    value: SurfaceD1Result;
} | {
    status: 'native-refused';
    reason: string;
};
export interface SurfaceRegionBoundaryChoice {
    axis: 'u' | 'v';
    boundary: 'start' | 'end';
    requested: number;
    effective: number;
    origin: 'original-domain-endpoint' | 'interior-request';
    adoptedOriginalEndpointBits: boolean;
}
export interface SurfaceRegionSplitOperation {
    index: number;
    axis: 'u' | 'v';
    boundary: 'start' | 'end';
    retainedSide: 'upper' | 'lower';
    result: SurfaceParameterSplitResult;
}
export interface SurfaceRegionProvenance {
    originalSurfaceId: string;
    outputSurfaceId: string;
    originalDomain: SurfaceRegionDomain;
    requestedDomain: SurfaceRegionDomain;
    effectiveDomain: SurfaceRegionDomain;
    parameterMaps: {
        u: {
            kind: 'identity';
            formula: 'u=s';
            d1Factor: 1;
        };
        v: {
            kind: 'identity';
            formula: 'v=t';
            d1Factor: 1;
        };
    };
    boundaries: SurfaceRegionBoundaryChoice[];
    fullDomainCopy: boolean;
    operations: SurfaceRegionSplitOperation[];
}
export interface SurfaceRegionObservation {
    u: number;
    v: number;
    originalPoint: Point;
    extractedPoint: Point;
    pointDifference: number;
    originalD1: SurfaceRegionD1State;
    extractedD1: SurfaceRegionD1State;
    duDifference: number | null;
    dvDifference: number | null;
}
export interface SurfaceRegionGuardObservation {
    originalU: number;
    originalV: number;
    extractedU: number;
    extractedV: number;
    originalGuardedAxes: ('u' | 'v')[];
    outputLocation: {
        u: 'interior' | 'start-endpoint' | 'end-endpoint';
        v: 'interior' | 'start-endpoint' | 'end-endpoint';
    };
    originalAtOriginalParameters: SurfaceRegionD1State;
    extractedAtRetainedParameters: SurfaceRegionD1State;
}
export interface ExtractedSurfaceRegionReport {
    family: 'own-native-original-parameter-surface-region';
    dto: {
        schema: 'barocss-native-surface-region';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-surface-not-face-topology';
    };
    originalSurfaceId: string;
    surfaceId: string;
    degrees: {
        u: number;
        v: number;
    };
    grids: {
        original: {
            u: number;
            v: number;
            total: number;
        };
        extracted: {
            u: number;
            v: number;
            total: number;
        };
    };
    originalDomain: SurfaceRegionDomain;
    domain: SurfaceRegionDomain;
    operationCount: number;
    uParameters: number[];
    vParameters: number[];
    observations: SurfaceRegionObservation[];
    guards: SurfaceRegionGuardObservation[];
    maximumPointDifference: number;
    maximumRelativeDuDifference: number;
    maximumRelativeDvDifference: number;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        pointComparison: 1e-7;
        relativeD1Comparison: 1e-7;
        localObservationsOnly: true;
        globalShapeErrorCertified: false;
        manufacturingToleranceCertified: false;
        derivativeSemantics: 'combined-native-d1-refusals-and-extracted-endpoints-distinct-no-unaffected-partial-or-g1-g2-claim';
    };
    limits: {
        maximumDegree: 3;
        maximumAxisPoles: 16;
        maximumTotalPoles: 256;
        maximumOperations: 4;
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
export interface ExtractedSurfaceRegionResult {
    original: Surface;
    options: SurfaceRegionOptions;
    surface: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    originalSource: string;
    originalModel: Model;
    provenance: SurfaceRegionProvenance;
    report: ExtractedSurfaceRegionReport;
}
/** Original-parameter tensor region using at most four unchanged native622 split operations. */
export declare function extractSurfaceRegion(surfaceInput: Surface, inputOptions: SurfaceRegionOptions): ExtractedSurfaceRegionResult;
/** Rebuild originals/options and complete genuine native Surface split/source/D1 lineage. */
export declare function validateExtractedSurfaceRegion(input: ExtractedSurfaceRegionResult): ExtractedSurfaceRegionReport;
