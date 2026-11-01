import { type Brep } from './brep-core.js';
export type PolyhedralBooleanOperation = 'union' | 'intersection' | 'difference';
/** A persistent name without its `#k` piece number. */
export declare const baseName: (name: string) => string;
/** A + B, A ∩ B or A − B for B-reps with planar faces and straight edges. */
export declare function booleanPolyhedra(a: Brep, b: Brep, operation: PolyhedralBooleanOperation, options?: {
    readonly id?: string;
}): Brep;
