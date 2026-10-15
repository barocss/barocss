// Planar arrangement of line segments and circular arcs, and Booleans of the regions they bound
// (brep-core step 5). Circle intersections are irrational, so this one works in binary64 with a
// scale-relative tolerance: points within it are one vertex, and tangency is resolved by curvature.
// The structure matches the exact line arrangement (step 3): split, merge coincident pieces with
// their signed per-polygon counts, sort half-edges by tangent (then curvature) around vertices,
// trace faces, propagate windings from the unbounded face, select, trace boundaries.
//
// Tolerance: eps = CadNumericPolicy linear tolerance at the input scale. Points within eps are one
// vertex. Two carriers whose gap stays within eps across their near-touch are tangent: one vertex.
import { linearToleranceMM } from './numeric-policy.js';

export type XY = [number, number];
/** A line from a to b, or an arc about c with radius r from angle t0 through the signed sweep. */
export type CurveSegment2 =
  | { readonly kind: 'line'; readonly a: XY; readonly b: XY }
  | { readonly kind: 'arc'; readonly c: XY; readonly r: number; readonly t0: number; readonly sweep: number };
/** A region: closed rings (material on the left: outer counter-clockwise, holes clockwise). */
export type CurveRegion2 = { readonly outer: readonly CurveSegment2[]; readonly holes: readonly (readonly CurveSegment2[])[] };
export type CurveBooleanOperation = 'union' | 'intersection' | 'difference' | 'xor';
export class CurvedArrangementError extends Error { constructor(detail: string) { super('Curved arrangement: ' + detail); this.name = 'CurvedArrangementError'; } }

const TWO_PI = 2 * Math.PI;
export const segStart = (s: CurveSegment2): XY => s.kind === 'line' ? s.a : [s.c[0] + s.r * Math.cos(s.t0), s.c[1] + s.r * Math.sin(s.t0)];
export const segEnd = (s: CurveSegment2): XY => s.kind === 'line' ? s.b : [s.c[0] + s.r * Math.cos(s.t0 + s.sweep), s.c[1] + s.r * Math.sin(s.t0 + s.sweep)];
export const segAt = (s: CurveSegment2, u: number): XY => s.kind === 'line' ? [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u] : [s.c[0] + s.r * Math.cos(s.t0 + s.sweep * u), s.c[1] + s.r * Math.sin(s.t0 + s.sweep * u)];
/** The same piece traversed the other way. */
export const segReverse = (s: CurveSegment2): CurveSegment2 => s.kind === 'line' ? { kind: 'line', a: s.b, b: s.a } : { ...s, t0: s.t0 + s.sweep, sweep: -s.sweep };
/** The sub-piece between parameters u0 < u1. */
function segPart(s: CurveSegment2, u0: number, u1: number, a: XY, b: XY): CurveSegment2 {
  return s.kind === 'line' ? { kind: 'line', a, b } : { ...s, t0: s.t0 + s.sweep * u0, sweep: s.sweep * (u1 - u0) };
}
/** Area contribution ½∮(x dy − y dx) of a segment. */
export function segArea(s: CurveSegment2): number {
  if (s.kind === 'line') return (s.a[0] * s.b[1] - s.b[0] * s.a[1]) / 2;
  const t1 = s.t0 + s.sweep;
  return (s.r * s.r * s.sweep + s.c[0] * s.r * (Math.sin(t1) - Math.sin(s.t0)) - s.c[1] * s.r * (Math.cos(t1) - Math.cos(s.t0))) / 2;
}
export const ringArea = (ring: readonly CurveSegment2[]) => ring.reduce((a, s) => a + segArea(s), 0);
export const regionArea = (r: CurveRegion2) => ringArea(r.outer) + r.holes.reduce((a, h) => a + ringArea(h), 0);
/** Points along a ring (arcs every ≤ 5°), end points excluded. */
export function sampleRing(ring: readonly CurveSegment2[], step = Math.PI / 36): XY[] {
  return ring.flatMap(s => { const n = s.kind === 'line' ? 1 : Math.max(2, Math.ceil(Math.abs(s.sweep) / step)); return Array.from({ length: n }, (_, k) => segAt(s, k / n)); });
}
const pip = (p: XY, poly: readonly XY[]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

/** Parameter u ∈ [0, 1] of a point known to lie on the segment's carrier (line or circle). */
export function paramOf(s: CurveSegment2, p: XY): number {
  if (s.kind === 'line') { const d = [s.b[0] - s.a[0], s.b[1] - s.a[1]], l2 = d[0] * d[0] + d[1] * d[1]; return ((p[0] - s.a[0]) * d[0] + (p[1] - s.a[1]) * d[1]) / l2; }
  // Angle from the start along the sweep direction in [0, 2π); past the end it is the nearer of the
  // two readings (slightly before the start or slightly after the end).
  const dir = Math.sign(s.sweep), w = Math.abs(s.sweep);
  let dt = (Math.atan2(p[1] - s.c[1], p[0] - s.c[0]) - s.t0) * dir;
  dt = ((dt % TWO_PI) + TWO_PI) % TWO_PI;
  if (dt > w && TWO_PI - dt < dt - w) dt -= TWO_PI;
  return dt / w;
}
/** Distance from p to the segment. */
export function segDistance(s: CurveSegment2, p: XY): number {
  const q = segAt(s, Math.min(1, Math.max(0, paramOf(s, p)))); return Math.hypot(q[0] - p[0], q[1] - p[1]);
}
/** Intersection points of two segments (crossings, tangencies, endpoints touching, overlap ends). */
function intersect(s: CurveSegment2, t: CurveSegment2, eps: number): XY[] {
  const out: XY[] = [], on = (x: CurveSegment2, p: XY) => segDistance(x, p) <= eps;
  const push = (p: XY) => { if (on(s, p) && on(t, p)) out.push(p); };
  const ends = () => { for (const p of [segStart(s), segEnd(s), segStart(t), segEnd(t)]) push(p); };
  if (s.kind === 'line' && t.kind === 'line') {
    const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [t.b[0] - t.a[0], t.b[1] - t.a[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
    const len = Math.hypot(...d1) * Math.hypot(...d2);
    if (Math.abs(den) <= 1e-12 * len) { ends(); return out; } // parallel (and possibly overlapping)
    const w = [t.a[0] - s.a[0], t.a[1] - s.a[1]], u = (w[0] * d2[1] - w[1] * d2[0]) / den;
    push([s.a[0] + d1[0] * u, s.a[1] + d1[1] * u]); ends(); return out;
  }
  if (s.kind === 'arc' && t.kind === 'arc') {
    const dx = t.c[0] - s.c[0], dy = t.c[1] - s.c[1], d = Math.hypot(dx, dy);
    if (d <= eps) { ends(); return out; } // concentric: overlap only if same radius; ends cover touching
    const a = (s.r * s.r - t.r * t.r + d * d) / (2 * d), h2 = s.r * s.r - a * a, band = 2 * eps * Math.min(s.r, t.r);
    if (h2 < -band) { ends(); return out; }
    const h = h2 > band ? Math.sqrt(h2) : 0, mx = s.c[0] + a * dx / d, my = s.c[1] + a * dy / d;
    push([mx + h * dy / d, my - h * dx / d]); if (h > 0) push([mx - h * dy / d, my + h * dx / d]);
    ends(); return out;
  }
  const line = (s.kind === 'line' ? s : t) as Extract<CurveSegment2, { kind: 'line' }>, arc = (s.kind === 'arc' ? s : t) as Extract<CurveSegment2, { kind: 'arc' }>;
  const d = [line.b[0] - line.a[0], line.b[1] - line.a[1]], l = Math.hypot(...d), ux = d[0] / l, uy = d[1] / l;
  const f = [line.a[0] - arc.c[0], line.a[1] - arc.c[1]], proj = f[0] * ux + f[1] * uy, dist2 = f[0] * f[0] + f[1] * f[1] - proj * proj, h2 = arc.r * arc.r - dist2;
  const band = 2 * eps * arc.r;
  if (h2 >= -band) { const h = h2 > band ? Math.sqrt(h2) : 0; for (const sgn of h > 0 ? [-1, 1] : [0]) { const k = -proj + sgn * h; push([line.a[0] + ux * k, line.a[1] + uy * k]); } }
  ends(); return out;
}

type Piece = { seg: CurveSegment2; polygon: number };
interface Edge { u: number; v: number; seg: CurveSegment2; count: Map<number, number> } // seg runs u → v
interface Half { from: number; to: number; edge: number; twin: number; next: number; face: number }

/** Arcs over half a turn are split in two, so no piece starts and ends at one vertex. */
const halves = (s: CurveSegment2): CurveSegment2[] => s.kind === 'arc' && Math.abs(s.sweep) > Math.PI ? [{ ...s, sweep: s.sweep / 2 }, { ...s, t0: s.t0 + s.sweep / 2, sweep: s.sweep / 2 }] : [s];
/** The arrangement tolerance for a set of rings. */
export function curveTolerance(rings: readonly (readonly CurveSegment2[])[]): number {
  let scale = 0;
  for (const ring of rings) for (const s of ring) for (const q of s.kind === 'line' ? [s.a, s.b] : [[Math.abs(s.c[0]) + s.r, Math.abs(s.c[1]) + s.r] as XY]) scale = Math.max(scale, Math.abs(q[0]), Math.abs(q[1]));
  return linearToleranceMM(scale);
}

function arrange(rings: readonly { polygon: number; ring: readonly CurveSegment2[] }[], tolerance?: number) {
  const pieces: Piece[] = [];
  for (const { polygon, ring } of rings) for (const seg of ring) for (const h of halves(seg)) pieces.push({ seg: h, polygon });
  const eps = tolerance ?? curveTolerance(rings.map(r => r.ring));
  // Vertices with a tolerance grid.
  const points: XY[] = [], grid = new Map<string, number[]>(), cell = eps * 64;
  const vid = (p: XY) => {
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const v of grid.get((gx + i) + ',' + (gy + j)) ?? []) if (Math.hypot(points[v][0] - p[0], points[v][1] - p[1]) <= eps) return v;
    const v = points.length; points.push(p); const k = gx + ',' + gy; grid.set(k, [...(grid.get(k) ?? []), v]); return v;
  };
  const cuts = pieces.map(p => [segStart(p.seg), segEnd(p.seg)]);
  const box = (s: CurveSegment2) => { const pts = s.kind === 'line' ? [s.a, s.b] : [segStart(s), segEnd(s), [s.c[0] - s.r, s.c[1] - s.r] as XY, [s.c[0] + s.r, s.c[1] + s.r] as XY]; return [Math.min(...pts.map(p => p[0])) - eps, Math.min(...pts.map(p => p[1])) - eps, Math.max(...pts.map(p => p[0])) + eps, Math.max(...pts.map(p => p[1])) + eps]; };
  const boxes = pieces.map(p => box(p.seg));
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = boxes[i], b = boxes[j]; if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]) continue;
    for (const p of intersect(pieces[i].seg, pieces[j].seg, eps)) { cuts[i].push(p); cuts[j].push(p); }
  }
  // Coincident pieces share endpoints and a midpoint (within tolerance).
  const edges: Edge[] = [], edgesBetween = new Map<string, number[]>();
  pieces.forEach((pc, i) => {
    const params = cuts[i].map(p => ({ u: Math.min(1, Math.max(0, paramOf(pc.seg, p))), v: vid(p) })).sort((x, y) => x.u - y.u);
    const stops: { u: number; v: number }[] = [];
    for (const st of params) if (!stops.length || stops[stops.length - 1].v !== st.v) stops.push(st);
    for (let k = 0; k + 1 < stops.length; k++) {
      const s0 = stops[k], s1 = stops[k + 1]; if (s1.u - s0.u <= 0) continue;
      const seg = segPart(pc.seg, s0.u, s1.u, points[s0.v], points[s1.v]), mid = segAt(seg, 0.5);
      const forward = s0.v < s1.v, lo = forward ? s0.v : s1.v, hi = forward ? s1.v : s0.v;
      const key = lo + ':' + hi, list = edgesBetween.get(key) ?? [];
      let e = list.find(k => segDistance(edges[k].seg, mid) <= 4 * eps);
      if (e === undefined) { e = edges.length; edges.push({ u: lo, v: hi, seg: forward ? seg : segReverse(seg), count: new Map() }); list.push(e); edgesBetween.set(key, list); }
      if (pc.polygon >= 0) { const c = edges[e].count; c.set(pc.polygon, (c.get(pc.polygon) ?? 0) + (forward ? 1 : -1)); }
    }
  });
  // Half-edges ordered by leaving tangent, then curvature (the more leftward-curving one later).
  const half: Half[] = [];
  edges.forEach((_, i) => { half.push({ from: edges[i].u, to: edges[i].v, edge: i, twin: 2 * i + 1, next: -1, face: -1 }, { from: edges[i].v, to: edges[i].u, edge: i, twin: 2 * i, next: -1, face: -1 }); });
  const leaving = (h: Half) => {
    const s = h.from === edges[h.edge].u ? edges[h.edge].seg : segReverse(edges[h.edge].seg);
    // Angles in (−π + 1e−12, π + 1e−12] so a direction along −x has one reading.
    const norm = (a: number) => a <= -Math.PI + 1e-12 ? a + TWO_PI : a;
    if (s.kind === 'line') return { angle: norm(Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0])), curvature: 0 };
    const t = s.t0, dir = Math.sign(s.sweep);
    return { angle: norm(Math.atan2(Math.cos(t) * dir, -Math.sin(t) * dir)), curvature: dir / s.r };
  };
  const outgoing = points.map(() => [] as number[]); half.forEach((h, i) => outgoing[h.from].push(i));
  const keyed = half.map(leaving);
  outgoing.forEach(list => list.sort((a, b) => { const A = keyed[a], B = keyed[b], d = A.angle - B.angle; return Math.abs(d) > 1e-12 ? d : A.curvature - B.curvature; }));
  const pos = new Map<number, number>(); outgoing.forEach(list => list.forEach((h, k) => pos.set(h, k)));
  for (const h of half) { const list = outgoing[h.to], k = pos.get(h.twin)!; h.next = list[(k - 1 + list.length) % list.length]; }
  const cycles: number[][] = [];
  half.forEach((h, i) => { if (h.face >= 0) return; const c: number[] = []; let g = i; do { half[g].face = cycles.length; c.push(g); g = half[g].next; } while (g !== i && c.length <= half.length); cycles.push(c); });
  const segOfHalf = (h: number) => half[h].from === edges[half[h].edge].u ? edges[half[h].edge].seg : segReverse(edges[half[h].edge].seg);
  return { points, edges, half, cycles, segOfHalf, eps };
}

/** Every vertex of the arrangement of the rings (crossings, tangencies, touches, ring vertices). */
export function curveArrangementVertices(rings: readonly (readonly CurveSegment2[])[], tolerance?: number): XY[] {
  return rings.length ? arrange(rings.map(ring => ({ polygon: 0, ring })), tolerance).points : [];
}

function regions(arr: ReturnType<typeof arrange>, polygonCount: number) {
  const { points, edges, half, cycles, segOfHalf } = arr;
  const areaOf = (c: number[]) => c.reduce((a, h) => a + segArea(segOfHalf(h)), 0);
  const areas = cycles.map(areaOf), root = points.map((_, i) => i), find = (v: number): number => { while (root[v] !== v) v = root[v] = root[root[v]]; return v; };
  for (const e of edges) root[find(e.u)] = find(e.v);
  const comp = (c: number[]) => find(half[c[0]].from), sampled = cycles.map(c => sampleRing(c.map(segOfHalf)));
  const faceOfCycle = cycles.map((c, i) => {
    if (areas[i] > 0) return i;
    const p = points[half[c[0]].from], mine = comp(c); let best = -1, bestArea = Infinity;
    cycles.forEach((o, k) => { if (areas[k] > 0 && comp(o) !== mine && areas[k] < bestArea && pip(p, sampled[k])) { bestArea = areas[k]; best = k; } });
    return best;
  });
  const faceOfHalf = half.map(h => faceOfCycle[h.face]), winding = new Map<number, number[]>([[-1, Array(polygonCount).fill(0)]]), queue = [-1];
  const halvesOf = new Map<number, number[]>(); faceOfHalf.forEach((f, h) => halvesOf.set(f, [...(halvesOf.get(f) ?? []), h]));
  while (queue.length) {
    const f = queue.shift()!, w = winding.get(f)!;
    for (const h of halvesOf.get(f) ?? []) {
      const other = faceOfHalf[half[h].twin]; if (winding.has(other)) continue;
      const e = edges[half[h].edge], fwd = half[h].from === e.u;
      winding.set(other, w.map((x, p) => x - (e.count.get(p) ?? 0) * (fwd ? 1 : -1))); queue.push(other);
    }
  }
  return { faceOfHalf, winding };
}

/** Merges consecutive pieces of one line or one circle (same direction). */
function simplify(ring: CurveSegment2[], eps: number): CurveSegment2[] {
  const sameCarrier = (s: CurveSegment2, t: CurveSegment2) => {
    if (s.kind === 'line' && t.kind === 'line') { const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [t.b[0] - t.a[0], t.b[1] - t.a[1]]; return Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) <= 1e-12 * Math.hypot(...d1) * Math.hypot(...d2) && d1[0] * d2[0] + d1[1] * d2[1] > 0; }
    if (s.kind === 'arc' && t.kind === 'arc') return Math.hypot(s.c[0] - t.c[0], s.c[1] - t.c[1]) <= eps && Math.abs(s.r - t.r) <= eps && Math.sign(s.sweep) === Math.sign(t.sweep);
    return false;
  };
  const out = [...ring];
  for (let changed = true; changed && out.length > 1;) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 1; i++) {
      const s = out[i], t = out[(i + 1) % out.length];
      if (!sameCarrier(s, t)) continue;
      const merged: CurveSegment2 = s.kind === 'line' ? { kind: 'line', a: s.a, b: (t as typeof s).b } : { ...s, sweep: s.sweep + (t as typeof s).sweep };
      if (merged.kind === 'arc' && Math.abs(merged.sweep) > Math.PI + 1e-12) continue; // arcs stay within half a turn
      out.splice(i, 1, merged); out.splice((i + 1) % (out.length), 1); changed = true; break;
    }
  }
  return out;
}

/** Boolean of two sets of closed rings (material left). Regions come back as outer + holes. */
export function booleanCurveRegions(a: readonly (readonly CurveSegment2[])[], b: readonly (readonly CurveSegment2[])[], operation: CurveBooleanOperation, tolerance?: number): CurveRegion2[] {
  const rings = [...a.map(ring => ({ polygon: 0, ring })), ...b.map(ring => ({ polygon: 1, ring }))];
  if (!rings.length) return [];
  const arr = arrange(rings, tolerance), { faceOfHalf, winding } = regions(arr, 2), { half, segOfHalf, eps } = arr;
  const pick = (w: number[]) => { const x = w[0] !== 0, y = w[1] !== 0; return operation === 'union' ? x || y : operation === 'intersection' ? x && y : operation === 'difference' ? x && !y : x !== y; };
  const selected = new Map<number, boolean>(); for (const [f, w] of winding) selected.set(f, f !== -1 && pick(w));
  const boundary = (h: number) => !!selected.get(faceOfHalf[h]) && !selected.get(faceOfHalf[half[h].twin]);
  const used = new Set<number>(), traced: CurveSegment2[][] = [];
  half.forEach((_, h) => {
    if (!boundary(h) || used.has(h)) return;
    const ring: CurveSegment2[] = []; let g = h;
    do { used.add(g); ring.push(segOfHalf(g)); let n = half[g].next; while (!boundary(n)) n = half[half[n].twin].next; g = n; } while (g !== h && ring.length <= half.length);
    traced.push(simplify(ring, eps));
  });
  const outers = traced.filter(r => ringArea(r) > 0).map(outer => ({ outer, holes: [] as CurveSegment2[][], sample: sampleRing(outer) }));
  for (const hole of traced.filter(r => ringArea(r) <= 0)) {
    const probe = sampleRing(hole);
    let best = -1, bestArea = Infinity;
    outers.forEach((o, k) => { const ar = ringArea(o.outer); if (ar < bestArea && probe.some(p => pip(p, o.sample)) && pip(segAt(hole[0], 0.5), o.sample)) { bestArea = ar; best = k; } });
    if (best < 0) throw new CurvedArrangementError('a result hole has no enclosing ring');
    outers[best].holes.push(hole);
  }
  return outers.map(o => ({ outer: o.outer, holes: o.holes }));
}
