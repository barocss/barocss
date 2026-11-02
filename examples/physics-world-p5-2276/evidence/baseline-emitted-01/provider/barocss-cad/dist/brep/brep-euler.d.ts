import { type Brep } from './brep-core.js';
import type { Curve, Point, Surface } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
type Sense = 'forward' | 'reversed';
interface V {
    id: string;
    point: Point;
}
interface E {
    id: string;
    v: [string, string];
    curve: Curve | null;
}
interface C {
    id: string;
    edge: string;
    sense: Sense;
    loop: string;
    next: string;
    prev: string;
}
interface L {
    id: string;
    face: string;
    first: string | null;
    anchor: string | null;
}
interface F {
    id: string;
    shell: string;
    outer: string;
    inner: string[];
    surface: Surface | null;
    sense: Sense;
}
interface S {
    id: string;
    body: string;
    faces: string[];
}
export declare class BrepEulerError extends KernelError {
    constructor(detail: string);
}
export declare class BrepEditor {
    private readonly prefix;
    readonly vertices: Map<string, V>;
    readonly edges: Map<string, E>;
    readonly coedges: Map<string, C>;
    readonly loops: Map<string, L>;
    readonly faces: Map<string, F>;
    readonly shells: Map<string, S>;
    readonly bodies: Map<string, {
        id: string;
        shells: string[];
    }>;
    private counter;
    constructor(prefix?: string);
    private id;
    start(c: string): string;
    end(c: string): string;
    /** Coedges of a loop in order (empty for a loop that is only an anchor vertex). */
    loopCoedges(loop: string): string[];
    /** Vertex ids of a loop in traversal order. */
    loopVertices(loop: string): string[];
    /** The coedge of `loop` that starts at vertex `v` (the first one when the vertex repeats). */
    outOf(loop: string, v: string): string;
    get counts(): {
        V: number;
        E: number;
        F: number;
        L: number;
        S: number;
    };
    private coedge;
    private link;
    mvfs(point: Point): {
        body: string;
        shell: string;
        face: string;
        loop: string;
        vertex: string;
    };
    /** A strut from `v` to a new vertex at `point`, inserted before coedge `before` (or into an anchor-only loop). */
    mev(loop: string, v: string, point: Point, curve?: Curve | null, before?: string): {
        vertex: string;
        edge: string;
        up: string;
        down: string;
    };
    /**
     * New edge from start(a) to start(b) (a, b on one loop). The new face's loop is a … prev(b)
     * closed by the new edge reversed; the old loop keeps b … prev(a) closed by the new edge forward.
     */
    mef(a: string, b: string, curve?: Curve | null): {
        face: string;
        loop: string;
        edge: string;
        kept: string;
        made: string;
    };
    /** Removes an edge whose two coedges lie on one loop; the part strictly between them becomes a new inner loop (ring). */
    kemr(edge: string): {
        ring: string;
    };
    /** Kills a face that has only its outer loop; that loop becomes an inner ring of `into` (a through hole). */
    kfmrh(face: string, into: string): void;
    setCurve(edge: string, curve: Curve): void;
    setSurface(face: string, surface: Surface, sense: Sense): void;
    /** The immutable B-rep. Edges without a curve get a straight line; every face needs a surface. */
    toBrep(source: Brep['source']): Brep;
}
export {};
