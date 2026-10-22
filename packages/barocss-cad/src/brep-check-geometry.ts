// The strict geometric checks of checkBrep (L0 validation, RB2), beyond topology: every edge lies on the
// surfaces of the faces using it, no loop crosses itself or another loop of its face (in the face's
// parameters), no face is a sliver (narrower than its tolerance allows), and no tolerance has grown past a cap
// of the model's size. Kept out of the builders' own checks (assertValidBrep): they cost point inversions.
import { curveDomain, curveEvaluator, surfaceDomain, surfaceEvaluator } from './math.js';
import type { Brep, BrepFace } from './brep-core.js';
import type { Point, Surface } from './types.js';

/** Every polyline edge vertex of a facet face is one of its patch's vertices (exactly). */
function facetEdgesOnPatch(face: BrepFace, P: Float64Array, maps: Maps, add: (kind: string, detail: string) => void): void {
  const have = new Set<string>();
  for (let i = 0; i < P.length; i += 3) have.add(`${P[i]},${P[i + 1]},${P[i + 2]}`);
  for (const lid of face.loops) for (const cid of maps.loops.get(lid)?.coedges ?? []) {
    const e = maps.edges.get(maps.coedges.get(cid)?.edge ?? ''); if (!e) continue;
    for (const p of e.curve.controlPoints) if (!have.has(`${p[0]},${p[1]},${p[2]}`)) { add('geometry', `edge ${e.id} leaves the facets of face ${face.id}`); return; }
  }
}

type XY = [number, number];
export interface StrictGeometry { maximumEdgeSurfaceGapMM: number }
interface Maps { loops: Map<string, Brep['loops'][number]>; coedges: Map<string, Brep['coedges'][number]>; edges: Map<string, Brep['edges'][number]> }

/** Samples along an edge use (a line: its ends and middle; a curve: 9), in the coedge's direction. */
const SAMPLES_LINE = 3, SAMPLES_CURVE = 9;
/** A tolerance may grow to this share of the model's size (at least 1 mm across): past it, it has blown up (a sewing or fitting default is 1e-3 at most). */
export const TOLERANCE_CAP = 1e-3;

/** A face's way of mapping a point to its parameters and measuring how far off its surface the point is. */
interface Mapper { uv(p: Point, hint: XY | null): XY; gap(p: Point, q: XY): number; closed: boolean; planar: boolean; ku: number; kv: number }

/** A flat bilinear patch: parameters by projection, the gap as the distance from its plane. */
function planeMapper(face: BrepFace): Mapper | null {
  const S = face.surface as Surface;
  if (S.degreeU !== 1 || S.degreeV !== 1 || S.controlPoints.length !== 2 || S.controlPoints[0].length !== 2) return null;
  const [[p00, p01], [p10]] = S.controlPoints, u = sub(p10, p00), v = sub(p01, p00), n = cross(u, v), l = Math.hypot(n[0], n[1], n[2]);
  if (!(l > 0) || Math.hypot(...sub(S.controlPoints[1][1], add(p10, v))) > 1e-9 * Math.max(1, Math.hypot(...u), Math.hypot(...v))) return null;
  const nn: Point = [n[0] / l, n[1] / l, n[2] / l], e1 = unit(u), e2 = cross(nn, e1);
  return { uv: p => { const d = sub(p, p00); return [dot(d, e1), dot(d, e2)]; }, gap: p => Math.abs(dot(sub(p, p00), nn)), closed: false, planar: true, ku: 1, kv: 1 };
}

/** Any other patch: Newton from the nearest of a 16 × 16 grid; closed when its sides meet (a seam) or collapse (a pole). */
function surfaceMapper(face: BrepFace): Mapper {
  const S = face.surface as Surface, at = surfaceEvaluator(S), { u: U, v: V } = surfaceDomain(S), N = 16, grid: { a: number; b: number; p: Point }[] = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const a = U[0] + (U[1] - U[0]) * i / N, b = V[0] + (V[1] - V[0]) * j / N; grid.push({ a, b, p: at(a, b) }); }
  let size = 1; for (const g of grid) size = Math.max(size, Math.abs(g.p[0]), Math.abs(g.p[1]), Math.abs(g.p[2]));
  let seamU = 0, seamV = 0;
  for (let k = 0; k <= N; k++) { seamU = Math.max(seamU, dist(grid[k].p, grid[N * (N + 1) + k].p)); seamV = Math.max(seamV, dist(grid[k * (N + 1)].p, grid[k * (N + 1) + N].p)); }
  // (Sides that meet or collapse make the parameter map of a boundary ambiguous: such faces skip the crossing test.)
  let collapsed = false;
  for (let k = 0; k < N && !collapsed; k++) collapsed = dist(grid[k].p, grid[k + 1].p) < 1e-9 * size || dist(grid[N * (N + 1) + k].p, grid[N * (N + 1) + k + 1].p) < 1e-9 * size
    || dist(grid[k * (N + 1)].p, grid[(k + 1) * (N + 1)].p) < 1e-9 * size || dist(grid[k * (N + 1) + N].p, grid[(k + 1) * (N + 1) + N].p) < 1e-9 * size;
  const closed = seamU < 1e-7 * size || seamV < 1e-7 * size || collapsed;
  // (Seeds off collapsed sides: at a pole one parameter is arbitrary and Newton cannot move along it.)
  const row = (i: number) => grid.slice(i * (N + 1), i * (N + 1) + N + 1), column = (j: number) => grid.filter((_, k) => k % (N + 1) === j);
  const pole = (line: { p: Point }[]) => line.every(g => dist(g.p, line[0].p) < 1e-9 * size);
  const polar = new Set([row(0), row(N), column(0), column(N)].filter(pole).flat());
  const seeds = grid.filter(g => !polar.has(g));
  return { uv: (p, hint) => nearestUV(at, U, V, seeds.length ? seeds : grid, p, hint), gap: (p, q) => dist(at(q[0], q[1]), p), closed, planar: false, ku: 1 / Math.max(1e-300, U[1] - U[0]), kv: 1 / Math.max(1e-300, V[1] - V[0]) };
}
/**
 * The parameters of the surface point nearest p: damped Newton (Levenberg–Marquardt, finite differences) from
 * the four nearest grid points and from `hint` (the previous sample's parameters along an edge), keeping the
 * best; a step is taken only when it brings the point nearer, so a pole (where the derivatives vanish) cannot
 * throw it off.
 */
function nearestUV(at: (u: number, v: number) => Point, U: readonly number[], V: readonly number[], grid: readonly { a: number; b: number; p: Point }[], p: Point, hint: XY | null): XY {
  const near: number[] = [], nd: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    const d = dist2(grid[i].p, p);
    if (near.length === 4 && d >= nd[3]) continue;
    let k = near.length < 4 ? near.length : 3;
    while (k > 0 && nd[k - 1] > d) k--;
    near.splice(k, 0, i); nd.splice(k, 0, d); if (near.length > 4) { near.pop(); nd.pop(); }
  }
  let best: XY = [grid[near[0]].a, grid[near[0]].b], bd = Math.sqrt(nd[0]);
  const starts: XY[] = near.map(i => [grid[i].a, grid[i].b] as XY); if (hint) starts.unshift(hint);
  for (const s of starts) { const q = descend(at, U, V, s[0], s[1], p), d = dist(at(q[0], q[1]), p); if (d < bd) { bd = d; best = q; } if (bd === 0) break; }
  return best;
}
/** Levenberg–Marquardt on |S(a, b) − p|² from (a, b), within the domain. */
function descend(at: (u: number, v: number) => Point, U: readonly number[], V: readonly number[], a: number, b: number, p: Point): XY {
  let q = at(a, b), f = dist2(q, p), lambda = 1e-6;
  for (let it = 0; it < 60 && f > 0; it++) {
    const ha = 1e-7 * (U[1] - U[0]), hb = 1e-7 * (V[1] - V[0]), ia = a + ha <= U[1] ? ha : -ha, ib = b + hb <= V[1] ? hb : -hb;
    const qa = at(a + ia, b), qb = at(a, b + ib);
    const Su: Point = [(qa[0] - q[0]) / ia, (qa[1] - q[1]) / ia, (qa[2] - q[2]) / ia], Sv: Point = [(qb[0] - q[0]) / ib, (qb[1] - q[1]) / ib, (qb[2] - q[2]) / ib], r = sub(p, q);
    const g11 = dot(Su, Su), g12 = dot(Su, Sv), g22 = dot(Sv, Sv), r1 = dot(r, Su), r2 = dot(r, Sv), scale = g11 + g22 || 1;
    let moved = false;
    for (let tries = 0; tries < 12 && !moved; tries++) {
      const d11 = g11 + lambda * scale, d22 = g22 + lambda * scale, det = d11 * d22 - g12 * g12;
      if (!(Math.abs(det) > 1e-300)) { lambda *= 10; continue; }
      const na = Math.min(U[1], Math.max(U[0], a + (r1 * d22 - r2 * g12) / det)), nb = Math.min(V[1], Math.max(V[0], b + (d11 * r2 - g12 * r1) / det));
      const nq = at(na, nb), nf = dist2(nq, p);
      if (nf < f) {
        const step = Math.max(Math.abs(na - a) / (U[1] - U[0]), Math.abs(nb - b) / (V[1] - V[0]));
        a = na; b = nb; q = nq; f = nf; lambda = Math.max(1e-12, lambda / 10);
        if (step < 1e-15) return [a, b];
        moved = true;
      } else lambda *= 10;
    }
    if (!moved) break;
  }
  return [a, b];
}

/**
 * The strict checks over all faces, reporting problems through `add` (kind, detail); returns the largest
 * distance of an edge sample from a surface using it. `size`: the model's extent (tolerances scale with it).
 */
export function strictGeometry(brep: Brep, maps: Maps, size: number, add: (kind: string, detail: string) => void): StrictGeometry {
  let maximumEdgeSurfaceGapMM = 0;
  const cap = TOLERANCE_CAP * Math.max(1, size);
  for (const e of brep.edges) if (e.toleranceMM > cap) add('tolerance', `edge ${e.id} tolerance ${e.toleranceMM} mm is past the cap ${cap} mm`);
  for (const v of brep.vertices) if (v.toleranceMM > cap) add('tolerance', `vertex ${v.id} tolerance ${v.toleranceMM} mm is past the cap ${cap} mm`);
  for (const face of brep.faces) {
    // (A lens: one loop of two edges between the same two vertices, the curves within a hundredth of their chord of
    // each other all along, and across one of them a face tangent to it — a seam between patches of one smooth surface
    // a hair beside the face that cut it, D102. Not a thin face of real geometry: a cylinder grazing a box makes lenses
    // as thin, their faces meeting at an angle.)
    const lens = lensGap(brep, face, maps);
    if (lens) add('geometry', `face ${face.id} is a sliver: its two edges lie within ${lens.gap.toExponential(2)} mm of each other over a ${lens.chord.toExponential(2)} mm chord`);
    // (A facet face's edges are polylines through its own vertices: on it by construction. Checked here: each
    // polyline vertex is one of the patch's.)
    if (face.surface.kind === 'facets') { facetEdgesOnPatch(face, face.surface.positions, maps, add); continue; }
    const mapper = planeMapper(face) ?? surfaceMapper(face), rings: XY[][] = [];
    let perimeter = 0, faceTol = 0;
    for (const lid of face.loops) {
      const loop = maps.loops.get(lid); if (!loop) continue;
      const ring: XY[] = [];
      for (const cid of loop.coedges) {
        const c = maps.coedges.get(cid), e = c && maps.edges.get(c.edge); if (!c || !e) continue;
        faceTol = Math.max(faceTol, e.toleranceMM);
        const at = curveEvaluator(e.curve), [t0, t1] = curveDomain(e.curve), line = e.curve.degree === 1 && e.curve.controlPoints.length === 2, n = line ? SAMPLES_LINE : SAMPLES_CURVE;
        // Edges stay within their own tolerance of the surface, or 1e-6 of the model where that is larger
        // (traced intersections are fitted to that).
        const limit = Math.max(10 * e.toleranceMM, 1e-6 * Math.max(1, size));
        let last: Point | null = null, hint: XY | null = null;
        for (let k = 0; k < n; k++) {
          const f = k / (n - 1), t = c.sense === 'forward' ? t0 + (t1 - t0) * f : t1 - (t1 - t0) * f, p = at(t), q = mapper.uv(p, hint), gap = mapper.gap(p, q);
          hint = q;
          if (gap > maximumEdgeSurfaceGapMM) maximumEdgeSurfaceGapMM = gap;
          if (gap > limit) { add('geometry', `edge ${e.id} is ${gap.toExponential(2)} mm off the surface of face ${face.id}`); break; }
          if (last) perimeter += dist(last, p);
          last = p;
          // (Each use's last sample is the next one's first: kept once.)
          if (k < n - 1) ring.push([q[0] * mapper.ku, q[1] * mapper.kv]);
        }
      }
      rings.push(ring);
    }
    if (mapper.closed) continue;
    const crossing = ringsCross(rings);
    if (crossing) add('geometry', `face ${face.id}: its loops cross or touch themselves or each other (${crossing})`);
    // A sliver: a planar face whose width (twice its area over its perimeter) is below its edges' tolerance.
    if (mapper.planar) {
      let area = 0; rings.forEach((r, k) => { const a = Math.abs(polygonArea(r)); area += k === 0 ? a : -a; });
      if (perimeter > 0 && 2 * area / perimeter < faceTol) add('geometry', `face ${face.id} is a sliver (width ${(2 * area / perimeter).toExponential(2)} mm)`);
    }
  }
  return { maximumEdgeSurfaceGapMM };
}

/**
 * A face of one loop of two edges joining the same two vertices that lie within 1e-2 of their chord of each other, one
 * of them a seam to a face tangent to it (normals within 1e-4 rad at its middle).
 */
function lensGap(brep: Brep, face: Brep['faces'][number], maps: Maps): { gap: number; chord: number } | null {
  if (face.loops.length !== 1) return null;
  const loop = maps.loops.get(face.loops[0]);
  if (!loop || loop.coedges.length !== 2) return null;
  const [e1, e2] = loop.coedges.map(cid => maps.edges.get(maps.coedges.get(cid)?.edge ?? ''));
  if (!e1 || !e2 || e1 === e2) return null;
  const [d1, d2] = [curveDomain(e1.curve), curveDomain(e2.curve)], a1 = curveEvaluator(e1.curve), a2 = curveEvaluator(e2.curve);
  const p = a1(d1[0]), q = a1(d1[1]), chord = dist(p, q);
  if (!(chord > 0)) return null;
  const along: Point[] = [];
  for (let k = 0; k <= 64; k++) along.push(a2(d2[0] + (d2[1] - d2[0]) * k / 64));
  let gap = 0;
  for (let k = 1; k < 16; k++) {
    const x = a1(d1[0] + (d1[1] - d1[0]) * k / 16);
    let best = Infinity; for (let j = 0; j + 1 < along.length; j++) best = Math.min(best, segmentDistance(x, along[j], along[j + 1]));
    gap = Math.max(gap, best);
    if (gap >= 1e-2 * chord) return null;
  }
  const seam = [e1, e2].some(e => {
    const other = brep.coedges.filter(c => c.edge === e.id).map(c => brep.faces.find(f => f.loops.includes(c.loop))).find(f => f && f !== face);
    if (!other || other.surface.kind === 'facets' || face.surface.kind === 'facets') return false;
    const [t0, t1] = curveDomain(e.curve), x = curveEvaluator(e.curve)((t0 + t1) / 2), n1 = normalAt(face, x), n2 = normalAt(other, x);
    return !!n1 && !!n2 && Math.acos(Math.min(1, Math.abs(n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]))) < 1e-4;
  });
  return seam ? { gap, chord } : null;
}
/** A face's unit normal (either way) at its point nearest x: a plane's, else by differences at its parameters there. */
function normalAt(face: Brep['faces'][number], x: Point): Point | null {
  const S = face.surface as Surface, plane = planeMapper(face);
  if (plane) { const [[p00, p01], [p10]] = S.controlPoints, n = cross(sub(p10, p00), sub(p01, p00)), l = Math.hypot(n[0], n[1], n[2]); return l > 0 ? [n[0] / l, n[1] / l, n[2] / l] : null; }
  const q = surfaceMapper(face).uv(x, null), at = surfaceEvaluator(S), { u: U, v: V } = surfaceDomain(S), hu = 1e-6 * (U[1] - U[0]), hv = 1e-6 * (V[1] - V[0]);
  const ua = Math.min(U[1], q[0] + hu), ub = Math.max(U[0], q[0] - hu), va = Math.min(V[1], q[1] + hv), vb = Math.max(V[0], q[1] - hv);
  const du = sub(at(ua, q[1]), at(ub, q[1])), dv = sub(at(q[0], va), at(q[0], vb)), n = cross(du, dv), l = Math.hypot(n[0], n[1], n[2]);
  return l > 0 ? [n[0] / l, n[1] / l, n[2] / l] : null;
}
function segmentDistance(x: Point, a: Point, b: Point): number {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x[0] - a[0]) * d[0] + (x[1] - a[1]) * d[1] + (x[2] - a[2]) * d[2]) / l2)) : 0;
  return Math.hypot(x[0] - a[0] - t * d[0], x[1] - a[1] - t * d[1], x[2] - a[2] - t * d[2]);
}

/**
 * A description of the first contact between segments of the rings that are not neighbours in one ring (a
 * crossing, or a touch: a loop through one point twice, two loops meeting), or null. Consecutive repeated
 * points are dropped first.
 */
function ringsCross(rings: readonly XY[][]): string | null {
  const segs: { a: XY; b: XY; ring: number; k: number; n: number; lo: number; hi: number }[] = [];
  rings.forEach((raw, ri) => {
    const r = raw.filter((p, k) => { const q = raw[(k + raw.length - 1) % raw.length]; return raw.length < 2 || p[0] !== q[0] || p[1] !== q[1]; });
    for (let k = 0; k < r.length; k++) { const a = r[k], b = r[(k + 1) % r.length]; segs.push({ a, b, ring: ri, k, n: r.length, lo: Math.min(a[0], b[0]), hi: Math.max(a[0], b[0]) }); }
  });
  segs.sort((x, y) => x.lo - y.lo);
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length && segs[j].lo <= segs[i].hi; j++) {
    const s = segs[i], t = segs[j];
    if (s.ring === t.ring && (Math.abs(s.k - t.k) <= 1 || Math.abs(s.k - t.k) === s.n - 1)) continue;
    if (meet(s.a, s.b, t.a, t.b)) return `ring ${s.ring} segment ${s.k} and ring ${t.ring} segment ${t.k}`;
  }
  return null;
}
/** Whether segments ab and cd have a point in common (within a relative 1e-9 of their lengths). */
function meet(a: XY, b: XY, c: XY, d: XY): boolean {
  const o = (p: XY, q: XY, r: XY) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const L = Math.max(dist2d(a, b), dist2d(c, d)), eps = 1e-9 * L * L;
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  if (((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) && ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps))) return true;
  // Touching: an end of one on the other.
  const on = (p: XY, q: XY, r: XY, orient: number) => Math.abs(orient) <= eps && r[0] >= Math.min(p[0], q[0]) - 1e-9 * L && r[0] <= Math.max(p[0], q[0]) + 1e-9 * L && r[1] >= Math.min(p[1], q[1]) - 1e-9 * L && r[1] <= Math.max(p[1], q[1]) + 1e-9 * L;
  return on(a, b, c, o1) || on(a, b, d, o2) || on(c, d, a, o3) || on(c, d, b, o4);
}
const polygonArea = (r: readonly XY[]) => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const sub = (a: readonly number[], b: readonly number[]): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: readonly number[], b: readonly number[]): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: readonly number[], b: readonly number[]): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Point): Point => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dist2 = (a: readonly number[], b: readonly number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const dist2d = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
