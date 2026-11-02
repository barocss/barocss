import { type Brep } from '../brep/brep-core.js';
import type { Curve, Point, Surface } from '../types.js';
type XY = [number, number];
/** A face's surface, ready to evaluate: clamped to its domain, its outward side `sense`. */
/** `pu`, `pv`: the surface closes on itself that way (a full turn): there the parameter wraps round its seam. */
export interface Sheet {
    readonly S: Surface;
    readonly at: (u: number, v: number) => Point;
    readonly u0: number;
    readonly u1: number;
    readonly v0: number;
    readonly v1: number;
    readonly sense: number;
    readonly hu: number;
    readonly hv: number;
    readonly pu: boolean;
    readonly pv: boolean;
}
export declare function sheetOf(S: Surface, sense: 'forward' | 'reversed'): Sheet;
export declare function pointOn(s: Sheet, u: number, v: number): Point;
/** The outward unit normal. */
export declare function normalOn(s: Sheet, u: number, v: number): Point;
/** (u, v) of the surface point nearest x: from `hint`, else the nearest of a 24 × 24 grid; Gauss–Newton. */
export declare function invertOn(s: Sheet, x: Point, hint?: XY): XY;
/** One rolling-ball station: the chain's point X and tangent t, the ball's centre and its contacts on A and B. */
export interface Station {
    readonly X: Point;
    readonly t: Point;
    readonly c: Point;
    readonly pA: Point;
    readonly pB: Point;
    readonly uvA: XY;
    readonly uvB: XY;
    readonly nA: Point;
    readonly nB: Point;
}
/**
 * The ball of radius r touching A and B (σ = −1: inside the material, a convex edge; +1 outside, a concave one) whose
 * centre lies in the plane through X square to t, from the contacts' seeds; null when Newton does not converge.
 */
export declare function solveStation(A: Sheet, sA: number, B: Sheet, sB: number, r: number, X: Point, t: Point, seedA: XY, seedB: XY, size: number): Station | null;
/** A station's section: its five corners (T1, T1 grown, the grown corner, T2 grown, T2) and the arc's middle pole and weight. */
export interface Section {
    readonly corners: Point[];
    readonly mid: Point;
    readonly w: number;
    readonly c: Point; /** The fillet's inner poles, from T2 (corner 4) to T1 (corner 0), weights 1, when it is not a conic of `mid` and `w` (a G2 section, R10.5b). */
    readonly poles?: readonly Point[];
}
/**
 * The fillet's section shape (R10.5b, D103): the ball's arc (circular, the default); a conic between the same contacts,
 * tangent there to the faces, its shape ρ ∈ (0, 1) (weight ρ/(1 − ρ) at the faces' corner; 0.5 a parabola; a circle at
 * the arc's own ρ); or G2 — a quartic tangent to both faces with their normal curvature across the contact, its inner
 * poles a fraction `tension` of the way to the faces' corner.
 */
export type SectionShape = {
    readonly kind: 'circular';
} | {
    readonly kind: 'conic';
    readonly rho: number;
} | {
    readonly kind: 'g2';
    readonly tension: number;
};
/** A station's shape terms: for G2, the faces' normal curvatures across the contacts (along the section, at T1 and T2). */
export type ShapeAt = {
    readonly kind: 'conic';
    readonly w: number;
} | {
    readonly kind: 'g2';
    readonly tension: number;
    readonly kA: number;
    readonly kB: number;
};
/**
 * The section of a station, grown g outside the corner (σ as for the ball: along −σ n at each contact, or along `growA`,
 * `growB` where given — beside a corner the ball rolls round, into the wedge there, R10.3a); null when it is degenerate.
 */
export declare function sectionOf(st: Station, sA: number, sB: number, r: number, g: number, growA?: Point, growB?: Point, shape?: ShapeAt): Section | null;
/**
 * The normal curvature of a sheet at (u, v) along the unit tangent d, against the unit normal n (positive where it
 * curves towards n): its second derivative along d by central differences.
 */
export declare function normalCurvature(S: Sheet, uv: XY, n: Point, d: Point): number;
/** How closely the lofted sections follow the true ones: their largest distance at the stations between, and the worst contact. */
export interface LoftReport {
    readonly stations: number;
    readonly patches: number;
    readonly maxDeviationMM: number;
}
/**
 * The fillet tool from its stations (every other one lofted through, the others measure it), around a closed chain
 * (an even count) or along an open one (an odd count, ending at lofted stations, capped there by the end sections'
 * planes): five faces a patch, `${id}.face` the fillet's, `${id}.tool` the rest. `breaks`: lofted indices where the
 * patches break (where the contacts cross seams; an open loft's start is one).
 */
export declare function loftTool(sections: readonly Section[], id: string, breaks?: readonly number[], closed?: boolean): {
    brep: Brep;
    report: LoftReport;
    contactFaces: string[];
};
/** An end's plane (a point and its normal): an open chain run past that end goes on until its section clears it. */
export interface EndPlane {
    readonly o: Point;
    readonly n: Point;
}
/** A tool's contact faces (ids): its fillet and its walls. */
export declare function contactFacesOf(tool: Brep, id: string): string[];
/** The closed tool of a ring (loftTool, closed). */
export declare function ringTool(sections: readonly Section[], id: string, breaks?: readonly number[]): {
    brep: Brep;
    report: LoftReport;
    contactFaces: string[];
};
/** A closed chain of edge curves by length: its point and unit tangent at s in [0, length). */
/** `starts`: the length along the chain where each of its curves starts. */
export interface ChainPath {
    readonly length: number;
    readonly starts: readonly number[];
    at(s: number): {
        X: Point;
        t: Point;
    };
}
export declare function chainPath(curves: readonly {
    curve: Curve;
    reversed: boolean;
}[], closed?: boolean): ChainPath;
/** Each refinement's measures, for tests and benches (unset in use). */
export declare let ringTrace: ((step: {
    stations: number;
    patches: number;
    contactMM: number;
    sectionMM: number;
}) => void) | null;
export declare function setRingTrace(f: typeof ringTrace): void;
export declare function setRingStations(n: number | null): void;
/** A fillet's report: its stations and patches, how far its lofted contacts lie off their faces, the arc off the ball. */
export interface FilletReport {
    readonly edges: readonly string[];
    readonly stations: number;
    readonly patches: number;
    /** The lofted contacts' largest distance from their faces, and the fillet's normal against theirs there (degrees). */
    readonly contact: number;
    readonly normal: number;
    /** The lofted sections against the true ones (at the stations between), and the solved balls' |c − p| − r. */
    readonly section: number;
    readonly ball: number;
}
type Face = Brep['faces'][number];
/** The surface carried on along each straight direction (degree 1, two rows: a plane, an extrusion, a cone's ruling) by k times its length either way — exactly the same surface, room for a tool running past the face. */
export declare function extendedSurface(S: Surface, k?: number): Surface;
/**
 * The fillet tool of a chain between the faces on its two sides: stations from about one per r/4 of its length, refined
 * until the lofted contacts lie within `tolMM` of their faces (refused past 4096), each solved on the face it falls on
 * (refused when it falls off them all: the fillet would run off its faces). A closed chain makes a ring; an open one a
 * capped tool, run on past an end by `past` (the body ends there: the Boolean trims it) or stopped at it.
 */
/** The radius at a point of a chain (R10.5, D100). */
export interface RadiusAt {
    readonly at: Point;
    readonly radius: number;
}
/**
 * Where the ball leaves a face at one of its edges and rolls round that edge onto the next face (R10.3a, D92): between
 * the loop's curve `after` and the next, which meet at an inside corner of the face they share. The edge (`edge`, not
 * finished) joins the faces `before` and `next` on side `side`; the ball keeps touching `shared`, on the other side.
 */
export interface CornerInput {
    readonly after: number;
    readonly side: 'A' | 'B';
    readonly shared: Face;
    readonly edge: Curve;
    readonly before: Face;
    readonly next: Face;
}
export interface RingInput {
    readonly loop: readonly {
        curve: Curve;
        reversed: boolean;
    }[];
    readonly facesOf?: readonly (readonly string[])[];
    readonly noCliffs?: boolean;
    readonly names: readonly string[];
    readonly sideA: readonly Face[];
    readonly sideB: readonly Face[];
    readonly start: {
        wA: Point;
        wB: Point;
    };
    readonly convex: boolean;
    readonly r: number;
    readonly id: string;
    readonly scaleMM: number;
    readonly tolMM: number;
    readonly closed?: boolean;
    readonly past?: readonly (EndPlane | null)[];
    readonly corners?: readonly CornerInput[]; /** A variable radius (R10.5, D100): the radius at points of the chain, `r` their largest. */
    readonly radii?: readonly RadiusAt[]; /** The section's shape (R10.5b, D103): circular when absent. */
    readonly shape?: SectionShape; /** Which ends run past are cut by their plane (a clipped tool), not trimmed by the Boolean. */
    readonly clipped?: readonly [boolean, boolean];
}
export declare function ringFillet(body: Brep, input: RingInput): {
    brep: Brep;
    report: FilletReport;
    contactFaces: string[];
    sides: string[];
};
/** Each corner ring's stations, before the loft (tests: unset in use). */
export declare let cornerTrace: ((x: {
    sols: readonly Station[];
    cuts: readonly number[];
    spans: readonly unknown[];
    breaks: readonly unknown[];
}) => void) | null;
export declare function setCornerTrace(f: typeof cornerTrace): void;
/**
 * The ball of radius r touching S and the edge C between the faces `before` and `next`, its foot's direction from the
 * edge the fraction θ of the way from the first face's normal to the second's (σ as for the ball): Newton in (u, v, t)
 * with the faces' normals at the foot held, then updated, until the foot settles. Null when it does not converge, or
 * the ball lies on the wrong side of the edge.
 */
export declare function solveCorner(S: Sheet, sigma: number, r: number, C: Curve, before: Sheet, next: Sheet, theta: number, seedS: XY, seedT: number, size: number): {
    c: Point;
    pS: Point;
    uvS: XY;
    nS: Point;
    foot: Point;
    t: number;
    m: Point;
} | null;
/**
 * The ball of radius r touching S and the edge C — rolling on along that edge where the face beside it ends (a cliff
 * edge, R10.4b, D96) — its centre in the plane through X square to tn: Newton in (u, v, t). Null when it does not
 * converge; `m` the unit way from the foot to the centre.
 */
export declare function solveCliff(S: Sheet, sigma: number, r: number, C: Curve, X: Point, tn: Point, seedS: XY, seedT: number, size: number): {
    c: Point;
    pS: Point;
    uvS: XY;
    nS: Point;
    foot: Point;
    t: number;
    m: Point;
} | null;
export {};
