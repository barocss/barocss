import type { ConvexPlanarFaceResult, ConvexPlanarFaceUse } from './own-convex-planar-face.js';
import type { Point } from './types.js';
import type { SectionFraction } from './section-rational-internal.js';
import type { ExactPointData } from './convex-planar-solid-proof-internal.js';
export { ConvexPlanarSolidError, ConvexPlanarSolidDiagnosticCode } from './convex-planar-solid-proof-internal.js';
export interface ConvexPlanarSolidAsset {
    sourceId: string;
    face: ConvexPlanarFaceResult;
}
export interface ConvexPlanarSolidUseReference {
    sourceId: string;
    useId: string;
}
export interface ConvexPlanarSolidEdgePair {
    a: ConvexPlanarSolidUseReference;
    b: ConvexPlanarSolidUseReference;
}
export interface ConvexPlanarSolidOptions {
    solidId: string;
    resultIdPrefix: string;
}
export interface ConvexPlanarSolidQueryOptions {
    maximumHalfspacePredicates: number;
}
export interface ConvexPlanarSolidVertexReference {
    sourceId: string;
    faceId: string;
    vertexId: string;
}
export interface ConvexPlanarSolidGraph {
    vertices: {
        id: string;
        pointMM: Point;
        members: ConvexPlanarSolidVertexReference[];
    }[];
    edges: {
        id: string;
        pairIndex: number;
        vertexIds: [string, string];
        uses: {
            sourceId: string;
            faceId: string;
            surfaceId: string;
            loopId: string;
            use: ConvexPlanarFaceUse;
        }[];
        parameterMapAtoB: {
            scale: SectionFraction;
            offset: SectionFraction;
        };
    }[];
    faces: {
        sourceId: string;
        faceId: string;
        surfaceId: string;
        loopId: string;
        vertexIds: string[];
        edgeIds: string[];
    }[];
    vertexLinks: {
        vertexId: string;
        arcs: {
            sourceId: string;
            faceId: string;
            fromEdgeId: string;
            toEdgeId: string;
        }[];
        cycleEdgeIds: string[];
    }[];
}
export interface ConvexPlanarSolidSupport {
    sourceId: string;
    faceId: string;
    surfaceId: string;
    originMM: ExactPointData;
    outwardNormal: ExactPointData;
    offset: SectionFraction;
}
export interface ConvexPlanarSolidCertificate {
    family: 'exact-stored-affine-convex-polyhedron-v0';
    solid: true;
    boundary: 'complete-convex-hull-facets';
    vertexRank: 3;
    volumeMM3: SectionFraction;
    strictInteriorMM: ExactPointData;
    incidence: {
        connected: true;
        oppositeEdgeUses: true;
        vertexLinksSingleCycles: true;
        eulerCharacteristic: 2;
    };
}
export interface ConvexPlanarSolidReport {
    schema: 'barocss-convex-planar-solid';
    version: 0;
    solidId: string;
    lengthUnit: 'mm';
    solid: true;
    faceCount: number;
    edgeCount: number;
    vertexCount: number;
    exactWork: {
        supportPredicates: number;
        coefficientProofs: number;
        fanTriangles: number;
        operations: number;
        gcdSteps: number;
        floatSearchSteps: number;
        floatConversions: number;
        maximumObservedBits: number;
    };
    childNativeWork: {
        completeFaceReconstructionCount: number;
        sourceCompilationCount: number;
        bindingObservationCount: number;
        curveD1Count: number;
        pcurveD1Count: number;
        surfaceD1Count: number;
        totalD1Count: number;
        retries: 0;
        scope: 'direct-calls-and-known-parent-loop-work-not-hidden-provider-internals';
    };
    numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion';
    qualificationScope: 'complete-convex-affine-facets-only-not-general-brep-or-manufacturing-tolerance';
    validationScope: 'whole-result-self-consistency-not-authenticity';
    childReportsUnchanged: true;
    persistentNamingCertified: false;
    limits: {
        faces: 12;
        directedUses: 64;
        pairs: 32;
        vertices: 32;
        supportPredicates: 384;
        coefficientProofs: 64;
        fanTriangles: 40;
        queryPoints: 64;
        queryPredicates: 768;
        rationalOperations: 200000;
        gcdSteps: 200000;
        integerBits: 8192;
        inputValues: 524288;
        resultValues: 786432;
        inputDepth: 24;
        resultDepth: 32;
        arrayElements: 4096;
        recordFields: 64;
        stringCharacters: 262144;
        inputStringCharacters: 4194304;
        resultStringCharacters: 8388608;
        inputBytes: 8388608;
        resultBytes: 16777216;
        cumulativeSnapshotBytes: 50331648;
        retainedInputAndResultBytes: 33554432;
    };
    dataCharge: 'alias-occurrence-counted-serialized-json-utf8-not-v8-heap';
    /** Present only when some stored pcurve pole was not exact and was certified within one chart rounding (CadNumericPolicy). */
    pcurveLift?: {
        policy: 'exact-or-one-rounding-certified-v1';
        certifiedPoles: number;
        maximumDeviationMM: number;
    };
}
export interface ConvexPlanarSolidResult {
    request: {
        assets: ConvexPlanarSolidAsset[];
        edgePairs: ConvexPlanarSolidEdgePair[];
        options: ConvexPlanarSolidOptions;
    };
    graph: ConvexPlanarSolidGraph;
    supports: ConvexPlanarSolidSupport[];
    certificate: ConvexPlanarSolidCertificate;
    report: ConvexPlanarSolidReport;
}
export interface ConvexPlanarSolidPointClassification {
    pointMM: Point;
    classification: 'inside' | 'boundary' | 'outside';
    incidentFaces: {
        sourceId: string;
        faceId: string;
        surfaceId: string;
    }[];
    supportSigns: (-1 | 0 | 1)[];
}
export interface ConvexPlanarSolidPointBatch {
    solidId: string;
    points: ConvexPlanarSolidPointClassification[];
    halfspacePredicateCount: number;
    reconstructionWork: ConvexPlanarSolidReport['childNativeWork'];
    exactWorkIncludingReconstruction: ConvexPlanarSolidReport['exactWork'];
}
/** Exact qualification of complete original convex planar facets; no geometry repair or tolerance sewing. */
export declare function qualifyConvexPlanarSolid(assets: ConvexPlanarSolidAsset[], edgePairs: ConvexPlanarSolidEdgePair[], options: ConvexPlanarSolidOptions): ConvexPlanarSolidResult;
/** Single complete reconstruction establishes owned-data self-consistency, not provenance/authenticity. */
export declare function validateConvexPlanarSolid(input: ConvexPlanarSolidResult): ConvexPlanarSolidReport;
/** One reconstruction and one cumulative exact context for an entire bounded point batch. */
export declare function classifyConvexPlanarSolidPoints(input: ConvexPlanarSolidResult, points: Point[], options: ConvexPlanarSolidQueryOptions): ConvexPlanarSolidPointBatch;
