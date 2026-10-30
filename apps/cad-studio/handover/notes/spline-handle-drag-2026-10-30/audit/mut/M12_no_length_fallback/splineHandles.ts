// D353: dragging a spline's tangent handles and fit points in the viewport (pure geometry; the Viewport wires the pointer).
import { splineAutoHandles, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';

type P2 = [number, number];
/** Screen length of a handle from its fit point to each end, and the pick radius (px). */
export const HANDLE_LENGTH = 30, HANDLE_PICK = 8;

export type SplineHandleHit = { kind: 'handle'; i: number; sign: 1 | -1 } | { kind: 'fit'; i: number };
export interface SplineHandleGeometry { c: P2; fwd: P2; back: P2 }

/** Per fit point: its screen centre and the handle ends (forward along the tangent, back opposite). `P` projects plane (u, v) to the screen. */
export function splineHandleGeometry(def: SplineDef, P: (u: number, v: number) => readonly number[]): SplineHandleGeometry[] {
  const auto = splineAutoHandles(def.fit, def.closed);
  return def.fit.map((f, i) => {
    const h = (def.handles?.[i] ?? auto[i]) * Math.PI / 180, c = P(f[0], f[1]), t = P(f[0] + Math.cos(h), f[1] + Math.sin(h));
    const l = Math.hypot(t[0] - c[0], t[1] - c[1]) || 0, dx = (t[0] - c[0]) / l * HANDLE_LENGTH, dy = (t[1] - c[1]) / l * HANDLE_LENGTH;
    return { c: [c[0], c[1]], fwd: [c[0] + dx, c[1] + dy], back: [c[0] - dx, c[1] - dy] };
  });
}

/** What the screen point (x, y) is on: a handle end first (nearest within 8 px), else a fit point (nearest within 8 px), else null. */
export function splineHandleHit(def: SplineDef, P: (u: number, v: number) => readonly number[], x: number, y: number): SplineHandleHit | null {
  const g = splineHandleGeometry(def, P);
  let best: SplineHandleHit | null = null, bd = HANDLE_PICK;
  g.forEach((k, i) => {
    for (const [sign, e] of [[1, k.fwd], [-1, k.back]] as const) {
      const d = Math.hypot(e[0] - x, e[1] - y);
      if (d <= bd) { bd = d; best = { kind: 'handle', i, sign }; }
    }
  });
  if (best) return best;
  bd = HANDLE_PICK;
  g.forEach((k, i) => { const d = Math.hypot(k.c[0] - x, k.c[1] - y); if (d <= bd) { bd = d; best = { kind: 'fit', i }; } });
  return best;
}

/** An angle in degrees as the equivalent one in (-180, 180]. */
const norm = (a: number) => { let r = a % 360; if (r > 180) r -= 360; else if (r <= -180) r += 360; return r; };

/**
 * The definition with the dragged handle or fit point at the plane point `p`. A handle end turns the tangent to point at `p`
 * (whole degrees, 0.1° with `fine`); a fit point moves to `p` on the grid (`step` mm, default 1; 0.01 mm with `fine`).
 * The grid rounding matches the Viewport's snap (to 1e-3).
 */
export function draggedSpline(def: SplineDef, hit: SplineHandleHit, p: readonly [number, number], opts: { fine?: boolean; step?: number } = {}): SplineDef {
  if (hit.kind === 'fit') {
    const st = opts.fine ? 0.01 : opts.step ?? 1, q = (v: number) => st > 0 ? Math.round(Math.round(v / st) * st * 1000) / 1000 : Math.round(v * 1000) / 1000;
    const fit = def.fit.map((f, k) => k === hit.i ? [q(p[0]), q(p[1])] as P2 : [f[0], f[1]] as P2);
    return { ...def, fit, ...(def.handles ? { handles: [...def.handles] } : {}) };
  }
  const f = def.fit[hit.i], dx = p[0] - f[0], dy = p[1] - f[1];
  const fit = def.fit.map(k => [k[0], k[1]] as P2);
  const handles = def.fit.map((_, k) => def.handles?.[k] ?? null);
  if (!(Math.hypot(dx, dy) > 1e-9)) return { ...def, fit, handles };
  const raw = Math.atan2(dy, dx) * 180 / Math.PI + (hit.sign === -1 ? 180 : 0), st = opts.fine ? 0.1 : 1;
  handles[hit.i] = norm(Math.round(Math.round(raw / st) * st * 10) / 10);
  return { ...def, fit, handles };
}
