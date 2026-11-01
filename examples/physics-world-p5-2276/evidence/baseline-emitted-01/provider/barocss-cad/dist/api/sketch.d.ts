import type { Vec3 } from './select.js';
export type Vec2 = readonly [number, number];
/** A plane as the documents store it: its origin (mm), its normal and its X axis (unit vectors, square to each other). */
export interface PlaneData {
    readonly origin: Vec3;
    readonly normal: Vec3;
    readonly xAxis: Vec3;
}
/** A sketch plane (build123d's Plane): XY, XZ or YZ through the origin, offset along its normal, or any of your own. */
export declare class Plane {
    readonly origin: Vec3;
    readonly normal: Vec3;
    readonly xAxis: Vec3;
    private constructor();
    /** The XY plane: sketch X along X, sketch Y along Y, solids grow along +Z. A sketch on it stores no plane. */
    static readonly XY: Plane;
    /** The XZ plane: sketch X along X, sketch Y along Z (its normal −Y, so Y = normal × X). */
    static readonly XZ: Plane;
    /** The YZ plane: sketch X along Y, sketch Y along Z (its normal +X). */
    static readonly YZ: Plane;
    /** A plane of your own; its normal and X axis unit vectors, square to each other. */
    static of(data: PlaneData): Plane;
    /** The same plane moved `distance` (mm) along its normal. */
    offset(distance: number): Plane;
    /** Whether it is the XY plane through the origin, which a sketch node leaves out. */
    get isXY(): boolean;
    /** The plain plane, as a sketch node stores it. */
    get data(): {
        origin: [number, number, number];
        normal: [number, number, number];
        xAxis: [number, number, number];
    };
}
/** A placement as the documents store one (an instance's, a frame's): rotated about X, then Y, then Z (degrees), then moved (mm). */
export interface PoseData {
    readonly position: Vec3;
    readonly rotation: Vec3;
}
/** A placement (build123d's Location), the documents' Pose: a turn about X, then Y, then Z, through the origin, then a move. */
export declare class Location {
    readonly position: Vec3;
    readonly rotation: Vec3;
    private constructor();
    /** Where nothing moves. */
    static readonly IDENTITY: Location;
    /** A placement of your own, either part left out at zero. */
    static of(pose: Partial<PoseData>): Location;
    /** A move only. */
    static at(position: Vec3): Location;
    /** The plain pose, as an instance stores it. */
    get data(): {
        position: [number, number, number];
        rotation: [number, number, number];
    };
}
/** One segment of a sketch loop, as both documents store it: from `start` to the next segment's start, straight or round `center`. */
export type LoopSegment = {
    readonly kind: 'line';
    readonly start: Vec2;
} | {
    readonly kind: 'arc';
    readonly start: Vec2;
    readonly center: Vec2;
    readonly direction: 'ccw' | 'cw';
};
/**
 * A sketch's profile, the fields its node carries (a node adds `kind: 'sketch'` and its id). `sideTags` (D86) give each
 * side an id of its own, `e1` … in the order the sides run, as the studio's sketcher gives them: the walls a body makes
 * of the sketch are named `side[e<k>]`, and keep their names when a side is added or taken away elsewhere (a vertex
 * inserted in the studio's sketcher takes a new id and leaves the others).
 */
export type SketchData = ({
    readonly profile: 'rectangle';
    readonly min: Vec2;
    readonly max: Vec2;
} | {
    readonly profile: 'circle';
    readonly center: Vec2;
    readonly radius: number;
} | {
    readonly profile: 'polygon';
    readonly points: readonly Vec2[];
} | {
    readonly profile: 'loop';
    readonly segments: readonly LoopSegment[];
}) & {
    readonly plane?: PlaneData;
    readonly sideTags?: {
        readonly outer: readonly string[];
    };
};
/** A finished, closed profile on a plane, ready for `extrude` or `revolve`. */
export declare class Sketch {
    #private;
    constructor(data: SketchData);
    /** The plain profile (a copy), as the sketch node stores it. */
    get data(): SketchData;
}
/** The start of a sketch on a plane: a rectangle, a circle, a polygon, or a path begun with `moveTo`. */
export declare class SketchStart {
    readonly plane: Plane;
    constructor(plane: Plane);
    /** A w × d rectangle with its least corner at (x, y) in the plane — the box command's profile. */
    rectangle(o: {
        w: number;
        d: number;
        x?: number;
        y?: number;
    }): Sketch;
    /** A circle of radius r about (x, y) in the plane — the cylinder command's profile. */
    circle(o: {
        r: number;
        x?: number;
        y?: number;
    }): Sketch;
    /** A closed polygon through the points (mm, in the plane), in order. */
    polygon(points: readonly Vec2[]): Sketch;
    /** A path of lines and arcs from a point; `close()` finishes it. */
    moveTo(point: Vec2): SketchPath;
}
/** A path being drawn: each step returns a new path; `close()` returns the sketch. */
export declare class SketchPath {
    #private;
    constructor(plane: Plane, first: Vec2, segments: readonly LoopSegment[], at: Vec2);
    /** A straight line to the point. */
    lineTo(point: Vec2): SketchPath;
    /** An arc to the point round a centre, counter-clockwise unless `direction: 'cw'`. */
    arcTo(point: Vec2, o: {
        center: Vec2;
        direction?: 'ccw' | 'cw';
    }): SketchPath;
    /** The loop closed with a straight line back to its first point (none when it is already there). */
    close(): Sketch;
}
/** A new sketch on a plane (XY unless given). */
export declare function sketch(plane?: Plane): SketchStart;
