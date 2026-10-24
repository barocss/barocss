// Exact planar arrangement of line segments and Boolean operations on polygons with holes
// (brep-core step 3). Touching, shared edges, T-junctions and collinear overlaps are ordinary cases,
// not refusals.
//
//   1. every pair of ring segments is intersected exactly (crossing, endpoint-on-segment, overlap)
//   2. segments split at those points; duplicates (overlaps) merge into one edge that remembers every
//      input segment lying on it, with direction
//   3. half-edges sorted by exact angle around each vertex; faces traced (face on the left)
//   4. inside / outside of every input polygon by winding propagation from the unbounded face —
//      crossing an edge adds the signed count of that polygon's segments on it; no point tests
//   5. Boolean = a predicate over the windings; the boundary between selected and unselected faces
//      is traced back into polygons with holes
//
// Points are homogeneous integers (x, y, w), w > 0. Every point is either an input binary64 point or
// the intersection of two input segments, so bit sizes stay bounded and every predicate is exact.
import { binary64Dyadic } from '../core/dyadic.js';
import { isFrom, kernelRefusal, type KernelError } from '../core/barocss-error.js';

export type XY = [number, number];
export interface PolygonWithHoles { readonly outer: readonly XY[]; readonly holes: readonly (readonly XY[])[] }
export type PlanarBooleanOperation = 'union' | 'intersection' | 'difference' | 'xor';
/** This module's refusal (R7.3a batch 2: the PlanarArrangementError class folded, D279): a BarocssError, `details.source` 'planar-arrangement'. */
export const planarArrangementError = (detail: string) => kernelRefusal('planar-arrangement', 'PLANAR_ARRANGEMENT', 'Planar arrangement: ' + detail) as KernelError & { readonly code: 'PLANAR_ARRANGEMENT' };
/** Whether something thrown is this module's refusal. */
export const isPlanarArrangementError = (e: unknown): e is KernelError & { readonly code: 'PLANAR_ARRANGEMENT' } => isFrom<'PLANAR_ARRANGEMENT'>(e, 'planar-arrangement');

type H = { x: bigint; y: bigint; w: bigint };
const abs = (a: bigint) => a < 0n ? -a : a;
const gcd = (a: bigint, b: bigint): bigint => { a = abs(a); b = abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
function normal(p: H): H { if (p.w < 0n) p = { x: -p.x, y: -p.y, w: -p.w }; const g = gcd(gcd(p.x, p.y), p.w) || 1n; return { x: p.x / g, y: p.y / g, w: p.w / g }; }
/** An exact binary64 as n / 2^k. */
function dyadic(v: number): [bigint, number] {
  if (!Number.isFinite(v)) throw planarArrangementError('finite coordinates required');
  const { m, k } = binary64Dyadic(v); return [m, k];
}
function fromXY([x, y]: XY): H { const [nx, kx] = dyadic(x), [ny, ky] = dyadic(y), k = Math.max(kx, ky); return normal({ x: nx << BigInt(k - kx), y: ny << BigInt(k - ky), w: 1n << BigInt(k) }); }
const key = (p: H) => `${p.x}/${p.y}/${p.w}`;
const same = (a: H, b: H) => a.x * b.w === b.x * a.w && a.y * b.w === b.y * a.w;
/** Sign of the orientation of (a, b, c): > 0 counter-clockwise. */
function orient(a: H, b: H, c: H): number {
  const d = a.x * (b.y * c.w - c.y * b.w) - a.y * (b.x * c.w - c.x * b.w) + a.w * (b.x * c.y - c.x * b.y);
  return d > 0n ? 1 : d < 0n ? -1 : 0;
}
/** Direction b − a as integers (scaled by the positive a.w · b.w). */
const dir = (a: H, b: H): [bigint, bigint] => [b.x * a.w - a.x * b.w, b.y * a.w - a.y * b.w];
/** Signed position of p along a → b (a scalar proportional to the parameter, with a positive common scale). */
function along(a: H, b: H, p: H): { n: bigint; d: bigint } {
  const [dx, dy] = dir(a, b), [px, py] = dir(a, p); return { n: px * dx + py * dy, d: a.w * p.w };
}
const lessAlong = (a: H, b: H, p: H, q: H) => { const s = along(a, b, p), t = along(a, b, q); return s.n * t.d < t.n * s.d; };
/** p strictly between a and b, all three collinear. */
function strictlyInside(a: H, b: H, p: H): boolean {
  const s = along(a, b, p), [dx, dy] = dir(a, b), len = { n: dx * dx + dy * dy, d: a.w * b.w };
  return s.n > 0n && s.n * len.d < len.n * s.d;
}
function cross(a: H, b: H, c: H, d: H): H {
  // Lines through (a, b) and (c, d) as homogeneous cross products; their intersection likewise.
  const l1 = { x: a.y * b.w - a.w * b.y, y: a.w * b.x - a.x * b.w, w: a.x * b.y - a.y * b.x };
  const l2 = { x: c.y * d.w - c.w * d.y, y: c.w * d.x - c.x * d.w, w: c.x * d.y - c.y * d.x };
  return normal({ x: l1.y * l2.w - l1.w * l2.y, y: l1.w * l2.x - l1.x * l2.w, w: l1.x * l2.y - l1.y * l2.x });
}
const toXY = (p: H): XY => [Number(p.x) / Number(p.w), Number(p.y) / Number(p.w)];
/** Half-plane-then-cross comparison of direction angles (counter-clockwise from +x). */
function angleLess(u: [bigint, bigint], v: [bigint, bigint]): boolean {
  const half = (d: [bigint, bigint]) => (d[1] > 0n || (d[1] === 0n && d[0] > 0n)) ? 0 : 1, hu = half(u), hv = half(v);
  if (hu !== hv) return hu < hv;
  return u[0] * v[1] - u[1] * v[0] > 0n;
}

interface Seg { a: H; b: H; polygon: number }
interface Edge { u: number; v: number; count: Map<number, number> } // signed count of each polygon's segments running u → v
interface HalfEdge { from: number; to: number; edge: number; twin: number; next: number; face: number }

/** The arrangement of the rings of several polygons (polygon index = position in `polygons`). */
function arrange(polygons: readonly PolygonWithHoles[]) {
  const segs: Seg[] = [];
  polygons.forEach((poly, pi) => {
    const signed = (ring: readonly XY[]) => ring.reduce((s, p, i) => s + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1], 0);
    // Normalise: outer counter-clockwise, holes clockwise, so the winding inside is exactly 1.
    const rings = [[...poly.outer], ...poly.holes.map(h => [...h])].map((ring, ri) => (ri === 0) === (signed(ring) > 0) ? ring : ring.reverse());
    for (const ring of rings) {
      if (ring.length < 3) throw planarArrangementError('rings need three points');
      const hs = ring.map(fromXY);
      hs.forEach((a, i) => { const b = hs[(i + 1) % hs.length]; if (!same(a, b)) segs.push({ a, b, polygon: pi }); });
    }
  });
  return arrangeSegments(segs, polygons.length);
}

/** The core arrangement. Segments of polygon −1 split faces without changing any winding (cuts). */
function arrangeSegments(segs: Seg[], polygonCount: number) {
  // 1. Split points per segment.
  const cuts = segs.map(() => [] as H[]);
  const box = (s: Seg) => { const [ax, ay] = toXY(s.a), [bx, by] = toXY(s.b); return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]; };
  const boxes = segs.map(box);
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [a0, a1, a2, a3] = boxes[i], [b0, b1, b2, b3] = boxes[j];
    if (a2 < b0 - 1e-9 * (1 + Math.abs(b0)) || b2 < a0 - 1e-9 * (1 + Math.abs(a0)) || a3 < b1 - 1e-9 * (1 + Math.abs(b1)) || b3 < a1 - 1e-9 * (1 + Math.abs(a1))) continue;
    const s = segs[i], t = segs[j];
    const o1 = orient(s.a, s.b, t.a), o2 = orient(s.a, s.b, t.b), o3 = orient(t.a, t.b, s.a), o4 = orient(t.a, t.b, s.b);
    if (o1 * o2 < 0 && o3 * o4 < 0) { const x = cross(s.a, s.b, t.a, t.b); cuts[i].push(x); cuts[j].push(x); continue; }
    if (o1 === 0 && strictlyInside(s.a, s.b, t.a)) cuts[i].push(t.a);
    if (o2 === 0 && strictlyInside(s.a, s.b, t.b)) cuts[i].push(t.b);
    if (o3 === 0 && strictlyInside(t.a, t.b, s.a)) cuts[j].push(s.a);
    if (o4 === 0 && strictlyInside(t.a, t.b, s.b)) cuts[j].push(s.b);
  }
  // 2. Sub-edges, merged by endpoints.
  const vertexOf = new Map<string, number>(), points: H[] = [];
  const vid = (p: H) => { const k = key(p); let v = vertexOf.get(k); if (v === undefined) { v = points.length; points.push(p); vertexOf.set(k, v); } return v; };
  const edgeOf = new Map<string, number>(), edges: Edge[] = [];
  segs.forEach((s, i) => {
    const pts = [s.a, ...cuts[i].filter((p, k, all) => all.findIndex(q => same(p, q)) === k).sort((p, q) => lessAlong(s.a, s.b, p, q) ? -1 : lessAlong(s.a, s.b, q, p) ? 1 : 0), s.b];
    for (let k = 0; k + 1 < pts.length; k++) {
      const u = vid(pts[k]), v = vid(pts[k + 1]); if (u === v) continue;
      const lo = Math.min(u, v), hi = Math.max(u, v), ek = lo + ':' + hi;
      let e = edgeOf.get(ek); if (e === undefined) { e = edges.length; edges.push({ u: lo, v: hi, count: new Map() }); edgeOf.set(ek, e); }
      if (s.polygon >= 0) { const c = edges[e].count; c.set(s.polygon, (c.get(s.polygon) ?? 0) + (u === lo ? 1 : -1)); }
    }
  });
  // 3. Half-edges around vertices, faces on the left.
  const half: HalfEdge[] = [];
  edges.forEach((e, i) => { half.push({ from: e.u, to: e.v, edge: i, twin: 2 * i + 1, next: -1, face: -1 }, { from: e.v, to: e.u, edge: i, twin: 2 * i, next: -1, face: -1 }); });
  const outgoing = points.map(() => [] as number[]);
  half.forEach((h, i) => outgoing[h.from].push(i));
  outgoing.forEach((list, v) => list.sort((a, b) => { const da = dir(points[v], points[half[a].to]), db = dir(points[v], points[half[b].to]); return angleLess(da, db) ? -1 : angleLess(db, da) ? 1 : 0; }));
  const position = new Map<number, number>(); outgoing.forEach(list => list.forEach((h, k) => position.set(h, k)));
  for (const [i, h] of half.entries()) {
    // next = the outgoing edge at `to` just clockwise of the twin.
    const list = outgoing[h.to], k = position.get(h.twin)!; h.next = list[(k - 1 + list.length) % list.length]; void i;
  }
  const cycles: number[][] = [];
  half.forEach((h, i) => { if (h.face >= 0) return; const c: number[] = []; let g = i; do { half[g].face = cycles.length; c.push(g); g = half[g].next; } while (g !== i && c.length <= half.length); cycles.push(c); });
  return { points, edges, half, cycles, polygons: polygonCount };
}

/** Exact orientation of a cycle: at its lowest-then-leftmost vertex (weakly simple cycles). */
function cycleSign(points: readonly H[], half: readonly HalfEdge[], cycle: readonly number[]): number {
  let best = 0;
  for (let k = 1; k < cycle.length; k++) {
    const p = points[half[cycle[k]].from], q = points[half[cycle[best]].from];
    if (p.y * q.w < q.y * p.w || (p.y * q.w === q.y * p.w && p.x * q.w < q.x * p.w)) best = k;
  }
  const prev = points[half[cycle[(best - 1 + cycle.length) % cycle.length]].from], v = points[half[cycle[best]].from], next = points[half[cycle[best]].to];
  const s = orient(prev, v, next);
  if (s !== 0) return s;
  return cycle.reduce((a, h) => { const p = toXY(points[half[h].from]), q = toXY(points[half[h].to]); return a + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1;
}
/** Exact point-in-cycle parity (the point is not on the cycle). */
function insideCycle(points: readonly H[], half: readonly HalfEdge[], cycle: readonly number[], p: H): boolean {
  let c = false;
  for (const h of cycle) {
    const a = points[half[h].from], b = points[half[h].to], ay = a.y * p.w > p.y * a.w, by = b.y * p.w > p.y * b.w;
    if (ay === by) continue;
    const o = orient(a, b, p); if ((by ? o > 0 : o < 0)) c = !c;
  }
  return c;
}

/**
 * Faces of the arrangement with the winding of every input polygon, and the half-edges grouped by face.
 * Face −1 is the unbounded face.
 */
function facesWithWindings(arr: ReturnType<typeof arrange>) {
  const { points, half, cycles, edges } = arr, area = (cycle: number[]) => Math.abs(cycle.reduce((a, h) => { const p = toXY(points[half[h].from]), q = toXY(points[half[h].to]); return a + p[0] * q[1] - q[0] * p[1]; }, 0));
  const signs = cycles.map(c => cycleSign(points, half, c));
  const outers = cycles.map((c, i) => signs[i] > 0 ? i : -1).filter(i => i >= 0);
  // Each cycle belongs to a face: positive cycles are face boundaries; a negative cycle is a hole of the
  // smallest positive cycle containing it, or of the unbounded face.
  // Containment is only asked across connected components, which share no vertex.
  const root = points.map((_, i) => i), find = (v: number): number => { while (root[v] !== v) v = root[v] = root[root[v]]; return v; };
  for (const e of edges) root[find(e.u)] = find(e.v);
  const componentOf = (cycle: number[]) => find(half[cycle[0]].from);
  const faceOfCycle = cycles.map((c, i) => {
    if (signs[i] > 0) return i;
    const p = points[half[c[0]].from], mine = componentOf(c);
    let best = -1, bestArea = Infinity;
    for (const o of outers) if (componentOf(cycles[o]) !== mine && insideCycle(points, half, cycles[o], p)) { const a = area(cycles[o]); if (a < bestArea) { bestArea = a; best = o; } }
    return best;
  });
  const faceOfHalf = half.map(h => faceOfCycle[h.face]);
  // Windings by propagation from the unbounded face (all zero).
  const winding = new Map<number, number[]>([[-1, Array(arr.polygons).fill(0)]]), queue = [-1];
  const halvesOfFace = new Map<number, number[]>();
  faceOfHalf.forEach((f, h) => halvesOfFace.set(f, [...(halvesOfFace.get(f) ?? []), h]));
  while (queue.length) {
    const f = queue.shift()!, w = winding.get(f)!;
    for (const h of halvesOfFace.get(f) ?? []) {
      const other = faceOfHalf[half[h].twin]; if (winding.has(other)) continue;
      // f is left of h; `other` is right of h. Left = right + count(h direction) ⇒ right = left − count.
      const e = edges[half[h].edge], forward = half[h].from === e.u;
      winding.set(other, w.map((x, p) => x - (e.count.get(p) ?? 0) * (forward ? 1 : -1))); queue.push(other);
    }
  }
  return { faceOfHalf, winding };
}

/** Boolean of two sets of polygons with holes. The result's outer rings are counter-clockwise, holes clockwise. */
export function booleanPolygons(a: readonly PolygonWithHoles[], b: readonly PolygonWithHoles[], operation: PlanarBooleanOperation): PolygonWithHoles[] {
  const all = [...a, ...b], arr = arrange(all), { faceOfHalf, winding } = facesWithWindings(arr), { points, half } = arr;
  const inA = (w: number[]) => w.slice(0, a.length).some(x => x !== 0), inB = (w: number[]) => w.slice(a.length).some(x => x !== 0);
  const pick = (f: number) => { const w = winding.get(f); if (!w || f === -1) return false; const x = inA(w), y = inB(w);
    return operation === 'union' ? x || y : operation === 'intersection' ? x && y : operation === 'difference' ? x && !y : x !== y; };
  const selected = new Map<number, boolean>(); for (const f of winding.keys()) selected.set(f, pick(f));
  const boundary = (h: number) => selected.get(faceOfHalf[h])! && !selected.get(faceOfHalf[half[h].twin])!;
  // Trace boundary cycles; at each vertex turn into the merged selected region.
  const used = new Set<number>(), rings: number[][] = [];
  half.forEach((_, h) => {
    if (!boundary(h) || used.has(h)) return;
    const ring: number[] = []; let g = h;
    do {
      used.add(g); ring.push(g);
      let n = half[g].next; while (!boundary(n)) n = half[half[n].twin].next;
      g = n;
    } while (g !== h && ring.length <= half.length);
    rings.push(ring);
  });
  // Drop collinear interior vertices, keep exact points.
  const simplify = (ring: number[]): H[] => {
    const pts = ring.map(h => points[half[h].from]);
    return pts.filter((p, i) => orient(pts[(i - 1 + pts.length) % pts.length], p, pts[(i + 1) % pts.length]) !== 0);
  };
  const outerRings: number[][] = [], holeRings: number[][] = [];
  for (const r of rings) (cycleSign(points, half, r) > 0 ? outerRings : holeRings).push(r);
  const result = outerRings.map(o => ({ ring: o, holes: [] as number[][] }));
  for (const hr of holeRings) {
    let best = -1, bestArea = Infinity;
    result.forEach((o, i) => {
      // Test with a hole vertex that is not on this outer ring (rings may touch at a vertex).
      const onRing = new Set(o.ring.map(h => half[h].from)), free = hr.map(h => half[h].from).find(v => !onRing.has(v));
      if (free === undefined) return;
      if (insideCycle(points, half, o.ring, points[free])) { const ar = Math.abs(o.ring.reduce((s, h) => { const u = toXY(points[half[h].from]), v = toXY(points[half[h].to]); return s + u[0] * v[1] - v[0] * u[1]; }, 0)); if (ar < bestArea) { bestArea = ar; best = i; } } });
    if (best < 0) throw planarArrangementError('a result hole has no enclosing ring');
    result[best].holes.push(hr);
  }
  return result.map(o => ({ outer: simplify(o.ring).map(toXY), holes: o.holes.map(h => simplify(h).map(toXY)) }));
}

/** Arrangement statistics (vertices, edges, bounded faces) for diagnostics and tests. */
export function planarArrangementCounts(polygons: readonly PolygonWithHoles[]): { vertices: number; edges: number; boundedFaces: number } {
  const arr = arrange(polygons), { winding } = facesWithWindings(arr);
  return { vertices: arr.points.length, edges: arr.edges.length, boundedFaces: winding.size - 1 };
}

// ---- Exact entry point for B-rep face splitting (polyhedral Booleans) ----------------------------
export type ExactPoint2 = H;
/** An exact rational point (xn / xd, yn / yd), denominators nonzero. */
export function exactPoint2(xn: bigint, xd: bigint, yn: bigint, yd: bigint): ExactPoint2 { return normal({ x: xn * yd, y: yn * xd, w: xd * yd }); }
export const exactPoint2FromXY = fromXY;
export const exactOrient2 = orient;
export const exactSame2 = same;
export const exactToXY = toXY;
export interface ExactRegion { readonly outer: readonly ExactPoint2[]; readonly holes: readonly (readonly ExactPoint2[])[]; readonly winding: readonly number[] }
/**
 * Bounded faces of the arrangement of exact rings (each tagged with a polygon index; outer rings
 * counter-clockwise, holes clockwise) and extra cut segments, with every polygon's winding.
 */
export function arrangementRegions(rings: readonly { readonly polygon: number; readonly ring: readonly ExactPoint2[] }[], cuts: readonly (readonly [ExactPoint2, ExactPoint2])[], polygonCount: number): ExactRegion[] {
  const segs: Seg[] = [];
  for (const { polygon, ring } of rings) ring.forEach((a, i) => { const b = ring[(i + 1) % ring.length]; if (!same(a, b)) segs.push({ a, b, polygon }); });
  for (const [a, b] of cuts) if (!same(a, b)) segs.push({ a, b, polygon: -1 });
  const arr = arrangeSegments(segs, polygonCount), { faceOfHalf, winding } = facesWithWindings(arr), { points, half, cycles } = arr;
  const holes = new Map<number, number[][]>();
  cycles.forEach((c, i) => { const f = faceOfHalf[c[0]]; if (f !== i && f >= 0) holes.set(f, [...(holes.get(f) ?? []), c]); });
  const out: ExactRegion[] = [];
  for (const [f, w] of winding) {
    if (f < 0) continue;
    out.push({ outer: cycles[f].map(h => points[half[h].from]), holes: (holes.get(f) ?? []).map(c => c.map(h => points[half[h].from])), winding: w });
  }
  return out;
}
