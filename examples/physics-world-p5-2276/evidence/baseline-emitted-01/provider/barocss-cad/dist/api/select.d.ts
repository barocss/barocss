import type { Brep } from '../brep/brep-core.js';
import type { BrepMesh } from '../brep/brep-tessellate.js';
/** A point or direction, mm, Z up: the facades' one shape (api-conventions §10.2), the same tuple gpu's core/geometry-types.ts declares. */
export type Vec3 = readonly [number, number, number];
export type AxisName = 'x' | 'y' | 'z';
/** An outward direction along an axis, for faces: '+z' is a face whose normal points up. */
export type Direction = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
/** One edge of a body: its persistent names (a closed curve may carry two), straight or not, its ends and its faces' names. */
export interface EdgeInfo {
    readonly names: readonly string[];
    readonly straight: boolean;
    /** The axis a straight edge runs along, when it runs along one. */
    readonly axis: AxisName | null;
    readonly a: Vec3;
    readonly b: Vec3;
    readonly faces: readonly [string, string];
}
/** One face of a body: its persistent name, plane or curved, its outward normal (a plane's) and centroid. */
export interface FaceInfo {
    readonly name: string;
    readonly kind: 'plane' | 'curved';
    readonly normal: Vec3;
    readonly centroid: Vec3;
    /** Its area (mm²), where the facade's core gives one. */
    readonly area?: number;
    /** The edges that bound it, by their index in the body's edge list. */
    readonly edges: readonly number[];
}
/** A body's edges and faces, from the records its facade filled. */
export declare class BodyQuery {
    #private;
    constructor(edges: readonly EdgeInfo[], faces: readonly FaceInfo[]);
    /** Every edge of the body, in the core's order. */
    edges(): EdgeQuery;
    /** Every face of the body, in the core's order. */
    faces(): FaceQuery;
}
export declare class EdgeQuery {
    #private;
    constructor(items: readonly EdgeInfo[]);
    /** Straight edges running along an axis. */
    along(axis: AxisName): EdgeQuery;
    straight(): EdgeQuery;
    curved(): EdgeQuery;
    /** The edges on a face, given by its persistent name. */
    on(face: string): EdgeQuery;
    /** Any test of your own on an edge's data. */
    where(test: (edge: EdgeInfo) => boolean): EdgeQuery;
    /** Sorted by the edge's midpoint along an axis, lowest first (stable: equal ones keep the core's order). */
    sortBy(axis: AxisName): EdgeQuery;
    first(count?: number): EdgeQuery;
    last(count?: number): EdgeQuery;
    get count(): number;
    list(): readonly EdgeInfo[];
    /** The persistent names a feature stores, every name of every edge, in the query's order. */
    names(): string[];
}
export declare class FaceQuery {
    #private;
    constructor(items: readonly FaceInfo[], edges: readonly EdgeInfo[]);
    /** Plane faces whose outward normal points that way. */
    facing(direction: Direction): FaceQuery;
    planar(): FaceQuery;
    curved(): FaceQuery;
    where(test: (face: FaceInfo) => boolean): FaceQuery;
    /** Sorted by the face's centroid along an axis, lowest first (stable). */
    sortBy(axis: AxisName): FaceQuery;
    first(count?: number): FaceQuery;
    last(count?: number): FaceQuery;
    get count(): number;
    list(): readonly FaceInfo[];
    names(): string[];
    /** The edges that bound these faces, each once, in the body's order. */
    edges(): EdgeQuery;
}
/**
 * A B-rep's display lines (api-conventions.md §10.3): the edges the selectors offer — seams and tangent joints left out,
 * as the studio's display leaves them — as segment pairs of their tessellated polylines, in mm.
 */
export declare function brepLines(brep: Brep, mesh: BrepMesh): Float32Array;
export declare function brepSelection(brep: Brep, mesh: BrepMesh): BodyQuery;
