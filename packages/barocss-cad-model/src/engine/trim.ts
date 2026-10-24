// Trimmed surfaces: a support surface kept whole, with closed loops in its (u, v) domain that cut
// regions away — each loop keeps what lies outside it (a hole) or inside it (an island). A loop
// comes from a closed curve projected onto the surface (each sample to its nearest surface point);
// the display mesh is the surface's grid clipped along the loops.
import { closestPointOnSurface, curveDomain, curveEvaluator, surfaceDomain, surfaceEvaluator, type Curve, type Surface } from '@barocss/cad';
import { refusal } from './refusal';

type At = (u: number, v: number) => readonly number[];

type UV = [number, number];
export interface TrimLoop { uv: UV[]; keep: 'outside' | 'inside' }

const sub3 = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);

/** The nearest point of the surface to p, from a seed (u, v): the kernel's `closestPointOnSurface` (K4), on the exact tangents. */
function nearest(s: Surface, p: readonly number[], seed: UV): { uv: UV; gap: number } {
  const f = closestPointOnSurface(s, p, { seed, iterations: 20 });
  return { uv: [f.u, f.v], gap: f.distance };
}

/** Whether segments ab and cd cross or touch (collinear ones only when they overlap). */
const turn = (p: UV, q: UV, r: UV) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
function crosses(a: UV, b: UV, c: UV, d: UV): boolean {
  const o = turn, d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  if (d1 === 0 && d2 === 0) { const k = Math.abs(d[0] - c[0]) >= Math.abs(d[1] - c[1]) ? 0 : 1; return Math.max(a[k], b[k]) >= Math.min(c[k], d[k]) && Math.max(c[k], d[k]) >= Math.min(a[k], b[k]); }
  return d1 * d2 <= 0 && d3 * d4 <= 0;
}
const crossesAny = (a: readonly UV[], b: readonly UV[], self: boolean) => {
  for (let i = 0; i < a.length; i++) for (let j = self ? i + 2 : 0; j < b.length; j++) {
    if (self && i === 0 && j === b.length - 1) continue;
    if (crosses(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  }
  return false;
};

/**
 * The closed curve projected onto the surface as a loop of (u, v) points (`samples` of them), checked to
 * close, not to cross itself or the earlier loops, and to enclose some area; else why not.
 */
export function projectLoop(s: Surface, c: Curve, earlier: readonly TrimLoop[] = [], samples = 160): UV[] {
  const [t0, t1] = curveDomain(c), C = curveEvaluator(c), S = surfaceEvaluator(s), ends = len3(sub3(C(t0), C(t1)));
  let size = 0; for (const p of c.controlPoints) size = Math.max(size, len3(sub3(p, c.controlPoints[0])));
  if (ends > Math.max(1e-6, size * 1e-6)) throw refusal('TRIM_CURVE', 'The curve does not close: trim by a closed curve (a loop).');
  // Seeds from a grid of the surface, then each sample from the one before (the loop moves smoothly).
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(s), G = 24, grid: { uv: UV; p: number[] }[] = [];
  for (let i = 0; i <= G; i++) for (let j = 0; j <= G; j++) { const uv: UV = [u0 + (u1 - u0) * i / G, v0 + (v1 - v0) * j / G]; grid.push({ uv, p: S(uv[0], uv[1]) as number[] }); }
  const out: UV[] = []; let prev: UV | null = null;
  for (let k = 0; k < samples; k++) {
    const p = C(t0 + (t1 - t0) * k / samples);
    const seed = nearestSeed(grid, p);
    let best = nearest(s, p, prev ?? seed);
    // (A jump to a far point of the surface: seeded again from the whole grid.)
    if (prev) { const fromGrid = nearest(s, p, seed); if (fromGrid.gap < best.gap - 1e-9) best = fromGrid; }
    out.push(best.uv); prev = best.uv;
  }
  if (crossesAny(out, out, true)) throw refusal('TRIM_CURVE', 'The curve crosses itself on the surface: trim by a simple loop.');
  if (Math.abs(area(out)) < (u1 - u0) * (v1 - v0) * 1e-6) throw refusal('TRIM_CURVE', 'The curve encloses nothing on the surface (it lies along it edge-on, or off its edge).');
  for (const l of earlier) if (crossesAny(out, l.uv, false)) throw refusal('TRIM_CURVE', 'The curve crosses an earlier trim of the surface.');
  return out;
}

/** The signed area of a (u, v) polygon (anticlockwise positive). */
export function area(poly: readonly UV[]): number {
  let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}

/** The signed distance (scaled to the domain) from (u, v) to a loop: positive on its kept side. */
function side(loop: TrimLoop, u: number, v: number, su: number, sv: number): number {
  let inside = false, best = Infinity;
  const P = loop.uv, n = P.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > v) !== (yj > v) && u < (xj - xi) * (v - yi) / (yj - yi) + xi) inside = !inside;
    // Distance to the segment, in domain-scaled units.
    const ax = (xj - xi) / su, ay = (yj - yi) / sv, px = (u - xi) / su, py = (v - yi) / sv, l2 = ax * ax + ay * ay;
    const t = l2 > 0 ? Math.max(0, Math.min(1, (px * ax + py * ay) / l2)) : 0;
    best = Math.min(best, Math.hypot(px - t * ax, py - t * ay));
  }
  return (inside === (loop.keep === 'inside') ? 1 : -1) * best;
}
/** Whether (u, v) is kept by every loop. */
export function kept(loops: readonly TrimLoop[], s: Surface, u: number, v: number): boolean {
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(s);
  return keptAt(loops, u, v, u1 - u0, v1 - v0);
}
/** kept() for a domain of spans su × sv already known (in a loop over one surface). */
export function keptAt(loops: readonly TrimLoop[], u: number, v: number, su: number, sv: number): boolean {
  for (const l of loops) if (side(l, u, v, su, sv) < 0) return false;
  return true;
}
/** The loops' signed distance at (u, v): the least of them (negative where any cuts the point away). */
function field(loops: readonly TrimLoop[], u: number, v: number, su: number, sv: number): number {
  let m = Infinity; for (const l of loops) m = Math.min(m, side(l, u, v, su, sv)); return m;
}
/** The grid point nearest p (the first such, in grid order). */
function nearestSeed(grid: readonly { uv: UV; p: number[] }[], p: readonly number[]): UV {
  let best = grid[0], bd = len3(sub3(best.p, p));
  for (let k = 1; k < grid.length; k++) { const d = len3(sub3(grid[k].p, p)); if (d < bd) { bd = d; best = grid[k]; } }
  return best.uv;
}

/** A mesh under construction: vertices by their (u, v) (shared by the triangles round them). */
interface Mesh { at: At; u0: number; u1: number; v0: number; v1: number; su: number; sv: number; pos: number[]; nrm: number[]; idx: number[]; seen: Map<string, number> }
function vertexOf(m: Mesh, u: number, v: number): number {
  const key = `${u},${v}`; let k = m.seen.get(key); if (k !== undefined) return k;
  const at = m.at, p = at(u, v), h = 1e-5;
  const ua = Math.max(m.u0, u - h * m.su), ub = Math.min(m.u1, u + h * m.su), va = Math.max(m.v0, v - h * m.sv), vb = Math.min(m.v1, v + h * m.sv);
  const du = sub3(at(ub, v), at(ua, v)), dv = sub3(at(u, vb), at(u, va));
  const c = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]], l = len3(c) || 1;
  k = m.pos.length / 3; m.pos.push(p[0], p[1], p[2]); m.nrm.push(c[0] / l, c[1] / l, c[2] / l); m.seen.set(key, k); return k;
}
/** One grid triangle (corners' u, v and field value in t, nine numbers), clipped to field ≥ 0. */
function clipInto(m: Mesh, t: readonly number[], ids: number[]): void {
  ids.length = 0;
  for (let a = 0; a < 3; a++) {
    const b = (a + 1) % 3, pu = t[3 * a], pv = t[3 * a + 1], pf = t[3 * a + 2], qf = t[3 * b + 2];
    if (pf >= 0) ids.push(vertexOf(m, pu, pv));
    if ((pf >= 0) !== (qf >= 0)) { const f = pf / (pf - qf); ids.push(vertexOf(m, pu + (t[3 * b] - pu) * f, pv + (t[3 * b + 1] - pv) * f)); }
  }
  if (ids.length < 3) return;
  for (let k = 1; k + 1 < ids.length; k++) m.idx.push(ids[0], ids[k], ids[k + 1]);
}

/**
 * The trimmed surface as a triangle mesh: an n × n grid of the domain, each triangle clipped where the
 * loops' signed distance (linear across it) crosses zero; normals from the surface at each vertex.
 */
export function trimmedMesh(s: Surface, loops: readonly TrimLoop[], n = 64): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } {
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(s), su = u1 - u0, sv = v1 - v0;
  const F: number[][] = [];
  for (let i = 0; i <= n; i++) { const row: number[] = []; for (let j = 0; j <= n; j++) row.push(field(loops, u0 + su * i / n, v0 + sv * j / n, su, sv)); F.push(row); }
  const m: Mesh = { at: surfaceEvaluator(s), u0, u1, v0, v1, su, sv, pos: [], nrm: [], idx: [], seen: new Map() }, t = Array<number>(9).fill(0), ids: number[] = [];
  const set = (k: number, a: number, b: number) => { t[3 * k] = u0 + su * a / n; t[3 * k + 1] = v0 + sv * b / n; t[3 * k + 2] = F[a][b]; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    set(0, i, j); set(1, i + 1, j); set(2, i + 1, j + 1); clipInto(m, t, ids);
    set(0, i, j); set(1, i + 1, j + 1); set(2, i, j + 1); clipInto(m, t, ids);
  }
  return { positions: new Float32Array(m.pos), normals: new Float32Array(m.nrm), indices: new Uint32Array(m.idx) };
}
