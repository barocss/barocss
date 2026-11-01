import { type Brep } from '../brep/brep-core.js';
import type { Point } from '../types.js';
/** Reads the solids of a STEP file as one B-rep. */
export declare function importStep(source: string, options?: {
    readonly id?: string;
}): Brep;
/**
 * A STEP file's tessellated meshes — every one when the file holds nothing else (no B-rep solid), else null — for the
 * studio to check and repair as a mesh (M3) before it becomes a part.
 */
export declare function stepMeshes(source: string): {
    name: string;
    positions: Float64Array;
    indices: Uint32Array;
}[] | null;
/**
 * How many of a STEP file's characters hold tessellated geometry (its COORDINATES_LIST and TRIANGULATED_FACE records,
 * COMPLEX_TRIANGULATED_FACE alike), found by a scan without parsing: the import's size caps tell a mesh file from a
 * B-rep one by it (D49). A record runs from its keyword to the next ';' — a ';' in a quoted name ends it early, so
 * it is counted short, never long.
 */
export declare function stepTessellatedChars(source: string): number;
/** A STEP file's geometric validation properties (CAx-IF), as written for its part; each may be missing. */
export interface StepValidationProperties {
    readonly volume?: number;
    readonly area?: number;
    readonly centroid?: Point;
    readonly box?: {
        readonly min: Point;
        readonly max: Point;
    };
}
/**
 * The validation properties a STEP file carries: PROPERTY_DEFINITIONs named 'geometric validation property'
 * whose representations are 'volume', 'surface area', 'centroid' or 'bounding box' (values in mm).
 */
export declare function stepValidationProperties(source: string): StepValidationProperties;
/** One property compared: the file's value, the model's, and the difference measured against its limit. */
export interface ValidationCheck {
    readonly expected: number | Point;
    readonly actual: number | Point;
    readonly difference: number;
    readonly limit: number;
    readonly ok: boolean;
}
/**
 * The file's validation properties against the model read from it (its volume, area and centroid as measured
 * here). Limits are CAx-IF's: volume and area within 1 %, the centroid within 0.1 % of the box's diagonal.
 */
export declare function compareValidationProperties(expected: StepValidationProperties, actual: {
    readonly volume: number;
    readonly area: number;
    readonly centroid: Point;
    readonly box: {
        readonly min: Point;
        readonly max: Point;
    };
}): {
    readonly volume?: ValidationCheck;
    readonly area?: ValidationCheck;
    readonly centroid?: ValidationCheck;
    readonly ok: boolean;
};
