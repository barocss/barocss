import type { ExactRationalMMV1 } from './exact-segment-intersection-point-v1.js';
import type { ExactSplitPointV1 } from './exact-straight-edge-split-plan-v1.js';
export interface NativeIncidenceVertexV1 {
    readonly id: string;
    readonly pointMM: ExactSplitPointV1;
    readonly incidentEdgeIds: readonly string[];
}
export interface NativeIncidenceEdgeV1 {
    readonly id: string;
    readonly parentEdgeId: string;
    readonly startVertexId: string;
    readonly endVertexId: string;
    readonly startParameter: ExactRationalMMV1;
    readonly endParameter: ExactRationalMMV1;
}
export type NativeCrossingIncidenceGraphV1 = {
    readonly status: 'exact';
    readonly vertices: readonly NativeIncidenceVertexV1[];
    readonly edges: readonly NativeIncidenceEdgeV1[];
    readonly crossingVertexId: 'crossing';
} | {
    readonly status: 'refused' | 'unsupported';
    readonly reason: string;
};
/**
 * Five-vertex, four-edge incidence graph for exactly two crossing straight edges.
 * No B-Rep loops, shells, sewing, or vertex tolerance equivalence is asserted.
 */
export declare function constructNativeCrossingIncidenceGraphV1(firstId: unknown, a: unknown, b: unknown, secondId: unknown, c: unknown, d: unknown, maxAbsCoordinateMM?: number): NativeCrossingIncidenceGraphV1;
