import { type Brep } from '../brep/brep-core.js';
import { type KernelError } from '../core/barocss-error.js';
/** This module's refusal (R7.3a batch 2: the MeshBrepError class folded, D279): a BarocssError, `details.source` 'mesh-brep'. */
export declare const meshBrepError: (message: string) => KernelError & {
    readonly code: "MESH_BREP";
};
/** Whether something thrown is this module's refusal. */
export declare const isMeshBrepError: (e: unknown) => e is KernelError & {
    readonly code: "MESH_BREP";
};
export interface MeshBrepOptions {
    /** The body's id (a letter, then letters, digits, _ or -; also the faces' names' prefix). */
    readonly id?: string;
    /** Corners closer than this (mm) are one vertex; default 1e-6 of the mesh's size. */
    readonly weldDistance?: number;
    /** At most this many triangles (default 200 000). */
    readonly maximumTriangles?: number;
    /** Per input triangle, a group: coplanar triangles join into one face only within a group (brepFromTriangles). */
    readonly groups?: ArrayLike<number>;
    /** Group g's faces' name, in place of `<id>.facet<k>`: the first face so, any further one `#k` (brepFromTriangles). */
    readonly groupName?: (group: number) => string;
}
/** The mesh as an owned native planar B-rep. Returned headers/face list and 4-knot vectors are runtime-fixed;
 * coordinate grids/points remain ordinary arrays. Make a new B-rep to replace a face or its spline header. */
export declare function brepFromTriangles(positions: ArrayLike<number>, indices: ArrayLike<number> | null, options?: MeshBrepOptions): Brep;
/** An STL file's triangles (binary or ASCII) as positions, three vertices per triangle, in the file's units. */
export declare function readStl(bytes: Uint8Array): Float64Array;
/** An OBJ file's faces (polygons fanned into triangles; texture and normal indices ignored) in the file's units. */
export declare function readObj(text: string): {
    positions: number[];
    indices: number[];
};
