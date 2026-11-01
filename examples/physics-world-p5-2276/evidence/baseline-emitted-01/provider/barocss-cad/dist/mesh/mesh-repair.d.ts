import type { Point } from '../types.js';
export interface MeshRepairSteps {
    readonly weld?: boolean;
    readonly degenerate?: boolean;
    readonly fins?: boolean;
    readonly orient?: boolean;
    /**
     * Fill holes; `skip`: the holes (by their number in the diagnosis) left open; `coarseness`: the fill's edge length
     * against its rim's (1, the default: as dense as the rim; 2: half the resolution — a quarter of the triangles).
     */
    readonly fill?: boolean | {
        readonly skip?: readonly number[];
        readonly coarseness?: number;
    };
    /** Drop closed pieces under this share of the largest one's volume (default 0.01; false: keep them). */
    readonly floaters?: false | {
        readonly minFraction: number;
    };
    /** Corners closer than this are one vertex (mm; default 1e-6 of the mesh's size). */
    readonly weldDistance?: number;
}
export declare const DEFAULT_REPAIR: Required<Omit<MeshRepairSteps, 'weldDistance'>>;
export interface MeshHole {
    readonly index: number;
    readonly edges: number;
    readonly perimeter: number;
    readonly centre: Point;
}
export interface MeshDiagnosis {
    readonly triangles: number;
    readonly vertices: number;
    /** Input corners merged by the weld. */
    readonly welded: number;
    readonly degenerate: number;
    readonly duplicates: number;
    /** Edges of more than two triangles. */
    readonly nonManifoldEdges: number;
    /** Two-triangle edges both triangles run the same way (before orienting). */
    readonly inconsistentEdges: number;
    readonly holes: readonly MeshHole[];
    /** Edge-connected pieces (through two-triangle edges), and those that are closed with their volumes. */
    readonly pieces: number;
    readonly pieceVolumes: readonly number[];
    /** Pieces under 1% of the largest volume. */
    readonly floaters: number;
    readonly selfIntersections: number;
    /** Where (up to 64): the midpoint of each crossing pair's centroids. */
    readonly selfIntersectionAt: readonly Point[];
    /** Whether the mesh would import as a closed solid as it is (no hole, no edge of more than two, wound one way). */
    readonly closed: boolean;
}
export interface MeshRepairReport {
    readonly welded: number;
    readonly degenerateRemoved: number;
    readonly duplicatesRemoved: number;
    readonly finsRemoved: number;
    readonly finTriangles: number;
    readonly flipped: number;
    readonly holesFilled: number;
    readonly fillTriangles: number;
    readonly largestFilledPerimeter: number;
    readonly filledArea: number;
    readonly holesLeft: number;
    readonly floatersRemoved: number;
    readonly floaterVolume: number;
    readonly nonManifoldEdgesLeft: number;
    readonly selfIntersections: number;
    /** After repair: closed and manifold (a solid), or open (it imports as a sheet). */
    readonly closed: boolean;
}
export interface MeshRepairResult {
    readonly positions: Float64Array;
    readonly indices: Uint32Array;
    readonly report: MeshRepairReport;
    /** Per output triangle: the fill patch it belongs to (its hole's number), or −1. */
    readonly fill: Int32Array;
}
/** What is wrong with a mesh (nothing changed). */
export declare function diagnoseMesh(positions: ArrayLike<number>, indices: ArrayLike<number> | null, options?: {
    readonly weldDistance?: number;
}): MeshDiagnosis;
/** The mesh repaired by the steps asked (DEFAULT_REPAIR by default), with what each did. */
export declare function repairMesh(positions: ArrayLike<number>, indices: ArrayLike<number> | null, steps?: MeshRepairSteps, progress?: (stage: string) => void): MeshRepairResult;
/**
 * Pairs of triangles that cross (sharing no corner): how many, and up to 64 places (the midpoint of each crossing
 * pair's centroids). Through a uniform grid over the triangles' boxes (a cell about twice a mean edge): a pair is
 * tested once, in the first cell their boxes share.
 */
export declare function selfIntersections(P: Float64Array, I: Uint32Array): {
    count: number;
    at: Point[];
};
