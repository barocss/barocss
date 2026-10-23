// D149: the isocline n·d = 0 of a NURBS surface for a pull direction d — where the surface turns from facing along the pull
// to facing against it (a mould's parting line across a straddling face). Traced on the exact unit normal (du × dv from the
// surface's first derivatives): marching squares over a slightly irregular grid of its domain (no grid line on a
// symmetric surface's isocline), each grid edge's crossing bisected 60 times, the crossings chained, then points added
// where the Catmull–Rom curve through them in the domain leaves the isocline by more than the tolerance (each new point
// Newton-corrected onto n·d = 0). n·d ≥ 0 counts as the + side, so an isocline along the domain's edge is not traced twice.
// Where du × dv vanishes (a pole) the normal is taken just inside the domain.
import { surfaceDomain, surfaceEvaluator, validateSurface } from '../../core/math.js';
import { surfaceD1Near } from './surface-closest.js';
import type { Point, Surface } from '../../types.js';
import { cross, dot, len, sub } from '../../core/vec3.js';

/** One isocline in the surface's domain: points on n·d = 0 in order, `closed` when it returns to its start. */
export interface SurfaceIsocline { readonly closed: boolean; readonly uv: readonly (readonly [number, number])[] }
export interface SurfaceIsoclineOptions {
  /** Grid cells along each domain side (default 32, 4 … 256). */
  readonly grid?: number;
  /** The largest distance (mm) of the Catmull–Rom curve through the points from the isocline (default 1e-7). */
  readonly toleranceMM?: number;
  /** At most this many points in all (default 20 000). */
  readonly maxPoints?: number;
}

type UV = [number, number];
interface Field { readonly S: Surface; readonly d: Point; readonly U: [number, number]; readonly V: [number, number]; readonly at: (u: number, v: number) => Point }

/**
 * n·d with n the unit normal at (u, v). At a pole (du × dv vanishing: one derivative zero along a collapsed side), just
 * inside the domain across that side only, so the isocline's end there keeps its free coordinate.
 */
function fieldAt(F: Field, u: number, v: number): number {
  let r = surfaceD1Near(F.S, u, v, F.U, F.V), n = cross(r.du, r.dv), l = len(n);
  if (!(l > 1e-12 * (dot(r.du, r.du) + dot(r.dv, r.dv)))) {
    const acrossV = dot(r.du, r.du) < dot(r.dv, r.dv), h = 1e-6 * (acrossV ? F.V[1] - F.V[0] : F.U[1] - F.U[0]), [lo, hi] = acrossV ? F.V : F.U, x = acrossV ? v : u;
    const y = x + h <= hi ? x + h : x - h;
    r = acrossV ? surfaceD1Near(F.S, u, y, F.U, F.V) : surfaceD1Near(F.S, y, v, F.U, F.V); n = cross(r.du, r.dv); l = len(n);
    if (!(l > 0) || y < lo) return 0;
  }
  return dot(n, F.d) / l;
}
const sideOf = (g: number) => g >= -1e-13;
/** The grid's coordinates: k/N moved by 0.0123·sin(2πk/N) of a side (monotone; the ends at the domain's ends). */
function gridLine(lo: number, hi: number, N: number): number[] {
  return Array.from({ length: N + 1 }, (_, k) => k === 0 ? lo : k === N ? hi : lo + (hi - lo) * (k / N + 0.0123 * Math.sin(2 * Math.PI * k / N)));
}
/** The crossing of n·d = 0 between a and b (their sides differ), bisected 60 times. */
function bisect(F: Field, a: UV, b: UV, sa: boolean): UV {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (sideOf(fieldAt(F, a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m)) === sa) lo = m; else hi = m; }
  const m = (lo + hi) / 2;
  return [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m];
}
/** q moved onto n·d = 0 by Newton steps along the field's gradient in the domain (clamped to it). */
function onIsocline(F: Field, q: UV): UV {
  let u = q[0], v = q[1];
  const hu = 1e-7 * (F.U[1] - F.U[0]), hv = 1e-7 * (F.V[1] - F.V[0]);
  for (let it = 0; it < 12; it++) {
    const g = fieldAt(F, u, v); if (g === 0) break;
    const ua = u + hu <= F.U[1] ? u + hu : u - hu, va = v + hv <= F.V[1] ? v + hv : v - hv;
    const gu = (fieldAt(F, ua, v) - g) / (ua - u), gv = (fieldAt(F, u, va) - g) / (va - v), g2 = gu * gu + gv * gv;
    if (!(g2 > 0)) break;
    const du = -g * gu / g2, dv = -g * gv / g2;
    u = Math.min(F.U[1], Math.max(F.U[0], u + du)); v = Math.min(F.V[1], Math.max(F.V[0], v + dv));
    if (Math.abs(du) <= 1e-15 * (F.U[1] - F.U[0]) && Math.abs(dv) <= 1e-15 * (F.V[1] - F.V[0])) break;
  }
  return [u, v];
}
/** The uniform Catmull–Rom point between p1 and p2 at s ∈ [0, 1]. */
export function catmullRom(p0: readonly number[], p1: readonly number[], p2: readonly number[], p3: readonly number[], s: number): UV {
  const s2 = s * s, s3 = s2 * s;
  const a = -0.5 * s3 + s2 - 0.5 * s, b = 1.5 * s3 - 2.5 * s2 + 1, c = -1.5 * s3 + 2 * s2 + 0.5 * s, e = 0.5 * s3 - 0.5 * s2;
  return [a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]];
}
/** The neighbours of interval i of a point chain (an open one's ends mirrored). */
export function chainNeighbours(P: readonly (readonly number[])[], i: number, closed: boolean): [readonly number[], readonly number[], readonly number[], readonly number[]] {
  const n = P.length, p1 = P[i], p2 = P[(i + 1) % n];
  const p0 = i > 0 ? P[i - 1] : closed ? P[n - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
  const p3 = i + 2 < n ? P[i + 2] : closed ? P[(i + 2) % n] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
  return [p0, p1, p2, p3];
}

/** The isoclines n·d = 0 of `surface` for the pull `pull` (any length), in its domain. */
export function surfaceIsoclines(surface: Surface, pull: readonly number[], options: SurfaceIsoclineOptions = {}): SurfaceIsocline[] {
  validateSurface(surface);
  const l = Math.hypot(pull[0], pull[1], pull[2]);
  if (!(l > 0) || !Number.isFinite(l)) throw new RangeError('surfaceIsoclines: the pull must be a finite, nonzero vector');
  const N = options.grid ?? 32, tol = options.toleranceMM ?? 1e-7, maxPoints = options.maxPoints ?? 20000;
  if (!Number.isInteger(N) || N < 4 || N > 256) throw new RangeError('surfaceIsoclines: grid must be a whole number from 4 to 256');
  if (!(tol > 0)) throw new RangeError('surfaceIsoclines: toleranceMM must be above 0');
  const D = surfaceDomain(surface), F: Field = { S: surface, d: [pull[0] / l, pull[1] / l, pull[2] / l], U: D.u, V: D.v, at: surfaceEvaluator(surface) };
  const us = gridLine(D.u[0], D.u[1], N), vs = gridLine(D.v[0], D.v[1], N);
  // A degenerate domain side — collapsed to a point (a pole), or along which n·d is 0 throughout (a flat edge square to the
  // pull) — takes its nodes' sides, and its edges' crossings, from the row just inside it: the field there says nothing (no
  // normal at a pole; zero all along the other), and an isocline reaching it ends where it is extrapolated to (below).
  const size = len(sub(F.at(D.u[1], D.v[1]), F.at(D.u[0], D.v[0]))) + len(sub(F.at(D.u[1], D.v[0]), F.at(D.u[0], D.v[1])));
  const degenerate = (fixed: 0 | 1, at: number) => {
    const p = (t: number): UV => fixed ? [D.u[0] + (D.u[1] - D.u[0]) * t, at] : [at, D.v[0] + (D.v[1] - D.v[0]) * t], o = F.at(...p(0)), ts = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
    return ts.every(t => len(sub(F.at(...p(t)), o)) <= 1e-12 * (size + 1)) || [0, ...ts].every(t => Math.abs(fieldAt(F, ...p(t))) <= 1e-9);
  };
  const degV = [degenerate(1, D.v[0]), degenerate(1, D.v[1])], degU = [degenerate(0, D.u[0]), degenerate(0, D.u[1])];
  const inI = (i: number) => i === 0 && degU[0] ? 1 : i === N && degU[1] ? N - 1 : i, inJ = (j: number) => j === 0 && degV[0] ? 1 : j === N && degV[1] ? N - 1 : j;
  const side: boolean[] = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) side.push(sideOf(fieldAt(F, us[inI(i)], vs[inJ(j)])));
  const s = (i: number, j: number) => side[i * (N + 1) + j];
  // Crossings by grid edge: horizontal (i, j)–(i + 1, j) as 2·(i·(N + 1) + j), vertical (i, j)–(i, j + 1) as that + 1.
  const crossing = new Map<number, UV>();
  const crossAt = (id: number): UV => {
    let q = crossing.get(id); if (q) return q;
    const k = id >> 1, i = Math.floor(k / (N + 1)), j = k % (N + 1), vertical = (id & 1) === 1;
    // (An edge along a degenerate side: bisected along the row inside it, then put on that side.)
    const ii = vertical ? inI(i) : i, jj = vertical ? j : inJ(j), a: UV = [us[ii], vs[jj]], b: UV = vertical ? [us[ii], vs[jj + 1]] : [us[ii + 1], vs[jj]];
    q = bisect(F, a, b, s(i, j));
    if (ii !== i) q = [us[i], q[1]]; else if (jj !== j) q = [q[0], vs[j]];
    crossing.set(id, q); return q;
  };
  const links = new Map<number, number[]>(), link = (a: number, b: number) => { for (const [x, y] of [[a, b], [b, a]]) { const l2 = links.get(x); if (l2) l2.push(y); else links.set(x, [y]); } };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    // The cell's edges counter-clockwise: bottom, right, top, left; each with a crossing where its corners' sides differ.
    const c = [s(i, j), s(i + 1, j), s(i + 1, j + 1), s(i, j + 1)];
    const ids = [2 * (i * (N + 1) + j), 2 * ((i + 1) * (N + 1) + j) + 1, 2 * (i * (N + 1) + j + 1), 2 * (i * (N + 1) + j) + 1];
    const hit = [0, 1, 2, 3].filter(e => c[e] !== c[(e + 1) % 4]);
    if (hit.length === 2) link(ids[hit[0]], ids[hit[1]]);
    else if (hit.length === 4) {
      // A saddle: the centre's side decides which corners join.
      const centre = sideOf(fieldAt(F, (us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2));
      if (centre === c[0]) { link(ids[0], ids[1]); link(ids[2], ids[3]); } else { link(ids[3], ids[0]); link(ids[1], ids[2]); }
    }
  }
  // Chains: from each end (one link: a crossing on the domain's edge), then the closed ones left.
  const used = new Set<number>(), chains: { closed: boolean; ids: number[] }[] = [];
  const walk = (start: number): number[] => {
    const out = [start]; used.add(start);
    for (let cur = start; ;) { const next = (links.get(cur) ?? []).find(x => !used.has(x)); if (next === undefined) break; used.add(next); out.push(next); cur = next; }
    return out;
  };
  for (const [id, l2] of links) if (l2.length === 1 && !used.has(id)) chains.push({ closed: false, ids: walk(id) });
  for (const id of links.keys()) if (!used.has(id)) chains.push({ closed: true, ids: walk(id) });
  let total = 0;
  const out: SurfaceIsocline[] = [];
  for (const ch of chains) {
    let P: UV[] = ch.ids.map(crossAt);
    if (P.length < 2) continue;
    // An end on a degenerate side: its free coordinate extrapolated from the next two points (the row inside gave it as theirs).
    if (!ch.closed && P.length >= 3) for (const [e, n1, n2] of [[0, 1, 2], [P.length - 1, P.length - 2, P.length - 3]]) {
      const q = P[e], a = P[n1], b = P[n2];
      const onV = (q[1] === D.v[0] && degV[0]) || (q[1] === D.v[1] && degV[1]), onU = (q[0] === D.u[0] && degU[0]) || (q[0] === D.u[1] && degU[1]);
      if (onV && a[1] !== b[1]) P[e] = [Math.min(D.u[1], Math.max(D.u[0], a[0] + (a[0] - b[0]) * (q[1] - a[1]) / (a[1] - b[1]))), q[1]];
      else if (onU && a[0] !== b[0]) P[e] = [q[0], Math.min(D.v[1], Math.max(D.v[0], a[1] + (a[1] - b[1]) * (q[0] - a[0]) / (a[0] - b[0])))];
    }
    // Points added where the curve through them leaves the isocline (its middle against the middle moved onto it).
    for (let pass = 0; pass < 12; pass++) {
      const next: UV[] = [], intervals = ch.closed ? P.length : P.length - 1;
      let added = 0;
      for (let i = 0; i < P.length; i++) {
        next.push(P[i]);
        if (i >= intervals || total + P.length + added >= maxPoints) continue;
        // (Points already this close in space — by a pole, where the domain's sides shrink — need nothing between them.)
        const a = P[i], b = P[(i + 1) % P.length]; if (len(sub(F.at(a[0], a[1]), F.at(b[0], b[1]))) <= 4 * tol) continue;
        // (The curve's middle clamped to the domain: near its edge the curve can bulge past it.)
        const [p0, p1, p2, p3] = chainNeighbours(P, i, ch.closed), c = catmullRom(p0, p1, p2, p3, 0.5);
        const m: UV = [Math.min(F.U[1], Math.max(F.U[0], c[0])), Math.min(F.V[1], Math.max(F.V[0], c[1]))], q = onIsocline(F, m);
        if (len(sub(F.at(m[0], m[1]), F.at(q[0], q[1]))) > tol) { next.push(q); added++; }
      }
      P = next;
      if (!added) break;
    }
    total += P.length;
    out.push({ closed: ch.closed, uv: P });
  }
  return out;
}
