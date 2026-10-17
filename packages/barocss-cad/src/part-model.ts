// The B-rep part model (brep-core step 6): an authored feature list evaluated entirely on the shared
// B-rep. Every output is one B-rep with persistent face and edge names; there are no per-family body
// types and no fixed node, Boolean or finishing-operation counts.
//
//   representation   a body stays a Z-prismatic solid (lines, arcs; Booleans slab-wise, curved walls)
//                    while every operation keeps it upright; otherwise it is a general B-rep. Its
//                    Booleans are the exact planar-polyhedron Booleans for planar bodies, and the
//                    analytic Booleans otherwise: planes and cylinders of any axis exactly, and any
//                    other surface (revolved tori and cones) by intersection curves traced onto both
//                    surfaces; configurations they cannot represent (inputs touching along an edge or
//                    at a point, profiles touching the revolve axis) are refused with the reason
//   names            features have stable ids; faces are named `<feature>.<role>` (`e1.side0`,
//                    `e1.top`, `h2.side0`, `c3.face`), kept through every later feature, `#k` when one
//                    name is split; copies are `@k` (patterns) and `@m` (kept mirrors); an edge is named
//                    by its two faces. Chamfers and fillets select edges by these names, so a selection
//                    survives parameter edits that keep the topology.
//   references       `id` (all parts of a feature) or `id/k` (part k: the sides of a split)
import { BrepError, buildBrep, lineCurve, mergeBreps, type Brep } from './brep-core.js';
import { brepFromPrismatic, booleanPrismatic, prismaticExtrude, prismaticFromProfile, prismaticVolume, transformPrismatic, PrismaticSolidError, type PrismaticSolid } from './prismatic-solid.js';
import { erodeSection } from './section-offset.js';
import { booleanCurveRegions, curveTolerance, regionMoments, sampleRing, segEnd, segReverse, CurvedArrangementError, type CurveRegion2, type CurveSegment2, type XY } from './curved-arrangement.js';
import { booleanPolyhedra } from './polyhedral-boolean.js';
import { booleanAnalytic, faceGeometry } from './analytic-boolean.js';
import { faceReach, finishBrepEdges } from './edge-finish.js';
import { draftedExtrusion } from './drafted-extrusion.js';
import { exportStep, importStep } from './step.js';
import { revolveProfile, revolveMassProperties, type RevolveInput } from './revolve.js';
import { transformBrep, quarterTurn, type BrepAffine } from './brep-transform.js';
import { tessellateBrep } from './brep-tessellate.js';
import { combineMassProperties, prismaticMassProperties, brepMassProperties, SolidMassError, type SolidMassProperties } from './solid-mass.js';
import { glueAtSharedFace, withCavities } from './brep-glue.js';
import { loftSolid } from './loft.js';
import { generalShell } from './general-shell.js';
import { ExtrudedProfileError, buildProfileLoop, type ProfileSegmentInput } from './extruded-profile-solid.js';
import type { Point } from './types.js';
import { add, cross, dot, len, scale, sub, unit } from './vec3.js';
import { encodeBinaryStl } from './stl.js';

export type CadPartDim = number | { readonly parameter: string };
export type CadPartAxis = 'x' | 'y' | 'z';
export type CadPartPoint2 = readonly [CadPartDim, CadPartDim];
export type CadPartPoint3 = readonly [CadPartDim, CadPartDim, CadPartDim];
export type CadPartLoopSegment = { readonly kind: 'line'; readonly start: CadPartPoint2 } | { readonly kind: 'arc'; readonly start: CadPartPoint2; readonly center: CadPartPoint2; readonly direction: 'ccw' | 'cw' };
type Base = { readonly id: string };
/**
 * Where a sketch lies: its X runs along `xAxis` and its Y along normal × xAxis from `origin`, and its
 * solids grow along `normal` (both directions are unit vectors after normalising); any plane, tilted
 * ones included. A body built on a plane with a vertical axis stays upright (exact, prismatic); on any
 * other it is a general B-rep. Without a plane a sketch lies on XY at Z 0.
 */
export interface CadPartSketchPlane { readonly origin: CadPartPoint3; readonly normal: readonly [number, number, number]; readonly xAxis: readonly [number, number, number] }
/**
 * `regions`: more closed loops of material beside the profile; `holes`: closed loops cut from them (a
 * plate with windows, two bosses at once). Only straight extrudes take them.
 */
type Placed = { readonly plane?: CadPartSketchPlane; readonly regions?: readonly (readonly CadPartLoopSegment[])[]; readonly holes?: readonly (readonly CadPartLoopSegment[])[] };
export type CadPartFeature = Base & (
  | ({ readonly kind: 'sketch'; readonly profile: 'rectangle'; readonly min: CadPartPoint2; readonly max: CadPartPoint2 } & Placed)
  | ({ readonly kind: 'sketch'; readonly profile: 'circle'; readonly center: CadPartPoint2; readonly radius: CadPartDim } & Placed)
  | ({ readonly kind: 'sketch'; readonly profile: 'polygon'; readonly points: readonly CadPartPoint2[] } & Placed)
  | ({ readonly kind: 'sketch'; readonly profile: 'loop'; readonly segments: readonly CadPartLoopSegment[] } & Placed)
  /** Along the sketch normal (+Z) from `from` (default 0); a negative height extrudes the other way. */
  /** `draft` (degrees, |θ| < 89) leans every wall into the material away from the sketch plane. */
  | { readonly kind: 'extrude'; readonly sketch: string; readonly height: CadPartDim; readonly from?: CadPartDim; readonly draft?: number }
  /** About an axis in the sketch plane (through `origin`, along X or Y), by angleDegrees (default 360). */
  | { readonly kind: 'revolve'; readonly sketch: string; readonly axis: { readonly origin: CadPartPoint2; readonly direction: 'x' | 'y' | readonly [number, number] }; readonly angleDegrees?: number }
  | { readonly kind: 'union' | 'difference' | 'intersect'; readonly target: string; readonly tool: string }
  /**
   * A hole along `axis` (default z) through the target, or `depth` deep from its `side` (default max:
   * the top for z). `center` is in the other two coordinates in order: z → [x, y], x → [y, z], y → [x, z].
   */
  | { readonly kind: 'hole'; readonly target: string; readonly center: CadPartPoint2; readonly radius: CadPartDim; readonly depth?: CadPartDim; readonly axis?: CadPartAxis; readonly side?: 'min' | 'max' }
  | { readonly kind: 'translate'; readonly target: string; readonly offset: CadPartPoint3 }
  /** About an axis through `pivot` (default the origin) by any angle; off quarter turns about X or Y the body leaves the upright family. */
  | { readonly kind: 'rotate'; readonly target: string; readonly axis: CadPartAxis; readonly angleDegrees: number; readonly pivot?: CadPartPoint3 }
  /** Mirror in a coordinate plane through the origin; `keep` also keeps the original (one body). */
  | { readonly kind: 'mirror'; readonly target: string; readonly plane: 'xy' | 'xz' | 'yz'; readonly keep?: boolean }
  | { readonly kind: 'scale'; readonly target: string; readonly factor: number; readonly pivot?: CadPartPoint3 }
  /** `count` copies (the original included) joined into one body. */
  | { readonly kind: 'linear-pattern'; readonly target: string; readonly axis: CadPartAxis; readonly spacing: CadPartDim; readonly count: number }
  /** Copies k·angleDegrees about the axis through `pivot` (about X or Y: multiples of 90°). */
  | { readonly kind: 'circular-pattern'; readonly target: string; readonly axis: CadPartAxis; readonly angleDegrees: number; readonly count: number; readonly pivot?: CadPartPoint3 }
  /**
   * Parts /0 (below `at`) and /1 (above): across the plane `axis` = at, or with `normal` (any direction,
   * not necessarily unit) across the plane normal·p = at — x + y = at for [1, 1, 0], a mitre.
   */
  | { readonly kind: 'split'; readonly target: string; readonly axis?: CadPartAxis; readonly normal?: CadPartPoint3; readonly at: CadPartDim }
  /**
   * The sketch's profile swept along a path through its centroid, from the sketch plane up +Z: straight
   * runs and bends of a radius (to the path) towards ±X or ±Y (as a pipe is bent), each from where the
   * last ended.
   */
  | { readonly kind: 'sweep'; readonly sketch: string; readonly path: readonly CadPartSweepStep[] }
  /**
   * A ruled loft through sketches placed at increasing heights: each section's edges joined by straight
   * rulings to the next one's (edge counts are evened out by halving the longest edges). Faces
   * `${id}.bottom`, `.top`, `.side${i}` (two sections) or `.s${k}.side${i}`. `smooth` (three or more
   * sections): one smooth side per edge through them all (C1), named `.side${i}`.
   */
  | { readonly kind: 'loft'; readonly sections: readonly CadPartLoftSection[]; readonly smooth?: boolean }
  /**
   * A body read from a STEP file (its text); its faces keep their names, prefixed `${id}.`. `each`: every
   * solid of the file is its own part (`id/k`, in file order) instead of one body holding them all.
   */
  | { readonly kind: 'import'; readonly step: string; readonly each?: boolean }
  /**
   * A body in several pieces (a cut right through it) as one part per piece, `id/0`, `id/1` … in the
   * order of its B-rep's bodies; refused for a body in one piece.
   */
  | { readonly kind: 'separate'; readonly target: string }
  /** Hollowed to walls `thickness` thick; `open` names the faces removed (the top of a box, a side). */
  | { readonly kind: 'shell'; readonly target: string; readonly thickness: CadPartDim; readonly open?: readonly string[] }
  | { readonly kind: 'chamfer'; readonly target: string; readonly edges: readonly string[]; readonly distance: CadPartDim }
  /** Vertical edges of upright bodies. */
  | { readonly kind: 'fillet'; readonly target: string; readonly edges: readonly string[]; readonly radius: CadPartDim }
);
export interface CadPartDocument {
  readonly format: 'barocss-cad-part'; readonly version: 1; readonly units: 'mm';
  readonly parameters: Readonly<Record<string, number>>;
  readonly features: readonly CadPartFeature[];
}
export interface CadPartLoftSection { readonly sketch: string; readonly z: CadPartDim }
export type CadPartSweepStep = { readonly kind: 'straight'; readonly length: CadPartDim } | { readonly kind: 'bend'; readonly radius: CadPartDim; readonly angleDegrees: number; readonly toward: 'x' | '-x' | 'y' | '-y' };
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
  /** STEP AP214 (exact B-rep: planes, B-spline surfaces and curves) of this output. */
  exportStep(options?: { readonly name?: string }): string;
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
/** `history`: an upright body of one section and the edge finishes applied to it since (for shell). */
interface Finish { readonly kind: 'chamfer' | 'fillet'; readonly edges: readonly string[]; readonly size: number; readonly id: string }
/** `moved`: the part this one is a moved (turned, mirrored, uniformly scaled) copy of, for shell. */
interface Part {
  readonly solid: Solid; brep?: Brep; readonly mass?: (density: number) => SolidMassProperties;
  readonly history?: { readonly base: PrismaticSolid; readonly finishes: readonly Finish[] };
  readonly moved?: { readonly from: Part; readonly m: BrepAffine['matrix']; readonly o: Point };
  /** How a revolved or swept body was made (shell erodes its section and makes it again). */
  readonly revolved?: RevolveInput;
  readonly swept?: { readonly profile: readonly ProfileSegmentInput[]; readonly steps: readonly SweepStep[] };
}
type SweepStep = { kind: 'straight'; length: number } | { kind: 'bend'; radius: number; angle: number; toward: 'x' | '-x' | 'y' | '-y' };
/** x ↦ m·x + o from a sketch's own XY (Z along its normal) into the part. */
type Frame = { readonly m: BrepAffine['matrix']; readonly o: Point };
type Result = { readonly kind: 'sketch'; readonly outer: readonly ProfileSegmentInput[]; readonly frame?: Frame; readonly regions?: readonly (readonly ProfileSegmentInput[])[]; readonly holes?: readonly (readonly ProfileSegmentInput[])[] } | { readonly kind: 'solid'; readonly parts: readonly Part[] };

/** A B-rep of several bodies as one B-rep per body (each with its own shells, faces, loops, edges and vertices). */
function splitBodies(b: Brep): Brep[] {
  if (b.bodies.length <= 1) return [b];
  return b.bodies.map(body => {
    const shells = b.shells.filter(x => x.body === body.id), faceIds = new Set(shells.flatMap(x => x.faces)), faces = b.faces.filter(f => faceIds.has(f.id));
    const loopIds = new Set(faces.flatMap(f => f.loops)), loops = b.loops.filter(l => loopIds.has(l.id)), coIds = new Set(loops.flatMap(l => l.coedges));
    const coedges = b.coedges.filter(c => coIds.has(c.id)), edgeIds = new Set(coedges.map(c => c.edge)), edges = b.edges.filter(e => edgeIds.has(e.id)), vIds = new Set(edges.flatMap(e => e.vertices));
    return { ...b, bodies: [body], shells, faces, loops, coedges, edges, vertices: b.vertices.filter(v => vIds.has(v.id)) };
  });
}
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
/**
 * Results by their feature's resolved definition, each with the inputs it was made from: a feature is
 * reused when its definition is the same and every input is the very result (===) it was made from —
 * reused inputs stay the same objects, so a key never has to spell out what is upstream of it.
 */
type Cache = Map<string, { deps: readonly Result[]; result: Result }[]>;

export function evaluateCadPart(input: CadPartDocument, previous?: Cache): CadPartSnapshot {
  const doc = admit(input), cache: Cache = new Map(), results = new Map<string, Result>();
  const lookup = (key: string, deps: readonly Result[]) => previous?.get(key)?.find(e => e.deps.length === deps.length && e.deps.every((d, i) => d === deps[i]))?.result;
  const remember = (key: string, deps: readonly Result[], result: Result) => { const list = cache.get(key); if (list) list.push({ deps, result }); else cache.set(key, [{ deps, result }]); };
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

    let result: Result;
    const f = feature as CadPartFeature & Record<string, unknown>;
    // A feature whose resolved definition and inputs are unchanged is reused.
    try {
      if (f.kind === 'sketch') {
        const frame = f.plane === undefined ? undefined : frameOf(f.plane as CadPartSketchPlane, xyz, fail);
        const loops = (key: 'regions' | 'holes') => {
          const list = f[key] as unknown;
          if (list === undefined) return {};
          if (!Array.isArray(list) || list.length > CadPartLimits.edges) fail('INPUT', `${key} must list up to 64 loops`);
          return { [key]: (list as unknown[]).map((segments, i) => sketchOuter({ profile: 'loop', segments }, xy, dim, (code, detail) => fail(code, `${key}[${i}]: ${detail}`))) };
        };
        const sketch: Result = { kind: 'sketch', outer: sketchOuter(f, xy, dim, fail), ...(frame ? { frame } : {}), ...loops('regions'), ...loops('holes') };
        // (The same sketch as before is the same object, so what is built on it can be reused.)
        const key = 'sketch:' + JSON.stringify(sketch);
        result = lookup(key, []) ?? sketch;
        remember(key, [], result);
      } else {
        const compute = operation(f, { dim, xy, xyz, integer, axisOf, solids, ref, fail, at });
        const key = JSON.stringify([f.kind, resolvedDefinition(f, doc.parameters)]), inputs = deps.map(d => results.get(d)!);
        const reused = lookup(key, inputs);
        result = reused ?? compute();
        (reused ? reusedIds : evaluated).push(at);
        remember(key, inputs, result);
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

function frameOf(plane: CadPartSketchPlane, xyz: Tools['xyz'], fail: Tools['fail']): Frame {
  if (!isRecord(plane)) fail('INPUT', 'plane must be { origin, normal, xAxis }');
  const direction = (v: unknown, what: string): Point => {
    if (!Array.isArray(v) || v.length !== 3 || !v.every(c => typeof c === 'number' && Number.isFinite(c))) fail('INPUT', `plane ${what} must be [x, y, z]`);
    const l = Math.hypot(...(v as number[]));
    if (!(l > 1e-12)) fail('INPUT', `plane ${what} must not be zero`);
    return (v as number[]).map(c => c / l) as unknown as Point;
  };
  // Components within rounding of 0 or ±1 are exactly that, so axis-aligned planes stay exact.
  const snap = (v: Point): Point => v.map(c => Math.abs(c) < 1e-12 ? 0 : Math.abs(Math.abs(c) - 1) < 1e-12 ? Math.sign(c) : c) as unknown as Point;
  const n = snap(direction(plane.normal, 'normal')), x0 = direction(plane.xAxis, 'xAxis');
  if (Math.abs(dot(x0, n)) > 1e-9) fail('INPUT', 'plane xAxis must be perpendicular to its normal');
  const x = snap(unit(sub(x0, scale(n, dot(x0, n))))), y = snap(cross(n, x));
  return { m: [x[0], y[0], n[0], x[1], y[1], n[1], x[2], y[2], n[2]], o: xyz(plane.origin, 'plane origin') };
}
/** A result built on a sketch's own XY, moved onto its plane. */
const placed = (frame: Frame | undefined, compute: () => Result): (() => Result) =>
  !frame ? compute : () => { const r = compute(); return r.kind === 'solid' ? moveAll(r.parts, frame.m, frame.o) : r; };

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
      const { outer, frame, regions, holes } = sketch as Extract<Result, { kind: 'sketch' }>;
      const draft = f.draft === undefined ? 0 : f.draft as unknown;
      if (typeof draft !== 'number' || !Number.isFinite(draft) || !(Math.abs(draft) < 89)) fail('INPUT', 'draft must be a number of degrees below 89 in size');
      if (draft === 0) return placed(frame, () => one({ kind: 'upright', solid: prismaticFromProfile({ outer, ...(regions ? { regions } : {}), ...(holes ? { holes } : {}), heightMM: Math.abs(h), fromMM: h > 0 ? from : from + h, tag: at }) }));
      if (regions?.length || holes?.length) fail('CAPABILITY', 'a drafted extrude takes one loop (no regions or holes) yet');
      // Built upwards from the sketch plane, then turned over for a downward extrude (the walls lean
      // away from the sketch plane either way).
      return placed(frame, () => {
        let brep: Brep;
        try { brep = draftedExtrusion({ profile: outer, z0: 0, z1: Math.abs(h), draftDegrees: draft as number, tag: at, id: at }); }
        catch (cause) { if (cause instanceof BrepError) fail(/not supported yet/.test(cause.message) ? 'CAPABILITY' : 'PARAMETER', cause.message.replace(/^B-rep: drafted extrusion: /, '')); throw cause; }
        return one({ kind: 'brep', brep: transformBrep(brep!, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, h > 0 ? 1 : -1], offset: [0, 0, from] }) });
      });
    }
    case 'revolve': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length || (sketch as Extract<Result, { kind: 'sketch' }>).holes?.length) fail('CAPABILITY', `${f.kind} takes a sketch of one loop (no regions or holes) yet`);
      const ax = f.axis as { origin?: CadPartPoint2; direction?: unknown } | undefined;
      // The axis lies in the sketch plane: along its X or Y, or any direction [dx, dy] there.
      const free = Array.isArray(ax?.direction) && ax!.direction.length === 2 && ax!.direction.every(v => typeof v === 'number' && Number.isFinite(v)) && Math.hypot(...(ax!.direction as number[])) > 1e-12;
      if (!isRecord(ax) || (ax.direction !== 'x' && ax.direction !== 'y' && !free)) fail('INPUT', 'axis must be { origin: [x, y], direction: "x" | "y" | [dx, dy] }');
      const origin = xy(ax!.origin, 'axis origin'), deg = f.angleDegrees === undefined ? 360 : f.angleDegrees as number;
      if (typeof deg !== 'number' || !(deg > 0 && deg <= 360)) fail('INPUT', 'angleDegrees must be in (0, 360]');
      const input = { id: at, profile: (sketch as Extract<Result, { kind: 'sketch' }>).outer, axis: { origin, direction: (free ? ax!.direction : ax!.direction === 'x' ? [1, 0] : [0, 1]) as XY }, angleDegrees: deg };
      return placed((sketch as Extract<Result, { kind: 'sketch' }>).frame, () => ({ kind: 'solid', parts: [{ solid: { kind: 'brep', brep: revolveProfile(input) }, mass: (density: number) => revolveMassProperties(input, density), revolved: input }] }));
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
      const depth = f.depth === undefined ? null : dim(f.depth as CadPartDim, 'depth', true), axis = f.axis === undefined ? 'z' : axisOf(f.axis);
      const side = f.side === undefined ? 'max' : f.side;
      if (side !== 'min' && side !== 'max') fail('INPUT', 'side must be min or max');
      return () => many(target.map(p => {
        // The tool: a cylinder along local z over [h0, h1], centred at local (c1, c2), turned onto the axis
        // by a cyclic permutation (x: local x, y, z → world y, z, x; y: → world z, x, y).
        const box = bounds(p.solid), k = 'xyz'.indexOf(axis), hi = box.max[k], lo = box.min[k];
        const [h0, h1] = depth === null ? [lo - 1, hi + 1] : side === 'max' ? [hi - depth, hi + 1] : [lo - 1, lo + depth];
        const local: XY = axis === 'y' ? [c[1], c[0]] : c;
        const cylinder = prismaticFromProfile({ outer: [{ kind: 'arc', start: [local[0] + r, local[1]], center: local, direction: 'ccw' }], heightMM: h1 - h0, fromMM: h0, tag: at });
        const tool: Solid = axis === 'z' ? { kind: 'upright', solid: cylinder }
          : { kind: 'brep', brep: transformBrep(brepFromPrismatic(cylinder, { id: at + '_tool' }), { matrix: axis === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : [0, 1, 0, 0, 0, 1, 1, 0, 0] }) };
        const out = boolean(p.solid, tool, 'difference', at);
        if (volumeOfSolid(p.solid) - volumeOfSolid(out) <= 1e-6 * volumeOfSolid(p.solid)) fail('SELECTION', `the hole at (${c[0]}, ${c[1]}) along ${axis} misses the target`);
        return out;
      }));
    }
    case 'translate': {
      const target = solids(f.target, 'target'), o = xyz(f.offset as CadPartPoint3, 'offset');
      return () => moveAll(target, [1, 0, 0, 0, 1, 0, 0, 0, 1], o);
    }
    case 'rotate': {
      const target = solids(f.target, 'target'), axis = axisOf(f.axis), deg = f.angleDegrees as number, pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof deg !== 'number' || !Number.isFinite(deg) || Math.abs(deg) > 3600) fail('INPUT', 'angleDegrees must be a finite number of degrees');
      return () => { const { m, o } = rotation(axis, deg, pivot); return moveAll(target, m, o); };
    }
    case 'mirror': {
      const target = solids(f.target, 'target'), plane = f.plane;
      if (plane !== 'xy' && plane !== 'xz' && plane !== 'yz') fail('INPUT', 'plane must be xy, xz or yz');
      const m: BrepAffine['matrix'] = plane === 'xy' ? [1, 0, 0, 0, 1, 0, 0, 0, -1] : plane === 'xz' ? [1, 0, 0, 0, -1, 0, 0, 0, 1] : [-1, 0, 0, 0, 1, 0, 0, 0, 1];
      if (!f.keep) return () => moveAll(target, m, [0, 0, 0]);
      return () => many(target.map(p => boolean(p.solid, affine(p.solid, m, [0, 0, 0], n => n + '@m'), 'union', at)));
    }
    case 'scale': {
      const target = solids(f.target, 'target'), k = f.factor as number, pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof k !== 'number' || !(k > 0 && k <= 1000 && Number.isFinite(k))) fail('INPUT', 'factor must be a positive number at most 1000');
      return () => moveAll(target, [k, 0, 0, 0, k, 0, 0, 0, k], [pivot[0] * (1 - k), pivot[1] * (1 - k), pivot[2] * (1 - k)]);
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
    case 'sweep': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length || (sketch as Extract<Result, { kind: 'sketch' }>).holes?.length) fail('CAPABILITY', `${f.kind} takes a sketch of one loop (no regions or holes) yet`);
      const path = f.path as unknown;
      if (!Array.isArray(path) || !path.length || path.length > CadPartLimits.copies) fail('INPUT', 'path must list 1 to 64 steps');
      const steps = (path as unknown[]).map((st, i): { kind: 'straight'; length: number } | { kind: 'bend'; radius: number; angle: number; toward: 'x' | '-x' | 'y' | '-y' } => {
        if (!isRecord(st)) return fail('INPUT', `path[${i}] must be a step`);
        if (st.kind === 'straight') return { kind: 'straight', length: dim(st.length as CadPartDim, `path[${i}].length`, true) };
        if (st.kind === 'bend') {
          const a = st.angleDegrees, toward = st.toward;
          if (typeof a !== 'number' || !(a > 0 && a <= 180)) fail('INPUT', `path[${i}].angleDegrees must be in (0, 180]`);
          if (toward !== 'x' && toward !== '-x' && toward !== 'y' && toward !== '-y') fail('INPUT', `path[${i}].toward must be x, -x, y or -y`);
          return { kind: 'bend', radius: dim(st.radius as CadPartDim, `path[${i}].radius`, true), angle: a as number, toward: toward as 'x' | '-x' | 'y' | '-y' };
        }
        return fail('INPUT', `path[${i}].kind must be straight or bend`);
      });
      const { outer, frame } = sketch as Extract<Result, { kind: 'sketch' }>;
      return placed(frame, () => { const { brep, mass } = sweepBrep(outer, steps, at, fail); return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass, swept: { profile: outer, steps } }] }; });
    }
    case 'loft': {
      const list = f.sections as unknown;
      if (!Array.isArray(list) || list.length < 2 || list.length > CadPartLimits.copies) fail('INPUT', 'sections must list 2 to 64 sections');
      const sections = (list as unknown[]).map((sec, i) => {
        if (!isRecord(sec) || typeof sec.sketch !== 'string') return fail('INPUT', `sections[${i}] must name a sketch`);
        const sketch = ref(sec.sketch, 'sketch').result;
        if (sketch.kind !== 'sketch') fail('REFERENCE', `${sec.sketch} is not a sketch`);
        if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length || (sketch as Extract<Result, { kind: 'sketch' }>).holes?.length) fail('CAPABILITY', 'loft sections are sketches of one loop (no regions or holes) yet');
        const { outer, frame } = sketch as Extract<Result, { kind: 'sketch' }>;
        return { profile: outer, z: dim(sec.z as CadPartDim, `sections[${i}].z`), frame };
      });
      // The sections stack along one sketch plane's normal.
      const frame = sections[0].frame;
      if (sections.some(x => JSON.stringify(x.frame) !== JSON.stringify(frame))) fail('INPUT', 'loft sections must be sketched on the same plane');
      sections.forEach((s, i) => { if (i && !(s.z > sections[i - 1].z)) fail('PARAMETER', `sections[${i}] must lie above sections[${i - 1}] (z ${s.z} ≤ ${sections[i - 1].z})`); });
      if (f.smooth !== undefined && typeof f.smooth !== 'boolean') fail('INPUT', 'smooth must be true or false');
      return placed(frame, () => { const { brep, mass } = loftSolid({ id: at, name: at, sections: sections.map(({ profile, z }) => ({ profile, z })), smooth: f.smooth === true }); return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass }] }; });
    }
    case 'import': {
      if (typeof f.step !== 'string' || !f.step.length) fail('INPUT', 'step must be the text of a STEP file');
      if ((f.step as string).length > CadPartLimits.fileBytes) fail('INPUT', `the STEP file is larger than ${CadPartLimits.fileBytes} bytes`);
      return () => {
        let brep: Brep;
        try { brep = importStep(f.step as string, { id: at }); }
        catch (cause) { if (cause instanceof BrepError) fail(/not supported/.test(cause.message) ? 'CAPABILITY' : 'INPUT', cause.message.replace(/^B-rep: STEP: /, '')); throw cause; }
        // Names in this part: the feature id before each face name (an edge's two names alike).
        const named = { ...brep!, faces: brep!.faces.map((x, i) => x.name ? x : { ...x, name: `face${i}` }) };
        const prefixed = transformBrep(named, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, n => n.split('|').map(p => `${at}.${p}`).join('|'));
        if (f.each !== undefined && typeof f.each !== 'boolean') fail('INPUT', 'each must be true or false');
        return f.each ? many(brepBodies(prefixed).map(b => ({ kind: 'brep' as const, brep: b }))) : one({ kind: 'brep', brep: prefixed });
      };
    }
    case 'shell': {
      const target = solids(f.target, 'target'), t = dim(f.thickness as CadPartDim, 'thickness', true);
      const open = f.open === undefined ? [] : f.open as unknown;
      if (!Array.isArray(open) || open.length > CadPartLimits.edges || !open.every(x => typeof x === 'string')) fail('INPUT', 'open must list up to 64 face names');
      if (target.length !== 1) fail('REFERENCE', 'shell one part at a time (name it as id/k)');
      return () => ({ kind: 'solid', parts: [shellOf(target[0], t, open as string[], at, fail)] });
    }
    case 'separate': {
      const target = solids(f.target, 'target');
      if (target.length !== 1) fail('REFERENCE', 'separate one part at a time (name it as id/k)');
      return () => {
        const pieces = splitBodies(brepOf(target[0], at));
        if (pieces.length < 2) fail('SELECTION', 'the body is in one piece: there is nothing to separate');
        return { kind: 'solid', parts: pieces.map(brep => ({ solid: { kind: 'brep', brep } as Solid })) };
      };
    }
    case 'split': {
      const target = solids(f.target, 'target'), level = dim(f.at as CadPartDim, 'at');
      if (target.length !== 1) fail('REFERENCE', 'split one part at a time (name it as id/k)');
      const normal = f.normal === undefined ? null : xyz(f.normal as CadPartPoint3, 'normal');
      if (normal && !(len(normal) > 1e-12)) fail('INPUT', 'the split normal must not be zero');
      const along = normal ? [0, 1, 2].filter(k => normal[k] !== 0) : [];
      if (!normal || along.length === 1) {
        // Across a coordinate plane (a normal along one axis is that axis, below and above as its sign says).
        const a = normal ? along[0] : 'xyz'.indexOf(axisOf(f.axis)), axis = 'xyz'[a], cut = normal ? level / normal[a] : level, flip = !!normal && normal[a] < 0;
        return () => {
          const s = target[0].solid, box = bounds(s);
          if (!(cut > box.min[a] && cut < box.max[a])) fail('SELECTION', `the split plane ${axis} = ${cut} does not cross the target (${box.min[a]} to ${box.max[a]})`);
          const half = (lo: boolean) => { const min = box.min.map(v => v - 1) as Point, max = box.max.map(v => v + 1) as Point; if (lo) max[a] = cut; else min[a] = cut; return boxSolid(min, max, `${at}.cut`); };
          const pieces = [boolean(s, half(true), 'intersection', at), boolean(s, half(false), 'intersection', at)];
          return many(flip ? pieces.reverse() : pieces);
        };
      }
      return () => {
        // An oblique plane: each side a box standing on the plane (its frame turned to the normal) round the target.
        const s = target[0].solid, box = bounds(s), n = unit(normal), d = level / len(normal);
        const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i & 1 ? box.max[0] : box.min[0], i & 2 ? box.max[1] : box.min[1], i & 4 ? box.max[2] : box.min[2]] as Point).map(c => dot(n, c));
        if (!(d > Math.min(...corners) && d < Math.max(...corners))) fail('SELECTION', 'the split plane does not cross the target');
        const c = scale(add(box.min, box.max), 0.5), o = sub(c, scale(n, dot(n, c) - d)), R = len(sub(box.max, box.min)) + 2;
        const x = unit(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), y = cross(n, x);
        const m: BrepAffine['matrix'] = [x[0], y[0], n[0], x[1], y[1], n[1], x[2], y[2], n[2]];
        const half = (lo: boolean) => affine(boxSolid([-R, -R, lo ? -R : 0], [R, R, lo ? 0 : R], `${at}.cut`), m, o);
        const pieces = [boolean(s, half(true), 'intersection', at), boolean(s, half(false), 'intersection', at)];
        if (pieces.some(empty)) fail('SELECTION', 'the split plane does not cross the target');
        return many(pieces);
      };
    }
    case 'chamfer': case 'fillet': {
      const target = solids(f.target, 'target'), size = dim((f.kind === 'chamfer' ? f.distance : f.radius) as CadPartDim, f.kind === 'chamfer' ? 'distance' : 'radius', true);
      if (!Array.isArray(f.edges) || !f.edges.length || f.edges.length > CadPartLimits.edges || !f.edges.every(e => typeof e === 'string')) fail('INPUT', 'edges must list 1 to 64 edge names');
      if (target.length !== 1) fail('REFERENCE', 'finish one part at a time (name it as id/k)');
      return () => {
        const t = target[0], kind = f.kind as 'chamfer' | 'fillet', solid = finishEdges(t, f.edges as string[], size, kind, at, fail);
        // A body that left the upright family keeps how it was made, so that it can still be shelled.
        const base = t.solid.kind === 'upright' ? t.solid.solid : t.history?.base, before = t.solid.kind === 'upright' ? [] : t.history?.finishes ?? [];
        const history = solid.kind === 'brep' && base ? { base, finishes: [...before, { kind, edges: f.edges as string[], size, id: at }] } : undefined;
        return { kind: 'solid', parts: [{ solid, ...(history ? { history } : {}) }] };
      };
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
  if (a.kind === 'upright' && b.kind === 'upright') {
    const solid = booleanPrismatic(a.solid, b.solid, op);
    if (touchingLumps(solid)) throw new CadPartError('GEOMETRY', at, 'the bodies touch along an edge or at a vertex only; the result is not a manifold solid');
    return { kind: 'upright', solid };
  }
  const A = a.kind === 'upright' ? (lineOnly(a.solid) ? brepFromPrismatic(a.solid, { id: at + '_a' }) : null) : a.brep;
  const B = b.kind === 'upright' ? (lineOnly(b.solid) ? brepFromPrismatic(b.solid, { id: at + '_b' }) : null) : b.brep;
  if (A && B && planarBrep(A) && planarBrep(B)) return { kind: 'brep', brep: booleanPolyhedra(A, B, op, { id: at }) };
  // Planes and cylinders of any axis.
  const toBrep = (s: Solid) => s.kind === 'upright' ? brepFromPrismatic(s.solid, { id: at + '_in' }) : s.brep;
  try { return { kind: 'brep', brep: booleanAnalytic(toBrep(a), toBrep(b), op, { id: at }) }; }
  catch (cause) {
    if (cause instanceof BrepError && /not supported yet/.test(cause.message)) throw new CadPartError('CAPABILITY', at, cause.message.replace(/^B-rep: analytic Boolean: /, ''));
    throw cause;
  }
}
/**
 * Whether separate lumps of an upright solid meet only along an edge or at a point (the analytic and
 * polyhedral Booleans refuse such results; the upright section Boolean would keep them as one body).
 */
function touchingLumps(solid: PrismaticSolid): boolean {
  if (solid.slabs.length < 2 && solid.slabs.every(s => s.regions.length < 2)) return false;
  const brep = brepFromPrismatic(solid, { id: 'touch' });
  if (brep.bodies.length < 2) return false;
  const shellBody = new Map(brep.shells.map(s => [s.id, s.body])), faceBody = new Map(brep.faces.map(f => [f.id, shellBody.get(f.shell)!]));
  const loopBody = new Map(brep.loops.map(l => [l.id, faceBody.get(l.face)!])), edgeBody = new Map<string, string>();
  for (const c of brep.coedges) edgeBody.set(c.edge, loopBody.get(c.loop)!);
  const point = new Map(brep.vertices.map(v => [v.id, v.point])), vertexBody = new Map<string, string>();
  for (const e of brep.edges) for (const v of e.vertices) vertexBody.set(v, edgeBody.get(e.id)!);
  let size = 1; for (const v of brep.vertices) for (const x of v.point) size = Math.max(size, Math.abs(x));
  const tol = 1e-9 * size;
  // A vertex of one lump on a vertex or a straight edge of another.
  const onSegment = (p: Point, a: Point, b: Point) => {
    const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / Math.max(dot(ab, ab), 1e-300)));
    return len(sub(p, add(a, scale(ab, t)))) <= tol;
  };
  for (const v of brep.vertices) for (const e of brep.edges) {
    if (edgeBody.get(e.id) === vertexBody.get(v.id)) continue;
    const q = e.curve.controlPoints;
    if (e.curve.degree === 1 && q.length === 2 ? onSegment(v.point, q[0], q[1]) : e.vertices.some(w => len(sub(point.get(w)!, v.point)) <= tol)) return true;
  }
  return false;
}
const volumeOfSolid = (s: Solid) => s.kind === 'upright' ? prismaticVolume(s.solid) : s.brep.bodies.length ? brepMassProperties(s.brep, 1, { segmentsPerQuarter: 8, quadratureSegments: 0 }).volumeMM3 : 0;

function affine(s: Solid, m: BrepAffine['matrix'], o: readonly number[], rename?: (n: string) => string): Solid {
  // Upright solids stay upright when XY maps by a similarity and Z only scales and shifts.
  if (s.kind === 'upright' && m[2] === 0 && m[5] === 0 && m[6] === 0 && m[7] === 0)
    return { kind: 'upright', solid: transformPrismatic(s.solid, { matrix: [m[0], m[1], m[3], m[4]], offset: [o[0], o[1]], zScale: m[8], zOffset: o[2], ...(rename ? { retag: rename } : {}) }) };
  const brep = s.kind === 'upright' ? brepFromPrismatic(s.solid) : s.brep;
  return { kind: 'brep', brep: transformBrep(brep, { matrix: m, offset: [o[0], o[1], o[2]] }, rename) };
}
/**
 * Parts moved by x ↦ m·x + o (m a rotation or reflection times a uniform scale): each remembers what it
 * was moved from, and its mass moves with it (exact when the original's was).
 */
function moveAll(parts: readonly Part[], m: BrepAffine['matrix'], o: Point): Result {
  return { kind: 'solid', parts: parts.map((p): Part => {
    const exact = p.mass ?? (p.solid.kind === 'upright' ? ((s: PrismaticSolid) => (d: number) => prismaticMassProperties(s, d))(p.solid.solid) : undefined);
    return { solid: affine(p.solid, m, o), moved: { from: p, m, o }, ...(exact ? { mass: (d: number) => movedMass(exact(d), m, o) } : {}) };
  }) };
}
function movedMass(p: SolidMassProperties, m: BrepAffine['matrix'], o: Point): SolidMassProperties {
  const k = Math.cbrt(Math.abs(m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]))), R = m.map(x => x / k);
  const c = p.centroidMM, I = p.inertiaCentroidKgM2, k5 = k ** 5;
  const RIRt = [0, 1, 2].map(i => [0, 1, 2].map(j => { let sum = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) sum += R[3 * i + a] * I[a][b] * R[3 * j + b]; return sum * k5; })) as [[number, number, number], [number, number, number], [number, number, number]];
  return { volumeMM3: p.volumeMM3 * k ** 3, massKG: p.massKG * k ** 3, method: p.method, inertiaCentroidKgM2: RIRt,
    centroidMM: [0, 1, 2].map(i => m[3 * i] * c[0] + m[3 * i + 1] * c[1] + m[3 * i + 2] * c[2] + o[i]) as Point };
}
function rotation(axis: CadPartAxis, deg: number, pivot: Point): { m: BrepAffine['matrix']; o: Point } {
  let m: BrepAffine['matrix'];
  // Quarter turns exactly; any other angle by its sine and cosine.
  if (Math.round(deg / 90) * 90 === deg) m = quarterTurn(axis, deg);
  else {
    const r = deg * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
    m = axis === 'z' ? [c, -sn, 0, sn, c, 0, 0, 0, 1] : axis === 'x' ? [1, 0, 0, 0, c, -sn, 0, sn, c] : [c, 0, sn, 0, 1, 0, -sn, 0, c];
  }
  const mp = [m[0] * pivot[0] + m[1] * pivot[1] + m[2] * pivot[2], m[3] * pivot[0] + m[4] * pivot[1] + m[5] * pivot[2], m[6] * pivot[0] + m[7] * pivot[1] + m[8] * pivot[2]];
  return { m, o: [pivot[0] - mp[0], pivot[1] - mp[1], pivot[2] - mp[2]] };
}
function rotate(s: Solid, axis: CadPartAxis, deg: number, pivot: Point, rename?: (n: string) => string): Solid {
  const { m, o } = rotation(axis, deg, pivot);
  return affine(s, m, o, rename);
}

// ---- sweep -----------------------------------------------------------------------------------------------
/**
 * A profile swept along straight runs (extrusions) and bends (revolutions about an axis in the profile's
 * plane, a radius to its side), each placed where the last one ended; the pieces meet in whole
 * cross-sections and are joined.
 */
function sweepBrep(profile: readonly ProfileSegmentInput[], steps: readonly SweepStep[], at: string, fail: Tools['fail'], through?: XY): { brep: Brep; mass: (density: number) => SolidMassProperties } {
  // The path runs through the profile's centroid (or a given point): the profile is moved there, the body back.
  const centre = through ?? buildProfileLoop(profile, { maximumSegments: 1024 }).centroidMM;
  const outer: ProfileSegmentInput[] = profile.map(g => g.kind === 'line' ? { kind: 'line', start: [g.start[0] - centre[0], g.start[1] - centre[1]] } : { ...g, start: [g.start[0] - centre[0], g.start[1] - centre[1]], center: [g.center[0] - centre[0], g.center[1] - centre[1]] });
  let o: Point = [centre[0], centre[1], 0], x: Point = [1, 0, 0], y: Point = [0, 1, 0], z: Point = [0, 0, 1];
  // (Ids are identifiers; the pieces' faces are named `${at}.s${k}.…`.)
  const place = (b: Brep, k: number): Brep => transformBrep(b, { matrix: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]], offset: [o[0], o[1], o[2]] }, n => n.split(`${at}_s${k}`).join(`${at}.s${k}`));
  const rot = (v: Point, d: Point, t: number): Point => add(add(scale(v, Math.cos(t)), scale(cross(d, v), Math.sin(t))), scale(d, dot(d, v) * (1 - Math.cos(t))));
  // Each piece's mass in closed form, in its own frame (the pieces meet only in cross-sections).
  const pieces: Brep[] = [], masses: { local: (density: number) => SolidMassProperties; axes: [Point, Point, Point]; offset: Point }[] = [];
  steps.forEach((st, k) => {
    const tag = `${at}_s${k}`;
    if (st.kind === 'straight') {
      const prism = prismaticFromProfile({ outer, heightMM: st.length, tag });
      masses.push({ local: d => prismaticMassProperties(prism, d), axes: [x, y, z], offset: o });
      pieces.push(place(brepFromPrismatic(prism, { id: tag }), k));
      o = add(o, scale(z, st.length));
      return;
    }
    // The bend axis lies in the profile's plane, `radius` towards the side, square to that side.
    const side = st.toward, sx = side === 'x' ? 1 : side === '-x' ? -1 : 0, sy = side === 'y' ? 1 : side === '-y' ? -1 : 0;
    const origin: XY = [sx * st.radius, sy * st.radius], direction: XY = sx ? [0, 1] : [1, 0];
    let turned: Brep;
    try { turned = revolveProfile({ id: tag, profile: outer, axis: { origin, direction }, angleDegrees: st.angle }); }
    catch (cause) { if (cause instanceof BrepError && /axis/.test(cause.message)) fail('PARAMETER', `bend ${k}: the profile reaches the bend's axis (use a radius larger than the profile's reach towards ${side})`); throw cause; }
    pieces.push(place(turned!, k));
    const input = { id: tag, profile: outer, axis: { origin, direction }, angleDegrees: st.angle };
    masses.push({ local: d => revolveMassProperties(input, d), axes: [x, y, z], offset: o });
    // The frame turns about the axis by the bend's angle (z towards the side).
    const sideDir = sx ? scale(x, sx) : scale(y, sy), d = unit(cross(z, sideDir)), A = add(o, scale(sideDir, st.radius)), t = st.angle * Math.PI / 180;
    o = add(A, rot(sub(o, A), d, t)); x = rot(x, d, t); y = rot(y, d, t); z = rot(z, d, t);
  });
  // Consecutive pieces meet in a cross-section, each on its side of its plane: they are glued there,
  // exactly, unless pieces further apart may touch (then they are united by a Boolean).
  const box = (b: Brep) => { const lo: Point = [Infinity, Infinity, Infinity], hi: Point = [-Infinity, -Infinity, -Infinity]; for (const f of b.faces) for (const row of f.surface.controlPoints) for (const p of row) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } return { lo, hi }; };
  const boxes = pieces.map(box), apart = (i: number, j: number) => [0, 1, 2].some(k => boxes[i].hi[k] < boxes[j].lo[k] - 1e-6 || boxes[j].hi[k] < boxes[i].lo[k] - 1e-6);
  const separate = pieces.every((_, i) => pieces.every((__, j) => j <= i + 1 || apart(i, j)));
  let body = pieces[0];
  for (const p of pieces.slice(1)) body = (separate ? glueAtSharedFace(body, p, { family: 'sweep', id: at }) : null) ?? booleanAnalytic(body, p, 'union', { id: at });
  return { brep: body, mass: d => combineMassProperties(masses.map(m => ({ props: m.local(d), axes: m.axes, offset: m.offset }))) };
}

// ---- shell -----------------------------------------------------------------------------------------------
/**
 * An upright body of one section, hollowed: the section eroded by the thickness (exact for lines and
 * arcs), extruded from the thickness above the bottom to below the top (or through an open top or
 * bottom), and taken away; open side walls let the hollow run through them.
 */
/** The shell of a part, by how it was made (its mass exact when that can be). */
function shellOf(part: Part, t: number, open: string[], at: string, fail: Tools['fail']): Part {
  if (part.solid.kind !== 'upright') {
    if (part.revolved) return shellRevolved(part, part.revolved, t, open, at, fail);
    if (part.swept) return shellSwept(part, part.swept, t, open, at, fail);
    // A moved copy: the original's shell, moved (a scaled copy's with the wall scaled back).
    if (!part.history && part.moved) {
      const { from, m, o } = part.moved, k = Math.cbrt(Math.abs(m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6])));
      const inner = shellOf(from, t / k, open, at, fail);
      return { solid: affine(inner.solid, m, o), ...(inner.mass ? { mass: (d: number) => movedMass(inner.mass!(d), m, o) } : {}) };
    }
  }
  return { solid: shellPart(part, t, open, at, fail) };
}

function shellPart(part: Part, t: number, open: string[], at: string, fail: Tools['fail']): Solid {
  if (part.solid.kind === 'upright') { const h = hollowOf(part.solid.solid, t, open, at, fail); return { kind: 'upright', solid: booleanPrismatic(part.solid.solid, h.hollow, 'difference') }; }
  if (!part.history) {
    // Any other body of planes and cylinders: its wall as the union of a slab per face.
    const body = brepOf(part, 'target'), names = new Set(body.faces.map(f => f.name ?? ''));
    for (const n of open) if (!names.has(n)) fail('SELECTION', `no face named ${n} to open; faces: ${[...names].slice(0, 12).join(', ')}`);
    try { return { kind: 'brep', brep: generalShell(body, t, new Set(open), at) }; }
    catch (cause) {
      const m = cause instanceof BrepError ? /CAPABILITY: (.*)$/s.exec(cause.message) : null;
      if (m) fail('CAPABILITY', m[1]);
      if (cause instanceof BrepError && /not supported yet/.test(cause.message)) fail('CAPABILITY', cause.message.replace(/^B-rep: analytic Boolean: /, ''));
      throw cause;
    }
  }
  // A finished body: its hollow is the base's hollow with the same finishes, offset by the wall — a
  // rolling ball of radius r less the wall rounds the offset of a convex edge rounded r (sharp when r
  // is not more than the wall); an equal chamfer d on a corner of angle α becomes d + t(1 − 1/sin(α/2))/cos(α/2).
  const { base, finishes } = part.history!;
  if (base.slabs.length !== 1) fail('CAPABILITY', 'shell after finishing edges works on bodies extruded from one section yet');
  const h = hollowOf(base, t, open, at, fail);
  // Walls split in parts (a full circle's halves) keep their `#k` inside.
  const face = (n: string) => { const w = n.replace(/#\d+$/, ''); return h.sides.has(w) ? `${at}.in.${n}` : h.tops.has(n) ? `${at}.ceiling` : h.bottoms.has(n) ? `${at}.floor` : null; };
  const outer = brepOf(part, 'target'), faces = new Map(outer.faces.map(f => [f.name, f]));
  let hollow: Part = { solid: { kind: 'upright', solid: h.hollow } };
  for (const fin of finishes) {
    // Edges by their offset size (a chamfer's depends on each corner's angle).
    const jobs = new Map<number, string[]>();
    for (const name of fin.edges) {
      let size = fin.size - t;
      const parts = name.split('|');
      if (parts.some(n => open.includes(n))) fail('CAPABILITY', `${name} borders an open face: finish the opening's edges after the shell`);
      const mapped = parts.map(face);
      if (mapped.some(n => n === null)) fail('CAPABILITY', `${fin.id} finishes ${name}, an edge made by an earlier finish: shell before that finish`);
      if (fin.kind === 'chamfer') {
        // The corner's angle from the faces' normals there (a cap meets a wall square).
        const g = parts.map(n => { try { return faces.has(n) ? faceGeometry(faces.get(n)!) : { kind: 'other' as const }; } catch { return { kind: 'other' as const }; } });
        const alpha = g[0].kind === 'plane' && g[1].kind === 'plane' ? Math.PI - Math.acos(Math.max(-1, Math.min(1, dot(g[0].n, g[1].n)))) : Math.PI / 2;
        size = fin.size + t * (1 - 1 / Math.sin(alpha / 2)) / Math.cos(alpha / 2);
      }
      if (!(size > 1e-9)) continue;
      const key = Math.round(size * 1e9) / 1e9;
      jobs.set(key, [...(jobs.get(key) ?? []), (mapped as string[]).sort().join('|')]);
    }
    [...jobs].forEach(([size, edges], k) => {
      const known = new Set(brepOf(hollow, `${at}_hollow`).edges.map(e => e.name)), missing = edges.find(e => !known.has(e));
      if (missing) fail('CAPABILITY', `the wall rounds the inside corner of ${missing} already: shell inside corners finished by ${fin.id} is not supported yet`);
      hollow = { solid: finishEdges(hollow, edges, size, fin.kind, `${at}_in_${fin.id}${k ? `_${k}` : ''}`, fail) };
    });
  }
  // (Ids are identifiers; the hollow's finished faces are named `${at}.in.${finish}.…`.)
  const inner = hollow.solid.kind === 'brep' ? { kind: 'brep' as const, brep: transformBrep(hollow.solid.brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, 0] }, n => n.split(`${at}_in_`).join(`${at}.in.`)) } : hollow.solid;
  return boolean(part.solid, inner, 'difference', at);
}

/** A body less hollows inside it: masses and moments subtracted (inertia via the origin). */
function massLess(outer: SolidMassProperties, inner: readonly SolidMassProperties[]): SolidMassProperties {
  const about = (p: SolidMassProperties) => { const c = p.centroidMM.map(x => x * 1e-3), cc = c[0] ** 2 + c[1] ** 2 + c[2] ** 2; return p.inertiaCentroidKgM2.map((row, i) => row.map((v, j) => v + p.massKG * ((i === j ? cc : 0) - c[i] * c[j]))); };
  const m = outer.massKG - inner.reduce((a, p) => a + p.massKG, 0), V = outer.volumeMM3 - inner.reduce((a, p) => a + p.volumeMM3, 0);
  const c = [0, 1, 2].map(i => (outer.massKG * outer.centroidMM[i] - inner.reduce((a, p) => a + p.massKG * p.centroidMM[i], 0)) / m) as Point;
  const T = about(outer); for (const p of inner) about(p).forEach((row, i) => row.forEach((v, j) => { T[i][j] -= v; }));
  const cm = c.map(x => x * 1e-3), cc = cm[0] ** 2 + cm[1] ** 2 + cm[2] ** 2;
  const I = T.map((row, i) => row.map((v, j) => v - m * ((i === j ? cc : 0) - cm[i] * cm[j]))) as [[number, number, number], [number, number, number], [number, number, number]];
  return { volumeMM3: V, massKG: m, centroidMM: c, inertiaCentroidKgM2: I, method: outer.method };
}
/** A ring of section segments as profile segments (each from its start). */
const profileOfRing = (ring: readonly CurveSegment2[]): ProfileSegmentInput[] => ring.map(g => {
  if (g.kind === 'line') return { kind: 'line', start: [g.a[0], g.a[1]] };
  if (g.kind === 'arc') return { kind: 'arc', start: [g.c[0] + g.r * Math.cos(g.t0), g.c[1] + g.r * Math.sin(g.t0)], center: [g.c[0], g.c[1]], direction: g.sweep > 0 ? 'ccw' : 'cw' };
  throw new CadPartError('CAPABILITY', 'shell', 'a section with curves other than lines and arcs');
});
/** A profile's segments as a tagged section ring (`side<i>`, as the body's faces are named), and the loop. */
type LineArc = Extract<CurveSegment2, { kind: 'line' } | { kind: 'arc' }>;
function sectionRing(profile: readonly ProfileSegmentInput[]): LineArc[] {
  const built = buildProfileLoop(profile, { maximumSegments: 1024 }).segments;
  // A single circle is two halves (side0, side1), as the revolved body has it.
  const loop = built.length > 1 ? built : (() => { const a = built[0] as Extract<typeof built[number], { kind: 'arc' }>; return [{ ...a, sweep: a.sweep / 2 }, { ...a, startAngle: a.startAngle + a.sweep / 2, sweep: a.sweep / 2 }]; })();
  return loop.map((g, i): LineArc => g.kind === 'line' ? { kind: 'line', a: g.start, b: g.end, tag: `side${i}` } : { kind: 'arc', c: g.center, r: g.radiusMM, t0: g.startAngle, sweep: g.sweep, tag: `side${i}` });
}
const ringsOfRegions = (rs: readonly CurveRegion2[]) => rs.flatMap(r => [r.outer, ...r.holes]);
/** Each body of a B-rep on its own: its shells, faces, loops, coedges, edges and vertices. */
function brepBodies(b: Brep): Brep[] {
  return b.bodies.map(body => {
    const shells = new Set(body.shells), faces = b.faces.filter(x => shells.has(x.shell)), faceIds = new Set(faces.map(x => x.id));
    const loops = b.loops.filter(l => faceIds.has(l.face)), loopIds = new Set(loops.map(l => l.id));
    const coedges = b.coedges.filter(c => loopIds.has(c.loop)), edgeIds = new Set(coedges.map(c => c.edge));
    const edges = b.edges.filter(e => edgeIds.has(e.id)), vertexIds = new Set(edges.flatMap(e => e.vertices));
    return { ...b, bodies: [body], shells: b.shells.filter(x => shells.has(x.id)), faces, loops, coedges, edges, vertices: b.vertices.filter(v => vertexIds.has(v.id)) };
  });
}
const renamed = (b: Brep, from: string, to: string) => transformBrep(b, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, 0] }, n => n.split(from).join(to));

/**
 * A body turned a full turn, hollowed: every point's nearest wall lies in its own meridian plane, so
 * the hollow is the meridian section (with its mirror across the axis) eroded, turned again — exact,
 * its mass the body's less the hollow's part inside it (also turned: closed form).
 */
function shellRevolved(part: Part, input: RevolveInput, t: number, open: string[], at: string, fail: Tools['fail']): Part {
  if (input.angleDegrees !== 360) fail('CAPABILITY', 'shell works on bodies turned a full turn yet (this one stops at its start and end faces)');
  const id = input.id!, ring = sectionRing(input.profile), tags = new Set(ring.map(g => g.tag!)), tol = curveTolerance([ring]);
  const openTags = new Set(open.map(n => { const tag = n.startsWith(id + '.') ? n.slice(id.length + 1).replace(/#\d+$/, '') : ''; if (!tags.has(tag)) fail('SELECTION', `no face named ${n} to open; faces: ${[...tags].map(x => `${id}.${x}`).slice(0, 12).join(', ')}`); return tag; }));
  // The axis, its side the profile is on, and the mirror across it.
  const [dx, dy] = input.axis.direction, dl = Math.hypot(dx, dy), d: XY = [dx / dl, dy / dl], A = input.axis.origin, nrm: XY = [-d[1], d[0]];
  const side = Math.sign(ring.reduce((acc, g) => { const p = g.kind === 'line' ? g.a : [g.c[0] + g.r * Math.cos(g.t0 + g.sweep / 2), g.c[1] + g.r * Math.sin(g.t0 + g.sweep / 2)]; return acc + (p[0] - A[0]) * nrm[0] + (p[1] - A[1]) * nrm[1]; }, 0)) || 1;
  const refl = (p: readonly number[]): XY => { const v = [p[0] - A[0], p[1] - A[1]], u = v[0] * d[0] + v[1] * d[1]; return [A[0] + 2 * u * d[0] - v[0], A[1] + 2 * u * d[1] - v[1]]; };
  const phi = Math.atan2(d[1], d[0]);
  const mirror: LineArc[] = [...ring].reverse().map((g): LineArc => g.kind === 'line' ? { kind: 'line', a: refl(g.b), b: refl(g.a), tag: g.tag } : { kind: 'arc', c: refl(g.c), r: g.r, t0: 2 * phi - g.t0 - g.sweep, sweep: g.sweep, tag: g.tag });
  const whole = booleanCurveRegions([ring], [mirror], 'union', tol);
  let inner: CurveRegion2[] = [];
  try { inner = erodeSection(whole, t, tag => !!tag && openTags.has(tag), () => 'wall', tol); }
  catch (cause) { if (cause instanceof Error && /only straight walls/.test(cause.message)) fail('CAPABILITY', cause.message); throw cause; }
  // The profile's half of it.
  const L = 4 * Math.max(1, ...ring.flatMap(g => g.kind === 'line' ? [...g.a, ...g.b].map(Math.abs) : [Math.abs(g.c[0]) + g.r, Math.abs(g.c[1]) + g.r]), Math.abs(A[0]), Math.abs(A[1]));
  const at2 = (u: number, w: number): XY => [A[0] + u * d[0] + w * side * nrm[0], A[1] + u * d[1] + w * side * nrm[1]];
  const corners = [at2(-L, 0), at2(L, 0), at2(L, L), at2(-L, L)], halfPlane: CurveSegment2[] = corners.map((p, k) => ({ kind: 'line', a: p, b: corners[(k + 1) % 4] }));
  const area = (rs: CurveRegion2[]) => rs.reduce((a, r) => a + regionMoments(r)[0], 0);
  const orient = (ring: readonly CurveSegment2[]): CurveSegment2[] => area([{ outer: ring, holes: [] }]) < 0 ? [...ring].reverse().map(segReverse) : [...ring];
  const half = booleanCurveRegions(ringsOfRegions(inner), [orient(halfPlane)], 'intersection', tol);
  if (!half.length || area(half) <= tol * tol) fail('PARAMETER', `a wall of ${t} mm leaves no hollow inside this body`);
  if (half.some(r => r.holes.length)) fail('CAPABILITY', 'shell of a revolved body whose hollow section has islands is not supported yet');
  const pieces = half.map((r, k) => ({ id: `${at}_in${k}`, profile: profileOfRing(r.outer), axis: input.axis, angleDegrees: 360 }));
  const hollow = mergeBreps(pieces.map(pc => renamed(revolveProfile(pc), `${at}_in`, `${at}.in`)), { family: 'revolve', id: `${at}_hollow` });
  // The hollow inside the body: the eroded half within the profile (an opening runs out past it).
  const inside = booleanCurveRegions(ringsOfRegions(half), [orient(ring)], 'intersection', tol).map((r, k) => ({ id: `${at}_m${k}`, profile: profileOfRing(r.outer), axis: input.axis, angleDegrees: 360 }));
  // Nothing opened: the hollow lies inside, apart from the walls — a cavity, no Boolean needed.
  const solid: Solid = openTags.size ? boolean(part.solid, { kind: 'brep', brep: hollow }, 'difference', at) : { kind: 'brep', brep: withCavities(brepOf(part, 'target'), hollow, { family: 'shell', id: at }) };
  return { solid, mass: d => massLess(revolveMassProperties(input, d), inside.map(pc => revolveMassProperties(pc, d))) };
}

/**
 * A swept body hollowed: its walls' normals lie in the path's cross-sections, so the hollow is the
 * section eroded, swept along the same path (through the same point) — run out past an open end,
 * started a wall's thickness into a closed one (on a straight run); exact, mass included.
 */
function shellSwept(part: Part, swept: NonNullable<Part['swept']>, t: number, open: string[], at: string, fail: Tools['fail']): Part {
  const steps = [...swept.steps], last = steps.length - 1, brep = brepOf(part, 'target');
  const names = new Set(brep.faces.map(f => f.name ?? '')), startName = [`${at}`].length ? [...names].find(n => /\.s0\.(bottom|start)$/.test(n)) : undefined, endName = [...names].find(n => new RegExp(`\\.s${last}\\.(top|end)$`).test(n));
  for (const n of open) if (n !== startName && n !== endName) fail(names.has(n) ? 'CAPABILITY' : 'SELECTION', names.has(n) ? `only a swept body's end faces can be opened yet (${startName}, ${endName})` : `no face named ${n} to open; faces: ${[startName, endName].join(', ')}`);
  const openStart = !!startName && open.includes(startName), openEnd = !!endName && open.includes(endName);
  const ring = sectionRing(swept.profile), tol = curveTolerance([ring]), centre = buildProfileLoop(swept.profile, { maximumSegments: 1024 }).centroidMM;
  const inner = erodeSection([{ outer: ring, holes: [] }], t, () => false, () => 'wall', tol);
  if (!inner.length) fail('PARAMETER', `a wall of ${t} mm leaves no hollow inside this section`);
  if (inner.length > 1 || inner[0].holes.length) fail('CAPABILITY', 'shell of a swept body whose hollow section falls apart is not supported yet');
  const profile = profileOfRing(inner[0].outer);
  // Its ends: a closed end on a straight run starts the hollow a wall into it.
  const trim = (k: number) => { const st = steps[k]; if (st.kind !== 'straight' || !(st.length > t)) fail('CAPABILITY', 'a closed end of a swept body must be a straight run longer than the wall yet (open it, or start with a run)'); return st.length - t; };
  const inside = steps.map(s => ({ ...s }));
  let lift = 0;
  if (!openStart) { inside[0] = { kind: 'straight', length: trim(0) }; lift = t; }
  if (!openEnd) { const k = last; const base = inside[k] as SweepStep; if (k === 0 && !openStart) { if (!(base.kind === 'straight' && base.length > t)) fail('CAPABILITY', 'the run is too short for both closed ends'); inside[0] = { kind: 'straight', length: (base as { length: number }).length - t }; } else inside[k] = { kind: 'straight', length: trim(k) }; }
  const run = 1 + t, path: SweepStep[] = [...(openStart ? [{ kind: 'straight' as const, length: run }] : []), ...inside, ...(openEnd ? [{ kind: 'straight' as const, length: run }] : [])];
  const shift = openStart ? -run : lift;
  const made = sweepBrep(profile, path, `${at}_in`, fail, centre), hollow = transformBrep(renamed(made.brep, `${at}_in`, `${at}.in`), { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, shift] });
  const within = sweepBrep(profile, inside, `${at}_m`, fail, centre);
  const solid: Solid = openStart || openEnd ? boolean(part.solid, { kind: 'brep', brep: hollow }, 'difference', at) : { kind: 'brep', brep: withCavities(brep, hollow, { family: 'shell', id: at }) };
  return { solid, mass: d => { const m = within.mass(d); return massLess(part.mass!(d), [movedMass(m, [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, lift])]); } };
}

/**
 * The hollow of an upright body (one section, or sections stacked): a point is hollow when it is at
 * least the wall from every wall at its height and at the heights within the wall above and below it
 * — the section at z is the intersection of the sections over [z − t, z + t], eroded (exact for lines
 * and arcs); offset walls and ledges meet sharply, as offset faces do. It runs on through open faces.
 */
function hollowOf(solid: PrismaticSolid, t: number, open: string[], at: string, fail: Tools['fail']): { hollow: PrismaticSolid; sides: Set<string>; tops: Set<string>; bottoms: Set<string> } {
  const slabs = [...solid.slabs].sort((a, b) => a.z0 - b.z0), rings = slabs.flatMap(s => s.regions.flatMap(r => [r.outer, ...r.holes])), tol = curveTolerance(rings);
  for (let k = 1; k < slabs.length; k++) if (slabs[k].z0 > slabs[k - 1].z1 + tol) fail('CAPABILITY', 'shell works on one body at a time (this one has pieces apart along its height)');
  const zmin = slabs[0].z0, zmax = slabs[slabs.length - 1].z1;
  const sides = new Set(rings.flatMap(r => r.map(g => g.tag).filter((x): x is string => !!x)));
  const capAt = (z: number) => (solid.caps ?? []).filter(c => Math.abs(c.z - z) <= tol).map(c => c.tag);
  const tops = new Set(capAt(zmax)), bottoms = new Set(capAt(zmin)), ledges = new Set((solid.caps ?? []).map(c => c.tag).filter(x => !tops.has(x) && !bottoms.has(x)));
  for (const name of open) {
    if (ledges.has(name)) fail('CAPABILITY', `${name} is a step between sections: only the top, the bottom and sides can be opened yet`);
    if (!sides.has(name) && !tops.has(name) && !bottoms.has(name)) fail('SELECTION', `no face named ${name} to open; faces: ${[...tops, ...bottoms, ...sides].slice(0, 12).join(', ')}`);
  }
  const openTop = open.some(n => tops.has(n)), openBottom = open.some(n => bottoms.has(n)), openSides = new Set(open.filter(n => sides.has(n)));
  const lo = openBottom ? zmin - 1 : zmin + t, hi = openTop ? zmax + 1 : zmax - t;
  if (!(hi > lo + tol)) fail('PARAMETER', `a wall of ${t} mm leaves no hollow between the top and the bottom`);
  // Heights where the window [z − t, z + t] takes in another section.
  const cuts = [...new Set([lo, hi, ...slabs.slice(1).flatMap(s => [s.z0 - t, s.z0 + t])].filter(z => z >= lo - tol && z <= hi + tol))].sort((a, b) => a - b);
  const pieces: { z0: number; z1: number; regions: CurveRegion2[] }[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const z0 = cuts[k], z1 = cuts[k + 1]; if (z1 - z0 <= tol) continue;
    const m = (z0 + z1) / 2, inWindow = slabs.filter(s => s.z0 < m + t - tol && s.z1 > m - t + tol);
    if (!inWindow.length) continue;
    let section: CurveRegion2[] = inWindow[0].regions as CurveRegion2[];
    for (const s of inWindow.slice(1)) section = booleanCurveRegions(section.flatMap(r => [r.outer, ...r.holes]), s.regions.flatMap(r => [r.outer, ...r.holes]), 'intersection', tol);
    let inner: CurveRegion2[] = [];
    try { inner = section.length ? erodeSection(section, t, tag => !!tag && openSides.has(tag), tag => `${at}.in.${tag ?? 'wall'}`, tol) : []; }
    catch (cause) { if (cause instanceof Error && /only straight walls/.test(cause.message)) fail('CAPABILITY', cause.message); throw cause; }
    if (inner.length) pieces.push({ z0, z1, regions: inner });
  }
  if (!pieces.length) fail('PARAMETER', `a wall of ${t} mm leaves no hollow inside this body`);
  let hollow = prismaticExtrude(pieces[0].regions.flatMap(r => [r.outer, ...r.holes]), pieces[0].z0, pieces[0].z1);
  for (const p of pieces.slice(1)) hollow = booleanPrismatic(hollow, prismaticExtrude(p.regions.flatMap(r => [r.outer, ...r.holes]), p.z0, p.z1), 'union');
  // Its floor and ceiling, and the steps between (the offset ledges), are named after the shell.
  const levels = [...new Set(hollow.slabs.flatMap(s => [s.z0, s.z1]))].sort((a, b) => a - b), all = pieces.flatMap(p => p.regions);
  const caps = levels.map((z, k) => ({ z, regions: all, tag: k === 0 ? `${at}.floor` : k === levels.length - 1 ? `${at}.ceiling` : `${at}.step${k}` }));
  return { hollow: { ...hollow, caps }, sides, tops, bottoms };
}

// ---- chamfers and fillets ------------------------------------------------------------------------------
function finishEdges(part: Part, names: string[], size: number, kind: 'chamfer' | 'fillet', at: string, fail: Tools['fail']): Solid {
  // Vertical corners of an upright body keep it upright (its section is finished exactly); straight
  // chamfers elsewhere cut a wedge; every other edge (sloping or curved, on any body) gets a rolling-ball
  // tool (finishBrepEdges).
  const brep = brepOf(part, 'target'), byName = new Map(brep.edges.map(e => [e.name, e]));
  const vertical: { x: number; y: number; z0: number; z1: number; name: string }[] = [], wedges: Brep['edges'][number][] = [], general: string[] = [];
  for (const name of names) {
    const e = byName.get(name);
    if (!e) fail('SELECTION', `no edge named ${name}; edges: ${brep.edges.slice(0, 12).map(x => x.name).join(', ')}${brep.edges.length > 12 ? ', …' : ''}`);
    const p = e!.curve.controlPoints, a = p[0], b = p[p.length - 1], straight = e!.curve.degree === 1 && p.length === 2;
    const tol = 1e-9 * Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs));
    if (straight && part.solid.kind === 'upright' && Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && uprightCorner(part.solid.solid, a[0], a[1], tol)) vertical.push({ x: a[0], y: a[1], z0: Math.min(a[2], b[2]), z1: Math.max(a[2], b[2]), name: name });
    else if (straight && kind === 'chamfer') wedges.push(e!);
    else general.push(name);
  }
  // A vertical edge meeting another finished edge at a vertex goes with it (their corner is one blend).
  if (general.length || wedges.length) {
    const ends = [...general.map(n => byName.get(n)!), ...wedges].flatMap(e => [e.curve.controlPoints[0], e.curve.controlPoints[e.curve.controlPoints.length - 1]]);
    for (let i = vertical.length - 1; i >= 0; i--) {
      const c = vertical[i], tol = 1e-9 * Math.max(1, Math.abs(c.x), Math.abs(c.y), Math.abs(c.z0), Math.abs(c.z1));
      if (ends.some(p => Math.abs(p[0] - c.x) <= tol && Math.abs(p[1] - c.y) <= tol && (Math.abs(p[2] - c.z0) <= tol || Math.abs(p[2] - c.z1) <= tol))) { general.push(c.name); vertical.splice(i, 1); }
    }
  }
  let solid = part.solid;
  if (vertical.length) solid = { kind: 'upright', solid: cornerFinish((solid as Extract<Solid, { kind: 'upright' }>).solid, vertical, size, kind, at, fail) };
  for (const e of wedges) solid = wedgeChamfer(solid, brep, e, size, at, fail);
  if (general.length) {
    const body = solid.kind === 'upright' ? brepFromPrismatic(solid.solid) : solid.brep;
    try { solid = { kind: 'brep', brep: finishBrepEdges(body, general, size, kind, at) }; }
    catch (cause) {
      const m = cause instanceof BrepError ? /^B-rep: (SELECTION|CAPABILITY|PARAMETER): (.*)$/s.exec(cause.message) : null;
      if (m) fail(m[1] as CadPartErrorCode, m[2]);
      if (cause instanceof BrepError && /not supported yet/.test(cause.message)) fail('CAPABILITY', cause.message.replace(/^B-rep: analytic Boolean: /, ''));
      throw cause;
    }
  }
  return solid;
}
/** Whether (x, y) is a corner between two straight walls in some slab of an upright body. */
function uprightCorner(solid: PrismaticSolid, x: number, y: number, tol: number): boolean {
  return solid.slabs.some(slab => slab.regions.some(r => [r.outer, ...r.holes].some(ring => ring.some((s, i) => {
    const n = ring[(i + 1) % ring.length], p = segEnd(s);
    return Math.hypot(p[0] - x, p[1] - y) <= Math.max(tol, 1e-9) && s.kind === 'line' && n.kind === 'line';
  }))));
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
  const P = edge.curve.controlPoints[0], Q = edge.curve.controlPoints[1], e = unit(sub(Q, P));
  const sides = uses.map(c => {
    const f = faceOf(c.loop), s = f.surface;
    if (!(s.degreeU === 1 && s.degreeV === 1)) fail('CAPABILITY', `edge ${edge.name}: chamfers along horizontal edges need planar faces`);
    const [[p00, p01], [p10]] = s.controlPoints as Point[][], n0 = cross(sub(p10, p00), sub(p01, p00)), n = unit(f.sense === 'forward' ? n0 : [-n0[0], -n0[1], -n0[2]]);
    const dir: Point = c.sense === 'forward' ? e : [-e[0], -e[1], -e[2]];
    return { n, w: unit(cross(n, dir)) }; // w: into the face, perpendicular to the edge
  });
  const [s1, s2] = sides, convex = dot(s2.w, s1.n) < 0;
  // Cutting, the chamfer must fit on both faces: d at most each face's reach across the edge.
  if (convex) {
    const walls = uses.map((c, k) => faceReach(source, faceOf(c.loop).id, P, sides[k].w)), tol = 1e-6 * Math.max(1, ...P.map(Math.abs), ...Q.map(Math.abs));
    if (walls.some(w => d > w + tol)) fail('PARAMETER', `edge ${edge.name}: chamfer ${d} mm is too large for walls of ${+walls[0].toFixed(6)} and ${+walls[1].toFixed(6)} mm`);
  }
  const corner = (X: Point) => {
    const A1 = add(X, scale(s1.w, d)), A2 = add(X, scale(s2.w, d)), M = scale(add(A1, A2), 0.5);
    // Grown about the chamfer line so no wedge face lies on a face of the body.
    return [sub(scale(A1, 2), A2), sub(scale(A2, 2), A1), sub(scale(X, 2), M)];
  };
  const grow = convex ? d : 0, T0 = corner(sub(P, scale(e, grow))), T1 = corner(add(Q, scale(e, grow)));
  const wedge = prismBrep(T0, T1, `${at}.face`);
  const body = solid.kind === 'upright' ? brepFromPrismatic(solid.solid) : solid.brep;
  if (planarBrep(body)) return { kind: 'brep', brep: booleanPolyhedra(body, wedge, convex ? 'difference' : 'union', { id: at }) };
  try { return { kind: 'brep', brep: booleanAnalytic(body, wedge, convex ? 'difference' : 'union', { id: at }) }; }
  catch (cause) { if (cause instanceof BrepError && /not supported yet/.test(cause.message)) fail('CAPABILITY', `edge ${edge.name}: the chamfer would cut a curved face at an angle (not supported yet)`); throw cause; }
}

/** A triangular prism between triangles T0 and T1 (corresponding corners), faces pointing out. */
function prismBrep(T0: Point[], T1: Point[], name: string): Brep {
  const a = T0[0], A = T1[0];
  let [b, c] = [T0[1], T0[2]], [B, C] = [T1[1], T1[2]];
  // Orient so the T0 triangle faces away from T1.
  if (dot(cross(sub(b, a), sub(c, a)), sub(A, a)) > 0) { [b, c] = [c, b]; [B, C] = [C, B]; }
  const pts = [a, b, c, A, B, C];
  const faces = [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]];
  const plane = (ids: number[]) => { const p = ids.map(i => pts[i]), n = unit(cross(sub(p[1], p[0]), sub(p[2], p[0]))), e1 = unit(sub(p[1], p[0])), e2 = cross(n, e1);
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
    massProperties(density: number) { return part.mass ? part.mass(density) : part.solid.kind === 'upright' ? prismaticMassProperties(part.solid.solid, density) : brepMassProperties(brep, density, { segmentsPerQuarter: 32 }); },
    exportStl(options: { readonly segmentsPerQuarter?: number } = {}) { return stl(brep, options.segmentsPerQuarter ?? 16); },
    exportStep(options: { readonly name?: string } = {}) { return exportStep(brep, { name: options.name ?? id }); },
  });
}
function stl(brep: Brep, segmentsPerQuarter: number): Uint8Array {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter });
  return encodeBinaryStl(mesh.positionsMM, mesh.indices, 'barocss part (mm)');
}
