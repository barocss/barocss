// CNC3 (O86): what a rotating tool leaves — inside corners, cavities' floors, small features and tall thin walls — from
// the part's exact geometry and rays through the studio's BVH. An inside corner along a tool's axis is a concave fillet
// (or a sharp concave edge) whose axis line, in the cavity, leads out of the part: the tool comes down it and leaves its
// radius, judged against ⅓ of the corner's depth. A sharp concave edge between square planes is cut sharp when one of
// them faces open air (the end mill's end on it, its side on the other). A floor is a plane facing open air with a
// neighbour rising above it; its depth is the highest neighbour, its width its narrowest extent (rotating calipers on
// its hull) across walls rising on both sides — a step, open on a side, is not a cavity. A tall feature is IM4's rib (two opposite planes, both facing into the part), its height from its root
// edge. Holes are CNC2's: a floor only a hole's bores rise from is the hole's bottom, not a cavity's.
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh } from '../engine/mesh';
import type { StudioDoc } from '../engine/doc';
import { rayHit, triangleBvh, type TriangleBvh } from '@barocss/cad';
import { besideEdge, wallsOf } from '../mould/walls';
import { concaveSpan, extent } from './holes';

type V = readonly number[];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const nameOf = (m: DisplayMesh, f: number) => m.faces[f].name.split('+')[0];

/** An inside corner: its radius (0 sharp), its depth along the tool's axis; `reach` whether a straight tool comes down it. */
export interface Corner { readonly body: string; readonly faces: readonly string[]; readonly radiusMM: number; readonly depthMM: number; readonly kind: 'fillet' | 'sharp'; readonly reach: boolean }
/** A sharp concave edge cut sharp (square planes, one facing open air), or angled (not square: CNC4's tool angle). */
export interface Edge { readonly body: string; readonly faces: readonly [string, string]; readonly lengthMM: number; readonly kind: 'cut' | 'angled' }
export interface Floor { readonly body: string; readonly face: string; readonly depthMM: number; readonly widthMM: number }
export interface Tall { readonly body: string; readonly faces: readonly [string, string]; readonly thicknessMM: number; readonly heightMM: number | null }
export interface Cavities { readonly corners: Corner[]; readonly edges: Edge[]; readonly floors: Floor[]; readonly tall: Tall[]; readonly edgeFillets: number }

/** The centre of each of a face's triangles, `off` mm along `n`. */
function centres(m: DisplayMesh, f: number, n: V, off: number): number[][] {
  const P = m.positions, I = m.indices, out: number[][] = [];
  for (let t = 0; t < I.length; t += 3) if (m.faceOfVertex[I[t]] === f) {
    const i0 = 3 * I[t], i1 = 3 * I[t + 1], i2 = 3 * I[t + 2];
    out.push([(P[i0] + P[i1] + P[i2]) / 3 + off * n[0], (P[i0 + 1] + P[i1 + 1] + P[i2 + 1]) / 3 + off * n[1], (P[i0 + 2] + P[i1 + 2] + P[i2 + 2]) / 3 + off * n[2]]);
  }
  return out;
}
/** Each face's vertices, by face index. */
function vertsByFace(m: DisplayMesh): number[][][] {
  const out: number[][][] = m.faces.map(() => []);
  for (let i = 0; i < m.faceOfVertex.length; i++) out[m.faceOfVertex[i]]?.push([m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]]);
  return out;
}
const escapes = (bvh: TriangleBvh, p: V, d: V) => rayHit(bvh, p, d) === Infinity;
/** Whether a cylinder's axis is the line through c along the unit a. */
function onAxis(x: { c: V; a: V }, c: V, a: V): boolean {
  const d = [x.c[0] - c[0], x.c[1] - c[1], x.c[2] - c[2]], s = dot(d, a);
  return Math.abs(Math.abs(dot(unit(x.a), a)) - 1) <= 1e-9 && Math.hypot(d[0] - s * a[0], d[1] - s * a[1], d[2] - s * a[2]) <= 1e-9;
}
/** Whether a plane next to a face (a set of display faces, across a straight edge) looks out along its normal beside it. */
function opensBeside(m: DisplayMesh, bvh: TriangleBvh, mine: ReadonlySet<number>): boolean {
  for (const g of m.edges) {
    if (!g.straight || mine.has(g.faces[0]) === mine.has(g.faces[1])) continue;
    const o = mine.has(g.faces[0]) ? g.faces[1] : g.faces[0], x = m.faces[o].exact;
    if (x?.kind === 'plane' && looksOut(m, bvh, o, x.n, g.a, g.b)) return true;
  }
  return false;
}
/**
 * Whether a plane a concave fillet is tangent to (its axis r off the plane, on its outer side; the display drops smooth
 * edges, so they are found by geometry) looks out along its normal next to it: its triangle nearest the tangent line.
 */
function tangentOpen(m: DisplayMesh, bvh: TriangleBvh, verts: readonly number[][][], c: V, a: V, r: number, lo: number, hi: number): boolean {
  for (const f of m.faces) {
    const x = f.exact; if (x?.kind !== 'plane' || Math.abs(dot(x.n, a)) > 1e-9 || Math.abs(dot([c[0] - x.o[0], c[1] - x.o[1], c[2] - x.o[2]], x.n) - r) > 1e-6) continue;
    const q = [c[0] - r * x.n[0], c[1] - r * x.n[1], c[2] - r * x.n[2]];
    // (It touches the fillet: one of its vertices on the tangent line, within the fillet's length.)
    let touches = false;
    for (const v of verts[f.index]) { const d = [v[0] - q[0], v[1] - q[1], v[2] - q[2]], s = dot(d, a); if (s >= lo - 1e-6 && s <= hi + 1e-6 && Math.hypot(d[0] - s * a[0], d[1] - s * a[1], d[2] - s * a[2]) <= 1e-6) { touches = true; break; } }
    if (!touches) continue;
    let best: number[] | null = null, bestD = Infinity;
    for (const p of centres(m, f.index, x.n, 0.01)) { const d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]], s = dot(d, a), D = Math.hypot(d[0] - s * a[0], d[1] - s * a[1], d[2] - s * a[2]); if (D < bestD) { bestD = D; best = p; } }
    if (best && escapes(bvh, best, x.n)) return true;
  }
  return false;
}
/** Whether a face, just beside an edge, looks out along its normal (a ray from there leaves the part). */
function looksOut(m: DisplayMesh, bvh: TriangleBvh, f: number, n: V, a: V, b: V): boolean {
  const c0 = besideEdge(m, f, a, b); return !!c0 && escapes(bvh, [c0[0] + 0.01 * n[0], c0[1] + 0.01 * n[1], c0[2] + 0.01 * n[2]], n);
}
/**
 * The narrowest width of points in a plane (normal n): over its 2D hull's edges, the farthest point from the edge's line —
 * only across directions `bounded` accepts (a cavity's: walls rising on both sides); null when it accepts none.
 */
export function narrowest(points: readonly V[], n: V, bounded: (u: V, lo: number, hi: number) => boolean = () => true): number | null {
  const X = unit(Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0])), Y = cross(n, X);
  const q = points.map(p => [dot(p, X), dot(p, Y)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower: number[][] = [], upper: number[][] = [];
  for (const p of q) { while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop(); lower.push(p); }
  for (let i = q.length - 1; i >= 0; i--) { const p = q[i]; while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop(); upper.push(p); }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  if (hull.length < 3) return null;
  let best = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!(L > 1e-12)) continue;
    // (Across the edge: its normal in the plane, in 3D.)
    const nu = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L], u = [nu[0] * X[0] + nu[1] * Y[0], nu[0] * X[1] + nu[1] * Y[1], nu[0] * X[2] + nu[1] * Y[2]];
    let lo = Infinity, hi = -Infinity; for (const p of points) { const s = dot(p, u); if (s < lo) lo = s; if (s > hi) hi = s; }
    if (hi - lo < best && bounded(u, lo, hi)) best = hi - lo;
  }
  return Number.isFinite(best) ? best : null;
}
const turn = (o: readonly number[], a: readonly number[], b: readonly number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
/** Whether a straight edge is concave: the other face, just off the edge, lies on the plane face's outer side. */
function concave(m: DisplayMesh, other: number, a: V, b: V, n: V): boolean {
  const c2 = besideEdge(m, other, a, b); if (!c2) return false;
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = dot(d, d);
  const v = [c2[0] - mid[0], c2[1] - mid[1], c2[2] - mid[2]], s = dot(v, d) / L2;
  return dot([v[0] - s * d[0], v[1] - s * d[1], v[2] - s * d[2]], n) > 1e-6;
}

/** Each body's inside corners, sharp edges, floors and tall features; `holeFaces` CNC2's bores (their bottoms not floors). */
export function cavitiesOf(doc: StudioDoc, bodies: readonly BodyResult[], holeFaces: ReadonlySet<string>): Cavities {
  const corners: Corner[] = [], edges: Edge[] = [], floors: Floor[] = [], tall: Tall[] = [];
  let edgeFillets = 0;
  const walls = wallsOf(doc, bodies, 0.6);
  for (const body of bodies) {
    const m = body.mesh, bvh = triangleBvh(m.positions, m.indices), verts = vertsByFace(m);
    // Inside fillets: concave cylinders round half a turn or less (pieces on one axis and radius joined).
    const seen = new Set<number>();
    for (const f of m.faces) {
      const e = f.exact; if (e?.kind !== 'cylinder' || seen.has(f.index)) continue;
      const a = unit(e.a), c = [e.c[0], e.c[1], e.c[2]], span = concaveSpan(m, f.index, c, a);
      if (span === null || span > Math.PI + 1e-6) continue;
      const same = m.faces.filter(x => x.exact?.kind === 'cylinder' && Math.abs(x.exact.r - e.r) <= 1e-9 && onAxis(x.exact, c, a));
      let lo = Infinity, hi = -Infinity; for (const x of same) { seen.add(x.index); const [l, h] = extent(m, x.index, c, a); lo = Math.min(lo, l); hi = Math.max(hi, h); }
      // (An edge fillet when a plane beside it looks out along its normal — a corner-radius or ball tool's, from that side;
      // else a cavity's corner: its axis line, in the cavity, leaving the part either way is a straight tool's axis.)
      const mine = new Set(same.map(x => x.index));
      if (opensBeside(m, bvh, mine) || tangentOpen(m, bvh, verts, c, a, e.r, lo, hi)) { edgeFillets++; continue; }
      const mid = (lo + hi) / 2, p = [c[0] + mid * a[0], c[1] + mid * a[1], c[2] + mid * a[2]];
      corners.push({ body: body.key, faces: [...new Set(same.map(x => nameOf(m, x.index)))], radiusMM: e.r, depthMM: hi - lo, kind: 'fillet', reach: escapes(bvh, p, a) || escapes(bvh, p, [-a[0], -a[1], -a[2]]) });
    }
    // Sharp concave edges between planes.
    const sharp = new Map<string, { faces: [string, string]; L: number; kind: 'cut' | 'angled' | 'corner' | 'closed' }>();
    for (const e of m.edges) {
      if (!e.straight) continue;
      const F1 = m.faces[e.faces[0]], F2 = m.faces[e.faces[1]]; if (F1?.exact?.kind !== 'plane' || F2?.exact?.kind !== 'plane') continue;
      const n1 = F1.exact.n, n2 = F2.exact.n; if (Math.abs(dot(n1, n2)) > 1 - 1e-9 || !concave(m, e.faces[1], e.a, e.b, n1)) continue;
      const L = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2]);
      let kind: 'cut' | 'angled' | 'corner' | 'closed';
      if (Math.abs(dot(n1, n2)) > 1e-9) kind = 'angled';
      else {
        // (Cut sharp when a face, just beside the edge, looks out along its normal: the end mill's end on it, its side on the other.)
        if (looksOut(m, bvh, e.faces[0], n1, e.a, e.b) || looksOut(m, bvh, e.faces[1], n2, e.a, e.b)) kind = 'cut';
        else {
          // (Else a corner along the edge: from just inside it, in the cavity, a ray along the edge either way leaving the part.)
          const d = unit([e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2]]), p = [(e.a[0] + e.b[0]) / 2 + 0.05 * (n1[0] + n2[0]), (e.a[1] + e.b[1]) / 2 + 0.05 * (n1[1] + n2[1]), (e.a[2] + e.b[2]) / 2 + 0.05 * (n1[2] + n2[2])];
          kind = escapes(bvh, p, d) || escapes(bvh, p, [-d[0], -d[1], -d[2]]) ? 'corner' : 'closed';
        }
      }
      const faces = [nameOf(m, e.faces[0]), nameOf(m, e.faces[1])].sort() as [string, string], key = faces.join('|'), have = sharp.get(key);
      if (have) have.L += L; else sharp.set(key, { faces, L, kind });
    }
    for (const s of sharp.values()) {
      if (s.kind === 'corner' || s.kind === 'closed') corners.push({ body: body.key, faces: s.faces, radiusMM: 0, depthMM: s.L, kind: 'sharp', reach: s.kind === 'corner' });
      else edges.push({ body: body.key, faces: s.faces, lengthMM: s.L, kind: s.kind });
    }
    // Floors: planes facing open air with a neighbour rising above them (not a hole's bottom).
    // (A neighbour rises from a floor across a concave edge — a straight one tested beside it, a curved one, a round
    // pocket's or a boss's, taken as rising; one meeting it at a convex edge, an L's side face, does not.)
    const nbrs = new Map<number, Set<number>>();
    for (const e of m.edges) for (const [x, y] of [[e.faces[0], e.faces[1]], [e.faces[1], e.faces[0]]]) {
      const fx = m.faces[x].exact; if (e.straight && fx?.kind === 'plane' && !concave(m, y, e.a, e.b, fx.n)) continue;
      const s = nbrs.get(x); if (s) s.add(y); else nbrs.set(x, new Set([y]));
    }
    for (const f of m.faces) {
      if (f.exact?.kind !== 'plane') continue;
      const n = f.exact.n, level = dot(f.exact.o, n), rising: number[] = []; let top = level;
      for (const g of nbrs.get(f.index) ?? []) { let h = -Infinity; for (const v of verts[g]) h = Math.max(h, dot(v, n)); if (h > level + 1e-6) { rising.push(g); top = Math.max(top, h); } }
      if (!rising.length || rising.every(g => holeFaces.has(m.faces[g].name))) continue;
      if (!centres(m, f.index, n, 0.01).some(p => escapes(bvh, p, n))) continue;
      // (Its width across walls rising on both sides — a rising neighbour wholly at or past each side: a rib's top between
      // two walls is as wide as the walls are apart, not the rib; a step, open on a side, is not a cavity.)
      const width = narrowest(verts[f.index], n, (u, lo, hi) => rising.some(g => verts[g].every(v => dot(v, u) >= hi - 1e-6)) && rising.some(g => verts[g].every(v => dot(v, u) <= lo + 1e-6)));
      if (width !== null) floors.push({ body: body.key, face: nameOf(m, f.index), depthMM: top - level, widthMM: width });
    }
  }
  // Tall features: IM4's ribs, their height across the rib face from its root (a concave edge to a face it stands on).
  for (const w of walls) {
    const body = bodies.find(b => b.key === w.body); if (!body) continue;
    const m = body.mesh, verts = vertsByFace(m);
    for (const r of w.ribs) {
      const A = m.faces.find(f => nameOf(m, f.index) === r.faces[0] && f.exact?.kind === 'plane'); if (!A || A.exact?.kind !== 'plane') { tall.push({ body: w.body, faces: r.faces, thicknessMM: r.thicknessMM, heightMM: null }); continue; }
      const n = A.exact.n; let height: number | null = null, rootL = 0;
      for (const e of m.edges) {
        if (!e.straight || !(e.faces[0] === A.index || e.faces[1] === A.index)) continue;
        const other = e.faces[0] === A.index ? e.faces[1] : e.faces[0], L = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2]);
        if (nameOf(m, other) === r.faces[1] || !concave(m, other, e.a, e.b, n) || L <= rootL) continue;
        const h = unit(cross(n, [e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2]]));
        let lo = Infinity, hi = -Infinity; for (const v of verts[A.index]) { const s = dot(v, h); lo = Math.min(lo, s); hi = Math.max(hi, s); }
        rootL = L; height = hi - lo;
      }
      tall.push({ body: w.body, faces: r.faces, thicknessMM: r.thicknessMM, heightMM: height });
    }
  }
  return { corners, edges, floors, tall, edgeFillets };
}
