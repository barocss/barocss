import type { NativeCrossingIncidenceGraphV1 } from './native-crossing-incidence-graph-v1.js';
export interface NativeDirectedHalfEdgeV1 {
    readonly id: string;
    readonly edgeId: string;
    readonly originVertexId: string;
    readonly destinationVertexId: string;
    readonly twinId: string;
}
export type NativeHalfEdgeTwinsV1 = {
    readonly status: 'exact';
    readonly halfEdges: readonly NativeDirectedHalfEdgeV1[];
} | {
    readonly status: 'refused';
    readonly reason: string;
};
/** Incidence-only. Deliberately does not invent next/prev or face loops. */
export declare function constructNativeHalfEdgeTwinsV1(input: NativeCrossingIncidenceGraphV1): NativeHalfEdgeTwinsV1;
