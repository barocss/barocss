// Trimmed surfaces: a support surface kept whole, with closed loops in its (u, v) domain that cut
// regions away — each loop keeps what lies outside it (a hole) or inside it (an island). A loop
// comes from a closed curve projected onto the surface (each sample to its nearest surface point);
// the display mesh is the surface's grid clipped along the loops.
import { curveDomain, evaluateCurve, evaluateSurface, surfaceDomain, type Curve, type Surface } from '@barocss/cad';

type UV = [number, number];
export interface TrimLoop { uv: UV[]; keep: 'outside' | 'inside' }

const sub3 = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);

/** The nearest point of the surface to p, from a seed (u, v): Gauss–Newton on the surface's tangents. */
function nearest(s: Surface, p: readonly number[], seed: UV): { uv: UV; gap: number } {
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(s), hu = (u1 - u0) * 1e-6, hv = (v1 - v0) * 1e-6;
  const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
  let [u, v] = seed;
  for (let it = 0; it < 20; it++) {
    const q = evaluateSurface(s, u, v), r = sub3(q, p);
    const ua = clamp(u - hu, u0, u1), ub = clamp(u + hu, u0, u1), va = clamp(v - hv, v0, v1), vb = clamp(v + hv, v0, v1);
    const su = sub3(evaluateSurface(s, ub, v), evaluateSurface(s, ua, v)).map(x => x / (ub - ua)), sv = sub3(evaluateSurface(s, u, vb), evaluateSurface(s, u, va)).map(x => x / (vb - va));
    const a = dot3(su, su), b = dot3(su, sv), c = dot3(sv, sv), det = a * c - b * b, gu = dot3(su, r), gv = dot3(sv, r);
    if (!(Math.abs(det) > 1e-300)) break;
    const du = -(c * gu - b * gv) / det, dv = -(a * gv - b * gu) / det, nu = clamp(u + du, u0, u1), nv = clamp(v + dv, v0, v1);
    const done = Math.abs(nu - u) < (u1 - u0) * 1e-12 && Math.abs(nv - v) < (v1 - v0) * 1e-12;
    u = nu; v = nv; if (done) break;
  }
  return { uv: [u, v], gap: len3(sub3(evaluateSurface(s, u, v), p)) };
}

/** Whether segments ab and cd cross or touch (collinear ones only when they overlap). */
function crosses(a: UV, b: UV, c: UV, d: UV): boolean {
  const o = (p: UV, q: UV, r: UV) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
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
  const [t0, t1] = curveDomain(c), ends = len3(sub3(evaluateCurve(c, t0), evaluateCurve(c, t1)));
  let size = 0; for (const p of c.controlPoints) size = Math.max(size, len3(sub3(p, c.controlPoints[0])));
  if (ends > Math.max(1e-6, size * 1e-6)) throw new Error('The curve does not close: trim by a closed curve (a loop).');
  // Seeds from a grid of the surface, then each sample from the one before (the loop moves smoothly).
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(s), G = 24, grid: { uv: UV; p: number[] }[] = [];
  for (let i = 0; i <= G; i++) for (let j = 0; j <= G; j++) { const uv: UV = [u0 + (u1 - u0) * i / G, v0 + (v1 - v0) * j / G]; grid.push({ uv, p: evaluateSurface(s, uv[0], uv[1]) }); }
  const out: UV[] = []; let prev: UV | null = null;
  for (let k = 0; k < samples; k++) {
    const p = evaluateCurve(c, t0 + (t1 - t0) * k / samples);
    let best = nearest(s, p, prev ?? grid.reduce((b, g) => len3(sub3(g.p, p)) < len3(sub3(b.p, p)) ? g : b).uv);
    // (A jump to a far point of the surface: seeded again from the whole grid.)
    if (prev) { const fromGrid = nearest(s, p, grid.reduce((b, g) => len3(sub3(g.p, p)) < len3(sub3(b.p, p)) ? g : b).uv); if (fromGrid.gap < best.gap - 1e-9) best = fromGrid; }
    out.push(best.uv); prev = best.uv;
  }
  if (crossesAny(out, out, true)) throw new Error('The curve crosses itself on the surface: trim by a simple loop.');
  if (Math.abs(area(out)) < (u1 - u0) * (v1 - v0) * 1e-6) throw new Error('The curve encloses nothing on the surface (it lies along it edge-on, or off its edge).');
  if (earlier.some(l => crossesAny(out, l.uv, false))) throw new Error('The curve crosses an earlier trim of the surface.');
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
  return loops.every(l => side(l, u, v, u1 - u0, v1 - v0) >= 0);
}

/**
 * The trimmed surface as a triangle mesh: an n × n grid of the domain, each triangle clipped where the
 * loops' signed distance (linear across it) crosses zero; normals from the surface at each vertex.
 */
export function trimmedMesh(s: Surface, loops: readonly TrimLoop[], n = 64): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } {
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(s), su = u1 - u0, sv = v1 - v0;
  const field = (u: number, v: number) => loops.reduce((m, l) => Math.min(m, side(l, u, v, su, sv)), Infinity);
  const F: number[][] = [];
  for (let i = 0; i <= n; i++) { const row: number[] = []; for (let j = 0; j <= n; j++) row.push(field(u0 + su * i / n, v0 + sv * j / n)); F.push(row); }
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [], seen = new Map<string, number>();
  const vertex = (u: number, v: number) => {
    const key = `${u},${v}`; let k = seen.get(key); if (k !== undefined) return k;
    const p = evaluateSurface(s, u, v), h = 1e-5;
    const ua = Math.max(u0, u - h * su), ub = Math.min(u1, u + h * su), va = Math.max(v0, v - h * sv), vb = Math.min(v1, v + h * sv);
    const du = sub3(evaluateSurface(s, ub, v), evaluateSurface(s, ua, v)), dv = sub3(evaluateSurface(s, u, vb), evaluateSurface(s, u, va));
    const c = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]], l = len3(c) || 1;
    k = pos.length / 3; pos.push(p[0], p[1], p[2]); nrm.push(c[0] / l, c[1] / l, c[2] / l); seen.set(key, k); return k;
  };
  // One triangle of the grid (corners in (u, v) with their field values), clipped to field ≥ 0.
  const clip = (t: [number, number, number][]) => {
    const keptPts: [number, number][] = [];
    for (let a = 0; a < 3; a++) {
      const p = t[a], q = t[(a + 1) % 3];
      if (p[2] >= 0) keptPts.push([p[0], p[1]]);
      if ((p[2] >= 0) !== (q[2] >= 0)) { const f = p[2] / (p[2] - q[2]); keptPts.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]); }
    }
    if (keptPts.length < 3) return;
    const ids = keptPts.map(([u, v]) => vertex(u, v));
    for (let k = 1; k + 1 < ids.length; k++) idx.push(ids[0], ids[k], ids[k + 1]);
  };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const c = (a: number, b: number): [number, number, number] => [u0 + su * a / n, v0 + sv * b / n, F[a][b]];
    clip([c(i, j), c(i + 1, j), c(i + 1, j + 1)]); clip([c(i, j), c(i + 1, j + 1), c(i, j + 1)]);
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint32Array(idx) };
}
