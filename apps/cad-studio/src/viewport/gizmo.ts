// Direct manipulation in the viewport, as CAD tools draw it: a transform gizmo of a fixed size on screen
// (an arrow per axis, a square per plane to move in two axes at once, a quarter arc per axis facing the
// camera to turn about it) and feature handles (an arrow that drags one dimension). Pure geometry: what to
// draw in screen space for a camera, which handle a point hits, and what a drag means in mm or degrees.
// The viewport draws and dispatches; callers apply the values.
import type { Vec3 } from '../engine/mesh';

export type Axis3 = 0 | 1 | 2;
type XY = [number, number];
export interface TransformGizmo {
  /** Where the handles sit (world, mm). */
  origin: Vec3;
  /** Axes it moves along (with a plane square for each pair of them) and turns about (world X, Y, Z). */
  move?: readonly Axis3[];
  turn?: readonly Axis3[];
  /** Degrees a turn snaps to (default 15; Shift: 1), per axis when one axis is held to steps (90). */
  turnSnap?: (axis: Axis3) => number;
  /** The whole move from the drag's start (mm, snapped to 1 mm; Shift: 0.1), live and once more at the end. */
  onMove?(delta: Vec3, done: boolean): void;
  /** The whole turn from the drag's start (degrees, right-handed about the axis). */
  onTurn?(axis: Axis3, degrees: number, done: boolean): void;
}
/** One dimension dragged along a direction: `value` at the start, `toValue` maps the mm moved to the new value. */
export interface FeatureHandle {
  id: string; at: Vec3; dir: Vec3; label: string; value: number;
  /**
   * An angle instead (degrees): an arc about `axis` through `centre`, from `from` (a point on it) as far
   * as the value; dragging it round sweeps the angle, `toValue` getting the degrees swept.
   */
  arc?: { centre: Vec3; axis: Vec3; from: Vec3 };
  toValue(start: number, mm: number): number;
  format(value: number): string;
  onDrag(value: number, done: boolean): void;
}
export type GizmoHit = { kind: 'move' | 'turn'; axis: Axis3 } | { kind: 'plane'; axes: [Axis3, Axis3] } | { kind: 'handle'; index: number };
/** Screen projection, the camera's forward direction, and `size`: world mm that make the gizmo's full size on screen there. */
export interface Projector { project(p: Vec3): XY; forward: Vec3; size: number }

export const AXIS_COLORS = ['#e5534b', '#57b26b', '#4f8ff7'] as const;
export const GIZMO_PX = 84;
const unitAxis = (k: Axis3): Vec3 => { const a: Vec3 = [0, 0, 0]; a[k] = 1; return a; };
const at = (o: Vec3, terms: [Vec3, number][]): Vec3 => [0, 1, 2].map(k => terms.reduce((s, [d, t]) => s + d[k] * t, o[k])) as Vec3;
/** +1 or −1: which way along an axis faces the camera (handles sit on the near side). */
const toward = (P: Projector, k: Axis3) => P.forward[k] > 0 ? -1 : 1;
const PAIRS: [Axis3, Axis3][] = [[0, 1], [1, 2], [0, 2]];

/** The gizmo in screen space: arrows (shaft start and tip), plane squares and turn arcs (polylines). */
export function layout(g: TransformGizmo, P: Projector) {
  const o = P.project(g.origin), s = P.size, move = g.move ?? [];
  // An arrow pointing at the camera shrinks to a dot: it is left out (no reliable drag along it).
  const arrows = move.map(axis => ({ axis, from: P.project(at(g.origin, [[unitAxis(axis), 0.2 * s]])), to: P.project(at(g.origin, [[unitAxis(axis), s]])) }))
    .filter(a => Math.hypot(a.to[0] - o[0], a.to[1] - o[1]) >= 0.3 * GIZMO_PX);
  const planes = PAIRS.filter(([a, b]) => move.includes(a) && move.includes(b)).map(axes => {
    // Between the two arrows (positive axes), as CAD tools place them.
    const [a, b] = axes, ua = unitAxis(a), ub = unitAxis(b);
    const corner = (i: number, j: number) => P.project(at(g.origin, [[ua, s * i], [ub, s * j]]));
    return { axes, points: [corner(0.26, 0.26), corner(0.5, 0.26), corner(0.5, 0.5), corner(0.26, 0.5)] };
  });
  const arcs = (g.turn ?? []).map(axis => {
    const [u, v] = [((axis + 1) % 3) as Axis3, ((axis + 2) % 3) as Axis3], su = toward(P, u), sv = toward(P, v), r = 0.82 * s; // past the plane squares' corners (0.71)
    const points = Array.from({ length: 19 }, (_, i) => { const a = (0.06 + 0.88 * i / 18) * Math.PI / 2; return P.project(at(g.origin, [[unitAxis(u), su * r * Math.cos(a)], [unitAxis(v), sv * r * Math.sin(a)]])); });
    return { axis, points };
  });
  return { origin: o, arrows, planes, arcs };
}
/** Rodrigues: v turned by `a` radians about the unit axis k. */
function turn(v: Vec3, k: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a), d = v[0] * k[0] + v[1] * k[1] + v[2] * k[2];
  return [0, 1, 2].map(i => v[i] * c + (k[(i + 1) % 3] * v[(i + 2) % 3] - k[(i + 2) % 3] * v[(i + 1) % 3]) * s + k[i] * d * (1 - c)) as Vec3;
}
/** A handle in screen space: an arrow (from, to), or an arc's points ending at its tip. */
export function handleLayout(h: FeatureHandle, P: Projector): { from: XY; to: XY; points?: XY[] } {
  if (h.arc) {
    const { centre: c, axis: k0, from: f } = h.arc, l = Math.hypot(...k0) || 1, k: Vec3 = [k0[0] / l, k0[1] / l, k0[2] / l], r0: Vec3 = [f[0] - c[0], f[1] - c[1], f[2] - c[2]];
    const n = Math.max(2, Math.ceil(Math.abs(h.value) / 6)), points = Array.from({ length: n + 1 }, (_, i) => P.project(at(c, [[turn(r0, k, h.value * Math.PI / 180 * i / n), 1]])));
    return { from: points[0], to: points[points.length - 1], points };
  }
  return { from: P.project(h.at), to: P.project(at(h.at, [[h.dir, 0.62 * P.size]])) };
}

const segDist = (p: XY, a: XY, b: XY) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const insidePolygon = (p: XY, ring: XY[]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const polyDist = (p: XY, pts: XY[]) => pts.slice(1).reduce((m, q, i) => Math.min(m, segDist(p, pts[i], q)), Infinity);

/** The handle under a screen point: plane squares, then the nearest arrow, arc or feature handle within a few px. */
export function hitTest(p: XY, g: TransformGizmo | null, handles: readonly FeatureHandle[], P: Projector): GizmoHit | null {
  let best: GizmoHit | null = null, bestD = Infinity;
  const consider = (hit: GizmoHit, d: number, within: number) => { if (d <= within && d < bestD) { best = hit; bestD = d; } };
  if (g) {
    const L = layout(g, P);
    for (const q of L.planes) if (insidePolygon(p, q.points)) consider({ kind: 'plane', axes: q.axes }, 0, 1);
    for (const a of L.arrows) consider({ kind: 'move', axis: a.axis }, Math.min(segDist(p, a.from, a.to), Math.hypot(p[0] - a.to[0], p[1] - a.to[1]) - 4), 7);
    for (const r of L.arcs) consider({ kind: 'turn', axis: r.axis }, polyDist(p, r.points) + 0.5, 7);
  }
  handles.forEach((h, index) => { const l = handleLayout(h, P); consider({ kind: 'handle', index }, Math.min(l.points ? polyDist(p, l.points) : segDist(p, l.from, l.to), Math.hypot(p[0] - l.to[0], p[1] - l.to[1]) - 4), 8); });
  return best;
}

/** mm moved along a world direction for a screen drag (its screen image measures it). */
export function dragAlong(from: XY, to: XY, origin: Vec3, dir: Vec3, P: Projector): number {
  const a = P.project(origin), b = P.project(at(origin, [[dir, P.size]])), sx = b[0] - a[0], sy = b[1] - a[1], sl = Math.hypot(sx, sy);
  if (sl < 4) return 0; // pointing at the camera: no reliable drag along it
  return ((to[0] - from[0]) * sx + (to[1] - from[1]) * sy) / sl / sl * P.size;
}
/** mm moved along two world axes for a screen drag on their plane square (the drag split between their images). */
export function dragPlane(from: XY, to: XY, origin: Vec3, axes: [Axis3, Axis3], P: Projector): [number, number] {
  const o = P.project(origin), ea = P.project(at(origin, [[unitAxis(axes[0]), P.size]])), eb = P.project(at(origin, [[unitAxis(axes[1]), P.size]]));
  const ax = ea[0] - o[0], ay = ea[1] - o[1], bx = eb[0] - o[0], by = eb[1] - o[1], det = ax * by - ay * bx, dx = to[0] - from[0], dy = to[1] - from[1];
  if (Math.abs(det) < 16) return [0, 0]; // the plane seen edge-on
  return [(dx * by - dy * bx) / det * P.size, (ax * dy - ay * dx) / det * P.size];
}
/** Degrees turned about a world axis through `centre` for a screen drag (the angle swept round the centre's image). */
export function dragTurn(from: XY, to: XY, centre: Vec3, axis: Axis3, P: Projector): number {
  const c = P.project(centre), a0 = Math.atan2(from[1] - c[1], from[0] - c[0]), a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
  let d = (a1 - a0) * 180 / Math.PI; d = ((d + 540) % 360) - 180;
  // Screen y runs down: a counter-clockwise sweep on screen is clockwise in math axes. Seen from the
  // axis's tip (axis towards the camera) a right-handed turn sweeps counter-clockwise.
  return -P.forward[axis] >= 0 ? -d : d;
}
/** Degrees turned about any axis through `centre` for a screen drag (as dragTurn, for a direction not along X, Y or Z). */
export function dragAbout(from: XY, to: XY, centre: Vec3, axis: Vec3, P: Projector): number {
  const c = P.project(centre), a0 = Math.atan2(from[1] - c[1], from[0] - c[0]), a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
  let d = (a1 - a0) * 180 / Math.PI; d = ((d + 540) % 360) - 180;
  return -(axis[0] * P.forward[0] + axis[1] * P.forward[1] + axis[2] * P.forward[2]) >= 0 ? -d : d;
}
export const snapTo = (v: number, step: number) => Math.round(v / step) * step || 0;
