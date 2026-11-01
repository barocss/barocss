import { SolidProof, same } from '../convex-planar-solid-proof-internal.js';
import { KernelError } from '../core/barocss-error.js';
export { SolidProof, same };
export type SlabSubtractionCode = 'INPUT' | 'IDENTITY' | 'BUDGET' | 'NATIVE' | 'OWNED' | 'BINDING' | 'INCIDENCE' | 'DEGENERATE' | 'REPRESENTABILITY' | 'SLAB';
export declare class ConvexPlanarSlabSubtractionError extends KernelError {
    readonly code: SlabSubtractionCode;
    readonly stage: string;
    readonly entity: string;
    constructor(code: SlabSubtractionCode, stage: string, entity: string, detail: string, cause?: unknown);
}
export declare function demand(condition: boolean, code: SlabSubtractionCode, detail: string): asserts condition;
export declare function at<T>(stage: string, entity: string, action: () => T): T;
export declare function fields(value: unknown, keys: string[]): Record<string, unknown>;
export declare function identity(value: unknown, maximum?: number): string;
export declare const SLAB_LIMITS: Readonly<{
    inputBytes: 33554432;
    resultBytes: 67108864;
    cumulativeSnapshotBytes: 201326592;
    retainedSnapshotBytes: 134217728;
    inputValues: 2097152;
    resultValues: 4194304;
    inputDepth: 48;
    resultDepth: 56;
    inputStringCharacters: 16777216;
    resultStringCharacters: 33554432;
    arrayElements: 4096;
    recordFields: 64;
    keyCharacters: 128;
    stringCharacters: 262144;
    facesPerChild: 12;
    edgesPerFace: 8;
    usesPerChild: 64;
    verticesPerChild: 32;
    facetPlanePasses: 48;
    temporaryPolygonVertices: 20;
    classifications: 960;
    crossings: 96;
    candidateRecords: 256;
    coveragePredicates: 320;
    faceCompilations: 72;
    sourceCompilations: 72;
    bindingObservations: 1152;
    totalD1: 3456;
    rationalContexts: 5;
    rationalOperationsPerContext: 200000;
    aggregateRationalOperations: 1000000;
    aggregateGcdSteps: 1000000;
    integerBits: 8192;
}>;
/** Serialized signed-JSON occurrence accounting, not heap telemetry. Child ledgers remain unchanged. */
export declare class SlabSubtractionLedger {
    cumulativeBytes: number;
    retainedBytes: number;
    copy<T>(input: T, result?: boolean, inspectOnly?: boolean, retained?: boolean): T;
}
