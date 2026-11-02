export interface Cage {
    readonly positions: readonly number[];
    readonly faces: readonly (readonly number[])[];
    readonly creases?: readonly (readonly [number, number])[];
}
/** The cage's half-edges and edges: each directed side of a face, each undirected edge with its faces (in order of the faces). */
export interface CageTopology {
    /** `${a}>${b}` → [face, side]: face's side `side` runs a → b. */
    readonly half: ReadonlyMap<string, readonly [number, number]>;
    /** undirected edge → its vertices and the faces using it. */
    readonly edges: ReadonlyMap<string, {
        readonly a: number;
        readonly b: number;
        readonly faces: readonly number[];
    }>;
    /** per vertex: its faces, and its edges' other ends. */
    readonly vertexFaces: readonly (readonly number[])[];
    readonly neighbours: readonly (readonly number[])[];
}
export declare function cageTopology(c: Cage): CageTopology;
export interface CageValidation {
    readonly valid: boolean;
    /** Edges with more than two faces, or used twice the same way (faces wound against each other). */
    readonly nonManifoldEdges: readonly [number, number][];
    /** Vertices whose faces are not one fan (a bowtie). */
    readonly nonManifoldVertices: readonly number[];
    /** Inside vertices not of valence 4 (extraordinary: caps there, R7), and boundary ones not of 3 (or 2 at a corner). */
    readonly poles: readonly {
        readonly vertex: number;
        readonly valence: number;
    }[];
    /** Faces that are not quads (refined once more, R7). */
    readonly ngons: readonly number[];
    /** Edges with one face. */
    readonly boundaryEdges: readonly [number, number][];
    /** Vertices where a crease ends inside the surface. */
    readonly darts: readonly number[];
    /** Vertices no face uses. */
    readonly unused: readonly number[];
}
export declare function validateCage(c: Cage): CageValidation;
/**
 * The edge loop through edge a–b: from each end on through the edge opposite at a valence-4 vertex (all quads round
 * it), stopping at any other vertex, a boundary or the start (closed). Edges as [from, to] in the loop's order.
 */
export declare function edgeLoop(c: Cage, a: number, b: number): [number, number][];
/** The edge ring through a–b: across each quad to its opposite edge, on into the next face, stopping at a non-quad, a boundary or the start. Edges oriented alike (their first ends on one side). */
export declare function edgeRing(c: Cage, a: number, b: number): [number, number][];
/** The vertices moved by `delta` (a mirror plane's own vertices kept on it: see mirror). */
export declare function moveVertices(c: Cage, vertices: readonly number[], delta: readonly number[]): Cage;
/** The vertices of a selection of vertices, edges ([a, b]) and faces. */
export declare function selectionVertices(c: Cage, sel: {
    vertices?: readonly number[];
    edges?: readonly (readonly [number, number])[];
    faces?: readonly number[];
}): number[];
/**
 * The faces extruded as one region: their vertices copied and moved `distance` along the region's normal there, the
 * faces moved onto the copies, and a side quad along every border edge of the region (an edge with no other region
 * face; `noWall`: none along such boundary edges). Returns the cage and the new faces' indices (the region, now at the copies).
 */
export declare function extrudeFaces(c: Cage, faces: readonly number[], distance?: number, noWall?: (a: number, b: number) => boolean): {
    cage: Cage;
    faces: number[];
    vertices: number[];
};
/** Boundary edges extruded: each [a, b] (a face's side, no face across) gets a new quad out to a + delta, b + delta (shared along a chain). */
export declare function extrudeEdges(c: Cage, edges: readonly (readonly [number, number])[], delta: readonly number[]): {
    cage: Cage;
    vertices: number[];
};
/** An edge loop inserted across the ring through a–b, at t along each ring edge (0 at its first end): each quad of the ring split in two; a face at a ring's open end gains the point (it becomes an n-gon). */
export declare function insertEdgeLoop(c: Cage, a: number, b: number, t?: number): {
    cage: Cage;
    vertices: number[];
};
/** The faces removed, and the vertices no face uses any more (renumbered; creases kept where their edges are). */
export declare function deleteFaces(c: Cage, faces: readonly number[]): Cage;
/** Vertices no face uses dropped and the rest renumbered; creases on edges no face has any more dropped. */
export declare function compact(c: Cage): Cage;
/** A boundary's edges in order round a hole (or along an open chain), each as its face runs it: [v0, v1, …]. */
export declare function boundaryLoop(c: Cage, edges: readonly (readonly [number, number])[]): {
    vertices: number[];
    closed: boolean;
};
/** A hole filled by one face (an n-gon: R7 refines it), run against its boundary. */
export declare function fillHole(c: Cage, edges: readonly (readonly [number, number])[]): Cage;
/**
 * Two boundary loops (or chains) of as many edges bridged by quads. A loop is paired with the other turned the
 * opposite way (each quad meets both as a twin) at the offset that keeps the bridge shortest.
 */
export declare function bridge(c: Cage, edgesA: readonly (readonly [number, number])[], edgesB: readonly (readonly [number, number])[]): Cage;
/** The vertices merged into their centroid; faces losing a side keep the rest (one left with fewer than 3 is removed). Refused when the result is not a manifold. */
export declare function weldVertices(c: Cage, vertices: readonly number[]): Cage;
/** Vertices within `tolerance` of each other welded, group by group (e.g. two loops brought together). */
export declare function weldWithin(c: Cage, vertices: readonly number[], tolerance: number): Cage;
/** Edges made infinitely sharp (on) or smooth again (off). */
export declare function setCreases(c: Cage, edges: readonly (readonly [number, number])[], on: boolean): Cage;
export type MirrorAxis = 'x' | 'y' | 'z';
/**
 * The full cage from one half and a mirror plane through the origin across `axis`: the half's vertices on the plane
 * (within `tolerance`) shared, the rest copied across, the copied faces wound back; creases copied. A face lying in
 * the plane is refused (it would be doubled).
 */
export declare function mirrorCage(half: Cage, axis: MirrorAxis, tolerance?: number): Cage;
/**
 * One side of a cage (`side` 1: the positive, −1: the negative) for mirroring across `axis`: the faces with every
 * vertex on that side or on the plane, the plane's vertices snapped onto it. Refused when a face crosses the plane (an
 * edge loop on it first), or when nothing is on that side.
 */
export declare function halfCage(c: Cage, axis: MirrorAxis, side?: 1 | -1, tolerance?: number): Cage;
/** The half's vertices on the mirror plane put back on it exactly (after a move): they must stay there for the halves to meet. */
export declare function keepOnPlane(c: Cage, axis: MirrorAxis, onPlane: readonly number[]): Cage;
/**
 * The cage refined `levels` times by Catmull–Clark (any polygons, sharp rules) and each vertex taken to its limit
 * position: a triangle mesh near the limit surface, cheap enough to redraw while a cage is dragged. The exact B-rep
 * (subdBrep) is built when the drag ends.
 */
export declare function subdPreviewMesh(c: Cage, levels?: number): {
    positions: Float64Array;
    indices: Uint32Array;
    normals: Float64Array;
};
