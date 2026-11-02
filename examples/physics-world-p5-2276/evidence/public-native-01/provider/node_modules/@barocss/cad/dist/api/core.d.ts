import { type CadPartDocument, type CadPartOutput } from '../part/part-model.js';
import { type BodyQuery } from './select.js';
export type { Vec3 } from './select.js';
import type { Vec3 } from './select.js';
/** A body's mass properties at a density, in MMGS (api-conventions.md §2): mm³, g, mm, and g·mm² about the centre of mass. */
export interface MassResult {
    volume: number;
    mass: number;
    centroid: Vec3;
    inertia: number[][];
}
/** A body's display triangles in the common mesh shape (api-conventions.md §10.3): mm, Z up — what gpu's GeometryInput takes. */
export interface MeshData {
    key: string;
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    /** Its display lines (the edges a person sees) as segment pairs, x, y, z each end — gpu's line geometry (R7.5b). */
    lines?: Float32Array;
    /** The material id its body names (cad-model: the body's own, else the brief's), for gpu's scene materials (§10.6). */
    material?: string;
}
/** The document's outputs (the parts no later feature consumes), or the kernel's refusal. */
export declare function outputsOf(doc: CadPartDocument): readonly CadPartOutput[];
/** An output's mass properties at a density (g/cm³). */
export declare function massOf(output: CadPartOutput, density: number): MassResult;
/** The outputs as one STEP AP214 file: one through its own export, several as the kernel writes a list of bodies. */
export declare function stepOf(outputs: readonly CadPartOutput[], name: string): string;
/** An output as binary STL (its display tessellation). */
export declare function stlOf(output: CadPartOutput): Uint8Array;
/** An output's display triangles, from the kernel's tessellation (its Float64 positions and normals as the common shape's Float32). */
export declare function meshOf(output: CadPartOutput): MeshData;
/** An output's edges and faces, to select from. */
export declare function selectionOf(output: CadPartOutput): BodyQuery;
