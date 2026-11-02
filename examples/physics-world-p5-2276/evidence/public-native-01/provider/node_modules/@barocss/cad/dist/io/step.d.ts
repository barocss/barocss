import { type Brep } from '../brep/brep-core.js';
export interface StepExportOptions {
    /** The product's name (and the file name in the header). */
    readonly name?: string;
    /** ISO 8601 time stamp for the header (default: now). */
    readonly timestamp?: string;
    /** The header's FILE_DESCRIPTION entries (default: 'BaroCSS CAD part'); the studio adds its source revision (O9). */
    readonly description?: readonly string[];
    /**
     * CAx-IF geometric validation properties of the part (volume, surface area, centroid, and a bounding box):
     * written by default, so a reader can check what it imported; false leaves them out (no mass computed).
     */
    readonly validationProperties?: boolean;
    /**
     * How a mesh body (facet faces) is written (R3.5, D48). 'tessellated': AP242 triangulated faces — compact, read by
     * current systems; 'planar': its triangles as planar B-rep faces (merged where flat) — read by any STEP reader,
     * but large; 'auto' (default): planar up to MESH_PLANAR_TRIANGLES triangles a body, tessellated above. An open
     * mesh (a sheet) is always tessellated: it has no planar solid.
     */
    readonly meshes?: 'auto' | 'tessellated' | 'planar';
}
/**
 * Mesh bodies up to this many triangles are written as planar faces under 'auto': readable by every STEP reader,
 * and still small (measured: about 1 kB a triangle as planar faces against 0.05 kB tessellated — 194 MB against
 * 9.4 MB at 200k — so 5k triangles is some 5 MB planar); larger ones as AP242 tessellated faces.
 */
export declare const MESH_PLANAR_TRIANGLES = 5000;
/** Planar faces past this many triangles a body are refused: some 250 MB of text, near what one string can hold (1M is past it). */
export declare const MESH_PLANAR_LIMIT = 250000;
/**
 * One STEP file of every solid of the given B-reps (a part's bodies), as one product. A part output (`{ id, brep }`,
 * R7.3b) is its B-rep, named by its id unless `name` is given.
 */
export declare function exportStep(input: Brep | readonly Brep[] | {
    readonly id: string;
    readonly brep: Brep;
}, options?: StepExportOptions): string;
export { importStep, stepMeshes, stepTessellatedChars, stepValidationProperties, compareValidationProperties, type StepValidationProperties, type ValidationCheck } from './step-import.js';
