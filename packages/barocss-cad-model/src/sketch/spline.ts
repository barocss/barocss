// Splines in a sketch: a smooth curve through the clicked points, kept as the outline the kernel builds
// on — tangent arcs (biarcs): between each two points two arcs meet tangentially, the first leaving the
// point along the curve's tangent there and the second arriving along the next. Tangents are the chords
// round each point (Catmull–Rom), and the ends' follow the end chords. The joints are kept exactly as computed
// (unrounded: both arcs meet tangent) and the fit points unchanged. The result is a polygon outline
// with bulges, so it extrudes, dimensions and trims like any line-and-arc outline.
import type { SketchShape } from './types';
import { arcOf } from './profile';
type P2 = [number, number];

const unit = (v: P2): P2 => { const l = Math.hypot(v[0], v[1]); return l > 0 ? [v[0] / l, v[1] / l] : [1, 0]; };
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const dot = (a: P2, b: P2) => a[0] * b[0] + a[1] * b[1];
const cross = (a: P2, b: P2) => a[0] * b[1] - a[1] * b[0];

/** The arc from a to b leaving a along t, as a bulge (tan of a quarter of its sweep; 0 when straight). */
function bulgeLeaving(a: P2, t: P2, b: P2): number {
  const ch = sub(b, a); if (!(Math.hypot(ch[0], ch[1]) > 1e-12)) return 0;
  // The tangent turned to the chord: half the arc's sweep (anticlockwise positive).
  const half = Math.atan2(cross(t, ch), dot(t, ch));
  return Math.abs(half) < 1e-9 ? 0 : Math.tan(half / 2);
}

/** The points' tangents: along the chord through the neighbours; at an open curve's end, the next tangent reflected in the end chord. */
export function splineTangents(points: readonly P2[], closed: boolean): P2[] {
  const n = points.length;
  const inner = (i: number) => unit(sub(points[(i + 1) % n], points[(i - 1 + n) % n]));
  const reflect = (t: P2, chord: P2): P2 => { const c = unit(chord), k = 2 * dot(c, t); return unit([k * c[0] - t[0], k * c[1] - t[1]]); };
  return points.map((_, i) => {
    if (closed) return inner(i);
    if (n === 2) return unit(sub(points[1], points[0]));
    if (i === 0) return reflect(inner(1), sub(points[1], points[0]));
    if (i === n - 1) return reflect(inner(n - 2), sub(points[n - 1], points[n - 2]));
    return inner(i);
  });
}

/** Two tangent arcs from p1 (along t1) to p2 (arriving along t2), meeting at a joint: [joint, bulge1, bulge2]. */
function biarc(p1: P2, t1: P2, p2: P2, t2: P2): [P2, number, number] | null {
  const v = sub(p2, p1), t: P2 = [t1[0] + t2[0], t1[1] + t2[1]], vt = dot(v, t), vv = dot(v, v), c = 1 - dot(t1, t2);
  if (!(vv > 1e-18)) return null;
  // Equal tangent lengths d at both ends (Ryan Juckett's biarc): d = vv / (vt + S) = (S - vt) / 2c with S = sqrt(vt² + 2c·vv),
  // each form taken where it does not cancel (vt >= 0 resp. vt < 0).
  const S = Math.sqrt(vt * vt + 2 * c * vv);
  const d = vt >= 0 ? (vt + S > 0 ? vv / (vt + S) : NaN) : c > 1e-12 ? (S - vt) / (2 * c) : Math.abs(dot(v, t2)) > 1e-12 ? vv / (4 * dot(v, t2)) : NaN;
  if (!(d > 0) || !Number.isFinite(d)) return null;
  const q1: P2 = [p1[0] + d * t1[0], p1[1] + d * t1[1]], q2: P2 = [p2[0] - d * t2[0], p2[1] - d * t2[1]], joint: P2 = [(q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2];
  const tm = unit(sub(q2, q1));
  return [joint, bulgeLeaving(p1, t1, joint), bulgeLeaving(joint, tm, p2)];
}

/** The fit indices kept: a point equal to the one before it is skipped, and a closed curve's repeated last point. */
function keptIndices(points: readonly P2[], closed: boolean): number[] {
  const idx = points.map((_, i) => i).filter(i => i === 0 || Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]) > 1e-9);
  if (closed && idx.length > 2 && Math.hypot(points[idx[0]][0] - points[idx[idx.length - 1]][0], points[idx[0]][1] - points[idx[idx.length - 1]][1]) < 1e-9) idx.pop();
  return idx;
}
/** The tangent directions: a given handle (degrees, direction of travel) where set, else the automatic one. */
function directions(pts: readonly P2[], closed: boolean, handles: readonly (number | null)[] | undefined, idx: readonly number[]): P2[] {
  const T = splineTangents(pts, closed);
  return T.map((t, i) => { const h = handles?.[idx[i]]; return typeof h === 'number' && Number.isFinite(h) ? [Math.cos(h * Math.PI / 180), Math.sin(h * Math.PI / 180)] as P2 : t; });
}

/**
 * The spline through the points as a polygon outline of tangent arcs: always two pieces per span (a biarc, or two straight halves
 * meeting at the span's midpoint when it is straight or has no biarc), so the outline has 2 × spans points (+1 when open) whatever the
 * handles are. `handles[i]`: the tangent direction at fit point i in degrees (anticlockwise from +X); null / missing: automatic.
 */
export function splineOutline(points: readonly P2[], closed: boolean, handles?: readonly (number | null)[]): { points: P2[]; bulges: number[] } {
  const idx = keptIndices(points, closed), pts = idx.map(i => points[i]);
  if (pts.length < 2) return { points: [...pts], bulges: pts.map(() => 0) };
  const T = directions(pts, closed, handles, idx), out: P2[] = [], bulges: number[] = [], spans = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < spans; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ba = biarc(a, T[i], b, T[(i + 1) % pts.length]);
    out.push(a);
    if (!ba || (Math.abs(ba[1]) < 1e-9 && Math.abs(ba[2]) < 1e-9)) { out.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); bulges.push(0, 0); continue; }
    out.push(ba[0]); bulges.push(ba[1], ba[2]);
  }
  if (!closed) { out.push(pts[pts.length - 1]); bulges.push(0); }
  return { points: out, bulges };
}

/** The automatic tangent direction at each fit point, in degrees (what a null handle means). */
export function splineAutoHandles(fit: readonly P2[], closed: boolean): number[] {
  const idx = keptIndices(fit, closed), out = fit.map(() => 0);
  // (The first click of the Spline tool is one fit point: no direction yet.)
  if (idx.length < 2) return out;
  const T = splineTangents(idx.map(i => fit[i]), closed);
  idx.forEach((k, i) => { out[k] = Math.atan2(T[i][1], T[i][0]) * 180 / Math.PI; });
  return out;
}

/** A spline kept with its fit points: `handles[i]` is the tangent direction at fit point i in degrees (anticlockwise from +X, direction of travel); null / missing is automatic. */
export interface SplineDef { fit: [number, number][]; closed: boolean; handles?: (number | null)[] }

type Poly = Extract<SketchShape, { kind: 'polygon' }>;
const copyDef = (d: SplineDef): SplineDef => ({ fit: d.fit.map(p => [p[0], p[1]] as [number, number]), closed: d.closed, ...(d.handles ? { handles: [...d.handles] } : {}) });

/** The polygon of a spline definition (a Spline-tool outline: closing infers only tangency). */
export function splineShape(def: SplineDef): Poly {
  const o = splineOutline(def.fit, def.closed, def.handles);
  return { kind: 'polygon', points: o.points, bulges: o.bulges, closed: def.closed, fromSpline: true, spline: copyDef(def) };
}

/** The spline polygon regenerated from `def`: ids, attached circles and tangent joints kept (its point count is stable); every other constraint dropped (points and handles drive it). */
export function respline(s: Poly, def: SplineDef): Poly {
  const o = splineOutline(def.fit, def.closed, def.handles), out: Poly = { ...s, points: o.points, bulges: o.bulges, closed: def.closed, fromSpline: true, spline: copyDef(def) };
  for (const k of ['lengths', 'radii', 'equalRadii', 'concentric', 'rules', 'hv'] as const) delete out[k];
  return out;
}

/** Whether a polygon's points and bulges are the outline `o` within 1e-8·size mm and 1e-10·size (`size`: at least 100: the closing solve may move points by solver-scale amounts). */
export function outlineMatches(o: { points: P2[]; bulges: number[] }, s: Extract<SketchShape, { kind: 'polygon' }>, size: number): boolean {
  const n = o.points.length, tp = 1e-8 * size, tb = 1e-10 * size;
  if (n !== s.points.length || n !== (s.bulges?.length ?? n)) return false;
  for (let i = 0; i < n; i++) {
    if (Math.abs(o.points[i][0] - s.points[i][0]) > tp || Math.abs(o.points[i][1] - s.points[i][1]) > tp) return false;
    if (Math.abs(o.bulges[i] - (s.bulges?.[i] ?? 0)) > tb) return false;
  }
  return true;
}

/** Whether the polygon still is what its spline definition makes: points within 1e-8·size mm and bulges within 1e-10·size (the closing solve may move points by solver-scale amounts, so both tolerances grow with the size past 100 mm). */
export function splineMatches(s: Poly): boolean {
  const d = s.spline; if (!d || d.closed !== s.closed) return false;
  return outlineMatches(splineOutline(d.fit, d.closed, d.handles), s, Math.max(100, ...d.fit.map(p => Math.max(Math.abs(p[0]), Math.abs(p[1])))));
}

// The kernel's profile admission (packages/barocss-cad ExtrudedProfileLimits): coordinates within ±10000 mm, arc radius >= 0.01 mm,
// line length >= 1e-4 mm (part-model.ts xy(): "must be a finite length within ±10000 mm" for every segment centre).
const KERNEL_COORD = 10000, KERNEL_MIN_RADIUS = 0.01, KERNEL_MIN_LINE = 1e-4;
const inRange = (p: readonly number[]) => Math.abs(p[0]) <= KERNEL_COORD && Math.abs(p[1]) <= KERNEL_COORD;
const NO_PAIR = 'That handle or point leaves no arc pair the model can build to the next point.';

/** Why a definition cannot be built (null: fine): the generated outline must exist and be admitted by the kernel. Automatic outlines are not checked here. */
export function splineEditError(def: SplineDef): string | null {
  const n = def.fit.length;
  if (n < (def.closed ? 3 : 2)) return 'A spline needs more fit points.';
  if (def.fit.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1])) || def.handles?.some(h => h != null && !Number.isFinite(h))) return 'A fit point or handle is not a number.';
  const spans = def.closed ? n : n - 1;
  for (let i = 0; i < spans; i++) { const a = def.fit[i], b = def.fit[(i + 1) % n]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-9) return 'Two neighbouring fit points coincide.'; }
  // A span with a handle at either end needs its biarc (else the outline would silently ignore the handle).
  const T = directions(def.fit, def.closed, def.handles, def.fit.map((_, i) => i));
  for (let i = 0; i < spans; i++) {
    const j = (i + 1) % n;
    if (def.handles?.[i] != null || def.handles?.[j] != null) { if (!biarc(def.fit[i], T[i], def.fit[j], T[j])) return NO_PAIR; }
  }
  const o = splineOutline(def.fit, def.closed, def.handles), m = o.points.length;
  for (let k = 0; k < (def.closed ? m : m - 1); k++) {
    const a = o.points[k], b = o.points[(k + 1) % m], bulge = o.bulges[k];
    if (!Number.isFinite(bulge) || !inRange(a) || !inRange(b)) return NO_PAIR;
    if (!bulge) { if (Math.hypot(b[0] - a[0], b[1] - a[1]) < KERNEL_MIN_LINE) return NO_PAIR; continue; }
    const arc = arcOf(a, b, bulge);
    if (!(arc.radius >= KERNEL_MIN_RADIUS) || !Number.isFinite(arc.center[0]) || !Number.isFinite(arc.center[1]) || !inRange(arc.center)) return NO_PAIR;
  }
  return null;
}
