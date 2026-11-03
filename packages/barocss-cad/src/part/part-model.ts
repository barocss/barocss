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
import { BrepError, checkBrep, isFacetFace, nurbsOf, type Brep, type BrepCheckReport } from '../brep/brep-core.js';
import { brepFromPrismatic, booleanPrismatic, prismaticFromProfile, prismaticVolume, transformPrismatic, isPrismaticSolidError, type PrismaticSolid } from '../features/prismatic-solid.js';
import { unitNamedField } from '../document/unit-named.js';
import { sampleRing, isCurvedArrangementError, type CurveSegment2, type XY } from '../brep/curved-arrangement.js';
import { booleanPolyhedra } from '../brep/polyhedral-boolean.js';
import { booleanAnalytic, faceGeometry, splitFaceAlongCurve, splitFaceAlongIsocline } from '../brep/analytic-boolean.js';
import { draftedExtrusion } from '../features/drafted-extrusion.js';
import { cylindricalWrapFeature } from '../features/cylindrical-wrap-feature.js';
import { transformOperation } from './part-transform.js';
import { prismaticDetailOperation } from './part-prismatic-detail.js';
import { stepTessellatedChars } from '../io/step.js';
import { brepFromTriangles, isMeshBrepError } from '../mesh/mesh-brep.js';
import { weldVertices } from '../mesh/facet-brep.js';
import { splitFacetBrep, type FacetSplitResult } from '../mesh/facet-split.js';
import { facetBoolean, isFacetBooleanError, splitMixedBrep } from '../mesh/facet-boolean.js';
import { selfIntersections } from '../mesh/mesh-repair.js';
import { sweepSolid } from '../brep/sweep-solid.js';
import { validateCurve } from '../core/math.js';

import { SIDE_TAG, type SideTags } from '../document/side-names.js';

import { revolveProfile, revolveMassProperties } from '../features/revolve.js';
import { transformBrep, quarterTurn, type BrepAffine } from '../brep/brep-transform.js';
import { tessellateBrep } from '../brep/brep-tessellate.js';
import { rayHit, triangleBvh } from '../mesh/triangle-bvh.js';
import { combineMassProperties, prismaticMassProperties, brepMassProperties, brepSurfaceArea, isSolidMassError, type MassProperties } from '../brep/solid-mass.js';
import { readNativeSIInertia, transferNativeMassBasis, unsupportedNativeMass } from '../internal/native-si-mass-state.js';
import { glueAtSharedFace } from '../brep/brep-glue.js';
import { loftSolid, type LoftInput, type LoftSectionFrame, type LoftSectionInput } from '../features/loft.js';

import { flatPattern as sheetFlatPattern, isFlatPatternError, type FlatPattern } from '../frame-sheet/sheet-flat.js';
import { isExtrudedProfileError, buildProfileLoop, type ProfileSegmentInput } from '../features/extruded-profile-solid.js';
import { type BeadSharedComponent } from '../frame-sheet/frame-weldment.js';

import type { Curve, FacetPatch, Point } from '../types.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import { encodeBinaryStl } from '../io/stl.js';
import { gearOperation } from './part-gears.js';
import { machineOperation } from './part-machine.js';
import { threadSolid } from '../machine/thread-solid.js';
import { finishOperation } from './part-finish.js';
import { meshOperation } from './part-mesh.js';
import { shellOperation, brepBodies } from './part-shell.js';
import { bandOperation } from './part-band.js';
import { sheetOperation } from './part-sheet.js';
import { faceFilletOperation } from './part-face-fillet.js';
import { frameOperation, planEndpointBeads, endpointContext, isEndpointBead } from './part-frame.js';
import type { EndpointBead } from './part-frame.js';
import { checkExpected, expectOf } from './part-expect.js';
import { KernelError } from '../core/barocss-error.js';
import { boundaryBindingRefusal } from './part-boundary-refusal-internal.js';
import { refusalCodeOf, type CadRefusalCode } from '../core/error-codes.js';

export type { CadPartDim, CadPartAxis, CadPartPoint2, CadPartPoint3, CadPartLoopSegment, CadPartSketchPlane, CadPartSideTags, CadPartFeature, CadPartSheetK, CadPartDocument, CadPartLoftSection, CadPartSweepStep, CadPartFrameCorners, CadPartFrameNotch, CadPartFrameTrim, CadPartFrameOverride, CadPartFrameSegment, CadPartSection, CadPartErrorCode, CadPartBeadSharing, CadPartOutput, CadPartSnapshot, Solid, Finish, Part, RackPlacement, GearPlacement, WormPlacement, BevelGearPlacement, SweepStep, Result, CadPartEvaluationOptions, CadPartProfileCalls, CadPartFeatureProfile } from './part-types.js';
import type { CadPartDim, CadPartAxis, CadPartPoint2, CadPartPoint3, CadPartLoopSegment, CadPartSketchPlane, CadPartFeature, CadPartDocument, CadPartErrorCode, CadPartOutput, CadPartSnapshot, Solid, Part, SweepStep, Result, Frame, CadPartEvaluationOptions, CadPartProfileCalls, CadPartFeatureProfile } from './part-types.js';

/**
 * A part-model refusal. Its `code` is the specific bracketed code of its message where it has one (`[FIT_TABLE_MISS]
 * …`), else its category; the category is in `details.category` either way (R7.3a batch 2, D278).
 */
export class CadPartError extends KernelError {
  declare readonly code: CadPartErrorCode | CadRefusalCode;
  declare readonly details: { readonly category: CadPartErrorCode };
  constructor(category: CadPartErrorCode, readonly feature: string | null, detail: string, readonly sharedComponent?: BeadSharedComponent) {
    super(`${feature ? feature + ': ' : ''}${detail}`.slice(0, 1024), { code: refusalCodeOf(detail) ?? category, details: { category } }); this.name = 'CadPartError';
  }
}
/**
 * `stepBytes`: an imported STEP file's text. A STEP file is read whole, and a solid of many faces holds
 * about 17 times its text in memory while it is built (a 19 MB faceted M8 bolt: about 320 MB): 32 MiB keeps
 * that near half a gigabyte, within a browser worker, and holds the studio's own exports of modelled
 * threads. The part document's own text stays at `fileBytes`. `stepTessellatedBytes`: a file whose excess over
 * `stepBytes` is tessellated meshes (AP242: the studio's own mesh exports, scans) — see `stepSizeProblem`.
 */
export const CadPartLimits = Object.freeze({ features: 512, parameters: 256, points: 1024, edges: 64, copies: 64, fileBytes: 4 << 20, stepBytes: 32 << 20, stepTessellatedBytes: 128 << 20, length: 10000, meshTriangles: 2_000_000, planarMeshTriangles: 100_000, subdVertices: 100_000 });
/**
 * Why a STEP file is too large to read, or null: its text past `stepTessellatedBytes`, or what is not tessellated in
 * it (B-rep records and the rest) past `stepBytes` (D49). Tessellated records take about 13 times their text while
 * read into a part (a 50 MB file of a million triangles: 680 MB; the owner's 128 MiB, D49, holds a 2M-triangle file) and a
 * mesh that size is held as arrays after; a mesh larger still opens from a .bcad file. A scan, no parse: checked before a file is read (the studio's worker too).
 */
export function stepSizeProblem(text: string): string | null {
  const MiB = (n: number) => `${n / 2 ** 20} MiB`;
  if (text.length > CadPartLimits.stepTessellatedBytes) return `the STEP file is larger than ${MiB(CadPartLimits.stepTessellatedBytes)}; a mesh that large opens from a .bcad file (its arrays kept as binary)`;
  if (text.length <= CadPartLimits.stepBytes) return null;
  const other = text.length - stepTessellatedChars(text);
  return other > CadPartLimits.stepBytes ? `the STEP file is larger than ${MiB(CadPartLimits.stepBytes)} outside its meshes (${(other / 2 ** 20).toFixed(1)} MiB); only tessellated meshes may take it up to ${MiB(CadPartLimits.stepTessellatedBytes)}` : null;
}

// ---- representation ------------------------------------------------------------------------------

/** A B-rep of several bodies as one B-rep per body (each with its own shells, faces, loops, edges and vertices). */
export function splitBodies(b: Brep): Brep[] {
  if (b.bodies.length <= 1) return [b];
  return b.bodies.map(body => {
    const shells = b.shells.filter(x => x.body === body.id), faceIds = new Set(shells.flatMap(x => x.faces)), faces = b.faces.filter(f => faceIds.has(f.id));
    const loopIds = new Set(faces.flatMap(f => f.loops)), loops = b.loops.filter(l => loopIds.has(l.id)), coIds = new Set(loops.flatMap(l => l.coedges));
    const coedges = b.coedges.filter(c => coIds.has(c.id)), edgeIds = new Set(coedges.map(c => c.edge)), edges = b.edges.filter(e => edgeIds.has(e.id)), vIds = new Set(edges.flatMap(e => e.vertices));
    return { ...b, bodies: [body], shells, faces, loops, coedges, edges, vertices: b.vertices.filter(v => vIds.has(v.id)) };
  });
}
export const empty = (s: Solid) => s.kind === 'upright' ? !s.solid.slabs.length : !s.brep.bodies.length;
const lineOnly = (s: PrismaticSolid) => s.slabs.every(x => x.regions.every(r => [r.outer, ...r.holes].every(ring => ring.every(g => g.kind === 'line'))));
export const planarBrep = (b: Brep) => b.faces.every(f => f.surface.kind === 'surface' && f.surface.degreeU === 1 && f.surface.degreeV === 1 && f.surface.controlPoints.length === 2 && f.surface.controlPoints[0].length === 2) && b.edges.every(e => e.curve.degree === 1 && e.curve.controlPoints.length === 2);
const representation = (s: Solid): CadPartOutput['representation'] => s.kind === 'upright' ? 'upright' : s.brep.faces.some(isFacetFace) ? 'faceted' : planarBrep(s.brep) ? 'planar' : 'curved';
/**
 * F0 fallback (owner, 2026-10-18; D3, D42): a facet body (a mesh imported as facet faces) meets a Boolean,
 * split, hole or draft only through the planar path until F1/F2 give facets their own — exploded back to the
 * planar per-triangle B-rep when it has at most this many triangles, refused with CAPABILITY above it. Committed
 * evaluations take up to this many: about 5 s at the worst, a hole (its cylinder takes the analytic path) through
 * a 16k-triangle mesh in the studio's whole evaluation (4.8 s; 18k 5.1–5.4 s, 20k 6.1 s; a polyhedral union with a
 * box is faster, 3.2 s at 20k in R2). Since F1 (D50) and F2 (D52) only a Boolean of two meshes takes it (F3); F2
 * holds the same number for the mesh near an exact tool, the share its exact Boolean takes.
 */
export const FACET_EXPLODE_TRIANGLES = 16000;
/** A preview's limit (CadPartEvaluationOptions.facetExplodeTriangles): about a second, so a preview stays live. */
export const FACET_PREVIEW_TRIANGLES = 5000;
/** The limit of the evaluation running now (evaluateCadPart is synchronous: set for its run, restored after). */
let facetLimit = FACET_EXPLODE_TRIANGLES;
/** The current feature's kernel calls while `profile` evaluates (null otherwise: one test per counted call). */
export let profiling: CadPartProfileCalls | null = null;
function explodeFacets(b: Brep, at: string, what: string): Brep {
  if (!b.faces.some(isFacetFace)) return b;
  if (!b.faces.every(isFacetFace)) throw new CadPartError('CAPABILITY', at, `${what} on a body mixing mesh and other faces is not supported yet`);
  if (b.bodies.some(x => x.kind === 'sheet')) throw new CadPartError('GEOMETRY', at, `${what} need a closed solid: this mesh is open (a sheet)`);
  let count = 0; for (const f of b.faces) count += (f.surface as FacetPatch).indices.length / 3;
  if (count > facetLimit) throw new CadPartError('CAPABILITY', at, count <= FACET_EXPLODE_TRIANGLES
    ? `${what} on meshes over ${facetLimit} triangles are not previewed (this mesh has ${count}): apply to run it (up to ${FACET_EXPLODE_TRIANGLES})`
    : `${what} of two large meshes arrive with F3 (this mesh has ${count} triangles; up to ${FACET_EXPLODE_TRIANGLES} go through the planar path)`);
  // Every face's triangles, wound outward, into one planar mesh solid.
  const positions: number[] = [], indices: number[] = [];
  for (const f of b.faces) {
    const F = f.surface as FacetPatch, base = positions.length / 3, X = F.indices, fw = f.sense === 'forward';
    for (let i = 0; i < F.positions.length; i++) positions.push(F.positions[i]);
    for (let t = 0; t < X.length; t += 3) indices.push(base + X[t], base + (fw ? X[t + 1] : X[t + 2]), base + (fw ? X[t + 2] : X[t + 1]));
  }
  // (A mesh crossing itself has no inside to cut: refused with where, D46. Its faces' vertices are welded first.)
  const welded = weldVertices(positions, positions.length / 3, 1e-9 * Math.max(1, ...positions.map(Math.abs))), wi = Uint32Array.from(indices, v => welded.remap[v]);
  const crossing = selfIntersections(welded.P, wi);
  if (crossing.count) throw new CadPartError('GEOMETRY', at, `${what} need a mesh that does not cross itself: this one does in ${crossing.count} place${crossing.count > 1 ? 's' : ''} (near ${crossing.at[0].map(x => +x.toFixed(2)).join(', ')}); repair does not fix that yet`);
  try { return brepFromTriangles(positions, indices, { id: b.bodies[0]?.id ?? at, maximumTriangles: count }); }
  catch (cause) { if (isMeshBrepError(cause)) throw new CadPartError('GEOMETRY', at, cause.message); throw cause; }
}
export const brepOf = (part: Part, id: string): Brep => part.brep ??= part.solid.kind === 'upright' ? brepFromPrismatic(part.solid.solid, { id }) : part.solid.brep;
/** A feature run after its stored names are checked on each target part (O19, D277). */
function expectedThen(f: CadPartFeature & Record<string, unknown>, t: Tools, expect: ReturnType<typeof expectOf> & object, run: () => Result): () => Result {
  const parts = t.solids(f.target, 'target'), edges = f.kind === 'fillet' || f.kind === 'chamfer';
  return () => { for (const p of parts) checkExpected(brepOf(p, t.at), expect, edges, f.kind, t.fail); return run(); };
}

/** Free space closer than this above a hole's face (mm) refuses it (D148b): the cutter has no room to stop short of it. */
const OBSTRUCTION_MM = 1e-3;
/** Unit vectors of the two coordinates a hole's `center` is in, for axis k: z → (x, y), x → (y, z), y → (x, z). */
const HOLE_PLANE_AXES: readonly (readonly [number, number])[] = [[1, 2], [0, 2], [0, 1]];
/**
 * The free space above a hole's face along its axis (D148b): rays from the face's plane, out along its normal, from the
 * hole's centre and 16 points on its rim and 8 at half its radius, against the body's tessellation (K2's tree); the
 * least hit, or Infinity when nothing is above.
 */
function clearanceAbove(brep: Brep, k: number, dir: 1 | -1, face: number, c: XY, r: number): number {
  if (profiling) profiling.tessellations++;
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: 8 }), bvh = triangleBvh(mesh.positions, mesh.indices), [a, b] = HOLE_PLANE_AXES[k];
  const o: Point = [0, 0, 0], d: Point = [0, 0, 0]; d[k] = dir;
  let least = Infinity;
  for (let s = 0; s < 25; s++) {
    const rad = s === 0 ? 0 : s <= 16 ? r : r / 2, ang = s === 0 ? 0 : s <= 16 ? 2 * Math.PI * (s - 1) / 16 : 2 * Math.PI * (s - 17) / 8;
    o[a] = c[0] + rad * Math.cos(ang); o[b] = c[1] + rad * Math.sin(ang); o[k] = face;
    least = Math.min(least, rayHit(bvh, o, d, 1e-9));
  }
  return least;
}
/** A named planar face of a body square to coordinate axis k: its plane's coordinate and the side its outward normal faces (D148). */
function holeFace(brep: Brep, name: string, k: number, fail: (code: CadPartErrorCode, detail: string) => never): { at: number; side: 'min' | 'max' } {
  const face = brep.faces.find(x => x.name === name || (x.name ?? '').split('#')[0] === name);
  if (!face) return fail('REFERENCE', `no face ${name} on the target`);
  const g = faceGeometry(face);
  if (g.kind !== 'plane' || Math.abs(Math.abs(g.n[k]) - 1) > 1e-9) return fail('SELECTION', `${name} is not a flat face square to the hole's axis`);
  return { at: g.o[k], side: g.n[k] > 0 ? 'max' : 'min' };
}
function bounds(s: Solid): { min: Point; max: Point } {
  const min: Point = [Infinity, Infinity, Infinity], max: Point = [-Infinity, -Infinity, -Infinity];
  const take = (p: readonly number[]) => { for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); } };
  if (s.kind === 'upright') for (const slab of s.solid.slabs) for (const r of slab.regions) for (const p of sampleRing(r.outer, Math.PI / 64)) { take([p[0], p[1], slab.z0]); take([p[0], p[1], slab.z1]); }
  else {
    for (const v of s.brep.vertices) take(v.point); for (const e of s.brep.edges) for (const p of e.curve.controlPoints) take(p);
    // (A facet face can reach past its boundary's points: its patch's box.)
    for (const f of s.brep.faces) if (f.surface.kind === 'facets') { const b = f.surface.bounds; take([b[0], b[1], b[2]]); take([b[3], b[4], b[5]]); }
  }
  return { min, max };
}

// ---- document admission ----------------------------------------------------------------------------
const ID = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function admit(input: unknown): CadPartDocument {
  const fail = (detail: string, feature: string | null = null): never => { throw new CadPartError('FORMAT', feature, detail); };
  if (!isRecord(input) || input.format !== 'barocss-cad-part' || input.version !== 1 || input.units !== 'mm') fail('a barocss-cad-part version 1 document in mm is required');
  const doc = input as unknown as CadPartDocument;
  if (!isRecord(doc.parameters) || Object.keys(doc.parameters).length > CadPartLimits.parameters) fail('parameters must be an object of at most 256 entries');
  for (const [k, v] of Object.entries(doc.parameters)) if (!ID.test(k) || typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > CadPartLimits.length) fail(`parameter ${k} must be a finite number within ±10000`);
  if (!Array.isArray(doc.features) || doc.features.length > CadPartLimits.features) fail('features must be an array of at most 512 features');
  const seen = new Set<string>();
  for (const f of doc.features) {
    if (!isRecord(f) || typeof f.id !== 'string' || !ID.test(f.id)) fail('every feature needs an id (a letter, then letters, digits, _ or -)');
    if (seen.has(f.id)) fail('duplicate feature id', f.id);
    seen.add(f.id);
    const named = unitNamedField(f);
    if (named) fail(`${named.path} is not a field: a length, angle or force carries no unit in its name (R7.7b, D281) — it is ${named.field}`, f.id);
  }
  return copyDocument(doc) as CadPartDocument;
}
const isMeshArray = (v: unknown): v is Float64Array | Float32Array | Uint32Array | Int32Array => v instanceof Float64Array || v instanceof Float32Array || v instanceof Uint32Array || v instanceof Int32Array;
/** A deep copy of the document's JSON values; a mesh's typed arrays shared as they are (they are never changed). */
function copyDocument(v: unknown): unknown {
  if (isMeshArray(v)) return v;
  if (Array.isArray(v)) return v.map(copyDocument);
  if (v && typeof v === 'object') { const out: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = copyDocument(x); return out; }
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  return v;
}
/** Checked once per array object: x, y, z numbers within the length limit, or vertex numbers below `nv` (three a triangle, at most the limit). */
const checkedArrays = new WeakMap<object, string>();
function meshArrayOk(v: unknown, what: 'positions' | 'indices', nv = 0): boolean {
  if (!Array.isArray(v) && !isMeshArray(v)) return false;
  const a = v as ArrayLike<number>, key = `${what}:${nv}`;
  if (checkedArrays.get(a as object) === key) return true;
  if (a.length % 3) return false;
  if (what === 'positions') { for (let i = 0; i < a.length; i++) { const x = a[i]; if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > CadPartLimits.length) return false; } }
  else { if (a.length / 3 > CadPartLimits.meshTriangles) return false; for (let i = 0; i < a.length; i++) { const x = a[i]; if (!Number.isInteger(x) || x < 0 || x >= nv) return false; } }
  checkedArrays.set(a as object, key);
  return true;
}
/** A typed array's reuse key: its kind, length and an FNV-1a hash of its bytes, worked out once per array. */
const arrayHashes = new WeakMap<object, string>();
function hashOfArray(a: Float64Array | Float32Array | Uint32Array | Int32Array): string {
  let h = arrayHashes.get(a);
  if (h === undefined) {
    const bytes = new Uint32Array(a.buffer, a.byteOffset, a.byteLength >> 2);
    let x = 0x811c9dc5, y = 0x01000193;
    for (let i = 0; i < bytes.length; i++) { x = Math.imul(x ^ bytes[i], 0x01000193); y = Math.imul(y ^ (bytes[i] >>> 7), 0x85ebca6b); }
    h = `${a.constructor.name}:${a.length}:${(x >>> 0).toString(16)}${(y >>> 0).toString(16)}`;
    arrayHashes.set(a, h);
  }
  return h;
}

// ---- evaluation --------------------------------------------------------------------------------------
/**
 * Results by their feature's resolved definition, each with the inputs it was made from: a feature is
 * reused when its definition is the same and every input is the very result (===) it was made from —
 * reused inputs stay the same objects, so a key never has to spell out what is upstream of it.
 */
type Cache = Map<string, { deps: readonly Result[]; result: Result }[]>;

export function evaluateCadPart(input: CadPartDocument, previous?: Cache, options: CadPartEvaluationOptions = {}): CadPartSnapshot {
  const was = facetLimit, wasProfiling = profiling;
  facetLimit = Math.min(FACET_EXPLODE_TRIANGLES, options.facetExplodeTriangles ?? FACET_EXPLODE_TRIANGLES);
  try { return evaluateWith(input, previous, options); }
  finally { facetLimit = was; profiling = wasProfiling; }
}
function evaluateWith(input: CadPartDocument, previous: Cache | undefined, options: CadPartEvaluationOptions): CadPartSnapshot {
  const doc = admit(input), cache: Cache = new Map(), results = new Map<string, Result>();
  const lookup = (key: string, deps: readonly Result[]) => previous?.get(key)?.find(e => e.deps.length === deps.length && e.deps.every((d, i) => d === deps[i]))?.result;
  const remember = (key: string, deps: readonly Result[], result: Result) => { const list = cache.get(key); if (list) list.push({ deps, result }); else cache.set(key, [{ deps, result }]); };
  const consumed = new Map<string, Set<number> | 'all'>(), features: { id: string; kind: CadPartFeature['kind']; dependencies: string[] }[] = [];
  const evaluated: string[] = [], reusedIds: string[] = [], profile: Record<string, CadPartFeatureProfile> | null = options.profile === true ? {} : null;
  // One frame plan per evaluation. A participant cannot escape a peer's refusal through the result cache.
  const beadPlans = new Map<string, ReturnType<typeof planEndpointBeads>>();
  const endpointBead: Tools['endpointBead'] = (f, byMember, frame) => {
    let plan = beadPlans.get(frame);
    if (!plan) { plan = planEndpointBeads(doc.features, byMember, frame, doc.parameters); beadPlans.set(frame, plan); }
    const entry = plan.get(f.id)!;
    if (entry instanceof CadPartError) throw entry;
    return entry;
  };
  for (const feature of doc.features) {
    const at = feature.id, deps: string[] = [];
    let started = 0;
    if (profile) { profiling = { booleans: 0, planarBooleans: 0, tessellations: 0, sweeps: 0, shells: 0, finishes: 0 }; started = performance.now(); }
    const fail = (code: CadPartErrorCode, detail: string): never => { throw new CadPartError(code, at, detail); };
    const dim = (v: CadPartDim | undefined, what: string, positive = false): number => {
      let x: unknown = v;
      if (isRecord(v)) { const name = (v as { parameter: unknown }).parameter; if (typeof name !== 'string' || !Object.hasOwn(doc.parameters, name)) fail('PARAMETER', `${what}: unknown parameter ${String(name)}`); x = doc.parameters[name as string]; }
      if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > CadPartLimits.length) fail('PARAMETER', `${what} must be a finite length within ±10000 mm`);
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
      let part = k === undefined ? null : Number(k);
      const author = doc.features.find(f => f.id === id);
      if (part !== null && author?.kind === 'frame' && author.bends !== undefined && result!.kind === 'solid') part = result!.parts.findIndex(p => p.member?.frame?.member === part);

      if (part !== null && !(Number.isInteger(part) && part >= 0 && result!.kind === 'solid' && part < result!.parts.length)) fail('REFERENCE', `${what}: ${r} is not a part`);
      return { id, part, result: result! };
    };
    const solids = (r: unknown, what: string, allowEmpty = false): Part[] => {
      const { id, part, result } = ref(r, what);
      if (result.kind !== 'solid') fail('REFERENCE', `${what}: ${id} is a sketch, not a solid`);
      const parts = (result as Extract<Result, { kind: 'solid' }>).parts, picked = part === null ? parts : [parts[part]];
      if (picked.some(p => p.cylindricalWrap)) fail('CAPABILITY', 'a cylindrical wrap reference cannot be consumed by another feature yet; its reference mass and face tolerance apply only to the original result');
      if (!allowEmpty && picked.every(p => empty(p.solid))) fail('SELECTION', `${what}: ${r} is empty`);
      const used = consumed.get(id); if (part === null) consumed.set(id, 'all'); else if (used !== 'all') consumed.set(id, (used ?? new Set()).add(part));
      return picked.filter(p => !empty(p.solid));
    };
    const cutSource: Tools['cutSource'] = r => {
      const selected = ref(r, 'target'), author = doc.features.find(f => f.id === selected.id);
      if (author?.kind !== 'difference') return fail('REFERENCE', 'feature pattern target must be a direct difference result');
      if ('suppressed' in author && author.suppressed) return fail('REFERENCE', 'feature pattern target must be an unsuppressed difference');
      const used = consumed.get(selected.id);
      if (used === 'all' || used?.has(0)) return fail('REFERENCE', 'feature pattern target must still be active');
      if (selected.result.kind !== 'solid' || selected.result.parts.length !== 1 || empty(selected.result.parts[0].solid)) return fail('REFERENCE', 'feature pattern target must be one nonempty solid');
      // One Part may hold several B-rep bodies; count the existing representation without mutating the cached Part.
      const selectedBrep = brepOf({ solid: selected.result.parts[0].solid }, selected.id);
      if (selectedBrep.bodies.length !== 1 || selectedBrep.bodies[0].kind !== 'solid') return fail('REFERENCE', 'feature pattern target must be one nonempty solid');
      // Resolve the original operands as dependencies; never replace or truncate their history.
      const base = solids(author.target, 'difference target', true), tool = solids(author.tool, 'difference tool', true);
      if (base.length !== 1) return fail('REFERENCE', 'feature pattern difference must have one base solid');
      return { seed: solids(r, 'target')[0], tool };
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
        const drawn = { outer: sketchOuter(f, xy, dim, fail), ...loops('regions'), ...loops('holes') } as { outer: ProfileSegmentInput[]; regions?: ProfileSegmentInput[][]; holes?: ProfileSegmentInput[][] };
        const tags = f.sideTags === undefined ? undefined : sideTagsOf(f.sideTags, drawn, fail);
        const sketch: Result = { kind: 'sketch', ...drawn, ...(frame ? { frame } : {}), ...(tags ? { tags } : {}) };
        // (The same sketch as before is the same object, so what is built on it can be reused.)
        const key = 'sketch:' + JSON.stringify(sketch);
        result = lookup(key, []) ?? sketch;
        remember(key, [], result);
      } else {
        const tools = { dim, xy, xyz, integer, axisOf, solids, ref, cutSource, fail, at, endpointBead }, run = operation(f, tools);
        // (O19: stored names checked against what they named before the feature builds on them, D277.)
        const expect = expectOf(f, fail), compute = expect && f.kind !== 'band-surface' ? expectedThen(f, tools, expect, run) : run;
        const key = JSON.stringify([f.kind, resolvedDefinition(f, doc.parameters), ...(isEndpointBead(f) ? [endpointContext(doc.features, f.frame, doc.parameters)] : [])]), inputs = deps.map(d => results.get(d)!);
        const reused = lookup(key, inputs);
        result = reused ?? compute();
        (reused ? reusedIds : evaluated).push(at);
        remember(key, inputs, result);
      }
    } catch (cause) {
      if (cause instanceof CadPartError) throw cause;
      const binding = boundaryBindingRefusal(cause);
      if (binding) throw new CadPartError(binding.code, at, binding.message);
      // Kernel refusals keep their own reason; anything else is reported, never swallowed.
      const known = cause instanceof BrepError || isPrismaticSolidError(cause) || isCurvedArrangementError(cause) || isExtrudedProfileError(cause) || isSolidMassError(cause);
      throw new CadPartError('GEOMETRY', at, known ? (cause as Error).message : `unexpected kernel failure: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    results.set(at, result); features.push({ id: at, kind: f.kind, dependencies: [...new Set(deps)] });
    if (profile) { profile[at] = Object.freeze({ wallTime: (performance.now() - started) / 1000, calls: Object.freeze(profiling!) }); profiling = null; }
  }
  // Outputs: parts not consumed by a later feature.
  const outputs: CadPartOutput[] = [];
  for (const feature of doc.features) {
    const result = results.get(feature.id)!, used = consumed.get(feature.id);
    if (result.kind !== 'solid' || used === 'all') continue;
    result.parts.forEach((part, k) => {
      if (used?.has(k) || empty(part.solid)) return;
      outputs.push(makeOutput(feature.kind === 'frame' && feature.bends !== undefined ? `${feature.id}/${part.member?.frame?.member ?? k}` : result.parts.length === 1 ? feature.id : `${feature.id}/${k}`, feature.id, part));
    });
  }
  const snapshot: CadPartSnapshot = {
    document: deepFreeze(doc), outputs: Object.freeze(outputs), features: deepFreeze(features), recomputation: deepFreeze({ evaluated, reused: reusedIds }),
    ...(profile ? { profile: Object.freeze(profile) } : undefined),
  };
  snapshotState.set(snapshot, { cache, ...(options ? { options } : {}) });
  return Object.freeze(snapshot);
}

/** A snapshot's evaluation cache and options, so a re-evaluation reuses what it can (R7.3b). */
const snapshotState = new WeakMap<CadPartSnapshot, { readonly cache: Cache | undefined; readonly options?: CadPartEvaluationOptions }>();
/** The output of a snapshot by id; refused, REFERENCE, when there is none. */
export function outputOf(snapshot: CadPartSnapshot, id: string): CadPartOutput {
  const o = snapshot.outputs.find(x => x.id === id); if (!o) throw new CadPartError('REFERENCE', null, `no output ${id}`); return o;
}
/**
 * A snapshot evaluated again: with new parameter values (`parameters`, each one the document declares), or another
 * document (`document`); every feature whose resolved definition is unchanged is reused.
 */
export function reevaluate(snapshot: CadPartSnapshot, change: { readonly parameters: Readonly<Record<string, number>> } | { readonly document: CadPartDocument }): CadPartSnapshot {
  const st = snapshotState.get(snapshot), doc = snapshot.document;
  if ('document' in change) return evaluateCadPart(change.document, st?.cache, st?.options);
  const parameters = { ...doc.parameters };
  for (const [k, v] of Object.entries(change.parameters)) { if (!Object.hasOwn(parameters, k)) throw new CadPartError('PARAMETER', null, `unknown parameter ${k}`); parameters[k] = v; }
  return evaluateCadPart({ ...doc, parameters }, st?.cache, st?.options);
}
/** A snapshot's document as saved text (a mesh's typed arrays written as plain arrays). */
export const saveCadPart = (snapshot: CadPartSnapshot): string => JSON.stringify(snapshot.document, (_, v) => isMeshArray(v) ? Array.from(v) : v) + '\n';

/** Parses and evaluates a saved part document. */
export function loadCadPart(text: string): CadPartSnapshot {
  if (typeof text !== 'string' || text.length > CadPartLimits.fileBytes) throw new CadPartError('FORMAT', null, 'a part document of at most 4 MiB is required');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new CadPartError('FORMAT', null, 'malformed JSON'); }
  return evaluateCadPart(parsed as CadPartDocument);
}
export const emptyCadPart = (): CadPartDocument => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [] });

function deepFreeze<T>(v: T): T { if (v && typeof v === 'object' && !ArrayBuffer.isView(v) && !Object.isFrozen(v)) { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } return v; }
/** The feature with parameters replaced by their values (the reuse key). */
/**
 * Long texts (an imported STEP file) stand in the reuse keys as an exact id from a map of the last few, compared by
 * content — not written out again into every key (a 30 MB file was 70–90 ms an evaluation; PERF3 C16). An id is never
 * given to another text; a text fallen out of the map gets a new one (a miss, not a wrong reuse).
 */
const LONG_TEXT = 1 << 16, TEXTS_KEPT = 8, textIds = new Map<string, number>();
let nextTextId = 1;
function textKey(t: string): string {
  let id = textIds.get(t);
  if (id === undefined) { id = nextTextId++; if (textIds.size >= TEXTS_KEPT) textIds.delete(textIds.keys().next().value!); }
  else textIds.delete(t);
  textIds.set(t, id);
  return `\u0000text#${id}:${t.length}`;
}
export function resolvedDefinition(f: unknown, parameters: Readonly<Record<string, number>>): unknown {
  if (isMeshArray(f)) return hashOfArray(f);
  if (typeof f === 'string' && f.length > LONG_TEXT) return textKey(f);
  if (Array.isArray(f)) return f.map(x => resolvedDefinition(x, parameters));
  if (isRecord(f)) { if (typeof f.parameter === 'string' && Object.keys(f).length === 1) return parameters[f.parameter]; return Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'id').map(([k, v]) => [k, resolvedDefinition(v, parameters)])); }
  return f;
}

export type Tools = {
  dim: (v: CadPartDim | undefined, what: string, positive?: boolean) => number; xy: (p: CadPartPoint2 | undefined, what: string) => XY; xyz: (p: CadPartPoint3 | undefined, what: string) => Point;
  integer: (v: unknown, what: string, lo: number, hi: number) => number; axisOf: (v: unknown) => CadPartAxis; solids: (r: unknown, what: string, allowEmpty?: boolean) => Part[];
  ref: (r: unknown, what: string) => { id: string; part: number | null; result: Result };
  cutSource: (r: unknown) => { seed: Part; tool: Part[] };
  fail: (code: CadPartErrorCode, detail: string) => never; at: string;
  endpointBead: (f: EndpointBead, byMember: ReadonlyMap<number, Part>, frame: string) => Result;
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
/** A point of a sketch's own XYZ in the part. */
const framed = (frame: Frame | undefined, p: Point): Point => !frame ? p : [frame.m[0] * p[0] + frame.m[1] * p[1] + frame.m[2] * p[2] + frame.o[0], frame.m[3] * p[0] + frame.m[4] * p[1] + frame.m[5] * p[2] + frame.o[1], frame.m[6] * p[0] + frame.m[7] * p[1] + frame.m[8] * p[2] + frame.o[2]];
/** A solid's volume by its exact surfaces (quadrature where curved): the flange's collision test. */
export const exactVolume = (s: Solid) => s.kind === 'upright' ? prismaticVolume(s.solid) : brepMassProperties(s.brep, 1).volume;
/** The points of a face's loops' vertices (its edges' ends). */
export function faceVertices(brep: Brep, face: string): Point[] {
  const loops = new Set(brep.loops.filter(l => l.face === face).map(l => l.id)), edges = new Map(brep.edges.map(x => [x.id, x])), out: Point[] = [];
  for (const c of brep.coedges) if (loops.has(c.loop)) { const p = edges.get(c.edge)!.curve.controlPoints; out.push(p[0], p[p.length - 1]); }
  return out;
}
/** Parts made from sheets (holes, cuts) carrying their sheet's report, part for part (R12.2, D117). */
const carrySheet = (r: Result, from: readonly Part[]): Result => r.kind === 'solid' && from.some(p => p.sheet) ? { kind: 'solid', parts: r.parts.map((q, i) => from[i]?.sheet ? { ...q, sheet: from[i].sheet } : q) } : r;
/** A result built on a sketch's own XY, moved onto its plane. */
/** A guide given in world coordinates, into a sketch frame's (z along its normal); left as given when it is not well formed (the loft refuses it). */
function guideInFrame(g: Record<string, unknown>, frame: Frame | undefined): Record<string, unknown> {
  const P = g.controlPoints;
  if (!frame || !Array.isArray(P) || !P.every(q => Array.isArray(q) && q.length === 3 && q.every(x => typeof x === 'number' && Number.isFinite(x)))) return g;
  const m = frame.m, o = frame.o;
  return { ...g, controlPoints: (P as number[][]).map(q => { const d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; return [0, 1, 2].map(k => m[k] * d[0] + m[3 + k] * d[1] + m[6 + k] * d[2]); }) };
}
const placed = (frame: Frame | undefined, compute: () => Result): (() => Result) =>
  !frame ? compute : () => { const r = compute(); return r.kind === 'solid' ? moveAll(r.parts, frame.m, frame.o) : r; };

/** A profile loop's points: its lines' starts and its arcs sampled (eight steps a quarter turn). */
function loopPoints(loop: readonly ProfileSegmentInput[]): [number, number][] {
  const out: [number, number][] = [];
  loop.forEach((s, i) => {
    out.push([s.start[0], s.start[1]]);
    if (s.kind !== 'arc') return;
    const end = loop[(i + 1) % loop.length].start, c = s.center, r = Math.hypot(s.start[0] - c[0], s.start[1] - c[1]);
    const a0 = Math.atan2(s.start[1] - c[1], s.start[0] - c[0]), a1 = Math.atan2(end[1] - c[1], end[0] - c[0]);
    let sweep = s.direction === 'ccw' ? a1 - a0 : a0 - a1; if (sweep <= 1e-12) sweep += 2 * Math.PI;
    const n = Math.max(2, Math.ceil(sweep / (Math.PI / 16)));
    for (let k = 1; k < n; k++) { const a = a0 + (s.direction === 'ccw' ? 1 : -1) * sweep * k / n; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  });
  return out;
}

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

/** A sketch's `sideTags` checked against its loops: one tag a side, each a name, none twice (R10a, D86). */
function sideTagsOf(v: unknown, drawn: { outer: readonly unknown[]; regions?: readonly (readonly unknown[])[]; holes?: readonly (readonly unknown[])[] }, fail: Tools['fail']): SideTags {
  if (!isRecord(v)) return fail('INPUT', 'sideTags must be { outer, regions?, holes? }');
  const seen = new Set<string>();
  const list = (x: unknown, n: number, what: string): string[] => {
    if (!Array.isArray(x) || x.length !== n) fail('INPUT', `sideTags.${what} must give ${n} tag${n === 1 ? '' : 's'}, one a side`);
    for (const t of x as unknown[]) {
      if (typeof t !== 'string' || !SIDE_TAG.test(t)) fail('INPUT', `sideTags.${what}: ${JSON.stringify(t)} is not a tag (letters, digits, _ or -, 1 to 32)`);
      if (seen.has(t as string)) fail('INPUT', `sideTags: ${t as string} is given twice`);
      seen.add(t as string);
    }
    return [...x as string[]];
  };
  const lists = (key: 'regions' | 'holes') => {
    const loops = drawn[key] ?? [], x = v[key];
    if (x === undefined) { if (loops.length) fail('INPUT', `sideTags.${key} must tag the ${loops.length} ${key === 'regions' ? 'region' : 'hole'} loop${loops.length === 1 ? '' : 's'}`); return {}; }
    if (!Array.isArray(x) || x.length !== loops.length) fail('INPUT', `sideTags.${key} must give one list a loop (${loops.length})`);
    return { [key]: loops.map((l, i) => list((x as unknown[])[i], l.length, `${key}[${i}]`)) };
  };
  return { outer: list(v.outer, drawn.outer.length, 'outer'), ...lists('regions'), ...lists('holes') };
}

// ---- operations ---------------------------------------------------------------------------------------
function operation(f: CadPartFeature & Record<string, unknown>, t: Tools): () => Result {
  const { dim, xy, xyz, axisOf, solids, ref, fail, at } = t;
  const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });
  const many = (parts: Solid[]): Result => ({ kind: 'solid', parts: parts.map(solid => ({ solid })) });
  switch (f.kind) {
    case 'extrude': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      const h = dim(f.height as CadPartDim, 'height'), from = f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from');
      if (h === 0) fail('PARAMETER', 'height must not be zero');
      const { outer, frame, regions, holes, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
      const draft = f.draft === undefined ? 0 : f.draft as unknown;
      if (typeof draft !== 'number' || !Number.isFinite(draft) || !(Math.abs(draft) < 89)) fail('INPUT', 'draft must be a number of degrees below 89 in size');
      if (draft === 0) return placed(frame, () => one({ kind: 'upright', solid: prismaticFromProfile({ outer, ...(regions ? { regions } : {}), ...(holes ? { holes } : {}), ...(tags ? { sideTags: tags } : {}), height: Math.abs(h), from: h > 0 ? from : from + h, tag: at }) }));
      if (regions?.length || holes?.length) fail('CAPABILITY', 'a drafted extrude takes one loop (no regions or holes) yet');
      // Built upwards from the sketch plane, then turned over for a downward extrude (the walls lean
      // away from the sketch plane either way).
      return placed(frame, () => {
        let brep: Brep;
        try { brep = draftedExtrusion({ profile: outer, z0: 0, z1: Math.abs(h), draft: draft as number, tag: at, id: at, ...(tags ? { sideTags: tags.outer } : {}) }); }
        catch (cause) { if (cause instanceof BrepError) fail(/not supported yet/.test(cause.message) ? 'CAPABILITY' : 'PARAMETER', cause.message.replace(/^B-rep: drafted extrusion: /, '')); throw cause; }
        return one({ kind: 'brep', brep: transformBrep(brep!, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, h > 0 ? 1 : -1], offset: [0, 0, from] }) });
      });
    }
    case 'revolve': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length) fail('CAPABILITY', 'revolve takes one outer loop with optional holes (no regions)');
      const ax = f.axis as { origin?: CadPartPoint2; direction?: unknown } | undefined;
      // The axis lies in the sketch plane: along its X or Y, or any direction [dx, dy] there.
      const free = Array.isArray(ax?.direction) && ax!.direction.length === 2 && ax!.direction.every(v => typeof v === 'number' && Number.isFinite(v)) && Math.hypot(...(ax!.direction as number[])) > 1e-12;
      if (!isRecord(ax) || (ax.direction !== 'x' && ax.direction !== 'y' && !free)) fail('INPUT', 'axis must be { origin: [x, y], direction: "x" | "y" | [dx, dy] }');
      const origin = xy(ax!.origin, 'axis origin'), deg = f.angle === undefined ? 360 : f.angle as number;
      if (typeof deg !== 'number' || !(deg > 0 && deg <= 360)) fail('INPUT', 'angle must be in (0, 360]');
      const rtags = (sketch as Extract<Result, { kind: 'sketch' }>).tags;
      const input = { id: at, profile: (sketch as Extract<Result, { kind: 'sketch' }>).outer, axis: { origin, direction: (free ? ax!.direction : ax!.direction === 'x' ? [1, 0] : [0, 1]) as XY }, angle: deg, ...((sketch as Extract<Result, { kind: 'sketch' }>).holes?.length ? { holes: (sketch as Extract<Result, { kind: 'sketch' }>).holes } : {}), ...(rtags ? { sideTags: rtags.outer, holeTags: rtags.holes } : {}) };
      return placed((sketch as Extract<Result, { kind: 'sketch' }>).frame, () => ({ kind: 'solid', parts: [{ solid: { kind: 'brep', brep: revolveProfile(input) }, mass: (density: number) => revolveMassProperties(input, density), revolved: input }] }));
    }
    case 'union': case 'difference': case 'intersect': {
      // (An operand may be empty — an intersection that met nothing, as agents' trees do: the Booleans' algebra holds,
      // A ∪ ∅ = A, A − ∅ = A, ∅ − B = A ∩ ∅ = ∅, where it was refused. L4 fuzz, D190.)
      const target = solids(f.target, 'target', true), tool = solids(f.tool, 'tool', true), op = f.kind === 'intersect' ? 'intersection' : f.kind;
      return () => {
        if (!tool.length || !target.length) {
          const left = target.length ? target : tool;
          if (op === 'intersection' || !left.length || (op === 'difference' && !target.length)) return many([]);
          if (op === 'union') return one(left.slice(1).reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), left[0].solid));
          return { kind: 'solid', parts: target };
        }
        // (The tool's parts joined from the first over the rest: over all of them, every such feature began with
        // tool[0] ∪ tool[0], a Boolean of a body with itself, D260/D268.)
        const joined = tool.slice(1).reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), tool[0].solid);
        // Unions merge every target part into one; difference and intersection act on each part.
        if (op === 'union') return one(target.reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), joined));
        // (A sheet's holes and cuts: still the sheet, its rules carried on; R12.2, D117.)
        const out = many(target.map(p => boolean(p.solid, joined, op, at)));
        return op === 'difference' ? carrySheet(out, target) : out;
      };
    }
    case 'rib': case 'profile-relief': case 'rectangular-relief': return prismaticDetailOperation(f, t, PRISMATIC_DETAIL_HELPERS);
    case 'cylindrical-wrap': {
      const target = solids(f.target, 'target'), selected = f.faces, rectangle = f.rectangle as { u?: unknown; v?: unknown } | undefined;
      if (target.length !== 1) fail('REFERENCE', 'cylindrical wrap target must be one nonempty solid');
      if (!Array.isArray(selected) || selected.length !== 1 || typeof selected[0] !== 'string' || !selected[0] || selected[0].includes('+')) fail('INPUT', 'cylindrical wrap faces must contain one exact native wall name');
      if (!rectangle || typeof rectangle !== 'object' || Array.isArray(rectangle) || Object.keys(rectangle).some(k => k !== 'u' && k !== 'v')) fail('INPUT', 'cylindrical wrap rectangle must contain original native u and v intervals');
      const u = rectangle!.u, v = rectangle!.v;
      if (!Array.isArray(u) || !Array.isArray(v) || u.length !== 2 || v.length !== 2 || ![...u, ...v].every(x => typeof x === 'number' && Number.isFinite(x))) fail('INPUT', 'cylindrical wrap intervals must each contain two finite Numbers');
      const U = u as [number, number], V = v as [number, number];
      if (!(0 < U[0] && U[0] < U[1] && U[1] < 0.5 && 0 < V[0] && V[0] < V[1] && V[1] < 1)) fail('PARAMETER', 'cylindrical wrap needs 0 < u0 < u1 < 0.5 and 0 < v0 < v1 < 1');
      const height = dim(f.height as CadPartDim, 'height', true), source = target[0], brep = brepOf(source, at);
      if (!brep.faces.some(face => face.name === selected[0])) fail('REFERENCE', 'cylindrical wrap selected wall name is missing from its target');
      const owned = { solid: source.solid, brep }, bounds = { u: [...U] as [number, number], v: [...V] as [number, number] }, face = selected[0] as string;
      return () => ({ kind: 'solid', parts: [cylindricalWrapFeature(owned, face, bounds, height, at, fail)] });
    }
    case 'full-round': {
      const target = solids(f.target, 'target'), names = f.faces as unknown, along = f.along as unknown;
      if (!Array.isArray(names) || !names.length || names.length > CadPartLimits.edges || !names.every(x => typeof x === 'string') || new Set(names).size !== names.length) fail('INPUT', 'faces must list 1 to 64 distinct face names');
      if (along !== undefined && along !== 'x' && along !== 'y') fail('INPUT', 'along must be x or y');
      if (target.length !== 1) fail('REFERENCE', 'full round one part at a time (name it as id/k)');
      return () => {
        if (target[0].solid.kind === 'brep' && target[0].solid.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'full round on mesh faces is not supported yet');
        const brep = brepOf(target[0], at), edges = new Map(brep.edges.map(e => [e.id, e])), points = new Map(brep.vertices.map(v => [v.id, v.point])), coedges = new Map(brep.coedges.map(c => [c.id, c]));
        // Each face's rectangle, read from the body as it was (before any round): its span along and across, and its height.
        const rounds = (names as string[]).map(name => {
          const face = brep.faces.find(x => x.name === name || (x.name ?? '').split('#')[0] === name);
          if (!face) return fail('REFERENCE', `no face ${name} on the target`);
          const g = faceGeometry(face);
          if (g.kind !== 'plane' || Math.abs(g.n[2] - 1) > 1e-9) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} is not a planar face facing +Z`);
          if (face.loops.length !== 1) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} has holes`);
          const loop = brep.loops.find(l => l.id === face.loops[0])!;
          const ring = loop.coedges.map(id => { const c = coedges.get(id)!, e = edges.get(c.edge)!; if (e.curve.degree !== 1 || e.curve.controlPoints.length !== 2) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} has a curved edge`); return points.get(c.sense === 'forward' ? e.vertices[0] : e.vertices[1])!; });
          const xs = ring.map(q => q[0]), ys = ring.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), z = ring[0][2];
          const tol = 1e-9 * Math.max(1, ...ring.flat().map(Math.abs));
          const corner = (q: Point) => (Math.abs(q[0] - x0) <= tol || Math.abs(q[0] - x1) <= tol) && (Math.abs(q[1] - y0) <= tol || Math.abs(q[1] - y1) <= tol);
          if (ring.length !== 4 || !ring.every(corner) || new Set(ring.map(q => `${Math.abs(q[0] - x0) <= tol}${Math.abs(q[1] - y0) <= tol}`)).size !== 4) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} is not an axis-aligned rectangle`);
          const dir = along ?? (x1 - x0 >= y1 - y0 ? 'x' : 'y');
          const [l0, l1, a0, a1] = dir === 'x' ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
          return { name, dir, l0, l1, a0, a1, z, r: (a1 - a0) / 2 };
        });
        let out = target[0].solid;
        rounds.forEach((q, k) => {
          // The corner material above the round, in (across, height), laid along the face: up one side, over the top,
          // down the other and back over the half circle. X, Y, Z: the local axes' images (determinant +1).
          const across = q.dir === 'x' ? [q.a0, q.a1] : [-q.a1, -q.a0], base = q.z - q.r, mid = (across[0] + across[1]) / 2;
          const outer: ProfileSegmentInput[] = [{ kind: 'line', start: [across[0], base] }, { kind: 'line', start: [across[0], q.z + q.r] }, { kind: 'line', start: [across[1], q.z + q.r] }, { kind: 'arc', start: [across[1], base], center: [mid, base], direction: 'ccw' }];
          const m: BrepAffine['matrix'] = q.dir === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : [-1, 0, 0, 0, 0, 1, 0, 1, 0];
          const tool = affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: q.l1 - q.l0, from: 0, tag: `${at}.round${k}` }) }, m, q.dir === 'x' ? [q.l0, 0, 0] : [0, q.l0, 0], n => n === `${at}.round${k}.side3` ? `${at}.round${k}` : n);
          // Open sides: no material just outside either side, a radius deep, from the round's foot to the top (a plate
          // under the face, or a neighbour within the radius, would be grooved by the cut).
          for (const [s0, s1] of [[q.a0 - q.r, q.a0], [q.a1, q.a1 + q.r]]) {
            const strip = q.dir === 'x' ? boxSolid([q.l0, s0, base], [q.l1, s1, q.z], `${at}.clear${k}`) : boxSolid([s0, q.l0, base], [s1, q.l1, q.z], `${at}.clear${k}`);
            const beside = boolean(out, strip, 'intersection', at);
            if (!empty(beside) && exactVolume(beside) > 1e-9 * exactVolume(strip)) fail('GEOMETRY', `[FULL_ROUND_NOT_CLEAR] the full round of ${q.name} needs its sides open ${+q.r.toPrecision(9)} mm down from it: material stands beside it`);
          }
          const before = exactVolume(out), next = boolean(out, tool, 'difference', at), pieces = next.kind === 'brep' ? next.brep.bodies.length : 1;
          const took = before - (empty(next) ? 0 : exactVolume(next)), want = (q.l1 - q.l0) * (q.a1 - q.a0) ** 2 * (4 - Math.PI) / 8;
          if (pieces !== 1 || Math.abs(took - want) > 1e-8 * Math.max(want, before)) fail('GEOMETRY', `[FULL_ROUND_NOT_CLEAR] the full round of ${q.name} would take ${+took.toPrecision(9)} mm³, not the ${+want.toPrecision(9)} its top holds: its sides must drop at least ${+q.r.toPrecision(9)} mm and nothing may stand above it`);
          out = next;
        });
        return one(out);
      };
    }
    case 'face-thread': {
      const target = solids(f.target, 'target'), name = f.face, p = dim(f.pitch as CadPartDim, 'pitch', true);
      const nominal = f.diameter === undefined ? null : dim(f.diameter as CadPartDim, 'diameter', true), want = f.length === undefined ? null : dim(f.length as CadPartDim, 'length', true);
      const end = f.end ?? '+', relief = f.relief === undefined ? p : dim(f.relief as CadPartDim, 'relief'), clearance = f.clearance === undefined ? null : dim(f.clearance as CadPartDim, 'clearance');
      if (typeof name !== 'string' || !name) fail('INPUT', 'face must name a cylindrical face');
      if (end !== '+' && end !== '-') fail('INPUT', "end must be '+' or '-'");
      const hand = f.hand ?? 'right';
      if (hand !== 'right' && hand !== 'left') fail('INPUT', 'hand must be right or left');
      if (!(relief >= 0)) fail('INPUT', 'relief must not be negative');
      if (clearance !== null && !(clearance >= 0 && clearance < p / 4)) fail('INPUT', 'clearance must be at least 0 and below a quarter of the pitch');
      if (target.length !== 1) fail('REFERENCE', 'thread one part at a time (name it as id/k)');
      return () => {
        const source = target[0].solid;
        if (source.kind === 'brep' && source.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'a thread on mesh faces is not supported yet');
        // The face by its name: a whole cylinder is often kept as its halves (`#1`, `#2`), one surface between them.
        const brep = brepOf(target[0], at), group = brep.faces.filter(x => x.name === name || (x.name ?? '').split('#')[0] === name);
        if (!group.length) return fail('REFERENCE', `no face ${name} on the target`);
        const g = faceGeometry(group[0]);
        if (g.kind !== 'cylinder') return fail('CAPABILITY', `[FACE_THREAD_FACE] ${name} is not a cylindrical face`);
        for (const x of group.slice(1)) {
          const h = faceGeometry(x);
          if (h.kind !== 'cylinder' || Math.abs(h.r - g.r) > 1e-9 * Math.max(1, g.r) || Math.abs(Math.abs(dot(unit(h.a), unit(g.a))) - 1) > 1e-12 || len(cross(sub(h.c, g.c), unit(g.a))) > 1e-9 * Math.max(1, g.r) || h.out !== g.out) fail('CAPABILITY', `[FACE_THREAD_FACE] the faces named ${name} are not one cylinder`);
        }
        const inGroup = new Set(group.map(x => x.id)), loops = new Set(group.flatMap(x => x.loops));
        // The axis, its largest component positive; t: the distance along it from the face's axis point.
        const k0 = [0, 1, 2].reduce((m, k) => Math.abs(g.a[k]) > Math.abs(g.a[m]) ? k : m, 0), a = unit(g.a[k0] < 0 ? scale(g.a, -1) : g.a), R = g.r;
        const points = new Map(brep.vertices.map(v => [v.id, v.point])), edges = new Map(brep.edges.map(e => [e.id, e])), loopFace = new Map(brep.loops.map(l => [l.id, l.face]));
        const own = brep.coedges.filter(c => loops.has(c.loop)), uses = new Map<string, number>();
        for (const c of own) uses.set(c.edge, (uses.get(c.edge) ?? 0) + 1);
        const tOf = (q: Point) => dot(sub(q, g.c), a), radial = (q: Point) => len(sub(sub(q, g.c), scale(a, tOf(q))));
        const ts = own.flatMap(c => edges.get(c.edge)!.vertices.map(v => tOf(points.get(v)!))), t0 = Math.min(...ts), t1 = Math.max(...ts), L = t1 - t0, tol = 1e-7 * Math.max(1, R, L);
        // Whole round: every edge it does not share with itself (a seam) is a circle in one of its end planes.
        const boundary = [...uses].filter(([, n]) => n === 1).map(([id]) => edges.get(id)!);
        const atEnd = (t: number) => Math.abs(t - t0) <= tol ? 0 : Math.abs(t - t1) <= tol ? 1 : -1;
        if (!(L > tol) || boundary.some(e => { const [u, v] = e.vertices.map(id => atEnd(tOf(points.get(id)!))); return u < 0 || u !== v; })) fail('CAPABILITY', `[FACE_THREAD_FACE] ${name} is not a whole round face between two end circles`);
        // Each end: what lies beyond it, from the faces met there — outward (a shoulder, the plate a hole opens in),
        // or not; flat: a plane square to the axis.
        const beyond = [0, 1].map(side => {
          const met = new Set(boundary.filter(e => atEnd(tOf(points.get(e.vertices[0])!)) === side).flatMap(e => brep.coedges.filter(c => c.edge === e.id).map(c => loopFace.get(c.loop)!)).filter(id => !inGroup.has(id)));
          const faces = brep.faces.filter(x => met.has(x.id)), corners = faces.flatMap(x => faceVertices(brep, x.id));
          const outward = corners.some(q => radial(q) > R + tol), flat = faces.length > 0 && faces.every(x => { const h = faceGeometry(x); return h.kind === 'plane' && Math.abs(Math.abs(dot(h.n, a)) - 1) <= 1e-9; });
          return { outward, flat };
        });
        const span = want ?? L;
        if (span > L + tol) fail('PARAMETER', `[FACE_THREAD_SIZE] the thread's length ${+span.toPrecision(9)} is longer than the face (${+L.toPrecision(9)})`);
        const r0 = end === '+' ? t1 - span : t0, r1 = end === '+' ? t1 : t0 + span;
        // A range end on a face end takes that end's kind; one inside the face meets the face going on (outward-free, not flat).
        const kindAt = (t: number) => { const side = atEnd(t); return side < 0 ? { outward: false, flat: false } : beyond[side]; };
        const ends = [kindAt(r0), kindAt(r1)], external = g.out === 1;
        // Local frame: Z along the axis from its point g.c (identity for +Z, to keep upright tools upright).
        const e1 = Math.abs(a[2] - 1) <= 1e-15 ? [1, 0, 0] as Point : unit(cross(Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], a)), e2 = cross(a, e1);
        const m: BrepAffine['matrix'] = [e1[0], e2[0], a[0], e1[1], e2[1], a[1], e1[2], e2[2], a[2]], o = [g.c[0], g.c[1], g.c[2]];
        const local = (s: Solid) => affine(s, m, o);
        const ring = (outer: number, inner: number | null, lo: number, hi: number, tag: string) => local({ kind: 'upright', solid: prismaticFromProfile({ outer: [{ kind: 'arc', start: [outer, 0], center: [0, 0], direction: 'ccw' }], ...(inner !== null ? { holes: [[{ kind: 'arc', start: [inner, 0], center: [0, 0], direction: 'ccw' }]] } : {}), height: hi - lo, from: lo, tag }) });
        const rod = (d: number, lo: number, hi: number, clear = 0) => {
          if (!(hi - lo >= p - tol)) fail('PARAMETER', `[FACE_THREAD_SIZE] the thread would be ${+(hi - lo).toPrecision(9)} mm long: at least a pitch (${p}) is needed`);
          let made: Brep;
          try { made = threadSolid({ id: at, diameter: d, pitch: p, center: [0, 0], seat: hi, length: hi - lo, form: 'helical', clearance: clear }); }
          catch (cause) { if (cause instanceof RangeError || isMeshBrepError(cause)) fail('PARAMETER', cause.message); throw cause; }
          // (A left-hand thread: the right-hand rod mirrored through a plane holding its axis.)
          const s = local(hand === 'left' ? affine({ kind: 'brep', brep: made! }, [-1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0]) : { kind: 'brep', brep: made! });
          return { solid: s, area: exactVolume(s) / (hi - lo) };
        };
        const close = (got: number, expected: number, scaleOf: number) => Math.abs(got - expected) <= 1e-7 * Math.max(expected, scaleOf);
        const before = exactVolume(source);
        if (!external) {
          if (nominal === null) fail('INPUT', 'a thread in a hole needs its nominal diameter: the hole is its tap drill');
          const d = nominal!;
          if (!(d / 2 > R + tol)) fail('PARAMETER', `[FACE_THREAD_SIZE] an M${d} thread is no wider than the ${+(2 * R).toPrecision(9)} mm hole`);
          // Fill the hole over the length (a plug a pitch wider, in the wall), then cut the thread.
          const filled = boolean(source, ring(d / 2 + p, null, r0, r1, `${at}.plug`), 'union', at), added = exactVolume(filled) - before;
          if (!close(added, Math.PI * R * R * span, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] the wall round ${name} is thinner than the thread needs (${+(d / 2 + p - R).toPrecision(9)} mm past the hole)`);
          const tap = rod(d, r0 - (ends[0].outward ? p : 0), r1 + (ends[1].outward ? p : 0), clearance ?? 0.04);
          const out = boolean(filled, tap.solid, 'difference', at), taken = exactVolume(filled) - exactVolume(out), pieces = out.kind === 'brep' ? out.brep.bodies.length : 1;
          if (pieces !== 1 || !close(taken, tap.area * span, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] the thread in ${name} would take ${+taken.toPrecision(9)} mm³, not the ${+(tap.area * span).toPrecision(9)} its length holds: something stands past the hole's ends`);
          return one(out);
        }
        if (clearance !== null) fail('INPUT', `the clearance goes in the hole: a shaft's thread (${name}) is the bolt's own`);
        if (nominal !== null && Math.abs(nominal - 2 * R) > tol) fail('PARAMETER', `[FACE_THREAD_SIZE] a thread on a ${+(2 * R).toPrecision(9)} mm shaft is M${+(2 * R).toPrecision(9)}, not M${nominal}`);
        const core = R - 0.8 * p;
        if (!(core > 0)) fail('PARAMETER', `[FACE_THREAD_SIZE] a ${p} mm pitch is too coarse for a ${+(2 * R).toPrecision(9)} mm shaft`);
        // A flat free end takes the thread to it; any other end leaves a relief groove at the core.
        const free = ends.map(e => !e.outward && e.flat), w = free.map(x => x ? 0 : relief);
        if (w.some((x, i) => !free[i] && !(x > 0))) fail('CAPABILITY', `[FACE_THREAD_RELIEF] the thread on ${name} ends at a shoulder or inside the face: it needs a relief groove (relief > 0)`);
        const necked = boolean(source, ring(R + p, core, r0 - (free[0] ? p : 0), r1 + (free[1] ? p : 0), `${at}.neck`), 'difference', at), cut = before - exactVolume(necked);
        if (!close(cut, Math.PI * (R * R - core * core) * span, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] material stands round ${name} within ${+p.toPrecision(9)} mm of it: the thread has no room`);
        const thread = rod(2 * R, r0 + w[0], r1 - w[1]), length = r1 - w[1] - r0 - w[0];
        const out = boolean(necked, thread.solid, 'union', at), joined = exactVolume(out) - exactVolume(necked), pieces = out.kind === 'brep' ? out.brep.bodies.length : 1;
        if (pieces !== 1 || !close(joined, (thread.area - Math.PI * core * core) * length, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] the thread on ${name} did not join the shaft's core as one body`);
        return one(out);
      };
    }
    case 'face-fillet': return faceFilletOperation(f, t);
    case 'hole': {
      const target = solids(f.target, 'target'), c = xy(f.center as CadPartPoint2, 'center'), r = dim(f.radius as CadPartDim, 'radius', true);
      const depth = f.depth === undefined ? null : dim(f.depth as CadPartDim, 'depth', true), axis = f.axis === undefined ? 'z' : axisOf(f.axis);
      const named = f.face === undefined ? null : f.face;
      if (named !== null && (typeof named !== 'string' || !named)) fail('INPUT', 'face must be a face name');
      const given = f.side;
      if (given !== undefined && given !== 'min' && given !== 'max') fail('INPUT', 'side must be min or max');
      const csk = f.countersink === undefined ? null : dim(f.countersink as CadPartDim, 'countersink', true);
      if (csk !== null && !(csk / 2 > r)) fail('INPUT', 'a countersink must be wider than the hole');
      return () => carrySheet(many(target.map(p => {
        // The tool: a cylinder along local z over [h0, h1], centred at local (c1, c2), turned onto the axis
        // by a cyclic permutation (x: local x, y, z → world y, z, x; y: → world z, x, y).
        const box = bounds(p.solid), k = 'xyz'.indexOf(axis), hi = box.max[k], lo = box.min[k];
        // (The face drilled into: the named planar face's plane, its outward normal along ±axis the side; else the
        // target's extreme on `side`. From a named face the tool reaches past it by 1 % of the depth, at most 1 mm, and at
        // most half the free space above the face over the hole (D148b: a lip or an overhang there stays whole); from the
        // extreme, 1 mm as before.)
        const start = named === null ? null : holeFace(brepOf(p, at), named, k, fail);
        const side = start ? start.side : given ?? 'max';
        if (start && given !== undefined && given !== start.side) fail('INPUT', `side ${given} does not match ${named}, which faces ${start.side === 'max' ? '+' : '-'}${axis}`);
        const face = start ? start.at : side === 'max' ? hi : lo;
        let over = 1;
        if (start && depth !== null) {
          const free = clearanceAbove(brepOf(p, at), k, side === 'max' ? 1 : -1, face, c, r);
          if (free < OBSTRUCTION_MM) fail('GEOMETRY', `[OBSTRUCTED_ABOVE] material ${+free.toPrecision(3)} mm above ${named} over the hole at (${c[0]}, ${c[1]}): a blind hole from that face would cut it`);
          over = Math.min(1, 0.01 * depth, free / 2);
        }
        const [h0, h1] = depth === null ? [lo - 1, hi + 1] : side === 'max' ? [face - depth, face + over] : [face - over, face + depth];
        const local: XY = axis === 'y' ? [c[1], c[0]] : c;
        const cylinder = prismaticFromProfile({ outer: [{ kind: 'arc', start: [local[0] + r, local[1]], center: local, direction: 'ccw' }], height: h1 - h0, from: h0, tag: at });
        const tool: Solid = axis === 'z' ? { kind: 'upright', solid: cylinder }
          : { kind: 'brep', brep: transformBrep(brepFromPrismatic(cylinder, { id: at + '_tool' }), { matrix: axis === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : [0, 1, 0, 0, 0, 1, 1, 0, 0] }) };
        const out = boolean(p.solid, tool, 'difference', at);
        // A miss: no volume taken. A B-rep result with some of the tool's faces took some (measuring the
        // volumes tessellates the whole body twice per hole); without them (off the body, or inside a hole
        // already there) the volumes decide, as before.
        const missed = out.kind === 'brep' && out.brep.faces.some(x => x.name?.startsWith(`${at}.`)) ? false : volumeOfSolid(p.solid) - volumeOfSolid(out) <= 1e-6 * volumeOfSolid(p.solid);
        if (missed) fail('SELECTION', `the hole at (${c[0]}, ${c[1]}) along ${axis} misses the target`);
        if (csk === null) return out;
        // The countersink: a 90° cone from Ø csk at the face down to the hole, its rim a little above the
        // face (so no face of it lies on the face). Revolved about its profile's Y (depth into the
        // material), then carried to the hole: s along local x, depth down local z from the face, the
        // revolve's z along ±local y (the map turning, not mirroring), then the hole's axis permutation.
        const R = csk / 2, e = Math.min(0.5, R), t = R - r, down = side === 'max' ? -1 : 1;
        const cone = revolveProfile({ id: `${at}_csk`, profile: [{ kind: 'line', start: [0, -e] }, { kind: 'line', start: [R + e, -e] }, { kind: 'line', start: [r, t] }, { kind: 'line', start: [0, t] }], axis: { origin: [0, 0], direction: [0, 1] }, angle: 360 });
        const M = [1, 0, 0, 0, 0, -down, 0, down, 0], P = axis === 'z' ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : axis === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : [0, 1, 0, 0, 0, 1, 1, 0, 0];
        const mul = (A: number[], B: number[]) => [0, 1, 2].flatMap(i => [0, 1, 2].map(j => A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j]));
        const o: Point = [local[0], local[1], face], offset = [0, 1, 2].map(i => P[3 * i] * o[0] + P[3 * i + 1] * o[1] + P[3 * i + 2] * o[2]) as Point;
        const placedCone = transformBrep(cone, { matrix: mul(P, M) as unknown as BrepAffine['matrix'], offset }, n => n.split('|').map(q => q.replace(`${at}_csk.`, `${at}.countersink-`)).join('|'));
        return boolean(out, { kind: 'brep', brep: placedCone }, 'difference', at);
      })), target);
    }
    case 'translate': case 'rotate': case 'mirror': case 'scale': case 'linear-pattern': case 'linear-feature-pattern': case 'rectangular-feature-pattern': case 'fill-feature-pattern': case 'curve-feature-pattern': case 'circular-pattern': return transformOperation(f, t, TRANSFORM_HELPERS);
    case 'frame-member': case 'frame': case 'gusset': case 'end-cap': case 'weld-bead': return frameOperation(f, t);
    case 'sheet-base': case 'sheet-contour': case 'sheet-corner-relief': case 'sheet-flange': return sheetOperation(f, t, HELPERS);
    case 'sweep': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length || (sketch as Extract<Result, { kind: 'sketch' }>).holes?.length) fail('CAPABILITY', 'sweep takes a sketch of one loop (no regions or holes) yet');
      const path = f.path as unknown;
      if (!Array.isArray(path) || !path.length || path.length > CadPartLimits.copies) fail('INPUT', 'path must list 1 to 64 steps');
      const steps = (path as unknown[]).map((st, i): { kind: 'straight'; length: number } | { kind: 'bend'; radius: number; angle: number; toward: 'x' | '-x' | 'y' | '-y' } => {
        if (!isRecord(st)) return fail('INPUT', `path[${i}] must be a step`);
        if (st.kind === 'straight') return { kind: 'straight', length: dim(st.length as CadPartDim, `path[${i}].length`, true) };
        if (st.kind === 'bend') {
          const a = st.angle, toward = st.toward;
          if (typeof a !== 'number' || !(a > 0 && a <= 180)) fail('INPUT', `path[${i}].angle must be in (0, 180]`);
          if (toward !== 'x' && toward !== '-x' && toward !== 'y' && toward !== '-y') fail('INPUT', `path[${i}].toward must be x, -x, y or -y`);
          return { kind: 'bend', radius: dim(st.radius as CadPartDim, `path[${i}].radius`, true), angle: a as number, toward: toward as 'x' | '-x' | 'y' | '-y' };
        }
        return fail('INPUT', `path[${i}].kind must be straight or bend`);
      });
      const { outer, frame, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
      return placed(frame, () => { const { brep, mass } = sweepBrep(outer, steps, at, fail, undefined, tags?.outer); return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass, swept: { profile: outer, steps, ...(tags ? { sideTags: tags.outer } : {}) } }] }; });
    }
    case 'loft': {
      const list = f.sections as unknown;
      if (!Array.isArray(list) || list.length < 2 || list.length > CadPartLimits.copies) fail('INPUT', 'sections must list 2 to 64 sections');
      const framedSections = (list as unknown[]).some(sec => isRecord(sec) && (sec.frame !== undefined || Object.hasOwn(sec, 'profile')));
      // (CG1.3: a general guide — kind nurbs — on sketches stacked along their plane's normal takes the z path.)
      const nurbsGuide = isRecord(f.guide) && (f.guide as { kind?: unknown }).kind === 'nurbs' && !framedSections;
      if ((f.guide !== undefined && !nurbsGuide) || framedSections) {
        if (f.smooth !== undefined && typeof f.smooth !== 'boolean') fail('INPUT', 'smooth must be true or false');
        const framed = (list as unknown[]).map((sec, i) => {
          if (!isRecord(sec) || sec.frame === undefined || sec.z !== undefined) return fail('INPUT', `sections[${i}] need an explicit frame without z`);
          if (Object.hasOwn(sec, 'profile')) {
            if (Object.hasOwn(sec, 'sketch') || !isRecord(sec.profile) || sec.profile.kind !== 'ellipse') return fail('INPUT', `sections[${i}] must provide an ellipse profile or a sketch, never both`);
            return { profile: sec.profile as unknown as Exclude<LoftSectionInput['profile'], readonly ProfileSegmentInput[]>, frame: sec.frame as unknown as LoftSectionFrame, tags: undefined };
          }
          if (typeof sec.sketch !== 'string') return fail('INPUT', `sections[${i}] must name a sketch or an inline ellipse profile`);
          const sketch = ref(sec.sketch, 'sketch').result;
          if (sketch.kind !== 'sketch') return fail('REFERENCE', `${sec.sketch} is not a sketch`);
          if (sketch.regions?.length || sketch.holes?.length) return fail('CAPABILITY', 'oriented loft sections need one loop without holes');
          return { profile: sketch.outer, frame: sec.frame as unknown as LoftSectionFrame, tags: sketch.tags };
        });
        return () => {
          const { brep, mass } = loftSolid({ id: at, name: at, sections: framed, smooth: f.smooth === true, ...(f.guide !== undefined ? { guide: f.guide as LoftInput['guide'] } : {}), ...(framed[0].tags ? { sideTags: framed[0].tags.outer } : {}) });
          return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass }] };
        };
      }
      const sections = (list as unknown[]).map((sec, i) => {
        if (!isRecord(sec) || typeof sec.sketch !== 'string') return fail('INPUT', `sections[${i}] must name a sketch`);
        const sketch = ref(sec.sketch, 'sketch').result;
        if (sketch.kind !== 'sketch') fail('REFERENCE', `${sec.sketch} is not a sketch`);
        if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length || (sketch as Extract<Result, { kind: 'sketch' }>).holes?.length) fail('CAPABILITY', 'loft sections are sketches of one loop (no regions or holes) yet');
        const { outer, frame, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
        return { profile: outer, z: dim(sec.z as CadPartDim, `sections[${i}].z`), frame, tags };
      });
      // The sections stack along one sketch plane's normal.
      const frame = sections[0].frame;
      if (sections.some(x => JSON.stringify(x.frame) !== JSON.stringify(frame))) fail('INPUT', 'loft sections must be sketched on the same plane');
      sections.forEach((s, i) => { if (i && !(s.z > sections[i - 1].z)) fail('PARAMETER', `sections[${i}] must lie above sections[${i - 1}] (z ${s.z} ≤ ${sections[i - 1].z})`); });
      if (f.smooth !== undefined && typeof f.smooth !== 'boolean') fail('INPUT', 'smooth must be true or false');
      const guide = nurbsGuide ? { guide: guideInFrame(f.guide as Record<string, unknown>, frame) as LoftInput['guide'] } : {};
      return placed(frame, () => { const { brep, mass } = loftSolid({ id: at, name: at, sections: sections.map(({ profile, z }) => ({ profile, z })), smooth: f.smooth === true, ...guide, ...(sections[0].tags ? { sideTags: sections[0].tags.outer } : {}) }); return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass }] }; });
    }
    case 'import': case 'subd': case 'sew': case 'mesh': case 'decimate': case 'separate': return meshOperation(f, t, HELPERS);
    case 'draft': {
      const target = solids(f.target, 'target'), names = f.faces as unknown, angle = f.angle as unknown;
      if (!Array.isArray(names) || !names.length || names.length > CadPartLimits.edges || !names.every(x => typeof x === 'string')) fail('INPUT', 'faces must list 1 to 64 face names');
      if (typeof angle !== 'number' || !Number.isFinite(angle) || angle === 0 || Math.abs(angle) >= 45) fail('INPUT', 'angle must be a number of degrees, not 0, below 45 in size');
      if (target.length !== 1) fail('REFERENCE', 'draft one part at a time (name it as id/k)');
      const neutral = f.neutral === undefined ? undefined : dim(f.neutral as CadPartDim, 'neutral');
      const pull = f.pull === undefined ? 'z' : f.pull as unknown;
      if (pull !== 'x' && pull !== 'y' && pull !== 'z' && pull !== '-x' && pull !== '-y' && pull !== '-z') fail('INPUT', 'pull must be x, y or z (a positive coordinate axis), or -x, -y or -z');
      return () => {
        if (target[0].solid.kind === 'brep' && target[0].solid.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'draft on mesh faces is not supported yet (general draft and offset arrive with R11)');
        // Signed permutations put the pull on local Z with determinant +1 and no trigonometric rotation.
        const negativePull = pull === '-x' || pull === '-y' || pull === '-z';
        const toZ: BrepAffine['matrix'] | null = pull === 'x' ? [0, 1, 0, 0, 0, 1, 1, 0, 0] : pull === 'y' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : pull === '-x' ? [0, 1, 0, 0, 0, -1, -1, 0, 0] : pull === '-y' ? [0, 0, 1, -1, 0, 0, 0, -1, 0] : pull === '-z' ? [1, 0, 0, 0, -1, 0, 0, 0, -1] : null;
        const fromZ: BrepAffine['matrix'] | null = pull === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : pull === 'y' ? [0, 1, 0, 0, 0, 1, 1, 0, 0] : pull === '-x' ? [0, 0, -1, 1, 0, 0, 0, -1, 0] : pull === '-y' ? [0, -1, 0, 0, 0, -1, 1, 0, 0] : pull === '-z' ? [1, 0, 0, 0, -1, 0, 0, 0, -1] : null;
        const localSolid = toZ ? affine(target[0].solid, toZ, [0, 0, 0]) : target[0].solid;
        const brep = brepOf(toZ ? { solid: localSolid } : target[0], at), box = bounds(localSolid), zN = negativePull && neutral !== undefined ? -neutral : neutral ?? box.min[2], R = len(sub(box.max, box.min)) + 2, a = (angle as number) * Math.PI / 180;
        // Extend tool coverage beyond the face; keep the turn on the authored neutral plane.
        const lift = 1e-6 * R;
        const coedges = new Map(brep.coedges.map(c => [c.id, c])), edges = new Map(brep.edges.map(e => [e.id, e])), points = new Map(brep.vertices.map(v => [v.id, v.point]));
        // Each face's wedge, from the body as it was: the face pushed in (or out) as deep as the turn takes
        // its top, met with the half-space beyond its turned plane (through its line on the neutral plane).
        const wedges = (names as string[]).map(name => {
          const face = brep.faces.find(x => x.name === name || (x.name ?? '').split('#')[0] === name);
          if (!face) return fail('REFERENCE', `no face ${name} on the target`);
          const loop = brep.loops.find(l => l.id === face.loops[0])!;
          const ring = loop.coedges.map(id => { const c = coedges.get(id)!, e = edges.get(c.edge)!; return points.get(c.sense === 'forward' ? e.vertices[0] : e.vertices[1])!; });
          let nrm: Point = [0, 0, 0];
          ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]; nrm = add(nrm, [(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])]); });
          const n = unit(nrm);
          if (Math.abs(n[2]) > 1e-9 || face.loops.length > 1) fail('CAPABILITY', `${name}: a draft takes side faces square to the pull (${pull === 'x' ? 'X' : pull === 'y' ? 'Y' : pull === '-x' ? '-X' : pull === '-y' ? '-Y' : pull === '-z' ? '-Z' : 'Z'}) without holes`);
          const zs = ring.map(p => p[2]), top = Math.max(...zs), height = top - zN;
          if (!(height > 0) || Math.min(...zs) < zN - 1e-6) fail('SELECTION', negativePull ? `${name}: the neutral plane ${pull.slice(1)} = ${-zN} must be at or above the face for pull ${pull}` : `${name}: the neutral plane ${pull} = ${zN} must be at or below the face`);
          // A frame on the face: X along it (level), Y up, Z into the body (draft in) or out of it (draft out).
          const along: Point = a > 0 ? [-n[0], -n[1], -n[2]] : n, x = unit(cross([0, 0, 1], along)), y = cross(along, x);
          const m: BrepAffine['matrix'] = [x[0], y[0], along[0], x[1], y[1], along[1], x[2], y[2], along[2]], o = ring[0];
          const uv = ring.map(p => { const d = sub(p, o); return [dot(d, x), dot(d, y)]; });
          // (A little wider and taller than the face, so the wedge's ends do not lie on its neighbours' planes.)
          const e = 1e-3 * R, wide = a > 0 ? e : 0, u0 = Math.min(...uv.map(q => q[0])) - wide, u1 = Math.max(...uv.map(q => q[0])) + wide, minV = Math.min(...uv.map(q => q[1])), v0 = minV - (a > 0 ? 2 * lift : 0), v1 = Math.max(...uv.map(q => q[1])) + wide;
          const depth = height * Math.tan(Math.abs(a)) + 1;
          // Preserve the original profile admission separately from the outward tool's exact extent.
          const outline: ProfileSegmentInput[] = [[u0, minV - 2 * lift], [u1, minV - 2 * lift], [u1, v1], [u0, v1]].map(start => ({ kind: 'line', start: start as XY }));
          const prism = prismaticFromProfile({ outer: outline, height: depth, from: a > 0 ? 0 : -1e-3, tag: `${at}.draft` });
          // Retain the former finite half-box's coordinate admission, not its rounded far-corner plane.
          boxSolid([-R, -R, 0], [R, R, R], `${at}.draft`);
          return draftWedge(prism, u0, u1, v0, v1, zN - o[2], a, m, o, `${at}.draft`);
        });
        // Faces that meet would need their wedges mitred where they join: not yet.
        const edgesOf = (name: string) => { const face = brep.faces.find(x => x.name === name || (x.name ?? '').split('#')[0] === name)!; return new Set(face.loops.flatMap(l => brep.loops.find(x => x.id === l)!.coedges.map(c => coedges.get(c)!.edge))); };
        const sets = (names as string[]).map(edgesOf);
        sets.forEach((x, i) => sets.forEach((y, j) => { if (j > i && [...x].some(e => y.has(e))) fail('CAPABILITY', `${(names as string[])[i]} and ${(names as string[])[j]} meet along an edge: draft faces that do not touch (or every side of an extrusion with its draft)`); }));
        // The wedges together, then off the body (or onto it) at once.
        const all = wedges.filter(w => !empty(w)).reduce<Solid | null>((u, w) => u ? boolean(u, w, 'union', at) : w, null);
        const result = all ? boolean(localSolid, all, a > 0 ? 'difference' : 'union', at) : localSolid;
        return one(fromZ ? affine(result, fromZ, [0, 0, 0]) : result);
      };
    }
    case 'split-face': {
      const target = solids(f.target, 'target'), face = f.face, given = f.curves as unknown, names = f.names as unknown;
      if (typeof face !== 'string' || !face) fail('INPUT', 'face must be a face name');
      if ((given === undefined) === (f.pull === undefined)) fail('INPUT', 'give curves, or pull for the isocline (one of them)');
      if (target.length !== 1) fail('REFERENCE', 'split one part at a time (name it as id/k)');
      if (names !== undefined && (!Array.isArray(names) || !names.every(n => typeof n === 'string'))) fail('INPUT', 'names must list the pieces\' names');
      const pull = f.pull === undefined ? null : xyz(f.pull as CadPartPoint3, 'pull');
      let curves: Curve[] | null = null;
      if (given !== undefined) {
        if (!Array.isArray(given) || !given.length || given.length > CadPartLimits.edges) fail('INPUT', 'curves must list 1 to 64 NURBS curves');
        curves = (given as Record<string, unknown>[]).map((c, i) => {
          if (!isRecord(c)) fail('INPUT', `curves[${i}] must be a NURBS curve { degree, knots, controlPoints, weights }`);
          const curve = { kind: 'curve' as const, id: `split_curve${i}`, degree: c.degree as number, knots: c.knots as number[], controlPoints: c.controlPoints as Point[], weights: c.weights as number[] };
          try { validateCurve(curve); } catch (cause) { fail('INPUT', `curves[${i}]: ${cause instanceof Error ? cause.message : String(cause)}`); }
          return curve;
        });
      }
      return () => {
        const brep = brepOf(target[0], at), options = { id: at, ...(names === undefined ? {} : { names: names as string[] }) };
        try { return one({ kind: 'brep', brep: (curves ? splitFaceAlongCurve(brep, face as string, curves, options) : splitFaceAlongIsocline(brep, face as string, pull!, options)).brep }); }
        catch (cause) {
          if (cause instanceof BrepError) fail(/not supported yet/.test(cause.message) ? 'CAPABILITY' : /\[(NO_FACE|AMBIGUOUS)\]/.test(cause.message) ? 'REFERENCE' : cause.code === 'INPUT' ? 'INPUT' : 'GEOMETRY', cause.message.replace(/^B-rep: /, ''));
          throw cause;
        }
      };
    }
    case 'shell': case 'thicken': return shellOperation(f, t, HELPERS);
    case 'band-surface': return bandOperation(f, t);
    case 'sweep-curve': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      const sk = sketch as Extract<Result, { kind: 'sketch' }>, path = f.path as Record<string, unknown>;
      if (!isRecord(path)) fail('INPUT', 'path must be a NURBS curve { degree, knots, controlPoints, weights }');
      const curve = { kind: 'curve' as const, id: 'path', degree: path.degree as number, knots: path.knots as number[], controlPoints: path.controlPoints as Point[], weights: path.weights as number[] };
      try { validateCurve(curve); } catch (cause) { fail('INPUT', `path: ${cause instanceof Error ? cause.message : String(cause)}`); }
      if (sk.regions?.length) fail('CAPABILITY', 'a sweep takes one shape (holes allowed, no separate regions) yet');
      const m = sk.frame?.m ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
      return () => {
        try {
          if (profiling) profiling.sweeps++;
          return one({ kind: 'brep', brep: sweepSolid({ id: at, outer: loopPoints(sk.outer), holes: (sk.holes ?? []).map(loopPoints), xAxis: [m[0], m[3], m[6]], yAxis: [m[1], m[4], m[7]], path: curve }) });
        } catch (cause) { if (cause instanceof RangeError || isMeshBrepError(cause)) fail('GEOMETRY', cause.message); throw cause; }
      };
    }
    case 'spur-gear': case 'internal-gear': case 'bevel-gear': case 'worm': case 'worm-wheel': case 'spur-rack': return gearOperation(f, t, HELPERS);
    case 'connector-opening': case 'connector-body': case 'oring-gland': case 'oring': case 'bearing': case 'key': case 'retaining-ring': case 'pin': case 'keyway': case 'shaft': case 'spring': case 'sprocket': case 'pulley': case 'belt': case 'coupling': case 'cam': case 'thread': return machineOperation(f, t, HELPERS);
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
          if (facetBody(s)) { const e: Point = [0, 0, 0]; e[a] = 1; const pieces = splitFacets(s, e, cut, at); return many(flip ? pieces.reverse() : pieces); }
          const half = (lo: boolean) => { const min = box.min.map(v => v - 1) as Point, max = box.max.map(v => v + 1) as Point; if (lo) max[a] = cut; else min[a] = cut; return boxSolid(min, max, `${at}.cut`); };
          const pieces = [boolean(s, half(true), 'intersection', at), boolean(s, half(false), 'intersection', at)];
          return many(flip ? pieces.reverse() : pieces);
        };
      }
      return () => {
        // An oblique plane: each side a box standing on the plane (its frame turned to the normal) round the target.
        const s = target[0].solid, box = bounds(s), n = unit(normal), d = level / len(normal);
        if (facetBody(s)) return many(splitFacets(s, n, d, at));
        const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i & 1 ? box.max[0] : box.min[0], i & 2 ? box.max[1] : box.min[1], i & 4 ? box.max[2] : box.min[2]] as Point).map(c => dot(n, c));
        if (!(d > Math.min(...corners) && d < Math.max(...corners))) fail('SELECTION', 'the split plane does not cross the target');
        const c = scale(add(box.min, box.max), 0.5), o = sub(c, scale(n, dot(n, c) - d)), R = len(sub(box.max, box.min)) + 2;
        const x = unit(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), y = cross(n, x);
        const pieces = [boolean(s, obliqueHalf(o, n, x, y, R, true, at), 'intersection', at), boolean(s, obliqueHalf(o, n, x, y, R, false, at), 'intersection', at)];
        if (pieces.some(empty)) fail('SELECTION', 'the split plane does not cross the target');
        return many(pieces);
      };
    }
    case 'chamfer': case 'fillet': return finishOperation(f, t, HELPERS);
  }
  return fail('INPUT', `unknown feature kind ${String((f as { kind?: unknown }).kind)}`);
}

/**
 * One side of an oblique split plane round a target within R of o: a tetrahedron, its base a triangle on the plane
 * (inradius 2R about o) and its apex 4R off it, so that it holds everything within R of o on its side. Triangles
 * only: a rotated box's quads are not exactly planar in binary64 and the exact polyhedral Boolean refused them
 * (D50). Both sides take the same three base corners, so they share one exact plane. Its base is `<at>.cut.top`
 * below and `<at>.cut.bottom` above, as the axis split's box names it.
 */
export function obliqueHalf(o: Point, n: Point, x: Point, y: Point, R: number, below: boolean, at: string, capName?: string): Solid {
  const corner = (deg: number) => add(o, add(scale(x, 4 * R * Math.cos(deg * Math.PI / 180)), scale(y, 4 * R * Math.sin(deg * Math.PI / 180))));
  const apex = add(o, scale(n, below ? -4 * R : 4 * R));
  const positions = [...corner(90), ...corner(210), ...corner(330), ...apex];
  // The base first (wound about +n below, −n above), then the sides against its edges.
  const indices = below ? [0, 1, 2, 1, 0, 3, 2, 1, 3, 0, 2, 3] : [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3];
  const tool = brepFromTriangles(positions, indices, { id: `${at}_cut`, maximumTriangles: 4 });
  const base = `${at}_cut.facet0`, cap = capName ?? `${at}.cut.${below ? 'top' : 'bottom'}`;
  return { kind: 'brep', brep: transformBrep(tool, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, name => name.split('|').map(q => q === base ? cap : q.replace(`${at}_cut.facet`, `${at}.cut.side`)).join('|')) };
}
/** F2: a body with mesh faces and an exact body, `op`; refusals typed. */
function facetWith(a: Solid, b: Solid, op: 'union' | 'difference' | 'intersection', at: string): Solid {
  const B = b.kind === 'upright' ? brepFromPrismatic(b.solid, { id: at + '_tool' }) : b.brep;
  try { return { kind: 'brep', brep: facetBoolean((a as Extract<Solid, { kind: 'brep' }>).brep, B, op, { id: at, nearTriangles: facetLimit }) }; }
  catch (cause) { if (isFacetBooleanError(cause)) throw new CadPartError(cause.code, at, cause.message); if (cause instanceof BrepError) throw new CadPartError('GEOMETRY', at, cause.message.replace(/^B-rep: /, '')); throw cause; }
}
/** A body of mesh faces only (F0): split on its own triangles (F1), any size. */
const facetBody = (s: Solid) => s.kind === 'brep' && s.brep.faces.length > 0 && s.brep.faces.some(isFacetFace);
/**
 * A facet body's triangles as one welded mesh (its faces share their boundary points exactly), each triangle's group
 * its face, and the faces' names (without a `#k`: a face split again keeps its source's name, numbered).
 */
export function facetTriangles(brep: Brep): { positions: Float64Array; indices: Uint32Array; groups: Int32Array; names: string[] } {
  let nv = 0, nt = 0;
  for (const f of brep.faces) { const p = f.surface as FacetPatch; nv += p.positions.length / 3; nt += p.indices.length / 3; }
  const P = new Float64Array(3 * nv), I = new Uint32Array(3 * nt), G = new Int32Array(nt), names: string[] = [];
  let ov = 0, ot = 0;
  brep.faces.forEach((f, g) => {
    const p = f.surface as FacetPatch, fw = f.sense === 'forward', X = p.indices;
    P.set(p.positions, 3 * ov);
    // (Wound outward: a reversed face's triangles turned.)
    for (let k = 0; k < X.length; k += 3) { I[3 * ot + k] = X[k] + ov; I[3 * ot + k + 1] = (fw ? X[k + 1] : X[k + 2]) + ov; I[3 * ot + k + 2] = (fw ? X[k + 2] : X[k + 1]) + ov; }
    G.fill(g, ot, ot + p.indices.length / 3);
    names.push((f.name ?? f.id).replace(/#\d+$/, ''));
    ov += p.positions.length / 3; ot += p.indices.length / 3;
  });
  let size = 1; for (let k = 0; k < P.length; k++) size = Math.max(size, Math.abs(P[k]));
  const { P: welded, remap } = weldVertices(P, nv, 1e-9 * size);
  for (let k = 0; k < I.length; k++) I[k] = remap[I[k]];
  return { positions: welded, indices: I, groups: G, names };
}
/** F1 (R4, D50): a facet body cut by n·p = d, below then above, each closed by an exact planar cap. */
function splitFacets(s: Solid, n: Point, d: number, at: string): Solid[] {
  let r: FacetSplitResult;
  const brep = (s as Extract<Solid, { kind: 'brep' }>).brep;
  try { r = brep.faces.every(isFacetFace) ? splitFacetBrep(brep, { normal: n, offset: d, at }) : { ...splitMixedBrep(brep, n, d, at), loops: [] }; }
  catch (cause) { if (cause instanceof BrepError || isFacetBooleanError(cause)) throw new CadPartError('GEOMETRY', at, cause.message.replace(/^B-rep: /, '')); throw cause; }
  if (!r.below || !r.above) throw new CadPartError('SELECTION', at, 'the split plane does not cross the target');
  return [{ kind: 'brep', brep: r.below }, { kind: 'brep', brep: r.above }];
}

function draftSectionEdge(outer: CurveSegment2[], a: XY, b: XY, tag: string): void {
  if (a[0] !== b[0] || a[1] !== b[1]) outer.push({ kind: 'line', a, b, tag });
}

/** The validated Draft prism clipped by its nominal plane in the existing face frame. */
function draftWedge(prism: PrismaticSolid, u0: number, u1: number, v0: number, v1: number, neutral: number,
  angle: number, frame: BrepAffine['matrix'], origin: Point, tag: string): Solid {
  const slab = prism.slabs[0], none: Solid = { kind: 'upright', solid: { kind: 'prismatic-solid', slabs: [] } };
  if (!slab) return none;
  const slope = Math.tan(Math.abs(angle)), bottom = slab.z0, depth = slab.z1;
  const lowerCross = slope === 0 ? -Infinity : neutral + bottom / slope;
  const lo = Math.max(v0, lowerCross), high = Math.min(depth, slope * (v1 - neutral));
  if (!(v1 > lo && high > bottom)) return none;
  // Copy a known clipping coordinate exactly; do not recover the neutral line from remote corners.
  const low = lo === lowerCross ? bottom : Math.max(bottom, Math.min(depth, slope * (lo - neutral)));
  const upperCross = slope === 0 ? Infinity : neutral + depth / slope, capped = slope * (v1 - neutral) > depth;
  const a: XY = [lo, bottom], b: XY = [v1, bottom], c: XY = [v1, high], d: XY = [lo, low], outer: CurveSegment2[] = [];
  draftSectionEdge(outer, a, b, `${tag}.overlap`);
  draftSectionEdge(outer, b, c, `${tag}.side2`);
  if (capped && upperCross > lo) {
    const cap: XY = [upperCross, depth];
    draftSectionEdge(outer, c, cap, `${tag}.top`);
    draftSectionEdge(outer, cap, d, `${tag}.bottom`);
  } else draftSectionEdge(outer, c, d, capped ? `${tag}.top` : `${tag}.bottom`);
  draftSectionEdge(outer, d, a, `${tag}.side0`);
  let twiceArea = 0;
  for (const edge of outer) if (edge.kind === 'line') twiceArea += (edge.a[0] - lo) * (edge.b[1] - bottom) - (edge.b[0] - lo) * (edge.a[1] - bottom);
  if (!(twiceArea > 0)) return none;
  // This convex section is derived geometry, not a new sketch: retain internal short cap edges.
  const regions = [{ outer, holes: [] }], section: PrismaticSolid = { kind: 'prismatic-solid',
    slabs: [{ z0: u0, z1: u1, regions }], caps: [{ z: u0, regions, tag: `${tag}.side3` }, { z: u1, regions, tag: `${tag}.side1` }] };
  // (faceY, normal, faceX) is a cyclic permutation of the original proper face frame.
  const matrix: BrepAffine['matrix'] = [frame[1], frame[2], frame[0], frame[4], frame[5], frame[3], frame[7], frame[8], frame[6]];
  return affine({ kind: 'upright', solid: section }, matrix, origin);
}

function boxSolid(min: Point, max: Point, tag: string): Solid {
  const ring: ProfileSegmentInput[] = [[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]].map(start => ({ kind: 'line', start: start as XY }));
  return { kind: 'upright', solid: prismaticFromProfile({ outer: ring, height: max[2] - min[2], from: min[2], tag }) };
}

/** Upright Booleans stay upright; otherwise both bodies must be planar for the exact polyhedral Boolean. */
export function boolean(a: Solid, b: Solid, op: 'union' | 'difference' | 'intersection', at: string, edgeFitTolerance?: number): Solid {
  if (profiling) profiling.booleans++;
  if (empty(b)) return op === 'intersection' ? b : a;
  if (empty(a)) return op === 'union' ? b : a;
  if (a.kind === 'upright' && b.kind === 'upright') {
    // (Lumps that touch along an edge or at a point stay separate bodies, as lumps apart are: D204.)
    return { kind: 'upright', solid: booleanPrismatic(a.solid, b.solid, op) };
  }
  // F2 (R6, D52): a mesh body with an exact one — the mesh near the tool through the exact Boolean, any size; union
  // and intersection either way round. (Mesh with mesh, F3, still through F0's planar path, D3.)
  const meshy = (s: Solid) => s.kind === 'brep' && s.brep.faces.some(isFacetFace);
  if (meshy(a) && !meshy(b)) return facetWith(a, b, op, at);
  if (meshy(b) && !meshy(a) && op !== 'difference') return facetWith(b, a, op, at);
  // (F0: a facet body, small enough, goes through the planar path; else refused, see FACET_EXPLODE_TRIANGLES.)
  if (a.kind === 'brep' && a.brep.faces.some(isFacetFace)) a = { kind: 'brep', brep: explodeFacets(a.brep, at, 'Booleans') };
  if (b.kind === 'brep' && b.brep.faces.some(isFacetFace)) b = { kind: 'brep', brep: explodeFacets(b.brep, at, 'Booleans') };
  const A = a.kind === 'upright' ? (lineOnly(a.solid) ? brepFromPrismatic(a.solid, { id: at + '_a' }) : null) : a.brep;
  const B = b.kind === 'upright' ? (lineOnly(b.solid) ? brepFromPrismatic(b.solid, { id: at + '_b' }) : null) : b.brep;
  if (A && B && planarBrep(A) && planarBrep(B)) return { kind: 'brep', brep: planarBoolean(A, B, op, at) };
  // Planes and cylinders of any axis.
  const toBrep = (s: Solid) => s.kind === 'upright' ? brepFromPrismatic(s.solid, { id: at + '_in' }) : s.brep;
  try { return { kind: 'brep', brep: booleanAnalytic(toBrep(a), toBrep(b), op, { id: at, ...(edgeFitTolerance === undefined ? {} : { edgeFitTolerance: edgeFitTolerance }) }) }; }
  catch (cause) {
    if (cause instanceof BrepError && /not supported yet/.test(cause.message)) throw new CadPartError('CAPABILITY', at, cause.message.replace(/^B-rep: (analytic Boolean: )?/, ''));
    throw cause;
  }
}
/**
 * Two bodies of planes only: the exact rational polyhedral Boolean. It needs each face's vertices exactly coplanar; a
 * body off the axes (a member on an oblique line, a split's slanted cut) has them so only to binary64 (~1e-15), and the
 * polyhedral route refuses the face (reason `NOT_PLANAR_WITHIN_FLOAT`, D126). Then the analytic Boolean, which works on the planes in binary64,
 * takes the pair (FR3a, D125: a mitred sharp tube on a 120° or 3D corner, and two such tubes welded, were refused).
 */
export function planarBoolean(a: Brep, b: Brep, op: 'union' | 'difference' | 'intersection', at: string): Brep {
  if (profiling) profiling.planarBooleans++;
  try { return booleanPolyhedra(a, b, op, { id: at }); }
  catch (cause) { if (!(cause instanceof BrepError && cause.reason === 'NOT_PLANAR_WITHIN_FLOAT')) throw cause; }
  return booleanAnalytic(a, b, op, { id: at });
}
/**
 * Copies united in a balanced tree (neighbours first, so each Boolean joins two bodies of like size, not
 * one growing body and a copy).
 */
function unionAll(list: Solid[], at: string): Solid {
  let level = list;
  while (level.length > 1) { const next: Solid[] = []; for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? boolean(level[i], level[i + 1], 'union', at) : level[i]); level = next; }
  return level[0];
}
export const volumeOfSolid = (s: Solid) => s.kind === 'upright' ? prismaticVolume(s.solid) : s.brep.bodies.length ? brepMassProperties(s.brep, 1, { segmentsPerQuarter: 8, quadratureSegments: 0 }).volume : 0;

export function affine(s: Solid, m: BrepAffine['matrix'], o: readonly number[], rename?: ((n: string) => string) | string): Solid {
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
export function moveAll(parts: readonly Part[], m: BrepAffine['matrix'], o: Point, preserveNativeSI = false): Result {
  return { kind: 'solid', parts: parts.map((p): Part => {
    const exact = p.mass ?? (p.solid.kind === 'upright' ? ((s: PrismaticSolid) => (d: number) => prismaticMassProperties(s, d))(p.solid.solid) : undefined);
    return { solid: affine(p.solid, m, o), moved: { from: p, m, o }, ...(exact ? { mass: (d: number) => movedMass(exact(d), m, o, preserveNativeSI) } : {}) };
  }) };
}
export function movedMass(p: MassProperties, m: BrepAffine['matrix'], o: Point, preserveNativeSI = false): MassProperties {
  const k = Math.cbrt(Math.abs(m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]))), R = m.map(x => x / k);
  const c = p.centroid, I = p.inertia, k5 = k ** 5;
  const RIRt = [0, 1, 2].map(i => [0, 1, 2].map(j => { let sum = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) sum += R[3 * i + a] * I[a][b] * R[3 * j + b]; return sum * k5; })) as [[number, number, number], [number, number, number], [number, number, number]];
  const moved = unsupportedNativeMass({ volume: p.volume * k ** 3, mass: p.mass * k ** 3, method: p.method, inertia: RIRt,
    centroid: [0, 1, 2].map(i => m[3 * i] * c[0] + m[3 * i + 1] * c[1] + m[3 * i + 2] * c[2] + o[i]) as Point }, 'transformed');
  // Only the translate feature may retain an existing integral basis: central moments do not
  // change under translation. Identity rotations/scales and unsupported bases stay unsupported.
  if (preserveNativeSI && m.every((x, i) => x === (i === 0 || i === 4 || i === 8 ? 1 : 0)) && readNativeSIInertia(p).ok) transferNativeMassBasis(p, moved);
  return moved;
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
export function sweepBrep(profile: readonly ProfileSegmentInput[], steps: readonly SweepStep[], at: string, fail: Tools['fail'], through?: XY, sideTags?: readonly string[]): { brep: Brep; mass: (density: number) => MassProperties } {
  if (profiling) profiling.sweeps++;
  // The path runs through the profile's centroid (or a given point): the profile is moved there, the body back.
  const centre = through ?? buildProfileLoop(profile, { maximumSegments: 1024 }).centroid;
  const outer: ProfileSegmentInput[] = profile.map(g => g.kind === 'line' ? { kind: 'line', start: [g.start[0] - centre[0], g.start[1] - centre[1]] } : { ...g, start: [g.start[0] - centre[0], g.start[1] - centre[1]], center: [g.center[0] - centre[0], g.center[1] - centre[1]] });
  let o: Point = [centre[0], centre[1], 0], x: Point = [1, 0, 0], y: Point = [0, 1, 0], z: Point = [0, 0, 1];
  // (Ids are identifiers; the pieces' faces are named `${at}.s${k}.…`.)
  const place = (b: Brep, k: number): Brep => transformBrep(b, { matrix: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]], offset: [o[0], o[1], o[2]] }, n => n.split(`${at}_s${k}`).join(`${at}.s${k}`));
  const rot = (v: Point, d: Point, t: number): Point => add(add(scale(v, Math.cos(t)), scale(cross(d, v), Math.sin(t))), scale(d, dot(d, v) * (1 - Math.cos(t))));
  // Each piece's mass in its own frame; these add only when the pieces are glued without overlap.
  const pieces: Brep[] = [], masses: { local: (density: number) => MassProperties; axes: [Point, Point, Point]; offset: Point }[] = [];
  steps.forEach((st, k) => {
    const tag = `${at}_s${k}`;
    if (st.kind === 'straight') {
      const prism = prismaticFromProfile({ outer, height: st.length, tag, ...(sideTags ? { sideTags: { outer: sideTags } } : {}) });
      masses.push({ local: d => prismaticMassProperties(prism, d), axes: [x, y, z], offset: o });
      pieces.push(place(brepFromPrismatic(prism, { id: tag }), k));
      o = add(o, scale(z, st.length));
      return;
    }
    // The bend axis lies in the profile's plane, `radius` towards the side, square to that side.
    const side = st.toward, sx = side === 'x' ? 1 : side === '-x' ? -1 : 0, sy = side === 'y' ? 1 : side === '-y' ? -1 : 0;
    const origin: XY = [sx * st.radius, sy * st.radius], direction: XY = sx ? [0, 1] : [1, 0];
    let turned: Brep;
    try { turned = revolveProfile({ id: tag, profile: outer, axis: { origin, direction }, angle: st.angle, ...(sideTags ? { sideTags } : {}) }); }
    catch (cause) { if (cause instanceof BrepError && /axis/.test(cause.message)) fail('PARAMETER', `bend ${k}: the profile reaches the bend's axis (use a radius larger than the profile's reach towards ${side})`); throw cause; }
    pieces.push(place(turned!, k));
    const input = { id: tag, profile: outer, axis: { origin, direction }, angle: st.angle };
    masses.push({ local: d => revolveMassProperties(input, d), axes: [x, y, z], offset: o });
    // The frame turns about the axis by the bend's angle (z towards the side).
    const sideDir = sx ? scale(x, sx) : scale(y, sy), d = unit(cross(z, sideDir)), A = add(o, scale(sideDir, st.radius)), t = st.angle * Math.PI / 180;
    o = add(A, rot(sub(o, A), d, t)); x = rot(x, d, t); y = rot(y, d, t); z = rot(z, d, t);
  });
  // Consecutive pieces meet in a cross-section, each on its side of its plane: they are glued there,
  // exactly, unless pieces further apart may touch (then they are united by a Boolean).
  const box = (b: Brep) => { const lo: Point = [Infinity, Infinity, Infinity], hi: Point = [-Infinity, -Infinity, -Infinity]; for (const f of b.faces) for (const row of nurbsOf(f).controlPoints) for (const p of row) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } return { lo, hi }; };
  const boxes = pieces.map(box), apart = (i: number, j: number) => [0, 1, 2].some(k => boxes[i].hi[k] < boxes[j].lo[k] - 1e-6 || boxes[j].hi[k] < boxes[i].lo[k] - 1e-6);
  const separate = pieces.every((_, i) => pieces.every((__, j) => j <= i + 1 || apart(i, j)));
  let body = pieces[0], additive = true;
  for (const p of pieces.slice(1)) {
    const glued = separate ? glueAtSharedFace(body, p, { family: 'sweep', id: at }) : null;
    if (!glued) additive = false;
    body = glued ?? booleanAnalytic(body, p, 'union', { id: at });
  }
  return { brep: body, mass: d => additive
    ? combineMassProperties(masses.map(m => ({ props: m.local(d), axes: m.axes, offset: m.offset })))
    : brepMassProperties(body, d) };
}

// ---- outputs --------------------------------------------------------------------------------------------
/** What an output's functions need beyond its data: the part it was made from, and its worked-out values. */
interface OutputState { readonly part: Part; validated?: BrepCheckReport; area?: number; readonly flats: Map<string, FlatPattern> }
const outputState = new WeakMap<CadPartOutput, OutputState>();
function makeOutput(id: string, feature: string, part: Part): CadPartOutput {
  const brep = brepOf(part, id.replace('/', '_'));
  const output: CadPartOutput = Object.freeze({
    id, feature, representation: representation(part.solid), brep, bodyCount: brep.bodies.length, ...(part.cylindricalWrap ? { cylindricalWrap: part.cylindricalWrap } : {}), ...(part.gear ? { gear: part.gear } : {}), ...(part.gearPlace ? { gearPlacement: part.gearPlace } : {}), ...(part.rack ? { rack: part.rack } : {}), ...(part.rackPlace ? { rackPlacement: part.rackPlace } : {}), ...(part.internalGear ? { internalGear: part.internalGear } : {}), ...(part.internalPlace ? { internalGearPlacement: part.internalPlace } : {}), ...(part.bevelGear ? { bevelGear: part.bevelGear } : {}), ...(part.bevelPlace ? { bevelGearPlacement: part.bevelPlace } : {}), ...(part.worm ? { worm: part.worm } : {}), ...(part.wormPlace ? { wormPlacement: part.wormPlace } : {}), ...(part.wormWheel ? { wormWheel: part.wormWheel } : {}), ...(part.wormWheelPlace ? { wormWheelPlacement: part.wormWheelPlace } : {}), ...(part.spring ? { spring: part.spring } : {}), ...(part.cam ? { cam: part.cam } : {}), ...(part.sprocket ? { sprocket: part.sprocket } : {}), ...(part.pulley ? { pulley: part.pulley } : {}), ...(part.belt ? { belt: part.belt } : {}), ...(part.coupling ? { coupling: part.coupling } : {}), ...(part.connector ? { connector: part.connector } : {}), ...(part.connectorBody ? { connectorBody: part.connectorBody } : {}), ...(part.shaft ? { shaft: part.shaft } : {}), ...(part.key ? { key: part.key } : {}), ...(part.keyway ? { keyway: part.keyway } : {}), ...(part.ring ? { ring: part.ring } : {}), ...(part.pin ? { pin: part.pin } : {}), ...(part.bearing ? { bearing: part.bearing } : {}), ...(part.gland ? { gland: part.gland } : {}), ...(part.oring ? { oring: part.oring } : {}), ...(part.subd ? { subd: part.subd } : {}), ...(part.band ? { band: part.band } : {}), ...(part.decimate ? { decimate: part.decimate } : {}), ...(part.fillet ? { fillet: part.fillet } : {}), ...(part.shell ? { shell: part.shell } : {}), ...(part.sheet ? { sheet: part.sheet } : {}), ...(part.member ? { member: part.member } : {}), ...(part.gusset ? { gusset: part.gusset } : {}), ...(part.endCap ? { endCap: part.endCap } : {}), ...(part.bead ? { bead: part.bead } : {})
  });
  outputState.set(output, { part, flats: new Map() });
  return output;
}
/** An output not made by evaluateCadPart (a copy, a deserialised one): its state from its B-rep alone. */
const stateOf = (o: CadPartOutput): OutputState => { let st = outputState.get(o); if (!st) { st = { part: { solid: { kind: 'brep', brep: o.brep }, brep: o.brep }, flats: new Map() }; outputState.set(o, st); } return st; };

/**
 * An output's mass properties (R7.3b, MMGS): `density` in g/cm³ (1 by default); volume mm³, mass g, centroid mm,
 * inertia g·mm² about the centroid. An open mesh (a sheet) encloses nothing: refused.
 */
export function massPropertiesOf(output: CadPartOutput, density = 1): MassProperties {
  const { part } = stateOf(output), brep = output.brep;
  if ((output.cylindricalWrap || brep.source?.family === 'cylindrical-wrap-assembly') && !part.mass) throw new CadPartError('CAPABILITY', output.id, 'cylindrical wrap mass requires a live evaluated provider; load and evaluate the saved document recipe');
  if (brep.bodies.some(b => b.kind === 'sheet')) throw new CadPartError('GEOMETRY', output.id, 'an open mesh (a sheet) encloses no volume: it has no mass');
  return part.mass ? part.mass(density) : part.solid.kind === 'upright' ? prismaticMassProperties(part.solid.solid, density) : brepMassProperties(brep, density, { segmentsPerQuarter: 32 });
}
/** An output's surface area (mm²) over its exact surfaces (brepSurfaceArea), worked out once. */
export function surfaceAreaOf(output: CadPartOutput): number { const st = stateOf(output); return st.area ??= brepSurfaceArea(output.brep); }
/**
 * An output's L0 validation (checkBrep with `strict`): topology, edges on their surfaces, loops that do not cross, no
 * slivers, tolerances under the cap. Worked out once; an imported STEP body is reported here rather than refused.
 */
export function checkOutput(output: CadPartOutput): BrepCheckReport { const st = stateOf(output); return st.validated ??= checkBrep(output.brep, { strict: true }); }
/** Binary STL (little-endian, 80-byte header) of an output's display tessellation. */
export function exportStl(output: CadPartOutput, options: { readonly segmentsPerQuarter?: number } = {}): Uint8Array { return stl(output.brep, options.segmentsPerQuarter ?? 16); }
/** A sheet-metal output's flat pattern: its fixed face and K-factor as made unless given, else its bend table bend by bend. */
export function flatPatternOf(output: CadPartOutput, options: { readonly fixedFace?: string; readonly kFactor?: number } = {}): FlatPattern {
  const st = stateOf(output), s = st.part.sheet, id = output.id;
  if (!s) throw new CadPartError('CAPABILITY', id, 'not made as sheet metal: give its thickness and K-factor to the kernel\'s flatPattern');
  const k = options.kFactor ?? s.kFactor, key = `${options.fixedFace ?? s.fixedFace}|${k ?? 'table'}`;
  const hit = st.flats.get(key); if (hit) return hit;
  try {
    const flat = sheetFlatPattern(output.brep, { thickness: s.thickness, ...(k !== undefined ? { kFactor: k } : { bendTable: s.bendTable! }), fixedFace: options.fixedFace ?? s.fixedFace, bendNames: s.bends.map(b => ({ name: b.name, faces: [b.inner, b.outer] })) });
    st.flats.set(key, flat); return flat;
  } catch (cause) {
    if (isFlatPatternError(cause)) throw new CadPartError(cause.code === 'CUT_ACROSS_BEND' ? 'CAPABILITY' : 'GEOMETRY', id, cause.message);
    throw cause;
  }
}
function stl(brep: Brep, segmentsPerQuarter: number): Uint8Array {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter });
  return encodeBinaryStl(mesh.positions, mesh.indices, 'barocss part (mm)');
}

/**
 * The part model's own helpers a feature family's module uses: passed in, never imported (they share this module's state,
 * the facet limit; `boolean` stays here). Frozen, so no family can swap one (R5.3, D221).
 */
const HELPERS = Object.freeze({ isRecord, brepOf, CadPartLimits, stepSizeProblem, splitBodies, meshArrayOk, facetBody, facetTriangles, brepBodies, frameOf, framed, placed });
export type PartHelpers = typeof HELPERS;

// Captured only after this module's constants initialize; original functions retain their shared runtime state.
const TRANSFORM_HELPERS = Object.freeze({ boolean, affine, rotation, moveAll, unionAll, rotate, CadPartLimits });

// Captured only after this module's constants initialize; original functions retain their shared runtime state.
const PRISMATIC_DETAIL_HELPERS = Object.freeze({ CadPartLimits, lineOnly, brepOf, boxSolid, boolean, empty, exactVolume });
