import type { Binary64PointV1 } from './exact-binary64-orientation-v1.js';
export interface NativeBoundaryVertexV1 {
    readonly id: string;
    readonly pointMM: Readonly<Binary64PointV1>;
}
export interface NativeBoundaryHalfEdgeV1 {
    readonly id: string;
    readonly originVertexId: string;
    readonly destinationVertexId: string;
    readonly nextId: string;
    readonly previousId: string;
    readonly twinId: null;
}
export type NativePlanarFaceBoundaryV1 = {
    readonly status: 'qualified';
    readonly faceId: string;
    readonly winding: 'clockwise' | 'counterclockwise';
    readonly vertices: readonly NativeBoundaryVertexV1[];
    readonly halfEdges: readonly NativeBoundaryHalfEdgeV1[];
} | {
    readonly status: 'refused' | 'unsupported';
    readonly reason: string;
};
/** One immutable oriented boundary cycle, not a sewn B-Rep Face/Shell. Twin is absent. */
export declare function constructNativePlanarFaceBoundaryV1(faceId: unknown, loop: unknown): NativePlanarFaceBoundaryV1;
