// R7 (the facades): a modelling verb as a document-neutral spec — the agent's v2 command name and its `values`
// (api-conventions.md §12), with the faces or edges it acts on by persistent name, the sketch it is built from, or the
// tool body it combines with. The one part implementation (./part) turns each verb into a spec once; each document's
// backend writes the spec into its own document (§11): cad's into a CadPartDocument, cad-model's through the studio's
// own command, as the agent's run_command does. The body a spec acts on (the part's one body, or the chosen one) is the
// backend's argument beside it.
import { refuse } from './refusal.js';
import { Sketch, type SketchData } from './sketch.js';
import type { AxisName, EdgeInfo } from './select.js';

export type BooleanCommand = 'union' | 'difference' | 'intersect';

/** A value that names one of the part's parameters — the documents' own `{ parameter }` dimension (R7.4d). */
export interface Param { readonly parameter: string }
/** A number, or a parameter by name. */
export type Dim = number | Param;
/** A value bound to a parameter: `box({ w: param('W'), d: 40, h: 10 })`. */
export const param = (name: string): Param => ({ parameter: name });
export const isParam = (v: unknown): v is Param => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof (v as Param).parameter === 'string';
/** Options with every parameter read as its number: what a spec is built from. */
export type Resolved<T> = { [K in keyof T]: Exclude<T[K], Param> };
/** The options given as parameters: each option's name and the parameter it names. */
export type Bound = readonly { readonly option: string; readonly parameter: string }[];

/** A spec, and the options given as parameters (each backend binds them where its document holds a reference). */
export type FeatureSpec = BaseSpec & { readonly bound?: Bound };
type BaseSpec =
  | { readonly command: 'box'; readonly values: { readonly w: number; readonly d: number; readonly h: number; readonly x: number; readonly y: number; readonly z: number } }
  | { readonly command: 'cylinder'; readonly values: { readonly r: number; readonly h: number; readonly x: number; readonly y: number; readonly z: number } }
  | { readonly command: 'extrude'; readonly sketch: SketchData; readonly values: { readonly h: number; readonly draft: number } }
  | { readonly command: 'revolve'; readonly sketch: SketchData; readonly values: { readonly axis: 'x' | 'y'; readonly deg: number } }
  | { readonly command: 'hole'; readonly face: string; readonly values: { readonly type: 'through' | 'blind'; readonly d: number; readonly x: number; readonly y: number; readonly depth?: number } }
  | { readonly command: 'fillet'; readonly edges: readonly string[]; readonly values: { readonly radius: number; readonly endRadius?: number } }
  | { readonly command: 'chamfer'; readonly edges: readonly string[]; readonly values: { readonly distance: number } }
  | { readonly command: 'shell'; readonly faces: readonly string[]; readonly values: { readonly t: number } }
  | { readonly command: BooleanCommand; readonly tool: string; readonly values: Record<string, never> }
  | { readonly command: 'linear-pattern'; readonly values: { readonly axis: AxisName; readonly spacing: number; readonly count: number } }
  | { readonly command: 'linear-feature-pattern'; readonly values: { readonly axis: AxisName; readonly spacing: number; readonly count: number } }
  | { readonly command: 'circular-pattern'; readonly values: { readonly axis: AxisName; readonly count: number; readonly span: number; readonly px: number; readonly py: number } }
  | { readonly command: 'move'; readonly values: { readonly x: number; readonly y: number; readonly z: number } }
  | { readonly command: 'mirror'; readonly values: { readonly plane: 'yz' | 'xz' | 'xy'; readonly at: number } }
  | { readonly command: 'scale'; readonly values: { readonly factor: number; readonly px: number; readonly py: number; readonly pz: number } }
  | { readonly command: 'split'; readonly values: { readonly axis: AxisName; readonly at: number } | { readonly axis: 'n'; readonly nx: number; readonly ny: number; readonly nz: number; readonly at: number } }
  | { readonly command: 'rotate'; readonly values: { readonly axis: AxisName; readonly angle: number; readonly px: number; readonly py: number; readonly pz: number } }
  /** P1: a studio command with no kernel feature of the same set (gears with their mesh, springs, fasteners from rows). */
  | { readonly command: StudioCommand; readonly values: Readonly<Record<string, number | string>> };

/** The studio's own commands the facade runs as they are, its values the command's (§12). */
export type StudioCommand = 'gear' | 'gear-mesh' | 'spring' | 'fastener';

/**
 * `box`: the command's values by their own names (§12). Every input is in the conventions' fixed units — lengths in mm,
 * angles in degrees — so no name carries a unit (owner, 2026-10-24).
 */
export interface BoxOptions { w: Dim; d: Dim; h: Dim; x?: Dim; y?: Dim; z?: Dim }
/** `cylinder`: radius r and height h, standing on z about (x, y). */
export interface CylinderOptions { r: Dim; h: Dim; x?: Dim; y?: Dim; z?: Dim }
/** `extrude`: the sketch pulled h along its plane's normal; `draft` leans its walls in (0: straight). */
export interface ExtrudeOptions { h: Dim; draft?: Dim }
/** `revolve`: the sketch turned about its plane's Y axis (or X), `deg` degrees (default 360). */
export interface RevolveOptions { axis?: 'x' | 'y'; deg?: Dim }
/** `hole`: into the face a selector picks; `x`, `y` on that face's plane (a Z face: X and Y), as the command takes them. */
export interface HoleOptions { d: Dim; x: Dim; y: Dim; type?: 'through' | 'blind'; depth?: Dim }
/** `fillet`: on the selected edges; endRadius explicitly selects one straight open edge, from a to b.
 * Both explicit endpoint radii are at least 0.1 mm. Near-equal distinct radii are refused at the existing
 * Studio 1e-9 boundary. Equal numeric radii use the constant path; only a varying endRadius can bind.
 */
export interface FilletOptions { radius: Dim; endRadius?: Dim }
/** `chamfer`: on the edges a selector picks, at 45°. */
export interface ChamferOptions { distance: Dim }
/** `shell`: walls t thick, the faces a selector picks left open (none: a closed hollow). */
export interface ShellOptions { t: Dim }
/** `linear-pattern`: `count` copies (the original among them) `spacing` apart along an axis, joined into one body. */
export interface LinearPatternOptions { axis: AxisName; spacing: Dim; count: Dim }
/**
 * `circular-pattern`: `count` copies (the original among them) about an axis, joined into one body. About Z they spread
 * over `span` (360, the default: an even full turn) round the axis through (px, py); about X or Y the kernel steps by
 * quarter turns, so the copies are 2 to 4 and no span or axis position is taken.
 */
export interface CircularPatternOptions { axis?: AxisName; count: Dim; span?: Dim; px?: Dim; py?: Dim }

/** `mirror`: a mirrored copy, joined, across a coordinate plane — yz (across X), xz or xy — through `at` on its axis (0: the origin). */
export interface MirrorOptions { plane: 'yz' | 'xz' | 'xy'; at?: Dim }
/** `scale`: the body scaled uniformly by `factor` about `pivot` (the origin unless given). */
export interface ScaleOptions { factor: Dim; pivot?: readonly [number, number, number] }
/** `split`: the body cut in two across the plane `axis` = at, or with `normal` any plane normal·p = at (x + y = at for [1, 1, 0]: a mitre). */
export type SplitOptions = { axis: AxisName; at: Dim } | { normal: readonly [number, number, number]; at: Dim };

const positive = (name: string, v: number) => { if (!(Number.isFinite(v) && v > 0)) throw refuse('VALUE', `${name} must be a positive number of mm, not ${String(v)}`); return v; };
const finite = (name: string, v: number) => { if (!Number.isFinite(v)) throw refuse('VALUE', `${name} must be a number of mm, not ${String(v)}`); return v; };
const degrees = (name: string, v: number) => { if (!Number.isFinite(v)) throw refuse('VALUE', `${name} must be a number of degrees, not ${String(v)}`); return v; };
const count = (v: number) => { if (!Number.isInteger(v) || v < 2) throw refuse('VALUE', `count must be a whole number of copies, at least 2, not ${String(v)}`); return v; };
const axisName = (v: unknown): AxisName => { if (v !== 'x' && v !== 'y' && v !== 'z') throw refuse('VALUE', `an axis is x, y or z, not ${String(v)}`); return v; };
const tuple3 = (name: string, value: unknown): [number, number, number] => {
  if (!Array.isArray(value) || value.length !== 3) throw refuse('VALUE', `${name} must be [x, y, z]`);
  const component = (k: number): number => {
    const v = value[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw refuse('VALUE', `${name} ${'xyz'[k]} must be a finite number, not ${String(v)}`);
    return v;
  };
  return [component(0), component(1), component(2)];
};
const edgesOf = (edges: readonly string[], verb: string) => { if (!edges.length) throw refuse('SELECTION_EMPTY', `the selector picked no edge to ${verb}`); return edges; };
const sketchData = (s: Sketch) => { if (!(s instanceof Sketch)) throw refuse('VALUE', 'give a finished sketch: sketch(plane)…close(), .rectangle(), .circle() or .polygon()'); return s.data; };

export function boxSpec(o: Resolved<BoxOptions>): FeatureSpec {
  return { command: 'box', values: { w: positive('w', o.w), d: positive('d', o.d), h: positive('h', o.h), x: finite('x', o.x ?? 0), y: finite('y', o.y ?? 0), z: finite('z', o.z ?? 0) } };
}

export function cylinderSpec(o: Resolved<CylinderOptions>): FeatureSpec {
  return { command: 'cylinder', values: { r: positive('r', o.r), h: positive('h', o.h), x: finite('x', o.x ?? 0), y: finite('y', o.y ?? 0), z: finite('z', o.z ?? 0) } };
}

export function extrudeSpec(s: Sketch, o: Resolved<ExtrudeOptions>): FeatureSpec {
  return { command: 'extrude', sketch: sketchData(s), values: { h: positive('h', o.h), draft: degrees('draft', o.draft ?? 0) } };
}

export function revolveSpec(s: Sketch, o: Resolved<RevolveOptions> = {}): FeatureSpec {
  const axis = o.axis ?? 'y', deg = degrees('deg', o.deg ?? 360);
  if (axis !== 'x' && axis !== 'y') throw refuse('VALUE', `a revolve turns about the sketch's x or y axis, not ${String(axis)}`);
  if (!(deg > 0 && deg <= 360)) throw refuse('VALUE', `deg is more than 0 and at most 360, not ${deg}`);
  return { command: 'revolve', sketch: sketchData(s), values: { axis, deg } };
}

export function holeSpec(face: string, o: Resolved<HoleOptions>): FeatureSpec {
  const requestedType = o.type, type = requestedType === undefined ? (o.depth !== undefined ? 'blind' : 'through') : requestedType;
  if (type !== 'through' && type !== 'blind') throw refuse('VALUE', `a hole's type is through or blind, not ${String(type)}`);
  if (type === 'blind' && o.depth === undefined) throw refuse('VALUE', 'a blind hole needs depth');
  return { command: 'hole', face, values: { type, d: positive('d', o.d), x: finite('x', o.x), y: finite('y', o.y), ...(type === 'blind' ? { depth: positive('depth', o.depth!) } : {}) } };
}

export function filletSpec(edges: readonly string[], o: Resolved<FilletOptions>, picked?: readonly EdgeInfo[]): FeatureSpec {
  const names = edgesOf(edges, 'fillet'), radius = positive('radius', o.radius);
  if (o.endRadius === undefined) return { command: 'fillet', edges: names, values: { radius } };
  const endRadius = finite('endRadius', o.endRadius);
  if (radius < 0.1 || endRadius < 0.1) throw refuse('VALUE', 'explicit fillet endpoint radii must be at least 0.1 mm');
  if (picked?.length !== 1) throw refuse('SELECTION_ONE', 'an endRadius takes exactly one straight open edge with one name');
  const edge = picked[0];
  if (!edge.straight || edge.a.length !== 3 || edge.b.length !== 3 || ![...edge.a, ...edge.b].every(Number.isFinite)
    || edge.a.map(x => Math.round(x * 1e4)).join(',') === edge.b.map(x => Math.round(x * 1e4)).join(',')) throw refuse('VALUE', 'an endRadius takes one straight open edge with distinct endpoints');
  if (names.length !== 1) throw refuse('SELECTION_ONE', 'an endRadius takes exactly one straight open edge with one name');
  // Preserve the existing Studio command threshold without silently dropping a distinct end radius.
  if (endRadius !== radius && Math.abs(endRadius - radius) <= 1e-9) throw refuse('VALUE', 'distinct fillet endpoint radii must differ by more than 1e-9 mm');
  return { command: 'fillet', edges: names, values: { radius, ...(endRadius !== radius ? { endRadius } : {}) } };
}

export function chamferSpec(edges: readonly string[], o: Resolved<ChamferOptions>): FeatureSpec {
  return { command: 'chamfer', edges: edgesOf(edges, 'chamfer'), values: { distance: positive('distance', o.distance) } };
}

export function shellSpec(open: readonly string[], o: Resolved<ShellOptions>): FeatureSpec {
  return { command: 'shell', faces: open, values: { t: positive('t', o.t) } };
}

export function booleanSpec(command: BooleanCommand, tool: string): FeatureSpec {
  return { command, tool, values: {} };
}

export function linearPatternSpec(o: Resolved<LinearPatternOptions>): FeatureSpec {
  return { command: 'linear-pattern', values: { axis: axisName(o.axis), spacing: positive('spacing', o.spacing), count: count(o.count) } };
}

export function linearFeaturePatternSpec(o: Resolved<LinearPatternOptions>): FeatureSpec {
  return { command: 'linear-feature-pattern', values: { axis: axisName(o.axis), spacing: positive('spacing', o.spacing), count: count(o.count) } };
}

export function circularPatternSpec(o: Resolved<CircularPatternOptions>): FeatureSpec {
  const axis = axisName(o.axis ?? 'z'), n = count(o.count), span = degrees('span', o.span ?? 360);
  if (!(span > 0 && span <= 360)) throw refuse('VALUE', `span is more than 0 and at most 360, not ${span}`);
  if (axis !== 'z' && (n > 4 || span !== 360 || o.px !== undefined || o.py !== undefined)) throw refuse('VALUE', `about ${axis} the copies step by quarter turns: 2 to 4 of them, with no span or axis position`);
  return { command: 'circular-pattern', values: { axis, count: n, span, px: finite('px', o.px ?? 0), py: finite('py', o.py ?? 0) } };
}

export function moveSpec(offset: readonly [number, number, number]): FeatureSpec {
  const [x, y, z] = tuple3('offset', offset);
  return { command: 'move', values: { x, y, z } };
}

/** A turn about an axis through the origin (a Location's). */
export function rotateSpec(axis: AxisName, angle: number): FeatureSpec {
  return { command: 'rotate', values: { axis: axisName(axis), angle: degrees('angle', angle), px: 0, py: 0, pz: 0 } };
}

export function mirrorSpec(o: Resolved<MirrorOptions>): FeatureSpec {
  if (o.plane !== 'yz' && o.plane !== 'xz' && o.plane !== 'xy') throw refuse('VALUE', `a mirror plane is yz, xz or xy, not ${String(o.plane)}`);
  return { command: 'mirror', values: { plane: o.plane, at: finite('at', o.at ?? 0) } };
}

/** A uniform scale about a pivot (the origin unless given, in both cores: the studio's own default, the body's centre, is not taken). */
export function scaleSpec(o: Resolved<ScaleOptions>): FeatureSpec {
  const p = tuple3('pivot', o.pivot === undefined ? [0, 0, 0] : o.pivot);
  if (!(Number.isFinite(o.factor) && o.factor > 0)) throw refuse('VALUE', `factor must be a positive number, not ${String(o.factor)}`);
  return { command: 'scale', values: { factor: o.factor, px: finite('pivot x', p[0]), py: finite('pivot y', p[1]), pz: finite('pivot z', p[2]) } };
}

export function splitSpec(o: Resolved<SplitOptions>): FeatureSpec {
  const at = finite('at', o.at);
  if ('normal' in o) {
    const [nx, ny, nz] = tuple3('normal', o.normal);
    if (!(Math.hypot(nx, ny, nz) > 1e-9)) throw refuse('VALUE', 'a split plane\'s normal must not be zero');
    return { command: 'split', values: { axis: 'n', nx, ny, nz, at } };
  }
  return { command: 'split', values: { axis: axisName(o.axis), at } };
}

/** A studio command's spec: each value a finite number or a string, by the command's own names (its checks are its own). */
export function studioSpec(command: StudioCommand, values: Readonly<Record<string, number | string | undefined>>): FeatureSpec {
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) continue;
    if (typeof v === 'number' ? !Number.isFinite(v) : typeof v !== 'string') throw refuse('VALUE', `${command}'s ${k} is a number or a word, not ${String(v)}`);
    out[k] = v;
  }
  return { command, values: out };
}
