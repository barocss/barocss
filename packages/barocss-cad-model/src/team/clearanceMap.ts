import { resolveShopTree } from '../engine/shopRows';
import { bearingHousingRef } from '../engine/bearingContext';
// G22's data side (the S0 in decisions-outer.md, with the GPU lane's changes): the assembly's interference and clearance
// map from the exact checks. Every body of the base part and of each shown placed part, as the assembly places it:
// their boxes grown by the near band pruned first (sorted along x, then y and z), the exact least distance of the
// display meshes on each candidate pair (`meshClearance`, through each mesh's K2 tree), and for each side within the
// band a refined band mesh — the triangles that can be within the band, split until their edges are at most a third of
// it — with the exact distance to the other body at each band vertex (`nearestDistance2`), for the GPU lane's decal.
// The exact overlap of crossing pairs (the kernel's analytic Boolean, about half a second each on curved parts) is left
// pending in the map and filled later (`fillOverlap`), nearest first; each fill carries the map's version and the pair's
// pose key, so a result for a pose no longer shown is dropped. Positions are each body's own (local) frame: they move
// with the part; the overlap in body a's.
// A9-5/6: bodies at no distance are in `contact` until the Boolean says which: `touching` (no volume — coincident faces,
// a welded member on its neighbour, a plate on its rails) or an `overlap` (a clash). A pair a feature seats together
// (a bearing on its shaft and in its housing, a key in its seat and its hub, an O-ring in its gland, a ring in its
// groove, a bead on its joint) or a declared fit pair joins is `designed`, its source named, whatever its volume.
import { booleanAnalytic, brepMassProperties, meshClearance, nearestDistance2, transformBrep, triangleBvh, type Brep, type TriangleBvh } from '@barocss/cad';
import { placedBase, type PartInstance, type StudioDoc } from '../engine/doc';
import { featureId } from '../engine/ids';
import { rotationMatrix } from '../engine/placement';
import { partBreps, type BodyResult } from '../engine/evaluate';
import { bodyMesh, type DisplayMesh } from '../engine/mesh';
import type { Evaluate } from '../chat/tools';

export const CLEARANCE_MAP_VERSION = 'clearance-map-v1';
/** At most this overlap (mm³) is no volume: faces coincident, the Boolean's round-off. */
export const TOUCHING_MM3 = 1e-6;
type Vec3 = [number, number, number];
/** A body as the assembly places it: world = m·local + t. */
export interface Pose { m: number[]; t: Vec3 }
/** One side's band: the refined triangles within the band of the other body, in this body's frame, the distance at each vertex (clamped at the band). */
export interface Band { positions: Float32Array; indices: Uint32Array; field: Float32Array }
export interface ClearancePair {
  a: string; b: string;
  /** contact: no distance, the volume pending; then touching (none) or overlap (a clash); designed: seated by its source. */
  state: 'overlap' | 'contact' | 'touching' | 'designed' | 'near' | 'clear';
  /** A designed pair's source: the feature or fit pair that seats the two together. */
  designed?: string;
  /** An O-ring against what squeezes it: the most its overlap is by design (more is a clash). */
  squeezeMM3?: number;
  minGapMM: number;
  /** The closest points, each in its own body's frame, and the faces they lie on by persistent name. */
  closest: { a: Vec3; b: Vec3; faceA: string; faceB: string };
  /** The two bodies' content and poses: a fill for another key is stale. */
  pose: string;
  overlap?: { volume: number; mesh: DisplayMesh } | { pending: true } | { refused: string };
  band?: { a: Band; b: Band };
}
export interface ClearanceMap {
  version: typeof CLEARANCE_MAP_VERSION;
  /** The map's revision (its pairs' pose keys): fills name it. */
  revision: string;
  near: { mm: number; source: 'input' };
  pairs: ClearancePair[];
  /** How many overlaps wait for their Boolean. */
  pending: number;
  timing: { pruneMS: number; clearanceMS: number; bandMS: number };
}
/** A filled overlap: its pair, the map's revision and the pair's pose key it was worked out for. */
export interface OverlapFill { a: string; b: string; revision: string; pose: string; overlap: NonNullable<ClearancePair['overlap']> }

/** A body of the assembly: its key (`<inst>/` for a placed part's), its display mesh and B-rep in its own frame, its pose. */
export interface PlacedBody {
  key: string; mesh: DisplayMesh; brep: Brep | null; pose: Pose;
  /** The bodies a feature of its part seats it with, by key, and that feature (A9-6). */
  designedWith?: ReadonlyMap<string, string>;
  /** An O-ring's squeeze (A9-6): designed against whatever squeezes it, in any part, up to the gland's overlap figure. */
  squeeze?: { ring: string; mm3: number };
}
interface Prepared extends PlacedBody { world: Float64Array; local: Float64Array; lo: Vec3; hi: Vec3; bvh: TriangleBvh; localBvh: TriangleBvh; hash: string }

const IDENTITY: Pose = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
const apply = (p: Pose, x: number, y: number, z: number): Vec3 => [p.m[0] * x + p.m[1] * y + p.m[2] * z + p.t[0], p.m[3] * x + p.m[4] * y + p.m[5] * z + p.t[1], p.m[6] * x + p.m[7] * y + p.m[8] * z + p.t[2]];
/** A world point in a pose's local frame (m is a rotation: its inverse its transpose). */
const unapply = (p: Pose, w: readonly number[]): Vec3 => { const x = w[0] - p.t[0], y = w[1] - p.t[1], z = w[2] - p.t[2]; return [p.m[0] * x + p.m[3] * y + p.m[6] * z + 0, p.m[1] * x + p.m[4] * y + p.m[7] * z + 0, p.m[2] * x + p.m[5] * y + p.m[8] * z + 0]; };
/** A short hash of numbers (FNV-1a over their single-precision bits): a body's content and pose. */
function hashOf(...lists: ArrayLike<number>[]): string {
  let h = 0x811c9dc5; const f = new Float32Array(1), u = new Uint32Array(f.buffer);
  for (const list of lists) for (let i = 0; i < list.length; i++) { f[0] = list[i]; h = Math.imul(h ^ u[0], 0x01000193) >>> 0; }
  return h.toString(36);
}

/** The assembly's bodies where it places them: the base part's as they are, each shown placed part's by its pose. */
export async function assemblyPlacedBodies(doc: StudioDoc, evaluate: Evaluate): Promise<PlacedBody[]> {
  doc = resolveShopTree(doc);
  const out: PlacedBody[] = [];
  const results = new Map<string, readonly BodyResult[]>();
  const take = (d: StudioDoc, bodies: readonly BodyResult[], prefix: string, pose: Pose) => {
    results.set(prefix, bodies);
    let breps: Map<string, Brep> = new Map(); try { breps = new Map(partBreps(d).map(x => [x.key, x.brep])); } catch { /* no B-reps: overlaps refused */ }
    const seats = designedSeats(d, bodies);
    for (const b of bodies) {
      const own = seats.get(b.key);
      const ring = b.element?.kind === 'oring' ? b.element.report : null;
      out.push({ key: `${prefix}${b.key}`, mesh: b.mesh, brep: breps.get(b.key) ?? null, pose, ...(own ? { designedWith: new Map([...own].map(([k, v]) => [`${prefix}${k}`, v])) } : {}), ...(ring ? { squeeze: { ring: ring.ring, mm3: ring.overlap } } : {}) });
    }
  };
  const base = await evaluate(doc); if (base?.ok) take(doc, base.bodies, '', IDENTITY);
  // (O10: each placed part as its own document unplaced and flattened — placedBase — so its bodies' keys are the ones every
  // producer gives them, a sub-assembly's nested bodies among them.)
  const sources = new Map<string, StudioDoc>();
  for (const inst of doc.instances ?? []) if (!inst.hidden) { const d = placedBase(inst, doc); sources.set(inst.id, d); const r = await evaluate(d); if (r?.ok) take(d, r.bodies, `${inst.id}/`, poseOf(inst)); }
  // Cross-part targets use final assembly keys, never the owner's local prefix.
  for (const [owner, source] of [['base', doc], ...[...sources]] as [string, StudioDoc][]) {
    for (const [i, node] of source.nodes.entries()) {
      const ref = bearingHousingRef(node); if (!ref || node.kind !== 'bearing' || node.suppressed) continue;
      const prefix = owner === 'base' ? '' : `${owner}/`, own = bodyOfFeature(source, results.get(prefix) ?? [], i);
      if (own?.element?.kind !== 'bearing' || !own.element.report.housing?.covered) continue;
      const a = out.find(b => b.key === `${prefix}${own.key}`);
      const b = out.find(b => b.key === `${ref.part === 'base' ? '' : `${ref.part}/`}${ref.body}`);
      if (!a || !b) continue;
      const evidence = `bearing ${featureId(source.nodes, i)} (${node.row}) in ${ref.part}/${ref.body}${node.housingClass ? `, seat ${node.housingClass}` : ''}`;
      for (const [x, y] of [[a, b], [b, a]]) { const links = new Map(x.designedWith); links.set(y.key, evidence); x.designedWith = links; }
    }
  }
  return out;
}
/** The body holding a feature's faces (its id the faces' prefix), else the one it made. */
function bodyOfFeature(doc: StudioDoc, bodies: readonly BodyResult[], node: number): BodyResult | undefined {
  const id = featureId(doc.nodes, node), prefix = `${id}.`;
  return bodies.find(b => b.mesh.faces.some(f => f.name.split('+').some(n => n.startsWith(prefix)))) ?? bodies.find(b => b.ref?.node === node);
}
/** A9-6: the pairs of a part's bodies its features seat together, each with that feature: both ways, by body key. */
export function designedSeats(doc: StudioDoc, bodies: readonly BodyResult[]): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  const tie = (a: BodyResult | undefined, b: BodyResult | undefined, source: string) => {
    if (!a || !b || a === b) return;
    for (const [x, y] of [[a, b], [b, a]]) { const m = out.get(x.key) ?? new Map<string, string>(); if (!m.has(y.key)) m.set(y.key, source); out.set(x.key, m); }
  };
  for (const b of bodies) {
    if (b.element?.kind === 'weld-bead') { for (const m of bodies) if (m.cutPiece) tie(b, m, `weld bead ${b.key}`); continue; }
    const i = b.ref?.node, n = i === undefined ? undefined : doc.nodes[i];
    if (!n) continue;
    const label = featureId(doc.nodes, i!);
    if (n.kind === 'bearing') {
      tie(b, bodyOfFeature(doc, bodies, n.shaft), `bearing ${label} (${n.row}) on its shaft${n.shaftClass ? `, seat ${n.shaftClass}` : ''}`);
      if (n.housing !== undefined) tie(b, bodyOfFeature(doc, bodies, n.housing), `bearing ${label} (${n.row}) in its housing${n.housingClass ? `, seat ${n.housingClass}` : ''}`);
    } else if (n.kind === 'key') {
      tie(b, bodyOfFeature(doc, bodies, n.shaft), `key ${label} in its keyseat`);
      if (n.hub !== undefined) tie(b, bodyOfFeature(doc, bodies, n.hub), `key ${label} in its hub's keyway`);
    } else if (n.kind === 'oring') {
      tie(b, bodyOfFeature(doc, bodies, n.gland), `O-ring ${label} in its gland ${featureId(doc.nodes, n.gland)} (its squeeze)`);
    } else if (n.kind === 'retaining-ring') {
      tie(b, bodyOfFeature(doc, bodies, n.shaft), `ring ${label} in its groove`);
    }
  }
  // (A declared fit pair: the bodies holding its two faces.)
  const holding = (face: string) => bodies.find(b => b.mesh.faces.some(f => f.name === face));
  for (const p of doc.fits?.pairs ?? []) tie(holding(p.hole), holding(p.shaft), `fit pair ${p.hole} / ${p.shaft}`);
  return out;
}
export const poseOf = (inst: PartInstance): Pose => ({ m: [...(rotationMatrix(inst.rotation) as unknown as number[])], t: [inst.position[0], inst.position[1], inst.position[2]] });

/** Each body prepared once (its world mesh, box, K2 trees and hash), kept while the body object lives: a band asked for later reuses them. */
const prepared = new WeakMap<PlacedBody, Prepared>();
function prepare(b: PlacedBody): Prepared {
  const had = prepared.get(b); if (had) return had;
  const P = b.mesh.positions, local = Float64Array.from(P), world = new Float64Array(P.length), lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < P.length; v += 3) { const w = apply(b.pose, P[v], P[v + 1], P[v + 2]); for (let k = 0; k < 3; k++) { world[v + k] = w[k]; lo[k] = Math.min(lo[k], w[k]); hi[k] = Math.max(hi[k], w[k]); } }
  const out = { ...b, world, local, lo, hi, bvh: triangleBvh(world, b.mesh.indices), localBvh: triangleBvh(local, b.mesh.indices), hash: hashOf(P, b.mesh.indices, b.pose.m, b.pose.t) };
  prepared.set(b, out);
  return out;
}
const faceOf = (mesh: DisplayMesh, triangle: number) => triangle < 0 ? '' : mesh.faces[mesh.faceOfVertex[mesh.indices[3 * triangle]]]?.name ?? '';

/**
 * The map: candidates by their grown boxes and the exact least distance on each — at once. Bands (`bands: true`, or each
 * by `bandFor`) and overlaps (`fillOverlap`) come after, nearest first: a band costs far more than the map (O-log).
 */
export function clearanceMap(bodies: readonly PlacedBody[], o: { near?: number; bands?: boolean } = {}): ClearanceMap {
  const near = o.near ?? 1, t0 = performance.now(), ps = bodies.map(prepare);
  const order = ps.map((_, k) => k).sort((a, b) => ps[a].lo[0] - ps[b].lo[0]), cand: [number, number][] = [];
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
    const A = ps[order[i]], B = ps[order[j]]; if (B.lo[0] > A.hi[0] + near) break;
    if (A.lo[1] <= B.hi[1] + near && B.lo[1] <= A.hi[1] + near && A.lo[2] <= B.hi[2] + near && B.lo[2] <= A.hi[2] + near) cand.push(order[i] < order[j] ? [order[i], order[j]] : [order[j], order[i]]);
  }
  cand.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const t1 = performance.now(), pairs: ClearancePair[] = [];
  let bandMS = 0;
  for (const [i, j] of cand) {
    const A = ps[i], B = ps[j], c = meshClearance(A.world, A.mesh.indices, B.world, B.mesh.indices, { bvhA: A.bvh, bvhB: B.bvh });
    const ring = A.squeeze ?? B.squeeze, gap = c.distance;
    const designed = A.designedWith?.get(B.key) ?? B.designedWith?.get(A.key) ?? (ring ? `O-ring ${ring.ring}: its squeeze, up to ${+ring.mm3.toFixed(4)} mm³ (its gland's figure)` : undefined);
    const state: ClearancePair['state'] = gap === 0 ? designed ? 'designed' : 'contact' : gap <= near ? 'near' : 'clear';
    const pair: ClearancePair = { a: A.key, b: B.key, state, minGapMM: gap, closest: { a: c.pointA ? unapply(A.pose, c.pointA) : [0, 0, 0], b: c.pointB ? unapply(B.pose, c.pointB) : [0, 0, 0], faceA: faceOf(A.mesh, c.triangleA), faceB: faceOf(B.mesh, c.triangleB) }, pose: `${A.hash}.${B.hash}` };
    if (designed) pair.designed = designed;
    if (ring && !(A.designedWith?.get(B.key) ?? B.designedWith?.get(A.key))) pair.squeezeMM3 = ring.mm3;
    if (gap === 0) pair.overlap = A.brep && B.brep ? { pending: true } : { refused: 'no exact solid for one of the two bodies (a mesh body): touching or overlapping is not told apart' };
    if (state !== 'clear' && o.bands) { const tb = performance.now(); pair.band = { a: bandOf(A, B, near), b: bandOf(B, A, near) }; bandMS += performance.now() - tb; }
    pairs.push(pair);
  }
  const t2 = performance.now();
  return { version: CLEARANCE_MAP_VERSION, revision: hashOf(pairs.map(p => p.pose.length), ...pairs.map(p => Array.from(p.pose, ch => ch.charCodeAt(0)))), near: { mm: near, source: 'input' }, pairs, pending: pairs.filter(p => p.overlap && 'pending' in p.overlap).length, timing: { pruneMS: t1 - t0, clearanceMS: t2 - t1 - bandMS, bandMS } };
}

/**
 * One side's band: each triangle of `A` (in A's frame) split in four while its edge is over near/3 and it can still be
 * within the band (the distance is 1-Lipschitz: a triangle whose every corner is further than the band plus its longest
 * edge is wholly outside) and its field is not affine over it (its edges' middles and its centroid off the corners'
 * interpolation by more than near/100); kept where a corner is within the band; the exact distance to `B` at each vertex.
 */
function bandOf(A: Prepared, B: Prepared, near: number): Band {
  const h = near / 3, P = A.local, I = A.mesh.indices, pos: number[] = [], idx: number[] = [], fld: number[] = [];
  const dist = (p: Vec3) => { const w = apply(A.pose, p[0], p[1], p[2]); return Math.sqrt(nearestDistance2(B.bvh, w[0], w[1], w[2], (near * 4) ** 2)); };
  const stack: [Vec3, Vec3, Vec3, number, number, number][] = [];
  for (let t = 0; t < I.length; t += 3) {
    const a: Vec3 = [P[3 * I[t]], P[3 * I[t] + 1], P[3 * I[t] + 2]], b: Vec3 = [P[3 * I[t + 1]], P[3 * I[t + 1] + 1], P[3 * I[t + 1] + 2]], c: Vec3 = [P[3 * I[t + 2]], P[3 * I[t + 2] + 1], P[3 * I[t + 2] + 2]];
    stack.push([a, b, c, dist(a), dist(b), dist(c)]);
    while (stack.length) {
      const [p, q, r, dp, dq, dr] = stack.pop()!, e = Math.max(len(p, q), len(q, r), len(r, p));
      if (Math.min(dp, dq, dr) > near + e) continue;
      if (e > h) {
        const pq = mid(p, q), qr = mid(q, r), rp = mid(r, p), dpq = dist(pq), dqr = dist(qr), drp = dist(rp);
        // (Where the distance is affine over the triangle — faces facing each other flat — its corners carry it exactly:
        // kept whole, no finer. Else split: a spot mid-face bends the field and is refined down to near/3.)
        const g = centroid(p, q, r), dg = dist(g), tol = near / 100;
        if (Math.min(dp, dq, dr) <= near && Math.abs(dpq - (dp + dq) / 2) <= tol && Math.abs(dqr - (dq + dr) / 2) <= tol && Math.abs(drp - (dr + dp) / 2) <= tol && Math.abs(dg - (dp + dq + dr) / 3) <= tol) {
          const k = pos.length / 3; pos.push(...p, ...q, ...r); fld.push(Math.min(dp, near), Math.min(dq, near), Math.min(dr, near)); idx.push(k, k + 1, k + 2);
          continue;
        }
        stack.push([p, pq, rp, dp, dpq, drp], [pq, q, qr, dpq, dq, dqr], [rp, qr, r, drp, dqr, dr], [pq, qr, rp, dpq, dqr, drp]);
        continue;
      }
      if (Math.min(dp, dq, dr) > near) continue;
      const k = pos.length / 3;
      pos.push(...p, ...q, ...r); fld.push(Math.min(dp, near), Math.min(dq, near), Math.min(dr, near)); idx.push(k, k + 1, k + 2);
    }
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx), field: Float32Array.from(fld) };
}
const len = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const centroid = (a: Vec3, b: Vec3, c: Vec3): Vec3 => [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];

/** A pair's bands on demand (both sides), the near band the map's — for the pairs on screen, nearest first. */
export function bandFor(map: ClearanceMap, bodies: readonly PlacedBody[], pair: ClearancePair): { a: Band; b: Band } | null {
  if (pair.state === 'clear') return null;
  const A = bodies.find(b => b.key === pair.a), B = bodies.find(b => b.key === pair.b); if (!A || !B) return null;
  const pa = prepare(A), pb = prepare(B); if (`${pa.hash}.${pb.hash}` !== pair.pose) return null;
  return pair.band ??= { a: bandOf(pa, pb, map.near.mm), b: bandOf(pb, pa, map.near.mm) };
}
/** The pairs waiting for their bands, nearest first (crossing ones first, then by gap). */
export const bandPending = (map: ClearanceMap): ClearancePair[] => map.pairs.filter(p => p.state !== 'clear' && !p.band).sort((x, y) => x.minGapMM - y.minGapMM);

/**
 * A pending overlap worked out: the kernel's analytic intersection of the two placed B-reps, its volume, and its
 * display mesh in body a's frame (the tessellation of the very B-rep whose volume is given). Refused, why.
 */
export function fillOverlap(map: ClearanceMap, bodies: readonly PlacedBody[], pair: ClearancePair): OverlapFill {
  const A = bodies.find(b => b.key === pair.a), B = bodies.find(b => b.key === pair.b);
  const base = { a: pair.a, b: pair.b, revision: map.revision, pose: pair.pose };
  if (!A?.brep || !B?.brep) return { ...base, overlap: { refused: 'no exact solid for one of the two bodies' } };
  try {
    // (B in A's frame: A's pose undone after B's done; the overlap is then in A's own frame.)
    const rel = relative(A.pose, B.pose), o = booleanAnalytic(A.brep, transformBrep(B.brep, { matrix: rel.m as never, offset: rel.t }), 'intersection');
    if (!o.bodies.length) return { ...base, overlap: { volume: 0, mesh: bodyMesh(o, 0, 8) } };
    return { ...base, overlap: { volume: brepMassProperties(o, 1).volume, mesh: bodyMesh(o, 0, 8) } };
  } catch (e) { return { ...base, overlap: { refused: e instanceof Error ? e.message : String(e) } }; }
}
/** B's pose seen from A's frame: x_A = mAᵀ(mB·x + tB − tA). */
function relative(A: Pose, B: Pose): Pose {
  const m: number[] = Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) m[3 * i + j] += A.m[3 * k + i] * B.m[3 * k + j];
  return { m, t: unapply(A, B.t) };
}
/** A fill applied to its map: only while the pair's pose key is the one it was worked out for (else stale, dropped). */
export function applyFill(map: ClearanceMap, f: OverlapFill): boolean {
  const p = map.pairs.find(x => x.a === f.a && x.b === f.b);
  if (!p || p.pose !== f.pose || !p.overlap || !('pending' in p.overlap)) return false;
  p.overlap = f.overlap; map.pending--;
  // (A9-5: in contact, no volume — touching; some — a clash. A designed pair stays designed, its volume given.)
  if (p.state === 'contact' && 'volume' in f.overlap) p.state = f.overlap.volume <= TOUCHING_MM3 ? 'touching' : 'overlap';
  // (An O-ring overlapping what squeezes it by more than its gland's figure: a clash, its declared squeeze still said.)
  if (p.state === 'designed' && p.squeezeMM3 !== undefined && 'volume' in f.overlap && f.overlap.volume > p.squeezeMM3 * (1 + 1e-9) + TOUCHING_MM3) p.state = 'overlap';
  return true;
}
/** The pending pairs, nearest first (crossing ones by their overlap's likely size: the boxes' common volume, largest first). */
export const pendingPairs = (map: ClearanceMap): ClearancePair[] => map.pairs.filter(p => p.overlap && 'pending' in p.overlap);
