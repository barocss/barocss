import type { Vec3 } from '@barocss/cad-model/engine/mesh';

type PickFilter = 'all' | 'face' | 'edge' | 'body';
type EdgeEnds = { a: readonly number[]; b: readonly number[] };
/** The actual 7 px corner search used by hover and click. Explicit filters keep their own pick. */
export function pickVertex(filter: PickFilter, body: number | undefined, edges: readonly EdgeEnds[], x: number, y: number,
  project: (point: readonly number[]) => readonly number[], printedTop?: number): { body: number; at: Vec3 } | null {
  if (body === undefined || filter !== 'all') return null;
  let best: Vec3 | null = null, distance = 7;
  // Keep the existing endpoint order, strict radius and printed-layer exclusion.
  for (const edge of edges) for (let k = 0; k < 2; k++) {
    const point = k ? edge.b : edge.a;
    if (printedTop !== undefined && point[2] > printedTop + 1e-7) continue;
    const pixel = project(point), gap = Math.hypot(pixel[0] - x, pixel[1] - y);
    if (gap < distance) { distance = gap; best = [...point] as Vec3; }
  }
  return best ? { body, at: best } : null;
}
