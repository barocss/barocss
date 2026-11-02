import { type CylindricalWrapOptions, type BoxOptions, type ChamferOptions, type CircularPatternOptions, type CylinderOptions, type ExtrudeOptions, type FeatureSpec, type FilletOptions, type HoleOptions, type RectangularFeaturePatternOptions, type FillFeaturePatternOptions, type CurveFeaturePatternOptions, type LinearPatternOptions, type MirrorOptions, type RevolveOptions, type ScaleOptions, type ShellOptions, type SplitOptions, type RawNurbsSurface, type SewOptions, type ThickenOptions } from './spec.js';
import type { BodyQuery, EdgeQuery, FaceQuery } from './select.js';
import { Location, type Sketch } from './sketch.js';
import type { MassResult, MeshData } from './core.js';
/** What a document kind provides the part: its empty document, how a spec is written into it, and its core's results. */
export interface PartBackend<D> {
    empty(): D;
    copy(doc: D): D;
    /** The document's bodies by name, in the core's order (the studio's keys `b1` …, the kernel's output ids). */
    bodies(doc: D): string[];
    /** The spec written into the document (a new one; the old one unchanged), acting on `body` (null: a verb that makes one), or the core's refusal. */
    apply(doc: D, spec: FeatureSpec, body: string | null): D;
    /** A body's edges and faces. */
    select(doc: D, body: string): BodyQuery;
    /** A body's mass properties at a density (g/cm³), in MMGS. */
    mass(doc: D, body: string, density: number): MassResult;
    /** Every body of the part as one STEP AP214 file. */
    step(doc: D, name: string): string;
    meshes(doc: D): MeshData[];
    /** The document's parameters (R7.4d), and the document with them replaced, evaluated (its refusal, typed). */
    parameters(doc: D): Readonly<Record<string, number>>;
    withParameters(doc: D, parameters: Record<string, number>): D;
    /** Its features by stable id, in order. */
    features(doc: D): FeatureInfo[];
    /** The feature suppressed or not (the studio's History toggle), evaluated; refused where the document can't hold it. */
    suppress(doc: D, id: string, suppressed: boolean): D;
}
/** A feature as `features()` lists it: its stable id, kind and the studio's label for it. */
export interface FeatureInfo {
    readonly id: string;
    readonly kind: string;
    readonly label: string;
}
/**
 * `withParameters(doc, edits) → doc` (R7.4d, api-conventions §4): a document's parameters given new values — each must
 * be one it has, each value a finite number — as the Parameters panel writes a value (the order kept). Pure; the
 * document is evaluated by whoever uses it.
 */
export declare function withParameters<D extends {
    readonly parameters: Readonly<Record<string, number>>;
}>(doc: D, edits: Readonly<Record<string, number>>): D;
/**
 * A density in g/cm³, the way materials are quoted (api-conventions §2) — the kernel's way of asking for mass (it keeps
 * no material library; cad-model's part also takes a material id).
 */
export interface Density {
    density: number;
}
/** A Boolean's tool: a body of the part by name, or a callback that adds the tool body to the part (`p => p.cylinder(…)`). */
export type Tool<P> = string | ((part: P) => P);
export declare class Part<D> {
    #private;
    readonly name: string;
    protected readonly backend: PartBackend<D>;
    constructor(backend: PartBackend<D>, name: string, doc: D, focus?: string | null);
    /** The plain document (a copy: changing it changes nothing here). */
    get doc(): D;
    /** A new part of this kind on another document (a subclass keeps its own kind). */
    protected next(doc: D, focus?: string | null): this;
    protected get document(): D;
    /** The body chosen with body(name), or null. */
    protected get focus(): string | null;
    /** The part's bodies by name, in the core's order. */
    bodies(): string[];
    /** The same part, its verbs acting on the body of that name (see `bodies()`). */
    body(name: string): this;
    /** `parameter`: a named value the part's dimensions can take (`param(name)`), added or set — the Parameters panel's. */
    parameter(name: string, value: number): this;
    /** The part's parameters and their values. */
    parameters(): Record<string, number>;
    /** The same part with parameters given new values (see the `withParameters` function), evaluated again. */
    withParameters(edits: Readonly<Record<string, number>>): this;
    /** The part's features by stable id (`n3`, `fillet1` …), in order: the last is the one a verb just added. */
    features(): FeatureInfo[];
    /** A feature suppressed (left out of the model, kept in its history) or not, by its id — the History panel's toggle. */
    suppressed(id: string, suppressed?: boolean): this;
    /** The body a verb acts on: the chosen one, else the part's one body. */
    protected target(): string;
    /** `box`: a w × d × h block with its least corner at (x, y, z), a body of its own. */
    box(options: BoxOptions): this;
    /** `cylinder`: a round bar of radius r and height h standing on z about (x, y), a body of its own. */
    cylinder(options: CylinderOptions): this;
    /** `extrude`: a finished sketch pulled along its plane's normal, a body of its own. */
    extrude(profile: Sketch, options: ExtrudeOptions): this;
    /** `revolve`: a finished sketch turned about its plane's Y axis (or X), a body of its own. */
    revolve(profile: Sketch, options?: RevolveOptions): this;
    /** `sew`: copy ordered whole surfaces into a new closed body, retaining the current body choice. */
    sew(surfaces: readonly RawNurbsSurface[], options?: SewOptions): this;
    /** `thicken`: copy one whole surface into a new body, retaining the current body choice. */
    thicken(surface: RawNurbsSurface, options: ThickenOptions): this;
    /** `hole`: a round hole into the one flat face a selector picks, at (x, y) on that face's plane; through unless blind. */
    hole(face: (body: BodyQuery) => FaceQuery, options: HoleOptions): this;
    /** `fillet`: rounds the edges a selector picks. */
    fillet(edges: (body: BodyQuery) => EdgeQuery, options: FilletOptions): this;
    /** Add a tolerance-qualified closed-reference pad over one strict original-UV rectangle. */
    cylindricalWrap(faces: (body: BodyQuery) => FaceQuery, options: CylindricalWrapOptions): this;
    /** `chamfer`: cuts the edges a selector picks at 45°. */
    chamfer(edges: (body: BodyQuery) => EdgeQuery, options: ChamferOptions): this;
    /** `shell`: hollows the body to walls t thick, leaving the faces a selector picks open — or, given no selector, closed. */
    shell(options: ShellOptions): this;
    shell(open: (body: BodyQuery) => FaceQuery, options: ShellOptions): this;
    /** `union`: the body joined with a tool body. */
    union(tool: Tool<this>): this;
    /** `difference` (the palette's Subtract): the tool body cut out of the body. */
    subtract(tool: Tool<this>): this;
    /** `intersect`: only where the body and the tool body overlap. */
    intersect(tool: Tool<this>): this;
    /** `linear-pattern`: copies of the body in a row along an axis, joined into one body. */
    linearPattern(options: LinearPatternOptions): this;
    /** Repeat the current difference's cut along an axis, including the original cut. */
    linearFeaturePattern(options: LinearPatternOptions): this;
    /** Repeat the current difference's cut on two distinct global axes. */
    rectangularFeaturePattern(options: RectangularFeaturePatternOptions): this;
    /** Repeat the original CUT tool on a finite XY grid, masked by reference points in a region snapshot. */
    fillFeaturePattern(options: FillFeaturePatternOptions): this;
    /** Repeat a difference's cut along an open polyline without rotating its tool. */
    curveFeaturePattern(options: CurveFeaturePatternOptions): this;
    /** `circular-pattern`: copies of the body round an axis, joined into one body. */
    circularPattern(options: CircularPatternOptions): this;
    /** `mirror`: the body joined with its mirror image across a coordinate plane (through `at` on its axis). */
    mirror(options: MirrorOptions): this;
    /** `scale`: the body scaled uniformly about a pivot, the origin unless given. */
    scale(options: ScaleOptions): this;
    /** `split`: the body cut in two by a plane, each side a body of its own (choose one with body(name)). */
    split(options: SplitOptions): this;
    /**
     * The body placed by a Location: `rotate` about X, then Y, then Z through the origin, then `move` — the two commands,
     * one node each for every part of the placement that isn't zero.
     */
    moved(location: Location): this;
    /** The body's edges and faces, to look at or to select from. */
    select(): BodyQuery;
    /** The body's mass properties at a density, in MMGS. */
    mass(density: Density): MassResult;
    /** The part (every body) as one STEP AP214 file, named after the part unless another name is given. */
    step(name?: string): string;
    /** Each body's display triangles, in the common mesh shape (§10.3) gpu's GeometryInput takes. */
    meshes(): MeshData[];
    /** For a part kind's own verbs (cad-model's studio commands): a spec that makes a body, and one that acts on the chosen one. */
    protected makes(spec: FeatureSpec): this;
    protected acts(spec: FeatureSpec): this;
}
