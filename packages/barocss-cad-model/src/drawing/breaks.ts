// Broken views (CG5, DR-2): a band of a long part taken out of the views along a model axis, the far side drawn closer
// with a small gap and break lines. A break is in model terms (an axis and an interval), so every orthographic view that
// shows that axis across or up is broken the same way and the views stay in projection. The views' exact curves are
// clipped outside the band (lines and arcs at the band's sides in closed form); a view point maps to the sheet through
// the breaks before the view's scale (`toSheet`), so dimensions, marks and leaders follow, and a dimension across a break
// reads its true length while drawn shorter.
import type { BrepProjection, ProjectedCurve, ProjectedEdge, ProjectedPiece } from '@barocss/cad';
import type { XY } from './types';

/** A break (DR-2): the part between `from` and `to` along a model axis (mm) left out of the orthographic views. */
export interface DrawingBreak { axis: 'x' | 'y' | 'z'; from: number; to: number }
export const BREAK_AXES = ['x', 'y', 'z'] as const;
/** The gap a break leaves on the paper (sheet mm), between its two break lines. */
export const BREAK_GAP = 6;
/** A break in a view's coordinates: along its horizontal (0) or vertical (1) axis, `from` < `to`; `gap` the model mm the band shrinks to. */
export interface ViewBreak { axis: 0 | 1; from: number; to: number; gap: number }

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** One break as a file or a tool gives it. */
export const breakOk = (x: unknown): x is DrawingBreak => { const b = x as DrawingBreak; return !!b && (BREAK_AXES as readonly string[]).includes(b.axis) && finite(b.from) && finite(b.to) && b.from < b.to; };
/** Two breaks on one axis that overlap or touch (they would not read as two). */
export const breaksMeet = (a: DrawingBreak, b: DrawingBreak) => a.axis === b.axis && a.from <= b.to && b.from <= a.to;
/** A saved break list: valid ones, none meeting an earlier one on its axis; none valid, null. */
export function readBreaks(raw: unknown): DrawingBreak[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DrawingBreak[] = [];
  for (const x of raw) if (breakOk(x) && !out.some(o => breaksMeet(o, x))) out.push({ axis: x.axis, from: x.from, to: x.to });
  return out.length ? out : null;
}

const K = { x: 0, y: 1, z: 2 } as const;
/**
 * The breaks of a view (unshifted view coordinates, sorted, gap 0): each break whose axis lies across (0) or up (1) the
 * view, its interval cut to the view's extent; one beyond the part is none. A view looking along the axis has none.
 */
export function viewBreaksOf(pr: Pick<BrepProjection, 'right' | 'up' | 'min' | 'max'>, breaks: readonly DrawingBreak[] | undefined): ViewBreak[] {
  const out: ViewBreak[] = [];
  for (const b of breaks ?? []) {
    const k = K[b.axis], across = Math.abs(pr.right[k]) > 0.5, up = Math.abs(pr.up[k]) > 0.5;
    if (!across && !up) continue;
    const axis: 0 | 1 = across ? 0 : 1, sign = axis === 0 ? Math.sign(pr.right[k]) : Math.sign(pr.up[k]), a = sign * b.from, c = sign * b.to;
    const from = Math.max(Math.min(a, c), pr.min[axis]), to = Math.min(Math.max(a, c), pr.max[axis]);
    if (to - from > 1e-9) out.push({ axis, from, to, gap: 0 });
  }
  return out.sort((p, q) => p.axis - q.axis || p.from - q.from);
}
/** The model mm a view's breaks take out along an axis, and how many there are. */
export function removedAlong(breaks: readonly ViewBreak[], axis: 0 | 1): { length: number; count: number } {
  let length = 0, count = 0;
  for (const b of breaks) if (b.axis === axis) { length += b.to - b.from; count++; }
  return { length, count };
}

/** A view coordinate along one axis through the breaks: past a break shifted back by its band less its gap; inside one, the band squeezed to the gap. */
export function throughBreaks(breaks: readonly ViewBreak[], axis: 0 | 1, w: number): number {
  let shift = 0;
  for (const b of breaks) {
    if (b.axis !== axis) continue;
    if (w >= b.to) shift += b.to - b.from - b.gap;
    else if (w > b.from) { shift += (w - b.from) * (1 - b.gap / (b.to - b.from)); break; }
    else break;
  }
  return w - shift;
}
/** The inverse of `throughBreaks`. */
export function backThroughBreaks(breaks: readonly ViewBreak[], axis: 0 | 1, w: number): number {
  let shift = 0;
  for (const b of breaks) {
    if (b.axis !== axis) continue;
    const from = b.from - shift, to = from + b.gap;
    if (w >= to) shift += b.to - b.from - b.gap;
    else if (w > from) return b.from + (w - from) * ((b.to - b.from) / (b.gap || 1));
    else break;
  }
  return w + shift;
}
export const breakPoint = (breaks: readonly ViewBreak[], p: readonly number[]): XY => [throughBreaks(breaks, 0, p[0]), throughBreaks(breaks, 1, p[1])];
export const unbreakPoint = (breaks: readonly ViewBreak[], p: readonly number[]): XY => [backThroughBreaks(breaks, 0, p[0]), backThroughBreaks(breaks, 1, p[1])];

// ---- Clipping outside the bands ----

const lerp = (a: readonly number[], b: readonly number[], t: number): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const outside = (w: number, b: ViewBreak) => w <= b.from + 1e-12 || w >= b.to - 1e-12;
/** The arc's parameters in (lo, hi) where its coordinate along `axis` is `w`: A cos t + B sin t = w − c, in closed form (an ellipse's too). */
function arcAt(c: Extract<ProjectedCurve, { kind: 'arc' }>, axis: 0 | 1, w: number, lo: number, hi: number, out: number[]): void {
  const A = c.u[axis], B = c.v[axis], Kw = w - c.center[axis], R = Math.hypot(A, B);
  if (R < 1e-15 || Math.abs(Kw) >= R) return;
  const phi = Math.atan2(B, A), a = Math.acos(Kw / R);
  for (const base of [phi + a, phi - a]) for (let k = Math.ceil((lo - base) / (2 * Math.PI)); base + 2 * Math.PI * k < hi; k++) { const t = base + 2 * Math.PI * k; if (t > lo) out.push(t); }
}
const arcCoord = (c: Extract<ProjectedCurve, { kind: 'arc' }>, axis: 0 | 1, t: number) => c.center[axis] + c.u[axis] * Math.cos(t) + c.v[axis] * Math.sin(t);
/** A curve's pieces outside a break's band. */
export function clipCurveOutside(c: ProjectedCurve, b: ViewBreak): ProjectedCurve[] {
  const k = b.axis;
  if (c.kind === 'line') return segmentOutside(c.a, c.b, b).map(([s, t]) => ({ kind: 'line', a: lerp(c.a, c.b, s), b: lerp(c.a, c.b, t) }));
  if (c.kind === 'arc') {
    const lo = Math.min(c.t0, c.t1), hi = Math.max(c.t0, c.t1), cuts = [lo];
    arcAt(c, k, b.from, lo, hi, cuts); arcAt(c, k, b.to, lo, hi, cuts); cuts.push(hi); cuts.sort((x, y) => x - y);
    const out: ProjectedCurve[] = [];
    for (let i = 1; i < cuts.length; i++) {
      if (cuts[i] - cuts[i - 1] <= 1e-12 || !outside(arcCoord(c, k, (cuts[i - 1] + cuts[i]) / 2), b)) continue;
      out.push(c.t0 <= c.t1 ? { ...c, t0: cuts[i - 1], t1: cuts[i] } : { ...c, t0: cuts[i], t1: cuts[i - 1] });
    }
    return out;
  }
  const out: ProjectedCurve[] = [];
  let run: XY[] = [];
  for (let i = 1; i < c.points.length; i++) {
    const a = c.points[i - 1], q = c.points[i];
    for (const [s, t] of segmentOutside(a, q, b)) {
      const p0 = lerp(a, q, s), p1 = lerp(a, q, t);
      if (!run.length || s > 1e-12) { if (run.length >= 2) out.push({ kind: 'polyline', points: run }); run = [p0]; }
      run.push(p1);
      if (t < 1 - 1e-12) { out.push({ kind: 'polyline', points: run }); run = []; }
    }
  }
  if (run.length >= 2) out.push({ kind: 'polyline', points: run });
  return out;
}
/** The parameter intervals of the segment a→b outside the band (at most two). */
function segmentOutside(a: readonly number[], q: readonly number[], b: ViewBreak): [number, number][] {
  const k = b.axis, wa = a[k], wq = q[k], d = wq - wa;
  if (Math.abs(d) < 1e-15) return outside(wa, b) ? [[0, 1]] : [];
  const t0 = (b.from - wa) / d, t1 = (b.to - wa) / d, lo = Math.min(t0, t1), hi = Math.max(t0, t1), out: [number, number][] = [];
  if (lo > 1e-12) out.push([0, Math.min(1, lo)]);
  if (hi < 1 - 1e-12) out.push([Math.max(0, hi), 1]);
  return out.filter(([s, t]) => t - s > 1e-12);
}
/** A projection with every piece clipped outside the breaks' bands (unshifted coordinates; `toSheet` shifts them). Edges left with no piece are dropped unless they had none. */
export function clipProjectionOutside(pr: BrepProjection, breaks: readonly ViewBreak[]): BrepProjection {
  if (!breaks.length) return pr;
  const edges: ProjectedEdge[] = [];
  for (const e of pr.edges) {
    if (!e.pieces.length) { edges.push(e); continue; }
    let pieces: ProjectedPiece[] = [...e.pieces];
    for (const b of breaks) { const next: ProjectedPiece[] = []; for (const p of pieces) for (const c of clipCurveOutside(p.curve, b)) next.push({ curve: c, visible: p.visible }); pieces = next; }
    if (pieces.length) edges.push({ ...e, pieces });
  }
  return { ...pr, edges };
}
/** Rings clipped outside the bands: each band splits a ring into its parts before and after (Sutherland–Hodgman against each side). */
export function clipRingsOutside(rings: readonly (readonly XY[])[], breaks: readonly ViewBreak[]): { rings: XY[][]; kept: number[] } {
  let cur: { ring: XY[]; k: number }[] = rings.map((r, k) => ({ ring: r.map(copyXY), k }));
  for (const b of breaks) {
    const next: { ring: XY[]; k: number }[] = [];
    for (const { ring, k } of cur) for (const side of [-1, 1] as const) { const part = halfPlane(ring, b.axis, side < 0 ? b.from : b.to, side); if (part.length >= 3) next.push({ ring: part, k }); }
    cur = next;
  }
  return { rings: cur.map(x => x.ring), kept: cur.map(x => x.k) };
}
const copyXY = (p: readonly number[]): XY => [p[0], p[1]];
/** The polygon's part with coordinate ≤ w (side −1) or ≥ w (side 1) along `axis`. */
function halfPlane(poly: readonly XY[], axis: 0 | 1, w: number, side: -1 | 1): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side * (p[axis] - w), sq = side * (q[axis] - w);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) out.push(lerp(p, q, sp / (sp - sq)));
  }
  return out;
}

/** The part's span along a model axis (mm), read from the first orthographic view that shows it across or up; null if none does. */
export function partSpan(views: Readonly<Record<'front' | 'top' | 'right', Pick<BrepProjection, 'right' | 'up' | 'min' | 'max'>>>, axis: DrawingBreak['axis']): [number, number] | null {
  const k = K[axis];
  for (const id of ['front', 'top', 'right'] as const) {
    const pr = views[id], across = Math.abs(pr.right[k]) > 0.5, up = Math.abs(pr.up[k]) > 0.5;
    if (!across && !up) continue;
    const i = across ? 0 : 1, sign = across ? Math.sign(pr.right[k]) : Math.sign(pr.up[k]), a = sign * pr.min[i], b = sign * pr.max[i];
    return [Math.min(a, b), Math.max(a, b)];
  }
  return null;
}
/** A first break for a part: its middle third along its longest axis (whole mm), clear of the breaks it has; null when none fits. */
export function suggestBreak(views: Parameters<typeof partSpan>[0], have: readonly DrawingBreak[] = []): DrawingBreak | null {
  let best: { axis: DrawingBreak['axis']; lo: number; hi: number } | null = null;
  for (const axis of BREAK_AXES) { const s = partSpan(views, axis); if (s && (!best || s[1] - s[0] > best.hi - best.lo)) best = { axis, lo: s[0], hi: s[1] }; }
  if (!best) return null;
  const L = best.hi - best.lo, b: DrawingBreak = { axis: best.axis, from: Math.round(best.lo + L / 3), to: Math.round(best.hi - L / 3) };
  return b.from < b.to && !have.some(o => breaksMeet(o, b)) ? b : null;
}
