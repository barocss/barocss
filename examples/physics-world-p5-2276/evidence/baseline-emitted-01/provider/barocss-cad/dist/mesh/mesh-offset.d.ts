export interface MeshShellReport {
    /** The wall asked for (mm). */
    readonly wall: number;
    /** The wall the offset achieves: the least and largest distance from it to the mesh's surface (mm). */
    readonly wallMin: number;
    readonly wallMax: number;
    /** Triangles of the cavity (the mesh's own). */
    readonly triangles: number;
}
/**
 * The inner offset of a closed, outward-wound mesh (positions P, triangles I) by t: its points on the same triangles,
 * and the wall it achieves.
 */
export declare function meshInnerOffset(P: Float64Array, I: Uint32Array, t: number): {
    positions: Float64Array;
    report: MeshShellReport;
};
