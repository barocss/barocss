// The B-rep part model (brep-core step 6): an authored feature list evaluated entirely on the shared
// B-rep. Every output is one B-rep with persistent face and edge names; there are no per-family body
// types and no fixed node, Boolean or finishing-operation counts.
//
//   representation   a body stays a Z-prismatic solid (lines, arcs; Booleans slab-wise, curved walls)
//                    while every operation keeps it upright; otherwise it is a general B-rep, whose
//                    Booleans are the exact planar-polyhedron Booleans (curved non-upright Booleans
//                    are refused with the reason, never approximated)
//   names            features have stable ids; faces are named `<feature>.<role>` (`e1.side0`,
//                    `e1.top`, `h2.side0`, `c3.face`), kept through every later feature, `#k` when one
//                    name is split; copies are `@k` (patterns) and `@m` (kept mirrors); an edge is named
//                    by its two faces. Chamfers and fillets select edges by these names, so a selection
//                    survives parameter edits that keep the topology.
//   references       `id` (all parts of a feature) or `id/k` (part k: the sides of a split)
import { BrepError, buildBrep, lineCurve, type Brep } from './brep-core.js';
import { brepFromPrismatic, booleanPrismatic, prismaticFromProfile, prismaticVolume, transformPrismatic, PrismaticSolidError, type PrismaticSolid } from './prismatic-solid.js';
import { booleanCurveRegions, curveTolerance, sampleRing, segEnd, CurvedArrangementError, type CurveSegment2, type XY } from './curved-arrangement.js';
import { booleanPolyhedra } from './polyhedral-boolean.js';
import { transformBrep, quarterTurn, type BrepAffine } from './brep-transform.js';
import { tessellateBrep } from './brep-tessellate.js';
import { prismaticMassProperties, brepMassProperties, SolidMassError, type SolidMassProperties } from './solid-mass.js';
import { ExtrudedProfileError, type ProfileSegmentInput } from './extruded-profile-solid.js';
import type { Point } from './types.js';

export type CadPartDim = number | { readonly parameter: string };
export type CadPartAxis = 'x' | 'y' | 'z';
export type CadPartPoint2 = readonly [CadPartDim, CadPartDim];
export type CadPartPoint3 = readonly [CadPartDim, CadPartDim, CadPartDim];
export type CadPartLoopSegment = { readonly kind: 'line'; readonly start: CadPartPoint2 } | { readonly kind: 'arc'; readonly start: CadPartPoint2; readonly center: CadPartPoint2; readonly direction: 'ccw' | 'cw' };
type Base = { readonly id: string };
export type CadPartFeature = Base & (
  | { readonly kind: 'sketch'; readonly profile: 'rectangle'; readonly min: CadPartPoint2; readonly max: CadPartPoint2 }
  | { readonly kind: 'sketch'; readonly profile: 'circle'; readonly center: CadPartPoint2; readonly radius: CadPartDim }
  | { readonly kind: 'sketch'; readonly profile: 'polygon'; readonly points: readonly CadPartPoint2[] }
  | { readonly kind: 'sketch'; readonly profile: 'loop'; readonly segments: readonly CadPartLoopSegment[] }
  /** Along +Z from `from` (default 0); a negative height extrudes downward. */
  | { readonly kind: 'extrude'; readonly sketch: string; readonly height: CadPartDim; readonly from?: CadPartDim }
  | { readonly kind: 'union' | 'difference' | 'intersect'; readonly target: string; readonly tool: string }
  /** A vertical hole down from the target's top: through, or `depth` deep. */
  | { readonly kind: 'hole'; readonly target: string; readonly center: CadPartPoint2; readonly radius: CadPartDim; readonly depth?: CadPartDim }
  | { readonly kind: 'translate'; readonly target: string; readonly offset: CadPartPoint3 }
  /** About Z by any angle; about X or Y by multiples of 90°. */
  | { readonly kind: 'rotate'; readonly target: string; readonly axis: CadPartAxis; readonly angleDegrees: number; readonly pivot?: CadPartPoint3 }
  /** Mirror in a coordinate plane through the origin; `keep` also keeps the original (one body). */
  | { readonly kind: 'mirror'; readonly target: string; readonly plane: 'xy' | 'xz' | 'yz'; readonly keep?: boolean }
  | { readonly kind: 'scale'; readonly target: string; readonly factor: number; readonly pivot?: CadPartPoint3 }
  /** `count` copies (the original included) joined into one body. */
  | { readonly kind: 'linear-pattern'; readonly target: string; readonly axis: CadPartAxis; readonly spacing: CadPartDim; readonly count: number }
  /** Copies k·angleDegrees about the axis through `pivot` (about X or Y: multiples of 90°). */
  | { readonly kind: 'circular-pattern'; readonly target: string; readonly axis: CadPartAxis; readonly angleDegrees: number; readonly count: number; readonly pivot?: CadPartPoint3 }
  /** Parts /0 (below `at`) and /1 (above). */
  | { readonly kind: 'split'; readonly target: string; readonly axis: CadPartAxis; readonly at: CadPartDim }
  | { readonly kind: 'chamfer'; readonly target: string; readonly edges: readonly string[]; readonly distance: CadPartDim }
  /** Vertical edges of upright bodies. */
  | { readonly kind: 'fillet'; readonly target: string; readonly edges: readonly string[]; readonly radius: CadPartDim }
);
export interface CadPartDocument {
  readonly format: 'barocss-cad-part'; readonly version: 1; readonly units: 'mm';
  readonly parameters: Readonly<Record<string, number>>;
  readonly features: readonly CadPartFeature[];
}
export type CadPartErrorCode = 'FORMAT' | 'INPUT' | 'PARAMETER' | 'REFERENCE' | 'SELECTION' | 'CAPABILITY' | 'GEOMETRY';
export class CadPartError extends Error {
  constructor(readonly code: CadPartErrorCode, readonly feature: string | null, detail: string) { super(`${feature ? feature + ': ' : ''}${detail}`.slice(0, 1024)); this.name = 'CadPartError'; }
}
export interface CadPartOutput {
  /** The feature id, or `id/k` for one part of a multi-part feature. */
  readonly id: string; readonly feature: string;
  /** 'upright': a Z-prismatic solid (closed-form mass, curved Booleans); otherwise a general B-rep. */
  readonly representation: 'upright' | 'planar' | 'curved';
  readonly brep: Brep;
  readonly bodyCount: number;
  massProperties(densityKgPerM3: number): SolidMassProperties;
  /** Binary STL (little-endian, 80-byte header) of the display tessellation. */
  exportStl(options?: { readonly segmentsPerQuarter?: number }): Uint8Array;
}
export interface CadPartSnapshot {
  readonly document: CadPartDocument;
  /** Parts no later feature consumes, in feature order. */
  readonly outputs: readonly CadPartOutput[];
  readonly features: readonly { readonly id: string; readonly kind: CadPartFeature['kind']; readonly dependencies: readonly string[] }[];
  /** Features computed in this evaluation, and features reused unchanged from the previous one. */
  readonly recomputation: { readonly evaluated: readonly string[]; readonly reused: readonly string[] };
  output(id: string): CadPartOutput;
  /** Re-evaluates with new parameter values; unchanged features are reused. */
  withParameters(edits: Readonly<Record<string, number>>): CadPartSnapshot;
  /** Evaluates another document, reusing every feature whose resolved definition is unchanged. */
  withDocument(document: CadPartDocument): CadPartSnapshot;
  save(): string;
}
export const CadPartLimits = Object.freeze({ features: 512, parameters: 256, points: 1024, edges: 64, copies: 64, fileBytes: 4 << 20, lengthMM: 10000 });

// ---- representation ------------------------------------------------------------------------------
type Solid = { readonly kind: 'upright'; readonly solid: PrismaticSolid } | { readonly kind: 'brep'; readonly brep: Brep };
interface Part { readonly solid: Solid; brep?: Brep }
type Result = { readonly kind: 'sketch'; readonly outer: readonly ProfileSegmentInput[] } | { readonly kind: 'solid'; readonly parts: readonly Part[] };

const empty = (s: Solid) => s.kind === 'upright' ? !s.solid.slabs.length : !s.brep.bodies.length;
const lineOnly = (s: PrismaticSolid) => s.slabs.every(x => x.regions.every(r => [r.outer, ...r.holes].every(ring => ring.every(g => g.kind === 'line'))));
const planarBrep = (b: Brep) => b.faces.every(f => f.surface.degreeU === 1 && f.surface.degreeV === 1 && f.surface.controlPoints.length === 2 && f.surface.controlPoints[0].length === 2) && b.edges.every(e => e.curve.degree === 1 && e.curve.controlPoints.length === 2);
const representation = (s: Solid): CadPartOutput['representation'] => s.kind === 'upright' ? 'upright' : planarBrep(s.brep) ? 'planar' : 'curved';
const brepOf = (part: Part, id: string): Brep => part.brep ??= part.solid.kind === 'upright' ? brepFromPrismatic(part.solid.solid, { id }) : part.solid.brep;

function bounds(s: Solid): { min: Point; max: Point } {
  const min: Point = [Infinity, Infinity, Infinity], max: Point = [-Infinity, -Infinity, -Infinity];
  const take = (p: readonly number[]) => { for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); } };
  if (s.kind === 'upright') for (const slab of s.solid.slabs) for (const r of slab.regions) for (const p of sampleRing(r.outer, Math.PI / 64)) { take([p[0], p[1], slab.z0]); take([p[0], p[1], slab.z1]); }
  else { for (const v of s.brep.vertices) take(v.point); for (const e of s.brep.edges) for (const p of e.curve.controlPoints) take(p); }
  return { min, max };
}

// ---- document admission ----------------------------------------------------------------------------
const ID = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function admit(input: unknown): CadPartDocument {
  const fail = (detail: string, feature: string | null = null): never => { throw new CadPartError('FORMAT', feature, detail); };
  if (!isRecord(input) || input.format !== 'barocss-cad-part' || input.version !== 1 || input.units !== 'mm') fail('a barocss-cad-part version 1 document in mm is required');
  const doc = input as unknown as CadPartDocument;
  if (!isRecord(doc.parameters) || Object.keys(doc.parameters).length > CadPartLimits.parameters) fail('parameters must be an object of at most 256 entries');
  for (const [k, v] of Object.entries(doc.parameters)) if (!ID.test(k) || typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > CadPartLimits.lengthMM) fail(`parameter ${k} must be a finite number within ±10000`);
  if (!Array.isArray(doc.features) || doc.features.length > CadPartLimits.features) fail('features must be an array of at most 512 features');
  const seen = new Set<string>();
  for (const f of doc.features) {
    if (!isRecord(f) || typeof f.id !== 'string' || !ID.test(f.id)) fail('every feature needs an id (a letter, then letters, digits, _ or -)');
    if (seen.has(f.id)) fail('duplicate feature id', f.id);
    seen.add(f.id);
  }
  return JSON.parse(JSON.stringify(doc));
}

// ---- evaluation --------------------------------------------------------------------------------------
type Cache = Map<string, Result>;

export function evaluateCadPart(input: CadPartDocument, previous?: Cache): CadPartSnapshot {
  const doc = admit(input), cache: Cache = new Map(), results = new Map<string, Result>(), keys = new Map<string, string>();
  const consumed = new Map<string, Set<number> | 'all'>(), features: { id: string; kind: CadPartFeature['kind']; dependencies: string[] }[] = [];
  const evaluated: string[] = [], reusedIds: string[] = [];
  for (const feature of doc.features) {
    const at = feature.id, deps: string[] = [];
    const fail = (code: CadPartErrorCode, detail: string): never => { throw new CadPartError(code, at, detail); };
    const dim = (v: CadPartDim | undefined, what: string, positive = false): number => {
      let x: unknown = v;
      if (isRecord(v)) { const name = (v as { parameter: unknown }).parameter; if (typeof name !== 'string' || !Object.hasOwn(doc.parameters, name)) fail('PARAMETER', `${what}: unknown parameter ${String(name)}`); x = doc.parameters[name as string]; }
      if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > CadPartLimits.lengthMM) fail('PARAMETER', `${what} must be a finite length within ±10000 mm`);
      if (positive && !((x as number) > 0)) fail('PARAMETER', `${what} must be positive`);
      return x as number;
    };
    const xy = (p: CadPartPoint2 | undefined, what: string): XY => { if (!Array.isArray(p) || p.length !== 2) fail('INPUT', `${what} must be [x, y]`); return [dim(p![0], what), dim(p![1], what)]; };
    const xyz = (p: CadPartPoint3 | undefined, what: string): Point => { if (!Array.isArray(p) || p.length !== 3) fail('INPUT', `${what} must be [x, y, z]`); return [dim(p![0], what), dim(p![1], what), dim(p![2], what)]; };
    const integer = (v: unknown, what: string, lo: number, hi: number): number => { if (!Number.isInteger(v) || (v as number) < lo || (v as number) > hi) fail('INPUT', `${what} must be an integer from ${lo} to ${hi}`); return v as number; };
    const axisOf = (v: unknown): CadPartAxis => { if (v !== 'x' && v !== 'y' && v !== 'z') fail('INPUT', 'axis must be x, y or z'); return v as CadPartAxis; };
    const ref = (r: unknown, what: string): { id: string; part: number | null; result: Result } => {
      if (typeof r !== 'string') fail('REFERENCE', `${what} must name an earlier feature`);
      const [id, k, extra] = (r as string).split('/');
      const result = results.get(id); if (!result || extra !== undefined) fail('REFERENCE', `${what}: no earlier feature ${r}`);
      deps.push(id);
      const part = k === undefined ? null : Number(k);
      if (part !== null && !(Number.isInteger(part) && part >= 0 && result!.kind === 'solid' && part < result!.parts.length)) fail('REFERENCE', `${what}: ${r} is not a part`);
      return { id, part, result: result! };
    };
    const solids = (r: unknown, what: string): Part[] => {
      const { id, part, result } = ref(r, what);
      if (result.kind !== 'solid') fail('REFERENCE', `${what}: ${id} is a sketch, not a solid`);
      const parts = (result as Extract<Result, { kind: 'solid' }>).parts, picked = part === null ? parts : [parts[part]];
      if (picked.every(p => empty(p.solid))) fail('SELECTION', `${what}: ${r} is empty`);
      const used = consumed.get(id); if (part === null) consumed.set(id, 'all'); else if (used !== 'all') consumed.set(id, (used ?? new Set()).add(part));
      return picked.filter(p => !empty(p.solid));
    };
    const dependsKey = () => deps.map(d => keys.get(d)).join(';');

    let result: Result;
    const f = feature as CadPartFeature & Record<string, unknown>;
    // A feature whose resolved definition and inputs are unchanged is reused.
    try {
      if (f.kind === 'sketch') {
        result = { kind: 'sketch', outer: sketchOuter(f, xy, dim, fail) };
        keys.set(at, JSON.stringify(result));
      } else {
        const compute = operation(f, { dim, xy, xyz, integer, axisOf, solids, ref, fail, at });
        const key = JSON.stringify([f.kind, resolvedDefinition(f, doc.parameters), dependsKey()]);
        keys.set(at, key);
        const reused = previous?.get(key);
        result = reused ?? compute();
        (reused ? reusedIds : evaluated).push(at);
        cache.set(key, result);
      }
    } catch (cause) {
      if (cause instanceof CadPartError) throw cause;
      // Kernel refusals keep their own reason; anything else is reported, never swallowed.
      const known = cause instanceof BrepError || cause instanceof PrismaticSolidError || cause instanceof CurvedArrangementError || cause instanceof ExtrudedProfileError || cause instanceof SolidMassError;
      throw new CadPartError('GEOMETRY', at, known ? (cause as Error).message : `unexpected kernel failure: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    results.set(at, result); features.push({ id: at, kind: f.kind, dependencies: [...new Set(deps)] });
  }
  // Outputs: parts not consumed by a later feature.
  const outputs: CadPartOutput[] = [];
  for (const feature of doc.features) {
    const result = results.get(feature.id)!, used = consumed.get(feature.id);
    if (result.kind !== 'solid' || used === 'all') continue;
    result.parts.forEach((part, k) => {
      if (used?.has(k) || empty(part.solid)) return;
      outputs.push(makeOutput(result.parts.length === 1 ? feature.id : `${feature.id}/${k}`, feature.id, part));
    });
  }
  const snapshot: CadPartSnapshot = {
    document: deepFreeze(doc), outputs: Object.freeze(outputs), features: deepFreeze(features), recomputation: deepFreeze({ evaluated, reused: reusedIds }),
    output(id: string) { const o = outputs.find(x => x.id === id); if (!o) throw new CadPartError('REFERENCE', null, `no output ${id}`); return o; },
    withParameters(edits) {
      const parameters = { ...doc.parameters };
      for (const [k, v] of Object.entries(edits)) { if (!Object.hasOwn(parameters, k)) throw new CadPartError('PARAMETER', null, `unknown parameter ${k}`); parameters[k] = v; }
      return evaluateCadPart({ ...doc, parameters }, cache);
    },
    withDocument(next) { return evaluateCadPart(next, cache); },
    save: () => JSON.stringify(doc) + '\n',
  };
  return Object.freeze(snapshot);
}

/** Parses and evaluates a saved part document. */
export function loadCadPart(text: string): CadPartSnapshot {
  if (typeof text !== 'string' || text.length > CadPartLimits.fileBytes) throw new CadPartError('FORMAT', null, 'a part document of at most 4 MiB is required');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new CadPartError('FORMAT', null, 'malformed JSON'); }
  return evaluateCadPart(parsed as CadPartDocument);
}
export const emptyCadPart = (): CadPartDocument => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [] });

function deepFreeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } return v; }
/** The feature with parameters replaced by their values (the reuse key). */
function resolvedDefinition(f: unknown, parameters: Readonly<Record<string, number>>): unknown {
  if (Array.isArray(f)) return f.map(x => resolvedDefinition(x, parameters));
  if (isRecord(f)) { if (typeof f.parameter === 'string' && Object.keys(f).length === 1) return parameters[f.parameter]; return Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'id').map(([k, v]) => [k, resolvedDefinition(v, parameters)])); }
  return f;
}

type Tools = {
  dim: (v: CadPartDim | undefined, what: string, positive?: boolean) => number; xy: (p: CadPartPoint2 | undefined, what: string) => XY; xyz: (p: CadPartPoint3 | undefined, what: string) => Point;
  integer: (v: unknown, what: string, lo: number, hi: number) => number; axisOf: (v: unknown) => CadPartAxis; solids: (r: unknown, what: string) => Part[];
  ref: (r: unknown, what: string) => { id: string; part: number | null; result: Result };
  fail: (code: CadPartErrorCode, detail: string) => never; at: string;
};

function sketchOuter(f: Record<string, unknown>, xy: Tools['xy'], dim: Tools['dim'], fail: Tools['fail']): ProfileSegmentInput[] {
  if (f.profile === 'rectangle') {
    const a = xy(f.min as CadPartPoint2, 'min'), b = xy(f.max as CadPartPoint2, 'max');
    if (!(a[0] < b[0] && a[1] < b[1])) fail('PARAMETER', 'rectangle min must be below max on both axes');
    return [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]].map(start => ({ kind: 'line', start: start as XY }));
  }
  if (f.profile === 'circle') { const c = xy(f.center as CadPartPoint2, 'center'), r = dim(f.radius as CadPartDim, 'radius', true); return [{ kind: 'arc', start: [c[0] + r, c[1]], center: c, direction: 'ccw' }]; }
  if (f.profile === 'polygon') {
    if (!Array.isArray(f.points) || f.points.length < 3 || f.points.length > CadPartLimits.points) fail('INPUT', 'a polygon needs 3 to 1024 points');
    return (f.points as CadPartPoint2[]).map((p, i) => ({ kind: 'line', start: xy(p, `point ${i}`) }));
  }
  if (f.profile === 'loop') {
    if (!Array.isArray(f.segments) || !f.segments.length || f.segments.length > CadPartLimits.points) fail('INPUT', 'a loop needs 1 to 1024 segments');
    return (f.segments as CadPartLoopSegment[]).map((s, i): ProfileSegmentInput => {
      if (!isRecord(s)) fail('INPUT', `segment ${i} must be an object`);
      if (s.kind === 'line') return { kind: 'line', start: xy(s.start, `segment ${i} start`) };
      if (s.kind === 'arc' && (s.direction === 'ccw' || s.direction === 'cw')) return { kind: 'arc', start: xy(s.start, `segment ${i} start`), center: xy(s.center, `segment ${i} center`), direction: s.direction };
      return fail('INPUT', `segment ${i} must be a line or an arc with direction ccw or cw`);
    });
  }
  return fail('INPUT', 'sketch profile must be rectangle, circle, polygon or loop');
}

// ---- operations ---------------------------------------------------------------------------------------
function operation(f: CadPartFeature & Record<string, unknown>, t: Tools): () => Result {
  const { dim, xy, xyz, integer, axisOf, solids, ref, fail, at } = t;
  const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });
  const many = (parts: Solid[]): Result => ({ kind: 'solid', parts: parts.map(solid => ({ solid })) });
  switch (f.kind) {
    case 'extrude': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      const h = dim(f.height as CadPartDim, 'height'), from = f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from');
      if (h === 0) fail('PARAMETER', 'height must not be zero');
      const outer = (sketch as Extract<Result, { kind: 'sketch' }>).outer;
      return () => one({ kind: 'upright', solid: prismaticFromProfile({ outer, heightMM: Math.abs(h), fromMM: h > 0 ? from : from + h, tag: at }) });
    }
    case 'union': case 'difference': case 'intersect': {
      const target = solids(f.target, 'target'), tool = solids(f.tool, 'tool'), op = f.kind === 'intersect' ? 'intersection' : f.kind;
      return () => {
        const joined = tool.reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), tool[0].solid);
        // Unions merge every target part into one; difference and intersection act on each part.
        if (op === 'union') return one(target.reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), joined));
        return many(target.map(p => boolean(p.solid, joined, op, at)));
      };
    }
    case 'hole': {
      const target = solids(f.target, 'target'), c = xy(f.center as CadPartPoint2, 'center'), r = dim(f.radius as CadPartDim, 'radius', true);
      const depth = f.depth === undefined ? null : dim(f.depth as CadPartDim, 'depth', true);
      return () => many(target.map(p => {
        if (p.solid.kind !== 'upright') fail('CAPABILITY', 'holes need an upright (Z-prismatic) target; this body was rotated about X or Y or chamfered along a horizontal edge');
        const box = bounds(p.solid), top = box.max[2], bottom = depth === null ? box.min[2] - 1 : top - depth;
        const tool = prismaticFromProfile({ outer: [{ kind: 'arc', start: [c[0] + r, c[1]], center: c, direction: 'ccw' }], heightMM: top + 1 - bottom, fromMM: bottom, tag: at });
        const before = (p.solid as Extract<Solid, { kind: 'upright' }>).solid, out = booleanPrismatic(before, tool, 'difference');
        if (prismaticVolume(before) - prismaticVolume(out) <= 1e-9 * prismaticVolume(before)) fail('SELECTION', `the hole at (${c[0]}, ${c[1]}) misses the target`);
        return { kind: 'upright', solid: out };
      }));
    }
    case 'translate': {
      const target = solids(f.target, 'target'), o = xyz(f.offset as CadPartPoint3, 'offset');
      return () => many(target.map(p => affine(p.solid, [1, 0, 0, 0, 1, 0, 0, 0, 1], o)));
    }
    case 'rotate': {
      const target = solids(f.target, 'target'), axis = axisOf(f.axis), deg = f.angleDegrees as number, pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof deg !== 'number' || !Number.isFinite(deg) || Math.abs(deg) > 3600) fail('INPUT', 'angleDegrees must be a finite number of degrees');
      if (axis !== 'z' && Math.round(deg / 90) * 90 !== deg) fail('CAPABILITY', 'rotations about X or Y must be multiples of 90°');
      return () => many(target.map(p => rotate(p.solid, axis, deg, pivot)));
    }
    case 'mirror': {
      const target = solids(f.target, 'target'), plane = f.plane;
      if (plane !== 'xy' && plane !== 'xz' && plane !== 'yz') fail('INPUT', 'plane must be xy, xz or yz');
      const m: BrepAffine['matrix'] = plane === 'xy' ? [1, 0, 0, 0, 1, 0, 0, 0, -1] : plane === 'xz' ? [1, 0, 0, 0, -1, 0, 0, 0, 1] : [-1, 0, 0, 0, 1, 0, 0, 0, 1];
      return () => many(target.map(p => {
        const mirrored = affine(p.solid, m, [0, 0, 0], f.keep ? (n => n + '@m') : undefined);
        return f.keep ? boolean(p.solid, mirrored, 'union', at) : mirrored;
      }));
    }
    case 'scale': {
      const target = solids(f.target, 'target'), k = f.factor as number, pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof k !== 'number' || !(k > 0 && k <= 1000 && Number.isFinite(k))) fail('INPUT', 'factor must be a positive number at most 1000');
      return () => many(target.map(p => affine(p.solid, [k, 0, 0, 0, k, 0, 0, 0, k], [pivot[0] * (1 - k), pivot[1] * (1 - k), pivot[2] * (1 - k)])));
    }
    case 'linear-pattern': {
      const target = solids(f.target, 'target'), axis = axisOf(f.axis), spacing = dim(f.spacing as CadPartDim, 'spacing'), count = integer(f.count, 'count', 1, CadPartLimits.copies);
      if (spacing === 0) fail('PARAMETER', 'spacing must not be zero');
      return () => many(target.map(p => {
        let acc = p.solid;
        for (let k = 1; k < count; k++) { const o: Point = [0, 0, 0]; o['xyz'.indexOf(axis)] = spacing * k; acc = boolean(acc, affine(p.solid, [1, 0, 0, 0, 1, 0, 0, 0, 1], o, n => `${n}@${k}`), 'union', at); }
        return acc;
      }));
    }
    case 'circular-pattern': {
      const target = solids(f.target, 'target'), axis = axisOf(f.axis), deg = f.angleDegrees as number, count = integer(f.count, 'count', 1, CadPartLimits.copies);
      const pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof deg !== 'number' || !Number.isFinite(deg) || deg === 0 || Math.abs(deg) > 360) fail('INPUT', 'angleDegrees must be a nonzero step of at most 360°');
      if (axis !== 'z' && Math.round(deg / 90) * 90 !== deg) fail('CAPABILITY', 'patterns about X or Y must step by multiples of 90°');
      return () => many(target.map(p => {
        let acc = p.solid;
        for (let k = 1; k < count; k++) acc = boolean(acc, rotate(p.solid, axis, deg * k, pivot, n => `${n}@${k}`), 'union', at);
        return acc;
      }));
    }
    case 'split': {
      const target = solids(f.target, 'target'), axis = axisOf(f.axis), cut = dim(f.at as CadPartDim, 'at');
      if (target.length !== 1) fail('REFERENCE', 'split one part at a time (name it as id/k)');
      return () => {
        const s = target[0].solid, box = bounds(s), a = 'xyz'.indexOf(axis);
        if (!(cut > box.min[a] && cut < box.max[a])) fail('SELECTION', `the split plane ${axis} = ${cut} does not cross the target (${box.min[a]} to ${box.max[a]})`);
        const half = (lo: boolean) => { const min = box.min.map(v => v - 1) as Point, max = box.max.map(v => v + 1) as Point; if (lo) max[a] = cut; else min[a] = cut; return boxSolid(min, max, `${at}.cut`); };
        return many([boolean(s, half(true), 'intersection', at), boolean(s, half(false), 'intersection', at)]);
      };
    }
    case 'chamfer': case 'fillet': {
      const target = solids(f.target, 'target'), size = dim((f.kind === 'chamfer' ? f.distance : f.radius) as CadPartDim, f.kind === 'chamfer' ? 'distance' : 'radius', true);
      if (!Array.isArray(f.edges) || !f.edges.length || f.edges.length > CadPartLimits.edges || !f.edges.every(e => typeof e === 'string')) fail('INPUT', 'edges must list 1 to 64 edge names');
      if (target.length !== 1) fail('REFERENCE', 'finish one part at a time (name it as id/k)');
      return () => one(finishEdges(target[0], f.edges as string[], size, f.kind as 'chamfer' | 'fillet', at, fail));
    }
  }
  return fail('INPUT', `unknown feature kind ${String((f as { kind?: unknown }).kind)}`);
}

function boxSolid(min: Point, max: Point, tag: string): Solid {
  const ring: ProfileSegmentInput[] = [[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]].map(start => ({ kind: 'line', start: start as XY }));
  return { kind: 'upright', solid: prismaticFromProfile({ outer: ring, heightMM: max[2] - min[2], fromMM: min[2], tag }) };
}

/** Upright Booleans stay upright; otherwise both bodies must be planar for the exact polyhedral Boolean. */
function boolean(a: Solid, b: Solid, op: 'union' | 'difference' | 'intersection', at: string): Solid {
  if (empty(b)) return op === 'intersection' ? b : a;
  if (empty(a)) return op === 'union' ? b : a;
  if (a.kind === 'upright' && b.kind === 'upright') return { kind: 'upright', solid: booleanPrismatic(a.solid, b.solid, op) };
  const A = a.kind === 'upright' ? (lineOnly(a.solid) ? brepFromPrismatic(a.solid, { id: at + '_a' }) : null) : a.brep;
  const B = b.kind === 'upright' ? (lineOnly(b.solid) ? brepFromPrismatic(b.solid, { id: at + '_b' }) : null) : b.brep;
  if (!A || !B || !planarBrep(A) || !planarBrep(B)) throw new CadPartError('CAPABILITY', at, 'Booleans between a curved body and a body that is not upright (rotated about X or Y, or chamfered along a horizontal edge) are not supported yet');
  const result = booleanPolyhedra(A, B, op, { id: at });
  return { kind: 'brep', brep: result };
}

function affine(s: Solid, m: BrepAffine['matrix'], o: readonly number[], rename?: (n: string) => string): Solid {
  // Upright solids stay upright when XY maps by a similarity and Z only scales and shifts.
  if (s.kind === 'upright' && m[2] === 0 && m[5] === 0 && m[6] === 0 && m[7] === 0)
    return { kind: 'upright', solid: transformPrismatic(s.solid, { matrix: [m[0], m[1], m[3], m[4]], offset: [o[0], o[1]], zScale: m[8], zOffset: o[2], ...(rename ? { retag: rename } : {}) }) };
  const brep = s.kind === 'upright' ? brepFromPrismatic(s.solid) : s.brep;
  return { kind: 'brep', brep: transformBrep(brep, { matrix: m, offset: [o[0], o[1], o[2]] }, rename) };
}
function rotate(s: Solid, axis: CadPartAxis, deg: number, pivot: Point, rename?: (n: string) => string): Solid {
  let m: BrepAffine['matrix'];
  if (axis === 'z') {
    const quarter = Math.round(deg / 90) * 90 === deg;
    if (quarter) m = quarterTurn('z', deg);
    else { const r = deg * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r); m = [c, -sn, 0, sn, c, 0, 0, 0, 1]; }
  } else m = quarterTurn(axis, deg);
  const mp = [m[0] * pivot[0] + m[1] * pivot[1] + m[2] * pivot[2], m[3] * pivot[0] + m[4] * pivot[1] + m[5] * pivot[2], m[6] * pivot[0] + m[7] * pivot[1] + m[8] * pivot[2]];
  return affine(s, m, [pivot[0] - mp[0], pivot[1] - mp[1], pivot[2] - mp[2]], rename);
}

// ---- chamfers and fillets ------------------------------------------------------------------------------
function finishEdges(part: Part, names: string[], size: number, kind: 'chamfer' | 'fillet', at: string, fail: Tools['fail']): Solid {
  const brep = brepOf(part, 'target'), byName = new Map(brep.edges.map(e => [e.name, e]));
  const vertical: { x: number; y: number; z0: number; z1: number; name: string }[] = [], other: Brep["edges"][number][] = [];
  for (const name of names) {
    const e = byName.get(name);
    if (!e) fail('SELECTION', `no edge named ${name}; edges: ${brep.edges.slice(0, 12).map(x => x.name).join(', ')}${brep.edges.length > 12 ? ', …' : ''}`);
    const p = e!.curve.controlPoints, a = p[0], b = p[p.length - 1], straight = e!.curve.degree === 1 && p.length === 2;
    if (!straight) fail('CAPABILITY', `edge ${name} is curved; only straight edges can be ${kind === 'chamfer' ? 'chamfered' : 'filleted'}`);
    const tol = 1e-9 * Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs));
    if (Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol) vertical.push({ x: a[0], y: a[1], z0: Math.min(a[2], b[2]), z1: Math.max(a[2], b[2]), name: name });
    else other.push(e!);
  }
  let solid = part.solid;
  if (vertical.length) {
    if (solid.kind !== 'upright') fail('CAPABILITY', 'vertical-edge finishes need an upright (Z-prismatic) body');
    solid = { kind: 'upright', solid: cornerFinish((solid as Extract<Solid, { kind: 'upright' }>).solid, vertical, size, kind, at, fail) };
  }
  if (other.length) {
    if (kind === 'fillet') fail('CAPABILITY', `only vertical edges can be filleted yet (${other.map(e => e.name).join(', ')})`);
    for (const e of other) solid = wedgeChamfer(solid, brep, e, size, at, fail);
  }
  return solid;
}

/** Chamfer or round the ring corners at the selected vertical edges, in every slab the edge spans. */
function cornerFinish(solid: PrismaticSolid, corners: { x: number; y: number; z0: number; z1: number; name: string }[], size: number, kind: 'chamfer' | 'fillet', at: string, fail: Tools['fail']): PrismaticSolid {
  const tol = curveTolerance(solid.slabs.flatMap(s => s.regions.flatMap(r => [r.outer, ...r.holes])));
  const done = new Set<string>();
  const slabs = solid.slabs.map(slab => {
    const here = corners.filter(c => c.z0 <= slab.z0 + tol && c.z1 >= slab.z1 - tol);
    if (!here.length) return slab;
    const rings = slab.regions.flatMap(r => [r.outer, ...r.holes]).map(ring => {
      let out = [...ring];
      for (const c of here) {
        let i = out.findIndex(s => Math.hypot(segEnd(s)[0] - c.x, segEnd(s)[1] - c.y) <= tol);
        if (i < 0) continue;
        // Rotate so the corner's two segments are consecutive without wrapping.
        if (i === out.length - 1) { out = [out[i], ...out.slice(0, i)]; i = 0; }
        const s1 = out[i], s2 = out[(i + 1) % out.length];
        if (s1.kind !== 'line' || s2.kind !== 'line') fail('CAPABILITY', `edge ${c.name}: only corners between two straight walls can be finished yet`);
        const l1 = s1 as Extract<CurveSegment2, { kind: 'line' }>, l2 = s2 as Extract<CurveSegment2, { kind: 'line' }>;
        const L1 = Math.hypot(l1.b[0] - l1.a[0], l1.b[1] - l1.a[1]), L2 = Math.hypot(l2.b[0] - l2.a[0], l2.b[1] - l2.a[1]);
        const u: XY = [(l1.b[0] - l1.a[0]) / L1, (l1.b[1] - l1.a[1]) / L1], v: XY = [(l2.b[0] - l2.a[0]) / L2, (l2.b[1] - l2.a[1]) / L2];
        const cross = u[0] * v[1] - u[1] * v[0], dot = u[0] * v[0] + u[1] * v[1];
        if (Math.abs(cross) < 1e-9) fail('SELECTION', `edge ${c.name} joins two walls in line; there is no corner to finish`);
        const turn = Math.atan2(cross, dot), back = kind === 'chamfer' ? size : size * Math.tan(Math.abs(turn) / 2);
        if (back >= L1 - tol || back >= L2 - tol) fail('PARAMETER', `edge ${c.name}: ${kind} ${size} mm is too large for walls of ${+L1.toFixed(6)} and ${+L2.toFixed(6)} mm`);
        const p = l1.b, A: XY = [p[0] - u[0] * back, p[1] - u[1] * back], B: XY = [p[0] + v[0] * back, p[1] + v[1] * back];
        let corner: CurveSegment2;
        if (kind === 'chamfer') corner = { kind: 'line', a: A, b: B, tag: `${at}.face` };
        else {
          const n: XY = turn > 0 ? [-u[1], u[0]] : [u[1], -u[0]], centre: XY = [A[0] + n[0] * size, A[1] + n[1] * size];
          corner = { kind: 'arc', c: centre, r: size, t0: Math.atan2(A[1] - centre[1], A[0] - centre[0]), sweep: turn, tag: `${at}.face` };
        }
        out.splice(i, 2, { ...l1, b: A }, corner, { ...l2, a: B });
        done.add(c.name);
      }
      return out;
    });
    return { ...slab, regions: booleanCurveRegions(rings, [], 'union', tol) };
  });
  for (const c of corners) if (!done.has(c.name)) fail('SELECTION', `edge ${c.name} is not a corner of a wall section`);
  return { ...solid, slabs };
}

/** A straight edge between two planar faces: cut away (convex) or fill (concave) a triangular prism. */
function wedgeChamfer(solid: Solid, source: Brep, edge: Brep['edges'][number], d: number, at: string, fail: Tools['fail']): Solid {
  const uses = source.coedges.filter(c => c.edge === edge.id);
  if (uses.length !== 2) fail('SELECTION', `edge ${edge.name} does not join exactly two faces`);
  const faceOf = (loopId: string) => source.faces.find(f => f.loops.includes(loopId))!;
  const P = edge.curve.controlPoints[0], Q = edge.curve.controlPoints[1], e = norm(sub(Q, P));
  const sides = uses.map(c => {
    const f = faceOf(c.loop), s = f.surface;
    if (!(s.degreeU === 1 && s.degreeV === 1)) fail('CAPABILITY', `edge ${edge.name}: chamfers along horizontal edges need planar faces`);
    const [[p00, p01], [p10]] = s.controlPoints as Point[][], n0 = cross(sub(p10, p00), sub(p01, p00)), n = norm(f.sense === 'forward' ? n0 : [-n0[0], -n0[1], -n0[2]]);
    const dir: Point = c.sense === 'forward' ? e : [-e[0], -e[1], -e[2]];
    return { n, w: norm(cross(n, dir)) }; // w: into the face, perpendicular to the edge
  });
  const [s1, s2] = sides, convex = dot(s2.w, s1.n) < 0;
  const corner = (X: Point) => {
    const A1 = add(X, scale(s1.w, d)), A2 = add(X, scale(s2.w, d)), M = scale(add(A1, A2), 0.5);
    // Grown about the chamfer line so no wedge face lies on a face of the body.
    return [sub(scale(A1, 2), A2), sub(scale(A2, 2), A1), sub(scale(X, 2), M)];
  };
  const grow = convex ? d : 0, T0 = corner(sub(P, scale(e, grow))), T1 = corner(add(Q, scale(e, grow)));
  const wedge = prismBrep(T0, T1, `${at}.face`);
  const body = solid.kind === 'upright' ? brepFromPrismatic(solid.solid) : solid.brep;
  if (!planarBrep(body)) fail('CAPABILITY', `edge ${edge.name}: chamfers along horizontal edges need a body with planar faces`);
  return { kind: 'brep', brep: booleanPolyhedra(body, wedge, convex ? 'difference' : 'union', { id: at }) };
}
const sub = (a: readonly number[], b: readonly number[]): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: readonly number[], b: readonly number[]): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: readonly number[], k: number): Point => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: readonly number[], b: readonly number[]): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: readonly number[]): Point => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

/** A triangular prism between triangles T0 and T1 (corresponding corners), faces pointing out. */
function prismBrep(T0: Point[], T1: Point[], name: string): Brep {
  const a = T0[0], A = T1[0];
  let [b, c] = [T0[1], T0[2]], [B, C] = [T1[1], T1[2]];
  // Orient so the T0 triangle faces away from T1.
  if (dot(cross(sub(b, a), sub(c, a)), sub(A, a)) > 0) { [b, c] = [c, b]; [B, C] = [C, B]; }
  const pts = [a, b, c, A, B, C];
  const faces = [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]];
  const plane = (ids: number[]) => { const p = ids.map(i => pts[i]), n = norm(cross(sub(p[1], p[0]), sub(p[2], p[0]))), e1 = norm(sub(p[1], p[0])), e2 = cross(n, e1);
    const uv = p.map(q => [dot(sub(q, p[0]), e1), dot(sub(q, p[0]), e2)]), u0 = Math.min(...uv.map(x => x[0])) - 1, u1 = Math.max(...uv.map(x => x[0])) + 1, v0 = Math.min(...uv.map(x => x[1])) - 1, v1 = Math.max(...uv.map(x => x[1])) + 1;
    const pt = (u: number, v: number): Point => add(p[0], add(scale(e1, u), scale(e2, v)));
    return { kind: 'surface' as const, id: 'w', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[pt(u0, v0), pt(u0, v1)], [pt(u1, v0), pt(u1, v1)]], weights: [[1, 1], [1, 1]] };
  };
  const edgeIds = new Map<string, { id: string; v: [number, number] }>();
  const use = (i: number, j: number) => { const k = i < j ? `${i}-${j}` : `${j}-${i}`; let e = edgeIds.get(k); if (!e) { e = { id: 'e' + edgeIds.size, v: i < j ? [i, j] : [j, i] }; edgeIds.set(k, e); } return { edge: e.id, sense: (e.v[0] === i ? 'forward' : 'reversed') as 'forward' | 'reversed' }; };
  const faceInputs = faces.map((ids, fi) => ({ id: 'f' + fi, name, surface: plane(ids), sense: 'forward' as const, loops: [{ kind: 'outer' as const, uses: ids.map((v, k) => use(v, ids[(k + 1) % ids.length])) }] }));
  return buildBrepLocal(pts, [...edgeIds.values()], faceInputs);
}
function buildBrepLocal(pts: Point[], edges: { id: string; v: [number, number] }[], faces: Parameters<typeof buildBrep>[0]['bodies'][number]['shells'][number]['faces']): Brep {
  return buildBrep({ source: { family: 'wedge', id: 'wedge' }, vertices: pts.map((p, i) => ({ id: 'v' + i, point: p })),
    edges: edges.map(e => ({ id: e.id, curve: lineCurve(e.id, pts[e.v[0]], pts[e.v[1]]), vertices: ['v' + e.v[0], 'v' + e.v[1]] as [string, string] })),
    bodies: [{ id: 'wedge', kind: 'solid', shells: [{ id: 's', closed: true, faces }] }] });
}

// ---- outputs --------------------------------------------------------------------------------------------
function makeOutput(id: string, feature: string, part: Part): CadPartOutput {
  const brep = brepOf(part, id.replace('/', '_'));
  return Object.freeze({
    id, feature, representation: representation(part.solid), brep, bodyCount: brep.bodies.length,
    massProperties(density: number) { return part.solid.kind === 'upright' ? prismaticMassProperties(part.solid.solid, density) : brepMassProperties(brep, density); },
    exportStl(options: { readonly segmentsPerQuarter?: number } = {}) { return stl(brep, options.segmentsPerQuarter ?? 16); },
  });
}
function stl(brep: Brep, segmentsPerQuarter: number): Uint8Array {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter }), p = mesh.positionsMM, ix = mesh.indices, n = ix.length / 3;
  const bytes = new Uint8Array(84 + 50 * n), view = new DataView(bytes.buffer);
  new TextEncoder().encodeInto('barocss part (mm)', bytes);
  view.setUint32(80, n, true);
  for (let t = 0; t < n; t++) {
    const v = [0, 1, 2].map(k => [p[ix[t * 3 + k] * 3], p[ix[t * 3 + k] * 3 + 1], p[ix[t * 3 + k] * 3 + 2]]), nn = cross(sub(v[1], v[0]), sub(v[2], v[0])), l = Math.hypot(...nn) || 1, o = 84 + 50 * t;
    [nn[0] / l, nn[1] / l, nn[2] / l, ...v.flat()].forEach((x, k) => view.setFloat32(o + 4 * k, x, true));
  }
  return bytes;
}
