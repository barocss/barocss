// D149's independent oracle: a trimmed face's area and its flux ∫ x·n dA, integrated on its exact surface by Green's theorem
// in its (u, v) domain — each edge's points projected onto the surface (K4), the inner integral in u and the boundary
// integral by 8-point Gauss–Legendre. Not the kernel's mass routine (which meshes trimmed general faces).
import { closestPointOnSurface, surfaceD1Near, surfaceDomain, curveD1Evaluator, curveDomain } from '../dist/index.js';

const GX = [-0.9602898564975363, -0.7966664774136267, -0.525532409916329, -0.1834346424956498, 0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363];
const GW = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.362683783378362, 0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);

/** ∫ from U0 to u of |Su × Sv| and of S·(Su × Sv) at height v, split at the surface's u knots. */
export function inner(S, U, V, u, v) {
  const breaks = [U[0], ...[...new Set(S.knotsU)].filter(k => k > U[0] && k < u), u];
  let a = 0, f = 0;
  for (let k = 0; k + 1 < breaks.length; k++) {
    const lo = breaks[k], hi = breaks[k + 1], h = (hi - lo) / 2;
    for (let g = 0; g < 8; g++) {
      const s = lo + h * (GX[g] + 1), r = surfaceD1Near(S, s, v, U, V), n = cross(r.du, r.dv);
      a += GW[g] * h * len(n); f += GW[g] * h * dot(r.point, n);
    }
  }
  return [a, f];
}
/** ∮ (P, Q) dv along a domain path (u(t), v(t)), t ∈ [0, 1], in `pieces` sub-intervals; dv from `dvdt`. */
function boundary(S, U, V, path, pieces) {
  let A = 0, Fl = 0;
  for (let k = 0; k < pieces; k++) for (let g = 0; g < 8; g++) {
    const t = (k + (GX[g] + 1) / 2) / pieces, w = GW[g] / 2 / pieces, { u, v, dv } = path(t), [a, f] = inner(S, U, V, u, v);
    A += w * a * dv; Fl += w * f * dv;
  }
  return [A, Fl];
}
/** Seeds for projections: a 24 × 24 grid of the domain without its pole nodes (Su × Sv vanishing holds Gauss–Newton there). */
function seeds(S, U, V) {
  const out = [];
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const u = U[0] + (U[1] - U[0]) * i / 24, v = V[0] + (V[1] - V[0]) * j / 24, r = surfaceD1Near(S, u, v, U, V);
    if (len(cross(r.du, r.dv)) > 1e-9 * (dot(r.du, r.du) + dot(r.dv, r.dv))) out.push({ u, v, p: r.point });
  }
  return out;
}
function project(S, list, x) {
  let best = list[0], d = Infinity;
  for (const s of list) { const e = (s.p[0] - x[0]) ** 2 + (s.p[1] - x[1]) ** 2 + (s.p[2] - x[2]) ** 2; if (e < d) { d = e; best = s; } }
  return closestPointOnSurface(S, x, { seed: [best.u, best.v], iterations: 60 });
}
/** A face's area and outward flux of x (the face by name). */
export function faceIntegrals(brep, name, pieces = 24) {
  const face = brep.faces.find(f => f.name === name); if (!face) throw new Error(`no face ${name}`);
  const S = face.surface, { u: U, v: V } = surfaceDomain(S), grid = seeds(S, U, V), sigma = face.sense === 'forward' ? 1 : -1;
  const loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(c => [c.id, c])), edges = new Map(brep.edges.map(e => [e.id, e]));
  let A = 0, Fl = 0;
  for (const lid of face.loops) for (const cid of loops.get(lid).coedges) {
    const c = coedges.get(cid), e = edges.get(c.edge), d1 = curveD1Evaluator(e.curve), [t0, t1] = curveDomain(e.curve);
    const [ta, tb] = c.sense === 'forward' ? [t0, t1] : [t1, t0];
    const path = s => {
      const r0 = d1(ta + (tb - ta) * s), x = r0.point, dx = r0.derivative.map(k => k * (tb - ta));
      const q = project(S, grid, x);
      const r = surfaceD1Near(S, q.u, q.v, U, V), g11 = dot(r.du, r.du), g12 = dot(r.du, r.dv), g22 = dot(r.dv, r.dv), b1 = dot(r.du, dx), b2 = dot(r.dv, dx), det = g11 * g22 - g12 * g12;
      // (At a pole Su vanishes: the v rate from Sv alone.)
      const dv = det > 1e-18 * (g11 + g22) ** 2 ? (g11 * b2 - g12 * b1) / det : b2 / g22;
      return { u: q.u, v: q.v, dv };
    };
    const [a, f] = boundary(S, U, V, path, pieces); A += a; Fl += f;
  }
  return { area: sigma * A, flux: Fl };
}
/** The volume of a closed B-rep: the faces' fluxes over 3. */
export const oracleVolume = brep => brep.faces.reduce((s, f) => s + faceIntegrals(brep, f.name).flux, 0) / 3;
/** A domain region's area on S: the closed domain path (u(t), v(t), du/dt, dv/dt) CCW, by Green's theorem. */
export function domainArea(S, path, pieces = 64) {
  const { u: U, v: V } = surfaceDomain(S);
  return boundary(S, U, V, t => { const p = path(t); return { u: p[0], v: p[1], dv: p[3] }; }, pieces)[0];
}
/** The distance from x to the surface S (projected from its nearest non-pole grid node). */
export function distanceToSurface(S, x) { const { u: U, v: V } = surfaceDomain(S); return project(S, seeds(S, U, V), x).distance; }
/** The Bézier curve of degree n through n + 1 points at t = k/n (Bernstein interpolation): exact for a polynomial of degree ≤ n. */
export function bezierThrough(points) {
  const n = points.length - 1, B = (i, t) => { let c = 1; for (let k = 0; k < i; k++) c = c * (n - k) / (k + 1); return c * t ** i * (1 - t) ** (n - i); };
  const M = points.map((_, k) => points.map((__, i) => B(i, k / n))), R = points.map(p => [...p]);
  for (let c = 0; c <= n; c++) {
    let piv = c; for (let r = c + 1; r <= n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]]; [R[c], R[piv]] = [R[piv], R[c]];
    for (let r = 0; r <= n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; for (let k = 0; k < 3; k++) R[r][k] -= f * R[c][k]; }
  }
  return R.map((p, i) => p.map(x => x / M[i][i]));
}
