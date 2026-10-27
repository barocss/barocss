// Recognising a NURBS patch as a surface of revolution: rows in one direction are circles about one
// axis (or poles), and the boundary across them is a line or an arc in a plane through the axis — the
// patches revolve, STEP import and drafted or rounded features make (cones, spheres, tori).
import { circleOf } from '../../brep/brep-tessellate.js';
import { cross, dot, len, scale, sub, unit } from '../../core/vec3.js';
import type { Point, Surface } from '../../types.js';

type XY = [number, number];
/** About the axis through c along a (frame e1, e2): the meridian profile in (ρ, h), h along a from c. */
export interface Revolution {
  readonly c: Point; readonly a: Point; readonly e1: Point; readonly e2: Point;
  readonly profile: { readonly kind: 'line'; readonly p: XY; readonly q: XY } | { readonly kind: 'arc'; readonly c: XY; readonly r: number };
  /** The patch: angles th0 → th0 + span about the axis; along the profile s0 → s1 (a line's share p → q, an arc's angle). */
  readonly patch?: { readonly th0: number; readonly span: number; readonly s0: number; readonly s1: number };
}
const TAU = 2 * Math.PI, wrap = (x: number) => ((x % TAU) + TAU) % TAU;
/** A point's place on a surface of revolution: its angle about the axis and its profile coordinate. */
export function revolutionCoords(R: Revolution, x: Point): [number, number] {
  const d = sub(x, R.c), h = dot(d, R.a), rho = len(sub(d, scale(R.a, h))), th = Math.atan2(dot(d, R.e2), dot(d, R.e1)), pr = R.profile;
  if (pr.kind === 'line') { const dx = pr.q[0] - pr.p[0], dy = pr.q[1] - pr.p[1]; return [th, ((rho - pr.p[0]) * dx + (h - pr.p[1]) * dy) / (dx * dx + dy * dy)]; }
  return [th, Math.atan2(h - pr.c[1], rho - pr.c[0])];
}
/** Whether a point's coordinates lie on the patch (with a margin in angle and profile). */
export function onPatch(R: Revolution, x: Point, margin = 1e-9): boolean {
  if (!R.patch) return true;
  const [th, s] = revolutionCoords(R, x), P = R.patch;
  if (wrap(th - P.th0 + margin) > P.span + 2 * margin) return false;
  if (R.profile.kind === 'line') return s >= P.s0 - margin && s <= P.s1 + margin;
  const lo = Math.min(P.s0, P.s1), hi = Math.max(P.s0, P.s1);
  return wrap(s - lo + margin) <= hi - lo + 2 * margin;
}

/**
 * How far a point lies inside the patch (> 0) or outside it (< 0): the nearer of its angle's distance from the patch's
 * ends and its profile coordinate's (each in its own units; the sign is what counts, and it is continuous across them).
 */
export function patchMargin(R: Revolution, x: Point): number {
  if (!R.patch) return Infinity;
  const [th, s] = revolutionCoords(R, x), P = R.patch, a = wrap(th - P.th0);
  const angle = a <= P.span ? Math.min(a, P.span - a) : -Math.min(a - P.span, TAU - a);
  if (R.profile.kind === 'line') return Math.min(angle, Math.min(s - P.s0, P.s1 - s));
  const lo = Math.min(P.s0, P.s1), hi = Math.max(P.s0, P.s1), w = wrap(s - lo);
  return Math.min(angle, w <= hi - lo ? Math.min(w, hi - lo - w) : -Math.min(w - (hi - lo), TAU - w));
}

export function revolutionOf(S: Surface, size: number): Revolution | null {
  for (const along of [0, 1] as const) {
    const rows = along === 0 ? S.controlPoints[0].map((_, j) => S.controlPoints.map(r => r[j])) : S.controlPoints;
    const wts = along === 0 ? S.weights[0].map((_, j) => S.weights.map(r => r[j])) : S.weights;
    const deg = along === 0 ? S.degreeU : S.degreeV, knots = along === 0 ? S.knotsU : S.knotsV;
    if (deg !== 2) continue;
    // (A row through an interior profile point has its weights scaled by that point's: the same circle.)
    const circles = rows.map((cps, j) => cps.every(q => len(sub(q as Point, cps[0] as Point)) < 1e-9 * size) ? 'pole' as const
      : circleOf({ kind: 'curve', id: 'r', degree: 2, knots: [...knots], controlPoints: cps, weights: wts[j].map(w => w / wts[j][0]) }));
    if (circles.some(c => c === null)) continue;
    const real = circles.filter((c): c is NonNullable<ReturnType<typeof circleOf>> => !!c && c !== 'pole');
    if (!real.length) continue;
    const a = unit(cross(real[0].e1, real[0].e2)), c = real[0].c;
    if (!real.every(q => len(cross(unit(cross(q.e1, q.e2)), a)) < 1e-9 && len(cross(sub(q.c, c), a)) < 1e-7 * size)) continue;
    const prof: Point[] = rows.map(r => r[0] as Point), pw = wts.map(w => w[0]), pk = along === 0 ? S.knotsV : S.knotsU, pd = along === 0 ? S.degreeV : S.degreeU;
    const e1 = unit(Math.abs(a[0]) < 0.9 ? cross([1, 0, 0], a) : cross([0, 1, 0], a)), e2 = cross(a, e1);
    const mer = (p: Point): XY => { const d = sub(p, c), h = dot(d, a); return [len(sub(d, scale(a, h))), h]; };
    // The patch's angles: those of a circle across it, from its start through its middle to its end.
    const row = circles.findIndex(q => q !== 'pole'), cps = rows[row], ang = (p: Point) => { const d = sub(p, c); return Math.atan2(dot(d, e2), dot(d, e1)); };
    const th0 = ang(cps[0] as Point), thE = wrap(ang(cps[cps.length - 1] as Point) - th0) || TAU, thM = wrap(ang(cps[Math.floor(cps.length / 2)] as Point) - th0);
    const span = thM <= thE ? thE : TAU - thE, start = thM <= thE ? th0 : th0 - span;
    if (pd === 1 && prof.length === 2) return { c, a, e1, e2, profile: { kind: 'line', p: mer(prof[0]), q: mer(prof[1]) }, patch: { th0: start, span, s0: 0, s1: 1 } };
    const k = circleOf({ kind: 'curve', id: 'p', degree: pd, knots: [...pk], controlPoints: prof, weights: pw.map(w => w / pw[0]) });
    if (k && Math.abs(dot(unit(cross(k.e1, k.e2)), a)) < 1e-9) {
      const C = mer(k.c), phi = (p: Point) => { const m = mer(p); return Math.atan2(m[1] - C[1], m[0] - C[0]); };
      const f0 = phi(prof[0]), fE = wrap(phi(prof[prof.length - 1]) - f0) || TAU, fM = wrap(phi(prof[Math.floor(prof.length / 2)]) - f0);
      const fs = fM <= fE ? fE : TAU - fE, fstart = fM <= fE ? f0 : f0 - fs;
      return { c, a, e1, e2, profile: { kind: 'arc', c: C, r: k.r }, patch: { th0: start, span, s0: fstart, s1: fstart + fs } };
    }
  }
  return null;
}

/** Where two meridian profiles cross, (ρ, h) — lines extended, circles whole; ρ ≥ 0 only. */
export function profileCrossings(A: Revolution['profile'], B: Revolution['profile'], tol: number): XY[] {
  const lineOf = (p: Revolution['profile'] & { kind: 'line' }) => { const d: XY = [p.q[0] - p.p[0], p.q[1] - p.p[1]], l = Math.hypot(d[0], d[1]); return { o: p.p, d: [d[0] / l, d[1] / l] as XY }; };
  const out: XY[] = [];
  if (A.kind === 'line' && B.kind === 'line') {
    const a = lineOf(A), b = lineOf(B), det = a.d[0] * -b.d[1] - a.d[1] * -b.d[0];
    if (Math.abs(det) < 1e-12) return [];
    const rx = b.o[0] - a.o[0], ry = b.o[1] - a.o[1], s = (rx * -b.d[1] - ry * -b.d[0]) / det;
    out.push([a.o[0] + a.d[0] * s, a.o[1] + a.d[1] * s]);
  } else if (A.kind === 'arc' && B.kind === 'arc') {
    const dx = B.c[0] - A.c[0], dy = B.c[1] - A.c[1], D = Math.hypot(dx, dy);
    if (D < tol || D > A.r + B.r + tol || D < Math.abs(A.r - B.r) - tol) return [];
    const x = (D * D + A.r * A.r - B.r * B.r) / (2 * D), h = Math.sqrt(Math.max(0, A.r * A.r - x * x)), ux = dx / D, uy = dy / D;
    out.push([A.c[0] + ux * x - uy * h, A.c[1] + uy * x + ux * h]); if (h > tol) out.push([A.c[0] + ux * x + uy * h, A.c[1] + uy * x - ux * h]);
  } else {
    const L = lineOf((A.kind === 'line' ? A : B) as Revolution['profile'] & { kind: 'line' }), C = (A.kind === 'arc' ? A : B) as Revolution['profile'] & { kind: 'arc' };
    const fx = L.o[0] - C.c[0], fy = L.o[1] - C.c[1], b = fx * L.d[0] + fy * L.d[1], cc = fx * fx + fy * fy - C.r * C.r, disc = b * b - cc;
    if (disc < -tol * tol) return [];
    const r = Math.sqrt(Math.max(0, disc));
    for (const s of r > tol ? [-b - r, -b + r] : [-b]) out.push([L.o[0] + L.d[0] * s, L.o[1] + L.d[1] * s]);
  }
  return out.filter(p => p[0] > -tol).map(p => [Math.max(0, p[0]), p[1]]);
}
