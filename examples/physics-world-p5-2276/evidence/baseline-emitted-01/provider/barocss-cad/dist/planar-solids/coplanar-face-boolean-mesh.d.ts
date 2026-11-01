import type { CoplanarFaceBooleanResult, CoplanarFaceBooleanContributor } from './coplanar-face-boolean.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const CoplanarFaceBooleanMeshDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly UNCERTAINTY: "UNCERTAINTY";
    readonly TRIANGULATION: "TRIANGULATION";
    readonly INCIDENCE: "INCIDENCE";
    readonly COVERAGE: "COVERAGE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CoplanarFaceBooleanMeshDiagnosticCode = typeof CoplanarFaceBooleanMeshDiagnosticCode[keyof typeof CoplanarFaceBooleanMeshDiagnosticCode];
export declare class CoplanarFaceBooleanMeshError extends KernelError {
    readonly code: CoplanarFaceBooleanMeshDiagnosticCode;
    constructor(code: CoplanarFaceBooleanMeshDiagnosticCode, detail: string, cause?: unknown);
}
export interface CoplanarFaceBooleanMeshOptions {
    meshId: string;
    maximumVertices: number;
    maximumTriangles: number;
    maximumCandidatePairs: number;
    maximumPredicateTests: number;
    maximumTriangleTests: number;
}
export interface CoplanarFaceBooleanMeshVertex {
    index: number;
    nativeVertexId: string;
    componentId: string;
    loopId: string;
    loopRole: 'outer' | 'hole';
    uv: [number, number];
    surfaceD1: SurfaceD1Result;
    orientedNormal: Point;
    originalPointMM: Point;
    originalSurfaceDifferenceMM: number;
}
export interface CoplanarFaceBooleanMeshBoundaryPath {
    componentId: string;
    loopId: string;
    loopRole: 'outer' | 'hole';
    fragmentId: string;
    edgeId: string;
    useId: string;
    curveId: string;
    pcurveId: string;
    contributor: CoplanarFaceBooleanContributor;
    source: {
        assetId: string;
        curveId: string;
        objectIndex: number;
    };
    sense: 'forward' | 'reverse';
    interval: [number, number];
    nativeInterval: [number, number];
    vertexIndices: [number, number];
    nativeVertexIds: [string, string];
    samples: {
        parameter: number;
        originalLineD1: CurveD1Result;
        lineD1: CurveD1Result;
        pcurveD1: CurveD1Result;
        surfaceD1: SurfaceD1Result;
        pointDifferenceMM: number;
        originalPointDifferenceMM: number;
        relativeD1Difference: number;
        relativeSurfaceD1Difference: number;
        meshEndpointDifferenceMM: number | null;
    }[];
}
export interface CoplanarFaceBooleanMeshEdgeUse {
    triangleId: string;
    from: number;
    to: number;
}
export interface CoplanarFaceBooleanMeshTriangulation {
    method: 'maximal-visible-native-vertex-planar-graph';
    bridges: {
        id: string;
        componentId: string;
        kind: 'display-internal-bridge';
        vertexIndices: [number, number];
        nativeVertexIds: [string, string];
    }[];
    internalEdges: {
        id: string;
        componentId: string;
        kind: 'display-internal-bridge' | 'display-internal-diagonal';
        vertexIndices: [number, number];
        uses: CoplanarFaceBooleanMeshEdgeUse[];
    }[];
    triangles: {
        id: string;
        componentId: string;
        vertexIndices: [number, number, number];
        signedAreaUV: number;
        centroidUV: [number, number];
        centroidInMaterial: true;
        areaMM2: number;
    }[];
    boundaryIncidence: {
        componentId: string;
        loopId: string;
        fragmentId: string;
        edgeId: string;
        useId: string;
        curveId: string;
        vertexIndices: [number, number];
        uses: CoplanarFaceBooleanMeshEdgeUse[];
    }[];
    components: {
        componentId: string;
        outerLoopId: string;
        holeLoopIds: string[];
        vertexIndices: number[];
        triangleIds: string[];
        expectedTriangleCount: number;
        expectedInternalEdgeCount: number;
        expectedBridgeCount: number;
        triangleCount: number;
        internalEdgeCount: number;
        bridgeCount: number;
        materialAreaUV: number;
        triangleAreaUV: number;
        areaDifferenceUV: number;
        areaToleranceUV: number;
        surfaceJacobianMM2: number;
        materialAreaMM2: number;
        triangleAreaMM2: number;
        areaDifferenceMM2: number;
    }[];
}
export interface CoplanarFaceBooleanMeshReport {
    schema: 'barocss-native-coplanar-face-boolean-mesh';
    version: 0;
    meshId: string;
    evaluationId: string;
    supportId: string;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    uvUnits: 'dimensionless';
    vertexCount: number;
    triangleCount: number;
    boundaryCount: number;
    loopCount: number;
    componentCount: number;
    holeCount: number;
    internalEdgeCount: number;
    bridgeCount: number;
    expectedTriangleCount: number;
    expectedInternalEdgeCount: number;
    candidatePairCount: number;
    predicateTestCount: number;
    triangleTestCount: number;
    vertexTripleTestCount: number;
    trianglePairTestCount: number;
    surfaceD1EvaluationCount: number;
    curveD1EvaluationCount: number;
    materialAreaUV: number;
    triangleAreaUV: number;
    areaDifferenceUV: number;
    areaToleranceUV: number;
    surfaceJacobianMM2: number | null;
    materialAreaMM2: number;
    triangleAreaMM2: number;
    areaDifferenceMM2: number;
    incidenceValid: true;
    materialCoverageObserved: true;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    proof: {
        boundaryOneDirectedUse: true;
        internalOppositeUses: true;
        triangleNonoverlap: true;
        holeExclusion: true;
        exactComponentTriangleCounts: true;
        guardedUVArea: true;
        noSteinerVertices: true;
        allComponentsPreserved: true;
    };
    nativeBindingResiduals: {
        maximumVertexSurfaceMM: number;
        maximumBoundaryLineSurfaceMM: number;
        maximumBoundaryMeshEndpointMM: number;
        maximumBoundaryRelativeD1: number;
    };
    numericPolicy: {
        predicate: 'exact-zero-or-64-epsilon-uncertainty-refusal';
        uvArea: '128-epsilon-scaled-area-sum-or-parent-area-uncertainty';
        relativePhysicalArea: 1e-7;
        materialProof: 'strict-general-native-loop-winding-visible-graph-all-vertex-triangles-and-separating-axes';
        positions: 'actual-original-support-d1-binary64';
        empty: 'zero-arrays-null-bounds-no-native-d1-calls';
    };
    quality: {
        representation: 'derived-raw-xyz-planar-material-preview-not-native-surface-or-preview-packet0';
        nativeRegionBitsPreserved: true;
        workScope: 'new-material-graph-and-mesh-bindings-excludes-native-parent-reconstruction';
        worldBoundary: 'actual-unsnapped-extracted-native-fragments-only';
        internalEdges: 'derived-display-diagonals-and-bridges-not-cad-boundaries';
        uvAreaIsManufacturingArea: false;
        globalTriangulationCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        rendererCapacityCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-mesh';
    limits: {
        maximumVertices: 64;
        maximumTriangles: 80;
        maximumCandidatePairs: 2016;
        maximumPredicateTests: 2000000;
        maximumTriangleTests: 50000;
        maximumInternalEdges: 88;
        maximumBridges: 8;
        maximumComponents: 8;
        maximumLoops: 16;
        maximumHoles: 8;
        ownValues: 1048576;
        ownDepth: 40;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
        meshIdCharacters: 20;
        pointComparisonMM: 1e-7;
        relativeD1Comparison: 1e-7;
    };
}
export interface CoplanarFaceBooleanMeshResult {
    region: CoplanarFaceBooleanResult;
    options: CoplanarFaceBooleanMeshOptions;
    mesh: {
        id: string;
        binding: {
            evaluationId: string;
            supportId: string;
            a: {
                faceId: string;
                evaluationId: string;
                supportId: string;
            };
            b: {
                faceId: string;
                evaluationId: string;
                supportId: string;
            };
            sourceAssetIds: string[];
        };
        positionsMM: number[];
        normals: number[];
        parametersUV: number[];
        indices: number[];
        boundsMM: {
            min: Point;
            max: Point;
        } | null;
        vertices: CoplanarFaceBooleanMeshVertex[];
    };
    boundaryPaths: CoplanarFaceBooleanMeshBoundaryPath[];
    triangulation: CoplanarFaceBooleanMeshTriangulation;
    report: CoplanarFaceBooleanMeshReport;
}
/** Filled derived material mesh; original Boolean coefficients and unsnapped boundary Curves remain native authority. */
export declare function tessellateCoplanarFaceBoolean(regionInput: CoplanarFaceBooleanResult, optionsInput: CoplanarFaceBooleanMeshOptions): CoplanarFaceBooleanMeshResult;
/** Reconstruct the native parent and the entire derived graph, mesh, boundary observations and work report. */
export declare function validateCoplanarFaceBooleanMesh(input: CoplanarFaceBooleanMeshResult): CoplanarFaceBooleanMeshReport;
