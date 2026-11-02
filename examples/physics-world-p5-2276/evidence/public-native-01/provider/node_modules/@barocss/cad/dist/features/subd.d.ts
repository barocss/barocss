import { type Brep } from '../brep/brep-core.js';
import { type Cap, type PolyMesh } from './subd-sd2.js';
export { SubdError } from './subd-sd2.js';
export interface SubdCage {
    /** x, y, z per vertex (mm). */
    readonly positions: ArrayLike<number>;
    /** Each face its vertex numbers, counter-clockwise seen from outside (quads only in SD1). */
    readonly faces: readonly (readonly number[])[];
    /** Infinitely sharp edges, as pairs of vertex numbers. */
    readonly creases?: readonly (readonly [number, number])[];
}
export interface SubdOptions {
    readonly id?: string;
    /** SD2: at least this many Catmull–Clark steps where the cage is not regular (1 or 2): two make the caps a quarter the area, nearer the limit, at four times the faces. */
    readonly steps?: 1 | 2;
}
export declare function subdBrep(cage: SubdCage, options?: SubdOptions): Brep;
/** What the build did: Catmull–Clark steps taken, the caps (by refined face) and the refined cage, for the report. */
/**
 * What a SubD body is made of, for its notes (D79): Catmull–Clark steps, irregular vertices and caps, the caps'
 * largest distance from the limit surface (on the fit's samples), and that at crease, corner and boundary vertices
 * (where the caps' even angles cost the most); the body's size (its cage's bounding diagonal).
 */
export interface SubdSummary {
    readonly steps: number;
    readonly irregularVertices: number;
    readonly caps: number;
    readonly maxDeviation: number;
    readonly creaseDeviation: number;
    readonly size: number;
}
export declare function subdSummary(build: SubdBuild): SubdSummary;
/** A face's side along an edge: its block (the B-rep face of the same index), side, first cell and cells. */
export interface EdgeRun {
    readonly face: number;
    readonly side: number;
    readonly q0: number;
    readonly count: number;
    readonly K: number;
    readonly L: number;
}
export interface SubdBuild {
    readonly brep: Brep;
    readonly steps: number;
    readonly caps: ReadonlyMap<number, Cap>;
    readonly mesh: PolyMesh | null;
    readonly labels: readonly string[] | null;
    readonly sharpEdges: ReadonlySet<string>;
    readonly runs: ReadonlyMap<string, EdgeRun[]>;
    /** The quad cage the faces were built from (refined, turned outward). */
    readonly quads: SubdCage;
    /** Each B-rep face's quads: the cage face, its frame and its place in the face's grid. */
    readonly cells: readonly {
        readonly face: number;
        readonly r: number;
        readonly i: number;
        readonly j: number;
    }[][];
}
export declare function buildSubd(cage: SubdCage, options?: SubdOptions): SubdBuild;
