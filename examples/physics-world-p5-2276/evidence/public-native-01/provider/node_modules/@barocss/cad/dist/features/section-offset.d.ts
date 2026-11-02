import { type CurveRegion2 } from '../brep/curved-arrangement.js';
/**
 * The section's regions eroded by `t`. `open(tag)` names the segments whose wall is removed (lines only);
 * `wallTag(tag)` tags the new wall facing a segment.
 */
export declare function erodeSection(regions: readonly CurveRegion2[], t: number, open: (tag: string | undefined) => boolean, wallTag: (tag: string | undefined) => string, tol: number): CurveRegion2[];
/** The section's regions grown by `t` (every point within t of them): the section and its boundary swept by a disc. */
export declare function growSection(regions: readonly CurveRegion2[], t: number, tol: number): CurveRegion2[];
