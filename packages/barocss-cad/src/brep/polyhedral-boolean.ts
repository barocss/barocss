// Boolean operations on planar polyhedra (brep-core step 4): any two B-reps whose faces are planar
// and whose edges are straight — non-convex, with face holes, cavities and touching faces.
//
//   1. face pairs: transversal planes → the line of intersection; the parts of the line inside
//      both faces (exact rational intervals) become cut segments of both faces. Coplanar faces
//      cut each other along their boundaries.
//   2. every face is split by its cuts with the exact planar arrangement (step 3)
//   3. each piece is classified against the other solid at an exact interior point: inside or
//      outside (exact ray parity, retried on a degenerate ray), or on a coplanar face with the same
//      or the opposite orientation
//   4. pieces are kept by the operation's rule (B's pieces flipped for a difference), T-junctions
//      between neighbouring pieces are split, and the pieces are stitched into shells; shells with
//      negative volume are cavities of the smallest shell containing them.
//
// Pieces are kept as separate faces (no coplanar merging yet); the result is a valid B-rep. Each piece
// keeps its input face's persistent name (numbered `#k` when a name is split), and edges are named by
// their two faces, as for prismatic solids.
import { buildBrep, checkBrep, lineCurve, BrepError, type Brep } from './brep-core.js';
import { arrangementRegions, exactPoint2, exactToXY, type ExactPoint2 } from './planar-arrangement.js';
import { triangulatePolygonWithHoles } from './brep-tessellate.js';
import { nameEdges } from '../features/prismatic-solid.js';
import { binary64Dyadic } from '../core/dyadic.js';
import type { Point, Surface } from '../types.js';

export type PolyhedralBooleanOperation = 'union' | 'intersection' | 'difference';

// ---- exact rationals ---------------------------------------------------------------------------
type Q = { n: bigint; d: bigint };
const babs = (a: bigint) => a < 0n ? -a : a;
const bgcd = (a: bigint, b: bigint): bigint => { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a; };
const q = (n: bigint, d = 1n): Q => { if (d < 0n) { n = -n; d = -d; } const g = bgcd(n, d) || 1n; return { n: n / g, d: d / g }; };
function qf(v: number): Q {
  if (!Number.isFinite(v)) throw new BrepError('INPUT', 'finite coordinates required');
  const { m, k } = binary64Dyadic(v); return q(m, 1n << BigInt(k));
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d), sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d), div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const sgn = (a: Q) => a.n > 0n ? 1 : a.n < 0n ? -1 : 0, cmp = (a: Q, b: Q) => sgn(sub(a, b)), num = (a: Q) => Number(a.n) / Number(a.d);
const ZERO: Q = { n: 0n, d: 1n };
type V = [Q, Q, Q];
const vsub = (a: V, b: V): V => [sub(a[0], b[0]), sub(a[1], b[1]), sub(a[2], b[2])];
const vadd = (a: V, b: V): V => [add(a[0], b[0]), add(a[1], b[1]), add(a[2], b[2])];
const vscale = (a: V, s: Q): V => [mul(a[0], s), mul(a[1], s), mul(a[2], s)];
const vcross = (a: V, b: V): V => [sub(mul(a[1], b[2]), mul(a[2], b[1])), sub(mul(a[2], b[0]), mul(a[0], b[2])), sub(mul(a[0], b[1]), mul(a[1], b[0]))];
const vdot = (a: V, b: V): Q => add(add(mul(a[0], b[0]), mul(a[1], b[1])), mul(a[2], b[2]));
const vzero = (a: V) => a.every(x => x.n === 0n);
const vkey = (a: V) => a.map(x => x.n + '/' + x.d).join(',');
const vnum = (a: V): Point => [num(a[0]), num(a[1]), num(a[2])];

// ---- faces -------------------------------------------------------------------------------------
interface PFace {
  solid: 0 | 1; rings: V[][]; normal: V; offset: Q; axis: 0 | 1 | 2; i: 0 | 1 | 2; j: 0 | 1 | 2;
  min: Point; max: Point; cuts: [V, V][]; coplanar: number[]; name?: string;
  /** The plane in binary64: normal, offset, |normal| and the face's reach from the origin (for error bounds). */
  nf?: Point; of?: number; nn?: number; reach?: number;
  /** The rings in binary64, projected on the face's (i, j) plane (made when first needed). */
  flat?: Float64Array[];
}
/** A persistent name without its `#k` piece number. */
export const baseName = (name: string) => name.replace(/#\d+$/, '');
function facesOf(brep: Brep, solid: 0 | 1): PFace[] {
  const edges = new Map(brep.edges.map(e => [e.id, e])), coedges = new Map(brep.coedges.map(c => [c.id, c])), loops = new Map(brep.loops.map(l => [l.id, l]));
  const vertices = new Map(brep.vertices.map(v => [v.id, v.point]));
  return brep.faces.map(f => {
    const outer = f.loops.find(l => loops.get(l)!.kind === 'outer')!, ordered = [outer, ...f.loops.filter(l => l !== outer)];
    const rings = ordered.map(lid => loops.get(lid)!.coedges.map(cid => {
      const c = coedges.get(cid)!, e = edges.get(c.edge)!;
      if (!(e.curve.degree === 1 && e.curve.controlPoints.length === 2)) throw new BrepError('GEOMETRY', `polyhedral Boolean: edge ${e.id} is not straight`);
      const p = vertices.get(c.sense === 'forward' ? e.vertices[0] : e.vertices[1])!; return p.map(qf) as V;
    }));
    // Exact Newell normal of the outer loop: points out of the solid (loops run counter-clockwise about it).
    const ring = rings[0], normal = newellNormal(rings);
    if (!normal) throw new BrepError('GEOMETRY', `polyhedral Boolean: face ${f.id} has no area`);
    if (normal === 'bent') throw new BrepError('GEOMETRY', `polyhedral Boolean: face ${f.id} is not planar`, undefined, 'NOT_PLANAR_WITHIN_FLOAT');
    const mag = normal.map(x => Math.abs(num(x))), axis = (mag[0] >= mag[1] && mag[0] >= mag[2] ? 0 : mag[1] >= mag[2] ? 1 : 2) as 0 | 1 | 2;
    let i = ((axis + 1) % 3) as 0 | 1 | 2, j = ((axis + 2) % 3) as 0 | 1 | 2; if (sgn(normal[axis]) < 0) [i, j] = [j, i];
    const flat = rings.flat().map(vnum), min = [0, 1, 2].map(k => Math.min(...flat.map(p => p[k]))) as Point, max = [0, 1, 2].map(k => Math.max(...flat.map(p => p[k]))) as Point;
    const offset = vdot(normal, ring[0]);
    return { solid, rings, normal, offset, axis, i, j, min, max, cuts: [], coplanar: [], ...(f.name === undefined ? {} : { name: baseName(f.name) }), ...floatPlane(normal, offset, min, max) };
  });
}
/**
 * The exact Newell normal of a face's outer ring (reduced to coprime integers), null when it has no area, or
 * 'bent' when a vertex of any ring is off its plane. The corners are binary64 values, so on the common
 * power-of-two denominator they are integers and the sums need no rational reductions.
 */
function newellNormal(rings: V[][]): V | null | 'bent' {
  let K = 0n;
  for (const r of rings) for (const p of r) for (const x of p) { const k = BigInt(x.d.toString(2).length - 1); if (k > K) K = k; }
  const whole = rings.map(r => r.map(p => p.map(x => x.n << (K - BigInt(x.d.toString(2).length - 1)))));
  const ring = whole[0];
  let nx = 0n, ny = 0n, nz = 0n;
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length];
    nx += a[1] * b[2] - a[2] * b[1]; ny += a[2] * b[0] - a[0] * b[2]; nz += a[0] * b[1] - a[1] * b[0];
  }
  if (nx === 0n && ny === 0n && nz === 0n) return null;
  const g = bgcd(bgcd(nx, ny), nz); nx /= g; ny /= g; nz /= g;
  const at = nx * ring[0][0] + ny * ring[0][1] + nz * ring[0][2];
  for (const r of whole) for (const p of r) if (nx * p[0] + ny * p[1] + nz * p[2] !== at) return 'bent';
  return [{ n: nx, d: 1n }, { n: ny, d: 1n }, { n: nz, d: 1n }];
}
/** The plane in binary64, with what its error bound needs (see `slack`). */
function floatPlane(normal: V, offset: Q, min: Point, max: Point): { nf: Point; of: number; nn: number; reach: number } {
  const nf = vnum(normal);
  return { nf, of: num(offset), nn: Math.hypot(nf[0], nf[1], nf[2]), reach: Math.max(Math.abs(min[0]), Math.abs(max[0]), Math.abs(min[1]), Math.abs(max[1]), Math.abs(min[2]), Math.abs(max[2]), 1) };
}
/**
 * A bound on the binary64 error of n·p − offset at a point of reach `pr`: the converted normal, offset and
 * point are each within an ulp or two of the exact values, so 1e-9 of the terms' size is far beyond it.
 */
const slack = (g: PFace, pr: number) => 1e-9 * (g.nn! * Math.max(g.reach!, pr) + Math.abs(g.of!));

const to2 = (f: PFace, p: V): ExactPoint2 => exactPoint2(p[f.i].n, p[f.i].d, p[f.j].n, p[f.j].d);
function lift(f: PFace, x: Q, y: Q): V {
  const out: V = [ZERO, ZERO, ZERO]; out[f.i] = x; out[f.j] = y;
  out[f.axis] = div(sub(sub(f.offset, mul(f.normal[f.i], x)), mul(f.normal[f.j], y)), f.normal[f.axis]); return out;
}
const fromH = (p: ExactPoint2): [Q, Q] => [q(p.x, p.w), q(p.y, p.w)];

/** Parameter intervals of the line P0 + t·D inside face f (half-open crossing rule handles vertices on the line). */
function intervals(f: PFace, P0: V, D: V): Q[] {
  const ts: Q[] = [], d2 = [D[f.i], D[f.j]], p2 = [P0[f.i], P0[f.j]];
  const side = (p: V) => sgn(sub(mul(d2[0], sub(p[f.j], p2[1])), mul(d2[1], sub(p[f.i], p2[0]))));
  for (const ring of f.rings) ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length], sa = side(a) > 0, sb = side(b) > 0;
    if (sa === sb) return;
    const ba = [sub(b[f.i], a[f.i]), sub(b[f.j], a[f.j])], ap = [sub(a[f.i], p2[0]), sub(a[f.j], p2[1])];
    ts.push(div(sub(mul(ap[0], ba[1]), mul(ap[1], ba[0])), sub(mul(d2[0], ba[1]), mul(d2[1], ba[0]))));
  });
  return ts.sort(cmp);
}
function overlap(a: Q[], b: Q[]): [Q, Q][] {
  const out: [Q, Q][] = [];
  for (let x = 0; x + 1 < a.length; x += 2) for (let y = 0; y + 1 < b.length; y += 2) {
    const lo = cmp(a[x], b[y]) > 0 ? a[x] : b[y], hi = cmp(a[x + 1], b[y + 1]) < 0 ? a[x + 1] : b[y + 1];
    if (cmp(lo, hi) < 0) out.push([lo, hi]);
  }
  return out;
}

// ---- classification ----------------------------------------------------------------------------
/** Exact point-in-face test in the face plane: 1 inside, 0 on the boundary, −1 outside. */
function pointInFace(f: PFace, p: V): number {
  const x = p[f.i], y = p[f.j]; let inside = false;
  const lo = (u: Q, v: Q) => cmp(u, v) < 0 ? u : v, hi = (u: Q, v: Q) => cmp(u, v) < 0 ? v : u;
  for (const ring of f.rings) for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length], ax = a[f.i], ay = a[f.j], bx = b[f.i], by = b[f.j];
    // On the edge: collinear and inside its bounding box.
    if (sub(mul(sub(bx, ax), sub(y, ay)), mul(sub(by, ay), sub(x, ax))).n === 0n
      && cmp(x, lo(ax, bx)) >= 0 && cmp(x, hi(ax, bx)) <= 0 && cmp(y, lo(ay, by)) >= 0 && cmp(y, hi(ay, by)) <= 0) return 0;
    if ((cmp(ay, y) > 0) !== (cmp(by, y) > 0)) {
      const xi = add(ax, div(mul(sub(bx, ax), sub(y, ay)), sub(by, ay)));
      if (cmp(x, xi) < 0) inside = !inside;
    }
  }
  return inside ? 1 : -1;
}
const RAYS: V[] = [[0.5773, 0.3419, 0.7413], [-0.2183, 0.8817, 0.4127], [0.6631, -0.5279, 0.3011], [-0.4421, -0.3137, 0.8401], [0.1931, 0.7349, -0.6503]].map(r => r.map(qf) as V);
const RAYS_F: Point[] = RAYS.map(vnum);
type Where = 'in' | 'out' | 'same' | 'opposite';
/**
 * Inside, outside, or on a coplanar face of `others` (same or opposite orientation), decided exactly. Faces
 * the point is clearly off (binary64 plane distance past the face's slack) skip the exact coplanar test, and
 * a ray skips the exact test of faces it clearly misses (its binary64 crossing point clearly outside the
 * face's box, or clearly behind the point); what remains is decided as before, in exact rationals.
 */
function classify(p: V, normal: V, others: PFace[]): Where {
  const pf = vnum(p), px = pf[0], py = pf[1], pz = pf[2], pr = Math.max(Math.abs(px), Math.abs(py), Math.abs(pz), 1);
  for (const g of others) {
    if (g.nf && Math.abs(g.nf[0] * px + g.nf[1] * py + g.nf[2] * pz - g.of!) > slack(g, pr)) continue;
    if (cmp(vdot(g.normal, p), g.offset) === 0 && pointInFace(g, p) > 0) return sgn(vdot(g.normal, normal)) > 0 ? 'same' : 'opposite';
  }
  for (let k = 0; k < RAYS.length; k++) {
    const r = RAYS[k], rf = RAYS_F[k];
    let crossings = 0, degenerate = false;
    for (const g of others) {
      const clear = g.nf ? crossing(g, px, py, pz, pr, rf) : 0;
      if (clear < 0) continue;
      if (clear > 0) { crossings++; continue; }
      const denom = vdot(g.normal, r), dist = sub(g.offset, vdot(g.normal, p));
      if (denom.n === 0n) { if (dist.n === 0n) { degenerate = true; break; } continue; }
      const t = div(dist, denom); if (sgn(t) <= 0) continue;
      const where = pointInFace(g, vadd(p, vscale(r, t)));
      if (where === 0) { degenerate = true; break; }
      if (where > 0) crossings++;
    }
    if (!degenerate) return crossings % 2 ? 'in' : 'out';
  }
  throw new BrepError('GEOMETRY', 'polyhedral Boolean: every classification ray was degenerate');
}
/**
 * Whether the ray p + t·r (t > 0) clearly misses face g (−1: crossing its plane clearly behind p, or clearly
 * outside the face) or clearly crosses it (1: the crossing point clearly inside, away from every edge), or
 * 0 when only the exact test can tell.
 */
function crossing(g: PFace, px: number, py: number, pz: number, pr: number, r: Point): number {
  const n = g.nf!, denom = n[0] * r[0] + n[1] * r[1] + n[2] * r[2], dist = g.of! - (n[0] * px + n[1] * py + n[2] * pz);
  // (A ray nearly in the plane, or a point nearly on it, is left to the exact test.)
  if (Math.abs(denom) < 1e-6 * g.nn! || Math.abs(dist) <= slack(g, pr)) return 0;
  const t = dist / denom;
  if (t < 0) return -1;
  const x = px + t * r[0], y = py + t * r[1], z = pz + t * r[2], m = 1e-7 * (1 + t) * Math.max(pr, g.reach!);
  if (x < g.min[0] - m || x > g.max[0] + m || y < g.min[1] - m || y > g.max[1] + m || z < g.min[2] - m || z > g.max[2] + m) return -1;
  // (The point's error is at most m in 3D, so at most m in the projection: a point farther than m from every
  // edge is on the side binary64 says.)
  const c = [x, y, z];
  return insideFlat(g, c[g.i], c[g.j], m);
}
/** 1 inside, −1 outside the face's projected rings, 0 within `m` of an edge. */
function insideFlat(g: PFace, x: number, y: number, m: number): number {
  if (!g.flat) g.flat = g.rings.map(ring => { const out = new Float64Array(2 * ring.length); ring.forEach((p, k) => { out[2 * k] = num(p[g.i]); out[2 * k + 1] = num(p[g.j]); }); return out; });
  let inside = false;
  for (const ring of g.flat) {
    const len = ring.length / 2;
    for (let k = 0; k < len; k++) {
      const ax = ring[2 * k], ay = ring[2 * k + 1], b = (k + 1) % len, bx = ring[2 * b], by = ring[2 * b + 1];
      const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey, s = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0;
      if (Math.hypot(x - ax - s * ex, y - ay - s * ey) <= m) return 0;
      if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
    }
  }
  return inside ? 1 : -1;
}

/** A + B, A ∩ B or A − B for B-reps with planar faces and straight edges. */
export function booleanPolyhedra(a: Brep, b: Brep, operation: PolyhedralBooleanOperation, options: { readonly id?: string } = {}): Brep {
  const A = facesOf(a, 0), B = facesOf(b, 1);
  // 1. Cuts.
  // (Pairs whose boxes meet, found through B's faces sorted by their lowest x; each A face's partners are
  // then taken in B's order, so the cuts come in the order they always did.)
  const byLowX = B.map((_, k) => k).sort((x, y) => B[x].min[0] - B[y].min[0]), lowX = Float64Array.from(byLowX, k => B[k].min[0]);
  let widest = 0; for (const f of B) widest = Math.max(widest, f.max[0] - f.min[0]);
  const partners: number[] = [];
  for (const fa of A) {
    partners.length = 0;
    for (let at = lowerBound(lowX, fa.min[0] - widest - 1e-9 * (1 + Math.abs(fa.min[0]) + widest)); at < byLowX.length && lowX[at] <= fa.max[0] + 1e-9 * (1 + Math.abs(fa.max[0])); at++) if (near(fa, B[byLowX[at]])) partners.push(byLowX[at]);
    partners.sort((x, y) => x - y);
    for (const k of partners) cutPair(fa, B[k]);
  }
  // 2–3. Pieces and their classes.
  type Piece = { face: PFace; loops: V[][]; where: Where };
  const pieces: Piece[] = [];
  for (const f of [...A, ...B]) {
    const rings = f.rings.map(r => ({ polygon: 0, ring: r.map(p => to2(f, p)) }));
    const regions = arrangementRegions(rings, f.cuts.map(([p, r]) => [to2(f, p), to2(f, r)] as const), 1).filter(rg => rg.winding[0] !== 0);
    for (const rg of regions) {
      const outer = rg.outer.map(exactToXY), holes = rg.holes.map(h => h.map(exactToXY)), all = [...rg.outer, ...rg.holes.flat()];
      const tris = triangulatePolygonWithHoles(outer, holes);
      // (A region of no area — a sliver where cuts meet at a corner — makes no face.)
      if (!tris.length) continue;
      const big = tris.reduce((best, t) => { const ar = (u: [number, number, number]) => { const [p0, p1, p2] = u.map(k => exactToXY(all[k])); return Math.abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0])); }; return ar(t) > ar(best) ? t : best; }, tris[0]);
      const c = big.map(k => fromH(all[k])), third: Q = { n: 1n, d: 3n };
      const interior = lift(f, mul(add(add(c[0][0], c[1][0]), c[2][0]), third), mul(add(add(c[0][1], c[1][1]), c[2][1]), third));
      const where = classify(interior, f.normal, f.solid === 0 ? B : A);
      const back = (ring: readonly ExactPoint2[]) => ring.map(p => { const [x, y] = fromH(p); return lift(f, x, y); });
      pieces.push({ face: f, loops: [back(rg.outer), ...rg.holes.map(back)], where });
    }
  }
  // 4. Keep, flip, stitch.
  const keep = (p: Piece): 'keep' | 'flip' | null => {
    const fromA = p.face.solid === 0, w = p.where;
    if (operation === 'union') return w === 'out' || (w === 'same' && fromA) ? 'keep' : null;
    if (operation === 'intersection') return w === 'in' || (w === 'same' && fromA) ? 'keep' : null;
    if (fromA) return w === 'out' || w === 'opposite' ? 'keep' : null;
    return w === 'in' ? 'flip' : null;
  };
  const kept = pieces.flatMap(p => { const k = keep(p); return k ? [{ ...p, name: p.face.name, loops: k === 'flip' ? p.loops.map(l => [...l].reverse()) : p.loops, normal: k === 'flip' ? vscale(p.face.normal, { n: -1n, d: 1n }) : p.face.normal }] : []; });
  const result = stitch(kept, options.id ?? `boolean-${operation}`), report = checkBrep(result);
  // Solids that touch only along an edge or at a vertex give a non-manifold result; refuse it plainly.
  if (!report.valid) throw new BrepError('TOPOLOGY', `polyhedral Boolean: the result is not a manifold solid (the inputs touch along an edge or at a vertex): ${report.issues[0]}`, report);
  return result;
}

function stitch(faces: { loops: V[][]; normal: V; name?: string }[], id: string): Brep {
  // Global vertices; split every loop edge at the vertices lying on it (T-junctions between pieces).
  const vertex = new Map<string, V>();
  for (const f of faces) for (const l of f.loops) for (const p of l) vertex.set(vkey(p), p);
  // (Vertices sorted by x: an edge looks only at those within its x range, then its box, then exactly.)
  const all = [...vertex.values()], nums = new Map(all.map(p => [vkey(p), vnum(p)]));
  const byX = all.map(p => ({ p, k: vkey(p), n: nums.get(vkey(p))! })).sort((a, b) => a.n[0] - b.n[0]), xs = Float64Array.from(byX, v => v.n[0]);
  const split = (l: V[]): V[] => l.flatMap((p, k) => {
    const r = l[(k + 1) % l.length], pk = vkey(p), rk = vkey(r), pn = nums.get(pk)!, rn = nums.get(rk)!;
    let d: V | null = null, dd: Q = ZERO;
    const lo = [0, 1, 2].map(i => Math.min(pn[i], rn[i]) - 1e-9 * (1 + Math.abs(pn[i]) + Math.abs(rn[i]))), hi = [0, 1, 2].map(i => Math.max(pn[i], rn[i]) + 1e-9 * (1 + Math.abs(pn[i]) + Math.abs(rn[i])));
    const inner: V[] = [];
    for (let at = lowerBound(xs, lo[0]); at < xs.length && xs[at] <= hi[0]; at++) {
      const { p: v, n: vn, k: vk } = byX[at];
      if (vk === pk || vk === rk || vn[1] < lo[1] || vn[1] > hi[1] || vn[2] < lo[2] || vn[2] > hi[2] || offLine(pn, rn, vn)) continue;
      if (!d) { d = vsub(r, p); dd = vdot(d, d); }
      const w = vsub(v, p); if (!vzero(vcross(d, w))) continue;
      const t = div(vdot(w, d), dd); if (sgn(t) > 0 && cmp(t, { n: 1n, d: 1n }) < 0) inner.push(v);
    }
    if (!inner.length) return [p];
    const along = d!;
    inner.sort((u, v) => cmp(vdot(vsub(u, p), along), vdot(vsub(v, p), along)));
    return [p, ...inner];
  });
  const loopsOf = faces.map(f => f.loops.map(split));
  // Edges by unordered vertex pair; shells by edge connectivity.
  const edgeIds = new Map<string, { id: string; v: [string, string] }>();
  const vertexIds = new Map([...vertex.keys()].map((k, i) => [k, 'v' + i]));
  const edgeOf = (p: V, r: V) => {
    const a = vertexIds.get(vkey(p))!, b = vertexIds.get(vkey(r))!, k = a < b ? a + '|' + b : b + '|' + a;
    let e = edgeIds.get(k); if (!e) { e = { id: 'e' + edgeIds.size, v: a < b ? [a, b] : [b, a] }; edgeIds.set(k, e); }
    return { edge: e.id, sense: (e.v[0] === a ? 'forward' : 'reversed') as 'forward' | 'reversed' };
  };
  const faceUses = loopsOf.map(ls => ls.map(l => l.map((p, k) => edgeOf(p, l[(k + 1) % l.length]))));
  const parent = faces.map((_, i) => i), find = (x: number): number => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
  const faceOfEdge = new Map<string, number>();
  faceUses.forEach((ls, fi) => ls.flat().forEach(u => { const o = faceOfEdge.get(u.edge); if (o === undefined) faceOfEdge.set(u.edge, fi); else parent[find(o)] = find(fi); }));
  const shells = new Map<number, number[]>(); faces.forEach((_, i) => { const r = find(i), list = shells.get(r); if (list) list.push(i); else shells.set(r, [i]); });
  // Signed volume per shell (divergence theorem over the loops' fan triangles).
  const volume = (members: number[]) => members.reduce((s, fi) => s + loopsOf[fi].reduce((t, l) => {
    const p = l.map(vnum); let v = 0; for (let k = 1; k + 1 < p.length; k++) { const [a, b, c] = [p[0], p[k], p[k + 1]]; v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; }
    return t + v; }, 0), 0);
  const groups = [...shells.values()].map(m => ({ members: m, volume: volume(m) }));
  const outers = groups.filter(g => g.volume > 0), cavities = groups.filter(g => g.volume <= 0);
  const bodies = outers.map((o, k) => ({ id: `${id}_body${k}`, outer: o, cavities: [] as typeof groups }));
  for (const c of cavities) {
    // The cavity belongs to the smallest outer shell containing one of its vertices.
    const p = loopsOf[c.members[0]][0][0];
    let best = -1, bestVolume = Infinity;
    bodies.forEach((bd, k) => {
      const shellFaces: PFace[] = bd.outer.members.map(fi => ({ solid: 0, rings: loopsOf[fi], normal: faces[fi].normal, offset: vdot(faces[fi].normal, loopsOf[fi][0][0]), ...frame(faces[fi].normal), min: [-Infinity, -Infinity, -Infinity], max: [Infinity, Infinity, Infinity], cuts: [], coplanar: [] }));
      if (classify(p, [ZERO, ZERO, { n: 1n, d: 1n }], shellFaces) === 'in' && bd.outer.volume < bestVolume) { bestVolume = bd.outer.volume; best = k; }
    });
    if (best < 0) throw new BrepError('TOPOLOGY', 'polyhedral Boolean: a cavity lies in no outer shell');
    bodies[best].cavities.push(c);
  }
  const points = new Map([...vertex.entries()].map(([k, p]) => [vertexIds.get(k)!, vnum(p)]));
  // Names: the piece's face name (numbered by position when repeated), edges by their two faces.
  const centre = (fi: number): Point => { const p = loopsOf[fi][0].map(vnum), n = p.length; return [0, 1, 2].map(k => p.reduce((s, x) => s + x[k], 0) / n) as Point; };
  const faceNames: string[] = [], counts = new Map<string, number[]>();
  faces.forEach((f, fi) => { const b = f.name ?? `${id}.face`, list = counts.get(b); if (list) list.push(fi); else counts.set(b, [fi]); });
  for (const [b, list] of counts) {
    if (list.length === 1) { faceNames[list[0]] = b; continue; }
    const keyed = list.map(fi => ({ fi, c: centre(fi) })).sort((x, y) => x.c[0] - y.c[0] || x.c[1] - y.c[1] || x.c[2] - y.c[2]);
    keyed.forEach(({ fi }, k) => { faceNames[fi] = `${b}#${k + 1}`; });
  }
  const facesOfEdge = new Map<string, number[]>();
  faceUses.forEach((ls, fi) => ls.flat().forEach(u => { const list = facesOfEdge.get(u.edge); if (list) list.push(fi); else facesOfEdge.set(u.edge, [fi]); }));
  const edgeList = [...edgeIds.values()].map(e => ({ id: e.id, curve: lineCurve(e.id, points.get(e.v[0])!, points.get(e.v[1])!), vertices: e.v, name: [...new Set((facesOfEdge.get(e.id) ?? []).map(fi => faceNames[fi]))].sort().join('|') }));
  nameEdges(edgeList);
  return buildBrep({ source: { family: 'polyhedral-boolean', id },
    vertices: [...points.entries()].map(([vid2, p]) => ({ id: vid2, point: p })),
    edges: edgeList,
    bodies: bodies.map(bd => ({ id: bd.id, kind: 'solid' as const, shells: [bd.outer, ...bd.cavities].map((g, si) => ({ id: 's' + si, closed: true,
      faces: g.members.map(fi => ({ id: 'f' + fi, name: faceNames[fi], surface: planeSurface('p' + fi, faces[fi].normal, loopsOf[fi].flat().map(vnum)), sense: 'forward' as const,
        loops: faceUses[fi].map((uses, li) => ({ kind: li === 0 ? 'outer' as const : 'inner' as const, uses })) })) })) })) });
}
/** The cuts faces fa and fb make in each other: along their planes' line, or along each other's edges when coplanar. */
function cutPair(fa: PFace, fb: PFace): void {
  const D = vcross(fa.normal, fb.normal);
  if (vzero(D)) {
    if (cmp(mul(fa.offset, fb.normal[fa.axis]), mul(fb.offset, fa.normal[fa.axis])) !== 0) return; // parallel, apart
    for (const r of fb.rings) r.forEach((p, k) => fa.cuts.push([p, r[(k + 1) % r.length]]));
    for (const r of fa.rings) r.forEach((p, k) => fb.cuts.push([p, r[(k + 1) % r.length]]));
    return;
  }
  // A point on both planes: solve Na·x = da, Nb·x = db, D·x = 0 (Cramer).
  const det = vdot(D, D), P0 = vscale(vadd(vscale(vcross(fb.normal, D), fa.offset), vscale(vcross(D, fa.normal), fb.offset)), div({ n: 1n, d: 1n }, det));
  for (const [lo, hi] of overlap(intervals(fa, P0, D), intervals(fb, P0, D))) {
    const s: [V, V] = [vadd(P0, vscale(D, lo)), vadd(P0, vscale(D, hi))]; fa.cuts.push(s); fb.cuts.push(s);
  }
}
/** Whether the boxes of two faces meet (with a relative margin). */
function near(f: PFace, g: PFace): boolean {
  for (let k = 0; k < 3; k++) if (f.min[k] > g.max[k] + 1e-9 * (1 + Math.abs(g.max[k])) || g.min[k] > f.max[k] + 1e-9 * (1 + Math.abs(f.max[k]))) return false;
  return true;
}
/** Whether v is clearly off the line through p and r (binary64 distance far past rounding). */
function offLine(p: Point, r: Point, v: Point): boolean {
  const dx = r[0] - p[0], dy = r[1] - p[1], dz = r[2] - p[2], wx = v[0] - p[0], wy = v[1] - p[1], wz = v[2] - p[2];
  const cx = dy * wz - dz * wy, cy = dz * wx - dx * wz, cz = dx * wy - dy * wx, scale = Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]), Math.abs(r[0]), Math.abs(r[1]), Math.abs(r[2]), Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]), 1);
  return Math.hypot(cx, cy, cz) > 1e-9 * scale * scale;
}
/** The first index whose value is at least x, in an ascending array. */
function lowerBound(a: Float64Array, x: number): number {
  let lo = 0, hi = a.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid] < x) lo = mid + 1; else hi = mid; }
  return lo;
}
function frame(normal: V): { axis: 0 | 1 | 2; i: 0 | 1 | 2; j: 0 | 1 | 2 } {
  const mag = normal.map(x => Math.abs(num(x))), axis = (mag[0] >= mag[1] && mag[0] >= mag[2] ? 0 : mag[1] >= mag[2] ? 1 : 2) as 0 | 1 | 2;
  let i = ((axis + 1) % 3) as 0 | 1 | 2, j = ((axis + 2) % 3) as 0 | 1 | 2; if (sgn(normal[axis]) < 0) [i, j] = [j, i];
  return { axis, i, j };
}
/** A planar patch through the points whose ∂S/∂u × ∂S/∂v points along `normal`. */
function planeSurface(id: string, normal: V, points: Point[]): Surface {
  const n = vnum(normal), ln = Math.hypot(...n), nz: Point = [n[0] / ln, n[1] / ln, n[2] / ln];
  const seed: Point = Math.abs(nz[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const c1: Point = [nz[1] * seed[2] - nz[2] * seed[1], nz[2] * seed[0] - nz[0] * seed[2], nz[0] * seed[1] - nz[1] * seed[0]], l1 = Math.hypot(...c1);
  const e1: Point = [c1[0] / l1, c1[1] / l1, c1[2] / l1], e2: Point = [nz[1] * e1[2] - nz[2] * e1[1], nz[2] * e1[0] - nz[0] * e1[2], nz[0] * e1[1] - nz[1] * e1[0]];
  const o = points[0], uv = points.map(p => { const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; return [d[0] * e1[0] + d[1] * e1[1] + d[2] * e1[2], d[0] * e2[0] + d[1] * e2[1] + d[2] * e2[2]]; });
  const u0 = Math.min(...uv.map(x => x[0])), u1 = Math.max(...uv.map(x => x[0])), v0 = Math.min(...uv.map(x => x[1])), v1 = Math.max(...uv.map(x => x[1]));
  const at = (u: number, v: number): Point => [o[0] + e1[0] * u + e2[0] * v, o[1] + e1[1] * u + e2[1] * v, o[2] + e1[2] * u + e2[2] * v];
  return { kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[at(u0, v0), at(u0, v1)], [at(u1, v0), at(u1, v1)]], weights: [[1, 1], [1, 1]] };
}
