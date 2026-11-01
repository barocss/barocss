// DR-6 datum targets (ASME Y14.5-2018 section 7.24, ISO 5459). A point target is an explicit endpoint on a signed current
// straight B-rep edge. A line target runs between two points and an area target is a circle or rectangle about a point;
// those two are placed by explicit view points (view mm) and do not follow the geometry.
import type { BrepProjection } from '@barocss/cad';
import { problem, type Problem } from '../engine/refusal';
import { sameDatumTargetSourceSig, toSig, type Sig } from '../engine/references';
import { PLAIN, formatLength, type StandardPreset } from './standard';
import type { Vec3, ViewId, XY } from './types';

export type DatumTargetKind = 'point' | 'line' | 'area';
/** An area target in model mm, centred on `at` (view mm): a circle of diameter d, or a w (across) by h (up) rectangle. */
export type DatumTargetArea = { shape: 'circle'; at: XY; d: number } | { shape: 'rect'; at: XY; w: number; h: number };
/** min/max is the lexicographic x, then y, then z endpoint. The near hint never chooses again. */
export type DatumTargetPoint = { edge: string; at: 'end'; near: Vec3; endpoint?: 'min' | 'max'; sig?: Sig; was?: string };
interface DatumTargetBase { id: string; letter: string; number: number; view: ViewId; place: XY; /** Only a point target (the standard moveable symbol). */ moveable?: true }
/** `kind` is stored only for line and area; a point target has none. */
export type DrawingPointDatumTarget = DatumTargetBase & { kind?: 'point'; point: DatumTargetPoint; line?: never; area?: never };
export type DrawingLineDatumTarget = DatumTargetBase & { kind: 'line'; line: { from: XY; to: XY }; point?: never; area?: never };
export type DrawingAreaDatumTarget = DatumTargetBase & { kind: 'area'; area: DatumTargetArea; point?: never; line?: never };
export type DrawingDatumTarget = DrawingPointDatumTarget | DrawingLineDatumTarget | DrawingAreaDatumTarget;
export type DatumTargetFailureCode = 'DATUM_TARGET_INVALID' | 'DATUM_TARGET_LOST' | 'DATUM_TARGET_AMBIGUOUS' | 'DATUM_TARGET_UNSUPPORTED' | 'DATUM_TARGET_DUPLICATE' | 'DATUM_TARGET_UNVERIFIED';
/** A line or area target resolves to a model point on its view plane (no edge). */
export type DatumTargetResolution = { ok: true; at: Vec3; edge?: string } | { ok: false; code: DatumTargetFailureCode; reason: string };

const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const label = (x: unknown): x is string => typeof x === 'string' && !!x.trim() && x.length <= 512;
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const keys = (x: Record<string, unknown>, allowed: readonly string[]) => Object.keys(x).every(k => allowed.includes(k));
function tuple(x: unknown, size: number): boolean {
  if (!Array.isArray(x) || x.length !== size) return false;
  for (let k = 0; k < size; k++) if (!Object.hasOwn(x, k) || !finite(x[k])) return false;
  return true;
}
const signature = (x: unknown): x is Sig => record(x) && keys(x, ['k', 'p', 'd', 's', 'r', 'n']) && typeof x.k === 'string' && tuple(x.p, 3) && finite(x.s) &&
  (x.d === undefined || tuple(x.d, 3)) && (x.r === undefined || finite(x.r)) && (x.n === undefined || finite(x.n));
const KEYS = ['id', 'letter', 'number', 'view', 'place', 'kind', 'point', 'line', 'area', 'moveable'] as const;
const sizeOk = (x: unknown): x is number => finite(x) && x > 0 && x <= 100000;
/** Why a row is not a datum target, in plain words (null: it is one). Saved rows are read as loosely as before: a number above 99 stays. */
function reasonOf(x: unknown, authored: boolean): string | null {
  if (!record(x) || !keys(x, KEYS)) return 'A datum target has an id, letter, number, view, place, a kind and that kind\'s geometry. No other keys.';
  if (!label(x.id)) return 'The datum target id must be a short non-empty text.';
  if (typeof x.letter !== 'string' || !/^[A-HJ-NPR-Z]$/.test(x.letter)) return 'The datum letter is one of A to Z without I, O and Q.';
  if (typeof x.number !== 'number' || !Number.isSafeInteger(x.number) || x.number <= 0 || (authored && x.number > 99)) return 'The target number is a whole number from 1 to 99.';
  if (typeof x.view !== 'string' || !['front', 'top', 'right', 'iso'].includes(x.view)) return 'The datum target view is front, top, right or iso.';
  if (!tuple(x.place, 2)) return 'The symbol place needs two numbers in view mm.';
  const kind = x.kind ?? 'point';
  if (kind !== 'point' && kind !== 'line' && kind !== 'area') return 'The datum target kind is point, line or area.';
  if (x.moveable !== undefined && x.moveable !== true) return 'moveable is true or left out.';
  if (x.moveable && kind !== 'point') return 'Only a point datum target can be moveable.';
  for (const k of ['point', 'line', 'area'] as const) if (k !== kind && x[k] !== undefined) return `A ${kind} datum target has no ${k} geometry.`;
  if (kind === 'point') {
    const p = x.point;
    return record(p) && keys(p, ['edge', 'at', 'near', 'endpoint', 'sig', 'was']) && label(p.edge) && p.at === 'end' && tuple(p.near, 3) &&
      (p.endpoint === 'min' || p.endpoint === 'max' || !authored && p.endpoint === undefined) &&
      (p.sig === undefined || signature(p.sig)) && (p.was === undefined || typeof p.was === 'string') ? null : 'A point target needs {edge, at: end, near[3], endpoint: min|max, sig?, was?}.';
  }
  if (kind === 'line') {
    const l = x.line;
    if (!record(l) || !keys(l, ['from', 'to']) || !tuple(l.from, 2) || !tuple(l.to, 2)) return 'A line target needs line {from[2], to[2]} in view mm.';
    const [a, b] = [l.from as number[], l.to as number[]];
    return a[0] === b[0] && a[1] === b[1] ? 'A target line needs two distinct points.' : null;
  }
  const a = x.area;
  if (!record(a) || !keys(a, ['shape', 'at', 'd', 'w', 'h']) || !tuple(a.at, 2)) return 'An area target needs area {shape: circle|rect, at[2], and d or w and h}.';
  if (a.shape === 'circle') return a.w === undefined && a.h === undefined && sizeOk(a.d) ? null : 'A circular area target needs a diameter d above zero (and no w or h).';
  if (a.shape === 'rect') return a.d === undefined && sizeOk(a.w) && sizeOk(a.h) ? null : 'A rectangular area target needs a width w and a height h above zero (and no d).';
  return 'The area shape is circle or rect.';
}
function targetOk(x: unknown, authored = false): x is DrawingDatumTarget { return reasonOf(x, authored) === null; }
/** The kind a row has: a point target stores none. */
export const datumTargetKind = (t: Pick<DrawingDatumTarget, 'kind'>): DatumTargetKind => t.kind ?? 'point';
/** The upper half of an area target's symbol: Ø6 for a circle, 6×4 for a rectangle; null for a point or a line. */
export function datumTargetSizeText(t: DrawingDatumTarget, p: StandardPreset = PLAIN): string | null {
  if (t.kind !== 'area') return null;
  const f = (mm: number) => formatLength(mm, p);
  return t.area.shape === 'circle' ? `Ø${f(t.area.d)}` : `${f(t.area.w)}×${f(t.area.h)}`;
}

/** Authored inputs are accepted as a whole. Omitted keeps the saved targets; [] clears them. */
export function checkDatumTargetOptions(args: Record<string, unknown>): Problem[] {
  if (!('datumTargets' in args)) return [];
  const raw = args.datumTargets, ids = new Set<string>(), labels = new Set<string>();
  if (!Array.isArray(raw) || raw.length > 200) return [problem('DRAWING_OPTIONS', 'datumTargets is a list of at most 200 targets.')];
  for (let k = 0; k < raw.length; k++) {
    const target = raw[k], at = `datumTargets[${k}]: `;
    if (!Object.hasOwn(raw, k)) return [problem('DRAWING_OPTIONS', `${at}is missing.`)];
    const why = reasonOf(target, true);
    if (why) return [problem('DRAWING_OPTIONS', at + why)];
    const t = target as DrawingDatumTarget, name = `${t.letter}${t.number}`;
    if (ids.has(t.id)) return [problem('DRAWING_OPTIONS', `${at}the id ${t.id} is used twice.`)];
    if (labels.has(name)) return [problem('DRAWING_OPTIONS', `${at}${name} is used twice; each number is used once per datum letter.`)];
    ids.add(t.id); labels.add(name);
  }
  return [];
}

/** Keep valid saved rows, including duplicates, so consumers can diagnose them without losing evidence. Key order is the canonical one. */
export function readDatumTargets(raw: unknown): DrawingDatumTarget[] {
  const out: DrawingDatumTarget[] = [];
  if (!Array.isArray(raw)) return out;
  for (const target of raw) {
    if (!targetOk(target)) continue;
    const head = { id: target.id, letter: target.letter, number: target.number, view: target.view, place: [target.place[0], target.place[1]] as XY };
    const moveable = target.moveable ? { moveable: true as const } : {};
    if (target.kind === 'line') { out.push({ ...head, kind: 'line', line: { from: [target.line.from[0], target.line.from[1]], to: [target.line.to[0], target.line.to[1]] } }); continue; }
    if (target.kind === 'area') {
      const a = target.area, at: XY = [a.at[0], a.at[1]];
      out.push({ ...head, kind: 'area', area: a.shape === 'circle' ? { shape: 'circle', at, d: a.d } : { shape: 'rect', at, w: a.w, h: a.h } }); continue;
    }
    const p = target.point;
    out.push({ ...head, point: {
      edge: p.edge, at: 'end', near: [p.near[0], p.near[1], p.near[2]],
      ...(p.endpoint !== undefined ? { endpoint: p.endpoint } : {}),
      ...(p.sig ? { sig: { ...p.sig, p: [...p.sig.p] as Vec3, ...(p.sig.d ? { d: [...p.sig.d] as Vec3 } : {}) } } : {}),
      ...(p.was !== undefined ? { was: p.was } : {}),
    }, ...moveable });
  }
  return out;
}

/** All rows sharing an id or a datum letter/number; no first row is silently preferred. */
export function datumTargetConflicts(targets: readonly DrawingDatumTarget[]): ReadonlySet<DrawingDatumTarget> {
  const ids = new Map<string, number>(), labels = new Map<string, number>();
  for (const target of targets) {
    const pair = `${target.letter}:${target.number}`;
    ids.set(target.id, (ids.get(target.id) ?? 0) + 1);
    labels.set(pair, (labels.get(pair) ?? 0) + 1);
  }
  return new Set(targets.filter(target => ids.get(target.id)! > 1 || labels.get(`${target.letter}:${target.number}`)! > 1));
}

const xy = { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } };
const vector = { ...xy, minItems: 3, maxItems: 3 };
const sig = { type: 'object', properties: { k: { type: 'string' }, p: vector, d: vector, s: { type: 'number' }, r: { type: 'number' }, n: { type: 'number' } }, required: ['k', 'p', 's'], additionalProperties: false };
const size = { type: 'number', exclusiveMinimum: 0, maximum: 100000 };
const area = {
  type: 'object', description: 'Area target, model mm, centred on at (view mm): circle {shape, at, d} or rect {shape, at, w, h}.',
  properties: { shape: { type: 'string', enum: ['circle', 'rect'] }, at: xy, d: size, w: size, h: size }, required: ['shape', 'at'], additionalProperties: false,
  oneOf: [{ properties: { shape: { enum: ['circle'] } }, required: ['d'] }, { properties: { shape: { enum: ['rect'] } }, required: ['w', 'h'] }],
};
export const datumTargetsProperty = {
  type: 'array', maxItems: 200,
  description: 'Datum targets (ASME Y14.5 7.24). [] clears; omitted keeps. Unique ids and (letter, number) pairs, number 1 to 99. kind point (default): an endpoint of a straight edge, point {edge, at, near, endpoint, sig}; endpoint min/max orders the two 3D endpoints by x, then y, then z; near is only a hint; a captured current straight-edge signature is required to render; legacy near-only, unsigned, changed or re-matched references stay unresolved. kind line: line {from, to} two distinct view-mm points, drawn as a phantom line. kind area: area (circle d or rect w, h), drawn with a phantom outline and hatching, its size in the symbol. Line and area are placed by view points and do not follow the geometry. moveable (point only) draws the moveable symbol.',
  items: {
    type: 'object', properties: {
      id: { type: 'string', minLength: 1, maxLength: 512, pattern: '\\S' },
      letter: { type: 'string', pattern: '^[A-HJ-NPR-Z]$' },
      number: { type: 'integer', minimum: 1, maximum: 99 },
      view: { type: 'string', enum: ['front', 'top', 'right', 'iso'] }, place: xy,
      kind: { type: 'string', enum: ['point', 'line', 'area'] },
      point: { type: 'object', properties: { edge: { type: 'string', minLength: 1, maxLength: 512, pattern: '\\S' }, at: { type: 'string', enum: ['end'] }, near: vector, endpoint: { type: 'string', enum: ['min', 'max'] }, sig, was: { type: 'string' } }, required: ['edge', 'at', 'near', 'endpoint'], additionalProperties: false },
      line: { type: 'object', properties: { from: xy, to: xy }, required: ['from', 'to'], additionalProperties: false },
      area, moveable: { type: 'boolean', enum: [true] },
    }, required: ['id', 'letter', 'number', 'view', 'place'], additionalProperties: false,
    // Exactly the geometry of its kind: no point (the default), line only with kind line, area only with kind area.
    oneOf: [
      { properties: { kind: { enum: ['point'] } }, required: ['point'] },
      { properties: { kind: { enum: ['line'] } }, required: ['kind', 'line'] },
      { properties: { kind: { enum: ['area'] } }, required: ['kind', 'area'] },
    ],
  },
};

/** A line or area target's reference point in the model: its middle on the view plane, at the part's front-most depth along the view. */
function freePoint(pr: BrepProjection, t: DrawingDatumTarget): Vec3 {
  const c: XY = t.kind === 'line' ? [(t.line.from[0] + t.line.to[0]) / 2, (t.line.from[1] + t.line.to[1]) / 2] : t.kind === 'area' ? t.area.at : [0, 0];
  let depth = -Infinity;
  for (const e of pr.edges) for (const q of [...(e.ends ?? []), ...(e.circle ? [e.circle.center] : [])]) depth = Math.max(depth, q[0] * pr.toward[0] + q[1] * pr.toward[1] + q[2] * pr.toward[2]);
  if (!Number.isFinite(depth)) depth = 0;
  return [0, 1, 2].map(k => pr.right[k] * c[0] + pr.up[k] * c[1] + pr.toward[k] * depth + 0) as Vec3;
}

function orderedEnds(ends: readonly Vec3[] | null): [Vec3, Vec3] | null {
  if (!ends || ends.length !== 2 || !tuple(ends[0], 3) || !tuple(ends[1], 3)) return null;
  for (let k = 0; k < 3; k++) {
    if (ends[0][k] < ends[1][k]) return [ends[0], ends[1]];
    if (ends[0][k] > ends[1][k]) return [ends[1], ends[0]];
  }
  return null;
}

/** Record the chosen current endpoint, independent of projection or mesh endpoint order. */
export function datumTargetEndpoint(ends: readonly Vec3[] | null, at: Vec3): 'min' | 'max' | null {
  const pair = orderedEnds(ends);
  if (!pair || !tuple(at, 3)) return null;
  if (pair[0].every((v, k) => v === at[k])) return 'min';
  if (pair[1].every((v, k) => v === at[k])) return 'max';
  return null;
}

/** No fallback to another name, the old hint, a circle, or a changed source edge. */
export function resolveDatumTarget(projection: BrepProjection, target: DrawingDatumTarget): DatumTargetResolution {
  if (!targetOk(target)) return { ok: false, code: 'DATUM_TARGET_INVALID', reason: 'The datum target input is invalid.' };
  if (target.kind === 'line' || target.kind === 'area') return { ok: true, at: freePoint(projection, target) };
  const edges = projection.edges.filter(e => e.name === target.point.edge);
  if (!edges.length) return { ok: false, code: 'DATUM_TARGET_LOST', reason: 'The datum target edge is not in the current projection.' };
  if (edges.length !== 1) return { ok: false, code: 'DATUM_TARGET_AMBIGUOUS', reason: 'The datum target edge name has more than one current candidate.' };
  const edge = edges[0], ends = edge.ends;
  // The projector assigns line only to straight B-rep edges; silhouettes have their own kind.
  if (edge.kind !== 'line' || edge.circle !== null || !Array.isArray(ends) || ends.length !== 2 || !tuple(ends[0], 3) || !tuple(ends[1], 3)) return { ok: false, code: 'DATUM_TARGET_UNSUPPORTED', reason: 'The datum target needs a straight B-rep edge with finite 3D endpoints.' };
  const pair = orderedEnds(ends);
  if (!pair) return { ok: false, code: 'DATUM_TARGET_AMBIGUOUS', reason: 'The current edge has no distinct endpoint pair.' };
  if (!target.point.endpoint || !target.point.sig || target.point.was !== undefined) return { ok: false, code: 'DATUM_TARGET_UNVERIFIED', reason: 'Select the endpoint again to record its endpoint identity and current edge signature.' };
  const d: Vec3 = [ends[1][0] - ends[0][0], ends[1][1] - ends[0][1], ends[1][2] - ends[0][2]], length = Math.hypot(...d);
  if (!Number.isFinite(length) || length <= 0) return { ok: false, code: 'DATUM_TARGET_UNSUPPORTED', reason: 'The current straight edge has no finite positive length.' };
  const current = toSig({ kind: 'line', at: [(ends[0][0] + ends[1][0]) / 2, (ends[0][1] + ends[1][1]) / 2, (ends[0][2] + ends[1][2]) / 2], dir: [d[0] / length, d[1] / length, d[2] / length], size: length });
  if (!sameDatumTargetSourceSig(target.point.sig, current)) return { ok: false, code: 'DATUM_TARGET_UNVERIFIED', reason: 'The source edge geometry changed. Select the endpoint again; the saved target is retained.' };
  const at = pair[target.point.endpoint === 'min' ? 0 : 1];
  return { ok: true, at: [at[0], at[1], at[2]], edge: edge.name };
}
