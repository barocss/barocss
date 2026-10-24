// R7 (the facades): a modelling verb as a document-neutral spec — the agent's v2 command name and its `values`
// (api-conventions.md §12), with the faces or edges it acts on by persistent name, the sketch it is built from, or the
// tool body it combines with. The one part implementation (./part) turns each verb into a spec once; each document's
// backend writes the spec into its own document (§11): cad's into a CadPartDocument, cad-model's through the studio's
// own command, as the agent's run_command does. The body a spec acts on (the part's one body, or the chosen one) is the
// backend's argument beside it.
import { refuse } from './refusal.js';
import { Sketch, type SketchData } from './sketch.js';
import type { AxisName } from './select.js';

export type BooleanCommand = 'union' | 'difference' | 'intersect';

export type FeatureSpec =
  | { readonly command: 'box'; readonly values: { readonly w: number; readonly d: number; readonly h: number; readonly x: number; readonly y: number; readonly z: number } }
  | { readonly command: 'cylinder'; readonly values: { readonly r: number; readonly h: number; readonly x: number; readonly y: number; readonly z: number } }
  | { readonly command: 'extrude'; readonly sketch: SketchData; readonly values: { readonly h: number; readonly draft: number } }
  | { readonly command: 'revolve'; readonly sketch: SketchData; readonly values: { readonly axis: 'x' | 'y'; readonly deg: number } }
  | { readonly command: 'hole'; readonly face: string; readonly values: { readonly type: 'through' | 'blind'; readonly d: number; readonly x: number; readonly y: number; readonly depth?: number } }
  | { readonly command: 'fillet'; readonly edges: readonly string[]; readonly values: { readonly radius: number } }
  | { readonly command: 'chamfer'; readonly edges: readonly string[]; readonly values: { readonly distance: number } }
  | { readonly command: 'shell'; readonly faces: readonly string[]; readonly values: { readonly t: number } }
  | { readonly command: BooleanCommand; readonly tool: string; readonly values: Record<string, never> }
  | { readonly command: 'linear-pattern'; readonly values: { readonly axis: AxisName; readonly spacing: number; readonly count: number } }
  | { readonly command: 'circular-pattern'; readonly values: { readonly axis: AxisName; readonly count: number; readonly span: number; readonly px: number; readonly py: number } }
  | { readonly command: 'move'; readonly values: { readonly x: number; readonly y: number; readonly z: number } }
  | { readonly command: 'rotate'; readonly values: { readonly axis: AxisName; readonly angle: number; readonly px: number; readonly py: number; readonly pz: number } };

/** `box`: the command's values, with their units in the names (§2). */
export interface BoxOptions { wMM: number; dMM: number; hMM: number; xMM?: number; yMM?: number; zMM?: number }
/** `cylinder`: radius r and height h, standing on z about (x, y). */
export interface CylinderOptions { rMM: number; hMM: number; xMM?: number; yMM?: number; zMM?: number }
/** `extrude`: the sketch pulled h along its plane's normal; `draftDeg` leans its walls in (0: straight). */
export interface ExtrudeOptions { hMM: number; draftDeg?: number }
/** `revolve`: the sketch turned about its plane's Y axis (or X), `angleDeg` (default 360). */
export interface RevolveOptions { axis?: 'x' | 'y'; angleDeg?: number }
/** `hole`: into the face a selector picks; `x`, `y` on that face's plane (a Z face: X and Y), as the command takes them. */
export interface HoleOptions { dMM: number; xMM: number; yMM: number; type?: 'through' | 'blind'; depthMM?: number }
/** `fillet`: on the edges a selector picks. */
export interface FilletOptions { radiusMM: number }
/** `chamfer`: on the edges a selector picks, at 45°. */
export interface ChamferOptions { distanceMM: number }
/** `shell`: walls t thick, the faces a selector picks left open (none: a closed hollow). */
export interface ShellOptions { tMM: number }
/** `linear-pattern`: `count` copies (the original among them) `spacingMM` apart along an axis, joined into one body. */
export interface LinearPatternOptions { axis: AxisName; spacingMM: number; count: number }
/**
 * `circular-pattern`: `count` copies (the original among them) about an axis, joined into one body. About Z they spread
 * over `spanDeg` (360, the default: an even full turn) round the axis through (px, py); about X or Y the kernel steps by
 * quarter turns, so the copies are 2 to 4 and no span or axis position is taken.
 */
export interface CircularPatternOptions { axis?: AxisName; count: number; spanDeg?: number; pxMM?: number; pyMM?: number }

const positive = (name: string, v: number) => { if (!(Number.isFinite(v) && v > 0)) throw refuse('VALUE', `${name} must be a positive number of mm, not ${v}`); return v; };
const finite = (name: string, v: number) => { if (!Number.isFinite(v)) throw refuse('VALUE', `${name} must be a number of mm, not ${v}`); return v; };
const degrees = (name: string, v: number) => { if (!Number.isFinite(v)) throw refuse('VALUE', `${name} must be a number of degrees, not ${v}`); return v; };
const count = (v: number) => { if (!Number.isInteger(v) || v < 2) throw refuse('VALUE', `count must be a whole number of copies, at least 2, not ${v}`); return v; };
const axisName = (v: unknown): AxisName => { if (v !== 'x' && v !== 'y' && v !== 'z') throw refuse('VALUE', `an axis is x, y or z, not ${String(v)}`); return v; };
const edgesOf = (edges: readonly string[], verb: string) => { if (!edges.length) throw refuse('SELECTION_EMPTY', `the selector picked no edge to ${verb}`); return edges; };
const sketchData = (s: Sketch) => { if (!(s instanceof Sketch)) throw refuse('VALUE', 'give a finished sketch: sketch(plane)…close(), .rectangle(), .circle() or .polygon()'); return s.data; };

export function boxSpec(o: BoxOptions): FeatureSpec {
  return { command: 'box', values: { w: positive('wMM', o.wMM), d: positive('dMM', o.dMM), h: positive('hMM', o.hMM), x: finite('xMM', o.xMM ?? 0), y: finite('yMM', o.yMM ?? 0), z: finite('zMM', o.zMM ?? 0) } };
}

export function cylinderSpec(o: CylinderOptions): FeatureSpec {
  return { command: 'cylinder', values: { r: positive('rMM', o.rMM), h: positive('hMM', o.hMM), x: finite('xMM', o.xMM ?? 0), y: finite('yMM', o.yMM ?? 0), z: finite('zMM', o.zMM ?? 0) } };
}

export function extrudeSpec(s: Sketch, o: ExtrudeOptions): FeatureSpec {
  return { command: 'extrude', sketch: sketchData(s), values: { h: positive('hMM', o.hMM), draft: degrees('draftDeg', o.draftDeg ?? 0) } };
}

export function revolveSpec(s: Sketch, o: RevolveOptions = {}): FeatureSpec {
  const axis = o.axis ?? 'y', deg = degrees('angleDeg', o.angleDeg ?? 360);
  if (axis !== 'x' && axis !== 'y') throw refuse('VALUE', `a revolve turns about the sketch's x or y axis, not ${String(axis)}`);
  if (!(deg > 0 && deg <= 360)) throw refuse('VALUE', `angleDeg is more than 0 and at most 360, not ${deg}`);
  return { command: 'revolve', sketch: sketchData(s), values: { axis, deg } };
}

export function holeSpec(face: string, o: HoleOptions): FeatureSpec {
  const type = o.type ?? (o.depthMM !== undefined ? 'blind' : 'through');
  if (type === 'blind' && o.depthMM === undefined) throw refuse('VALUE', 'a blind hole needs depthMM');
  return { command: 'hole', face, values: { type, d: positive('dMM', o.dMM), x: finite('xMM', o.xMM), y: finite('yMM', o.yMM), ...(type === 'blind' ? { depth: positive('depthMM', o.depthMM!) } : {}) } };
}

export function filletSpec(edges: readonly string[], o: FilletOptions): FeatureSpec {
  return { command: 'fillet', edges: edgesOf(edges, 'fillet'), values: { radius: positive('radiusMM', o.radiusMM) } };
}

export function chamferSpec(edges: readonly string[], o: ChamferOptions): FeatureSpec {
  return { command: 'chamfer', edges: edgesOf(edges, 'chamfer'), values: { distance: positive('distanceMM', o.distanceMM) } };
}

export function shellSpec(open: readonly string[], o: ShellOptions): FeatureSpec {
  return { command: 'shell', faces: open, values: { t: positive('tMM', o.tMM) } };
}

export function booleanSpec(command: BooleanCommand, tool: string): FeatureSpec {
  return { command, tool, values: {} };
}

export function linearPatternSpec(o: LinearPatternOptions): FeatureSpec {
  return { command: 'linear-pattern', values: { axis: axisName(o.axis), spacing: positive('spacingMM', o.spacingMM), count: count(o.count) } };
}

export function circularPatternSpec(o: CircularPatternOptions): FeatureSpec {
  const axis = axisName(o.axis ?? 'z'), n = count(o.count), span = degrees('spanDeg', o.spanDeg ?? 360);
  if (!(span > 0 && span <= 360)) throw refuse('VALUE', `spanDeg is more than 0 and at most 360, not ${span}`);
  if (axis !== 'z' && (n > 4 || span !== 360 || o.pxMM !== undefined || o.pyMM !== undefined)) throw refuse('VALUE', `about ${axis} the copies step by quarter turns: 2 to 4 of them, with no span or axis position`);
  return { command: 'circular-pattern', values: { axis, count: n, span, px: finite('pxMM', o.pxMM ?? 0), py: finite('pyMM', o.pyMM ?? 0) } };
}

export function moveSpec(offset: readonly [number, number, number]): FeatureSpec {
  return { command: 'move', values: { x: finite('x', offset[0]), y: finite('y', offset[1]), z: finite('z', offset[2]) } };
}

/** A turn about an axis through the origin (a Location's). */
export function rotateSpec(axis: AxisName, angleDeg: number): FeatureSpec {
  return { command: 'rotate', values: { axis, angle: degrees('angleDeg', angleDeg), px: 0, py: 0, pz: 0 } };
}
