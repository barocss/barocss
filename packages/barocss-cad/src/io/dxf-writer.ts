// An ASCII DXF writer for 2D drawings (R11b, decision O1): DXF 2000 (AC1015) by default, with a DXF R12
// (AC1009) option. The input is a plain document of layers, line types, text styles, blocks and entities in
// drawing units; the output is deterministic text (no time stamps; handles numbered in writing order), so
// the same document always gives the same file.
//
// AC1015 is written with its full object structure (handles, owners, subclass markers, the block record
// table, the Model and Layout1 layouts, the root dictionary). R12 has no ELLIPSE, SPLINE, LWPOLYLINE, MTEXT,
// HATCH, line weights or $INSUNITS: polylines become POLYLINE/VERTEX (exact), multi-line text becomes one TEXT
// a line (exact placement), ellipses and splines become polylines only within an explicit chord tolerance,
// a line hatch of straight-sided loops becomes its lines (exact), and the rest is refused, typed. Every such
// change is counted in the report; nothing is approximated silently.
//
// Text is Windows-1252 ($DWGCODEPAGE ANSI_1252, the files' native code page): `bytes` is the file; Ø ° ± go as
// the control codes %%c %%d %%p, characters outside the code page as \U+XXXX.
//
// The format was read from the public DXF reference and from files a test oracle (ezdxf, MIT, run outside the
// product) writes; no code is taken from either.
import { KernelError } from '../core/barocss-error.js';

export const DXF_WRITER_VERSION = 'barocss-dxf-writer-v1';

export type DxfVersion = 'AC1015' | 'AC1009';
export type DxfUnits = 'unitless' | 'in' | 'ft' | 'mm' | 'cm' | 'm';
export type DxfXY = readonly [number, number];

/** `color`: an AutoCAD colour index 1–255 (7: black on paper, white on screen); `lineweight`: 1/100 mm (AC1015 only). */
export interface DxfLayer { name: string; color?: number; linetype?: string; lineweight?: number }
/** `pattern`: dash lengths (positive), gaps (negative) and dots (0), in drawing units. */
export interface DxfLinetype { name: string; description: string; pattern: readonly number[] }
/** `font`: the font file a CAD program looks for (e.g. `arial.ttf`). */
export interface DxfTextStyle { name: string; font: string }
/** A boundary loop of a hatch: closed, `bulges[i]` the bulge of the side from point i to point i + 1. */
export interface DxfHatchLoop { points: readonly DxfXY[]; bulges?: readonly number[] }
/** `lines`: a family of parallel lines `spacing` apart at `angleDeg`, one through `origin` (default 0, 0). */
export type DxfHatchFill = { kind: 'solid' } | { kind: 'lines'; angleDeg: number; spacing: number; origin?: DxfXY };
/** The definition points of a dimension (drawing coordinates). */
export type DxfDimensionGeometry =
  /** `p1`, `p2`: the measured points; `line`: a point on the dimension line; `angleDeg`: the dimension line's direction. */
  | { kind: 'linear'; p1: DxfXY; p2: DxfXY; line: DxfXY; angleDeg: number }
  | { kind: 'aligned'; p1: DxfXY; p2: DxfXY; line: DxfXY }
  /** The two lines (each start → end) and a point on the dimension arc. */
  | { kind: 'angular'; line1: readonly [DxfXY, DxfXY]; line2: readonly [DxfXY, DxfXY]; arc: DxfXY }
  /** `rim`: the point on the circle the dimension points at; `opposite`: the point across from it. */
  | { kind: 'diameter'; rim: DxfXY; opposite: DxfXY }
  | { kind: 'radius'; center: DxfXY; rim: DxfXY };
interface DxfEntityBase { layer?: string; linetype?: string; color?: number }
export type DxfEntity = DxfEntityBase & (
  | { type: 'line'; a: DxfXY; b: DxfXY }
  | { type: 'circle'; center: DxfXY; radius: number }
  /** Counter-clockwise from `startDeg` to `endDeg`. */
  | { type: 'arc'; center: DxfXY; radius: number; startDeg: number; endDeg: number }
  /** `major`: the major semi-axis from the centre; `ratio`: minor / major (0, 1]; counter-clockwise from parameter `start` to `end` (radians). */
  | { type: 'ellipse'; center: DxfXY; major: DxfXY; ratio: number; start: number; end: number }
  /** `bulges[i]`: tan(sweep / 4) of the side from point i to i + 1 (positive counter-clockwise). */
  | { type: 'lwpolyline'; points: readonly DxfXY[]; bulges?: readonly number[]; closed?: boolean }
  /** A NURBS curve: `knots` = control points + degree + 1, nondecreasing; `weights` (all positive) make it rational. */
  | { type: 'spline'; degree: number; knots: readonly number[]; control: readonly DxfXY[]; weights?: readonly number[] }
  /** One line of text; `at` is its baseline point at the `align` side. */
  | { type: 'text'; at: DxfXY; height: number; text: string; rotationDeg?: number; align?: 'left' | 'center' | 'right'; style?: string }
  /** Lines of text (\n between them), `at` the top left corner. */
  | { type: 'mtext'; at: DxfXY; height: number; text: string; rotationDeg?: number; style?: string }
  /** A filled triangle or quadrilateral, its corners in order round it. */
  | { type: 'solid'; points: readonly DxfXY[] }
  | { type: 'hatch'; loops: readonly DxfHatchLoop[]; fill: DxfHatchFill }
  | { type: 'insert'; block: string; at: DxfXY; scale?: number; rotationDeg?: number }
  /** `block`: what the dimension shows (lines, solids, text) in drawing coordinates; `text`: its text as shown; `measurement`: the measured value. */
  | { type: 'dimension'; geometry: DxfDimensionGeometry; block: readonly DxfEntity[]; text: string; textAt: DxfXY; measurement?: number });
export interface DxfBlock { name: string; base?: DxfXY; entities: readonly DxfEntity[] }
export interface DxfDocument {
  units: DxfUnits;
  layers?: readonly DxfLayer[];
  linetypes?: readonly DxfLinetype[];
  styles?: readonly DxfTextStyle[];
  blocks?: readonly DxfBlock[];
  entities: readonly DxfEntity[];
}
/** `r12ChordTolerance`: for R12, the largest distance (drawing units) allowed between an ellipse or spline and the polyline written for it. */
export interface DxfWriteOptions { version?: DxfVersion; r12ChordTolerance?: number }
export interface DxfWriteReport {
  contract: typeof DXF_WRITER_VERSION;
  version: DxfVersion;
  /** Entities written in model space, by DXF type. */
  modelSpace: Record<string, number>;
  /** Entities written in each block (dimension blocks `*D1`, `*D2`, … included), by DXF type. */
  blocks: Record<string, Record<string, number>>;
  /** R12 only: what was changed to fit it. `maxChordDeviation`: measured at 7 points a polyline side. */
  r12?: { ellipses: number; splines: number; polylines: number; mtexts: number; hatches: number; maxChordDeviation: number; unitsNotStored: boolean; lineweightsDropped: boolean };
  extents: { min: [number, number]; max: [number, number] } | null;
}
/** `text`: the file as characters; `bytes`: the file as written (Windows-1252). */
export interface DxfWriteResult { text: string; bytes: Uint8Array; report: DxfWriteReport }

export type DxfWriteErrorCode = 'NOT_FINITE' | 'BAD_ENTITY' | 'BAD_NAME' | 'DUPLICATE_NAME' | 'UNKNOWN_LAYER' | 'UNKNOWN_LINETYPE' | 'UNKNOWN_STYLE' | 'UNKNOWN_BLOCK' | 'BLOCK_CYCLE' | 'BAD_TEXT' | 'TEXT_TOO_LONG' | 'R12_UNSUPPORTED' | 'R12_NEEDS_TOLERANCE' | 'APPROX_TOLERANCE_NOT_MET';
export class DxfWriteError extends KernelError {
  constructor(readonly code: DxfWriteErrorCode, detail: string) { super(`DXF [${code}]: ${detail}`); this.name = 'DxfWriteError'; }
}

const INSUNITS: Record<DxfUnits, number> = { unitless: 0, in: 1, ft: 2, mm: 4, cm: 5, m: 6 };
const BUILTIN_LTYPES = ['ByBlock', 'ByLayer', 'Continuous'];
const NAME_BAD = /[<>/\\":;?*|=`]/;
const NAME_R12 = /^[A-Za-z0-9$_-]{1,31}$/;
const TEXT_CHUNK = 250;
const SAMPLES_PER_SIDE = 7;
const MAX_SIDES_PER_SPAN = 4096;

// ---------------------------------------------------------------------------------------------------------
// Values

/** A number as DXF text: the shortest form that reads back to the same binary64, never in exponent form. */
export function dxfNumber(x: number): string {
  if (!Number.isFinite(x)) throw new DxfWriteError('NOT_FINITE', `a value is ${x}`);
  if (Math.abs(x) >= 1e15) throw new DxfWriteError('NOT_FINITE', `a value of ${x} is too large to write exactly`);
  if (x === 0) return '0.0';
  let s = String(x);
  if (s.includes('e')) s = x.toFixed(20).replace(/0+$/, '');
  return s.includes('.') ? (s.endsWith('.') ? s + '0' : s) : s + '.0';
}

const DIAMETER = 0xd8, DEGREE = 0xb0, PLUS_MINUS = 0xb1;
/** Windows-1252's bytes 0x80–0x9f by character (0xa0–0xff are Latin-1's). */
const CP1252_HIGH: ReadonlyMap<number, number> = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e],
  [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);
/** The Windows-1252 byte of a character, or −1. */
function cp1252(c: number): number {
  if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) return c;
  return CP1252_HIGH.get(c) ?? -1;
}
/** The file's characters as Windows-1252 bytes (texts are escaped already: anything else refused). */
function encode(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const b = cp1252(text.charCodeAt(i));
    if (b < 0) throw new DxfWriteError('BAD_NAME', `a name holds ${text[i]}, outside the DXF file's code page (Windows-1252)`);
    out[i] = b;
  }
  return out;
}
/**
 * Text as DXF writes it: Ø ° ± as the control codes %%c %%d %%p, % as %%%, other characters of Windows-1252
 * as they are, any other as \U+XXXX; multi-line text (`mtext`) escapes \ { } and writes \P between lines.
 * Characters outside the Basic Multilingual Plane and control characters are refused.
 */
export function dxfText(s: string, mtext: boolean): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c === 10 && mtext) { out += '\\P'; continue; }
    if (c < 0x20 || c === 0x7f) throw new DxfWriteError('BAD_TEXT', `text holds control character ${c}${c === 10 ? ' (a line break: use mtext)' : ''}`);
    if (c > 0xffff) throw new DxfWriteError('BAD_TEXT', `text holds ${ch}, outside the characters DXF text can escape`);
    if (c === DIAMETER) out += '%%c';
    else if (c === DEGREE) out += '%%d';
    else if (c === PLUS_MINUS) out += '%%p';
    else if (c === 0x25) out += '%%%';
    else if (mtext && (c === 0x5c || c === 0x7b || c === 0x7d)) out += '\\' + ch;
    else if (c > 0x7e && (c < 0xa0 || cp1252(c) < 0)) out += '\\U+' + c.toString(16).toUpperCase().padStart(4, '0');
    else out += ch;
  }
  return out;
}

class Out {
  readonly lines: string[] = [];
  g(code: number, value: string | number): void {
    this.lines.push(code < 10 ? `  ${code}` : code < 100 ? ` ${code}` : String(code));
    this.lines.push(typeof value === 'number' ? (Number.isInteger(value) && !FLOAT_CODE(code) ? String(value) : dxfNumber(value)) : value);
  }
  xy(code: number, p: DxfXY): void { this.g(code, p[0]); this.g(code + 10, p[1]); }
  xyz(code: number, p: DxfXY): void { this.g(code, p[0]); this.g(code + 10, p[1]); this.g(code + 20, 0); }
}
/** Group codes that hold reals (written with a decimal point even when whole). */
function FLOAT_CODE(code: number): boolean {
  return (code >= 10 && code <= 59) || (code >= 110 && code <= 149) || (code >= 210 && code <= 239) || (code >= 1010 && code <= 1059);
}

class Handles {
  private next = 1;
  take(): string { return (this.next++).toString(16).toUpperCase(); }
  get seed(): string { return this.next.toString(16).toUpperCase(); }
}

// ---------------------------------------------------------------------------------------------------------
// Checks

function finite(p: DxfXY, what: string): void {
  if (!Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) throw new DxfWriteError('NOT_FINITE', `${what} is not a finite point`);
}
function checkName(name: string, what: string, version: DxfVersion): void {
  if (typeof name !== 'string' || !name || name.length > 255 || NAME_BAD.test(name) || name.trim() !== name) throw new DxfWriteError('BAD_NAME', `${what} name ${JSON.stringify(name)}`);
  for (const ch of name) { const c = ch.codePointAt(0)!; if (c < 0x20 || c === 0x7f || (c >= 0x80 && c < 0xa0) || cp1252(c) < 0) throw new DxfWriteError('BAD_NAME', `${what} name ${JSON.stringify(name)}: ${ch} is outside the file's code page`); }
  if (version === 'AC1009' && !name.startsWith('*') && !NAME_R12.test(name)) throw new DxfWriteError('BAD_NAME', `${what} name ${JSON.stringify(name)} is not an R12 name (A–Z, 0–9, $ _ -, at most 31)`);
}

interface Context {
  version: DxfVersion;
  layers: Set<string>;
  linetypes: Set<string>;
  styles: Set<string>;
  blocks: Map<string, DxfBlock>;
  tolerance: number | undefined;
  r12: NonNullable<DxfWriteReport['r12']>;
}

function checkEntity(e: DxfEntity, ctx: Context, inBlock: boolean): void {
  const layer = e.layer ?? '0';
  if (!ctx.layers.has(layer)) throw new DxfWriteError('UNKNOWN_LAYER', `${e.type} on layer ${JSON.stringify(layer)}, which is not defined`);
  if (e.linetype !== undefined && !ctx.linetypes.has(e.linetype)) throw new DxfWriteError('UNKNOWN_LINETYPE', `${e.type} with line type ${JSON.stringify(e.linetype)}`);
  if (e.color !== undefined && !(Number.isInteger(e.color) && e.color >= 0 && e.color <= 256)) throw new DxfWriteError('BAD_ENTITY', `${e.type} colour ${e.color}`);
  switch (e.type) {
    case 'line': finite(e.a, 'line start'); finite(e.b, 'line end'); return;
    case 'circle': finite(e.center, 'circle centre'); positive(e.radius, 'circle radius'); return;
    case 'arc': finite(e.center, 'arc centre'); positive(e.radius, 'arc radius'); num(e.startDeg, 'arc start'); num(e.endDeg, 'arc end'); return;
    case 'ellipse':
      finite(e.center, 'ellipse centre'); finite(e.major, 'ellipse axis'); num(e.start, 'ellipse start'); num(e.end, 'ellipse end');
      if (!(Math.hypot(e.major[0], e.major[1]) > 0) || !(e.ratio > 0 && e.ratio <= 1)) throw new DxfWriteError('BAD_ENTITY', `ellipse axis ${e.major} ratio ${e.ratio}`);
      if (e.start === e.end) throw new DxfWriteError('BAD_ENTITY', 'an ellipse arc of no sweep (a whole ellipse runs from 0 to 2π)');
      return;
    case 'lwpolyline':
      if (e.points.length < 2) throw new DxfWriteError('BAD_ENTITY', 'a polyline needs two points');
      e.points.forEach((p, i) => finite(p, `polyline point ${i}`));
      bulges(e.bulges, e.points.length, 'polyline');
      return;
    case 'spline': {
      const n = e.control.length;
      if (!Number.isInteger(e.degree) || e.degree < 1 || e.degree > 11 || n < e.degree + 1) throw new DxfWriteError('BAD_ENTITY', `spline of degree ${e.degree} with ${n} control points`);
      if (e.knots.length !== n + e.degree + 1) throw new DxfWriteError('BAD_ENTITY', `spline with ${e.knots.length} knots (needs ${n + e.degree + 1})`);
      for (let i = 0; i < e.knots.length; i++) { num(e.knots[i], 'spline knot'); if (i && e.knots[i] < e.knots[i - 1]) throw new DxfWriteError('BAD_ENTITY', 'spline knots decrease'); }
      if (!(e.knots[n] > e.knots[e.degree])) throw new DxfWriteError('BAD_ENTITY', 'spline has an empty domain');
      e.control.forEach((p, i) => finite(p, `spline control point ${i}`));
      if (e.weights && (e.weights.length !== n || e.weights.some(w => !(w > 0) || !Number.isFinite(w)))) throw new DxfWriteError('BAD_ENTITY', 'spline weights must be one positive value a control point');
      return;
    }
    case 'text': case 'mtext':
      finite(e.at, `${e.type} point`); positive(e.height, `${e.type} height`); if (e.rotationDeg !== undefined) num(e.rotationDeg, `${e.type} rotation`);
      if (e.style !== undefined && !ctx.styles.has(e.style)) throw new DxfWriteError('UNKNOWN_STYLE', `text style ${JSON.stringify(e.style)}`);
      if (typeof e.text !== 'string') throw new DxfWriteError('BAD_TEXT', 'text is not a string');
      if (e.type === 'text' && dxfText(e.text, false).length > TEXT_CHUNK) throw new DxfWriteError('TEXT_TOO_LONG', `a TEXT of ${e.text.length} characters (at most ${TEXT_CHUNK} written; use mtext)`);
      dxfText(e.text, e.type === 'mtext');
      return;
    case 'solid':
      if (e.points.length !== 3 && e.points.length !== 4) throw new DxfWriteError('BAD_ENTITY', `a solid of ${e.points.length} points (3 or 4)`);
      e.points.forEach((p, i) => finite(p, `solid point ${i}`));
      return;
    case 'hatch':
      if (!e.loops.length) throw new DxfWriteError('BAD_ENTITY', 'a hatch without loops');
      for (const l of e.loops) { if (l.points.length < 3 && !(l.points.length === 2 && l.bulges?.some(b => b !== 0))) throw new DxfWriteError('BAD_ENTITY', 'a hatch loop needs three points (or two with a bulge)'); l.points.forEach((p, i) => finite(p, `hatch point ${i}`)); bulges(l.bulges, l.points.length, 'hatch loop'); }
      if (e.fill.kind === 'lines') { num(e.fill.angleDeg, 'hatch angle'); positive(e.fill.spacing, 'hatch spacing'); if (e.fill.origin) finite(e.fill.origin, 'hatch origin'); }
      else if (e.fill.kind !== 'solid') throw new DxfWriteError('BAD_ENTITY', 'hatch fill');
      return;
    case 'insert':
      if (!ctx.blocks.has(e.block)) throw new DxfWriteError('UNKNOWN_BLOCK', `insert of ${JSON.stringify(e.block)}`);
      finite(e.at, 'insert point'); if (e.scale !== undefined) positive(e.scale, 'insert scale'); if (e.rotationDeg !== undefined) num(e.rotationDeg, 'insert rotation');
      return;
    case 'dimension': {
      if (inBlock) throw new DxfWriteError('BAD_ENTITY', 'a dimension inside a block');
      const g = e.geometry;
      if (g.kind === 'linear' || g.kind === 'aligned') { finite(g.p1, 'dimension point'); finite(g.p2, 'dimension point'); finite(g.line, 'dimension line point'); if (g.kind === 'linear') num(g.angleDeg, 'dimension angle'); }
      else if (g.kind === 'angular') { for (const p of [...g.line1, ...g.line2, g.arc]) finite(p, 'angular dimension point'); }
      else if (g.kind === 'diameter') { finite(g.rim, 'diameter point'); finite(g.opposite, 'diameter point'); }
      else if (g.kind === 'radius') { finite(g.center, 'radius centre'); finite(g.rim, 'radius point'); }
      else throw new DxfWriteError('BAD_ENTITY', 'dimension kind');
      finite(e.textAt, 'dimension text point'); if (e.measurement !== undefined) num(e.measurement, 'dimension measurement');
      dxfText(e.text, false);
      for (const b of e.block) { if (b.type === 'dimension' || b.type === 'insert') throw new DxfWriteError('BAD_ENTITY', `a ${b.type} inside a dimension's block`); checkEntity(b, ctx, true); }
      return;
    }
    default: throw new DxfWriteError('BAD_ENTITY', `entity type ${JSON.stringify((e as { type: unknown }).type)}`);
  }
}
function num(x: number, what: string): void { if (!Number.isFinite(x)) throw new DxfWriteError('NOT_FINITE', `${what} is ${x}`); }
function positive(x: number, what: string): void { if (!(Number.isFinite(x) && x > 0)) throw new DxfWriteError('BAD_ENTITY', `${what} is ${x}`); }
function bulges(b: readonly number[] | undefined, n: number, what: string): void {
  if (!b) return;
  if (b.length !== n) throw new DxfWriteError('BAD_ENTITY', `${what}: ${b.length} bulges for ${n} points`);
  for (const x of b) num(x, `${what} bulge`);
}

function checkCycles(blocks: Map<string, DxfBlock>): void {
  const state = new Map<string, 1 | 2>();
  const visit = (name: string, path: string[]): void => {
    const s = state.get(name);
    if (s === 2) return;
    if (s === 1) throw new DxfWriteError('BLOCK_CYCLE', `blocks insert each other: ${[...path, name].join(' → ')}`);
    state.set(name, 1);
    for (const e of blocks.get(name)!.entities) if (e.type === 'insert') visit(e.block, [...path, name]);
    state.set(name, 2);
  };
  for (const name of blocks.keys()) visit(name, []);
}

// ---------------------------------------------------------------------------------------------------------
// Curves (extents and R12 polylines)

function ellipseAt(e: Extract<DxfEntity, { type: 'ellipse' }>, t: number): [number, number] {
  const mx = e.major[0], my = e.major[1], c = Math.cos(t), s = Math.sin(t);
  return [e.center[0] + mx * c - my * e.ratio * s, e.center[1] + my * c + mx * e.ratio * s];
}

/** A NURBS point by de Boor's algorithm on homogeneous coordinates (`work`: 3 × (degree + 1) scratch). */
function splineAt(e: Extract<DxfEntity, { type: 'spline' }>, t: number, work: Float64Array): [number, number] {
  const p = e.degree, U = e.knots, n = e.control.length;
  let k = p;
  while (k < n - 1 && t >= U[k + 1]) k++;
  for (let j = 0; j <= p; j++) {
    const i = k - p + j, w = e.weights ? e.weights[i] : 1;
    work[3 * j] = e.control[i][0] * w; work[3 * j + 1] = e.control[i][1] * w; work[3 * j + 2] = w;
  }
  for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) {
    const i = k - p + j, den = U[i + p - r + 1] - U[i], a = den > 0 ? (t - U[i]) / den : 0;
    for (let c = 0; c < 3; c++) work[3 * j + c] = (1 - a) * work[3 * (j - 1) + c] + a * work[3 * j + c];
  }
  return [work[3 * p] / work[3 * p + 2], work[3 * p + 1] / work[3 * p + 2]];
}

function segmentDistance(q: DxfXY, a: DxfXY, b: DxfXY): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
}

type Curve = { kind: 'ellipse'; e: Extract<DxfEntity, { type: 'ellipse' }> } | { kind: 'spline'; e: Extract<DxfEntity, { type: 'spline' }>; work: Float64Array };
function curveAt(c: Curve, t: number): [number, number] { return c.kind === 'ellipse' ? ellipseAt(c.e, t) : splineAt(c.e, t, c.work); }

/**
 * Points along a curve from t0 to t1 such that every side lies within `tol` of it (measured at 7 points a
 * side): the span halved until it does. Returns the points (t0 first, t1 last) and the deviation found.
 */
function polylineOf(c: Curve, t0: number, t1: number, tol: number, out: [number, number][]): number {
  for (let m = 1; m <= MAX_SIDES_PER_SPAN; m *= 2) {
    let worst = 0;
    const pts: [number, number][] = [];
    for (let i = 0; i <= m; i++) pts.push(curveAt(c, i === m ? t1 : t0 + (t1 - t0) * i / m));
    for (let i = 0; i < m && worst <= tol; i++) for (let j = 1; j <= SAMPLES_PER_SIDE; j++) {
      const d = segmentDistance(curveAt(c, t0 + (t1 - t0) * (i + j / (SAMPLES_PER_SIDE + 1)) / m), pts[i], pts[i + 1]);
      if (d > worst) worst = d;
    }
    if (worst <= tol) { if (out.length) pts.shift(); out.push(...pts); return worst; }
  }
  throw new DxfWriteError('APPROX_TOLERANCE_NOT_MET', `a ${c.kind} needs more than ${MAX_SIDES_PER_SPAN} sides a span for ${tol}`);
}

/** An ellipse's sweep in (0, 2π]: the end taken past the start as DXF reads it (a whole turn when they differ by one). */
function ellipseSpan(e: Extract<DxfEntity, { type: 'ellipse' }>): number {
  const d = e.end - e.start, full = 2 * Math.PI;
  if (Math.abs(Math.abs(d) - full) <= 1e-12 * full) return full;
  const span = ((d % full) + full) % full;
  return span > 0 ? span : full;
}

function curvePolyline(c: Curve, tol: number): { points: [number, number][]; deviation: number } {
  const points: [number, number][] = [];
  let deviation = 0;
  if (c.kind === 'ellipse') {
    const t0 = c.e.start, t1 = t0 + ellipseSpan(c.e);
    // Quarter turns at most a piece, so the halving starts from a fair split.
    const pieces = Math.max(1, Math.ceil((t1 - t0) / (Math.PI / 2) - 1e-12));
    for (let i = 0; i < pieces; i++) deviation = Math.max(deviation, polylineOf(c, t0 + (t1 - t0) * i / pieces, i === pieces - 1 ? t1 : t0 + (t1 - t0) * (i + 1) / pieces, tol, points));
  } else {
    const U = c.e.knots;
    for (let k = c.e.degree; k < c.e.control.length; k++) if (U[k + 1] > U[k]) deviation = Math.max(deviation, polylineOf(c, U[k], U[k + 1], tol, points));
  }
  return { points, deviation };
}

/** Lines of a line hatch over straight-sided loops (even–odd), the family through `origin`. */
export function dxfHatchLines(loops: readonly DxfHatchLoop[], angleDeg: number, spacing: number, origin: DxfXY = [0, 0]): [DxfXY, DxfXY][] {
  const a = angleDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), [ox, oy] = origin;
  // In coordinates about the origin turned by −angle the lines are horizontal, at multiples of the spacing.
  const rs = loops.map(l => l.points.map(p => [ca * (p[0] - ox) + sa * (p[1] - oy), -sa * (p[0] - ox) + ca * (p[1] - oy)] as [number, number]));
  let lo = Infinity, hi = -Infinity;
  for (const r of rs) for (const p of r) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; }
  const out: [DxfXY, DxfXY][] = [];
  if (!(hi >= lo)) return out;
  for (let k = Math.ceil(lo / spacing); k * spacing <= hi; k++) {
    const y = k * spacing, xs: number[] = [];
    for (const r of rs) for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length];
      if ((p[1] <= y) !== (q[1] <= y)) xs.push(p[0] + (y - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1e-12) out.push([[ox + ca * xs[i] - sa * y, oy + sa * xs[i] + ca * y], [ox + ca * xs[i + 1] - sa * y, oy + sa * xs[i + 1] + ca * y]]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Extents

class Box {
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
  add(x: number, y: number): void { if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y; }
  get empty(): boolean { return !(this.x1 >= this.x0); }
}

/** An affine map x' = a x + b y + e, y' = c x + d y + f. */
type Xf = readonly [number, number, number, number, number, number];
const IDENTITY: Xf = [1, 0, 0, 1, 0, 0];
function put(box: Box, t: Xf, x: number, y: number): void { box.add(t[0] * x + t[1] * y + t[4], t[2] * x + t[3] * y + t[5]); }
/** `t` after an insert's own map: the block's base to `at`, scaled and turned. */
function insertXf(t: Xf, e: Extract<DxfEntity, { type: 'insert' }>, base: DxfXY): Xf {
  const k = e.scale ?? 1, r = (e.rotationDeg ?? 0) * Math.PI / 180, c = k * Math.cos(r), s = k * Math.sin(r);
  const a = c, b = -s, cc = s, d = c, ex = e.at[0] - (c * base[0] - s * base[1]), fy = e.at[1] - (s * base[0] + c * base[1]);
  return [t[0] * a + t[1] * cc, t[0] * b + t[1] * d, t[2] * a + t[3] * cc, t[2] * b + t[3] * d, t[0] * ex + t[1] * fy + t[4], t[2] * ex + t[3] * fy + t[5]];
}

function entityExtents(e: DxfEntity, box: Box, blocks: Map<string, DxfBlock>, t: Xf): void {
  switch (e.type) {
    case 'line': put(box, t, e.a[0], e.a[1]); put(box, t, e.b[0], e.b[1]); return;
    // (A circle's or ellipse's whole square: extents only set the first view.)
    case 'circle': case 'arc':
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) put(box, t, e.center[0] + sx * e.radius, e.center[1] + sy * e.radius);
      return;
    case 'ellipse': { const r = Math.hypot(e.major[0], e.major[1]); for (const sx of [-1, 1]) for (const sy of [-1, 1]) put(box, t, e.center[0] + sx * r, e.center[1] + sy * r); return; }
    case 'lwpolyline': case 'solid': for (const p of e.points) put(box, t, p[0], p[1]); return;
    case 'spline': for (const p of e.control) put(box, t, p[0], p[1]); return;
    case 'text': case 'mtext': put(box, t, e.at[0], e.at[1]); return;
    case 'hatch': for (const l of e.loops) for (const p of l.points) put(box, t, p[0], p[1]); return;
    case 'dimension': for (const b of e.block) entityExtents(b, box, blocks, t); return;
    case 'insert': { const b = blocks.get(e.block)!, inner = insertXf(t, e, b.base ?? [0, 0]); for (const x of b.entities) entityExtents(x, box, blocks, inner); return; }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Writing

const deg = (x: number) => { let d = x % 360; if (d < 0) d += 360; return Object.is(d, -0) ? 0 : d; };
/** DXF's solid corner order: 1, 2, 4, 3 round the shape (a triangle repeats its last corner). */
function solidCorners(p: readonly DxfXY[]): DxfXY[] { return p.length === 3 ? [p[0], p[1], p[2], p[2]] : [p[0], p[1], p[3], p[2]]; }

interface Writer {
  o: Out;
  v: DxfVersion;
  h: Handles;
  ctx: Context;
  counts: Record<string, number>;
  /** AC1015: the owner (block record) of what is written now. */
  owner: string;
  dimBlocks: string[];
  dimIndex: number;
}

function head(w: Writer, type: string, e: DxfEntity, subclass: string): void {
  w.counts[type] = (w.counts[type] ?? 0) + 1;
  const o = w.o;
  o.g(0, type);
  if (w.v === 'AC1015') { o.g(5, w.h.take()); o.g(330, w.owner); o.g(100, 'AcDbEntity'); }
  o.g(8, e.layer ?? '0');
  if (e.linetype !== undefined) o.g(6, w.v === 'AC1009' && BUILTIN_LTYPES.includes(e.linetype) ? e.linetype.toUpperCase() : e.linetype);
  if (e.color !== undefined) o.g(62, e.color);
  if (w.v === 'AC1015' && subclass) o.g(100, subclass);
}

function writeText(w: Writer, e: DxfEntity, at: DxfXY, height: number, text: string, rotationDeg: number, align: 'left' | 'center' | 'right' | undefined, style: string | undefined): void {
  const o = w.o;
  head(w, 'TEXT', e, 'AcDbText');
  o.xyz(10, at); o.g(40, height); o.g(1, dxfText(text, false));
  if (rotationDeg) o.g(50, deg(rotationDeg));
  if (style !== undefined) o.g(7, style);
  const h = align === 'center' ? 1 : align === 'right' ? 2 : 0;
  if (h) { o.g(72, h); o.xyz(11, at); }
  if (w.v === 'AC1015') o.g(100, 'AcDbText');
}

function writePolyline(w: Writer, e: DxfEntity, points: readonly DxfXY[], bulgeList: readonly number[] | undefined, closed: boolean): void {
  const o = w.o;
  if (w.v === 'AC1015') {
    head(w, 'LWPOLYLINE', e, 'AcDbPolyline');
    o.g(90, points.length); o.g(70, closed ? 1 : 0);
    points.forEach((p, i) => { o.xy(10, p); if (bulgeList && bulgeList[i]) o.g(42, bulgeList[i]); });
    return;
  }
  head(w, 'POLYLINE', e, '');
  o.g(66, 1); o.xyz(10, [0, 0]); o.g(70, closed ? 1 : 0);
  points.forEach((p, i) => {
    w.counts.VERTEX = (w.counts.VERTEX ?? 0) + 1;
    o.g(0, 'VERTEX'); o.g(8, e.layer ?? '0'); o.xyz(10, p); if (bulgeList && bulgeList[i]) o.g(42, bulgeList[i]);
  });
  w.counts.SEQEND = (w.counts.SEQEND ?? 0) + 1;
  o.g(0, 'SEQEND'); o.g(8, e.layer ?? '0');
}

function writeEntity(w: Writer, e: DxfEntity): void {
  const o = w.o, r12 = w.v === 'AC1009';
  switch (e.type) {
    case 'line': head(w, 'LINE', e, 'AcDbLine'); o.xyz(10, e.a); o.xyz(11, e.b); return;
    case 'circle': head(w, 'CIRCLE', e, 'AcDbCircle'); o.xyz(10, e.center); o.g(40, e.radius); return;
    case 'arc':
      head(w, 'ARC', e, 'AcDbCircle'); o.xyz(10, e.center); o.g(40, e.radius);
      if (!r12) o.g(100, 'AcDbArc');
      o.g(50, deg(e.startDeg)); o.g(51, deg(e.endDeg));
      return;
    case 'ellipse': {
      if (r12) { r12Curve(w, e, { kind: 'ellipse', e }); w.ctx.r12.ellipses++; return; }
      head(w, 'ELLIPSE', e, 'AcDbEllipse'); o.xyz(10, e.center); o.xyz(11, e.major); o.g(40, e.ratio);
      let t0 = e.start % (2 * Math.PI); if (t0 < 0) t0 += 2 * Math.PI;
      o.g(41, t0); o.g(42, t0 + ellipseSpan(e));
      return;
    }
    case 'lwpolyline': if (r12) w.ctx.r12.polylines++; writePolyline(w, e, e.points, e.bulges, !!e.closed); return;
    case 'spline': {
      if (r12) { r12Curve(w, e, { kind: 'spline', e, work: new Float64Array(3 * (e.degree + 1)) }); w.ctx.r12.splines++; return; }
      head(w, 'SPLINE', e, 'AcDbSpline');
      o.g(210, 0); o.g(220, 0); o.g(230, 1);
      o.g(70, 8 | (e.weights ? 4 : 0)); o.g(71, e.degree); o.g(72, e.knots.length); o.g(73, e.control.length); o.g(74, 0);
      o.g(42, 1e-10); o.g(43, 1e-10);
      for (const k of e.knots) o.g(40, k);
      if (e.weights) for (const x of e.weights) o.g(41, x);
      for (const p of e.control) o.xyz(10, p);
      return;
    }
    case 'text': writeText(w, e, e.at, e.height, e.text, e.rotationDeg ?? 0, e.align, e.style); return;
    case 'mtext': {
      const a = (e.rotationDeg ?? 0) * Math.PI / 180;
      if (r12) {
        // One TEXT a line; the first line's top at `at` (cap height taken as the text height), 5/3 of the height apart (MTEXT's own spacing).
        w.ctx.r12.mtexts++;
        e.text.split('\n').forEach((line, k) => {
          const down = e.height * (1 + k * 5 / 3);
          writeText(w, e, [e.at[0] + Math.sin(a) * down, e.at[1] - Math.cos(a) * down], e.height, line, e.rotationDeg ?? 0, 'left', e.style);
        });
        return;
      }
      head(w, 'MTEXT', e, 'AcDbMText');
      o.xyz(10, e.at); o.g(40, e.height); o.g(71, 1); o.g(72, 1);
      const s = dxfText(e.text, true);
      let i = 0;
      for (; s.length - i > TEXT_CHUNK; i += TEXT_CHUNK) o.g(3, s.slice(i, i + TEXT_CHUNK));
      o.g(1, s.slice(i));
      if (e.style !== undefined) o.g(7, e.style);
      if (a) o.xyz(11, [Math.cos(a), Math.sin(a)]);
      return;
    }
    case 'solid': { head(w, 'SOLID', e, 'AcDbTrace'); const c = solidCorners(e.points); o.xyz(10, c[0]); o.xyz(11, c[1]); o.xyz(12, c[2]); o.xyz(13, c[3]); return; }
    case 'hatch': {
      if (r12) {
        if (e.fill.kind === 'solid') throw new DxfWriteError('R12_UNSUPPORTED', 'a solid hatch (R12 has no HATCH; write AC1015 or give the fill as solids)');
        if (e.loops.some(l => l.bulges?.some(b => b !== 0))) throw new DxfWriteError('R12_UNSUPPORTED', 'a hatch with arc sides (R12 has no HATCH)');
        w.ctx.r12.hatches++;
        for (const [a, b] of dxfHatchLines(e.loops, e.fill.angleDeg, e.fill.spacing, e.fill.origin)) writeEntity(w, { type: 'line', a, b, layer: e.layer, ...(e.linetype !== undefined ? { linetype: e.linetype } : {}), ...(e.color !== undefined ? { color: e.color } : {}) });
        return;
      }
      head(w, 'HATCH', e, 'AcDbHatch');
      o.xyz(10, [0, 0]); o.g(210, 0); o.g(220, 0); o.g(230, 1);
      const solid = e.fill.kind === 'solid';
      o.g(2, solid ? 'SOLID' : '_USER'); o.g(70, solid ? 1 : 0); o.g(71, 0); o.g(91, e.loops.length);
      for (const l of e.loops) {
        const bulged = !!l.bulges?.some(b => b !== 0);
        o.g(92, 3); o.g(72, bulged ? 1 : 0); o.g(73, 1); o.g(93, l.points.length);
        l.points.forEach((p, i) => { o.xy(10, p); if (bulged) o.g(42, l.bulges![i]); });
        o.g(97, 0);
      }
      o.g(75, 0); o.g(76, solid ? 1 : 0);
      if (e.fill.kind === 'lines') {
        // The pattern line as DXF stores it: already turned and scaled, its offset to the next line in drawing coordinates.
        const a = e.fill.angleDeg * Math.PI / 180;
        o.g(52, deg(e.fill.angleDeg)); o.g(41, e.fill.spacing); o.g(77, 0); o.g(78, 1);
        o.g(53, deg(e.fill.angleDeg)); o.g(43, e.fill.origin?.[0] ?? 0); o.g(44, e.fill.origin?.[1] ?? 0); o.g(45, -Math.sin(a) * e.fill.spacing); o.g(46, Math.cos(a) * e.fill.spacing); o.g(79, 0);
      }
      o.g(98, 0);
      return;
    }
    case 'insert':
      head(w, 'INSERT', e, 'AcDbBlockReference'); o.g(2, e.block); o.xyz(10, e.at);
      if (e.scale !== undefined && e.scale !== 1) { o.g(41, e.scale); o.g(42, e.scale); o.g(43, e.scale); }
      if (e.rotationDeg) o.g(50, deg(e.rotationDeg));
      return;
    case 'dimension': {
      const g = e.geometry, name = w.dimBlocks[w.dimIndex++];
      const type = g.kind === 'linear' ? 0 : g.kind === 'aligned' ? 1 : g.kind === 'angular' ? 2 : g.kind === 'diameter' ? 3 : 4;
      head(w, 'DIMENSION', e, 'AcDbDimension');
      o.g(2, name);
      const def = g.kind === 'linear' || g.kind === 'aligned' ? g.line : g.kind === 'angular' ? g.line2[1] : g.kind === 'diameter' ? g.opposite : g.center;
      o.xyz(10, def); o.xyz(11, e.textAt);
      o.g(70, type | 32 | 128);
      if (!r12) { o.g(71, 5); if (e.measurement !== undefined && g.kind !== 'angular') o.g(42, e.measurement); }
      o.g(1, dxfText(e.text, false)); o.g(3, r12 ? 'STANDARD' : 'Standard');
      if (g.kind === 'linear' || g.kind === 'aligned') {
        if (!r12) o.g(100, 'AcDbAlignedDimension');
        o.xyz(13, g.p1); o.xyz(14, g.p2);
        if (g.kind === 'linear') { o.g(50, deg(g.angleDeg)); if (!r12) o.g(100, 'AcDbRotatedDimension'); }
      } else if (g.kind === 'angular') {
        if (!r12) o.g(100, 'AcDb2LineAngularDimension');
        o.xyz(13, g.line1[0]); o.xyz(14, g.line1[1]); o.xyz(15, g.line2[0]); o.xyz(16, g.arc);
      } else {
        if (!r12) o.g(100, g.kind === 'diameter' ? 'AcDbDiametricDimension' : 'AcDbRadialDimension');
        o.xyz(15, g.rim); o.g(40, 0);
      }
      return;
    }
  }
}

function r12Curve(w: Writer, e: DxfEntity, c: Curve): void {
  const tol = w.ctx.tolerance;
  if (tol === undefined) throw new DxfWriteError('R12_NEEDS_TOLERANCE', `an ${c.kind} in R12 is written as a polyline: give r12ChordTolerance`);
  const { points, deviation } = curvePolyline(c, tol);
  if (deviation > w.ctx.r12.maxChordDeviation) w.ctx.r12.maxChordDeviation = deviation;
  const first = points[0], last = points[points.length - 1], closed = points.length > 2 && Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-12 * (1 + Math.hypot(first[0], first[1]));
  writePolyline(w, { layer: e.layer, ...(e.linetype !== undefined ? { linetype: e.linetype } : {}), ...(e.color !== undefined ? { color: e.color } : {}), type: 'lwpolyline', points }, closed ? points.slice(0, -1) : points, undefined, closed);
}

// ---------------------------------------------------------------------------------------------------------
// The document

/** Writes a DXF file of the document. Throws DxfWriteError (typed) for anything it cannot write as given. */
export function writeDxf(doc: DxfDocument, options: DxfWriteOptions = {}): DxfWriteResult {
  const version: DxfVersion = options.version ?? 'AC1015';
  if (version !== 'AC1015' && version !== 'AC1009') throw new DxfWriteError('BAD_ENTITY', `version ${String(version)}`);
  if (!(doc.units in INSUNITS)) throw new DxfWriteError('BAD_ENTITY', `units ${String(doc.units)}`);
  const tol = options.r12ChordTolerance;
  if (tol !== undefined && !(tol > 0 && Number.isFinite(tol))) throw new DxfWriteError('BAD_ENTITY', `r12ChordTolerance ${tol}`);
  const layers = doc.layers ?? [], linetypes = doc.linetypes ?? [], styles = doc.styles ?? [], userBlocks = doc.blocks ?? [];
  const ctx: Context = {
    version, layers: new Set(['0']), linetypes: new Set(BUILTIN_LTYPES), styles: new Set(['Standard']), blocks: new Map(), tolerance: tol,
    r12: { ellipses: 0, splines: 0, polylines: 0, mtexts: 0, hatches: 0, maxChordDeviation: 0, unitsNotStored: version === 'AC1009', lineweightsDropped: false },
  };
  const unique = (set: Set<string>, name: string, what: string) => {
    checkName(name, what, version);
    const key = name.toUpperCase();
    if ([...set].some(x => x.toUpperCase() === key)) throw new DxfWriteError('DUPLICATE_NAME', `${what} ${JSON.stringify(name)}`);
    set.add(name);
  };
  for (const t of linetypes) {
    unique(ctx.linetypes, t.name, 'line type');
    if (!t.pattern.length || t.pattern.some(x => !Number.isFinite(x))) throw new DxfWriteError('BAD_ENTITY', `line type ${t.name} pattern`);
    if (typeof t.description !== 'string') throw new DxfWriteError('BAD_ENTITY', `line type ${t.name} description`);
    dxfText(t.description, false);
  }
  for (const l of layers) {
    if (l.name === '0') throw new DxfWriteError('DUPLICATE_NAME', 'layer 0 is always defined');
    unique(ctx.layers, l.name, 'layer');
    if (l.linetype !== undefined && !ctx.linetypes.has(l.linetype)) throw new DxfWriteError('UNKNOWN_LINETYPE', `layer ${l.name} line type ${JSON.stringify(l.linetype)}`);
    if (l.color !== undefined && !(Number.isInteger(l.color) && l.color >= 1 && l.color <= 255)) throw new DxfWriteError('BAD_ENTITY', `layer ${l.name} colour ${l.color}`);
    if (l.lineweight !== undefined) {
      if (!(Number.isInteger(l.lineweight) && l.lineweight >= 0 && l.lineweight <= 211)) throw new DxfWriteError('BAD_ENTITY', `layer ${l.name} line weight ${l.lineweight}`);
      if (version === 'AC1009') ctx.r12.lineweightsDropped = true;
    }
  }
  for (const s of styles) { unique(ctx.styles, s.name, 'text style'); if (typeof s.font !== 'string' || !s.font) throw new DxfWriteError('BAD_ENTITY', `text style ${s.name} font`); }
  for (const b of userBlocks) {
    if (b.name.startsWith('*')) throw new DxfWriteError('BAD_NAME', `block ${JSON.stringify(b.name)}: names starting * are the writer's own`);
    const names = new Set(ctx.blocks.keys()); unique(names, b.name, 'block'); ctx.blocks.set(b.name, b);
    if (b.base) finite(b.base, `block ${b.name} base`);
  }
  for (const b of userBlocks) for (const e of b.entities) checkEntity(e, ctx, true);
  checkCycles(ctx.blocks);
  for (const e of doc.entities) checkEntity(e, ctx, false);

  const box = new Box();
  for (const e of doc.entities) entityExtents(e, box, ctx.blocks, IDENTITY);
  const extents = box.empty ? null : { min: [box.x0, box.y0] as [number, number], max: [box.x1, box.y1] as [number, number] };
  const dims = doc.entities.filter((e): e is Extract<DxfEntity, { type: 'dimension' }> => e.type === 'dimension');
  const dimBlocks = dims.map((_, k) => `*D${k + 1}`);
  const report: DxfWriteReport = { contract: DXF_WRITER_VERSION, version, modelSpace: {}, blocks: {}, extents };
  const text = version === 'AC1015' ? writeAc1015(doc, ctx, dims, dimBlocks, report) : writeAc1009(doc, ctx, dims, dimBlocks, report);
  if (version === 'AC1009') report.r12 = ctx.r12;
  return { text, bytes: encode(text), report };
}

function view(extents: DxfWriteReport['extents']): { cx: number; cy: number; height: number; x0: number; y0: number; x1: number; y1: number } {
  if (!extents) return { cx: 0, cy: 0, height: 1, x0: 0, y0: 0, x1: 0, y1: 0 };
  const [x0, y0] = extents.min, [x1, y1] = extents.max;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, height: Math.max(1e-6, (y1 - y0) * 1.1, (x1 - x0) * 1.1 / 1.5), x0, y0, x1, y1 };
}

function writeAc1015(doc: DxfDocument, ctx: Context, dims: Extract<DxfEntity, { type: 'dimension' }>[], dimBlocks: string[], report: DxfWriteReport): string {
  const h = new Handles(), body = new Out();
  // Handles first, in a fixed order, so owners and pointers are known before they are written.
  const T = { vport: h.take(), ltype: h.take(), layer: h.take(), style: h.take(), view: h.take(), ucs: h.take(), appid: h.take(), dimstyle: h.take(), blockRecord: h.take() };
  const D = { root: h.take(), group: h.take(), layout: h.take(), plotStyle: h.take(), placeholder: h.take(), model: h.take(), layout1: h.take() };
  const blockList: { name: string; base: DxfXY; entities: readonly DxfEntity[]; flags: number; record: string; begin: string; end: string; paper?: boolean }[] = [
    { name: '*Model_Space', base: [0, 0], entities: [], flags: 0, record: h.take(), begin: h.take(), end: h.take() },
    { name: '*Paper_Space', base: [0, 0], entities: [], flags: 0, record: h.take(), begin: h.take(), end: h.take(), paper: true },
    ...(doc.blocks ?? []).map(b => ({ name: b.name, base: b.base ?? [0, 0] as DxfXY, entities: b.entities, flags: 0, record: h.take(), begin: h.take(), end: h.take() })),
    ...dims.map((d, k) => ({ name: dimBlocks[k], base: [0, 0] as DxfXY, entities: d.block, flags: 1, record: h.take(), begin: h.take(), end: h.take() })),
  ];
  const ltypes = [{ name: 'ByBlock', description: '', pattern: [] as readonly number[] }, { name: 'ByLayer', description: '', pattern: [] }, { name: 'Continuous', description: 'Solid line', pattern: [] }, ...(doc.linetypes ?? [])];
  const layers: DxfLayer[] = [{ name: '0', color: 7, linetype: 'Continuous' }, ...(doc.layers ?? [])];
  const styles: DxfTextStyle[] = [{ name: 'Standard', font: 'txt' }, ...(doc.styles ?? [])];
  const o = body, v = view(report.extents);
  const table = (name: string, handle: string, count: number) => { o.g(0, 'TABLE'); o.g(2, name); o.g(5, handle); o.g(330, '0'); o.g(100, 'AcDbSymbolTable'); o.g(70, count); };
  const record = (type: string, handle: string, owner: string, subclass: string, handleCode = 5) => { o.g(0, type); o.g(handleCode, handle); o.g(330, owner); o.g(100, 'AcDbSymbolTableRecord'); o.g(100, subclass); };

  o.g(0, 'SECTION'); o.g(2, 'CLASSES'); o.g(0, 'ENDSEC');
  o.g(0, 'SECTION'); o.g(2, 'TABLES');
  table('VPORT', T.vport, 1);
  record('VPORT', h.take(), T.vport, 'AcDbViewportTableRecord');
  o.g(2, '*Active'); o.g(70, 0); o.xy(10, [0, 0]); o.xy(11, [1, 1]); o.xy(12, [v.cx, v.cy]); o.xy(13, [0, 0]); o.xy(14, [10, 10]); o.xy(15, [10, 10]);
  o.g(16, 0); o.g(26, 0); o.g(36, 1); o.g(17, 0); o.g(27, 0); o.g(37, 0); o.g(40, v.height); o.g(41, 1.5); o.g(42, 50); o.g(43, 0); o.g(44, 0); o.g(50, 0); o.g(51, 0);
  o.g(71, 0); o.g(72, 1000); o.g(73, 1); o.g(74, 3); o.g(75, 0); o.g(76, 0); o.g(77, 0); o.g(78, 0); o.g(281, 0); o.g(65, 0); o.g(146, 0);
  o.g(0, 'ENDTAB');
  table('LTYPE', T.ltype, ltypes.length);
  for (const t of ltypes) {
    record('LTYPE', h.take(), T.ltype, 'AcDbLinetypeTableRecord');
    o.g(2, t.name); o.g(70, 0); o.g(3, dxfText(t.description, false)); o.g(72, 65); o.g(73, t.pattern.length); o.g(40, t.pattern.reduce((s, x) => s + Math.abs(x), 0));
    for (const x of t.pattern) { o.g(49, x); o.g(74, 0); }
  }
  o.g(0, 'ENDTAB');
  table('LAYER', T.layer, layers.length);
  for (const l of layers) {
    record('LAYER', h.take(), T.layer, 'AcDbLayerTableRecord');
    o.g(2, l.name); o.g(70, 0); o.g(62, l.color ?? 7); o.g(6, l.linetype ?? 'Continuous'); o.g(370, l.lineweight ?? -3); o.g(390, D.placeholder);
  }
  o.g(0, 'ENDTAB');
  table('STYLE', T.style, styles.length);
  for (const s of styles) { record('STYLE', h.take(), T.style, 'AcDbTextStyleTableRecord'); o.g(2, s.name); o.g(70, 0); o.g(40, 0); o.g(41, 1); o.g(50, 0); o.g(71, 0); o.g(42, 2.5); o.g(3, s.font); o.g(4, ''); }
  o.g(0, 'ENDTAB');
  table('VIEW', T.view, 0); o.g(0, 'ENDTAB');
  table('UCS', T.ucs, 0); o.g(0, 'ENDTAB');
  table('APPID', T.appid, 1); record('APPID', h.take(), T.appid, 'AcDbRegAppTableRecord'); o.g(2, 'ACAD'); o.g(70, 0); o.g(0, 'ENDTAB');
  table('DIMSTYLE', T.dimstyle, 1); o.g(100, 'AcDbDimStyleTable');
  record('DIMSTYLE', h.take(), T.dimstyle, 'AcDbDimStyleTableRecord', 105);
  // Arrows 3, text 3.5, extension lines 1 off the part and 2 past the dimension line, gap 1, two decimals (what the studio draws).
  o.g(2, 'Standard'); o.g(70, 0); o.g(40, 1); o.g(41, 3); o.g(42, 1); o.g(44, 2); o.g(140, 3.5); o.g(147, 1); o.g(77, 1); o.g(271, 2); o.g(277, 2);
  o.g(0, 'ENDTAB');
  table('BLOCK_RECORD', T.blockRecord, blockList.length);
  for (const b of blockList) {
    record('BLOCK_RECORD', b.record, T.blockRecord, 'AcDbBlockTableRecord'); o.g(2, b.name);
    o.g(340, b.name === '*Model_Space' ? D.model : b.name === '*Paper_Space' ? D.layout1 : '0');
  }
  o.g(0, 'ENDTAB');
  o.g(0, 'ENDSEC');

  const w: Writer = { o, v: 'AC1015', h, ctx, counts: {}, owner: blockList[0].record, dimBlocks, dimIndex: 0 };
  o.g(0, 'SECTION'); o.g(2, 'BLOCKS');
  for (const b of blockList) {
    o.g(0, 'BLOCK'); o.g(5, b.begin); o.g(330, b.record); o.g(100, 'AcDbEntity'); if (b.paper) o.g(67, 1); o.g(8, '0'); o.g(100, 'AcDbBlockBegin');
    o.g(2, b.name); o.g(70, b.flags); o.xyz(10, b.base); o.g(3, b.name); o.g(1, '');
    w.owner = b.record; w.counts = {};
    for (const e of b.entities) writeEntity(w, e);
    if (b.name !== '*Model_Space' && b.name !== '*Paper_Space') report.blocks[b.name] = w.counts;
    o.g(0, 'ENDBLK'); o.g(5, b.end); o.g(330, b.record); o.g(100, 'AcDbEntity'); if (b.paper) o.g(67, 1); o.g(8, '0'); o.g(100, 'AcDbBlockEnd');
  }
  o.g(0, 'ENDSEC');
  o.g(0, 'SECTION'); o.g(2, 'ENTITIES');
  w.owner = blockList[0].record; w.counts = {};
  for (const e of doc.entities) writeEntity(w, e);
  report.modelSpace = w.counts;
  o.g(0, 'ENDSEC');

  o.g(0, 'SECTION'); o.g(2, 'OBJECTS');
  o.g(0, 'DICTIONARY'); o.g(5, D.root); o.g(330, '0'); o.g(100, 'AcDbDictionary'); o.g(281, 1);
  o.g(3, 'ACAD_GROUP'); o.g(350, D.group); o.g(3, 'ACAD_LAYOUT'); o.g(350, D.layout); o.g(3, 'ACAD_PLOTSTYLENAME'); o.g(350, D.plotStyle);
  o.g(0, 'DICTIONARY'); o.g(5, D.group); o.g(330, D.root); o.g(100, 'AcDbDictionary'); o.g(281, 1);
  o.g(0, 'DICTIONARY'); o.g(5, D.layout); o.g(330, D.root); o.g(100, 'AcDbDictionary'); o.g(281, 1); o.g(3, 'Model'); o.g(350, D.model); o.g(3, 'Layout1'); o.g(350, D.layout1);
  o.g(0, 'ACDBDICTIONARYWDFLT'); o.g(5, D.plotStyle); o.g(330, D.root); o.g(100, 'AcDbDictionary'); o.g(281, 1); o.g(3, 'Normal'); o.g(350, D.placeholder); o.g(100, 'AcDbDictionaryWithDefault'); o.g(340, D.placeholder);
  o.g(0, 'ACDBPLACEHOLDER'); o.g(5, D.placeholder); o.g(330, D.plotStyle);
  for (const [handle, name, flags, tab, owner] of [[D.model, 'Model', 1024, 0, blockList[0].record], [D.layout1, 'Layout1', 0, 1, blockList[1].record]] as const) {
    o.g(0, 'LAYOUT'); o.g(5, handle); o.g(330, D.layout); o.g(100, 'AcDbPlotSettings');
    o.g(1, ''); o.g(4, ''); o.g(6, ''); o.g(40, 0); o.g(41, 0); o.g(42, 0); o.g(43, 0); o.g(44, 0); o.g(45, 0); o.g(46, 0); o.g(47, 0); o.g(48, 0); o.g(49, 0); o.g(140, 0); o.g(141, 0); o.g(142, 1); o.g(143, 1);
    o.g(70, flags); o.g(72, 1); o.g(73, 0); o.g(74, 5); o.g(7, ''); o.g(75, 16); o.g(147, 1); o.g(148, 0); o.g(149, 0);
    o.g(100, 'AcDbLayout'); o.g(1, name); o.g(70, 1); o.g(71, tab);
    o.xy(10, [0, 0]); o.xy(11, [v.x1, v.y1]); o.xyz(12, [0, 0]); o.xyz(14, [v.x0, v.y0]); o.xyz(15, [v.x1, v.y1]); o.g(146, 0);
    o.xyz(13, [0, 0]); o.g(16, 1); o.g(26, 0); o.g(36, 0); o.g(17, 0); o.g(27, 1); o.g(37, 0); o.g(76, 1); o.g(330, owner);
  }
  o.g(0, 'ENDSEC');
  o.g(0, 'EOF');

  const hd = new Out();
  hd.g(0, 'SECTION'); hd.g(2, 'HEADER');
  hd.g(9, '$ACADVER'); hd.g(1, 'AC1015');
  hd.g(9, '$ACADMAINTVER'); hd.g(70, 6);
  hd.g(9, '$DWGCODEPAGE'); hd.g(3, 'ANSI_1252');
  headerCommon(hd, v, ctx.version);
  hd.g(9, '$INSUNITS'); hd.g(70, INSUNITS[doc.units]);
  hd.g(9, '$MEASUREMENT'); hd.g(70, doc.units === 'in' || doc.units === 'ft' ? 0 : 1);
  hd.g(9, '$LWDISPLAY'); hd.g(290, 1);
  hd.g(9, '$HANDSEED'); hd.g(5, h.seed);
  hd.g(0, 'ENDSEC');
  return [...hd.lines, ...body.lines].join('\n') + '\n';
}

function headerCommon(hd: Out, v: ReturnType<typeof view>, version: DxfVersion): void {
  hd.g(9, '$INSBASE'); hd.xyz(10, [0, 0]);
  hd.g(9, '$EXTMIN'); hd.xyz(10, [v.x0, v.y0]);
  hd.g(9, '$EXTMAX'); hd.xyz(10, [v.x1, v.y1]);
  hd.g(9, '$LIMMIN'); hd.xy(10, [v.x0, v.y0]);
  hd.g(9, '$LIMMAX'); hd.xy(10, [v.x1, v.y1]);
  hd.g(9, '$LTSCALE'); hd.g(40, 1);
  hd.g(9, '$CLAYER'); hd.g(8, '0');
  hd.g(9, '$TEXTSTYLE'); hd.g(7, version === 'AC1009' ? 'STANDARD' : 'Standard');
  hd.g(9, '$DIMSTYLE'); hd.g(2, version === 'AC1009' ? 'STANDARD' : 'Standard');
  hd.g(9, '$LUNITS'); hd.g(70, 2);
  hd.g(9, '$LUPREC'); hd.g(70, 4);
}

function writeAc1009(doc: DxfDocument, ctx: Context, dims: Extract<DxfEntity, { type: 'dimension' }>[], dimBlocks: string[], report: DxfWriteReport): string {
  const o = new Out(), v = view(report.extents);
  o.g(0, 'SECTION'); o.g(2, 'HEADER');
  o.g(9, '$ACADVER'); o.g(1, 'AC1009');
  o.g(9, '$DWGCODEPAGE'); o.g(3, 'ANSI_1252');
  headerCommon(o, v, 'AC1009');
  o.g(0, 'ENDSEC');
  const ltypes = [{ name: 'CONTINUOUS', description: 'Solid line', pattern: [] as readonly number[] }, ...(doc.linetypes ?? [])];
  const layers: DxfLayer[] = [{ name: '0', color: 7, linetype: 'CONTINUOUS' }, ...(doc.layers ?? [])];
  const styles: DxfTextStyle[] = [{ name: 'STANDARD', font: 'txt' }, ...(doc.styles ?? [])];
  o.g(0, 'SECTION'); o.g(2, 'TABLES');
  o.g(0, 'TABLE'); o.g(2, 'LTYPE'); o.g(70, ltypes.length);
  for (const t of ltypes) { o.g(0, 'LTYPE'); o.g(2, t.name); o.g(70, 0); o.g(3, dxfText(t.description, false)); o.g(72, 65); o.g(73, t.pattern.length); o.g(40, t.pattern.reduce((s, x) => s + Math.abs(x), 0)); for (const x of t.pattern) o.g(49, x); }
  o.g(0, 'ENDTAB');
  o.g(0, 'TABLE'); o.g(2, 'LAYER'); o.g(70, layers.length);
  for (const l of layers) { o.g(0, 'LAYER'); o.g(2, l.name); o.g(70, 0); o.g(62, l.color ?? 7); o.g(6, l.linetype === undefined || l.linetype === 'Continuous' ? 'CONTINUOUS' : l.linetype); }
  o.g(0, 'ENDTAB');
  o.g(0, 'TABLE'); o.g(2, 'STYLE'); o.g(70, styles.length);
  for (const s of styles) { o.g(0, 'STYLE'); o.g(2, s.name === 'Standard' ? 'STANDARD' : s.name); o.g(70, 0); o.g(40, 0); o.g(41, 1); o.g(50, 0); o.g(71, 0); o.g(42, 2.5); o.g(3, s.font); o.g(4, ''); }
  o.g(0, 'ENDTAB');
  o.g(0, 'TABLE'); o.g(2, 'APPID'); o.g(70, 1); o.g(0, 'APPID'); o.g(2, 'ACAD'); o.g(70, 0); o.g(0, 'ENDTAB');
  o.g(0, 'TABLE'); o.g(2, 'DIMSTYLE'); o.g(70, 1);
  o.g(0, 'DIMSTYLE'); o.g(2, 'STANDARD'); o.g(70, 0); o.g(40, 1); o.g(41, 3); o.g(42, 1); o.g(44, 2); o.g(140, 3.5); o.g(147, 1); o.g(77, 1);
  o.g(0, 'ENDTAB');
  o.g(0, 'ENDSEC');
  const w: Writer = { o, v: 'AC1009', h: new Handles(), ctx, counts: {}, owner: '0', dimBlocks, dimIndex: 0 };
  o.g(0, 'SECTION'); o.g(2, 'BLOCKS');
  const blocks = [...(doc.blocks ?? []).map(b => ({ name: b.name, base: b.base ?? [0, 0] as DxfXY, entities: b.entities, flags: 0 })), ...dims.map((d, k) => ({ name: dimBlocks[k], base: [0, 0] as DxfXY, entities: d.block, flags: 1 }))];
  for (const b of blocks) {
    o.g(0, 'BLOCK'); o.g(8, '0'); o.g(2, b.name); o.g(70, b.flags); o.xyz(10, b.base); o.g(3, b.name);
    w.counts = {};
    for (const e of b.entities) writeEntity(w, withR12Style(e));
    report.blocks[b.name] = w.counts;
    o.g(0, 'ENDBLK'); o.g(8, '0');
  }
  o.g(0, 'ENDSEC');
  o.g(0, 'SECTION'); o.g(2, 'ENTITIES');
  w.counts = {};
  for (const e of doc.entities) writeEntity(w, withR12Style(e));
  report.modelSpace = w.counts;
  o.g(0, 'ENDSEC');
  o.g(0, 'EOF');
  return o.lines.join('\n') + '\n';
}

/** R12 names its default text style STANDARD. */
function withR12Style(e: DxfEntity): DxfEntity {
  if ((e.type === 'text' || e.type === 'mtext') && e.style === 'Standard') return { ...e, style: 'STANDARD' };
  if (e.type === 'dimension' && e.block.some(b => (b.type === 'text' || b.type === 'mtext') && b.style === 'Standard')) return { ...e, block: e.block.map(withR12Style) };
  return e;
}
