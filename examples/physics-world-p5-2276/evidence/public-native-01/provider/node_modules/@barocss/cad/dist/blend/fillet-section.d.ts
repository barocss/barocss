import type { ProfileSegmentInput } from '../features/extruded-profile-solid.js';
export type XY = [number, number];
/** A face in the section: a line through p along d (unit), or a circle about c of radius r. */
export type SectionCurve = {
    readonly kind: 'line';
    readonly p: XY;
    readonly d: XY;
} | {
    readonly kind: 'circle';
    readonly c: XY;
    readonly r: number;
};
/** A face at the edge's point X: its curve, the direction into it (w, square to the edge) and its outward normal n. */
export interface SectionSide {
    readonly curve: SectionCurve;
    readonly w: XY;
    readonly n: XY;
}
export interface FilletSection {
    /** The tool's profile; its last segment is the fillet arc (tags `t0`–`t3`, `f`). */
    readonly profile: ProfileSegmentInput[];
    readonly tags: string[];
    /** The ball's centre and its contacts on face 1 and face 2. */
    readonly centre: XY;
    readonly contacts: [XY, XY];
    readonly convex: boolean;
    /** The growth used (reduced from the one asked for where a face's circle would shrink past half its radius). */
    readonly g: number;
}
/** Why a fillet has no closed-form section here (R10.1's typed refusals). */
export type FilletRefusal = 'TANGENT_FACES' | 'RADIUS_EXCEEDS_FACE' | 'RADIUS_EXCEEDS_CURVATURE' | 'NOT_ANALYTIC_PAIR' | 'CONTACT_LEAVES_FACE' | 'APPROX_TOLERANCE_NOT_MET';
/** A typed refusal: `B-rep: <SELECTION|CAPABILITY|PARAMETER>: [<code>] <detail>` (finishEdges maps it to the part error). */
export declare const refuseFillet: (code: FilletRefusal, detail: string) => never;
/**
 * The fillet of radius r between two sides meeting at X, its tool grown by g outside the corner (g is reduced
 * where a face's outward offset would shrink a circle past half its radius). `scale` sets the tolerances.
 */
export declare function filletSection(X: XY, s1: SectionSide, s2: SectionSide, r: number, g: number, name: string, scale: number): FilletSection;
/** How far a point lies into a side from X, along its curve: a line's distance along w, a circle's angle towards w (0 to 2π). */
export declare function acrossOf(s: SectionSide, X: XY, y: XY): number;
