// An open surface thickened into a solid: the surface and its offset along the normal (∂S/∂u × ∂S/∂v,
// or the other way, or half each way) joined round the four edges, as one faceted closed mesh sampled
// on a grid. An offset deeper than the surface's tightest curve folds over itself; nothing checks that.
import { brepFromTriangles } from './mesh-brep.js';
import { evaluateSurface, surfaceDomain } from './math.js';
import { evaluateSurfaceD1 } from './derivatives.js';
import type { Brep } from './brep-core.js';
import type { Point, Surface } from './types.js';

export interface ThickenSolidRequest {
  readonly id?: string;
  readonly surface: Surface;
  /** The wall, mm. */
  readonly thickness: number;
  /** Which way: along the normal (default), against it, or half each way. */
  readonly side?: 'normal' | 'reverse' | 'both';
  /** Samples each way (default 40). */
  readonly grid?: number;
}

const sub = (a: readonly number[], b: readonly number[]): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: readonly number[], b: readonly number[]): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function thickenSolid(req: ThickenSolidRequest): Brep {
  const t = req.thickness, n = req.grid ?? 40;
  if (!(t > 0)) throw new RangeError('a thickness must be positive');
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(req.surface), s = req.surface;
  const [lo, hi] = req.side === 'reverse' ? [-t, 0] : req.side === 'both' ? [-t / 2, t / 2] : [0, t];
  const at = (i: number, j: number) => [u0 + (u1 - u0) * i / n, v0 + (v1 - v0) * j / n] as const;
  // The unit normal at a sample: from the derivatives, else from neighbouring samples (a corner, a pole).
  const normal = (u: number, v: number): Point => {
    let d: Point;
    try { const r = evaluateSurfaceD1(s, u, v); d = cross(r.du, r.dv); } catch { d = [0, 0, 0]; }
    if (!(Math.hypot(...d) > 1e-12)) {
      const h = 1e-4, uu = Math.min(u1, Math.max(u0, u)), vv = Math.min(v1, Math.max(v0, v));
      const du = sub(evaluateSurface(s, Math.min(u1, uu + h * (u1 - u0)), vv), evaluateSurface(s, Math.max(u0, uu - h * (u1 - u0)), vv));
      const dv = sub(evaluateSurface(s, uu, Math.min(v1, vv + h * (v1 - v0))), evaluateSurface(s, uu, Math.max(v0, vv - h * (v1 - v0))));
      d = cross(du, dv);
    }
    const l = Math.hypot(...d); if (!(l > 1e-12)) throw new RangeError('the surface has no normal at a point (it is degenerate there)');
    return [d[0] / l, d[1] / l, d[2] / l];
  };
  const pos: number[] = [], idx: number[] = [];
  // Two sheets: the inner one (lo) and the outer one (hi) along the normal.
  const sheet = (k: number) => { const out: number[][] = []; for (let i = 0; i <= n; i++) { const row: number[] = []; for (let j = 0; j <= n; j++) { const [u, v] = at(i, j), p = evaluateSurface(s, u, v), nn = normal(u, v); pos.push(p[0] + nn[0] * k, p[1] + nn[1] * k, p[2] + nn[2] * k); row.push(pos.length / 3 - 1); } out.push(row); } return out; };
  const A = sheet(lo), B = sheet(hi);
  const quad = (a: number, b: number, c: number, d: number) => idx.push(a, b, c, a, c, d);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    quad(B[i][j], B[i + 1][j], B[i + 1][j + 1], B[i][j + 1]); // outer: facing along the normal
    quad(A[i][j], A[i][j + 1], A[i + 1][j + 1], A[i + 1][j]); // inner: facing back
  }
  // The four edges' walls, between the sheets.
  for (let k = 0; k < n; k++) {
    quad(A[k][0], A[k + 1][0], B[k + 1][0], B[k][0]);
    quad(A[n][k], A[n][k + 1], B[n][k + 1], B[n][k]);
    quad(A[k + 1][n], A[k][n], B[k][n], B[k + 1][n]);
    quad(A[0][k + 1], A[0][k], B[0][k], B[0][k + 1]);
  }
  return brepFromTriangles(pos, idx, { id: req.id ?? 'thicken', maximumTriangles: 400_000 });
}
