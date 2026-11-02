import { type Brep } from './brep-core.js';
import type { Curve, Surface } from '../types.js';
/** A patch: its surface (u along side A, v from A to B) and the two boundary curves it has along u (v = 0 and v = 1). */
export interface BandPatch {
    readonly surface: Surface;
    readonly a: Curve;
    readonly b: Curve;
}
/** The patches (consecutive ones meeting along a ruling; a closed band's last meets its first) as one open-shell sheet body. */
export declare function bandSheetBrep(input: {
    readonly id: string;
    readonly patches: readonly BandPatch[];
    readonly closed: boolean;
}): Brep;
