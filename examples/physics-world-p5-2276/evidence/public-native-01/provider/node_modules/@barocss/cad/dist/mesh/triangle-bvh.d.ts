/** The hierarchy and its mesh. Per node: its box [x0, y0, z0, x1, y1, z1]; its first child (the second is next), or −1 for a leaf; a leaf's triangles order[start, start + count). */
export interface TriangleBvh {
    readonly positions: Float64Array;
    readonly indices: Uint32Array;
    readonly box: Float64Array;
    readonly left: Int32Array;
    readonly start: Int32Array;
    readonly count: Int32Array;
    readonly order: Uint32Array;
    readonly nodes: number;
    /** The largest coordinate's magnitude (at least 1): a scale for tolerances. */
    readonly size: number;
}
export interface TriangleBvhOptions {
    readonly leafSize?: number;
}
/** The hierarchy over a mesh's triangles. Typed arrays are taken as they are (a Float64Array and a Uint32Array are not copied). */
export declare function triangleBvh(positions: ArrayLike<number>, indices: ArrayLike<number>, options?: TriangleBvhOptions): TriangleBvh;
/**
 * The nearest crossing of the ray o + t·d with the mesh beyond `minT` (default 1e-6, in d's lengths; Möller–Trumbore; a triangle whose determinant is
 * within `detTol` of zero — the ray in its plane — is passed), skipping triangle `skip`; Infinity when there is none.
 * Hits on a triangle's edges count. `d` need not be unit: t is in its lengths.
 */
export declare function rayHit(bvh: TriangleBvh, o: ArrayLike<number>, d: ArrayLike<number>, minT?: number, skip?: number, detTol?: number): number;
/** The squared distance from a point to the mesh's surface, when less than `bound2` (else `bound2`): branch and bound, the nearer child first. */
export declare function nearestDistance2(bvh: TriangleBvh, x: number, y: number, z: number, bound2?: number): number;
/** The squared distance from a point to triangle k of a mesh (the closest point by its Voronoi regions, Ericson 5.1.5). */
export declare function pointTriangleDistance2(P: ArrayLike<number>, I: ArrayLike<number>, k: number, px: number, py: number, pz: number): number;
/** The point of triangle abc nearest p (Ericson 5.1.5's regions; K4), written into `out` (by default a new one). */
export declare function closestPointOnTriangle(p: ArrayLike<number>, a: ArrayLike<number>, b: ArrayLike<number>, c: ArrayLike<number>, out?: [number, number, number]): [number, number, number];
