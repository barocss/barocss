import { type FillFeaturePatternRegion } from '../features/fill-cut-pattern.js';
export type { FillFeaturePatternRegion } from '../features/fill-cut-pattern.js';
import { Sketch, type SketchData } from './sketch.js';
import type { AxisName, EdgeInfo } from './select.js';
import type { RawNurbsPath } from '../features/curve-cut-pattern.js';
export type { RawNurbsPath } from '../features/curve-cut-pattern.js';
export type BooleanCommand = 'union' | 'difference' | 'intersect';
/** A value that names one of the part's parameters — the documents' own `{ parameter }` dimension (R7.4d). */
export interface Param {
    readonly parameter: string;
}
/** A number, or a parameter by name. */
export type Dim = number | Param;
/** A value bound to a parameter: `box({ w: param('W'), d: 40, h: 10 })`. */
export declare const param: (name: string) => Param;
export declare const isParam: (v: unknown) => v is Param;
/** Options with every parameter read as its number: what a spec is built from. */
export type Resolved<T> = {
    [K in keyof T]: Exclude<T[K], Param>;
};
/** The options given as parameters: each option's name and the parameter it names. */
export type Bound = readonly {
    readonly option: string;
    readonly parameter: string;
}[];
/** A spec, and the options given as parameters (each backend binds them where its document holds a reference). */
export type FeatureSpec = BaseSpec & {
    readonly bound?: Bound;
};
type BaseSpec = {
    readonly command: 'box';
    readonly values: {
        readonly w: number;
        readonly d: number;
        readonly h: number;
        readonly x: number;
        readonly y: number;
        readonly z: number;
    };
} | {
    readonly command: 'cylinder';
    readonly values: {
        readonly r: number;
        readonly h: number;
        readonly x: number;
        readonly y: number;
        readonly z: number;
    };
} | {
    readonly command: 'sew';
    readonly surfaces: readonly RawNurbsSurface[];
    readonly values: {
        readonly tol: number;
    };
} | {
    readonly command: 'thicken';
    readonly surface: RawNurbsSurface;
    readonly values: {
        readonly t: number;
        readonly side?: 'normal' | 'reverse' | 'both';
    };
} | {
    readonly command: 'extrude';
    readonly sketch: SketchData;
    readonly values: {
        readonly h: number;
        readonly draft: number;
    };
} | {
    readonly command: 'revolve';
    readonly sketch: SketchData;
    readonly values: {
        readonly axis: 'x' | 'y';
        readonly deg: number;
    };
} | {
    readonly command: 'hole';
    readonly face: string;
    readonly values: {
        readonly type: 'through' | 'blind';
        readonly d: number;
        readonly x: number;
        readonly y: number;
        readonly depth?: number;
    };
} | {
    readonly command: 'fillet';
    readonly edges: readonly string[];
    readonly values: {
        readonly radius: number;
        readonly endRadius?: number;
    };
} | {
    readonly command: 'chamfer';
    readonly edges: readonly string[];
    readonly values: {
        readonly distance: number;
    };
} | {
    readonly command: 'cylindrical-wrap';
    readonly face: string;
    readonly values: {
        readonly u0: number;
        readonly u1: number;
        readonly v0: number;
        readonly v1: number;
        readonly height: number;
    };
} | {
    readonly command: 'shell';
    readonly faces: readonly string[];
    readonly values: {
        readonly t: number;
    };
} | {
    readonly command: BooleanCommand;
    readonly tool: string;
    readonly values: Record<string, never>;
} | {
    readonly command: 'linear-pattern';
    readonly values: {
        readonly axis: AxisName;
        readonly spacing: number;
        readonly count: number;
    };
} | {
    readonly command: 'linear-feature-pattern';
    readonly values: {
        readonly axis: AxisName;
        readonly spacing: number;
        readonly count: number;
    };
} | {
    readonly command: 'rectangular-feature-pattern';
    readonly values: {
        readonly axis: AxisName;
        readonly spacing: number;
        readonly count: number;
        readonly axis2: AxisName;
        readonly spacing2: number;
        readonly count2: number;
    };
} | {
    readonly command: 'fill-feature-pattern';
    readonly region: FillFeaturePatternRegion;
    readonly anchor: readonly [number, number];
    readonly values: {
        readonly spacing: number;
        readonly count: number;
        readonly spacing2: number;
        readonly count2: number;
    };
} | {
    readonly command: 'curve-feature-pattern';
    readonly path: CurveFeaturePatternPath;
    readonly values: {
        readonly spacing: number;
        readonly count: number;
    };
} | {
    readonly command: 'circular-pattern';
    readonly values: {
        readonly axis: AxisName;
        readonly count: number;
        readonly span: number;
        readonly px: number;
        readonly py: number;
    };
} | {
    readonly command: 'move';
    readonly values: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
    };
} | {
    readonly command: 'mirror';
    readonly values: {
        readonly plane: 'yz' | 'xz' | 'xy';
        readonly at: number;
    };
} | {
    readonly command: 'scale';
    readonly values: {
        readonly factor: number;
        readonly px: number;
        readonly py: number;
        readonly pz: number;
    };
} | {
    readonly command: 'split';
    readonly values: {
        readonly axis: AxisName;
        readonly at: number;
    } | {
        readonly axis: 'n';
        readonly nx: number;
        readonly ny: number;
        readonly nz: number;
        readonly at: number;
    };
} | {
    readonly command: 'rotate';
    readonly values: {
        readonly axis: AxisName;
        readonly angle: number;
        readonly px: number;
        readonly py: number;
        readonly pz: number;
    };
}
/** P1: a studio command with no kernel feature of the same set (gears with their mesh, springs, fasteners from rows). */
 | {
    readonly command: StudioCommand;
    readonly values: Readonly<Record<string, number | string>>;
};
/** The studio's own commands the facade runs as they are, its values the command's (§12). */
export type StudioCommand = 'gear' | 'gear-mesh' | 'spring' | 'fastener';
/**
 * `box`: the command's values by their own names (§12). Every input is in the conventions' fixed units — lengths in mm,
 * angles in degrees — so no name carries a unit (owner, 2026-10-24).
 */
export interface BoxOptions {
    w: Dim;
    d: Dim;
    h: Dim;
    x?: Dim;
    y?: Dim;
    z?: Dim;
}
/** One rectangle in the first original native quarter of the unchanged positive-Y cylinder wall. */
export interface CylindricalWrapOptions {
    u0: number;
    u1: number;
    v0: number;
    v1: number;
    height: Dim;
}
/** `cylinder`: radius r and height h, standing on z about (x, y). */
export interface CylinderOptions {
    r: Dim;
    h: Dim;
    x?: Dim;
    y?: Dim;
    z?: Dim;
}
/** `extrude`: the sketch pulled h along its plane's normal; `draft` leans its walls in (0: straight). */
export interface ExtrudeOptions {
    h: Dim;
    draft?: Dim;
}
/** `revolve`: the sketch turned about its plane's Y axis (or X), `deg` degrees (default 360). */
export interface RevolveOptions {
    axis?: 'x' | 'y';
    deg?: Dim;
}
/** `hole`: into the face a selector picks; `x`, `y` on that face's plane (a Z face: X and Y), as the command takes them. */
export interface HoleOptions {
    d: Dim;
    x: Dim;
    y: Dim;
    type?: 'through' | 'blind';
    depth?: Dim;
}
/** `fillet`: on the selected edges; endRadius explicitly selects one straight open edge, from a to b.
 * Both explicit endpoint radii are at least 0.1 mm. Near-equal distinct radii are refused at the existing
 * Studio 1e-9 boundary. Equal numeric radii use the constant path; only a varying endRadius can bind.
 */
export interface FilletOptions {
    radius: Dim;
    endRadius?: Dim;
}
/** `chamfer`: on the edges a selector picks, at 45°. */
export interface ChamferOptions {
    distance: Dim;
}
/** A copied whole, untrimmed NURBS support, with no native identity or live source reference. */
export interface RawNurbsSurface {
    readonly degreeU: number;
    readonly degreeV: number;
    readonly knotsU: readonly number[];
    readonly knotsV: readonly number[];
    readonly controlPoints: readonly (readonly (readonly [number, number, number])[])[];
    readonly weights: readonly (readonly number[])[];
}
/** `thicken`: total thickness t; normal is du × dv, both offsets half t in each direction. */
export interface ThickenOptions {
    t: Dim;
    side?: 'normal' | 'reverse' | 'both';
}
/** `sew`: tolerance in mm; omitted or 0 uses the native automatic tolerance. */
export interface SewOptions {
    tol?: number;
}
/** `shell`: walls t thick, the faces a selector picks left open (none: a closed hollow). */
export interface ShellOptions {
    t: Dim;
}
/** `linear-pattern`: `count` copies (the original among them) `spacing` apart along an axis, joined into one body. */
export interface LinearPatternOptions {
    axis: AxisName;
    spacing: Dim;
    count: Dim;
}
/** Repeat a difference tool on two distinct global axes; each count includes the original cut. */
export interface RectangularFeaturePatternOptions {
    axis: AxisName;
    spacing: Dim;
    count: Dim;
    axis2: AxisName;
    spacing2: Dim;
    count2: Dim;
}
/** An inline XY region snapshot masks authored reference points; counts include the original cut. */
export interface FillFeaturePatternOptions {
    region: FillFeaturePatternRegion;
    anchor: readonly [number, number];
    spacing: Dim;
    count: Dim;
    spacing2: Dim;
    count2: Dim;
}
/** Raw authored geometry, or a cad-model direct curve's stable object id. */
export type CurveFeaturePatternPath = RawNurbsPath | {
    readonly objectId: string;
};
/** Fixed-orientation cuts along an open polyline; count includes the original cut (1..64). */
export interface CurveFeaturePatternOptions {
    path: CurveFeaturePatternPath;
    spacing: Dim;
    count: Dim;
}
/**
 * `circular-pattern`: `count` copies (the original among them) about an axis, joined into one body. About Z they spread
 * over `span` (360, the default: an even full turn) round the axis through (px, py); about X or Y the kernel steps by
 * quarter turns, so the copies are 2 to 4 and no span or axis position is taken.
 */
export interface CircularPatternOptions {
    axis?: AxisName;
    count: Dim;
    span?: Dim;
    px?: Dim;
    py?: Dim;
}
/** `mirror`: a mirrored copy, joined, across a coordinate plane — yz (across X), xz or xy — through `at` on its axis (0: the origin). */
export interface MirrorOptions {
    plane: 'yz' | 'xz' | 'xy';
    at?: Dim;
}
/** `scale`: the body scaled uniformly by `factor` about `pivot` (the origin unless given). */
export interface ScaleOptions {
    factor: Dim;
    pivot?: readonly [number, number, number];
}
/** `split`: the body cut in two across the plane `axis` = at, or with `normal` any plane normal·p = at (x + y = at for [1, 1, 0]: a mitre). */
export type SplitOptions = {
    axis: AxisName;
    at: Dim;
} | {
    normal: readonly [number, number, number];
    at: Dim;
};
export declare function boxSpec(o: Resolved<BoxOptions>): FeatureSpec;
export declare function cylinderSpec(o: Resolved<CylinderOptions>): FeatureSpec;
export declare function extrudeSpec(s: Sketch, o: Resolved<ExtrudeOptions>): FeatureSpec;
export declare function revolveSpec(s: Sketch, o?: Resolved<RevolveOptions>): FeatureSpec;
export declare function holeSpec(face: string, o: Resolved<HoleOptions>): FeatureSpec;
export declare function filletSpec(edges: readonly string[], o: Resolved<FilletOptions>, picked?: readonly EdgeInfo[]): FeatureSpec;
export declare function chamferSpec(edges: readonly string[], o: Resolved<ChamferOptions>): FeatureSpec;
export declare function cylindricalWrapSpec(face: string, o: Resolved<CylindricalWrapOptions>): FeatureSpec;
export declare function shellSpec(open: readonly string[], o: Resolved<ShellOptions>): FeatureSpec;
/** Capture a whole-surface recipe once; curved results use the native faceted approximation. */
export declare function thickenSpec(surface: RawNurbsSurface, o: Resolved<ThickenOptions>): Extract<FeatureSpec, {
    readonly command: 'thicken';
}>;
/** Copy ordered whole surfaces into one new closed body with the existing native sewing algorithm. */
export declare function sewSpec(surfaces: readonly RawNurbsSurface[], o?: SewOptions): Extract<FeatureSpec, {
    readonly command: 'sew';
}>;
export declare function booleanSpec(command: BooleanCommand, tool: string): FeatureSpec;
export declare function linearPatternSpec(o: Resolved<LinearPatternOptions>): FeatureSpec;
export declare function linearFeaturePatternSpec(o: Resolved<LinearPatternOptions>): FeatureSpec;
export declare function rectangularFeaturePatternSpec(o: Resolved<RectangularFeaturePatternOptions>): FeatureSpec;
export declare function fillFeaturePatternSpec(o: Resolved<FillFeaturePatternOptions>): Extract<FeatureSpec, {
    readonly command: 'fill-feature-pattern';
}>;
export declare function curveFeaturePatternSpec(o: Resolved<CurveFeaturePatternOptions>): FeatureSpec;
export declare function circularPatternSpec(o: Resolved<CircularPatternOptions>): FeatureSpec;
export declare function moveSpec(offset: readonly [number, number, number]): FeatureSpec;
/** A turn about an axis through the origin (a Location's). */
export declare function rotateSpec(axis: AxisName, angle: number): FeatureSpec;
export declare function mirrorSpec(o: Resolved<MirrorOptions>): FeatureSpec;
/** A uniform scale about a pivot (the origin unless given, in both cores: the studio's own default, the body's centre, is not taken). */
export declare function scaleSpec(o: Resolved<ScaleOptions>): FeatureSpec;
export declare function splitSpec(o: Resolved<SplitOptions>): FeatureSpec;
/** A studio command's spec: each value a finite number or a string, by the command's own names (its checks are its own). */
export declare function studioSpec(command: StudioCommand, values: Readonly<Record<string, number | string | undefined>>): FeatureSpec;
