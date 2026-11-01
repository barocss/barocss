import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { ConvexPlanarFaceWithHolesResult } from './own-convex-planar-face-holes.js';
import type { Point } from '../types.js';
export interface ConvexHoleMeshVertex {
    index: number;
    nativeVertexId: string;
    loopId: string;
    loopRole: 'outer' | 'inner';
    uv: [number, number];
    surfaceD1: SurfaceD1Result;
    orientedNormal: Point;
    originalPointMM: Point;
    originalSurfaceDifferenceMM: number;
}
export interface ConvexHoleMeshBoundaryPath {
    loopId: string;
    loopRole: 'outer' | 'inner';
    edgeId: string;
    curveId: string;
    useId: string;
    pcurveId: string;
    sense: 'forward' | 'reverse';
    interval: [number, number];
    vertexIndices: [number, number];
    nativeVertexIds: [string, string];
    samples: {
        parameter: number;
        lineD1: CurveD1Result;
        pcurveD1: CurveD1Result;
        surfaceD1: SurfaceD1Result;
        pointDifferenceMM: number;
    }[];
}
export interface ConvexHoleMeshEdgeUse {
    triangleId: string;
    from: number;
    to: number;
}
export interface ConvexHoleMeshTriangulation {
    method: 'maximal-visible-native-vertex-planar-graph';
    bridges: {
        id: string;
        vertexIndices: [number, number];
        nativeVertexIds: [string, string];
    }[];
    internalEdges: {
        id: string;
        vertexIndices: [number, number];
        uses: ConvexHoleMeshEdgeUse[];
    }[];
    triangles: {
        id: string;
        vertexIndices: [number, number, number];
        signedAreaUV: number;
    }[];
    boundaryIncidence: {
        edgeId: string;
        curveId: string;
        loopId: string;
        vertexIndices: [number, number];
        uses: ConvexHoleMeshEdgeUse[];
    }[];
}
export interface ConvexPlanarFaceWithHolesMeshReport {
    family: 'own-native-convex-planar-hole-face-material-mesh';
    faceId: string;
    meshId: string;
    vertexCount: number;
    triangleCount: number;
    boundaryCount: number;
    internalEdgeCount: number;
    bridgeCount: number;
    expectedTriangleCount: number;
    incidenceValid: true;
    materialCoverageObserved: true;
    outerAreaUV: number;
    holeAreasUV: number[];
    materialAreaUV: number;
    triangleAreaUV: number;
    areaDifferenceUV: number;
    areaToleranceUV: number;
    surfaceJacobianMM2: number;
    materialAreaMM2: number;
    triangleAreaMM2: number;
    areaDifferenceMM2: number;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    proof: {
        boundaryOneUse: true;
        internalOppositeUses: true;
        triangleNonoverlap: true;
        holeExclusion: true;
        exactTriangleCount: true;
        guardedUVArea: true;
        noSteinerVertices: true;
    };
    nativeBindingResiduals: {
        maximumVertexSurfaceMM: number;
        maximumBoundaryLineSurfaceMM: number;
    };
    numericPolicy: {
        predicate: 'exact-zero-or-64-epsilon-uncertainty-refusal';
        uvArea: '128-epsilon-scaled-area-sum';
        relativePhysicalArea: 1e-7;
        materialProof: 'original-boundary-visibility-open-hole-halfspaces-and-all-vertex-separating-axes';
        positions: 'actual-original-surface-d1-binary64';
    };
    limits: {
        maximumVertices: 15;
        maximumBoundaries: 15;
        maximumHoles: 2;
        maximumTriangles: 17;
        maximumInternalEdges: 18;
        maximumBridges: 2;
        positions: 45;
        normals: 45;
        parametersUV: 30;
        indices: 51;
        snapshotValues: 131072;
        snapshotDepth: 24;
        arrayElements: 512;
        recordFields: 48;
        sourceStringCharacters: 262144;
    };
}
export interface ConvexPlanarFaceWithHolesMeshResult {
    face: ConvexPlanarFaceWithHolesResult;
    mesh: {
        id: string;
        positionsMM: number[];
        normals: number[];
        parametersUV: number[];
        indices: number[];
        vertices: ConvexHoleMeshVertex[];
    };
    boundaryPaths: ConvexHoleMeshBoundaryPath[];
    triangulation: ConvexHoleMeshTriangulation;
    report: ConvexPlanarFaceWithHolesMeshReport;
}
/** Internal shared UV predicates; original convex-hole admission and numeric operations stay unchanged. */
export declare function createNativeUVGraphPredicates(uv: Point[], check: (condition: boolean, detail: string) => void, label?: string, tick?: () => void): {
    orientation: (a: number, b: number, c: number) => number;
    onSegment: (a: number, b: number, p: number) => boolean;
    compatibleSegments: (a: number, b: number, c: number, d: number) => boolean;
    separatedPolygons: (a: number[], b: number[]) => boolean;
};
/** Native vertices only. Display predicates can refuse an otherwise admitted native face. */
export declare function tessellateConvexPlanarFaceWithHoles(faceInput: ConvexPlanarFaceWithHolesResult): ConvexPlanarFaceWithHolesMeshResult;
/** Rebuild the real parent and every actual native material mesh/path/display role. */
export declare function validateConvexPlanarFaceWithHolesMesh(input: ConvexPlanarFaceWithHolesMeshResult): ConvexPlanarFaceWithHolesMeshReport;
