// Picking outline points and edges in the viewport (screen pixels), and what a click does with the
// Select and Dimension tools.
import type { SketchState } from '../viewport/Viewport';
import { sampleSegment, type P2 } from './profile';
import { distanceKey, isSettled, samePick, type Polygon, type SketchPick } from './rules';

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
 * A click with the Select tool picks; with the Dimension tool an edge or arc opens its dimension and two
 * points (one click each) open the distance between them.
 */
export function sketchClick(s: SketchState, hit: SketchPick | null, additive: boolean): SketchState {
  const shape = s.shape;
  if (!isSettled(shape)) return { ...s, picked: [], editDim: null };
  if (s.tool !== 'dimension') return { ...s, picked: nextPicks(s.picked ?? [], hit, additive), editDim: null };
  if (!hit) return { ...s, picked: [], editDim: null };
  if (hit.kind === 'edge') return { ...s, picked: [], editDim: (shape.bulges?.[hit.i] ? 'rad' : 'len') + hit.i };
  const first = (s.picked ?? []).find(p => p.kind === 'point');
  if (first && first.i !== hit.i) return { ...s, picked: [], editDim: distanceKey(shape, first.i, hit.i) };
  return { ...s, picked: [hit], editDim: null };
}
