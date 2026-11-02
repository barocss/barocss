import type { Brep } from './brep-core.js';
export interface StrictGeometry {
    maximumEdgeSurfaceGapMM: number;
}
interface Maps {
    loops: Map<string, Brep['loops'][number]>;
    coedges: Map<string, Brep['coedges'][number]>;
    edges: Map<string, Brep['edges'][number]>;
}
/** A tolerance may grow to this share of the model's size (at least 1 mm across): past it, it has blown up (a sewing or fitting default is 1e-3 at most). */
export declare const TOLERANCE_CAP = 0.001;
/**
 * The strict checks over all faces, reporting problems through `add` (kind, detail); returns the largest
 * distance of an edge sample from a surface using it. `size`: the model's extent (tolerances scale with it).
 */
export declare function strictGeometry(brep: Brep, maps: Maps, size: number, add: (kind: string, detail: string) => void): StrictGeometry;
export {};
