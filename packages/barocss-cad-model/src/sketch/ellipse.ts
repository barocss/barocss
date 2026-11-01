// Ellipses in a sketch: a centre, two semi-axes and the first axis's angle, kept as the outline the kernel builds on. A profile
// takes lines and arcs only, so the outline is the spline's tangent-arc (biarc) outline through ELLIPSE_POINTS points at equal
// steps of the ellipse's parameter, each leaving along the ellipse's exact tangent: 2 × ELLIPSE_POINTS points whatever the
// definition, so the side ids never change when it is edited. Make curves gives the exact ellipse instead (engine/curveSource.ts).
import type { SketchShape } from './types';
import { arcOf } from './profile';
import { outlineMatches, splineEditError, splineOutline } from './spline';
type P2 = [number, number];

/** The fit points of every ellipse outline (the outline has twice as many points). Measured: 96 holds ELLIPSE_TOLERANCE for every ratio down to 1 : 5 (48 gives 6.7e-5, 80 gives 1.2e-5). */
export const ELLIPSE_POINTS = 96;
/** The outline's largest distance from the true ellipse, relative to the longer semi-axis (ellipseDeviation measures it). */
export const ELLIPSE_TOLERANCE = 1e-5;
/** The narrowest supported ellipse: shorter semi-axis over longer. */
export const ELLIPSE_MIN_RATIO = 0.2;

/** An ellipse: `rx` and `ry` semi-axes in mm (> 0), `angle` the direction of the rx axis in degrees anticlockwise from +X. */
export interface EllipseDef { center: [number, number]; rx: number; ry: number; angle: number }

type Poly = Extract<SketchShape, { kind: 'polygon' }>;
/** An angle in degrees as stored: in [0, 360), never -0. */
export const normalAngle = (a: number): number => { const r = ((a % 360) + 360) % 360; return r === 0 ? 0 : r; };
const copyDef = (d: EllipseDef): EllipseDef => ({ center: [d.center[0], d.center[1]], rx: d.rx, ry: d.ry, angle: normalAngle(d.angle) });
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The fit points (parameter steps 2πk/N from the +rx end) and the tangent directions there in degrees. */
function fitOf(d: EllipseDef): { fit: P2[]; handles: number[] } {
  const a = d.angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), fit: P2[] = [], handles: number[] = [];
  for (let k = 0; k < ELLIPSE_POINTS; k++) {
    const t = 2 * Math.PI * k / ELLIPSE_POINTS, x = d.rx * Math.cos(t), y = d.ry * Math.sin(t);
    fit.push([d.center[0] + ca * x - sa * y, d.center[1] + sa * x + ca * y]);
    handles.push(Math.atan2(d.ry * Math.cos(t), -d.rx * Math.sin(t)) * 180 / Math.PI + d.angle);
  }
  return { fit, handles };
}

/** The ellipse as a closed polygon outline of tangent arcs: 2 × ELLIPSE_POINTS points, the fit points at the even indices. */
export function ellipseOutline(d: EllipseDef): { points: P2[]; bulges: number[] } {
  const { fit, handles } = fitOf(d);
  return splineOutline(fit, true, handles);
}

/** The polygon of an ellipse definition (an Ellipse-tool outline: closing infers nothing). */
export function ellipseShape(d: EllipseDef): Poly {
  const o = ellipseOutline(d);
  return { kind: 'polygon', points: o.points, bulges: o.bulges, closed: true, fromEllipse: true, ellipse: copyDef(d) };
}

/** The ellipse polygon regenerated from `d`: ids and attached circles kept (its point count is fixed); every other constraint dropped (the definition drives it). */
export function reellipse(s: Poly, d: EllipseDef): Poly {
  const o = ellipseOutline(d), out: Poly = { ...s, points: o.points, bulges: o.bulges, closed: true, fromEllipse: true, ellipse: copyDef(d) };
  for (const k of ['lengths', 'radii', 'tangents', 'equalRadii', 'concentric', 'rules', 'hv'] as const) delete out[k];
  return out;
}

/** Whether the polygon still is what its ellipse definition makes (tolerances as a spline's: 1e-8·size mm, 1e-10·size, size at least 100). */
export function ellipseMatches(s: Poly): boolean {
  const d = s.ellipse; if (!d || !s.closed || ellipseShapeError(d)) return false;
  return outlineMatches(ellipseOutline(d), s, Math.max(100, Math.abs(d.center[0]) + Math.max(d.rx, d.ry), Math.abs(d.center[1]) + Math.max(d.rx, d.ry)));
}

/** A stored ellipse definition as a copy only when well-formed (finite numbers, ellipseError null), else null. */
export function wellFormedEllipse(x: unknown): EllipseDef | null {
  const d = x as Partial<EllipseDef> | null | undefined;
  if (!d || typeof d !== 'object' || !Array.isArray(d.center) || d.center.length !== 2 || !d.center.every(num) || !num(d.rx) || !num(d.ry) || !num(d.angle)) return null;
  const def = copyDef(d as EllipseDef);
  return ellipseError(def) ? null : def;
}

/** Numbers and axis checks only (cheap: no outline). */
function ellipseShapeError(d: EllipseDef): string | null {
  if (!Array.isArray(d.center) || ![d.center[0], d.center[1], d.rx, d.ry, d.angle].every(num)) return 'The ellipse needs a centre, two semi-axes and an angle that are numbers.';
  if (Math.abs(d.angle) > 1e6) return 'The angle is not a usable number.';
  if (!(d.rx > 0 && d.ry > 0)) return 'Both semi-axes of an ellipse must be above 0.';
  return null;
}

/** Why a definition cannot be built (null: fine): numbers, axes above 0, no narrower than 1 : 5, and an outline the kernel admits (points and arc centres within ±10000 mm, arcs of at least 0.01 mm radius: a large narrow ellipse has far centres). */
export function ellipseError(d: EllipseDef): string | null {
  const why = ellipseShapeError(d); if (why) return why;
  if (Math.min(d.rx, d.ry) / Math.max(d.rx, d.ry) < ELLIPSE_MIN_RATIO - 1e-9) return 'A narrower ellipse than 1 : 5 is not supported; draw a slot or a spline instead.';
  const { fit, handles } = fitOf(d);
  if (splineEditError({ fit, closed: true, handles })) return 'The ellipse is too large, too small or too far out for the model: its points and arc centres must stay within ±10000 mm and its arcs have at least 0.01 mm radius.';
  return null;
}

/** The distance from (x, y) to the ellipse with semi-axes rx, ry about the origin (Newton on the parameter from the radial guess). */
function distanceTo(rx: number, ry: number, x: number, y: number): number {
  let t = Math.atan2(y / ry, x / rx);
  for (let i = 0; i < 8; i++) {
    const px = rx * Math.cos(t), py = ry * Math.sin(t), dx = -rx * Math.sin(t), dy = ry * Math.cos(t);
    const f = (px - x) * dx + (py - y) * dy, fp = dx * dx + dy * dy - (px - x) * px - (py - y) * py;
    if (!(Math.abs(fp) > 1e-300)) break;
    t -= f / fp;
  }
  return Math.hypot(rx * Math.cos(t) - x, ry * Math.sin(t) - y);
}

/** The largest distance (mm) from the outline of a definition to the true ellipse, each arc sampled at 65 points and measured by Newton steps on the parameter (for tests and docs: it is within ELLIPSE_TOLERANCE × the longer semi-axis). */
export function ellipseDeviation(d: EllipseDef): number {
  const o = ellipseOutline(d), n = o.points.length, a = -d.angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  let worst = 0;
  const at = (q: P2) => { const x = q[0] - d.center[0], y = q[1] - d.center[1]; worst = Math.max(worst, distanceTo(d.rx, d.ry, ca * x - sa * y, sa * x + ca * y)); };
  for (let i = 0; i < n; i++) {
    const p = o.points[i], q = o.points[(i + 1) % n], bulge = o.bulges[i];
    if (!bulge) { for (let k = 0; k <= 64; k++) at([p[0] + (q[0] - p[0]) * k / 64, p[1] + (q[1] - p[1]) * k / 64]); continue; }
    const arc = arcOf(p, q, bulge);
    for (let k = 0; k <= 64; k++) { const t = arc.start + arc.sweep * k / 64; at([arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t)]); }
  }
  return worst;
}

/** Why a fillet or chamfer on an ellipse's side edges is refused (the ellipse is 192 tangent arcs, so each side face is one and the kernel's rounding of them takes minutes). */
export const ELLIPSE_SIDE_EDGE_REFUSAL = 'Fillets and chamfers on an ellipse\'s side edges are not supported yet: the ellipse is 192 tangent arcs and the fillet would take minutes. Fillet a circle or slot instead, or make the shape from the exact curve (Make curves).';

type NodeLike = { id?: string; kind: string; sketch?: unknown; outline?: { ellipse?: unknown }; sideTags?: { outer?: string[] } };
const SIDE_FACE = /^(?:[^/|]*\/)?([A-Za-z0-9_-]+)(?:\.s\d+)?\.side(?:\[([^\]]+)\]|(\d+))(?:#\d+)?(?:@\d+)?$/;

/**
 * Whether an edge name (`n<k>.side[e17]|n<k>.top`, faces joined by `|`) bounds a side face generated from an ellipse outline: the face is a
 * `side[...]` (or positional `side<k>`) of a feature built on a sketch (an extrude, revolve or sweep: the `sketch` field is an index into `nodes`) whose main outline carries an `ellipse` definition
 * and the side is one of that outline's. A hole's or region's sides, and the sides of other sketches, are not.
 */
export function ellipseSideEdge(nodes: readonly NodeLike[], edgeName: string): boolean {
  for (const face of edgeName.split('|')) {
    const m = SIDE_FACE.exec(face); if (!m) continue;
    const feature = nodes.find((n, i) => (n.id ?? `n${i}`) === m[1]); // (the prefix is the feature's stable id, not its index)
    if (!feature || typeof feature.sketch !== 'number') continue;
    const sk = nodes[feature.sketch]; if (!sk || sk.kind !== 'sketch' || !sk.outline?.ellipse) continue;
    const outer = sk.sideTags?.outer;
    if (m[2] !== undefined ? !!outer?.includes(m[2]) : !outer && m[3] !== undefined) return true;
  }
  return false;
}
