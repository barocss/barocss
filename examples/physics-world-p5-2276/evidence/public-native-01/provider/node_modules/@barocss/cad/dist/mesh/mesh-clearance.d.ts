import { type TriangleBvh } from './triangle-bvh.js';
export interface MeshClearance {
    /** The least distance between the two surfaces, mm (0 when they touch or cross; Infinity when either has no triangle). */
    readonly distance: number;
    /** The closest points, on A and on B (equal where they cross); null when either has no triangle. */
    readonly pointA: readonly [number, number, number] | null;
    readonly pointB: readonly [number, number, number] | null;
    /** The two triangles they lie on (indices into each mesh), or −1. */
    readonly triangleA: number;
    readonly triangleB: number;
}
export interface MeshClearanceOptions {
    /** Prebuilt hierarchies of the two meshes (`triangleBvh` of the same positions and indices), to reuse. */
    readonly bvhA?: TriangleBvh;
    readonly bvhB?: TriangleBvh;
}
/** The least distance between two meshes' surfaces (squared internally; exact up to rounding), with the closest points. */
export declare function meshClearance(pa: ArrayLike<number>, ia: ArrayLike<number>, pb: ArrayLike<number>, ib: ArrayLike<number>, options?: MeshClearanceOptions): MeshClearance;
