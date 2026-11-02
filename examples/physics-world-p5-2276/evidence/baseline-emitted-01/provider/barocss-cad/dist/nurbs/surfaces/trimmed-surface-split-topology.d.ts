import { type ExactPoint2 } from '../../brep/planar-arrangement.js';
import type { SectionRational, SectionRationalContext } from '../../section-rational-internal.js';
export type SplitUV = [number, number];
export interface SplitTopologyWork {
    vertexPairs: number;
    edgePairs: number;
    orientations: number;
    containmentTests: number;
}
export declare function pointKey(p: ExactPoint2): string;
export declare function coordinateCompare(a: ExactPoint2, b: ExactPoint2, axis: 0 | 1): number;
/** Exact segment relation, including shared endpoints and positive collinear overlap. */
export declare function segmentRelation(a: ExactPoint2, b: ExactPoint2, c: ExactPoint2, d: ExactPoint2, work: SplitTopologyWork): number;
export declare function ringArea2(ring: readonly ExactPoint2[], q: SectionRationalContext): SectionRational;
export declare function simpleRing(ring: readonly ExactPoint2[], work: SplitTopologyWork, maximumVertices?: 326 | 484): void;
export declare function canonicalRing(input: readonly ExactPoint2[], positive: boolean, q: SectionRationalContext, work: SplitTopologyWork, maximumVertices?: 326 | 484): ExactPoint2[];
export declare function compareRings(a: readonly ExactPoint2[], b: readonly ExactPoint2[]): number;
/** -1 outside,0 boundary,+1 inside, on exact represented/rational coordinates. */
export declare function pointInRing(ring: readonly ExactPoint2[], point: ExactPoint2, work: SplitTopologyWork): number;
export declare function uvRing(points: readonly SplitUV[]): ExactPoint2[];
/** Compare all inter-ring contacts and containment after storage rounding. */
export declare function compareRingRelations(exact: readonly (readonly ExactPoint2[])[], rounded: readonly (readonly ExactPoint2[])[], work: SplitTopologyWork): void;
