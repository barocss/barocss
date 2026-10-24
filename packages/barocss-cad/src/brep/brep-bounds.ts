// D151: a B-rep's bounding box without a mesh. STEP export wrote its bounding-box validation property from a tessellation at
// 16 segments a quarter — 770k triangles and 14 s for the 724-face throated wheel, for six numbers. Here:
// - every edge curve, sampled per span and refined about its extreme samples (golden section);
// - a planar face adds nothing (its extremes lie on its boundary edges);
// - a face that is its surface's whole patch (the mass routine's test): the surface's extremes over its domain, from a grid
//   per span refined by alternating golden sections — exact, where the mesh's vertices fell short by its chord;
// - any other face (trimmed and curved): the vertices of its own tessellation at 16 segments a quarter, as before;
// - facet faces: their positions.
import { curveDomain, curveEvaluator, surfaceDomain, surfaceEvaluator } from '../core/math.js';
import { planar, tessellateBrepWithParameters } from './brep-tessellate.js';
import { wholePatchTest } from './brep-mass-quadrature.js';
import type { Brep } from './brep-core.js';
import type { Curve, Point, Surface } from '../types.js';

const GOLDEN = 0.6180339887498949;
/** The distinct knot values of a knot vector inside [lo, hi], with lo and hi. */
function breaks(knots: readonly number[], lo: number, hi: number): number[] {
  const out = [lo]; for (const k of knots) if (k > lo && k < hi && k !== out[out.length - 1]) out.push(k); out.push(hi); return out;
}
/** Samples of [lo, hi]: `per` in each knot span. */
function samples(knots: readonly number[], lo: number, hi: number, per: number): number[] {
  const b = breaks(knots, lo, hi), out: number[] = [];
  for (let i = 0; i + 1 < b.length; i++) for (let j = 0; j < per; j++) out.push(b[i] + (b[i + 1] - b[i]) * j / per);
  out.push(hi); return out;
}
/** The largest of f over [a, b] by golden section (f unimodal there). */
function goldenMax(f: (t: number) => number, a: number, b: number): number {
  let lo = a, hi = b, m1 = hi - GOLDEN * (hi - lo), m2 = lo + GOLDEN * (hi - lo), f1 = f(m1), f2 = f(m2);
  for (let i = 0; i < 60 && hi - lo > 1e-15 * (Math.abs(a) + Math.abs(b) + 1); i++) {
    if (f1 < f2) { lo = m1; m1 = m2; f1 = f2; m2 = lo + GOLDEN * (hi - lo); f2 = f(m2); } else { hi = m2; m2 = m1; f2 = f1; m1 = hi - GOLDEN * (hi - lo); f1 = f(m1); }
  }
  return Math.max(f1, f2, f(a), f(b));
}
function grow(lo: number[], hi: number[], p: ArrayLike<number>): void { for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; } }
/** A curve's extremes along each axis into the box. */
function curveInto(c: Curve, lo: number[], hi: number[]): void {
  const [t0, t1] = curveDomain(c), at = curveEvaluator(c), ts = samples(c.knots, t0, t1, 8), P = ts.map(at);
  for (const p of P) grow(lo, hi, p);
  for (let k = 0; k < 3; k++) for (const s of [1, -1]) {
    let best = 0; for (let i = 1; i < P.length; i++) if (s * P[i][k] > s * P[best][k]) best = i;
    const m = goldenMax(t => s * at(t)[k], ts[Math.max(0, best - 1)], ts[Math.min(ts.length - 1, best + 1)]) * s;
    if (s > 0) hi[k] = Math.max(hi[k], m); else lo[k] = Math.min(lo[k], m);
  }
}
/** A whole surface patch's extremes along each axis into the box. */
function patchInto(S: Surface, lo: number[], hi: number[]): void {
  const { u: U, v: V } = surfaceDomain(S), at = surfaceEvaluator(S), us = samples(S.knotsU, U[0], U[1], 4), vs = samples(S.knotsV, V[0], V[1], 4);
  const P = us.map(u => vs.map(v => at(u, v)));
  for (const row of P) for (const p of row) grow(lo, hi, p);
  for (let k = 0; k < 3; k++) for (const s of [1, -1]) {
    let bi = 0, bj = 0; for (let i = 0; i < us.length; i++) for (let j = 0; j < vs.length; j++) if (s * P[i][j][k] > s * P[bi][bj][k]) { bi = i; bj = j; }
    // Alternating golden sections within the cells about the best sample.
    const ua = us[Math.max(0, bi - 1)], ub = us[Math.min(us.length - 1, bi + 1)], va = vs[Math.max(0, bj - 1)], vb = vs[Math.min(vs.length - 1, bj + 1)];
    let u = us[bi], v = vs[bj], best = s * P[bi][bj][k];
    for (let round = 0; round < 8; round++) {
      let nu = u, fu = -Infinity; { let lo2 = ua, hi2 = ub; for (let i = 0; i < 60; i++) { const m1 = hi2 - GOLDEN * (hi2 - lo2), m2 = lo2 + GOLDEN * (hi2 - lo2); if (s * at(m1, v)[k] < s * at(m2, v)[k]) lo2 = m1; else hi2 = m2; } nu = (lo2 + hi2) / 2; fu = s * at(nu, v)[k]; }
      if (fu > best) { u = nu; best = fu; }
      let nv = v, fv = -Infinity; { let lo2 = va, hi2 = vb; for (let i = 0; i < 60; i++) { const m1 = hi2 - GOLDEN * (hi2 - lo2), m2 = lo2 + GOLDEN * (hi2 - lo2); if (s * at(u, m1)[k] < s * at(u, m2)[k]) lo2 = m1; else hi2 = m2; } nv = (lo2 + hi2) / 2; fv = s * at(u, nv)[k]; }
      if (fv > best) { v = nv; best = fv; } else if (!(fu > best)) break;
    }
    if (s > 0) hi[k] = Math.max(hi[k], best); else lo[k] = Math.min(lo[k], -best);
  }
}

/** Whether a control net's box lies within the box (then so does the curve or patch: positive weights keep it in its hull). */
function within(points: Iterable<readonly number[]>, lo: readonly number[], hi: readonly number[]): boolean {
  for (const p of points) for (let k = 0; k < 3; k++) if (p[k] < lo[k] || p[k] > hi[k]) return false;
  return true;
}
/** The smallest axis box holding the B-rep: exact on edges, planar faces and whole patches; trimmed curved faces by their mesh at 16 segments a quarter. */
export function brepBounds(brep: Brep): { min: Point; max: Point } {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of brep.vertices) grow(lo, hi, v.point);
  // (A curve or patch whose control net lies within the box so far adds nothing: most of them, once the vertices are in.)
  for (const e of brep.edges) if (!within(e.curve.controlPoints, lo, hi)) curveInto(e.curve, lo, hi);
  const whole = wholePatchTest(brep), rest = new Set<string>();
  for (const f of brep.faces) {
    if (f.surface.kind === 'facets') { const P = f.surface.positions; for (let i = 0; i + 2 < P.length; i += 3) grow(lo, hi, [P[i], P[i + 1], P[i + 2]]); continue; }
    if (planar(f.surface) || within(f.surface.controlPoints.flat(), lo, hi)) continue;
    if (whole(f)) { patchInto(f.surface, lo, hi); continue; }
    rest.add(f.id);
  }
  if (rest.size) { const P = tessellateBrepWithParameters(brep, { segmentsPerQuarter: 16 }, rest).mesh.positions; for (let i = 0; i + 2 < P.length; i += 3) grow(lo, hi, [P[i], P[i + 1], P[i + 2]]); }
  return { min: lo as Point, max: hi as Point };
}
