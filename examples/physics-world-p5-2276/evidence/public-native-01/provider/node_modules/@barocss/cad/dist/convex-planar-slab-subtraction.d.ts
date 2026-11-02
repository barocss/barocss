import type { ConvexPlanarSolidResult, ConvexPlanarSolidReport } from './convex-planar-solid.js';
import type { ExactPointData } from './convex-planar-solid-proof-internal.js';
import type { SectionFraction } from './section-rational-internal.js';
import { SolidProof, SLAB_LIMITS } from './planar-solids/convex-planar-slab-subtraction-internal.js';
export { ConvexPlanarSlabSubtractionError } from './planar-solids/convex-planar-slab-subtraction-internal.js';
export type { SlabSubtractionCode as ConvexPlanarSlabSubtractionDiagnosticCode } from './planar-solids/convex-planar-slab-subtraction-internal.js';
export interface ConvexPlanarSlabFaceReference {
    sourceId: string;
    faceId: string;
}
export interface ConvexPlanarSlabSubtractionOptions {
    operationId: string;
    first: {
        toolFace: ConvexPlanarSlabFaceReference;
        solidId: string;
        resultIdPrefix: string;
    };
    second: {
        toolFace: ConvexPlanarSlabFaceReference;
        solidId: string;
        resultIdPrefix: string;
    };
}
export interface ConvexPlanarSlabSubtractionSource {
    operand: 'parent' | 'tool';
    sourceId: string;
    faceId: string;
    surfaceId: string;
    loopId: string;
}
export interface ConvexPlanarSlabSubtractionNode {
    key: string;
    exactPointMM: ExactPointData;
    supports: ConvexPlanarSlabSubtractionSource[];
}
export interface ConvexPlanarSlabSubtractionEdgeOrigin extends ConvexPlanarSlabSubtractionSource {
    edgeId: string;
    useId: string;
    curveId: string;
    pcurveId: string;
    domain: [number, number];
    sourceInterval: [SectionFraction, SectionFraction];
}
export interface ConvexPlanarSlabSubtractionFace {
    key: string;
    sources: ConvexPlanarSlabSubtractionSource[];
    output: {
        sourceId: string;
        faceId: string;
        surfaceId: string;
        loopId: string;
    };
    edges: {
        useId: string;
        nodeKeys: [string, string];
        originalEdges: ConvexPlanarSlabSubtractionEdgeOrigin[];
        supportingSources: ConvexPlanarSlabSubtractionSource[];
    }[];
}
export type ConvexPlanarSlabSubtractionOutcome = {
    kind: 'solid';
    solid: ConvexPlanarSolidResult;
} | {
    kind: 'empty';
};
export interface ConvexPlanarSlabSubtractionComponent {
    role: 'first' | 'second';
    selectedToolFace: ConvexPlanarSlabSubtractionSource;
    outcome: ConvexPlanarSlabSubtractionOutcome;
    affineDimension: -1 | 0 | 1 | 2 | 3;
    lineage: {
        nodes: ConvexPlanarSlabSubtractionNode[];
        faces: ConvexPlanarSlabSubtractionFace[];
        discardedSources: ConvexPlanarSlabSubtractionSource[];
    };
}
export interface ConvexPlanarSlabSubtractionReport {
    schema: 'barocss-convex-planar-slab-subtraction';
    version: 0;
    operationId: string;
    componentCount: number;
    boundaryProof: 'complete-parent-facets-outside-selected-support-plus-reversed-finite-tool-cap';
    nativeWork: {
        parentReconstructions: 2;
        outputQualifications: number;
        completeFaceReconstructions: number;
        newFaceConstructions: number;
        faceCompilations: number;
        sourceCompilations: number;
        bindingObservations: number;
        totalD1: number;
        retries: 0;
        scope: 'direct-calls-and-known-parent-loops-not-provider-internals';
    };
    clipWork: {
        facetPlanePasses: number;
        classifications: number;
        crossings: number;
        candidateRecords: number;
        maximumPolygonVertices: number;
        temporaryNonDyadicCrossings: number;
        coveragePredicates: number;
    };
    exactWork: {
        root: ReturnType<SolidProof['rational']['counts']>;
        qualifiers: ConvexPlanarSolidReport['exactWork'][];
        contextCount: number;
        aggregateOperations: number;
        aggregateGcdSteps: number;
        maximumObservedBits: number;
    };
    volumeMM3: {
        parent: SectionFraction;
        first: SectionFraction;
        second: SectionFraction;
        remaining: SectionFraction;
        removed: SectionFraction;
    };
    limits: typeof SLAB_LIMITS;
    validationScope: 'whole-result-self-consistency-not-authenticity';
    numericPolicy: 'exact-stored-binary64-native-admission-no-welding';
    persistentNamingCertified: false;
    memoryAccounting: 'root-signed-json-occurrences-plus-unchanged-child-ledgers-not-heap';
}
export interface ConvexPlanarSlabSubtractionResult {
    request: {
        parent: ConvexPlanarSolidResult;
        tool: ConvexPlanarSolidResult;
        options: ConvexPlanarSlabSubtractionOptions;
    };
    first: ConvexPlanarSlabSubtractionComponent;
    second: ConvexPlanarSlabSubtractionComponent;
    materialProof: {
        semantics: 'closure-of-interior-parent-minus-tool';
        selected: [ConvexPlanarSlabSubtractionSource, ConvexPlanarSlabSubtractionSource];
        normalizedFirstNormal: ExactPointData;
        firstOffset: SectionFraction;
        secondOffsetInFirstDirection: SectionFraction;
        positiveOffsetGap: SectionFraction;
        coverage: {
            source: ConvexPlanarSlabSubtractionSource;
            maximumParentSignedDistance: SectionFraction;
        }[];
        equality: 'within-parent-tool-equals-selected-closed-slab';
        separation: 'positive-width-gap-between-fixed-outside-components';
    };
    report: ConvexPlanarSlabSubtractionReport;
}
/** Subtract a positively wide through slab with two caller-selected opposite tool supports. */
export declare function subtractConvexPlanarSlab(parent: ConvexPlanarSolidResult, tool: ConvexPlanarSolidResult, options: ConvexPlanarSlabSubtractionOptions): ConvexPlanarSlabSubtractionResult;
/** Reconstruct complete operands, both fixed outcomes, material proof, lineage and work once. */
export declare function validateConvexPlanarSlabSubtraction(input: ConvexPlanarSlabSubtractionResult): ConvexPlanarSlabSubtractionReport;
