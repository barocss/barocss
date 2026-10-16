// Picking outline points and edges in the viewport (screen pixels), and what a click does with the
// Select and Dimension tools.
import type { SketchState } from '../viewport/Viewport';
import { sampleSegment, type P2 } from './profile';
import { angleKey, distanceKey, isSettled, samePick, type Polygon, type SketchPick } from './rules';

/** Plane coordinates → screen pixels. */
export type Project = (u: number, v: number) => readonly number[];

const toSegment = (p: readonly number[], a: readonly number[], b: readonly number[]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

/** The outline point within `pointPx` of (x, y), else the nearest edge within `edgePx`; null when nothing is near. */
export function pickSketch(s: Polygon, project: Project, x: number, y: number, pointPx = 9, edgePx = 7): SketchPick | null {
  const n = s.points.length, at = [x, y];
  let best: SketchPick | null = null, bestD = pointPx;
  for (let i = 0; i < n; i++) { const q = project(s.points[i][0], s.points[i][1]), d = Math.hypot(q[0] - x, q[1] - y); if (d <= bestD) { bestD = d; best = { kind: 'point', i }; } }
  if (best) return best;
  bestD = edgePx;
  for (let i = 0; i < n; i++) {
    const a = s.points[i] as P2, b = s.points[(i + 1) % n] as P2;
    const pts = [...sampleSegment(a, b, s.bulges?.[i] ?? 0, 16), b].map(p => project(p[0], p[1]));
    for (let k = 0; k + 1 < pts.length; k++) { const d = toSegment(at, pts[k], pts[k + 1]); if (d <= bestD) { bestD = d; best = { kind: 'edge', i }; } }
  }
  return best;
}

/** The selection after a click: replace, or toggle with Shift; empty space clears it. */
export function nextPicks(picks: readonly SketchPick[], hit: SketchPick | null, additive: boolean): SketchPick[] {
  if (!hit) return additive ? [...picks] : [];
  if (!additive) return [hit];
  return picks.some(p => samePick(p, hit)) ? picks.filter(p => !samePick(p, hit)) : [...picks, hit];
}

/**
 * A click with the Select tool picks; with the Dimension tool an edge or arc opens its dimension, a second
 * straight edge after a straight edge opens the angle between them, and two points (one click each) open
 * the distance between them.
 */
export function sketchClick(s: SketchState, hit: SketchPick | null, additive: boolean): SketchState {
  const shape = s.shape;
  if (!isSettled(shape)) return { ...s, picked: [], editDim: null };
  if (s.tool !== 'dimension') return { ...s, picked: nextPicks(s.picked ?? [], hit, additive), editDim: null };
  if (!hit) return { ...s, picked: [], editDim: null };
  if (hit.kind === 'edge') {
    const line = (i: number) => !shape.bulges?.[i], prev = (s.picked ?? []).find(p => p.kind === 'edge');
    if (prev && prev.i !== hit.i && line(prev.i) && line(hit.i)) return { ...s, picked: [], editDim: angleKey(prev.i, hit.i) };
    return { ...s, picked: line(hit.i) ? [hit] : [], editDim: (line(hit.i) ? 'len' : 'rad') + hit.i };
  }
  const first = (s.picked ?? []).find(p => p.kind === 'point');
  if (first && first.i !== hit.i) return { ...s, picked: [], editDim: distanceKey(shape, first.i, hit.i) };
  return { ...s, picked: [hit], editDim: null };
}

/** A rectangle as a closed four-edge outline (counter-clockwise from its lower-left corner) with its H/V edges kept; null when degenerate. */
export function rectangleOutline(r: Extract<NonNullable<SketchState['shape']>, { kind: 'rectangle' }>): Polygon | null {
  const x0 = Math.min(r.a[0], r.b[0]), x1 = Math.max(r.a[0], r.b[0]), y0 = Math.min(r.a[1], r.b[1]), y1 = Math.max(r.a[1], r.b[1]);
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  return { kind: 'polygon', points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], closed: true, bulges: [0, 0, 0, 0], hv: { h: [0, 2], v: [1, 3] }, fromRectangle: true };
}

/**
 * Switching to Select or Dimension: the current shape stays (a rectangle becomes an outline so its edges
 * take constraints and dimensions); with none, the last finished outline or rectangle comes back to edit.
 */
export function startPicking(s: SketchState, tool: 'select' | 'dimension'): SketchState {
  let shape = s.shape, done = s.done ?? [];
  if (shape?.kind === 'polygon' && shape.pending) shape = { ...shape, pending: false };
  const last = done[done.length - 1];
  if (!shape && (last?.kind === 'rectangle' || isSettled(last))) { shape = last; done = done.slice(0, -1); }
  if (shape?.kind === 'rectangle') shape = rectangleOutline(shape) ?? shape;
  return { ...s, tool, picked: [], editDim: null, shape, done };
}
