// Detail views (CG5, DR-1): a circle on a view or a section, and what lies inside it drawn larger elsewhere on the sheet.
// The detail is the parent's own exact projection clipped to the circle (lines and circular arcs at their crossings in
// closed form, elliptic arcs by bracketed roots of the distance), so it is exact wherever the parent is; its cut faces
// are the parent's rings clipped to the circle. Its dimensions resolve from the model as the parent's do (`detail:B`).
import type { BrepProjection, ProjectedCurve, ProjectedEdge, ProjectedPiece } from '@barocss/cad';
import { SCALES } from './views';
import type { XY } from './types';

/**
 * A detail (DR-1): its letter, the view or section it enlarges (`view`: front, top, right or `section:A`), the circle's
 * centre and radius in that view's coordinates (model mm), its scale (absolute, 5 = 5:1; absent: the smallest standard
 * scale at least twice the sheet's) and, placed by hand, its centre on the sheet (sheet mm; absent: laid out in free room).
 */
export interface DrawingDetail { id: string; view: DetailParent; center: XY; radius: number; scale?: number; at?: XY }
export type DetailParent = 'front' | 'top' | 'right' | `section:${string}`;
export const DETAIL_PARENTS = ['front', 'top', 'right'] as const;
export const isDetailParent = (v: unknown): v is DetailParent => typeof v === 'string' && ((DETAIL_PARENTS as readonly string[]).includes(v) || /^section:[A-Z]{1,2}$/.test(v));

/** The detail's scale: its own, or the smallest standard scale at least twice the sheet's (none: twice the sheet's). */
export function detailScale(d: Pick<DrawingDetail, 'scale'>, sheetScale: number): number {
  if (d.scale) return d.scale;
  const want = 2 * sheetScale * (1 - 1e-9), fit = SCALES.filter(s => s >= want);
  return fit.length ? fit[fit.length - 1] : 2 * sheetScale;
}

/** A saved or offered detail list: letters (one or two capitals) unique, a parent, a finite centre, a positive radius, a positive scale; none valid, null. */
export function readDetails(raw: unknown): DrawingDetail[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DrawingDetail[] = [];
  for (const x of raw) if (detailOk(x) && !out.some(o => o.id === x.id)) out.push({ id: x.id, view: x.view, center: [x.center[0], x.center[1]], radius: x.radius, ...(x.scale !== undefined ? { scale: x.scale } : {}), ...(x.at ? { at: [x.at[0], x.at[1]] as XY } : {}) });
  return out.length ? out : null;
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const xyOk = (p: unknown): p is XY => Array.isArray(p) && p.length === 2 && p.every(finite);
/** One detail as a file or a tool gives it (no other keys checked here: the tool's own check refuses them). */
export function detailOk(x: unknown): x is DrawingDetail {
  const d = x as DrawingDetail;
  return !!d && typeof d.id === 'string' && /^[A-Z]{1,2}$/.test(d.id) && isDetailParent(d.view) && xyOk(d.center) && finite(d.radius) && d.radius > 0 && d.radius <= 1e5
    && (d.scale === undefined || (finite(d.scale) && d.scale > 0 && d.scale <= 1000)) && (d.at === undefined || xyOk(d.at));
}

// ---- Clipping a projection to a disk ----

const EPS = 1e-12;
/** Where the segment a→b is inside the circle (c, r): its parameter interval in [0, 1], or null. */
export function segmentInDisk(a: readonly number[], b: readonly number[], c: readonly number[], r: number): [number, number] | null {
  const dx = b[0] - a[0], dy = b[1] - a[1], ex = a[0] - c[0], ey = a[1] - c[1];
  const A = dx * dx + dy * dy, B = 2 * (dx * ex + dy * ey), C = ex * ex + ey * ey - r * r;
  if (A < EPS) return C <= 0 ? [0, 1] : null;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return null;
  // (The stable pair of roots: q = −(B + sign(B)·√disc)/2, t = q/A and C/q.)
  const s = Math.sqrt(disc), q = -0.5 * (B + (B >= 0 ? s : -s)), t1 = q / A, t2 = q !== 0 ? C / q : -B / A - t1;
  const lo = Math.max(0, Math.min(t1, t2)), hi = Math.min(1, Math.max(t1, t2));
  return hi - lo > 1e-12 ? [lo, hi] : null;
}

/** The arc's points `center + u·cos t + v·sin t`. */
const arcAt = (c: Extract<ProjectedCurve, { kind: 'arc' }>, t: number): XY => [c.center[0] + c.u[0] * Math.cos(t) + c.v[0] * Math.sin(t), c.center[1] + c.u[1] * Math.cos(t) + c.v[1] * Math.sin(t)];
const distOut = (c: Extract<ProjectedCurve, { kind: 'arc' }>, t: number, o: readonly number[], r: number) => { const p = arcAt(c, t); return (p[0] - o[0]) ** 2 + (p[1] - o[1]) ** 2 - r * r; };
/** An arc's samples when its roots are bracketed (an elliptic arc): enough that two crossings never share a step. */
const ARC_SAMPLES = 720;
/**
 * The parameters in (t0, t1) where an arc crosses the circle (o, r), sorted. A circular arc's in closed form
 * (A cos t + B sin t = K); an elliptic one's by sign changes over samples, each refined by bisection to the last bit.
 */
export function arcCrossings(c: Extract<ProjectedCurve, { kind: 'arc' }>, o: readonly number[], r: number): number[] {
  const uu = c.u[0] * c.u[0] + c.u[1] * c.u[1], vv = c.v[0] * c.v[0] + c.v[1] * c.v[1], uv = c.u[0] * c.v[0] + c.u[1] * c.v[1];
  const lo = Math.min(c.t0, c.t1), hi = Math.max(c.t0, c.t1), out: number[] = [];
  if (Math.abs(uu - vv) <= 1e-12 * Math.max(1, uu) && Math.abs(uv) <= 1e-12 * Math.max(1, uu)) {
    const wx = c.center[0] - o[0], wy = c.center[1] - o[1];
    const A = 2 * (wx * c.u[0] + wy * c.u[1]), B = 2 * (wx * c.v[0] + wy * c.v[1]), K = r * r - wx * wx - wy * wy - uu, R = Math.hypot(A, B);
    if (R < EPS || Math.abs(K) >= R) return out;
    const phi = Math.atan2(B, A), a = Math.acos(K / R);
    for (const base of [phi + a, phi - a]) for (let k = Math.ceil((lo - base) / (2 * Math.PI)); base + 2 * Math.PI * k < hi; k++) { const t = base + 2 * Math.PI * k; if (t > lo) out.push(t); }
    return out.sort((x, y) => x - y);
  }
  const n = Math.max(8, Math.ceil(ARC_SAMPLES * (hi - lo) / (2 * Math.PI)));
  let ta = lo, fa = distOut(c, lo, o, r);
  for (let k = 1; k <= n; k++) {
    const tb = lo + (hi - lo) * k / n, fb = distOut(c, tb, o, r);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) out.push(bisect(c, ta, tb, fa, o, r));
    ta = tb; fa = fb;
  }
  return out;
}
function bisect(c: Extract<ProjectedCurve, { kind: 'arc' }>, a: number, b: number, fa: number, o: readonly number[], r: number): number {
  for (let k = 0; k < 100; k++) {
    const m = (a + b) / 2; if (m === a || m === b) break;
    const fm = distOut(c, m, o, r);
    if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

/** A curve's pieces inside the circle (o, r): lines and arcs cut at their crossings, a polyline into its inside runs. */
export function clipCurveToDisk(c: ProjectedCurve, o: readonly number[], r: number): ProjectedCurve[] {
  if (c.kind === 'line') {
    const t = segmentInDisk(c.a, c.b, o, r); if (!t) return [];
    return [{ kind: 'line', a: lerp(c.a, c.b, t[0]), b: lerp(c.a, c.b, t[1]) }];
  }
  if (c.kind === 'arc') {
    const lo = Math.min(c.t0, c.t1), hi = Math.max(c.t0, c.t1), cuts = [lo, ...arcCrossings(c, o, r), hi], out: ProjectedCurve[] = [];
    for (let k = 1; k < cuts.length; k++) {
      if (cuts[k] - cuts[k - 1] <= 1e-12) continue;
      if (distOut(c, (cuts[k - 1] + cuts[k]) / 2, o, r) > 0) continue;
      // (The arc's own direction kept: t0 > t1 runs backward.)
      out.push(c.t0 <= c.t1 ? { ...c, t0: cuts[k - 1], t1: cuts[k] } : { ...c, t0: cuts[k], t1: cuts[k - 1] });
    }
    return out;
  }
  const out: ProjectedCurve[] = [];
  let run: XY[] = [];
  for (let k = 1; k < c.points.length; k++) {
    const a = c.points[k - 1], b = c.points[k], t = segmentInDisk(a, b, o, r);
    if (!t) { if (run.length >= 2) out.push({ kind: 'polyline', points: run }); run = []; continue; }
    const p = lerp(a, b, t[0]), q = lerp(a, b, t[1]);
    if (!run.length || t[0] > 1e-12) { if (run.length >= 2) out.push({ kind: 'polyline', points: run }); run = [p]; }
    run.push(q);
    if (t[1] < 1 - 1e-12) { out.push({ kind: 'polyline', points: run }); run = []; }
  }
  if (run.length >= 2) out.push({ kind: 'polyline', points: run });
  return out;
}
const lerp = (a: readonly number[], b: readonly number[], t: number): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const inViewOf = (pr: BrepProjection, p: readonly number[]): XY => [p[0] * pr.right[0] + p[1] * pr.right[1] + p[2] * pr.right[2], p[0] * pr.up[0] + p[1] * pr.up[1] + p[2] * pr.up[2]];
const inDisk = (p: readonly number[], o: readonly number[], r: number) => (p[0] - o[0]) ** 2 + (p[1] - o[1]) ** 2 <= r * r * (1 + 1e-12);
/**
 * A projection clipped to the circle (o, r): every edge with a piece inside it (each piece clipped), and — the parent
 * showing an edge with no pieces (it lies on visible ink) — that edge when an end or its centre is inside. Its extent is
 * the circle's square (the detail's own outline).
 */
export function clipProjectionToDisk(pr: BrepProjection, o: XY, r: number): BrepProjection {
  const edges: ProjectedEdge[] = [];
  for (const e of pr.edges) {
    if (!e.pieces.length) {
      let near = !!e.circle && inDisk(inViewOf(pr, e.circle.center), o, r);
      for (const p of e.ends ?? []) near ||= inDisk(inViewOf(pr, p), o, r);
      if (near) edges.push(e);
      continue;
    }
    const pieces: ProjectedPiece[] = [];
    for (const p of e.pieces) for (const c of clipCurveToDisk(p.curve, o, r)) pieces.push({ curve: c, visible: p.visible });
    if (pieces.length) edges.push({ ...e, pieces });
  }
  return { right: pr.right, up: pr.up, toward: pr.toward, edges, min: [o[0] - r, o[1] - r], max: [o[0] + r, o[1] + r] };
}

/** The sides of the polygon a ring is clipped by (the circle inscribed with so many sides: 2.5e-5 of the radius off at most, for hatching only). */
const RING_SIDES = 512;
/** Rings clipped to the circle (o, r) (Sutherland–Hodgman against the inscribed polygon), even–odd as before; empty rings dropped. */
export function clipRingsToDisk(rings: readonly (readonly XY[])[], o: XY, r: number): { rings: XY[][]; kept: number[] } {
  const out: XY[][] = [], kept: number[] = [];
  for (let k = 0; k < rings.length; k++) {
    let poly: XY[] = rings[k].map(copyXY);
    for (let s = 0; s < RING_SIDES && poly.length; s++) poly = clipHalf(poly, o, r, s);
    if (poly.length >= 3) { out.push(poly); kept.push(k); }
  }
  return { rings: out, kept };
}
const copyXY = (p: readonly number[]): XY => [p[0], p[1]];
/** The polygon's part inside side `s` of the inscribed polygon. */
function clipHalf(poly: readonly XY[], o: XY, r: number, s: number): XY[] {
  const a0 = 2 * Math.PI * s / RING_SIDES, a1 = 2 * Math.PI * (s + 1) / RING_SIDES;
  const A: XY = [o[0] + r * Math.cos(a0), o[1] + r * Math.sin(a0)], B: XY = [o[0] + r * Math.cos(a1), o[1] + r * Math.sin(a1)];
  const out: XY[] = [];
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length], sp = side(A, B, p), sq = side(A, B, q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
/** Left of A→B (the circle's inside, its sides running counter-clockwise): positive. */
const side = (A: XY, B: XY, p: readonly number[]) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]);

/** The next free letter for a section or a detail: letters are one namespace on a drawing (A, B, … Z; then AA, AB, …). */
export function nextLetter(used: Iterable<string>): string {
  const taken = new Set(used);
  for (let k = 0; ; k++) { const id = k < 26 ? String.fromCharCode(65 + k) : String.fromCharCode(64 + Math.floor(k / 26)) + String.fromCharCode(65 + k % 26); if (!taken.has(id)) return id; }
}
