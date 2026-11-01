// Object snaps while sketching, as CAD sketchers have them: the pointer is drawn to the ends, middles,
// centres and quarter points of what is drawn, to the corners, edge middles and circle centres of the
// model where they lie in the sketch plane, and to the origin — the nearest within a few pixels on
// screen; else the 1 mm grid takes it.
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import { wellFormedBezier } from './bezier';
import { toLocal, type SketchPlane } from './plane';

type XY = [number, number];
export type SnapKind = 'end' | 'mid' | 'centre' | 'quadrant' | 'origin';
export interface SnapPoint { at: XY; kind: SnapKind }
/** The shapes the snaps come from (SketchShape, as far as its points go). */
export type SnapShape =
  | { kind: 'rectangle'; a: XY; b: XY }
  | { kind: 'circle'; c: XY; r: number }
  | { kind: 'polygon'; points: XY[]; closed: boolean; bulges?: number[] }
  | { kind: 'slot'; a: XY; b: XY; r: number }
  | { kind: 'bezier'; poles: XY[] };

const mid = (a: XY, b: XY): XY => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** A shape's snap points. `moving`: leave out the point the pointer is placing (a rectangle's far corner). */
export function shapeSnaps(s: SnapShape, moving = false): SnapPoint[] {
  switch (s.kind) {
    case 'rectangle': {
      if (moving) return [{ at: s.a, kind: 'end' }];
      const c: XY[] = [s.a, [s.b[0], s.a[1]], s.b, [s.a[0], s.b[1]]];
      return [...c.map(at => ({ at, kind: 'end' as const })), ...c.map((p, i) => ({ at: mid(p, c[(i + 1) % 4]), kind: 'mid' as const })), { at: mid(s.a, s.b), kind: 'centre' }];
    }
    case 'circle':
      return moving ? [{ at: s.c, kind: 'centre' }] : [{ at: s.c, kind: 'centre' }, ...[[1, 0], [0, 1], [-1, 0], [0, -1]].map(([u, v]) => ({ at: [s.c[0] + u * s.r, s.c[1] + v * s.r] as XY, kind: 'quadrant' as const }))];
    case 'slot': return moving ? [{ at: s.a, kind: 'centre' }] : [{ at: s.a, kind: 'centre' }, { at: s.b, kind: 'centre' }, { at: mid(s.a, s.b), kind: 'mid' }];
    // (A Bézier curve snaps to its end poles, not to the middle ones it does not pass through.)
    case 'bezier': return wellFormedBezier(s) ? [{ at: s.poles[0], kind: 'end' }, { at: s.poles[s.poles.length - 1], kind: 'end' }] : [];
    case 'polygon': {
      const out: SnapPoint[] = s.points.map(at => ({ at, kind: 'end' as const })), n = s.points.length;
      for (let i = 0; i < (s.closed ? n : n - 1); i++) if (!s.bulges?.[i]) out.push({ at: mid(s.points[i], s.points[(i + 1) % n]), kind: 'mid' });
      return out;
    }
  }
}

/** The circle through three points (null when in a line). */
function centre3(a: XY, b: XY, c: XY): XY | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-9) return null;
  const q = (p: XY) => p[0] * p[0] + p[1] * p[1];
  return [(q(a) * (b[1] - c[1]) + q(b) * (c[1] - a[1]) + q(c) * (a[1] - b[1])) / d, (q(a) * (c[0] - b[0]) + q(b) * (a[0] - c[0]) + q(c) * (b[0] - a[0])) / d];
}
/**
 * The model's snap points in the sketch plane: the ends and middles of edges lying in it (to `tol` mm)
 * and the centres of its curved ones, in plane coordinates.
 */
export function modelSnaps(meshes: readonly DisplayMesh[], plane: SketchPlane, tol = 1e-3): SnapPoint[] {
  const out: SnapPoint[] = [], n = plane.normal, o = plane.origin;
  const off = (p: readonly number[]) => (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1] + (p[2] - o[2]) * n[2];
  const round = (p: XY): XY => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];
  for (const m of meshes) {
    // Each edge's polyline (its display segments).
    const pts = new Map<number, Vec3[]>();
    for (let s = 0; s < m.edgeOfSegment.length; s += 2) {
      const e = m.edgeOfSegment[s], L = m.edgeLines, k = s * 3;
      const list = pts.get(e) ?? []; list.push([L[k], L[k + 1], L[k + 2]]); pts.set(e, list);
    }
    for (const e of m.edges) {
      if (Math.abs(off(e.a)) > tol || Math.abs(off(e.b)) > tol) continue;
      const a = toLocal(plane, [...e.a] as Vec3), b = toLocal(plane, [...e.b] as Vec3);
      if (e.straight) { out.push({ at: round(a), kind: 'end' }, { at: round(b), kind: 'end' }, { at: round(mid(a, b)), kind: 'mid' }); continue; }
      const poly = pts.get(e.index) ?? [];
      if (poly.length >= 3 && poly.every(p => Math.abs(off(p)) < tol * 10)) {
        const q = [poly[0], poly[Math.floor(poly.length / 3)], poly[Math.floor(2 * poly.length / 3)]].map(p => toLocal(plane, p));
        const c = centre3(q[0], q[1], q[2]); if (c) out.push({ at: round(c), kind: 'centre' });
      }
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-6) out.push({ at: round(a), kind: 'end' }, { at: round(b), kind: 'end' });
    }
  }
  return out;
}

/** The snap nearest the pointer on screen within `px`, given each point's screen position. */
export function nearestSnap(points: readonly SnapPoint[], screen: (p: XY) => XY, pointer: XY, px = 8): SnapPoint | null {
  let best: SnapPoint | null = null, d0 = px;
  for (const p of points) { const s = screen(p.at), d = Math.hypot(s[0] - pointer[0], s[1] - pointer[1]); if (d < d0) { d0 = d; best = p; } }
  return best;
}
