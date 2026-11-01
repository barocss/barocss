export type VoxelPoint = [number, number, number];
/** A scalar field on a grid: node (i, j, k) at o + h(i, j, k), its value phi[(k·n₁ + j)·n₀ + i]. */
export interface VoxelField {
    readonly o: VoxelPoint;
    readonly h: number;
    readonly n: readonly [number, number, number];
    readonly phi: Float64Array;
}
/**
 * Whether each node of the grid (o, h, n) is inside a closed mesh, by the parity of a ray along +X: each row's crossings
 * with the triangles (the row's (y, z) against each triangle's YZ projection, barycentric), sorted, counted below each
 * node. A row through an edge or a vertex is the caller's to avoid (an irrational offset of the grid).
 */
export declare function voxelInsideFlags(positions: ArrayLike<number>, indices: ArrayLike<number>, o: readonly number[], h: number, n: readonly number[]): Uint8Array;
/**
 * Each inside node's depth below the mesh's surface — its distance to the nearest triangle — capped at `cap` (past it a
 * node is as deep as matters); `inside` the flags (`voxelInsideFlags`), outside nodes 0. Through the K2 hierarchy's
 * nearest query bounded by the cap.
 */
export declare function voxelDepth(positions: ArrayLike<number>, indices: ArrayLike<number>, o: readonly number[], h: number, n: readonly number[], cap: number, inside: Uint8Array): Float64Array;
/** The cube's corners by bit (x, y, z), and its six tetrahedra about the diagonal 0 → 7. */
export declare const VOXEL_CORNERS: readonly (readonly [number, number, number])[];
export declare const VOXEL_TETRAHEDRA: readonly (readonly [number, number, number, number])[];
/** A node's position. */
export declare function voxelNode(g: VoxelField, id: number): VoxelPoint;
/**
 * The surface φ = 0 of the region φ > 0 as a closed mesh, outward (towards φ < 0), its vertices shared by grid edge;
 * `edges` each vertex's grid edge (a·N + b, a < b, N the node count) for a later pass that moves it along its edge.
 */
export declare function marchingTetrahedra(g: VoxelField): {
    positions: number[];
    indices: number[];
    edges: Float64Array;
};
