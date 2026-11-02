import type { CoplanarFaceBooleanExtrusionResult } from './coplanar-face-boolean-extrusion.js';
import type { CoplanarFaceBooleanMeshResult } from './coplanar-face-boolean-mesh.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const CoplanarFaceBooleanExtrusionMeshDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly INCIDENCE: "INCIDENCE";
    readonly COVERAGE: "COVERAGE";
    readonly OWNED: "OWNED";
}>;
export type CoplanarFaceBooleanExtrusionMeshDiagnosticCode = typeof CoplanarFaceBooleanExtrusionMeshDiagnosticCode[keyof typeof CoplanarFaceBooleanExtrusionMeshDiagnosticCode];
export declare class CoplanarFaceBooleanExtrusionMeshError extends KernelError {
    readonly code: CoplanarFaceBooleanExtrusionMeshDiagnosticCode;
    constructor(code: CoplanarFaceBooleanExtrusionMeshDiagnosticCode, detail: string, cause?: unknown);
}
export interface CoplanarFaceBooleanExtrusionMeshOptions {
    meshId: string;
    maximumVertices: number;
    maximumTriangles: number;
    maximumEdgePaths: number;
    maximumNativeSamples: number;
}
type SourcePointer = CoplanarFaceBooleanExtrusionResult['edges'][number]['source'];
type TriangleUse = {
    triangleId: string;
    from: number;
    to: number;
};
export interface CoplanarFaceBooleanExtrusionMeshVertex {
    index: number;
    faceId: string;
    shellId: string;
    componentId: string;
    nativeVertexId: string;
    regionVertexId: string;
    regionMeshVertexIndex: number | null;
    surfaceId: string;
    source: SourcePointer;
    uv: [number, number];
    surfaceD1: SurfaceD1Result;
    orientedNormal: Point;
    canonicalPointMM: Point;
    pointDifferenceMM: number;
}
export interface CoplanarFaceBooleanExtrusionMeshFaceRange {
    faceId: string;
    shellId: string;
    componentId: string;
    kind: 'bottom-cap' | 'top-cap' | 'wall';
    orientation: 'forward' | 'reverse';
    surfaceId: string;
    source: SourcePointer;
    vertexStart: number;
    vertexCount: number;
    indexStart: number;
    indexCount: number;
    triangleStart: number;
    triangleCount: number;
    triangles: {
        id: string;
        vertexIndices: [number, number, number];
        regionMeshTriangleId: string | null;
        indexStart: number;
        areaMM2: number;
        minimumNormalDot: number;
    }[];
    loops: {
        loopId: string;
        role: 'outer' | 'hole';
        nativeLoopId: string | null;
        effectiveUseIds: string[];
        uses: {
            useId: string;
            edgeId: string;
            curveId: string;
            pcurveId: string;
            edgeSense: 'forward' | 'reverse';
            effectiveSense: 'forward' | 'reverse';
            localVertexIds: [string, string];
            effectiveVertexIds: [string, string];
            localVertexIndices: [number, number];
            effectiveVertexIndices: [number, number];
            interval: [number, number];
            effectiveInterval: [number, number];
        }[];
    }[];
    boundaryIncidence: {
        loopId: string;
        useId: string;
        edgeId: string;
        curveId: string;
        pcurveId: string;
        effectiveSense: 'forward' | 'reverse';
        vertexIndices: [number, number];
        triangleUses: TriangleUse[];
    }[];
    internalEdges: {
        id: string;
        kind: 'display-cap-bridge' | 'display-cap-diagonal' | 'display-wall-diagonal';
        regionMeshEdgeId: string | null;
        vertexIndices: [number, number];
        triangleUses: TriangleUse[];
    }[];
    wallCenterObservation: {
        u: number;
        v: number;
        surfaceD1: SurfaceD1Result;
        orientedNormal: Point;
        trianglePlaneDistancesMM: [number, number];
        minimumTrianglePlaneDistanceMM: number;
        minimumNormalDot: number;
    } | null;
}
export interface CoplanarFaceBooleanExtrusionMeshEdgePath {
    edgeId: string;
    shellId: string;
    componentId: string;
    kind: 'bottom' | 'top' | 'vertical';
    curveId: string;
    source: SourcePointer;
    interval: [number, number];
    nativeVertexIds: [string, string];
    nativeFragmentId: string | null;
    nativeVertexId: string | null;
    samples: {
        parameter: number;
        curveD1: CurveD1Result;
    }[];
    adjacentFaces: {
        faceId: string;
        loopId: string;
        useId: string;
        pcurveId: string;
        effectiveSense: 'forward' | 'reverse';
        vertexIndices: [number, number];
        endpointDifferencesMM: [number, number];
        triangleUses: TriangleUse[];
    }[];
}
export interface CoplanarFaceBooleanExtrusionMeshShellRange {
    shellId: string;
    componentId: string;
    nativeFaceIds: string[];
    nativeEdgeIds: string[];
    nativeVertexIds: string[];
    holeLoopIds: string[];
    faceRangeIndices: number[];
    edgePathIndices: number[];
    vertexCount: number;
    triangleCount: number;
    edgePathCount: number;
    solid: false;
}
export interface CoplanarFaceBooleanExtrusionMeshReport {
    schema: 'barocss-native-coplanar-face-boolean-extrusion-mesh';
    version: 0;
    meshId: string;
    extrusionEvaluationId: string;
    booleanEvaluationId: string;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    uvUnits: 'dimensionless-per-face-native-parameters';
    empty: boolean;
    nativeVertexCount: number;
    nativeFragmentCount: number;
    componentCount: number;
    holeCount: number;
    vertexCount: number;
    triangleCount: number;
    edgePathCount: number;
    faceRangeCount: number;
    shellRangeCount: number;
    internalEdgeCount: number;
    expectedVertexCount: number;
    expectedTriangleCount: number;
    expectedEdgePathCount: number;
    wrapperWork: {
        nativeSampleCount: number;
        surfaceD1EvaluationCount: number;
        faceVertexSurfaceD1EvaluationCount: number;
        wallCenterSurfaceD1EvaluationCount: number;
        curveD1EvaluationCount: number;
        edgePathCurveD1EvaluationCount: number;
    };
    regionMeshWork: {
        surfaceD1EvaluationCount: number;
        curveD1EvaluationCount: number;
        candidatePairCount: number;
        predicateTestCount: number;
        vertexTripleTestCount: number;
        trianglePairTestCount: number;
        triangleTestCount: number;
    };
    maximumVertexDifferenceMM: number;
    maximumPathEndpointDifferenceMM: number;
    maximumWallCenterPlaneDifferenceMM: number;
    incidenceValid: true;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        geometryAuthority: 'unchanged-native-extrusion-curves-surfaces-trims-and-source0';
        capConnectivity: 'actual-owned-native-region-mesh';
        positions: 'actual-derived-cap-and-wall-surface-d1-no-display-top-translation';
        normals: 'per-face-hard-native-outward-normals';
        truePaths: 'actual-global-native-edges-with-both-adjacent-face-endpoints';
        internalEdges: 'display-only-cap-diagonals-bridges-and-wall-diagonals';
        boundsAuthority: 'actual-display-positions-not-certified-native-geometry-bounds';
        workScope: 'new-wrapper-native-samples-separate-from-region-mesh-work-and-parent-reconstruction';
        nativeInverseCertified: false;
        exactSewingCertified: false;
        globalManifoldCertified: false;
        globalShapeErrorCertified: false;
        manufacturingToleranceCertified: false;
        rendererCapacityCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-filled-mesh';
    limits: {
        maximumVertices: 384;
        maximumTriangles: 288;
        maximumEdgePaths: 192;
        maximumNativeSamples: 1024;
        maximumFaceRanges: 80;
        maximumShellRanges: 8;
        ownValues: 1048576;
        ownDepth: 40;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
        meshIdCharacters: 12;
        pointComparisonMM: 1e-7;
    };
}
export interface CoplanarFaceBooleanExtrusionMeshResult {
    extrusion: CoplanarFaceBooleanExtrusionResult;
    options: CoplanarFaceBooleanExtrusionMeshOptions;
    regionMesh: CoplanarFaceBooleanMeshResult;
    mesh: {
        id: string;
        binding: {
            extrusionEvaluationId: string;
            booleanEvaluationId: string;
            nativeShellIds: string[];
            sourceAssetIds: string[];
            regionMeshId: string;
        };
        positionsMM: number[];
        normals: number[];
        parametersUV: number[];
        indices: number[];
        vertices: CoplanarFaceBooleanExtrusionMeshVertex[];
        boundsMM: {
            min: Point;
            max: Point;
        } | null;
    };
    faceRanges: CoplanarFaceBooleanExtrusionMeshFaceRange[];
    edgePaths: CoplanarFaceBooleanExtrusionMeshEdgePath[];
    shellRanges: CoplanarFaceBooleanExtrusionMeshShellRange[];
    report: CoplanarFaceBooleanExtrusionMeshReport;
}
/** Filled face-local display vertices retain native hard normals and every true paired edge path. */
export declare function tessellateCoplanarFaceBooleanExtrusion(extrusionInput: CoplanarFaceBooleanExtrusionResult, optionsInput: CoplanarFaceBooleanExtrusionMeshOptions): CoplanarFaceBooleanExtrusionMeshResult;
/** Full reconstruction includes native parent, actual reused cap graph, face-local ranges and both edge bindings. */
export declare function validateCoplanarFaceBooleanExtrusionMesh(input: CoplanarFaceBooleanExtrusionMeshResult): CoplanarFaceBooleanExtrusionMeshReport;
export {};
