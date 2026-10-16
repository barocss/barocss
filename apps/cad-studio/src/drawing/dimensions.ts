// Dimensions on a drawing: what can be picked in a view (edge ends, circle centres, edges), how a
// dimension's references resolve against the current projection, and the value it reads — always
// from the model's 3D geometry in mm, so a dimension follows the part as it changes.
import type { BrepProjection, ProjectedCurve, ProjectedEdge } from '@barocss/cad';
import type { DimPoint, DrawingDimension, EdgeRef, Vec3, ViewId, XY } from './types';

const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub3 = (a: readonly number[], b: readonly number[]): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist3 = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** A model point in the view's 2D frame (mm). */
export const inView = (pr: BrepProjection, p: readonly number[]): XY => [dot(p, pr.right), dot(p, pr.up)];

/** A point a dimension can start or end at, in view coordinates. */
export interface SnapPoint { at: XY; ref: DimPoint }

/** Edge ends and circle centres of a view (one per position). */
export function snapPoints(pr: BrepProjection): SnapPoint[] {
  const out: SnapPoint[] = [];
  const add = (edge: ProjectedEdge, at: DimPoint['at'], p: readonly number[]) => {
    const q = inView(pr, p);
    if (out.some(s => Math.hypot(s.at[0] - q[0], s.at[1] - q[1]) < 1e-6)) return;
    out.push({ at: q, ref: { edge: edge.name, at, near: [p[0], p[1], p[2]] } });
  };
  for (const e of pr.edges) {
    if (e.ends) for (const p of e.ends) add(e, 'end', p);
    if (e.circle) add(e, 'center', e.circle.center);
  }
  return out;
}

/** Whether a circle shows true (round) in the view: its plane faces the viewer. */
export const roundIn = (pr: BrepProjection, e: ProjectedEdge) => !!e.circle && Math.abs(dot(e.circle.normal, pr.toward)) > 1 - 1e-6;

/** The nearest edge to a view point, within `tol` (view mm). */
export function edgeAt(pr: BrepProjection, p: XY, tol: number): ProjectedEdge | null {
  let best: ProjectedEdge | null = null, bestD = tol;
  for (const e of pr.edges) for (const piece of e.pieces) {
    const d = distanceTo(piece.curve, p);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

export function distanceTo(c: ProjectedCurve, p: XY): number {
  const seg = (a: readonly number[], b: readonly number[]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dd = dx * dx + dy * dy, t = dd > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / dd)) : 0;
    return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
  };
  if (c.kind === 'line') return seg(c.a, c.b);
  const pts = c.kind === 'polyline' ? c.points : arcPoints(c, 96);
  let d = Infinity; for (let k = 1; k < pts.length; k++) d = Math.min(d, seg(pts[k - 1], pts[k]));
  return d;
}

export function arcPoints(c: Extract<ProjectedCurve, { kind: 'arc' }>, n: number): XY[] {
  return Array.from({ length: n + 1 }, (_, k) => { const t = c.t0 + (c.t1 - c.t0) * k / n; return [c.center[0] + c.u[0] * Math.cos(t) + c.v[0] * Math.sin(t), c.center[1] + c.u[1] * Math.cos(t) + c.v[1] * Math.sin(t)] as XY; });
}

/** A dimension point on the current model (null: its edge is gone). */
export function resolvePoint(pr: BrepProjection, ref: DimPoint): Vec3 | null {
  const edges = pr.edges.filter(e => e.name === ref.edge);
  let best: Vec3 | null = null, bestD = Infinity;
  for (const e of edges) {
    const cands = ref.at === 'center' ? (e.circle ? [e.circle.center] : []) : (e.ends ?? []);
    for (const p of cands) { const d = dist3(p, ref.near); if (d < bestD) { bestD = d; best = [p[0], p[1], p[2]]; } }
  }
  return best;
}

export type Resolved =
  | { ok: true; kind: 'linear'; dim: Extract<DrawingDimension, { kind: 'linear' }>; a: XY; b: XY; value: number; text: string }
  | { ok: true; kind: 'diameter' | 'radius'; dim: Extract<DrawingDimension, { kind: 'diameter' | 'radius' }>; center: XY; radius: number; value: number; text: string }
  /** `vertex`: where the two lines meet; `from`/`to`: the sector's bounding directions (counter-clockwise from → to); `ends`: each edge's far end from the vertex. */
  | { ok: true; kind: 'angle'; dim: Extract<DrawingDimension, { kind: 'angle' }>; vertex: XY; from: XY; to: XY; ends: [XY, XY]; value: number; text: string }
  | { ok: false; dim: DrawingDimension; reason: string };

export const fmtMM = (v: number) => { const r = Math.round(v * 100) / 100; return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); };

/** Linear value between two model points as the dimension orients it. */
export function linearValue(pr: BrepProjection, a: readonly number[], b: readonly number[], orient: 'horizontal' | 'vertical' | 'aligned') {
  const d = sub3(b, a), du = dot(d, pr.right), dv = dot(d, pr.up);
  return orient === 'horizontal' ? Math.abs(du) : orient === 'vertical' ? Math.abs(dv) : Math.hypot(du, dv);
}

/** A straight edge on the current model: its two ends in view coordinates (null: gone, or not straight). */
export function resolveLine(pr: BrepProjection, ref: EdgeRef): [XY, XY] | null {
  let best: [XY, XY] | null = null, bestD = Infinity;
  for (const e of pr.edges) {
    if (e.name !== ref.edge || !e.ends || (e.kind !== 'line' && e.kind !== 'silhouette') || e.circle) continue;
    const [p, q] = e.ends, m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], d = dist3(m, ref.near);
    if (d < bestD) { bestD = d; best = [inView(pr, p), inView(pr, q)]; }
  }
  return best;
}

/**
 * The angle between two lines in a view, in the sector (of the four they make) that holds `place`:
 * degrees from the model's exact edge ends, as the lines show in the view.
 */
export function angleBetween(a: [XY, XY], b: [XY, XY], place: XY): { vertex: XY; from: XY; to: XY; ends: [XY, XY]; degrees: number } | null {
  const da: XY = [a[1][0] - a[0][0], a[1][1] - a[0][1]], db: XY = [b[1][0] - b[0][0], b[1][1] - b[0][1]];
  const den = da[0] * db[1] - da[1] * db[0], la = Math.hypot(...da), lb = Math.hypot(...db);
  if (Math.abs(den) <= 1e-9 * la * lb) return null; // parallel
  const t = ((b[0][0] - a[0][0]) * db[1] - (b[0][1] - a[0][1]) * db[0]) / den, X: XY = [a[0][0] + da[0] * t, a[0][1] + da[1] * t];
  const far = (l: [XY, XY]): XY => Math.hypot(l[0][0] - X[0], l[0][1] - X[1]) > Math.hypot(l[1][0] - X[0], l[1][1] - X[1]) ? l[0] : l[1];
  const rays = [[da[0] / la, da[1] / la], [-da[0] / la, -da[1] / la], [db[0] / lb, db[1] / lb], [-db[0] / lb, -db[1] / lb]].map(r => ({ r: r as XY, at: Math.atan2(r[1], r[0]) }));
  const at = Math.atan2(place[1] - X[1], place[0] - X[0]), norm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // The rays just before and after the placement direction (counter-clockwise), one from each line.
  const sorted = rays.map((r, k) => ({ ...r, line: k < 2 ? 0 : 1, off: norm(r.at - at) })).sort((p, q) => p.off - q.off);
  const to = sorted[0], from = sorted[sorted.length - 1];
  if (to.line === from.line) return null;
  const degrees = norm(to.at - from.at) * 180 / Math.PI;
  return { vertex: X, from: from.r, to: to.r, ends: [far(a), far(b)], degrees };
}

export function resolveDimension(views: Record<ViewId, BrepProjection>, dim: DrawingDimension): Resolved {
  const pr = views[dim.view];
  if (dim.kind === 'angle') {
    const a = resolveLine(pr, dim.a), b = resolveLine(pr, dim.b);
    if (!a || !b) return { ok: false, dim, reason: 'An edge it measured is no longer in the part.' };
    const g = angleBetween(a, b, dim.place);
    if (!g) return { ok: false, dim, reason: 'Its two edges are now parallel in this view.' };
    return { ok: true, kind: 'angle', dim, vertex: g.vertex, from: g.from, to: g.to, ends: g.ends, value: g.degrees, text: `${fmtMM(g.degrees)}°` };
  }
  if (dim.kind === 'linear') {
    const a = resolvePoint(pr, dim.a), b = resolvePoint(pr, dim.b);
    if (!a || !b) return { ok: false, dim, reason: 'An edge it measured is no longer in the part.' };
    const value = linearValue(pr, a, b, dim.orient);
    if (value < 1e-9) return { ok: false, dim, reason: 'Its two points now coincide in this view.' };
    return { ok: true, kind: 'linear', dim, a: inView(pr, a), b: inView(pr, b), value, text: fmtMM(value) };
  }
  let best: ProjectedEdge | null = null, bestD = Infinity;
  for (const e of pr.edges) if (e.name === dim.edge && e.circle) { const d = dist3(e.circle.center, dim.near); if (d < bestD) { bestD = d; best = e; } }
  if (!best?.circle) return { ok: false, dim, reason: 'The circle it measured is no longer in the part.' };
  if (!roundIn(pr, best)) return { ok: false, dim, reason: 'The circle no longer shows round in this view.' };
  const r = best.circle.radius, value = dim.kind === 'diameter' ? 2 * r : r;
  return { ok: true, kind: dim.kind, dim, center: inView(pr, best.circle.center), radius: r, value, text: (dim.kind === 'diameter' ? 'Ø' : 'R') + fmtMM(value) };
}

/**
 * How a linear dimension between two view points reads, from where it is placed: above or below
 * them (within their width) horizontal, beside them vertical, otherwise along them.
 */
export function orientFor(a: XY, b: XY, place: XY): 'horizontal' | 'vertical' | 'aligned' {
  const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]), tiny = 1e-6 * Math.max(1, dx, dy);
  if (dy <= tiny) return 'horizontal';
  if (dx <= tiny) return 'vertical';
  const inU = place[0] >= Math.min(a[0], b[0]) && place[0] <= Math.max(a[0], b[0]), inV = place[1] >= Math.min(a[1], b[1]) && place[1] <= Math.max(a[1], b[1]);
  if (inU && !inV) return 'horizontal';
  if (inV && !inU) return 'vertical';
  return 'aligned';
}

export const newDimensionId = (dims: readonly DrawingDimension[]) => { const used = new Set(dims.map(d => d.id)); let n = 1; while (used.has(`d${n}`)) n++; return `d${n}`; };
