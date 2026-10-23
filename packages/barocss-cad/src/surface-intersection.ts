// Surface–surface intersection by marching (brep-core step 9). Two parametric patches over boxes in
// their own 2D coordinates; seeds from intersecting triangles of coarse grids of both, each seed
// refined onto both surfaces and traced both ways along n₁ × n₂ (predictor step, corrector: Newton on
// the two surfaces and the plane normal to the curve through the predicted point) until it leaves a
// box or closes on itself. The result is a list of point chains (with tangents) on both surfaces.
import { add, cross, dot, len, scale, sub, unit } from './vec3.js';
import type { Point } from './types.js';

type XY = [number, number];
export interface Patch {
  readonly at: (p: XY) => Point;
  readonly box: readonly [XY, XY];
}
export interface IntersectionChain {
  readonly points: readonly Point[]; readonly tangents: readonly Point[]; readonly closed: boolean;
  /** Each point's coordinates on the two patches. */
  readonly uvA: readonly XY[]; readonly uvB: readonly XY[];
}
export class SurfaceIntersectionError extends Error { constructor(detail: string) { super('Surface intersection: ' + detail); this.name = 'SurfaceIntersectionError'; } }

function derivatives(P: Patch, p: XY): { x: Point; du: Point; dv: Point } {
  const [[u0, v0], [u1, v1]] = P.box, hu = 1e-6 * (u1 - u0 || 1), hv = 1e-6 * (v1 - v0 || 1);
  const x = P.at(p), a = P.at([p[0] + hu, p[1]]), b = P.at([p[0] - hu, p[1]]), c = P.at([p[0], p[1] + hv]), d = P.at([p[0], p[1] - hv]);
  return { x, du: scale(sub(a, b), 1 / (2 * hu)), dv: scale(sub(c, d), 1 / (2 * hv)) };
}
const inside = (P: Patch, p: XY, slack = 0) => p[0] >= P.box[0][0] - slack && p[0] <= P.box[1][0] + slack && p[1] >= P.box[0][1] - slack && p[1] <= P.box[1][1] + slack;
/** Nearest point of a patch to x by Newton (from a start), unclamped (callers test the box). */
function project(P: Patch, x: Point, start: XY): XY {
  let p: XY = [start[0], start[1]];
  for (let it = 0; it < 30; it++) {
    const { x: q, du, dv } = derivatives(P, p), r = sub(x, q);
    const g11 = dot(du, du), g12 = dot(du, dv), g22 = dot(dv, dv), r1 = dot(r, du), r2 = dot(r, dv), det = g11 * g22 - g12 * g12;
    if (!(Math.abs(det) > 1e-300)) break;
    const a = (r1 * g22 - r2 * g12) / det, b = (g11 * r2 - g12 * r1) / det;
    p = [p[0] + a, p[1] + b];
    if (Math.abs(a) + Math.abs(b) < 1e-15 * (1 + Math.abs(p[0]) + Math.abs(p[1]))) break;
  }
  return p;
}
/**
 * A point on both surfaces near x (and, with a plane, on it): Newton on F = PA(a) − PB(b) (3 rows) plus
 * the plane row, solved by least squares over the 4 parameters.
 */
function onBoth(A: Patch, B: Patch, pa: XY, pb: XY, plane?: { o: Point; n: Point }): { pa: XY; pb: XY; x: Point } | null {
  for (let it = 0; it < 40; it++) {
    const da = derivatives(A, pa), db = derivatives(B, pb), F = sub(da.x, db.x);
    // Rows: F (3) and optionally n·(PA − o) (1); columns: a0, a1, b0, b1.
    const rows: number[][] = [[da.du[0], da.dv[0], -db.du[0], -db.dv[0], -F[0]], [da.du[1], da.dv[1], -db.du[1], -db.dv[1], -F[1]], [da.du[2], da.dv[2], -db.du[2], -db.dv[2], -F[2]]];
    if (plane) rows.push([dot(plane.n, da.du), dot(plane.n, da.dv), 0, 0, -dot(plane.n, sub(da.x, plane.o))]);
    // Minimum-norm least squares: solve (J Jᵀ) y = rhs, step = Jᵀ y. (Loops, not closures per iteration: R5.2, D220;
    // the same sums in the same order, the step's from 0 as the reduce had it.)
    const m = rows.length, JJ: number[][] = [], rhs: number[] = [];
    for (let i = 0; i < m; i++) { const r = rows[i], row: number[] = []; for (let k = 0; k < m; k++) { const q = rows[k]; row.push(r[0] * q[0] + r[1] * q[1] + r[2] * q[2] + r[3] * q[3]); } JJ.push(row); rhs.push(r[4]); }
    const y = solve(JJ, rhs, m); if (!y) return null;
    const step = [0, 0, 0, 0];
    for (let j = 0; j < 4; j++) { let acc = 0; for (let i = 0; i < m; i++) acc = acc + rows[i][j] * y[i]; step[j] = acc; }
    pa = [pa[0] + step[0], pa[1] + step[1]]; pb = [pb[0] + step[2], pb[1] + step[3]];
    if (Math.abs(step[0]) + Math.abs(step[1]) + Math.abs(step[2]) + Math.abs(step[3]) < 1e-14 * (1 + Math.abs(pa[0]) + Math.abs(pa[1]) + Math.abs(pb[0]) + Math.abs(pb[1]))) break;
  }
  const xa = A.at(pa), xb = B.at(pb);
  return { pa, pb, x: scale(add(xa, xb), 0.5) };
}
function solve(M: number[][], b: number[], n: number): number[] | null {
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-300) return null;
    [M[c], M[piv]] = [M[piv], M[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k < n; k++) M[r][k] -= f * M[c][k]; b[r] -= f * b[c]; }
  }
  const x = Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
const normalOf = (P: Patch, p: XY) => { const d = derivatives(P, p); return unit(cross(d.du, d.dv)); };

/** Segment–triangle crossing points of two triangles (Möller-style: each triangle's edges against the other). */
function triangleCrossings(t1: Point[], t2: Point[]): Point[] {
  const out: Point[] = [];
  const edgeTri = (p: Point, q: Point, t: Point[]) => {
    const e1 = sub(t[1], t[0]), e2 = sub(t[2], t[0]), d = sub(q, p), h = cross(d, e2), a = dot(e1, h);
    if (Math.abs(a) < 1e-300) return;
    const f = 1 / a, s = sub(p, t[0]), u = f * dot(s, h); if (u < 0 || u > 1) return;
    const qq = cross(s, e1), v = f * dot(d, qq); if (v < 0 || u + v > 1) return;
    const w = f * dot(e2, qq); if (w < 0 || w > 1) return;
    out.push(add(p, scale(d, w)));
  };
  for (let i = 0; i < 3; i++) { edgeTri(t1[i], t1[(i + 1) % 3], t2); edgeTri(t2[i], t2[(i + 1) % 3], t1); }
  return out;
}

/** All intersection chains of two patches within their boxes. `step` is the marching step in mm. */
export function intersectPatches(A: Patch, B: Patch, options: {
  readonly step: number; readonly tolerance: number; readonly grid?: number;
  /** Seeds to leave out (points of an intersection the caller already has). */
  readonly skip?: (x: Point) => boolean;
  /** Whether x lies within r of that intersection: facet crossings that close are not refined at all. */
  readonly skipNear?: (x: Point, r: number) => boolean;
  /** At most this many marching steps in all (default 200 000), so a degenerate pair fails, not hangs. */
  readonly budget?: number;
  /**
   * Points known to be on the intersection (where a curve found on a neighbouring patch crosses into
   * these): traced first, so a short piece by a patch's edge is not missed between grid seeds.
   */
  readonly seeds?: readonly Point[];
}): IntersectionChain[] {
  const n = options.grid ?? 24, h = options.step, tol = options.tolerance;
  let budget = options.budget ?? 200000;
  const spend = () => { if (--budget < 0) throw new SurfaceIntersectionError('too many marching steps (the surfaces touch or overlap along a curve)'); };
  const gridOf = (P: Patch) => { const [[u0, v0], [u1, v1]] = P.box, pts: { p: XY; x: Point }[][] = [];
    for (let i = 0; i <= n; i++) { const row: { p: XY; x: Point }[] = []; for (let j = 0; j <= n; j++) { const p: XY = [u0 + (u1 - u0) * i / n, v0 + (v1 - v0) * j / n]; row.push({ p, x: P.at(p) }); } pts.push(row); } return pts; };
  const GA = gridOf(A), GB = gridOf(B);
  // No chain is longer than a few times both patches' size.
  const extent = (G: { x: Point }[][]) => { let m = 0; for (const row of G) for (const c of row) m = Math.max(m, len(sub(c.x, G[0][0].x))); return m; };
  const maxSteps = Math.min(20000, Math.ceil(8 * (extent(GA) + extent(GB)) / h) + 100);
  const tris = (G: { p: XY; x: Point }[][]) => { const out: { pts: Point[]; uv: XY[]; min: Point; max: Point }[] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (const t of [[G[i][j], G[i + 1][j], G[i + 1][j + 1]], [G[i][j], G[i + 1][j + 1], G[i][j + 1]]]) {
      const pts = t.map(c => c.x), min = [0, 1, 2].map(k => Math.min(...pts.map(p => p[k]))) as Point, max = [0, 1, 2].map(k => Math.max(...pts.map(p => p[k]))) as Point;
      out.push({ pts, uv: t.map(c => c.p), min, max });
    } return out; };
  // Only triangles within the other patch's box can cross it.
  const boxOf = (T: { min: Point; max: Point }[]) => T.reduce((m, t) => ({ min: [0, 1, 2].map(k => Math.min(m.min[k], t.min[k])) as Point, max: [0, 1, 2].map(k => Math.max(m.max[k], t.max[k])) as Point }), { min: [Infinity, Infinity, Infinity] as Point, max: [-Infinity, -Infinity, -Infinity] as Point });
  const within = (t: { min: Point; max: Point }, b: { min: Point; max: Point }) => [0, 1, 2].every(k => t.max[k] >= b.min[k] - tol && t.min[k] <= b.max[k] + tol);
  const allA = tris(GA), allB = tris(GB), bA = boxOf(allA), bB = boxOf(allB), TA = allA.filter(t => within(t, bB)), TB = allB.filter(t => within(t, bA));
  // Facet crossings, refined onto both surfaces only when reached (most lie on a chain traced by then).
  const raw: { x: Point; ua: XY; ub: XY }[] = [];
  for (const a of TA) for (const b of TB) {
    if (a.max[0] < b.min[0] - tol || b.max[0] < a.min[0] - tol || a.max[1] < b.min[1] - tol || b.max[1] < a.min[1] - tol || a.max[2] < b.min[2] - tol || b.max[2] < a.min[2] - tol) continue;
    // Facets nearly parallel are a tangency or one surface twice: no curve to trace there.
    const na = cross(sub(a.pts[1], a.pts[0]), sub(a.pts[2], a.pts[0])), nb = cross(sub(b.pts[1], b.pts[0]), sub(b.pts[2], b.pts[0]));
    if (len(cross(na, nb)) <= 1e-4 * len(na) * len(nb)) continue;
    for (const x of triangleCrossings(a.pts, b.pts)) raw.push({ x, ua: a.uv[0], ub: b.uv[0] });
  }
  const chains: IntersectionChain[] = [];
  const near = (x: Point, r: number) => chains.some(c => c.points.some((p, i) => { if (len(sub(p, x)) <= 2 * r) return true; const q = c.points[i + 1]; if (!q) return false; const d = sub(q, p), t = Math.max(0, Math.min(1, dot(sub(x, p), d) / (dot(d, d) || 1))); return len(sub(add(p, scale(d, t)), x)) <= r; }));
  const covered = (x: Point) => near(x, h);
  // Given points first: each from the nearest grid point of either patch.
  const nearest = (G: { p: XY; x: Point }[][], x: Point) => { let best = G[0][0]; for (const row of G) for (const c of row) if (len(sub(c.x, x)) < len(sub(best.x, x))) best = c; return best.p; };
  function* seeds() {
    for (const x of options.seeds ?? []) {
      const s = onBoth(A, B, project(A, x, nearest(GA, x)), project(B, x, nearest(GB, x)));
      if (s && len(sub(A.at(s.pa), B.at(s.pb))) <= tol && len(sub(s.x, x)) <= 100 * tol && inside(A, s.pa, 1e-9) && inside(B, s.pb, 1e-9)) yield s;
    }
    for (const c of raw) {
      // A crossing well within a traced chain's reach refines onto that chain: skipped unrefined.
      if (near(c.x, h / 2) || options.skipNear?.(c.x, h / 2)) continue;
      const s = onBoth(A, B, project(A, c.x, c.ua), project(B, c.x, c.ub));
      if (s && len(sub(A.at(s.pa), B.at(s.pb))) <= tol && inside(A, s.pa, 1e-9) && inside(B, s.pb, 1e-9)) yield s;
    }
  }
  for (const seed of seeds()) {
    if (covered(seed.x) || options.skip?.(seed.x)) continue;
    // Tangent contact (normals within about 0.006°, above the differencing noise at a domain edge): not traced.
    if (len(cross(normalOf(A, seed.pa), normalOf(B, seed.pb))) < 1e-4) continue;
    const march = (dir: 1 | -1) => {
      const pts: Point[] = [seed.x], tans: Point[] = [], uvA: XY[] = [seed.pa], uvB: XY[] = [seed.pb];
      let closed = false;
      for (let k = 0; k < maxSteps; k++) {
        spend();
        const pa = uvA[uvA.length - 1], pb = uvB[uvB.length - 1], x = pts[pts.length - 1], c = cross(normalOf(A, pa), normalOf(B, pb));
        // The surfaces turn tangent: the curve ends here (its direction is undefined).
        if (len(c) < 1e-4) break;
        const t = scale(unit(c), dir);
        tans.push(t);
        // Predictor, then corrector on both surfaces and the plane through the prediction normal to t.
        let step = h, next: ReturnType<typeof onBoth> = null;
        for (let tries = 0; tries < 6 && !next; tries++, step /= 2) {
          const guess = add(x, scale(t, step));
          const r = onBoth(A, B, project(A, guess, pa), project(B, guess, pb), { o: guess, n: t });
          if (r && len(sub(r.x, guess)) < step && len(sub(A.at(r.pa), B.at(r.pb))) <= tol) next = r;
        }
        if (!next) break;
        // Leaving a box: cut the step at the box edge (bisection on the fraction of the step).
        if (!inside(A, next.pa) || !inside(B, next.pb)) {
          let lo = 0, hi = 1, last = { pa, pb, x };
          for (let it = 0; it < 40; it++) {
            spend();
            const m = (lo + hi) / 2, g = add(x, scale(sub(next.x, x), m)), r = onBoth(A, B, project(A, g, pa), project(B, g, pb), { o: g, n: t });
            if (r && inside(A, r.pa) && inside(B, r.pb)) { lo = m; last = r; } else hi = m;
          }
          // The end lies exactly on the edge: a point closer than the step tolerance replaces the last one.
          const endTan = scale(unit(cross(normalOf(A, last.pa), normalOf(B, last.pb))), dir);
          if (len(sub(last.x, x)) > tol) { pts.push(last.x); uvA.push(last.pa); uvB.push(last.pb); tans.push(endTan); }
          else if (last.x !== x) { pts[pts.length - 1] = last.x; uvA[uvA.length - 1] = last.pa; uvB[uvB.length - 1] = last.pb; tans[tans.length - 1] = endTan; }
          break;
        }
        // Closing on the start.
        if (k > 3 && len(sub(next.x, pts[0])) < step * 0.75 && dot(sub(pts[0], x), t) > 0) { closed = true; break; }
        // Running back over itself (circling a tangency): the curve ends there.
        if (k > 8 && pts.slice(1, -8).some(p => len(sub(next.x, p)) < step * 0.5)) break;
        pts.push(next.x); uvA.push(next.pa); uvB.push(next.pb);
      }
      if (tans.length < pts.length) tans.push(tans[tans.length - 1] ?? [1, 0, 0]);
      return { pts, tans, closed, uvA, uvB };
    };
    const fwd = march(1);
    if (fwd.closed) { chains.push({ points: fwd.pts, tangents: fwd.tans, closed: true, uvA: fwd.uvA, uvB: fwd.uvB }); continue; }
    const back = march(-1);
    const points = [...back.pts.slice(1).reverse(), ...fwd.pts], tangents = [...back.tans.slice(1).reverse().map(t => scale(t, -1)), ...fwd.tans];
    if (points.length >= 2) chains.push({ points, tangents, closed: false, uvA: [...back.uvA.slice(1).reverse(), ...fwd.uvA], uvB: [...back.uvB.slice(1).reverse(), ...fwd.uvB] });
  }
  return chains;
}

/**
 * A chain as a C¹ curve on t ∈ [0, 1] (cubic Hermite between consecutive points, by chord length).
 * With the two patches, every chain step is first subdivided in four by points corrected onto both
 * surfaces (in the plane normal to the curve), with their tangents: the interpolant then deviates
 * from the intersection by about (step / 4)⁴ κ³ / 384, far below tolerance, at no cost per evaluation.
 */
export function chainCurve(chain: IntersectionChain, on?: { readonly A: Patch; readonly B: Patch }): (t: number) => Point {
  const close = <T>(xs: readonly T[]) => chain.closed ? [...xs, xs[0]] : [...xs];
  let pts = close(chain.points), tans = close(chain.tangents);
  const hermite = (P: Point[], T: Point[], i: number, d: number, u: number): { x: Point; dx: Point } => {
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    const g00 = 6 * u2 - 6 * u, g10 = 3 * u2 - 4 * u + 1, g01 = -6 * u2 + 6 * u, g11 = 3 * u2 - 2 * u;
    return { x: add(add(scale(P[i], h00), scale(T[i], h10 * d)), add(scale(P[i + 1], h01), scale(T[i + 1], h11 * d))),
      dx: add(add(scale(P[i], g00 / d), scale(T[i], g10)), add(scale(P[i + 1], g01 / d), scale(T[i + 1], g11))) };
  };
  if (on) {
    const uvA = close(chain.uvA), uvB = close(chain.uvB), P: Point[] = [pts[0]], T: Point[] = [tans[0]];
    for (let i = 0; i + 1 < pts.length; i++) {
      const d = len(sub(pts[i + 1], pts[i])) || 1;
      for (let j = 1; j < 4; j++) {
        const { x, dx } = hermite(pts, tans, i, d, j / 4), k = j < 2 ? i : i + 1, dir = unit(dx);
        const r = onBoth(on.A, on.B, project(on.A, x, uvA[k]), project(on.B, x, uvB[k]), { o: x, n: dir });
        if (r && len(sub(r.x, x)) < d / 4) {
          const t = unit(cross(normalOf(on.A, r.pa), normalOf(on.B, r.pb)));
          P.push(r.x); T.push(dot(t, dir) < 0 ? scale(t, -1) : t);
        }
      }
      P.push(pts[i + 1]); T.push(tans[i + 1]);
    }
    pts = P; tans = T;
  }
  const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + len(sub(pts[i], pts[i - 1])));
  const L = s[s.length - 1] || 1;
  return t => {
    const target = Math.min(1, Math.max(0, t)) * L;
    let i = 0, hi = pts.length - 2; while (i < hi) { const m = (i + hi + 1) >> 1; if (s[m] <= target) i = m; else hi = m - 1; }
    const d = s[i + 1] - s[i] || 1;
    return hermite(pts, tans, i, d, (target - s[i]) / d).x;
  };
}
